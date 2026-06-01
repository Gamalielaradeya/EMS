from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Iterable

from gateway.models import SensorReading, SensorStatus


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_readings_payload(
    gateway_id: str,
    readings: Iterable[SensorReading],
    *,
    recorded_at: datetime | None = None,
    source: str = "hardware",
) -> dict[str, Any]:
    timestamp = _timestamp(recorded_at or utc_now())
    payload_readings = [
        {
            "sensor_code": reading.sensor_code,
            "sensor_role": reading.sensor_role,
            "temperature": reading.temperature,
            "humidity": reading.humidity,
        }
        for reading in readings
    ]
    if not gateway_id.strip():
        raise ValueError("gateway_id must not be empty")
    if not payload_readings:
        raise ValueError("readings payload must contain at least one reading")
    return {
        "gateway_id": gateway_id,
        "recorded_at": timestamp,
        "source": source,
        "readings": payload_readings,
    }


def build_status_payload(
    gateway_id: str,
    gateway_status: str,
    sensors: Iterable[SensorStatus],
    *,
    message: str,
    reported_at: datetime | None = None,
) -> dict[str, Any]:
    if not gateway_id.strip():
        raise ValueError("gateway_id must not be empty")
    return {
        "gateway_id": gateway_id,
        "status": gateway_status,
        "reported_at": _timestamp(reported_at or utc_now()),
        "message": message,
        "sensors": [
            {
                "sensor_code": sensor.sensor_code,
                "status": sensor.status,
                "message": sensor.message,
            }
            for sensor in sensors
        ],
    }


def build_send_test_payload(gateway_id: str) -> dict[str, Any]:
    return build_readings_payload(
        gateway_id,
        (
            SensorReading("S1", "ambient", 27.4, 63.2),
            SensorReading("S2", "hotspot", 30.8, 58.5),
        ),
        source="simulator",
    )


def mark_replay(payload: dict[str, Any]) -> dict[str, Any]:
    replay_payload = dict(payload)
    if "readings" in replay_payload:
        replay_payload["source"] = "replay"
    return replay_payload


def _timestamp(value: datetime) -> str:
    if value.tzinfo is None:
        raise ValueError("timestamp must include timezone information")
    return value.isoformat()
