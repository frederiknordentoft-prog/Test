"""Predefined scenarios: named event sequences that can be attached to any
configuration. The 12 required scenario building blocks all map to event types
in the library; margin-call cascades additionally emerge endogenously."""
from __future__ import annotations

from simcore.models.config import EventConfig, SignalConfig

SCENARIOS: dict[str, list[EventConfig]] = {
    "baseline": [],
    "rate_shock": [
        EventConfig(
            name="Unexpected central bank hike (+1pp)", event_type="rate_hike",
            description="The central bank raises the policy rate by 1 percentage point without warning.",
            start_tick=50, magnitude=1.0,
            signal=SignalConfig(publicity=1.0, credibility=1.0),
        )
    ],
    "profit_warning": [
        EventConfig(
            name="Major firm cuts guidance", event_type="profit_warning",
            description="The largest listed firm lowers its earnings expectations sharply.",
            start_tick=40, magnitude=1.0,
        )
    ],
    "supply_chain_crisis": [
        EventConfig(
            name="Key supplier production halt", event_type="supplier_stoppage",
            description="The largest supplier suffers a production stoppage.",
            start_tick=30, duration=25, magnitude=1.0,
            signal=SignalConfig(publicity=0.35, credibility=0.85),
        ),
        EventConfig(
            name="Input commodity price spike", event_type="commodity_spike",
            description="A key input commodity becomes sharply more expensive.",
            start_tick=38, duration=40, magnitude=0.8,
        ),
    ],
    "rumor_panic": [
        EventConfig(
            name="Negative social media rumor", event_type="rumor",
            description="A fabricated negative story spreads on social networks.",
            start_tick=25, duration=8, magnitude=1.2,
            signal=SignalConfig(publicity=0.08, credibility=0.6, truth=0.0),
            escalation_probability=0.4,
        )
    ],
    "institutional_selloff": [
        EventConfig(
            name="Large institutional liquidation", event_type="institutional_selloff",
            description="A major institutional investor unwinds a significant position.",
            start_tick=30, duration=5, magnitude=1.0,
            signal=SignalConfig(publicity=0.5, credibility=0.9),
        )
    ],
    "credit_crunch": [
        EventConfig(
            name="Banks tighten lending standards", event_type="credit_tightening",
            description="Banks collectively raise lending standards.",
            start_tick=30, magnitude=1.0,
        ),
        EventConfig(
            name="New capital requirements", event_type="capital_requirements",
            description="The regulator introduces stricter capital and margin requirements.",
            start_tick=45, magnitude=1.0,
        ),
    ],
    "demand_slump": [
        EventConfig(
            name="Household demand falls", event_type="demand_drop",
            description="Customer demand drops as household income weakens.",
            start_tick=25, duration=40, magnitude=1.0,
        )
    ],
    "tech_rally": [
        EventConfig(
            name="Positive technology breakthrough", event_type="tech_breakthrough",
            description="A technology breakthrough lifts growth expectations across firms.",
            start_tick=30, magnitude=1.0,
            signal=SignalConfig(publicity=0.9, credibility=0.85),
        )
    ],
    "cyberattack": [
        EventConfig(
            name="Cyberattack on major firm", event_type="cyberattack",
            description="A central firm is hit by a cyberattack and loses most capacity.",
            start_tick=35, duration=12, magnitude=1.0,
            escalation_probability=0.25,
        )
    ],
    "margin_cascade": [
        EventConfig(
            name="Exchange hikes margin requirements", event_type="margin_shock",
            description="Margin requirements jump, squeezing leveraged actors.",
            start_tick=30, duration=20, magnitude=1.0,
        )
    ],
}


def get_scenario(name: str) -> list[EventConfig]:
    if name not in SCENARIOS:
        raise KeyError(f"unknown scenario '{name}' (available: {sorted(SCENARIOS)})")
    return [e.model_copy(deep=True) for e in SCENARIOS[name]]
