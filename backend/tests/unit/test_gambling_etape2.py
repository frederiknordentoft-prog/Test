"""Etape 2 (gambling domain): operator choice → market share. Multinomial-logit
choice incl. offshore + prediction, the channelization engine, and the Danske
Spil split. DoD: shares sum to 1, channelization lands within the 72-92%
interval, DS market share is produced, casino overtakes betting, and the tail
leaks offshore endogenously."""
import time

import numpy as np
import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.config import GamblingConfig
from simcore.gambling.decisions import (
    choice_probabilities,
    operator_attr_arrays,
    player_betas,
    utilities,
)
from simcore.gambling.market import AttractionMarket
from simcore.gambling.population import build_population
from simcore.gambling.simulation import GamblingSimulation


def _market(**over):
    gcfg = GamblingConfig(**over)
    pop = build_population(gcfg, np.random.default_rng(3))
    return gcfg, pop, AttractionMarket(gcfg, pop)


# --------------------------------------------------------------------------- #
def test_shares_plus_outside_sum_to_one_per_track():
    """Budget conservation: operator shares + the outside option exhaust the
    potential — nothing is created or destroyed by the choice model."""
    _g, _p, mkt = _market()
    res = mkt.clear(0)
    for tid, r in res.items():
        assert sum(r["shares"].values()) + r["outside_share"] == pytest.approx(1.0, abs=1e-9)
        assert r["participation"] == pytest.approx(sum(r["shares"].values()), abs=1e-9)


def test_baseline_participation_matches_target():
    gcfg, _p, mkt = _market()
    res = mkt.clear(0)
    for tid, r in res.items():
        assert r["participation"] == pytest.approx(gcfg.participation_start, abs=0.01)


def test_baseline_channelization_within_interval():
    gcfg, _p, mkt = _market()
    res = mkt.clear(0)
    # Competitive tracks calibrate to channelization_start + per-track offset;
    # casino is structurally below sports (DK H2GC / Sweden evidence).
    for tid in ("casino", "sports"):
        target = gcfg.channelization_start + gcfg.track_channelization_offset.get(tid, 0.0)
        assert res[tid]["channelization"] == pytest.approx(target, abs=0.01)
    assert res["casino"]["channelization"] < res["sports"]["channelization"]
    for tid in ("lottery", "scratch"):
        assert res[tid]["channelization"] == pytest.approx(gcfg.monopoly_channelization, abs=0.01)
    total_lic = sum(r["licensed_bsi"] for r in res.values())
    total = sum(r["total_bsi"] for r in res.values())
    overall = total_lic / total
    assert gcfg.channelization_low <= overall <= gcfg.channelization_high


def test_ds_split_two_agents_both_present():
    gcfg, _p, _m = _market()
    ds = [o for o in gcfg.operators if o.is_ds]
    kinds = {o.kind for o in ds}
    assert kinds == {"ds_monopoly", "ds_licensed"}
    # monopoly agent on lottery/scratch, licensed agent on casino/sports
    mono = next(o for o in ds if o.kind == "ds_monopoly")
    lic = next(o for o in ds if o.kind == "ds_licensed")
    assert set(mono.tracks) == {"lottery", "scratch"}
    assert set(lic.tracks) == {"casino", "sports"}


def test_offshore_and_prediction_are_in_the_choice_set():
    gcfg, _p, _m = _market()
    casino_ops = {o.operator_id for o in gcfg.operators_for("casino")}
    sports_ops = {o.operator_id for o in gcfg.operators_for("sports")}
    assert "offshore" in casino_ops and "offshore" in sports_ops
    assert "prediction" in sports_ops   # prediction markets are sports-first


def test_casino_overtakes_betting():
    """Not just the static anchor (3.5 > 2.21): the growth *dynamic* must have
    casino pulling away from near-flat sports (critic finding — the old test
    asserted only the trivial tick-0 anchor)."""
    _g, _p, mkt = _market()
    res0 = mkt.clear(0)
    res24 = mkt.clear(24)
    assert res0["casino"]["licensed_bsi"] > res0["sports"]["licensed_bsi"]
    casino_growth = res24["casino"]["licensed_bsi"] / res0["casino"]["licensed_bsi"]
    # compare sports year-on-year at the same calendar month to strip seasonality
    sports_growth = mkt.clear(24)["sports"]["licensed_bsi"] / mkt.clear(12)["sports"]["licensed_bsi"]
    assert casino_growth > 1.25                       # ~1.147² over two years
    assert casino_growth > sports_growth + 0.20


def test_channelization_falls_when_licensed_appeal_drops():
    """Mechanism: penalising the licensed operators' appeal (a proxy for
    tightening) must lower channelization — the model can show leakage."""
    _g, _p, mkt = _market()
    tm = mkt.tracks["casino"]
    base = tm.clear(0)["channelization"]
    mods = np.array([-3.0 if o.licensed else 0.0 for o in tm.operators])
    penalized = tm.clear(0, extra_offsets=mods)["channelization"]
    assert penalized < base - 0.05


def test_total_demand_is_elastic_under_tightening():
    """THE critic experiment: maximal tightening must shrink the total market
    (before: exactly 0.00 % — every krone was mechanically re-routed offshore).
    The breadth exits to the outside option; only part of the loss leaks."""
    from simcore.gambling.stakeholders import RegulationState

    _g, _p, mkt = _market()
    base = mkt.clear(0)
    reg = RegulationState(ad_ban=1.0, rg_friction=1.0, loss_limits=1.0, bonus_restriction=1.0)
    tight = mkt.clear(0, reg)
    total_base = sum(r["total_bsi"] for r in base.values())
    total_tight = sum(r["total_bsi"] for r in tight.values())
    assert total_tight < total_base * 0.95, "tightening must be able to shrink demand"
    # ...while channelization still falls (part of the response is leakage)
    chan = lambda res: sum(r["licensed_bsi"] for r in res.values()) / sum(r["total_bsi"] for r in res.values())
    assert chan(tight) < chan(base) - 0.03


def test_tail_leaks_offshore_endogenously():
    """High-risk, friction-tolerant players must choose offshore more than
    low-risk players — the heterogeneity that makes channelization honest."""
    gcfg, pop, _m = _market(population=4000)
    ops = gcfg.operators_for("casino")
    attrs = operator_attr_arrays(ops)
    betas = player_betas(pop, gcfg)
    probs = choice_probabilities(utilities(betas, attrs), gcfg.logit_temperature)
    off = next(i for i, o in enumerate(ops) if o.kind == "offshore")
    hi = pop.risk > 0.7
    lo = pop.risk < 0.3
    assert probs[hi, off].mean() > probs[lo, off].mean() + 0.02


def test_top_spenders_leak_offshore_more_than_the_breadth():
    """The tail is behavioural, not cosmetic: under tightening, the top-5 %
    spenders shift toward unlicensed alternatives markedly more than the rest
    (before: 5.73 % vs 5.66 % — statistically identical)."""
    from simcore.gambling.stakeholders import RegulationState

    gcfg, pop, mkt = _market(population=4000)
    tm = mkt.tracks["casino"]
    reg = RegulationState(ad_ban=0.8, rg_friction=1.0, loss_limits=1.0, bonus_restriction=0.8)
    pb = choice_probabilities(tm._full_utilities(None), tm.temperature)
    pt = choice_probabilities(tm._full_utilities(reg), tm.temperature)
    unl = np.where(tm.unlicensed_mask)[0]
    shift = pt[:, unl].sum(axis=1) - pb[:, unl].sum(axis=1)
    top = pop.budget >= np.quantile(pop.budget, 0.95)
    assert shift[top].mean() > shift[~top].mean() * 1.5


def test_ad_ban_hits_acquisition_led_operators_harder():
    """The asymmetry the whole Spilpakke analysis is about: an ad ban must hurt
    the acquisition-led challenger (Betano, reach 0.92) relatively more than the
    brand/retail incumbent (DS) — emergently, not by construction."""
    from simcore.gambling.stakeholders import RegulationState

    _g, _p, mkt = _market()
    base = mkt.clear(0)["sports"]["shares"]
    banned = mkt.clear(0, RegulationState(ad_ban=1.0, bonus_restriction=0.6))["sports"]["shares"]
    betano_loss = 1.0 - banned["betano"] / base["betano"]
    ds_loss = 1.0 - banned["ds_licens"] / base["ds_licens"]
    assert betano_loss > ds_loss + 0.10


def test_hhi_and_operator_bsi_consistency():
    _g, _p, mkt = _market()
    res = mkt.clear(0)
    # HHI on a competitive track sits well below a monopoly's
    assert res["casino"]["hhi"] < res["lottery"]["hhi"]
    assert 800 < res["casino"]["hhi"] < 4000
    # per-operator BSI sums to the track total
    for r in res.values():
        assert sum(r["operator_bsi"].values()) == pytest.approx(r["total_bsi"], rel=1e-9)


def test_reproducible_shares():
    _g1, _p1, m1 = _market()
    _g2, _p2, m2 = _market()
    assert m1.clear(0)["casino"]["shares"] == m2.clear(0)["casino"]["shares"]


# --------------------------------------------------------------------------- #
# API — market-share series flow through the generic /metrics endpoint
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "gambling2.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_market_share_series(client):
    rid = client.post("/api/runs", json={"preset_id": "dk_baseline", "ticks": 12}).json()["run_id"]
    client.post(f"/api/runs/{rid}/speed", json={"tps": 500})
    client.post(f"/api/runs/{rid}/start")
    deadline = time.time() + 60
    while time.time() < deadline:
        if client.get(f"/api/runs/{rid}").json()["status"] == "finished":
            break
        time.sleep(0.1)
    m = client.get(f"/api/runs/{rid}/metrics?names=ds_share_total,channelization,ds_share_casino").json()
    assert len(m["ticks"]) == 12
    for name in ("ds_share_total", "channelization", "ds_share_casino"):
        assert name in m["series"] and all(0.0 <= v <= 1.0 for v in m["series"][name])
