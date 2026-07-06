package service

import (
	"context"
	"fmt"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/sse"
	"ems-thermal-lstm/backend-go/internal/validation"
)

func (s *Service) InsertPrediction(ctx context.Context, input model.PredictionInput) (model.Prediction, validation.Errors, error) {
	if errs := validation.ValidatePrediction(input); len(errs) > 0 {
		return model.Prediction{}, errs, ErrValidation
	}
	settings, err := s.repository.PredictionSettings(ctx)
	if err != nil {
		return model.Prediction{}, nil, err
	}
	thermalStatus := classifyThermalStatus(*input.PredictedTemperature, settings)
	prediction, systemLogs, err := s.repository.InsertPrediction(ctx, input, thermalStatus, thermalStatus, settings, time.Now())
	if err != nil {
		return model.Prediction{}, nil, err
	}
	for _, systemLog := range systemLogs {
		s.publish(sse.EventSystemLog, systemLog)
	}
	s.publish(sse.EventPredictionLatest, prediction)
	if prediction.IsStale || prediction.FinalStatus == "normal" {
		return prediction, nil, nil
	}
	event, err := s.repository.InsertAnomalyEvent(ctx, prediction, severityForStatus(prediction.FinalStatus), descriptionForStatus(prediction.FinalStatus))
	if err != nil {
		return model.Prediction{}, nil, err
	}
	s.publish(sse.EventAnomalyCreated, event)
	s.processTelegramNotification(ctx, &event, prediction)
	return prediction, nil, nil
}

func (s *Service) LatestPrediction(ctx context.Context) (*model.Prediction, error) {
	if err := s.refreshPredictions(ctx); err != nil {
		return nil, err
	}
	return s.repository.LatestPrediction(ctx)
}

func (s *Service) PredictionHistory(ctx context.Context, filters model.PredictionFilters) ([]model.Prediction, int64, error) {
	if err := s.refreshPredictions(ctx); err != nil {
		return nil, 0, err
	}
	return s.repository.PredictionHistory(ctx, filters)
}

func (s *Service) ListModelVersions(ctx context.Context) ([]model.ModelVersion, error) {
	return s.repository.ListModelVersions(ctx)
}

func (s *Service) GetModelVersion(ctx context.Context, id int64) (model.ModelVersion, error) {
	return s.repository.GetModelVersion(ctx, id)
}

func (s *Service) UpdateModelVersionName(ctx context.Context, id int64, name string) (model.ModelVersion, error) {
	return s.repository.UpdateModelVersionName(ctx, id, name)
}

func (s *Service) ActivateModelVersion(ctx context.Context, id int64) (model.ModelVersion, error) {
	item, systemLog, err := s.repository.ActivateModelVersion(ctx, id)
	if err == nil {
		s.publish(sse.EventSystemLog, systemLog)
	}
	return item, err
}

func (s *Service) LatestModelMetrics(ctx context.Context) (*model.ModelMetrics, error) {
	return s.repository.LatestModelMetrics(ctx)
}

func (s *Service) LatestModelComparison(ctx context.Context) (*model.ModelComparison, error) {
	return s.repository.LatestModelComparison(ctx)
}

func (s *Service) AnomalyEvents(ctx context.Context, filters model.EventFilters) ([]model.AnomalyEvent, int64, error) {
	return s.repository.AnomalyEvents(ctx, filters)
}

func (s *Service) NotificationLogs(ctx context.Context, filters model.EventFilters) ([]model.NotificationLog, int64, error) {
	return s.repository.NotificationLogs(ctx, filters)
}

func (s *Service) TestNotification(ctx context.Context) (model.NotificationLog, error) {
	settings, err := s.repository.TelegramSettings(ctx)
	if err != nil {
		return model.NotificationLog{}, err
	}
	message := "[EMS THERMAL TEST]\n\nTelegram notification test from EMS Thermal LSTM backend."
	item := model.NotificationLog{
		Channel:  "telegram",
		Message:  message,
		Metadata: map[string]any{"type": "manual_test"},
	}
	s.sendTelegram(ctx, &item, settings)
	item, err = s.repository.InsertNotificationLog(ctx, item)
	if err == nil {
		s.publish(sse.EventNotificationSent, item)
	}
	return item, err
}

func (s *Service) refreshPredictions(ctx context.Context) error {
	settings, err := s.repository.PredictionSettings(ctx)
	if err != nil {
		return err
	}
	return s.repository.RefreshPredictions(ctx, settings)
}

func (s *Service) processTelegramNotification(ctx context.Context, event *model.AnomalyEvent, prediction model.Prediction) {
	settings, err := s.repository.TelegramSettings(ctx)
	if err != nil {
		return
	}
	message := thermalAlertMessage(prediction)
	item := model.NotificationLog{
		AnomalyEventID: &event.ID,
		Channel:        "telegram",
		Message:        message,
		Metadata: map[string]any{
			"sensor_code": prediction.TargetSensor,
			"status":      prediction.FinalStatus,
		},
	}
	if prediction.TargetSensorID != nil {
		lastSentAt, lookupErr := s.repository.LastSentNotificationAt(ctx, *prediction.TargetSensorID, prediction.FinalStatus)
		if lookupErr == nil && lastSentAt != nil && time.Since(*lastSentAt) < time.Duration(settings.CooldownMinutes)*time.Minute {
			reason := "notification skipped during cooldown"
			item.Status = "skipped"
			item.ErrorMessage = &reason
		}
	}
	if item.Status == "" {
		s.sendTelegram(ctx, &item, settings)
	}
	item, err = s.repository.InsertNotificationLog(ctx, item)
	if err == nil {
		s.publish(sse.EventNotificationSent, item)
	}
}

func (s *Service) sendTelegram(ctx context.Context, item *model.NotificationLog, settings model.TelegramSettings) {
	if !settings.Enabled {
		reason := "Telegram is disabled"
		item.Status = "skipped"
		item.ErrorMessage = &reason
		return
	}
	if settings.BotToken == "" || settings.ChatID == "" {
		reason := "Telegram bot token or chat ID is not configured"
		item.Status = "skipped"
		item.ErrorMessage = &reason
		return
	}
	item.Recipient = &settings.ChatID
	if s.telegram == nil {
		reason := "Telegram sender is unavailable"
		item.Status = "failed"
		item.ErrorMessage = &reason
		return
	}
	if err := s.telegram.Send(ctx, settings.BotToken, settings.ChatID, item.Message); err != nil {
		reason := err.Error()
		item.Status = "failed"
		item.ErrorMessage = &reason
		return
	}
	now := time.Now()
	item.Status = "sent"
	item.SentAt = &now
}

func classifyThermalStatus(temperature float64, settings model.PredictionSettings) string {
	if temperature < settings.ThresholdNormalMax {
		return "normal"
	}
	if temperature <= settings.ThresholdAnomalyMin {
		return "waspada"
	}
	return "anomali"
}

func severityForStatus(status string) string {
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

func descriptionForStatus(status string) string {
	switch status {
	case "waspada":
		return "Predicted S2 temperature is within warning range."
	case "anomali":
		return "Predicted S2 temperature exceeded anomaly threshold."
	case "trouble":
		return "S2 prediction received while sensor or gateway is in trouble."
	default:
		return "S2 prediction is within normal range."
	}
}

func thermalAlertMessage(prediction model.Prediction) string {
	return fmt.Sprintf(
		"[EMS THERMAL ALERT]\n\nStatus: %s\nSensor: %s - Hotspot/Exhaust\nPredicted temperature: %.2f C\nPredicted for: %s\nThreshold: Normal < %.2f C, Anomaly > %.2f C",
		prediction.FinalStatus,
		prediction.TargetSensor,
		prediction.PredictedTemperature,
		prediction.PredictedFor.Format(time.RFC3339),
		prediction.ThresholdNormalMax,
		prediction.ThresholdAnomalyMin,
	)
}
