from __future__ import annotations

import os
import unittest
from unittest.mock import patch

from ml_worker.config import ConfigError, load_settings


class ConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        os.environ.pop("ML_INFER_INTERVAL_SECONDS", None)

    def test_infer_interval_defaults_to_sixty_seconds(self) -> None:
        self.assertEqual(load_settings().infer_interval_seconds, 60)

    @patch.dict(os.environ, {"ML_INFER_INTERVAL_SECONDS": "17"}, clear=False)
    def test_infer_interval_can_be_overridden(self) -> None:
        self.assertEqual(load_settings().infer_interval_seconds, 17)

    @patch.dict(os.environ, {"ML_INFER_INTERVAL_SECONDS": "0"}, clear=False)
    def test_infer_interval_must_be_positive(self) -> None:
        with self.assertRaises(ConfigError):
            load_settings()


if __name__ == "__main__":
    unittest.main()
