package config

import (
	"errors"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Environment        string
	Port               string
	FrontendOrigin     string
	DatabaseURL        string
	GatewayToken       string
	ActiveGatewayCode  string
	AdminToken         string
	InternalAPIToken   string
	TelegramAPIBaseURL string
	UploadDir          string
	OfflineCheckEvery  time.Duration
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		Environment:        valueOrDefault("APP_ENV", "development"),
		Port:               valueOrDefault("APP_PORT", "8080"),
		FrontendOrigin:     valueOrDefault("FRONTEND_ORIGIN", "http://localhost:5173"),
		DatabaseURL:        strings.TrimSpace(os.Getenv("DATABASE_URL")),
		GatewayToken:       strings.TrimSpace(os.Getenv("GATEWAY_TOKEN")),
		ActiveGatewayCode:  valueOrDefault("ACTIVE_GATEWAY_CODE", "raspi-gateway-01"),
		AdminToken:         strings.TrimSpace(os.Getenv("ADMIN_TOKEN")),
		InternalAPIToken:   internalAPIToken(),
		TelegramAPIBaseURL: valueOrDefault("TELEGRAM_API_BASE_URL", "https://api.telegram.org"),
		UploadDir:          valueOrDefault("UPLOAD_DIR", "./uploads"),
	}

	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if cfg.GatewayToken == "" {
		return Config{}, errors.New("GATEWAY_TOKEN is required")
	}
	offlineCheckSeconds, err := positiveIntegerOrDefault("BACKEND_OFFLINE_CHECK_INTERVAL_SECONDS", 30)
	if err != nil {
		return Config{}, err
	}
	cfg.OfflineCheckEvery = time.Duration(offlineCheckSeconds) * time.Second

	return cfg, nil
}

func valueOrDefault(key, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func internalAPIToken() string {
	if token := strings.TrimSpace(os.Getenv("INTERNAL_API_TOKEN")); token != "" {
		return token
	}
	return strings.TrimSpace(os.Getenv("INTERNAL_ML_TOKEN"))
}

func positiveIntegerOrDefault(key string, fallback int) (int, error) {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback, nil
	}
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		return 0, errors.New(key + " must be a positive integer")
	}
	return parsed, nil
}
