"""Recorder: buffered batch writer. The simulation thread is the only writer;
rows are flushed with executemany every ``flush_interval`` ticks."""
from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timezone
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from simcore.agents.actor import Actor
    from simcore.engine.simulation import Simulation
    from simcore.events.scheduler import EventRecord
    from simcore.markets.clearing import Trade
    from simcore.models.actions import Decision


class Recorder:
    def __init__(self, conn: sqlite3.Connection, run_id: str, flush_interval: int = 25):
        self.conn = conn
        self.run_id = run_id
        self.flush_interval = flush_interval
        self._asset_ticks: list[tuple] = []
        self._metrics: list[tuple] = []
        self._snapshots: list[tuple] = []
        self._trades: list[tuple] = []
        self._decisions: list[tuple] = []
        self._events: list[tuple] = []

    # ------------------------------------------------------------------ #
    def register_run(self, sim: "Simulation", label: str = "") -> None:
        self.conn.execute(
            "INSERT OR REPLACE INTO runs VALUES (?,?,?,?,?,?,?,?,?)",
            (
                self.run_id,
                label or sim.config.name,
                datetime.now(timezone.utc).isoformat(),
                sim.config.seed,
                "created",
                0,
                sim.config.ticks,
                sim.config.tick_resolution,
                sim.config.model_dump_json(),
            ),
        )
        rows = [
            (
                self.run_id, a.id, a.actor_type.value, a.name, a.state.strategy,
                json.dumps(asdict(a.traits)), a.state.initial_wealth,
            )
            for a in sim.actors
        ]
        self.conn.executemany("INSERT OR REPLACE INTO population VALUES (?,?,?,?,?,?,?)", rows)
        self.conn.commit()

    def set_status(self, status: str, tick: int) -> None:
        self.conn.execute(
            "UPDATE runs SET status=?, tick_count=? WHERE run_id=?", (status, tick, self.run_id)
        )
        self.conn.commit()

    # ------------------------------------------------------------------ #
    def asset_tick(self, tick: int, asset_id: str, price: float, fundamental: float,
                   volume: float, vol: float, spread: float) -> None:
        self._asset_ticks.append((self.run_id, tick, asset_id, price, fundamental, volume, vol, spread))

    def metrics(self, tick: int, metrics: dict[str, float]) -> None:
        self._metrics.extend((self.run_id, tick, k, float(v)) for k, v in metrics.items())

    def snapshot(self, tick: int, actor: "Actor", prices: dict[str, float]) -> None:
        s = actor.state
        self._snapshots.append(
            (
                self.run_id, tick, actor.id, s.wealth(prices), s.cash, s.leverage(prices),
                s.sentiment, s.stress, int(s.alive),
                json.dumps({k: round(v, 4) for k, v in s.positions.items() if abs(v) > 1e-9}),
            )
        )

    def trade(self, t: "Trade") -> None:
        self._trades.append(
            (self.run_id, t.tick, t.actor_id, t.asset_id, t.side, t.qty, t.price, int(t.forced))
        )

    def decision(self, tick: int, actor: "Actor", decision: "Decision") -> None:
        e = decision.explanation
        first = decision.intents[0] if decision.intents else None
        self._decisions.append(
            (
                self.run_id, tick, actor.id, actor.actor_type.value,
                e.model_name if e else actor.state.strategy,
                first.action.value if first else "hold",
                first.asset_id if first else None,
                first.qty if first else 0.0,
                e.decision_probability if e else 0.0,
                e.stress_level if e else actor.state.stress,
                e.score if e else 0.0,
                json.dumps([{"driver": n, "contribution": c} for n, c in e.main_drivers]) if e else "[]",
            )
        )

    def event(self, rec: "EventRecord") -> None:
        self._events.append(
            (self.run_id, rec.tick, rec.name, rec.event_type, rec.magnitude, rec.phase,
             json.dumps(rec.payload))
        )

    # ------------------------------------------------------------------ #
    def maybe_flush(self, tick: int) -> None:
        if tick % self.flush_interval == 0:
            self.flush()

    def flush(self) -> None:
        c = self.conn
        if self._asset_ticks:
            c.executemany("INSERT OR REPLACE INTO asset_ticks VALUES (?,?,?,?,?,?,?,?)", self._asset_ticks)
            self._asset_ticks.clear()
        if self._metrics:
            c.executemany("INSERT OR REPLACE INTO metrics VALUES (?,?,?,?)", self._metrics)
            self._metrics.clear()
        if self._snapshots:
            c.executemany("INSERT OR REPLACE INTO actor_snapshots VALUES (?,?,?,?,?,?,?,?,?,?)", self._snapshots)
            self._snapshots.clear()
        if self._trades:
            c.executemany("INSERT INTO trades VALUES (?,?,?,?,?,?,?,?)", self._trades)
            self._trades.clear()
        if self._decisions:
            c.executemany("INSERT INTO decisions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)", self._decisions)
            self._decisions.clear()
        if self._events:
            c.executemany("INSERT INTO events VALUES (?,?,?,?,?,?,?)", self._events)
            self._events.clear()
        c.commit()
