"""The Actor: a composition of traits, mutable state, a decision model and an
own RNG stream. Behavior differences between actors come from (a) trait values,
(b) the injected decision model, (c) network position, (d) state history —
never from subclass overrides.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

import numpy as np

from simcore.models.actor_state import ActorState, ActorType, EconState, MemoryRecord, Traits

if TYPE_CHECKING:
    from simcore.decisions.base import DecisionContext, DecisionModel, Observation


@dataclass(slots=True)
class Actor:
    id: int
    actor_type: ActorType
    name: str
    traits: Traits
    state: ActorState
    rng: np.random.Generator
    model: "DecisionModel | None" = None
    econ: EconState | None = None
    primary_objective: str = ""
    secondary_objectives: list[str] = field(default_factory=list)
    market_participant: bool = True
    can_short: bool = False
    can_leverage: bool = False
    trade_fraction: float = 0.08

    # ------------------------------------------------------------------ #
    # state update (tick stage 5): sentiment, stress, expectations, memory
    # ------------------------------------------------------------------ #
    def update_state(self, obs: "Observation", ctx: "DecisionContext") -> None:
        t = self.traits
        s = self.state

        # --- sentiment: EWMA blend of perceived market direction, peers, signals
        signal_push = 0.0
        for sig in obs.signals:
            signal_push += sig.sentiment_hint * sig.credibility
        signal_push = float(np.clip(signal_push, -1.0, 1.0))

        mkt_direction = (
            float(np.tanh(15.0 * np.mean(list(obs.returns_1.values())))) if obs.returns_1 else 0.0
        )
        herd = t.herd_tendency
        target = (
            (1.0 - herd) * mkt_direction
            + herd * 0.7 * obs.peer_sentiment
            + herd * 0.3 * obs.peer_net_flow
            + 0.5 * signal_push
        )
        blend = 0.15 + 0.35 * t.adaptability
        s.sentiment = float(np.clip((1 - blend) * s.sentiment + blend * target, -1.0, 1.0))

        # --- stress: drawdown, survival proximity, margin proximity, liquidity
        wealth = obs.own_wealth
        s.peak_wealth = max(s.peak_wealth, wealth)
        drawdown = 0.0 if s.peak_wealth <= 0 else max(0.0, 1.0 - wealth / s.peak_wealth)
        survival_line = t.survival_threshold * max(s.initial_wealth, 1e-9)
        survival_prox = 0.0
        if s.initial_wealth > 0:
            survival_prox = float(np.clip(1.0 - (wealth - survival_line) / max(s.initial_wealth - survival_line, 1e-9), 0.0, 1.0))
        margin_prox = float(np.clip(1.0 - obs.econ.get("equity_ratio", 1.0) / 0.5, 0.0, 1.0))
        liq_short = float(np.clip(1.0 - s.cash / max(0.1 * max(wealth, 1e-9), 1e-9), 0.0, 1.0)) if wealth > 0 else 1.0
        shock_boost = min(0.3, 0.3 * abs(signal_push)) if signal_push < 0 else 0.0
        raw_stress = 0.45 * drawdown * t.loss_aversion / 2.0 + 0.25 * survival_prox + 0.2 * margin_prox + 0.10 * liq_short
        s.stress = float(np.clip(0.6 * s.stress + 0.4 * min(1.0, raw_stress + shock_boost), 0.0, 1.0))

        # --- confidence: driven by expectation errors, cushioned by overconfidence
        realized = obs.own_return
        expected = s.internal_state.get("expected_own_return", 0.0)
        err = realized - expected
        floor = 0.2 + 0.5 * t.overconfidence
        s.confidence = float(np.clip(0.9 * s.confidence + 2.0 * err, floor * 0.5, 1.0))
        s.confidence = max(s.confidence, floor * 0.4)

        # --- expectations per asset: exponential smoothing of perceived returns,
        #     blended toward the fundamental gap for analytical actors
        g = 0.15 + 0.35 * t.analytical_capability
        horizon = max(int(t.time_horizon), 1)
        overconf = 1.0 + 0.5 * t.overconfidence
        for a in ctx.asset_ids:
            r = obs.returns_1.get(a, 0.0)
            prev = s.expected_returns.get(a, 0.0)
            momentum_exp = (1 - g) * prev + g * r
            fund = obs.fundamentals.get(a)
            price = obs.prices.get(a, 0.0)
            if fund and price > 0 and t.analytical_capability > 0.25:
                gap_per_tick = (fund / price - 1.0) / horizon
                w_f = 0.5 * t.analytical_capability
                exp_r = (1 - w_f) * momentum_exp + w_f * gap_per_tick
            else:
                exp_r = momentum_exp
            s.expected_returns[a] = float(np.clip(exp_r * overconf, -0.2, 0.2))
            prev_risk = s.expected_risks.get(a, obs.volatility.get(a, 0.01))
            s.expected_risks[a] = float(np.sqrt(0.9 * prev_risk**2 + 0.1 * r**2))
        s.internal_state["expected_own_return"] = float(
            np.mean([s.expected_returns.get(a, 0.0) for a in ctx.asset_ids])
        ) if ctx.asset_ids else 0.0

        # --- memory (bounded by trait memory_length)
        shock = obs.signals[0].topic if obs.signals else None
        s.memory.append(
            MemoryRecord(tick=obs.tick, wealth=wealth, ret=realized, action=None, shock=shock, expectation_error=err)
        )
        while len(s.memory) > max(int(self.traits.memory_length), 1):
            s.memory.popleft()

        s.last_wealth = wealth

    # ------------------------------------------------------------------ #
    def base_order_qty(self, price: float, wealth: float) -> float:
        """Typical order size in shares for this actor."""
        if price <= 0:
            return 0.0
        return max(wealth, 0.0) * self.trade_fraction / price

    def to_summary(self, prices: dict[str, float]) -> dict[str, Any]:
        s = self.state
        return {
            "id": self.id,
            "type": self.actor_type.value,
            "name": self.name,
            "wealth": round(s.wealth(prices), 2),
            "cash": round(s.cash, 2),
            "leverage": round(s.leverage(prices), 3),
            "sentiment": round(s.sentiment, 3),
            "stress": round(s.stress, 3),
            "alive": s.alive,
            "strategy": s.strategy,
        }


def new_actor_state(wealth: float) -> ActorState:
    return ActorState(
        cash=wealth,
        initial_wealth=wealth,
        peak_wealth=wealth,
        last_wealth=wealth,
        memory=deque(),
    )
