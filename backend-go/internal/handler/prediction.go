package handler

import (
	"net/http"
	"strconv"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/apiresponse"
	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/validation"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) InsertPrediction(w http.ResponseWriter, r *http.Request) {
	var input model.PredictionInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	prediction, validationErrors, err := h.service.InsertPrediction(r.Context(), input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusCreated, "prediction accepted", prediction)
}

func (h *Handler) LatestPrediction(w http.ResponseWriter, r *http.Request) {
	prediction, err := h.service.LatestPrediction(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	message := "latest prediction retrieved"
	if prediction == nil {
		message = "no prediction available"
	}
	apiresponse.Success(w, http.StatusOK, message, prediction)
}

func (h *Handler) PredictionHistory(w http.ResponseWriter, r *http.Request) {
	filters, errs := predictionFilters(r)
	if len(errs) > 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", errs)
		return
	}
	items, total, err := h.service.PredictionHistory(r.Context(), filters)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.SuccessWithMeta(w, http.StatusOK, "prediction history retrieved", items, paginationMeta(total, filters.Limit, filters.Offset))
}

func (h *Handler) ListModelVersions(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListModelVersions(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "model versions retrieved", items)
}

func (h *Handler) GetModelVersion(w http.ResponseWriter, r *http.Request) {
	id, ok := resourceID(w, r)
	if !ok {
		return
	}
	item, err := h.service.GetModelVersion(r.Context(), id)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "model version retrieved", item)
}

func (h *Handler) ActivateModelVersion(w http.ResponseWriter, r *http.Request) {
	id, ok := resourceID(w, r)
	if !ok {
		return
	}
	item, err := h.service.ActivateModelVersion(r.Context(), id)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "model activated successfully", item)
}

func (h *Handler) UpdateModelVersion(w http.ResponseWriter, r *http.Request) {
	id, ok := resourceID(w, r)
	if !ok {
		return
	}
	var input struct {
		ModelName string `json:"model_name"`
	}
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	if strings.TrimSpace(input.ModelName) == "" {
		apiresponse.Error(w, http.StatusBadRequest, "model_name is required", nil)
		return
	}
	item, err := h.service.UpdateModelVersionName(r.Context(), id, input.ModelName)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "model updated successfully", item)
}

func (h *Handler) LatestModelMetrics(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.LatestModelMetrics(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "latest model metrics retrieved", item)
}

func (h *Handler) LatestModelComparison(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.LatestModelComparison(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "model comparison retrieved", item)
}

func (h *Handler) AnomalyEvents(w http.ResponseWriter, r *http.Request) {
	filters, errs := eventFilters(r, validation.FinalStatusValid)
	if len(errs) > 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", errs)
		return
	}
	items, total, err := h.service.AnomalyEvents(r.Context(), filters)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.SuccessWithMeta(w, http.StatusOK, "anomaly events retrieved", items, paginationMeta(total, filters.Limit, filters.Offset))
}

func (h *Handler) NotificationLogs(w http.ResponseWriter, r *http.Request) {
	filters, errs := eventFilters(r, validation.NotificationStatusValid)
	if len(errs) > 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", errs)
		return
	}
	items, total, err := h.service.NotificationLogs(r.Context(), filters)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.SuccessWithMeta(w, http.StatusOK, "notification logs retrieved", items, paginationMeta(total, filters.Limit, filters.Offset))
}

func (h *Handler) TestNotification(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.TestNotification(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "notification test processed", item)
}

func predictionFilters(r *http.Request) (model.PredictionFilters, validation.Errors) {
	base, errs := eventFilters(r, validation.FinalStatusValid)
	return model.PredictionFilters{
		FinalStatus: base.Status,
		From:        base.From,
		To:          base.To,
		Limit:       base.Limit,
		Offset:      base.Offset,
	}, errs
}

func eventFilters(r *http.Request, statusValid func(string) bool) (model.EventFilters, validation.Errors) {
	query := r.URL.Query()
	filters := model.EventFilters{Status: strings.ToLower(query.Get("status")), Limit: 100}
	errs := validation.Errors{}
	if !statusValid(filters.Status) {
		errs.Add("status", "status filter is invalid")
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

func resourceID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil || id <= 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", map[string][]string{"id": {"id must be a positive integer"}})
		return 0, false
	}
	return id, true
}

func paginationMeta(total int64, limit, offset int) map[string]any {
	return map[string]any{"total": total, "limit": limit, "offset": offset}
}
