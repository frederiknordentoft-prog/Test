"""Load the committed calibration data (real, sourced figures) into pandas.

Three CSVs sit next to this module, each row carrying its own source + a
confidence flag (green/yellow/red) so nothing is used blind:
- ``historical.csv``   — Danish annual series (GGR per vertical, channelization,
                          ROFUS, prevalence, Danske Spil financials, enforcement).
- ``concentration.csv``— income/spend concentration (UK Patterns of Play + Finland).
- ``experiments.csv``  — natural-experiment targets (Sweden re-regulation, Betano
                          entry, DK operator shares, PGSI transitions, elasticities).

See ``data_manifest.md`` for provenance, the 2024/2025 methodology break, and the
honest list of what could NOT be obtained (the clean monthly 2012→now series lives
behind Spillemyndigheden's PowerBI/Excel, which is not machine-fetchable here).
"""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

_DIR = Path(__file__).parent


@lru_cache(maxsize=8)
def _load(name: str) -> pd.DataFrame:
    return pd.read_csv(_DIR / name, encoding="utf-8")


def historical() -> pd.DataFrame:
    return _load("historical.csv").copy()


def concentration() -> pd.DataFrame:
    return _load("concentration.csv").copy()


def experiments() -> pd.DataFrame:
    return _load("experiments.csv").copy()


def series(series_id: str) -> tuple[list[int], list[float]]:
    """Return (years, values) for one historical series, sorted by year."""
    df = historical()
    rows = df[df["series_id"] == series_id].sort_values("year")
    if rows.empty:
        raise KeyError(f"unknown series_id '{series_id}'")
    return rows["year"].astype(int).tolist(), rows["value"].astype(float).tolist()


def experiment_value(experiment: str, metric: str) -> float:
    df = experiments()
    row = df[(df["experiment"] == experiment) & (df["metric"] == metric)]
    if row.empty:
        raise KeyError(f"no experiment value for {experiment}/{metric}")
    return float(row.iloc[0]["value"])


def concentration_target(vertical: str, percentile: str, study: str = "patterns_of_play") -> float:
    df = concentration()
    row = df[(df["study"] == study) & (df["vertical"] == vertical)
             & (df["percentile"] == percentile)]
    if row.empty:
        raise KeyError(f"no concentration target for {study}/{vertical}/{percentile}")
    return float(row.iloc[0]["share"])
