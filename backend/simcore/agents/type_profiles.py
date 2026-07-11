"""Actor type profiles: the source of heterogeneity.

A type is *data*: trait distributions, a wealth distribution, a decision-model
mixture, objectives and an optional real-economy template. Actors of the same
type still differ individually because every trait is drawn from a
distribution; actors of different types differ *structurally* because the
distributions, allowed behaviors and decision models differ.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from simcore.models.actor_state import ActorType
from simcore.models.config import DistributionSpec as D
from simcore.models.config import const


def _d(dist: str, **params: Any) -> D:
    low = params.pop("low", None)
    high = params.pop("high", None)
    return D(dist=dist, params=params, low=low, high=high)


@dataclass(slots=True)
class TypeProfile:
    actor_type: ActorType
    primary_objective: str
    secondary_objectives: list[str]
    wealth: D
    traits: dict[str, D]
    decision_models: dict[str, float]       # mixture weights over model registry keys
    market_participant: bool = True         # submits orders on the financial market
    econ_role: str | None = None            # "firm" | "supplier" | "customer" | None
    invested_fraction: D = field(default_factory=lambda: const(0.0))
    trade_fraction: float = 0.08            # typical order size as fraction of wealth
    can_short: bool = False
    can_leverage: bool = False
    econ_template: dict[str, D] = field(default_factory=dict)


TYPE_PROFILES: dict[ActorType, TypeProfile] = {
    ActorType.RETAIL: TypeProfile(
        actor_type=ActorType.RETAIL,
        primary_objective="grow_wealth",
        secondary_objectives=["avoid_losses", "follow_trends"],
        wealth=_d("lognormal", mean=9.2, sigma=0.9),
        traits={
            "risk_tolerance": _d("beta", a=2.2, b=3.5),
            "loss_aversion": _d("gamma", shape=6, scale=0.3, loc=1.0, high=5.0),
            "patience": _d("beta", a=2, b=4),
            "time_horizon": _d("choice", values=[5, 10, 20, 40], probs=[0.3, 0.3, 0.25, 0.15]),
            "information_quality": _d("beta", a=2, b=4),
            "information_delay": _d("choice", values=[1, 2, 3, 4], probs=[0.35, 0.35, 0.2, 0.1]),
            "analytical_capability": _d("beta", a=2, b=4.5),
            "adaptability": _d("beta", a=2.5, b=3),
            "herd_tendency": _d("beta", a=4.5, b=2),
            "trust_level": _d("beta", a=3, b=2.5),
            "market_power": _d("pareto", alpha=3, xm=0.001, high=0.05),
            "network_influence": _d("beta", a=1.6, b=5),
            "memory_length": _d("choice", values=[10, 20, 30], probs=[0.4, 0.4, 0.2]),
            "overconfidence": _d("beta", a=4, b=2.6),
            "survival_threshold": _d("uniform", low=0.2, high=0.45),
            "action_threshold": _d("uniform", low=0.05, high=0.2),
            "regulatory_constraint": const(0.0),
        },
        decision_models={"momentum": 0.30, "imitation": 0.30, "rules": 0.20, "meanrev": 0.10, "adaptive": 0.10},
        invested_fraction=_d("beta", a=2, b=2, scale=0.7),
        trade_fraction=0.12,
    ),
    ActorType.INSTITUTIONAL: TypeProfile(
        actor_type=ActorType.INSTITUTIONAL,
        primary_objective="meet_benchmark",
        secondary_objectives=["preserve_capital", "comply_with_mandate"],
        wealth=_d("lognormal", mean=13.0, sigma=0.6),
        traits={
            "risk_tolerance": _d("beta", a=3, b=3),
            "loss_aversion": _d("gamma", shape=4, scale=0.25, loc=1.0, high=4.0),
            "patience": _d("beta", a=4, b=2),
            "time_horizon": _d("choice", values=[100, 200, 400], probs=[0.4, 0.4, 0.2]),
            "information_quality": _d("beta", a=5, b=2),
            "information_delay": _d("choice", values=[0, 1], probs=[0.6, 0.4]),
            "analytical_capability": _d("beta", a=5, b=2),
            "adaptability": _d("beta", a=3, b=3),
            "herd_tendency": _d("beta", a=2, b=5),
            "trust_level": _d("beta", a=4, b=3),
            "market_power": _d("pareto", alpha=2, xm=0.01, high=0.5),
            "network_influence": _d("beta", a=3, b=3),
            "memory_length": _d("choice", values=[60, 120], probs=[0.5, 0.5]),
            "overconfidence": _d("beta", a=2, b=4),
            "survival_threshold": _d("uniform", low=0.3, high=0.5),
            "action_threshold": _d("uniform", low=0.1, high=0.25),
            "regulatory_constraint": _d("uniform", low=0.2, high=0.5),
        },
        decision_models={"utility": 0.35, "value": 0.30, "rules": 0.20, "adaptive": 0.15},
        invested_fraction=_d("beta", a=5, b=2, scale=0.9),
        trade_fraction=0.05,
    ),
    ActorType.HEDGE_FUND: TypeProfile(
        actor_type=ActorType.HEDGE_FUND,
        primary_objective="maximize_absolute_return",
        secondary_objectives=["exploit_mispricing", "manage_drawdown"],
        wealth=_d("lognormal", mean=12.4, sigma=0.7),
        traits={
            "risk_tolerance": _d("beta", a=6, b=2),
            "loss_aversion": _d("gamma", shape=3, scale=0.2, loc=1.0, high=3.0),
            "patience": _d("beta", a=2, b=3),
            "time_horizon": _d("choice", values=[10, 20, 60], probs=[0.4, 0.4, 0.2]),
            "information_quality": _d("beta", a=6, b=2),
            "information_delay": _d("choice", values=[0, 1], probs=[0.8, 0.2]),
            "analytical_capability": _d("beta", a=6, b=2),
            "adaptability": _d("beta", a=5, b=2),
            "herd_tendency": _d("beta", a=2, b=4),
            "trust_level": _d("beta", a=3, b=3),
            "market_power": _d("pareto", alpha=2, xm=0.02, high=0.6),
            "network_influence": _d("beta", a=3, b=4),
            "memory_length": _d("choice", values=[20, 40, 80], probs=[0.4, 0.4, 0.2]),
            "overconfidence": _d("beta", a=4, b=3),
            "survival_threshold": _d("uniform", low=0.15, high=0.35),
            "action_threshold": _d("uniform", low=0.03, high=0.12),
            "regulatory_constraint": const(0.0),
        },
        decision_models={"adaptive": 0.40, "momentum": 0.30, "value": 0.15, "rules": 0.15},
        invested_fraction=_d("beta", a=5, b=2),
        trade_fraction=0.15,
        can_short=True,
        can_leverage=True,
    ),
    ActorType.BANK: TypeProfile(
        actor_type=ActorType.BANK,
        primary_objective="earn_interest_margin",
        secondary_objectives=["preserve_capital_adequacy", "limit_defaults"],
        wealth=_d("lognormal", mean=14.5, sigma=0.4),
        traits={
            "risk_tolerance": _d("beta", a=2, b=5),
            "loss_aversion": _d("gamma", shape=5, scale=0.3, loc=1.0, high=4.0),
            "patience": _d("beta", a=5, b=2),
            "time_horizon": _d("choice", values=[200, 400], probs=[0.5, 0.5]),
            "information_quality": _d("beta", a=5, b=2),
            "information_delay": _d("choice", values=[0, 1], probs=[0.7, 0.3]),
            "analytical_capability": _d("beta", a=5, b=2),
            "adaptability": _d("beta", a=2.5, b=3),
            "herd_tendency": _d("beta", a=2, b=5),
            "trust_level": _d("beta", a=4, b=3),
            "market_power": _d("pareto", alpha=1.8, xm=0.05, high=0.8),
            "network_influence": _d("beta", a=4, b=3),
            "memory_length": const(120),
            "overconfidence": _d("beta", a=2, b=5),
            "survival_threshold": _d("uniform", low=0.4, high=0.6),
            "action_threshold": _d("uniform", low=0.1, high=0.2),
            "regulatory_constraint": _d("uniform", low=0.5, high=0.8),
        },
        decision_models={"bank": 1.0},
        market_participant=False,
        trade_fraction=0.02,
    ),
    ActorType.FIRM: TypeProfile(
        actor_type=ActorType.FIRM,
        primary_objective="maximize_profit",
        secondary_objectives=["grow_market_share", "maintain_solvency"],
        wealth=_d("lognormal", mean=11.0, sigma=0.6),
        traits={
            "risk_tolerance": _d("beta", a=3, b=3),
            "loss_aversion": _d("gamma", shape=4, scale=0.3, loc=1.0, high=4.0),
            "patience": _d("beta", a=4, b=2.5),
            "time_horizon": _d("choice", values=[100, 250], probs=[0.5, 0.5]),
            "information_quality": _d("beta", a=4, b=3),
            "information_delay": _d("choice", values=[0, 1, 2], probs=[0.4, 0.4, 0.2]),
            "analytical_capability": _d("beta", a=4, b=3),
            "adaptability": _d("beta", a=3, b=3),
            "herd_tendency": _d("beta", a=2.5, b=4),
            "trust_level": _d("beta", a=4, b=3),
            "market_power": _d("pareto", alpha=2.2, xm=0.02, high=0.7),
            "network_influence": _d("beta", a=3, b=3),
            "memory_length": _d("choice", values=[40, 80], probs=[0.5, 0.5]),
            "overconfidence": _d("beta", a=3, b=3),
            "survival_threshold": _d("uniform", low=0.1, high=0.25),
            "action_threshold": _d("uniform", low=0.05, high=0.15),
            "regulatory_constraint": _d("uniform", low=0.1, high=0.3),
        },
        decision_models={"firm": 1.0},
        market_participant=False,
        econ_role="firm",
        econ_template={
            "capacity": _d("gamma", shape=4, scale=40, low=30),
            "price": _d("uniform", low=9.0, high=12.0),
            "cost_ratio": _d("uniform", low=0.55, high=0.7),   # unit_cost = ratio * price
            "inventory_ratio": _d("uniform", low=0.2, high=0.6),
            "pricing_power": _d("beta", a=3, b=3),
            "brand_strength": _d("beta", a=3, b=3),
        },
    ),
    ActorType.SUPPLIER: TypeProfile(
        actor_type=ActorType.SUPPLIER,
        primary_objective="maximize_profit",
        secondary_objectives=["maintain_capacity_utilization", "keep_key_customers"],
        wealth=_d("lognormal", mean=10.2, sigma=0.6),
        traits={
            "risk_tolerance": _d("beta", a=3, b=3.5),
            "loss_aversion": _d("gamma", shape=4, scale=0.3, loc=1.0, high=4.0),
            "patience": _d("beta", a=3.5, b=2.5),
            "time_horizon": _d("choice", values=[60, 150], probs=[0.5, 0.5]),
            "information_quality": _d("beta", a=3, b=3),
            "information_delay": _d("choice", values=[1, 2, 3], probs=[0.4, 0.4, 0.2]),
            "analytical_capability": _d("beta", a=3, b=3),
            "adaptability": _d("beta", a=2.5, b=3.5),
            "herd_tendency": _d("beta", a=2.5, b=4),
            "trust_level": _d("beta", a=4, b=3),
            "market_power": _d("pareto", alpha=2.5, xm=0.01, high=0.5),
            "network_influence": _d("beta", a=2, b=4),
            "memory_length": _d("choice", values=[30, 60], probs=[0.5, 0.5]),
            "overconfidence": _d("beta", a=3, b=3.5),
            "survival_threshold": _d("uniform", low=0.1, high=0.2),
            "action_threshold": _d("uniform", low=0.05, high=0.15),
            "regulatory_constraint": const(0.0),
        },
        decision_models={"supplier": 1.0},
        market_participant=False,
        econ_role="supplier",
        econ_template={
            "capacity": _d("gamma", shape=4, scale=60, low=50),
            "price": _d("uniform", low=3.5, high=5.0),
            "cost_ratio": _d("uniform", low=0.5, high=0.7),
        },
    ),
    ActorType.CUSTOMER: TypeProfile(
        actor_type=ActorType.CUSTOMER,
        primary_objective="maximize_perceived_value",
        secondary_objectives=["stay_within_budget"],
        wealth=_d("lognormal", mean=8.0, sigma=0.7),
        traits={
            "risk_tolerance": _d("beta", a=3, b=3),
            "loss_aversion": _d("gamma", shape=5, scale=0.3, loc=1.0, high=5.0),
            "patience": _d("beta", a=3, b=3),
            "time_horizon": _d("choice", values=[10, 30], probs=[0.6, 0.4]),
            "information_quality": _d("beta", a=2.5, b=3.5),
            "information_delay": _d("choice", values=[1, 2, 3], probs=[0.4, 0.4, 0.2]),
            "analytical_capability": _d("beta", a=2.5, b=3.5),
            "adaptability": _d("beta", a=3, b=3),
            "herd_tendency": _d("beta", a=4, b=2.5),
            "trust_level": _d("beta", a=3.5, b=3),
            "market_power": _d("pareto", alpha=3.5, xm=0.0005, high=0.01),
            "network_influence": _d("beta", a=2, b=5),
            "memory_length": _d("choice", values=[10, 20], probs=[0.6, 0.4]),
            "overconfidence": _d("beta", a=3, b=3),
            "survival_threshold": _d("uniform", low=0.05, high=0.15),
            "action_threshold": _d("uniform", low=0.05, high=0.15),
            "regulatory_constraint": const(0.0),
        },
        decision_models={"customer": 1.0},
        market_participant=False,
        econ_role="customer",
        econ_template={
            "base_income": _d("lognormal", mean=6.75, sigma=0.5),
            "price_sensitivity": _d("gamma", shape=3, scale=0.5, loc=0.5, high=4.0),
            "loyalty": _d("beta", a=3, b=3),
        },
    ),
    ActorType.REGULATOR: TypeProfile(
        actor_type=ActorType.REGULATOR,
        primary_objective="maintain_stability",
        secondary_objectives=["protect_consumers", "enforce_rules"],
        wealth=const(0.0),
        traits={
            "risk_tolerance": _d("beta", a=2, b=6),
            "loss_aversion": const(2.0),
            "patience": _d("beta", a=5, b=2),
            "time_horizon": const(400),
            "information_quality": _d("beta", a=4, b=2.5),
            "information_delay": _d("choice", values=[2, 3, 5], probs=[0.4, 0.4, 0.2]),
            "analytical_capability": _d("beta", a=4, b=2.5),
            "adaptability": _d("beta", a=2, b=4),
            "herd_tendency": const(0.05),
            "trust_level": _d("beta", a=4, b=3),
            "market_power": _d("uniform", low=0.5, high=0.9),
            "network_influence": _d("uniform", low=0.5, high=0.9),
            "memory_length": const(200),
            "overconfidence": _d("beta", a=2, b=5),
            "survival_threshold": const(0.0),
            "action_threshold": _d("uniform", low=0.3, high=0.5),  # reaction threshold
            "regulatory_constraint": const(0.0),
        },
        decision_models={"regulator": 1.0},
        market_participant=False,
    ),
    ActorType.MEDIA: TypeProfile(
        actor_type=ActorType.MEDIA,
        primary_objective="maximize_attention",
        secondary_objectives=["build_credibility"],
        wealth=const(0.0),
        traits={
            "risk_tolerance": _d("beta", a=3, b=3),
            "loss_aversion": const(1.5),
            "patience": _d("beta", a=2, b=4),
            "time_horizon": const(20),
            "information_quality": _d("beta", a=4, b=3),
            "information_delay": _d("choice", values=[0, 1], probs=[0.7, 0.3]),
            "analytical_capability": _d("beta", a=3, b=3),
            "adaptability": _d("beta", a=3, b=3),
            "herd_tendency": _d("beta", a=3, b=3),
            "trust_level": _d("beta", a=3, b=3),
            "market_power": const(0.0),
            "network_influence": _d("beta", a=6, b=2),           # media are hubs
            "memory_length": const(30),
            "overconfidence": _d("beta", a=3, b=3),
            "survival_threshold": const(0.0),
            "action_threshold": _d("uniform", low=0.1, high=0.3),
            "regulatory_constraint": const(0.0),
        },
        decision_models={"media": 1.0},
        market_participant=False,
    ),
}


# sensationalism / bias are media-specific extras drawn at init into internal_state
MEDIA_EXTRAS: dict[str, D] = {
    "sensationalism": _d("beta", a=4, b=2.5),
    "bias": _d("normal", mean=0.0, std=0.25, low=-0.6, high=0.6),
    "reach": _d("beta", a=4, b=2),
}
