from __future__ import annotations

import unittest
from pathlib import Path

from ml_worker.config import PROJECT_ROOT
from ml_worker.repository import _resolved_path, _stored_path


class RepositoryTests(unittest.TestCase):
    def test_artifact_paths_are_stored_relative_to_worker_root(self) -> None:
        artifact = PROJECT_ROOT / "models" / "example" / "model.keras"
        stored = _stored_path(artifact)
        self.assertEqual(stored, str(Path("models") / "example" / "model.keras"))
        self.assertEqual(_resolved_path(stored), artifact)


if __name__ == "__main__":
    unittest.main()
