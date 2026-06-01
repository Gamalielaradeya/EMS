package model

import "time"

type ReadingInput struct {
	SensorCode  string   `json:"sensor_code"`
	SensorRole  string   `json:"sensor_role"`
	Temperature *float64 `json:"temperature"`
	Humidity    *float64 `json:"humidity"`
}

type ReadingsInput struct {
	GatewayID  string         `json:"gateway_id"`
	RecordedAt string         `json:"recorded_at"`
	Source     string         `json:"source"`
	Readings   []ReadingInput `json:"readings"`
}

type GatewaySensorStatusInput struct {
	SensorCode string `json:"sensor_code"`
	Status     string `json:"status"`
	Message    string `json:"message"`
}

type GatewayStatusInput struct {
	GatewayID  string                     `json:"gateway_id"`
	Status     string                     `json:"status"`
	ReportedAt string                     `json:"reported_at"`
	Message    string                     `json:"message"`
	Sensors    []GatewaySensorStatusInput `json:"sensors"`
}

type SensorUpdateInput struct {
	Name               *string `json:"name"`
	Location           *string `json:"location"`
	ModbusSlaveID      *int    `json:"modbus_slave_id"`
	SensorHealthStatus *string `json:"sensor_health_status"`
}

type Sensor struct {
	ID                 int64      `json:"id"`
	GatewayCode        *string    `json:"gateway_id"`
	SensorCode         string     `json:"sensor_code"`
	SensorRole         string     `json:"sensor_role"`
	Name               string     `json:"name"`
	Type               string     `json:"type"`
	Location           *string    `json:"location"`
	ModbusSlaveID      *int       `json:"modbus_slave_id"`
	SensorHealthStatus string     `json:"sensor_health_status"`
	LastSeenAt         *time.Time `json:"last_seen_at"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

type Reading struct {
	ID            int64     `json:"id"`
	GatewayCode   string    `json:"gateway_id"`
	SensorCode    string    `json:"sensor_code"`
	SensorRole    string    `json:"sensor_role"`
	Temperature   float64   `json:"temperature"`
	Humidity      float64   `json:"humidity"`
	RecordedAt    time.Time `json:"recorded_at"`
	QualityStatus string    `json:"quality_status"`
	Source        string    `json:"source"`
}

type ReadingFilters struct {
	SensorCode    string
	QualityStatus string
	From          *time.Time
	To            *time.Time
	Limit         int
	Offset        int
}

type ReadingInsert struct {
	SensorCode  string
	Temperature float64
	Humidity    float64
}

type GatewaySummary struct {
	GatewayCode string     `json:"gateway_code"`
	Status      string     `json:"status"`
	LastSeenAt  *time.Time `json:"last_seen_at"`
}

type DashboardReading struct {
	SensorCode         string    `json:"sensor_code"`
	SensorRole         string    `json:"sensor_role"`
	Temperature        float64   `json:"temperature"`
	Humidity           float64   `json:"humidity"`
	SensorHealthStatus string    `json:"sensor_health_status"`
	QualityStatus      string    `json:"quality_status"`
	RecordedAt         time.Time `json:"recorded_at"`
}

type PredictionSummary struct {
	ID                   int64     `json:"id"`
	TargetSensor         string    `json:"target_sensor"`
	PredictedTemperature float64   `json:"predicted_temperature"`
	PredictedFor         time.Time `json:"predicted_for"`
	ThermalStatus        string    `json:"thermal_status"`
	FinalStatus          string    `json:"final_status"`
	ModelVersion         *string   `json:"model_version"`
	IsStale              bool      `json:"is_stale"`
}

type ActiveModelSummary struct {
	ID        int64      `json:"id"`
	Version   string     `json:"version"`
	TrainedAt *time.Time `json:"trained_at"`
}

type MetricsSummary struct {
	RMSE float64 `json:"rmse"`
	MAE  float64 `json:"mae"`
	MAPE float64 `json:"mape"`
}

type TodaySummary struct {
	TotalReadings int64 `json:"total_readings"`
	TotalWaspada  int64 `json:"total_waspada"`
	TotalAnomali  int64 `json:"total_anomali"`
	TotalTrouble  int64 `json:"total_trouble"`
}

type TelegramSummary struct {
	Enabled    bool    `json:"enabled"`
	LastStatus *string `json:"last_status"`
}

type DashboardEvent struct {
	ID          int64     `json:"id"`
	SensorCode  *string   `json:"sensor_code"`
	Status      string    `json:"status"`
	Severity    string    `json:"severity"`
	Description *string   `json:"description"`
	DetectedAt  time.Time `json:"detected_at"`
}

type DashboardSummary struct {
	Gateway          *GatewaySummary             `json:"gateway"`
	LatestReadings   map[string]DashboardReading `json:"latest_readings"`
	LatestPrediction *PredictionSummary          `json:"latest_prediction"`
	ActiveModel      *ActiveModelSummary         `json:"active_model"`
	LatestMetrics    *MetricsSummary             `json:"latest_metrics"`
	TodaySummary     TodaySummary                `json:"today_summary"`
	Telegram         TelegramSummary             `json:"telegram"`
	RecentEvents     []DashboardEvent            `json:"recent_events"`
}

type SystemLog struct {
	ID        int64          `json:"id"`
	Source    string         `json:"source"`
	Level     string         `json:"level"`
	Message   string         `json:"message"`
	Context   map[string]any `json:"context,omitempty"`
	CreatedAt time.Time      `json:"created_at"`
}

type StatusChange struct {
	Entity string    `json:"entity"`
	Code   string    `json:"code"`
	Status string    `json:"status"`
	Log    SystemLog `json:"-"`
}
