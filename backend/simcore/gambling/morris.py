"""Morris elementary-effects screening over the parameter register.

The 3×3 channelization×concentration grid answers "is this conclusion robust
across the two contested assumptions?" — but the register carries ~20 red-prior
parameters (harm coefficients, β scales, loop strengths) that also drive
conclusions. Morris screening ranks ALL of them by global influence at
r·(k+1) model runs instead of a full factorial, reporting per output metric:

- ``mu_star``: mean |elementary effect| — overall influence,
- ``sigma``: std of the effects — nonlinearity / interaction,

with effects normalized per parameter range and per output scale so ranks are
comparable. The ranking tells the analyst *which sliders matter* — and which
red priors most urgently need real data (perspective §7, fælde 3/4).
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.params import Param, screening_params
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import SimConfig

DEFAULT_METRICS = [
    "channelization", "market_size_total", "ds_share_total",
    "customers_total", "state_revenue", "measured_harm", "harm_gap",
]


def _set_field(gambling: dict, path: str, value: float) -> None:
    keys = path.split(".")
    node = gambling
    for k in keys[:-1]:
        node = node.setdefault(k, {})
    node[keys[-1]] = float(value)


def _evaluate(base_cfg: SimConfig, params: list[Param], x_unit: np.ndarray,
              metrics: list[str], ticks: int) -> dict[str, float]:
    cfg = base_cfg.model_copy(deep=True)
    cfg.ticks = ticks
    g = dict(cfg.gambling or {})
    # Widen the interval guard so the swept channelization is always valid.
    g.setdefault("channelization_low", 0.50)
    g["channelization_low"] = min(g.get("channelization_low", 0.5), 0.50)
    g["channelization_high"] = max(g.get("channelization_high", 0.92), 0.99)
    for p, u in zip(params, x_unit):
        lo, hi = p.interval
        _set_field(g, p.config_field, lo + float(u) * (hi - lo))
    cfg.gambling = g
    sim = GamblingSimulation(cfg)
    sim.run()
    last = sim.metrics_history[-1] if sim.metrics_history else {}
    return {m: float(last.get(m, 0.0)) for m in metrics}


def morris_screening(
    base_cfg: SimConfig,
    params: list[Param] | None = None,
    metrics: list[str] | None = None,
    trajectories: int = 4,
    levels: int = 4,
    ticks: int = 24,
    seed: int = 0,
    on_progress=None,
) -> dict:
    """Randomized Morris trajectories over the unit hypercube of the screenable
    register parameters. Returns per-metric mu_star/sigma per parameter plus an
    overall influence ranking."""
    params = params if params is not None else screening_params()
    metrics = metrics or DEFAULT_METRICS
    if not params:
        return {"params": [], "metrics": metrics, "ranking": [], "n_runs": 0}

    rng = np.random.default_rng(seed)
    k = len(params)
    delta = levels / (2.0 * (levels - 1.0))     # standard Morris step
    grid = np.arange(0, levels // 2) / (levels - 1.0)

    effects: dict[str, dict[str, list[float]]] = {m: {p.name: [] for p in params}
                                                  for m in metrics}
    total_runs = trajectories * (k + 1)
    done = 0
    for _ in range(trajectories):
        x = rng.choice(grid, size=k)             # random base point (low half)
        y = _evaluate(base_cfg, params, x, metrics, ticks)
        done += 1
        if on_progress:
            on_progress(done, total_runs)
        for i in rng.permutation(k):             # move one coordinate at a time
            x_new = x.copy()
            x_new[i] = x[i] + delta
            y_new = _evaluate(base_cfg, params, x_new, metrics, ticks)
            done += 1
            if on_progress:
                on_progress(done, total_runs)
            for m in metrics:
                effects[m][params[i].name].append((y_new[m] - y[m]) / delta)
            x, y = x_new, y_new

    # Normalize per metric by its mean |effect| across all params so mu_star is
    # comparable across outputs of different scale.
    result: dict[str, dict] = {}
    overall: dict[str, float] = {p.name: 0.0 for p in params}
    for m in metrics:
        all_abs = [abs(e) for es in effects[m].values() for e in es]
        scale = float(np.mean(all_abs)) or 1.0
        rows = {}
        for p in params:
            es = np.array(effects[m][p.name]) / scale
            mu_star = float(np.mean(np.abs(es))) if len(es) else 0.0
            rows[p.name] = {
                "mu_star": round(mu_star, 4),
                "sigma": round(float(np.std(es)) if len(es) else 0.0, 4),
                "confidence": p.confidence,
            }
            overall[p.name] += mu_star
        result[m] = rows

    ranking = sorted(overall.items(), key=lambda kv: -kv[1])
    return {
        "params": [p.name for p in params],
        "metrics": metrics,
        "per_metric": result,
        "ranking": [{"name": n, "influence": round(v / len(metrics), 4)} for n, v in ranking],
        "n_runs": total_runs,
        "trajectories": trajectories,
        "ticks": ticks,
    }
