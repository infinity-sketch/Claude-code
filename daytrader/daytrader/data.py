"""Market data: load intraday OHLCV from CSV, or generate synthetic sessions.

CSV format (one row per bar, e.g. 1-minute):
    timestamp,open,high,low,close,volume
Timestamps are parsed by pandas; each calendar date becomes one trading session.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

COLUMNS = ["open", "high", "low", "close", "volume"]


def load_csv(path: str) -> list[pd.DataFrame]:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    ts_col = next((c for c in ("timestamp", "datetime", "date", "time") if c in df.columns), None)
    if ts_col is None:
        raise ValueError("CSV needs a timestamp/datetime/date column")
    missing = [c for c in COLUMNS if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing columns: {missing}")
    df[ts_col] = pd.to_datetime(df[ts_col])
    df = df.sort_values(ts_col).set_index(ts_col)[COLUMNS].astype(float).dropna()
    return [g for _, g in df.groupby(df.index.date) if len(g) >= 30]


def synthetic_sessions(n_days: int = 200, bars_per_day: int = 390, seed: int = 0,
                       start_price: float = 100.0) -> list[pd.DataFrame]:
    """Regime-switching intraday price paths with mean-reversion, trend bursts,
    a U-shaped volatility profile, and overnight gaps. Contains learnable but
    noisy structure, so agents have something to find without it being trivial."""
    rng = np.random.default_rng(seed)
    sessions = []
    price = start_price
    t = np.linspace(0, 1, bars_per_day)
    vol_profile = 0.6 + 1.2 * (t - 0.5) ** 2 * 4  # higher at open/close
    for d in range(n_days):
        price *= np.exp(rng.normal(0, 0.008))  # overnight gap
        anchor = price
        regime = rng.choice(["trend", "revert", "chop"], p=[0.35, 0.4, 0.25])
        drift = rng.normal(0, 0.00002) if regime == "trend" else 0.0
        base_vol = rng.uniform(0.0003, 0.0007)
        closes = np.empty(bars_per_day)
        momentum = 0.0
        p = price
        for i in range(bars_per_day):
            vol = base_vol * vol_profile[i]
            shock = rng.normal(0, vol)
            if regime == "trend":
                momentum = 0.25 * momentum + shock
                r = drift + momentum
            elif regime == "revert":
                r = -0.03 * np.log(p / anchor) + shock
            else:
                r = shock
            p *= np.exp(r)
            closes[i] = p
        opens = np.concatenate([[price], closes[:-1]])
        spread = np.abs(rng.normal(0, base_vol, bars_per_day)) * closes
        highs = np.maximum(opens, closes) + spread
        lows = np.minimum(opens, closes) - spread
        volume = rng.lognormal(10, 0.4, bars_per_day) * vol_profile
        idx = pd.date_range(pd.Timestamp("2024-01-02 09:30") + pd.Timedelta(days=d),
                            periods=bars_per_day, freq="min")
        sessions.append(pd.DataFrame({"open": opens, "high": highs, "low": lows,
                                      "close": closes, "volume": volume}, index=idx))
        price = closes[-1]
    return sessions


def split(sessions: list, train: float = 0.7, val: float = 0.15):
    """Chronological split — never shuffle time series across the split."""
    n = len(sessions)
    a, b = int(n * train), int(n * (train + val))
    return sessions[:a], sessions[a:b], sessions[b:]
