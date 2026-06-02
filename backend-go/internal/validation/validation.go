package validation

import (
	"bytes"
	"encoding/json"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"

	_ "golang.org/x/image/webp"
)

type Errors map[string][]string

func (e Errors) Add(field, message string) {
	e[field] = append(e[field], message)
}

func ValidateReadings(input model.ReadingsInput) Errors {
	errs := Errors{}
	if strings.TrimSpace(input.GatewayID) == "" {
		errs.Add("gateway_id", "gateway_id is required")
	}
	if _, err := time.Parse(time.RFC3339, input.RecordedAt); err != nil {
		errs.Add("recorded_at", "recorded_at must use RFC3339 format")
	}
	if input.Source != "" && input.Source != "hardware" && input.Source != "simulator" && input.Source != "replay" {
		errs.Add("source", "source must be hardware, simulator, or replay")
	}
	if len(input.Readings) == 0 {
		errs.Add("readings", "at least one reading is required")
	}

	seen := map[string]bool{}
	for index, reading := range input.Readings {
		prefix := "readings[" + strconv.Itoa(index) + "]"
		expectedRole, exists := sensorRoles[reading.SensorCode]
		if !exists {
			errs.Add(prefix+".sensor_code", "sensor_code must be S1 or S2")
		} else if reading.SensorRole != expectedRole {
			errs.Add(prefix+".sensor_role", reading.SensorCode+" role must be "+expectedRole)
		}
		if seen[reading.SensorCode] {
			errs.Add(prefix+".sensor_code", "sensor_code must not be repeated in one payload")
		}
		seen[reading.SensorCode] = true
		validateMeasurement(errs, prefix+".temperature", reading.Temperature, 0, 80)
		validateMeasurement(errs, prefix+".humidity", reading.Humidity, 0, 100)
	}

	return errs
}

func ValidateGatewayStatus(input model.GatewayStatusInput) Errors {
	errs := Errors{}
	if strings.TrimSpace(input.GatewayID) == "" {
		errs.Add("gateway_id", "gateway_id is required")
	}
	if !isGatewayStatus(input.Status) {
		errs.Add("status", "status must be active, offline, trouble, or maintenance")
	}
	if _, err := time.Parse(time.RFC3339, input.ReportedAt); err != nil {
		errs.Add("reported_at", "reported_at must use RFC3339 format")
	}
	for index, sensor := range input.Sensors {
		prefix := "sensors[" + strconv.Itoa(index) + "]"
		if _, exists := sensorRoles[sensor.SensorCode]; !exists {
			errs.Add(prefix+".sensor_code", "sensor_code must be S1 or S2")
		}
		if !isSensorHealthStatus(sensor.Status) {
			errs.Add(prefix+".status", "status must be normal, trouble, or inactive")
		}
	}
	return errs
}

func ValidateSensorUpdate(input model.SensorUpdateInput) Errors {
	errs := Errors{}
	if input.Name != nil && strings.TrimSpace(*input.Name) == "" {
		errs.Add("name", "name must not be empty")
	}
	if input.ModbusSlaveID != nil && *input.ModbusSlaveID <= 0 {
		errs.Add("modbus_slave_id", "modbus_slave_id must be greater than zero")
	}
	if input.SensorHealthStatus != nil && !isSensorHealthStatus(*input.SensorHealthStatus) {
		errs.Add("sensor_health_status", "sensor_health_status must be normal, trouble, or inactive")
	}
	if input.Name == nil && input.Location == nil && input.ModbusSlaveID == nil && input.SensorHealthStatus == nil {
		errs.Add("body", "at least one editable field is required")
	}
	return errs
}

func ValidatePrediction(input model.PredictionInput) Errors {
	errs := Errors{}
	if input.TargetSensorCode != "S2" {
		errs.Add("target_sensor_code", "target_sensor_code must be S2")
	}
	validateMeasurement(errs, "predicted_temperature", input.PredictedTemperature, 0, 80)
	for field, value := range map[string]string{
		"input_window_start_at": input.InputWindowStartAt,
		"input_window_end_at":   input.InputWindowEndAt,
		"predicted_for":         input.PredictedFor,
	} {
		if _, err := time.Parse(time.RFC3339, value); err != nil {
			errs.Add(field, field+" must use RFC3339 format")
		}
	}
	if len(errs) == 0 {
		startAt, _ := time.Parse(time.RFC3339, input.InputWindowStartAt)
		endAt, _ := time.Parse(time.RFC3339, input.InputWindowEndAt)
		predictedFor, _ := time.Parse(time.RFC3339, input.PredictedFor)
		if !startAt.Before(endAt) {
			errs.Add("input_window_start_at", "input_window_start_at must be before input_window_end_at")
		}
		if !endAt.Before(predictedFor) {
			errs.Add("predicted_for", "predicted_for must be after input_window_end_at")
		}
	}
	return errs
}

func FinalStatusValid(status string) bool {
	return status == "" || status == "normal" || status == "waspada" || status == "anomali" || status == "trouble"
}

func NotificationStatusValid(status string) bool {
	return status == "" || status == "pending" || status == "sent" || status == "failed" || status == "skipped"
}

func SystemLogSourceValid(source string) bool {
	return source == "" || source == "backend" || source == "gateway" || source == "ml-worker" || source == "telegram" || source == "database"
}

func SystemLogLevelValid(level string) bool {
	return level == "" || level == "info" || level == "warning" || level == "error" || level == "critical"
}

func ValidateSettingUpdate(key string, input model.SettingUpdateInput, current map[string]string) Errors {
	errs := Errors{}
	switch key {
	case "threshold_normal_max", "threshold_anomaly_min":
		value, err := strconv.ParseFloat(input.Value, 64)
		if err != nil || value < 0 || value > 80 {
			errs.Add("value", "threshold value must be a number between 0 and 80")
			return errs
		}
		normalMax := floatValue(current["threshold_normal_max"])
		anomalyMin := floatValue(current["threshold_anomaly_min"])
		if key == "threshold_normal_max" {
			normalMax = value
		} else {
			anomalyMin = value
		}
		if normalMax >= anomalyMin {
			errs.Add("value", "threshold_normal_max must be less than threshold_anomaly_min")
		}
	case "sensor_timeout_minutes":
		validatePositiveSetting(errs, input.Value, "sensor timeout")
	case "telegram_cooldown_minutes":
		value, err := strconv.Atoi(input.Value)
		if err != nil || value < 0 {
			errs.Add("value", "telegram cooldown must be a non-negative integer")
		}
	case "telegram_enabled":
		if _, err := strconv.ParseBool(input.Value); err != nil {
			errs.Add("value", "telegram_enabled must be true or false")
		}
	case "telegram_bot_token", "telegram_chat_id":
		if input.Value == model.MaskedSettingValue {
			errs.Add("value", "masked sensitive value cannot be saved")
		}
	default:
		errs.Add("key", "setting is read-only or unsupported")
	}
	return errs
}

func ValidateLayoutImage(name, filename string, data []byte) (int, int, string, Errors) {
	errs := Errors{}
	if len(data) == 0 {
		errs.Add("image", "layout image is required")
		return 0, 0, "", errs
	}
	if len(data) > model.MaxLayoutImageBytes {
		errs.Add("image", "layout image must be at most 5 MB")
		return 0, 0, "", errs
	}
	if len(strings.TrimSpace(name)) > 150 {
		errs.Add("name", "layout name must be at most 150 characters")
	}
	declaredExtension := strings.ToLower(filepath.Ext(filename))
	if declaredExtension != ".png" && declaredExtension != ".jpg" && declaredExtension != ".jpeg" && declaredExtension != ".webp" {
		errs.Add("image", "layout image must be PNG, JPG, JPEG, or WebP")
		return 0, 0, "", errs
	}
	config, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		errs.Add("image", "layout image could not be decoded")
		return 0, 0, "", errs
	}
	extension := map[string]string{"png": ".png", "jpeg": ".jpg", "webp": ".webp"}[format]
	if extension == "" || (declaredExtension != extension && !(extension == ".jpg" && declaredExtension == ".jpeg")) {
		errs.Add("image", "layout image type does not match its filename")
		return 0, 0, "", errs
	}
	return config.Width, config.Height, extension, errs
}

func ValidateLayoutDevice(sensorCode string, input model.LayoutDeviceInput) Errors {
	errs := Errors{}
	if !SensorCodeValid(sensorCode) {
		errs.Add("sensor_code", "sensor_code must be S1 or S2")
	}
	if len(strings.TrimSpace(input.Label)) > 150 {
		errs.Add("label", "label must be at most 150 characters")
	}
	validateRatio(errs, "position_x", input.PositionX)
	validateRatio(errs, "position_y", input.PositionY)
	return errs
}

func validateRatio(errs Errors, field string, value *float64) {
	if value == nil {
		errs.Add(field, field+" is required")
		return
	}
	if *value < 0 || *value > 1 {
		errs.Add(field, field+" must be between 0 and 1")
	}
}

func validatePositiveSetting(errs Errors, value, label string) {
	parsed, err := strconv.Atoi(value)
	if err != nil || parsed <= 0 {
		errs.Add("value", label+" must be a positive integer")
	}
}

func floatValue(value string) float64 {
	var parsed float64
	_ = json.Unmarshal([]byte(value), &parsed)
	return parsed
}

func SensorCodeValid(sensorCode string) bool {
	_, exists := sensorRoles[sensorCode]
	return exists
}

func QualityStatusValid(status string) bool {
	return status == "" || status == "valid" || status == "invalid" || status == "timeout" || status == "simulated"
}

func validateMeasurement(errs Errors, field string, value *float64, minimum, maximum float64) {
	if value == nil {
		errs.Add(field, field+" is required")
		return
	}
	if *value < minimum || *value > maximum {
		errs.Add(field, field+" must be between allowed limits")
	}
}

func isGatewayStatus(status string) bool {
	return status == "active" || status == "offline" || status == "trouble" || status == "maintenance"
}

func isSensorHealthStatus(status string) bool {
	return status == "normal" || status == "trouble" || status == "inactive"
}

var sensorRoles = map[string]string{
	"S1": "ambient",
	"S2": "hotspot",
}
