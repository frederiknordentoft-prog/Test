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

    # --- axis 2: heavy-tailed monthly spend (concentration = spend_sigma) ---
    budget = rng.lognormal(0.0, gcfg.spend_sigma, n)

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


def customer_counts(pop: PlayerArrays, gcfg: GamblingConfig) -> dict[str, float]:
    """Per-track customer counts (scaled to represented_customers) plus the
    unique total. A player is a customer of a track if their preference weight
    for it is at least ``participation_threshold`` (multi-homing allowed)."""
    scale_people = gcfg.represented_customers / max(pop.n, 1)
    active = pop.pref >= gcfg.participation_threshold          # [n, n_tracks] bool
    out: dict[str, float] = {}
    for i, tid in enumerate(pop.track_ids):
        out[tid] = float(active[:, i].sum()) * scale_people
    out["_unique"] = float((active.any(axis=1)).sum()) * scale_people
    return out
