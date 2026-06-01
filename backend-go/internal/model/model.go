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
