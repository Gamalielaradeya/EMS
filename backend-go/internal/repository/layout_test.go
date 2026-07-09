package repository

import (
	"testing"

	"ems-thermal-lstm/backend-go/internal/model"
)

func TestLayoutDeviceStatusUsesActualTemperature(t *testing.T) {
	settings := model.PredictionSettings{ThresholdNormalMax: 30, ThresholdAnomalyMin: 32}
	normal := 29.9
	waspada := 31.0
	anomali := 32.1
	tests := []struct {
		name        string
		health      string
		temperature *float64
		expected    string
	}{
		{name: "normal actual", health: "normal", temperature: &normal, expected: "normal"},
		{name: "warning actual", health: "normal", temperature: &waspada, expected: "waspada"},
		{name: "anomaly actual", health: "normal", temperature: &anomali, expected: "anomali"},
		{name: "health trouble overrides temperature", health: "trouble", temperature: &normal, expected: "trouble"},
		{name: "missing reading is trouble", health: "normal", expected: "trouble"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := layoutDeviceStatus(test.health, test.temperature, settings); actual != test.expected {
				t.Fatalf("expected %s, got %s", test.expected, actual)
			}
		})
	}
}
