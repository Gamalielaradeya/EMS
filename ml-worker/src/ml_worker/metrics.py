from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np


@dataclass(frozen=True)
class RegressionMetrics:
    rmse: float
    mae: float
    mape: float

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


def calculate_metrics(actual: np.ndarray, predicted: np.ndarray) -> RegressionMetrics:
    actual_values = np.asarray(actual, dtype=float).reshape(-1)
    predicted_values = np.asarray(predicted, dtype=float).reshape(-1)
    if actual_values.size == 0 or actual_values.shape != predicted_values.shape:
        raise ValueError("actual and predicted values must be non-empty and have matching shapes")
    errors = actual_values - predicted_values
    non_zero = np.abs(actual_values) > 1e-12
    mape = float(np.mean(np.abs(errors[non_zero] / actual_values[non_zero])) * 100) if non_zero.any() else 0.0
    return RegressionMetrics(
        rmse=float(np.sqrt(np.mean(np.square(errors)))),
        mae=float(np.mean(np.abs(errors))),
        mape=mape,
    )
