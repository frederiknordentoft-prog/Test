"""API request schemas and config assembly."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from simcore.config.loader import config_from_dict, load_preset
from simcore.events.scenarios import get_scenario
from simcore.models.config import EventConfig, SimConfig, default_actor_mix


class CreateRunRequest(BaseModel):
    preset_id: str | None = None
    saved_id: str | None = None            # a scenario saved via POST /api/configs
    config: dict[str, Any] | None = None   # full config dict (may include "scenario")
    label: str = ""
    seed: int | None = Field(None, ge=0)
    ticks: int | None = Field(None, ge=1, le=20000)
    tick_resolution: str | None = None
    n_actors: int | None = Field(None, ge=10, le=5000)
    actor_counts: dict[str, int] | None = None
    scenario: str | None = None
    events: list[dict[str, Any]] = Field(default_factory=list)
    domain: str | None = None  # "finance" | "gambling"; overrides the base config's
    gambling_overrides: dict[str, Any] | None = None  # merged onto the base gambling config


class CreateMonteCarloRequest(CreateRunRequest):
    n_seeds: int = Field(10, ge=1, le=500)
    base_seed: int = Field(1000, ge=0)


class SaveConfigRequest(CreateRunRequest):
    name: str
    description: str = ""


class StepRequest(BaseModel):
    n: int = 1


class SpeedRequest(BaseModel):
    tps: float = 20.0


def build_config(req: CreateRunRequest) -> SimConfig:
    if req.saved_id:
        from api.routes.configs import load_saved

        cfg = load_saved(req.saved_id)
    elif req.preset_id:
        cfg = load_preset(req.preset_id)
    elif req.config:
        cfg = config_from_dict(req.config)
    else:
        cfg = SimConfig()
    if req.domain is not None:
        cfg.sim_domain = req.domain  # type: ignore[assignment]
    # Actor-count overrides only apply to the finance population; the gambling
    # domain builds its own population from the ``gambling`` block.
    if cfg.sim_domain == "finance":
        if req.n_actors:
            cfg.actors = default_actor_mix(req.n_actors)
        if req.actor_counts:
            for k, v in req.actor_counts.items():
                if k in cfg.actors:
                    cfg.actors[k].count = int(v)
    if req.seed is not None:
        cfg.seed = req.seed
    if req.ticks is not None:
        cfg.ticks = req.ticks
    if req.tick_resolution is not None:
        cfg.tick_resolution = req.tick_resolution  # type: ignore[assignment]
    if req.scenario:
        cfg.events = list(cfg.events) + get_scenario(req.scenario)
    for e in req.events:
        cfg.events.append(EventConfig(**e))
    if cfg.sim_domain == "gambling":
        if req.gambling_overrides:
            cfg.gambling = {**(cfg.gambling or {}), **req.gambling_overrides}
        # Validate the gambling block now so a bad config surfaces as a 422 at
        # request time rather than an opaque error inside the sim thread.
        from pydantic import ValidationError

        from simcore.gambling.config import GamblingConfig

        try:
            GamblingConfig.model_validate(cfg.gambling or {})
        except ValidationError as e:
            raise ValueError(f"invalid gambling config: {e}") from e
    return cfg
