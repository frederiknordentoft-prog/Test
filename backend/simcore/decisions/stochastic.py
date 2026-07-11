"""Structured stochasticity — the shared decision core.

Every decision model funnels through the same primitive:

    z      = sum(driver.value * driver.weight)
    p_act  = logistic(k * (|z| - action_threshold))     k falls with patience
    fired  = |z| >= action_threshold and rng() < p_act
    size  ∝ base * f(|z|, risk_tolerance, stress, loss_aversion) * jitter

The explanation is assembled from the *same* Driver objects that produced z,
so logged reasons cannot drift from actual behavior.
"""
from __future__ import annotations

import math
from typing import TYPE_CHECKING

from simcore.models.actions import Driver, Explanation

if TYPE_CHECKING:
    from simcore.agents.actor import Actor

K_BASE = 6.0


def combine(drivers: list[Driver]) -> float:
    return sum(d.contribution for d in drivers)


def decisiveness(patience: float) -> float:
    """Impatient actors have a steeper trigger curve."""
    return K_BASE * (1.5 - patience)


def act_probability(z: float, threshold: float, k: float) -> float:
    x = k * (abs(z) - threshold)
    if x < -30:
        return 0.0
    if x > 30:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def gate(actor: "Actor", drivers: list[Driver], threshold: float | None = None) -> tuple[bool, float, float]:
    """Returns (fired, p_act, z). The action threshold is an actor trait unless
    a model supplies its own."""
    z = combine(drivers)
    thr = actor.traits.action_threshold if threshold is None else threshold
    if abs(z) < thr:
        return False, 0.0, z
    p = act_probability(z, thr, decisiveness(actor.traits.patience))
    fired = bool(actor.rng.random() < p)
    return fired, p, z


def size_multiplier(actor: "Actor", z: float, selling: bool) -> float:
    """Aggression scaling. Stress + loss aversion dampen risk-taking (buys)
    but amplify de-risking (sells) — this is where panic selling comes from."""
    t = actor.traits
    s = actor.state
    loss_norm = (t.loss_aversion - 1.0) / 4.0  # ~0..1
    base = min(abs(z) * 1.5, 1.5)
    if selling:
        mult = base * (0.5 + 0.5 * t.risk_tolerance) * (1.0 + 0.8 * s.stress * (0.5 + loss_norm))
    else:
        mult = base * (0.5 + t.risk_tolerance) * max(0.15, 1.0 - 0.8 * s.stress * loss_norm)
    jitter = 0.9 + 0.2 * actor.rng.random()
    return mult * jitter


def explanation(
    model_name: str, drivers: list[Driver], p: float, actor: "Actor", z: float, top: int = 3
) -> Explanation:
    ranked = sorted(drivers, key=lambda d: abs(d.contribution), reverse=True)[:top]
    return Explanation(
        model_name=model_name,
        main_drivers=[(d.name, round(d.contribution, 4)) for d in ranked],
        decision_probability=p,
        stress_level=actor.state.stress,
        score=z,
    )
