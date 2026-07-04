from __future__ import annotations

import logging
import time
from collections.abc import Callable
from typing import Any

import httpx

from gateway.models import BackendConfig


class DeliveryError(RuntimeError):
    """Raised after the configured bounded HTTP attempts are exhausted."""


class HTTPSender:
    def __init__(
        self,
        config: BackendConfig,
        *,
        transport: httpx.BaseTransport | None = None,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._config = config
        self._sleeper = sleeper
        self._logger = logging.getLogger("gateway.http")
        self._client = httpx.Client(
            base_url=config.base_url,
            headers={"Authorization": f"Bearer {config.token}"},
            timeout=config.timeout_seconds,
            transport=transport,
        )

    def send_readings(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.send(self._config.readings_endpoint, payload)

    def send_status(self, payload: dict[str, Any]) -> dict[str, Any]:
        return self.send(self._config.status_endpoint, payload)

    def send(self, endpoint: str, payload: dict[str, Any]) -> dict[str, Any]:
        last_error: Exception | None = None
        total_attempts = self._config.retry_count + 1
        for attempt in range(1, total_attempts + 1):
            try:
                response = self._client.post(endpoint, json=payload)
                response.raise_for_status()
                if not response.content:
                    return {}
                data = response.json()
                return data if isinstance(data, dict) else {"data": data}
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
                self._logger.warning(
                    "HTTP POST failed endpoint=%s attempt=%d/%d error=%s",
                    endpoint,
                    attempt,
                    total_attempts,
                    exc,
                )
                if attempt < total_attempts:
                    self._sleeper(self._config.retry_delay_seconds)
        raise DeliveryError(f"POST {endpoint} failed after {total_attempts} attempt(s): {last_error}")

    def close(self) -> None:
        self._client.close()
