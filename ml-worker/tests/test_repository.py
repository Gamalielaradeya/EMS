from __future__ import annotations

import unittest
from pathlib import Path

from ml_worker.config import PROJECT_ROOT
from ml_worker.repository import (
    _resolved_path,
    _stored_path,
    get_model_version,
    latest_prediction_window_end,
)


class FakeCursor:
    def __init__(self, row: tuple[object, ...] | None = None) -> None:
        self.row = row
        self.query = ""
        self.params: tuple[object, ...] = ()

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def execute(self, query: str, params: tuple[object, ...]) -> None:
        self.query = query
        self.params = params

    def fetchone(self) -> tuple[object, ...] | None:
        return self.row


class FakeConnection:
    def __init__(self, cursor: FakeCursor) -> None:
        self._cursor = cursor

    def cursor(self) -> FakeCursor:
        return self._cursor


class RepositoryTests(unittest.TestCase):
    def test_artifact_paths_are_stored_relative_to_worker_root(self) -> None:
        artifact = PROJECT_ROOT / "models" / "example" / "model.keras"
        stored = _stored_path(artifact)
        self.assertEqual(stored, str(Path("models") / "example" / "model.keras"))
        self.assertEqual(_resolved_path(stored), artifact)

    def test_default_model_lookup_requires_active_model(self) -> None:
        cursor = FakeCursor()

        result = get_model_version(FakeConnection(cursor))  # type: ignore[arg-type]

        self.assertIsNone(result)
        self.assertIn("WHERE is_active = TRUE", cursor.query)
        self.assertEqual(cursor.params, ())

    def test_explicit_model_lookup_uses_requested_version(self) -> None:
        cursor = FakeCursor()

        result = get_model_version(FakeConnection(cursor), "v20260709")  # type: ignore[arg-type]

        self.assertIsNone(result)
        self.assertIn("WHERE version = %s", cursor.query)
        self.assertNotIn("is_active = TRUE", cursor.query)
        self.assertEqual(cursor.params, ("v20260709",))

    def test_latest_prediction_window_is_scoped_to_model(self) -> None:
        cursor = FakeCursor((None,))

        result = latest_prediction_window_end(FakeConnection(cursor), 17)  # type: ignore[arg-type]

        self.assertIsNone(result)
        self.assertIn("WHERE model_version_id = %s", cursor.query)
        self.assertEqual(cursor.params, (17,))


if __name__ == "__main__":
    unittest.main()
