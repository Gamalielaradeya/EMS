from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

from ml_worker.errors import ConfigError

PROJECT_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class Settings:
    database_url: str
    backend_base_url: str
    internal_api_token: str
    model_name: str
    artifact_dir: Path
    report_dir: Path
    log_level: str
    log_file: Path
    allowed_sources: tuple[str, ...]
    allowed_quality_statuses: tuple[str, ...]
    raw_sampling_interval_seconds: int
    resample_interval_seconds: int
    window_size: int
    horizon_minutes: int
    interpolation_limit: int
    train_ratio: float
    validation_ratio: float
    test_ratio: float
    minimum_resampled_rows: int
    moving_average_window: int
    epochs: int
    batch_size: int
    learning_rate: float
    early_stopping_patience: int
    history_hours: int


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env")
    load_dotenv()
    settings = Settings(
        database_url=os.getenv("DATABASE_URL", "").strip(),
        backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:8080/api/v1").strip().rstrip("/"),
        internal_api_token=_internal_api_token(),
        model_name=os.getenv("ML_MODEL_NAME", "ems_s2_lstm").strip(),
        artifact_dir=_path_env("ML_ARTIFACT_DIR", PROJECT_ROOT / "models"),
        report_dir=_path_env("ML_REPORT_DIR", PROJECT_ROOT / "reports"),
        log_level=os.getenv("ML_LOG_LEVEL", "INFO").strip().upper(),
        log_file=_path_env("ML_LOG_FILE", PROJECT_ROOT / "ml-worker.log"),
        allowed_sources=_csv_env("ML_ALLOWED_SOURCES", "hardware"),
        allowed_quality_statuses=_csv_env("ML_ALLOWED_QUALITY_STATUSES", "valid"),
        raw_sampling_interval_seconds=_int_env("ML_RAW_SAMPLING_INTERVAL_SECONDS", 10),
        resample_interval_seconds=_int_env("ML_RESAMPLE_INTERVAL_SECONDS", 60),
        window_size=_int_env("ML_WINDOW_SIZE", 30),
        horizon_minutes=_int_env("ML_HORIZON_MINUTES", 5),
        interpolation_limit=_int_env("ML_INTERPOLATION_LIMIT", 3),
        train_ratio=_float_env("ML_TRAIN_RATIO", 0.70),
        validation_ratio=_float_env("ML_VALIDATION_RATIO", 0.15),
        test_ratio=_float_env("ML_TEST_RATIO", 0.15),
        minimum_resampled_rows=_int_env("ML_MINIMUM_RESAMPLED_ROWS", 300),
        moving_average_window=_int_env("ML_MOVING_AVERAGE_WINDOW", 5),
        epochs=_int_env("ML_EPOCHS", 50),
        batch_size=_int_env("ML_BATCH_SIZE", 32),
        learning_rate=_float_env("ML_LEARNING_RATE", 0.001),
        early_stopping_patience=_int_env("ML_EARLY_STOPPING_PATIENCE", 8),
        history_hours=_int_env("ML_HISTORY_HOURS", 168),
    )
    _validate(settings)
    return settings


def require_database_url(settings: Settings) -> str:
    if not settings.database_url:
        raise ConfigError("DATABASE_URL is required. Copy .env.example to .env and set PostgreSQL access.")
    return settings.database_url


def _validate(settings: Settings) -> None:
    if not settings.model_name:
        raise ConfigError("ML_MODEL_NAME must not be empty")
    if not settings.backend_base_url.startswith(("http://", "https://")):
        raise ConfigError("BACKEND_BASE_URL must start with http:// or https://")
    if settings.log_level not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
        raise ConfigError("ML_LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR, or CRITICAL")
    positive_ints = (
        ("ML_RAW_SAMPLING_INTERVAL_SECONDS", settings.raw_sampling_interval_seconds),
        ("ML_RESAMPLE_INTERVAL_SECONDS", settings.resample_interval_seconds),
        ("ML_WINDOW_SIZE", settings.window_size),
        ("ML_HORIZON_MINUTES", settings.horizon_minutes),
        ("ML_MINIMUM_RESAMPLED_ROWS", settings.minimum_resampled_rows),
        ("ML_MOVING_AVERAGE_WINDOW", settings.moving_average_window),
        ("ML_EPOCHS", settings.epochs),
        ("ML_BATCH_SIZE", settings.batch_size),
        ("ML_EARLY_STOPPING_PATIENCE", settings.early_stopping_patience),
        ("ML_HISTORY_HOURS", settings.history_hours),
    )
    for name, value in positive_ints:
        if value <= 0:
            raise ConfigError(f"{name} must be positive")
    if settings.interpolation_limit < 0:
        raise ConfigError("ML_INTERPOLATION_LIMIT must not be negative")
    if settings.learning_rate <= 0:
        raise ConfigError("ML_LEARNING_RATE must be positive")
    if not settings.allowed_sources or not settings.allowed_quality_statuses:
        raise ConfigError("ML_ALLOWED_SOURCES and ML_ALLOWED_QUALITY_STATUSES must not be empty")
    ratio_total = settings.train_ratio + settings.validation_ratio + settings.test_ratio
    if abs(ratio_total - 1.0) > 1e-9 or min(
        settings.train_ratio, settings.validation_ratio, settings.test_ratio
    ) <= 0:
        raise ConfigError("ML split ratios must be positive and sum to 1.0")
    if (settings.horizon_minutes * 60) % settings.resample_interval_seconds:
        raise ConfigError("ML_HORIZON_MINUTES must align with ML_RESAMPLE_INTERVAL_SECONDS")


def _csv_env(name: str, default: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in os.getenv(name, default).split(",") if item.strip())


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ConfigError(f"{name} must be an integer") from exc


def _float_env(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except ValueError as exc:
        raise ConfigError(f"{name} must be numeric") from exc


def _path_env(name: str, default: Path) -> Path:
    path = Path(os.getenv(name, str(default))).expanduser()
    return path.resolve() if path.is_absolute() else (PROJECT_ROOT / path).resolve()


def _internal_api_token() -> str:
    return os.getenv("INTERNAL_API_TOKEN", "").strip() or os.getenv("INTERNAL_ML_TOKEN", "").strip()
