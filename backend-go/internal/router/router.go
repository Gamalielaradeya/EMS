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
}, frontendOrigin string) http.Handler {
	router := chi.NewRouter()
	router.Use(middleware.RequestLogger)
	router.Use(middleware.CORS(frontendOrigin))

	router.Route("/api/v1", func(router chi.Router) {
		router.Get("/health", handler.Health)

		router.Group(func(router chi.Router) {
			router.Use(middleware.GatewayBearerAuth(tokenValidator))
			router.Post("/readings", handler.InsertReadings)
			router.Post("/gateway/status", handler.RecordGatewayStatus)
		})

		router.Get("/sensors", handler.ListSensors)
		router.Get("/sensors/{sensorCode}", handler.GetSensor)
		router.Put("/sensors/{sensorCode}", handler.UpdateSensor)
		router.Get("/readings/latest", handler.LatestReadings)
		router.Get("/readings/history", handler.ReadingHistory)
	})

	return router
}
