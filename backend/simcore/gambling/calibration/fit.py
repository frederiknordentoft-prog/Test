"""Fit a parsimonious growth model to a historical vertical series, with a
proper train/holdout split — the core of the hindcast (Etape B).

Method: simulated / indirect least squares. We minimize the squared error
between the model's projected annual values and the observed values on the
*training* years only, then score the frozen model on the *held-out* years.
Deliberately few free parameters (2–4) so ~13 annual observations can identify
them without overfitting (perspective §7 fælde 3).
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import least_squares

from simcore.gambling.calibration.growth_models import MODELS, project
from simcore.gambling.calibration.skill import skill_report


def fit_series(model: str, years: list[int], values: list[float],
               holdout: int = 2, bounds: dict | None = None,
               init: dict | None = None) -> dict:
    """Fit ``model`` to (years, values) using all but the last ``holdout``
    years, then report out-of-sample skill on the held-out tail."""
    years = np.asarray(years, float)
    values = np.asarray(values, float)
    t = years - years[0]
    n = len(values)
    if holdout >= n:
        raise ValueError("holdout must leave at least one training year")
    tr = slice(0, n - holdout)
    _, names = MODELS[model]

    # sensible defaults for bounds/init if not supplied
    v0, vlast = values[0], values[n - holdout - 1]
    span = max(t[n - holdout - 1] - t[0], 1.0)
    cagr0 = (vlast / max(v0, 1e-9)) ** (1.0 / span) - 1.0
    default_init = {
        "level0": v0, "cagr": cagr0,
        "ceiling": max(values) * 1.6, "midpoint": span, "rate": 0.4, "floor": v0 * 0.5,
        "market": max(values) * 1.6, "p": 0.03, "q": 0.4,
    }
    default_bounds = {
        "level0": (0.0, v0 * 3 + 1), "cagr": (-0.5, 1.0),
        "ceiling": (max(values), max(values) * 6 + 1),
        "midpoint": (-20.0, 60.0), "rate": (0.01, 3.0), "floor": (0.0, max(values)),
        "market": (max(values), max(values) * 6 + 1), "p": (1e-4, 0.5), "q": (0.01, 1.5),
    }
    init = {**default_init, **(init or {})}
    bounds = {**default_bounds, **(bounds or {})}
    x0 = np.array([init[k] for k in names])
    lo = np.array([bounds[k][0] for k in names])
    hi = np.array([bounds[k][1] for k in names])
    x0 = np.clip(x0, lo + 1e-9, hi - 1e-9)

    def resid(x):
        params = dict(zip(names, x))
        pred = project(model, t[tr], params)
        return (pred - values[tr]) / max(np.mean(values[tr]), 1e-9)

    res = least_squares(resid, x0, bounds=(lo, hi), method="trf", max_nfev=4000)
    params = dict(zip(names, res.x.tolist()))

    full = project(model, t, params)
    report = skill_report(model, values[tr], values[n - holdout:], full[n - holdout:])
    return {
        "model": model,
        "params": {k: round(v, 6) for k, v in params.items()},
        "fitted": [round(v, 3) for v in full.tolist()],
        "train_years": [int(y) for y in years[tr].tolist()],
        "holdout_years": [int(y) for y in years[n - holdout:].tolist()],
        "skill": report,
        "converged": bool(res.success),
    }


def best_model(years: list[int], values: list[float], holdout: int = 2,
               candidates=("exponential", "logistic")) -> dict:
    """Fit each candidate shape and pick the one with the best holdout MASE —
    honest model selection on out-of-sample error, not in-sample fit."""
    fits = []
    for m in candidates:
        try:
            fits.append(fit_series(m, years, values, holdout))
        except Exception:  # pragma: no cover - a shape that won't converge
            continue
    if not fits:
        raise RuntimeError("no growth model converged")
    fits.sort(key=lambda f: f["skill"]["model"]["mase"])
    best = fits[0]
    best["alternatives"] = [{"model": f["model"], "mase": f["skill"]["model"]["mase"]}
                            for f in fits]
    return best


def implied_cagr(years: list[int], fitted: list[float], last_n: int = 3) -> float:
    """The forward annual growth the fitted curve implies at its end — fed back
    into the model's ``growth_rate`` so the baseline trend is *calibrated*,
    not eyeballed."""
    v = np.asarray(fitted, float)
    if len(v) < last_n + 1 or v[-last_n - 1] <= 0:
        return 0.0
    return float((v[-1] / v[-last_n - 1]) ** (1.0 / last_n) - 1.0)
