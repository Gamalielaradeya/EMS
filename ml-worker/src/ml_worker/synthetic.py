from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class SyntheticConfig:
    minutes: int = 1440
    seed: int = 42
    start_at: datetime = datetime(2026, 1, 1, tzinfo=timezone.utc)
    normal_max: float = 30.0
    anomaly_min: float = 32.0


def generate_synthetic_dataset(config: SyntheticConfig) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    if config.minutes < 60:
        raise ValueError("Synthetic dataset requires at least 60 minutes.")
    if config.normal_max >= config.anomaly_min:
        raise ValueError("normal_max must be lower than anomaly_min.")

    rng = np.random.default_rng(config.seed)
    timestamps = pd.date_range(config.start_at, periods=config.minutes, freq="1min", tz="UTC")
    ambient = _ambient_series(config.minutes, rng)
    hotspot_delta, phases = _hotspot_cycle(config.minutes, rng)

    temperature_s1 = ambient + rng.normal(0, 0.035, config.minutes)
    temperature_s2 = ambient + 0.55 + hotspot_delta + rng.normal(0, 0.055, config.minutes)
    humidity_s1 = np.clip(62.0 - (temperature_s1 - 27.5) * 1.4 + rng.normal(0, 0.15, config.minutes), 25, 90)
    humidity_s2 = np.clip(
        humidity_s1 - 2.2 - hotspot_delta * 0.85 + rng.normal(0, 0.18, config.minutes),
        20,
        90,
    )

    wide = pd.DataFrame(
        {
            "recorded_at": timestamps,
            "temperature_s1": temperature_s1.round(3),
            "humidity_s1": humidity_s1.round(3),
            "temperature_s2": temperature_s2.round(3),
            "humidity_s2": humidity_s2.round(3),
            "scenario_phase": phases,
        }
    )
    wide["thermal_status_s2"] = wide["temperature_s2"].map(
        lambda value: _thermal_status(value, config.normal_max, config.anomaly_min)
    )

    long = pd.concat(
        (_sensor_rows(wide, "S1", "ambient"), _sensor_rows(wide, "S2", "hotspot")),
        ignore_index=True,
    ).sort_values(["recorded_at", "sensor_code"], ignore_index=True)

    manifest = {
        "dataset_type": "synthetic_development_augmentation",
        "disclaimer": "Generated data is not hardware evidence and must not be used in validation or test partitions.",
        "config": {
            **asdict(config),
            "start_at": config.start_at.astimezone(timezone.utc).isoformat(),
        },
        "rows": {"wide": len(wide), "long": len(long)},
        "status_counts": wide["thermal_status_s2"].value_counts().to_dict(),
        "phase_counts": wide["scenario_phase"].value_counts().to_dict(),
        "temperature_s2": {
            "minimum": float(wide["temperature_s2"].min()),
            "maximum": float(wide["temperature_s2"].max()),
            "mean": float(wide["temperature_s2"].mean()),
        },
    }
    return wide, long, manifest


def write_synthetic_dataset(output_dir: Path, config: SyntheticConfig) -> dict:
    wide, long, manifest = generate_synthetic_dataset(config)
    output_dir.mkdir(parents=True, exist_ok=True)
    wide_path = output_dir / "synthetic_ml_wide.csv"
    long_path = output_dir / "synthetic_readings_long.csv"
    manifest_path = output_dir / "synthetic_manifest.json"
    wide.to_csv(wide_path, index=False)
    long.to_csv(long_path, index=False)
    manifest_path.write_text(json.dumps(manifest, indent=2, default=str) + "\n", encoding="utf-8")
    return {
        **manifest,
        "files": {
            "wide": str(wide_path.resolve()),
            "long": str(long_path.resolve()),
            "manifest": str(manifest_path.resolve()),
        },
    }


def _ambient_series(minutes: int, rng: np.random.Generator) -> np.ndarray:
    time = np.arange(minutes)
    slow_cycle = 0.35 * np.sin(2 * np.pi * time / max(minutes, 720))
    drift = np.cumsum(rng.normal(0, 0.003, minutes))
    drift -= drift.mean()
    return 27.6 + slow_cycle + drift


def _hotspot_cycle(minutes: int, rng: np.random.Generator) -> tuple[np.ndarray, list[str]]:
    delta = np.zeros(minutes, dtype=float)
    phases = ["normal"] * minutes
    cursor = int(rng.integers(35, 70))

    while cursor < minutes:
        cursor += int(rng.integers(35, 100))
        if cursor >= minutes:
            break

        heating_length = int(rng.integers(8, 24))
        hold_length = int(rng.integers(6, 20))
        recovery_length = int(rng.integers(15, 40))
        peak = float(rng.uniform(2.3, 5.4))
        rapid = bool(rng.integers(0, 2))

        heat_end = min(cursor + heating_length, minutes)
        heat_progress = np.linspace(0, 1, heat_end - cursor, endpoint=False)
        if rapid:
            heat_progress = np.sqrt(heat_progress)
        delta[cursor:heat_end] = peak * heat_progress
        phases[cursor:heat_end] = ["heating_rapid" if rapid else "heating_slow"] * (heat_end - cursor)

        hold_end = min(heat_end + hold_length, minutes)
        delta[heat_end:hold_end] = peak + rng.normal(0, 0.08, hold_end - heat_end)
        phases[heat_end:hold_end] = ["hot_hold"] * (hold_end - heat_end)

        recovery_end = min(hold_end + recovery_length, minutes)
        delta[hold_end:recovery_end] = np.linspace(peak, 0, recovery_end - hold_end, endpoint=False)
        phases[hold_end:recovery_end] = ["recovery"] * (recovery_end - hold_end)
        cursor = recovery_end

    return delta, phases


def _sensor_rows(wide: pd.DataFrame, sensor_code: str, sensor_role: str) -> pd.DataFrame:
    suffix = sensor_code.lower()
    return pd.DataFrame(
        {
            "recorded_at": wide["recorded_at"],
            "sensor_code": sensor_code,
            "sensor_role": sensor_role,
            "temperature": wide[f"temperature_{suffix}"],
            "humidity": wide[f"humidity_{suffix}"],
            "source": "simulator",
            "quality_status": "simulated",
            "scenario_phase": wide["scenario_phase"],
        }
    )


def _thermal_status(value: float, normal_max: float, anomaly_min: float) -> str:
    if value < normal_max:
        return "normal"
    if value <= anomaly_min:
        return "waspada"
    return "anomali"
