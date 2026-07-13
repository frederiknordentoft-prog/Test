"""Forecast-skill metrics for the hindcast.

A model that fits history is worthless; a model that beats a naive baseline
*out of sample* is informative. We report, per vertical, error on the held-out
years relative to two honest baselines:

- **random walk (RW)**: next year = last observed year (persistence).
- **last-growth (LG)**: extrapolate the most recent year-on-year growth.

MASE (mean absolute scaled error) < 1 means the model beats the naive
random-walk baseline; > 1 means it does not. With only ~13 annual observations
the honest claim is "the model is not rejected / beats naive", never a precise
point forecast (perspective §6).
"""
from __future__ import annotations

import numpy as np


def mape(actual: np.ndarray, pred: np.ndarray) -> float:
    a = np.asarray(actual, float)
    p = np.asarray(pred, float)
    mask = np.abs(a) > 1e-9
    return float(np.mean(np.abs((a[mask] - p[mask]) / a[mask]))) if mask.any() else float("nan")


def rmse(actual: np.ndarray, pred: np.ndarray) -> float:
    a = np.asarray(actual, float)
    p = np.asarray(pred, float)
    return float(np.sqrt(np.mean((a - p) ** 2)))


def mase(train: np.ndarray, actual: np.ndarray, pred: np.ndarray) -> float:
    """Mean absolute scaled error: model MAE on the holdout divided by the
    in-sample MAE of a one-step random-walk. <1 beats persistence."""
    train = np.asarray(train, float)
    naive_mae = np.mean(np.abs(np.diff(train))) if len(train) > 1 else 1.0
    naive_mae = max(naive_mae, 1e-9)
    model_mae = np.mean(np.abs(np.asarray(actual, float) - np.asarray(pred, float)))
    return float(model_mae / naive_mae)


def naive_random_walk(train: np.ndarray, horizon: int) -> np.ndarray:
    return np.full(horizon, float(train[-1]))


def naive_last_growth(train: np.ndarray, horizon: int) -> np.ndarray:
    if len(train) < 2 or train[-2] == 0:
        return naive_random_walk(train, horizon)
    g = train[-1] / train[-2]
    return np.array([train[-1] * g ** (h + 1) for h in range(horizon)])


def skill_report(name: str, train: np.ndarray, holdout_actual: np.ndarray,
                 model_pred: np.ndarray) -> dict:
    """Compare the fitted model against the two naive baselines on the holdout."""
    h = len(holdout_actual)
    rw = naive_random_walk(train, h)
    lg = naive_last_growth(train, h)
    return {
        "series": name,
        "holdout_years": h,
        "model": {"mape": round(mape(holdout_actual, model_pred), 4),
                  "rmse": round(rmse(holdout_actual, model_pred), 3),
                  "mase": round(mase(train, holdout_actual, model_pred), 3)},
        "random_walk": {"mape": round(mape(holdout_actual, rw), 4),
                        "mase": round(mase(train, holdout_actual, rw), 3)},
        "last_growth": {"mape": round(mape(holdout_actual, lg), 4),
                        "mase": round(mase(train, holdout_actual, lg), 3)},
        "beats_random_walk": bool(mase(train, holdout_actual, model_pred)
                                  < mase(train, holdout_actual, rw)),
    }
