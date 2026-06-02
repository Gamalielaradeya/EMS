package service

import (
	"context"

	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/sse"
	"ems-thermal-lstm/backend-go/internal/validation"
)

func (s *Service) ListSettings(ctx context.Context) ([]model.Setting, error) {
	return s.repository.ListSettings(ctx)
}

func (s *Service) UpdateSetting(ctx context.Context, key string, input model.SettingUpdateInput) (model.Setting, validation.Errors, error) {
	current, err := s.repository.CurrentThresholdSettings(ctx)
	if err != nil {
		return model.Setting{}, nil, err
	}
	if errs := validation.ValidateSettingUpdate(key, input, current); len(errs) > 0 {
		return model.Setting{}, errs, ErrValidation
	}
	item, systemLog, err := s.repository.UpdateSetting(ctx, key, input.Value)
	if err == nil {
		s.publish(sse.EventSystemLog, systemLog)
	}
	return item, nil, err
}

func (s *Service) SystemLogs(ctx context.Context, filters model.SystemLogFilters) ([]model.SystemLog, int64, error) {
	return s.repository.SystemLogs(ctx, filters)
}
