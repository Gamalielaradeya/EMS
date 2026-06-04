package repository

import (
	"testing"

	"ems-thermal-lstm/backend-go/internal/model"
)

func TestClassifyCurrentThermalStatusBoundaries(t *testing.T) {
	settings := model.PredictionSettings{ThresholdNormalMax: 30, ThresholdAnomalyMin: 32}
	cases := map[float64]string{29.9: "normal", 30: "waspada", 32: "waspada", 32.1: "anomali"}
	for temperature, expected := range cases {
		if actual := classifyCurrentThermalStatus(temperature, settings); actual != expected {
			t.Fatalf("temperature %.1f: expected %s, got %s", temperature, expected, actual)
		}
	}
}

func TestCurrentThermalSeverity(t *testing.T) {
	if currentThermalSeverity("anomali") <= currentThermalSeverity("waspada") {
		t.Fatal("anomali must outrank waspada")
	}
	if currentThermalSeverity("waspada") <= currentThermalSeverity("normal") {
		t.Fatal("waspada must outrank normal")
	}
}
