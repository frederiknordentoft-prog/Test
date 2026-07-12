"""Configuration schema for the gambling domain.

Mirrors the finance ``SimConfig`` pattern (Pydantic sub-models + a
``@model_validator`` for cross-field invariants). Kept in its own module so it
can import ``DistributionSpec`` from ``simcore.models.config`` without creating
an import cycle (models/config.py never imports this module).

Defaults are the 2024/25 Danish anchors from the research dossier (§12). They
are documented start-assumptions, not truth: there are no official operator
market shares and channelization is contested (72–92 %). Everything here is a
slider — see ``params.yaml`` for the source/uncertainty of each anchor.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

TrackId = Literal["lottery", "scratch", "casino", "sports"]


class CalendarConfig(BaseModel):
    """Sports calendar: a monthly 'sports intensity' curve that drives betting
    seasonality. The dossier is explicit that any model must have this feature —
    betting swings ±45 %/month year-on-year, while casino has no calendar and is
    the commercially stable leg."""

    enabled: bool = True
    amplitude: float = Field(0.45, ge=0.0, le=2.0)  # ±45 %/month per dossier
    # Relative month-of-year weights (Jan..Dec); normalized to mean 1.0 in use.
    monthly_pattern: list[float] = Field(
        default_factory=lambda: [
            0.95, 0.90, 1.00, 1.05, 1.10, 1.15, 0.85, 0.90, 1.15, 1.20, 1.10, 1.00
        ]
    )
    start_month: int = Field(1, ge=1, le=12)  # calendar month at tick 0
    tournament_ticks: list[int] = Field(default_factory=list)  # extra spikes (EM/VM/CL)
    tournament_boost: float = Field(0.30, ge=0.0, le=2.0)

    @model_validator(mode="after")
    def _check(self) -> "CalendarConfig":
        if len(self.monthly_pattern) != 12:
            raise ValueError("monthly_pattern must have exactly 12 entries")
        if min(self.monthly_pattern) <= 0:
            raise ValueError("monthly_pattern entries must be positive")
        return self


class TrackConfig(BaseModel):
    """One product track. ``annual_bsi`` is the gross gaming revenue anchor in
    bn DKK; ``competitive`` distinguishes the near-monopoly tracks (lottery,
    scratch) from the liberalized ones (casino, sports)."""

    track_id: TrackId
    name: str
    competitive: bool
    annual_bsi: float = Field(..., ge=0.0)         # bn DKK anchor (2024/25)
    tax_rate: float = Field(0.28, ge=0.0, le=1.0)  # 28 % on the liberalized segment
    seasonal: bool = False                          # sports uses the calendar
    growth_rate: float = Field(0.0, ge=-0.5, le=1.0)  # annual trend (fraction)


OperatorKind = Literal[
    "ds_monopoly",   # Danske Lotteri Spil — monopoly on lottery + scratch
    "ds_licensed",   # Danske Licens Spil — competition-exposed (casino + sports)
    "licensed",      # other licensed competitors (bet365, Unibet, Betano, long-tail)
    "offshore",      # unregulated — non-optional; the channelization leak
    "prediction",    # prediction markets — regulatory arbitrage; non-optional
]


class OperatorConfig(BaseModel):
    """An operator (or channel) in the attraction model. Attributes are in
    [0,1] and feed the players' multinomial-logit utility. ``tax_free`` marks
    whether a player's winnings are tax-free (a strong onshore driver — offshore
    and prediction lack it)."""

    operator_id: str
    name: str
    kind: OperatorKind
    tracks: list[TrackId]
    rtp: float = Field(0.55, ge=0.0, le=1.0)             # payout / return-to-player
    product_breadth: float = Field(0.5, ge=0.0, le=1.0)  # crash games etc.
    brand: float = Field(0.5, ge=0.0, le=1.0)
    marketing_reach: float = Field(0.5, ge=0.0, le=1.0)
    friction: float = Field(0.5, ge=0.0, le=1.0)         # MitID/KYC/withdrawal (higher = worse)
    protection: float = Field(0.5, ge=0.0, le=1.0)       # ROFUS/limits (plus for some, minus for others)
    tax_free: bool = True
    appeal: float = Field(0.0, ge=-5.0, le=5.0)          # static utility offset

    @property
    def licensed(self) -> bool:
        return self.kind in ("ds_monopoly", "ds_licensed", "licensed")

    @property
    def is_ds(self) -> bool:
        return self.kind in ("ds_monopoly", "ds_licensed")


DEFAULT_OPERATORS: list[dict] = [
    # Danske Spil split into two agents (perspective §2.2).
    {"operator_id": "ds_lotteri", "name": "Danske Lotteri Spil", "kind": "ds_monopoly",
     "tracks": ["lottery", "scratch"], "rtp": 0.50, "product_breadth": 0.50, "brand": 0.95,
     "marketing_reach": 0.70, "friction": 0.40, "protection": 0.85, "tax_free": True},
    {"operator_id": "ds_licens", "name": "Danske Licens Spil", "kind": "ds_licensed",
     "tracks": ["casino", "sports"], "rtp": 0.55, "product_breadth": 0.60, "brand": 0.90,
     "marketing_reach": 0.70, "friction": 0.50, "protection": 0.90, "tax_free": True},
    # Licensed competitors.
    {"operator_id": "bet365", "name": "bet365", "kind": "licensed",
     "tracks": ["sports", "casino"], "rtp": 0.60, "product_breadth": 0.70, "brand": 0.80,
     "marketing_reach": 0.60, "friction": 0.50, "protection": 0.70, "tax_free": True},
    {"operator_id": "unibet", "name": "Unibet (FDJ)", "kind": "licensed",
     "tracks": ["casino", "sports"], "rtp": 0.58, "product_breadth": 0.65, "brand": 0.72,
     "marketing_reach": 0.60, "friction": 0.50, "protection": 0.70, "tax_free": True},
    {"operator_id": "betano", "name": "Betano (Kaizen)", "kind": "licensed",
     "tracks": ["sports", "casino"], "rtp": 0.62, "product_breadth": 0.70, "brand": 0.58,
     "marketing_reach": 0.92, "friction": 0.50, "protection": 0.65, "tax_free": True},
    {"operator_id": "longtail", "name": "Øvrige licenshavere", "kind": "licensed",
     "tracks": ["casino", "sports"], "rtp": 0.57, "product_breadth": 0.55, "brand": 0.40,
     "marketing_reach": 0.40, "friction": 0.50, "protection": 0.60, "tax_free": True},
    # Non-optional unregulated channels.
    {"operator_id": "offshore", "name": "Offshore/ureguleret", "kind": "offshore",
     "tracks": ["lottery", "scratch", "casino", "sports"], "rtp": 0.75, "product_breadth": 0.95,
     "brand": 0.35, "marketing_reach": 0.50, "friction": 0.20, "protection": 0.10, "tax_free": False},
    {"operator_id": "prediction", "name": "Prediction markets", "kind": "prediction",
     "tracks": ["sports"], "rtp": 0.70, "product_breadth": 0.60, "brand": 0.50,
     "marketing_reach": 0.60, "friction": 0.25, "protection": 0.20, "tax_free": False},
]


def default_operators() -> list[OperatorConfig]:
    return [OperatorConfig(**o) for o in DEFAULT_OPERATORS]


DEFAULT_TRACKS: list[dict] = [
    {"track_id": "lottery", "name": "Lotterier", "competitive": False,
     "annual_bsi": 2.0, "tax_rate": 0.0, "seasonal": False},
    {"track_id": "scratch", "name": "Skrabelodder", "competitive": False,
     "annual_bsi": 1.0, "tax_rate": 0.0, "seasonal": False},
    {"track_id": "casino", "name": "Online casino", "competitive": True,
     "annual_bsi": 3.5, "tax_rate": 0.28, "seasonal": False},
    {"track_id": "sports", "name": "Sportsbetting", "competitive": True,
     "annual_bsi": 2.21, "tax_rate": 0.28, "seasonal": True},
]


def default_tracks() -> list[TrackConfig]:
    return [TrackConfig(**t) for t in DEFAULT_TRACKS]


class GamblingConfig(BaseModel):
    """Top-level gambling-domain config. Etape 0 uses tracks + calendar to
    reproduce the baseline market sizes; later etaper add population, operators,
    AI diffusion, entry and the stakeholder loops on top."""

    tracks: list[TrackConfig] = Field(default_factory=default_tracks)
    operators: list[OperatorConfig] = Field(default_factory=default_operators)
    calendar: CalendarConfig = Field(default_factory=CalendarConfig)

    # Multinomial-logit temperature: higher spreads choice out (less winner-take-all).
    logit_temperature: float = Field(1.0, ge=0.1, le=10.0)
    # Baseline channelization on the monopoly tracks (DS licensed share); the
    # competitive tracks calibrate to channelization_start.
    monopoly_channelization: float = Field(0.95, ge=0.0, le=1.0)

    # Channelization is contested — treated as an interval, not a point. Only
    # conclusions robust across [low, high] should be reported (dossier fælde 2).
    channelization_start: float = Field(0.82, ge=0.0, le=1.0)
    channelization_low: float = Field(0.72, ge=0.0, le=1.0)
    channelization_high: float = Field(0.92, ge=0.0, le=1.0)

    population: int = Field(500, ge=50, le=20000)   # player agents
    baseline_noise: float = Field(0.0, ge=0.0, le=0.5)  # monthly lognormal noise on BSI

    # --- population shape (Etape 1) ------------------------------------- #
    # Number of real active gamblers the agent population represents (for
    # scaling agent counts to customer numbers). No hard DK anchor exists.
    represented_customers: int = Field(2_500_000, ge=1000)
    # Heavy-tailed monthly spend: lognormal sigma is the income-concentration
    # knob (higher => a smaller share of players make up more of the BSI). This
    # is the single most important / most uncertain lever (perspective §2.1) and
    # must be swept in sensitivity analysis — see params.yaml.
    spend_sigma: float = Field(1.10, ge=0.10, le=3.00)
    # Minimum per-track preference weight for a player to count as a customer of
    # that track.
    participation_threshold: float = Field(0.05, ge=0.0, le=1.0)
    male_fraction: float = Field(0.62, ge=0.0, le=1.0)   # online accounts skew male
    young_age_threshold: int = Field(25, ge=18, le=40)

    @model_validator(mode="after")
    def _check(self) -> "GamblingConfig":
        if not self.tracks:
            raise ValueError("at least one track is required")
        ids = [t.track_id for t in self.tracks]
        if len(set(ids)) != len(ids):
            raise ValueError(f"duplicate track_id in {ids}")
        if not (self.channelization_low <= self.channelization_start <= self.channelization_high):
            raise ValueError(
                "channelization_start must lie within [channelization_low, channelization_high]"
            )
        if self.channelization_low > self.channelization_high:
            raise ValueError("channelization_low must be <= channelization_high")
        track_ids = set(ids)
        op_ids = [o.operator_id for o in self.operators]
        if len(set(op_ids)) != len(op_ids):
            raise ValueError(f"duplicate operator_id in {op_ids}")
        for o in self.operators:
            bad = [t for t in o.tracks if t not in track_ids]
            if bad:
                raise ValueError(f"operator {o.operator_id} references unknown track(s) {bad}")
        return self

    def operators_for(self, track_id: str) -> list[OperatorConfig]:
        return [o for o in self.operators if track_id in o.tracks]

    def track(self, track_id: str) -> TrackConfig:
        for t in self.tracks:
            if t.track_id == track_id:
                return t
        raise KeyError(track_id)
