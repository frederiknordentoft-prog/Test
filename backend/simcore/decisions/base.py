"""Decision model interface.

Every model — rule-based, heuristic, utility, adaptive, economic, (later LLM) —
implements the same contract:

    model.decide(actor, obs, ctx) -> Decision

``obs`` is the actor's *perceived* view of the world (already distorted by its
information quality, delay and biases — see simcore/information/perception.py).
Models draw randomness exclusively from ``actor.rng``.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

from simcore.models.actions import Decision

if TYPE_CHECKING:  # avoid runtime circularity
    from simcore.agents.actor import Actor
    from simcore.models.config import MarketConfig, SimConfig


@dataclass(slots=True)
class PerceivedSignal:
    topic: str                # e.g. "rate_hike", "profit_warning", "rumor"
    asset_id: str | None
    magnitude: float          # signed, already distorted by perception
    credibility: float
    source: str
    sentiment_hint: float     # -1..1 push on sentiment


@dataclass(slots=True)
class Observation:
    tick: int
    own_wealth: float
    own_return: float                          # last-tick portfolio return
    prices: dict[str, float]                   # perceived prices
    returns_1: dict[str, float]                # perceived 1-tick returns
    momentum: dict[str, float]                 # perceived trailing k-tick return
    volatility: dict[str, float]
    ma_anchor: dict[str, float]                # trailing moving average (anchor)
    fundamentals: dict[str, float]             # perceived fundamental value per share
    peer_sentiment: float                      # mean sentiment of social neighbors
    peer_net_flow: float                       # perceived crowd buy/sell imbalance -1..1
    market_sentiment: float                    # global sentiment index
    credit_tightness: float                    # 0..1
    risk_free_rate: float
    signals: list[PerceivedSignal] = field(default_factory=list)
    econ: dict[str, Any] = field(default_factory=dict)  # role-specific perceived features


@dataclass(slots=True)
class DecisionContext:
    """Shared, read-only context for one tick's decide stage."""

    tick: int
    asset_ids: list[str]
    market: "MarketConfig"
    config: "SimConfig"
    systemic_score: float = 0.0
    extras: dict[str, Any] = field(default_factory=dict)


class DecisionModel(Protocol):
    name: str

    def decide(self, actor: "Actor", obs: Observation, ctx: DecisionContext) -> Decision: ...
