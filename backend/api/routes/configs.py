"""Preset, scenario and event-type catalogs + saved user scenarios."""
from __future__ import annotations

import re
from pathlib import Path

import yaml
from fastapi import APIRouter, HTTPException

from api.schemas import SaveConfigRequest
from simcore.config.loader import config_from_dict, list_presets, preset_raw
from simcore.events.library import EVENT_HANDLERS
from simcore.events.scenarios import SCENARIOS
from simcore.models.config import SimConfig, default_actor_mix

router = APIRouter(prefix="/api", tags=["configs"])

SAVED_DIR = Path("../configs/saved")


def _slug(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
    return s or "scenario"


def load_saved(saved_id: str) -> SimConfig:
    path = SAVED_DIR / f"{saved_id}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"unknown saved scenario '{saved_id}'")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    data.pop("saved_name", None)
    data.pop("saved_description", None)
    return config_from_dict(data)


@router.get("/presets")
def presets():
    return list_presets()


@router.get("/presets/{preset_id}")
def preset(preset_id: str):
    try:
        return preset_raw(preset_id)
    except FileNotFoundError as e:
        raise HTTPException(404, str(e))


@router.get("/scenarios")
def scenarios():
    return [
        {
            "id": name,
            "events": [
                {"name": e.name, "type": e.event_type, "start_tick": e.start_tick,
                 "duration": e.duration, "magnitude": e.magnitude, "description": e.description}
                for e in evs
            ],
        }
        for name, evs in SCENARIOS.items()
    ]


@router.get("/event-types")
def event_types():
    return sorted(EVENT_HANDLERS.keys())


@router.get("/configs")
def list_saved():
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for p in sorted(SAVED_DIR.glob("*.yaml")):
        data = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
        out.append({
            "id": p.stem,
            "name": data.get("saved_name", p.stem),
            "description": data.get("saved_description", ""),
            "seed": data.get("seed"),
            "ticks": data.get("ticks"),
        })
    return out


@router.post("/configs")
def save_config(req: SaveConfigRequest):
    from api.schemas import build_config

    try:
        cfg = build_config(req)
    except (KeyError, FileNotFoundError, ValueError) as e:
        raise HTTPException(422, str(e))
    SAVED_DIR.mkdir(parents=True, exist_ok=True)
    saved_id = _slug(req.name)
    data = cfg.model_dump(mode="json")
    data["saved_name"] = req.name
    data["saved_description"] = req.description
    (SAVED_DIR / f"{saved_id}.yaml").write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True), encoding="utf-8")
    return {"id": saved_id, "name": req.name}


@router.get("/configs/{saved_id}")
def get_saved(saved_id: str):
    path = SAVED_DIR / f"{saved_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"unknown saved scenario '{saved_id}'")
    return yaml.safe_load(path.read_text(encoding="utf-8"))


@router.delete("/configs/{saved_id}")
def delete_saved(saved_id: str):
    path = SAVED_DIR / f"{saved_id}.yaml"
    if not path.exists():
        raise HTTPException(404, f"unknown saved scenario '{saved_id}'")
    path.unlink()
    return {"status": "deleted"}


@router.get("/defaults")
def defaults():
    cfg = SimConfig()
    return {
        "config": cfg.model_dump(),
        "actor_mix_300": {k: v.count for k, v in default_actor_mix(300).items()},
    }
