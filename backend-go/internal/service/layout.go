package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/repository"
	"ems-thermal-lstm/backend-go/internal/sse"
	"ems-thermal-lstm/backend-go/internal/validation"
)

func (s *Service) ActiveLayout(ctx context.Context) (*model.ActiveLayout, error) {
	return s.repository.ActiveLayout(ctx)
}

func (s *Service) UploadLayout(ctx context.Context, name, originalFilename string, data []byte) (model.Layout, validation.Errors, error) {
	width, height, extension, errs := validation.ValidateLayoutImage(name, originalFilename, data)
	if len(errs) > 0 {
		return model.Layout{}, errs, ErrValidation
	}
	if strings.TrimSpace(name) == "" {
		name = "Server Testbed Layout"
	}
	if err := os.MkdirAll(s.layoutUploadDir, 0o750); err != nil {
		return model.Layout{}, nil, fmt.Errorf("create layout upload directory: %w", err)
	}
	filename, err := randomLayoutFilename(extension)
	if err != nil {
		return model.Layout{}, nil, err
	}
	target := filepath.Join(s.layoutUploadDir, filename)
	if err := os.WriteFile(target, data, 0o640); err != nil {
		return model.Layout{}, nil, fmt.Errorf("write layout image: %w", err)
	}
	imageURL := "/api/v1/layout/images/" + filename
	layout, systemLog, err := s.repository.CreateLayout(ctx, strings.TrimSpace(name), imageURL, width, height)
	if err != nil {
		_ = os.Remove(target)
		return model.Layout{}, nil, err
	}
	s.publish(sse.EventSystemLog, systemLog)
	return layout, nil, nil
}

func (s *Service) UpdateLayoutDevice(ctx context.Context, sensorCode string, input model.LayoutDeviceInput) (*model.ActiveLayout, validation.Errors, error) {
	if errs := validation.ValidateLayoutDevice(sensorCode, input); len(errs) > 0 {
		return nil, errs, ErrValidation
	}
	systemLog, err := s.repository.UpsertLayoutDevice(ctx, sensorCode, input)
	if err != nil {
		return nil, nil, err
	}
	s.publish(sse.EventSystemLog, systemLog)
	layout, err := s.repository.ActiveLayout(ctx)
	return layout, nil, err
}

func (s *Service) DeleteLayoutDevice(ctx context.Context, sensorCode string) (*model.ActiveLayout, validation.Errors, error) {
	if !validation.SensorCodeValid(sensorCode) {
		return nil, validation.Errors{"sensor_code": {"sensor_code must be S1 or S2"}}, ErrValidation
	}
	systemLog, err := s.repository.DeleteLayoutDevice(ctx, sensorCode)
	if err != nil {
		return nil, nil, err
	}
	s.publish(sse.EventSystemLog, systemLog)
	layout, err := s.repository.ActiveLayout(ctx)
	return layout, nil, err
}

func (s *Service) OpenLayoutImage(filename string) (*os.File, string, error) {
	if filename == "" || filepath.Base(filename) != filename {
		return nil, "", ErrValidation
	}
	extension := strings.ToLower(filepath.Ext(filename))
	contentType := layoutContentType(extension)
	if contentType == "" {
		return nil, "", ErrValidation
	}
	file, err := os.Open(filepath.Join(s.layoutUploadDir, filename))
	if errors.Is(err, os.ErrNotExist) {
		return nil, "", repository.ErrNotFound
	}
	if err != nil {
		return nil, "", fmt.Errorf("open layout image: %w", err)
	}
	return file, contentType, nil
}

func randomLayoutFilename(extension string) (string, error) {
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("generate layout image name: %w", err)
	}
	return "layout-" + hex.EncodeToString(randomBytes) + extension, nil
}

func layoutContentType(extension string) string {
	switch extension {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".webp":
		return "image/webp"
	default:
		return ""
	}
}
