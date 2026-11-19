"""Per-bar feature engineering. Every feature at bar i uses only data <= i."""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_NAMES = [
    "ret_1", "ret_5", "ret_15", "ret_30",
    "vol_15", "rsi_14", "dist_vwap", "dist_open",
    "range_pos_30", "vol_z", "time_of_day",
]


def _rsi(close: pd.Series, n: int = 14) -> pd.Series:
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    rs = up / (dn + 1e-12)
    return (100 - 100 / (1 + rs)) / 50 - 1  # scaled to [-1, 1]


def compute_features(day: pd.DataFrame) -> np.ndarray:
    c = day["close"]
    lr = np.log(c).diff().fillna(0)
    f = pd.DataFrame(index=day.index)
    for k in (1, 5, 15, 30):
        f[f"ret_{k}"] = np.log(c / c.shift(k)).fillna(0) * 100
    f["vol_15"] = lr.rolling(15, min_periods=2).std().fillna(0) * 100
    f["rsi_14"] = _rsi(c).fillna(0)
    typical = (day["high"] + day["low"] + c) / 3
    vwap = (typical * day["volume"]).cumsum() / day["volume"].cumsum()
    f["dist_vwap"] = (c / vwap - 1) * 100
    f["dist_open"] = (c / day["open"].iloc[0] - 1) * 100
    hi = day["high"].rolling(30, min_periods=1).max()
    lo = day["low"].rolling(30, min_periods=1).min()
    f["range_pos_30"] = ((c - lo) / (hi - lo + 1e-12)) * 2 - 1
    v = day["volume"]
    f["vol_z"] = ((v - v.expanding().mean()) / (v.expanding().std() + 1e-12)).fillna(0).clip(-4, 4)
    f["time_of_day"] = np.linspace(-1, 1, len(day))
    return f[FEATURE_NAMES].to_numpy(dtype=np.float64)
