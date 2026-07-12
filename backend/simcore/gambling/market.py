"""AttractionMarket: per-track market-share allocation + channelization engine.

Each competitive track (casino, sports) runs a full multinomial-logit choice
between the licensed operators, offshore and prediction markets; each monopoly
track (lottery, scratch) is a two-way choice between the DS monopoly and
offshore leakage. Aggregate operator shares are the budget-weighted mean of the
players' choice probabilities, so the heterogeneous tail moves shares
endogenously.

Calibration is done once, at baseline: a scalar appeal offset on the unlicensed
channels is solved (per track) so channelization matches the target
(channelization_start for competitive tracks, monopoly_channelization for the
monopoly ones), and total demand is anchored so the licensed portion equals the
reported 2024/25 BSI. The offset and total-demand level are then held fixed, so
later dynamics — AI personalization, entry/exit, bans, tax, enforcement — move
channelization and market size *away* from baseline instead of being calibrated
away.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig, OperatorConfig
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
    """The per-track choice problem. Calibration (``delta``, ``total_base``) is
    computed once at baseline and then reused across operator-set changes."""

    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays, betas, track,
                 operators: list[OperatorConfig],
                 delta: float | None = None, total_base: float | None = None):
        self.track = track
        self.calendar = gcfg.calendar
        self.temperature = gcfg.logit_temperature
        self.betas = betas
        idx = pop.track_ids.index(track.track_id)
        self.weights = pop.budget * pop.pref[:, idx]
        self.target = gcfg.monopoly_channelization if not track.competitive else gcfg.channelization_start
        self.set_operators(operators)

        if delta is None:
            self.unlicensed_delta = self._solve_delta(self.target)
        else:
            self.unlicensed_delta = delta
        if total_base is None:
            anchor_monthly = track.annual_bsi / 12.0 * BN_TO_MIO
            self.total_base = anchor_monthly / max(self.target, 1e-6)
        else:
            self.total_base = total_base

    # ------------------------------------------------------------------ #
    def set_operators(self, operators: list[OperatorConfig]) -> None:
        """(Re)bind the operator set — recomputes attributes and utilities but
        keeps the calibrated delta/total_base."""
        self.operators = operators
        self.attrs = operator_attr_arrays(operators)
        self.licensed_mask = np.array([o.licensed for o in operators])
        self.unlicensed_mask = ~self.licensed_mask
        self._base_u = utilities(self.betas, self.attrs)

    def _offset(self, appeal_mods: np.ndarray | None) -> np.ndarray:
        off = np.zeros(len(self.operators))
        off[self.unlicensed_mask] = self.unlicensed_delta
        if appeal_mods is not None:
            off = off + appeal_mods
        return off

    def _channelization_for(self, delta: float) -> float:
        off = np.zeros(len(self.operators))
        off[self.unlicensed_mask] = delta
        probs = choice_probabilities(self._base_u + off[None, :], self.temperature)
        shares = budget_weighted_shares(probs, self.weights)
        return float(shares[self.licensed_mask].sum())

    def _solve_delta(self, target: float) -> float:
        """Bisection for the unlicensed appeal offset so baseline channelization
        equals ``target`` (channelization is monotone decreasing in delta)."""
        if not self.unlicensed_mask.any():
            return 0.0
        lo, hi = -12.0, 12.0
        for _ in range(60):
            mid = 0.5 * (lo + hi)
            if self._channelization_for(mid) > target:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    # ------------------------------------------------------------------ #
    def clear(self, tick: int, appeal_mods: np.ndarray | None = None,
              engagement: float = 1.0) -> dict:
        probs = choice_probabilities(self._base_u + self._offset(appeal_mods)[None, :],
                                     self.temperature)
        shares = budget_weighted_shares(probs, self.weights)
        season = sports_intensity(tick, self.calendar) if self.track.seasonal else 1.0
        total = self.total_base * season * engagement
        operator_bsi = {o.operator_id: float(shares[i] * total)
                        for i, o in enumerate(self.operators)}
        licensed_bsi = float(shares[self.licensed_mask].sum() * total)
        offshore_bsi = float(shares[self.unlicensed_mask].sum() * total)
        return {
            "shares": {o.operator_id: float(shares[i]) for i, o in enumerate(self.operators)},
            "operator_bsi": operator_bsi,
            "channelization": float(shares[self.licensed_mask].sum()),
            "licensed_bsi": licensed_bsi,
            "offshore_bsi": offshore_bsi,
            "total_bsi": licensed_bsi + offshore_bsi,
            "hhi": float(np.sum(shares ** 2) * 10000.0),
        }


class AttractionMarket:
    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays):
        self.gcfg = gcfg
        self.pop = pop
        self.betas = player_betas(pop, gcfg.young_age_threshold)
        self.operators: list[OperatorConfig] = list(gcfg.operators)
        self.tracks: dict[str, TrackMarket] = {}
        for track in gcfg.tracks:
            ops = [o for o in self.operators if track.track_id in o.tracks]
            self.tracks[track.track_id] = TrackMarket(gcfg, pop, self.betas, track, ops)

    # ------------------------------------------------------------------ #
    def _rebuild_track(self, track_id: str) -> None:
        tm = self.tracks[track_id]
        ops = [o for o in self.operators if track_id in o.tracks]
        tm.set_operators(ops)

    def add_operator(self, op: OperatorConfig) -> None:
        """Add an operator (entry) and rebuild affected tracks without
        recalibration, so the new competitor genuinely moves shares/channelization."""
        self.operators.append(op)
        for tid in op.tracks:
            if tid in self.tracks:
                self._rebuild_track(tid)

    def remove_operator(self, operator_id: str) -> None:
        op = next((o for o in self.operators if o.operator_id == operator_id), None)
        if op is None:
            return
        self.operators = [o for o in self.operators if o.operator_id != operator_id]
        for tid in op.tracks:
            if tid in self.tracks:
                self._rebuild_track(tid)

    def replace_operator(self, old_id: str, new_op: OperatorConfig) -> None:
        """M&A: swap an incumbent for an acquirer-branded operator in place."""
        old = next((o for o in self.operators if o.operator_id == old_id), None)
        tracks = set(old.tracks) if old else set(new_op.tracks)
        self.operators = [new_op if o.operator_id == old_id else o for o in self.operators]
        if old is None:
            self.operators.append(new_op)
            tracks = set(new_op.tracks)
        for tid in tracks | set(new_op.tracks):
            if tid in self.tracks:
                self._rebuild_track(tid)

    def has_operator(self, operator_id: str) -> bool:
        return any(o.operator_id == operator_id for o in self.operators)

    # ------------------------------------------------------------------ #
    def clear(self, tick: int, appeal_mods: dict[str, np.ndarray] | None = None,
              engagement: float = 1.0) -> dict[str, dict]:
        out = {}
        for tid, tm in self.tracks.items():
            mods = None if appeal_mods is None else appeal_mods.get(tid)
            out[tid] = tm.clear(tick, mods, engagement)
        return out
