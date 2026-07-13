"""Player operator-choice: a multinomial-logit / random-utility model.

The player's utility over an operator *j* is a β-weighted sum of drivers
(payout, product breadth, bonus, brand, friction, tax-free winnings, protection,
marketing reach) — the perspective's §4.1 utility. The **β-vector varies per
segment**: that is the whole point. A young, high-risk, friction-tolerant player
weights product breadth (crash games) and bonuses up and protection/tax-free
down, so the tail leaks offshore under tightening; a mainstream low-risk player
is the opposite.

Two further pieces make the heterogeneity behavioural rather than cosmetic:

- an **outside option** ("spiller ikke") sits in every choice set, most
  attractive to low-risk players (``outside_risk_beta``) — so tightening can
  shrink total demand (the breadth exits) instead of only re-routing it;
- the **offshore-propensity axis** (axis 5) shifts utility toward unlicensed
  alternatives per player (``offshore_affinity_beta``), so the tail responds to
  tightening by leaking offshore while the breadth does not.

The bulk computation is vectorized (numpy) for 500–20 000 players × ~8 operators.
For explainability (decision log / reaction analysis) a representative player's
choice is re-expressed through the engine's stochastic core
(``Driver`` + ``explanation``), so the "why" comes from the same machinery the
finance domain uses.
"""
from __future__ import annotations

import numpy as np

from simcore.decisions.stochastic import explanation
from simcore.gambling.config import GamblingConfig, OperatorConfig
from simcore.gambling.population import PlayerArrays
from simcore.models.actions import Driver

# Driver keys (order is fixed; used for both the vectorized path and Drivers).
DRIVERS = ("payout", "breadth", "bonus", "brand", "friction", "taxfree", "protection", "marketing")


def player_betas(pop: PlayerArrays, gcfg: GamblingConfig) -> dict[str, np.ndarray]:
    """Per-player β weights on each driver, derived from the five axes. Friction
    aversion falls with risk (the tail is friction-tolerant); protection flips
    sign (a plus for low-risk players, a minus for high-risk ones); bonus appeal
    rises with risk and youth (β3 — the lever Spilpakke restricts).

    Also carries two non-driver betas: ``offshore_affinity`` (axis 5 → shifts
    utility toward unlicensed alternatives) and ``outside`` (the no-play
    alternative's utility, highest for low-risk players)."""
    risk = pop.risk
    young = (pop.age < gcfg.young_age_threshold).astype(float)
    return {
        "payout": 0.8 + 0.8 * risk,
        "breadth": 0.2 + 1.6 * risk + 0.3 * young,
        "bonus": 0.5 + 1.2 * risk + 0.5 * young,
        "brand": 1.0 - 0.5 * risk,
        "friction": 1.4 * (1.0 - 0.75 * risk),         # subtracted in the utility
        "taxfree": 0.8 * (1.0 - 0.5 * risk),
        "protection": 1.0 * (1.0 - risk) - 0.8 * risk,  # sign flips with risk
        "marketing": 0.4 + 0.9 * young + 0.3 * risk,
        "offshore_affinity": gcfg.offshore_affinity_beta * pop.offshore,
        "outside": gcfg.outside_risk_beta * (1.0 - risk),
    }


def operator_attr_arrays(operators: list[OperatorConfig]) -> dict[str, np.ndarray]:
    """Per-operator attribute vectors (order matches ``operators``).
    ``unlicensed`` marks the offshore/prediction channels for the per-player
    offshore-affinity shift."""
    return {
        "payout": np.array([o.payout for o in operators]),
        "breadth": np.array([o.product_breadth for o in operators]),
        "bonus": np.array([o.bonus for o in operators]),
        "brand": np.array([o.brand for o in operators]),
        "friction": np.array([o.friction for o in operators]),
        "taxfree": np.array([1.0 if o.tax_free else 0.0 for o in operators]),
        "protection": np.array([o.protection for o in operators]),
        "marketing": np.array([o.marketing_reach for o in operators]),
        "appeal": np.array([o.appeal for o in operators]),
        "unlicensed": np.array([0.0 if o.licensed else 1.0 for o in operators]),
    }


def utilities(
    betas: dict[str, np.ndarray],
    attrs: dict[str, np.ndarray],
    appeal_offset: np.ndarray | None = None,
) -> np.ndarray:
    """Utility matrix U[player, operator] (vectorized β·x)."""
    n = len(betas["payout"])
    m = len(attrs["payout"])
    u = np.zeros((n, m))
    u += betas["payout"][:, None] * attrs["payout"][None, :]
    u += betas["breadth"][:, None] * attrs["breadth"][None, :]
    u += betas["bonus"][:, None] * attrs["bonus"][None, :]
    u += betas["brand"][:, None] * attrs["brand"][None, :]
    u -= betas["friction"][:, None] * attrs["friction"][None, :]
    u += betas["taxfree"][:, None] * attrs["taxfree"][None, :]
    u += betas["protection"][:, None] * attrs["protection"][None, :]
    u += betas["marketing"][:, None] * attrs["marketing"][None, :]
    u += betas["offshore_affinity"][:, None] * attrs["unlicensed"][None, :]
    u += attrs["appeal"][None, :]
    if appeal_offset is not None:
        u += appeal_offset[None, :]
    return u


def choice_probabilities(u: np.ndarray, temperature: float) -> np.ndarray:
    """Softmax over alternatives per player (numerically stable)."""
    z = u / max(temperature, 1e-6)
    z -= z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def nested_choice_probabilities(
    u: np.ndarray, nest_index: np.ndarray, nest_lambdas: list[float], temperature: float,
) -> np.ndarray:
    """Two-level nested logit (numerically stable, vectorized).

    Plain MNL has the IIA property: a licensed entrant draws probability mass
    from offshore and the outside option *in proportion to their shares*, so
    entry mechanically raises channelization — exactly the setting where IIA is
    known to fail (critic finding). Nesting the alternatives (licensed /
    unlicensed / outside) with dissimilarity parameters λ < 1 makes substitution
    happen mostly *within* a nest: an entrant competes primarily with the other
    licensed operators.

    ``nest_index[j]`` assigns alternative j to a nest; ``nest_lambdas[k]`` is
    nest k's dissimilarity (λ = 1 for every nest reduces to plain MNL).
    P(j) = P(nest k) · P(j | k) with inclusive values
    IV_k = λ_k · logsumexp(u_j / λ_k) over j ∈ k.
    """
    z = u / max(temperature, 1e-6)
    n, m = z.shape
    n_nests = len(nest_lambdas)
    probs = np.zeros_like(z)
    ivs = np.full((n, n_nests), -np.inf)
    within: list[np.ndarray | None] = [None] * n_nests
    cols: list[np.ndarray] = [np.where(nest_index == k)[0] for k in range(n_nests)]

    for k, lam in enumerate(nest_lambdas):
        if len(cols[k]) == 0:
            continue
        lam = max(lam, 1e-3)
        zk = z[:, cols[k]] / lam
        zmax = zk.max(axis=1, keepdims=True)
        e = np.exp(zk - zmax)
        s = e.sum(axis=1, keepdims=True)
        within[k] = e / s
        ivs[:, k] = lam * (np.log(s) + zmax)[:, 0]

    iv_max = ivs.max(axis=1, keepdims=True)
    nest_e = np.where(np.isfinite(ivs), np.exp(ivs - iv_max), 0.0)
    nest_p = nest_e / nest_e.sum(axis=1, keepdims=True)

    for k in range(n_nests):
        if within[k] is not None:
            probs[:, cols[k]] = nest_p[:, [k]] * within[k]
    return probs


def budget_weighted_shares(probs: np.ndarray, weights: np.ndarray) -> np.ndarray:
    """Aggregate alternative shares = budget-weighted mean of choice probabilities."""
    w = weights / max(float(weights.sum()), 1e-12)
    return probs.T @ w


def explain_choice(
    operators: list[OperatorConfig], attrs: dict[str, np.ndarray],
    betas: dict[str, np.ndarray], player_idx: int, chosen_op: int, prob: float,
):
    """Re-express one player's operator choice through the stochastic core so the
    decision log carries the actual drivers (for reaction analysis)."""
    signed = {  # (+ for utility-adding drivers, − for friction)
        "payout": 1, "breadth": 1, "bonus": 1, "brand": 1, "friction": -1,
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
