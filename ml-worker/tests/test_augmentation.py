from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

from ml_worker.augmentation import combine_training_windows, load_synthetic_training_csv
from ml_worker.config import load_settings
from ml_worker.synthetic import SyntheticConfig, generate_synthetic_dataset


class AugmentationTests(unittest.TestCase):
    def test_loads_generated_wide_csv_and_builds_future_target(self) -> None:
        wide, _, _ = generate_synthetic_dataset(SyntheticConfig(minutes=120, seed=4))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.csv"
            wide.to_csv(path, index=False)
            prepared = load_synthetic_training_csv(path, load_settings())

        self.assertEqual(len(prepared), 115)
        self.assertIn("future_temperature_s2", prepared.columns)
        self.assertTrue(prepared.index.is_monotonic_increasing)

    def test_caps_synthetic_windows_to_requested_share(self) -> None:
        real_x = np.zeros((70, 30, 4))
        real_y = np.zeros((70, 1))
        synthetic_x = np.ones((100, 30, 4))
        synthetic_y = np.ones((100, 1))

        combined_x, combined_y, stats = combine_training_windows(
            real_x, real_y, synthetic_x, synthetic_y, 0.30, seed=9
        )

        self.assertEqual(len(combined_x), 100)
        self.assertEqual(len(combined_y), 100)
        self.assertEqual(stats["synthetic_windows_selected"], 30)
        self.assertAlmostEqual(stats["synthetic_ratio"], 0.30)

    def test_ratio_validation_prevents_unbounded_augmentation(self) -> None:
        values_x = np.zeros((10, 30, 4))
        values_y = np.zeros((10, 1))
        with self.assertRaises(ValueError):
            combine_training_windows(values_x, values_y, values_x, values_y, 1.0, seed=1)


if __name__ == "__main__":
    unittest.main()
