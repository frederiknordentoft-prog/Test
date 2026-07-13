"""Config loading: YAML/JSON files, named presets, scenario merging."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml

from simcore.events.scenarios import get_scenario
from simcore.models.config import EventConfig, SimConfig

PRESET_DIR = Path(__file__).parent / "presets"


def config_from_dict(data: dict[str, Any]) -> SimConfig:
    """Build a SimConfig; a top-level ``scenario`` name expands into events
    (appended to any explicitly configured events)."""
    data = dict(data)
    scenario = data.pop("scenario", None)
    cfg = SimConfig(**data)
    if scenario:
        cfg.events = list(cfg.events) + get_scenario(scenario)
        cfg.description = (cfg.description + f" [scenario: {scenario}]").strip()
    return cfg


def load_config(path: str | Path) -> SimConfig:
    path = Path(path)
    text = path.read_text(encoding="utf-8")
    data = yaml.safe_load(text) if path.suffix in (".yaml", ".yml") else json.loads(text)
    return config_from_dict(data)


def list_presets() -> list[dict[str, str]]:
    out = []
    for p in sorted(PRESET_DIR.glob("*.yaml")):
        data = yaml.safe_load(p.read_text(encoding="utf-8"))
        out.append(
            {
                "id": p.stem,
                "name": data.get("name", p.stem),
                "description": data.get("description", ""),
                "domain": data.get("sim_domain", "finance"),
            }
        )
    return out


def load_preset(preset_id: str) -> SimConfig:
    path = PRESET_DIR / f"{preset_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"unknown preset '{preset_id}'")
    return load_config(path)


def preset_raw(preset_id: str) -> dict[str, Any]:
    path = PRESET_DIR / f"{preset_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"unknown preset '{preset_id}'")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


def event_from_dict(data: dict[str, Any]) -> EventConfig:
    return EventConfig(**data)
