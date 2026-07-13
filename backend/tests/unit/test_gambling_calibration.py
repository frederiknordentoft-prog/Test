"""Flagship Etape A+B: real calibration data + hindcast/backtest.

The model is now anchored to real, sourced data (UK Patterns of Play for
concentration; Spillemyndigheden series for growth) and validated out-of-sample
against the held-out recent years — reporting honestly where it does and does
not beat a naive baseline (perspective §6)."""
import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.calibration import loader
from simcore.gambling.calibration.fit import best_model
from simcore.gambling.calibration.hindcast import recent_cagr, run_hindcast
from simcore.gambling.calibration.skill import mase, naive_random_walk, skill_report
from simcore.gambling.config import GamblingConfig
from simcore.gambling.population import build_population, concentration
from simcore.gambling.simulation import GamblingSimulation


# --------------------------------------------------------------------------- #
# Etape A — data loads and is sourced
def test_historical_data_loads_with_sources():
    df = loader.historical()
    assert {"series_id", "year", "value", "confidence", "source"} <= set(df.columns)
    assert (df["confidence"].isin(["green", "yellow", "red"])).all()
    yrs, casino = loader.series("casino_ggr")
    assert yrs[0] <= 2020 and casino[yrs.index(2020)] == 2453  # casino overtook betting in 2020
    _, betting = loader.series("betting_ggr")
    assert casino[yrs.index(2020)] > betting[yrs.index(2020)]   # the crossover


def test_concentration_data_matches_patterns_of_play():
    # The #1 missing parameter, now filled from real data.
    assert loader.concentration_target("all_online", "top5") == pytest.approx(0.6694)
    assert loader.concentration_target("slots_rng", "top5") == pytest.approx(0.8171)
    assert loader.concentration_target("sports", "top5") == pytest.approx(0.6481)


def test_spend_sigma_reproduces_real_concentration():
    """spend_sigma default is anchored to Patterns of Play top-5 % = 67 %."""
    g = GamblingConfig(spend_sigma=2.0, population=6000)
    import numpy as np
    pop = build_population(g, np.random.default_rng(7))
    top5 = concentration(pop.budget, 0.05)
    assert 0.58 <= top5 <= 0.72, f"top-5 % {top5:.3f} should sit near the PoP 0.67 anchor"


# --------------------------------------------------------------------------- #
# Etape B — hindcast skill
def test_casino_hindcast_beats_naive_out_of_sample():
    yrs, vals = loader.series("casino_ggr")
    fit = best_model(yrs, vals, holdout=2)
    sk = fit["skill"]
    assert sk["beats_random_walk"], "casino model must beat persistence out-of-sample"
    assert sk["model"]["mape"] < 0.12, "casino holdout error should be < 12 %"


def test_betting_hindcast_reports_honest_failure():
    """Betting is flat/volatile — the model does NOT beat a random walk here,
    and the hindcast must report that honestly rather than hide it."""
    rep = run_hindcast()
    betting = next(r for r in rep["results"] if r["vertical"] == "sports")
    assert betting["beats_random_walk"] is False
    assert "IKKE" in betting["verdict"] or "ikke" in betting["verdict"]


def test_calibrated_growth_feeds_the_model():
    rep = run_hindcast()
    cg = rep["calibrated_growth"]
    assert cg["casino"] > 0.08                       # casino is the growth engine
    assert cg["sports"] < 0.03                        # betting near-flat
    # and the config default matches the calibrated casino CAGR
    cfg = load_preset("dk_baseline")
    casino = next(t for t in cfg.gambling["tracks"] if t["track_id"] == "casino")
    assert casino["growth_rate"] == pytest.approx(0.128, abs=0.01)


def test_hindcast_summary_is_honest_about_limits():
    rep = run_hindcast()
    assert rep["n_series"] >= 2
    assert "robuste" in rep["summary"].lower() or "punktprognose" in rep["summary"].lower()


def test_skill_metrics_sane():
    train = [100.0, 110.0, 120.0]
    actual = [130.0, 140.0]
    perfect = skill_report("x", train, actual, [130.0, 140.0])
    assert perfect["model"]["mape"] == 0.0 and perfect["beats_random_walk"]
    rw = naive_random_walk(train, 2)
    assert list(rw) == [120.0, 120.0]


# --------------------------------------------------------------------------- #
# API exposure
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "cal.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_forecast_validation_bundle():
    from simcore.gambling.calibration.forecast import forecast_validation
    fv = forecast_validation()
    # reality anchors for the nowcasting overlay
    assert "bsi_casino" in fv["reality_anchors"]
    assert fv["reality_anchors"]["bsi_casino"]["year"] == 2025
    # evidence for trust: backtest skill + natural experiments
    assert fv["hindcast"]["n_series"] >= 2
    assert fv["natural_experiments"]["n_reproduced"] == 2
    assert "bud" in fv["honesty"].lower() and "robust" in fv["honesty"].lower()


def test_api_forecast_validation(client):
    r = client.get("/api/forecast-validation")
    assert r.status_code == 200
    data = r.json()
    assert data["anchor_year"] == 2025
    assert data["reality_anchors"] and data["hindcast"] and data["natural_experiments"]


def test_api_hindcast_and_calibration_data(client):
    h = client.get("/api/hindcast")
    assert h.status_code == 200
    data = h.json()
    assert data["n_series"] >= 2 and "calibrated_growth" in data
    assert any(r["vertical"] == "casino" for r in data["results"])

    cd = client.get("/api/calibration-data")
    assert cd.status_code == 200
    payload = cd.json()
    assert payload["historical"] and payload["concentration"] and payload["experiments"]
    assert all("source" in row for row in payload["historical"])


# --------------------------------------------------------------------------- #
# The DS anchors must still hold under the recalibrated defaults
def test_anchors_hold_after_recalibration():
    cfg = load_preset("dk_baseline")
    cfg.ticks = 12
    cfg.gambling = {**cfg.gambling, "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False}
    sim = GamblingSimulation(cfg)
    sim.run()
    ds = sum(m["ds_bsi_total"] for m in sim.metrics_history)
    udl = sum(m["udlodning"] for m in sim.metrics_history)
    assert ds == pytest.approx(5160, rel=0.10)
    assert udl == pytest.approx(1790, rel=0.10)
