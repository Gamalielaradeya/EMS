package config

import (
	"errors"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment       string
	Port              string
	FrontendOrigin    string
	DatabaseURL       string
	GatewayToken      string
	ActiveGatewayCode string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Environment:       valueOrDefault("APP_ENV", "development"),
		Port:              valueOrDefault("APP_PORT", "8080"),
		FrontendOrigin:    valueOrDefault("FRONTEND_ORIGIN", "http://localhost:5173"),
		DatabaseURL:       strings.TrimSpace(os.Getenv("DATABASE_URL")),
		GatewayToken:      strings.TrimSpace(os.Getenv("GATEWAY_TOKEN")),
		ActiveGatewayCode: valueOrDefault("ACTIVE_GATEWAY_CODE", "raspi-gateway-01"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if cfg.GatewayToken == "" {
		return Config{}, errors.New("GATEWAY_TOKEN is required")
	}

	return cfg, nil
}

func valueOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}
