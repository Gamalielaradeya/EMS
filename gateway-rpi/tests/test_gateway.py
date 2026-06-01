from __future__ import annotations

import json
import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import httpx

from gateway.buffer import BufferReplayer, JSONLBuffer
from gateway.config import ConfigError, load_config
from gateway.http_sender import DeliveryError, HTTPSender
from gateway.main import GatewayRuntime
from gateway.models import (
    BackendConfig,
    BufferConfig,
    RegisterConfig,
    SensorConfig,
    SensorRegisters,
    ValidationConfig,
)
from gateway.payload_builder import build_readings_payload
from gateway.sensor_reader import SensorReadError
from gateway.status_reporter import StatusReporter
from gateway.validator import SensorValidationError, validate_sensor_reading


PROJECT_ROOT = Path(__file__).resolve().parents[1]


def backend_config(retry_count: int = 1) -> BackendConfig:
    return BackendConfig(
        base_url="http://backend.test/api/v1",
        readings_endpoint="/readings",
        status_endpoint="/gateway/status",
        token="test-token",
        timeout_seconds=1,
        retry_count=retry_count,
        retry_delay_seconds=0,
    )


def sensor(code: str = "S1", role: str = "ambient") -> SensorConfig:
    register = RegisterConfig(address=1, count=1, scale=0.1)
    return SensorConfig(
        code=code,
        role=role,
        name=code,
        enabled=True,
        slave_id=1,
        registers=SensorRegisters(temperature=register, humidity=register),
    )


class ConfigTests(unittest.TestCase):
    def test_load_config_applies_environment_overrides(self) -> None:
        with patch.dict(
            os.environ,
            {
                "BACKEND_BASE_URL": "http://localhost:8081/api/v1",
                "BACKEND_TOKEN": "local-token",
                "MODBUS_PORT": "COM99",
            },
            clear=False,
        ):
            config = load_config(PROJECT_ROOT / "config.example.yaml")
        self.assertEqual(config.backend.base_url, "http://localhost:8081/api/v1")
        self.assertEqual(config.backend.token, "local-token")
        self.assertEqual(config.modbus.port, "COM99")
        self.assertEqual(config.sensor_by_code("s2").role, "hotspot")

    def test_load_config_reports_missing_file(self) -> None:
        with self.assertRaisesRegex(ConfigError, "configuration file not found"):
            load_config(PROJECT_ROOT / "missing.yaml")


class ValidationAndPayloadTests(unittest.TestCase):
    def setUp(self) -> None:
        self.rules = ValidationConfig(0, 80, 0, 100)

    def test_payload_matches_backend_contract(self) -> None:
        reading = validate_sensor_reading(sensor(), 27.4, 63.2, self.rules)
        payload = build_readings_payload(
            "raspi-gateway-01",
            [reading],
            recorded_at=datetime(2026, 6, 1, 12, 30, tzinfo=timezone.utc),
        )
        self.assertEqual(
            payload,
            {
                "gateway_id": "raspi-gateway-01",
                "recorded_at": "2026-06-01T12:30:00+00:00",
                "source": "hardware",
                "readings": [
                    {
                        "sensor_code": "S1",
                        "sensor_role": "ambient",
                        "temperature": 27.4,
                        "humidity": 63.2,
                    }
                ],
            },
        )

    def test_validation_rejects_wrong_role_and_out_of_range_value(self) -> None:
        with self.assertRaisesRegex(SensorValidationError, "S1 role must be ambient"):
            validate_sensor_reading(sensor(role="hotspot"), 27.4, 63.2, self.rules)
        with self.assertRaisesRegex(SensorValidationError, "outside 0-80"):
            validate_sensor_reading(sensor(), 81, 63.2, self.rules)


class HTTPSenderTests(unittest.TestCase):
    def test_sender_adds_bearer_token_and_retries_once(self) -> None:
        requests: list[httpx.Request] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            if len(requests) == 1:
                return httpx.Response(503, json={"status": "error"})
            return httpx.Response(201, json={"status": "success"})

        sender = HTTPSender(
            backend_config(),
            transport=httpx.MockTransport(handler),
            sleeper=lambda _: None,
        )
        try:
            response = sender.send_readings({"readings": []})
        finally:
            sender.close()
        self.assertEqual(response["status"], "success")
        self.assertEqual(len(requests), 2)
        self.assertEqual(requests[0].headers["Authorization"], "Bearer test-token")

    def test_sender_stops_after_retry_is_exhausted(self) -> None:
        attempts = 0

        def handler(_: httpx.Request) -> httpx.Response:
            nonlocal attempts
            attempts += 1
            return httpx.Response(503)

        sender = HTTPSender(
            backend_config(),
            transport=httpx.MockTransport(handler),
            sleeper=lambda _: None,
        )
        try:
            with self.assertRaises(DeliveryError):
                sender.send_readings({"readings": []})
        finally:
            sender.close()
        self.assertEqual(attempts, 2)


class BufferTests(unittest.TestCase):
    def test_jsonl_buffer_drops_oldest_item_at_bound(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = self._config(Path(temp_dir) / "failed_payloads.jsonl", max_items=2)
            buffer = JSONLBuffer(config)
            buffer.append("/readings", {"sequence": 1})
            buffer.append("/readings", {"sequence": 2})
            buffer.append("/readings", {"sequence": 3})
            self.assertEqual([item.payload["sequence"] for item in buffer.read_all()], [2, 3])

    def test_replay_is_batched_throttled_and_marks_source(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = self._config(Path(temp_dir) / "failed_payloads.jsonl", replay_batch_size=1)
            buffer = JSONLBuffer(config)
            buffer.append("/readings", {"sequence": 1, "source": "hardware", "readings": []})
            buffer.append("/readings", {"sequence": 2, "source": "hardware", "readings": []})
            sender = RecordingSender()
            ticks = iter((100.0, 101.0, 200.0))
            replayer = BufferReplayer(config, buffer, sender, monotonic=lambda: next(ticks))

            self.assertEqual(replayer.replay_due(), 1)
            self.assertEqual(replayer.replay_due(), 0)
            self.assertEqual(replayer.replay_due(), 1)
            self.assertEqual(sender.payloads[0]["source"], "replay")
            self.assertEqual(buffer.read_all(), [])

    def test_replay_keeps_item_when_backend_is_still_offline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            config = self._config(Path(temp_dir) / "failed_payloads.jsonl")
            buffer = JSONLBuffer(config)
            buffer.append("/readings", {"sequence": 1, "source": "hardware", "readings": []})
            replayer = BufferReplayer(config, buffer, FailingSender(), monotonic=lambda: 100.0)

            self.assertEqual(replayer.replay_due(), 0)
            self.assertEqual(len(buffer.read_all()), 1)

    @staticmethod
    def _config(
        path: Path,
        *,
        max_items: int = 3,
        replay_batch_size: int = 2,
    ) -> BufferConfig:
        return BufferConfig(
            enabled=True,
            file_path=path,
            max_items=max_items,
            replay_enabled=True,
            replay_batch_size=replay_batch_size,
            replay_interval_seconds=60,
        )


class RecordingSender:
    def __init__(self) -> None:
        self.payloads: list[dict[str, object]] = []

    def send(self, _: str, payload: dict[str, object]) -> dict[str, str]:
        self.payloads.append(payload)
        return {"status": "success"}


class FailingSender:
    def send(self, _: str, payload: dict[str, object]) -> dict[str, str]:
        raise DeliveryError("backend offline")


class StatusReporterTests(unittest.TestCase):
    def test_status_change_is_immediate_and_heartbeat_is_periodic(self) -> None:
        sender = RecordingStatusSender()
        ticks = iter((0.0, 1.0, 2.0, 62.0))
        reporter = StatusReporter(
            "raspi-gateway-01",
            [sensor()],
            sender,
            heartbeat_interval_seconds=60,
            monotonic=lambda: next(ticks),
        )

        self.assertTrue(reporter.report_if_due())
        self.assertFalse(reporter.report_if_due())
        reporter.mark_trouble("S1", "Sensor timeout")
        self.assertTrue(reporter.report_if_due())
        self.assertTrue(reporter.report_if_due())
        self.assertEqual(len(sender.payloads), 3)
        self.assertEqual(sender.payloads[1]["sensors"][0]["status"], "trouble")
        self.assertEqual(sender.payloads[2]["message"], "Gateway heartbeat")

    def test_failed_heartbeat_waits_until_next_interval(self) -> None:
        sender = FailingStatusSender()
        ticks = iter((0.0, 1.0, 61.0))
        reporter = StatusReporter(
            "raspi-gateway-01",
            [sensor()],
            sender,
            heartbeat_interval_seconds=60,
            monotonic=lambda: next(ticks),
        )

        self.assertFalse(reporter.report_if_due())
        self.assertFalse(reporter.report_if_due())
        self.assertFalse(reporter.report_if_due())
        self.assertEqual(sender.calls, 2)


class RuntimeTests(unittest.TestCase):
    def test_cycle_buffers_valid_peer_reading_when_sensor_and_backend_fail(self) -> None:
        config = load_config(PROJECT_ROOT / "config.example.yaml")
        reader = PartialReader()
        sender = OfflineSender()
        buffer = RecordingBuffer()
        status = RecordingRuntimeStatus()
        with (
            patch("gateway.main.GatewayModbusClient", return_value=Closable()),
            patch("gateway.main.SensorReader", return_value=reader),
            patch("gateway.main.HTTPSender", return_value=sender),
            patch("gateway.main.JSONLBuffer", return_value=buffer),
            patch("gateway.main.BufferReplayer", return_value=NoopReplayer()),
            patch("gateway.main.StatusReporter", return_value=status),
        ):
            runtime = GatewayRuntime(config)
            runtime.run_once()
            runtime.close()

        self.assertEqual(len(buffer.items), 1)
        self.assertEqual(buffer.items[0][1]["readings"][0]["sensor_code"], "S1")
        self.assertEqual(status.trouble_codes, ["S2"])
        self.assertEqual(status.report_calls, 1)


class RecordingStatusSender:
    def __init__(self) -> None:
        self.payloads: list[dict[str, object]] = []

    def send_status(self, payload: dict[str, object]) -> dict[str, str]:
        self.payloads.append(payload)
        return {"status": "success"}


class FailingStatusSender:
    def __init__(self) -> None:
        self.calls = 0

    def send_status(self, _: dict[str, object]) -> dict[str, str]:
        self.calls += 1
        raise DeliveryError("backend offline")


class PartialReader:
    def read(self, configured_sensor: SensorConfig) -> object:
        if configured_sensor.code == "S2":
            raise SensorReadError("S2 read failed: timeout")
        return validate_sensor_reading(configured_sensor, 27.4, 63.2, ValidationConfig(0, 80, 0, 100))


class OfflineSender:
    def send_readings(self, payload: dict[str, object]) -> dict[str, str]:
        raise DeliveryError("backend offline")

    def close(self) -> None:
        return None


class RecordingBuffer:
    def __init__(self) -> None:
        self.items: list[tuple[str, dict[str, object]]] = []

    def append(self, endpoint: str, payload: dict[str, object]) -> None:
        self.items.append((endpoint, payload))


class NoopReplayer:
    def replay_due(self) -> int:
        return 0


class RecordingRuntimeStatus:
    def __init__(self) -> None:
        self.trouble_codes: list[str] = []
        self.report_calls = 0

    def mark_normal(self, _: str) -> None:
        return None

    def mark_trouble(self, sensor_code: str, _: str) -> None:
        self.trouble_codes.append(sensor_code)

    def report_if_due(self) -> bool:
        self.report_calls += 1
        return True


class Closable:
    def close(self) -> None:
        return None


if __name__ == "__main__":
    unittest.main()
