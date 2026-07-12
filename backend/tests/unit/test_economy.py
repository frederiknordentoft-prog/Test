import numpy as np

from simcore.engine.simulation import Simulation
from tests.conftest import small_config


def test_goods_loop_produces_and_sells():
    sim = Simulation(small_config(seed=42, ticks=10))
    sim.run(10)
    m = sim.metrics_history[-1]
    assert m["total_production"] > 0
    assert m["total_sales_value"] > 0
    assert m["avg_firm_price"] > 0


def test_fundamentals_track_earnings():
    sim = Simulation(small_config(seed=42, ticks=5))
    listed = [a for a in sim.actors if a.econ and a.econ.listed_asset]
    assert listed, "some firms must be listed"
    for f in listed:
        asset = sim.market.assets[f.econ.listed_asset]
        implied = max(f.econ.earnings_smoothed, 0.0) / (
            sim.config.economy.discount_rate * f.econ.shares_outstanding
        )
        assert abs(asset.fundamental - implied) < 1e-6


def test_fundamental_starts_near_initial_price():
    sim = Simulation(small_config(seed=42, ticks=5))
    for aid, asset in sim.market.assets.items():
        assert 0.7 * asset.initial_price <= asset.fundamental <= 1.3 * asset.initial_price, (
            f"{aid}: fundamental {asset.fundamental} not calibrated to price {asset.initial_price}"
        )


def test_economy_disabled_still_runs_market():
    cfg = small_config(seed=42, ticks=15)
    cfg.economy.enabled = False
    sim = Simulation(cfg)
    assert sim.goods is None
    sim.run(15)
    assert len(sim.metrics_history) == 15
    assert sim.metrics_history[-1]["total_volume"] >= 0


def test_customer_budgets_respond_to_income_factor():
    cfg = small_config(seed=42, ticks=6)
    sim = Simulation(cfg)
    sim.run(3)
    budgets_before = np.mean([c.econ.budget for c in sim.goods.customers])
    for c in sim.goods.customers:
        c.state.internal_state["income_factor"] = 0.5
    sim.run(3)
    budgets_after = np.mean([c.econ.budget for c in sim.goods.customers])
    assert budgets_after < budgets_before * 0.75
