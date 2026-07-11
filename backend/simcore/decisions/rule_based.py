"""Rule-based trader: prioritized threshold rules (stop-loss, risk mandate,
take-profit, entry on expected return, liquidity management). The triggered
rule provides the dominant driver, so the explanation names the actual rule.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.stochastic import act_probability, decisiveness, explanation
from simcore.decisions.heuristics import portfolio_drivers
from simcore.markets.constraints import max_buy_qty
from simcore.models.actions import Action, ActionIntent, Decision, Domain, Driver

if TYPE_CHECKING:
    from simcore.agents.actor import Actor

RULE_THRESHOLD = 0.05  # rules are decisive once triggered


class RuleBasedModel:
    name = "rules"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        t = actor.traits
        s = actor.state
        entries: dict[str, float] = s.internal_state.setdefault("entry_price", {})
        stop_frac = 0.04 + 0.12 * (1.0 - t.risk_tolerance)  # cautious = tighter stop
        shared = portfolio_drivers(actor, obs)

        rule_driver: Driver | None = None
        intent: ActionIntent | None = None

        # 1. stop-loss on the worst breached holding
        worst: tuple[str, float] | None = None
        for a, pos in s.positions.items():
            if pos <= 0:
                continue
            price = obs.prices.get(a, 0.0)
            entry = entries.get(a, price)
            if price > 0 and entry > 0 and price < entry * (1.0 - stop_frac):
                breach = (entry - price) / entry - stop_frac
                if worst is None or breach > worst[1]:
                    worst = (a, breach)
        if worst is not None:
            a, breach = worst
            loss_norm = (t.loss_aversion - 1.0) / 4.0
            rule_driver = Driver("stop_loss_breach", -(0.5 + 8.0 * breach), 0.8 + 0.5 * loss_norm)
            intent = ActionIntent(actor.id, Action.SELL, Domain.MARKET, a, s.positions[a])

        # 2. risk mandate: perceived volatility above mandate -> de-risk biggest holding
        if intent is None:
            mandate = 0.015 + 0.05 * t.risk_tolerance
            held = [(a, p) for a, p in s.positions.items() if p > 0]
            if held:
                a_vol, pos = max(held, key=lambda ap: obs.volatility.get(ap[0], 0.0))
                vol = obs.volatility.get(a_vol, 0.0)
                if vol > mandate:
                    rule_driver = Driver("risk_mandate_breach", -(vol / mandate - 1.0), 1.0)
                    intent = ActionIntent(actor.id, Action.SELL, Domain.MARKET, a_vol, 0.35 * pos)

        # 3. take-profit
        if intent is None:
            for a, pos in s.positions.items():
                if pos <= 0:
                    continue
                price = obs.prices.get(a, 0.0)
                entry = entries.get(a, price)
                if price > 0 and entry > 0 and price > entry * (1.0 + 2.5 * stop_frac):
                    gain = (price - entry) / entry
                    rule_driver = Driver("take_profit", -(0.3 + gain), 0.7)
                    intent = ActionIntent(actor.id, Action.SELL, Domain.MARKET, a, 0.5 * pos)
                    break

        # 4. entry: expected return above hurdle
        if intent is None:
            hurdle = obs.risk_free_rate + 0.0012 * (1.5 - t.risk_tolerance)
            best_a, best_e = None, hurdle
            for a in ctx.asset_ids:
                e = s.expected_returns.get(a, 0.0)
                if e > best_e:
                    best_a, best_e = a, e
            if best_a is not None:
                price = obs.prices.get(best_a, 0.0)
                if price > 0:
                    qty = min(
                        actor.base_order_qty(price, obs.own_wealth),
                        max_buy_qty(actor, price, obs.prices, ctx.market),
                    )
                    if qty > 1e-9:
                        rule_driver = Driver("expected_return_entry", (best_e - hurdle) * 400.0, 1.0)
                        intent = ActionIntent(actor.id, Action.BUY, Domain.MARKET, best_a, qty)

        # 5. liquidity management (institutional habit): stress flight vs. calm provision
        extra: list[ActionIntent] = []
        if s.stress > 0.7 and s.provided_liquidity > 0:
            extra.append(
                ActionIntent(actor.id, Action.WITHDRAW_LIQUIDITY, Domain.MARKET, None, s.provided_liquidity)
            )
        elif s.stress < 0.2 and s.cash > 0.35 * max(obs.own_wealth, 1e-9) and s.provided_liquidity < 0.05 * obs.own_wealth:
            extra.append(
                ActionIntent(actor.id, Action.PROVIDE_LIQUIDITY, Domain.MARKET, None, 0.03 * obs.own_wealth)
            )

        if intent is None and not extra:
            return Decision(intents=[])
        drivers = ([rule_driver] if rule_driver else []) + shared
        z = sum(d.contribution for d in drivers)
        p = act_probability(z, RULE_THRESHOLD, decisiveness(t.patience) * 1.5)
        expl = explanation(self.name, drivers, p, actor, z)
        if intent is not None and actor.rng.random() >= p:
            intent = None  # even rules keep a stochastic residual
        intents = ([intent] if intent else []) + extra
        return Decision(intents=intents, explanation=expl)
