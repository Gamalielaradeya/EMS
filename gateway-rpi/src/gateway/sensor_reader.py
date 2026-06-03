from __future__ import annotations

from gateway.models import RegisterConfig, SensorConfig, SensorReading, ValidationConfig
from gateway.modbus_client import GatewayModbusClient, ModbusReadError
from gateway.validator import SensorValidationError, validate_sensor_reading


class SensorReadError(RuntimeError):
    """Raised when one configured sensor cannot produce a valid reading."""


class SensorReader:
    def __init__(self, client: GatewayModbusClient, validation: ValidationConfig) -> None:
        self._client = client
        self._validation = validation

    def read(self, sensor: SensorConfig) -> SensorReading:
        try:
            temperature = self._read_scaled(sensor, sensor.registers.temperature)
            humidity = self._read_scaled(sensor, sensor.registers.humidity)
            return validate_sensor_reading(sensor, temperature, humidity, self._validation)
        except (ModbusReadError, SensorValidationError) as exc:
            raise SensorReadError(f"{sensor.code} read failed: {exc}") from exc

    def _read_scaled(self, sensor: SensorConfig, register: RegisterConfig) -> float:
        values = self._client.read_registers(
            sensor.slave_id,
            register.address,
            register.count,
            register.register_type,
        )
        return float(values[0]) * register.scale
