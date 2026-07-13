"""AI diffusion — the core of the AI shock.

A global ``ai_frontier`` rises over time (base drift + optional shocks, the
latter delivered as events in Etape 4/5). Each operator adopts *toward* the
frontier via a logistic S-curve whose speed is its ``ai_adoption`` — early
adopters gain a temporary edge that decays as laggards catch up. AI capability
then feeds three market channels (Etape 3): personalization (a choice-utility
bump), market-size engagement (the best capability grows total demand), and — as
a dual-use lever wired in later — responsible-gambling detection.
"""
from __future__ import annotations

from simcore.gambling.config import GamblingConfig


class AIDiffusion:
    def __init__(self, gcfg: GamblingConfig):
        self.gcfg = gcfg
        self.frontier = gcfg.ai_frontier_start
        # Per-operator capability, keyed by operator_id (incl. entrants once they join).
        self.cap: dict[str, float] = {o.operator_id: o.ai_cap0 for o in gcfg.operators}
        # Baseline best capability — engagement (market-size growth) is measured
        # relative to this, so the market starts at the calibrated anchor.
        self.cap_baseline = self.best_cap()

    def register(self, operator_id: str, cap0: float) -> None:
        """Add an operator's capability track (used when an entrant joins)."""
        self.cap.setdefault(operator_id, cap0)

    def drop(self, operator_id: str) -> None:
        self.cap.pop(operator_id, None)

    def step(self, tick: int, frontier_shock: float = 0.0) -> None:
        """Advance the frontier and each operator's capability by one tick.
        ``frontier_shock`` is an additive jump ("wild AI"), supplied by events."""
        g = self.gcfg.ai_frontier_growth
        # drift toward 1.0 (saturating) + shock, clamped
        self.frontier = min(1.0, self.frontier + g * (1.0 - self.frontier) + frontier_shock)
        adoption = {o.operator_id: o.ai_adoption for o in self.gcfg.operators}
        adoption.update({e.operator_id: e.ai_adoption for e in self.gcfg.entrants})
        for oid, cap in list(self.cap.items()):
            rate = adoption.get(oid, 0.08)
            # logistic approach toward the frontier
            self.cap[oid] = cap + rate * (self.frontier - cap)

    def best_cap(self) -> float:
        return max(self.cap.values(), default=0.0)

    def personalization_offset(self, operators) -> "list[float]":
        """Per-operator choice-utility bump from AI personalization (order matches
        ``operators``). Measured *relative to the baseline best capability* —
        same convention as the engagement multiplier — so the calibrated t0
        market is undisturbed and only capability *gains* (or an entrant's
        AI-native edge over the incumbents' baseline) move choices."""
        gain = self.gcfg.ai_personalization_gain
        return [gain * (self.cap.get(o.operator_id, 0.0) - self.cap_baseline)
                for o in operators]

    def engagement_multiplier(self) -> float:
        """Global market-size multiplier: best AI capability *beyond baseline*
        grows total demand (personalized UX pulls in latent play). Relative to
        baseline so the market starts at the calibrated anchor. Used for
        market-wide appraisals (entry economics); per-track demand uses
        ``engagement_for`` instead."""
        excess = max(0.0, self.best_cap() - self.cap_baseline)
        return 1.0 + self.gcfg.ai_engagement_gain * excess

    def engagement_for(self, operators) -> float:
        """Per-track engagement multiplier: only the capability of operators
        actually *serving the track* can grow its demand — an AI-native casino
        does not grow the lottery market (cross-track spillover was a critic
        finding)."""
        caps = [self.cap.get(o.operator_id, 0.0) for o in operators]
        excess = max(0.0, max(caps, default=0.0) - self.cap_baseline)
        return 1.0 + self.gcfg.ai_engagement_gain * excess
