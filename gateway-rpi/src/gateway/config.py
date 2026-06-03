from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from gateway.models import (
    AppConfig,
    BackendConfig,
    BufferConfig,
    GatewayConfig,
    LoggingConfig,
    ModbusConfig,
    RegisterConfig,
    SamplingConfig,
    SensorConfig,
    SensorRegisters,
    ValidationConfig,
)


class ConfigError(ValueError):
    """Raised when gateway configuration is missing or invalid."""


def load_config(config_path: str | Path | None = None) -> AppConfig:
    load_dotenv()
    path = Path(config_path or os.getenv("GATEWAY_CONFIG", "./config.yaml")).expanduser().resolve()
    if not path.is_file():
        raise ConfigError(
            f"configuration file not found: {path}. Copy config.example.yaml to config.yaml first."
        )

    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError) as exc:
        raise ConfigError(f"cannot read configuration file {path}: {exc}") from exc
    if not isinstance(raw, dict):
        raise ConfigError("configuration root must be a YAML mapping")

    _apply_environment_overrides(raw)
    try:
        config = _build_config(raw, path.parent)
    except (KeyError, TypeError, ValueError) as exc:
        raise ConfigError(f"invalid gateway configuration: {exc}") from exc
    _validate_config(config)
    return config


def _apply_environment_overrides(raw: dict[str, Any]) -> None:
    overrides = (
        ("GATEWAY_ID", ("gateway", "id"), str),
        ("BACKEND_BASE_URL", ("backend", "base_url"), str),
        ("GATEWAY_TOKEN", ("backend", "token"), str),
        ("BACKEND_TOKEN", ("backend", "token"), str),
        ("MODBUS_PORT", ("modbus", "port"), str),
        ("MODBUS_REGISTER_TYPE", ("modbus", "register_type"), str),
        ("SAMPLING_INTERVAL_SECONDS", ("sampling", "interval_seconds"), float),
        ("HEARTBEAT_INTERVAL_SECONDS", ("sampling", "heartbeat_interval_seconds"), float),
        ("BUFFER_FILE_PATH", ("buffer", "file_path"), str),
        ("LOG_LEVEL", ("logging", "level"), str),
        ("LOG_FILE_PATH", ("logging", "file_path"), str),
    )
    for env_name, keys, caster in overrides:
        value = os.getenv(env_name)
        if value is None or value == "":
            continue
        target = raw.setdefault(keys[0], {})
        target[keys[1]] = caster(value)


def _build_config(raw: dict[str, Any], base_dir: Path) -> AppConfig:
    gateway = raw["gateway"]
    backend = raw["backend"]
    sampling = raw["sampling"]
    modbus = raw["modbus"]
    validation = raw["validation"]
    buffer_config = raw["buffer"]
    logging_config = raw["logging"]

    sensors = tuple(_build_sensor(sensor) for sensor in raw["sensors"])
    return AppConfig(
        gateway=GatewayConfig(
            id=str(gateway["id"]).strip(),
            name=str(gateway["name"]).strip(),
            mode=str(gateway["mode"]).strip(),
            location=str(gateway["location"]).strip(),
        ),
        backend=BackendConfig(
            base_url=str(backend["base_url"]).strip().rstrip("/"),
            readings_endpoint=_endpoint(backend["readings_endpoint"]),
            status_endpoint=_endpoint(backend["status_endpoint"]),
            token=str(backend["token"]).strip(),
            timeout_seconds=float(backend["timeout_seconds"]),
            retry_count=int(backend["retry_count"]),
            retry_delay_seconds=float(backend["retry_delay_seconds"]),
        ),
        sampling=SamplingConfig(
            interval_seconds=float(sampling["interval_seconds"]),
            heartbeat_interval_seconds=float(sampling.get("heartbeat_interval_seconds", 60)),
        ),
        modbus=ModbusConfig(
            port=str(modbus["port"]).strip(),
            baudrate=int(modbus["baudrate"]),
            bytesize=int(modbus["bytesize"]),
            parity=str(modbus["parity"]).strip().upper(),
            stopbits=int(modbus["stopbits"]),
            timeout_seconds=float(modbus["timeout_seconds"]),
            register_type=_normalize_register_type(modbus.get("register_type", "holding")),
        ),
        sensors=sensors,
        validation=ValidationConfig(
            temperature_min=float(validation["temperature_min"]),
            temperature_max=float(validation["temperature_max"]),
            humidity_min=float(validation["humidity_min"]),
            humidity_max=float(validation["humidity_max"]),
        ),
        buffer=BufferConfig(
            enabled=bool(buffer_config["enabled"]),
            file_path=_runtime_path(base_dir, buffer_config["file_path"]),
            max_items=int(buffer_config["max_items"]),
            replay_enabled=bool(buffer_config["replay_enabled"]),
            replay_batch_size=int(buffer_config["replay_batch_size"]),
            replay_interval_seconds=float(buffer_config["replay_interval_seconds"]),
        ),
        logging=LoggingConfig(
            level=str(logging_config["level"]).strip().upper(),
            file_path=_runtime_path(base_dir, logging_config["file_path"]),
        ),
    )


def _build_sensor(raw: dict[str, Any]) -> SensorConfig:
    registers = raw["registers"]
    return SensorConfig(
        code=str(raw["code"]).strip().upper(),
        role=str(raw["role"]).strip().lower(),
        name=str(raw["name"]).strip(),
        enabled=bool(raw["enabled"]),
        slave_id=int(raw["slave_id"]),
        registers=SensorRegisters(
            temperature=_build_register(registers["temperature"]),
            humidity=_build_register(registers["humidity"]),
        ),
    )


def _build_register(raw: dict[str, Any]) -> RegisterConfig:
    return RegisterConfig(
        address=int(raw["address"]),
        count=int(raw["count"]),
        scale=float(raw["scale"]),
        register_type=_normalize_register_type(raw.get("register_type", raw.get("function", "holding"))),
    )


def _normalize_register_type(value: Any) -> str:
    normalized = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    if normalized in {"3", "03", "function_03", "function03", "holding", "holding_registers"}:
        return "holding"
    if normalized in {"4", "04", "function_04", "function04", "input", "input_registers"}:
        return "input"
    raise ConfigError("register_type must be holding/function03 or input/function04")


def _runtime_path(base_dir: Path, value: Any) -> Path:
    path = Path(str(value)).expanduser()
    return path if path.is_absolute() else (base_dir / path).resolve()


def _endpoint(value: Any) -> str:
    endpoint = str(value).strip()
    return endpoint if endpoint.startswith("/") else f"/{endpoint}"


def _validate_config(config: AppConfig) -> None:
    if not config.gateway.id:
        raise ConfigError("gateway.id must not be empty")
    if config.gateway.mode != "hardware":
        raise ConfigError("gateway.mode must be hardware")
    if not config.backend.base_url.startswith(("http://", "https://")):
        raise ConfigError("backend.base_url must start with http:// or https://")
    if not config.backend.token:
        raise ConfigError("backend.token must not be empty")
    if config.backend.retry_count not in (0, 1):
        raise ConfigError("backend.retry_count must be 0 or 1")
    if config.backend.timeout_seconds <= 0 or config.backend.retry_delay_seconds < 0:
        raise ConfigError("backend timeout must be positive and retry delay must not be negative")
    if config.sampling.interval_seconds <= 0 or config.sampling.heartbeat_interval_seconds <= 0:
        raise ConfigError("sampling intervals must be positive")
    if not config.modbus.port:
        raise ConfigError("modbus.port must not be empty")
    if config.modbus.parity not in {"N", "E", "O"}:
        raise ConfigError("modbus.parity must be N, E, or O")
    if config.modbus.register_type not in {"holding", "input"}:
        raise ConfigError("modbus.register_type must be holding or input")
    if config.validation.temperature_min > config.validation.temperature_max:
        raise ConfigError("validation temperature range is invalid")
    if config.validation.humidity_min > config.validation.humidity_max:
        raise ConfigError("validation humidity range is invalid")
    if config.buffer.max_items <= 0 or config.buffer.replay_batch_size <= 0:
        raise ConfigError("buffer limits must be positive")
    if config.buffer.replay_interval_seconds <= 0:
        raise ConfigError("buffer replay interval must be positive")

    expected_roles = {"S1": "ambient", "S2": "hotspot"}
    sensor_codes = {sensor.code for sensor in config.sensors}
    if sensor_codes != set(expected_roles):
        raise ConfigError("sensors must configure exactly S1 and S2")
    for sensor in config.sensors:
        if sensor.role != expected_roles[sensor.code]:
            raise ConfigError(f"{sensor.code} role must be {expected_roles[sensor.code]}")
        if sensor.slave_id <= 0:
            raise ConfigError(f"{sensor.code} slave_id must be positive")
        for register in (sensor.registers.temperature, sensor.registers.humidity):
            if register.address < 0 or register.count <= 0:
                raise ConfigError(f"{sensor.code} register address/count is invalid")
            if register.register_type not in {"holding", "input"}:
                raise ConfigError(f"{sensor.code} register_type must be holding or input")
