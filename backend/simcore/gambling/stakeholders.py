"""Stakeholders and the balancing/reinforcing loops (perspective §3).

- ``RegulationState`` is the policy vector (RG friction, ad ban, bonus
  restrictions, offshore enforcement, extra tax, loss limits, AI-based RG
  detection). It is consumed by ``TrackMarket._policy_attrs``, which maps each
  lever onto the operator *attributes* it actually touches (marketing under an
  ad ban, bonuses under bonus restrictions, friction, RTP under tax
  pass-through) — the players' per-segment betas then mediate the response, so
  heterogeneous effects (Betano vs DS under an ad ban; the tail vs the breadth
  under friction) emerge instead of being uniform.
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

from simcore.gambling.config import GamblingConfig


@dataclass
class RegulationState:
    rg_friction: float = 0.0        # licensed friction add-on (MitID, limits UX, cooldowns)
    ad_ban: float = 0.0             # 0..1 fraction of licensed marketing switched off
    bonus_restriction: float = 0.0  # 0..1 fraction of licensed bonus value banned (β3 lever)
    enforcement: float = 0.0        # 0..1 offshore blocking (decays; raises unlicensed friction)
    tax_add: float = 0.0            # extra tax fraction -> licensed RTP down (pass-through)
    loss_limits: float = 0.0        # 0..1 (reduces harm; raises licensed protection)
    rg_detection: float = 0.0       # 0..1 AI-based harm detection (dual-use)
    monopoly_scope: float = 1.0     # 1 = intact monopoly, <1 = liberalized
    licensed_bonus: float = 0.0     # licensed product boost (e.g. crash games legalized onshore)
    prediction_boost: float = 0.0   # fintech-loophole state: >0 = prediction markets distributed


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
            reg.bonus_restriction = min(1.0, reg.bonus_restriction + 0.3)
            self._cooldown = g.political_cooldown
            self.packages += 1
            return True
        return False


def udlodning_from(gcfg: GamblingConfig, ds_bsi_monthly: float) -> float:
    """Monthly udlodning (distribution funds) from Danske Spil profit."""
    return ds_bsi_monthly * gcfg.ds_profit_margin * gcfg.udlodning_ratio
