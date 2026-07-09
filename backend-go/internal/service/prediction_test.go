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
	description := "Sensor S2 changed to trouble after timeout."
	detectedAt := time.Date(2026, 7, 7, 1, 0, 0, 0, time.UTC)
	tests := []struct {
		eventType string
		expected  string
		event     model.AnomalyEvent
	}{
		{eventType: "actual_threshold", expected: "EMS THERMAL - ALARM", event: model.AnomalyEvent{ActualTemperature: &temperature}},
		{eventType: "prediction_threshold", expected: "EMS THERMAL - PRE-ALARM", event: model.AnomalyEvent{PredictedTemperature: &temperature}},
		{eventType: "sensor_trouble", expected: "EMS THERMAL - TROUBLE", event: model.AnomalyEvent{Description: &description}},
	}
	for _, test := range tests {
		t.Run(test.eventType, func(t *testing.T) {
			test.event.EventType = test.eventType
			test.event.Status = "waspada"
			test.event.SensorCode = &sensor
			test.event.DetectedAt = detectedAt
			message := eventAlertMessage(test.event)
			for _, expected := range []string{
				test.expected,
				"Status : WASPADA",
				"Source : Sensor S2",
				"Time   : 07 Jul 2026 08:00:00 WIB",
				"Action :",
			} {
				if !strings.Contains(message, expected) {
					t.Fatalf("expected %q in %q", expected, message)
				}
			}
			if test.eventType == "sensor_trouble" && !strings.Contains(message, "Detail : Sensor S2 changed to trouble after timeout.") {
				t.Fatalf("expected formatted detail in %q", message)
			}
		})
	}
}

func TestSeverityForStatus(t *testing.T) {
	if severityForStatus("anomali") != "critical" || severityForStatus("trouble") != "error" {
		t.Fatal("status severity mapping is incorrect")
	}
}

func TestPredictionTransitionEligibility(t *testing.T) {
	tests := []struct {
		name       string
		prediction model.Prediction
		expected   bool
	}{
		{
			name:       "fresh thermal warning",
			prediction: model.Prediction{FinalStatus: "waspada"},
			expected:   true,
		},
		{
			name:       "fresh thermal recovery",
			prediction: model.Prediction{FinalStatus: "normal"},
			expected:   true,
		},
		{
			name:       "stale prediction",
			prediction: model.Prediction{FinalStatus: "waspada", IsStale: true},
			expected:   false,
		},
		{
			name:       "sensor or gateway trouble",
			prediction: model.Prediction{FinalStatus: "trouble"},
			expected:   false,
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if actual := predictionTransitionEligible(test.prediction); actual != test.expected {
				t.Fatalf("expected %t, got %t", test.expected, actual)
			}
		})
	}
}

func TestNotificationQueueIsNonBlockingWhenFull(t *testing.T) {
	service := &Service{notificationQueue: make(chan notificationJob, 1)}
	job := notificationJob{event: model.AnomalyEvent{ID: 1}}

	if !service.tryQueueNotification(job) {
		t.Fatal("expected first notification to be queued")
	}
	if service.tryQueueNotification(job) {
		t.Fatal("expected full queue to reject notification without blocking")
	}
}
