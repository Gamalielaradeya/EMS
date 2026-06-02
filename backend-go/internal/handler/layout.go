package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"ems-thermal-lstm/backend-go/internal/apiresponse"
	"ems-thermal-lstm/backend-go/internal/model"
	"ems-thermal-lstm/backend-go/internal/service"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) ActiveLayout(w http.ResponseWriter, r *http.Request) {
	layout, err := h.service.ActiveLayout(r.Context())
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	message := "layout retrieved"
	if layout == nil {
		message = "no active layout available"
	}
	apiresponse.Success(w, http.StatusOK, message, layout)
}

func (h *Handler) UploadLayout(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, model.MaxLayoutImageBytes+1<<20)
	if err := r.ParseMultipartForm(model.MaxLayoutImageBytes + 1<<20); err != nil {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", map[string][]string{"image": {"layout image must be at most 5 MB"}})
		return
	}
	file, header, err := r.FormFile("image")
	if err != nil {
		apiresponse.Error(w, http.StatusUnprocessableEntity, "validation failed", map[string][]string{"image": {"layout image is required"}})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(io.LimitReader(file, model.MaxLayoutImageBytes+1))
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	layout, validationErrors, err := h.service.UploadLayout(r.Context(), r.FormValue("name"), header.Filename, data)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusCreated, "layout image uploaded", layout)
}

func (h *Handler) UpdateLayoutDevice(w http.ResponseWriter, r *http.Request) {
	sensorCode := strings.ToUpper(chi.URLParam(r, "sensorCode"))
	var input model.LayoutDeviceInput
	if err := decodeJSON(r, &input); err != nil {
		apiresponse.Error(w, http.StatusBadRequest, "invalid JSON payload", map[string][]string{"body": {err.Error()}})
		return
	}
	layout, validationErrors, err := h.service.UpdateLayoutDevice(r.Context(), sensorCode, input)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusOK, "layout marker updated", layout)
}

func (h *Handler) DeleteLayoutDevice(w http.ResponseWriter, r *http.Request) {
	sensorCode := strings.ToUpper(chi.URLParam(r, "sensorCode"))
	layout, validationErrors, err := h.service.DeleteLayoutDevice(r.Context(), sensorCode)
	if err != nil {
		writeServiceError(w, err, validationErrors)
		return
	}
	apiresponse.Success(w, http.StatusOK, "layout marker removed", layout)
}

func (h *Handler) LayoutImage(w http.ResponseWriter, r *http.Request) {
	file, contentType, err := h.service.OpenLayoutImage(chi.URLParam(r, "fileName"))
	if err != nil {
		if errors.Is(err, service.ErrValidation) {
			apiresponse.Error(w, http.StatusNotFound, "layout image was not found", nil)
			return
		}
		writeServiceError(w, err, nil)
		return
	}
	defer file.Close()
	stat, err := file.Stat()
	if err != nil {
		writeServiceError(w, err, nil)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
}
