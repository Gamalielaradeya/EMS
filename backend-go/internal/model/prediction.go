package model

import "time"

type PredictionInput struct {
	ModelVersionID       *int64   `json:"model_version_id"`
	ModelVersion         string   `json:"model_version"`
	PredictionRunID      *int64   `json:"prediction_run_id"`
	TargetSensorCode     string   `json:"target_sensor_code"`
	PredictedTemperature *float64 `json:"predicted_temperature"`
	InputWindowStartAt   string   `json:"input_window_start_at"`
	InputWindowEndAt     string   `json:"input_window_end_at"`
	PredictedFor         string   `json:"predicted_for"`
}

type Prediction struct {
	ID                   int64      `json:"id"`
	PredictionRunID      *int64     `json:"prediction_run_id"`
	ModelVersionID       *int64     `json:"model_version_id"`
	ModelVersion         *string    `json:"model_version"`
	TargetSensorID       *int64     `json:"-"`
	TargetSensor         string     `json:"target_sensor"`
	PredictedTemperature float64    `json:"predicted_temperature"`
	ActualTemperature    *float64   `json:"actual_temperature"`
	InputWindowStartAt   *time.Time `json:"input_window_start_at"`
	InputWindowEndAt     *time.Time `json:"input_window_end_at"`
	PredictedFor         time.Time  `json:"predicted_for"`
	ThermalStatus        string     `json:"thermal_status"`
	FinalStatus          string     `json:"final_status"`
	ThresholdNormalMax   float64    `json:"threshold_normal_max"`
	ThresholdAnomalyMin  float64    `json:"threshold_anomaly_min"`
	IsStale              bool       `json:"is_stale"`
	CreatedAt            time.Time  `json:"created_at"`
}

type PredictionFilters struct {
	FinalStatus string
	From        *time.Time
	To          *time.Time
	Limit       int
	Offset      int
}

type PredictionSettings struct {
	ThresholdNormalMax          float64
	ThresholdAnomalyMin         float64
	PredictionStaleTTLMinutes   int
	ActualMatchToleranceSeconds int
}

type TelegramSettings struct {
	Enabled         bool
	BotToken        string
	ChatID          string
	CooldownMinutes int
}

type ModelVersion struct {
	ID                 int64           `json:"id"`
	ModelName          string          `json:"model_name"`
	ModelType          string          `json:"model_type"`
	Version            string          `json:"version"`
	Algorithm          string          `json:"algorithm"`
	FeatureColumns     []string        `json:"feature_columns"`
	TargetColumn       string          `json:"target_column"`
	WindowSize         int             `json:"window_size"`
	HorizonMinutes     int             `json:"horizon_minutes"`
	RawSamplingSeconds int             `json:"raw_sampling_interval_seconds"`
	ResampleSeconds    int             `json:"resample_interval_seconds"`
	IsActive           bool            `json:"is_active"`
	TrainedAt          *time.Time      `json:"trained_at"`
	CreatedAt          time.Time       `json:"created_at"`
	Metrics            *MetricsSummary `json:"metrics"`
}

type ModelMetrics struct {
	ModelVersion   string     `json:"model_version"`
	DatasetStartAt *time.Time `json:"dataset_start_at"`
	DatasetEndAt   *time.Time `json:"dataset_end_at"`
	TrainSize      *int       `json:"train_size"`
	ValidationSize *int       `json:"validation_size"`
	TestSize       *int       `json:"test_size"`
	RMSE           float64    `json:"rmse"`
	MAE            float64    `json:"mae"`
	MAPE           float64    `json:"mape"`
}

type BaselineResult struct {
	BaselineType string  `json:"baseline_type"`
	RMSE         float64 `json:"rmse"`
	MAE          float64 `json:"mae"`
	MAPE         float64 `json:"mape"`
}

type ModelComparison struct {
	ModelVersion string           `json:"model_version"`
	LSTM         MetricsSummary   `json:"lstm"`
	Baselines    []BaselineResult `json:"baselines"`
}

type AnomalyEvent struct {
	ID                   int64     `json:"id"`
	PredictionID         *int64    `json:"prediction_id"`
	SensorID             *int64    `json:"-"`
	SensorCode           *string   `json:"sensor_code"`
	EventType            string    `json:"event_type"`
	Status               string    `json:"status"`
	Severity             string    `json:"severity"`
	PredictedTemperature *float64  `json:"predicted_temperature"`
	ActualTemperature    *float64  `json:"actual_temperature"`
	Description          *string   `json:"description"`
	DetectedAt           time.Time `json:"detected_at"`
	CreatedAt            time.Time `json:"created_at"`
}

type NotificationLog struct {
	ID             int64          `json:"id"`
	AnomalyEventID *int64         `json:"anomaly_event_id"`
	Channel        string         `json:"channel"`
	Recipient      *string        `json:"recipient"`
	Message        string         `json:"message"`
	Status         string         `json:"status"`
	SentAt         *time.Time     `json:"sent_at"`
	ErrorMessage   *string        `json:"error_message"`
	Metadata       map[string]any `json:"metadata,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
}

type EventFilters struct {
	Status string
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}
