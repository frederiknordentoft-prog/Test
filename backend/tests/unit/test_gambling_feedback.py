"""User-feedback round: gambling HTML report, anchored customer counts,
DS share of the liberalized market, licensee representation and per-operator
strategy overrides."""
import time

import pytest
from fastapi.testclient import TestClient

from simcore.config.loader import load_preset
from simcore.gambling.config import GamblingConfig
from simcore.gambling.simulation import GamblingSimulation
from simcore.persistence.report import generate_report


def _sim(ticks=12, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False, **g}
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


def test_gambling_html_report_generates():
    """The report endpoint raised KeyError('price_index') on gambling runs."""
    sim = _sim(ticks=8)
    html = generate_report(sim)
    assert "Spilmarkeds-rapport" in html
    assert "rullende 12" in html
    assert "Kanalisering" in html and "parameterregistret" in html.lower() or "Parameterregister" in html
    # Feedback round 2: DS lottery share + unique-customers line in the report.
    assert "lotterimarkedet" in html
    assert "Unikke kunder" in html


def test_report_survives_server_restart(tmp_path, monkeypatch):
    """Feedback round 2 ("HTML virker ikke"): after a server restart the report
    button opened a raw 404-JSON tab, because /report only knew in-memory runs.
    It must now rebuild the report from the database — and show a friendly
    Danish error page for a genuinely unknown run, never raw JSON."""
    import api.runner as runner_mod

    db = str(tmp_path / "restart.db")
    monkeypatch.setattr(runner_mod, "DB_PATH", db)

    # A recorded run, as the UI would have created it — then "restart": the
    # registry has no handle, only the database remains.
    cfg = load_preset("dk_baseline")
    cfg.ticks = 6
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False,
                    "rofus_enabled": False}
    sim = GamblingSimulation(cfg, db_path=db)
    sim.run()

    from api.main import create_app
    client = TestClient(create_app())

    r = client.get(f"/api/runs/{sim.run_id}/report")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "Spilmarkeds-rapport" in r.text

    r = client.get("/api/runs/does-not-exist/report")
    assert r.status_code == 404
    assert "text/html" in r.headers["content-type"]
    assert "Rapporten kan ikke vises" in r.text     # friendly page, not raw JSON


def test_customer_counts_match_danish_anchors_at_baseline():
    """~4.5 M adult Danes: lottery ≈ 1.4 M customers, the liberalized verticals
    a few hundred thousand each — not millions (user feedback)."""
    sim = _sim(ticks=6)
    m0 = sim.metrics_history[0]
    # Feedback round 2: low-mid of the user's 300-800k band per liberalized vertical.
    assert m0["customers_lottery"] == pytest.approx(1_400_000, rel=1e-6)
    assert m0["customers_scratch"] == pytest.approx(550_000, rel=1e-6)
    assert m0["customers_casino"] == pytest.approx(400_000, rel=1e-6)
    assert m0["customers_sports"] == pytest.approx(450_000, rel=1e-6)
    # unique respects overlap: below the sum, above the biggest vertical
    total = m0["customers_total"]
    assert m0["customers_lottery"] < total < 2_800_000
    assert total < 1_500_000 * 1.5   # sanity vs the adult population


def test_ds_share_of_liberalized_market_is_emitted():
    sim = _sim(ticks=6)
    m = sim.metrics_history[-1]
    assert 0.0 < m["ds_share_liberalized"] <= 1.0
    # the total share includes the protected monopoly and must differ
    assert m["ds_share_liberalized"] != m["ds_share_total"]
    # DS competitive anchor implies roughly 35-45 % of the licensed liberalized market
    assert 0.25 <= m["ds_share_liberalized"] <= 0.55


def test_licensees_represented_and_longtail_persists():
    """Spillemyndigheden's register lists ~40 full-scale licence holders; the
    aggregated long-tail block must not exit as one unit."""
    cfg = load_preset("dk_baseline")
    cfg.ticks = 24
    sim = GamblingSimulation(cfg)
    sim.run()
    m = sim.metrics_history[-1]
    assert m["n_licensees"] >= 35
    assert "longtail" not in sim.entry.exited
    assert any(o.operator_id == "longtail" for o in sim.market.operators)


def test_operator_overrides_change_outcomes():
    base = _sim(ticks=10)
    nerfed = _sim(ticks=10, operator_overrides={
        "betano": {"marketing_reach": 0.2, "bonus": 0.2, "aggressiveness": 0.2}})
    s_base = base.metrics_history[-1].get("share_op_betano", 0.0)
    s_nerf = nerfed.metrics_history[-1].get("share_op_betano", 0.0)
    assert s_nerf < s_base, "cutting Betano's commercial levers must cost it share"
    with pytest.raises(ValueError):
        GamblingConfig(operator_overrides={"unknown_op": {"bonus": 0.5}})
    with pytest.raises(ValueError):
        GamblingConfig(operator_overrides={"betano": {"not_a_field": 1.0}})


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "fb.db"))
    from api.main import create_app

    return TestClient(create_app())


def test_api_gambling_report_and_overrides(client):
    body = {"preset_id": "dk_baseline", "ticks": 8, "domain": "gambling",
            "gambling_overrides": {
                "population": 200,
                "operator_overrides": {"ds_licens": {"marketing_reach": 0.9}},
            }}
    rid = client.post("/api/runs", json=body).json()["run_id"]
    client.post(f"/api/runs/{rid}/speed", json={"tps": 500})
    client.post(f"/api/runs/{rid}/start")
    deadline = time.time() + 60
    while time.time() < deadline:
        if client.get(f"/api/runs/{rid}").json()["status"] == "finished":
            break
        time.sleep(0.2)
    r = client.get(f"/api/runs/{rid}/report")
    assert r.status_code == 200 and "Spilmarkeds-rapport" in r.text
    m = client.get(f"/api/runs/{rid}/metrics?names=ds_share_liberalized,n_licensees,customers_lottery").json()
    assert all(k in m["series"] for k in ("ds_share_liberalized", "n_licensees", "customers_lottery"))
