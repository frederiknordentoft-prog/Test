"""Entry, exit and M&A.

A pool of potential entrants (AI-native operators, a big-tech super-app, a
crypto-casino, a consolidator) is evaluated periodically. An entrant's expected
monthly BSI is estimated by a dry-run of the real logit (adding it to its
tracks), turned into an expected NPV, and it enters when that clears its cost +
barrier and the AI frontier passes its gate (big-tech is gated high). A
consolidator acquires the weakest incumbent (M&A) instead of launching
greenfield. Incumbents that fall below a survival share for several periods
exit. Entries/exits reshape the attraction field, so incumbents and DS feel the
competition — none of it is hardcoded.
"""
from __future__ import annotations

import numpy as np

from simcore.gambling.ai_diffusion import AIDiffusion
from simcore.gambling.config import EntrantConfig, GamblingConfig, OperatorConfig
from simcore.gambling.market import AttractionMarket, TrackMarket


class EntryManager:
    def __init__(self, gcfg: GamblingConfig):
        self.gcfg = gcfg
        self.pending: list[EntrantConfig] = list(gcfg.entrants)
        self.entered: list[str] = []
        self.exited: list[str] = []
        self._low_share: dict[str, int] = {}
        self.events: list[dict] = []   # (tick, kind, operator_id, detail) for logging

    # ------------------------------------------------------------------ #
    def _estimate_bsi(self, market: AttractionMarket, op: OperatorConfig,
                      engagement: float) -> float:
        """Expected monthly BSI for ``op`` via a dry-run of the logit on each of
        its tracks (reusing each track's calibrated delta/total_base)."""
        total = 0.0
        for tid in op.tracks:
            tm = market.tracks.get(tid)
            if tm is None:
                continue
            temp = TrackMarket(self.gcfg, market.pop, market.betas, tm.track,
                               tm.operators + [op], delta=tm.unlicensed_delta,
                               total_base=tm.total_base, outside_delta=tm.outside_delta)
            r = temp.clear(0, engagement=engagement)
            total += r["operator_bsi"].get(op.operator_id, 0.0)
        return total

    def _npv(self, monthly_bsi: float, ent: EntrantConfig) -> float:
        annual = monthly_bsi * 12.0
        profit = annual * self.gcfg.entry_profit_margin
        horizon_years = self.gcfg.entry_horizon_months / 12.0
        return profit * horizon_years - ent.entry_cost - ent.entry_barrier

    def _weakest_incumbent(self, market: AttractionMarket, tracks, results) -> str | None:
        """Lowest-BSI licensed non-DS incumbent across the given tracks."""
        agg: dict[str, float] = {}
        for tid in tracks:
            for oid, bsi in results.get(tid, {}).get("operator_bsi", {}).items():
                agg[oid] = agg.get(oid, 0.0) + bsi
        cand = [
            o for o in market.operators
            if o.licensed and not o.is_ds and o.operator_id in agg
        ]
        if not cand:
            return None
        return min(cand, key=lambda o: agg[o.operator_id]).operator_id

    # ------------------------------------------------------------------ #
    def evaluate(self, tick: int, market: AttractionMarket, ai: AIDiffusion,
                 results: dict, rng: np.random.Generator) -> None:
        if tick % self.gcfg.entry_eval_period != 0:
            return
        engagement = ai.engagement_multiplier()
        for ent in list(self.pending):
            gate = self.gcfg.ai_bigtech_threshold if ent.operator_id == "bigtech" else ent.min_frontier
            if ai.frontier < gate:
                continue
            exp_bsi = self._estimate_bsi(market, ent, engagement)
            npv = self._npv(exp_bsi, ent)
            if npv > 0 and rng.random() < 0.6:
                self._enter(tick, market, ai, ent, results)

    def _enter(self, tick: int, market: AttractionMarket, ai: AIDiffusion,
               ent: EntrantConfig, results: dict) -> None:
        op = OperatorConfig(**{k: getattr(ent, k) for k in OperatorConfig.model_fields})
        if ent.consolidator:
            target = self._weakest_incumbent(market, ent.tracks, results)
            if target is None:
                return
            ai.drop(target)
            market.replace_operator(target, op)
            ai.register(op.operator_id, ent.ai_cap0)
            self.events.append({"tick": tick, "kind": "m&a", "operator_id": op.operator_id,
                                "detail": f"acquired {target}"})
        else:
            market.add_operator(op)
            ai.register(op.operator_id, ent.ai_cap0)
            self.events.append({"tick": tick, "kind": "entry", "operator_id": op.operator_id,
                                "detail": ent.kind})
        self.pending.remove(ent)
        self.entered.append(op.operator_id)

    # ------------------------------------------------------------------ #
    def check_exits(self, tick: int, market: AttractionMarket, ai: AIDiffusion,
                    results: dict) -> None:
        """Remove licensed non-DS operators that stay below the survival share."""
        share: dict[str, float] = {}
        total = sum(r["total_bsi"] for r in results.values()) or 1.0
        agg: dict[str, float] = {}
        for r in results.values():
            for oid, bsi in r["operator_bsi"].items():
                agg[oid] = agg.get(oid, 0.0) + bsi
        for oid, bsi in agg.items():
            share[oid] = bsi / total
        for op in list(market.operators):
            if not op.licensed or op.is_ds:
                continue
            s = share.get(op.operator_id, 0.0)
            if s < self.gcfg.survival_share:
                self._low_share[op.operator_id] = self._low_share.get(op.operator_id, 0) + 1
            else:
                self._low_share[op.operator_id] = 0
            if self._low_share[op.operator_id] >= self.gcfg.survival_periods:
                market.remove_operator(op.operator_id)
                ai.drop(op.operator_id)
                self.exited.append(op.operator_id)
                self._low_share.pop(op.operator_id, None)
                self.events.append({"tick": tick, "kind": "exit", "operator_id": op.operator_id,
                                    "detail": f"share {s:.3f}"})

    def active_count(self, market: AttractionMarket) -> int:
        return sum(1 for o in market.operators if o.licensed)
