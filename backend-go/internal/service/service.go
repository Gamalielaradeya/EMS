package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/repository"
	"ems-thermal-lstm/backend-go/internal/validation"
)

var ErrValidation = errors.New("validation failed")

type Service struct {
	repository        *repository.Repository
	activeGatewayCode string
}

func New(repository *repository.Repository, activeGatewayCode string) *Service {
	return &Service{
		repository:        repository,
		activeGatewayCode: activeGatewayCode,
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
	return storedCount, nil, err
}

func (s *Service) RecordGatewayStatus(ctx context.Context, input model.GatewayStatusInput) (validation.Errors, error) {
	if errs := validation.ValidateGatewayStatus(input); len(errs) > 0 {
		return errs, ErrValidation
	}
	reportedAt, _ := time.Parse(time.RFC3339, input.ReportedAt)
	return nil, s.repository.RecordGatewayStatus(ctx, input, reportedAt)
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

func hashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
