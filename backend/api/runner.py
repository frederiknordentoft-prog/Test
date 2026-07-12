"""Run execution: one thread per live simulation (the loop is CPU-bound pure
Python, so an asyncio task would starve the event loop). Control is
event-based; live frames are pushed to WebSocket subscriber queues with
latest-wins coalescing (a slow client never blocks the simulation)."""
from __future__ import annotations

import asyncio
import threading
import time
import traceback
import uuid
from dataclasses import dataclass, field

from simcore.analytics.montecarlo import run_monte_carlo
from simcore.models.config import SimConfig

DB_PATH = "../data/simulator.db"
FRAME_INTERVAL = 0.1  # seconds between websocket frames (<=10 fps)


def make_simulation(config: SimConfig, db_path: str | None, run_id: str, label: str):
    """Pick the Simulation class by domain (imports are lazy so the finance
    path never pays for gambling code and vice versa)."""
    if getattr(config, "sim_domain", "finance") == "gambling":
        from simcore.gambling.simulation import GamblingSimulation

        return GamblingSimulation(config, db_path=db_path, run_id=run_id, label=label)
    from simcore.engine.simulation import Simulation

    return Simulation(config, db_path=db_path, run_id=run_id, label=label)


@dataclass
class Subscriber:
    queue: asyncio.Queue
    loop: asyncio.AbstractEventLoop


class RunHandle:
    def __init__(self, config: SimConfig, label: str = "", db_path: str | None = None):
        self.run_id = uuid.uuid4().hex[:12]
        self.config = config
        # resolve at call time so tests / deployments can repoint the module DB_PATH
        import api.runner as _runner_mod

        resolved_db = db_path if db_path is not None else _runner_mod.DB_PATH
        self.sim = make_simulation(config, resolved_db, self.run_id, label)
        self.label = label or config.name
        self.status = "created"
        self.error: str | None = None
        self._pause = threading.Event()
        self._pause.set()  # created runs start paused
        self._stop = threading.Event()
        self._step_budget: int | None = None
        self._budget_lock = threading.Lock()
        self.target_tps = 20.0
        self.subscribers: list[Subscriber] = []
        self._last_frame_time = 0.0
        self._last_event_idx = 0
        self.thread = threading.Thread(target=self._loop, daemon=True, name=f"sim-{self.run_id}")
        self.thread.start()

    # ------------------------------------------------------------------ #
    def _loop(self) -> None:
        try:
            while not self._stop.is_set() and self.sim.tick < self.config.ticks:
                if self._pause.is_set():
                    self.status = "paused" if self.status != "created" else self.status
                    time.sleep(0.03)
                    continue
                self.status = "running"
                t0 = time.time()
                self.sim.step()
                with self._budget_lock:
                    if self._step_budget is not None:
                        self._step_budget -= 1
                        if self._step_budget <= 0:
                            self._step_budget = None
                            self._pause.set()
                self._publish_frame()
                delay = 1.0 / self.target_tps - (time.time() - t0)
                if delay > 0:
                    time.sleep(delay)
            if self.sim.recorder:
                self.sim.recorder.flush()
                self.sim.recorder.set_status(
                    "finished" if self.sim.tick >= self.config.ticks else "stopped", self.sim.tick
                )
            self.status = "finished" if self.sim.tick >= self.config.ticks else "stopped"
            self._publish_frame(force=True)
        except Exception:  # pragma: no cover - defensive
            self.error = traceback.format_exc()
            self.status = "error"

    # ------------------------------------------------------------------ #
    def start(self) -> None:
        if self.status in ("created", "paused"):
            self._pause.clear()

    def pause(self) -> None:
        self._pause.set()

    def resume(self) -> None:
        self._pause.clear()

    def stop(self) -> None:
        self._stop.set()
        self._pause.clear()

    def step(self, n: int = 1) -> None:
        with self._budget_lock:
            self._step_budget = n
        self._pause.clear()

    def reset(self) -> "RunHandle":
        """Stop this run and build a fresh handle with the same config."""
        self.stop()
        self.thread.join(timeout=5)
        return RunHandle(self.config.model_copy(deep=True), label=self.label)

    # ------------------------------------------------------------------ #
    def frame(self) -> dict:
        if getattr(self.config, "sim_domain", "finance") == "gambling":
            return self._gambling_frame()
        sim = self.sim
        m = sim.metrics_history[-1] if sim.metrics_history else {}
        new_events = [
            {"tick": r.tick, "name": r.name, "type": r.event_type, "phase": r.phase,
             "magnitude": r.magnitude}
            for r in sim.events_log[self._last_event_idx:]
        ]
        self._last_event_idx = len(sim.events_log)
        return {
            "run_id": self.run_id,
            "tick": sim.tick,
            "ticks_target": self.config.ticks,
            "status": self.status,
            "prices": {aid: round(a.price, 4) for aid, a in sim.market.assets.items()},
            "fundamentals": {aid: round(a.fundamental, 4) for aid, a in sim.market.assets.items()},
            "volatility": {aid: round(a.sigma, 5) for aid, a in sim.market.assets.items()},
            "spread": {aid: round(a.spread, 5) for aid, a in sim.market.assets.items()},
            "volume": {aid: round(a.volume, 2) for aid, a in sim.market.assets.items()},
            "metrics": {
                k: round(float(m.get(k, 0.0)), 4)
                for k in (
                    "price_index", "systemic_risk", "mean_sentiment", "mean_stress",
                    "mean_leverage", "liquidity_index", "credit_tightness",
                    "bankruptcies_total", "margin_calls_total", "wealth_gini",
                    "employment_index", "forced_volume_share",
                )
            },
            "new_events": new_events,
        }

    def _gambling_frame(self) -> dict:
        """WebSocket/status frame for the gambling domain. Prices are per-track
        monthly BSI; metrics pass through every numeric series from the last
        tick so new series (share, customers, revenue, …) added in later etaper
        surface with no change here."""
        sim = self.sim
        m = sim.metrics_history[-1] if sim.metrics_history else {}
        new_events = [
            {"tick": r.tick, "name": r.name, "type": r.event_type, "phase": r.phase,
             "magnitude": r.magnitude}
            for r in sim.events_log[self._last_event_idx:]
        ]
        self._last_event_idx = len(sim.events_log)
        prices = sim.prices() if hasattr(sim, "prices") else {}
        return {
            "run_id": self.run_id,
            "tick": sim.tick,
            "ticks_target": self.config.ticks,
            "status": self.status,
            "domain": "gambling",
            "prices": {k: round(float(v), 3) for k, v in prices.items()},
            "metrics": {
                k: round(float(v), 4)
                for k, v in m.items()
                if k != "tick" and isinstance(v, (int, float))
            },
            "new_events": new_events,
        }

    def _publish_frame(self, force: bool = False) -> None:
        now = time.time()
        if not force and now - self._last_frame_time < FRAME_INTERVAL:
            return
        if not self.subscribers:
            return
        self._last_frame_time = now
        frame = self.frame()
        for sub in list(self.subscribers):
            def _put(q=sub.queue, f=frame):
                if q.full():
                    try:
                        q.get_nowait()  # coalesce: latest frame wins
                    except asyncio.QueueEmpty:
                        pass
                q.put_nowait(f)
            try:
                sub.loop.call_soon_threadsafe(_put)
            except RuntimeError:
                self.subscribers.remove(sub)

    def subscribe(self, loop: asyncio.AbstractEventLoop) -> Subscriber:
        sub = Subscriber(queue=asyncio.Queue(maxsize=1), loop=loop)
        self.subscribers.append(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        if sub in self.subscribers:
            self.subscribers.remove(sub)


class MonteCarloHandle:
    def __init__(self, config: SimConfig, seeds: list[int], label: str = ""):
        self.mc_id = uuid.uuid4().hex[:12]
        self.label = label or f"mc-{config.name}"
        self.status = "running"
        self.progress = 0
        self.total = len(seeds)
        self.result: dict | None = None
        self.error: str | None = None
        self._stop = threading.Event()

        def _run():
            try:
                self.result = run_monte_carlo(
                    config, seeds,
                    on_progress=self._on_progress,
                    should_stop=self._stop.is_set,
                )
                self.status = "finished" if not self._stop.is_set() else "stopped"
            except Exception:  # pragma: no cover
                self.error = traceback.format_exc()
                self.status = "error"

        self.thread = threading.Thread(target=_run, daemon=True, name=f"mc-{self.mc_id}")
        self.thread.start()

    def _on_progress(self, done: int, total: int) -> None:
        self.progress = done

    def stop(self) -> None:
        self._stop.set()


class SimulationRegistry:
    def __init__(self):
        self.runs: dict[str, RunHandle] = {}
        self.mc: dict[str, MonteCarloHandle] = {}

    def create(self, config: SimConfig, label: str = "") -> RunHandle:
        handle = RunHandle(config, label)
        self.runs[handle.run_id] = handle
        return handle

    def get(self, run_id: str) -> RunHandle:
        if run_id not in self.runs:
            raise KeyError(run_id)
        return self.runs[run_id]

    def replace(self, old_id: str, handle: RunHandle) -> None:
        self.runs.pop(old_id, None)
        self.runs[handle.run_id] = handle


REGISTRY = SimulationRegistry()
