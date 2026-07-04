from __future__ import annotations

from datetime import datetime

import pandas as pd
from psycopg import Connection

from ml_worker.config import Settings

RAW_READING_QUERY = """
SELECT
    sr.recorded_at,
    s.sensor_code,
    sr.temperature::DOUBLE PRECISION,
    sr.humidity::DOUBLE PRECISION
FROM sensor_readings sr
JOIN sensors s ON s.id = sr.sensor_id
WHERE s.sensor_code IN ('S1', 'S2')
  AND sr.source = ANY(%s)
  AND sr.quality_status = ANY(%s)
  AND sr.recorded_at >= %s
  AND sr.recorded_at <= %s
ORDER BY sr.recorded_at ASC, s.sensor_code ASC
"""


def load_raw_readings(
    connection: Connection,
    settings: Settings,
    start_at: datetime,
    end_at: datetime,
) -> pd.DataFrame:
    with connection.cursor() as cursor:
        cursor.execute(
            RAW_READING_QUERY,
            (list(settings.allowed_sources), list(settings.allowed_quality_statuses), start_at, end_at),
        )
        rows = cursor.fetchall()
    return pd.DataFrame(rows, columns=("recorded_at", "sensor_code", "temperature", "humidity"))
