"""Indicators: assemble the per-tick metrics dict the Recorder/API consume.

Every value here becomes a named series queryable through the generic
``GET /api/runs/{id}/metrics`` endpoint with zero endpoint changes. Etape 0
emits the headline market-size series (BSI per track + total) plus the sports
intensity and the (still static) channelization interval. Market share,
customer counts and the secondary KPIs (tax revenue, HHI, harm) are added in
later etaper as more series in this same dict.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig
from simcore.gambling.population import PlayerArrays, concentration


def compute_gambling_metrics(
    gcfg: GamblingConfig, tick: int, bsi_by_track: dict[str, float]
) -> dict[str, float]:
    """Build the metrics dict for one tick from the per-track monthly BSI."""
    metrics: dict[str, float] = {}
    total = 0.0
    for t in gcfg.tracks:
        bsi = float(bsi_by_track.get(t.track_id, 0.0))
        metrics[f"bsi_{t.track_id}"] = round(bsi, 3)
        total += bsi
    metrics["bsi_total"] = round(total, 3)
    metrics["bsi_competitive"] = round(
        sum(bsi_by_track.get(t.track_id, 0.0) for t in gcfg.tracks if t.competitive), 3
    )
    metrics["bsi_monopoly"] = round(
        sum(bsi_by_track.get(t.track_id, 0.0) for t in gcfg.tracks if not t.competitive), 3
    )
    metrics["sports_intensity"] = round(sports_intensity(tick, gcfg.calendar), 4)
    # Channelization is an interval; the point value is the current assumption
    # and is made dynamic in Etape 2. Low/high travel alongside for robustness.
    metrics["channelization"] = round(gcfg.channelization_start, 4)
    metrics["channelization_low"] = round(gcfg.channelization_low, 4)
    metrics["channelization_high"] = round(gcfg.channelization_high, 4)
    return metrics


def compute_population_metrics(
    pop: PlayerArrays, gcfg: GamblingConfig,
    customers: dict[str, float], player_total: np.ndarray,
) -> dict[str, float]:
    """Customer counts, income concentration and demographic shares. In Etape 1
    these are constant across ticks (the population is fixed); later etaper make
    them dynamic as players churn and escalate."""
    m: dict[str, float] = {}
    for tid in pop.track_ids:
        m[f"customers_{tid}"] = round(float(customers.get(tid, 0.0)), 0)
    m["customers_total"] = round(float(customers.get("_unique", 0.0)), 0)
    # Income concentration — the core diagnostic (must be robust to spend_sigma).
    m["top5pct_bsi_share"] = round(concentration(player_total, 0.05), 4)
    m["top1pct_bsi_share"] = round(concentration(player_total, 0.01), 4)
    m["mean_risk"] = round(float(pop.risk.mean()), 4)
    m["at_risk_share"] = round(float((pop.risk > 0.7).mean()), 4)
    m["young_share"] = round(float((pop.age < gcfg.young_age_threshold).mean()), 4)
    m["male_share"] = round(float(pop.male.mean()), 4)
    return m


def compute_market_metrics(gcfg: GamblingConfig, results: dict[str, dict]) -> dict[str, float]:
    """Market share, channelization and concentration from the per-track
    AttractionMarket results. This is the headline output: market size, market
    share (incl. Danske Spil's) and where customers leak to."""
    m: dict[str, float] = {}
    ds_ids = {o.operator_id for o in gcfg.operators if o.is_ds}
    tot_licensed = 0.0
    tot_offshore = 0.0
    per_op_bsi: dict[str, float] = {}

    tot_potential = 0.0
    for tid, r in results.items():
        m[f"channelization_{tid}"] = round(r["channelization"], 4)
        m[f"offshore_bsi_{tid}"] = round(r["offshore_bsi"], 3)
        m[f"market_size_{tid}"] = round(r["total_bsi"], 3)
        m[f"participation_{tid}"] = round(r["participation"], 4)
        m[f"hhi_{tid}"] = round(r["hhi"], 1)
        in_market = max(r["participation"], 1e-12)
        ds_share = sum(s for oid, s in r["shares"].items() if oid in ds_ids) / in_market
        m[f"ds_share_{tid}"] = round(ds_share, 4)
        tot_licensed += r["licensed_bsi"]
        tot_offshore += r["offshore_bsi"]
        tot_potential += r.get("potential_bsi", r["total_bsi"])
        for opid, bsi in r["operator_bsi"].items():
            per_op_bsi[opid] = per_op_bsi.get(opid, 0.0) + bsi

    total = tot_licensed + tot_offshore
    denom = max(total, 1e-9)
    # Demand elasticity made visible: how much of the potential is wagered at
    # all (the outside option is the rest). Tightening can now shrink this.
    m["participation"] = round(total / max(tot_potential, 1e-9), 4)
    m["channelization"] = round(tot_licensed / denom, 4)   # overall (dynamic; overrides the static value)
    m["offshore_share"] = round(tot_offshore / denom, 4)
    m["market_size_total"] = round(total, 3)               # incl. offshore leakage

    ds_bsi = sum(per_op_bsi.get(i, 0.0) for i in ds_ids)
    m["ds_bsi_total"] = round(ds_bsi, 3)
    m["ds_share_total"] = round(ds_bsi / denom, 4)          # Danske Spil market share
    for opid, bsi in per_op_bsi.items():
        m[f"bsi_op_{opid}"] = round(bsi, 3)
        m[f"share_op_{opid}"] = round(bsi / denom, 4)

    # DS's share of the *liberalized, licensed* market (casino + sports) — the
    # segment where DS actually competes; the total share is diluted by the
    # protected monopoly block.
    comp_tracks = {t.track_id for t in gcfg.tracks if t.competitive}
    lib_licensed = sum(results[tid]["licensed_bsi"] for tid in comp_tracks if tid in results)
    ds_lib = 0.0
    for tid in comp_tracks:
        r = results.get(tid)
        if not r:
            continue
        ds_lib += sum(b for oid, b in r["operator_bsi"].items() if oid in ds_ids)
    m["ds_share_liberalized"] = round(ds_lib / max(lib_licensed, 1e-9), 4)
    return m


def compute_ai_entry_metrics(gcfg: GamblingConfig, ai, entry, market) -> dict[str, float]:
    """AI diffusion + entry/exit state: the frontier, per-operator capability,
    the engagement multiplier, and the count of active operators / entrants."""
    m: dict[str, float] = {}
    m["ai_frontier"] = round(float(ai.frontier), 4)
    m["ai_best_cap"] = round(float(ai.best_cap()), 4)
    m["ai_engagement"] = round(float(ai.engagement_multiplier()), 4)
    for oid, cap in ai.cap.items():
        m[f"ai_cap_{oid}"] = round(float(cap), 4)
    m["n_operators"] = float(sum(1 for o in market.operators if o.licensed))
    # Real licences represented: the named licensed agents plus the ~35 full-
    # scale licence holders the aggregated long-tail agent stands for
    # (Spillemyndigheden's register lists 54 holders incl. limited licences).
    named = sum(1 for o in market.operators if o.licensed and o.operator_id != "longtail")
    longtail_active = any(o.operator_id == "longtail" for o in market.operators)
    m["n_licensees"] = float(named + (gcfg.longtail_licensees if longtail_active else 0))
    m["n_entrants"] = float(len(entry.entered))
    m["n_exits"] = float(len(entry.exited))
    return m


def compute_stakeholder_metrics(reg, udlodning: float, political) -> dict[str, float]:
    """Policy state + the udlodning loop output."""
    return {
        "reg_friction": round(float(reg.rg_friction), 4),
        "ad_ban": round(float(reg.ad_ban), 4),
        "enforcement": round(float(reg.enforcement), 4),
        "tax_add": round(float(reg.tax_add), 4),
        "loss_limits": round(float(reg.loss_limits), 4),
        "rg_detection": round(float(reg.rg_detection), 4),
        "monopoly_scope": round(float(reg.monopoly_scope), 4),
        "udlodning": round(float(udlodning), 3),
        "political_packages": float(political.packages),
    }


def compute_revenue(gcfg: GamblingConfig, reg, results: dict[str, dict]) -> dict[str, float]:
    """State gambling-tax revenue from the licensed BSI (28% on the competitive
    segment + any political tax add). The core policy trade-off: tightening can
    shrink licensed BSI and thus revenue (dossier §11.1)."""
    rev = 0.0
    for t in gcfg.tracks:
        r = results.get(t.track_id)
        if not r:
            continue
        rate = t.tax_rate + (reg.tax_add if t.competitive else 0.0)
        rev += r["licensed_bsi"] * max(0.0, rate)
    return {"state_revenue": round(rev, 3)}
