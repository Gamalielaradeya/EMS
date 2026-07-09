package router

import (
	"context"
	"net/http"

	"ems-thermal-lstm/backend-go/internal/handler"
	"ems-thermal-lstm/backend-go/internal/middleware"

	"github.com/go-chi/chi/v5"
)

func New(handler *handler.Handler, tokenValidator interface {
	ValidateGatewayToken(ctx context.Context, token string) (bool, error)
}, frontendOrigin, adminToken, internalAPIToken string) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestLogger)
	router.Use(middleware.CORS(frontendOrigin))

	router.Route("/api/v1", func(router chi.Router) {
		router.Get("/health", handler.Health)
		router.Get("/events", handler.Events)
		router.Get("/dashboard/summary", handler.DashboardSummary)

		router.Group(func(router chi.Router) {
			router.Use(middleware.GatewayBearerAuth(tokenValidator))
			router.Post("/readings", handler.InsertReadings)
			router.Post("/gateway/status", handler.RecordGatewayStatus)
		})

		router.Get("/sensors", handler.ListSensors)
		router.Get("/sensors/{sensorCode}", handler.GetSensor)
		router.Get("/readings/latest", handler.LatestReadings)
		router.Get("/readings/history", handler.ReadingHistory)
		router.Get("/predictions/latest", handler.LatestPrediction)
		router.Get("/predictions/history", handler.PredictionHistory)
		router.Get("/model-versions", handler.ListModelVersions)
		router.Get("/model-versions/{id}", handler.GetModelVersion)
		router.Get("/model-metrics/latest", handler.LatestModelMetrics)
		router.Get("/model-comparison/latest", handler.LatestModelComparison)
		router.Get("/anomaly-events", handler.AnomalyEvents)
		router.Get("/notification-logs", handler.NotificationLogs)
		router.Get("/system-logs", handler.SystemLogs)
		router.Get("/settings", handler.ListSettings)
		router.Get("/layout", handler.ActiveLayout)
		router.Get("/layout/images/{fileName}", handler.LayoutImage)

		router.Group(func(router chi.Router) {
			router.Use(middleware.AdminOrInternalBearerAuth(adminToken, internalAPIToken))
			router.Post("/ml/predictions", handler.InsertPrediction)
			router.Put("/sensors/{sensorCode}", handler.UpdateSensor)
			router.Put("/model-versions/{id}/activate", handler.ActivateModelVersion)
			router.Put("/model-versions/{id}", handler.UpdateModelVersion)
			router.Delete("/model-versions/{id}", handler.DeleteModelVersion)
			router.Post("/notifications/test", handler.TestNotification)
			router.Put("/settings/{key}", handler.UpdateSetting)
			router.Post("/layout/image", handler.UploadLayout)
			router.Put("/layout/devices/{sensorCode}", handler.UpdateLayoutDevice)
			router.Delete("/layout/devices/{sensorCode}", handler.DeleteLayoutDevice)
		})
	})

	return router
}
