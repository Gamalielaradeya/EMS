from __future__ import annotations

import numpy as np

from ml_worker.metrics import RegressionMetrics, calculate_metrics
from ml_worker.preprocessing import FEATURE_COLUMNS

S2_TEMPERATURE_INDEX = FEATURE_COLUMNS.index("temperature_s2")


def persistence_predictions(windows: np.ndarray) -> np.ndarray:
    return np.asarray(windows, dtype=float)[:, -1, S2_TEMPERATURE_INDEX]


def moving_average_predictions(windows: np.ndarray, average_window: int = 5) -> np.ndarray:
    if average_window <= 0:
        raise ValueError("average_window must be positive")
    return np.asarray(windows, dtype=float)[:, -average_window:, S2_TEMPERATURE_INDEX].mean(axis=1)


def evaluate_baselines(
    windows: np.ndarray,
    actual: np.ndarray,
    average_window: int = 5,
) -> dict[str, RegressionMetrics]:
    return {
        "persistence": calculate_metrics(actual, persistence_predictions(windows)),
        "moving_average": calculate_metrics(actual, moving_average_predictions(windows, average_window)),
    }
