from __future__ import annotations

import numpy as np
import pandas as pd

from ml_worker.errors import InsufficientDataError
from ml_worker.preprocessing import FEATURE_COLUMNS, TARGET_COLUMN


def build_windows(frame: pd.DataFrame, window_size: int) -> tuple[np.ndarray, np.ndarray]:
    if len(frame) <= window_size:
        raise InsufficientDataError(
            f"Need more than {window_size} rows to build LSTM windows; received {len(frame)}."
        )
    features = frame.loc[:, FEATURE_COLUMNS].to_numpy(dtype=float)
    targets = frame.loc[:, TARGET_COLUMN].to_numpy(dtype=float)
    windows = [features[index - window_size : index] for index in range(window_size, len(frame))]
    labels = targets[window_size:]
    return np.asarray(windows, dtype=float), np.asarray(labels, dtype=float).reshape(-1, 1)


def latest_window(frame: pd.DataFrame, window_size: int) -> np.ndarray:
    if len(frame) < window_size:
        raise InsufficientDataError(
            f"Need at least {window_size} complete minute rows for inference; received {len(frame)}."
        )
    return frame.loc[:, FEATURE_COLUMNS].tail(window_size).to_numpy(dtype=float)[None, :, :]
