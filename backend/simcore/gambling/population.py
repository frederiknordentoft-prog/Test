"""Player universe — the most important single decision in the model.

The design perspective (§2.1) is emphatic: modelling a homogeneous / average
player is *the* deadly mistake, because it systematically overstates how well
tightening works (the heavy tail is the most price-elastic, most offshore-prone
and most harm-concentrated part, and it does not respond to advertising the way
the breadth does). So players are drawn on **five orthogonal, freely-combinable
axes** (not preset personas):

 1. vertical preference — over lottery / scratch / casino / sports
 2. consumption level  — heavy-tailed (lognormal); the concentration knob
 3. latent risk        — a PGSI-like continuous variable that can escalate later
 4. demographics       — age × gender (young men are a distinct class)
 5. offshore propensity— willingness to play unlicensed (rises with risk/youth)

Stored columnar (numpy) for speed at 500–20 000 agents. Etape 1 uses these to
produce calibrated aggregate BSI per track + customer counts + an income-
concentration metric; Etape 2 feeds the same axes into a multinomial-logit
operator choice.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from simcore.gambling.config import GamblingConfig


@dataclass(slots=True)
class PlayerArrays:
    budget: np.ndarray      # relative monthly spend capacity (heavy-tailed), pre-calibration
    risk: np.ndarray        # [0,1] latent risk profile
    age: np.ndarray         # years
    male: np.ndarray        # 1.0 male, 0.0 female
    offshore: np.ndarray    # [0,1] offshore propensity
    pref: np.ndarray        # [n, n_tracks] normalized track-preference weights
    track_ids: list[str]

    @property
    def n(self) -> int:
        return len(self.budget)


def build_population(gcfg: GamblingConfig, rng: np.random.Generator) -> PlayerArrays:
    """Draw the player population on the five axes. Deterministic given ``rng``."""
    n = gcfg.population
    tracks = [t.track_id for t in gcfg.tracks]
    idx = {tid: i for i, tid in enumerate(tracks)}

    # --- axis 4: demographics ---
    age = np.clip(rng.normal(42.0, 15.0, n), 18.0, 90.0)
    male = (rng.random(n) < gcfg.male_fraction).astype(float)
    young = age < gcfg.young_age_threshold

    # --- axis 3: latent risk (skewed low; higher for young men) ---
    risk = rng.beta(2.0, 6.0, n)
    risk = np.clip(risk + (young * male) * rng.uniform(0.10, 0.40, n), 0.0, 1.0)

    # --- axis 5: offshore propensity (rises with risk and youth) ---
    offshore = np.clip(0.35 * risk + 0.20 * young + 0.5 * rng.beta(2.0, 5.0, n), 0.0, 1.0)

    # --- axis 2: heavy-tailed monthly spend, coupled to risk ---
    # log-spend = coupling·(risk − mean) + N(0, σ): the top spenders are drawn
    # disproportionately from the high-risk tail, so the tail is not cosmetic —
    # it is the friction-tolerant, offshore-prone part of the BSI (perspective
    # §2.1). With coupling 0 this degrades to the old independent draw.
    budget = np.exp(gcfg.risk_spend_coupling * (risk - float(risk.mean()))
                    + rng.normal(0.0, gcfg.spend_sigma, n))

    # --- axis 1: vertical preference (sparse base + demographic/risk tilt) ---
    base = rng.dirichlet(np.full(len(tracks), 0.6), n)   # sparse-ish, heterogeneous
    tilt = np.zeros((n, len(tracks)))
    young_risky = 0.6 * risk + 0.4 * young.astype(float)
    older_safe = 0.5 * (age > 45).astype(float) + 0.5 * (1.0 - risk)
    if "casino" in idx:
        tilt[:, idx["casino"]] += young_risky
    if "sports" in idx:
        tilt[:, idx["sports"]] += 0.8 * young_risky + 0.3 * male
    if "lottery" in idx:
        tilt[:, idx["lottery"]] += older_safe
    if "scratch" in idx:
        tilt[:, idx["scratch"]] += 0.6 * older_safe
    pref = base * np.exp(tilt)
    pref = pref / pref.sum(axis=1, keepdims=True)

    return PlayerArrays(budget, risk, age, male, offshore, pref, tracks)


def calibrate_track_scale(pop: PlayerArrays, gcfg: GamblingConfig) -> np.ndarray:
    """Per-track scale factors so the population's aggregate monthly spend equals
    the anchor for each track (mio DKK). This makes the heterogeneous population
    reproduce the calibrated market size while still carrying the tail that
    matters for shocks."""
    raw = (pop.budget[:, None] * pop.pref).sum(axis=0)   # per-track raw weight
    anchor = np.array([t.annual_bsi / 12.0 * 1000.0 for t in gcfg.tracks])  # mio/month
    return anchor / np.maximum(raw, 1e-9)


def player_track_spend(pop: PlayerArrays, track_scale: np.ndarray) -> np.ndarray:
    """[n, n_tracks] calibrated monthly spend per player per track (mio DKK)."""
    return pop.budget[:, None] * pop.pref * track_scale[None, :]


def concentration(total_spend_per_player: np.ndarray, top_fraction: float) -> float:
    """Share of total BSI made up by the top ``top_fraction`` of players by spend
    (e.g. 0.05 → top-5 %). The core income-concentration diagnostic."""
    n = len(total_spend_per_player)
    if n == 0:
        return 0.0
    k = max(1, int(round(top_fraction * n)))
    top = np.sort(total_spend_per_player)[-k:]
    total = float(total_spend_per_player.sum())
    return float(top.sum() / total) if total > 0 else 0.0


def anchored_customer_counts(
    pop: PlayerArrays, gcfg: GamblingConfig,
    participation: dict[str, np.ndarray],
    scales: dict[str, float] | None = None,
    kappa: float | None = None,
) -> tuple[dict[str, float], dict[str, float], float]:
    """Per-track expected customer counts calibrated to ``customer_anchors``.

    The agent population carries the *dynamics* (who plays, per tick, from the
    choice probabilities); the anchors carry the *level* (~1.4 M lottery
    customers, a few hundred thousand per liberalized vertical — of ~4.5 M
    adult Danes). On the first call the per-track scale factors and the overlap
    factor κ (unique ÷ sum of track counts, from the agent-level engagement
    overlap) are calibrated and then held fixed, so policy/AI/entry move the
    counts away from the anchored baseline instead of being re-absorbed."""
    engaged = pop.pref >= gcfg.participation_threshold
    ones = np.ones(pop.n)
    raw: dict[str, float] = {}
    p_not_any = np.ones(pop.n)
    for i, tid in enumerate(pop.track_ids):
        p_customer = engaged[:, i] * participation.get(tid, ones)
        raw[tid] = float(p_customer.sum())
        p_not_any *= 1.0 - p_customer
    raw_unique = float((1.0 - p_not_any).sum())

    if scales is None or kappa is None:
        scales = {tid: gcfg.customer_anchors.get(tid, 0.0) / max(raw[tid], 1e-9)
                  for tid in pop.track_ids}
        # Overlap factor φ: how many *new* unique customers each additional
        # vertical adds beyond the largest one, measured in agent space. Keeps
        # unique ≥ the biggest vertical (a plain unique/sum ratio broke that
        # invariant once per-track people-scales diverged).
        raw_max = max(raw.values(), default=0.0)
        others = max(sum(raw.values()) - raw_max, 1e-9)
        kappa = max(0.0, raw_unique - raw_max) / others

    counts = {tid: raw[tid] * scales[tid] for tid in pop.track_ids}
    biggest = max(counts.values(), default=0.0)
    counts["_unique"] = biggest + kappa * (sum(counts[tid] for tid in pop.track_ids) - biggest)
    return counts, scales, kappa


def customer_counts(pop: PlayerArrays, gcfg: GamblingConfig,
                    participation: dict[str, np.ndarray] | None = None) -> dict[str, float]:
    """Per-track expected customer counts (scaled to ``represented_customers``)
    plus the unique total.

    A player is *engaged* with a track if their preference weight passes
    ``participation_threshold`` (multi-homing allowed). ``participation`` maps
    track_id → per-player probability of actually playing this month (1 − the
    outside-option probability from the choice model); the expected customer
    count is the sum of engaged × participating probabilities, so policy, AI and
    entry genuinely move customer counts every tick. Without ``participation``
    (pre-market init) the counts are the engaged-population upper bound."""
    scale_people = gcfg.represented_customers / max(pop.n, 1)
    engaged = pop.pref >= gcfg.participation_threshold          # [n, n_tracks] bool
    out: dict[str, float] = {}
    p_not_any = np.ones(pop.n)
    for i, tid in enumerate(pop.track_ids):
        p_play = np.ones(pop.n) if participation is None else participation.get(tid, np.ones(pop.n))
        p_customer = engaged[:, i] * p_play
        out[tid] = float(p_customer.sum()) * scale_people
        p_not_any *= 1.0 - p_customer
    out["_unique"] = float((1.0 - p_not_any).sum()) * scale_people
    return out
