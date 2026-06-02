from __future__ import annotations

import json
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from ml_worker.config import Settings
from ml_worker.errors import ConfigError, MLWorkerError


def build_prediction_payload(
    *,
    model_version_id: int,
    model_version: str,
    prediction_run_id: int,
    predicted_temperature: float,
    input_window_start_at: str,
    input_window_end_at: str,
    predicted_for: str,
) -> dict[str, Any]:
    return {
        "model_version_id": model_version_id,
        "model_version": model_version,
        "prediction_run_id": prediction_run_id,
        "target_sensor_code": "S2",
        "predicted_temperature": predicted_temperature,
        "input_window_start_at": input_window_start_at,
        "input_window_end_at": input_window_end_at,
        "predicted_for": predicted_for,
    }


def submit_prediction(
    settings: Settings,
    payload: dict[str, Any],
    opener: Callable[..., Any] = urlopen,
) -> dict[str, Any]:
    if not settings.internal_api_token:
        raise ConfigError("INTERNAL_API_TOKEN or INTERNAL_ML_TOKEN is required for inference submission.")
    request = Request(
        f"{settings.backend_base_url}/ml/predictions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {settings.internal_api_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with opener(request, timeout=10) as response:
            body = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        raise MLWorkerError(f"Backend prediction submission failed with HTTP {exc.code}.") from exc
    except (URLError, OSError) as exc:
        raise MLWorkerError(f"Backend prediction submission failed: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise MLWorkerError("Backend prediction submission returned unreadable JSON.") from exc
    if body.get("status") != "success":
        raise MLWorkerError(f"Backend prediction submission failed: {body.get('message', 'unknown error')}")
    return body["data"]
