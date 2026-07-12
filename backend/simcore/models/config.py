"""Configuration schema for the simulator.

Every numeric actor parameter can be initialized from a distribution rather than
a fixed value: ``DistributionSpec`` is the single primitive for that. Type
profiles (see ``simcore/agents/type_profiles.py``) provide per-actor-type
defaults; a ``SimConfig`` only has to override what differs from the defaults,
which keeps preset YAML files short.
"""
from __future__ import annotations

from typing import Any, Literal

import numpy as np
from pydantic import BaseModel, Field, model_validator


class DistributionSpec(BaseModel):
    """A configurable random distribution.

    Supported ``dist`` values and their ``params``:

    - ``constant``:  {"value": v}
    - ``uniform``:   {"low": a, "high": b}
    - ``normal``:    {"mean": m, "std": s}
    - ``lognormal``: {"mean": m, "sigma": s}          (of the underlying normal)
    - ``beta``:      {"a": a, "b": b, "loc": 0, "scale": 1}
    - ``gamma``:     {"shape": k, "scale": s, "loc": 0}
    - ``pareto``:    {"alpha": a, "xm": minimum}      (power law, heavy tail)
    - ``choice``:    {"values": [...], "probs": [...]}

    Optional ``low``/``high`` clip the samples.
    """

    dist: Literal[
        "constant", "uniform", "normal", "lognormal", "beta", "gamma", "pareto", "choice"
    ]
    params: dict[str, Any] = Field(default_factory=dict)
    low: float | None = None
    high: float | None = None

    def sample(self, rng: np.random.Generator, size: int | None = None) -> Any:
        p = self.params
        if self.dist == "constant":
            out = np.full(size or 1, float(p["value"]))
        elif self.dist == "uniform":
            out = rng.uniform(p.get("low", 0.0), p.get("high", 1.0), size=size or 1)
        elif self.dist == "normal":
            out = rng.normal(p.get("mean", 0.0), p.get("std", 1.0), size=size or 1)
        elif self.dist == "lognormal":
            out = rng.lognormal(p.get("mean", 0.0), p.get("sigma", 1.0), size=size or 1)
        elif self.dist == "beta":
            out = p.get("loc", 0.0) + p.get("scale", 1.0) * rng.beta(
                p.get("a", 2.0), p.get("b", 2.0), size=size or 1
            )
        elif self.dist == "gamma":
            out = p.get("loc", 0.0) + rng.gamma(
                p.get("shape", 2.0), p.get("scale", 1.0), size=size or 1
            )
        elif self.dist == "pareto":
            out = p.get("xm", 1.0) * (1.0 + rng.pareto(p.get("alpha", 2.0), size=size or 1))
        elif self.dist == "choice":
            values = p["values"]
            probs = p.get("probs")
            out = rng.choice(values, size=size or 1, p=probs)
        else:  # pragma: no cover - pydantic guards this
            raise ValueError(f"unknown distribution {self.dist}")
        out = np.asarray(out, dtype=float)
        if self.low is not None or self.high is not None:
            out = np.clip(out, self.low, self.high)
        if size is None:
            return float(out[0])
        return out


def const(value: float) -> DistributionSpec:
    return DistributionSpec(dist="constant", params={"value": value})


class ActorTypeConfig(BaseModel):
    """Per-type population settings. Traits omitted here fall back to the
    type profile defaults."""

    count: int = Field(0, ge=0, le=5000)
    wealth: DistributionSpec | None = None
    traits: dict[str, DistributionSpec] = Field(default_factory=dict)
    decision_models: dict[str, float] | None = None  # mixture weights


class AssetConfig(BaseModel):
    asset_id: str
    initial_price: float = 100.0
    fundamental_value: float = 100.0  # used when not linked to a listed firm
    initial_volatility: float = 0.01
    shares_outstanding: float = 1_000_000.0


class MarketConfig(BaseModel):
    """Batch call auction parameters. See docs/architecture.md §6 for formulas."""

    impact_alpha: float = 0.04        # max |log price move| per tick from imbalance
    sentiment_beta: float = 0.35       # sentiment channel weight
    noise_sigma: float = 0.003        # exogenous log price noise
    depth_frac: float = 0.02          # depth (shares) = depth_frac * shares_outstanding
    depth_base: float = 2_000.0       # absolute fallback when shares unknown
    kappa_vol: float = 25.0           # volatility -> depth shrink factor
    liquidity_base: float = 1.0       # normalized liquidity pool baseline
    spread_min: float = 0.001
    spread_c1: float = 0.05           # volatility -> spread
    spread_c2: float = 0.02           # imbalance -> spread
    forced_multiplier: float = 1.5    # forced sales weigh heavier in imbalance
    forced_escalation: float = 0.25   # added to multiplier per tick a forced order rolls
    absorb_rho: float = 0.5           # depth pool absorbs up to rho*depth of majority side
    ewma_lambda: float = 0.94         # volatility EWMA
    maintenance_margin: float = 0.25
    initial_margin: float = 0.40
    max_leverage: float = 3.0
    price_floor: float = 0.01
    risk_free_rate: float = 0.00012   # per tick (~3%/yr at daily resolution)


class EconomyConfig(BaseModel):
    enabled: bool = True
    econ_period: int = 1              # run the goods loop every N ticks
    demand_elasticity: float = 1.5
    base_demand_budget_share: float = 0.9
    markup_step: float = 0.03         # firm price adjustment per period
    wage_per_capacity: float = 0.55   # wage bill per unit of utilized capacity
    discount_rate: float = 0.0005     # per tick, for fundamental value = E/r
    earnings_smoothing: float = 0.94  # EWMA on firm earnings
    investment_rate: float = 0.02     # base capacity growth per period when q > 1
    tobin_q_sensitivity: float = 0.5  # market -> investment coupling strength
    loan_rate_spread: float = 0.0004  # bank spread over risk-free per unit tightness
    credit_tighten_speed: float = 0.15
    supplier_fail_losses: int = 8     # consecutive loss periods before supplier failure
    employment_smoothing: float = 0.9
    listed_capacity_boost: float = 6.0  # listed firms are larger than average firms


class NetworkLayerConfig(BaseModel):
    kind: Literal["random", "small_world", "scale_free", "clustered"] = "scale_free"
    params: dict[str, Any] = Field(default_factory=dict)


class SignalConfig(BaseModel):
    """How a signal attached to an event is published."""

    publicity: float = Field(1.0, ge=0.0, le=1.0)  # share of population reached directly
    credibility: float = Field(0.9, ge=0.0, le=1.0)
    truth: float = Field(1.0, ge=0.0, le=1.0)      # 1 = true, 0 = fabricated rumor
    channel_delay: int = Field(0, ge=0, le=100)    # base delay in ticks before delivery


class EventConfig(BaseModel):
    """Generic external event. ``effects`` are interpreted by the event library
    (see simcore/events/library.py) — they parameterize the shock, they do NOT
    encode the outcome."""

    name: str
    event_type: str                   # key into the event library
    description: str = ""
    start_tick: int | None = Field(None, ge=0)  # fixed schedule ...
    probability: float = Field(0.0, ge=0.0, le=1.0)  # ... or per-tick hazard
    duration: int = Field(1, ge=1, le=5000)
    magnitude: float = Field(1.0, ge=-5.0, le=5.0)
    targets: dict[str, Any] = Field(default_factory=dict)  # actor_type / actor_id / asset_id
    params: dict[str, Any] = Field(default_factory=dict)
    signal: SignalConfig = Field(default_factory=SignalConfig)
    escalation_probability: float = Field(0.0, ge=0.0, le=1.0)
    de_escalation_probability: float = Field(0.0, ge=0.0, le=1.0)


class RecordingConfig(BaseModel):
    snapshot_interval: int = Field(10, ge=1)   # actor snapshots every N ticks
    decision_log_sample: float = Field(1.0, ge=0.0, le=1.0)
    flush_interval: int = Field(25, ge=1)      # recorder flush cadence (ticks)
    history_window: int = Field(512, ge=64)    # in-memory ring buffer length


class SystemicRiskWeights(BaseModel):
    """Weights of the systemic risk score components (docs §12)."""

    leverage: float = 1.0
    volatility: float = 1.0
    liquidity_depletion: float = 1.0
    forced_sale_share: float = 1.0
    credit_tightness: float = 1.0
    stressed_share: float = 1.0


class SimConfig(BaseModel):
    name: str = "simulation"
    description: str = ""
    seed: int = Field(42, ge=0)
    ticks: int = Field(500, ge=1, le=20000)
    tick_resolution: Literal["minute", "hour", "day", "week", "month", "quarter"] = "day"
    sim_domain: Literal["finance", "gambling"] = "finance"
    # Raw gambling-domain config; validated into a GamblingConfig by the
    # GamblingSimulation (kept as a dict here so models/config.py has no
    # dependency on the gambling package — avoids an import cycle).
    gambling: dict[str, Any] | None = None
    actors: dict[str, ActorTypeConfig] = Field(default_factory=dict)
    assets: list[AssetConfig] = Field(default_factory=list)
    market: MarketConfig = Field(default_factory=MarketConfig)
    economy: EconomyConfig = Field(default_factory=EconomyConfig)
    networks: dict[str, NetworkLayerConfig] = Field(default_factory=dict)
    events: list[EventConfig] = Field(default_factory=list)
    recording: RecordingConfig = Field(default_factory=RecordingConfig)
    systemic_weights: SystemicRiskWeights = Field(default_factory=SystemicRiskWeights)

    @model_validator(mode="after")
    def _defaults(self) -> "SimConfig":
        if self.market.initial_margin <= self.market.maintenance_margin:
            raise ValueError(
                f"initial_margin ({self.market.initial_margin}) must exceed "
                f"maintenance_margin ({self.market.maintenance_margin})"
            )
        if self.market.max_leverage < 1.0:
            raise ValueError("max_leverage must be >= 1.0")
        # The gambling domain builds its own population/market from the
        # ``gambling`` block; don't inject the finance defaults for it.
        if self.sim_domain == "finance":
            if not self.assets:
                self.assets = [
                    AssetConfig(asset_id=f"EQ{i+1}", initial_price=100.0) for i in range(5)
                ]
            if not self.actors:
                self.actors = default_actor_mix()
            if not self.networks:
                self.networks = {
                    "social": NetworkLayerConfig(kind="scale_free", params={"m": 3}),
                    "information": NetworkLayerConfig(kind="small_world", params={"k": 6, "p": 0.1}),
                }
        return self

    @property
    def n_actors(self) -> int:
        return sum(tc.count for tc in self.actors.values())


def default_actor_mix(total: int = 300) -> dict[str, ActorTypeConfig]:
    """Default population mix, proportional to ``total``. Customers take the
    remainder so counts always sum exactly to ``total``."""
    frac = {
        "retail": 0.50,
        "institutional": 0.08,
        "hedge_fund": 0.05,
        "bank": 0.02,
        "firm": 0.10,
        "supplier": 0.08,
        "media": 0.013,
        "regulator": 0.007,
    }
    counts = {k: max(1, round(v * total)) for k, v in frac.items()}
    counts["customer"] = max(1, total - sum(counts.values()))
    return {k: ActorTypeConfig(count=v) for k, v in counts.items()}
