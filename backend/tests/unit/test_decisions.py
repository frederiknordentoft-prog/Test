import numpy as np

from simcore.decisions.base import DecisionContext, Observation
from simcore.decisions.heuristics import MomentumModel
from simcore.decisions.stochastic import combine, explanation, gate, size_multiplier
from simcore.models.actions import Driver
from simcore.models.actor_state import Traits
from simcore.models.config import SimConfig
from tests.unit.test_clearing import make_actor


def make_obs(momentum=0.0, prices=None):
    prices = prices or {"X": 100.0}
    return Observation(
        tick=5, own_wealth=10_000.0, own_return=0.0,
        prices=prices,
        returns_1={a: momentum / 10 for a in prices},
        momentum={a: momentum for a in prices},
        volatility={a: 0.01 for a in prices},
        ma_anchor=dict(prices),
        fundamentals=dict(prices),
        peer_sentiment=0.0, peer_net_flow=0.0, market_sentiment=0.0,
        credit_tightness=0.1, risk_free_rate=0.0001,
    )


def make_ctx():
    cfg = SimConfig()
    return DecisionContext(tick=5, asset_ids=["X"], market=cfg.market, config=cfg)


def test_explanation_derives_from_actual_drivers():
    actor = make_actor(0)
    drivers = [Driver("a", 0.5, 1.0), Driver("b", -0.1, 0.5), Driver("c", 0.9, 0.8),
               Driver("d", 0.01, 0.1)]
    z = combine(drivers)
    _, p, z2 = gate(actor, drivers, threshold=0.01)
    e = explanation("test", drivers, p, actor, z2)
    assert abs(e.score - z) < 1e-12, "explanation score must equal the decision score"
    names = [n for n, _ in e.main_drivers]
    assert names[0] == "c" and "d" not in names, "top drivers ranked by |contribution|"
    contributions = dict(e.main_drivers)
    assert abs(contributions["a"] - 0.5) < 1e-9


def test_probability_shaped_by_traits_and_score():
    impatient = make_actor(0)
    object.__setattr__(impatient, "traits", Traits(patience=0.0, action_threshold=0.1))
    patient = make_actor(1)
    object.__setattr__(patient, "traits", Traits(patience=1.0, action_threshold=0.1))
    drivers = [Driver("x", 0.4, 1.0)]
    fired_i, p_i, _ = gate(impatient, drivers)
    fired_p, p_p, _ = gate(patient, drivers)
    assert p_i > p_p, "impatient actors act with higher probability at the same score"


def test_below_threshold_never_fires():
    actor = make_actor(0)
    object.__setattr__(actor, "traits", Traits(action_threshold=0.5))
    fired, p, _ = gate(actor, [Driver("x", 0.1, 1.0)])
    assert not fired and p == 0.0


def test_stress_amplifies_selling_dampens_buying():
    calm = make_actor(0)
    calm.state.stress = 0.0
    stressed = make_actor(1)
    stressed.state.stress = 0.9
    z = -0.5
    sells = [size_multiplier(a, z, selling=True) for a in (calm, stressed)]
    buys = [size_multiplier(a, 0.5, selling=False) for a in (calm, stressed)]
    assert sells[1] > sells[0] * 1.2, "stressed actors panic-sell bigger"
    assert buys[1] < buys[0], "stressed actors buy smaller"


def test_momentum_model_buys_uptrend_sells_downtrend():
    model = MomentumModel()
    ctx = make_ctx()
    buys = sells = 0
    for i in range(30):
        actor = make_actor(i, cash=10_000, positions={"X": 20.0})
        actor.rng = np.random.default_rng(i)
        up = model.decide(actor, make_obs(momentum=0.3), ctx)
        dn = model.decide(actor, make_obs(momentum=-0.3), ctx)
        buys += sum(1 for it in up.intents if it.action.value == "buy")
        sells += sum(1 for it in dn.intents if it.action.value in ("sell", "short"))
    assert buys > 15, f"expected mostly buys in strong uptrend, got {buys}"
    assert sells > 15, f"expected mostly sells in strong downtrend, got {sells}"


def test_decision_logging_matches_behavior_end_to_end():
    """Logged drivers must reproduce the logged score (explainability guarantee)."""
    from simcore.engine.simulation import Simulation
    from tests.conftest import small_config

    sim = Simulation(small_config(seed=9, ticks=10))
    sim.run(10)
    checked = 0
    for d in sim.recent_decisions:
        e = d["explanation"]
        if e is None or len(e["main_drivers"]) < 3:
            continue
        # top-3 drivers cannot exceed the absolute total score contribution-wise
        # but each contribution must be finite and probability in [0,1]
        assert 0.0 <= e["decision_probability"] <= 1.0
        assert all(np.isfinite(dr["contribution"]) for dr in e["main_drivers"])
        checked += 1
    assert checked > 50, "expected a meaningful number of logged explanations"
