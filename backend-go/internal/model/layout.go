package model

import "time"

const MaxLayoutImageBytes = 5 << 20

type Layout struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	ImageURL    string    `json:"image_url"`
	ImageWidth  int       `json:"image_width"`
	ImageHeight int       `json:"image_height"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type LayoutDevice struct {
	SensorCode         string     `json:"sensor_code"`
	SensorRole         string     `json:"sensor_role"`
	Label              string     `json:"label"`
	PositionX          float64    `json:"position_x"`
	PositionY          float64    `json:"position_y"`
	FinalStatus        string     `json:"final_status"`
	Temperature        *float64   `json:"temperature"`
	Humidity           *float64   `json:"humidity"`
	LastSeenAt         *time.Time `json:"last_seen_at"`
	SensorHealthStatus string     `json:"sensor_health_status"`
}

type ActiveLayout struct {
	Layout  Layout         `json:"layout"`
	Devices []LayoutDevice `json:"devices"`
}

type LayoutDeviceInput struct {
	Label     string   `json:"label"`
	PositionX *float64 `json:"position_x"`
	PositionY *float64 `json:"position_y"`
}
