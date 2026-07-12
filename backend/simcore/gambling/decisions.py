"""Player operator-choice: a multinomial-logit / random-utility model.

The player's utility over an operator *j* is a β-weighted sum of drivers
(payout, product breadth, brand, friction, tax-free winnings, protection,
marketing reach) — the perspective's §4.1 utility. The **β-vector varies per
segment**: that is the whole point. A young, high-risk, friction-tolerant player
weights product breadth (crash games) up and protection/tax-free down, so the
tail leaks offshore under tightening; a mainstream low-risk player is the
opposite. This endogenous, heterogeneous response is what lets the model produce
the channelization dynamics honestly instead of assuming them.

The bulk computation is vectorized (numpy) for 500–20 000 players × ~7 operators.
For explainability (decision log / reaction analysis) a representative player's
choice is re-expressed through the engine's stochastic core
(``Driver`` + ``explanation``), so the "why" comes from the same machinery the
finance domain uses.
"""
from __future__ import annotations

import numpy as np

from simcore.decisions.stochastic import explanation
from simcore.gambling.config import OperatorConfig
from simcore.gambling.population import PlayerArrays
from simcore.models.actions import Driver

# Driver keys (order is fixed; used for both the vectorized path and Drivers).
DRIVERS = ("rtp", "breadth", "brand", "friction", "taxfree", "protection", "marketing")


def player_betas(pop: PlayerArrays, young_age_threshold: int) -> dict[str, np.ndarray]:
    """Per-player β weights on each driver, derived from the five axes. Friction
    aversion falls with risk (the tail is friction-tolerant); protection flips
    sign (a plus for low-risk players, a minus for high-risk ones)."""
    risk = pop.risk
    young = (pop.age < young_age_threshold).astype(float)
    return {
        "rtp": 0.8 + 0.8 * risk,
        "breadth": 0.2 + 1.6 * risk + 0.3 * young,
        "brand": 1.0 - 0.5 * risk,
        "friction": 1.4 * (1.0 - 0.75 * risk),         # subtracted in the utility
        "taxfree": 0.8 * (1.0 - 0.5 * risk),
        "protection": 1.0 * (1.0 - risk) - 0.8 * risk,  # sign flips with risk
        "marketing": 0.4 + 0.9 * young + 0.3 * risk,
    }


def operator_attr_arrays(operators: list[OperatorConfig]) -> dict[str, np.ndarray]:
    """Per-operator attribute vectors (order matches ``operators``)."""
    return {
        "rtp": np.array([o.rtp for o in operators]),
        "breadth": np.array([o.product_breadth for o in operators]),
        "brand": np.array([o.brand for o in operators]),
        "friction": np.array([o.friction for o in operators]),
        "taxfree": np.array([1.0 if o.tax_free else 0.0 for o in operators]),
        "protection": np.array([o.protection for o in operators]),
        "marketing": np.array([o.marketing_reach for o in operators]),
        "appeal": np.array([o.appeal for o in operators]),
    }


def utilities(
    betas: dict[str, np.ndarray],
    attrs: dict[str, np.ndarray],
    appeal_offset: np.ndarray | None = None,
) -> np.ndarray:
    """Utility matrix U[player, operator] (vectorized β·x)."""
    n = len(betas["rtp"])
    m = len(attrs["rtp"])
    u = np.zeros((n, m))
    u += betas["rtp"][:, None] * attrs["rtp"][None, :]
    u += betas["breadth"][:, None] * attrs["breadth"][None, :]
    u += betas["brand"][:, None] * attrs["brand"][None, :]
    u -= betas["friction"][:, None] * attrs["friction"][None, :]
    u += betas["taxfree"][:, None] * attrs["taxfree"][None, :]
    u += betas["protection"][:, None] * attrs["protection"][None, :]
    u += betas["marketing"][:, None] * attrs["marketing"][None, :]
    u += attrs["appeal"][None, :]
    if appeal_offset is not None:
        u += appeal_offset[None, :]
    return u


def choice_probabilities(u: np.ndarray, temperature: float) -> np.ndarray:
    """Softmax over operators per player (numerically stable)."""
    z = u / max(temperature, 1e-6)
    z -= z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def budget_weighted_shares(probs: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Aggregate operator shares = budget-weighted mean of choice probabilities."""
    w = weights / max(float(weights.sum()), 1e-12)
    return probs.T @ w


def explain_choice(
    operators: list[OperatorConfig], attrs: dict[str, np.ndarray],
    betas: dict[str, np.ndarray], player_idx: int, chosen_op: int, prob: float,
):
    """Re-express one player's operator choice through the stochastic core so the
    decision log carries the actual drivers (for reaction analysis)."""
    signed = {  # (+ for utility-adding drivers, − for friction)
        "rtp": 1, "breadth": 1, "brand": 1, "friction": -1,
        "taxfree": 1, "protection": 1, "marketing": 1,
    }
    drivers = [
        Driver(name=k, value=float(signed[k] * attrs[k][chosen_op]),
               weight=float(betas[k][player_idx]))
        for k in DRIVERS
    ]

    class _A:  # minimal actor stand-in for explanation()
        class state:
            stress = 0.0

    z = sum(d.contribution for d in drivers)
    return explanation(f"player_choice:{operators[chosen_op].operator_id}", drivers,
                       float(prob), _A(), float(z))
