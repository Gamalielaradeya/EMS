package service

import (
	"strings"
	"testing"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"
)

func TestClassifyThermalStatusBoundaries(t *testing.T) {
	settings := model.PredictionSettings{ThresholdNormalMax: 30, ThresholdAnomalyMin: 32}
	cases := map[float64]string{29.9: "normal", 30: "waspada", 32: "waspada", 32.1: "anomali"}
	for temperature, expected := range cases {
		if actual := classifyThermalStatus(temperature, settings); actual != expected {
			t.Fatalf("temperature %.1f: expected %s, got %s", temperature, expected, actual)
		}
	}
}

func TestEventAlertMessageCategories(t *testing.T) {
	sensor := "S2"
	temperature := 31.5
	detectedAt := time.Date(2026, 7, 7, 1, 0, 0, 0, time.UTC)
	tests := []struct {
		eventType string
		expected  string
		event     model.AnomalyEvent
	}{
		{eventType: "actual_threshold", expected: "EMS THERMAL ALARM", event: model.AnomalyEvent{ActualTemperature: &temperature}},
		{eventType: "prediction_threshold", expected: "EMS THERMAL PRE-ALARM", event: model.AnomalyEvent{PredictedTemperature: &temperature}},
		{eventType: "sensor_trouble", expected: "EMS THERMAL TROUBLE", event: model.AnomalyEvent{}},
	}
	for _, test := range tests {
		t.Run(test.eventType, func(t *testing.T) {
			test.event.EventType = test.eventType
			test.event.Status = "waspada"
			test.event.SensorCode = &sensor
			test.event.DetectedAt = detectedAt
			if message := eventAlertMessage(test.event); !strings.Contains(message, test.expected) {
				t.Fatalf("expected %q in %q", test.expected, message)
			}
		})
	}
}

func TestSeverityForStatus(t *testing.T) {
	if severityForStatus("anomali") != "critical" || severityForStatus("trouble") != "error" {
		t.Fatal("status severity mapping is incorrect")
	}
}
