"""Phase-3 feature tests: reaction analysis, report, parquet, saved scenarios,
network centrality, validation and archived-run fallbacks."""
import time

import pandas as pd
import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    import api.runner as runner_mod
    from api.routes import configs as configs_mod
    from api.routes import results as results_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "api.db"))
    monkeypatch.setattr(configs_mod, "SAVED_DIR", tmp_path / "saved")
    monkeypatch.setattr(results_mod, "EXPORT_DIR", tmp_path / "exports")
    from api.main import create_app

    return TestClient(create_app())


def _finished_run(client, ticks=25, **kwargs) -> str:
    body = {"ticks": ticks, "seed": 5, "n_actors": 100,
            "events": [{"name": "hike", "event_type": "rate_hike", "start_tick": 3}]}
    body.update(kwargs)
    rid = client.post("/api/runs", json=body).json()["run_id"]
    client.post(f"/api/runs/{rid}/speed", json={"tps": 500})
    client.post(f"/api/runs/{rid}/start")
    deadline = time.time() + 60
    while time.time() < deadline:
        if client.get(f"/api/runs/{rid}").json()["status"] == "finished":
            return rid
        time.sleep(0.2)
    raise TimeoutError("run did not finish")


def test_reaction_analysis_endpoint(client):
    rid = _finished_run(client)
    r = client.get(f"/api/runs/{rid}/events/0/reactions?window=10")
    assert r.status_code == 200
    data = r.json()
    assert data["event"]["type"] == "rate_hike"
    assert data["n_decisions"] > 0
    assert data["reactions_by_type"], "must aggregate who reacted"
    assert data["top_drivers"], "must expose why (actual drivers)"
    assert data["reactions_per_tick"], "must show how the reaction spread"
    assert "margin_calls_in_window" in data["second_order"]
    assert client.get(f"/api/runs/{rid}/events/99/reactions").status_code == 404


def test_html_report(client):
    rid = _finished_run(client, ticks=15)
    r = client.get(f"/api/runs/{rid}/report")
    assert r.status_code == 200
    assert "not a forecast" in r.text
    assert "plotly" in r.text.lower()
    assert "Final indicators" in r.text


def test_parquet_export(client, tmp_path):
    rid = _finished_run(client, ticks=12)
    r = client.get(f"/api/runs/{rid}/export?fmt=parquet")
    assert r.status_code == 200
    files = [f for f in r.json()["files"] if f.endswith(".parquet")]
    assert files
    df = pd.read_parquet(next(f for f in files if "metrics" in f))
    assert "price_index" in df.columns and len(df) == 12
    assert client.get(f"/api/runs/{rid}/export?fmt=bogus").status_code == 422


def test_save_and_reload_scenario(client):
    r = client.post("/api/configs", json={
        "name": "Crash Test", "description": "test scenario",
        "ticks": 33, "seed": 77, "scenario": "rumor_panic",
    })
    assert r.status_code == 200
    saved_id = r.json()["id"]
    listed = client.get("/api/configs").json()
    assert any(c["id"] == saved_id for c in listed)
    run = client.post("/api/runs", json={"saved_id": saved_id, "label": "reload"})
    assert run.status_code == 200
    cfg = run.json()["config"]
    assert cfg["ticks"] == 33 and cfg["seed"] == 77
    assert any(e["event_type"] == "rumor" for e in cfg["events"]), "scenario events preserved"
    assert client.delete(f"/api/configs/{saved_id}").status_code == 200
    assert client.post("/api/runs", json={"saved_id": saved_id}).status_code == 422


def test_network_includes_centrality_and_systemic_flag(client):
    rid = _finished_run(client, ticks=8)
    n = client.get(f"/api/runs/{rid}/network?layer=social").json()
    assert all("centrality" in node and "systemic" in node for node in n["nodes"])
    n_sys = sum(1 for node in n["nodes"] if node["systemic"])
    assert 0 < n_sys <= len(n["nodes"]) * 0.25


def test_request_validation(client):
    assert client.post("/api/runs", json={"ticks": -5}).status_code == 422
    assert client.post("/api/runs", json={"n_actors": 2}).status_code == 422
    assert client.post("/api/runs", json={"seed": -1}).status_code == 422
    assert client.post("/api/montecarlo", json={"n_seeds": 0}).status_code == 422
    bad_event = {"events": [{"name": "x", "event_type": "rate_hike", "magnitude": 99}]}
    assert client.post("/api/runs", json=bad_event).status_code == 422


def test_metrics_available_for_archived_runs(client):
    """Metrics must survive registry loss (server restart) via SQLite."""
    from api.runner import REGISTRY

    rid = _finished_run(client, ticks=10)
    REGISTRY.runs.pop(rid)  # simulate restart
    listed = client.get("/api/runs").json()
    entry = next(r for r in listed if r["run_id"] == rid)
    assert entry["archived"] is True
    m = client.get(f"/api/runs/{rid}/metrics?names=price_index").json()
    assert len(m["ticks"]) == 10
