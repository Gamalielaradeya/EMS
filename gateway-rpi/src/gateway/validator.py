from __future__ import annotations

from gateway.models import SensorConfig, SensorReading, ValidationConfig


class SensorValidationError(ValueError):
    """Raised when a sensor reading cannot be sent as a valid measurement."""


def validate_sensor_reading(
    sensor: SensorConfig,
    temperature: float,
    humidity: float,
    rules: ValidationConfig,
) -> SensorReading:
    expected_roles = {"S1": "ambient", "S2": "hotspot"}
    if sensor.code not in expected_roles:
        raise SensorValidationError(f"sensor_code must be S1 or S2, got {sensor.code!r}")
    if sensor.role != expected_roles[sensor.code]:
        raise SensorValidationError(f"{sensor.code} role must be {expected_roles[sensor.code]}")
    if not isinstance(temperature, (int, float)) or isinstance(temperature, bool):
        raise SensorValidationError(f"{sensor.code} temperature must be numeric")
    if not isinstance(humidity, (int, float)) or isinstance(humidity, bool):
        raise SensorValidationError(f"{sensor.code} humidity must be numeric")
    if not rules.temperature_min <= float(temperature) <= rules.temperature_max:
        raise SensorValidationError(
            f"{sensor.code} temperature {temperature} outside "
            f"{rules.temperature_min:g}-{rules.temperature_max:g}"
        )
    if not rules.humidity_min <= float(humidity) <= rules.humidity_max:
        raise SensorValidationError(
            f"{sensor.code} humidity {humidity} outside {rules.humidity_min:g}-{rules.humidity_max:g}"
        )
    return SensorReading(
        sensor_code=sensor.code,
        sensor_role=sensor.role,
        temperature=float(temperature),
        humidity=float(humidity),
    )
