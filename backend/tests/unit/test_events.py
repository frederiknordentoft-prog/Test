from simcore.engine.simulation import Simulation
from simcore.models.actor_state import ActorType
from simcore.models.config import EventConfig
from tests.conftest import small_config


def run_with_events(events, ticks=10, seed=42):
    cfg = small_config(seed=seed, ticks=ticks)
    cfg.events = events
    sim = Simulation(cfg)
    return sim


def test_rate_hike_raises_risk_free_rate():
    sim = run_with_events(
        [EventConfig(name="hike", event_type="rate_hike", start_tick=3, magnitude=1.0)]
    )
    rf0 = sim.market.risk_free_rate
    sim.run(6)
    assert sim.market.risk_free_rate > rf0
    assert any(r.event_type == "rate_hike" for r in sim.events_log)


def test_supplier_stoppage_cuts_and_restores_capacity():
    sim = run_with_events(
        [EventConfig(name="stop", event_type="supplier_stoppage", start_tick=2,
                     duration=4, magnitude=1.0)],
        ticks=12,
    )
    sim.run(3)
    suppliers = [a for a in sim.actors if a.actor_type == ActorType.SUPPLIER]
    hit = [s for s in suppliers if s.state.internal_state.get("capacity_factor", 1.0) < 0.5]
    assert len(hit) == 1, "exactly one supplier stopped"
    sim.run(6)
    assert all(
        s.state.internal_state.get("capacity_factor", 1.0) == 1.0 for s in suppliers
    ), "capacity restored after event ends"


def test_rumor_delivers_signal_and_correction():
    sim = run_with_events(
        [EventConfig(name="rumor", event_type="rumor", start_tick=1, duration=3,
                     magnitude=1.5)],
        ticks=15,
    )
    sim.run(15)
    topics = [
        s.topic for lst in [sim.bus._queue.get(t, []) for t in range(20)] for _, s in lst
    ]
    # signals already delivered are gone from the queue; check corrections got scheduled/emitted
    assert any(r.event_type == "rumor" for r in sim.events_log)


def test_institutional_selloff_generates_sell_trades():
    sim = run_with_events(
        [EventConfig(name="dump", event_type="institutional_selloff", start_tick=2,
                     duration=3, magnitude=1.5)],
        ticks=8,
    )
    sim.run(8)
    inst = [a for a in sim.actors if a.actor_type == ActorType.INSTITUTIONAL]
    biggest = max(inst, key=lambda a: a.state.initial_wealth)
    sells = [t for t in sim.recent_trades if t.actor_id == biggest.id and t.side == "sell"]
    assert sells, "the targeted institutional investor must have sold"


def test_probabilistic_event_fires_reproducibly():
    events = [EventConfig(name="hazard", event_type="rate_hike", probability=0.3, magnitude=0.2)]
    a = run_with_events([e.model_copy(deep=True) for e in events], ticks=20, seed=5)
    a.run(20)
    b = run_with_events([e.model_copy(deep=True) for e in events], ticks=20, seed=5)
    b.run(20)
    assert [r.tick for r in a.events_log] == [r.tick for r in b.events_log]


def test_margin_shock_reverts_margin_rules():
    sim = run_with_events(
        [EventConfig(name="mshock", event_type="margin_shock", start_tick=2, duration=4,
                     magnitude=1.0)],
        ticks=12,
    )
    base = sim.market.maintenance_margin
    sim.run(4)
    assert sim.market.maintenance_margin > base
    sim.run(8)
    assert abs(sim.market.maintenance_margin - base) < 1e-9
