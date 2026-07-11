"""Result endpoints: metrics, asset series, actors, decisions, trades, events,
network snapshots and export."""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path

import numpy as np
from fastapi import APIRouter, HTTPException, Query

from api.runner import REGISTRY, RunHandle
from simcore.models.actor_state import ActorType
from simcore.persistence.export import export_run

router = APIRouter(prefix="/api/runs", tags=["results"])

EXPORT_DIR = Path("../data/exports")


def _handle(run_id: str) -> RunHandle:
    try:
        return REGISTRY.get(run_id)
    except KeyError:
        raise HTTPException(404, f"unknown run '{run_id}'")


@router.get("/{run_id}/metrics")
def metrics(run_id: str, names: str | None = None, from_tick: int = 0, to_tick: int | None = None,
            stride: int = 1):
    h = _handle(run_id)
    history = h.sim.metrics_history[from_tick:to_tick]
    if stride > 1:
        history = history[::stride]
    if not history:
        return {"ticks": [], "series": {}}
    keys = names.split(",") if names else [k for k in history[0] if k != "tick"]
    return {
        "ticks": [m["tick"] for m in history],
        "series": {k: [round(float(m.get(k, 0.0)), 5) for m in history] for k in keys},
    }


@router.get("/{run_id}/assets")
def assets(run_id: str, from_tick: int = 0, stride: int = 1):
    h = _handle(run_id)
    rows = [r for r in h.sim.asset_history if r["tick"] >= from_tick]
    if stride > 1:
        rows = [r for r in rows if r["tick"] % stride == 0]
    return {"assets": list(h.sim.market.assets.keys()), "rows": rows}


@router.get("/{run_id}/actors")
def actors(run_id: str, sample: int = 40):
    h = _handle(run_id)
    sim = h.sim
    prices = sim.market.prices()
    by_type: dict[str, dict] = {}
    for t in ActorType:
        members = [a for a in sim.actors if a.actor_type == t]
        if not members:
            continue
        alive = [a for a in members if a.state.alive]
        wealth = np.array([a.state.wealth(prices) for a in alive]) if alive else np.array([0.0])
        by_type[t.value] = {
            "count": len(members),
            "alive": len(alive),
            "bankrupt": len(members) - len(alive),
            "total_wealth": float(wealth.sum()),
            "mean_wealth": float(wealth.mean()),
            "mean_sentiment": float(np.mean([a.state.sentiment for a in alive])) if alive else 0.0,
            "mean_stress": float(np.mean([a.state.stress for a in alive])) if alive else 0.0,
            "mean_leverage": float(np.mean([a.state.leverage(prices) for a in alive])) if alive else 0.0,
        }
    ranked = sorted(sim.actors, key=lambda a: a.state.wealth(prices), reverse=True)
    top = [a.to_summary(prices) for a in ranked[:10]]
    idx = np.linspace(0, len(ranked) - 1, num=min(sample, len(ranked)), dtype=int)
    sampled = [ranked[i].to_summary(prices) for i in idx]
    wealth_all = np.array([a.state.wealth(prices) for a in sim.actors if a.state.alive])
    hist, edges = np.histogram(np.log10(np.clip(wealth_all, 1.0, None)), bins=20)
    return {
        "types": by_type,
        "top": top,
        "sample": sampled,
        "wealth_histogram": {"counts": hist.tolist(), "log10_edges": np.round(edges, 3).tolist()},
    }


@router.get("/{run_id}/actors/{actor_id}")
def actor_detail(run_id: str, actor_id: int):
    h = _handle(run_id)
    sim = h.sim
    if actor_id < 0 or actor_id >= len(sim.actors):
        raise HTTPException(404, "unknown actor")
    a = sim.actors[actor_id]
    prices = sim.market.prices()
    decisions = [d for d in sim.recent_decisions if d["actor_id"] == actor_id][-20:]
    return {
        **a.to_summary(prices),
        "objective": a.primary_objective,
        "secondary_objectives": a.secondary_objectives,
        "traits": asdict(a.traits),
        "positions": a.state.positions,
        "margin_debt": a.state.margin_debt,
        "loans": a.state.loans,
        "memory": [asdict(m) for m in list(a.state.memory)[-20:]],
        "recent_decisions": decisions,
        "relationships": {
            layer: sim.net.neighbors(layer, actor_id) for layer in sim.net.layers
        },
    }


@router.get("/{run_id}/decisions")
def decisions(run_id: str, actor_id: int | None = None, tick: int | None = None,
              action: str | None = None, limit: int = Query(100, le=1000)):
    h = _handle(run_id)
    out = list(h.sim.recent_decisions)
    if actor_id is not None:
        out = [d for d in out if d["actor_id"] == actor_id]
    if tick is not None:
        out = [d for d in out if d["tick"] == tick]
    if action is not None:
        out = [d for d in out if d["action"] == action]
    return out[-limit:]


@router.get("/{run_id}/trades")
def trades(run_id: str, tick: int | None = None, limit: int = Query(200, le=2000)):
    h = _handle(run_id)
    out = list(h.sim.recent_trades)
    if tick is not None:
        out = [t for t in out if t.tick == tick]
    return [asdict(t) for t in out[-limit:]]


@router.get("/{run_id}/events")
def events(run_id: str):
    h = _handle(run_id)
    return [
        {"tick": r.tick, "name": r.name, "type": r.event_type,
         "magnitude": r.magnitude, "phase": r.phase}
        for r in h.sim.events_log
    ]


@router.get("/{run_id}/network")
def network(run_id: str, layer: str = "social", max_nodes: int = 400):
    h = _handle(run_id)
    sim = h.sim
    if layer not in sim.net.layers:
        raise HTTPException(404, f"unknown layer '{layer}' (available: {list(sim.net.layers)})")
    g = sim.net.layers[layer]
    prices = sim.market.prices()
    nodes = []
    for n in list(g.nodes)[:max_nodes]:
        a = sim.actors[int(n)]
        nodes.append(
            {"id": int(n), "type": a.actor_type.value, "alive": a.state.alive,
             "wealth": round(float(a.state.wealth(prices)), 1),
             "market_power": round(float(a.traits.market_power), 4),
             "sentiment": round(float(a.state.sentiment), 3)}
        )
    keep = {n["id"] for n in nodes}
    edges = [
        {"source": int(u), "target": int(v), "strength": round(float(d.get("strength", 0.5)), 3)}
        for u, v, d in g.edges(data=True)
        if int(u) in keep and int(v) in keep
    ]
    return {"layer": layer, "nodes": nodes, "edges": edges}


@router.get("/{run_id}/export")
def export(run_id: str, fmt: str = "csv"):
    h = _handle(run_id)
    if h.sim.recorder is None:
        raise HTTPException(400, "run has no persistence enabled")
    h.sim.recorder.flush()
    out_dir = EXPORT_DIR / run_id
    files = export_run(h.sim.recorder.conn, run_id, out_dir, fmt=fmt)
    return {"files": files, "directory": str(out_dir.resolve())}
