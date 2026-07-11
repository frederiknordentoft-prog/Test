"""Event scheduler: fires scheduled and probabilistic events, manages
durations, escalation and early de-escalation."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from simcore.events.library import EVENT_HANDLERS
from simcore.models.config import EventConfig

if TYPE_CHECKING:
    from simcore.engine.simulation import Simulation


@dataclass(slots=True)
class ActiveEvent:
    cfg: EventConfig
    start_tick: int
    end_tick: int


@dataclass(slots=True)
class EventRecord:
    tick: int
    name: str
    event_type: str
    magnitude: float
    phase: str
    payload: dict = field(default_factory=dict)


class EventScheduler:
    def __init__(self, events: list[EventConfig]):
        # copy configs so runtime params (_target etc.) don't leak between runs
        self.pending: list[EventConfig] = [e.model_copy(deep=True) for e in events]
        self.active: list[ActiveEvent] = []
        self.records: list[EventRecord] = []

    def process(self, sim: "Simulation") -> list[EventRecord]:
        tick = sim.tick
        rng = sim.hub.events
        new_records: list[EventRecord] = []

        # fire pending events
        still_pending: list[EventConfig] = []
        for ev in self.pending:
            fire = False
            if ev.start_tick is not None:
                fire = ev.start_tick == tick
                keep = ev.start_tick > tick
            else:
                fire = ev.probability > 0 and rng.random() < ev.probability
                keep = True  # hazard events can re-fire
            handler = EVENT_HANDLERS.get(ev.event_type)
            if fire and handler is not None:
                handler(sim, ev, "start")
                new_records.append(EventRecord(tick, ev.name, ev.event_type, ev.magnitude, "start"))
                if ev.duration > 1:
                    self.active.append(ActiveEvent(ev, tick, tick + ev.duration))
                if ev.escalation_probability > 0 and rng.random() < ev.escalation_probability:
                    esc = ev.model_copy(deep=True)
                    esc.name = f"{ev.name}_escalation"
                    esc.magnitude = ev.magnitude * 1.5
                    esc.start_tick = tick + max(2, ev.duration // 2)
                    esc.escalation_probability = 0.0
                    still_pending.append(esc)
            if keep and not (fire and ev.start_tick is not None):
                still_pending.append(ev)
        self.pending = still_pending

        # advance active events
        still_active: list[ActiveEvent] = []
        for ae in self.active:
            handler = EVENT_HANDLERS.get(ae.cfg.event_type)
            if handler is None:
                continue
            de_escalated = (
                ae.cfg.de_escalation_probability > 0
                and rng.random() < ae.cfg.de_escalation_probability
            )
            if tick >= ae.end_tick or de_escalated:
                handler(sim, ae.cfg, "end")
                phase = "de_escalated" if de_escalated else "end"
                new_records.append(
                    EventRecord(tick, ae.cfg.name, ae.cfg.event_type, ae.cfg.magnitude, phase)
                )
            else:
                handler(sim, ae.cfg, "tick")
                still_active.append(ae)
        self.active = still_active

        self.records.extend(new_records)
        return new_records
