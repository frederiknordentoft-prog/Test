"""Actions, decisions and structured explanations.

The explanation attached to a Decision is built from the same driver values
that produced the action (see simcore/decisions/stochastic.py) — it is an
extract of the computation, not text invented after the fact.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Action(str, Enum):
    # market domain
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"
    SHORT = "short"
    COVER = "cover"
    INCREASE_LEVERAGE = "increase_leverage"
    REDUCE_LEVERAGE = "reduce_leverage"
    PROVIDE_LIQUIDITY = "provide_liquidity"
    WITHDRAW_LIQUIDITY = "withdraw_liquidity"
    # goods domain
    SET_PRICE = "set_price"
    PRODUCE = "produce"
    ORDER_INPUTS = "order_inputs"
    INVEST = "invest"
    PURCHASE = "purchase"
    DEFER_PURCHASE = "defer_purchase"
    SWITCH_FIRM = "switch_firm"
    RATION_CAPACITY = "ration_capacity"
    # credit domain
    REQUEST_LOAN = "request_loan"
    SET_CREDIT_CONDITIONS = "set_credit_conditions"
    # information domain
    EMIT_SIGNAL = "emit_signal"


class Domain(str, Enum):
    MARKET = "market"
    GOODS = "goods"
    CREDIT = "credit"
    INFO = "info"


@dataclass(slots=True)
class ActionIntent:
    actor_id: int
    action: Action
    domain: Domain = Domain.MARKET
    asset_id: str | None = None
    qty: float = 0.0
    forced: bool = False
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class Driver:
    """One weighted input to a decision. contribution = value * weight."""

    name: str
    value: float
    weight: float

    @property
    def contribution(self) -> float:
        return self.value * self.weight


@dataclass(slots=True)
class Explanation:
    model_name: str
    main_drivers: list[tuple[str, float]]  # (driver name, contribution), top-|contribution|
    decision_probability: float
    stress_level: float
    score: float = 0.0  # the combined driver score z that produced the action

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model_name,
            "main_drivers": [{"driver": n, "contribution": round(c, 4)} for n, c in self.main_drivers],
            "decision_probability": round(self.decision_probability, 4),
            "stress_level": round(self.stress_level, 4),
            "score": round(self.score, 4),
        }


@dataclass(slots=True)
class Decision:
    intents: list[ActionIntent]
    explanation: Explanation | None = None


HOLD_DECISION = Decision(intents=[], explanation=None)
