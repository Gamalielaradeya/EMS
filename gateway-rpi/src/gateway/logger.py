from __future__ import annotations

import logging
from pathlib import Path

from gateway.models import LoggingConfig


def configure_logging(config: LoggingConfig) -> None:
    config.file_path.parent.mkdir(parents=True, exist_ok=True)
    root = logging.getLogger()
    root.setLevel(_level(config.level))
    formatter = logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s")

    if not _has_file_handler(root, config.file_path):
        file_handler = logging.FileHandler(config.file_path, encoding="utf-8")
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)
    if not any(type(handler) is logging.StreamHandler for handler in root.handlers):
        stream_handler = logging.StreamHandler()
        stream_handler.setFormatter(formatter)
        root.addHandler(stream_handler)


def _level(value: str) -> int:
    level = getattr(logging, value.upper(), None)
    if not isinstance(level, int):
        raise ValueError(f"unknown logging level: {value}")
    return level


def _has_file_handler(logger: logging.Logger, path: Path) -> bool:
    target = path.resolve()
    return any(
        isinstance(handler, logging.FileHandler) and Path(handler.baseFilename).resolve() == target
        for handler in logger.handlers
    )
