"""Optional LLM decision adapter — interface only, never called in the MVP.

To let a few key actors reason via an LLM later, implement ``LLMClient`` and
register ``LLMDecisionModel(client)`` in the registry under a mixture key used
by a type profile. ``prompt_context`` shows exactly what such a model would
see; the response must map back onto the same ActionIntent/Explanation schema
so logging and analytics keep working unchanged.
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol

from simcore.decisions.base import DecisionContext, Observation
from simcore.models.actions import Decision

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


class LLMClient(Protocol):
    def complete(self, context: dict[str, Any]) -> dict[str, Any]:
        """Given a prompt context, return {action, asset_id, qty, drivers}."""
        ...


def prompt_context(actor: "Actor", obs: Observation, ctx: DecisionContext) -> dict[str, Any]:
    return {
        "actor": {
            "type": actor.actor_type.value,
            "objective": actor.primary_objective,
            "traits": {
                "risk_tolerance": actor.traits.risk_tolerance,
                "loss_aversion": actor.traits.loss_aversion,
                "time_horizon": actor.traits.time_horizon,
            },
            "state": {
                "cash": actor.state.cash,
                "positions": dict(actor.state.positions),
                "sentiment": actor.state.sentiment,
                "stress": actor.state.stress,
            },
        },
        "observation": {
            "tick": obs.tick,
            "prices": obs.prices,
            "returns": obs.returns_1,
            "signals": [
                {"topic": s.topic, "magnitude": s.magnitude, "credibility": s.credibility}
                for s in obs.signals
            ],
        },
        "allowed_actions": ["buy", "sell", "hold", "short", "cover"],
    }


class LLMDecisionModel:
    name = "llm"

    def __init__(self, client: LLMClient | None = None):
        self.client = client

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        if self.client is None:
            raise NotImplementedError(
                "LLMDecisionModel is an adapter stub in the MVP; inject an LLMClient to use it."
            )
        raise NotImplementedError("Response mapping is intentionally left to phase 3.")
