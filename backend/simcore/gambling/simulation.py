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
from simcore.gambling.events import GAMBLING_EVENT_HANDLERS
from simcore.gambling.harm import compute_harm
from simcore.gambling.indicators import (
    compute_ai_entry_metrics,
    compute_gambling_metrics,
    compute_market_metrics,
    compute_population_metrics,
    compute_revenue,
    compute_stakeholder_metrics,
)
from simcore.gambling.market import AttractionMarket
from simcore.gambling.operators import OperatorAgents
from simcore.gambling.stakeholders import (
    PoliticalAgent,
    Regulator,
    RegulationState,
    udlodning_from,
)
from simcore.gambling.trends import apply_config_trends, step_trends
from simcore.gambling.population import (
    anchored_customer_counts,
    build_population,
    calibrate_track_scale,
    customer_counts,
    player_track_spend,
)
from simcore.models.config import SimConfig
from simcore.persistence.db import connect
from simcore.persistence.recorder import Recorder


class GamblingSimulation:
    def __init__(self, config: SimConfig, db_path: str | None = None,
                 run_id: str | None = None, label: str = ""):
        self.config = config
        self.run_id = run_id or uuid.uuid4().hex[:12]
        self.gcfg = GamblingConfig.model_validate(config.gambling or {})
        # Long-run trends: one-off parameter adjustments (growth rates, AI
        # speed) apply before anything is built, so they flow into the run's
        # dynamics without disturbing the t0 level anchors.
        apply_config_trends(self.gcfg)
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

        # AI diffusion + entry/exit/M&A (Etape 3) + endogenous operator agents.
        self.ai = AIDiffusion(self.gcfg)
        self.entry = EntryManager(self.gcfg)
        self.operators = OperatorAgents(self.gcfg)
        self._last_results: dict = {}
        self._entry_event_idx = 0

        # Stakeholders + the four loops (Etape 4).
        self.reg = RegulationState()
        self.regulator = Regulator(self.gcfg)
        self.political = PoliticalAgent(self.gcfg)
        self._measured_hist: list[float] = []
        self._udlodning_baseline: float | None = None

        # ROFUS self-exclusion register (near-absorbing player state).
        self.rofus = np.zeros(self.pop.n, dtype=bool)
        self._rofus_inflow = 0.0

        # Customer-count calibration state (anchored on the first clear).
        self._cust_scales: dict[str, float] | None = None
        self._cust_kappa: float | None = None
        self._customer_base: float | None = None   # baseline unique customers (ROFUS scale)

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
        stake_on = self.gcfg.stakeholders_enabled

        # 1. Scheduled policy/market events (Spilpakke, ad ban, tax, ...) and
        #    the monthly drift from long-run trends (regulatory creep,
        #    offshore professionalization, prediction-loophole growth).
        self._apply_gambling_events(t)
        step_trends(self)

        # 2. Entry/exit/M&A, gated by the AI frontier (big-tech needs wild AI).
        if self.gcfg.entry_enabled:
            self.entry.evaluate(t, self.market, self.ai, self._last_results, self.hub.events)
            self.entry.check_exits(t, self.market, self.ai, self._last_results)
            self._drain_entry_events(t)

        # 2b. Endogenous operator behaviour: licensed operators reallocate
        #     their commercial budget when regulation closes channels
        #     (ad ban → brand/product/F2P — the Klub Lotto pattern).
        if self.gcfg.operators_enabled:
            self.operators.step(t, self.market, self.reg, self)

        # 3. Clear the market: policy acts on operator attributes (mediated by
        #    per-segment betas), AI adds personalization offsets, and each track
        #    carries its observed growth trend + optional baseline noise. The
        #    market clears with the *current* AI state (advanced at tick-end).
        ai_offsets = self._ai_offsets() if ai_on else None
        # Engagement is per track: only operators serving a track can grow its
        # demand (no cross-track AI spillover from casino into lottery).
        engagement: float | dict[str, float] = 1.0
        if ai_on:
            engagement = {tid: self.ai.engagement_for(tm.operators)
                          for tid, tm in self.market.tracks.items()}
        reg = self.reg if stake_on else None
        rofus = self.rofus if self.gcfg.rofus_enabled else None
        results = self.market.clear(t, reg, ai_offsets, engagement, self._noise(), rofus)
        self._last_results = results
        bsi_by_track = {tid: r["licensed_bsi"] for tid, r in results.items()}

        # Customer counts are endogenous (participation probabilities drive the
        # dynamics) and anchored (per-track scales calibrated once, at t0, to
        # the recognizable Danish levels — ~1.4 M lottery customers etc.).
        self.customers, self._cust_scales, self._cust_kappa = anchored_customer_counts(
            self.pop, self.gcfg, self.market.participation(),
            self._cust_scales, self._cust_kappa,
        )
        if self._customer_base is None:
            self._customer_base = max(self.customers.get("_unique", 1.0), 1.0)

        metrics = compute_gambling_metrics(self.gcfg, t, bsi_by_track)
        metrics.update(
            compute_population_metrics(self.pop, self.gcfg, self.customers, self.player_total)
        )
        metrics.update(compute_market_metrics(self.gcfg, results))
        metrics.update(compute_ai_entry_metrics(self.gcfg, self.ai, self.entry, self.market))
        metrics.update(compute_revenue(self.gcfg, self.reg, results))

        # 3b. ROFUS: high-risk players playing licensed can self-exclude
        #     (boosted by AI-based RG detection); near-absorbing.
        if self.gcfg.rofus_enabled:
            self._rofus_step()
            people = self._customer_base or self.gcfg.represented_customers
            metrics["rofus_stock"] = round(float(self.rofus.mean()) * people, 0)
            metrics["rofus_inflow"] = round(self._rofus_inflow, 0)

        # 4. Harm + the stakeholder loops (measured vs true harm, regulator with
        #    enforcement decay, delayed political agent, udlodning resistance).
        if stake_on:
            harm = compute_harm(self.gcfg, self.reg, results, self.pop, self.market)
            metrics.update(harm)
            self._measured_hist.append(harm["measured_harm"])
            udl = udlodning_from(self.gcfg, metrics.get("ds_bsi_total", 0.0))
            if self._udlodning_baseline is None:
                self._udlodning_baseline = max(udl, 1e-9)
            if self.gcfg.regulator_enabled:
                self.regulator.update(self.reg, harm["measured_harm"],
                                      metrics.get("offshore_share", 0.0))
            if self.gcfg.political_enabled and self.political.update(
                self.reg, self._measured_hist, t, udl, self._udlodning_baseline
            ):
                self._log_gambling_event(t, f"Politisk stramning #{self.political.packages}",
                                         "political_tightening", "delayed reaction to visible harm")
            metrics.update(compute_stakeholder_metrics(self.reg, udl, self.political))

        # 5. Advance AI for the next tick (frontier + per-operator capability).
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
    def _ai_offsets(self) -> dict[str, np.ndarray]:
        """Per-track, per-operator choice-utility offsets from AI personalization."""
        return {tid: np.array(self.ai.personalization_offset(tm.operators))
                for tid, tm in self.market.tracks.items()}

    def _rofus_step(self) -> None:
        """ROFUS inflow/exit. Inflow hazard rises with the player's latent risk
        (squared — the escalated tail self-excludes), with how much licensed
        play they actually have (only visible players are caught/nudged), and
        with AI-based RG detection. Exit is rare: near-absorbing."""
        g = self.gcfg
        lic_play = np.zeros(self.pop.n)
        n_tracks = 0
        for tm in self.market.tracks.values():
            if tm.last_lic_prob is not None:
                lic_play += tm.last_lic_prob
                n_tracks += 1
        if n_tracks:
            lic_play /= n_tracks
        hazard = (g.rofus_base_rate * (self.pop.risk ** 2) * lic_play
                  * (1.0 + g.rofus_detection_gain * self.reg.rg_detection))
        rng = self.hub.economy
        inflow = (~self.rofus) & (rng.random(self.pop.n) < hazard)
        outflow = self.rofus & (rng.random(self.pop.n) < g.rofus_exit_rate)
        self.rofus = (self.rofus | inflow) & ~outflow
        self._rofus_inflow = float(inflow.sum()) / max(self.pop.n, 1) * g.represented_customers

    def _noise(self) -> dict[str, float] | None:
        """Per-track multiplicative baseline noise (mean-one lognormal), drawn
        from the per-track RNG streams so runs stay reproducible per seed. The
        real betting series is 'extremely volatile' — a perfectly smooth
        baseline misreads as precision."""
        sigma = self.gcfg.baseline_noise
        if sigma <= 0.0:
            return None
        out: dict[str, float] = {}
        for i, t in enumerate(self.gcfg.tracks):
            rng = self.hub.assets[i % len(self.hub.assets)]
            out[t.track_id] = float(np.exp(rng.normal(0.0, sigma) - 0.5 * sigma * sigma))
        return out

    def _apply_gambling_events(self, tick: int) -> None:
        """Apply scheduled policy/market events. ``duration > 1`` phases the
        event in as a ramp: the handler runs every tick of the window with
        magnitude/duration, so e.g. Spilpakke 1 builds up over its real 14-month
        implementation period instead of landing as a one-tick cliff."""
        for ev in self.config.events:
            if ev.start_tick is None or ev.event_type not in GAMBLING_EVENT_HANDLERS:
                continue
            dur = max(1, ev.duration)
            if not (ev.start_tick <= tick < ev.start_tick + dur):
                continue
            step_ev = ev if dur == 1 else ev.model_copy(
                update={"magnitude": (ev.magnitude or 1.0) / dur}
            )
            GAMBLING_EVENT_HANDLERS[ev.event_type](self.reg, step_ev, self)
            if tick == ev.start_tick:
                detail = ev.description or ""
                if dur > 1:
                    detail = (detail + f" (indfases over {dur} måneder)").strip()
                self._log_gambling_event(tick, ev.name or ev.event_type, ev.event_type, detail)

    def _log_gambling_event(self, tick: int, name: str, event_type: str, detail: str) -> None:
        rec = EventRecord(tick=tick, name=name, event_type=event_type, magnitude=1.0,
                          phase="start", payload={"detail": detail})
        self.events_log.append(rec)
        if self.recorder:
            self.recorder.event(rec)

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
