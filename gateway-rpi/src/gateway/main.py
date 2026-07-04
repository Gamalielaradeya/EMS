from __future__ import annotations

import logging
import time
from collections.abc import Callable

from gateway.buffer import BufferReplayer, JSONLBuffer
from gateway.http_sender import DeliveryError, HTTPSender
from gateway.models import AppConfig
from gateway.modbus_client import GatewayModbusClient
from gateway.payload_builder import build_readings_payload
from gateway.sensor_reader import SensorReadError, SensorReader
from gateway.status_reporter import StatusReporter


class GatewayRuntime:
    def __init__(
        self,
        config: AppConfig,
        *,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._sleeper = sleeper
        self._logger = logging.getLogger("gateway.runtime")
        self._modbus = GatewayModbusClient(config.modbus)
        self._reader = SensorReader(self._modbus, config.validation)
        self._sender = HTTPSender(config.backend, sleeper=sleeper)
        self._buffer = JSONLBuffer(config.buffer)
        self._replayer = BufferReplayer(config.buffer, self._buffer, self._sender)
        self._status = StatusReporter(
            config.gateway.id,
            config.sensors,
            self._sender,
            config.sampling.heartbeat_interval_seconds,
        )

    def run_forever(self) -> None:
        self._logger.info("Gateway loop started gateway_id=%s", self._config.gateway.id)
        try:
            while True:
                started_at = time.monotonic()
                self.run_once()
                elapsed = time.monotonic() - started_at
                self._sleeper(max(0, self._config.sampling.interval_seconds - elapsed))
        finally:
            self.close()

    def run_once(self) -> None:
        readings = []
        enabled_sensors = [sensor for sensor in self._config.sensors if sensor.enabled]
        for index, sensor in enumerate(enabled_sensors):
            try:
                reading = self._reader.read(sensor)
            except SensorReadError as exc:
                self._logger.warning("%s", exc)
                self._status.mark_trouble(sensor.code, str(exc))
            else:
                self._status.mark_normal(sensor.code)
                readings.append(reading)
            if index < len(enabled_sensors) - 1 and self._config.modbus.inter_read_delay_ms > 0:
                self._sleeper(self._config.modbus.inter_read_delay_ms / 1000)

        realtime_delivered = False
        if readings:
            payload = build_readings_payload(self._config.gateway.id, readings)
            try:
                self._sender.send_readings(payload)
                realtime_delivered = True
            except DeliveryError as exc:
                self._logger.warning("Realtime readings delivery failed: %s", exc)
                self._buffer.append(self._config.backend.readings_endpoint, payload)
        else:
            self._logger.warning("No valid sensor readings available in this cycle")

        if realtime_delivered:
            self._replayer.replay_due()
        self._status.report_if_due()

    def close(self) -> None:
        self._modbus.close()
        self._sender.close()
