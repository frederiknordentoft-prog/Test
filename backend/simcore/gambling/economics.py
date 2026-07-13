"""Operator business models — competitor & industry intelligence.

Until now operators had attributes and a budget-reallocation rule but no P&L:
they could max every lever for free. This module gives each operator a monthly
income statement calibrated to real annual-report ratios, so commercial
intensity has a *cost* and aggressive acquisition is a *bet* (spend now, earn
later) that can run a challenger out of cash.

Calibrated to sourced figures (see params.yaml / calibration):
- Marketing spend ≈ 20 % of GGR at reach 0.6 (Flutter 22.8 %, Kindred ~19 %,
  Evoke ~25 %).
- Bonus/promo cost ≈ 18 % of GGR at bonus 0.6 (RSI ~17 % ad+promo; NGR/GGR
  bridge 8-40 %).
- Operating (platform/staff/compliance) ≈ 18 % of GGR.
- Gambling tax: 28 % of GGR on the competitive segment, 15 % on the monopoly.
- Result: a competitive operator nets ~15-25 % EBIT margin (Betsson 23 %,
  Entain online 25 %, Evoke 18 %); the monopoly nets more (little marketing/
  bonus, ~39 % blended for Danske Spil).

Acquisition economics (DraftKings cohort: CAC ~$371, LTV ~$2,546, payback
~18 months) are represented at the aggregate: a high-burn challenger's marketing
outruns its early revenue, drawing down the cash runway it entered with; if the
runway is exhausted it must pull back (or, for non-DS, exit).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from simcore.gambling.config import GamblingConfig


@dataclass
class OperatorEconomics:
    gcfg: GamblingConfig
    cash: dict[str, float] = field(default_factory=dict)      # cumulative cash (mio DKK)
    burn_months: dict[str, int] = field(default_factory=dict)  # consecutive months cash < 0
    last: dict[str, dict] = field(default_factory=dict)        # last P&L per operator

    def _tax_rate(self, op, results) -> float:
        # weight the operator's tracks by where it earns
        num = den = 0.0
        for tid, r in results.items():
            b = r["operator_bsi"].get(op.operator_id, 0.0)
            if b <= 0:
                continue
            track = self.gcfg.track(tid)
            num += b * track.tax_rate
            den += b
        return num / den if den else 0.28

    def step(self, results: dict[str, dict], market, reg=None) -> dict[str, dict]:
        """Compute one month's P&L for every operator from its BSI + attributes."""
        g = self.gcfg
        pnl: dict[str, dict] = {}
        for op in market.operators:
            ggr = sum(r["operator_bsi"].get(op.operator_id, 0.0) for r in results.values())
            if ggr <= 0 and op.operator_id not in self.cash:
                continue
            tax = ggr * self._tax_rate(op, results)
            # Monopoly needs little marketing/bonus; competitive operators pay for reach.
            mkt_factor = 0.15 if op.kind == "ds_monopoly" else 1.0
            bonus_eff = op.bonus * (1.0 - (reg.bonus_restriction if reg else 0.0))
            mkt_eff = op.marketing_reach * (1.0 - (reg.ad_ban if reg else 0.0))
            marketing = g.econ_marketing_ratio * mkt_eff * mkt_factor * ggr
            bonus = g.econ_bonus_ratio * bonus_eff * ggr
            opex = g.econ_opex_ratio * ggr
            ebit = ggr - tax - marketing - bonus - opex
            row = {
                "ggr": round(ggr, 3), "tax": round(tax, 3), "marketing": round(marketing, 3),
                "bonus": round(bonus, 3), "opex": round(opex, 3), "ebit": round(ebit, 3),
                "ebit_margin": round(ebit / ggr, 4) if ggr > 0 else 0.0,
            }
            self.cash[op.operator_id] = self.cash.get(op.operator_id, 0.0) + ebit
            row["cash"] = round(self.cash[op.operator_id], 1)
            self.burn_months[op.operator_id] = (
                self.burn_months.get(op.operator_id, 0) + 1 if self.cash[op.operator_id] < 0 else 0)
            pnl[op.operator_id] = row
        self.last = pnl
        return pnl

    def register_runway(self, operator_id: str, runway: float) -> None:
        """An entrant arrives with a cash runway (its raised capital) to fund the
        acquisition burn before revenue catches up."""
        self.cash.setdefault(operator_id, runway)
        self.burn_months.setdefault(operator_id, 0)

    def drop(self, operator_id: str) -> None:
        self.cash.pop(operator_id, None)
        self.burn_months.pop(operator_id, None)
        self.last.pop(operator_id, None)

    def cash_exhausted(self, operator_id: str) -> bool:
        """A challenger that has burned negative cash past its runway for longer
        than the grace period is financially unsustainable."""
        return (self.cash.get(operator_id, 0.0) < -self.gcfg.econ_runway
                and self.burn_months.get(operator_id, 0) >= self.gcfg.econ_burn_grace)
