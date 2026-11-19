"""Intraday trading environment (gym-style API, no gym dependency).

Each episode is one trading session. The agent picks a *target position*
each bar: 0 = flat, 1 = long, 2 = short. Changing position pays commission +
slippage. Any open position is force-closed at the final bar, so the agent
never carries risk overnight — the defining rule of day trading.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .features import compute_features

ACTIONS = {0: 0.0, 1: 1.0, 2: -1.0}  # action -> position


@dataclass
class EnvConfig:
    cost_bps: float = 1.0        # commission + slippage per unit of turnover, in basis points
    warmup: int = 30             # bars skipped at session start (features warm up)
    reward_scale: float = 100.0  # reward = pct-points of PnL, keeps values O(1)
    allow_short: bool = True
    decision_every: int = 5      # agent decides every N bars (action held in between)
    turnover_penalty: float = 0.0  # extra reward penalty per position change (training shaping only)


class DayTradingEnv:
    def __init__(self, sessions, config: EnvConfig | None = None, seed: int = 0):
        self.cfg = config or EnvConfig()
        self.sessions = sessions
        self.feats = [compute_features(s) for s in sessions]
        self.closes = [s["close"].to_numpy() for s in sessions]
        self.rng = np.random.default_rng(seed)
        self.n_actions = 3 if self.cfg.allow_short else 2
        self.obs_dim = self.feats[0].shape[1] + 3  # + position, unrealized pnl, bars-left
        self.day = 0
        self.t = 0
        self.pos = 0.0
        self.entry = None

    def _obs(self):
        close = self.closes[self.day][self.t]
        upnl = 0.0 if self.entry is None else self.pos * (close / self.entry - 1) * 100
        left = 1 - self.t / (len(self.closes[self.day]) - 1)
        return np.concatenate([self.feats[self.day][self.t], [self.pos, upnl, left]])

    def reset(self, day: int | None = None):
        self.day = int(self.rng.integers(len(self.sessions))) if day is None else day
        self.t = self.cfg.warmup
        self.pos, self.entry = 0.0, None
        return self._obs()

    def _bar(self, target: float):
        closes = self.closes[self.day]
        last = len(closes) - 1
        if self.t + 1 >= last:  # final decision: must be flat at the close
            target = 0.0
        turnover = abs(target - self.pos)
        cost = turnover * self.cfg.cost_bps / 1e4
        if target != self.pos:
            self.entry = closes[self.t] if target != 0 else None
        self.pos = target
        pnl = self.pos * (closes[self.t + 1] / closes[self.t] - 1) - cost
        self.t += 1
        return pnl, cost, turnover, self.t >= last

    def step(self, action: int):
        target = ACTIONS[int(action)]
        if not self.cfg.allow_short and target < 0:
            target = 0.0
        pnl = cost = turnover = 0.0
        done = False
        for _ in range(max(1, self.cfg.decision_every)):
            p, c, tv, done = self._bar(target)
            pnl, cost, turnover = pnl + p, cost + c, turnover + tv
            if done:
                break
        reward = pnl * self.cfg.reward_scale - self.cfg.turnover_penalty * turnover
        return self._obs(), reward, done, {"pnl": pnl, "cost": cost, "pos": self.pos,
                                           "turnover": turnover}
