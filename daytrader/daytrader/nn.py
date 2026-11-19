"""Tiny numpy MLP with Adam — enough for a DQN without a deep-learning framework."""
from __future__ import annotations

import numpy as np


class MLP:
    def __init__(self, sizes, seed=0, lr=1e-3):
        rng = np.random.default_rng(seed)
        self.W = [rng.normal(0, np.sqrt(2 / a), (a, b)) for a, b in zip(sizes[:-1], sizes[1:])]
        self.b = [np.zeros(b) for b in sizes[1:]]
        self.lr = lr
        self._m = [np.zeros_like(p) for p in self.params()]
        self._v = [np.zeros_like(p) for p in self.params()]
        self._step = 0

    def params(self):
        return self.W + self.b

    def forward(self, x, cache=False):
        acts = [x]
        h = x
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            h = h @ W + b
            if i < len(self.W) - 1:
                h = np.maximum(h, 0)
            acts.append(h)
        return (h, acts) if cache else h

    def backward(self, acts, grad_out):
        gW, gb = [None] * len(self.W), [None] * len(self.b)
        g = grad_out
        for i in reversed(range(len(self.W))):
            gW[i] = acts[i].T @ g
            gb[i] = g.sum(0)
            if i > 0:
                g = (g @ self.W[i].T) * (acts[i] > 0)
        return gW + gb

    def adam(self, grads, clip=10.0):
        norm = np.sqrt(sum((g ** 2).sum() for g in grads))
        if norm > clip:
            grads = [g * clip / norm for g in grads]
        self._step += 1
        b1, b2 = 0.9, 0.999
        for p, g, m, v in zip(self.params(), grads, self._m, self._v):
            m *= b1; m += (1 - b1) * g
            v *= b2; v += (1 - b2) * g * g
            mh = m / (1 - b1 ** self._step)
            vh = v / (1 - b2 ** self._step)
            p -= self.lr * mh / (np.sqrt(vh) + 1e-8)

    def copy_from(self, other: "MLP"):
        for p, q in zip(self.params(), other.params()):
            p[...] = q

    def state(self):
        return {f"p{i}": p for i, p in enumerate(self.params())}

    def load_state(self, state):
        for i, p in enumerate(self.params()):
            p[...] = state[f"p{i}"]
