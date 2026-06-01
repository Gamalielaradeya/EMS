from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class RegisterConfig:
    address: int
    count: int
    scale: float


@dataclass(frozen=True)
class SensorRegisters:
    temperature: RegisterConfig
    humidity: RegisterConfig


@dataclass(frozen=True)
class SensorConfig:
    code: str
    role: str
    name: str
    enabled: bool
    slave_id: int
    registers: SensorRegisters


@dataclass(frozen=True)
class GatewayConfig:
    id: str
    name: str
    mode: str
    location: str


@dataclass(frozen=True)
class BackendConfig:
    base_url: str
    readings_endpoint: str
    status_endpoint: str
    token: str
    timeout_seconds: float
    retry_count: int
    retry_delay_seconds: float


@dataclass(frozen=True)
class SamplingConfig:
    interval_seconds: float
    heartbeat_interval_seconds: float


@dataclass(frozen=True)
class ModbusConfig:
    port: str
    baudrate: int
    bytesize: int
    parity: str
    stopbits: int
    timeout_seconds: float


@dataclass(frozen=True)
class ValidationConfig:
    temperature_min: float
    temperature_max: float
    humidity_min: float
    humidity_max: float


@dataclass(frozen=True)
class BufferConfig:
    enabled: bool
    file_path: Path
    max_items: int
    replay_enabled: bool
    replay_batch_size: int
    replay_interval_seconds: float


@dataclass(frozen=True)
class LoggingConfig:
    level: str
    file_path: Path


@dataclass(frozen=True)
class AppConfig:
    gateway: GatewayConfig
    backend: BackendConfig
    sampling: SamplingConfig
    modbus: ModbusConfig
    sensors: tuple[SensorConfig, ...]
    validation: ValidationConfig
    buffer: BufferConfig
    logging: LoggingConfig

    def sensor_by_code(self, sensor_code: str) -> SensorConfig:
        normalized = sensor_code.strip().upper()
        for sensor in self.sensors:
            if sensor.code == normalized:
                return sensor
        raise KeyError(f"sensor {normalized!r} is not configured")


@dataclass(frozen=True)
class SensorReading:
    sensor_code: str
    sensor_role: str
    temperature: float
    humidity: float


@dataclass(frozen=True)
class SensorStatus:
    sensor_code: str
    status: str
    message: str


@dataclass(frozen=True)
class BufferedPayload:
    endpoint: str
    payload: dict[str, Any]
    buffered_at: str

    @classmethod
    def create(cls, endpoint: str, payload: dict[str, Any], now: datetime) -> "BufferedPayload":
        return cls(endpoint=endpoint, payload=payload, buffered_at=now.isoformat())
