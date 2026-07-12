"""Export: SQLite -> pandas -> CSV / JSON files per run."""
from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import pandas as pd


TABLES = ["asset_ticks", "metrics", "actor_snapshots", "trades", "decisions", "events", "population"]


def export_run(conn: sqlite3.Connection, run_id: str, out_dir: str | Path,
               fmt: str = "csv") -> list[str]:
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    written: list[str] = []

    run_row = pd.read_sql_query("SELECT * FROM runs WHERE run_id=?", conn, params=(run_id,))
    if run_row.empty:
        raise KeyError(f"unknown run '{run_id}'")

    config_path = out / f"{run_id}_config.json"
    config_path.write_text(json.dumps(json.loads(run_row.iloc[0]["config_json"]), indent=2))
    written.append(str(config_path))

    for table in TABLES:
        df = pd.read_sql_query(f"SELECT * FROM {table} WHERE run_id=?", conn, params=(run_id,))
        if df.empty:
            continue
        if table == "metrics":
            df = df.pivot_table(index="tick", columns="name", values="value").reset_index()
        if fmt == "json":
            path = out / f"{run_id}_{table}.json"
            df.to_json(path, orient="records")
        elif fmt == "parquet":
            try:
                import pyarrow  # noqa: F401
            except ImportError as e:
                raise RuntimeError(
                    "parquet export requires pyarrow — install with: pip install pyarrow"
                ) from e
            path = out / f"{run_id}_{table}.parquet"
            df.to_parquet(path, index=False)
        else:
            path = out / f"{run_id}_{table}.csv"
            df.to_csv(path, index=False)
        written.append(str(path))
    return written
