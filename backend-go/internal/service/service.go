package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/repository"
	"ems-thermal-lstm/backend-go/internal/sse"
	"ems-thermal-lstm/backend-go/internal/validation"
)

var ErrValidation = errors.New("validation failed")

type Service struct {
	repository        *repository.Repository
	activeGatewayCode string
	events            eventPublisher
}

type eventPublisher interface {
	Publish(eventType string, data any) error
}

func New(repository *repository.Repository, activeGatewayCode string, events eventPublisher) *Service {
	return &Service{
		repository:        repository,
		activeGatewayCode: activeGatewayCode,
		events:            events,
	}
}

func (s *Service) BootstrapGatewayToken(ctx context.Context, token string) error {
	return s.repository.BootstrapGatewayToken(ctx, s.activeGatewayCode, hashToken(token))
}

func (s *Service) ValidateGatewayToken(ctx context.Context, token string) (bool, error) {
	if token == "" {
		return false, nil
	}
	return s.repository.GatewayTokenValid(ctx, hashToken(token))
}

func (s *Service) Health(ctx context.Context) error {
	return s.repository.Ping(ctx)
}

func (s *Service) InsertReadings(ctx context.Context, input model.ReadingsInput) (int64, validation.Errors, error) {
	if errs := validation.ValidateReadings(input); len(errs) > 0 {
		return 0, errs, ErrValidation
	}
	if input.Source == "" {
		input.Source = "hardware"
	}
	recordedAt, _ := time.Parse(time.RFC3339, input.RecordedAt)
	rawPayload, err := json.Marshal(input)
	if err != nil {
		return 0, nil, fmt.Errorf("marshal readings payload: %w", err)
	}

	readings := make([]model.ReadingInsert, 0, len(input.Readings))
	for _, reading := range input.Readings {
		readings = append(readings, model.ReadingInsert{
			SensorCode:  reading.SensorCode,
			Temperature: *reading.Temperature,
			Humidity:    *reading.Humidity,
		})
	}
	storedCount, err := s.repository.InsertReadings(ctx, input.GatewayID, recordedAt, input.Source, readings, rawPayload)
	if err == nil {
		s.publish(sse.EventReadingLatest, readingLatestEvent(input, recordedAt))
	}
	return storedCount, nil, err
}

func (s *Service) RecordGatewayStatus(ctx context.Context, input model.GatewayStatusInput) (validation.Errors, error) {
	if errs := validation.ValidateGatewayStatus(input); len(errs) > 0 {
		return errs, ErrValidation
	}
	reportedAt, _ := time.Parse(time.RFC3339, input.ReportedAt)
	systemLogs, err := s.repository.RecordGatewayStatus(ctx, input, reportedAt)
	if err != nil {
		return nil, err
	}
	s.publish(sse.EventGatewayStatus, input)
	for _, sensor := range input.Sensors {
		if sensor.Status == "trouble" {
			s.publish(sse.EventSensorTrouble, sensor)
		}
	}
	for _, systemLog := range systemLogs {
		s.publish(sse.EventSystemLog, systemLog)
	}
	return nil, nil
}

func (s *Service) ListSensors(ctx context.Context) ([]model.Sensor, error) {
	return s.repository.ListSensors(ctx)
}

func (s *Service) GetSensor(ctx context.Context, sensorCode string) (model.Sensor, error) {
	return s.repository.GetSensor(ctx, s.activeGatewayCode, sensorCode)
}

func (s *Service) UpdateSensor(ctx context.Context, sensorCode string, input model.SensorUpdateInput) (model.Sensor, validation.Errors, error) {
	if !validation.SensorCodeValid(sensorCode) {
		return model.Sensor{}, validation.Errors{
			"sensor_code": {"sensor_code must be S1 or S2"},
		}, ErrValidation
	}
	if errs := validation.ValidateSensorUpdate(input); len(errs) > 0 {
		return model.Sensor{}, errs, ErrValidation
	}
	sensor, err := s.repository.UpdateSensor(ctx, s.activeGatewayCode, sensorCode, input)
	return sensor, nil, err
}

func (s *Service) LatestReadings(ctx context.Context) (map[string]model.Reading, error) {
	return s.repository.LatestReadings(ctx)
}

func (s *Service) ReadingHistory(ctx context.Context, filters model.ReadingFilters) ([]model.Reading, int64, error) {
	return s.repository.ReadingHistory(ctx, filters)
}

func (s *Service) DashboardSummary(ctx context.Context) (model.DashboardSummary, error) {
	return s.repository.DashboardSummary(ctx, s.activeGatewayCode)
}

func (s *Service) RunOfflineChecker(ctx context.Context, interval time.Duration) {
	s.checkOfflineStatuses(ctx)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkOfflineStatuses(ctx)
		}
	}
}

func (s *Service) checkOfflineStatuses(ctx context.Context) {
	changes, err := s.repository.MarkOfflineStatuses(ctx, time.Now(), 5)
	if err != nil {
		log.Printf("offline checker failed: %v", err)
		return
	}
	for _, change := range changes {
		s.publish(sse.EventSystemLog, change.Log)
		switch change.Entity {
		case "gateway":
			s.publish(sse.EventGatewayStatus, change)
		case "sensor":
			s.publish(sse.EventSensorTrouble, change)
		}
	}
}

func (s *Service) publish(eventType string, data any) {
	if s.events == nil {
		return
	}
	if err := s.events.Publish(eventType, data); err != nil {
		log.Printf("publish %s event: %v", eventType, err)
	}
}

func readingLatestEvent(input model.ReadingsInput, recordedAt time.Time) map[string]any {
	readings := make(map[string]any, len(input.Readings))
	for _, reading := range input.Readings {
		readings[reading.SensorCode] = map[string]any{
			"temperature":          *reading.Temperature,
			"humidity":             *reading.Humidity,
			"sensor_health_status": "normal",
			"recorded_at":          recordedAt,
		}
	}
	return map[string]any{
		"gateway_id":  input.GatewayID,
		"recorded_at": recordedAt,
		"readings":    readings,
	}
}

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
