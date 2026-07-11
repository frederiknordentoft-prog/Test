"""SQLite persistence: schema DDL and connection helpers. Plain sqlite3 with
WAL; the hot write path batches through the Recorder."""
from __future__ import annotations

import sqlite3
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs(
    run_id TEXT PRIMARY KEY, label TEXT, created_at TEXT, seed INTEGER,
    status TEXT, tick_count INTEGER, ticks_target INTEGER,
    tick_resolution TEXT, config_json TEXT);
CREATE TABLE IF NOT EXISTS asset_ticks(
    run_id TEXT, tick INTEGER, asset_id TEXT, price REAL, fundamental REAL,
    volume REAL, volatility REAL, spread REAL,
    PRIMARY KEY(run_id, tick, asset_id)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS metrics(
    run_id TEXT, tick INTEGER, name TEXT, value REAL,
    PRIMARY KEY(run_id, tick, name)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS actor_snapshots(
    run_id TEXT, tick INTEGER, actor_id INTEGER, wealth REAL, cash REAL,
    leverage REAL, sentiment REAL, stress REAL, alive INTEGER,
    positions_json TEXT,
    PRIMARY KEY(run_id, tick, actor_id)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS trades(
    run_id TEXT, tick INTEGER, actor_id INTEGER, asset_id TEXT,
    side TEXT, qty REAL, price REAL, forced INTEGER);
CREATE TABLE IF NOT EXISTS decisions(
    run_id TEXT, tick INTEGER, actor_id INTEGER, actor_type TEXT, model TEXT,
    action TEXT, asset_id TEXT, qty REAL, probability REAL, stress REAL,
    score REAL, drivers_json TEXT);
CREATE TABLE IF NOT EXISTS events(
    run_id TEXT, tick INTEGER, name TEXT, event_type TEXT,
    magnitude REAL, phase TEXT, payload_json TEXT);
CREATE TABLE IF NOT EXISTS population(
    run_id TEXT, actor_id INTEGER, actor_type TEXT, name TEXT, model TEXT,
    traits_json TEXT, initial_wealth REAL,
    PRIMARY KEY(run_id, actor_id)) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS mc_batches(
    mc_id TEXT PRIMARY KEY, label TEXT, created_at TEXT, status TEXT,
    n_seeds INTEGER, config_json TEXT, summary_json TEXT);
CREATE TABLE IF NOT EXISTS mc_members(
    mc_id TEXT, run_id TEXT, seed INTEGER, summary_json TEXT,
    PRIMARY KEY(mc_id, run_id)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_trades_run_tick ON trades(run_id, tick);
CREATE INDEX IF NOT EXISTS idx_decisions_run_tick ON decisions(run_id, tick);
CREATE INDEX IF NOT EXISTS idx_decisions_run_actor ON decisions(run_id, actor_id);
"""


def connect(db_path: str | Path) -> sqlite3.Connection:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.executescript(SCHEMA)
    return conn
