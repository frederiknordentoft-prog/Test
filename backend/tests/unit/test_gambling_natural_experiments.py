"""Flagship Etape C: the model is anchored in documented natural experiments —
shocks it was NOT fitted to. Reproducing them (emergently, not hardcoded) is
what turns illustrative foresight into a model that earns trust."""
import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.calibration.natural_experiments import (
    betano_entry,
    run_natural_experiments,
    sweden_bonus_ban,
)
from simcore.gambling.simulation import GamblingSimulation


def test_sweden_bonus_ban_reproduces_casino_collapse():
    """Sweden 2019: a bonus ban dropped online-casino channelization to 57-72 %
    while sports betting stayed ~92-95 %. The model must reproduce the asymmetry
    emergently — casino falls far more than betting."""
    r = sweden_bonus_ban()
    m = r["model"]
    assert 0.55 <= m["casino_channelization"] <= 0.75, "casino must land in the Swedish band"
    assert m["betting_channelization"] > 0.80, "betting must stay materially higher"
    assert m["asymmetry_ratio"] > 1.5, "casino must fall >1.5x more than betting"
    assert r["reproduced"]


def test_betano_style_entry_reaches_realistic_share():
    """Betano reached ~3.7 % of the DK market within ~2 years, still growing.
    The model's challenger must reach a comparable share on its own economics."""
    r = betano_entry()
    assert r["model"]["entered"]
    assert 0.01 <= r["model"]["share_within_2y"] <= 0.08, "share should be Betano-plausible at 2y"
    assert r["reproduced"]


def test_entrant_ramp_builds_share_over_time():
    """An entrant builds share gradually (brand/trust/distribution), not
    instantly — its 2-year share is well below its 5-year share."""
    def share(total, at):
        cfg = load_preset("dk_baseline")
        cfg.ticks = total
        cfg.gambling = {**cfg.gambling, "ai_enabled": True, "entry_enabled": True,
                        "ai_frontier_growth": 0.0, "ai_frontier_start": 0.0}
        sim = GamblingSimulation(cfg)
        sim.run()
        return sim.metrics_history[at - 1].get("share_op_challenger", 0.0)
    s2y = share(60, 24)
    s5y = share(60, 60)
    assert s5y > s2y * 1.8, "share must grow substantially as the entrant matures"


def test_natural_experiments_summary():
    r = run_natural_experiments()
    assert r["n_total"] == 2
    assert r["n_reproduced"] == 2
    assert "sensitivitet" in r["summary"].lower() or "validere" in r["summary"].lower()


def test_ds_anchor_survives_etape_c_changes():
    cfg = load_preset("dk_baseline")
    cfg.ticks = 12
    cfg.gambling = {**cfg.gambling, "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False}
    sim = GamblingSimulation(cfg)
    sim.run()
    ds = sum(m["ds_bsi_total"] for m in sim.metrics_history)
    assert ds == pytest.approx(5160, rel=0.10)
    # per-track channelization: casino structurally below sports
    m0 = sim.metrics_history[0]
    assert m0["channelization_casino"] < m0["channelization_sports"]


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "ne.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_natural_experiments(client):
    r = client.get("/api/natural-experiments")
    assert r.status_code == 200
    data = r.json()
    assert data["n_total"] == 2
    assert any("Sverige" in c["experiment"] for c in data["checks"])
