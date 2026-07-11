"""Adaptive trader: reinforcement-style scoring over sub-strategies.

Keeps a per-actor score per sub-strategy (stored in actor.state.strategy_scores,
so the model object itself stays shared and stateless). Each tick the actor
credits its last-used strategy with its realized return, then picks the next
strategy by softmax over scores — adaptable actors switch faster (higher
learning rate, lower temperature).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.heuristics import MeanReversionModel, MomentumModel, ValueModel
from simcore.models.actions import Decision, Explanation

if TYPE_CHECKING:
    from simcore.agents.actor import Actor


class AdaptiveModel:
    name = "adaptive"

    def __init__(self) -> None:
        self.subs = {
            "momentum": MomentumModel(),
            "meanrev": MeanReversionModel(),
            "value": ValueModel(),
        }

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision:
        t = actor.traits
        s = actor.state
        scores = s.strategy_scores
        for k in self.subs:
            scores.setdefault(k, 0.0)

        # credit assignment for the strategy used last tick
        last = s.internal_state.get("adaptive_choice")
        if last in scores:
            eta = 0.1 + 0.4 * t.adaptability
            scores[last] = (1 - eta) * scores[last] + eta * float(np.clip(obs.own_return * 100.0, -3, 3))

        # softmax selection; adaptable actors exploit more sharply
        temp = max(0.15, 1.0 - 0.8 * t.adaptability)
        names = list(self.subs.keys())
        vals = np.array([scores[k] for k in names]) / temp
        vals -= vals.max()
        probs = np.exp(vals)
        probs /= probs.sum()
        choice = str(actor.rng.choice(names, p=probs))
        s.internal_state["adaptive_choice"] = choice
        s.strategy = f"adaptive:{choice}"

        decision = self.subs[choice].decide(actor, obs, ctx)
        if decision.explanation is not None:
            e = decision.explanation
            drivers = e.main_drivers + [(f"strategy_score_{choice}", round(scores[choice], 4))]
            decision.explanation = Explanation(
                model_name=f"adaptive({choice})",
                main_drivers=drivers,
                decision_probability=e.decision_probability,
                stress_level=e.stress_level,
                score=e.score,
            )
        return decision
