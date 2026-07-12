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
from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig
from simcore.gambling.indicators import compute_gambling_metrics, compute_population_metrics
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

        # Player universe (Etape 1): heavy-tailed spend on five orthogonal axes,
        # calibrated so aggregate BSI per track matches the anchors.
        self.pop = build_population(self.gcfg, self.hub.population)
        self.track_scale = calibrate_track_scale(self.pop, self.gcfg)
        player_track = player_track_spend(self.pop, self.track_scale)  # [n, ntracks]
        self.track_base = player_track.sum(axis=0)                     # per-track monthly (mio)
        self.player_total = player_track.sum(axis=1)                   # per-player monthly (mio)
        self.customers = customer_counts(self.pop, self.gcfg)

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
        # Per-track monthly BSI from the calibrated population, with the sports
        # calendar on seasonal tracks and optional per-track noise.
        bsi_by_track = {}
        for i, track in enumerate(self.gcfg.tracks):
            v = float(self.track_base[i])
            if track.seasonal:
                v *= sports_intensity(t, self.gcfg.calendar)
            if self.gcfg.baseline_noise > 0:
                v *= float(np.exp(self.hub.assets[i].normal(0.0, self.gcfg.baseline_noise)))
            bsi_by_track[track.track_id] = v

        metrics = compute_gambling_metrics(self.gcfg, t, bsi_by_track)
        metrics.update(
            compute_population_metrics(self.pop, self.gcfg, self.customers, self.player_total)
        )

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
