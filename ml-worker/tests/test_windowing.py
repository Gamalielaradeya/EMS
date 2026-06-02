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
        self.assertEqual(windows.shape, (10, 30, 4))
        self.assertEqual(targets.shape, (10, 1))
        self.assertEqual(windows[0, -1, 2], 229)
        self.assertEqual(targets[0, 0], 430)


if __name__ == "__main__":
    unittest.main()
