"""Companion — competitor & industry intelligence: operator P&L.

Until this layer, operators could max every commercial lever for free. Now each
operator has a monthly income statement calibrated to real annual-report ratios
(Flutter marketing 22.8 % of revenue, competitive EBIT margin 18-25 %, monopoly
~39 %), so commercial intensity has a *cost* and an aggressive challenger's
acquisition burn can exhaust the cash runway it entered with — the way a
real high-burn entrant (DraftKings CAC/LTV, Betano playbook) does.
"""
import numpy as np
import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.config import GamblingConfig
from simcore.gambling.economics import OperatorEconomics
from simcore.gambling.simulation import GamblingSimulation


def _sim(ticks=24, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), **g}
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


# --------------------------------------------------------------------------- #
# The P&L identity and the calibrated margins
def test_pnl_identity_holds_per_operator():
    """GGR must decompose exactly into tax + marketing + bonus + opex + EBIT."""
    sim = _sim(ticks=6)
    last = sim.economics.last
    assert last, "economics should have produced a P&L"
    for oid, row in last.items():
        recon = row["tax"] + row["marketing"] + row["bonus"] + row["opex"] + row["ebit"]
        # Each field is rounded to 3 decimals, so allow the accumulated rounding.
        assert recon == pytest.approx(row["ggr"], abs=0.01), f"{oid} P&L does not reconcile"


def test_monopoly_margin_exceeds_competitive():
    """Danske Spil's monopoly block spends almost nothing on acquisition and so
    nets a far higher margin than a competitive operator (the ~39 % vs ~20 %
    gap in the real reports)."""
    sim = _sim(ticks=12)
    last = sim.economics.last
    mono = last["ds_lotteri"]["ebit_margin"]
    comp = last["unibet"]["ebit_margin"]
    assert mono > comp
    assert mono > 0.35, f"monopoly margin {mono:.3f} should sit near the ~39 % anchor"


def test_ds_aggregate_ebit_margin_near_anchor():
    """The Danske Spil blended EBIT margin lands near the 0.389 annual-report
    anchor (2.008/5.158 bn)."""
    sim = _sim(ticks=12)
    m = sim.metrics_history[-1]
    assert m["ds_ebit_margin"] == pytest.approx(0.389, abs=0.05)


def test_marketing_is_roughly_a_fifth_of_ggr_for_a_reach_competitor():
    """Calibration target: a competitive operator at marketing_reach ≈ 0.6 spends
    on the order of 20 % of GGR on marketing (Flutter 22.8 %)."""
    sim = _sim(ticks=6)
    row = sim.economics.last["bet365"]           # reach 0.60, no ad ban in baseline
    ratio = row["marketing"] / row["ggr"]
    assert 0.15 <= ratio <= 0.25, f"marketing/GGR {ratio:.3f} off the ~20 % anchor"


def test_aggressive_challenger_burns():
    """The sponsorship-led challenger (reach 0.95, bonus 0.95) runs its
    commercial levers hot — its EBIT margin is far below the mature operators',
    and can be negative (spend-now-earn-later acquisition)."""
    sim = _sim(ticks=36, entry_enabled=True)
    if "challenger" not in sim.economics.last:
        pytest.skip("challenger did not enter in this seed/horizon")
    ch = sim.economics.last["challenger"]["ebit_margin"]
    mature = sim.economics.last["unibet"]["ebit_margin"]
    assert ch < mature


# --------------------------------------------------------------------------- #
# Runway / cash-exhaustion mechanics
def test_register_runway_and_drop():
    econ = OperatorEconomics(GamblingConfig())
    econ.register_runway("x", 300.0)
    assert econ.cash["x"] == 300.0 and econ.burn_months["x"] == 0
    econ.drop("x")
    assert "x" not in econ.cash and "x" not in econ.burn_months


def test_cash_exhausted_requires_runway_and_grace():
    g = GamblingConfig(econ_runway=50.0, econ_burn_grace=3)
    econ = OperatorEconomics(g)
    # Healthy cash → never exhausted.
    econ.cash["a"] = 100.0
    econ.burn_months["a"] = 12
    assert not econ.cash_exhausted("a")
    # Burned past the runway but not past the grace period yet.
    econ.cash["b"] = -80.0
    econ.burn_months["b"] = 2
    assert not econ.cash_exhausted("b")
    # Past both thresholds → unsustainable.
    econ.burn_months["b"] = 3
    assert econ.cash_exhausted("b")


def test_a_bleeding_entrant_can_exit_on_cash():
    """A tiny runway plus a hot commercial profile forces a cash-driven exit
    even if market share alone would keep the operator alive."""
    # Shrink the runway hard so the burn overruns it inside the horizon.
    sim = _sim(ticks=60, entry_enabled=True, econ_runway_multiple=0.0,
               econ_runway=1.0, econ_burn_grace=6)
    exits = [e for e in sim.entry.events if e["kind"] == "exit"]
    cash_exits = [e for e in exits if "cash" in e["detail"]]
    # At least the mechanism is reachable: if anyone entered and burned, a
    # cash-driven exit should be recorded (otherwise nobody entered — skip).
    if not sim.entry.entered:
        pytest.skip("no entrant in this configuration")
    assert cash_exits, "a bleeding entrant on a 1-mio runway should exit on cash"


def test_established_incumbent_does_not_cash_fold():
    """An established t0 incumbent (Betano — aggressive burn, but a going concern
    with a parent balance sheet) must NEVER be force-exited by cash exhaustion.
    Only operators that entered with a raised-capital runway can fold on cash."""
    sim = _sim(ticks=72, entry_enabled=True)
    cash_exits = [e["operator_id"] for e in sim.entry.events
                  if e["kind"] == "exit" and "cash" in e["detail"]]
    # Every cash-driven exit must be an operator that actually entered.
    for oid in cash_exits:
        assert oid in sim.entry.entered, f"t0 incumbent '{oid}' folded on cash — it has no runway"
    # Betano is a named t0 incumbent → it may be acquired (M&A) but never cash-folds.
    assert "betano" not in cash_exits


# --------------------------------------------------------------------------- #
# Metrics + API exposure
def test_economics_metrics_emitted():
    sim = _sim(ticks=6)
    m = sim.metrics_history[-1]
    assert "ds_ebit" in m and "ds_ebit_margin" in m
    assert "industry_ebit_margin" in m
    assert any(k.startswith("ebit_op_") for k in m)
    assert any(k.startswith("cash_op_") for k in m)


def test_disabling_economics_skips_the_layer():
    sim = _sim(ticks=6, economics_enabled=False)
    m = sim.metrics_history[-1]
    assert "ds_ebit" not in m
    assert not sim.economics.last


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "econ.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_competitor_intelligence(client):
    r = client.get("/api/competitor-intelligence")
    assert r.status_code == 200
    data = r.json()
    names = {p["name"] for p in data["parameters"]}
    assert "econ_marketing_ratio" in names
    assert "flutter_marketing_pct_revenue" in names
    assert "ma_ev_ebitda_multiple" in names
    assert "Betano" in data["note"]
