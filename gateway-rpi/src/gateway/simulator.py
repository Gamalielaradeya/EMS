from __future__ import annotations

import math
import random
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable, Iterable

from gateway.http_sender import DeliveryError, HTTPSender
from gateway.models import AppConfig, SensorReading
from gateway.payload_builder import build_readings_payload


@dataclass(frozen=True)
class SimulatorOptions:
    scenario: str = "random-smooth"
    interval_seconds: float = 10.0
    duration_seconds: float | None = 1800.0
    seed: int = 42
    drop_sensor: str | None = None
    drop_after_seconds: float | None = None
    drop_for_seconds: float | None = None
    recover_for_seconds: float | None = None


@dataclass(frozen=True)
class Segment:
    name: str
    seconds: float
    target_s1: float
    target_s2: float


class SmoothThermalSimulator:
    def __init__(self, options: SimulatorOptions) -> None:
        if options.interval_seconds <= 0:
            raise ValueError("interval_seconds must be positive")
        if options.duration_seconds is not None and options.duration_seconds <= 0:
            raise ValueError("duration_seconds must be positive")
        self._options = options
        self._rng = random.Random(options.seed)
        self._elapsed = 0.0
        self._s1_temperature = 27.8
        self._s2_temperature = 28.4
        self._s1_humidity = 62.0
        self._s2_humidity = 59.5
        self._segments = self._build_segments(options.scenario)
        self._segment_index = 0
        self._segment_elapsed = 0.0
        self._segment_start_s1 = self._s1_temperature
        self._segment_start_s2 = self._s2_temperature

    def next_readings(self) -> tuple[list[SensorReading], dict[str, object]]:
        segment = self._segments[self._segment_index]
        progress = min(1.0, self._segment_elapsed / max(segment.seconds, self._options.interval_seconds))
        smooth = 0.5 - 0.5 * math.cos(math.pi * progress)
        noise_s1 = self._rng.uniform(-0.03, 0.03)
        noise_s2 = self._rng.uniform(-0.05, 0.05)

        self._s1_temperature = self._segment_start_s1 + (segment.target_s1 - self._segment_start_s1) * smooth + noise_s1
        self._s2_temperature = self._segment_start_s2 + (segment.target_s2 - self._segment_start_s2) * smooth + noise_s2
        delta = max(0.0, self._s2_temperature - self._s1_temperature)
        self._s1_humidity = _approach(self._s1_humidity, 62.0 - (self._s1_temperature - 27.8) * 1.2, 0.08)
        self._s2_humidity = _approach(self._s2_humidity, self._s1_humidity - 2.0 - delta * 0.75, 0.10)

        readings = [
            SensorReading("S1", "ambient", round(self._s1_temperature, 2), round(self._s1_humidity, 2)),
            SensorReading("S2", "hotspot", round(self._s2_temperature, 2), round(self._s2_humidity, 2)),
        ]
        readings = self._apply_drop_sensor(readings)
        metadata = {
            "elapsed_seconds": round(self._elapsed, 3),
            "segment": segment.name,
            "target_s1": segment.target_s1,
            "target_s2": segment.target_s2,
            "readings_count": len(readings),
        }
        self._advance()
        return readings, metadata

    def _advance(self) -> None:
        step = self._options.interval_seconds
        self._elapsed += step
        self._segment_elapsed += step
        current = self._segments[self._segment_index]
        if self._segment_elapsed >= current.seconds:
            self._segment_index = (self._segment_index + 1) % len(self._segments)
            self._segment_elapsed = 0.0
            self._segment_start_s1 = self._s1_temperature
            self._segment_start_s2 = self._s2_temperature

    def _apply_drop_sensor(self, readings: list[SensorReading]) -> list[SensorReading]:
        if not self._options.drop_sensor or self._options.drop_after_seconds is None:
            return readings
        if self._elapsed < self._options.drop_after_seconds:
            return readings
        if not self._drop_active():
            return readings
        dropped = self._options.drop_sensor.upper()
        return [reading for reading in readings if reading.sensor_code != dropped]

    def _drop_active(self) -> bool:
        if self._options.drop_for_seconds is None and self._options.recover_for_seconds is None:
            return True
        if not self._options.drop_for_seconds or not self._options.recover_for_seconds:
            raise ValueError("drop cycle requires both drop_for_seconds and recover_for_seconds")
        if self._options.drop_for_seconds <= 0 or self._options.recover_for_seconds <= 0:
            raise ValueError("drop_for_seconds and recover_for_seconds must be positive")

        cycle_elapsed = (self._elapsed - (self._options.drop_after_seconds or 0.0)) % (
            self._options.drop_for_seconds + self._options.recover_for_seconds
        )
        return cycle_elapsed < self._options.drop_for_seconds

    def _build_segments(self, scenario: str) -> list[Segment]:
        if scenario == "normal":
            return [Segment("normal_stable", self._options.duration_seconds or 3600, 27.8, 28.4)]
        if scenario == "heat-cycle":
            return [
                Segment("normal_stable", 180, 27.8, 28.4),
                Segment("heating_slow", 300, 28.5, 30.8),
                Segment("hot_hold", 180, 28.8, 31.2),
                Segment("recovery", 420, 27.8, 28.5),
            ]
        if scenario != "random-smooth":
            raise ValueError("scenario must be random-smooth, heat-cycle, or normal")

        segments: list[Segment] = [Segment("normal_stable", self._rng.uniform(120, 240), 27.8, 28.4)]
        target_duration = self._options.duration_seconds or 86400
        while sum(segment.seconds for segment in segments) < target_duration + 300:
            peak_s1, peak_s2, impact = self._random_heat_targets()
            recovery_s1 = self._rng.uniform(27.6, 28.5)
            recovery_s2 = self._rng.uniform(28.1, 29.0)
            segments.extend(
                [
                    Segment(
                        f"{impact}_{'heating_slow' if self._rng.random() < 0.65 else 'heating_fast'}",
                        self._rng.uniform(120, 420),
                        peak_s1,
                        peak_s2,
                    ),
                    Segment(
                        f"{impact}_hot_hold",
                        self._rng.uniform(90, 240),
                        peak_s1 + self._rng.uniform(-0.18, 0.18),
                        peak_s2 + self._rng.uniform(-0.25, 0.25),
                    ),
                    Segment("recovery", self._rng.uniform(240, 540), recovery_s1, recovery_s2),
                    Segment(
                        "normal_stable",
                        self._rng.uniform(120, 360),
                        self._rng.uniform(27.5, 28.4),
                        self._rng.uniform(28.1, 28.8),
                    ),
                ]
            )
        return segments

    def _random_heat_targets(self) -> tuple[float, float, str]:
        impact = self._rng.choices(("s2_only", "s1_only", "both"), weights=(0.55, 0.20, 0.25), k=1)[0]
        if impact == "s1_only":
            return self._rng.uniform(30.1, 31.6), self._rng.uniform(28.4, 29.4), impact
        if impact == "both":
            base_peak = self._rng.uniform(30.1, 32.4)
            return base_peak + self._rng.uniform(-0.4, 0.4), base_peak + self._rng.uniform(0.2, 1.2), impact
        return self._rng.uniform(27.7, 28.7), self._rng.uniform(30.2, 33.4), impact


def run_simulator(
    config: AppConfig,
    options: SimulatorOptions,
    *,
    sender: HTTPSender | None = None,
    sleeper: Callable[[float], None] = time.sleep,
    now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    printer: Callable[[str], None] = print,
) -> int:
    simulator = SmoothThermalSimulator(options)
    owns_sender = sender is None
    sender = sender or HTTPSender(config.backend)
    started_at = now()
    sent = 0
    try:
        while options.duration_seconds is None or (now() - started_at).total_seconds() < options.duration_seconds:
            readings, metadata = simulator.next_readings()
            if readings:
                payload = build_readings_payload(
                    config.gateway.id,
                    readings,
                    recorded_at=now(),
                    source="simulator",
                )
                try:
                    sender.send_readings(payload)
                    sent += 1
                    printer(
                        "simulator sent "
                        f"#{sent} "
                        f"segment={metadata['segment']} "
                        f"readings={_reading_summary(readings)}"
                    )
                except DeliveryError as exc:
                    printer(f"simulator delivery failed: {exc}")
                    return 1
            else:
                printer("simulator skipped payload because all sensors are dropped")
            sleeper(options.interval_seconds)
        return 0
    finally:
        if owns_sender:
            sender.close()


def duration_to_seconds(value: str) -> float | None:
    text = value.strip().lower()
    if not text:
        raise ValueError("duration must not be empty")
    if text in {"forever", "infinite", "inf", "none"}:
        return None
    unit = text[-1]
    number = text[:-1] if unit in {"s", "m", "h"} else text
    amount = float(number)
    if amount <= 0:
        raise ValueError("duration must be positive")
    if unit == "h":
        return amount * 3600
    if unit == "m":
        return amount * 60
    return amount


def _approach(current: float, target: float, rate: float) -> float:
    return current + (target - current) * rate


def _reading_summary(readings: Iterable[SensorReading]) -> str:
    return ", ".join(
        f"{reading.sensor_code}={reading.temperature:.2f}C/{reading.humidity:.1f}%"
        for reading in readings
    )
