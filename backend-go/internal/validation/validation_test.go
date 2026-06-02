package validation

import (
	"bytes"
	"image"
	"image/color"
	"image/png"
	"testing"

	"ems-thermal-lstm/backend-go/internal/model"
)

func TestValidateLayoutDevice(t *testing.T) {
	validX, validY := 0.25, 0.75
	if errs := ValidateLayoutDevice("S1", model.LayoutDeviceInput{PositionX: &validX, PositionY: &validY}); len(errs) != 0 {
		t.Fatalf("expected valid marker, got %#v", errs)
	}
	invalidX := 1.01
	if errs := ValidateLayoutDevice("S2", model.LayoutDeviceInput{PositionX: &invalidX, PositionY: &validY}); len(errs) == 0 {
		t.Fatal("expected out-of-range marker validation error")
	}
}

func TestValidateLayoutImage(t *testing.T) {
	imageData := image.NewRGBA(image.Rect(0, 0, 2, 3))
	imageData.Set(0, 0, color.White)
	var payload bytes.Buffer
	if err := png.Encode(&payload, imageData); err != nil {
		t.Fatalf("encode PNG: %v", err)
	}
	width, height, extension, errs := ValidateLayoutImage("Testbed", "testbed.png", payload.Bytes())
	if len(errs) != 0 {
		t.Fatalf("expected valid image, got %#v", errs)
	}
	if width != 2 || height != 3 || extension != ".png" {
		t.Fatalf("unexpected decoded metadata: %dx%d %q", width, height, extension)
	}
	if _, _, _, errs := ValidateLayoutImage("Testbed", "testbed.jpg", payload.Bytes()); len(errs) == 0 {
		t.Fatal("expected mismatched extension validation error")
	}
}

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

func TestValidatePredictionRequiresS2AndOrderedWindow(t *testing.T) {
	temperature := 31.2
	input := model.PredictionInput{
		TargetSensorCode:     "S1",
		PredictedTemperature: &temperature,
		InputWindowStartAt:   "2026-06-01T10:00:00Z",
		InputWindowEndAt:     "2026-06-01T10:30:00Z",
		PredictedFor:         "2026-06-01T10:35:00Z",
	}
	if errs := ValidatePrediction(input); len(errs["target_sensor_code"]) == 0 {
		t.Fatalf("expected S2 target validation error, got %#v", errs)
	}
}

func TestValidateSettingUpdateRejectsInvalidThresholdOrder(t *testing.T) {
	errs := ValidateSettingUpdate(
		"threshold_normal_max",
		model.SettingUpdateInput{Value: "33"},
		map[string]string{"threshold_normal_max": "30", "threshold_anomaly_min": "32"},
	)
	if len(errs["value"]) == 0 {
		t.Fatalf("expected invalid threshold order, got %#v", errs)
	}
}

func TestValidateSettingUpdateRejectsMaskedSensitiveValue(t *testing.T) {
	errs := ValidateSettingUpdate(
		"telegram_bot_token",
		model.SettingUpdateInput{Value: model.MaskedSettingValue},
		nil,
	)
	if len(errs["value"]) == 0 {
		t.Fatalf("expected masked sensitive value rejection, got %#v", errs)
	}
}

func TestValidateSettingUpdateRejectsReadOnlyKey(t *testing.T) {
	errs := ValidateSettingUpdate(
		"lstm_window_size",
		model.SettingUpdateInput{Value: "60"},
		nil,
	)
	if len(errs["key"]) == 0 {
		t.Fatalf("expected read-only setting rejection, got %#v", errs)
	}
}
