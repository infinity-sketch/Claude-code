"""Run an agent over sessions greedily and compute trading metrics."""
from __future__ import annotations

import numpy as np

from .env import DayTradingEnv


def run_backtest(agent, env: DayTradingEnv, days=None):
    days = range(len(env.sessions)) if days is None else days
    daily, trades, costs, exposure = [], 0, 0.0, []
    for d in days:
        obs, done, pnl = env.reset(day=d), False, 0.0
        prev = 0.0
        while not done:
            obs, _, done, info = env.step(agent.act(obs, greedy=True))
            pnl += info["pnl"]
            costs += info["cost"]
            if info["pos"] != prev and info["pos"] != 0:
                trades += 1  # count entries / reversals
            prev = info["pos"]
            exposure.append(abs(info["pos"]))
        daily.append(pnl)
    return metrics(np.array(daily), trades, costs, float(np.mean(exposure)))


def metrics(daily: np.ndarray, trades=0, costs=0.0, exposure=0.0):
    equity = np.cumprod(1 + daily)
    peak = np.maximum.accumulate(equity)
    std = daily.std(ddof=1) if len(daily) > 1 else 0.0
    return {
        "days": len(daily),
        "total_return_pct": (equity[-1] - 1) * 100,
        "avg_daily_pct": daily.mean() * 100,
        "sharpe_annual": daily.mean() / std * np.sqrt(252) if std > 0 else 0.0,
        "max_drawdown_pct": ((equity / peak) - 1).min() * 100,
        "win_day_rate": (daily > 0).mean(),
        "trades_per_day": trades / max(len(daily), 1),
        "cost_pct": costs * 100,
        "exposure": exposure,
    }


def format_table(rows: dict[str, dict]) -> str:
    cols = [("total_return_pct", "Return%", "{:+.2f}"), ("sharpe_annual", "Sharpe", "{:+.2f}"),
            ("max_drawdown_pct", "MaxDD%", "{:.2f}"), ("win_day_rate", "WinDays", "{:.0%}"),
            ("trades_per_day", "Trades/d", "{:.1f}"), ("exposure", "Exposure", "{:.0%}")]
    w = max(len(k) for k in rows) + 2
    out = ["Agent".ljust(w) + "".join(h.rjust(10) for _, h, _ in cols)]
    for name, m in rows.items():
        out.append(name.ljust(w) + "".join(f.format(m[k]).rjust(10) for k, _, f in cols))
    return "\n".join(out)
