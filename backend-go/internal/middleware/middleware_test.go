package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAdminOrInternalBearerAuthAcceptsConfiguredTokens(t *testing.T) {
	handler := AdminOrInternalBearerAuth("admin-token", "internal-token")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	for _, token := range []string{"admin-token", "internal-token"} {
		request := httptest.NewRequest(http.MethodPost, "/", nil)
		request.Header.Set("Authorization", "Bearer "+token)
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != http.StatusNoContent {
			t.Fatalf("token %q returned status %d", token, response.Code)
		}
	}
}

func TestAdminOrInternalBearerAuthRejectsMissingToken(t *testing.T) {
	handler := AdminOrInternalBearerAuth("admin-token", "internal-token")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, httptest.NewRequest(http.MethodPost, "/", nil))
	if response.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, response.Code)
	}
}
