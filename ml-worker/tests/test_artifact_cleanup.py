from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from ml_worker.artifact_cleanup import find_orphan_artifact_dirs


class ArtifactCleanupTests(unittest.TestCase):
    def test_only_returns_unreferenced_generated_model_directories(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            models = root / "models"
            reports = root / "reports"
            kept_model = models / "ems_s2_lstm_v1"
            orphan_model = models / "ems_s2_lstm_v2"
            orphan_report = reports / "ems_s2_lstm_v2"
            synthetic = reports / "synthetic-run-01"
            for path in (kept_model, orphan_model, orphan_report, synthetic):
                path.mkdir(parents=True)

            result = find_orphan_artifact_dirs(
                models,
                reports,
                "ems_s2_lstm",
                [kept_model / "model.keras"],
            )

            self.assertEqual(result, sorted([orphan_model.resolve(), orphan_report.resolve()]))

    def test_missing_roots_are_safe(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            result = find_orphan_artifact_dirs(
                root / "missing-models",
                root / "missing-reports",
                "ems_s2_lstm",
                [],
            )
            self.assertEqual(result, [])
