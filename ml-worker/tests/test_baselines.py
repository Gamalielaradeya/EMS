from __future__ import annotations

import unittest

import numpy as np

from ml_worker.baselines import moving_average_predictions, persistence_predictions


class BaselineTests(unittest.TestCase):
    def test_baselines_use_raw_s2_temperature_window(self) -> None:
        window = np.zeros((1, 30, 4))
        window[0, :, 2] = np.arange(30, dtype=float)
        self.assertEqual(float(persistence_predictions(window)[0]), 29.0)
        self.assertEqual(float(moving_average_predictions(window, 5)[0]), 27.0)


if __name__ == "__main__":
    unittest.main()
