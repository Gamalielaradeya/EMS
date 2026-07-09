from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import joblib
from psycopg import Connection

from ml_worker.augmentation import combine_training_windows, load_synthetic_training_csv, scale_augmented_data
from ml_worker.baselines import evaluate_baselines
from ml_worker.backend_client import build_prediction_payload, submit_prediction
from ml_worker.config import Settings
from ml_worker.dataset import load_raw_readings
from ml_worker.early_warning import evaluate_promotion_gate
from ml_worker.errors import InsufficientDataError, MLWorkerError
from ml_worker.metrics import calculate_metrics
from ml_worker.model import build_lstm_model, load_model, tensorflow
from ml_worker.preprocessing import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    chronological_split,
    prepare_feature_dataset,
    prepare_training_dataset,
    scale_split,
)
from ml_worker.repository import (
    create_prediction_run,
    finish_prediction_run,
    get_model_version,
    latest_prediction_window_end,
    insert_baseline_results,
    insert_model_metrics,
    insert_model_version,
    insert_system_log,
)
from ml_worker.windowing import build_windows, latest_window


def train(
    connection: Connection,
    settings: Settings,
    start_at: datetime,
    end_at: datetime,
    activate: bool = False,
) -> dict[str, Any]:
    run_id = create_prediction_run(connection, "training", {"start_at": start_at, "end_at": end_at})
    connection.commit()
    try:
        raw = load_raw_readings(connection, settings, start_at, end_at)
        prepared, stats = prepare_training_dataset(raw, settings)
        if len(prepared) < settings.minimum_resampled_rows:
            raise InsufficientDataError(
                f"Need at least {settings.minimum_resampled_rows} usable resampled rows; received {len(prepared)}."
            )
        split = chronological_split(prepared, settings)
        scaled = scale_split(split)
        train_x, train_y = _build_windows(scaled.train, settings)
        validation_x, validation_y = _build_windows(scaled.validation, settings)
        test_x, _ = _build_windows(scaled.test, settings)
        raw_test_x, raw_test_y = _build_windows(split.test, settings)
        baselines = evaluate_baselines(raw_test_x, raw_test_y, settings.moving_average_window)

        tf = tensorflow()
        model = build_lstm_model(settings.window_size, len(FEATURE_COLUMNS), settings.learning_rate)
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=settings.early_stopping_patience,
                restore_best_weights=True,
            )
        ]
        history = model.fit(
            train_x,
            train_y,
            validation_data=(validation_x, validation_y),
            epochs=settings.epochs,
            batch_size=settings.batch_size,
            callbacks=callbacks,
            verbose=0,
        )
        predicted_scaled = model.predict(test_x, verbose=0)
        predicted_celsius = scaled.target_scaler.inverse_transform(predicted_scaled).reshape(-1)
        actual_celsius = raw_test_y.reshape(-1)
        metrics = calculate_metrics(actual_celsius, predicted_celsius)
        promotion_gate = evaluate_promotion_gate(
            {
                "lstm": metrics.to_dict(),
                "baselines": {name: value.to_dict() for name, value in baselines.items()},
            }
        )
        activation_allowed = activate and promotion_gate["passed"]

        version = datetime.now(timezone.utc).strftime("v%Y%m%d_%H%M%S")
        model_name = _display_model_name(settings, version)
        artifacts = _save_artifacts(
            settings,
            version,
            model,
            scaled.feature_scaler,
            scaled.target_scaler,
            {
                "version": version,
                "model_name": model_name,
                "features": FEATURE_COLUMNS,
                "target": TARGET_COLUMN,
                "trained_at": datetime.now(timezone.utc),
                "dataset_start_at": prepared.index.min(),
                "dataset_end_at": prepared.index.max(),
                "resample_stats": stats.to_dict(),
                "split_sizes": _split_sizes(split),
                "window_size": settings.window_size,
                "horizon_minutes": settings.horizon_minutes,
                "epochs_completed": len(history.history.get("loss", [])),
                "metrics_celsius": metrics.to_dict(),
                "baselines_celsius": {name: value.to_dict() for name, value in baselines.items()},
            },
        )
        model_version_id = insert_model_version(
            connection,
            settings,
            version,
            model_name,
            artifacts,
            {
                "epochs": settings.epochs,
                "batch_size": settings.batch_size,
                "learning_rate": settings.learning_rate,
                "early_stopping_patience": settings.early_stopping_patience,
            },
            activation_allowed,
        )
        insert_model_metrics(
            connection,
            model_version_id,
            prepared.index.min().to_pydatetime(),
            prepared.index.max().to_pydatetime(),
            _split_sizes(split),
            metrics,
        )
        insert_baseline_results(connection, model_version_id, baselines, settings.moving_average_window)
        finish_prediction_run(
            connection,
            run_id,
            "success",
            f"Trained model {version}.",
            {
                "metrics_celsius": metrics.to_dict(),
                "artifacts": {k: str(v) for k, v in artifacts.items()},
                "activation_requested": activate,
                "activated": activation_allowed,
                "promotion_gate": promotion_gate,
            },
            model_version_id,
        )
        insert_system_log(
            connection,
            "info",
            f"ML training completed for {version}.",
            {
                "model_version_id": model_version_id,
                "metrics_celsius": metrics.to_dict(),
                "activation_requested": activate,
                "activated": activation_allowed,
                "promotion_gate": promotion_gate,
            },
        )
        connection.commit()
        return {
            "model_version_id": model_version_id,
            "version": version,
            "metrics_celsius": metrics.to_dict(),
            "baselines_celsius": {name: value.to_dict() for name, value in baselines.items()},
            "activation_requested": activate,
            "activated": activation_allowed,
            "promotion_gate": promotion_gate,
            "artifacts": {name: str(path) for name, path in artifacts.items()},
        }
    except Exception as exc:
        connection.rollback()
        _record_failure(connection, run_id, "training", exc)
        raise


def train_augmented(
    connection: Connection,
    settings: Settings,
    start_at: datetime,
    end_at: datetime,
    synthetic_path: Path,
    max_synthetic_ratio: float = 0.30,
    seed: int = 42,
) -> dict[str, Any]:
    run_metadata = {
        "start_at": start_at,
        "end_at": end_at,
        "training_mode": "hardware_plus_synthetic",
        "synthetic_path": str(synthetic_path),
        "max_synthetic_ratio": max_synthetic_ratio,
        "seed": seed,
    }
    run_id = create_prediction_run(connection, "training", run_metadata)
    connection.commit()
    try:
        raw = load_raw_readings(connection, settings, start_at, end_at)
        prepared, stats = prepare_training_dataset(raw, settings)
        if len(prepared) < settings.minimum_resampled_rows:
            raise InsufficientDataError(
                f"Need at least {settings.minimum_resampled_rows} hardware resampled rows; received {len(prepared)}."
            )
        split = chronological_split(prepared, settings)
        synthetic = load_synthetic_training_csv(synthetic_path, settings)
        scaled = scale_augmented_data(split, synthetic)

        real_train_x, real_train_y = _build_windows(scaled.real.train, settings)
        synthetic_x, synthetic_y = _build_windows(scaled.synthetic, settings)
        train_x, train_y, augmentation = combine_training_windows(
            real_train_x,
            real_train_y,
            synthetic_x,
            synthetic_y,
            max_synthetic_ratio,
            seed,
        )
        validation_x, validation_y = _build_windows(scaled.real.validation, settings)
        test_x, _ = _build_windows(scaled.real.test, settings)
        raw_test_x, raw_test_y = _build_windows(split.test, settings)
        baselines = evaluate_baselines(raw_test_x, raw_test_y, settings.moving_average_window)

        tf = tensorflow()
        tf.keras.utils.set_random_seed(seed)
        model = build_lstm_model(settings.window_size, len(FEATURE_COLUMNS), settings.learning_rate)
        callbacks = [
            tf.keras.callbacks.EarlyStopping(
                monitor="val_loss",
                patience=settings.early_stopping_patience,
                restore_best_weights=True,
            )
        ]
        history = model.fit(
            train_x,
            train_y,
            validation_data=(validation_x, validation_y),
            epochs=settings.epochs,
            batch_size=settings.batch_size,
            callbacks=callbacks,
            verbose=0,
        )
        predicted_scaled = model.predict(test_x, verbose=0)
        predicted_celsius = scaled.target_scaler.inverse_transform(predicted_scaled).reshape(-1)
        actual_celsius = raw_test_y.reshape(-1)
        metrics = calculate_metrics(actual_celsius, predicted_celsius)
        promotion_gate = evaluate_promotion_gate(
            {
                "lstm": metrics.to_dict(),
                "baselines": {name: value.to_dict() for name, value in baselines.items()},
            }
        )

        version = datetime.now(timezone.utc).strftime("v%Y%m%d_%H%M%S")
        model_name = _display_model_name(settings, version)
        split_sizes = (len(split.train), len(split.validation), len(split.test))
        artifacts = _save_artifacts(
            settings,
            version,
            model,
            scaled.feature_scaler,
            scaled.target_scaler,
            {
                "version": version,
                "model_name": model_name,
                "features": FEATURE_COLUMNS,
                "target": TARGET_COLUMN,
                "trained_at": datetime.now(timezone.utc),
                "training_mode": "hardware_plus_synthetic",
                "hardware_dataset_start_at": prepared.index.min(),
                "hardware_dataset_end_at": prepared.index.max(),
                "hardware_resample_stats": stats.to_dict(),
                "hardware_split_sizes": split_sizes,
                "validation_source": "hardware",
                "test_source": "hardware",
                "synthetic_source_path": str(synthetic_path.resolve()),
                "synthetic_rows": len(synthetic),
                "augmentation": augmentation,
                "window_size": settings.window_size,
                "horizon_minutes": settings.horizon_minutes,
                "epochs_completed": len(history.history.get("loss", [])),
                "metrics_celsius_hardware_test": metrics.to_dict(),
                "baselines_celsius_hardware_test": {
                    name: value.to_dict() for name, value in baselines.items()
                },
                "promotion_gate": promotion_gate,
            },
        )
        model_version_id = insert_model_version(
            connection,
            settings,
            version,
            model_name,
            artifacts,
            {
                "epochs": settings.epochs,
                "batch_size": settings.batch_size,
                "learning_rate": settings.learning_rate,
                "early_stopping_patience": settings.early_stopping_patience,
                "training_mode": "hardware_plus_synthetic",
                "augmentation": augmentation,
            },
            False,
        )
        insert_model_metrics(connection, model_version_id, prepared.index.min().to_pydatetime(), prepared.index.max().to_pydatetime(), split_sizes, metrics)
        insert_baseline_results(connection, model_version_id, baselines, settings.moving_average_window)
        result = {
            "model_version_id": model_version_id,
            "version": version,
            "training_mode": "hardware_plus_synthetic",
            "metrics_celsius_hardware_test": metrics.to_dict(),
            "baselines_celsius_hardware_test": {name: value.to_dict() for name, value in baselines.items()},
            "promotion_gate": promotion_gate,
            "augmentation": augmentation,
            "activated": False,
            "artifacts": {name: str(path) for name, path in artifacts.items()},
        }
        finish_prediction_run(connection, run_id, "success", f"Trained augmented candidate {version}.", result, model_version_id)
        insert_system_log(connection, "info", f"Augmented ML candidate completed for {version}.", result)
        connection.commit()
        return result
    except Exception as exc:
        connection.rollback()
        _record_failure(connection, run_id, "augmented training", exc)
        raise


def evaluate(
    connection: Connection,
    settings: Settings,
    start_at: datetime,
    end_at: datetime,
    version: str | None = None,
) -> dict[str, Any]:
    model_version = _require_model_version(connection, version)
    run_id = create_prediction_run(connection, "batch_inference", model_version_id=model_version["id"])
    connection.commit()
    try:
        raw = load_raw_readings(connection, settings, start_at, end_at)
        prepared, _ = prepare_training_dataset(raw, settings)
        split = chronological_split(prepared, settings)
        feature_scaler = joblib.load(model_version["feature_scaler_path"])
        target_scaler = joblib.load(model_version["target_scaler_path"])
        transformed_test = split.test.astype(
            {column: "float64" for column in (*FEATURE_COLUMNS, TARGET_COLUMN)}
        )
        transformed_test.loc[:, FEATURE_COLUMNS] = feature_scaler.transform(split.test.loc[:, FEATURE_COLUMNS])
        transformed_test.loc[:, [TARGET_COLUMN]] = target_scaler.transform(split.test.loc[:, [TARGET_COLUMN]])
        test_x, _ = _build_windows(transformed_test, settings)
        raw_test_x, raw_test_y = _build_windows(split.test, settings)
        predicted = target_scaler.inverse_transform(
            load_model(model_version["model_path"]).predict(test_x, verbose=0)
        ).reshape(-1)
        metrics = calculate_metrics(raw_test_y, predicted)
        baselines = evaluate_baselines(raw_test_x, raw_test_y, settings.moving_average_window)
        result = {
            "version": model_version["version"],
            "metrics_celsius": metrics.to_dict(),
            "baselines_celsius": {name: value.to_dict() for name, value in baselines.items()},
        }
        finish_prediction_run(connection, run_id, "success", "Local evaluation completed.", result)
        connection.commit()
        return result
    except Exception as exc:
        connection.rollback()
        _record_failure(connection, run_id, "batch evaluation", exc)
        raise


def infer(
    connection: Connection,
    settings: Settings,
    end_at: datetime,
    version: str | None = None,
) -> dict[str, Any]:
    model_version = _require_model_version(connection, version)
    run_id: int | None = None
    try:
        start_at = end_at - timedelta(hours=settings.history_hours)
        raw = load_raw_readings(connection, settings, start_at, end_at)
        features, _ = prepare_feature_dataset(raw, settings)
        input_window_end = features.index[-1].to_pydatetime()
        previous_window_end = latest_prediction_window_end(connection, model_version["id"])
        predicted_for = input_window_end + timedelta(minutes=settings.horizon_minutes)
        if previous_window_end is not None and input_window_end <= previous_window_end:
            return {
                "version": model_version["version"],
                "predicted_for": predicted_for.isoformat(),
                "input_window_end_at": input_window_end.isoformat(),
                "mode": "skipped_no_new_input",
                "backend_prediction": None,
            }
        run_id = create_prediction_run(connection, "inference", model_version_id=model_version["id"])
        connection.commit()
        feature_scaler = joblib.load(model_version["feature_scaler_path"])
        target_scaler = joblib.load(model_version["target_scaler_path"])
        scaled_features = features.astype({column: "float64" for column in FEATURE_COLUMNS})
        scaled_features.loc[:, FEATURE_COLUMNS] = feature_scaler.transform(features.loc[:, FEATURE_COLUMNS])
        window = latest_window(
            scaled_features,
            settings.window_size,
            settings.resample_interval_seconds,
        )
        prediction = float(
            target_scaler.inverse_transform(
                load_model(model_version["model_path"]).predict(window, verbose=0)
            ).reshape(-1)[0]
        )
        payload = build_prediction_payload(
            model_version_id=model_version["id"],
            model_version=model_version["version"],
            prediction_run_id=run_id,
            predicted_temperature=prediction,
            input_window_start_at=features.index[-settings.window_size].to_pydatetime().isoformat(),
            input_window_end_at=input_window_end.isoformat(),
            predicted_for=predicted_for.isoformat(),
        )
        backend_prediction = submit_prediction(settings, payload)
        result = {
            "version": model_version["version"],
            "predicted_temperature_s2": prediction,
            "predicted_for": predicted_for.isoformat(),
            "mode": "backend_submitted",
            "backend_prediction": backend_prediction,
        }
        finish_prediction_run(connection, run_id, "success", "Inference submitted to backend.", result)
        insert_system_log(connection, "info", "ML inference submitted to backend.", result)
        connection.commit()
        return result
    except Exception as exc:
        connection.rollback()
        if run_id is not None:
            _record_failure(connection, run_id, "inference", exc)
        raise


def _save_artifacts(
    settings: Settings,
    version: str,
    model: Any,
    feature_scaler: Any,
    target_scaler: Any,
    metadata: dict[str, Any],
) -> dict[str, Path]:
    artifact_dir = settings.artifact_dir / f"{settings.model_name}_{version}"
    report_dir = settings.report_dir / f"{settings.model_name}_{version}"
    artifact_dir.mkdir(parents=True, exist_ok=False)
    report_dir.mkdir(parents=True, exist_ok=False)
    artifacts = {
        "model": artifact_dir / "model.keras",
        "feature_scaler": artifact_dir / "feature_scaler.pkl",
        "target_scaler": artifact_dir / "target_scaler.pkl",
        "metadata": artifact_dir / "model_metadata.json",
        "report": report_dir / "training_report.json",
    }
    model.save(artifacts["model"])
    joblib.dump(feature_scaler, artifacts["feature_scaler"])
    joblib.dump(target_scaler, artifacts["target_scaler"])
    serialized = json.dumps(metadata, default=str, indent=2)
    artifacts["metadata"].write_text(serialized + "\n", encoding="utf-8")
    artifacts["report"].write_text(serialized + "\n", encoding="utf-8")
    return artifacts


def _display_model_name(settings: Settings, version: str) -> str:
    return f"{settings.model_name} {version}"


def _require_model_version(connection: Connection, version: str | None) -> dict[str, Any]:
    model_version = get_model_version(connection, version)
    if not model_version:
        if version:
            raise MLWorkerError(f"No trained model version {version} exists in model_versions.")
        raise MLWorkerError("No active model exists in model_versions.")
    return model_version


def _split_sizes(split: Any) -> tuple[int, int, int]:
    return len(split.train), len(split.validation), len(split.test)


def _build_windows(frame: Any, settings: Settings) -> tuple[Any, Any]:
    return build_windows(
        frame,
        settings.window_size,
        settings.resample_interval_seconds,
    )


def _record_failure(connection: Connection, run_id: int, operation: str, exc: Exception) -> None:
    message = f"ML {operation} failed: {exc}"
    finish_prediction_run(connection, run_id, "failed", message)
    insert_system_log(connection, "error", message)
    connection.commit()
