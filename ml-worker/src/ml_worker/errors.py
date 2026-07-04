"""Worker-specific errors with CLI-friendly messages."""


class MLWorkerError(RuntimeError):
    """Base class for expected worker failures."""


class ConfigError(MLWorkerError):
    """Raised when worker configuration is invalid."""


class DatabaseError(MLWorkerError):
    """Raised when PostgreSQL is unavailable or rejects an operation."""


class InsufficientDataError(MLWorkerError):
    """Raised when the time-series cannot safely train or evaluate a model."""


class TensorFlowUnavailableError(MLWorkerError):
    """Raised when a TensorFlow-dependent command runs without TensorFlow."""
