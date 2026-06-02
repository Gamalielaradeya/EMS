from __future__ import annotations

import os
import unittest

import pandas as pd

from ml_worker.config import load_settings
from ml_worker.preprocessing import FEATURE_COLUMNS, TARGET_COLUMN, chronological_split, scale_split


class ScalingTests(unittest.TestCase):
    def test_scalers_fit_training_partition_only(self) -> None:
        settings = load_settings()
        row_count = 400
        index = pd.date_range("2026-01-01T00:00:00Z", periods=row_count, freq="min")
        frame = pd.DataFrame(
            {
                "temperature_s1": range(row_count),
                "humidity_s1": range(row_count),
                "temperature_s2": range(row_count),
                "humidity_s2": range(row_count),
                TARGET_COLUMN: range(row_count),
            },
            index=index,
        )
        split = chronological_split(frame, settings)
        scaled = scale_split(split)
        expected_max = float(len(split.train) - 1)
        self.assertEqual(scaled.feature_scaler.data_max_.tolist(), [expected_max] * len(FEATURE_COLUMNS))
        self.assertEqual(scaled.target_scaler.data_max_.tolist(), [expected_max])
        self.assertGreater(float(scaled.validation.iloc[-1]["temperature_s1"]), 1.0)


if __name__ == "__main__":
    unittest.main()
