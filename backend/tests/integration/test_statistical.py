"""Statistical integration tests (paired seeds / common random numbers).

Baseline and treatment share the same seed list, so population and event noise
cancel and directional effects show through with few pairs. Assertions are
interval/sign-based — single runs are allowed to deviate.

Run with:  pytest -m statistical
"""
import numpy as np
import pytest

from simcore.engine.simulation import Simulation
from simcore.models.config import EventConfig
from tests.conftest import small_config

SEEDS = list(range(101, 113))  # 12 paired seeds
pytestmark = pytest.mark.statistical


def run_sim(cfg):
    sim = Simulation(cfg)
    sim.run(cfg.ticks)
    return sim


def mean_post(sim, key, from_tick):
    vals = [m[key] for m in sim.metrics_history if m["tick"] >= from_tick]
    return float(np.mean(vals))


def test_negative_shock_lowers_prices_on_average():
    """A large institutional sell-off + rate hike should on average depress
    post-shock prices relative to the same seed without the shock."""
    deltas = []
    for seed in SEEDS:
        base = run_sim(small_config(seed=seed, ticks=120))
        shocked_cfg = small_config(seed=seed, ticks=120)
        shocked_cfg.events = [
            EventConfig(name="hike", event_type="rate_hike", start_tick=40, magnitude=1.5),
            EventConfig(name="dump", event_type="institutional_selloff", start_tick=45,
                        duration=6, magnitude=1.5),
        ]
        shocked = run_sim(shocked_cfg)
        deltas.append(
            mean_post(shocked, "price_index", 45) - mean_post(base, "price_index", 45)
        )
    deltas = np.array(deltas)
    n_negative = int((deltas < 0).sum())
    assert deltas.mean() < -1.0, f"mean post-shock delta {deltas.mean():.2f} not negative enough"
    assert n_negative >= 9, f"only {n_negative}/12 seeds moved in the expected direction"


def test_high_leverage_fattens_downside():
    """More leverage must amplify downside fragility under the same shock.

    At this population size the price index's whole-run drawdown is dominated
    by endogenous sentiment cycles, so the leverage channel is asserted on the
    quantities leverage actually drives: margin-call cascades, forced-sale
    volume, and actor failures (which in turn feed price impact)."""
    rows_high, rows_low = [], []
    for seed in SEEDS:
        for lev, sink in ((5.0, rows_high), (1.2, rows_low)):
            cfg = small_config(seed=seed, ticks=120)
            cfg.actors["hedge_fund"].count = 16
            cfg.actors["retail"].count = 30
            cfg.market.max_leverage = lev
            if lev > 2:  # generous margin rules amplify the leverage channel
                cfg.market.initial_margin = 0.25
                cfg.market.maintenance_margin = 0.15
            cfg.events = [
                EventConfig(name="dump", event_type="institutional_selloff",
                            start_tick=40, duration=5, magnitude=1.5),
            ]
            sim = run_sim(cfg)
            mh = sim.metrics_history
            sink.append({
                "margin_calls": mh[-1]["margin_calls_total"],
                "bankruptcies": mh[-1]["bankruptcies_total"],
                "forced_share": float(np.mean(
                    [m["forced_volume_share"] for m in mh if 40 <= m["tick"] < 80]
                )),
            })
    calls_h = np.array([r["margin_calls"] for r in rows_high])
    calls_l = np.array([r["margin_calls"] for r in rows_low])
    bank_h = np.array([r["bankruptcies"] for r in rows_high])
    bank_l = np.array([r["bankruptcies"] for r in rows_low])
    forced_h = np.array([r["forced_share"] for r in rows_high])
    forced_l = np.array([r["forced_share"] for r in rows_low])
    assert calls_h.mean() > 2 * calls_l.mean(), (
        f"margin calls high {calls_h.mean():.1f} vs low {calls_l.mean():.1f}"
    )
    assert int((calls_h > calls_l).sum()) >= 10, "margin-call channel not directional"
    assert bank_h.mean() > bank_l.mean(), (
        f"bankruptcies high {bank_h.mean():.1f} vs low {bank_l.mean():.1f}"
    )
    assert forced_h.mean() > forced_l.mean(), "forced-sale share must rise with leverage"


def test_concentrated_suppliers_more_fragile_under_stoppage():
    """A concentrated supplier base should lose more production when the
    largest supplier stops than a fragmented one."""
    drop_conc, drop_frag = [], []
    for seed in SEEDS:
        for n_sup, sink in ((3, drop_conc), (16, drop_frag)):
            cfg = small_config(seed=seed, ticks=100)
            cfg.actors["supplier"].count = n_sup
            cfg.events = [
                EventConfig(name="stop", event_type="supplier_stoppage", start_tick=30,
                            duration=30, magnitude=1.0),
            ]
            sim = run_sim(cfg)
            pre = np.mean([m["total_production"] for m in sim.metrics_history
                           if 10 <= m["tick"] < 30])
            during = np.mean([m["total_production"] for m in sim.metrics_history
                              if 32 <= m["tick"] < 60])
            sink.append((pre - during) / max(pre, 1e-9))
    drop_conc, drop_frag = np.array(drop_conc), np.array(drop_frag)
    directional = int((drop_conc > drop_frag).sum())
    assert drop_conc.mean() > drop_frag.mean(), (
        f"concentrated production drop {drop_conc.mean():.3f} <= fragmented {drop_frag.mean():.3f}"
    )
    assert directional >= 8, f"only {directional}/12 seeds directional"
