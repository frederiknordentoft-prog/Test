"""AttractionMarket: per-track market-share allocation + channelization engine.

Each track runs a multinomial-logit choice between the licensed operators,
offshore/prediction channels **and an outside option ("spiller ikke")** — so
total demand is elastic: tightening can shrink the market (the breadth exits to
the outside option) instead of only re-routing spend offshore. Aggregate shares
are the budget-weighted mean of the players' choice probabilities, so the
heterogeneous tail moves shares endogenously.

Policy acts on operator *attributes* (marketing under an ad ban, bonuses under
bonus restrictions, friction under RG rules, RTP under tax pass-through), which
the players' per-segment betas then mediate — an acquisition-led challenger
loses more from an ad ban than a brand/retail incumbent, emergently.

Calibration is done once, at baseline: per track, two scalar offsets are solved
jointly (alternating bisection) — the unlicensed appeal delta so channelization
matches the contested target, and the outside-option delta so baseline
participation matches ``participation_start``. Both are then held fixed, and the
demand level is anchored so the licensed portion equals the reported 2024/25
BSI. Later dynamics — growth trends, AI, entry/exit, bans, tax, enforcement —
move channelization, market size and participation *away* from baseline instead
of being calibrated away.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import GamblingConfig, OperatorConfig
from simcore.gambling.decisions import (
    budget_weighted_shares,
    nested_choice_probabilities,
    operator_attr_arrays,
    player_betas,
    utilities,
)
from simcore.gambling.population import PlayerArrays

BN_TO_MIO = 1000.0


class TrackMarket:
    """The per-track choice problem. Calibration (``unlicensed_delta``,
    ``outside_delta``, ``total_base``) is computed once at baseline and then
    reused across operator-set changes."""

    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays, betas, track,
                 operators: list[OperatorConfig],
                 delta: float | None = None, total_base: float | None = None,
                 outside_delta: float | None = None):
        self.track = track
        self.gcfg = gcfg
        self.calendar = gcfg.calendar
        self.temperature = gcfg.logit_temperature
        self.betas = betas
        idx = pop.track_ids.index(track.track_id)
        self.weights = pop.budget * pop.pref[:, idx]
        self.target = gcfg.monopoly_channelization if not track.competitive else gcfg.channelization_start
        # Per-player outside-option utility (before the calibrated delta):
        # highest for low-risk players — the breadth exits first.
        self._outside_beta = betas["outside"]
        self.last_participation: np.ndarray | None = None
        self.last_lic_prob: np.ndarray | None = None
        self.last_unl_prob: np.ndarray | None = None
        self.set_operators(operators)

        if delta is not None and outside_delta is not None:
            self.unlicensed_delta = delta
            self.outside_delta = outside_delta
        else:
            self.unlicensed_delta, self.outside_delta = self._calibrate()
        if total_base is None:
            # Baseline licensed share of potential = participation × channelization,
            # so anchoring licensed BSI to the dossier value fixes the potential.
            anchor_monthly = track.annual_bsi / 12.0 * BN_TO_MIO
            lic0 = self.target * gcfg.participation_start
            self.total_base = anchor_monthly / max(lic0, 1e-6)
        else:
            self.total_base = total_base

    # ------------------------------------------------------------------ #
    def set_operators(self, operators: list[OperatorConfig]) -> None:
        """(Re)bind the operator set — recomputes attributes but keeps the
        calibrated deltas/total_base."""
        self.operators = operators
        self.attrs = operator_attr_arrays(operators)
        self.licensed_mask = np.array([o.licensed for o in operators])
        self.unlicensed_mask = ~self.licensed_mask
        self.offshore_mask = np.array([o.kind == "offshore" for o in operators])
        self.prediction_mask = np.array([o.kind == "prediction" for o in operators])
        # Nested logit: licensed=0, unlicensed=1, outside=2 (last column).
        m = len(operators)
        self._nest_index = np.full(m + 1, 2)
        self._nest_index[:m] = np.where(self.licensed_mask, 0, 1)
        self._nest_lambdas = [self.gcfg.nest_lambda_licensed,
                              self.gcfg.nest_lambda_unlicensed, 1.0]

    def refresh_attrs(self) -> None:
        """Recompute attribute arrays after operator agents mutate their
        OperatorConfig fields (endogenous behaviour)."""
        self.set_operators(self.operators)

    # ------------------------------------------------------------------ #
    def _policy_attrs(self, reg) -> dict[str, np.ndarray]:
        """Apply the regulation state to operator attributes. The per-segment
        betas then mediate the response — this is where an ad ban hits the
        acquisition-led challenger harder than the brand incumbent."""
        if reg is None:
            return self.attrs
        g = self.gcfg
        a = dict(self.attrs)
        lic = self.licensed_mask
        unl = self.unlicensed_mask

        marketing = a["marketing"].copy()
        marketing[lic] *= max(0.0, 1.0 - reg.ad_ban)          # ads switched off
        a["marketing"] = marketing

        bonus = a["bonus"].copy()
        bonus[lic] *= max(0.0, 1.0 - reg.bonus_restriction)   # bonus/affiliate rules
        a["bonus"] = bonus

        friction = a["friction"].copy()
        friction[lic] = friction[lic] + g.rg_friction_gain * reg.rg_friction
        # DNS/payment blocking bites offshore only — prediction markets are
        # financial derivatives distributed via fintech apps and cannot be
        # blocked on the same legal basis (dossier §10.1).
        friction[self.offshore_mask] += g.enforcement_friction * reg.enforcement
        a["friction"] = friction

        if reg.prediction_boost and self.prediction_mask.any():
            appeal = a["appeal"].copy()
            appeal[self.prediction_mask] += reg.prediction_boost
            a["appeal"] = appeal

        payout = a["payout"].copy()
        payout[lic] = np.clip(payout[lic] - g.rtp_tax_passthrough * reg.tax_add, 0.0, 1.0)
        a["payout"] = payout

        protection = a["protection"].copy()
        protection[lic] = np.clip(protection[lic] + g.limits_protection_gain * reg.loss_limits,
                                  0.0, 1.5)
        a["protection"] = protection

        if reg.licensed_bonus:  # e.g. crash games legalized onshore
            breadth = a["breadth"].copy()
            breadth[lic] = np.clip(breadth[lic] + 0.3 * reg.licensed_bonus, 0.0, 1.2)
            a["breadth"] = breadth
        return a

    def _full_utilities(self, reg=None, extra_offsets: np.ndarray | None = None,
                        unlicensed_delta: float | None = None,
                        outside_delta: float | None = None,
                        rofus: np.ndarray | None = None) -> np.ndarray:
        """[n, m+1] utility matrix: operators + the outside option (last col).
        ROFUS-registered players have licensed alternatives blocked (the
        self-exclusion register covers the licensed market only)."""
        du = self.unlicensed_delta if unlicensed_delta is None else unlicensed_delta
        do = self.outside_delta if outside_delta is None else outside_delta
        u = utilities(self.betas, self._policy_attrs(reg))
        off = np.zeros(len(self.operators))
        off[self.unlicensed_mask] = du
        if extra_offsets is not None:
            off = off + extra_offsets
        u = u + off[None, :]
        if rofus is not None and rofus.any():
            u[np.ix_(rofus, np.where(self.licensed_mask)[0])] -= self.gcfg.rofus_penalty
        outside = (do + self._outside_beta)[:, None]
        return np.concatenate([u, outside], axis=1)

    def _probs(self, u_full: np.ndarray) -> np.ndarray:
        return nested_choice_probabilities(u_full, self._nest_index, self._nest_lambdas,
                                           self.temperature)

    def _shares_for(self, du: float, do: float) -> np.ndarray:
        probs = self._probs(self._full_utilities(unlicensed_delta=du, outside_delta=do))
        return budget_weighted_shares(probs, self.weights)

    def _calibrate(self) -> tuple[float, float]:
        """Jointly solve (unlicensed_delta, outside_delta) so that at baseline
        channelization = target AND participation = participation_start.
        Alternating bisection on two monotone coordinates converges fast."""
        if not self.unlicensed_mask.any():
            # No unlicensed channel: only the outside option is calibrated.
            du = 0.0
            do = self._solve_outside(du)
            return du, do
        du, do = 0.0, 0.0
        for _ in range(6):
            du = self._solve_unlicensed(do)
            do = self._solve_outside(du)
        return du, do

    def _solve_unlicensed(self, do: float) -> float:
        """Bisection: channelization (licensed share of in-market spend) is
        monotone decreasing in the unlicensed delta."""
        lo, hi = -12.0, 12.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            s = self._shares_for(mid, do)
            in_market = float(s[:-1].sum())
            chan = float(s[:-1][self.licensed_mask].sum()) / max(in_market, 1e-12)
            if chan > self.target:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def _solve_outside(self, du: float) -> float:
        """Bisection: participation (1 − outside share) is monotone decreasing
        in the outside delta."""
        lo, hi = -14.0, 14.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            part = 1.0 - float(self._shares_for(du, mid)[-1])
            if part > self.gcfg.participation_start:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    # ------------------------------------------------------------------ #
    def clear(self, tick: int, reg=None, extra_offsets: np.ndarray | None = None,
              engagement: float = 1.0, noise: float = 1.0,
              rofus: np.ndarray | None = None) -> dict:
        probs = self._probs(self._full_utilities(reg, extra_offsets, rofus=rofus))
        self.last_participation = 1.0 - probs[:, -1]
        m = len(self.operators)
        self.last_lic_prob = probs[:, :m][:, self.licensed_mask].sum(axis=1)
        self.last_unl_prob = probs[:, :m][:, self.unlicensed_mask].sum(axis=1)
        shares_full = budget_weighted_shares(probs, self.weights)
        shares = shares_full[:-1]                       # operator shares of potential
        outside_share = float(shares_full[-1])
        in_market = float(shares.sum())

        season = sports_intensity(tick, self.calendar) if self.track.seasonal else 1.0
        growth = (1.0 + self.track.growth_rate) ** (tick / 12.0)
        potential = self.total_base * season * engagement * growth * noise

        operator_bsi = {o.operator_id: float(shares[i] * potential)
                        for i, o in enumerate(self.operators)}
        licensed_share = float(shares[self.licensed_mask].sum())
        licensed_bsi = licensed_share * potential
        offshore_bsi = float(shares[self.unlicensed_mask].sum()) * potential

        # HHI on the licensed market (the convention for concentration).
        lic_shares = shares[self.licensed_mask]
        lic_total = float(lic_shares.sum())
        hhi = float(np.sum((lic_shares / max(lic_total, 1e-12)) ** 2) * 10000.0)

        return {
            "shares": {o.operator_id: float(shares[i]) for i, o in enumerate(self.operators)},
            "outside_share": outside_share,
            "participation": in_market,
            "operator_bsi": operator_bsi,
            "channelization": licensed_share / max(in_market, 1e-12),
            "licensed_bsi": licensed_bsi,
            "offshore_bsi": offshore_bsi,
            "total_bsi": licensed_bsi + offshore_bsi,
            "potential_bsi": potential,
            "hhi": hhi,
        }


class AttractionMarket:
    def __init__(self, gcfg: GamblingConfig, pop: PlayerArrays):
        self.gcfg = gcfg
        self.pop = pop
        self.betas = player_betas(pop, gcfg)
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

    def participation(self) -> dict[str, np.ndarray]:
        """Per-track per-player probability of playing this month (from the last
        clear) — feeds the endogenous customer counts."""
        return {tid: tm.last_participation for tid, tm in self.tracks.items()
                if tm.last_participation is not None}

    def refresh_attrs(self) -> None:
        """Recompute all tracks' attribute arrays after operator agents mutate
        their OperatorConfig fields."""
        for tm in self.tracks.values():
            tm.refresh_attrs()

    # ------------------------------------------------------------------ #
    def clear(self, tick: int, reg=None, ai_offsets: dict[str, np.ndarray] | None = None,
              engagement: float | dict[str, float] = 1.0,
              noise: dict[str, float] | None = None,
              rofus: np.ndarray | None = None) -> dict[str, dict]:
        out = {}
        for tid, tm in self.tracks.items():
            extra = None if ai_offsets is None else ai_offsets.get(tid)
            nz = 1.0 if noise is None else noise.get(tid, 1.0)
            eng = engagement.get(tid, 1.0) if isinstance(engagement, dict) else engagement
            out[tid] = tm.clear(tick, reg, extra, eng, nz, rofus)
        return out
