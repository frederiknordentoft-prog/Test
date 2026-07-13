"""Robustness & sensitivity endpoints — the model's most important output,
made reachable from the product (a critic finding: the report existed but no
route exposed it).

- ``GET  /api/params``          the source-annotated parameter register
- ``POST /api/robustness``      start a grid (contested-assumptions) or Morris
                                (register-wide screening) analysis in the
                                background
- ``GET  /api/robustness/{id}`` poll progress / fetch the result
"""
from __future__ import annotations

import threading
import traceback
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import Field

from api.schemas import CreateRunRequest, build_config
from simcore.gambling.morris import morris_screening
from simcore.gambling.params import load_register, param_table
from simcore.gambling.robustness import robustness_statement, run_robustness
from simcore.models.config import EventConfig

router = APIRouter(prefix="/api", tags=["robustness"])


class RobustnessRequest(CreateRunRequest):
    mode: str = Field("grid", pattern="^(grid|morris)$")
    # grid mode
    policy_events: list[dict[str, Any]] = Field(default_factory=list)
    channelization_grid: list[float] | None = None
    sigma_grid: list[float] | None = None
    # morris mode
    trajectories: int = Field(4, ge=1, le=20)
    analysis_ticks: int = Field(24, ge=4, le=240)


class RobustnessHandle:
    def __init__(self, req: RobustnessRequest):
        self.rb_id = uuid.uuid4().hex[:12]
        self.mode = req.mode
        self.status = "running"
        self.progress = 0
        self.total = 0
        self.result: dict | None = None
        self.error: str | None = None

        config = build_config(req)

        def _on_progress(done: int, total: int) -> None:
            self.progress, self.total = done, total

        def _run() -> None:
            try:
                if req.mode == "morris":
                    self.result = morris_screening(
                        config, trajectories=req.trajectories,
                        ticks=req.analysis_ticks, on_progress=_on_progress,
                    )
                else:
                    events = [EventConfig(**e) for e in req.policy_events]
                    rep = run_robustness(
                        config, events,
                        channelization_grid=req.channelization_grid,
                        sigma_grid=req.sigma_grid,
                        ticks=req.analysis_ticks,
                    )
                    rep["statements"] = robustness_statement(rep)
                    self.result = rep
                self.status = "finished"
            except Exception:  # pragma: no cover - defensive
                self.error = traceback.format_exc()
                self.status = "error"

        self.thread = threading.Thread(target=_run, daemon=True, name=f"rb-{self.rb_id}")
        self.thread.start()


_HANDLES: dict[str, RobustnessHandle] = {}


@router.get("/params")
def params():
    """The parameter register: value, source, confidence, sensitivity flag and
    interval per parameter — 'as important as the code' (fælde 3)."""
    reg = load_register()
    return {"meta": reg["meta"], "parameters": param_table()}


@router.get("/trends")
def trends():
    """The clickable long-run trend catalog (id, Danish name/description,
    realism grade, default strength) for the setup panel."""
    from simcore.gambling.trends import TREND_CATALOG

    return TREND_CATALOG


@router.get("/hindcast")
def hindcast():
    """Backtest against the real Spillemyndigheden series (flagship Etape B):
    per-vertical fit, out-of-sample skill vs naive baselines, and an honest
    verdict on what the model can and cannot predict."""
    from simcore.gambling.calibration.hindcast import run_hindcast

    return run_hindcast()


@router.get("/calibration-data")
def calibration_data():
    """The committed real calibration data (historical series + concentration +
    natural-experiment targets) with source and confidence per row — the
    provenance behind the model's anchors."""
    from simcore.gambling.calibration.loader import (
        concentration,
        experiments,
        historical,
    )

    return {
        "historical": historical().to_dict(orient="records"),
        "concentration": concentration().to_dict(orient="records"),
        "experiments": experiments().to_dict(orient="records"),
    }


@router.post("/robustness")
def create_robustness(req: RobustnessRequest):
    try:
        handle = RobustnessHandle(req)
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(422, str(e))
    _HANDLES[handle.rb_id] = handle
    return {"rb_id": handle.rb_id, "mode": handle.mode, "status": handle.status}


@router.get("/robustness/{rb_id}")
def get_robustness(rb_id: str):
    h = _HANDLES.get(rb_id)
    if h is None:
        raise HTTPException(404, f"unknown robustness analysis '{rb_id}'")
    return {"rb_id": h.rb_id, "mode": h.mode, "status": h.status,
            "progress": h.progress, "total": h.total,
            "result": h.result, "error": h.error}
