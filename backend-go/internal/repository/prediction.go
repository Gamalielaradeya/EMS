package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"

	"github.com/jackc/pgx/v5"
)

func (r *Repository) PredictionSettings(ctx context.Context) (model.PredictionSettings, error) {
	settings, err := r.settings(ctx, []string{
		"threshold_normal_max",
		"threshold_anomaly_min",
		"prediction_stale_ttl_minutes",
		"actual_temperature_match_tolerance_seconds",
	})
	if err != nil {
		return model.PredictionSettings{}, err
	}
	return model.PredictionSettings{
		ThresholdNormalMax:          floatSetting(settings, "threshold_normal_max", 30),
		ThresholdAnomalyMin:         floatSetting(settings, "threshold_anomaly_min", 32),
		PredictionStaleTTLMinutes:   intSetting(settings, "prediction_stale_ttl_minutes", 10),
		ActualMatchToleranceSeconds: intSetting(settings, "actual_temperature_match_tolerance_seconds", 60),
	}, nil
}

func (r *Repository) TelegramSettings(ctx context.Context) (model.TelegramSettings, error) {
	settings, err := r.settings(ctx, []string{
		"telegram_enabled",
		"telegram_bot_token",
		"telegram_chat_id",
		"telegram_cooldown_minutes",
	})
	if err != nil {
		return model.TelegramSettings{}, err
	}
	enabled, _ := strconv.ParseBool(settings["telegram_enabled"])
	return model.TelegramSettings{
		Enabled:         enabled,
		BotToken:        settings["telegram_bot_token"],
		ChatID:          settings["telegram_chat_id"],
		CooldownMinutes: intSetting(settings, "telegram_cooldown_minutes", 5),
	}, nil
}

func (r *Repository) RefreshPredictions(ctx context.Context, settings model.PredictionSettings) error {
	if _, err := r.db.Exec(ctx, `
		UPDATE predictions
		SET is_stale = TRUE
		WHERE is_stale = FALSE
		  AND predicted_for < NOW() - make_interval(mins => $1)`,
		settings.PredictionStaleTTLMinutes,
	); err != nil {
		return fmt.Errorf("mark stale predictions: %w", err)
	}
	// Use range condition instead of ABS(EXTRACT(EPOCH...)) so that
	// idx_sensor_readings_sensor_recorded(sensor_id, recorded_at) can be used.
	// ABS() on recorded_at prevents index scans (O(N×M) full scan).
	if _, err := r.db.Exec(ctx, `
		UPDATE predictions AS prediction
		SET actual_temperature = (
			SELECT sensor_readings.temperature::FLOAT8
			FROM sensor_readings
			JOIN sensors ON sensors.id = sensor_readings.sensor_id
			WHERE sensors.sensor_code = 'S2'
			  AND sensor_readings.recorded_at BETWEEN
			      prediction.predicted_for - make_interval(secs => $1::int)
			      AND prediction.predicted_for + make_interval(secs => $1::int)
			ORDER BY ABS(EXTRACT(EPOCH FROM (sensor_readings.recorded_at - prediction.predicted_for))) ASC
			LIMIT 1
		)
		WHERE prediction.actual_temperature IS NULL
		  AND prediction.predicted_for <= NOW()
		  AND EXISTS (
			SELECT 1
			FROM sensor_readings
			JOIN sensors ON sensors.id = sensor_readings.sensor_id
			WHERE sensors.sensor_code = 'S2'
			  AND sensor_readings.recorded_at BETWEEN
			      prediction.predicted_for - make_interval(secs => $1::int)
			      AND prediction.predicted_for + make_interval(secs => $1::int)
		  )`,
		settings.ActualMatchToleranceSeconds,
	); err != nil {
		return fmt.Errorf("match actual prediction temperature: %w", err)
	}
	return nil
}

func (r *Repository) InsertPrediction(
	ctx context.Context,
	input model.PredictionInput,
	thermalStatus string,
	finalStatus string,
	settings model.PredictionSettings,
	now time.Time,
) (model.Prediction, []model.SystemLog, bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.Prediction{}, nil, false, fmt.Errorf("begin prediction transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var sensorID int64
	var sensorHealth, gatewayStatus string
	err = tx.QueryRow(ctx, `
		SELECT sensors.id, sensors.sensor_health_status, COALESCE(gateways.status, 'offline')
		FROM sensors
		LEFT JOIN gateways ON gateways.id = sensors.gateway_id
		WHERE sensors.sensor_code = $1
		LIMIT 1`,
		input.TargetSensorCode,
	).Scan(&sensorID, &sensorHealth, &gatewayStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Prediction{}, nil, false, fmt.Errorf("%w: sensor %s", ErrNotFound, input.TargetSensorCode)
	}
	if err != nil {
		return model.Prediction{}, nil, false, fmt.Errorf("find prediction sensor: %w", err)
	}
	if sensorHealth != "normal" || gatewayStatus == "offline" || gatewayStatus == "trouble" {
		finalStatus = "trouble"
	}

	modelVersionID, modelVersion, warningLog, err := resolveModelVersion(ctx, tx, input)
	if err != nil {
		return model.Prediction{}, nil, false, err
	}
	systemLogs := make([]model.SystemLog, 0, 1)
	if warningLog != nil {
		systemLogs = append(systemLogs, *warningLog)
	}

	inputWindowStartAt, _ := time.Parse(time.RFC3339, input.InputWindowStartAt)
	inputWindowEndAt, _ := time.Parse(time.RFC3339, input.InputWindowEndAt)
	predictedFor, _ := time.Parse(time.RFC3339, input.PredictedFor)
	isStale := predictedFor.Before(now.Add(-time.Duration(settings.PredictionStaleTTLMinutes) * time.Minute))
	if modelVersionID != nil {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock($1)`, *modelVersionID); err != nil {
			return model.Prediction{}, nil, false, fmt.Errorf("lock prediction model: %w", err)
		}
		existing, err := scanPrediction(tx.QueryRow(ctx,
			predictionSelect+`
			WHERE predictions.model_version_id = $1
			  AND predictions.input_window_end_at = $2
			ORDER BY predictions.created_at DESC
			LIMIT 1`,
			*modelVersionID,
			inputWindowEndAt,
		))
		if err == nil {
			return existing, nil, false, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return model.Prediction{}, nil, false, fmt.Errorf("find duplicate prediction: %w", err)
		}
	}

	var actualTemperature *float64
	err = tx.QueryRow(ctx, `
		SELECT sensor_readings.temperature::FLOAT8
		FROM sensor_readings
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		WHERE sensors.sensor_code = 'S2'
		  AND ABS(EXTRACT(EPOCH FROM (sensor_readings.recorded_at - $1::TIMESTAMPTZ))) <= $2
		ORDER BY ABS(EXTRACT(EPOCH FROM (sensor_readings.recorded_at - $1::TIMESTAMPTZ))) ASC
		LIMIT 1`,
		predictedFor,
		settings.ActualMatchToleranceSeconds,
	).Scan(&actualTemperature)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return model.Prediction{}, nil, false, fmt.Errorf("find actual prediction temperature: %w", err)
	}

	prediction := model.Prediction{
		PredictionRunID:      input.PredictionRunID,
		ModelVersionID:       modelVersionID,
		ModelVersion:         modelVersion,
		TargetSensorID:       &sensorID,
		TargetSensor:         input.TargetSensorCode,
		PredictedTemperature: *input.PredictedTemperature,
		ActualTemperature:    actualTemperature,
		InputWindowStartAt:   &inputWindowStartAt,
		InputWindowEndAt:     &inputWindowEndAt,
		PredictedFor:         predictedFor,
		ThermalStatus:        thermalStatus,
		FinalStatus:          finalStatus,
		ThresholdNormalMax:   settings.ThresholdNormalMax,
		ThresholdAnomalyMin:  settings.ThresholdAnomalyMin,
		IsStale:              isStale,
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO predictions (
			prediction_run_id, model_version_id, target_sensor_id,
			predicted_temperature, actual_temperature, input_window_start_at,
			input_window_end_at, predicted_for, thermal_status, final_status,
			threshold_normal_max, threshold_anomaly_min, is_stale
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at`,
		prediction.PredictionRunID,
		prediction.ModelVersionID,
		prediction.TargetSensorID,
		prediction.PredictedTemperature,
		prediction.ActualTemperature,
		prediction.InputWindowStartAt,
		prediction.InputWindowEndAt,
		prediction.PredictedFor,
		prediction.ThermalStatus,
		prediction.FinalStatus,
		prediction.ThresholdNormalMax,
		prediction.ThresholdAnomalyMin,
		prediction.IsStale,
	).Scan(&prediction.ID, &prediction.CreatedAt)
	if err != nil {
		return model.Prediction{}, nil, false, fmt.Errorf("insert prediction: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return model.Prediction{}, nil, false, fmt.Errorf("commit prediction transaction: %w", err)
	}
	return prediction, systemLogs, true, nil
}

func (r *Repository) LatestPrediction(ctx context.Context) (*model.Prediction, error) {
	row := r.db.QueryRow(ctx, predictionSelect+` ORDER BY predictions.created_at DESC LIMIT 1`)
	prediction, err := scanPrediction(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &prediction, err
}

func (r *Repository) PredictionHistory(ctx context.Context, filters model.PredictionFilters) ([]model.Prediction, int64, error) {
	conditions, args := filterConditions(filters.FinalStatus, filters.From, filters.To, "predictions.final_status", "predictions.created_at")
	where := strings.Join(conditions, " AND ")
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM predictions WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count prediction history: %w", err)
	}
	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, predictionSelect+` WHERE `+where+`
		ORDER BY predictions.created_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, fmt.Errorf("prediction history: %w", err)
	}
	defer rows.Close()
	predictions := make([]model.Prediction, 0)
	for rows.Next() {
		prediction, err := scanPrediction(rows)
		if err != nil {
			return nil, 0, err
		}
		predictions = append(predictions, prediction)
	}
	return predictions, total, rows.Err()
}

func (r *Repository) ListModelVersions(ctx context.Context) ([]model.ModelVersion, error) {
	rows, err := r.db.Query(ctx, modelVersionSelect+` ORDER BY model_versions.trained_at DESC NULLS LAST, model_versions.id DESC`)
	if err != nil {
		return nil, fmt.Errorf("list model versions: %w", err)
	}
	defer rows.Close()
	models := make([]model.ModelVersion, 0)
	for rows.Next() {
		item, err := scanModelVersion(rows)
		if err != nil {
			return nil, err
		}
		models = append(models, item)
	}
	return models, rows.Err()
}

func (r *Repository) GetModelVersion(ctx context.Context, id int64) (model.ModelVersion, error) {
	item, err := scanModelVersion(r.db.QueryRow(ctx, modelVersionSelect+` WHERE model_versions.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return model.ModelVersion{}, ErrNotFound
	}
	return item, err
}

func (r *Repository) UpdateModelVersionName(ctx context.Context, id int64, name string) (model.ModelVersion, error) {
	commandTag, err := r.db.Exec(ctx, `UPDATE model_versions SET model_name = $1 WHERE id = $2`, strings.TrimSpace(name), id)
	if err != nil {
		return model.ModelVersion{}, fmt.Errorf("update model name: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		return model.ModelVersion{}, ErrNotFound
	}
	return r.GetModelVersion(ctx, id)
}

func (r *Repository) DeleteModelVersion(ctx context.Context, id int64) (model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("begin model delete transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var modelName string
	var isActive bool
	err = tx.QueryRow(ctx, `SELECT model_name, is_active FROM model_versions WHERE id = $1`, id).Scan(&modelName, &isActive)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.SystemLog{}, ErrNotFound
	}
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("get model before delete: %w", err)
	}
	if isActive {
		return model.SystemLog{}, fmt.Errorf("%w: active model cannot be deleted", ErrConflict)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM model_versions WHERE id = $1`, id); err != nil {
		return model.SystemLog{}, fmt.Errorf("delete model version: %w", err)
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Inactive model version deleted", map[string]any{
		"model_version_id": id,
		"model_name":       modelName,
	})
	if err != nil {
		return model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.SystemLog{}, err
	}
	return systemLog, nil
}

func (r *Repository) ActivateModelVersion(ctx context.Context, id int64) (model.ModelVersion, model.SystemLog, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return model.ModelVersion{}, model.SystemLog{}, fmt.Errorf("begin model activation transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM model_versions WHERE id = $1)`, id).Scan(&exists); err != nil {
		return model.ModelVersion{}, model.SystemLog{}, err
	}
	if !exists {
		return model.ModelVersion{}, model.SystemLog{}, ErrNotFound
	}
	if _, err := tx.Exec(ctx, `UPDATE model_versions SET is_active = FALSE WHERE is_active = TRUE`); err != nil {
		return model.ModelVersion{}, model.SystemLog{}, err
	}
	if _, err := tx.Exec(ctx, `UPDATE model_versions SET is_active = TRUE WHERE id = $1`, id); err != nil {
		return model.ModelVersion{}, model.SystemLog{}, err
	}
	systemLog, err := insertSystemLogTx(ctx, tx, "backend", "info", "Model version activated", map[string]any{"model_version_id": id})
	if err != nil {
		return model.ModelVersion{}, model.SystemLog{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return model.ModelVersion{}, model.SystemLog{}, err
	}
	item, err := r.GetModelVersion(ctx, id)
	return item, systemLog, err
}

func (r *Repository) LatestModelMetrics(ctx context.Context) (*model.ModelMetrics, error) {
	var metrics model.ModelMetrics
	err := r.db.QueryRow(ctx, `
		SELECT model_versions.version, model_metrics.dataset_start_at, model_metrics.dataset_end_at,
		       model_metrics.train_size, model_metrics.validation_size, model_metrics.test_size,
		       model_metrics.rmse::FLOAT8, model_metrics.mae::FLOAT8, model_metrics.mape::FLOAT8
		FROM model_metrics
		JOIN model_versions ON model_versions.id = model_metrics.model_version_id
		WHERE model_versions.is_active = TRUE
		ORDER BY model_metrics.created_at DESC
		LIMIT 1`,
	).Scan(&metrics.ModelVersion, &metrics.DatasetStartAt, &metrics.DatasetEndAt, &metrics.TrainSize, &metrics.ValidationSize, &metrics.TestSize, &metrics.RMSE, &metrics.MAE, &metrics.MAPE)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &metrics, err
}

func (r *Repository) LatestModelComparison(ctx context.Context) (*model.ModelComparison, error) {
	metrics, err := r.LatestModelMetrics(ctx)
	if err != nil || metrics == nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT baseline_results.baseline_type, baseline_results.rmse::FLOAT8,
		       baseline_results.mae::FLOAT8, baseline_results.mape::FLOAT8
		FROM baseline_results
		JOIN model_versions ON model_versions.id = baseline_results.model_version_id
		WHERE model_versions.is_active = TRUE
		ORDER BY baseline_results.baseline_type`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	comparison := &model.ModelComparison{
		ModelVersion: metrics.ModelVersion,
		LSTM:         model.MetricsSummary{RMSE: metrics.RMSE, MAE: metrics.MAE, MAPE: metrics.MAPE},
		Baselines:    make([]model.BaselineResult, 0),
	}
	for rows.Next() {
		var baseline model.BaselineResult
		if err := rows.Scan(&baseline.BaselineType, &baseline.RMSE, &baseline.MAE, &baseline.MAPE); err != nil {
			return nil, err
		}
		comparison.Baselines = append(comparison.Baselines, baseline)
	}
	return comparison, rows.Err()
}

func (r *Repository) InsertPredictionTransitionEvent(ctx context.Context, prediction model.Prediction) (*model.AnomalyEvent, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin prediction event transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	status := prediction.ThermalStatus
	description := "Predicted S2 temperature entered " + status + " range."
	if status == "normal" {
		description = "Predicted S2 temperature recovered to normal range."
	}
	code := prediction.TargetSensor
	event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
		PredictionID:         &prediction.ID,
		SensorID:             prediction.TargetSensorID,
		SensorCode:           &code,
		EventType:            "prediction_threshold",
		Status:               status,
		Severity:             statusSeverity(status),
		PredictedTemperature: &prediction.PredictedTemperature,
		ActualTemperature:    prediction.ActualTemperature,
		ThresholdNormalMax:   &prediction.ThresholdNormalMax,
		ThresholdAnomalyMin:  &prediction.ThresholdAnomalyMin,
		Description:          description,
		DetectedAt:           prediction.CreatedAt,
	})
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit prediction event transaction: %w", err)
	}
	return event, nil
}

func (r *Repository) LastSentNotificationAt(ctx context.Context, sensorID *int64, eventType, status string) (*time.Time, error) {
	var sentAt time.Time
	err := r.db.QueryRow(ctx, `
		SELECT notification_logs.sent_at
		FROM notification_logs
		JOIN anomaly_events ON anomaly_events.id = notification_logs.anomaly_event_id
		WHERE anomaly_events.sensor_id IS NOT DISTINCT FROM $1
		  AND anomaly_events.event_type = $2
		  AND anomaly_events.status = $3
		  AND notification_logs.channel = 'telegram'
		  AND notification_logs.status = 'sent'
		ORDER BY notification_logs.sent_at DESC
		LIMIT 1`,
		sensorID, eventType, status,
	).Scan(&sentAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	return &sentAt, err
}

func (r *Repository) InsertNotificationLog(ctx context.Context, item model.NotificationLog) (model.NotificationLog, error) {
	metadata, err := json.Marshal(item.Metadata)
	if err != nil {
		return model.NotificationLog{}, err
	}
	err = r.db.QueryRow(ctx, `
		INSERT INTO notification_logs (
			anomaly_event_id, channel, recipient, message, status, sent_at, error_message, metadata
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		item.AnomalyEventID, item.Channel, item.Recipient, item.Message, item.Status,
		item.SentAt, item.ErrorMessage, metadata,
	).Scan(&item.ID, &item.CreatedAt)
	return item, err
}

func (r *Repository) AnomalyEvents(ctx context.Context, filters model.EventFilters) ([]model.AnomalyEvent, int64, error) {
	conditions, args := filterConditions(filters.Status, filters.From, filters.To, "anomaly_events.status", "anomaly_events.detected_at")
	where := strings.Join(conditions, " AND ")
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM anomaly_events WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT anomaly_events.id, anomaly_events.prediction_id, anomaly_events.sensor_id, sensors.sensor_code,
		       anomaly_events.event_type, anomaly_events.status, anomaly_events.severity,
		       anomaly_events.predicted_temperature::FLOAT8, anomaly_events.actual_temperature::FLOAT8,
		       anomaly_events.description, anomaly_events.detected_at, anomaly_events.created_at
		FROM anomaly_events
		LEFT JOIN sensors ON sensors.id = anomaly_events.sensor_id
		WHERE `+where+`
		ORDER BY anomaly_events.detected_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]model.AnomalyEvent, 0)
	for rows.Next() {
		var item model.AnomalyEvent
		if err := rows.Scan(&item.ID, &item.PredictionID, &item.SensorID, &item.SensorCode, &item.EventType, &item.Status, &item.Severity, &item.PredictedTemperature, &item.ActualTemperature, &item.Description, &item.DetectedAt, &item.CreatedAt); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (r *Repository) NotificationLogs(ctx context.Context, filters model.EventFilters) ([]model.NotificationLog, int64, error) {
	conditions, args := filterConditions(filters.Status, filters.From, filters.To, "notification_logs.status", "notification_logs.created_at")
	where := strings.Join(conditions, " AND ")
	var total int64
	if err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM notification_logs WHERE `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT id, anomaly_event_id, channel, recipient, message, status, sent_at, error_message, metadata, created_at
		FROM notification_logs
		WHERE `+where+`
		ORDER BY created_at DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]model.NotificationLog, 0)
	for rows.Next() {
		var item model.NotificationLog
		var metadata []byte
		if err := rows.Scan(&item.ID, &item.AnomalyEventID, &item.Channel, &item.Recipient, &item.Message, &item.Status, &item.SentAt, &item.ErrorMessage, &metadata, &item.CreatedAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(metadata, &item.Metadata)
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func resolveModelVersion(ctx context.Context, tx pgx.Tx, input model.PredictionInput) (*int64, *string, *model.SystemLog, error) {
	var id int64
	var version string
	var err error
	switch {
	case input.ModelVersionID != nil:
		err = tx.QueryRow(ctx, `SELECT id, version FROM model_versions WHERE id = $1`, *input.ModelVersionID).Scan(&id, &version)
	case input.ModelVersion != "":
		err = tx.QueryRow(ctx, `SELECT id, version FROM model_versions WHERE version = $1 ORDER BY id DESC LIMIT 1`, input.ModelVersion).Scan(&id, &version)
	default:
		err = pgx.ErrNoRows
	}
	if err == nil {
		return &id, &version, nil, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, nil, fmt.Errorf("resolve model version: %w", err)
	}
	systemLog, logErr := insertSystemLogTx(ctx, tx, "backend", "warning", "Prediction accepted without matching model version", map[string]any{
		"model_version_id": input.ModelVersionID,
		"model_version":    input.ModelVersion,
		"mode":             "development_manual",
	})
	return nil, nil, &systemLog, logErr
}

func (r *Repository) settings(ctx context.Context, keys []string) (map[string]string, error) {
	rows, err := r.db.Query(ctx, `SELECT key, value FROM settings WHERE key = ANY($1)`, keys)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	settings := make(map[string]string)
	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			return nil, err
		}
		settings[key] = value
	}
	return settings, rows.Err()
}

func floatSetting(settings map[string]string, key string, fallback float64) float64 {
	value, err := strconv.ParseFloat(settings[key], 64)
	if err != nil {
		return fallback
	}
	return value
}

func intSetting(settings map[string]string, key string, fallback int) int {
	value, err := strconv.Atoi(settings[key])
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func filterConditions(status string, from, to *time.Time, statusColumn, timeColumn string) ([]string, []any) {
	conditions := []string{"TRUE"}
	args := make([]any, 0)
	add := func(condition string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}
	if status != "" {
		add(statusColumn+" = $%d", status)
	}
	if from != nil {
		add(timeColumn+" >= $%d", *from)
	}
	if to != nil {
		add(timeColumn+" <= $%d", *to)
	}
	return conditions, args
}

const predictionSelect = `
	SELECT predictions.id, predictions.prediction_run_id, predictions.model_version_id, model_versions.version,
	       predictions.target_sensor_id, COALESCE(sensors.sensor_code, 'S2'),
	       predictions.predicted_temperature::FLOAT8, predictions.actual_temperature::FLOAT8,
	       predictions.input_window_start_at, predictions.input_window_end_at, predictions.predicted_for,
	       predictions.thermal_status, predictions.final_status, predictions.threshold_normal_max::FLOAT8,
	       predictions.threshold_anomaly_min::FLOAT8, predictions.is_stale, predictions.created_at
	FROM predictions
	LEFT JOIN model_versions ON model_versions.id = predictions.model_version_id
	LEFT JOIN sensors ON sensors.id = predictions.target_sensor_id`

func scanPrediction(scanner rowScanner) (model.Prediction, error) {
	var item model.Prediction
	err := scanner.Scan(
		&item.ID, &item.PredictionRunID, &item.ModelVersionID, &item.ModelVersion,
		&item.TargetSensorID, &item.TargetSensor, &item.PredictedTemperature, &item.ActualTemperature,
		&item.InputWindowStartAt, &item.InputWindowEndAt, &item.PredictedFor, &item.ThermalStatus,
		&item.FinalStatus, &item.ThresholdNormalMax, &item.ThresholdAnomalyMin, &item.IsStale, &item.CreatedAt,
	)
	return item, err
}

const modelVersionSelect = `
	SELECT model_versions.id, model_versions.model_name, model_versions.model_type, model_versions.version,
	       model_versions.algorithm, model_versions.feature_columns, model_versions.target_column,
	       model_versions.window_size, model_versions.horizon_minutes, model_versions.raw_sampling_interval_seconds,
	       model_versions.resample_interval_seconds, model_versions.is_active, model_versions.trained_at,
	       model_versions.created_at, model_metrics.rmse::FLOAT8, model_metrics.mae::FLOAT8, model_metrics.mape::FLOAT8
	FROM model_versions
	LEFT JOIN LATERAL (
		SELECT rmse, mae, mape
		FROM model_metrics
		WHERE model_metrics.model_version_id = model_versions.id
		ORDER BY created_at DESC
		LIMIT 1
	) model_metrics ON TRUE`

func scanModelVersion(scanner rowScanner) (model.ModelVersion, error) {
	var item model.ModelVersion
	var featureColumns []byte
	var rmse, mae, mape *float64
	err := scanner.Scan(
		&item.ID, &item.ModelName, &item.ModelType, &item.Version, &item.Algorithm, &featureColumns,
		&item.TargetColumn, &item.WindowSize, &item.HorizonMinutes, &item.RawSamplingSeconds,
		&item.ResampleSeconds, &item.IsActive, &item.TrainedAt, &item.CreatedAt, &rmse, &mae, &mape,
	)
	if err == nil {
		_ = json.Unmarshal(featureColumns, &item.FeatureColumns)
		if rmse != nil && mae != nil && mape != nil {
			item.Metrics = &model.MetricsSummary{RMSE: *rmse, MAE: *mae, MAPE: *mape}
		}
	}
	return item, err
}
