"""Monte Carlo runner: same configuration across many seeds, headless.

Returns per-seed summaries plus distribution statistics (median, percentiles,
worst case) so users see outcome *distributions* rather than single paths.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

from simcore.engine.simulation import Simulation
from simcore.models.config import SimConfig

SUMMARY_KEYS = [
    "final_price_index",
    "min_price_index",
    "max_drawdown",
    "mean_volatility",
    "bankruptcies_total",
    "defaults_total",
    "worst_systemic_risk",
    "final_wealth_gini",
    "final_mean_leverage",
]


def summarize_run(sim: Simulation) -> dict[str, float]:
    mh = sim.metrics_history
    if not mh:
        return {k: 0.0 for k in SUMMARY_KEYS} | {"seed": sim.config.seed}
    idx = [m["price_index"] for m in mh]
    return {
        "seed": sim.config.seed,
        "final_price_index": idx[-1],
        "min_price_index": min(idx),
        "max_drawdown": max(m["drawdown"] for m in mh),
        "mean_volatility": float(np.mean([m["mean_volatility"] for m in mh])),
        "bankruptcies_total": mh[-1]["bankruptcies_total"],
        "defaults_total": mh[-1]["defaults_total"],
        "worst_systemic_risk": max(m["systemic_risk"] for m in mh),
        "final_wealth_gini": mh[-1]["wealth_gini"],
        "final_mean_leverage": mh[-1]["mean_leverage"],
    }


def run_monte_carlo(
    config: SimConfig,
    seeds: list[int],
    on_progress: Callable[[int, int], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> dict:
    rows: list[dict[str, float]] = []
    for i, seed in enumerate(seeds):
        if should_stop is not None and should_stop():
            break
        cfg = config.model_copy(deep=True)
        cfg.seed = int(seed)
        sim = Simulation(cfg)  # headless: no persistence, no frontend rendering
        sim.run()
        rows.append(summarize_run(sim))
        if on_progress is not None:
            on_progress(i + 1, len(seeds))

    percentiles: dict[str, dict[str, float]] = {}
    for key in SUMMARY_KEYS:
        vals = np.array([r[key] for r in rows]) if rows else np.array([0.0])
        percentiles[key] = {
            "min": float(vals.min()),
            "p5": float(np.percentile(vals, 5)),
            "p25": float(np.percentile(vals, 25)),
            "median": float(np.percentile(vals, 50)),
            "p75": float(np.percentile(vals, 75)),
            "p95": float(np.percentile(vals, 95)),
            "max": float(vals.max()),
            "mean": float(vals.mean()),
        }
    return {"n_runs": len(rows), "runs": rows, "percentiles": percentiles}
