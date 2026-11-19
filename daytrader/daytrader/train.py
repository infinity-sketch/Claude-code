"""Train a DQN day-trading agent and compare it with baselines on held-out days.

    python -m daytrader.train                       # synthetic data
    python -m daytrader.train --csv my_1min.csv     # your own intraday bars
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import numpy as np

from . import agents as A
from .backtest import format_table, run_backtest
from .data import load_csv, split, synthetic_sessions
from .env import DayTradingEnv, EnvConfig


def train(args):
    sessions = load_csv(args.csv) if args.csv else synthetic_sessions(args.days, seed=args.seed)
    tr, va, te = split(sessions)
    print(f"Sessions: {len(tr)} train / {len(va)} val / {len(te)} test "
          f"({'CSV' if args.csv else 'synthetic'})")
    cfg = EnvConfig(cost_bps=args.cost_bps, allow_short=not args.long_only,
                    decision_every=args.decision_every)
    train_cfg = EnvConfig(**{**cfg.__dict__, "turnover_penalty": args.turnover_penalty})
    env_tr = DayTradingEnv(tr, train_cfg, seed=args.seed)
    env_va, env_te = DayTradingEnv(va, cfg), DayTradingEnv(te, cfg)

    agent = A.DQNAgent(env_tr.obs_dim, env_tr.n_actions, hidden=tuple(args.hidden),
                       lr=args.lr, gamma=args.gamma, seed=args.seed)
    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    best_sharpe, best_ep, history = -np.inf, 0, []
    t0 = time.time()
    for ep in range(1, args.episodes + 1):
        agent.epsilon = max(args.eps_min, 1.0 - ep / (args.episodes * 0.6))
        obs, done, ep_r, losses = env_tr.reset(), False, 0.0, []
        step = 0
        while not done:
            a = agent.act(obs)
            obs2, r, done, _ = env_tr.step(a)
            agent.observe(obs, a, r, obs2, float(done))
            if step % args.learn_every == 0:
                l = agent.learn()
                if l is not None:
                    losses.append(l)
            obs, ep_r, step = obs2, ep_r + r, step + 1
        if ep % args.eval_every == 0 or ep == args.episodes:
            m = run_backtest(agent, env_va)
            history.append({"episode": ep, "epsilon": agent.epsilon, **m})
            flag = ""
            if m["sharpe_annual"] > best_sharpe:  # model selection on validation only
                best_sharpe, best_ep, flag = m["sharpe_annual"], ep, "  *best"
                agent.save(out / "dqn_best.npz")
            print(f"ep {ep:4d}  eps {agent.epsilon:.2f}  loss {np.mean(losses) if losses else 0:.4f}  "
                  f"val ret {m['total_return_pct']:+6.2f}%  sharpe {m['sharpe_annual']:+5.2f}  "
                  f"trades/d {m['trades_per_day']:5.1f}  [{time.time()-t0:.0f}s]{flag}")
    (out / "history.json").write_text(json.dumps(history, indent=2))

    agent.load(out / "dqn_best.npz")
    rows = {f"DQN (best @ ep {best_ep})": run_backtest(agent, env_te)}
    for b in (A.FlatAgent(), A.BuyHoldIntradayAgent(), A.RandomAgent(env_te.n_actions, args.seed),
              A.MomentumAgent(), A.VWAPReversionAgent()):
        rows[b.name] = run_backtest(b, env_te)
    print(f"\nHeld-out TEST results ({len(te)} sessions, {args.cost_bps} bps cost per trade side):")
    print(format_table(rows))
    (out / "test_results.json").write_text(json.dumps(rows, indent=2, default=float))
    print(f"\nSaved model + logs to {out}/")
    return rows


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--csv", help="intraday OHLCV CSV (timestamp,open,high,low,close,volume)")
    p.add_argument("--days", type=int, default=400, help="synthetic sessions to generate")
    p.add_argument("--episodes", type=int, default=1500)
    p.add_argument("--eval-every", type=int, default=50)
    p.add_argument("--learn-every", type=int, default=4)
    p.add_argument("--lr", type=float, default=5e-4)
    p.add_argument("--gamma", type=float, default=0.97)
    p.add_argument("--hidden", type=int, nargs="+", default=[64, 64])
    p.add_argument("--eps-min", type=float, default=0.05)
    p.add_argument("--cost-bps", type=float, default=1.0)
    p.add_argument("--long-only", action="store_true")
    p.add_argument("--decision-every", type=int, default=5, help="bars between decisions")
    p.add_argument("--turnover-penalty", type=float, default=0.05,
                   help="training-only reward penalty per unit position change")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--out", default="runs/latest")
    train(p.parse_args(argv))


if __name__ == "__main__":
    main()
