package router

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ems-thermal-lstm/backend-go/internal/handler"
)

type allowGatewayToken struct{}

func (allowGatewayToken) ValidateGatewayToken(context.Context, string) (bool, error) {
	return true, nil
}

func TestUpdateSensorRequiresAdminOrInternalToken(t *testing.T) {
	apiHandler := handler.New(nil, http.NotFoundHandler())
	router := New(apiHandler, allowGatewayToken{}, "http://localhost:5173", "admin-secret", "internal-secret")

	withoutToken := httptest.NewRequest(http.MethodPut, "/api/v1/sensors/S1", strings.NewReader("{"))
	withoutToken.Header.Set("Content-Type", "application/json")
	withoutTokenResponse := httptest.NewRecorder()
	router.ServeHTTP(withoutTokenResponse, withoutToken)
	if withoutTokenResponse.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without token, got %d", withoutTokenResponse.Code)
	}

	withToken := httptest.NewRequest(http.MethodPut, "/api/v1/sensors/S1", strings.NewReader("{"))
	withToken.Header.Set("Authorization", "Bearer admin-secret")
	withToken.Header.Set("Content-Type", "application/json")
	withTokenResponse := httptest.NewRecorder()
	router.ServeHTTP(withTokenResponse, withToken)
	if withTokenResponse.Code != http.StatusBadRequest {
		t.Fatalf("expected authenticated request to reach JSON validation, got %d", withTokenResponse.Code)
	}
}
