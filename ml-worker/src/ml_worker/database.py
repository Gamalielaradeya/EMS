from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg import Connection

from ml_worker.config import Settings, require_database_url
from ml_worker.errors import DatabaseError


@contextmanager
def connect(settings: Settings) -> Iterator[Connection]:
    try:
        with psycopg.connect(require_database_url(settings)) as connection:
            yield connection
    except psycopg.Error as exc:
        raise DatabaseError(f"PostgreSQL operation failed: {exc}") from exc
