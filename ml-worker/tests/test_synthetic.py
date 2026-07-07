from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import pandas as pd

from ml_worker.synthetic import SyntheticConfig, generate_synthetic_dataset, write_synthetic_dataset


class SyntheticDatasetTests(unittest.TestCase):
    def test_generator_is_reproducible_and_contains_threshold_transitions(self) -> None:
        config = SyntheticConfig(minutes=720, seed=17)
        first_wide, first_long, first_manifest = generate_synthetic_dataset(config)
        second_wide, _, _ = generate_synthetic_dataset(config)

        pd.testing.assert_frame_equal(first_wide, second_wide)
        self.assertEqual(len(first_wide), 720)
        self.assertEqual(len(first_long), 1440)
        self.assertIn("waspada", set(first_wide["thermal_status_s2"]))
        self.assertIn("anomali", set(first_wide["thermal_status_s2"]))
        self.assertEqual(set(first_long["source"]), {"simulator"})
        self.assertEqual(set(first_long["quality_status"]), {"simulated"})
        self.assertEqual(first_manifest["dataset_type"], "synthetic_development_augmentation")

    def test_writer_creates_auditable_files(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            result = write_synthetic_dataset(Path(directory), SyntheticConfig(minutes=120, seed=8))
            self.assertTrue(Path(result["files"]["wide"]).is_file())
            self.assertTrue(Path(result["files"]["long"]).is_file())
            self.assertTrue(Path(result["files"]["manifest"]).is_file())

    def test_rejects_short_or_invalid_configuration(self) -> None:
        with self.assertRaises(ValueError):
            generate_synthetic_dataset(SyntheticConfig(minutes=59))
        with self.assertRaises(ValueError):
            generate_synthetic_dataset(SyntheticConfig(normal_max=32, anomaly_min=30))


if __name__ == "__main__":
    unittest.main()
