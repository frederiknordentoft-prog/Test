"""Harm index — true vs. measured, and the channelization false positive.

The regulator only *measures* harm in the licensed market (ROFUS, treatment
numbers, licensed operators' data). When tightening pushes the friction-tolerant
tail offshore, those players — and their harm — leave the measurement apparatus:
measured harm falls (looks like success) while true harm, now concentrated
offshore where there is no ROFUS/limit/detection, rises. Reproducing that false
positive is the whole point of loop 1 (perspective §3). Offshore play carries a
higher harm coefficient; loss limits and AI-based RG detection reduce licensed
harm only.

This is a documented dashboard heuristic, not a validated harm measure.
"""
from __future__ import annotations

from simcore.gambling.config import GamblingConfig
from simcore.gambling.population import PlayerArrays


def compute_harm(gcfg: GamblingConfig, reg, results: dict[str, dict],
                 pop: PlayerArrays) -> dict[str, float]:
    licensed = sum(r["licensed_bsi"] for r in results.values())
    offshore = sum(r["offshore_bsi"] for r in results.values())

    # Licensed harm is dampened by loss limits and AI-based detection; offshore
    # has neither and a higher base coefficient.
    h_lic = (1.0
             * (1.0 - gcfg.loss_limit_harm_reduction * reg.loss_limits)
             * (1.0 - gcfg.rg_detection_harm_reduction * reg.rg_detection))
    h_off = gcfg.offshore_harm_coeff

    risk_load = float((pop.risk).mean())        # population risk intensity
    scale = gcfg.harm_scale
    true_h = risk_load * (licensed * h_lic + offshore * h_off) * scale / 100.0
    measured_h = risk_load * (licensed * h_lic) * scale / 100.0
    young_load = float(((pop.age < gcfg.young_age_threshold) * pop.risk).mean())
    young_h = young_load * (licensed * h_lic + offshore * h_off) * scale / 100.0

    return {
        "true_harm": round(true_h, 3),
        "measured_harm": round(measured_h, 3),
        "harm_gap": round(true_h - measured_h, 3),   # the hidden (offshore) harm
        "young_harm": round(young_h, 3),
    }
