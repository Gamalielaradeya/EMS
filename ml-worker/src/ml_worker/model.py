from __future__ import annotations

from pathlib import Path
from typing import Any

from ml_worker.errors import TensorFlowUnavailableError


def tensorflow() -> Any:
    try:
        import tensorflow as tf
    except ImportError as exc:
        raise TensorFlowUnavailableError(
            "TensorFlow is required for train, evaluate, and infer. "
            "Install it with: python -m pip install -r requirements-tensorflow.txt"
        ) from exc
    return tf


def build_lstm_model(window_size: int, feature_count: int, learning_rate: float) -> Any:
    tf = tensorflow()
    model = tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(window_size, feature_count)),
            tf.keras.layers.LSTM(64, return_sequences=True),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.LSTM(32),
            tf.keras.layers.Dropout(0.2),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=learning_rate), loss="mse")
    return model


def load_model(path: Path) -> Any:
    if not path.is_file():
        raise FileNotFoundError(f"Model artifact not found: {path}")
    return tensorflow().keras.models.load_model(path)
