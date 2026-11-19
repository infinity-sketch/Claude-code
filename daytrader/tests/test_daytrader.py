import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from daytrader import agents as A
from daytrader.backtest import run_backtest
from daytrader.data import load_csv, split, synthetic_sessions
from daytrader.env import DayTradingEnv, EnvConfig
from daytrader.features import compute_features
from daytrader.nn import MLP


def sessions(n=6):
    return synthetic_sessions(n, bars_per_day=120, seed=1)


def test_features_have_no_lookahead():
    day = sessions(1)[0]
    full = compute_features(day)
    partial = compute_features(day.iloc[:60])
    assert np.allclose(full[:60, :-1], partial[:, :-1])  # time_of_day is schedule-based


def test_always_flat_at_close():
    env = DayTradingEnv(sessions(), EnvConfig(decision_every=1))
    env.reset(day=0)
    done = False
    while not done:
        _, _, done, info = env.step(1)
    assert info["pos"] == 0.0


def test_flat_agent_zero_pnl_and_costs_charged():
    env = DayTradingEnv(sessions(), EnvConfig(cost_bps=5))
    assert run_backtest(A.FlatAgent(), env)["total_return_pct"] == 0.0
    # with zero price movement the only PnL is cost
    s = sessions(1)[0].copy()
    s[["open", "high", "low", "close"]] = 100.0
    env = DayTradingEnv([s], EnvConfig(cost_bps=5, decision_every=1))
    m = run_backtest(A.BuyHoldIntradayAgent(), env)
    assert np.isclose(m["total_return_pct"], -0.10, atol=1e-6)  # 5 bps in + 5 bps out


def test_long_only_blocks_shorts():
    env = DayTradingEnv(sessions(), EnvConfig(allow_short=False))
    env.reset(day=0)
    _, _, _, info = env.step(2)
    assert info["pos"] == 0.0


def test_mlp_gradient_matches_numeric():
    net = MLP([4, 5, 3], seed=0)
    x = np.random.default_rng(0).normal(size=(2, 4))
    out, acts = net.forward(x, cache=True)
    grads = net.backward(acts, np.ones_like(out))
    eps, W = 1e-6, net.W[0]
    W[1, 2] += eps; up = net.forward(x).sum()
    W[1, 2] -= 2 * eps; dn = net.forward(x).sum()
    W[1, 2] += eps
    assert np.isclose(grads[0][1, 2], (up - dn) / (2 * eps), atol=1e-5)


def test_dqn_trains_and_roundtrips(tmp_path):
    tr, _, _ = split(sessions(10))
    env = DayTradingEnv(tr, EnvConfig(decision_every=1))
    agent = A.DQNAgent(env.obs_dim, env.n_actions, batch=16, seed=0)
    for _ in range(5):
        obs, done = env.reset(), False
        while not done:
            a = agent.act(obs)
            obs2, r, done, _ = env.step(a)
            agent.observe(obs, a, r, obs2, float(done))
            agent.learn()
            obs = obs2
    assert agent.updates > 0
    agent.save(tmp_path / "m.npz")
    other = A.DQNAgent(env.obs_dim, env.n_actions)
    other.load(tmp_path / "m.npz")
    o = env.reset(day=0)
    assert agent.act(o, greedy=True) == other.act(o, greedy=True)


def test_load_csv(tmp_path):
    df = sessions(2)[0].reset_index().rename(columns={"index": "timestamp"})
    path = tmp_path / "bars.csv"
    df.to_csv(path, index=False)
    loaded = load_csv(str(path))
    assert len(loaded) == 1 and len(loaded[0]) == 120
