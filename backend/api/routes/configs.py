"""Preset, scenario and event-type catalogs for the frontend."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from simcore.config.loader import list_presets, preset_raw
from simcore.events.library import EVENT_HANDLERS
from simcore.events.scenarios import SCENARIOS
from simcore.models.config import SimConfig, default_actor_mix

router = APIRouter(prefix="/api", tags=["configs"])


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


@router.get("/defaults")
def defaults():
    cfg = SimConfig()
    return {
        "config": cfg.model_dump(),
        "actor_mix_300": {k: v.count for k, v in default_actor_mix(300).items()},
    }
