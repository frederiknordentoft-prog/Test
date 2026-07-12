"""Robustness analysis — the model's most important output.

Per the design perspective (§7 fælde 4, §11): the model's value is not the
numbers but *which conclusions are robust across the assumptions*. Channelization
is contested (72-92%) and income concentration is unknown, so a policy's effect
is evaluated across a grid of both. For each headline metric we report the sign
of the policy's effect and the fraction of the grid on which that sign holds — a
conclusion is "robust" only if it holds everywhere. This actively surfaces the
parameter sets that contradict a thesis instead of hiding them.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import SimConfig

DEFAULT_CHANNELIZATION_GRID = [0.72, 0.82, 0.92]      # the contested interval
DEFAULT_SIGMA_GRID = [0.7, 1.1, 1.6]                  # income concentration prior
DEFAULT_METRICS = [
    "measured_harm", "harm_gap", "true_harm", "channelization",
    "state_revenue", "ds_share_total", "offshore_share",
]


def _final(cfg: SimConfig, events) -> dict:
    c = cfg.model_copy(deep=True)
    if events:
        c.events = list(c.events) + list(events)
    sim = GamblingSimulation(c)
    sim.run()
    return sim.metrics_history[-1] if sim.metrics_history else {}


def run_robustness(
    base_cfg: SimConfig,
    policy_events,
    channelization_grid=None,
    sigma_grid=None,
    metrics=None,
    ticks: int | None = None,
) -> dict:
    """Run baseline vs policy across the assumption grid; report per-metric
    robustness of the policy's effect direction."""
    channelization_grid = channelization_grid or DEFAULT_CHANNELIZATION_GRID
    sigma_grid = sigma_grid or DEFAULT_SIGMA_GRID
    metrics = metrics or DEFAULT_METRICS

    points: list[dict] = []
    for c0 in channelization_grid:
        for sig in sigma_grid:
            cfg = base_cfg.model_copy(deep=True)
            if ticks is not None:
                cfg.ticks = ticks
            cfg.gambling = {
                **(cfg.gambling or {}),
                "channelization_low": 0.50, "channelization_high": 0.99,
                "channelization_start": c0, "spend_sigma": sig,
            }
            base = _final(cfg, None)
            pol = _final(cfg, policy_events)
            deltas = {m: round(pol.get(m, 0.0) - base.get(m, 0.0), 4) for m in metrics}
            points.append({"channelization_start": c0, "spend_sigma": sig, "deltas": deltas})

    robustness: dict[str, dict] = {}
    for m in metrics:
        signs = [np.sign(p["deltas"][m]) for p in points]
        pos = sum(1 for s in signs if s > 0)
        neg = sum(1 for s in signs if s < 0)
        direction = "up" if pos > neg else ("down" if neg > pos else "mixed")
        frac = max(pos, neg) / len(points) if points else 0.0
        robustness[m] = {
            "direction": direction,
            "robust_fraction": round(frac, 3),
            "robust": frac >= 0.999,
            "mean_delta": round(float(np.mean([p["deltas"][m] for p in points])), 4),
        }
    return {"n_points": len(points), "points": points, "robustness": robustness}


def robustness_statement(report: dict) -> list[str]:
    """Human-readable robustness lines for a report/UI."""
    lines = []
    for metric, r in report["robustness"].items():
        tag = "ROBUST" if r["robust"] else f"conditional ({int(r['robust_fraction']*100)}%)"
        lines.append(f"{metric}: {r['direction']} — {tag} (mean Δ {r['mean_delta']})")
    return lines
