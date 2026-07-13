"""Endogenous operator behaviour: per-tick commercial budget reallocation.

Each licensed operator manages four channels — marketing, bonus, brand,
product — anchored at its archetype values (`OperatorConfig` at t0). At
baseline every channel is open and attributes rest at their anchors, so the
calibrated market is undisturbed. When regulation closes a channel (an ad ban
zeroes marketing's effect, bonus restrictions cut bonuses), the operator
*reallocates* the stranded budget to the channels still open — brand, product,
free-to-play top-of-funnel — at reduced efficiency
(``op_realloc_substitutability``): the Klub Lotto pattern the dossier documents
(§10.5), and the reason an ad ban is not simply "everyone stands still".

The response scales with ``aggressiveness``: a high-burn challenger (Betano)
pivots hard; a retail/brand incumbent moves less. Attributes drift toward their
targets at ``op_adjust_rate`` per month, so the pivot takes ~a year, not a
tick. Every reallocation is logged through the engine's explanation machinery
(``Driver`` + drivers list), so the decision log / reaction analysis can show
*who* reallocated, *what* to, and *why*.
"""
from __future__ import annotations

from simcore.gambling.config import GamblingConfig
from simcore.models.actions import Driver

# channel -> OperatorConfig attribute
CHANNELS = {
    "marketing": "marketing_reach",
    "bonus": "bonus",
    "brand": "brand",
    "product": "product_breadth",
}


class OperatorAgents:
    def __init__(self, gcfg: GamblingConfig):
        self.gcfg = gcfg
        # Archetype anchors, captured at t0 (also for entrants when they join).
        self.base: dict[str, dict[str, float]] = {}
        for op in gcfg.operators:
            self._register(op)

    def _register(self, op) -> None:
        self.base[op.operator_id] = {c: float(getattr(op, attr)) for c, attr in CHANNELS.items()}

    # ------------------------------------------------------------------ #
    def _openness(self, reg) -> dict[str, float]:
        return {
            "marketing": max(0.0, 1.0 - reg.ad_ban),
            "bonus": max(0.0, 1.0 - reg.bonus_restriction),
            "brand": 1.0,
            "product": 1.0,
        }

    def step(self, tick: int, market, reg, sim=None) -> None:
        """Drift every licensed operator's channel attributes toward its
        current targets: archetype anchors, plus stranded budget from closed
        channels reallocated to the open ones."""
        openness = self._openness(reg)
        moved = False
        for op in market.operators:
            if not op.licensed:
                continue
            base = self.base.get(op.operator_id)
            if base is None:                      # entrant that joined mid-run
                self._register(op)
                base = self.base[op.operator_id]

            # Budget stranded in closed channels, scaled by how hard this
            # operator plays its levers and how substitutable the channels are.
            freed = sum(base[c] * (1.0 - openness[c]) for c in CHANNELS)
            freed *= op.aggressiveness * self.gcfg.op_realloc_substitutability

            open_weight = {c: base[c] * openness[c] for c in CHANNELS}
            total_open = sum(open_weight.values()) or 1.0

            drivers = []
            for c, attr in CHANNELS.items():
                target = base[c] + freed * (open_weight[c] / total_open)
                target = min(1.0, target)
                cur = float(getattr(op, attr))
                nxt = cur + self.gcfg.op_adjust_rate * (target - cur)
                if abs(nxt - cur) > 1e-9:
                    setattr(op, attr, round(nxt, 6))
                    moved = True
                    drivers.append(Driver(name=f"realloc→{c}", value=target - cur,
                                          weight=op.aggressiveness))
            if drivers and sim is not None:
                sim.recent_decisions.append({
                    "tick": tick,
                    "actor_id": -abs(hash(op.operator_id)) % 100000,
                    "actor_type": "operator",
                    "model": "budget_reallocation",
                    "action": "reallocate",
                    "asset_id": op.operator_id,
                    "qty": round(freed, 4),
                    "explanation": {
                        "model_name": "budget_reallocation",
                        "main_drivers": [(d.name, round(d.contribution, 4)) for d in drivers[:3]],
                        "decision_probability": 1.0,
                        "stress_level": 0.0,
                        "score": round(freed, 4),
                    },
                })
        if moved:
            market.refresh_attrs()
