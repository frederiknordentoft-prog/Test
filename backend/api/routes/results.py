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
    try:
        history = REGISTRY.get(run_id).sim.metrics_history
    except KeyError:
        history = _metrics_from_db(run_id)  # archived run (server restarted)
    history = history[from_tick:to_tick]
    if stride > 1:
        history = history[::stride]
    if not history:
        return {"ticks": [], "series": {}}
    keys = names.split(",") if names else [k for k in history[0] if k != "tick"]
    return {
        "ticks": [m["tick"] for m in history],
        "series": {k: [round(float(m.get(k, 0.0)), 5) for m in history] for k in keys},
    }


def _metrics_from_db(run_id: str) -> list[dict]:
    from api.runner import DB_PATH
    from simcore.persistence.db import connect

    conn = connect(DB_PATH)
    rows = conn.execute(
        "SELECT tick, name, value FROM metrics WHERE run_id=? ORDER BY tick", (run_id,)
    ).fetchall()
    conn.close()
    if not rows:
        raise HTTPException(404, f"unknown run '{run_id}'")
    by_tick: dict[int, dict] = {}
    for tick, name, value in rows:
        by_tick.setdefault(tick, {"tick": tick})[name] = value
    return [by_tick[t] for t in sorted(by_tick)]


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
    centrality = sim.net.degree_centrality(layer)
    ranked = sorted(centrality.values(), reverse=True)
    systemic_cut = ranked[max(0, min(len(ranked) - 1, len(ranked) // 10))] if ranked else 1.0
    nodes = []
    for n in list(g.nodes)[:max_nodes]:
        a = sim.actors[int(n)]
        c = float(centrality.get(n, 0.0))
        nodes.append(
            {"id": int(n), "type": a.actor_type.value, "alive": a.state.alive,
             "wealth": round(float(a.state.wealth(prices)), 1),
             "market_power": round(float(a.traits.market_power), 4),
             "sentiment": round(float(a.state.sentiment), 3),
             "centrality": round(c, 4),
             "systemic": bool(c >= systemic_cut and c > 0)}
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
    if fmt not in ("csv", "json", "parquet"):
        raise HTTPException(422, f"unknown export format '{fmt}' (csv | json | parquet)")
    h = _handle(run_id)
    if h.sim.recorder is None:
        raise HTTPException(400, "run has no persistence enabled")
    h.sim.recorder.flush()
    out_dir = EXPORT_DIR / run_id
    try:
        files = export_run(h.sim.recorder.conn, run_id, out_dir, fmt=fmt)
    except RuntimeError as e:
        raise HTTPException(400, str(e))
    return {"files": files, "directory": str(out_dir.resolve())}


@router.get("/{run_id}/report")
def report(run_id: str):
    from fastapi.responses import HTMLResponse

    from simcore.persistence.report import generate_report

    h = _handle(run_id)
    html = generate_report(h.sim)
    out_dir = EXPORT_DIR / run_id
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "report.html").write_text(html, encoding="utf-8")
    return HTMLResponse(html)


@router.get("/{run_id}/events/{event_index}/reactions")
def event_reactions(run_id: str, event_index: int, window: int = Query(15, ge=1, le=200)):
    """Reaction analysis for one event: who reacted, how, why (actual drivers),
    how the reaction spread over ticks, and second-order effects in the window."""
    h = _handle(run_id)
    sim = h.sim
    if event_index < 0 or event_index >= len(sim.events_log):
        raise HTTPException(404, f"event index {event_index} out of range "
                                 f"(run has {len(sim.events_log)} event records)")
    rec = sim.events_log[event_index]
    t0, t1 = rec.tick, rec.tick + window

    decisions = [d for d in sim.recent_decisions if t0 <= d["tick"] < t1]
    # the in-memory log is bounded; fall back to SQLite for older windows
    earliest = min((d["tick"] for d in sim.recent_decisions), default=None)
    if sim.recorder is not None and (earliest is None or earliest > t0):
        import json as _json

        sim.recorder.flush()
        rows = sim.recorder.conn.execute(
            "SELECT tick, actor_type, action, qty, drivers_json FROM decisions "
            "WHERE run_id=? AND tick>=? AND tick<?", (run_id, t0, t1)
        ).fetchall()
        decisions = [
            {
                "tick": r[0], "actor_type": r[1], "action": r[2], "qty": r[3],
                "explanation": {"main_drivers": _json.loads(r[4] or "[]")},
            }
            for r in rows
        ]
    by_type_action: dict[tuple[str, str], dict] = {}
    driver_stats: dict[str, dict] = {}
    per_tick: dict[int, int] = {}
    for d in decisions:
        key = (d["actor_type"], d["action"])
        slot = by_type_action.setdefault(key, {"count": 0, "qty": 0.0})
        slot["count"] += 1
        slot["qty"] += abs(d["qty"] or 0.0)
        per_tick[d["tick"]] = per_tick.get(d["tick"], 0) + 1
        for drv in (d["explanation"] or {}).get("main_drivers", []):
            ds = driver_stats.setdefault(drv["driver"], {"count": 0, "total": 0.0})
            ds["count"] += 1
            ds["total"] += drv["contribution"]

    price_moves = {}
    for aid in sim.market.assets:
        rows = [r for r in sim.asset_history if r["asset_id"] == aid]
        p_start = next((r["price"] for r in rows if r["tick"] >= t0), None)
        window_rows = [r for r in rows if t0 <= r["tick"] < t1]
        if p_start and window_rows:
            p_end = window_rows[-1]["price"]
            p_min = min(r["price"] for r in window_rows)
            price_moves[aid] = {
                "return": round(p_end / p_start - 1.0, 4),
                "trough_return": round(p_min / p_start - 1.0, 4),
            }

    mh = {m["tick"]: m for m in sim.metrics_history}
    pre = mh.get(max(t0 - 1, 0), {})
    end = mh.get(min(t1 - 1, sim.tick - 1), {})
    second_order = {
        "margin_calls_in_window": (end.get("margin_calls_total", 0) or 0) - (pre.get("margin_calls_total", 0) or 0),
        "bankruptcies_in_window": (end.get("bankruptcies_total", 0) or 0) - (pre.get("bankruptcies_total", 0) or 0),
        "defaults_in_window": (end.get("defaults_total", 0) or 0) - (pre.get("defaults_total", 0) or 0),
        "credit_tightness_change": round((end.get("credit_tightness", 0) or 0) - (pre.get("credit_tightness", 0) or 0), 4),
        "max_forced_volume_share": round(max(
            (m["forced_volume_share"] for m in sim.metrics_history if t0 <= m["tick"] < t1),
            default=0.0), 4),
        "systemic_risk_change": round((end.get("systemic_risk", 0) or 0) - (pre.get("systemic_risk", 0) or 0), 2),
    }

    top_drivers = sorted(driver_stats.items(), key=lambda kv: kv[1]["count"], reverse=True)[:12]
    return {
        "event": {"tick": rec.tick, "name": rec.name, "type": rec.event_type,
                  "magnitude": rec.magnitude, "phase": rec.phase},
        "window": [t0, t1],
        "n_decisions": len(decisions),
        "reactions_by_type": [
            {"actor_type": k[0], "action": k[1], "count": v["count"], "total_qty": round(v["qty"], 1)}
            for k, v in sorted(by_type_action.items(), key=lambda kv: kv[1]["count"], reverse=True)
        ],
        "top_drivers": [
            {"driver": name, "count": s["count"], "mean_contribution": round(s["total"] / s["count"], 4)}
            for name, s in top_drivers
        ],
        "reactions_per_tick": [{"tick": t, "count": per_tick[t]} for t in sorted(per_tick)],
        "price_moves": price_moves,
        "second_order": second_order,
        "note": "drivers are extracted from the logged decision computations; "
                "recent_decisions holds a bounded window — for long-past events use the decisions export",
    }
