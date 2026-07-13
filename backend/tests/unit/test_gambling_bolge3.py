"""Bølge 3 (red-team fixes): calibration anchors, the completed parameter
register, Morris screening and the robustness API.

The green anchors that existed but were unused (DS BSI 5.16 bn/yr, udlodning
1.79 bn/yr) now pin the model; the logit scale is magnitude-anchored to the
Swedish bonus-ban natural experiment; and the register drives a Morris
elementary-effects screening reachable through the API."""
import time

import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.morris import morris_screening
from simcore.gambling.params import load_params, screening_params
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import EventConfig


def _sim(ticks=12, events=None, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False, **g}
    if events:
        cfg.events = list(cfg.events) + events
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


# --------------------------------------------------------------------------- #
# 13 — the green anchors actually pin the model
def test_ds_bsi_matches_annual_report_anchor():
    """Danske Spil 2025: BSI 5.16 bn, profit margin 38.9 %, udlodning 1.79 bn.
    These were registered green but never used (critic finding)."""
    sim = _sim(ticks=12)
    ds_annual = sum(m["ds_bsi_total"] for m in sim.metrics_history)
    udl_annual = sum(m["udlodning"] for m in sim.metrics_history)
    assert ds_annual == pytest.approx(5160.0, rel=0.10)
    assert udl_annual == pytest.approx(1790.0, rel=0.10)


def test_state_revenue_includes_monopoly_win_tax():
    """The 15 % gevinstafgift approximation on the monopoly block must be in
    state_revenue — omitting it understated the monopoly's fiscal weight in
    liberalization scenarios."""
    sim = _sim(ticks=12)
    annual_rev = sum(m["state_revenue"] for m in sim.metrics_history)
    monopoly = sum(m["bsi_lottery"] + m["bsi_scratch"] for m in sim.metrics_history)
    competitive = sum(m["bsi_casino"] + m["bsi_sports"] for m in sim.metrics_history)
    expected = 0.15 * monopoly + 0.28 * competitive
    assert annual_rev == pytest.approx(expected, rel=0.02)
    assert annual_rev > 0.28 * competitive          # strictly more than before the fix


def test_payout_attribute_renamed_with_rtp_alias():
    from simcore.gambling.config import OperatorConfig

    legacy = OperatorConfig(operator_id="x", name="X", kind="licensed",
                            tracks=["casino"], rtp=0.61)
    assert legacy.payout == pytest.approx(0.61)


# --------------------------------------------------------------------------- #
# 16 — magnitude anchor: the Swedish bonus-ban natural experiment
def test_bonus_ban_magnitude_anchored_to_swedish_experiment():
    """Sweden's bonus restrictions left online-casino channelization far below
    the general level (57-62 % vs a ~90 % ambition). We anchor the logit scale
    loosely to that magnitude: a full bonus ban must move casino channelization
    down by 5-30 pp — not by 0.5 pp (scale too cold) and not by 60 pp (too hot).
    An interval anchor, honestly wide, per the register's fælde-2 discipline."""
    base = _sim(ticks=18)
    ban = _sim(ticks=18, events=[EventConfig(
        name="bonusforbud", event_type="spilpakke_1", start_tick=3,
        params={"ad_ban": 0.0, "rg_friction": 0.0, "loss_limits": 0.0,
                "bonus_restriction": 1.0})])
    drop = (base.metrics_history[-1]["channelization_casino"]
            - ban.metrics_history[-1]["channelization_casino"])
    assert 0.05 <= drop <= 0.30, f"casino channelization drop {drop:.3f} outside the anchored band"


# --------------------------------------------------------------------------- #
# 14 — the register is complete enough to drive screening
def test_register_covers_the_conclusion_driving_constants():
    names = {p.name for p in load_params()}
    for required in ("harm_scale", "offshore_harm_coeff", "ai_personalization_gain",
                     "political_threshold", "udlodning_resistance", "logit_temperature",
                     "entry_go_prob", "nest_lambda_licensed", "spend_sigma"):
        assert required in names, f"{required} missing from params.yaml"
    screenable = screening_params()
    assert len(screenable) >= 15
    assert all(p.interval and p.config_field for p in screenable)


# --------------------------------------------------------------------------- #
# 15 — Morris screening
def test_morris_screening_ranks_parameters():
    cfg = load_preset("dk_baseline")
    cfg.gambling = {**(cfg.gambling or {}), "population": 200, "ai_enabled": False,
                    "entry_enabled": False, "rofus_enabled": False}
    subset = [p for p in screening_params()
              if p.name in ("spend_sigma", "channelization_rate", "harm_scale")]
    rep = morris_screening(cfg, params=subset, trajectories=2, ticks=6, seed=1)
    assert rep["n_runs"] == 2 * (len(subset) + 1)
    assert {r["name"] for r in rep["ranking"]} == {p.name for p in subset}
    assert all(r["influence"] >= 0 for r in rep["ranking"])
    # channelization_start must matter for channelization; harm_scale must not
    per = rep["per_metric"]["channelization"]
    assert per["channelization_rate"]["mu_star"] > per["harm_scale"]["mu_star"]


# --------------------------------------------------------------------------- #
# 15 — API exposure
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "rb.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_parameter_register(client):
    r = client.get("/api/params")
    assert r.status_code == 200
    data = r.json()
    names = {p["name"] for p in data["parameters"]}
    assert "spend_sigma" in names and "channelization_rate" in names
    assert all(p["confidence"] in ("green", "yellow", "red") for p in data["parameters"])


def test_api_robustness_grid_roundtrip(client):
    body = {"preset_id": "dk_baseline", "mode": "grid", "analysis_ticks": 8,
            "channelization_grid": [0.82], "sigma_grid": [1.7],
            "gambling_overrides": {"population": 200},
            "policy_events": [{"name": "SP1", "event_type": "spilpakke_1", "start_tick": 2}]}
    r = client.post("/api/robustness", json=body)
    assert r.status_code == 200
    rb_id = r.json()["rb_id"]
    deadline = time.time() + 120
    while time.time() < deadline:
        data = client.get(f"/api/robustness/{rb_id}").json()
        if data["status"] in ("finished", "error"):
            break
        time.sleep(0.3)
    assert data["status"] == "finished", data.get("error")
    assert "robustness" in data["result"] and data["result"]["statements"]
    assert client.get("/api/robustness/nope").status_code == 404
