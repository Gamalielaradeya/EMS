from __future__ import annotations

import unittest

import numpy as np

from ml_worker.metrics import calculate_metrics


class MetricTests(unittest.TestCase):
    def test_metrics_are_calculated_in_input_units(self) -> None:
        metrics = calculate_metrics(np.array([20.0, 30.0]), np.array([22.0, 28.0]))
        self.assertAlmostEqual(metrics.rmse, 2.0)
        self.assertAlmostEqual(metrics.mae, 2.0)
        self.assertAlmostEqual(metrics.mape, (0.1 + (2 / 30)) / 2 * 100)


if __name__ == "__main__":
    unittest.main()
