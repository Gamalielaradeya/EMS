package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"

	"github.com/jackc/pgx/v5"
)

type transitionEventInput struct {
	PredictionID         *int64
	SensorID             *int64
	SensorCode           *string
	EventType            string
	Status               string
	Severity             string
	PredictedTemperature *float64
	ActualTemperature    *float64
	ThresholdNormalMax   *float64
	ThresholdAnomalyMin  *float64
	Description          string
	DetectedAt           time.Time
}

func insertTransitionEventTx(ctx context.Context, tx pgx.Tx, input transitionEventInput) (*model.AnomalyEvent, error) {
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || COALESCE($2::bigint::text, 'gateway'), 0))`, input.EventType, input.SensorID); err != nil {
		return nil, fmt.Errorf("lock %s transition: %w", input.EventType, err)
	}
	var previousStatus string
	err := tx.QueryRow(ctx, `
		SELECT status
		FROM anomaly_events
		WHERE event_type = $1
		  AND sensor_id IS NOT DISTINCT FROM $2
		ORDER BY detected_at DESC, id DESC
		LIMIT 1`,
		input.EventType,
		input.SensorID,
	).Scan(&previousStatus)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("get previous %s event: %w", input.EventType, err)
	}
	var previous *string
	if err == nil {
		previous = &previousStatus
	}
	if !shouldCreateTransition(previous, input.Status) {
		return nil, nil
	}

	event := model.AnomalyEvent{
		PredictionID:         input.PredictionID,
		SensorID:             input.SensorID,
		SensorCode:           input.SensorCode,
		EventType:            input.EventType,
		Status:               input.Status,
		Severity:             input.Severity,
		PredictedTemperature: input.PredictedTemperature,
		ActualTemperature:    input.ActualTemperature,
		Description:          &input.Description,
		DetectedAt:           input.DetectedAt,
	}
	err = tx.QueryRow(ctx, `
		INSERT INTO anomaly_events (
			prediction_id, sensor_id, event_type, status, severity,
			predicted_temperature, actual_temperature, threshold_normal_max,
			threshold_anomaly_min, description, detected_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at`,
		event.PredictionID,
		event.SensorID,
		event.EventType,
		event.Status,
		event.Severity,
		event.PredictedTemperature,
		event.ActualTemperature,
		input.ThresholdNormalMax,
		input.ThresholdAnomalyMin,
		event.Description,
		event.DetectedAt,
	).Scan(&event.ID, &event.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("insert %s transition event: %w", input.EventType, err)
	}
	return &event, nil
}

func shouldCreateTransition(previousStatus *string, currentStatus string) bool {
	if previousStatus == nil {
		return currentStatus != "normal"
	}
	return *previousStatus != currentStatus
}

func statusSeverity(status string) string {
	switch status {
	case "waspada":
		return "warning"
	case "anomali":
		return "critical"
	case "trouble":
		return "error"
	default:
		return "info"
	}
}

func floatPointer(value float64) *float64 {
	return &value
}
