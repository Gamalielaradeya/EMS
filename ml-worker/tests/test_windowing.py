from __future__ import annotations

import unittest

import pandas as pd

from ml_worker.preprocessing import TARGET_COLUMN
from ml_worker.windowing import build_windows


class WindowingTests(unittest.TestCase):
    def test_builds_ordered_windows(self) -> None:
        frame = pd.DataFrame(
            {
                "temperature_s1": range(40),
                "humidity_s1": range(100, 140),
                "temperature_s2": range(200, 240),
                "humidity_s2": range(300, 340),
                TARGET_COLUMN: range(400, 440),
            }
        )
        windows, targets = build_windows(frame, 30)
        self.assertEqual(windows.shape, (11, 30, 4))
        self.assertEqual(targets.shape, (11, 1))
        self.assertEqual(windows[0, -1, 2], 229)
        self.assertEqual(targets[0, 0], 429)

    def test_rejects_windows_that_cross_timestamp_gap(self) -> None:
        index = pd.date_range("2026-01-01T00:00:00Z", periods=40, freq="1min")
        index = index[:20].append(index[20:] + pd.Timedelta(minutes=10))
        frame = pd.DataFrame(
            {
                "temperature_s1": range(40),
                "humidity_s1": range(100, 140),
                "temperature_s2": range(200, 240),
                "humidity_s2": range(300, 340),
                TARGET_COLUMN: range(400, 440),
            },
            index=index,
        )

        windows, targets = build_windows(frame, 10, expected_interval_seconds=60)

        self.assertEqual(windows.shape, (22, 10, 4))
        self.assertEqual(targets.shape, (22, 1))


if __name__ == "__main__":
    unittest.main()
