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

from pydantic import AliasChoices, BaseModel, Field, model_validator

TrackId = Literal["lottery", "scratch", "casino", "sports"]


class CalendarConfig(BaseModel):
    """Sports calendar: a monthly 'sports intensity' curve that drives betting
    seasonality. The dossier is explicit that any model must have this feature.
    The within-year pattern gives the league rhythm; ``tournament_ticks``
    (EM/VM summers, typically every other year) give the *between-year*
    variation that produces the observed −46 %..+14 % YoY swings — a repeating
    12-month pattern alone produces 0 % YoY by construction. Casino has no
    calendar and is the commercially stable leg."""

    enabled: bool = True
    amplitude: float = Field(1.0, ge=0.0, le=2.0)   # 1.0 = raw monthly pattern
    # Relative month-of-year weights (Jan..Dec); normalized to mean 1.0 in use.
    monthly_pattern: list[float] = Field(
        default_factory=lambda: [
            0.95, 0.90, 1.00, 1.05, 1.10, 1.15, 0.85, 0.90, 1.15, 1.20, 1.10, 1.00
        ]
    )
    start_month: int = Field(1, ge=1, le=12)  # calendar month at tick 0
    tournament_ticks: list[int] = Field(default_factory=list)  # EM/VM summer months (ticks)
    tournament_boost: float = Field(0.60, ge=0.0, le=2.0)

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
    # Perceived payout generosity in [0,1] — a *ranking* attribute, not an RTP
    # percentage (a critic flagged 0.55 labelled "rtp" as a credibility hit;
    # real casino RTPs sit at ~95-97 %). Accepts the legacy "rtp" key.
    payout: float = Field(0.55, ge=0.0, le=1.0,
                          validation_alias=AliasChoices("payout", "rtp"))
    product_breadth: float = Field(0.5, ge=0.0, le=1.0)  # crash games etc.
    bonus: float = Field(0.5, ge=0.0, le=1.0)            # acquisition/retention bonus intensity (β3)
    brand: float = Field(0.5, ge=0.0, le=1.0)
    marketing_reach: float = Field(0.5, ge=0.0, le=1.0)
    friction: float = Field(0.5, ge=0.0, le=1.0)         # MitID/KYC/withdrawal (higher = worse)
    protection: float = Field(0.5, ge=0.0, le=1.0)       # ROFUS/limits (plus for some, minus for others)
    tax_free: bool = True
    appeal: float = Field(0.0, ge=-5.0, le=5.0)          # static utility offset
    # How hard the operator plays its commercial levers (budget reallocation
    # when channels close, burn rate). Betano-type challengers sit high.
    aggressiveness: float = Field(0.5, ge=0.0, le=1.0)
    # AI diffusion (Etape 3): starting capability and adoption speed toward the
    # frontier. Early adopters (higher adoption) gain a temporary, decaying edge.
    ai_cap0: float = Field(0.10, ge=0.0, le=1.0)
    ai_adoption: float = Field(0.08, ge=0.0, le=1.0)

    @property
    def licensed(self) -> bool:
        return self.kind in ("ds_monopoly", "ds_licensed", "licensed")

    @property
    def is_ds(self) -> bool:
        return self.kind in ("ds_monopoly", "ds_licensed")


DEFAULT_OPERATORS: list[dict] = [
    # Danske Spil split into two agents (perspective §2.2).
    {"operator_id": "ds_lotteri", "name": "Danske Lotteri Spil", "kind": "ds_monopoly",
     "tracks": ["lottery", "scratch"], "payout": 0.50, "product_breadth": 0.50, "bonus": 0.10,
     "brand": 0.95, "marketing_reach": 0.70, "friction": 0.40, "protection": 0.85, "tax_free": True},
    # appeal 0.65 calibrates DS's competitive share so total DS BSI hits the
    # green 5.16 bn/yr anchor (Danske Spil annual report 2025) — DS is the
    # largest licensed operator; the generic attrs alone understated it (~14 %
    # of the competitive segment vs the ~39 % the anchor implies).
    {"operator_id": "ds_licens", "name": "Danske Licens Spil", "kind": "ds_licensed",
     "tracks": ["casino", "sports"], "payout": 0.55, "product_breadth": 0.60, "bonus": 0.35,
     "brand": 0.90, "marketing_reach": 0.70, "friction": 0.50, "protection": 0.90,
     "tax_free": True, "appeal": 0.65},
    # Licensed competitors.
    {"operator_id": "bet365", "name": "bet365", "kind": "licensed",
     "tracks": ["sports", "casino"], "payout": 0.60, "product_breadth": 0.70, "bonus": 0.60,
     "brand": 0.80, "marketing_reach": 0.60, "friction": 0.50, "protection": 0.70, "tax_free": True},
    {"operator_id": "unibet", "name": "Unibet (FDJ)", "kind": "licensed",
     "tracks": ["casino", "sports"], "payout": 0.58, "product_breadth": 0.65, "bonus": 0.60,
     "brand": 0.72, "marketing_reach": 0.60, "friction": 0.50, "protection": 0.70, "tax_free": True},
    {"operator_id": "betano", "name": "Betano (Kaizen)", "kind": "licensed",
     "tracks": ["sports", "casino"], "payout": 0.62, "product_breadth": 0.70, "bonus": 0.90,
     "brand": 0.58, "marketing_reach": 0.92, "friction": 0.50, "protection": 0.65,
     "tax_free": True, "aggressiveness": 0.92},
    {"operator_id": "longtail", "name": "Øvrige licenshavere", "kind": "licensed",
     "tracks": ["casino", "sports"], "payout": 0.57, "product_breadth": 0.55, "bonus": 0.50,
     "brand": 0.40, "marketing_reach": 0.40, "friction": 0.50, "protection": 0.60, "tax_free": True},
    # Non-optional unregulated channels.
    {"operator_id": "offshore", "name": "Offshore/ureguleret", "kind": "offshore",
     "tracks": ["lottery", "scratch", "casino", "sports"], "payout": 0.75, "product_breadth": 0.95,
     "bonus": 0.95, "brand": 0.35, "marketing_reach": 0.50, "friction": 0.20, "protection": 0.10,
     "tax_free": False},
    # Prediction markets start at ≈0 share (appeal −2.5): they are a *structural
    # discontinuity* that arrives via fintech-app distribution when the
    # loophole opens (a prediction_surge event), not a smoothly-grown incumbent.
    {"operator_id": "prediction", "name": "Prediction markets", "kind": "prediction",
     "tracks": ["sports"], "payout": 0.70, "product_breadth": 0.60, "bonus": 0.30, "brand": 0.50,
     "marketing_reach": 0.60, "friction": 0.25, "protection": 0.20, "tax_free": False,
     "appeal": -2.5},
]


def default_operators() -> list[OperatorConfig]:
    return [OperatorConfig(**o) for o in DEFAULT_OPERATORS]


class EntrantConfig(OperatorConfig):
    """A potential entrant: an operator spec plus entry economics. Enters when
    expected NPV clears the barrier and the AI frontier passes ``min_frontier``
    (big-tech is gated high). ``consolidator`` acquires the weakest incumbent
    instead of launching greenfield."""

    entry_cost: float = Field(200.0, ge=0.0)     # one-off, mio DKK
    entry_barrier: float = Field(0.0, ge=0.0)    # extra NPV hurdle (regulatory/other)
    min_frontier: float = Field(0.0, ge=0.0, le=1.0)  # AI-frontier gate
    consolidator: bool = False                   # M&A instead of greenfield


DEFAULT_ENTRANTS: list[dict] = [
    {"operator_id": "ai_casino", "name": "AI-native casino", "kind": "licensed",
     "tracks": ["casino"], "payout": 0.64, "product_breadth": 0.85, "bonus": 0.70, "brand": 0.35,
     "marketing_reach": 0.70, "friction": 0.45, "protection": 0.55, "tax_free": True,
     "ai_cap0": 0.55, "ai_adoption": 0.20, "entry_cost": 180.0, "min_frontier": 0.40},
    {"operator_id": "ai_sportsbook", "name": "AI-native sportsbook", "kind": "licensed",
     "tracks": ["sports", "casino"], "payout": 0.63, "product_breadth": 0.72, "bonus": 0.75,
     "brand": 0.35, "marketing_reach": 0.90, "friction": 0.45, "protection": 0.55, "tax_free": True,
     "ai_cap0": 0.50, "ai_adoption": 0.22, "entry_cost": 160.0, "min_frontier": 0.35},
    {"operator_id": "bigtech", "name": "Big-tech super-app", "kind": "licensed",
     "tracks": ["casino", "sports"], "payout": 0.62, "product_breadth": 0.80, "bonus": 0.50,
     "brand": 0.85, "marketing_reach": 0.95, "friction": 0.30, "protection": 0.60, "tax_free": True,
     "ai_cap0": 0.80, "ai_adoption": 0.25, "entry_cost": 600.0, "entry_barrier": 400.0,
     "min_frontier": 0.70},
    {"operator_id": "crypto_casino", "name": "Crypto-casino", "kind": "offshore",
     "tracks": ["casino"], "payout": 0.82, "product_breadth": 0.98, "bonus": 0.95, "brand": 0.30,
     "marketing_reach": 0.55, "friction": 0.15, "protection": 0.05, "tax_free": False,
     "ai_cap0": 0.45, "ai_adoption": 0.20, "entry_cost": 60.0, "min_frontier": 0.35},
    # Consolidator pays the acquisition price (multiple × target profit);
    # entry_cost here is deal/transaction cost only. min_frontier keeps the
    # consolidation wave a mid-horizon phenomenon, not a day-one buyout.
    {"operator_id": "consolidator", "name": "Konsolidator (Allwyn/FDJ-type)", "kind": "licensed",
     "tracks": ["casino", "sports"], "payout": 0.60, "product_breadth": 0.68, "bonus": 0.60,
     "brand": 0.80, "marketing_reach": 0.80, "friction": 0.48, "protection": 0.68, "tax_free": True,
     "ai_cap0": 0.30, "ai_adoption": 0.12, "entry_cost": 100.0, "min_frontier": 0.35,
     "consolidator": True},
    # Sponsorship-led aggressive challenger (the Betano playbook, next wave):
    # enters on market economics alone — NO AI gate (critic finding: the pool
    # only held AI/big-tech archetypes, so a Betano-style entry couldn't occur).
    {"operator_id": "challenger", "name": "Aggressiv udfordrer (sponsorat-drevet)",
     "kind": "licensed", "tracks": ["sports", "casino"], "payout": 0.62,
     "product_breadth": 0.65, "bonus": 0.95, "brand": 0.45, "marketing_reach": 0.95,
     "friction": 0.50, "protection": 0.62, "tax_free": True, "aggressiveness": 0.95,
     "ai_cap0": 0.15, "ai_adoption": 0.10, "entry_cost": 260.0, "min_frontier": 0.0},
]


def default_entrants() -> list[EntrantConfig]:
    return [EntrantConfig(**e) for e in DEFAULT_ENTRANTS]


DEFAULT_TRACKS: list[dict] = [
    # growth_rate is the dossier's observed annual trend: casino is the growth
    # engine (+14.7 %), sports is near-flat (+1.2 %), the monopoly block has
    # been flat since 2012.
    # Monopoly tax_rate 0.15 approximates the 15 % gevinstafgift (winnings tax)
    # on the lottery block: with lottery payout ≈ 50 %, winnings ≈ BSI, so the
    # state's take ≈ 15 % of BSI. Ignoring it understated the monopoly's fiscal
    # contribution in liberalization scenarios (critic finding).
    {"track_id": "lottery", "name": "Lotterier", "competitive": False,
     "annual_bsi": 2.0, "tax_rate": 0.15, "seasonal": False, "growth_rate": 0.0},
    {"track_id": "scratch", "name": "Skrabelodder", "competitive": False,
     "annual_bsi": 1.0, "tax_rate": 0.15, "seasonal": False, "growth_rate": 0.0},
    {"track_id": "casino", "name": "Online casino", "competitive": True,
     "annual_bsi": 3.5, "tax_rate": 0.28, "seasonal": False, "growth_rate": 0.147},
    {"track_id": "sports", "name": "Sportsbetting", "competitive": True,
     "annual_bsi": 2.21, "tax_rate": 0.28, "seasonal": True, "growth_rate": 0.012},
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

    # --- outside option ("spiller ikke") --------------------------------- #
    # Every track's choice set includes a no-play alternative, so total demand
    # is elastic: tightening can shrink the market, not only re-route it.
    # ``participation_start`` is the baseline share of track-engaged budget that
    # is actually wagered (calibrated jointly with the unlicensed delta);
    # ``outside_risk_beta`` makes the outside option most attractive to low-risk
    # players — the breadth exits, the tail keeps playing (and leaks offshore).
    participation_start: float = Field(0.80, ge=0.05, le=0.99)
    outside_risk_beta: float = Field(2.0, ge=0.0, le=10.0)

    # --- heavy-tail ↔ behaviour coupling --------------------------------- #
    # Spend is drawn with a risk-dependent location, so the top spenders are
    # disproportionately high-risk (the tail that is friction-tolerant and
    # offshore-prone). ``offshore_affinity_beta`` scales how strongly a player's
    # offshore-propensity axis shifts utility toward unlicensed alternatives.
    risk_spend_coupling: float = Field(3.0, ge=0.0, le=8.0)
    offshore_affinity_beta: float = Field(2.0, ge=0.0, le=10.0)

    # --- policy → attribute pass-through --------------------------------- #
    # Policy levers act on operator *attributes* (mediated by per-segment betas)
    # instead of uniform utility constants, so heterogeneous responses emerge.
    # DNS/payment enforcement raises *offshore* friction only — prediction
    # markets are regulated as financial derivatives distributed via fintech
    # apps and cannot be blocked on the same legal basis (dossier §10.1).
    rtp_tax_passthrough: float = Field(0.5, ge=0.0, le=1.0)   # tax_add -> licensed rtp down
    enforcement_friction: float = Field(0.6, ge=0.0, le=3.0)  # enforcement -> offshore friction up
    limits_protection_gain: float = Field(0.5, ge=0.0, le=2.0)  # loss limits -> licensed protection up
    rg_friction_gain: float = Field(0.5, ge=0.0, le=2.0)      # rg_friction -> licensed friction up

    # --- nested logit (IIA fix) ------------------------------------------ #
    # Dissimilarity parameters for the licensed / unlicensed nests (outside is
    # its own single-alternative nest). λ = 1 degrades to plain MNL; λ < 1 makes
    # substitution happen mostly within the nest, so a licensed entrant competes
    # primarily with licensed incumbents instead of mechanically raising
    # channelization by draining offshore proportionally.
    nest_lambda_licensed: float = Field(0.5, ge=0.05, le=1.0)
    nest_lambda_unlicensed: float = Field(0.5, ge=0.05, le=1.0)

    # --- ROFUS (self-exclusion, near-absorbing) --------------------------- #
    # High-risk players playing licensed can self-exclude (or be nudged by
    # AI-based RG detection). ROFUS blocks *licensed* play only — the excluded
    # can still leak offshore, which is exactly the displacement the harm
    # accounting must be able to show.
    rofus_enabled: bool = True
    # Monthly hazard scale: hazard_i = rate · risk_i² · licensed-play_i. For the
    # escalated tail (risk ≈ 0.7+) that is ~0.3 %/month — a stock of the order
    # of the real 60k register builds over a few simulated years.
    rofus_base_rate: float = Field(0.01, ge=0.0, le=0.2)
    rofus_detection_gain: float = Field(2.0, ge=0.0, le=10.0)  # rg_detection multiplier
    rofus_exit_rate: float = Field(0.005, ge=0.0, le=0.5)    # near-absorbing
    rofus_penalty: float = Field(6.0, ge=0.0, le=20.0)       # licensed-utility block

    # --- AI diffusion + entry (Etape 3) --------------------------------- #
    ai_enabled: bool = True
    entry_enabled: bool = True
    ai_frontier_start: float = Field(0.20, ge=0.0, le=1.0)
    ai_frontier_growth: float = Field(0.010, ge=0.0, le=0.5)   # per-tick drift toward 1.0
    # Additive frontier jumps ("wild AI") — [{"tick": int, "size": float}, ...].
    ai_shocks: list[dict] = Field(default_factory=list)
    ai_personalization_gain: float = Field(2.0, ge=0.0, le=10.0)  # AI cap -> choice utility
    # Best AI cap beyond baseline -> extra market-size growth. Kept small: the
    # observed baseline trend is carried by TrackConfig.growth_rate; this is the
    # *residual* AI-driven engagement channel on top.
    ai_engagement_gain: float = Field(0.15, ge=0.0, le=3.0)
    ai_bigtech_threshold: float = Field(0.70, ge=0.0, le=1.0)  # frontier gate for big-tech entry

    entrants: list[EntrantConfig] = Field(default_factory=default_entrants)
    entry_eval_period: int = Field(3, ge=1)          # evaluate entry every N ticks
    entry_profit_margin: float = Field(0.25, ge=0.0, le=1.0)   # profit as share of BSI
    entry_horizon_months: int = Field(36, ge=1)      # NPV horizon
    entry_discount_annual: float = Field(0.10, ge=0.0, le=1.0)  # NPV discount rate
    entry_go_prob: float = Field(0.6, ge=0.0, le=1.0)  # execution risk given positive NPV
    # M&A: price as a multiple of the target's annual profit ("podium strategy" —
    # acquirers buy strong local brands, valued on earnings, not the cheapest).
    acquisition_multiple: float = Field(2.0, ge=0.0, le=20.0)
    survival_share: float = Field(0.015, ge=0.0, le=1.0)       # exit below this share
    survival_periods: int = Field(6, ge=1)           # ...for this many consecutive ticks

    # --- endogenous operator behaviour ------------------------------------ #
    # Each licensed operator reallocates its commercial budget across channels
    # {marketing, bonus, brand, product} every tick. At baseline (all channels
    # open) attributes rest at their archetype anchors; when regulation closes a
    # channel, the freed budget flows to the open ones (the Klub Lotto / §10.5
    # pattern) at reduced efficiency.
    operators_enabled: bool = True
    op_adjust_rate: float = Field(0.08, ge=0.0, le=1.0)         # attr drift speed per tick
    op_realloc_substitutability: float = Field(0.6, ge=0.0, le=1.0)  # closed→open efficiency

    # --- stakeholders + the four loops (Etape 4) ------------------------ #
    stakeholders_enabled: bool = True
    # Harm: offshore play is more harmful (no ROFUS/limits); limits and AI-based
    # RG detection reduce licensed harm. The gap between true and measured harm
    # is the channelization false positive (loop 1).
    offshore_harm_coeff: float = Field(2.2, ge=1.0, le=6.0)
    # Scales the player-level harm index to ~0-100. Harm is spend-weighted per
    # player; with the risk↔spend coupling the spend-weighted risk sits well
    # above the population mean, hence the lower scale than the old aggregate.
    harm_scale: float = Field(15.0, ge=0.0, le=200.0)
    loss_limit_harm_reduction: float = Field(0.50, ge=0.0, le=1.0)
    rg_detection_harm_reduction: float = Field(0.40, ge=0.0, le=1.0)
    # Regulator (Spillemyndigheden): reacts to measured harm; enforcement against
    # offshore decays (mirror sites) unless renewed.
    regulator_enabled: bool = True
    reg_harm_threshold: float = Field(55.0, ge=0.0)
    reg_step: float = Field(0.15, ge=0.0, le=2.0)
    enforcement_decay: float = Field(0.10, ge=0.0, le=1.0)
    reg_offshore_alarm: float = Field(0.20, ge=0.0, le=1.0)
    # Political agent (Skatteministeriet/Folketinget): reacts to *visible* harm
    # with a 12-24 month delay -> overshoot/oscillation.
    political_enabled: bool = True
    political_delay: int = Field(18, ge=0, le=60)
    political_threshold: float = Field(60.0, ge=0.0)
    political_tax_step: float = Field(0.05, ge=0.0, le=1.0)
    political_limit_step: float = Field(0.25, ge=0.0, le=1.0)
    political_cooldown: int = Field(18, ge=1)
    # Udlodning loop (loop 3): DS profit funds sport/culture -> resistance to
    # tightening (raises the political threshold). Margin is the green anchor
    # 2.008/5.158 = 38.9 %; the ratio is set so baseline udlodning hits the
    # ~1.79 bn/yr anchor.
    ds_profit_margin: float = Field(0.389, ge=0.0, le=1.0)
    udlodning_ratio: float = Field(0.89, ge=0.0, le=1.0)
    udlodning_resistance: float = Field(0.35, ge=0.0, le=3.0)

    # Channelization is contested — treated as an interval, not a point. Only
    # conclusions robust across [low, high] should be reported (dossier fælde 2).
    channelization_start: float = Field(0.82, ge=0.0, le=1.0)
    channelization_low: float = Field(0.72, ge=0.0, le=1.0)
    channelization_high: float = Field(0.92, ge=0.0, le=1.0)

    population: int = Field(500, ge=50, le=20000)   # player agents
    baseline_noise: float = Field(0.0, ge=0.0, le=0.5)  # monthly lognormal noise on BSI

    # --- population shape (Etape 1) ------------------------------------- #
    # Legacy total-population scale (kept for the engagement-level view);
    # actual customer counts are calibrated per track to customer_anchors.
    represented_customers: int = Field(2_500_000, ge=1000)
    # Per-track customer anchors (people, all providers): calibrated so the
    # baseline counts are recognizable — ~4.5 M adult Danes, lottery reaches
    # ~1.4 M, the other verticals a few hundred thousand each. Estimates, not
    # official statistics (see params.yaml).
    customer_anchors: dict[str, float] = Field(default_factory=lambda: {
        "lottery": 1_400_000.0, "scratch": 700_000.0,
        "casino": 450_000.0, "sports": 500_000.0,
    })
    # Licensed operators in Denmark: Spillemyndigheden's register lists 54
    # licence holders (June 2026; 23 casino+betting, 12 casino-only, 14
    # limited casino, 5 betting-only). The model names 5 of the ~40 full-scale
    # operators as agents; ``longtail_licensees`` is how many real licences the
    # aggregated "Øvrige licenshavere" agent represents.
    longtail_licensees: int = Field(35, ge=0, le=100)
    # Per-operator field overrides ({operator_id: {field: value}}) — the UI's
    # "operator strategy" panel (DS vs competitors: marketing pressure, bonus
    # intensity, AI adoption, aggressiveness, payout ...).
    operator_overrides: dict[str, dict[str, float | bool]] = Field(default_factory=dict)
    # Heavy-tailed monthly spend: lognormal sigma is the income-concentration
    # knob (higher => a smaller share of players make up more of the BSI). This
    # is the single most important / most uncertain lever (perspective §2.1) and
    # must be swept in sensitivity analysis — see params.yaml. Default 1.70
    # targets top-5 % ≈ 50-70 % of BSI (international priors); 1.10 gave ~30 %,
    # far too thin.
    spend_sigma: float = Field(1.70, ge=0.10, le=3.00)
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
        for o in list(self.operators) + list(self.entrants):
            bad = [t for t in o.tracks if t not in track_ids]
            if bad:
                raise ValueError(f"operator {o.operator_id} references unknown track(s) {bad}")
        clash = {o.operator_id for o in self.operators} & {e.operator_id for e in self.entrants}
        if clash:
            raise ValueError(f"entrant ids clash with operators: {clash}")
        # Apply per-operator strategy overrides (validated field names).
        if self.operator_overrides:
            by_id = {o.operator_id: o for o in list(self.operators) + list(self.entrants)}
            allowed = set(OperatorConfig.model_fields) - {"operator_id", "kind", "tracks", "name"}
            for oid, patch in self.operator_overrides.items():
                op = by_id.get(oid)
                if op is None:
                    raise ValueError(f"operator_overrides: unknown operator '{oid}'")
                for field, value in patch.items():
                    if field not in allowed:
                        raise ValueError(
                            f"operator_overrides: unknown field '{field}' for '{oid}'")
                    setattr(op, field, value)
        bad_anchor = [t for t in self.customer_anchors if t not in track_ids]
        if bad_anchor:
            raise ValueError(f"customer_anchors references unknown track(s) {bad_anchor}")
        return self

    def operators_for(self, track_id: str) -> list[OperatorConfig]:
        return [o for o in self.operators if track_id in o.tracks]

    def track(self, track_id: str) -> TrackConfig:
        for t in self.tracks:
            if t.track_id == track_id:
                return t
        raise KeyError(track_id)
