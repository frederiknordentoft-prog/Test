"""Gambling-domain events: discrete policy/market shocks applied to the
RegulationState (and AI frontier) at a scheduled tick.

These are separate from the finance event library — the finance handlers expect
a finance market/population and must never run against a gambling sim. The
simulation applies any ``EventConfig`` whose ``event_type`` is in
``GAMBLING_EVENT_HANDLERS`` at its ``start_tick``. Effects scale with
``magnitude`` and can be overridden via ``params``.
"""
from __future__ import annotations

from typing import Callable


def _p(ev, key, default):
    return float(ev.params.get(key, default)) * (ev.magnitude if ev.magnitude else 1.0)


def spilpakke_1(reg, ev, sim) -> None:
    """Ad ban (whistle-to-whistle), bonus/affiliate restrictions, loss limits."""
    reg.ad_ban = min(1.0, reg.ad_ban + _p(ev, "ad_ban", 0.55))
    reg.rg_friction = min(3.0, reg.rg_friction + _p(ev, "rg_friction", 0.7))
    reg.loss_limits = min(1.0, reg.loss_limits + _p(ev, "loss_limits", 0.35))


def spilpakke_2(reg, ev, sim) -> None:
    """Targets prediction markets / offshore arbitrage: enforcement + friction."""
    reg.enforcement = min(1.0, reg.enforcement + _p(ev, "enforcement", 0.5))
    reg.rg_friction = min(3.0, reg.rg_friction + _p(ev, "rg_friction", 0.3))


def ad_ban(reg, ev, sim) -> None:
    reg.ad_ban = min(1.0, reg.ad_ban + _p(ev, "size", 0.5))


def tax_change(reg, ev, sim) -> None:
    reg.tax_add = min(1.0, max(-0.28, reg.tax_add + _p(ev, "size", 0.05)))


def enforcement_boost(reg, ev, sim) -> None:
    reg.enforcement = min(1.0, reg.enforcement + _p(ev, "size", 0.4))


def rg_2_0(reg, ev, sim) -> None:
    """Mandate proactive AI-based responsible-gambling detection (dual-use moat)."""
    reg.rg_detection = min(1.0, reg.rg_detection + _p(ev, "size", 0.5))


def liberalize(reg, ev, sim) -> None:
    """Loosen the monopoly scope (opens lottery/scratch to competition later)."""
    reg.monopoly_scope = max(0.0, reg.monopoly_scope - _p(ev, "size", 0.5))


def crash_games_licensed(reg, ev, sim) -> None:
    """Legalize the products (crash games/virtual sport) that today only exist
    offshore — licensed operators gain appeal, pulling channelization up."""
    reg.licensed_bonus = min(3.0, reg.licensed_bonus + _p(ev, "size", 0.8))


def ai_breakthrough(reg, ev, sim) -> None:
    """Wild-AI jump — pushes the frontier directly."""
    sim.ai.frontier = min(1.0, sim.ai.frontier + _p(ev, "size", 0.3))


def offshore_surge(reg, ev, sim) -> None:
    """A surge in offshore/prediction attractiveness (crypto casinos, Stake)."""
    reg.enforcement = max(0.0, reg.enforcement - _p(ev, "size", 0.3))


GAMBLING_EVENT_HANDLERS: dict[str, Callable] = {
    "spilpakke_1": spilpakke_1,
    "spilpakke_2": spilpakke_2,
    "ad_ban": ad_ban,
    "tax_change": tax_change,
    "enforcement_boost": enforcement_boost,
    "rg_2_0": rg_2_0,
    "liberalize": liberalize,
    "crash_games_licensed": crash_games_licensed,
    "ai_breakthrough": ai_breakthrough,
    "offshore_surge": offshore_surge,
}

GAMBLING_EVENT_TYPES = frozenset(GAMBLING_EVENT_HANDLERS)
