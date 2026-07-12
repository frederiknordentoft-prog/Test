"""AttractionMarket: per-track market-share allocation + channelization engine.

Each competitive track (casino, sports) runs a full multinomial-logit choice
between the licensed operators, offshore and prediction markets; each monopoly
track (lottery, scratch) is a two-way choice between the DS monopoly and
offshore leakage. Aggregate operator shares are the budget-weighted mean of the
players' choice probabilities, so the heterogeneous tail moves shares
endogenously.

Calibration: an appeal offset on the unlicensed channels is solved (per track)
so that the *baseline* channelization matches the target — channelization_start
for competitive tracks, monopoly_channelization for the monopoly ones. The
offset is fixed at baseline; later etaper move channelization away from it by
changing operator appeal (AI, bans, tax, enforcement). Total demand per track is
anchored so the licensed portion equals the reported 2024/25 BSI at baseline.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig
from simcore.gambling.decisions import (
    budget_weighted_shares,
    choice_probabilities,
    operator_attr_arrays,
    player_betas,
    utilities,
)
from simcore.gambling.population import PlayerArrays

BN_TO_MIO = 1000.0


class TrackMarket:
    """Precomputed per-track choice problem."""

    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays, betas, track):
        self.track = track
        self.calendar = gcfg.calendar
        self.operators = gcfg.operators_for(track.track_id)
        if not self.operators:
            raise ValueError(f"track {track.track_id} has no operators")
        self.attrs = operator_attr_arrays(self.operators)
        self.betas = betas
        self.temperature = gcfg.logit_temperature
        idx = pop.track_ids.index(track.track_id)
        self.weights = pop.budget * pop.pref[:, idx]
        self.licensed_mask = np.array([o.licensed for o in self.operators])
        self.unlicensed_mask = ~self.licensed_mask

        target = gcfg.monopoly_channelization if not track.competitive else gcfg.channelization_start
        self.target = target
        self._base_u = utilities(betas, self.attrs)
        self.offset = self._solve_offset(target)
        # Total monthly demand so the licensed portion equals the anchor at baseline.
        anchor_monthly = track.annual_bsi / 12.0 * BN_TO_MIO
        self.total_base = anchor_monthly / max(target, 1e-6)

    # ------------------------------------------------------------------ #
    def _channelization_for(self, offset: np.ndarray) -> float:
        probs = choice_probabilities(self._base_u + offset[None, :], self.temperature)
        shares = budget_weighted_shares(probs, self.weights)
        return float(shares[self.licensed_mask].sum())

    def _solve_offset(self, target: float) -> np.ndarray:
        """Bisection: add a scalar δ to the unlicensed channels' appeal so the
        baseline licensed share equals ``target``. Channelization is monotone
        decreasing in δ."""
        if not self.unlicensed_mask.any():
            return np.zeros(len(self.operators))

        def make(delta: float) -> np.ndarray:
            off = np.zeros(len(self.operators))
            off[self.unlicensed_mask] = delta
            return off

        lo, hi = -12.0, 12.0
        # f(δ) = channelization(δ) − target is decreasing in δ.
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            if self._channelization_for(make(mid)) > target:
                lo = mid       # too much licensed → raise unlicensed appeal
            else:
                hi = mid
        return make(0.5 * (lo + hi))

    # ------------------------------------------------------------------ #
    def clear(self, tick: int, appeal_mods: np.ndarray | None = None) -> dict:
        """Compute shares and per-operator BSI for one tick. ``appeal_mods`` is an
        optional per-operator utility modifier (used by later etaper for AI, bans,
        tax, enforcement)."""
        offset = self.offset if appeal_mods is None else self.offset + appeal_mods
        probs = choice_probabilities(self._base_u + offset[None, :], self.temperature)
        shares = budget_weighted_shares(probs, self.weights)
        channelization = float(shares[self.licensed_mask].sum())

        season = sports_intensity(tick, self.calendar) if self.track.seasonal else 1.0
        total = self.total_base * season
        operator_bsi = {o.operator_id: float(shares[i] * total)
                        for i, o in enumerate(self.operators)}
        licensed_bsi = float(shares[self.licensed_mask].sum() * total)
        offshore_bsi = float(shares[self.unlicensed_mask].sum() * total)
        hhi = float(np.sum(shares ** 2) * 10000.0)
        return {
            "shares": {o.operator_id: float(shares[i]) for i, o in enumerate(self.operators)},
            "operator_bsi": operator_bsi,
            "channelization": channelization,
            "licensed_bsi": licensed_bsi,     # matches the anchor at baseline
            "offshore_bsi": offshore_bsi,
            "total_bsi": licensed_bsi + offshore_bsi,
            "hhi": hhi,
        }


class AttractionMarket:
    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays):
        self.gcfg = gcfg
        betas = player_betas(pop, gcfg.young_age_threshold)
        self.tracks: dict[str, TrackMarket] = {}
        for track in gcfg.tracks:
            self.tracks[track.track_id] = TrackMarket(gcfg, pop, betas, track)

    def clear(self, tick: int, appeal_mods: dict[str, np.ndarray] | None = None) -> dict[str, dict]:
        out = {}
        for tid, tm in self.tracks.items():
            mods = None if appeal_mods is None else appeal_mods.get(tid)
            out[tid] = tm.clear(tick, mods)
        return out
