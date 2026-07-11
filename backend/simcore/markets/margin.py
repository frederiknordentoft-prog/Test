"""Margin engine: converts margin breaches into forced sell/cover intents.

Runs before intent collection each tick. Cascades are emergent: forced sales
depress the clearing price, which lowers equity ratios elsewhere, which
triggers the next round of margin calls next tick.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from simcore.models.actions import Action, ActionIntent, Domain

if TYPE_CHECKING:
    from simcore.agents.actor import Actor
    from simcore.markets.asset import MarketState


class MarginEngine:
    def generate_forced_intents(
        self, actors: list["Actor"], market: "MarketState"
    ) -> tuple[list[ActionIntent], int]:
        prices = market.prices()
        intents: list[ActionIntent] = []
        calls = 0
        for actor in actors:
            s = actor.state
            if not s.alive or not actor.market_participant:
                continue
            has_short = any(q < 0 for q in s.positions.values())
            if s.margin_debt <= 0 and not has_short:
                continue
            gross = s.gross_exposure(prices)
            if gross <= 1e-9:
                continue
            eq_ratio = s.equity_ratio(prices)
            if eq_ratio >= market.maintenance_margin:
                continue
            calls += 1
            wealth = s.wealth(prices)
            target_gross = max(wealth, 0.0) / market.initial_margin
            excess = gross - target_gross
            if wealth <= 0:
                excess = gross  # wiped out: full liquidation
            for asset_id, pos in list(s.positions.items()):
                if abs(pos) < 1e-12:
                    continue
                price = prices.get(asset_id, 0.0)
                if price <= 0:
                    continue
                share = abs(pos) * price / gross
                qty = min(excess * share / price, abs(pos))
                if qty <= 1e-9:
                    continue
                s.pending_forced[asset_id] = qty
                if pos > 0:
                    intents.append(
                        ActionIntent(actor.id, Action.SELL, Domain.MARKET, asset_id, qty, forced=True)
                    )
                else:
                    intents.append(
                        ActionIntent(actor.id, Action.COVER, Domain.MARKET, asset_id, qty, forced=True)
                    )
        market.margin_calls_tick = calls
        market.margin_calls_total += calls
        return intents, calls

    @staticmethod
    def bankruptcy_unwind(actor: "Actor", market: "MarketState") -> list[ActionIntent]:
        """Forced liquidation of everything a failed actor still holds."""
        intents: list[ActionIntent] = []
        for asset_id, pos in list(actor.state.positions.items()):
            if abs(pos) < 1e-12:
                continue
            actor.state.pending_forced[asset_id] = abs(pos)
            action = Action.SELL if pos > 0 else Action.COVER
            intents.append(
                ActionIntent(actor.id, action, Domain.MARKET, asset_id, abs(pos), forced=True)
            )
        return intents

    @staticmethod
    def accrue_margin_interest(actors: list["Actor"], market: "MarketState") -> None:
        rate = market.risk_free_rate + 0.0003 + 0.0006 * market.credit_tightness
        for actor in actors:
            s = actor.state
            if s.margin_debt > 0:
                s.margin_debt *= 1.0 + rate
