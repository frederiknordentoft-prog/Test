"""Run lifecycle endpoints."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.runner import REGISTRY, RunHandle
from api.schemas import CreateRunRequest, SpeedRequest, StepRequest

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _handle(run_id: str) -> RunHandle:
    try:
        return REGISTRY.get(run_id)
    except KeyError:
        raise HTTPException(404, f"unknown run '{run_id}'")


@router.post("")
def create_run(req: CreateRunRequest):
    from api.schemas import build_config

    try:
        config = build_config(req)
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(422, str(e))
    handle = REGISTRY.create(config, req.label)
    return {"run_id": handle.run_id, "status": handle.status, "config": config.model_dump()}


@router.get("")
def list_runs(include_archived: bool = True):
    live = [
        {
            "run_id": h.run_id,
            "label": h.label,
            "status": h.status,
            "tick": h.sim.tick,
            "ticks_target": h.config.ticks,
            "seed": h.config.seed,
            "archived": False,
        }
        for h in REGISTRY.runs.values()
    ]
    if not include_archived:
        return live
    live_ids = {r["run_id"] for r in live}
    try:
        from api.runner import DB_PATH
        from simcore.persistence.db import connect

        conn = connect(DB_PATH)
        rows = conn.execute(
            "SELECT run_id, label, status, tick_count, ticks_target, seed FROM runs "
            "ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
        conn.close()
        for run_id, label, status, tick, target, seed in rows:
            if run_id not in live_ids:
                live.append({
                    "run_id": run_id, "label": label, "status": status,
                    "tick": tick, "ticks_target": target, "seed": seed,
                    "archived": True,
                })
    except Exception:
        pass  # a missing/locked DB must never break run listing
    return live


@router.get("/{run_id}")
def get_run(run_id: str):
    h = _handle(run_id)
    return h.frame() | {"label": h.label, "seed": h.config.seed, "error": h.error}


@router.post("/{run_id}/start")
def start(run_id: str):
    _handle(run_id).start()
    return {"status": "ok"}


@router.post("/{run_id}/pause")
def pause(run_id: str):
    _handle(run_id).pause()
    return {"status": "ok"}


@router.post("/{run_id}/resume")
def resume(run_id: str):
    _handle(run_id).resume()
    return {"status": "ok"}


@router.post("/{run_id}/stop")
def stop(run_id: str):
    _handle(run_id).stop()
    return {"status": "ok"}


@router.post("/{run_id}/step")
def step(run_id: str, req: StepRequest | None = None):
    _handle(run_id).step((req.n if req else 1) or 1)
    return {"status": "ok"}


@router.post("/{run_id}/speed")
def speed(run_id: str, req: SpeedRequest):
    h = _handle(run_id)
    h.target_tps = max(0.5, min(req.tps, 500.0))
    return {"status": "ok", "tps": h.target_tps}


@router.post("/{run_id}/reset")
def reset(run_id: str):
    h = _handle(run_id)
    new = h.reset()
    REGISTRY.replace(run_id, new)
    return {"run_id": new.run_id, "status": new.status}
