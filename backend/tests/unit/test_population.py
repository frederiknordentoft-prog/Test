import numpy as np

from simcore.agents.population import PopulationFactory
from simcore.engine.rng import RngHub
from simcore.models.actor_state import ActorType
from tests.conftest import small_config


def build(seed=42):
    cfg = small_config(seed=seed)
    hub = RngHub(cfg.seed, cfg.n_actors, len(cfg.assets))
    actors, arrays = PopulationFactory(cfg, hub).build()
    return cfg, actors, arrays


def test_counts_match_config():
    cfg, actors, _ = build()
    assert len(actors) == cfg.n_actors
    retail = [a for a in actors if a.actor_type == ActorType.RETAIL]
    assert len(retail) == cfg.actors["retail"].count


def test_actors_are_heterogeneous():
    _, actors, _ = build()
    retail = [a for a in actors if a.actor_type == ActorType.RETAIL]
    risk = np.array([a.traits.risk_tolerance for a in retail])
    wealth = np.array([a.state.initial_wealth for a in retail])
    assert risk.std() > 0.01, "traits must vary within a type"
    assert wealth.std() > 0.0
    # structural differences between types
    inst = [a for a in actors if a.actor_type == ActorType.INSTITUTIONAL]
    assert np.mean([a.traits.herd_tendency for a in retail]) > np.mean(
        [a.traits.herd_tendency for a in inst]
    ), "retail must herd more than institutions on average"
    assert np.mean([a.state.initial_wealth for a in inst]) > np.mean(wealth)


def test_decision_model_mixture_assigned():
    _, actors, _ = build()
    retail_models = {a.model.name for a in actors if a.actor_type == ActorType.RETAIL}
    assert len(retail_models) >= 3, "retail should mix several decision models"
    firms = [a for a in actors if a.actor_type == ActorType.FIRM]
    assert all(a.model.name == "firm" for a in firms)


def test_market_participants_have_portfolios():
    _, actors, _ = build()
    investors = [a for a in actors if a.market_participant]
    with_positions = [a for a in investors if a.state.positions]
    assert len(with_positions) > len(investors) * 0.5


def test_econ_actors_have_econ_state():
    _, actors, _ = build()
    for a in actors:
        if a.actor_type in (ActorType.FIRM, ActorType.SUPPLIER, ActorType.CUSTOMER):
            assert a.econ is not None
        if a.actor_type == ActorType.FIRM:
            assert a.econ.capacity > 0


def test_wealth_never_negative_at_init():
    _, actors, _ = build()
    prices = {"A1": 100.0, "A2": 50.0}
    for a in actors:
        assert a.state.wealth(prices) >= -1e-6
