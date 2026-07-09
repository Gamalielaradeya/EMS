from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from ml_worker.config import Settings
from ml_worker.errors import InsufficientDataError
from ml_worker.preprocessing import FEATURE_COLUMNS, TARGET_COLUMN, ChronologicalSplit


@dataclass(frozen=True)
class AugmentedScaledData:
    real: ChronologicalSplit
    synthetic: pd.DataFrame
    feature_scaler: MinMaxScaler
    target_scaler: MinMaxScaler


def load_synthetic_training_csv(path: Path, settings: Settings) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Synthetic training CSV not found: {path}")
    frame = pd.read_csv(path)
    required = {"recorded_at", *FEATURE_COLUMNS}
    missing = required.difference(frame.columns)
    if missing:
        raise InsufficientDataError(f"Synthetic CSV is missing columns: {sorted(missing)}")

    prepared = frame.loc[:, ["recorded_at", *FEATURE_COLUMNS]].copy()
    prepared["recorded_at"] = pd.to_datetime(prepared["recorded_at"], utc=True, errors="coerce")
    for column in FEATURE_COLUMNS:
        prepared[column] = pd.to_numeric(prepared[column], errors="coerce")
    prepared = prepared.dropna().drop_duplicates(subset=["recorded_at"]).sort_values("recorded_at")
    prepared = prepared.set_index("recorded_at")
    prepared = prepared[
        prepared["temperature_s1"].between(0, 80)
        & prepared["temperature_s2"].between(0, 80)
        & prepared["humidity_s1"].between(0, 100)
        & prepared["humidity_s2"].between(0, 100)
    ]
    horizon_steps = (settings.horizon_minutes * 60) // settings.resample_interval_seconds
    prepared[TARGET_COLUMN] = prepared["temperature_s2"].shift(-horizon_steps)
    prepared = prepared.dropna(subset=[TARGET_COLUMN])
    if len(prepared) <= settings.window_size:
        raise InsufficientDataError(
            f"Synthetic CSV needs more than {settings.window_size} usable target rows; received {len(prepared)}."
        )
    return prepared


def scale_augmented_data(real: ChronologicalSplit, synthetic: pd.DataFrame) -> AugmentedScaledData:
    scaler_fit = pd.concat((real.train, synthetic), axis=0)
    feature_scaler = MinMaxScaler().fit(scaler_fit.loc[:, FEATURE_COLUMNS])
    target_scaler = MinMaxScaler().fit(scaler_fit.loc[:, [TARGET_COLUMN]])
    return AugmentedScaledData(
        real=ChronologicalSplit(
            train=_transform(real.train, feature_scaler, target_scaler),
            validation=_transform(real.validation, feature_scaler, target_scaler),
            test=_transform(real.test, feature_scaler, target_scaler),
        ),
        synthetic=_transform(synthetic, feature_scaler, target_scaler),
        feature_scaler=feature_scaler,
        target_scaler=target_scaler,
    )


def combine_training_windows(
    real_x: np.ndarray,
    real_y: np.ndarray,
    synthetic_x: np.ndarray,
    synthetic_y: np.ndarray,
    max_synthetic_ratio: float,
    seed: int,
) -> tuple[np.ndarray, np.ndarray, dict[str, int | float]]:
    if not 0 < max_synthetic_ratio < 1:
        raise ValueError("max_synthetic_ratio must be between 0 and 1.")
    max_synthetic = int(len(real_x) * max_synthetic_ratio / (1 - max_synthetic_ratio))
    selected_count = min(len(synthetic_x), max_synthetic)
    if selected_count <= 0:
        raise InsufficientDataError("Synthetic ratio produced no usable augmentation windows.")

    rng = np.random.default_rng(seed)
    selected = np.sort(rng.choice(len(synthetic_x), size=selected_count, replace=False))
    combined_x = np.concatenate((real_x, synthetic_x[selected]), axis=0)
    combined_y = np.concatenate((real_y, synthetic_y[selected]), axis=0)
    actual_ratio = selected_count / len(combined_x)
    return combined_x, combined_y, {
        "hardware_windows": len(real_x),
        "synthetic_windows_available": len(synthetic_x),
        "synthetic_windows_selected": selected_count,
        "combined_windows": len(combined_x),
        "synthetic_ratio": actual_ratio,
    }


def _transform(
    frame: pd.DataFrame,
    feature_scaler: MinMaxScaler,
    target_scaler: MinMaxScaler,
) -> pd.DataFrame:
    transformed = frame.astype({column: "float64" for column in (*FEATURE_COLUMNS, TARGET_COLUMN)})
    transformed.loc[:, FEATURE_COLUMNS] = feature_scaler.transform(frame.loc[:, FEATURE_COLUMNS])
    transformed.loc[:, [TARGET_COLUMN]] = target_scaler.transform(frame.loc[:, [TARGET_COLUMN]])
    return transformed
