"""Entry, exit and M&A.

A pool of potential entrants (AI-native operators, a big-tech super-app, a
crypto-casino, a sponsorship-led aggressive challenger, a consolidator) is
evaluated periodically. An entrant's expected monthly BSI is estimated by a
dry-run of the real logit (adding it to its tracks), turned into a *discounted*
NPV, and it enters when that clears its cost + barrier, the AI frontier passes
its gate (big-tech is gated high; the challenger has no gate — entry on market
economics alone) and an execution draw succeeds. The execution draw is taken
unconditionally every evaluation so paired-seed (common-random-number) runs stay
stream-aligned between baseline and policy configurations.

A consolidator acquires via M&A ("podium strategy"): it values every incumbent
at ``acquisition_multiple`` × annual profit and buys the one with the highest
NPV — a strong local brand whose earnings it can improve with its own AI
capability — not the cheapest/weakest (critic finding: buying the weakest had
an Allwyn-type swallowing the long-tail aggregate in month 6, the opposite of
the observed FDJ/Kindred, Flutter-style pattern).

Incumbents that stay below a survival share for several periods exit.
Entries/exits reshape the attraction field, so incumbents and DS feel the
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
                      engagement: float, ai: AIDiffusion) -> float:
        """Expected monthly BSI for ``op`` via a dry-run of the logit on each of
        its tracks (reusing each track's calibrated deltas/total_base). The
        dry-run includes AI personalization offsets — an AI-native entrant's
        capability edge is precisely what its business case rests on."""
        gain = self.gcfg.ai_personalization_gain
        total = 0.0
        for tid in op.tracks:
            tm = market.tracks.get(tid)
            if tm is None:
                continue
            ops = tm.operators + [op]
            temp = TrackMarket(self.gcfg, market.pop, market.betas, tm.track,
                               ops, delta=tm.unlicensed_delta,
                               total_base=tm.total_base, outside_delta=tm.outside_delta)
            offsets = np.array([
                gain * (ai.cap.get(o.operator_id, getattr(o, "ai_cap0", 0.0)) - ai.cap_baseline)
                for o in ops
            ])
            r = temp.clear(0, extra_offsets=offsets, engagement=engagement)
            total += r["operator_bsi"].get(op.operator_id, 0.0)
        return total

    def _annuity_factor(self) -> float:
        """Present value of 1/month over the horizon at the discount rate."""
        r = (1.0 + self.gcfg.entry_discount_annual) ** (1.0 / 12.0) - 1.0
        h = self.gcfg.entry_horizon_months
        if r <= 1e-9:
            return float(h)
        return (1.0 - (1.0 + r) ** (-h)) / r

    def _npv(self, monthly_bsi: float, ent: EntrantConfig) -> float:
        monthly_profit = monthly_bsi * self.gcfg.entry_profit_margin
        return monthly_profit * self._annuity_factor() - ent.entry_cost - ent.entry_barrier

    def _best_acquisition(self, market: AttractionMarket, ent: EntrantConfig,
                          ai: AIDiffusion, results: dict) -> tuple[str | None, float]:
        """Podium strategy: value every licensed non-DS incumbent at
        ``acquisition_multiple`` × annual profit and pick the highest-NPV
        target — earnings the acquirer can lift with its AI-capability edge."""
        agg: dict[str, float] = {}
        for tid in ent.tracks:
            for oid, bsi in results.get(tid, {}).get("operator_bsi", {}).items():
                agg[oid] = agg.get(oid, 0.0) + bsi
        margin = self.gcfg.entry_profit_margin
        af = self._annuity_factor()
        best, best_npv = None, -np.inf
        for op in market.operators:
            if not op.licensed or op.is_ds or op.operator_id not in agg:
                continue
            monthly_profit = agg[op.operator_id] * margin
            price = self.gcfg.acquisition_multiple * monthly_profit * 12.0
            cap_uplift = max(0.0, ent.ai_cap0 - ai.cap.get(op.operator_id, 0.0))
            npv = monthly_profit * (1.0 + cap_uplift) * af - price - ent.entry_cost
            if npv > best_npv:
                best, best_npv = op.operator_id, npv
        return best, best_npv

    # ------------------------------------------------------------------ #
    def evaluate(self, tick: int, market: AttractionMarket, ai: AIDiffusion,
                 results: dict, rng: np.random.Generator) -> None:
        if tick % self.gcfg.entry_eval_period != 0:
            return
        engagement = ai.engagement_multiplier()
        for ent in list(self.pending):
            # Unconditional draw: keeps RNG streams aligned across paired-seed
            # baseline/policy runs even when the NPV gate flips.
            go = rng.random() < self.gcfg.entry_go_prob
            gate = self.gcfg.ai_bigtech_threshold if ent.operator_id == "bigtech" else ent.min_frontier
            if ai.frontier < gate or not go:
                continue
            if ent.consolidator:
                target, npv = self._best_acquisition(market, ent, ai, results)
                if target is not None and npv > 0:
                    self._enter(tick, market, ai, ent, target=target)
            else:
                exp_bsi = self._estimate_bsi(market, ent, engagement, ai)
                if self._npv(exp_bsi, ent) > 0:
                    self._enter(tick, market, ai, ent)

    def _enter(self, tick: int, market: AttractionMarket, ai: AIDiffusion,
               ent: EntrantConfig, target: str | None = None) -> None:
        op = OperatorConfig(**{k: getattr(ent, k) for k in OperatorConfig.model_fields})
        if target is not None:
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
