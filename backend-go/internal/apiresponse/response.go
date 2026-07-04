package apiresponse

import (
	"encoding/json"
	"net/http"
)

type response struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Data    any    `json:"data"`
	Meta    any    `json:"meta,omitempty"`
	Errors  any    `json:"errors,omitempty"`
}

func Success(w http.ResponseWriter, statusCode int, message string, data any) {
	writeJSON(w, statusCode, response{
		Status:  "success",
		Message: message,
		Data:    data,
	})
}

func SuccessWithMeta(w http.ResponseWriter, statusCode int, message string, data, meta any) {
	writeJSON(w, statusCode, response{
		Status:  "success",
		Message: message,
		Data:    data,
		Meta:    meta,
	})
}

func Error(w http.ResponseWriter, statusCode int, message string, errors any) {
	writeJSON(w, statusCode, response{
		Status:  "error",
		Message: message,
		Errors:  errors,
	})
}

func writeJSON(w http.ResponseWriter, statusCode int, payload response) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(payload)
}
