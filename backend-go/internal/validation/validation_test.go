package validation

import (
	"testing"

	"ems-thermal-lstm/backend-go/internal/model"
)

func TestValidateReadingsAcceptsS1AndS2(t *testing.T) {
	temperatureS1, humidityS1 := 27.4, 63.2
	temperatureS2, humidityS2 := 30.8, 58.5
	input := model.ReadingsInput{
		GatewayID:  "raspi-gateway-01",
		RecordedAt: "2026-06-01T10:00:00+07:00",
		Source:     "hardware",
		Readings: []model.ReadingInput{
			{SensorCode: "S1", SensorRole: "ambient", Temperature: &temperatureS1, Humidity: &humidityS1},
			{SensorCode: "S2", SensorRole: "hotspot", Temperature: &temperatureS2, Humidity: &humidityS2},
		},
	}

	if errs := ValidateReadings(input); len(errs) != 0 {
		t.Fatalf("expected valid payload, got errors: %#v", errs)
	}
}

func TestValidateReadingsRejectsTemperatureOutsideRange(t *testing.T) {
	temperature, humidity := 81.0, 50.0
	input := model.ReadingsInput{
		GatewayID:  "raspi-gateway-01",
		RecordedAt: "2026-06-01T10:00:00+07:00",
		Readings: []model.ReadingInput{
			{SensorCode: "S1", SensorRole: "ambient", Temperature: &temperature, Humidity: &humidity},
		},
	}

	if errs := ValidateReadings(input); len(errs["readings[0].temperature"]) == 0 {
		t.Fatalf("expected out-of-range temperature error, got: %#v", errs)
	}
}

func TestValidateReadingsRejectsRoleMismatch(t *testing.T) {
	temperature, humidity := 27.0, 50.0
	input := model.ReadingsInput{
		GatewayID:  "raspi-gateway-01",
		RecordedAt: "2026-06-01T10:00:00+07:00",
		Readings: []model.ReadingInput{
			{SensorCode: "S1", SensorRole: "hotspot", Temperature: &temperature, Humidity: &humidity},
		},
	}

	if errs := ValidateReadings(input); len(errs["readings[0].sensor_role"]) == 0 {
		t.Fatalf("expected role mismatch error, got: %#v", errs)
	}
}

func TestValidateGatewayStatusRejectsInvalidSensorHealth(t *testing.T) {
	input := model.GatewayStatusInput{
		GatewayID:  "raspi-gateway-01",
		Status:     "active",
		ReportedAt: "2026-06-01T10:00:00+07:00",
		Sensors: []model.GatewaySensorStatusInput{
			{SensorCode: "S1", Status: "anomali"},
		},
	}

	if errs := ValidateGatewayStatus(input); len(errs["sensors[0].status"]) == 0 {
		t.Fatalf("expected separated health-status validation error, got: %#v", errs)
	}
}
