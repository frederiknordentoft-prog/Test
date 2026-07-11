"""Actor traits (immutable, drawn at init) and state (mutable, evolves per tick).

Together with the type profile (objectives, allowed actions) and the network
layers (relationships), these cover the full required actor schema:
unique_id, actor_type, name, objectives, wealth/resources, liquidity, leverage,
risk_tolerance, loss_aversion, confidence, patience, time_horizon,
information_quality/delay, analytical_capability, adaptability, herd_tendency,
trust_level, reputation, market_power, network_influence,
regulatory_constraints, memory_length, current_sentiment, expected_return/risk,
stress_level, survival_threshold, action_thresholds, strategy, relationships,
current_positions, historical_actions, internal_state.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class ActorType(str, Enum):
    RETAIL = "retail"
    INSTITUTIONAL = "institutional"
    HEDGE_FUND = "hedge_fund"
    BANK = "bank"
    FIRM = "firm"
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    REGULATOR = "regulator"
    MEDIA = "media"


@dataclass(frozen=True, slots=True)
class Traits:
    risk_tolerance: float = 0.5        # 0..1
    loss_aversion: float = 2.0         # multiplier on pain of losses (>1 = averse)
    patience: float = 0.5              # 0..1, lowers decisiveness k
    time_horizon: int = 50             # ticks the actor "plans" over
    information_quality: float = 0.5   # 0..1, scales observation noise down
    information_delay: int = 1         # ticks of delay on public information
    analytical_capability: float = 0.5 # 0..1, better expectation formation
    adaptability: float = 0.5          # 0..1, learning rate of adaptive parts
    herd_tendency: float = 0.5         # 0..1, weight on peer behavior/sentiment
    trust_level: float = 0.5           # 0..1, base trust in signal sources
    market_power: float = 0.01         # relative ability to move markets (via size)
    network_influence: float = 0.1     # 0..1, how strongly the actor spreads signals
    memory_length: int = 30            # ticks of memory
    overconfidence: float = 0.3        # 0..1, inflates own expectations
    survival_threshold: float = 0.25   # fraction of initial wealth = distress line
    action_threshold: float = 0.1      # minimum |score| before acting at all
    regulatory_constraint: float = 0.0 # 0..1, fraction of aggressive actions blocked


@dataclass(slots=True)
class MemoryRecord:
    tick: int
    wealth: float
    ret: float                 # own portfolio return that tick
    action: str | None
    shock: str | None          # event name if one hit this actor
    expectation_error: float   # realized - expected return


@dataclass(slots=True)
class EconState:
    """Extra block for real-economy actors (firm / supplier / customer).
    Roles use the subset of fields that applies to them."""

    # firm + supplier
    price: float = 10.0
    unit_cost: float = 6.0
    capacity: float = 100.0
    utilization: float = 0.8
    inventory: float = 50.0
    employees: float = 10.0
    revenue: float = 0.0
    earnings: float = 0.0
    earnings_smoothed: float = 0.0
    loss_streak: int = 0
    listed_asset: str | None = None     # firm equity traded under this asset id
    shares_outstanding: float = 1_000_000.0
    pricing_power: float = 0.5
    brand_strength: float = 0.5
    # customer
    base_income: float = 100.0
    budget: float = 100.0
    price_sensitivity: float = 1.5
    loyalty: float = 0.5
    perceived_value: float = 1.0
    consumption_scale: float = 1.0


@dataclass(slots=True)
class ActorState:
    cash: float = 0.0
    positions: dict[str, float] = field(default_factory=dict)  # asset -> qty (neg = short)
    margin_debt: float = 0.0
    loans: float = 0.0                  # bank loans (economy actors)
    provided_liquidity: float = 0.0     # share of wealth parked in the liquidity pool
    sentiment: float = 0.0              # -1..1
    stress: float = 0.0                 # 0..1
    confidence: float = 0.5             # 0..1
    reputation: float = 0.5             # 0..1
    expected_returns: dict[str, float] = field(default_factory=dict)
    expected_risks: dict[str, float] = field(default_factory=dict)
    trust_in_sources: dict[str, float] = field(default_factory=dict)
    alive: bool = True
    bankrupt_tick: int | None = None
    initial_wealth: float = 0.0
    peak_wealth: float = 0.0
    last_wealth: float = 0.0
    realized_pnl: float = 0.0
    strategy: str = ""
    strategy_scores: dict[str, float] = field(default_factory=dict)
    memory: deque[MemoryRecord] = field(default_factory=deque)
    pending_forced: dict[str, float] = field(default_factory=dict)  # asset -> qty still to force-sell
    forced_ticks: int = 0               # how long forced flow has been rolling
    internal_state: dict[str, Any] = field(default_factory=dict)

    # -- derived quantities -------------------------------------------------

    def portfolio_value(self, prices: dict[str, float]) -> float:
        return sum(q * prices.get(a, 0.0) for a, q in self.positions.items())

    def gross_exposure(self, prices: dict[str, float]) -> float:
        return sum(abs(q) * prices.get(a, 0.0) for a, q in self.positions.items())

    def wealth(self, prices: dict[str, float]) -> float:
        return self.cash + self.portfolio_value(prices) - self.margin_debt - self.loans

    def leverage(self, prices: dict[str, float]) -> float:
        w = self.wealth(prices)
        g = self.gross_exposure(prices)
        if w <= 1e-9:
            return 99.0 if g > 0 else 0.0
        return g / w

    def equity_ratio(self, prices: dict[str, float]) -> float:
        g = self.gross_exposure(prices)
        if g <= 1e-9:
            return 1.0
        return self.wealth(prices) / g
