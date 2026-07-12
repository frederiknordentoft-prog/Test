import time

import pandas as pd
from fastapi.testclient import TestClient

from simcore.engine.simulation import Simulation
from simcore.persistence.export import export_run
from tests.conftest import small_config


def test_export_writes_files(tmp_path):
    db = tmp_path / "test.db"
    sim = Simulation(small_config(seed=42, ticks=12), db_path=str(db))
    sim.run(12)
    sim.recorder.flush()
    files = export_run(sim.recorder.conn, sim.run_id, tmp_path / "out", fmt="csv")
    assert len(files) >= 5
    metrics = pd.read_csv(next(f for f in files if "metrics" in f))
    assert len(metrics) == 12
    assert "price_index" in metrics.columns
    decisions = pd.read_csv(next(f for f in files if "decisions" in f))
    assert {"actor_id", "action", "probability", "drivers_json"} <= set(decisions.columns)
    assert len(decisions) > 0


def test_api_end_to_end(tmp_path, monkeypatch):
    import api.runner as runner_mod

    monkeypatch.setattr(runner_mod, "DB_PATH", str(tmp_path / "api.db"))
    from api.main import create_app

    client = TestClient(create_app())
    assert client.get("/api/health").json() == {"status": "ok"}
    assert len(client.get("/api/presets").json()) >= 5
    assert "rate_shock" in [s["id"] for s in client.get("/api/scenarios").json()]

    r = client.post("/api/runs", json={"ticks": 15, "seed": 3, "n_actors": 100,
                                       "scenario": "rate_shock", "label": "t"})
    assert r.status_code == 200
    rid = r.json()["run_id"]

    client.post(f"/api/runs/{rid}/start")
    deadline = time.time() + 30
    while time.time() < deadline:
        fr = client.get(f"/api/runs/{rid}").json()
        if fr["status"] in ("finished", "stopped", "error"):
            break
        time.sleep(0.3)
    assert fr["status"] == "finished", fr.get("error")
    assert fr["tick"] == 15

    m = client.get(f"/api/runs/{rid}/metrics?names=price_index,systemic_risk").json()
    assert len(m["ticks"]) == 15
    a = client.get(f"/api/runs/{rid}/actors").json()
    assert "retail" in a["types"]
    d = client.get(f"/api/runs/{rid}/decisions?limit=5").json()
    assert d and "explanation" in d[0]
    n = client.get(f"/api/runs/{rid}/network?layer=supplier").json()
    assert n["nodes"]
    assert client.get(f"/api/runs/{rid}/export").status_code == 200
    bad = client.post("/api/runs", json={"preset_id": "nope"})
    assert bad.status_code == 422
