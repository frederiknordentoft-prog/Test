"""Feasibility constraints on trading intents.

Used softly by decision models (to avoid emitting impossible orders) and
enforced hard by the clearing engine. Buying power and short capacity follow
from the margin rules: post-trade equity ratio must stay >= initial_margin and
gross exposure <= max_leverage * wealth.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from simcore.models.config import MarketConfig

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


def max_buy_qty(actor: "Actor", price: float, prices: dict[str, float], mkt: MarketConfig) -> float:
    if price <= 0:
        return 0.0
    s = actor.state
    cash_qty = max(s.cash, 0.0) / price
    if not actor.can_leverage:
        return cash_qty
    w = s.wealth(prices)
    g = s.gross_exposure(prices)
    if w <= 0:
        return 0.0
    margin_cap = max(0.0, (w / mkt.initial_margin - g) / price)
    lev_cap = max(0.0, (mkt.max_leverage * w - g) / price)
    return max(cash_qty, min(margin_cap, lev_cap))


def max_sell_qty(actor: "Actor", asset_id: str, price: float, prices: dict[str, float], mkt: MarketConfig) -> float:
    """How much the actor can sell (long liquidation plus short capacity)."""
    if price <= 0:
        return 0.0
    s = actor.state
    pos = s.positions.get(asset_id, 0.0)
    long_qty = max(pos, 0.0)
    if not actor.can_short:
        return long_qty
    w = s.wealth(prices)
    g = s.gross_exposure(prices)
    if w <= 0:
        return long_qty
    short_cap = max(0.0, (w / mkt.initial_margin - g) / price)
    lev_cap = max(0.0, (mkt.max_leverage * w - g) / price)
    return long_qty + min(short_cap, lev_cap)
