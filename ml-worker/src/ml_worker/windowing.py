from __future__ import annotations

import numpy as np
import pandas as pd

from ml_worker.errors import InsufficientDataError
from ml_worker.preprocessing import FEATURE_COLUMNS, TARGET_COLUMN


def build_windows(
    frame: pd.DataFrame,
    window_size: int,
    expected_interval_seconds: int | None = None,
) -> tuple[np.ndarray, np.ndarray]:
    if len(frame) < window_size:
        raise InsufficientDataError(
            f"Need at least {window_size} rows to build LSTM windows; received {len(frame)}."
        )
    features = frame.loc[:, FEATURE_COLUMNS].to_numpy(dtype=float)
    targets = frame.loc[:, TARGET_COLUMN].to_numpy(dtype=float)
    windows: list[np.ndarray] = []
    labels: list[float] = []
    for start in range(0, len(frame) - window_size + 1):
        end = start + window_size
        if not _index_is_contiguous(frame.index[start:end], expected_interval_seconds):
            continue
        windows.append(features[start:end])
        labels.append(targets[end - 1])
    if not windows:
        raise InsufficientDataError(
            f"No contiguous {window_size}-row windows match the configured resample interval."
        )
    return np.asarray(windows, dtype=float), np.asarray(labels, dtype=float).reshape(-1, 1)


def latest_window(
    frame: pd.DataFrame,
    window_size: int,
    expected_interval_seconds: int | None = None,
) -> np.ndarray:
    if len(frame) < window_size:
        raise InsufficientDataError(
            f"Need at least {window_size} complete minute rows for inference; received {len(frame)}."
        )
    latest = frame.tail(window_size)
    if not _index_is_contiguous(latest.index, expected_interval_seconds):
        raise InsufficientDataError(
            f"Latest {window_size} rows are not continuous at the configured resample interval."
        )
    return latest.loc[:, FEATURE_COLUMNS].to_numpy(dtype=float)[None, :, :]


def _index_is_contiguous(index: pd.Index, expected_interval_seconds: int | None) -> bool:
    if expected_interval_seconds is None or not isinstance(index, pd.DatetimeIndex) or len(index) < 2:
        return True
    expected = pd.Timedelta(seconds=expected_interval_seconds)
    return bool((index.to_series().diff().iloc[1:] == expected).all())
