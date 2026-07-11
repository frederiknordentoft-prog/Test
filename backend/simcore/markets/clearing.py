"""Batch call auction — one clearing per asset per tick.

Formulas are documented in docs/architecture.md §6. Actor size and market
power act through order quantity; forced flow (margin calls, bankruptcy
unwinds) is weighted up in the imbalance and fills with priority, and any
unfilled forced remainder rolls to the next tick with an escalating
multiplier — the raw material of liquidity spirals.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

import numpy as np

from simcore.models.actions import Action, ActionIntent
from simcore.models.config import MarketConfig

if TYPE_CHECKING:
    from simcore.agents.actor import Actor
    from simcore.engine.rng import RngHub
    from simcore.markets.asset import Asset, MarketState


@dataclass(slots=True)
class Trade:
    tick: int
    actor_id: int
    asset_id: str
    side: str          # buy / sell / short / cover
    qty: float
    price: float
    forced: bool


@dataclass(slots=True)
class _Order:
    actor: "Actor"
    qty: float          # signed: + buy, - sell
    forced: bool
    multiplier: float   # forced escalation multiplier
    side_label: str


class BatchAuction:
    def __init__(self, cfg: MarketConfig):
        self.cfg = cfg

    # ------------------------------------------------------------------ #
    def clear_asset(
        self,
        tick: int,
        asset: "Asset",
        orders: list[_Order],
        market: "MarketState",
        rng: np.random.Generator,
    ) -> list[Trade]:
        cfg = self.cfg
        buys = [o for o in orders if o.qty > 0]
        sells = [o for o in orders if o.qty < 0]
        B = sum(o.qty for o in buys)
        S_vol = sum(-o.qty for o in sells if not o.forced)
        S_forced_eff = sum(-o.qty * o.multiplier for o in sells if o.forced)
        S_plain = sum(-o.qty for o in sells)

        # imbalance & depth
        Q = B - S_vol - S_forced_eff
        depth = asset.depth_shares * market.liquidity_index / (1.0 + cfg.kappa_vol * asset.sigma)
        depth = max(depth, 1e-6)

        # price update (log space, bounded)
        ret = (
            cfg.impact_alpha * float(np.tanh(Q / depth))
            + cfg.sentiment_beta * market.sentiment_index * asset.sigma_base
            + float(rng.normal(0.0, cfg.noise_sigma))
        )
        new_price = max(asset.price * float(np.exp(ret)), cfg.price_floor)

        # spread
        gross = B + S_plain
        imb_share = abs(Q) / gross if gross > 0 else 0.0
        spread = cfg.spread_min + cfg.spread_c1 * asset.sigma + cfg.spread_c2 * imb_share
        p_buy = new_price * (1.0 + spread / 2.0)
        p_sell = new_price * (1.0 - spread / 2.0)

        # fills: minority side fills 100%; majority side pro-rata with pool absorption
        trades: list[Trade] = []
        if B >= S_plain:
            budget = S_plain + cfg.absorb_rho * depth
            fill_buy = self._fill_ratios(buys, budget, forced_first=True)
            fill_sell = {id(o): 1.0 for o in sells}
        else:
            budget = B + cfg.absorb_rho * depth
            fill_sell = self._fill_ratios(sells, budget, forced_first=True)
            fill_buy = {id(o): 1.0 for o in buys}

        realized_ret = float(np.log(new_price / asset.price)) if asset.price > 0 else 0.0
        forced_vol = 0.0
        total_vol = 0.0
        for o in orders:
            ratio = fill_buy[id(o)] if o.qty > 0 else fill_sell[id(o)]
            filled = o.qty * ratio
            if abs(filled) < 1e-12:
                continue
            exec_price = p_buy if filled > 0 else p_sell
            self._settle(o.actor, asset.asset_id, filled, exec_price)
            total_vol += abs(filled)
            if o.forced:
                forced_vol += abs(filled)
                self._roll_forced(o, filled, asset.asset_id)
            trades.append(
                Trade(tick, o.actor.id, asset.asset_id, o.side_label, abs(filled), exec_price, o.forced)
            )

        # asset state updates
        asset.record_price(new_price)
        lam = cfg.ewma_lambda
        asset.sigma = float(np.sqrt(lam * asset.sigma**2 + (1 - lam) * realized_ret**2))
        asset.spread = spread
        asset.volume = total_vol
        asset.forced_volume = forced_vol
        return trades

    # ------------------------------------------------------------------ #
    def _fill_ratios(self, side_orders: list[_Order], budget: float, forced_first: bool) -> dict[int, float]:
        """Pro-rata fill of the majority side; forced orders eat the budget first."""
        ratios: dict[int, float] = {}
        forced = [o for o in side_orders if o.forced]
        voluntary = [o for o in side_orders if not o.forced]
        forced_qty = sum(abs(o.qty) for o in forced)
        vol_qty = sum(abs(o.qty) for o in voluntary)
        remaining = budget
        f_ratio = 1.0 if forced_qty <= remaining else (remaining / forced_qty if forced_qty > 0 else 0.0)
        for o in forced:
            ratios[id(o)] = f_ratio
        remaining = max(0.0, remaining - forced_qty * f_ratio)
        v_ratio = 1.0 if vol_qty <= remaining else (remaining / vol_qty if vol_qty > 0 else 0.0)
        for o in voluntary:
            ratios[id(o)] = v_ratio
        return ratios

    def _settle(self, actor: "Actor", asset_id: str, filled_qty: float, price: float) -> None:
        """Update cash / positions / margin debt; track average entry price."""
        s = actor.state
        pos_before = s.positions.get(asset_id, 0.0)
        if filled_qty > 0:
            cost = filled_qty * price
            pay_cash = min(s.cash, cost)
            s.cash -= pay_cash
            shortfall = cost - pay_cash
            if shortfall > 0:
                s.margin_debt += shortfall  # leverage (only reachable for can_leverage actors)
        else:
            proceeds = -filled_qty * price
            repay = min(s.margin_debt, proceeds)
            s.margin_debt -= repay
            s.cash += proceeds - repay
        new_pos = pos_before + filled_qty
        if abs(new_pos) < 1e-9:
            new_pos = 0.0
            s.internal_state.setdefault("entry_price", {}).pop(asset_id, None)
        s.positions[asset_id] = new_pos

        # average entry price while increasing a long (rules' stop-loss anchor)
        entries = s.internal_state.setdefault("entry_price", {})
        if filled_qty > 0 and new_pos > 0:
            prev_qty = max(pos_before, 0.0)
            entries[asset_id] = (entries.get(asset_id, price) * prev_qty + filled_qty * price) / (
                prev_qty + filled_qty
            )

    def _roll_forced(self, order: _Order, filled: float, asset_id: str) -> None:
        s = order.actor.state
        outstanding = s.pending_forced.get(asset_id, 0.0)
        remaining = max(0.0, outstanding - abs(filled))
        if remaining > 1e-9:
            s.pending_forced[asset_id] = remaining
            s.forced_ticks += 1
        else:
            s.pending_forced.pop(asset_id, None)
            if not s.pending_forced:
                s.forced_ticks = 0

    # ------------------------------------------------------------------ #
    def build_orders(
        self,
        intents: list[ActionIntent],
        actors: list["Actor"],
        market: "MarketState",
    ) -> dict[str, list[_Order]]:
        """Convert market-domain intents into per-asset signed orders, enforcing
        feasibility hard limits (cash / margin / shorting rights)."""
        from simcore.markets.constraints import max_buy_qty, max_sell_qty

        cfg = self.cfg
        prices = market.prices()
        by_asset: dict[str, list[_Order]] = {aid: [] for aid in market.assets}
        for intent in intents:
            if intent.asset_id is None or intent.asset_id not in by_asset:
                continue
            actor = actors[intent.actor_id]
            if not actor.state.alive:
                continue
            price = prices[intent.asset_id]
            qty = float(intent.qty)
            if qty <= 1e-12:
                continue
            mult = 1.0
            if intent.action in (Action.BUY, Action.COVER):
                if not intent.forced:
                    qty = min(qty, max_buy_qty(actor, price, prices, cfg))
                signed = qty
            elif intent.action in (Action.SELL, Action.SHORT):
                if not intent.forced:
                    qty = min(qty, max_sell_qty(actor, intent.asset_id, price, prices, cfg))
                signed = -qty
                if intent.forced:
                    mult = cfg.forced_multiplier + cfg.forced_escalation * actor.state.forced_ticks
            else:
                continue
            if abs(signed) <= 1e-12:
                continue
            by_asset[intent.asset_id].append(
                _Order(actor, signed, intent.forced, mult, intent.action.value)
            )
        return by_asset

    def apply_liquidity_intents(
        self, intents: list[ActionIntent], actors: list["Actor"], market: "MarketState"
    ) -> None:
        for intent in intents:
            actor = actors[intent.actor_id]
            s = actor.state
            if intent.action == Action.PROVIDE_LIQUIDITY:
                amt = min(float(intent.qty), max(s.cash, 0.0))
                if amt > 0:
                    s.cash -= amt
                    s.provided_liquidity += amt
                    market.liquidity_pool += amt
            elif intent.action == Action.WITHDRAW_LIQUIDITY:
                amt = min(float(intent.qty), s.provided_liquidity)
                if amt > 0:
                    s.cash += amt
                    s.provided_liquidity -= amt
                    market.liquidity_pool = max(market.liquidity_pool - amt, 0.0)
