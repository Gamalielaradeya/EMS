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

func (h *Handler) ListSettings(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.ListSettings(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.Success(w, http.StatusOK, "settings retrieved", items)
}

func (h *Handler) UpdateSetting(w http.ResponseWriter, r *http.Request) {
	var input model.SettingUpdateInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	item, validationErrors, err := h.service.UpdateSetting(r.Context(), chi.URLParam(r, "key"), input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusOK, "setting updated", item)
}

func (h *Handler) SystemLogs(w http.ResponseWriter, r *http.Request) {
	filters, errs := systemLogFilters(r)
	if len(errs) > 0 {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", errs)
		return
	}
	items, total, err := h.service.SystemLogs(r.Context(), filters)
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	apiresponse.SuccessWithMeta(w, http.StatusOK, "system logs retrieved", items, paginationMeta(total, filters.Limit, filters.Offset))
}

func systemLogFilters(r *http.Request) (model.SystemLogFilters, validation.Errors) {
	query := r.URL.Query()
	filters := model.SystemLogFilters{
		Source: strings.ToLower(query.Get("source")),
		Level:  strings.ToLower(query.Get("level")),
		Limit:  100,
	}
	errs := validation.Errors{}
	if !validation.SystemLogSourceValid(filters.Source) {
		errs.Add("source", "source must be backend, gateway, ml-worker, telegram, or database")
	}
	if !validation.SystemLogLevelValid(filters.Level) {
		errs.Add("level", "level must be info, warning, error, or critical")
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
