"""Investment / deal-returns endpoints — the capital-fund lens.

- ``POST /api/investment``      start a deal analysis (Monte Carlo returns +
                                downside tornado) in the background
- ``GET  /api/investment/{id}`` poll progress / fetch the result

The result bundles what an investment committee reads: the distribution of
IRR / MOIC / EV-EBITDA / equity value across seeds, the value-creation bridge,
the NAV fan over the hold, the probability of capital loss, and the thesis-risk
tornado (how far each stress scenario moves median IRR).
"""
from __future__ import annotations

import threading
import traceback
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import Field

from api.schemas import CreateRunRequest, build_config
from simcore.gambling.config import DealConfig
from simcore.gambling.investment import (
    STRESS_SCENARIOS,
    deal_monte_carlo,
    deal_stress_tornado,
)

router = APIRouter(prefix="/api", tags=["investment"])


class InvestmentRequest(CreateRunRequest):
    deal: DealConfig = Field(default_factory=DealConfig)
    base_seed: int = Field(1000, ge=0)
    tornado: bool = True
    tornado_seeds: int = Field(8, ge=1, le=100)   # reduced seed count for the stress sweep


class InvestmentHandle:
    def __init__(self, req: InvestmentRequest):
        self.inv_id = uuid.uuid4().hex[:12]
        self.status = "running"
        self.progress = 0
        deal = req.deal
        seeds = [req.base_seed + i for i in range(deal.n_seeds)]
        t_seeds = seeds[:min(deal.n_seeds, req.tornado_seeds)]
        self.total = deal.n_seeds + (len(STRESS_SCENARIOS) if req.tornado else 0)
        self.result: dict | None = None
        self.error: str | None = None

        config = build_config(req)   # forces gambling domain + validates

        def _mc_progress(done: int, total: int) -> None:
            self.progress = done

        def _run() -> None:
            try:
                mc = deal_monte_carlo(config, deal, seeds, on_progress=_mc_progress)
                result = dict(mc)
                if req.tornado:
                    base_med = mc["percentiles"]["deal_irr"]["median"]

                    def _tor_progress(done: int, total: int) -> None:
                        self.progress = deal.n_seeds + done

                    result["tornado"] = deal_stress_tornado(
                        config, deal, t_seeds, baseline_median_irr=base_med,
                        on_progress=_tor_progress)
                self.result = result
                self.status = "finished"
            except Exception:  # pragma: no cover - defensive
                self.error = traceback.format_exc()
                self.status = "error"

        self.thread = threading.Thread(target=_run, daemon=True, name=f"inv-{self.inv_id}")
        self.thread.start()


_HANDLES: dict[str, InvestmentHandle] = {}


@router.post("/investment")
def create_investment(req: InvestmentRequest):
    try:
        handle = InvestmentHandle(req)
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(422, str(e))
    _HANDLES[handle.inv_id] = handle
    return {"inv_id": handle.inv_id, "status": handle.status, "total": handle.total}


@router.get("/investment/{inv_id}")
def get_investment(inv_id: str):
    h = _HANDLES.get(inv_id)
    if h is None:
        raise HTTPException(404, f"unknown investment analysis '{inv_id}'")
    return {"inv_id": h.inv_id, "status": h.status, "progress": h.progress,
            "total": h.total, "result": h.result, "error": h.error}
