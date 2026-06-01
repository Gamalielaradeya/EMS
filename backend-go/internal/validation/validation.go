package validation

import (
	"strconv"
	"strings"
	"time"

	"ems-thermal-lstm/backend-go/internal/model"
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
