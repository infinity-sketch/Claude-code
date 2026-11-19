"""Backtest a saved model on CSV or synthetic sessions.

    python -m daytrader.evaluate --model runs/latest/dqn_best.npz --csv my_1min.csv
"""
from __future__ import annotations

import argparse

from . import agents as A
from .backtest import format_table, run_backtest
from .data import load_csv, synthetic_sessions
from .env import DayTradingEnv, EnvConfig


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--model", required=True)
    p.add_argument("--csv")
    p.add_argument("--days", type=int, default=60)
    p.add_argument("--seed", type=int, default=123, help="synthetic seed (use one unseen in training)")
    p.add_argument("--cost-bps", type=float, default=1.0)
    p.add_argument("--decision-every", type=int, default=5)
    p.add_argument("--hidden", type=int, nargs="+", default=[64, 64])
    p.add_argument("--long-only", action="store_true")
    a = p.parse_args(argv)
    sessions = load_csv(a.csv) if a.csv else synthetic_sessions(a.days, seed=a.seed)
    env = DayTradingEnv(sessions, EnvConfig(cost_bps=a.cost_bps, decision_every=a.decision_every,
                                            allow_short=not a.long_only))
    agent = A.DQNAgent(env.obs_dim, env.n_actions, hidden=tuple(a.hidden))
    agent.load(a.model)
    rows = {"DQN": run_backtest(agent, env)}
    for b in (A.FlatAgent(), A.BuyHoldIntradayAgent(), A.MomentumAgent(), A.VWAPReversionAgent()):
        rows[b.name] = run_backtest(b, env)
    print(f"{len(sessions)} sessions, {a.cost_bps} bps cost")
    print(format_table(rows))


if __name__ == "__main__":
    main()
