from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler

from ml_worker.config import Settings
from ml_worker.errors import InsufficientDataError

FEATURE_COLUMNS = (
    "temperature_s1",
    "humidity_s1",
    "temperature_s2",
    "humidity_s2",
)
TARGET_COLUMN = "future_temperature_s2"


@dataclass(frozen=True)
class ResampleStats:
    raw_rows: int
    invalid_temperature_rows: int
    invalid_humidity_rows: int
    missing_values_before_fill: int
    missing_values_after_fill: int
    usable_resampled_rows: int

    def to_dict(self) -> dict[str, int]:
        return asdict(self)


@dataclass(frozen=True)
class ChronologicalSplit:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame


@dataclass(frozen=True)
class ScaledSplit:
    train: pd.DataFrame
    validation: pd.DataFrame
    test: pd.DataFrame
    feature_scaler: MinMaxScaler
    target_scaler: MinMaxScaler


def prepare_training_dataset(raw: pd.DataFrame, settings: Settings) -> tuple[pd.DataFrame, ResampleStats]:
    features, stats = prepare_feature_dataset(raw, settings)
    horizon = pd.Timedelta(minutes=settings.horizon_minutes)
    future_target = features["temperature_s2"].rename(TARGET_COLUMN).copy()
    future_target.index = future_target.index - horizon
    prepared = features.join(future_target, how="inner").dropna(subset=[TARGET_COLUMN])
    if prepared.empty:
        raise InsufficientDataError("No rows remain after creating the future S2 target.")
    return prepared, stats


def prepare_feature_dataset(raw: pd.DataFrame, settings: Settings) -> tuple[pd.DataFrame, ResampleStats]:
    required = {"recorded_at", "sensor_code", "temperature", "humidity"}
    missing_columns = required.difference(raw.columns)
    if missing_columns:
        raise InsufficientDataError(f"Reading dataset is missing columns: {sorted(missing_columns)}")
    if raw.empty:
        raise InsufficientDataError("No sensor readings matched the configured source and quality filters.")

    readings = raw.loc[:, sorted(required)].copy()
    readings["recorded_at"] = pd.to_datetime(readings["recorded_at"], utc=True, errors="coerce")
    readings["sensor_code"] = readings["sensor_code"].astype(str).str.upper()
    readings = readings[readings["sensor_code"].isin(("S1", "S2"))]
    readings["temperature"] = pd.to_numeric(readings["temperature"], errors="coerce")
    readings["humidity"] = pd.to_numeric(readings["humidity"], errors="coerce")

    invalid_temperature = ~readings["temperature"].between(0, 80, inclusive="both")
    invalid_humidity = ~readings["humidity"].between(0, 100, inclusive="both")
    readings.loc[invalid_temperature, "temperature"] = np.nan
    readings.loc[invalid_humidity, "humidity"] = np.nan
    readings = readings.dropna(subset=["recorded_at"])
    if readings.empty:
        raise InsufficientDataError("No timestamped S1/S2 readings remain after validation.")

    frequency = f"{settings.resample_interval_seconds}s"
    grouped = (
        readings.set_index("recorded_at")
        .groupby("sensor_code")[["temperature", "humidity"]]
        .resample(frequency)
        .mean()
        .reset_index()
    )
    wide = grouped.pivot(index="recorded_at", columns="sensor_code", values=["temperature", "humidity"])
    wide.columns = [f"{measurement}_{sensor_code.lower()}" for measurement, sensor_code in wide.columns]
    wide = wide.reindex(columns=FEATURE_COLUMNS).sort_index()
    missing_before = int(wide.isna().sum().sum())
    if settings.interpolation_limit:
        wide = wide.interpolate(
            method="time",
            limit=settings.interpolation_limit,
            limit_area="inside",
        ).ffill(limit=settings.interpolation_limit)
    missing_after = int(wide.isna().sum().sum())
    wide = wide.dropna(subset=FEATURE_COLUMNS)
    stats = ResampleStats(
        raw_rows=len(raw),
        invalid_temperature_rows=int(invalid_temperature.sum()),
        invalid_humidity_rows=int(invalid_humidity.sum()),
        missing_values_before_fill=missing_before,
        missing_values_after_fill=missing_after,
        usable_resampled_rows=len(wide),
    )
    if wide.empty:
        raise InsufficientDataError("No complete S1/S2 minute rows remain after bounded missing-value handling.")
    return wide, stats


def chronological_split(frame: pd.DataFrame, settings: Settings) -> ChronologicalSplit:
    row_count = len(frame)
    train_end = int(row_count * settings.train_ratio)
    validation_end = train_end + int(row_count * settings.validation_ratio)
    validation_start_at = frame.index[train_end]
    test_start_at = frame.index[validation_end]
    horizon = pd.Timedelta(minutes=settings.horizon_minutes)

    train = frame.iloc[:train_end].copy()
    validation = frame.iloc[train_end:validation_end].copy()
    test = frame.iloc[validation_end:].copy()

    # Purge rows whose future target belongs to the next partition.
    train = train[train.index + horizon < validation_start_at]
    validation = validation[validation.index + horizon < test_start_at]
    split = ChronologicalSplit(
        train=train,
        validation=validation,
        test=test,
    )
    minimum_partition_rows = settings.window_size
    sizes = (len(split.train), len(split.validation), len(split.test))
    if min(sizes) < minimum_partition_rows:
        raise InsufficientDataError(
            "Chronological split is too small for safe windowing: "
            f"train={sizes[0]}, validation={sizes[1]}, test={sizes[2]}, "
            f"required_each>={minimum_partition_rows}."
        )
    return split


def scale_split(split: ChronologicalSplit) -> ScaledSplit:
    feature_scaler = MinMaxScaler().fit(split.train.loc[:, FEATURE_COLUMNS])
    target_scaler = MinMaxScaler().fit(split.train.loc[:, [TARGET_COLUMN]])
    return ScaledSplit(
        train=_transform(split.train, feature_scaler, target_scaler),
        validation=_transform(split.validation, feature_scaler, target_scaler),
        test=_transform(split.test, feature_scaler, target_scaler),
        feature_scaler=feature_scaler,
        target_scaler=target_scaler,
    )


def _transform(
    frame: pd.DataFrame,
    feature_scaler: MinMaxScaler,
    target_scaler: MinMaxScaler,
) -> pd.DataFrame:
    transformed = frame.astype({column: "float64" for column in (*FEATURE_COLUMNS, TARGET_COLUMN)})
    transformed.loc[:, FEATURE_COLUMNS] = feature_scaler.transform(frame.loc[:, FEATURE_COLUMNS])
    transformed.loc[:, [TARGET_COLUMN]] = target_scaler.transform(frame.loc[:, [TARGET_COLUMN]])
    return transformed
