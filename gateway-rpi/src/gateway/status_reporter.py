from __future__ import annotations

import logging
import time
from collections.abc import Callable, Iterable

from gateway.http_sender import DeliveryError, HTTPSender
from gateway.models import SensorConfig, SensorStatus
from gateway.payload_builder import build_status_payload


class StatusReporter:
    def __init__(
        self,
        gateway_id: str,
        sensors: Iterable[SensorConfig],
        sender: HTTPSender,
        heartbeat_interval_seconds: float,
        *,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._gateway_id = gateway_id
        self._sender = sender
        self._heartbeat_interval_seconds = heartbeat_interval_seconds
        self._monotonic = monotonic
        self._logger = logging.getLogger("gateway.status")
        self._statuses = {
            sensor.code: SensorStatus(sensor.code, "inactive", "Sensor has not been read yet")
            for sensor in sensors
            if sensor.enabled
        }
        self._last_attempted_at: float | None = None
        self._dirty = True

    def mark_normal(self, sensor_code: str) -> None:
        self._set_status(sensor_code, "normal", "Sensor readable")

    def mark_trouble(self, sensor_code: str, message: str) -> None:
        self._set_status(sensor_code, "trouble", message)

    def report_if_due(self) -> bool:
        now = self._monotonic()
        heartbeat_due = (
            self._last_attempted_at is None
            or now - self._last_attempted_at >= self._heartbeat_interval_seconds
        )
        if not self._dirty and not heartbeat_due:
            return False
        payload = build_status_payload(
            self._gateway_id,
            "active",
            self._statuses.values(),
            message="Gateway heartbeat" if heartbeat_due else "Sensor status changed",
        )
        self._last_attempted_at = now
        try:
            self._sender.send_status(payload)
        except DeliveryError as exc:
            self._logger.warning("Gateway status delivery failed: %s", exc)
            self._dirty = False
            return False
        self._dirty = False
        return True

    def _set_status(self, sensor_code: str, status: str, message: str) -> None:
        current = self._statuses.get(sensor_code)
        updated = SensorStatus(sensor_code, status, message)
        if current != updated:
            self._statuses[sensor_code] = updated
            self._dirty = True
