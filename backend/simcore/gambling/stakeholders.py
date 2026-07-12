"""Stakeholders and the balancing/reinforcing loops (perspective §3).

- ``RegulationState`` is the policy vector (RG friction, ad ban, offshore
  enforcement, extra tax, loss limits, AI-based RG detection). It maps to
  per-operator choice-utility modifiers, so tightening lowers licensed appeal
  (and pushes the tail offshore) while enforcement lowers offshore appeal.
- ``Regulator`` (Spillemyndigheden) reacts to *measured* harm and offshore
  alarm; its offshore enforcement **decays** each tick (mirror sites / captured
  subdomains) unless renewed — so Denmark cannot block its way out of the
  problem.
- ``PoliticalAgent`` (Skatteministeriet/Folketinget) reacts to *visible*
  (measured, delayed 12-24 months) harm and passes discrete tightening packages
  — the delay produces overshoot/oscillation (loop 2).
- The **udlodning loop** (loop 3): Danske Spil profit funds sport/culture, which
  raises the political tightening threshold (stakeholder resistance).
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from simcore.gambling.config import GamblingConfig


@dataclass
class RegulationState:
    rg_friction: float = 0.0    # licensed friction (utility penalty)
    ad_ban: float = 0.0         # 0..1 licensed marketing/acquisition loss
    enforcement: float = 0.0    # 0..1 offshore blocking (decays)
    tax_add: float = 0.0        # extra tax fraction -> licensed RTP down
    loss_limits: float = 0.0    # 0..1 (reduces harm and licensed appeal)
    rg_detection: float = 0.0   # 0..1 AI-based harm detection (dual-use)
    monopoly_scope: float = 1.0 # 1 = intact monopoly, <1 = liberalized
    licensed_bonus: float = 0.0 # licensed appeal bonus (e.g. crash games legalized onshore)

    def appeal_mods(self, market) -> dict[str, np.ndarray]:
        """Per-track, per-operator choice-utility modifiers from the current
        policy. Licensed operators lose appeal from friction/ad-ban/tax/limits;
        offshore/prediction lose appeal from enforcement."""
        licensed_penalty = (0.8 * self.rg_friction + 0.9 * self.ad_ban
                            + 2.0 * self.tax_add + 0.5 * self.loss_limits
                            - self.licensed_bonus)
        offshore_penalty = 1.4 * self.enforcement
        mods: dict[str, np.ndarray] = {}
        for tid, tm in market.tracks.items():
            arr = np.array([-licensed_penalty if o.licensed else -offshore_penalty
                            for o in tm.operators])
            mods[tid] = arr
        return mods


class Regulator:
    """Spillemyndigheden: reacts to measured harm and offshore alarm; enforcement
    decays over time."""

    def __init__(self, gcfg: GamblingConfig):
        self.gcfg = gcfg

    def update(self, reg: RegulationState, measured_harm: float, offshore_share: float) -> None:
        g = self.gcfg
        # Enforcement decays every tick (mirror sites) regardless of action.
        reg.enforcement *= (1.0 - g.enforcement_decay)
        if measured_harm > g.reg_harm_threshold:
            reg.rg_friction = min(3.0, reg.rg_friction + g.reg_step)
            reg.ad_ban = min(1.0, reg.ad_ban + 0.5 * g.reg_step)
        if offshore_share > g.reg_offshore_alarm:
            # Renew enforcement (fights the decay) when leakage is alarming.
            reg.enforcement = min(1.0, reg.enforcement + 2.0 * g.reg_step)


class PoliticalAgent:
    """Skatteministeriet/Folketinget: reacts to visible (delayed) harm with big
    discrete tightening packages, dampened by the udlodning coalition."""

    def __init__(self, gcfg: GamblingConfig):
        self.gcfg = gcfg
        self._cooldown = 0
        self.packages = 0

    def update(self, reg: RegulationState, measured_history: list[float],
               tick: int, udlodning: float, udlodning_baseline: float) -> bool:
        g = self.gcfg
        if self._cooldown > 0:
            self._cooldown -= 1
            return False
        if len(measured_history) <= g.political_delay:
            return False
        visible = measured_history[-1 - g.political_delay]     # 12-24 months ago
        # The udlodning coalition (a standing interest, scaled by its size) raises
        # the effective tightening threshold — resistance to stramninger.
        resistance = g.udlodning_resistance * (udlodning / max(udlodning_baseline, 1e-9))
        threshold = g.political_threshold * (1.0 + resistance)
        if visible > threshold:
            reg.tax_add = min(1.0, reg.tax_add + g.political_tax_step)
            reg.loss_limits = min(1.0, reg.loss_limits + g.political_limit_step)
            reg.ad_ban = min(1.0, reg.ad_ban + 0.3)
            self._cooldown = g.political_cooldown
            self.packages += 1
            return True
        return False


def udlodning_from(gcfg: GamblingConfig, ds_bsi_monthly: float) -> float:
    """Monthly udlodning (distribution funds) from Danske Spil profit."""
    return ds_bsi_monthly * gcfg.ds_profit_margin * gcfg.udlodning_ratio
