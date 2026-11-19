"""Agents: a trainable Double-DQN plus rule-based baselines to compare against."""
from __future__ import annotations

import numpy as np

from .nn import MLP


class RunningNorm:
    def __init__(self, dim):
        self.n, self.mean, self.m2 = 0, np.zeros(dim), np.zeros(dim)

    def update(self, x):
        for row in np.atleast_2d(x):
            self.n += 1
            d = row - self.mean
            self.mean += d / self.n
            self.m2 += d * (row - self.mean)

    def __call__(self, x):
        std = np.sqrt(self.m2 / max(self.n - 1, 1)) + 1e-6
        return np.clip((x - self.mean) / std, -6, 6)


class Replay:
    def __init__(self, cap, dim, seed=0):
        self.s = np.zeros((cap, dim)); self.s2 = np.zeros((cap, dim))
        self.a = np.zeros(cap, int); self.r = np.zeros(cap); self.d = np.zeros(cap)
        self.cap, self.i, self.full = cap, 0, False
        self.rng = np.random.default_rng(seed)

    def add(self, s, a, r, s2, d):
        self.s[self.i], self.a[self.i], self.r[self.i], self.s2[self.i], self.d[self.i] = s, a, r, s2, d
        self.i = (self.i + 1) % self.cap
        self.full |= self.i == 0

    def __len__(self):
        return self.cap if self.full else self.i

    def sample(self, n):
        idx = self.rng.integers(len(self), size=n)
        return self.s[idx], self.a[idx], self.r[idx], self.s2[idx], self.d[idx]


class DQNAgent:
    name = "dqn"

    def __init__(self, obs_dim, n_actions, hidden=(64, 64), lr=5e-4, gamma=0.97,
                 batch=128, buffer=100_000, target_every=500, seed=0):
        sizes = [obs_dim, *hidden, n_actions]
        self.q = MLP(sizes, seed=seed, lr=lr)
        self.q_target = MLP(sizes, seed=seed)
        self.q_target.copy_from(self.q)
        self.norm = RunningNorm(obs_dim)
        self.buf = Replay(buffer, obs_dim, seed)
        self.n_actions, self.gamma, self.batch, self.target_every = n_actions, gamma, batch, target_every
        self.rng = np.random.default_rng(seed)
        self.updates = 0
        self.epsilon = 1.0

    def act(self, obs, greedy=False):
        if not greedy and self.rng.random() < self.epsilon:
            return int(self.rng.integers(self.n_actions))
        return int(np.argmax(self.q.forward(self.norm(obs)[None])[0]))

    def observe(self, s, a, r, s2, d):
        self.norm.update(s)
        self.buf.add(s, a, r, s2, d)

    def learn(self):
        if len(self.buf) < self.batch * 10:
            return None
        s, a, r, s2, d = self.buf.sample(self.batch)
        s, s2 = self.norm(s), self.norm(s2)
        q, acts = self.q.forward(s, cache=True)
        # Double DQN: online net picks next action, target net evaluates it
        a2 = np.argmax(self.q.forward(s2), axis=1)
        q2 = self.q_target.forward(s2)[np.arange(len(a2)), a2]
        target = r + self.gamma * (1 - d) * q2
        err = q[np.arange(len(a)), a] - target
        # Huber loss gradient
        g = np.zeros_like(q)
        g[np.arange(len(a)), a] = np.clip(err, -1, 1) / len(a)
        self.q.adam(self.q.backward(acts, g))
        self.updates += 1
        if self.updates % self.target_every == 0:
            self.q_target.copy_from(self.q)
        return float(np.mean(err ** 2))

    def save(self, path):
        np.savez(path, **self.q.state(), norm_n=self.norm.n, norm_mean=self.norm.mean,
                 norm_m2=self.norm.m2)

    def load(self, path):
        z = np.load(path)
        self.q.load_state(z)
        self.q_target.copy_from(self.q)
        self.norm.n, self.norm.mean, self.norm.m2 = int(z["norm_n"]), z["norm_mean"], z["norm_m2"]
        self.epsilon = 0.0


# ---- Baselines (obs layout: see features.FEATURE_NAMES, then pos, upnl, bars_left) ----

class FlatAgent:
    name = "flat (no trading)"
    def act(self, obs, greedy=True): return 0


class BuyHoldIntradayAgent:
    name = "buy & hold intraday"
    def act(self, obs, greedy=True): return 1


class RandomAgent:
    name = "random"
    def __init__(self, n_actions=3, seed=0):
        self.rng, self.n = np.random.default_rng(seed), n_actions
    def act(self, obs, greedy=True): return int(self.rng.integers(self.n))


class MomentumAgent:
    name = "momentum (15-bar)"
    def act(self, obs, greedy=True):
        r15 = obs[2]
        return 1 if r15 > 0.05 else 2 if r15 < -0.05 else 0


class VWAPReversionAgent:
    name = "VWAP mean-reversion"
    def act(self, obs, greedy=True):
        d = obs[6]
        return 2 if d > 0.15 else 1 if d < -0.15 else 0
