package middleware

import (
	"context"
	"log"
	"net/http"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/apiresponse"
)

type gatewayTokenValidator interface {
	ValidateGatewayToken(ctx context.Context, token string) (bool, error)
}

func GatewayBearerAuth(validator gatewayTokenValidator) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
			if token == "" || token == r.Header.Get("Authorization") {
				apiresponse.Error(w, http.StatusUnauthorized, "gateway bearer token is required", nil)
				return
			}
			valid, err := validator.ValidateGatewayToken(r.Context(), token)
			if err != nil {
				apiresponse.Error(w, http.StatusInternalServerError, "gateway token validation failed", nil)
				return
			}
			if !valid {
				apiresponse.Error(w, http.StatusUnauthorized, "gateway bearer token is invalid", nil)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func AdminOrInternalBearerAuth(adminToken, internalAPIToken string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := bearerToken(r)
			if token == "" {
				apiresponse.Error(w, http.StatusUnauthorized, "admin or internal bearer token is required", nil)
				return
			}
			if token != adminToken && token != internalAPIToken {
				apiresponse.Error(w, http.StatusUnauthorized, "admin or internal bearer token is invalid", nil)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func bearerToken(r *http.Request) string {
	authorization := r.Header.Get("Authorization")
	token := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
	if token == authorization {
		return ""
	}
	return token
}

func CORS(frontendOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Header.Get("Origin") == frontendOrigin {
				w.Header().Set("Access-Control-Allow-Origin", frontendOrigin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		startedAt := time.Now()
		recorder := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(recorder, r)
		log.Printf("%s %s status=%d duration=%s", r.Method, r.URL.Path, recorder.statusCode, time.Since(startedAt))
	})
}

type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(statusCode int) {
	r.statusCode = statusCode
	r.ResponseWriter.WriteHeader(statusCode)
}

func (r *statusRecorder) Flush() {
	if flusher, ok := r.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}
