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
    # Dotted path into the GamblingConfig dict this parameter controls
    # (e.g. "spend_sigma", "calendar.amplitude"). Set on every sweepable
    # parameter so Morris screening can drive the model from the register.
    config_field: str | None = None


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
            config_field=p.get("config_field"),
        )
        for p in data.get("parameters", [])
    ]
    return {"meta": data.get("meta", {}), "parameters": params}


def screening_params(path: str | Path | None = None) -> list[Param]:
    """Sensitivity-flagged parameters that are wired to a config field and have
    an interval — the input set for Morris screening."""
    return [p for p in sensitivity_params(path)
            if p.config_field and p.interval and len(p.interval) == 2]


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
            "interval": p.interval, "note": p.note, "config_field": p.config_field,
        }
        for p in load_params(path)
    ]
