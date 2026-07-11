"""Heuristic trading models: momentum, mean-reversion/anchoring, imitation,
fundamentalist value. All share the driver→gate→size core; they differ only in
which drivers they produce and how heavily traits weight them.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.stochastic import combine, explanation, gate, size_multiplier
from simcore.markets.constraints import max_buy_qty, max_sell_qty
from simcore.models.actions import Action, ActionIntent, Decision, Domain, Driver

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


def _tanh(x: float) -> float:
    return math.tanh(x)


def portfolio_drivers(actor: "Actor", obs: Observation) -> list[Driver]:
    """Drivers shared by all market models: stress-driven de-risking,
    survival pressure and aggregated news sentiment."""
    t = actor.traits
    s = actor.state
    loss_norm = (t.loss_aversion - 1.0) / 4.0
    out = [Driver("stress_derisk", -s.stress, 0.5 * (loss_norm + 0.3))]
    if s.initial_wealth > 0 and obs.own_wealth < 1.25 * t.survival_threshold * s.initial_wealth:
        out.append(Driver("survival_pressure", -1.0, 0.8))
    push = 0.0
    for sig in obs.signals:
        push += sig.sentiment_hint * sig.credibility
    if push != 0.0:
        out.append(Driver("news_sentiment", float(np.clip(push, -1.5, 1.5)), 0.35 + 0.35 * t.herd_tendency))
    return out


def build_trade_decision(
    model_name: str,
    actor: "Actor",
    obs: Observation,
    ctx: DecisionContext,
    asset_drivers_fn,
) -> Decision:
    """Evaluate drivers per asset, act on the strongest signal."""
    shared = portfolio_drivers(actor, obs)
    best: tuple[str, float, list[Driver]] | None = None
    for a in ctx.asset_ids:
        price = obs.prices.get(a, 0.0)
        if price <= 0:
            continue
        drivers = asset_drivers_fn(actor, obs, a) + shared
        z = combine(drivers)
        if best is None or abs(z) > abs(best[1]):
            best = (a, z, drivers)
    if best is None:
        return Decision(intents=[])
    asset_id, _, drivers = best
    fired, p, z = gate(actor, drivers)
    expl = explanation(model_name, drivers, p, actor, z)
    if not fired:
        return Decision(intents=[], explanation=expl)

    price = obs.prices[asset_id]
    prices = obs.prices
    qty = actor.base_order_qty(price, obs.own_wealth) * size_multiplier(actor, z, selling=z < 0)
    pos = actor.state.positions.get(asset_id, 0.0)
    intents: list[ActionIntent] = []
    if z > 0:
        if pos < 0:  # covering a short first
            cover = min(qty, -pos)
            intents.append(ActionIntent(actor.id, Action.COVER, Domain.MARKET, asset_id, cover))
        else:
            qty = min(qty, max_buy_qty(actor, price, prices, ctx.market))
            if qty > 1e-9:
                intents.append(ActionIntent(actor.id, Action.BUY, Domain.MARKET, asset_id, qty))
    else:
        cap = max_sell_qty(actor, asset_id, price, prices, ctx.market)
        qty = min(qty, cap)
        if qty > 1e-9:
            action = Action.SELL if pos > 0 else Action.SHORT
            if not actor.can_short and pos <= 0:
                qty = 0.0
            if qty > 1e-9:
                intents.append(ActionIntent(actor.id, action, Domain.MARKET, asset_id, qty))
    return Decision(intents=intents, explanation=expl)


class MomentumModel:
    name = "momentum"

    def asset_drivers(self, actor: "Actor", obs: Observation, a: str) -> list[Driver]:
        t = actor.traits
        vol = max(obs.volatility.get(a, 0.01), 1e-4)
        mom = obs.momentum.get(a, 0.0)
        r1 = obs.returns_1.get(a, 0.0)
        return [
            Driver("momentum", _tanh(0.8 * mom / (vol * math.sqrt(10.0))), 0.9),
            Driver("recency", _tanh(0.5 * r1 / vol), 0.4),
            Driver("peer_flow", obs.peer_net_flow, 0.6 * t.herd_tendency),
            Driver("own_sentiment", actor.state.sentiment, 0.3),
        ]

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        return build_trade_decision(self.name, actor, obs, ctx, self.asset_drivers)


class MeanReversionModel:
    """Anchoring / mean reversion: trades the gap to a trailing moving average."""

    name = "meanrev"

    def asset_drivers(self, actor: "Actor", obs: Observation, a: str) -> list[Driver]:
        t = actor.traits
        price = max(obs.prices.get(a, 1e-9), 1e-9)
        anchor = obs.ma_anchor.get(a, price)
        vol = max(obs.volatility.get(a, 0.01), 1e-4)
        mom = obs.momentum.get(a, 0.0)
        return [
            Driver("anchor_gap", _tanh(8.0 * (anchor / price - 1.0)), 1.0),
            Driver("overextension", -_tanh(0.6 * mom / (vol * math.sqrt(10.0))), 0.4),
            Driver("peer_flow", obs.peer_net_flow, 0.2 * t.herd_tendency),
            Driver("own_sentiment", actor.state.sentiment, 0.2),
        ]

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        return build_trade_decision(self.name, actor, obs, ctx, self.asset_drivers)


class ValueModel:
    """Fundamentalist: trades the gap between perceived fundamental value and price."""

    name = "value"

    def asset_drivers(self, actor: "Actor", obs: Observation, a: str) -> list[Driver]:
        t = actor.traits
        price = max(obs.prices.get(a, 1e-9), 1e-9)
        fund = obs.fundamentals.get(a, price)
        exp_r = actor.state.expected_returns.get(a, 0.0)
        return [
            Driver("fundamental_gap", _tanh(2.5 * (fund / price - 1.0)), 0.9 + 0.6 * t.analytical_capability),
            Driver("expected_return", _tanh(40.0 * (exp_r - obs.risk_free_rate)), 0.4),
            Driver("credit_tightness", -obs.credit_tightness, 0.3),
        ]

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        return build_trade_decision(self.name, actor, obs, ctx, self.asset_drivers)


class ImitationModel:
    """Herding: follows the perceived crowd and social sentiment."""

    name = "imitation"

    def asset_drivers(self, actor: "Actor", obs: Observation, a: str) -> list[Driver]:
        t = actor.traits
        vol = max(obs.volatility.get(a, 0.01), 1e-4)
        mom = obs.momentum.get(a, 0.0)
        return [
            Driver("peer_flow", obs.peer_net_flow, 0.2 + 1.1 * t.herd_tendency),
            Driver("peer_sentiment", obs.peer_sentiment, 0.7 * t.herd_tendency),
            Driver("price_chase", _tanh(0.6 * mom / (vol * math.sqrt(10.0))), 0.3),
            Driver("fomo_confidence", actor.state.confidence - 0.5, 0.3),
        ]

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        return build_trade_decision(self.name, actor, obs, ctx, self.asset_drivers)
