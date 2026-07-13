"""Monte Carlo runner: same configuration across many seeds, headless.

Returns per-seed summaries plus distribution statistics (median, percentiles,
worst case) so users see outcome *distributions* rather than single paths.
Domain-aware: finance and gambling runs are summarized on their own headline
metrics.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

from simcore.models.config import SimConfig

FINANCE_SUMMARY_KEYS = [
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

GAMBLING_SUMMARY_KEYS = [
    "final_ds_share",
    "final_channelization",
    "min_channelization",
    "final_market_size",
    "final_state_revenue",
    "final_true_harm",
    "max_true_harm",
    "final_offshore_share",
    "n_entrants",
]


def summarize_run(sim) -> dict[str, float]:
    mh = sim.metrics_history
    if not mh:
        return {k: 0.0 for k in FINANCE_SUMMARY_KEYS} | {"seed": sim.config.seed}
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


def summarize_gambling(sim) -> dict[str, float]:
    mh = sim.metrics_history
    if not mh:
        return {k: 0.0 for k in GAMBLING_SUMMARY_KEYS} | {"seed": sim.config.seed}
    last = mh[-1]

    def col(name):
        return [m[name] for m in mh if name in m]

    return {
        "seed": sim.config.seed,
        "final_ds_share": last.get("ds_share_total", 0.0),
        "final_channelization": last.get("channelization", 0.0),
        "min_channelization": min(col("channelization") or [0.0]),
        "final_market_size": last.get("market_size_total", 0.0),
        "final_state_revenue": last.get("state_revenue", 0.0),
        "final_true_harm": last.get("true_harm", 0.0),
        "max_true_harm": max(col("true_harm") or [0.0]),
        "final_offshore_share": last.get("offshore_share", 0.0),
        "n_entrants": last.get("n_entrants", 0.0),
    }


# Per-tick fan-chart series (p5/p50/p95 across seeds) per domain — so the UI
# can draw uncertainty over *time*, not only end-state histograms.
FAN_KEYS = {
    "finance": ["price_index", "systemic_risk"],
    "gambling": ["channelization", "ds_share_total", "market_size_total", "customers_total"],
}


def _make_headless(cfg: SimConfig):
    if getattr(cfg, "sim_domain", "finance") == "gambling":
        from simcore.gambling.simulation import GamblingSimulation

        return GamblingSimulation(cfg), summarize_gambling, GAMBLING_SUMMARY_KEYS
    from simcore.engine.simulation import Simulation

    return Simulation(cfg), summarize_run, FINANCE_SUMMARY_KEYS


def run_monte_carlo(
    config: SimConfig,
    seeds: list[int],
    on_progress: Callable[[int, int], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> dict:
    rows: list[dict[str, float]] = []
    keys = FINANCE_SUMMARY_KEYS
    fan_keys = FAN_KEYS.get(getattr(config, "sim_domain", "finance"), [])
    fan_series: dict[str, list[list[float]]] = {k: [] for k in fan_keys}
    for i, seed in enumerate(seeds):
        if should_stop is not None and should_stop():
            break
        cfg = config.model_copy(deep=True)
        cfg.seed = int(seed)
        sim, summarize, keys = _make_headless(cfg)  # headless: no persistence
        sim.run()
        rows.append(summarize(sim))
        for k in fan_keys:
            fan_series[k].append([float(m.get(k, 0.0)) for m in sim.metrics_history])
        if on_progress is not None:
            on_progress(i + 1, len(seeds))

    percentiles: dict[str, dict[str, float]] = {}
    for key in keys:
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

    # Per-tick fan bands: uncertainty drawn over time instead of only end-state.
    series_percentiles: dict[str, dict[str, list[float]]] = {}
    for k, runs_series in fan_series.items():
        lengths = [len(s) for s in runs_series if s]
        if not lengths:
            continue
        n = min(lengths)
        arr = np.array([s[:n] for s in runs_series if s])
        series_percentiles[k] = {
            "ticks": list(range(n)),
            "p5": np.percentile(arr, 5, axis=0).round(4).tolist(),
            "p50": np.percentile(arr, 50, axis=0).round(4).tolist(),
            "p95": np.percentile(arr, 95, axis=0).round(4).tolist(),
        }

    return {"n_runs": len(rows), "runs": rows, "percentiles": percentiles,
            "series_percentiles": series_percentiles}
