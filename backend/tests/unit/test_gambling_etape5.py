"""Etape 5 (gambling domain): scenarios/presets, domain-aware Monte Carlo, and
the robustness analysis (which conclusions hold across the contested
assumptions). DoD: policy presets run, Monte Carlo yields gambling
distributions, and robustness reports per-conclusion robustness."""
import time

import pytest
from fastapi.testclient import TestClient

from simcore.analytics.montecarlo import GAMBLING_SUMMARY_KEYS, run_monte_carlo
from simcore.config.loader import list_presets, load_preset
from simcore.gambling.robustness import run_robustness
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import EventConfig

GAMBLING_PRESETS = [
    "dk_baseline", "spilpakke_1", "spilpakke_2_prediction", "prediction_market_surge",
    "crash_games_licensed", "wild_ai_boom", "consolidation_wave", "light_touch",
    "responsible_first",
]


# --------------------------------------------------------------------------- #
def test_all_gambling_presets_registered():
    ids = {p["id"]: p for p in list_presets()}
    for pid in GAMBLING_PRESETS:
        assert pid in ids and ids[pid]["domain"] == "gambling"


@pytest.mark.parametrize("pid", GAMBLING_PRESETS)
def test_gambling_preset_runs(pid):
    cfg = load_preset(pid)
    cfg.ticks = 18
    sim = GamblingSimulation(cfg)
    sim.run()
    m = sim.metrics_history[-1]
    for key in ("channelization", "ds_share_total", "market_size_total", "state_revenue"):
        assert key in m
    assert 0.0 <= m["channelization"] <= 1.0


def test_crash_games_licensed_raises_channelization():
    """The new product-legality lever must pull channelization up vs baseline."""
    def chan(pid):
        cfg = load_preset(pid); cfg.ticks = 36
        cfg.gambling = {**cfg.gambling, "entry_enabled": False}
        sim = GamblingSimulation(cfg); sim.run()
        return sim.metrics_history[-1]["channelization"]
    assert chan("crash_games_licensed") > chan("dk_baseline")


# --------------------------------------------------------------------------- #
# domain-aware Monte Carlo
def test_gambling_monte_carlo_distributions():
    cfg = load_preset("dk_baseline")
    cfg.ticks = 12
    result = run_monte_carlo(cfg, seeds=[1, 2, 3, 4])
    assert result["n_runs"] == 4
    assert set(GAMBLING_SUMMARY_KEYS).issubset(result["percentiles"].keys())
    assert "final_ds_share" in result["runs"][0]
    p = result["percentiles"]["final_ds_share"]
    assert p["min"] <= p["median"] <= p["max"]


# --------------------------------------------------------------------------- #
# robustness — which conclusions hold across the assumption grid
def test_robustness_false_positive_is_robust():
    base = load_preset("dk_baseline")
    # Isolate the explicit policy shock from AI/entry and the endogenous reactive
    # agents so the loop-1 mechanism is measured cleanly (harm accounting stays on).
    base.gambling = {**base.gambling, "ai_enabled": False, "entry_enabled": False,
                     "regulator_enabled": False, "political_enabled": False}
    rep = run_robustness(
        base, [EventConfig(name="Spilpakke 1", event_type="spilpakke_1", start_tick=6)],
        channelization_grid=[0.75, 0.85], sigma_grid=[0.8, 1.4], ticks=30,
    )
    r = rep["robustness"]
    # Robust across the grid: measured harm falls, the hidden gap widens,
    # channelization falls and state revenue falls.
    assert r["measured_harm"]["direction"] == "down" and r["measured_harm"]["robust"]
    assert r["harm_gap"]["direction"] == "up" and r["harm_gap"]["robust"]
    assert r["channelization"]["direction"] == "down" and r["channelization"]["robust"]
    assert r["state_revenue"]["direction"] == "down" and r["state_revenue"]["robust"]


def test_robustness_report_structure():
    base = load_preset("dk_baseline")
    rep = run_robustness(base, [EventConfig(name="AI", event_type="ai_breakthrough",
                                            start_tick=4, params={"size": 0.3})],
                         channelization_grid=[0.82], sigma_grid=[1.1], ticks=20)
    assert rep["n_points"] == 1
    for m, r in rep["robustness"].items():
        assert set(r) == {"direction", "robust_fraction", "robust", "mean_delta"}


# --------------------------------------------------------------------------- #
# Monte Carlo through the API
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "mc.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_gambling_overrides_merge(client):
    body = {"preset_id": "dk_baseline", "ticks": 8, "domain": "gambling",
            "gambling_overrides": {"population": 300, "channelization_start": 0.90,
                                   "channelization_low": 0.50, "channelization_high": 0.99}}
    r = client.post("/api/runs", json=body)
    assert r.status_code == 200
    g = r.json()["config"]["gambling"]
    assert g["population"] == 300 and g["channelization_start"] == 0.90


def test_api_gambling_monte_carlo(client):
    r = client.post("/api/montecarlo", json={"preset_id": "dk_baseline", "ticks": 10, "n_seeds": 3})
    assert r.status_code == 200
    mc_id = r.json()["mc_id"]
    deadline = time.time() + 60
    while time.time() < deadline:
        data = client.get(f"/api/montecarlo/{mc_id}").json()
        if data["status"] in ("finished", "error"):
            break
        time.sleep(0.2)
    assert data["status"] == "finished"
    assert "final_ds_share" in data["result"]["percentiles"]
