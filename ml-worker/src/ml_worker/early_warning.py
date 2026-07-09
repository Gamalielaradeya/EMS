from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Sequence

import numpy as np

from ml_worker.metrics import calculate_metrics
from ml_worker.repository import (
    get_model_quality_metrics,
    get_model_version,
    load_matched_predictions,
)


@dataclass(frozen=True)
class Episode:
    started_at: datetime
    ended_at: datetime
    actual_status: str
    detected: bool
    lead_time_seconds: float | None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def build_early_warning_report(
    connection: Any,
    start_at: datetime,
    end_at: datetime,
    version: str | None = None,
    max_baseline_ratio: float = 1.0,
) -> dict[str, Any]:
    if max_baseline_ratio <= 0:
        raise ValueError("max_baseline_ratio must be positive")
    model = get_model_version(connection, version)
    if not model:
        raise ValueError("No active/latest model version is available for early-warning evaluation.")

    quality = get_model_quality_metrics(connection, model["id"])
    rows = load_matched_predictions(connection, model["id"], start_at, end_at)
    operational = evaluate_matched_predictions(rows)
    promotion = evaluate_promotion_gate(quality, max_baseline_ratio)
    return {
        "model_version": model["version"],
        "evaluation_start_at": start_at,
        "evaluation_end_at": end_at,
        "matched_prediction_count": len(rows),
        "operational": operational,
        "quality_gate": promotion,
    }


def evaluate_matched_predictions(rows: Sequence[dict[str, Any]]) -> dict[str, Any]:
    ordered = sorted(rows, key=lambda row: row["predicted_for"])
    if not ordered:
        return {
            "available": False,
            "reason": "No matched predictions with actual S2 temperatures exist in the requested range.",
            "episodes": [],
        }

    actual = np.asarray([float(row["actual_temperature"]) for row in ordered])
    predicted = np.asarray([float(row["predicted_temperature"]) for row in ordered])
    regression = calculate_metrics(actual, predicted)
    actual_alert = [_status(float(row["actual_temperature"]), row) != "normal" for row in ordered]
    predicted_alert = [_status(float(row["predicted_temperature"]), row) != "normal" for row in ordered]
    episodes = _build_episodes(ordered, actual_alert, predicted_alert)
    detected = sum(episode.detected for episode in episodes)
    lead_times = [episode.lead_time_seconds for episode in episodes if episode.lead_time_seconds is not None]
    transition_indexes = [index for index, is_alert in enumerate(actual_alert) if is_alert]
    transition_metrics = (
        calculate_metrics(actual[transition_indexes], predicted[transition_indexes]).to_dict()
        if transition_indexes
        else None
    )
    return {
        "available": True,
        "global_metrics": regression.to_dict(),
        "transition_metrics": transition_metrics,
        "actual_threshold_points": sum(actual_alert),
        "predicted_threshold_points": sum(predicted_alert),
        "false_warning_predictions": sum(predicted and not actual for predicted, actual in zip(predicted_alert, actual_alert)),
        "episode_count": len(episodes),
        "detected_episode_count": detected,
        "missed_warning_count": len(episodes) - detected,
        "threshold_recall": detected / len(episodes) if episodes else None,
        "median_lead_time_seconds": float(np.median(lead_times)) if lead_times else None,
        "episodes": [episode.to_dict() for episode in episodes],
    }


def evaluate_promotion_gate(quality: dict[str, Any] | None, max_baseline_ratio: float = 1.0) -> dict[str, Any]:
    if not quality or not quality.get("lstm") or not quality.get("baselines"):
        return {
            "passed": False,
            "reasons": ["Stored LSTM and baseline metrics are required."],
            "max_baseline_ratio": max_baseline_ratio,
        }
    baselines = quality["baselines"]
    best_name, best = min(baselines.items(), key=lambda item: (item[1]["mae"], item[1]["rmse"]))
    lstm = quality["lstm"]
    reasons: list[str] = []
    if lstm["mae"] > best["mae"] * max_baseline_ratio:
        reasons.append(f"LSTM MAE {lstm['mae']:.4f} exceeds {best_name} MAE {best['mae']:.4f}.")
    if lstm["rmse"] > best["rmse"] * max_baseline_ratio:
        reasons.append(f"LSTM RMSE {lstm['rmse']:.4f} exceeds {best_name} RMSE {best['rmse']:.4f}.")
    return {
        "passed": not reasons,
        "reasons": reasons,
        "max_baseline_ratio": max_baseline_ratio,
        "lstm": lstm,
        "best_baseline": {"name": best_name, **best},
    }


def _build_episodes(
    rows: Sequence[dict[str, Any]],
    actual_alert: Sequence[bool],
    predicted_alert: Sequence[bool],
    maximum_gap: timedelta = timedelta(minutes=2),
) -> list[Episode]:
    groups: list[list[int]] = []
    for index, is_alert in enumerate(actual_alert):
        if not is_alert:
            continue
        if not groups or rows[index]["predicted_for"] - rows[groups[-1][-1]]["predicted_for"] > maximum_gap:
            groups.append([index])
        else:
            groups[-1].append(index)

    episodes: list[Episode] = []
    for indexes in groups:
        started_at = rows[indexes[0]]["predicted_for"]
        warning_indexes = [
            index
            for index in indexes
            if predicted_alert[index] and rows[index]["created_at"] < started_at
        ]
        earliest_warning = min((rows[index]["created_at"] for index in warning_indexes), default=None)
        episodes.append(
            Episode(
                started_at=started_at,
                ended_at=rows[indexes[-1]]["predicted_for"],
                actual_status=max((_status(float(rows[index]["actual_temperature"]), rows[index]) for index in indexes), key=_status_rank),
                detected=bool(warning_indexes),
                lead_time_seconds=(started_at - earliest_warning).total_seconds() if earliest_warning else None,
            )
        )
    return episodes


def _status(temperature: float, row: dict[str, Any]) -> str:
    if temperature < float(row["threshold_normal_max"]):
        return "normal"
    if temperature <= float(row["threshold_anomaly_min"]):
        return "waspada"
    return "anomali"


def _status_rank(status: str) -> int:
    return {"normal": 0, "waspada": 1, "anomali": 2}[status]
