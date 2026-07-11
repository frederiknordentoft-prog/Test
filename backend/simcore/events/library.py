"""Event library: 12 generic external event types.

Handlers *parameterize shocks* (rates, capacity, costs, income, margins,
signals) — they never encode market outcomes. What happens next emerges from
actor reactions. Each handler acts on phases: "start", "tick" (each tick while
active), "end" (revert temporary effects).
"""
from __future__ import annotations

from typing import TYPE_CHECKING, Callable

import numpy as np

from simcore.engine.clock import TICKS_PER_YEAR, TickResolution
from simcore.information.signals import Signal
from simcore.models.actions import Action, ActionIntent, Domain
from simcore.models.actor_state import ActorType
from simcore.models.config import EventConfig

if TYPE_CHECKING:
    from simcore.engine.simulation import Simulation


def _emit(sim: "Simulation", ev: EventConfig, hint: float, asset_id: str | None = None,
          social: bool = True, magnitude: float | None = None, truth: float | None = None) -> None:
    sig = Signal(
        topic=ev.event_type,
        asset_id=asset_id,
        magnitude=magnitude if magnitude is not None else ev.magnitude,
        sentiment_hint=hint,
        credibility=ev.signal.credibility,
        truth=truth if truth is not None else ev.signal.truth,
        source=ev.name,
        created_tick=sim.tick,
        social=social,
        meta={"duration": max(ev.duration, 3)},
    )
    sim.bus.emit(sim.tick, sig, sim.arrays, publicity=ev.signal.publicity,
                 channel_delay=ev.signal.channel_delay)


def _largest(sim: "Simulation", actor_type: ActorType, ev: EventConfig):
    target_id = ev.targets.get("actor_id")
    if target_id is not None:
        return sim.actors[int(target_id)]
    candidates = [a for a in sim.actors if a.actor_type == actor_type and a.state.alive]
    if not candidates:
        return None
    if actor_type == ActorType.FIRM:
        listed = [a for a in candidates if a.econ and a.econ.listed_asset]
        candidates = listed or candidates
    prices = sim.market.prices()
    return max(candidates, key=lambda a: a.state.wealth(prices) + (a.econ.capacity if a.econ else 0.0))


# --------------------------------------------------------------------------- #
def rate_hike(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    per_year = TICKS_PER_YEAR[TickResolution(sim.config.tick_resolution)]
    delta = 0.01 * ev.magnitude / per_year
    sim.market.risk_free_rate += delta
    _emit(sim, ev, hint=-0.35 * ev.magnitude)


def profit_warning(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    firm = _largest(sim, ActorType.FIRM, ev)
    if firm is None or firm.econ is None:
        return
    firm.state.internal_state["earnings_shock"] = min(0.9, 0.3 * ev.magnitude)
    firm.econ.earnings_smoothed *= max(0.0, 1.0 - 0.25 * ev.magnitude)
    _emit(sim, ev, hint=-0.5 * ev.magnitude, asset_id=firm.econ.listed_asset)


def supplier_stoppage(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    supplier = ev.params.get("_target")
    if phase == "start":
        supplier = _largest(sim, ActorType.SUPPLIER, ev)
        if supplier is None:
            return
        ev.params["_target"] = supplier
        supplier.state.internal_state["capacity_factor"] = max(0.0, 1.0 - 0.9 * ev.magnitude)
        _emit(sim, ev, hint=-0.3 * ev.magnitude, social=True)
    elif phase == "end" and supplier is not None:
        supplier.state.internal_state["capacity_factor"] = 1.0


def rumor(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    asset_id = ev.targets.get("asset_id")
    if asset_id is None:
        asset_ids = list(sim.market.assets)
        asset_id = asset_ids[int(sim.hub.events.integers(0, len(asset_ids)))]
    _emit(sim, ev, hint=-0.6 * ev.magnitude, asset_id=asset_id, social=True, truth=0.0)


def institutional_selloff(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase == "start":
        inst = _largest(sim, ActorType.INSTITUTIONAL, ev)
        if inst is None:
            return
        ev.params["_target"] = inst
        ev.params["_frac_per_tick"] = min(0.9, 0.3 * ev.magnitude) / max(ev.duration, 1)
        _emit(sim, ev, hint=-0.3 * ev.magnitude, social=True)
    if phase in ("start", "tick"):
        inst = ev.params.get("_target")
        frac = ev.params.get("_frac_per_tick", 0.0)
        if inst is None or not inst.state.alive:
            return
        for asset_id, pos in list(inst.state.positions.items()):
            if pos > 1e-9:
                sim.event_intents.append(
                    ActionIntent(inst.id, Action.SELL, Domain.MARKET, asset_id, pos * frac)
                )


def credit_tightening(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    for b in sim.credit.bank_ids:
        sim.credit.bank_delta[b] = float(np.clip(sim.credit.bank_delta[b] + 0.2 * ev.magnitude, -0.25, 1.0))
    sim.credit._recompute(sim.actors, sim.market)
    _emit(sim, ev, hint=-0.25 * ev.magnitude, social=False)


def capital_requirements(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    sim.market.maintenance_margin = float(
        np.clip(sim.market.maintenance_margin + 0.05 * ev.magnitude,
                sim.market.baseline_maintenance, sim.market.baseline_maintenance + 0.2)
    )
    sim.market.initial_margin = sim.market.maintenance_margin + 0.15
    sim.credit.regulatory_delta = float(np.clip(sim.credit.regulatory_delta + 0.1 * ev.magnitude, 0.0, 0.5))
    sim.credit._recompute(sim.actors, sim.market)
    _emit(sim, ev, hint=-0.2 * ev.magnitude)


def commodity_spike(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    factor = 1.0 + 0.4 * ev.magnitude
    for s in sim.actors:
        if s.actor_type == ActorType.SUPPLIER:
            if phase == "start":
                s.state.internal_state["cost_index"] = float(s.state.internal_state.get("cost_index", 1.0)) * factor
            elif phase == "end":
                s.state.internal_state["cost_index"] = float(s.state.internal_state.get("cost_index", 1.0)) / factor
    if phase == "start":
        _emit(sim, ev, hint=-0.25 * ev.magnitude)


def demand_drop(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    factor = max(0.1, 1.0 - 0.25 * ev.magnitude)
    for c in sim.actors:
        if c.actor_type == ActorType.CUSTOMER:
            if phase == "start":
                c.state.internal_state["income_factor"] = factor
            elif phase == "end":
                c.state.internal_state["income_factor"] = 1.0
    if phase == "start":
        _emit(sim, ev, hint=-0.3 * ev.magnitude)


def tech_breakthrough(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    if phase != "start":
        return
    for f in sim.actors:
        if f.actor_type == ActorType.FIRM and f.state.alive and f.econ is not None:
            f.econ.earnings_smoothed *= 1.0 + 0.15 * ev.magnitude
    _emit(sim, ev, hint=0.5 * ev.magnitude)


def cyberattack(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    firm = ev.params.get("_target")
    if phase == "start":
        firm = _largest(sim, ActorType.FIRM, ev)
        if firm is None:
            return
        ev.params["_target"] = firm
        firm.state.internal_state["capacity_factor"] = max(0.0, 1.0 - 0.7 * ev.magnitude)
        _emit(sim, ev, hint=-0.5 * ev.magnitude,
              asset_id=firm.econ.listed_asset if firm.econ else None, social=True)
    elif phase == "end" and firm is not None:
        firm.state.internal_state["capacity_factor"] = 1.0


def margin_shock(sim: "Simulation", ev: EventConfig, phase: str) -> None:
    delta = 0.1 * ev.magnitude
    if phase == "start":
        ev.params["_delta"] = delta
        sim.market.maintenance_margin += delta
        sim.market.initial_margin += delta
        _emit(sim, ev, hint=-0.3 * ev.magnitude, social=False)
    elif phase == "end":
        d = ev.params.get("_delta", delta)
        sim.market.maintenance_margin = max(sim.market.baseline_maintenance, sim.market.maintenance_margin - d)
        sim.market.initial_margin = sim.market.maintenance_margin + 0.15


EVENT_HANDLERS: dict[str, Callable] = {
    "rate_hike": rate_hike,
    "profit_warning": profit_warning,
    "supplier_stoppage": supplier_stoppage,
    "rumor": rumor,
    "institutional_selloff": institutional_selloff,
    "credit_tightening": credit_tightening,
    "capital_requirements": capital_requirements,
    "commodity_spike": commodity_spike,
    "demand_drop": demand_drop,
    "tech_breakthrough": tech_breakthrough,
    "cyberattack": cyberattack,
    "margin_shock": margin_shock,
}
