"""Etape 0 (gambling domain): config validation, sports calendar, parameter
register, baseline market-size skeleton, reproducibility and the API domain
switch. DoD: the baseline reproduces the 2024/25 anchors per track as a stable
series."""
import time

import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import CalendarConfig, GamblingConfig, TrackConfig
from simcore.gambling.params import load_params, sensitivity_params
from simcore.gambling.simulation import GamblingSimulation

BN_TO_MIO = 1000.0


# --------------------------------------------------------------------------- #
# config validation
def test_gambling_config_defaults_and_tracks():
    cfg = GamblingConfig()
    ids = {t.track_id for t in cfg.tracks}
    assert ids == {"lottery", "scratch", "casino", "sports"}
    assert cfg.track("sports").seasonal is True
    assert cfg.track("lottery").competitive is False
    assert cfg.track("casino").competitive is True


def test_gambling_config_rejects_duplicate_track():
    with pytest.raises(ValueError):
        GamblingConfig(tracks=[
            TrackConfig(track_id="casino", name="A", competitive=True, annual_bsi=1.0),
            TrackConfig(track_id="casino", name="B", competitive=True, annual_bsi=1.0),
        ])


def test_gambling_config_channelization_interval():
    with pytest.raises(ValueError):
        GamblingConfig(channelization_start=0.60)  # below low (0.72)
    ok = GamblingConfig(channelization_low=0.70, channelization_start=0.80,
                        channelization_high=0.90)
    assert ok.channelization_low <= ok.channelization_start <= ok.channelization_high


# --------------------------------------------------------------------------- #
# sports calendar
def test_sports_intensity_mean_is_one_over_year():
    cal = CalendarConfig(amplitude=0.45)
    vals = [sports_intensity(t, cal) for t in range(12)]
    assert abs(sum(vals) / 12 - 1.0) < 1e-9        # annual mean is exactly 1.0
    assert max(vals) > min(vals)                    # there is real seasonality


def test_sports_intensity_flat_when_amplitude_zero():
    cal = CalendarConfig(amplitude=0.0)
    assert all(abs(sports_intensity(t, cal) - 1.0) < 1e-12 for t in range(12))


def test_sports_intensity_tournament_spike():
    cal = CalendarConfig(amplitude=0.0, tournament_ticks=[5], tournament_boost=0.3)
    assert sports_intensity(5, cal) == pytest.approx(1.3)
    assert sports_intensity(4, cal) == pytest.approx(1.0)


# --------------------------------------------------------------------------- #
# parameter register
def test_parameter_register_has_flagged_uncertainty():
    params = load_params()
    by_name = {p.name: p for p in params}
    assert "channelization_rate" in by_name
    assert by_name["channelization_rate"].interval == [0.72, 0.92]
    # income concentration is the #1 missing parameter and must be sensitivity-swept
    inc = by_name["income_concentration_top_share"]
    assert inc.confidence == "red" and inc.sensitivity is True
    assert any(p.name == "income_concentration_top_share" for p in sensitivity_params())


# --------------------------------------------------------------------------- #
# baseline simulation matches anchors (DoD)
def _run(preset="dk_baseline", ticks=None):
    cfg = load_preset(preset)
    if ticks is not None:
        cfg.ticks = ticks
    # Etape 0 tests the pure calibrated baseline: AI diffusion, entry and the
    # ROFUS drain off, so the market stays at the anchors (those dynamics are
    # tested in Etape 3 / Bølge 2).
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False}
    sim = GamblingSimulation(cfg)
    sim.run()
    return cfg, sim


def test_baseline_monopoly_tracks_are_flat_and_anchored():
    """The monopoly block has been flat since 2012 — zero growth, exact anchor."""
    cfg, sim = _run(ticks=24)
    for track_id, annual in (("lottery", 2.0), ("scratch", 1.0)):
        series = [m[f"bsi_{track_id}"] for m in sim.metrics_history]
        assert len(set(round(v, 6) for v in series)) == 1, f"{track_id} must be flat"
        assert series[0] == pytest.approx(annual / 12 * BN_TO_MIO, rel=1e-3)


def test_baseline_casino_is_the_growth_engine():
    """Casino must be anchored at t0 and carry the observed +14.7 %/yr trend —
    the inverted-growth baseline was a critic finding."""
    _cfg, sim = _run(ticks=25)
    casino = [m["bsi_casino"] for m in sim.metrics_history]
    lottery = [m["bsi_lottery"] for m in sim.metrics_history]
    assert casino[0] == pytest.approx(3.5 / 12 * BN_TO_MIO, rel=1e-3)
    assert casino[12] / casino[0] == pytest.approx(1.147, rel=1e-2)
    assert casino[24] / casino[0] > lottery[24] / lottery[0] + 0.25


def test_baseline_sports_is_seasonal():
    _cfg, sim = _run(ticks=24)
    sports = [m["bsi_sports"] for m in sim.metrics_history]
    assert max(sports) > min(sports)               # betting varies with the calendar
    # annual mean matches the anchor (sports intensity averages to 1.0/year;
    # the +1.2 %/yr trend adds a small drift within the year)
    first_year = sports[:12]
    assert sum(first_year) == pytest.approx(2.21 / 12 * BN_TO_MIO * 12, rel=1e-2)


def test_baseline_total_matches_four_track_anchor():
    _cfg, sim = _run(ticks=12)
    annual_total = sum(m["bsi_total"] for m in sim.metrics_history)  # 12 monthly sums
    # Anchored at t0; casino's +14.7 %/yr trend adds ~+3 % over the first year.
    assert annual_total == pytest.approx((2.0 + 1.0 + 3.5 + 2.21) * BN_TO_MIO, rel=0.05)
    first = sim.metrics_history[0]
    assert first["bsi_lottery"] + first["bsi_scratch"] + first["bsi_casino"] \
        == pytest.approx((2.0 + 1.0 + 3.5) / 12 * BN_TO_MIO, rel=1e-3)


def test_baseline_noise_is_live_and_reproducible():
    """`baseline_noise` must actually roughen the series (it was a dead knob) —
    deterministically per seed."""
    _c1, quiet = _run(ticks=12)
    cfg = load_preset("dk_baseline")
    cfg.ticks = 12
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False, "baseline_noise": 0.05}
    noisy_a = GamblingSimulation(cfg)
    noisy_a.run()
    noisy_b = GamblingSimulation(cfg.model_copy(deep=True))
    noisy_b.run()
    lottery_quiet = [m["bsi_lottery"] for m in quiet.metrics_history]
    lottery_noisy = [m["bsi_lottery"] for m in noisy_a.metrics_history]
    assert len(set(round(v, 6) for v in lottery_quiet)) == 1
    assert len(set(round(v, 6) for v in lottery_noisy)) > 1, "noise must be live"
    assert noisy_a.state_hash() == noisy_b.state_hash()      # still reproducible


def test_reproducibility_same_seed_same_hash():
    _c1, s1 = _run(ticks=30)
    _c2, s2 = _run(ticks=30)
    assert s1.state_hash() == s2.state_hash()
    assert s1.metrics_history[-1] == s2.metrics_history[-1]


# --------------------------------------------------------------------------- #
# API domain switch
@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "gambling.db"))
    from api.main import create_app

    return TestClient(create_app())


def _finish(client, body, timeout=60):
    rid = client.post("/api/runs", json=body).json()["run_id"]
    client.post(f"/api/runs/{rid}/speed", json={"tps": 500})
    client.post(f"/api/runs/{rid}/start")
    deadline = time.time() + timeout
    while time.time() < deadline:
        if client.get(f"/api/runs/{rid}").json()["status"] == "finished":
            return rid
        time.sleep(0.1)
    raise TimeoutError("run did not finish")


def test_api_gambling_run_produces_market_size_series(client):
    rid = _finish(client, {"preset_id": "dk_baseline", "ticks": 24})
    frame = client.get(f"/api/runs/{rid}").json()
    assert frame.get("domain") == "gambling"
    assert "bsi_total" in frame["metrics"]
    m = client.get(f"/api/runs/{rid}/metrics?names=bsi_total,bsi_casino").json()
    assert len(m["ticks"]) == 24
    assert "bsi_total" in m["series"] and "bsi_casino" in m["series"]


def test_api_gambling_presets_listed_with_domain(client):
    presets = client.get("/api/presets").json()
    dk = next((p for p in presets if p["id"] == "dk_baseline"), None)
    assert dk is not None and dk["domain"] == "gambling"


def test_api_rejects_bad_gambling_config(client):
    bad = {"config": {"sim_domain": "gambling",
                      "gambling": {"channelization_start": 0.5}}}  # below low
    assert client.post("/api/runs", json=bad).status_code == 422
