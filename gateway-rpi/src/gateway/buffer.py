from __future__ import annotations

import json
import logging
import time
from collections.abc import Callable
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from gateway.http_sender import DeliveryError, HTTPSender
from gateway.models import BufferConfig, BufferedPayload
from gateway.payload_builder import mark_replay


class JSONLBuffer:
    def __init__(self, config: BufferConfig) -> None:
        self._config = config
        self._path = config.file_path
        self._logger = logging.getLogger("gateway.buffer")

    @property
    def path(self) -> Path:
        return self._path

    def append(self, endpoint: str, payload: dict[str, Any]) -> None:
        if not self._config.enabled:
            return
        items = self.read_all()
        items.append(BufferedPayload.create(endpoint, payload, datetime.now(timezone.utc)))
        dropped = max(0, len(items) - self._config.max_items)
        if dropped:
            self._logger.warning("Buffer full; dropping %d oldest payload(s)", dropped)
            items = items[dropped:]
        self._write(items)

    def peek(self, limit: int) -> list[BufferedPayload]:
        return self.read_all()[:limit]

    def discard(self, count: int) -> None:
        if count <= 0:
            return
        self._write(self.read_all()[count:])

    def read_all(self) -> list[BufferedPayload]:
        if not self._path.exists():
            return []
        items: list[BufferedPayload] = []
        try:
            for line_number, line in enumerate(self._path.read_text(encoding="utf-8").splitlines(), start=1):
                if not line.strip():
                    continue
                raw = json.loads(line)
                items.append(
                    BufferedPayload(
                        endpoint=str(raw["endpoint"]),
                        payload=dict(raw["payload"]),
                        buffered_at=str(raw["buffered_at"]),
                    )
                )
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise RuntimeError(f"cannot read JSONL buffer {self._path}: {exc}") from exc
        return items

    def _write(self, items: list[BufferedPayload]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        content = "".join(
            json.dumps(
                {"endpoint": item.endpoint, "payload": item.payload, "buffered_at": item.buffered_at},
                separators=(",", ":"),
            )
            + "\n"
            for item in items
        )
        self._path.write_text(content, encoding="utf-8")


class BufferReplayer:
    def __init__(
        self,
        config: BufferConfig,
        buffer: JSONLBuffer,
        sender: HTTPSender,
        *,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._config = config
        self._buffer = buffer
        self._sender = sender
        self._monotonic = monotonic
        self._last_attempt_at: float | None = None
        self._logger = logging.getLogger("gateway.buffer")

    def replay_due(self) -> int:
        if not self._config.enabled or not self._config.replay_enabled:
            return 0
        now = self._monotonic()
        if self._last_attempt_at is not None:
            elapsed = now - self._last_attempt_at
            if elapsed < self._config.replay_interval_seconds:
                return 0
        self._last_attempt_at = now

        replayed = 0
        for item in self._buffer.peek(self._config.replay_batch_size):
            try:
                self._sender.send(item.endpoint, mark_replay(item.payload))
            except DeliveryError as exc:
                self._logger.warning("Buffered replay paused: %s", exc)
                break
            self._buffer.discard(1)
            replayed += 1
        if replayed:
            self._logger.info("Replayed %d buffered payload(s)", replayed)
        return replayed
