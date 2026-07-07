from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

from psycopg import Connection

from ml_worker.config import PROJECT_ROOT, Settings
from ml_worker.metrics import RegressionMetrics
from ml_worker.preprocessing import FEATURE_COLUMNS, TARGET_COLUMN


def insert_system_log(
    connection: Connection,
    level: str,
    message: str,
    context: dict[str, Any] | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            "INSERT INTO system_logs (source, level, message, context) VALUES (%s, %s, %s, %s::jsonb)",
            ("ml-worker", level, message, _json(context)),
        )


def create_prediction_run(
    connection: Connection,
    run_type: str,
    metadata: dict[str, Any] | None = None,
    model_version_id: int | None = None,
) -> int:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO prediction_runs (model_version_id, run_type, metadata)
            VALUES (%s, %s, %s::jsonb)
            RETURNING id
            """,
            (model_version_id, run_type, _json(metadata)),
        )
        return int(cursor.fetchone()[0])


def finish_prediction_run(
    connection: Connection,
    run_id: int,
    status: str,
    message: str,
    metadata: dict[str, Any] | None = None,
    model_version_id: int | None = None,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE prediction_runs
            SET status = %s,
                finished_at = NOW(),
                message = %s,
                metadata = COALESCE(%s::jsonb, metadata),
                model_version_id = COALESCE(%s, model_version_id)
            WHERE id = %s
            """,
            (status, message, _json(metadata), model_version_id, run_id),
        )


def insert_model_version(
    connection: Connection,
    settings: Settings,
    version: str,
    artifacts: dict[str, Path],
    parameters: dict[str, Any],
    activate: bool,
) -> int:
    with connection.cursor() as cursor:
        if activate:
            cursor.execute("UPDATE model_versions SET is_active = FALSE WHERE is_active = TRUE")
        cursor.execute(
            """
            INSERT INTO model_versions (
                model_name, model_type, version, algorithm, feature_columns, target_column,
                window_size, horizon_minutes, raw_sampling_interval_seconds,
                resample_interval_seconds, model_path, feature_scaler_path,
                target_scaler_path, metadata_path, parameters, is_active, trained_at
            )
            VALUES (%s, 'LSTM', %s, 'Long Short-Term Memory', %s::jsonb, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s::jsonb, %s, NOW())
            RETURNING id
            """,
            (
                settings.model_name,
                version,
                json.dumps(FEATURE_COLUMNS),
                TARGET_COLUMN,
                settings.window_size,
                settings.horizon_minutes,
                settings.raw_sampling_interval_seconds,
                settings.resample_interval_seconds,
                _stored_path(artifacts["model"]),
                _stored_path(artifacts["feature_scaler"]),
                _stored_path(artifacts["target_scaler"]),
                _stored_path(artifacts["metadata"]),
                json.dumps(parameters),
                activate,
            ),
        )
        return int(cursor.fetchone()[0])


def insert_model_metrics(
    connection: Connection,
    model_version_id: int,
    dataset_start_at: datetime,
    dataset_end_at: datetime,
    sizes: tuple[int, int, int],
    metrics: RegressionMetrics,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO model_metrics (
                model_version_id, dataset_start_at, dataset_end_at,
                train_size, validation_size, test_size, rmse, mae, mape
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                model_version_id,
                dataset_start_at,
                dataset_end_at,
                *sizes,
                metrics.rmse,
                metrics.mae,
                metrics.mape,
            ),
        )


def insert_baseline_results(
    connection: Connection,
    model_version_id: int,
    baselines: dict[str, RegressionMetrics],
    moving_average_window: int,
) -> None:
    with connection.cursor() as cursor:
        for baseline_type, metrics in baselines.items():
            parameters = {"window": moving_average_window} if baseline_type == "moving_average" else {}
            cursor.execute(
                """
                INSERT INTO baseline_results (model_version_id, baseline_type, rmse, mae, mape, parameters)
                VALUES (%s, %s, %s, %s, %s, %s::jsonb)
                """,
                (
                    model_version_id,
                    baseline_type,
                    metrics.rmse,
                    metrics.mae,
                    metrics.mape,
                    json.dumps(parameters),
                ),
            )


def get_model_version(connection: Connection, version: str | None = None) -> dict[str, Any] | None:
    query = """
        SELECT id, version, model_path, feature_scaler_path, target_scaler_path, metadata_path
        FROM model_versions
    """
    params: tuple[Any, ...] = ()
    if version:
        query += " WHERE version = %s ORDER BY trained_at DESC NULLS LAST, id DESC LIMIT 1"
        params = (version,)
    else:
        query += " ORDER BY is_active DESC, trained_at DESC NULLS LAST, id DESC LIMIT 1"
    with connection.cursor() as cursor:
        cursor.execute(query, params)
        row = cursor.fetchone()
    if not row:
        return None
    return {
        "id": int(row[0]),
        "version": row[1],
        "model_path": _resolved_path(row[2]),
        "feature_scaler_path": _resolved_path(row[3]),
        "target_scaler_path": _resolved_path(row[4]),
        "metadata_path": _resolved_path(row[5]) if row[5] else None,
    }


def get_model_quality_metrics(connection: Connection, model_version_id: int) -> dict[str, Any] | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT rmse, mae, mape
            FROM model_metrics
            WHERE model_version_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (model_version_id,),
        )
        model_row = cursor.fetchone()
        cursor.execute(
            """
            SELECT DISTINCT ON (baseline_type) baseline_type, rmse, mae, mape
            FROM baseline_results
            WHERE model_version_id = %s
            ORDER BY baseline_type, created_at DESC, id DESC
            """,
            (model_version_id,),
        )
        baseline_rows = cursor.fetchall()
    if not model_row:
        return None
    return {
        "lstm": {"rmse": float(model_row[0]), "mae": float(model_row[1]), "mape": float(model_row[2])},
        "baselines": {
            row[0]: {"rmse": float(row[1]), "mae": float(row[2]), "mape": float(row[3])}
            for row in baseline_rows
        },
    }


def load_matched_predictions(
    connection: Connection,
    model_version_id: int,
    start_at: datetime,
    end_at: datetime,
) -> list[dict[str, Any]]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT predicted_temperature, actual_temperature, predicted_for, created_at,
                   threshold_normal_max, threshold_anomaly_min
            FROM predictions
            WHERE model_version_id = %s
              AND predicted_for >= %s
              AND predicted_for <= %s
              AND actual_temperature IS NOT NULL
            ORDER BY predicted_for ASC, id ASC
            """,
            (model_version_id, start_at, end_at),
        )
        rows = cursor.fetchall()
    return [
        {
            "predicted_temperature": float(row[0]),
            "actual_temperature": float(row[1]),
            "predicted_for": row[2],
            "created_at": row[3],
            "threshold_normal_max": float(row[4]),
            "threshold_anomaly_min": float(row[5]),
        }
        for row in rows
    ]


def _json(value: dict[str, Any] | None) -> str | None:
    return json.dumps(value, default=str) if value is not None else None


def _stored_path(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


def _resolved_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path
