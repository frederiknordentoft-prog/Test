"""PopulationFactory: turns a SimConfig into a heterogeneous actor population.

All draws use the dedicated population RNG stream. Listed firms (the first
``n_assets`` firm actors, capacity-boosted) get their share count calibrated so
that fundamental value per share == the asset's initial price at t=0 — this
keeps price and fundamentals consistent regardless of the population scale.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from simcore.agents.actor import Actor, new_actor_state
from simcore.agents.type_profiles import MEDIA_EXTRAS, TYPE_PROFILES, TypeProfile
from simcore.decisions.registry import get_model
from simcore.engine.rng import RngHub
from simcore.models.actor_state import ActorType, EconState, Traits
from simcore.models.config import SimConfig

INT_TRAITS = {"time_horizon", "information_delay", "memory_length"}


@dataclass(slots=True)
class PopulationArrays:
    """Columnar mirror of actor state for vectorized stages."""

    n: int
    wealth: np.ndarray
    cash: np.ndarray
    sentiment: np.ndarray
    stress: np.ndarray
    leverage: np.ndarray
    alive: np.ndarray            # bool
    market_power: np.ndarray
    info_quality: np.ndarray
    info_delay: np.ndarray       # int
    herd: np.ndarray
    trust: np.ndarray
    survival_wealth: np.ndarray  # absolute distress line per actor
    is_market: np.ndarray        # bool: participates in the financial market
    type_code: np.ndarray        # int index into ACTOR_TYPE_ORDER

    def sync(self, actors: list[Actor], prices: dict[str, float]) -> None:
        for a in actors:
            i = a.id
            s = a.state
            self.wealth[i] = s.wealth(prices)
            self.cash[i] = s.cash
            self.sentiment[i] = s.sentiment
            self.stress[i] = s.stress
            self.leverage[i] = s.leverage(prices)
            self.alive[i] = s.alive


ACTOR_TYPE_ORDER = [t.value for t in ActorType]


def _sample_traits(profile: TypeProfile, overrides: dict, count: int, rng: np.random.Generator) -> list[Traits]:
    merged = dict(profile.traits)
    merged.update(overrides or {})
    columns: dict[str, np.ndarray] = {}
    for name, spec in merged.items():
        columns[name] = spec.sample(rng, size=count)
    traits_list = []
    for i in range(count):
        kwargs = {}
        for name, col in columns.items():
            v = col[i]
            kwargs[name] = int(round(float(v))) if name in INT_TRAITS else float(v)
        traits_list.append(Traits(**kwargs))
    return traits_list


class PopulationFactory:
    def __init__(self, config: SimConfig, hub: RngHub):
        self.config = config
        self.hub = hub

    def build(self) -> tuple[list[Actor], PopulationArrays]:
        cfg = self.config
        rng = self.hub.population
        actors: list[Actor] = []
        next_id = 0

        asset_ids = [a.asset_id for a in cfg.assets]
        price0 = {a.asset_id: a.initial_price for a in cfg.assets}

        for type_key, tc in cfg.actors.items():
            atype = ActorType(type_key)
            profile = TYPE_PROFILES[atype]
            n = tc.count
            if n <= 0:
                continue
            traits_list = _sample_traits(profile, tc.traits, n, rng)
            wealth_spec = tc.wealth or profile.wealth
            wealth = np.maximum(wealth_spec.sample(rng, size=n), 0.0)
            mix = tc.decision_models or profile.decision_models
            model_names = list(mix.keys())
            probs = np.array(list(mix.values()), dtype=float)
            probs = probs / probs.sum()
            assigned = rng.choice(model_names, size=n, p=probs)
            invested = profile.invested_fraction.sample(rng, size=n)

            for i in range(n):
                t = traits_list[i]
                state = new_actor_state(float(wealth[i]))
                state.strategy = str(assigned[i])
                model = get_model(str(assigned[i]))
                actor = Actor(
                    id=next_id,
                    actor_type=atype,
                    name=f"{atype.value}_{next_id}",
                    traits=t,
                    state=state,
                    rng=self.hub.actors[next_id],
                    model=model,
                    primary_objective=profile.primary_objective,
                    secondary_objectives=list(profile.secondary_objectives),
                    market_participant=profile.market_participant,
                    can_short=profile.can_short,
                    can_leverage=profile.can_leverage,
                    trade_fraction=profile.trade_fraction,
                )
                if profile.market_participant and wealth[i] > 0:
                    self._init_portfolio(actor, float(invested[i]), asset_ids, price0, rng)
                if profile.econ_role:
                    actor.econ = self._init_econ(profile, rng)
                if atype == ActorType.MEDIA:
                    for k, spec in MEDIA_EXTRAS.items():
                        actor.state.internal_state[k] = spec.sample(rng)
                actors.append(actor)
                next_id += 1

        self._assign_listed_firms(actors)
        arrays = self._build_arrays(actors, price0)
        return actors, arrays

    # ------------------------------------------------------------------ #
    def _init_portfolio(
        self,
        actor: Actor,
        invested_frac: float,
        asset_ids: list[str],
        price0: dict[str, float],
        rng: np.random.Generator,
    ) -> None:
        s = actor.state
        w = s.initial_wealth
        frac = float(np.clip(invested_frac, 0.0, 0.95))
        if frac <= 0.01 or not asset_ids:
            return
        k = int(rng.integers(1, min(3, len(asset_ids)) + 1))
        chosen = list(rng.choice(asset_ids, size=k, replace=False))
        splits = rng.dirichlet(np.ones(k))
        lever = 1.0
        if actor.can_leverage:
            lever = 1.0 + float(rng.beta(2, 3)) * 1.0  # initial leverage 1.0–2.0
        target_value = w * frac * lever
        s.margin_debt = max(0.0, target_value - w * frac)
        s.cash = w - w * frac
        for a, sp in zip(chosen, splits):
            qty = target_value * float(sp) / price0[a]
            s.positions[a] = s.positions.get(a, 0.0) + qty

    def _init_econ(self, profile: TypeProfile, rng: np.random.Generator) -> EconState:
        tpl = profile.econ_template
        econ = EconState()
        if profile.econ_role in ("firm", "supplier"):
            econ.capacity = float(tpl["capacity"].sample(rng)) if "capacity" in tpl else 100.0
            econ.price = float(tpl["price"].sample(rng)) if "price" in tpl else 10.0
            cost_ratio = float(tpl["cost_ratio"].sample(rng)) if "cost_ratio" in tpl else 0.6
            econ.unit_cost = econ.price * cost_ratio
            if "inventory_ratio" in tpl:
                econ.inventory = econ.capacity * float(tpl["inventory_ratio"].sample(rng))
            if "pricing_power" in tpl:
                econ.pricing_power = float(tpl["pricing_power"].sample(rng))
            if "brand_strength" in tpl:
                econ.brand_strength = float(tpl["brand_strength"].sample(rng))
            econ.employees = econ.capacity / 10.0
        elif profile.econ_role == "customer":
            econ.base_income = float(tpl["base_income"].sample(rng)) if "base_income" in tpl else 100.0
            econ.budget = econ.base_income
            econ.price_sensitivity = (
                float(tpl["price_sensitivity"].sample(rng)) if "price_sensitivity" in tpl else 1.5
            )
            econ.loyalty = float(tpl["loyalty"].sample(rng)) if "loyalty" in tpl else 0.5
        return econ

    def _assign_listed_firms(self, actors: list[Actor]) -> None:
        """Boost the first n_assets firms, list them, and calibrate share counts
        so fundamental_per_share == initial price at t=0."""
        cfg = self.config
        firms = [a for a in actors if a.actor_type == ActorType.FIRM and a.econ is not None]
        suppliers = [a for a in actors if a.actor_type == ActorType.SUPPLIER and a.econ is not None]
        customers = [a for a in actors if a.actor_type == ActorType.CUSTOMER and a.econ is not None]
        if not firms:
            return

        boost = cfg.economy.listed_capacity_boost
        for firm, asset in zip(firms, cfg.assets):
            firm.econ.capacity *= boost
            firm.econ.inventory *= boost
            firm.econ.employees *= boost
            firm.econ.listed_asset = asset.asset_id

        avg_supplier_price = float(np.mean([s.econ.price for s in suppliers])) if suppliers else 4.25
        unit_cost_est = avg_supplier_price + cfg.economy.wage_per_capacity
        total_spend = sum(c.econ.base_income for c in customers) * cfg.economy.base_demand_budget_share
        total_capacity = sum(f.econ.capacity for f in firms)
        avg_price = float(np.mean([f.econ.price for f in firms]))
        expected_util = float(np.clip(total_spend / max(total_capacity * avg_price, 1e-9), 0.05, 1.0))

        for firm in firms:
            e = firm.econ
            e.unit_cost = unit_cost_est
            e.utilization = expected_util
            earnings_est = e.capacity * expected_util * max(e.price - unit_cost_est, 0.1)
            e.earnings = earnings_est
            e.earnings_smoothed = earnings_est
            if e.listed_asset is not None:
                p0 = next(a.initial_price for a in cfg.assets if a.asset_id == e.listed_asset)
                e.shares_outstanding = max(earnings_est, 1.0) / (cfg.economy.discount_rate * p0)

    def _build_arrays(self, actors: list[Actor], prices: dict[str, float]) -> PopulationArrays:
        n = len(actors)
        arr = PopulationArrays(
            n=n,
            wealth=np.zeros(n),
            cash=np.zeros(n),
            sentiment=np.zeros(n),
            stress=np.zeros(n),
            leverage=np.zeros(n),
            alive=np.ones(n, dtype=bool),
            market_power=np.zeros(n),
            info_quality=np.zeros(n),
            info_delay=np.zeros(n, dtype=int),
            herd=np.zeros(n),
            trust=np.zeros(n),
            survival_wealth=np.zeros(n),
            is_market=np.zeros(n, dtype=bool),
            type_code=np.zeros(n, dtype=int),
        )
        for a in actors:
            i = a.id
            arr.market_power[i] = a.traits.market_power
            arr.info_quality[i] = a.traits.information_quality
            arr.info_delay[i] = a.traits.information_delay
            arr.herd[i] = a.traits.herd_tendency
            arr.trust[i] = a.traits.trust_level
            arr.survival_wealth[i] = a.traits.survival_threshold * a.state.initial_wealth
            arr.is_market[i] = a.market_participant
            arr.type_code[i] = ACTOR_TYPE_ORDER.index(a.actor_type.value)
        arr.sync(actors, prices)
        return arr
