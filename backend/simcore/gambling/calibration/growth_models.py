"""Parsimonious growth models for the per-vertical BSI trajectory.

The historical Danish market (2012→now) is dominated by one structural force:
the digital transition — online casino overtaking betting. That macro trajectory
is what we *can* validate against data; the ABM's forward reaction mechanisms
(channelization, harm, entry) are what we can only reason about. So we fit a
small, identifiable growth model per vertical (2-3 free params — deliberately
far from the ~60 the data cannot support, perspective §7 fælde 3) and hold out
recent years to measure skill.

Three shapes, each ``project(t_years, **params) -> value``:
- ``exponential``:  a constant CAGR (mature verticals: lottery, betting).
- ``logistic``:     an S-curve saturating at a ceiling (adoption: online casino).
- ``bass`` (light): a diffusion curve (innovators + imitators) for a new
  product category — used later for AI/prediction adoption.

Time is measured in years from the series start (t=0 at the first observation).
"""
from __future__ import annotations

import numpy as np


def exponential(t: np.ndarray, level0: float, cagr: float) -> np.ndarray:
    """Constant compound annual growth."""
    return level0 * (1.0 + cagr) ** t


def logistic(t: np.ndarray, ceiling: float, midpoint: float, rate: float,
             floor: float = 0.0) -> np.ndarray:
    """S-curve from ``floor`` toward ``ceiling``; steepest at ``midpoint`` years."""
    return floor + (ceiling - floor) / (1.0 + np.exp(-rate * (t - midpoint)))


def bass(t: np.ndarray, market: float, p: float, q: float) -> np.ndarray:
    """Cumulative Bass diffusion adoption (p = innovation, q = imitation)."""
    e = np.exp(-(p + q) * np.maximum(t, 0.0))
    return market * (1.0 - e) / (1.0 + (q / max(p, 1e-9)) * e)


MODELS = {
    "exponential": (exponential, ("level0", "cagr")),
    "logistic": (logistic, ("ceiling", "midpoint", "rate", "floor")),
    "bass": (bass, ("market", "p", "q")),
}


def project(model: str, t: np.ndarray, params: dict) -> np.ndarray:
    fn, names = MODELS[model]
    return fn(t, **{k: v for k, v in params.items() if k in names})
