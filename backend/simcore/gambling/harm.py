"""Harm index — true vs. measured, computed at the player level.

The regulator only *measures* harm in the licensed market (ROFUS, treatment
numbers, licensed operators' data). Harm is computed per player as
risk × spend-exposure per channel, so the channelization false positive is
*emergent*: when tightening pushes the friction-tolerant, high-risk, high-spend
tail offshore, those specific players — and their harm — leave the measurement
apparatus. Measured harm falls (looks like success) while true harm, now
concentrated offshore where there is no ROFUS/limit/detection, persists or
rises. (The previous aggregate formula produced the same signs as an arithmetic
identity — a critic finding; the player-level accounting makes it a mechanism.)

Offshore play carries a higher harm coefficient; loss limits and AI-based RG
detection reduce licensed harm only. ROFUS-registered players have licensed
play blocked upstream (in the choice model), so their exposure shifts to
offshore/outside — harm displacement, not harm deletion.

This is a documented dashboard heuristic, not a validated harm measure.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.config import GamblingConfig
from simcore.gambling.population import PlayerArrays


def compute_harm(gcfg: GamblingConfig, reg, results: dict[str, dict],
                 pop: PlayerArrays, market) -> dict[str, float]:
    # Licensed harm is dampened by loss limits and AI-based detection; offshore
    # has neither and a higher base coefficient.
    h_lic = (1.0
             * (1.0 - gcfg.loss_limit_harm_reduction * reg.loss_limits)
             * (1.0 - gcfg.rg_detection_harm_reduction * reg.rg_detection))
    h_off = gcfg.offshore_harm_coeff

    # Per-player monthly spend by channel (mio DKK): each track's potential is
    # distributed over players by budget-weight × their own choice probability.
    n = pop.n
    lic_spend = np.zeros(n)
    off_spend = np.zeros(n)
    for tid, tm in market.tracks.items():
        r = results.get(tid)
        if r is None or tm.last_lic_prob is None:
            continue
        w = tm.weights / max(float(tm.weights.sum()), 1e-12)
        pot = r.get("potential_bsi", r["total_bsi"])
        lic_spend += pot * w * tm.last_lic_prob
        off_spend += pot * w * tm.last_unl_prob

    scale = gcfg.harm_scale / 100.0
    true_pp = pop.risk * (lic_spend * h_lic + off_spend * h_off)
    measured_pp = pop.risk * (lic_spend * h_lic)          # only licensed play is seen
    young = pop.age < gcfg.young_age_threshold

    return {
        "true_harm": round(float(true_pp.sum()) * scale, 3),
        "measured_harm": round(float(measured_pp.sum()) * scale, 3),
        "harm_gap": round(float((true_pp - measured_pp).sum()) * scale, 3),
        "young_harm": round(float(true_pp[young].sum()) * scale, 3),
    }
