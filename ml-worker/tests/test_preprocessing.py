from __future__ import annotations

import os
import unittest
from dataclasses import replace

import pandas as pd

from ml_worker.config import load_settings
from ml_worker.preprocessing import (
    TARGET_COLUMN,
    chronological_split,
    prepare_feature_dataset,
    prepare_training_dataset,
)


def generated_raw(minutes: int = 360) -> pd.DataFrame:
    timestamps = pd.date_range("2026-01-01T00:00:00Z", periods=minutes * 6, freq="10s")
    rows = []
    for index, timestamp in enumerate(timestamps):
        rows.append((timestamp, "S1", 25 + index / 10000, 55 + index / 20000))
        rows.append((timestamp, "S2", 29 + index / 10000, 60 + index / 20000))
    return pd.DataFrame(rows, columns=("recorded_at", "sensor_code", "temperature", "humidity"))


class PreprocessingTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ.pop("ML_INTERPOLATION_LIMIT", None)
        self.settings = load_settings()

    def test_resamples_and_builds_future_target(self) -> None:
        raw = generated_raw(120)
        prepared, stats = prepare_training_dataset(raw, self.settings)
        features, _ = prepare_feature_dataset(raw, self.settings)
        self.assertEqual(list(prepared.columns), [
            "temperature_s1",
            "humidity_s1",
            "temperature_s2",
            "humidity_s2",
            TARGET_COLUMN,
        ])
        self.assertEqual(len(prepared), 115)
        self.assertGreater(stats.usable_resampled_rows, len(prepared))
        self.assertGreater(prepared.iloc[0][TARGET_COLUMN], prepared.iloc[0]["temperature_s2"])
        horizon = pd.Timedelta(minutes=self.settings.horizon_minutes)
        for timestamp, row in prepared.iterrows():
            self.assertEqual(
                row[TARGET_COLUMN],
                features.loc[timestamp + horizon, "temperature_s2"],
            )

    def test_chronological_split_preserves_order(self) -> None:
        prepared, _ = prepare_training_dataset(generated_raw(), self.settings)
        split = chronological_split(prepared, self.settings)
        horizon = pd.Timedelta(minutes=self.settings.horizon_minutes)
        self.assertLess(split.train.index.max(), split.validation.index.min())
        self.assertLess(split.validation.index.max(), split.test.index.min())
        self.assertTrue((split.train.index + horizon < split.validation.index.min()).all())
        self.assertTrue((split.validation.index + horizon < split.test.index.min()).all())
        horizon_steps = (
            self.settings.horizon_minutes * 60
        ) // self.settings.resample_interval_seconds
        self.assertEqual(
            len(split.train) + len(split.validation) + len(split.test),
            len(prepared) - (2 * horizon_steps),
        )

    def test_future_target_remains_exact_across_long_data_gap(self) -> None:
        raw = generated_raw(60)
        timestamps = pd.to_datetime(raw["recorded_at"], utc=True)
        gap_start = timestamps.min() + pd.Timedelta(minutes=15)
        gap_end = timestamps.min() + pd.Timedelta(minutes=30)
        raw = raw[(timestamps < gap_start) | (timestamps >= gap_end)]

        prepared, _ = prepare_training_dataset(raw, self.settings)
        features, _ = prepare_feature_dataset(raw, self.settings)
        horizon = pd.Timedelta(minutes=self.settings.horizon_minutes)
        for timestamp, row in prepared.iterrows():
            self.assertEqual(
                row[TARGET_COLUMN],
                features.loc[timestamp + horizon, "temperature_s2"],
            )

    def test_invalid_values_become_missing_and_are_bounded(self) -> None:
        raw = generated_raw(120)
        raw.loc[0, "temperature"] = 100
        raw.loc[1, "humidity"] = -1
        _, stats = prepare_training_dataset(raw, self.settings)
        self.assertEqual(stats.invalid_temperature_rows, 1)
        self.assertEqual(stats.invalid_humidity_rows, 1)


if __name__ == "__main__":
    unittest.main()
