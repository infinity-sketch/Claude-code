# Day-Trader RL Agent

A reinforcement-learning toolkit that **trains agents to day trade** in a realistic
intraday simulator, then judges them on held-out days against rule-based baselines.

> ⚠️ **Simulation and backtesting only.** Nothing here connects to a broker or places real orders.
> Results on synthetic data say nothing about real markets. Most retail day traders lose money,
> and a strategy that backtests well can still fail live because of overfitting, slippage, latency
> and regime changes. Paper-trade for months before you risk any money.

## Quick start

```bash
cd daytrader
pip install -r requirements.txt          # just numpy + pandas (+ pytest)
python -m daytrader.train                # ~25s on synthetic data
python -m daytrader.evaluate --model runs/latest/dqn_best.npz --days 100 --seed 999
python -m pytest -q tests
```

Train on your own 1-minute bars (one row per bar; each calendar date becomes one session):

```bash
python -m daytrader.train --csv data/SPY_1min.csv --cost-bps 2
```

CSV columns: `timestamp,open,high,low,close,volume`.

## How it works

| Piece | File | What it does |
|---|---|---|
| Data | `data.py` | Loads CSV bars, or generates synthetic sessions (trend, mean-reverting and choppy regimes, U-shaped intraday volatility, overnight gaps). Splits train, validation and test **by date**, never shuffled. |
| Features | `features.py` | Returns over 1/5/15/30 bars, realized volatility, RSI, distance from VWAP and from the open, position in the 30-bar range, volume z-score, time of day. Each feature uses only past bars (enforced by a test). |
| Environment | `env.py` | One episode = one session. Actions: **flat / long / short** target position, decided every `--decision-every` bars. Each position change pays `--cost-bps`. **Positions are force-closed at the close**, so nothing is held overnight. |
| Agent | `agents.py`, `nn.py` | Double-DQN built on a small numpy MLP: Adam, Huber loss, replay buffer, target network, running observation normalisation. No PyTorch needed. |
| Baselines | `agents.py` | Flat, intraday buy & hold, random, 15-bar momentum, VWAP mean reversion. |
| Evaluation | `backtest.py` | Return, annualised Sharpe, max drawdown, winning-day rate, trades per day, exposure. |

**Guarding against overfitting:** the model is checkpointed on *validation* Sharpe. The
test set is touched once, at the end. The turnover penalty applies to training reward
only, so reported numbers are honest PnL after costs.

## Example result (synthetic data, default settings)

60 held-out test sessions:

```
Agent                    Return%    Sharpe    MaxDD%   WinDays  Trades/d  Exposure
DQN (best @ ep 1500)       +8.56     +2.48     -3.24       58%       4.2       74%
flat (no trading)          +0.00     +0.00      0.00        0%       0.0        0%
buy & hold intraday        -0.64     -0.11     -5.43       53%       1.0       99%
random                    -34.67    -11.95    -33.66       20%      31.4       66%
momentum (15-bar)         -30.81    -10.19    -30.85       25%      19.1       75%
VWAP mean-reversion        +7.83     +2.70     -3.93       67%       7.0       60%
```

The synthetic market has mean-reverting structure built in. The DQN found it on its own,
roughly matching a hand-written VWAP-reversion rule while trading less. On real data,
expect far weaker edges. Always compare against the baselines and against **flat**.

## Useful knobs

| Flag | Default | Notes |
|---|---|---|
| `--episodes` | 1500 | Training sessions sampled |
| `--decision-every` | 5 | Bars between decisions. Higher means less noise and fewer trades |
| `--turnover-penalty` | 0.05 | Training-only penalty that discourages churning |
| `--cost-bps` | 1.0 | Commission plus slippage per side. Use 2–5 for realistic retail costs |
| `--long-only` | off | Disables shorting |
| `--hidden` | 64 64 | MLP layer sizes |

## Ideas for next steps

- Train on real minute bars from your data vendor and test across several tickers and years
- Walk-forward retraining (rolling train and test windows)
- Position sizing and stop-loss rules, plus a daily loss limit in the env
- Swap in PPO or a recurrent policy
- A paper-trading adapter (for example a broker's sandbox API) once backtests are robust
