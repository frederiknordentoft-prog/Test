"""Long-run trends: clickable, strength-adjustable drivers + 15-year horizons.

Config-trends adjust growth/AI parameters at run start; drift-trends move the
regulation/operator state a little every month. Validated against the catalog,
served to the UI via GET /api/trends."""
import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.calendar import sports_intensity
from simcore.gambling.config import CalendarConfig, GamblingConfig
from simcore.gambling.simulation import GamblingSimulation
from simcore.gambling.trends import TREND_CATALOG, TREND_IDS


def _run(trends=None, ticks=25, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False, **({"trends": trends} if trends else {}), **g}
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


# --------------------------------------------------------------------------- #
def test_catalog_is_wellformed():
    assert len(TREND_CATALOG) >= 8
    for t in TREND_CATALOG:
        assert {"id", "name", "desc", "kind", "realism", "default"} <= set(t)
        assert t["kind"] in ("config", "drift")
        assert t["realism"] in ("høj", "middel", "lav")
        assert 0.0 <= t["default"] <= 1.0


def test_unknown_or_out_of_range_trend_rejected():
    with pytest.raises(ValueError):
        GamblingConfig(trends={"not_a_trend": 0.5})
    with pytest.raises(ValueError):
        GamblingConfig(trends={"market_growth": 1.5})


def test_market_growth_trend_scales_observed_rates():
    base = _run()
    strong = _run({"market_growth": 1.0})
    weak = _run({"market_growth": 0.0})
    g = lambda s: s.metrics_history[12]["bsi_casino"] / s.metrics_history[0]["bsi_casino"]
    assert g(strong) > g(base) + 0.04       # ~+22 %/yr vs +14.7 %/yr
    assert g(weak) < g(base) - 0.04         # ~+7 %/yr
    # t0 anchor untouched — trends shape the dynamics, not the starting level
    assert strong.metrics_history[0]["bsi_casino"] == pytest.approx(
        base.metrics_history[0]["bsi_casino"], rel=1e-6)


def test_generational_shift_erodes_lottery():
    base = _run(ticks=37)
    shift = _run({"generational_shift": 1.0}, ticks=37)
    g = lambda s: s.metrics_history[36]["bsi_lottery"] / s.metrics_history[0]["bsi_lottery"]
    assert g(shift) < g(base) - 0.05        # −3 %/yr compounds over 3 years


def test_regulatory_drift_tightens_gradually_and_leaks():
    base = _run(ticks=36)
    drift = _run({"regulatory_drift": 1.0}, ticks=36)
    fr = [m["reg_friction"] for m in drift.metrics_history]
    assert fr[35] > fr[12] > fr[1]          # monotone creep, no cliff
    assert drift.metrics_history[-1]["channelization"] < base.metrics_history[-1]["channelization"] - 0.02


def test_prediction_growth_opens_the_loophole_gradually():
    drift = _run({"prediction_growth": 1.0}, ticks=60)
    share = [m.get("share_op_prediction", 0.0) for m in drift.metrics_history]
    assert share[12] < 0.01                 # still marginal after a year
    assert share[-1] > 0.01                 # a real market after five


def test_fifteen_year_horizon_with_recurring_tournaments():
    cal = CalendarConfig(amplitude=0.0, tournament_every=24, tournament_offset=17,
                         tournament_boost=0.6)
    boosted = [t for t in range(180) if sports_intensity(t, cal) > 1.3]
    assert boosted[:4] == [17, 18, 41, 42]
    assert 161 in boosted and 162 in boosted   # tournaments keep cycling in year 13
    sim = _run({"market_growth": 0.5, "regulatory_drift": 0.3}, ticks=180)
    assert sim.tick == 180
    assert sim.metrics_history[-1]["market_size_total"] > 0


def test_api_trend_catalog_and_run_with_trends(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "tr.db"))
    from api.main import create_app

    client = TestClient(create_app())
    cat = client.get("/api/trends").json()
    assert {t["id"] for t in cat} == TREND_IDS
    r = client.post("/api/runs", json={
        "preset_id": "dk_baseline", "ticks": 6, "domain": "gambling",
        "gambling_overrides": {"population": 200, "trends": {"market_growth": 0.8}}})
    assert r.status_code == 200
    bad = client.post("/api/runs", json={
        "preset_id": "dk_baseline", "domain": "gambling",
        "gambling_overrides": {"trends": {"hoverboards": 1.0}}})
    assert bad.status_code == 422
