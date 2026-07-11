"""SignalBus: the information layer.

Signals reach actors with per-actor delay (channel delay + the actor's own
information_delay trait). Social signals (rumors, media stories) additionally
propagate hop-by-hop over the social network with pass-through probability
proportional to edge strength and receiver herd tendency. Fabricated signals
(truth < 0.5) schedule a public correction after their duration — believers
lose trust in the source when it arrives.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from simcore.agents.population import PopulationArrays
from simcore.networks.layers import MultiLayerNetwork


@dataclass(slots=True)
class Signal:
    topic: str
    asset_id: str | None
    magnitude: float          # signed strength of the story
    sentiment_hint: float     # -1..1 suggested sentiment push
    credibility: float
    truth: float              # 1 true .. 0 fabricated
    source: str
    created_tick: int
    social: bool = False      # spreads over the social layer
    meta: dict = field(default_factory=dict)


class SignalBus:
    def __init__(self, n_actors: int, rng: np.random.Generator):
        self.n = n_actors
        self.rng = rng
        self._queue: dict[int, list[tuple[int, Signal]]] = {}
        self._spreading: list[tuple[Signal, np.ndarray]] = []  # (signal, informed bool vector)
        self._corrections: list[tuple[int, Signal]] = []

    # ------------------------------------------------------------------ #
    def emit(
        self,
        tick: int,
        signal: Signal,
        arrays: PopulationArrays,
        publicity: float = 1.0,
        channel_delay: int = 0,
        audience: list[int] | None = None,
    ) -> None:
        """Deliver to a share of the population (publicity) or an explicit
        audience, with per-actor delays."""
        if audience is None:
            mask = self.rng.random(self.n) < publicity
            audience = list(np.flatnonzero(mask & arrays.alive))
        for i in audience:
            deliver = tick + channel_delay + int(arrays.info_delay[i])
            self._queue.setdefault(deliver, []).append((int(i), signal))
        if signal.social:
            informed = np.zeros(self.n, dtype=bool)
            informed[audience] = True
            self._spreading.append((signal, informed))
        if signal.truth < 0.5:
            correction = Signal(
                topic=f"correction_{signal.topic}",
                asset_id=signal.asset_id,
                magnitude=-signal.magnitude * 0.8,
                sentiment_hint=-signal.sentiment_hint * 0.8,
                credibility=0.95,
                truth=1.0,
                source="fact_check",
                created_tick=tick,
                meta={"corrects": signal.source},
            )
            reveal = tick + int(signal.meta.get("duration", 5)) + 2
            self._corrections.append((reveal, correction))

    def social_step(self, tick: int, net: MultiLayerNetwork, arrays: PopulationArrays) -> None:
        """One hop of social contagion for all spreading signals."""
        if not self._spreading:
            return
        adj = net.adjacency("social")
        still: list[tuple[Signal, np.ndarray]] = []
        for signal, informed in self._spreading:
            age = tick - signal.created_tick
            if age > int(signal.meta.get("duration", 5)) + 3:
                continue  # story went stale
            exposure = adj @ informed.astype(float)          # weighted informed-neighbor mass
            salience = min(abs(signal.magnitude), 1.5)
            p_pass = 1.0 - np.exp(-exposure * (0.3 + 0.7 * arrays.herd) * salience)
            newly = (~informed) & arrays.alive & (self.rng.random(self.n) < p_pass)
            idx = np.flatnonzero(newly)
            for i in idx:
                self._queue.setdefault(tick + 1, []).append((int(i), signal))
            informed = informed | newly
            still.append((signal, informed))
        self._spreading = still

    def release_corrections(self, tick: int, arrays: PopulationArrays) -> None:
        due = [c for t, c in self._corrections if t == tick]
        self._corrections = [(t, c) for t, c in self._corrections if t != tick]
        for c in due:
            self.emit(tick, c, arrays, publicity=0.9, channel_delay=0)

    def collect(self, tick: int) -> dict[int, list[Signal]]:
        out: dict[int, list[Signal]] = {}
        for actor_id, signal in self._queue.pop(tick, []):
            out.setdefault(actor_id, []).append(signal)
        return out
