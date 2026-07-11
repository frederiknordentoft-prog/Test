"""Reproducibility backbone: a SeedSequence tree.

Every source of randomness in the simulation draws from its own dedicated
``numpy.random.Generator`` spawned deterministically from the master seed.
Because each actor owns its own stream, shuffling actor processing order can
never shift anyone's random sequence — reproducibility is independent of
execution order (docs/architecture.md §8).
"""
from __future__ import annotations

import numpy as np


class RngHub:
    def __init__(self, master_seed: int, n_actors: int, n_assets: int):
        self.master_seed = int(master_seed)
        root = np.random.SeedSequence(self.master_seed)
        (
            pop_ss,
            sched_ss,
            event_ss,
            signal_ss,
            assets_ss,
            actors_ss,
            econ_ss,
            perception_ss,
        ) = root.spawn(8)
        self.population = np.random.default_rng(pop_ss)
        self.scheduler = np.random.default_rng(sched_ss)
        self.events = np.random.default_rng(event_ss)
        self.signals = np.random.default_rng(signal_ss)
        self.economy = np.random.default_rng(econ_ss)
        self.perception = np.random.default_rng(perception_ss)
        self.assets = [np.random.default_rng(s) for s in assets_ss.spawn(n_assets)]
        self.actors = [np.random.default_rng(s) for s in actors_ss.spawn(n_actors)]

    def shuffled_indices(self, n: int) -> np.ndarray:
        """Random processing order for the decide stage (scheduler stream)."""
        return self.scheduler.permutation(n)
