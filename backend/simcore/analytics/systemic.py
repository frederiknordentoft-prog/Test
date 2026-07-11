"""Systemic risk score.

A deliberately simple, documented dashboard heuristic in [0, 100]:

    score = 100 * Σ wᵢ·cᵢ / Σ wᵢ

with six components cᵢ ∈ [0, 1]:

1. leverage        mean leverage of market participants / 2.5 (capped)
2. volatility      mean EWMA volatility / (5 × baseline volatility)
3. liquidity_depletion   1 − liquidity pool index
4. forced_sale_share     forced volume / total volume this tick
5. credit_tightness      the global credit-conditions index
6. stressed_share        share of living actors with stress > 0.6

Weights come from ``SimConfig.systemic_weights`` (default: equal). This score
is NOT a validated risk measure — it is a monitoring aid for comparing runs
and spotting regime shifts inside the simulation.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from simcore.engine.simulation import Simulation


def systemic_risk_score(sim: "Simulation", metrics: dict[str, float]) -> float:
    w = sim.config.systemic_weights
    sigma_base = float(np.mean([a.sigma_base for a in sim.market.assets.values()])) or 0.01
    components = {
        "leverage": min(metrics["mean_leverage"] / 2.5, 1.0),
        "volatility": min(metrics["mean_volatility"] / (5.0 * sigma_base), 1.0),
        "liquidity_depletion": float(np.clip(1.0 - metrics["liquidity_index"], 0.0, 1.0)),
        "forced_sale_share": float(np.clip(metrics["forced_volume_share"], 0.0, 1.0)),
        "credit_tightness": float(np.clip(metrics["credit_tightness"], 0.0, 1.0)),
        "stressed_share": float(np.clip(metrics["stressed_share"], 0.0, 1.0)),
    }
    weights = {k: getattr(w, k) for k in components}
    total_w = sum(weights.values()) or 1.0
    return 100.0 * sum(weights[k] * components[k] for k in components) / total_w
