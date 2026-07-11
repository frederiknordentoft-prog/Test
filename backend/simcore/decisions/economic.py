"""Decision models for real-economy and institutional actors: firms,
suppliers, customers, banks, regulators and media. Same driver→gate→explain
core as the trading models; the intents live in the goods / credit / info
domains and are executed by the goods market, credit system and signal bus.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.stochastic import combine, explanation, gate
from simcore.models.actions import Action, ActionIntent, Decision, Domain, Driver

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


def _news_push(obs: Observation) -> float:
    return float(np.clip(sum(s.sentiment_hint * s.credibility for s in obs.signals), -1.5, 1.5))


class FirmModel:
    name = "firm"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        e = actor.econ
        s = actor.state
        assert e is not None
        econ = obs.econ
        cap = max(e.capacity, 1e-9)
        demand = econ.get("demand_units", cap * 0.5)
        input_price = econ.get("input_price", e.unit_cost)
        inv_ratio = e.inventory / cap
        unit_cost_ref = max(s.internal_state.setdefault("unit_cost_ref", e.unit_cost), 1e-9)

        drivers = [
            Driver("demand_pressure", math.tanh(2.0 * (demand - cap * 0.8) / cap), 1.0 + 0.5 * e.pricing_power),
            Driver("inventory_pressure", -math.tanh(2.5 * (inv_ratio - 0.4)), 0.8),
            Driver("input_cost_passthrough", math.tanh(4.0 * (input_price + ctx.config.economy.wage_per_capacity) / unit_cost_ref - 4.0), 0.9),
            Driver("stress", -s.stress, 0.3),
        ]
        fired, p, z = gate(actor, drivers)
        intents: list[ActionIntent] = []
        if fired:
            step = ctx.config.economy.markup_step * (0.5 + e.pricing_power)
            new_price = e.price * (1.0 + step * float(np.clip(z, -1.5, 1.5)))
            new_price = max(new_price, 0.85 * (input_price + ctx.config.economy.wage_per_capacity))
            intents.append(
                ActionIntent(actor.id, Action.SET_PRICE, Domain.GOODS, None, new_price)
            )

        # production plan follows perceived demand (never gated away — firms keep operating)
        target = float(np.clip(demand * 1.05 - e.inventory * 0.5, 0.05 * cap, cap))
        if s.stress > 0.6:
            target *= 1.0 - 0.4 * (s.stress - 0.6)  # distressed firms cut production
        intents.append(ActionIntent(actor.id, Action.PRODUCE, Domain.GOODS, None, target))

        # investment: Tobin-q coupling (market -> real economy)
        q = econ.get("tobin_q", 1.0)
        if (
            q > 1.05
            and obs.credit_tightness < 0.6
            and s.cash > 0.15 * max(s.initial_wealth, 1.0)
            and actor.rng.random() < 0.3
        ):
            delta_cap = e.capacity * ctx.config.economy.investment_rate * (
                1.0 + ctx.config.economy.tobin_q_sensitivity * (q - 1.0)
            )
            intents.append(ActionIntent(actor.id, Action.INVEST, Domain.GOODS, None, delta_cap))

        # financing gap -> loan request
        est_outlay = target * (input_price + ctx.config.economy.wage_per_capacity)
        if s.cash < est_outlay:
            need = (est_outlay - s.cash) * 1.25
            intents.append(ActionIntent(actor.id, Action.REQUEST_LOAN, Domain.CREDIT, None, need))

        # endogenous news: listed firms warn when earnings deteriorate sharply
        prev = s.internal_state.get("earnings_ref", e.earnings_smoothed)
        if e.listed_asset and prev > 0 and e.earnings_smoothed < 0.6 * prev:
            intents.append(
                ActionIntent(
                    actor.id,
                    Action.EMIT_SIGNAL,
                    Domain.INFO,
                    e.listed_asset,
                    -min(1.0, 1.0 - e.earnings_smoothed / prev),
                    meta={"topic": "profit_warning", "credibility": 0.95, "truth": 1.0, "publicity": 1.0},
                )
            )
            s.internal_state["earnings_ref"] = e.earnings_smoothed
        else:
            s.internal_state["earnings_ref"] = 0.9 * prev + 0.1 * e.earnings_smoothed

        return Decision(intents=intents, explanation=explanation(self.name, drivers, max(p, 0.5), actor, z))


class SupplierModel:
    name = "supplier"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        e = actor.econ
        s = actor.state
        assert e is not None
        util = obs.econ.get("utilization", e.utilization)
        cost_index = obs.econ.get("cost_index", 1.0)
        drivers = [
            Driver("utilization", math.tanh(2.5 * (util - 0.6)), 1.0),
            Driver("cost_push", math.tanh(3.0 * (cost_index - 1.0)), 1.1),
            Driver("stress", -s.stress, 0.2),
        ]
        fired, p, z = gate(actor, drivers)
        intents: list[ActionIntent] = []
        if fired:
            new_price = e.price * (1.0 + ctx.config.economy.markup_step * float(np.clip(z, -1.5, 1.5)))
            new_price = max(new_price, e.unit_cost * cost_index * 1.02)
            intents.append(ActionIntent(actor.id, Action.SET_PRICE, Domain.GOODS, None, new_price))
        return Decision(intents=intents, explanation=explanation(self.name, drivers, p, actor, z))


class CustomerModel:
    name = "customer"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        e = actor.econ
        s = actor.state
        t = actor.traits
        assert e is not None
        econ = obs.econ
        avg_price = econ.get("avg_price", 10.0)
        baseline = max(econ.get("baseline_price", avg_price), 1e-9)
        drivers = [
            Driver("price_level", -math.tanh(e.price_sensitivity * (avg_price / baseline - 1.0)), 1.0),
            Driver("own_sentiment", s.sentiment, 0.5),
            Driver("stress", -s.stress, 0.7),
            Driver("peer_sentiment", obs.peer_sentiment, 0.6 * t.herd_tendency),
            Driver("news", _news_push(obs), 0.5),
        ]
        z = combine(drivers)
        mult = float(np.clip(1.0 + 0.5 * math.tanh(z), 0.25, 1.6))
        spend = e.budget * ctx.config.economy.base_demand_budget_share * mult
        intents = [ActionIntent(actor.id, Action.PURCHASE, Domain.GOODS, None, spend)]
        if mult < 0.7:
            intents.append(ActionIntent(actor.id, Action.DEFER_PURCHASE, Domain.GOODS, None, 1.0 - mult))

        # switching: disloyal, price-sensitive or herd-driven customers change firm
        gap = econ.get("own_firm_price_gap", 0.0)
        p_switch = (1.0 - e.loyalty) * float(np.clip(0.4 * gap * e.price_sensitivity + 0.2 * s.stress, 0.0, 0.5))
        if actor.rng.random() < p_switch:
            intents.append(ActionIntent(actor.id, Action.SWITCH_FIRM, Domain.GOODS, None, 1.0))

        p_act = float(np.clip(mult / 1.6, 0.0, 1.0))
        return Decision(intents=intents, explanation=explanation(self.name, drivers, p_act, actor, z))


class BankModel:
    name = "bank"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        s = actor.state
        t = actor.traits
        econ = obs.econ
        loss_rate = econ.get("loan_loss_rate", 0.0)
        cap_ratio = econ.get("capital_ratio", 0.2)
        target = 0.10 + 0.10 * t.regulatory_constraint
        drivers = [
            Driver("loan_losses", math.tanh(loss_rate / 0.02), 1.2),
            Driver("capital_shortfall", math.tanh(5.0 * (target - cap_ratio)), 1.0),
            Driver("systemic_stress", econ.get("systemic_score", 0.0), 0.5),
            Driver("margin_competition", -0.3, 0.4),  # loosening pull in calm times
        ]
        fired, p, z = gate(actor, drivers)
        intents: list[ActionIntent] = []
        if fired:
            delta = 0.12 * float(np.clip(z, -1.5, 1.5))
            intents.append(ActionIntent(actor.id, Action.SET_CREDIT_CONDITIONS, Domain.CREDIT, None, delta))
        return Decision(intents=intents, explanation=explanation(self.name, drivers, p, actor, z))


class RegulatorModel:
    name = "regulator"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        s = actor.state
        t = actor.traits
        score = obs.econ.get("systemic_score", 0.0)  # 0..1, perceived with delay
        default_rate = obs.econ.get("default_rate", 0.0)
        breach = s.internal_state.get("breach_ticks", 0)
        if score > t.action_threshold + 0.15:
            breach += 1
        else:
            breach = max(0, breach - 1)
        s.internal_state["breach_ticks"] = breach
        persistence_needed = 3.0 + 10.0 * t.patience

        drivers = [
            Driver("systemic_risk", score, 1.2),
            Driver("persistence", min(breach / persistence_needed, 1.0), 0.8),
            Driver("default_rate", math.tanh(10.0 * default_rate), 0.5),
        ]
        fired, p, z = gate(actor, drivers, threshold=0.5)
        intents: list[ActionIntent] = []
        active = s.internal_state.get("intervention_level", 0)
        if fired and z > 0 and active < 3:
            s.internal_state["intervention_level"] = active + 1
            intents.append(
                ActionIntent(
                    actor.id, Action.SET_CREDIT_CONDITIONS, Domain.CREDIT, None, 0.15,
                    meta={"regulatory": True, "margin_delta": 0.05},
                )
            )
            intents.append(
                ActionIntent(
                    actor.id, Action.EMIT_SIGNAL, Domain.INFO, None, -0.4,
                    meta={"topic": "regulatory_intervention", "credibility": 0.95, "truth": 1.0, "publicity": 1.0},
                )
            )
        elif active > 0 and score < 0.25 and breach == 0:
            s.internal_state["intervention_level"] = active - 1
            intents.append(
                ActionIntent(
                    actor.id, Action.SET_CREDIT_CONDITIONS, Domain.CREDIT, None, -0.1,
                    meta={"regulatory": True, "margin_delta": -0.05},
                )
            )
        return Decision(intents=intents, explanation=explanation(self.name, drivers, p, actor, z))


class MediaModel:
    name = "media"

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        s = actor.state
        sensationalism = float(s.internal_state.get("sensationalism", 0.5))
        bias = float(s.internal_state.get("bias", 0.0))
        reach = float(s.internal_state.get("reach", 0.5))

        best_asset, best_r = None, 0.0
        for a, r in obs.returns_1.items():
            if abs(r) > abs(best_r):
                best_asset, best_r = a, r
        vol = max(obs.volatility.get(best_asset, 0.01), 1e-4) if best_asset else 0.01
        salience = abs(best_r) / (2.5 * vol)
        drivers = [
            Driver("story_salience", math.tanh(salience), 1.0 + 0.6 * sensationalism),
            Driver("incoming_signal", _news_push(obs), 0.8),
            Driver("slow_news_day", -0.2, 0.4),
        ]
        fired, p, z = gate(actor, drivers)
        intents: list[ActionIntent] = []
        if fired and best_asset is not None:
            hint = math.tanh(math.copysign(salience, best_r) * (1.0 + sensationalism)) + 0.3 * bias
            intents.append(
                ActionIntent(
                    actor.id, Action.EMIT_SIGNAL, Domain.INFO, best_asset,
                    float(np.clip(hint, -1.0, 1.0)),
                    meta={
                        "topic": "media_story",
                        "credibility": 0.4 + 0.5 * s.reputation,
                        "truth": 0.8,
                        "publicity": 0.3 + 0.6 * reach,
                        "amplify": True,
                    },
                )
            )
        return Decision(intents=intents, explanation=explanation(self.name, drivers, p, actor, z))
