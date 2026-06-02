package service

import (
	"testing"

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

func TestSeverityForStatus(t *testing.T) {
	if severityForStatus("anomali") != "critical" || severityForStatus("trouble") != "error" {
		t.Fatal("status severity mapping is incorrect")
	}
}
