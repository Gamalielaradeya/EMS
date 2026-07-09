from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from gateway.config import load_config
from gateway.simulator import SimulatorOptions, SmoothThermalSimulator, duration_to_seconds, run_simulator


class SimulatorTests(unittest.TestCase):
    def test_random_smooth_generates_threshold_crossing_readings(self) -> None:
        simulator = SmoothThermalSimulator(SimulatorOptions(duration_seconds=1800, interval_seconds=10, seed=1))
        temperatures = []
        for _ in range(180):
            readings, metadata = simulator.next_readings()
            self.assertEqual(len(readings), 2)
            self.assertIsInstance(metadata["segment"], str)
            temperatures.append(next(reading.temperature for reading in readings if reading.sensor_code == "S2"))
        self.assertGreater(max(temperatures), 30.0)

    def test_random_smooth_can_heat_s1_without_s2(self) -> None:
        simulator = SmoothThermalSimulator(SimulatorOptions(duration_seconds=7200, interval_seconds=10, seed=1))
        s1_temperatures = []
        s2_temperatures = []
        for _ in range(720):
            readings, _ = simulator.next_readings()
            by_code = {reading.sensor_code: reading.temperature for reading in readings}
            s1_temperatures.append(by_code["S1"])
            s2_temperatures.append(by_code["S2"])
        self.assertGreater(max(s1_temperatures), 30.0)
        self.assertTrue(any(s1 > 30.0 and s2 < 30.0 for s1, s2 in zip(s1_temperatures, s2_temperatures)))

    def test_random_smooth_contains_s1_s2_and_joint_heat_segments(self) -> None:
        simulator = SmoothThermalSimulator(SimulatorOptions(duration_seconds=7200, interval_seconds=10, seed=1))
        segment_names = {segment.name for segment in simulator._segments}  # noqa: SLF001 - verifies deterministic scenario mix.

        self.assertTrue(any(name.startswith("s1_only_") for name in segment_names))
        self.assertTrue(any(name.startswith("s2_only_") for name in segment_names))
        self.assertTrue(any(name.startswith("both_") for name in segment_names))

    def test_random_smooth_starts_with_joint_heat_after_stable_period(self) -> None:
        simulator = SmoothThermalSimulator(SimulatorOptions(duration_seconds=7200, interval_seconds=10, seed=42))

        self.assertEqual(simulator._segments[0].name, "normal_stable")  # noqa: SLF001
        self.assertTrue(simulator._segments[1].name.startswith("both_"))  # noqa: SLF001

    def test_drop_sensor_omits_sensor_after_configured_time(self) -> None:
        simulator = SmoothThermalSimulator(
            SimulatorOptions(duration_seconds=120, interval_seconds=10, drop_sensor="S2", drop_after_seconds=10)
        )
        first, _ = simulator.next_readings()
        second, _ = simulator.next_readings()
        self.assertEqual({reading.sensor_code for reading in first}, {"S1", "S2"})
        self.assertEqual({reading.sensor_code for reading in second}, {"S1"})

    def test_drop_sensor_cycle_recovers_and_drops_again(self) -> None:
        simulator = SmoothThermalSimulator(
            SimulatorOptions(
                duration_seconds=120,
                interval_seconds=10,
                drop_sensor="S2",
                drop_after_seconds=10,
                drop_for_seconds=20,
                recover_for_seconds=30,
            )
        )
        sensor_sets = []
        for _ in range(8):
            readings, _ = simulator.next_readings()
            sensor_sets.append({reading.sensor_code for reading in readings})

        self.assertEqual(sensor_sets[0], {"S1", "S2"})
        self.assertEqual(sensor_sets[1], {"S1"})
        self.assertEqual(sensor_sets[2], {"S1"})
        self.assertEqual(sensor_sets[3], {"S1", "S2"})
        self.assertEqual(sensor_sets[4], {"S1", "S2"})
        self.assertEqual(sensor_sets[5], {"S1", "S2"})
        self.assertEqual(sensor_sets[6], {"S1"})
        self.assertEqual(sensor_sets[7], {"S1"})

    def test_alternating_drop_cycles_s1_then_s2(self) -> None:
        simulator = SmoothThermalSimulator(
            SimulatorOptions(
                duration_seconds=120,
                interval_seconds=10,
                drop_sensor="alternate",
                drop_after_seconds=10,
                drop_for_seconds=20,
                recover_for_seconds=30,
            )
        )
        sensor_sets = []
        dropped_sensors = []
        for _ in range(8):
            readings, metadata = simulator.next_readings()
            sensor_sets.append({reading.sensor_code for reading in readings})
            dropped_sensors.append(metadata["dropped_sensor"])

        self.assertEqual(sensor_sets[0], {"S1", "S2"})
        self.assertEqual(sensor_sets[1:3], [{"S2"}, {"S2"}])
        self.assertEqual(sensor_sets[3:6], [{"S1", "S2"}] * 3)
        self.assertEqual(sensor_sets[6:8], [{"S1"}, {"S1"}])
        self.assertEqual(dropped_sensors[1:3], ["S1", "S1"])
        self.assertEqual(dropped_sensors[6:8], ["S2", "S2"])

    def test_duration_parser(self) -> None:
        self.assertEqual(duration_to_seconds("10s"), 10)
        self.assertEqual(duration_to_seconds("2m"), 120)
        self.assertEqual(duration_to_seconds("1h"), 3600)
        self.assertEqual(duration_to_seconds("15"), 15)
        self.assertIsNone(duration_to_seconds("forever"))

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
