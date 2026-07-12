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
def test_shares_sum_to_one_per_track():
    _g, _p, mkt = _market()
    res = mkt.clear(0)
    for tid, r in res.items():
        assert sum(r["shares"].values()) == pytest.approx(1.0, abs=1e-9)


def test_baseline_channelization_within_interval():
    gcfg, _p, mkt = _market()
    res = mkt.clear(0)
    for tid in ("casino", "sports"):
        assert res[tid]["channelization"] == pytest.approx(gcfg.channelization_start, abs=0.01)
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
    _g, _p, mkt = _market()
    res = mkt.clear(0)
    assert res["casino"]["licensed_bsi"] > res["sports"]["licensed_bsi"]


def test_channelization_falls_when_licensed_appeal_drops():
    """Mechanism: penalising the licensed operators' appeal (a proxy for
    tightening) must lower channelization — the model can show leakage."""
    _g, _p, mkt = _market()
    tm = mkt.tracks["casino"]
    base = tm.clear(0)["channelization"]
    mods = np.array([-3.0 if o.licensed else 0.0 for o in tm.operators])
    penalized = tm.clear(0, mods)["channelization"]
    assert penalized < base - 0.05


def test_tail_leaks_offshore_endogenously():
    """High-risk, friction-tolerant players must choose offshore more than
    low-risk players — the heterogeneity that makes channelization honest."""
    gcfg, pop, _m = _market(population=4000)
    ops = gcfg.operators_for("casino")
    attrs = operator_attr_arrays(ops)
    betas = player_betas(pop, gcfg.young_age_threshold)
    probs = choice_probabilities(utilities(betas, attrs), gcfg.logit_temperature)
    off = next(i for i, o in enumerate(ops) if o.kind == "offshore")
    hi = pop.risk > 0.7
    lo = pop.risk < 0.3
    assert probs[hi, off].mean() > probs[lo, off].mean() + 0.02


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
