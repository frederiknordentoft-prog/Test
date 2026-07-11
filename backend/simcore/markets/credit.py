"""Credit system: banks pool lending capacity; credit conditions feed back
into loan pricing, approval and — via defaults — into bank capital and
further tightening (the credit-crunch loop, coupling channel 3).
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from simcore.models.actions import ActionIntent
from simcore.models.config import SimConfig

if TYPE_CHECKING:
    from simcore.agents.actor import Actor
    from simcore.markets.asset import MarketState


BASE_TIGHTNESS = 0.15


class CreditSystem:
    def __init__(self, config: SimConfig, bank_ids: list[int]):
        self.config = config
        self.bank_ids = bank_ids
        self.bank_delta: dict[int, float] = {b: 0.0 for b in bank_ids}
        self.bank_loss_ewma: dict[int, float] = {b: 0.0 for b in bank_ids}
        self.regulatory_delta = 0.0
        self.tightness = BASE_TIGHTNESS
        self.total_loans = 0.0
        self.defaults_total = 0
        self.defaults_tick = 0

    # ------------------------------------------------------------------ #
    def apply_condition_intents(
        self, intents: list[ActionIntent], actors: list["Actor"], market: "MarketState"
    ) -> None:
        for intent in intents:
            if intent.meta.get("regulatory"):
                self.regulatory_delta = float(np.clip(self.regulatory_delta + intent.qty, 0.0, 0.5))
                m_delta = float(intent.meta.get("margin_delta", 0.0))
                market.maintenance_margin = float(
                    np.clip(
                        market.maintenance_margin + m_delta,
                        market.baseline_maintenance,
                        market.baseline_maintenance + 0.15,
                    )
                )
                market.initial_margin = market.maintenance_margin + 0.15
            elif intent.actor_id in self.bank_delta:
                self.bank_delta[intent.actor_id] = float(
                    np.clip(self.bank_delta[intent.actor_id] + intent.qty, -0.25, 1.0)
                )
        self._recompute(actors, market)

    def _recompute(self, actors: list["Actor"], market: "MarketState") -> None:
        if self.bank_ids:
            caps = np.array([max(actors[b].state.cash, 1.0) for b in self.bank_ids])
            deltas = np.array([self.bank_delta[b] for b in self.bank_ids])
            bank_component = float((caps * deltas).sum() / caps.sum())
        else:
            bank_component = 0.0
        self.tightness = float(np.clip(BASE_TIGHTNESS + bank_component + self.regulatory_delta, 0.02, 0.95))
        market.credit_tightness = self.tightness

    # ------------------------------------------------------------------ #
    def request_loan(self, actor: "Actor", amount: float, prices: dict[str, float]) -> float:
        if amount <= 0 or not self.bank_ids:
            return 0.0
        s = actor.state
        wealth = s.wealth(prices)
        lev = s.loans / max(wealth + s.loans, 1.0)
        risk_premium = 0.5 * s.stress + float(np.clip(lev, 0.0, 1.0))
        approval = float(np.clip(1.2 - 1.2 * self.tightness - risk_premium, 0.0, 1.0))
        granted = amount * approval
        if granted <= 0:
            return 0.0
        econ = self.config.economy
        rate = (
            self.config.market.risk_free_rate
            + econ.loan_rate_spread * (1.0 + 3.0 * self.tightness)
            + 0.001 * risk_premium
        )
        prev = s.loans
        blended = (s.internal_state.get("loan_rate", rate) * prev + rate * granted) / max(prev + granted, 1e-9)
        s.internal_state["loan_rate"] = blended
        s.cash += granted
        s.loans += granted
        self.total_loans += granted
        # lending reduces bank cash pro rata to capital
        caps = np.array(
            [max(0.0, self._actors[b].state.cash if self._actors[b].state.alive else 0.0) for b in self.bank_ids]
        )
        if caps.sum() > 0:
            for b, c in zip(self.bank_ids, caps):
                self._actors[b].state.cash -= granted * c / caps.sum()
        return granted

    def bind_actors(self, actors: list["Actor"]) -> None:
        self._actors = actors

    # ------------------------------------------------------------------ #
    def service_loans(self, actors: list["Actor"], prices: dict[str, float]) -> list[int]:
        """Charge interest + amortization; detect defaults. Returns defaulted actor ids."""
        self.defaults_tick = 0
        defaulted: list[int] = []
        for actor in actors:
            s = actor.state
            if not s.alive or s.loans <= 0:
                continue
            rate = s.internal_state.get("loan_rate", self.config.market.risk_free_rate * 2)
            interest = s.loans * rate
            amort = 0.02 * s.loans
            pay = interest + amort
            if s.cash >= pay:
                s.cash -= pay
                s.loans -= amort
                self.total_loans = max(0.0, self.total_loans - amort)
            else:
                # missed payment: distress; default when deeply insolvent
                s.stress = min(1.0, s.stress + 0.15)
                wealth = s.wealth(prices)
                if wealth < 0.5 * s.loans or s.cash <= 0 and wealth <= 0:
                    loss = s.loans
                    s.loans = 0.0
                    self.total_loans = max(0.0, self.total_loans - loss)
                    self._distribute_loss(actors, loss)
                    self.defaults_total += 1
                    self.defaults_tick += 1
                    defaulted.append(actor.id)
        # interest earned accrues to banks pro rata (net of losses handled above)
        return defaulted

    def _distribute_loss(self, actors: list["Actor"], loss: float) -> None:
        if not self.bank_ids:
            return
        caps = np.array([max(actors[b].state.cash, 1.0) for b in self.bank_ids])
        for b, c in zip(self.bank_ids, caps):
            share = loss * c / caps.sum()
            bank = actors[b]
            bank.state.cash -= share
            prev = self.bank_loss_ewma[b]
            exposure = max(self.total_loans * c / caps.sum(), 1.0)
            self.bank_loss_ewma[b] = 0.9 * prev + 0.1 * (share / exposure)

    def credit_interest_income(self, actors: list["Actor"]) -> None:
        """Banks earn the aggregate interest margin each tick (simplified)."""
        if not self.bank_ids or self.total_loans <= 0:
            return
        income = self.total_loans * (self.config.economy.loan_rate_spread * (1.0 + self.tightness))
        caps = np.array([max(actors[b].state.cash, 1.0) for b in self.bank_ids])
        for b, c in zip(self.bank_ids, caps):
            actors[b].state.cash += income * c / caps.sum()

    def bank_features(self, bank_id: int, actors: list["Actor"]) -> dict[str, float]:
        caps = np.array([max(actors[b].state.cash, 1.0) for b in self.bank_ids])
        share = max(actors[bank_id].state.cash, 1.0) / caps.sum()
        exposure = self.total_loans * share
        capital = max(actors[bank_id].state.cash, 0.0)
        return {
            "loan_loss_rate": self.bank_loss_ewma.get(bank_id, 0.0),
            "capital_ratio": capital / max(exposure + capital, 1e-9),
        }
