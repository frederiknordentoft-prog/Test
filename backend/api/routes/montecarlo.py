"""Monte Carlo endpoints: multi-seed headless batches."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.runner import REGISTRY, MonteCarloHandle
from api.schemas import CreateMonteCarloRequest, build_config

router = APIRouter(prefix="/api/montecarlo", tags=["montecarlo"])


@router.post("")
def create_mc(req: CreateMonteCarloRequest):
    try:
        config = build_config(req)
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(422, str(e))
    seeds = [req.base_seed + i for i in range(max(1, min(req.n_seeds, 500)))]
    handle = MonteCarloHandle(config, seeds, req.label)
    REGISTRY.mc[handle.mc_id] = handle
    return {"mc_id": handle.mc_id, "n_seeds": len(seeds), "status": handle.status}


@router.get("")
def list_mc():
    return [
        {"mc_id": h.mc_id, "label": h.label, "status": h.status,
         "progress": h.progress, "total": h.total}
        for h in REGISTRY.mc.values()
    ]


@router.get("/{mc_id}")
def get_mc(mc_id: str):
    h = REGISTRY.mc.get(mc_id)
    if h is None:
        raise HTTPException(404, f"unknown monte carlo batch '{mc_id}'")
    return {
        "mc_id": h.mc_id,
        "label": h.label,
        "status": h.status,
        "progress": h.progress,
        "total": h.total,
        "result": h.result,
        "error": h.error,
    }


@router.post("/{mc_id}/stop")
def stop_mc(mc_id: str):
    h = REGISTRY.mc.get(mc_id)
    if h is None:
        raise HTTPException(404, f"unknown monte carlo batch '{mc_id}'")
    h.stop()
    return {"status": "ok"}
