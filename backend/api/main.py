"""FastAPI app factory. Serves the REST API + WebSocket, and (if built) the
frontend bundle from frontend/dist."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.routes import configs, montecarlo, results, runs, ws

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def create_app() -> FastAPI:
    app = FastAPI(
        title="Agent Market Simulator",
        description=(
            "Agent-based simulation environment for exploring reaction patterns, "
            "feedback loops and systemic risk. An analysis and learning tool — "
            "NOT a financial forecasting model."
        ),
        version="0.1.0",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(runs.router)
    app.include_router(results.router)
    app.include_router(configs.router)
    app.include_router(montecarlo.router)
    app.include_router(ws.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    if FRONTEND_DIST.exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    return app


app = create_app()
