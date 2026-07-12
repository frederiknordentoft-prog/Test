"""Parameter register loader.

Loads ``params.yaml`` — the source-annotated companion to the presets. The
register is a first-class artifact (perspective §7, fælde 3): it exposes each
calibration parameter's value, source, confidence and whether it must be swept
in sensitivity analysis. Later etaper use ``sensitivity_params()`` to drive
Monte Carlo sensitivity and the robustness report.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml

PARAMS_PATH = Path(__file__).parent / "params.yaml"


@dataclass(slots=True)
class Param:
    name: str
    value: Any
    unit: str
    source: str
    confidence: str          # green | yellow | red
    sensitivity: bool
    note: str = ""
    interval: list[float] | None = None


def load_register(path: str | Path | None = None) -> dict[str, Any]:
    """Return the full register: {'meta': {...}, 'parameters': [Param, ...]}."""
    data = yaml.safe_load(Path(path or PARAMS_PATH).read_text()) or {}
    params = [
        Param(
            name=p["name"],
            value=p.get("value"),
            unit=p.get("unit", ""),
            source=p.get("source", ""),
            confidence=p.get("confidence", "yellow"),
            sensitivity=bool(p.get("sensitivity", False)),
            note=p.get("note", ""),
            interval=p.get("interval"),
        )
        for p in data.get("parameters", [])
    ]
    return {"meta": data.get("meta", {}), "parameters": params}


def load_params(path: str | Path | None = None) -> list[Param]:
    return load_register(path)["parameters"]


def sensitivity_params(path: str | Path | None = None) -> list[Param]:
    """Parameters that must be varied in sensitivity analysis."""
    return [p for p in load_params(path) if p.sensitivity]


def param_table(path: str | Path | None = None) -> list[dict[str, Any]]:
    """Register as plain dicts (for API/report rendering)."""
    return [
        {
            "name": p.name, "value": p.value, "unit": p.unit, "source": p.source,
            "confidence": p.confidence, "sensitivity": p.sensitivity,
            "interval": p.interval, "note": p.note,
        }
        for p in load_params(path)
    ]
