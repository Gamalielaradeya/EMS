package model

import "time"

const MaskedSettingValue = "********"

type Setting struct {
	Key         string    `json:"key"`
	Value       string    `json:"value"`
	ValueType   string    `json:"value_type"`
	Description *string   `json:"description"`
	IsSensitive bool      `json:"is_sensitive"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SettingUpdateInput struct {
	Value string `json:"value"`
}

type SystemLogFilters struct {
	Source string
	Level  string
	From   *time.Time
	To     *time.Time
	Limit  int
	Offset int
}
