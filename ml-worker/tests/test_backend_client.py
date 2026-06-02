from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from ml_worker.backend_client import build_prediction_payload, submit_prediction
from ml_worker.config import load_settings


class FakeResponse:
    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps({"status": "success", "data": {"id": 7, "final_status": "waspada"}}).encode()


class BackendClientTests(unittest.TestCase):
    def test_payload_matches_internal_prediction_contract(self) -> None:
        payload = build_prediction_payload(
            model_version_id=4,
            model_version="v-test",
            prediction_run_id=9,
            predicted_temperature=31.2,
            input_window_start_at="2026-06-01T10:00:00+00:00",
            input_window_end_at="2026-06-01T10:30:00+00:00",
            predicted_for="2026-06-01T10:35:00+00:00",
        )
        self.assertEqual(payload["target_sensor_code"], "S2")
        self.assertEqual(payload["predicted_temperature"], 31.2)

    @patch.dict(os.environ, {"INTERNAL_API_TOKEN": "internal-token"}, clear=False)
    def test_submit_uses_internal_bearer_token(self) -> None:
        captured = {}

        def opener(request: object, timeout: int) -> FakeResponse:
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse()

        result = submit_prediction(load_settings(), {"predicted_temperature": 31.2}, opener=opener)
        request = captured["request"]
        self.assertEqual(request.get_header("Authorization"), "Bearer internal-token")
        self.assertEqual(captured["timeout"], 10)
        self.assertEqual(result["final_status"], "waspada")


if __name__ == "__main__":
    unittest.main()
