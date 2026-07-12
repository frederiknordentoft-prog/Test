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
