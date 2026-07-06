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
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrNotFound = errors.New("record not found")

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Ping(ctx context.Context) error {
	return r.db.Ping(ctx)
}

func (r *Repository) BootstrapGatewayToken(ctx context.Context, gatewayCode, tokenHash string) error {
	commandTag, err := r.db.Exec(ctx, `
		INSERT INTO api_tokens (gateway_id, token_hash, name)
		SELECT gateways.id, $2, 'Gateway bootstrap token'
		FROM gateways
		WHERE gateways.gateway_code = $1
		  AND NOT EXISTS (
			  SELECT 1
			  FROM api_tokens
			  WHERE api_tokens.gateway_id = gateways.id
			    AND api_tokens.token_hash = $2
			    AND api_tokens.is_active = TRUE
		  )`,
		gatewayCode,
		tokenHash,
	)
	if err != nil {
		return fmt.Errorf("bootstrap gateway token: %w", err)
	}
	if commandTag.RowsAffected() == 0 {
		var gatewayExists bool
		if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM gateways WHERE gateway_code = $1)`, gatewayCode).Scan(&gatewayExists); err != nil {
			return fmt.Errorf("check gateway existence: %w", err)
		}
		if !gatewayExists {
			return fmt.Errorf("%w: gateway %s", ErrNotFound, gatewayCode)
		}
	}
	return nil
}

func (r *Repository) GatewayTokenValid(ctx context.Context, tokenHash string) (bool, error) {
	var valid bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM api_tokens
			JOIN gateways ON gateways.id = api_tokens.gateway_id
			WHERE api_tokens.token_hash = $1
			  AND api_tokens.is_active = TRUE
			  AND api_tokens.revoked_at IS NULL
		)`,
		tokenHash,
	).Scan(&valid)
	if err != nil {
		return false, fmt.Errorf("validate gateway token: %w", err)
	}
	if valid {
		if _, err := r.db.Exec(ctx, `
			UPDATE api_tokens
			SET last_used_at = NOW()
			WHERE token_hash = $1 AND is_active = TRUE AND revoked_at IS NULL`,
			tokenHash,
		); err != nil {
			return false, fmt.Errorf("update token usage: %w", err)
		}
	}
	return valid, nil
}

func (r *Repository) InsertReadings(
	ctx context.Context,
	gatewayCode string,
	recordedAt time.Time,
	source string,
	readings []model.ReadingInsert,
	rawPayload []byte,
	settings model.PredictionSettings,
) (int64, []model.AnomalyEvent, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return 0, nil, fmt.Errorf("begin readings transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	gatewayID, err := lookupGatewayID(ctx, tx, gatewayCode)
	if err != nil {
		return 0, nil, err
	}
	var previousGatewayStatus string
	var previousGatewayLastSeen *time.Time
	if err := tx.QueryRow(ctx, `SELECT status, last_seen_at FROM gateways WHERE id = $1`, gatewayID).Scan(&previousGatewayStatus, &previousGatewayLastSeen); err != nil {
		return 0, nil, fmt.Errorf("get gateway status before readings: %w", err)
	}
	isLatestGatewayReading := previousGatewayLastSeen == nil || !recordedAt.Before(*previousGatewayLastSeen)

	var storedCount int64
	events := make([]model.AnomalyEvent, 0)
	for _, reading := range readings {
		var sensorID int64
		var previousSensorHealth string
		var previousSensorLastSeen *time.Time
		err := tx.QueryRow(ctx, `
			SELECT id, sensor_health_status, last_seen_at
			FROM sensors
			WHERE gateway_id = $1 AND sensor_code = $2`,
			gatewayID,
			reading.SensorCode,
		).Scan(&sensorID, &previousSensorHealth, &previousSensorLastSeen)
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, nil, fmt.Errorf("%w: sensor %s", ErrNotFound, reading.SensorCode)
		}
		if err != nil {
			return 0, nil, fmt.Errorf("find sensor %s: %w", reading.SensorCode, err)
		}

		commandTag, err := tx.Exec(ctx, `
			INSERT INTO sensor_readings (
				gateway_id, sensor_id, temperature, humidity, recorded_at,
				quality_status, source, raw_payload
			)
			VALUES ($1, $2, $3, $4, $5, 'valid', $6, $7)
			ON CONFLICT (gateway_id, sensor_id, recorded_at) DO NOTHING`,
			gatewayID,
			sensorID,
			reading.Temperature,
			reading.Humidity,
			recordedAt,
			source,
			rawPayload,
		)
		if err != nil {
			return 0, nil, fmt.Errorf("insert sensor reading: %w", err)
		}
		inserted := commandTag.RowsAffected() > 0
		storedCount += commandTag.RowsAffected()
		isLatestSensorReading := previousSensorLastSeen == nil || !recordedAt.Before(*previousSensorLastSeen)

		if _, err := tx.Exec(ctx, `
			UPDATE sensors
			SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2),
			    sensor_health_status = CASE WHEN last_seen_at IS NULL OR $2 >= last_seen_at THEN 'normal' ELSE sensor_health_status END,
			    updated_at = NOW()
			WHERE id = $1`,
			sensorID,
			recordedAt,
		); err != nil {
			return 0, nil, fmt.Errorf("update sensor last seen: %w", err)
		}

		sensorCode := reading.SensorCode
		sensorIDCopy := sensorID
		if inserted && isLatestSensorReading {
			description := fmt.Sprintf("Actual %s temperature entered %s range.", sensorCode, reading.ThermalStatus)
			if reading.ThermalStatus == "normal" {
				description = fmt.Sprintf("Actual %s temperature recovered to normal.", sensorCode)
			}
			event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
				SensorID:            &sensorIDCopy,
				SensorCode:          &sensorCode,
				EventType:           "actual_threshold",
				Status:              reading.ThermalStatus,
				Severity:            statusSeverity(reading.ThermalStatus),
				ActualTemperature:   floatPointer(reading.Temperature),
				ThresholdNormalMax:  floatPointer(settings.ThresholdNormalMax),
				ThresholdAnomalyMin: floatPointer(settings.ThresholdAnomalyMin),
				Description:         description,
				DetectedAt:          recordedAt,
			})
			if err != nil {
				return 0, nil, err
			}
			if event != nil {
				events = append(events, *event)
			}
		}
		if isLatestSensorReading && previousSensorHealth == "trouble" {
			event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
				SensorID:    &sensorIDCopy,
				SensorCode:  &sensorCode,
				EventType:   "sensor_trouble",
				Status:      "normal",
				Severity:    "info",
				Description: fmt.Sprintf("Sensor %s recovered and is reporting readings.", sensorCode),
				DetectedAt:  recordedAt,
			})
			if err != nil {
				return 0, nil, err
			}
			if event != nil {
				events = append(events, *event)
			}
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gateways
		SET last_seen_at = GREATEST(COALESCE(last_seen_at, $2), $2),
		    status = CASE WHEN last_seen_at IS NULL OR $2 >= last_seen_at THEN 'active' ELSE status END,
		    updated_at = NOW()
		WHERE id = $1`,
		gatewayID,
		recordedAt,
	); err != nil {
		return 0, nil, fmt.Errorf("update gateway last seen: %w", err)
	}
	if isLatestGatewayReading && (previousGatewayStatus == "offline" || previousGatewayStatus == "trouble") {
		event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
			EventType:   "gateway_trouble",
			Status:      "normal",
			Severity:    "info",
			Description: fmt.Sprintf("Gateway %s recovered and is reporting readings.", gatewayCode),
			DetectedAt:  recordedAt,
		})
		if err != nil {
			return 0, nil, err
		}
		if event != nil {
			events = append(events, *event)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, nil, fmt.Errorf("commit readings transaction: %w", err)
	}
	return storedCount, events, nil
}

func (r *Repository) RecordGatewayStatus(ctx context.Context, input model.GatewayStatusInput, reportedAt time.Time) ([]model.SystemLog, []model.AnomalyEvent, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("begin gateway status transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	gatewayID, err := lookupGatewayID(ctx, tx, input.GatewayID)
	if err != nil {
		return nil, nil, err
	}

	var previousGatewayStatus string
	if err := tx.QueryRow(ctx, `SELECT status FROM gateways WHERE id = $1`, gatewayID).Scan(&previousGatewayStatus); err != nil {
		return nil, nil, fmt.Errorf("get gateway status: %w", err)
	}

	if _, err := tx.Exec(ctx, `
		UPDATE gateways
		SET status = $2,
		    last_seen_at = GREATEST(COALESCE(last_seen_at, $3), $3),
		    updated_at = NOW()
		WHERE id = $1`,
		gatewayID,
		input.Status,
		reportedAt,
	); err != nil {
		return nil, nil, fmt.Errorf("update gateway status: %w", err)
	}

	payload, err := json.Marshal(input)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal gateway status payload: %w", err)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO gateway_status_logs (gateway_id, status, message, payload, reported_at)
		VALUES ($1, $2, $3, $4, $5)`,
		gatewayID,
		input.Status,
		input.Message,
		payload,
		reportedAt,
	); err != nil {
		return nil, nil, fmt.Errorf("insert gateway status log: %w", err)
	}

	systemLogs := make([]model.SystemLog, 0)
	events := make([]model.AnomalyEvent, 0)
	if previousGatewayStatus != input.Status && (input.Status == "offline" || input.Status == "trouble") {
		systemLog, err := insertSystemLogTx(ctx, tx, "backend", "error", "Gateway status changed to "+input.Status, map[string]any{
			"entity":       "gateway",
			"gateway_code": input.GatewayID,
			"status":       input.Status,
		})
		if err != nil {
			return nil, nil, err
		}
		systemLogs = append(systemLogs, systemLog)
	}
	if previousGatewayStatus != input.Status {
		status := ""
		description := ""
		if input.Status == "offline" || input.Status == "trouble" {
			status = "trouble"
			description = "Gateway " + input.GatewayID + " changed to " + input.Status + "."
		} else if input.Status == "active" {
			status = "normal"
			description = "Gateway " + input.GatewayID + " recovered to active."
		}
		if status != "" {
			event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
				EventType:   "gateway_trouble",
				Status:      status,
				Severity:    statusSeverity(status),
				Description: description,
				DetectedAt:  reportedAt,
			})
			if err != nil {
				return nil, nil, err
			}
			if event != nil {
				events = append(events, *event)
			}
		}
	}

	for _, sensor := range input.Sensors {
		var previousSensorStatus string
		err := tx.QueryRow(ctx, `
			SELECT sensor_health_status
			FROM sensors
			WHERE gateway_id = $1 AND sensor_code = $2`,
			gatewayID,
			sensor.SensorCode,
		).Scan(&previousSensorStatus)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, fmt.Errorf("%w: sensor %s", ErrNotFound, sensor.SensorCode)
		}
		if err != nil {
			return nil, nil, fmt.Errorf("get sensor status: %w", err)
		}

		commandTag, err := tx.Exec(ctx, `
			UPDATE sensors
			SET sensor_health_status = $3,
			    updated_at = NOW()
			WHERE gateway_id = $1 AND sensor_code = $2`,
			gatewayID,
			sensor.SensorCode,
			sensor.Status,
		)
		if err != nil {
			return nil, nil, fmt.Errorf("update sensor status: %w", err)
		}
		if commandTag.RowsAffected() == 0 {
			return nil, nil, fmt.Errorf("%w: sensor %s", ErrNotFound, sensor.SensorCode)
		}
		if previousSensorStatus != sensor.Status && sensor.Status == "trouble" {
			systemLog, err := insertSystemLogTx(ctx, tx, "backend", "error", "Sensor "+sensor.SensorCode+" status changed to trouble", map[string]any{
				"entity":      "sensor",
				"sensor_code": sensor.SensorCode,
				"status":      sensor.Status,
				"message":     sensor.Message,
			})
			if err != nil {
				return nil, nil, err
			}
			systemLogs = append(systemLogs, systemLog)
		}
		if previousSensorStatus != sensor.Status && (sensor.Status == "trouble" || sensor.Status == "normal") {
			sensorCode := sensor.SensorCode
			var sensorID int64
			if err := tx.QueryRow(ctx, `SELECT id FROM sensors WHERE gateway_id = $1 AND sensor_code = $2`, gatewayID, sensor.SensorCode).Scan(&sensorID); err != nil {
				return nil, nil, fmt.Errorf("get sensor id for event: %w", err)
			}
			status := sensor.Status
			description := "Sensor " + sensor.SensorCode + " changed to trouble."
			if status == "normal" {
				description = "Sensor " + sensor.SensorCode + " recovered to normal."
			}
			event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
				SensorID:    &sensorID,
				SensorCode:  &sensorCode,
				EventType:   "sensor_trouble",
				Status:      status,
				Severity:    statusSeverity(status),
				Description: description,
				DetectedAt:  reportedAt,
			})
			if err != nil {
				return nil, nil, err
			}
			if event != nil {
				events = append(events, *event)
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("commit gateway status transaction: %w", err)
	}
	return systemLogs, events, nil
}

func (r *Repository) ListSensors(ctx context.Context) ([]model.Sensor, error) {
	rows, err := r.db.Query(ctx, sensorSelect+` ORDER BY sensors.sensor_code`)
	if err != nil {
		return nil, fmt.Errorf("list sensors: %w", err)
	}
	defer rows.Close()

	sensors := make([]model.Sensor, 0)
	for rows.Next() {
		sensor, err := scanSensor(rows)
		if err != nil {
			return nil, err
		}
		sensors = append(sensors, sensor)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate sensors: %w", err)
	}
	return sensors, nil
}

func (r *Repository) GetSensor(ctx context.Context, gatewayCode, sensorCode string) (model.Sensor, error) {
	row := r.db.QueryRow(ctx, sensorSelect+` WHERE gateways.gateway_code = $1 AND sensors.sensor_code = $2`, gatewayCode, sensorCode)
	sensor, err := scanSensor(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Sensor{}, ErrNotFound
	}
	return sensor, err
}

func (r *Repository) UpdateSensor(ctx context.Context, gatewayCode, sensorCode string, input model.SensorUpdateInput) (model.Sensor, error) {
	row := r.db.QueryRow(ctx, `
		UPDATE sensors
		SET name = COALESCE($3, name),
		    location = COALESCE($4, location),
		    modbus_slave_id = COALESCE($5, modbus_slave_id),
		    sensor_health_status = COALESCE($6, sensor_health_status),
		    updated_at = NOW()
		WHERE sensor_code = $1
		  AND gateway_id = (SELECT id FROM gateways WHERE gateway_code = $2)
		RETURNING id`,
		sensorCode,
		gatewayCode,
		input.Name,
		input.Location,
		input.ModbusSlaveID,
		input.SensorHealthStatus,
	)
	var sensorID int64
	if err := row.Scan(&sensorID); errors.Is(err, pgx.ErrNoRows) {
		return model.Sensor{}, ErrNotFound
	} else if err != nil {
		return model.Sensor{}, fmt.Errorf("update sensor: %w", err)
	}
	return r.GetSensor(ctx, gatewayCode, sensorCode)
}

func (r *Repository) LatestReadings(ctx context.Context) (map[string]model.Reading, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT ON (sensors.sensor_code)
			sensor_readings.id,
			gateways.gateway_code,
			sensors.sensor_code,
			sensors.sensor_role,
			sensor_readings.temperature::FLOAT8,
			sensor_readings.humidity::FLOAT8,
			sensor_readings.recorded_at,
			sensor_readings.quality_status,
			sensor_readings.source
		FROM sensor_readings
		JOIN gateways ON gateways.id = sensor_readings.gateway_id
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		ORDER BY sensors.sensor_code, sensor_readings.recorded_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("latest readings: %w", err)
	}
	defer rows.Close()

	readings := map[string]model.Reading{}
	for rows.Next() {
		reading, err := scanReading(rows)
		if err != nil {
			return nil, err
		}
		readings[reading.SensorCode] = reading
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate latest readings: %w", err)
	}
	return readings, nil
}

func (r *Repository) ReadingHistory(ctx context.Context, filters model.ReadingFilters) ([]model.Reading, int64, error) {
	conditions := []string{"TRUE"}
	args := make([]any, 0)
	addCondition := func(condition string, value any) {
		args = append(args, value)
		conditions = append(conditions, fmt.Sprintf(condition, len(args)))
	}
	if filters.SensorCode != "" {
		addCondition("sensors.sensor_code = $%d", filters.SensorCode)
	}
	if filters.QualityStatus != "" {
		addCondition("sensor_readings.quality_status = $%d", filters.QualityStatus)
	}
	if filters.From != nil {
		addCondition("sensor_readings.recorded_at >= $%d", *filters.From)
	}
	if filters.To != nil {
		addCondition("sensor_readings.recorded_at <= $%d", *filters.To)
	}

	where := strings.Join(conditions, " AND ")
	var total int64
	if err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM sensor_readings
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		WHERE `+where,
		args...,
	).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count reading history: %w", err)
	}

	args = append(args, filters.Limit, filters.Offset)
	rows, err := r.db.Query(ctx, `
		SELECT
			sensor_readings.id,
			gateways.gateway_code,
			sensors.sensor_code,
			sensors.sensor_role,
			sensor_readings.temperature::FLOAT8,
			sensor_readings.humidity::FLOAT8,
			sensor_readings.recorded_at,
			sensor_readings.quality_status,
			sensor_readings.source
		FROM sensor_readings
		JOIN gateways ON gateways.id = sensor_readings.gateway_id
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		WHERE `+where+`
		ORDER BY sensor_readings.recorded_at DESC, sensor_readings.id DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)),
		args...,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("reading history: %w", err)
	}
	defer rows.Close()

	readings := make([]model.Reading, 0)
	for rows.Next() {
		reading, err := scanReading(rows)
		if err != nil {
			return nil, 0, err
		}
		readings = append(readings, reading)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterate reading history: %w", err)
	}
	return readings, total, nil
}

func (r *Repository) DashboardSummary(ctx context.Context, gatewayCode string) (model.DashboardSummary, error) {
	settings, err := r.PredictionSettings(ctx)
	if err != nil {
		return model.DashboardSummary{}, err
	}
	if err := r.RefreshPredictions(ctx, settings); err != nil {
		return model.DashboardSummary{}, err
	}
	summary := model.DashboardSummary{
		LatestReadings:              make(map[string]model.DashboardReading),
		OverallCurrentThermalStatus: "normal",
		RecentEvents:                make([]model.DashboardEvent, 0),
	}

	var gateway model.GatewaySummary
	err = r.db.QueryRow(ctx, `
		SELECT gateway_code, status, last_seen_at
		FROM gateways
		WHERE gateway_code = $1`,
		gatewayCode,
	).Scan(&gateway.GatewayCode, &gateway.Status, &gateway.LastSeenAt)
	if err == nil {
		summary.Gateway = &gateway
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard gateway: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT ON (sensors.sensor_code)
			sensors.sensor_code,
			sensors.sensor_role,
			sensor_readings.temperature::FLOAT8,
			sensor_readings.humidity::FLOAT8,
			sensors.sensor_health_status,
			sensor_readings.quality_status,
			sensor_readings.recorded_at
		FROM sensor_readings
		JOIN sensors ON sensors.id = sensor_readings.sensor_id
		JOIN gateways ON gateways.id = sensor_readings.gateway_id
		WHERE gateways.gateway_code = $1
		ORDER BY sensors.sensor_code, sensor_readings.recorded_at DESC`,
		gatewayCode,
	)
	if err != nil {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard latest readings: %w", err)
	}
	for rows.Next() {
		var reading model.DashboardReading
		if err := rows.Scan(
			&reading.SensorCode,
			&reading.SensorRole,
			&reading.Temperature,
			&reading.Humidity,
			&reading.SensorHealthStatus,
			&reading.QualityStatus,
			&reading.RecordedAt,
		); err != nil {
			rows.Close()
			return model.DashboardSummary{}, fmt.Errorf("scan dashboard reading: %w", err)
		}
		reading.CurrentThermalStatus = classifyCurrentThermalStatus(reading.Temperature, settings)
		summary.LatestReadings[reading.SensorCode] = reading
		readingSeverity := currentThermalSeverity(reading.CurrentThermalStatus)
		overallSeverity := currentThermalSeverity(summary.OverallCurrentThermalStatus)
		if summary.OverallCurrentThermalSourceSensor == nil ||
			readingSeverity > overallSeverity ||
			(readingSeverity == overallSeverity && reading.SensorCode == "S2") {
			summary.OverallCurrentThermalStatus = reading.CurrentThermalStatus
			sourceSensor := reading.SensorCode
			summary.OverallCurrentThermalSourceSensor = &sourceSensor
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return model.DashboardSummary{}, fmt.Errorf("iterate dashboard readings: %w", err)
	}
	rows.Close()

	var prediction model.PredictionSummary
	err = r.db.QueryRow(ctx, `
		SELECT
			predictions.id,
			COALESCE(sensors.sensor_code, 'S2'),
			predictions.predicted_temperature::FLOAT8,
			predictions.predicted_for,
			predictions.thermal_status,
			predictions.final_status,
			model_versions.version,
			predictions.is_stale
		FROM predictions
		LEFT JOIN sensors ON sensors.id = predictions.target_sensor_id
		LEFT JOIN model_versions ON model_versions.id = predictions.model_version_id
		WHERE predictions.is_stale = FALSE
		ORDER BY predictions.created_at DESC
		LIMIT 1`,
	).Scan(
		&prediction.ID,
		&prediction.TargetSensor,
		&prediction.PredictedTemperature,
		&prediction.PredictedFor,
		&prediction.ThermalStatus,
		&prediction.FinalStatus,
		&prediction.ModelVersion,
		&prediction.IsStale,
	)
	if err == nil {
		summary.LatestPrediction = &prediction
		summary.PredictionThermalStatus = &prediction.ThermalStatus
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard latest prediction: %w", err)
	}

	var activeModel model.ActiveModelSummary
	err = r.db.QueryRow(ctx, `
		SELECT id, version, trained_at
		FROM model_versions
		WHERE is_active = TRUE
		LIMIT 1`,
	).Scan(&activeModel.ID, &activeModel.Version, &activeModel.TrainedAt)
	if err == nil {
		summary.ActiveModel = &activeModel
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard active model: %w", err)
	}

	var metrics model.MetricsSummary
	err = r.db.QueryRow(ctx, `
		SELECT model_metrics.rmse::FLOAT8, model_metrics.mae::FLOAT8, model_metrics.mape::FLOAT8
		FROM model_metrics
		JOIN model_versions ON model_versions.id = model_metrics.model_version_id
		WHERE model_versions.is_active = TRUE
		ORDER BY model_metrics.created_at DESC
		LIMIT 1`,
	).Scan(&metrics.RMSE, &metrics.MAE, &metrics.MAPE)
	if err == nil {
		summary.LatestMetrics = &metrics
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard latest metrics: %w", err)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM sensor_readings WHERE recorded_at >= date_trunc('day', NOW())),
			(SELECT COUNT(*) FROM anomaly_events WHERE status = 'waspada' AND detected_at >= date_trunc('day', NOW())),
			(SELECT COUNT(*) FROM anomaly_events WHERE status = 'anomali' AND detected_at >= date_trunc('day', NOW())),
			(SELECT COUNT(*) FROM anomaly_events WHERE event_type = 'actual_threshold' AND status IN ('waspada', 'anomali') AND detected_at >= date_trunc('day', NOW())),
			(SELECT CASE WHEN EXISTS (
				SELECT 1
				FROM predictions
				WHERE is_stale = FALSE
				  AND predicted_for > NOW()
				  AND thermal_status IN ('waspada', 'anomali')
			) THEN 1 ELSE 0 END),
			(SELECT COUNT(*) FROM anomaly_events WHERE event_type IN ('sensor_trouble', 'gateway_trouble') AND status = 'trouble' AND detected_at >= date_trunc('day', NOW()))`,
	).Scan(
		&summary.TodaySummary.TotalReadings,
		&summary.TodaySummary.TotalWaspada,
		&summary.TodaySummary.TotalAnomali,
		&summary.TodaySummary.TotalAlarm,
		&summary.TodaySummary.TotalPreAlarm,
		&summary.TodaySummary.TotalTrouble,
	); err != nil {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard today summary: %w", err)
	}

	var telegramEnabled string
	err = r.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'telegram_enabled'`).Scan(&telegramEnabled)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get telegram enabled setting: %w", err)
	}
	summary.Telegram.Enabled, _ = strconv.ParseBool(telegramEnabled)
	err = r.db.QueryRow(ctx, `
		SELECT status
		FROM notification_logs
		WHERE channel = 'telegram'
		ORDER BY created_at DESC
		LIMIT 1`,
	).Scan(&summary.Telegram.LastStatus)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return model.DashboardSummary{}, fmt.Errorf("get latest telegram notification status: %w", err)
	}

	rows, err = r.db.Query(ctx, `
		SELECT anomaly_events.id, sensors.sensor_code, anomaly_events.event_type, anomaly_events.status, anomaly_events.severity,
		       anomaly_events.description, anomaly_events.detected_at
		FROM anomaly_events
		LEFT JOIN sensors ON sensors.id = anomaly_events.sensor_id
		ORDER BY anomaly_events.detected_at DESC
		LIMIT 10`)
	if err != nil {
		return model.DashboardSummary{}, fmt.Errorf("get dashboard recent events: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var event model.DashboardEvent
		if err := rows.Scan(
			&event.ID,
			&event.SensorCode,
			&event.EventType,
			&event.Status,
			&event.Severity,
			&event.Description,
			&event.DetectedAt,
		); err != nil {
			return model.DashboardSummary{}, fmt.Errorf("scan dashboard event: %w", err)
		}
		summary.RecentEvents = append(summary.RecentEvents, event)
	}
	if err := rows.Err(); err != nil {
		return model.DashboardSummary{}, fmt.Errorf("iterate dashboard events: %w", err)
	}

	return summary, nil
}

func (r *Repository) InsertSystemLog(ctx context.Context, source, level, message string, context map[string]any) (model.SystemLog, error) {
	return insertSystemLog(ctx, r.db, source, level, message, context)
}

func classifyCurrentThermalStatus(temperature float64, settings model.PredictionSettings) string {
	if temperature < settings.ThresholdNormalMax {
		return "normal"
	}
	if temperature <= settings.ThresholdAnomalyMin {
		return "waspada"
	}
	return "anomali"
}

func currentThermalSeverity(status string) int {
	switch status {
	case "anomali":
		return 2
	case "waspada":
		return 1
	default:
		return 0
	}
}

func (r *Repository) MarkOfflineStatuses(ctx context.Context, now time.Time, fallbackTimeoutMinutes int) ([]model.StatusChange, error) {
	timeoutMinutes := fallbackTimeoutMinutes
	var configuredTimeout string
	err := r.db.QueryRow(ctx, `SELECT value FROM settings WHERE key = 'sensor_timeout_minutes'`).Scan(&configuredTimeout)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("get sensor timeout setting: %w", err)
	}
	if parsed, parseErr := strconv.Atoi(configuredTimeout); parseErr == nil && parsed > 0 {
		timeoutMinutes = parsed
	}
	cutoff := now.Add(-time.Duration(timeoutMinutes) * time.Minute)

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin offline status transaction: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	changes := make([]model.StatusChange, 0)
	rows, err := tx.Query(ctx, `
		UPDATE gateways
		SET status = 'offline', updated_at = NOW()
		WHERE last_seen_at IS NOT NULL
		  AND last_seen_at < $1
		  AND status NOT IN ('offline', 'maintenance')
		RETURNING gateway_code`,
		cutoff,
	)
	if err != nil {
		return nil, fmt.Errorf("mark gateways offline: %w", err)
	}
	offlineGateways := make([]string, 0)
	for rows.Next() {
		var gatewayCode string
		if err := rows.Scan(&gatewayCode); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan offline gateway: %w", err)
		}
		offlineGateways = append(offlineGateways, gatewayCode)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("iterate offline gateways: %w", err)
	}
	rows.Close()
	for _, gatewayCode := range offlineGateways {
		systemLog, err := insertSystemLogTx(ctx, tx, "backend", "error", "Gateway "+gatewayCode+" changed to offline after timeout", map[string]any{
			"entity":          "gateway",
			"gateway_code":    gatewayCode,
			"status":          "offline",
			"timeout_minutes": timeoutMinutes,
		})
		if err != nil {
			rows.Close()
			return nil, err
		}
		event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
			EventType:   "gateway_trouble",
			Status:      "trouble",
			Severity:    "error",
			Description: "Gateway " + gatewayCode + " changed to offline after timeout.",
			DetectedAt:  now,
		})
		if err != nil {
			return nil, err
		}
		changes = append(changes, model.StatusChange{Entity: "gateway", Code: gatewayCode, Status: "offline", Log: systemLog, Event: event})
	}

	rows, err = tx.Query(ctx, `
		UPDATE sensors
		SET sensor_health_status = 'trouble', updated_at = NOW()
		WHERE last_seen_at IS NOT NULL
		  AND last_seen_at < $1
		  AND sensor_health_status = 'normal'
		RETURNING id, sensor_code`,
		cutoff,
	)
	if err != nil {
		return nil, fmt.Errorf("mark sensors trouble: %w", err)
	}
	type troubleSensor struct {
		id   int64
		code string
	}
	troubleSensors := make([]troubleSensor, 0)
	for rows.Next() {
		var sensor troubleSensor
		if err := rows.Scan(&sensor.id, &sensor.code); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scan trouble sensor: %w", err)
		}
		troubleSensors = append(troubleSensors, sensor)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("iterate trouble sensors: %w", err)
	}
	rows.Close()
	for _, sensor := range troubleSensors {
		systemLog, err := insertSystemLogTx(ctx, tx, "backend", "error", "Sensor "+sensor.code+" changed to trouble after timeout", map[string]any{
			"entity":          "sensor",
			"sensor_code":     sensor.code,
			"status":          "trouble",
			"timeout_minutes": timeoutMinutes,
		})
		if err != nil {
			rows.Close()
			return nil, err
		}
		sensorCode := sensor.code
		event, err := insertTransitionEventTx(ctx, tx, transitionEventInput{
			SensorID:    &sensor.id,
			SensorCode:  &sensorCode,
			EventType:   "sensor_trouble",
			Status:      "trouble",
			Severity:    "error",
			Description: "Sensor " + sensor.code + " changed to trouble after timeout.",
			DetectedAt:  now,
		})
		if err != nil {
			return nil, err
		}
		changes = append(changes, model.StatusChange{Entity: "sensor", Code: sensor.code, Status: "trouble", Log: systemLog, Event: event})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit offline status transaction: %w", err)
	}
	return changes, nil
}

type systemLogQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func insertSystemLog(ctx context.Context, querier systemLogQuerier, source, level, message string, logContext map[string]any) (model.SystemLog, error) {
	payload, err := json.Marshal(logContext)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("marshal system log context: %w", err)
	}
	systemLog := model.SystemLog{
		Source:  source,
		Level:   level,
		Message: message,
		Context: logContext,
	}
	err = querier.QueryRow(ctx, `
		INSERT INTO system_logs (source, level, message, context)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at`,
		source,
		level,
		message,
		payload,
	).Scan(&systemLog.ID, &systemLog.CreatedAt)
	if err != nil {
		return model.SystemLog{}, fmt.Errorf("insert system log: %w", err)
	}
	return systemLog, nil
}

func insertSystemLogTx(ctx context.Context, tx pgx.Tx, source, level, message string, logContext map[string]any) (model.SystemLog, error) {
	return insertSystemLog(ctx, tx, source, level, message, logContext)
}

func lookupGatewayID(ctx context.Context, tx pgx.Tx, gatewayCode string) (int64, error) {
	var gatewayID int64
	err := tx.QueryRow(ctx, `SELECT id FROM gateways WHERE gateway_code = $1`, gatewayCode).Scan(&gatewayID)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("%w: gateway %s", ErrNotFound, gatewayCode)
	}
	if err != nil {
		return 0, fmt.Errorf("find gateway: %w", err)
	}
	return gatewayID, nil
}

const sensorSelect = `
	SELECT
		sensors.id,
		gateways.gateway_code,
		sensors.sensor_code,
		sensors.sensor_role,
		sensors.name,
		sensors.type,
		sensors.location,
		sensors.modbus_slave_id,
		sensors.sensor_health_status,
		sensors.last_seen_at,
		sensors.created_at,
		sensors.updated_at
	FROM sensors
	LEFT JOIN gateways ON gateways.id = sensors.gateway_id`

type rowScanner interface {
	Scan(dest ...any) error
}

func scanSensor(scanner rowScanner) (model.Sensor, error) {
	var sensor model.Sensor
	if err := scanner.Scan(
		&sensor.ID,
		&sensor.GatewayCode,
		&sensor.SensorCode,
		&sensor.SensorRole,
		&sensor.Name,
		&sensor.Type,
		&sensor.Location,
		&sensor.ModbusSlaveID,
		&sensor.SensorHealthStatus,
		&sensor.LastSeenAt,
		&sensor.CreatedAt,
		&sensor.UpdatedAt,
	); err != nil {
		return model.Sensor{}, err
	}
	return sensor, nil
}

func scanReading(scanner rowScanner) (model.Reading, error) {
	var reading model.Reading
	if err := scanner.Scan(
		&reading.ID,
		&reading.GatewayCode,
		&reading.SensorCode,
		&reading.SensorRole,
		&reading.Temperature,
		&reading.Humidity,
		&reading.RecordedAt,
		&reading.QualityStatus,
		&reading.Source,
	); err != nil {
		return model.Reading{}, err
	}
	return reading, nil
}
