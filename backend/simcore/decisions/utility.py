"""Utility-based trader: CRRA mean-variance portfolio target.

Optimal risky weight per asset  w* = (E[r] - r_f) / (γ σ²), γ rising as risk
tolerance falls. The actor rebalances toward the largest gap between target and
current weight when the gap exceeds its rebalancing band. The gap itself is the
dominant driver, so the explanation exposes the actual utility computation.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.stochastic import explanation, gate, size_multiplier
from simcore.decisions.heuristics import portfolio_drivers
from simcore.markets.constraints import max_buy_qty, max_sell_qty
from simcore.models.actions import Action, ActionIntent, Decision, Domain, Driver

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


class UtilityModel:
    name = "utility"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        t = actor.traits
        s = actor.state
        wealth = max(obs.own_wealth, 1e-9)
        gamma = 2.0 + 6.0 * (1.0 - t.risk_tolerance)
        w_cap = min(1.0, 0.3 + t.risk_tolerance)
        stress_shrink = 1.0 - 0.6 * s.stress

        best: tuple[str, float, float] | None = None  # asset, gap, target
        for a in ctx.asset_ids:
            price = obs.prices.get(a, 0.0)
            if price <= 0:
                continue
            er = s.expected_returns.get(a, 0.0)
            sigma = max(s.expected_risks.get(a, obs.volatility.get(a, 0.01)), 1e-3)
            w_star = (er - obs.risk_free_rate) / (gamma * sigma * sigma)
            lo = -w_cap if actor.can_short else 0.0
            w_star = float(np.clip(w_star * stress_shrink, lo, w_cap))
            w_cur = s.positions.get(a, 0.0) * price / wealth
            gap = w_star - w_cur
            if best is None or abs(gap) > abs(best[1]):
                best = (a, gap, w_star)
        if best is None:
            return Decision(intents=[])

        a, gap, w_star = best
        band = 0.04 + 0.08 * t.patience
        drivers = [
            Driver("portfolio_gap", float(np.tanh(3.0 * gap)), 1.2),
            Driver("target_weight", w_star, 0.2),
        ] + portfolio_drivers(actor, obs)
        fired, p, z = gate(actor, drivers, threshold=band)
        expl = explanation(self.name, drivers, p, actor, z)

        intents: list[ActionIntent] = []
        price = obs.prices[a]
        if fired and abs(gap) > band:
            qty = abs(gap) * wealth / price * 0.5 * (0.5 + size_multiplier(actor, z, selling=gap < 0) / 1.5)
            pos = s.positions.get(a, 0.0)
            if gap > 0:
                if pos < 0:
                    intents.append(ActionIntent(actor.id, Action.COVER, Domain.MARKET, a, min(qty, -pos)))
                else:
                    qty = min(qty, max_buy_qty(actor, price, obs.prices, ctx.market))
                    if qty > 1e-9:
                        intents.append(ActionIntent(actor.id, Action.BUY, Domain.MARKET, a, qty))
            else:
                qty = min(qty, max_sell_qty(actor, a, price, obs.prices, ctx.market))
                if qty > 1e-9:
                    action = Action.SELL if pos > 0 else Action.SHORT
                    if actor.can_short or pos > 0:
                        intents.append(ActionIntent(actor.id, action, Domain.MARKET, a, qty))

        # liquidity management mirrors the rule-based habit
        if s.stress > 0.75 and s.provided_liquidity > 0:
            intents.append(ActionIntent(actor.id, Action.WITHDRAW_LIQUIDITY, Domain.MARKET, None, s.provided_liquidity))
        elif s.stress < 0.15 and s.cash > 0.4 * wealth and s.provided_liquidity < 0.05 * wealth:
            intents.append(ActionIntent(actor.id, Action.PROVIDE_LIQUIDITY, Domain.MARKET, None, 0.04 * wealth))

        return Decision(intents=intents, explanation=expl)
