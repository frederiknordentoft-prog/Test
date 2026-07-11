"""Per-tick indicator computation (vectorized over the population arrays)."""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from simcore.engine.simulation import Simulation


def gini(values: np.ndarray) -> float:
    v = np.sort(np.clip(values, 0.0, None))
    n = v.size
    if n == 0 or v.sum() <= 0:
        return 0.0
    cum = np.cumsum(v)
    return float((n + 1 - 2 * (cum / cum[-1]).sum()) / n)


def hhi(values: np.ndarray) -> float:
    v = np.clip(values, 0.0, None)
    total = v.sum()
    if total <= 0:
        return 0.0
    shares = v / total
    return float((shares**2).sum())


def compute_indicators(sim: "Simulation", econ_aggregates: dict | None) -> dict[str, float]:
    arrays = sim.arrays
    market = sim.market
    alive = arrays.alive
    mp = alive & arrays.is_market

    prices = market.prices()
    assets = list(market.assets.values())
    index = float(np.mean([a.price / a.initial_price for a in assets])) * 100.0
    peak = max(sim.internal.get("index_peak", index), index)
    sim.internal["index_peak"] = peak
    drawdown = 0.0 if peak <= 0 else 1.0 - index / peak

    total_volume = sum(a.volume for a in assets)
    forced_volume = sum(a.forced_volume for a in assets)
    wealth_alive = arrays.wealth[alive]
    lev_mp = arrays.leverage[mp] if mp.any() else np.array([0.0])

    fund_gap = [
        abs(a.price / a.fundamental - 1.0) for a in assets if a.fundamental > 1e-9
    ]

    metrics: dict[str, float] = {
        "price_index": index,
        "drawdown": drawdown,
        "mean_volatility": float(np.mean([a.sigma for a in assets])),
        "mean_spread": float(np.mean([a.spread for a in assets])),
        "total_volume": total_volume,
        "forced_volume_share": forced_volume / total_volume if total_volume > 0 else 0.0,
        "liquidity_index": market.liquidity_index,
        "wealth_gini": gini(wealth_alive),
        "wealth_hhi": hhi(wealth_alive),
        "mean_leverage": float(np.mean(lev_mp)),
        "p95_leverage": float(np.percentile(lev_mp, 95)) if lev_mp.size else 0.0,
        "mean_sentiment": float(np.mean(arrays.sentiment[alive])) if alive.any() else 0.0,
        "mean_stress": float(np.mean(arrays.stress[alive])) if alive.any() else 0.0,
        "stressed_share": float(np.mean(arrays.stress[alive] > 0.6)) if alive.any() else 0.0,
        "below_survival_share": float(
            np.mean(arrays.wealth[alive] < arrays.survival_wealth[alive])
        ) if alive.any() else 0.0,
        "bankruptcies_total": float((~arrays.alive).sum()),
        "margin_calls": float(market.margin_calls_tick),
        "margin_calls_total": float(market.margin_calls_total),
        "defaults_total": float(sim.credit.defaults_total),
        "credit_tightness": market.credit_tightness,
        "risk_free_rate": market.risk_free_rate,
        "price_vs_fundamental_gap": float(np.mean(fund_gap)) if fund_gap else 0.0,
        "supplier_dependency_hhi": _supplier_dependency(sim),
    }
    if econ_aggregates:
        metrics["employment_index"] = econ_aggregates.get("employment_index", 1.0)
        metrics["avg_firm_price"] = econ_aggregates.get("avg_firm_price", 0.0)
        metrics["total_production"] = econ_aggregates.get("total_production", 0.0)
        metrics["total_sales_value"] = econ_aggregates.get("total_sales_value", 0.0)

    # sentiment per main group
    for code, name in [(0, "retail"), (1, "institutional"), (2, "hedge_fund")]:
        mask = alive & (arrays.type_code == code)
        metrics[f"sentiment_{name}"] = float(np.mean(arrays.sentiment[mask])) if mask.any() else 0.0

    return metrics


def _supplier_dependency(sim: "Simulation") -> float:
    """Mean HHI of firms' supplier-edge strengths: 1.0 = single-supplier firms."""
    g = sim.net.layers.get("supplier")
    if g is None:
        return 0.0
    hhis = []
    for firm in sim.goods.firms if sim.goods else []:
        if not firm.state.alive:
            continue
        strengths = np.array(
            [g.edges[firm.id, s].get("strength", 0.5) for s in g.neighbors(firm.id)]
        )
        if strengths.size == 0:
            hhis.append(1.0)
            continue
        shares = strengths / strengths.sum()
        hhis.append(float((shares**2).sum()))
    return float(np.mean(hhis)) if hhis else 0.0
