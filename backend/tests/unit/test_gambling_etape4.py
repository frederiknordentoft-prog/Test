"""Etape 4 (gambling domain): stakeholder reactions + the four feedback loops.
DoD: the Spilpakke-1 counterfactual, the channelization false positive (measured
harm falls while hidden/offshore harm rises), regulator enforcement decay, the
delayed political agent (overshoot), and the udlodning resistance loop."""
import pytest

from simcore.config.loader import load_preset
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import EventConfig


def _sim(events=None, ticks=48, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    # Isolate the loops from AI/entry unless a test asks otherwise.
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False, **g}
    if events:
        cfg.events = list(cfg.events) + events
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


def _spilpakke(tick=6):
    return [EventConfig(name="Spilpakke 1", event_type="spilpakke_1", start_tick=tick)]


# --------------------------------------------------------------------------- #
# loop 1 — channelization false positive + the Spilpakke counterfactual
def test_spilpakke_channelization_false_positive():
    base = _sim().metrics_history[-1]
    pak = _sim(events=_spilpakke()).metrics_history[-1]
    # tightening pushes players offshore
    assert pak["channelization"] < base["channelization"]
    assert pak["offshore_share"] > base["offshore_share"]
    # measured harm FALLS (looks like success) while the hidden (offshore) harm
    # gap WIDENS — the false positive the model must be able to produce
    assert pak["measured_harm"] < base["measured_harm"]
    assert pak["harm_gap"] > base["harm_gap"]


def test_counterfactual_changes_outcome():
    """The 'what if no Spilpakke 1' counterfactual must move the outcome."""
    base = _sim().metrics_history[-1]
    pak = _sim(events=_spilpakke()).metrics_history[-1]
    assert base["channelization"] != pytest.approx(pak["channelization"], abs=1e-3)


def test_state_revenue_falls_with_tightening():
    """Core tension (dossier §11.1): tightening shrinks licensed BSI -> revenue."""
    base = _sim().metrics_history[-1]
    pak = _sim(events=_spilpakke()).metrics_history[-1]
    assert pak["state_revenue"] < base["state_revenue"]


# --------------------------------------------------------------------------- #
# loop 2 — regulator enforcement decay + delayed political reaction
def test_enforcement_decays_without_renewal():
    sim = _sim(ticks=15, reg_offshore_alarm=0.99, reg_harm_threshold=9999.0,
               events=[EventConfig(name="enf", event_type="enforcement_boost",
                                   start_tick=2, params={"size": 0.6})])
    enf = [m["enforcement"] for m in sim.metrics_history]
    assert max(enf) > 0.3                    # the boost landed
    assert enf[3] > enf[10]                  # ...then decayed (mirror sites)


def test_regulator_tightens_on_high_measured_harm():
    sim = _sim(ticks=24, reg_harm_threshold=30.0, political_enabled=False)
    fr = [m["reg_friction"] for m in sim.metrics_history]
    assert fr[-1] > fr[0]                     # regulator ratchets friction up


def test_political_reaction_is_delayed():
    sim = _sim(ticks=40, political_threshold=30.0, political_delay=8,
               udlodning_resistance=0.0, regulator_enabled=False)
    assert sim.political.packages > 0
    ticks = [e.tick for e in sim.events_log if e.event_type == "political_tightening"]
    assert ticks and min(ticks) >= 8          # nothing before the delay


# --------------------------------------------------------------------------- #
# loop 3 — udlodning coalition resists tightening
def test_udlodning_resistance_reduces_tightening():
    common = dict(ticks=40, political_threshold=30.0, political_delay=8, regulator_enabled=False)
    low = _sim(udlodning_resistance=0.0, **common)
    high = _sim(udlodning_resistance=2.0, **common)
    assert high.political.packages < low.political.packages


# --------------------------------------------------------------------------- #
def test_stakeholders_can_be_disabled():
    sim = _sim(stakeholders_enabled=False)
    assert "true_harm" not in sim.metrics_history[-1]
    assert "state_revenue" in sim.metrics_history[-1]   # revenue is always computed


def test_reproducible_with_stakeholders():
    a = _sim(events=_spilpakke())
    b = _sim(events=_spilpakke())
    assert a.state_hash() == b.state_hash()
    assert [m["true_harm"] for m in a.metrics_history] == [m["true_harm"] for m in b.metrics_history]
