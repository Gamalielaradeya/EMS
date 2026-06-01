package handler

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/apiresponse"
	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/repository"
	"ems-thermal-lstm/backend-go/internal/service"
	"ems-thermal-lstm/backend-go/internal/validation"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	service     *service.Service
	eventStream http.Handler
}

func New(service *service.Service, eventStream http.Handler) *Handler {
	return &Handler{service: service, eventStream: eventStream}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Health(r.Context()); err != nil {
		apiresponse.Error(w, http.StatusServiceUnavailable, "database is unavailable", nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "service is healthy", map[string]any{
		"database": "connected",
		"time":     time.Now().UTC(),
	})
}

func (h *Handler) Events(w http.ResponseWriter, r *http.Request) {
	h.eventStream.ServeHTTP(w, r)
}

func (h *Handler) DashboardSummary(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.DashboardSummary(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "dashboard summary retrieved", summary)
}

func (h *Handler) InsertReadings(w http.ResponseWriter, r *http.Request) {
	var input model.ReadingsInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	storedCount, validationErrors, err := h.service.InsertReadings(r.Context(), input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusCreated, "readings accepted", map[string]any{
		"received_count": len(input.Readings),
		"stored_count":   storedCount,
	})
}

func (h *Handler) RecordGatewayStatus(w http.ResponseWriter, r *http.Request) {
	var input model.GatewayStatusInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	validationErrors, err := h.service.RecordGatewayStatus(r.Context(), input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusCreated, "gateway status accepted", nil)
}

func (h *Handler) ListSensors(w http.ResponseWriter, r *http.Request) {
	sensors, err := h.service.ListSensors(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "sensors retrieved", sensors)
}

func (h *Handler) GetSensor(w http.ResponseWriter, r *http.Request) {
	sensorCode := strings.ToUpper(chi.URLParam(r, "sensorCode"))
	if !validation.SensorCodeValid(sensorCode) {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", map[string][]string{
			"sensor_code": {"sensor_code must be S1 or S2"},
		})
		return
	}
	sensor, err := h.service.GetSensor(r.Context(), sensorCode)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "sensor retrieved", sensor)
}

func (h *Handler) UpdateSensor(w http.ResponseWriter, r *http.Request) {
	sensorCode := strings.ToUpper(chi.URLParam(r, "sensorCode"))
	var input model.SensorUpdateInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	sensor, validationErrors, err := h.service.UpdateSensor(r.Context(), sensorCode, input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusOK, "sensor updated", sensor)
}

func (h *Handler) LatestReadings(w http.ResponseWriter, r *http.Request) {
	readings, err := h.service.LatestReadings(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "latest readings retrieved", readings)
}

func (h *Handler) ReadingHistory(w http.ResponseWriter, r *http.Request) {
	filters, validationErrors := historyFilters(r)
	if len(validationErrors) > 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", validationErrors)
		return
	}
	readings, total, err := h.service.ReadingHistory(r.Context(), filters)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.SuccessWithMeta(w, http.StatusOK, "reading history retrieved", readings, map[string]any{
		"total":  total,
		"limit":  filters.Limit,
		"offset": filters.Offset,
	})
}

func decodeJSON(r *http.Request, destination any) error {
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(destination); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return errors.New("payload must contain one JSON object")
	}
	return nil
}

func historyFilters(r *http.Request) (model.ReadingFilters, validation.Errors) {
	query := r.URL.Query()
	filters := model.ReadingFilters{
		SensorCode:    strings.ToUpper(query.Get("sensor_code")),
		QualityStatus: query.Get("quality_status"),
		Limit:         500,
	}
	errs := validation.Errors{}
	if filters.SensorCode != "" && !validation.SensorCodeValid(filters.SensorCode) {
		errs.Add("sensor_code", "sensor_code must be S1 or S2")
	}
	if !validation.QualityStatusValid(filters.QualityStatus) {
		errs.Add("quality_status", "quality_status must be valid, invalid, timeout, or simulated")
	}
	if value := query.Get("from"); value != "" {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			errs.Add("from", "from must use RFC3339 format")
		} else {
			filters.From = &parsed
		}
	}
	if value := query.Get("to"); value != "" {
		parsed, err := time.Parse(time.RFC3339, value)
		if err != nil {
			errs.Add("to", "to must use RFC3339 format")
		} else {
			filters.To = &parsed
		}
	}
	if value := query.Get("limit"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 1 || parsed > 1000 {
			errs.Add("limit", "limit must be an integer between 1 and 1000")
		} else {
			filters.Limit = parsed
		}
	}
	if value := query.Get("offset"); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil || parsed < 0 {
			errs.Add("offset", "offset must be a non-negative integer")
		} else {
			filters.Offset = parsed
		}
	}
	return filters, errs
}

func writeServiceError(w http.ResponseWriter, err error, validationErrors validation.Errors) {
	switch {
	case errors.Is(err, service.ErrValidation):
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", validationErrors)
	case errors.Is(err, repository.ErrNotFound):
		apiresponse.Error(w, http.StatusNotFound, "requested record was not found", nil)
	default:
		apiresponse.Error(w, http.StatusInternalServerError, "internal server error", nil)
	}
}
