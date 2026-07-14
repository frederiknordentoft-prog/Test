"""Investment / deal-returns — the capital-fund lens.

The operator P&L layer answers "how does the business perform?"; this layer
answers the investment committee's question: "what return, at what risk, and
what kills the thesis?". A deal owns an operator (greenfield / buyout / rollup),
holds it, and is valued at exit on an EV/EBITDA multiple — with the EBITDA path
supplied endogenously by the simulation. These tests pin the finance identities
(IRR/MOIC, the value bridge, leverage amplification) and confirm the layer is a
read-only overlay that never disturbs the baseline anchors.
"""
import time

import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.config import DealConfig
from simcore.gambling.investment import (
    DEAL_SUMMARY_KEYS,
    deal_monte_carlo,
    deal_stress_tornado,
    evaluate_deal,
    irr,
)


@pytest.fixture(scope="module")
def base():
    return load_preset("dk_baseline")


# --------------------------------------------------------------------------- #
# The IRR primitive
def test_irr_two_flow_matches_closed_form():
    # −100 now, +200 in year 5 → IRR = (2)^(1/5) − 1.
    r = irr([-100.0, 0.0, 0.0, 0.0, 0.0, 200.0])
    assert r == pytest.approx(2.0 ** (1 / 5) - 1, abs=1e-4)


def test_irr_undefined_on_total_loss():
    # No positive flow ever → no sign change → undefined.
    assert irr([-100.0, 0.0, 0.0]) is None


# --------------------------------------------------------------------------- #
# A clean profitable buyout: identities hold
def test_buyout_returns_are_sane(base):
    deal = DealConfig(archetype="buyout", target="unibet", leverage=3.0, hold_years=5)
    res = evaluate_deal(base, deal, seed=7)
    s, d = res["summary"], res["detail"]
    assert d["entry_ebitda"] > 0 and d["exit_ebitda"] > 0
    assert s["deal_moic"] > 1.0                      # a good target makes money
    assert 0.0 < s["deal_irr"] < 1.0
    # MOIC and the equity cash flows must be internally consistent.
    assert d["total_value"] == pytest.approx(
        d["equity_exit"] + d["total_distributions"], abs=1e-6)
    assert s["deal_moic"] == pytest.approx(d["total_value"] / d["equity_entry"], abs=1e-6)


def test_value_bridge_sums_to_equity_gain(base):
    """The 3-way PE bridge (EBITDA growth × multiple × deleveraging/FCF) must sum
    exactly to the total equity gain for a profitable deal (no EBITDA clamps)."""
    deal = DealConfig(archetype="buyout", target="unibet", leverage=3.0, hold_years=5,
                      entry_multiple=9.0, exit_multiple=11.0)
    res = evaluate_deal(base, deal, seed=7)
    b, d = res["bridge"], res["detail"]
    bridge_sum = b["ebitda_growth"] + b["multiple"] + b["deleverage_fcf"]
    equity_gain = d["total_value"] - d["equity_entry"]
    assert bridge_sum == pytest.approx(equity_gain, abs=1e-3)
    # Multiple expansion (9→11) contributes positively when exit EBITDA is positive.
    assert b["multiple"] > 0


def test_leverage_amplifies_returns(base):
    """More debt lifts equity IRR and MOIC on a profitable deal (the LBO effect)."""
    def run(lev):
        deal = DealConfig(archetype="buyout", target="unibet", leverage=lev, hold_years=5)
        return evaluate_deal(base, deal, seed=7)["summary"]

    lo, hi = run(0.0), run(4.0)
    assert hi["deal_moic"] > lo["deal_moic"]
    assert hi["deal_irr"] > lo["deal_irr"]


# --------------------------------------------------------------------------- #
# Archetypes
def test_rollup_of_longtail_makes_money(base):
    deal = DealConfig(archetype="rollup", target="longtail", leverage=3.0, hold_years=5)
    s = evaluate_deal(base, deal, seed=7)["summary"]
    assert s["deal_moic"] > 1.0


def test_greenfield_challenger_is_a_cautionary_loss(base):
    """Backing a pure-burn challenger (marketing 0.95, bonus 0.95) at those
    settings never turns a profit in the P&L model — an honest IC finding, not a
    bug. It should show as a capital loss (MOIC < 1)."""
    deal = DealConfig(archetype="greenfield", target="challenger",
                      committed_capital=400.0, hold_years=5)
    s = evaluate_deal(base, deal, seed=7)["summary"]
    assert s["deal_moic"] < 1.0


def test_greenfield_ai_native_can_win(base):
    """An AI-native greenfield with a path to profit is a viable venture bet."""
    deal = DealConfig(archetype="greenfield", target="ai_casino",
                      committed_capital=400.0, hold_years=5)
    s = evaluate_deal(base, deal, seed=7)["summary"]
    assert s["deal_moic"] > 1.0


def test_unknown_target_raises(base):
    with pytest.raises(ValueError):
        evaluate_deal(base, DealConfig(archetype="buyout", target="nope"), seed=1)
    with pytest.raises(ValueError):
        evaluate_deal(base, DealConfig(archetype="greenfield", target="unibet"), seed=1)


# --------------------------------------------------------------------------- #
# Monte Carlo distribution
def test_deal_monte_carlo_distribution(base):
    deal = DealConfig(archetype="buyout", target="unibet", leverage=3.0, hold_years=4)
    seeds = [2000 + i for i in range(10)]
    mc = deal_monte_carlo(base, deal, seeds)
    assert mc["n_runs"] == 10
    for key in DEAL_SUMMARY_KEYS:
        p = mc["percentiles"][key]
        assert p["p5"] <= p["median"] <= p["p95"]
    assert 0.0 <= mc["prob_loss"] <= 1.0
    assert len(mc["nav_fan"]["p50"]) == 4 * 12         # monthly over the hold
    assert set(mc["bridge"]) >= {"ebitda_growth", "multiple", "deleverage_fcf"}


def test_deal_is_reproducible(base):
    deal = DealConfig(archetype="buyout", target="unibet", hold_years=3)
    a = evaluate_deal(base, deal, seed=42)["summary"]
    b = evaluate_deal(base, deal, seed=42)["summary"]
    assert a["deal_irr"] == b["deal_irr"] and a["deal_moic"] == b["deal_moic"]


# --------------------------------------------------------------------------- #
# The layer is a read-only overlay: it must not mutate the caller's config.
def test_evaluate_does_not_mutate_base(base):
    before_ops = [o["operator_id"] if isinstance(o, dict) else o
                  for o in (base.gambling or {}).get("operators", [])]
    before_ticks = base.ticks
    evaluate_deal(base, DealConfig(archetype="greenfield", target="ai_casino"), seed=1)
    assert base.ticks == before_ticks
    assert [o["operator_id"] if isinstance(o, dict) else o
            for o in (base.gambling or {}).get("operators", [])] == before_ops


# --------------------------------------------------------------------------- #
# Downside / thesis-risk tornado
def test_stress_tornado_ranks_scenarios(base):
    deal = DealConfig(archetype="buyout", target="unibet", hold_years=3, n_seeds=4)
    seeds = [3000 + i for i in range(4)]
    tor = deal_stress_tornado(base, deal, seeds)
    assert len(tor) == 4                               # one per stress scenario
    # sorted most-damaging first (ascending IRR delta)
    assert tor == sorted(tor, key=lambda d: d["irr_delta"])
    assert all("scenario_irr" in t and "irr_delta" in t for t in tor)


# --------------------------------------------------------------------------- #
# API exposure
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "inv.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_investment_roundtrip(client):
    body = {"preset_id": "dk_baseline",
            "gambling_overrides": {"population": 200},
            "deal": {"archetype": "buyout", "target": "unibet", "leverage": 3.0,
                     "hold_years": 2, "n_seeds": 3},
            "tornado": True, "tornado_seeds": 2}
    r = client.post("/api/investment", json=body)
    assert r.status_code == 200
    inv_id = r.json()["inv_id"]
    deadline = time.time() + 120
    while time.time() < deadline:
        data = client.get(f"/api/investment/{inv_id}").json()
        if data["status"] in ("finished", "error"):
            break
        time.sleep(0.3)
    assert data["status"] == "finished", data.get("error")
    result = data["result"]
    assert result["n_runs"] == 3
    assert "deal_irr" in result["percentiles"] and "deal_moic" in result["percentiles"]
    assert result["nav_fan"]["p50"] and result["bridge"]
    assert len(result["tornado"]) == 4
    assert client.get("/api/investment/nope").status_code == 404


def test_api_investment_bad_target_is_422(client):
    body = {"preset_id": "dk_baseline",
            "deal": {"archetype": "buyout", "target": "does_not_exist", "n_seeds": 2}}
    r = client.post("/api/investment", json=body)
    # bad target surfaces when the deal runs; the create still validates the
    # request shape (422 only if the deal fails at build). Accept either the
    # 422 at request time or an error status after polling.
    if r.status_code == 200:
        inv_id = r.json()["inv_id"]
        deadline = time.time() + 60
        while time.time() < deadline:
            data = client.get(f"/api/investment/{inv_id}").json()
            if data["status"] in ("finished", "error"):
                break
            time.sleep(0.3)
        assert data["status"] == "error"
    else:
        assert r.status_code == 422
