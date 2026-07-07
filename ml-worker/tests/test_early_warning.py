from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from ml_worker.early_warning import evaluate_matched_predictions, evaluate_promotion_gate


BASE = datetime(2026, 7, 7, 5, 0, tzinfo=timezone.utc)


def row(minute: int, predicted: float, actual: float) -> dict[str, object]:
    target = BASE + timedelta(minutes=minute)
    return {
        "predicted_temperature": predicted,
        "actual_temperature": actual,
        "predicted_for": target,
        "created_at": target - timedelta(minutes=5),
        "threshold_normal_max": 30.0,
        "threshold_anomaly_min": 32.0,
    }


class EarlyWarningEvaluationTests(unittest.TestCase):
    def test_counts_one_missed_transition_episode_instead_of_each_point(self) -> None:
        result = evaluate_matched_predictions(
            [row(0, 29.0, 29.0), row(1, 29.2, 30.5), row(2, 29.4, 31.0), row(3, 29.5, 29.5)]
        )
        self.assertEqual(result["episode_count"], 1)
        self.assertEqual(result["missed_warning_count"], 1)
        self.assertEqual(result["threshold_recall"], 0.0)

    def test_reports_detected_episode_lead_time_and_false_warning(self) -> None:
        result = evaluate_matched_predictions(
            [row(0, 30.2, 29.0), row(1, 30.4, 30.5), row(2, 30.6, 31.0)]
        )
        self.assertEqual(result["false_warning_predictions"], 1)
        self.assertEqual(result["detected_episode_count"], 1)
        self.assertEqual(result["median_lead_time_seconds"], 300.0)

    def test_warning_created_after_threshold_crossing_is_not_early_warning(self) -> None:
        rows = [row(0, 29.0, 30.5), row(1, 30.5, 31.0)]
        rows[1]["created_at"] = BASE + timedelta(seconds=30)
        result = evaluate_matched_predictions(rows)
        self.assertEqual(result["detected_episode_count"], 0)
        self.assertEqual(result["missed_warning_count"], 1)
        self.assertIsNone(result["median_lead_time_seconds"])

    def test_promotion_fails_when_lstm_is_worse_than_best_baseline(self) -> None:
        quality = {
            "lstm": {"rmse": 0.10, "mae": 0.08, "mape": 0.3},
            "baselines": {
                "persistence": {"rmse": 0.05, "mae": 0.04, "mape": 0.1},
                "moving_average": {"rmse": 0.06, "mae": 0.05, "mape": 0.2},
            },
        }
        result = evaluate_promotion_gate(quality)
        self.assertFalse(result["passed"])
        self.assertEqual(result["best_baseline"]["name"], "persistence")
        self.assertEqual(len(result["reasons"]), 2)

    def test_promotion_passes_when_lstm_beats_baseline(self) -> None:
        quality = {
            "lstm": {"rmse": 0.04, "mae": 0.03, "mape": 0.1},
            "baselines": {"persistence": {"rmse": 0.05, "mae": 0.04, "mape": 0.2}},
        }
        self.assertTrue(evaluate_promotion_gate(quality)["passed"])


if __name__ == "__main__":
    unittest.main()
