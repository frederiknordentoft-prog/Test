"""Gambling-domain statistical integration tests (paired seeds / CRN).

Baseline and policy runs share each seed, so population draws cancel and the
policy's directional effect shows through with few pairs. Assertions are
majority/sign-based — single pairs may deviate; the *distribution* must not.

Run with:  pytest -m statistical
"""
import pytest

from simcore.config.loader import load_preset
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import EventConfig

pytestmark = pytest.mark.statistical

SEEDS = list(range(201, 211))   # 10 paired seeds


def _run(seed: int, events=None):
    cfg = load_preset("dk_baseline")
    cfg.ticks = 36
    cfg.seed = seed
    cfg.gambling = {**(cfg.gambling or {}), "population": 400,
                    "ai_enabled": False, "entry_enabled": False}
    if events:
        cfg.events = list(cfg.events) + events
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim.metrics_history[-1]


def test_spilpakke_directional_effects_hold_across_seeds():
    """Loop 1 + the core tension, distributionally: tightening must (a) lower
    channelization, (b) raise the offshore share, (c) shrink the total market
    (elastic demand — the pre-fix model was locked at exactly 0.00 %),
    (d) produce the measured-harm false positive while the hidden gap widens,
    and (e) cost the state revenue — in the vast majority of paired seeds."""
    ev = [EventConfig(name="Spilpakke 1", event_type="spilpakke_1", start_tick=6)]
    wins = {k: 0 for k in ("chan", "offshore", "market", "false_pos", "revenue")}
    for seed in SEEDS:
        base = _run(seed)
        pak = _run(seed, ev)
        wins["chan"] += pak["channelization"] < base["channelization"]
        wins["offshore"] += pak["offshore_share"] > base["offshore_share"]
        wins["market"] += pak["market_size_total"] < base["market_size_total"]
        wins["false_pos"] += (pak["measured_harm"] < base["measured_harm"]
                              and pak["harm_gap"] > base["harm_gap"])
        wins["revenue"] += pak["state_revenue"] < base["state_revenue"]
    n = len(SEEDS)
    for key, w in wins.items():
        assert w >= 0.9 * n, f"{key}: only {w}/{n} paired seeds show the effect"
