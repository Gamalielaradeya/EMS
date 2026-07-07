from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from gateway.config import load_config
from gateway.simulator import SimulatorOptions, SmoothThermalSimulator, duration_to_seconds, run_simulator


class SimulatorTests(unittest.TestCase):
    def test_random_smooth_generates_threshold_crossing_readings(self) -> None:
        simulator = SmoothThermalSimulator(SimulatorOptions(duration_seconds=900, interval_seconds=10, seed=5))
        temperatures = []
        for _ in range(90):
            readings, metadata = simulator.next_readings()
            self.assertEqual(len(readings), 2)
            self.assertIn(metadata["segment"], {"normal_stable", "heating_slow", "heating_fast", "hot_hold", "recovery"})
            temperatures.append(next(reading.temperature for reading in readings if reading.sensor_code == "S2"))
        self.assertGreater(max(temperatures), 30.0)

    def test_drop_sensor_omits_sensor_after_configured_time(self) -> None:
        simulator = SmoothThermalSimulator(
            SimulatorOptions(duration_seconds=120, interval_seconds=10, drop_sensor="S2", drop_after_seconds=10)
        )
        first, _ = simulator.next_readings()
        second, _ = simulator.next_readings()
        self.assertEqual({reading.sensor_code for reading in first}, {"S1", "S2"})
        self.assertEqual({reading.sensor_code for reading in second}, {"S1"})

    def test_duration_parser(self) -> None:
        self.assertEqual(duration_to_seconds("10s"), 10)
        self.assertEqual(duration_to_seconds("2m"), 120)
        self.assertEqual(duration_to_seconds("1h"), 3600)
        self.assertEqual(duration_to_seconds("15"), 15)

    def test_run_simulator_sends_simulator_payloads(self) -> None:
        config = load_config("config.example.yaml")
        sender = RecordingSender()
        timeline = Timeline()
        code = run_simulator(
            config,
            SimulatorOptions(duration_seconds=20, interval_seconds=10, seed=3),
            sender=sender,  # type: ignore[arg-type]
            sleeper=timeline.sleep,
            now=timeline.now,
            printer=lambda _: None,
        )
        self.assertEqual(code, 0)
        self.assertEqual(len(sender.payloads), 2)
        self.assertEqual(sender.payloads[0]["source"], "simulator")
        self.assertEqual(sender.payloads[0]["gateway_id"], config.gateway.id)


class RecordingSender:
    def __init__(self) -> None:
        self.payloads: list[dict[str, object]] = []

    def send_readings(self, payload: dict[str, object]) -> dict[str, str]:
        self.payloads.append(payload)
        return {"status": "success"}


class Timeline:
    def __init__(self) -> None:
        self.current = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def now(self) -> datetime:
        return self.current

    def sleep(self, seconds: float) -> None:
        self.current += timedelta(seconds=seconds)


if __name__ == "__main__":
    unittest.main()
