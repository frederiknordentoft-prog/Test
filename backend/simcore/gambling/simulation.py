"""GamblingSimulation: the tick-pipeline for the gambling domain.

Etape 0 is a working skeleton: each tick (a month) it computes per-track
monthly BSI (with the sports calendar) and records the market-size series. It
reuses the engine's RngHub and the Recorder, and exposes the same attribute
surface the finance ``Simulation`` does (``metrics_history``, ``asset_history``,
``events_log``, ``recent_decisions``/``recent_trades``, ``recorder``, ``tick``,
``run``/``step``/``state_hash``) so ``RunHandle``, the WebSocket frame and the
generic result endpoints work unchanged.

Players, operators, the multinomial-logit choice, channelization, AI diffusion,
entry and the stakeholder loops are layered on in Etape 1–5; the class keeps
this same shape.
"""
from __future__ import annotations

import hashlib
import uuid
from collections import deque

import numpy as np

from simcore.engine.rng import RngHub
from simcore.events.scheduler import EventRecord
from simcore.gambling.ai_diffusion import AIDiffusion
from simcore.gambling.config import GamblingConfig
from simcore.gambling.entry import EntryManager
from simcore.gambling.indicators import (
    compute_ai_entry_metrics,
    compute_gambling_metrics,
    compute_market_metrics,
    compute_population_metrics,
)
from simcore.gambling.market import AttractionMarket
from simcore.gambling.population import (
    build_population,
    calibrate_track_scale,
    customer_counts,
    player_track_spend,
)
from simcore.models.config import SimConfig
from simcore.persistence.db import connect
from simcore.persistence.recorder import Recorder

# Event types the gambling domain knows how to handle. Empty in Etape 0 — the
# generic finance handlers must never run against a gambling sim (they expect a
# finance market/population). Gambling event handlers are added in Etape 4.
GAMBLING_EVENT_TYPES: frozenset[str] = frozenset()


class GamblingSimulation:
    def __init__(self, config: SimConfig, db_path: str | None = None,
                 run_id: str | None = None, label: str = ""):
        self.config = config
        self.run_id = run_id or uuid.uuid4().hex[:12]
        self.gcfg = GamblingConfig.model_validate(config.gambling or {})
        self.hub = RngHub(config.seed, self.gcfg.population, len(self.gcfg.tracks))

        # No finance actors in the gambling domain (operators arrive in later
        # etaper). An empty list keeps Recorder.register_run happy.
        self.actors: list = []

        # Player universe (Etape 1): heavy-tailed spend on five orthogonal axes.
        self.pop = build_population(self.gcfg, self.hub.population)
        player_track = player_track_spend(self.pop, calibrate_track_scale(self.pop, self.gcfg))
        self.player_total = player_track.sum(axis=1)     # per-player monthly (concentration basis)
        self.customers = customer_counts(self.pop, self.gcfg)

        # Attraction market (Etape 2): per-track multinomial-logit operator
        # choice + channelization engine, calibrated to the baseline targets.
        self.market = AttractionMarket(self.gcfg, self.pop)

        # AI diffusion + entry/exit/M&A (Etape 3).
        self.ai = AIDiffusion(self.gcfg)
        self.entry = EntryManager(self.gcfg)
        self._last_results: dict = {}
        self._entry_event_idx = 0

        self.tick = 0
        self.metrics_history: list[dict] = []
        self.asset_history: list[dict] = []
        self.events_log: list = []
        self.recent_decisions: deque = deque(maxlen=3000)
        self.recent_trades: deque = deque(maxlen=3000)
        self.systemic_history: list[float] = []

        self.recorder: Recorder | None = None
        if db_path:
            conn = connect(db_path)
            self.recorder = Recorder(conn, self.run_id, config.recording.flush_interval)
            self.recorder.register_run(self, label)

    # ------------------------------------------------------------------ #
    def step(self) -> dict[str, float]:
        t = self.tick
        ai_on = self.gcfg.ai_enabled

        # 1. Entry/exit/M&A, evaluated against last tick's results + a dry-run
        #    (gated by the AI frontier, so big-tech needs wild AI to enter).
        if self.gcfg.entry_enabled:
            self.entry.evaluate(t, self.market, self.ai, self._last_results, self.hub.events)
            self.entry.check_exits(t, self.market, self.ai, self._last_results)
            self._drain_entry_events(t)

        # 2. Attraction market clears with AI personalization + engagement, using
        #    the *current* AI state (advanced at tick-end so t=0 is pristine).
        if ai_on:
            appeal_mods = {
                tid: np.array(self.ai.personalization_offset(tm.operators))
                for tid, tm in self.market.tracks.items()
            }
            engagement = self.ai.engagement_multiplier()
        else:
            appeal_mods, engagement = None, 1.0
        results = self.market.clear(t, appeal_mods, engagement)
        self._last_results = results
        bsi_by_track = {tid: r["licensed_bsi"] for tid, r in results.items()}

        metrics = compute_gambling_metrics(self.gcfg, t, bsi_by_track)
        metrics.update(
            compute_population_metrics(self.pop, self.gcfg, self.customers, self.player_total)
        )
        metrics.update(compute_market_metrics(self.gcfg, results))
        metrics.update(compute_ai_entry_metrics(self.gcfg, self.ai, self.entry, self.market))

        # 3. Advance AI for the next tick (frontier + per-operator capability).
        if ai_on:
            self.ai.step(t, frontier_shock=self._frontier_shock(t))

        # Per-track history (reuses the asset_tick shape so /assets works).
        for track_id, bsi in bsi_by_track.items():
            self.asset_history.append(
                {"tick": t, "asset_id": track_id, "price": round(bsi, 3),
                 "fundamental": 0.0, "volume": 0.0, "volatility": 0.0, "spread": 0.0}
            )
            if self.recorder:
                self.recorder.asset_tick(t, track_id, bsi, 0.0, 0.0, 0.0, 0.0)

        self.metrics_history.append({"tick": t, **metrics})
        self.systemic_history.append(0.0)
        if self.recorder:
            self.recorder.metrics(t, metrics)
            self.recorder.maybe_flush(t)

        self.tick += 1
        return metrics

    # ------------------------------------------------------------------ #
    def _frontier_shock(self, tick: int) -> float:
        """Additive AI-frontier jump at this tick from configured shocks
        (Etape 4/5 also inject shocks via events)."""
        return float(sum(s.get("size", 0.0) for s in self.gcfg.ai_shocks
                         if int(s.get("tick", -1)) == tick))

    def _drain_entry_events(self, tick: int) -> None:
        """Turn new entry/exit/M&A events into EventRecords for the log/recorder."""
        for ev in self.entry.events[self._entry_event_idx:]:
            rec = EventRecord(
                tick=ev["tick"], name=f'{ev["kind"]}: {ev["operator_id"]}',
                event_type=ev["kind"], magnitude=1.0, phase="start",
                payload={"operator_id": ev["operator_id"], "detail": ev.get("detail", "")},
            )
            self.events_log.append(rec)
            if self.recorder:
                self.recorder.event(rec)
        self._entry_event_idx = len(self.entry.events)

    # ------------------------------------------------------------------ #
    def run(self, n_ticks: int | None = None, on_tick=None, should_stop=None) -> None:
        n = n_ticks if n_ticks is not None else self.config.ticks
        for _ in range(n):
            if should_stop is not None and should_stop():
                break
            metrics = self.step()
            if on_tick is not None:
                on_tick(self.tick, metrics)
        if self.recorder:
            self.recorder.flush()
            self.recorder.set_status(
                "finished" if self.tick >= self.config.ticks else "stopped", self.tick
            )

    # ------------------------------------------------------------------ #
    def prices(self) -> dict[str, float]:
        """Latest per-track monthly BSI (used by the WebSocket frame)."""
        if not self.metrics_history:
            return {t.track_id: 0.0 for t in self.gcfg.tracks}
        m = self.metrics_history[-1]
        return {t.track_id: float(m.get(f"bsi_{t.track_id}", 0.0)) for t in self.gcfg.tracks}

    def state_hash(self) -> str:
        h = hashlib.sha256()
        h.update(np.int64(self.tick).tobytes())
        if self.metrics_history:
            m = self.metrics_history[-1]
            for t in self.gcfg.tracks:
                h.update(t.track_id.encode())
                h.update(np.float64(round(m.get(f"bsi_{t.track_id}", 0.0), 4)).tobytes())
        return h.hexdigest()
