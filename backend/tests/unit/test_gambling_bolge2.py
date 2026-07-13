"""Bølge 2 (red-team fixes): behaviour & mechanisms.

Covers: phased Spilpakke ramp, tournament-year YoY swings, nested logit (IIA
fix), prediction markets as an unblockable structural discontinuity, ROFUS as a
near-absorbing state, endogenous operator budget reallocation (the Klub Lotto
pattern) and podium-strategy M&A."""
import numpy as np
import pytest

from simcore.config.loader import load_preset
from simcore.gambling.config import GamblingConfig, OperatorConfig
from simcore.gambling.decisions import (
    choice_probabilities,
    nested_choice_probabilities,
)
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import EventConfig


def _sim(preset="dk_baseline", ticks=30, events=None, **g):
    cfg = load_preset(preset)
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": False, "entry_enabled": False, **g}
    if events:
        cfg.events = list(cfg.events) + events
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


# --------------------------------------------------------------------------- #
# 7 — phased Spilpakke (ramp, not cliff)
def test_spilpakke_phases_in_over_duration():
    ev = [EventConfig(name="SP1", event_type="spilpakke_1", start_tick=6, duration=12)]
    sim = _sim(ticks=30, events=ev)
    ab = [m.get("ad_ban", 0.0) for m in sim.metrics_history]
    assert ab[5] == 0.0
    assert 0.0 < ab[11] < ab[20] - 0.05, "must build gradually"
    instant = _sim(ticks=30, events=[EventConfig(name="SP1", event_type="spilpakke_1",
                                                 start_tick=6)])
    assert ab[-1] == pytest.approx(instant.metrics_history[-1]["ad_ban"], abs=1e-6)


# --------------------------------------------------------------------------- #
# 8 — tournament years drive the YoY swings; casino stays the stable leg
def test_tournament_years_produce_yoy_swings():
    sim = _sim(ticks=37)
    sports = [m["bsi_sports"] for m in sim.metrics_history]
    casino = [m["bsi_casino"] for m in sim.metrics_history]
    yoy_sports = [sports[t] / sports[t - 12] - 1.0 for t in range(12, 37)]
    yoy_casino = [casino[t] / casino[t - 12] - 1.0 for t in range(12, 37)]
    # tournament July vs empty July and vice versa (dossier: -46 %..+14 % obs.)
    assert min(yoy_sports) < -0.20
    assert max(yoy_sports) > 0.30
    # casino has no calendar: YoY is the smooth growth trend only
    assert max(yoy_casino) - min(yoy_casino) < 0.02
    assert np.std(yoy_sports) > 10 * np.std(yoy_casino)


# --------------------------------------------------------------------------- #
# 9 — nested logit (IIA fix)
def test_nested_logit_reduces_to_mnl_at_lambda_one():
    rng = np.random.default_rng(0)
    u = rng.normal(size=(50, 6))
    nests = np.array([0, 0, 0, 1, 1, 2])
    nested = nested_choice_probabilities(u, nests, [1.0, 1.0, 1.0], temperature=1.0)
    plain = choice_probabilities(u, temperature=1.0)
    np.testing.assert_allclose(nested, plain, atol=1e-10)
    np.testing.assert_allclose(nested.sum(axis=1), 1.0, atol=1e-12)


def test_licensed_entrant_competes_within_its_nest():
    """A licensed entrant must primarily cannibalize licensed incumbents — not
    mechanically raise channelization by draining offshore proportionally
    (the IIA failure the critic flagged)."""
    sim = _sim(ticks=2)
    tm = sim.market.tracks["casino"]
    before = tm.clear(0)
    newop = OperatorConfig(operator_id="newco", name="NewCo", kind="licensed",
                           tracks=["casino"], rtp=0.62, product_breadth=0.75, bonus=0.7,
                           brand=0.5, marketing_reach=0.7, friction=0.5, protection=0.6)
    sim.market.add_operator(newop)
    after = tm.clear(0)
    assert after["channelization"] - before["channelization"] < 0.02
    unl = ("offshore", "prediction")
    lic_loss = 1.0 - (sum(v for k, v in after["shares"].items() if k not in unl + ("newco",))
                      / sum(v for k, v in before["shares"].items() if k not in unl))
    off_loss = 1.0 - after["shares"]["offshore"] / before["shares"]["offshore"]
    assert lic_loss > 1.5 * off_loss, "substitution must happen mostly within the licensed nest"


# --------------------------------------------------------------------------- #
# 12 — prediction markets: ~0 at baseline, a discontinuity when the loophole
# opens, and immune to DNS enforcement
def test_prediction_starts_at_zero_and_surges_discontinuously():
    base = _sim(ticks=24)
    assert base.metrics_history[-1].get("share_op_prediction", 0.0) < 0.005
    surge = _sim("prediction_market_surge", ticks=24)
    pred = [m.get("share_op_prediction", 0.0) for m in surge.metrics_history]
    assert pred[4] < 0.005                      # nothing before the loophole opens
    assert pred[-1] > 0.02                      # a real market arrived
    assert max(np.diff(pred)) > 0.003           # ...as a jump, not smooth growth


def test_enforcement_hits_offshore_but_not_prediction():
    surge_events = [EventConfig(name="surge", event_type="prediction_surge",
                                start_tick=2, params={"size": 4.0})]
    base = _sim(ticks=12, events=surge_events)
    boosted = _sim(ticks=12, events=surge_events + [
        EventConfig(name="enf", event_type="enforcement_boost", start_tick=9,
                    params={"size": 0.9})])
    # measured right after the boost, before mirror-site decay eats it
    b, e = base.metrics_history[10], boosted.metrics_history[10]
    assert e["share_op_offshore"] < b["share_op_offshore"] - 0.002, \
        "DNS/payment blocking must bite offshore"
    assert e["share_op_prediction"] >= b["share_op_prediction"] - 1e-6, \
        "prediction (financial derivative via fintech apps) cannot be blocked"


# --------------------------------------------------------------------------- #
# 10 — ROFUS: near-absorbing, detection-driven, reproducible
def test_rofus_stock_builds_and_detection_accelerates_it():
    base = _sim(ticks=36)
    stock = [m["rofus_stock"] for m in base.metrics_history]
    assert stock[-1] > 0, "the register must fill over time"
    assert stock[-1] >= stock[12] >= stock[0]
    rg = _sim(ticks=36, events=[EventConfig(name="rg", event_type="rg_2_0",
                                            start_tick=2, params={"size": 1.0})])
    assert rg.metrics_history[-1]["rofus_stock"] > stock[-1], \
        "AI-based RG detection must raise self-exclusion inflow"


def test_rofus_reproducible():
    a = _sim(ticks=24)
    b = _sim(ticks=24)
    assert [m["rofus_stock"] for m in a.metrics_history] \
        == [m["rofus_stock"] for m in b.metrics_history]


# --------------------------------------------------------------------------- #
# 6 — endogenous operator behaviour (the Klub Lotto reallocation pattern)
def test_operator_attributes_stable_at_baseline():
    sim = _sim(ticks=24)
    betano = next(o for o in sim.market.operators if o.operator_id == "betano")
    assert betano.brand == pytest.approx(0.58, abs=1e-6)
    assert betano.marketing_reach == pytest.approx(0.92, abs=1e-6)


def test_ad_ban_triggers_budget_reallocation():
    """When the marketing channel closes, operators pivot the stranded budget to
    brand/product (F2P top-of-funnel) — hardest for the high-burn challenger."""
    ev = [EventConfig(name="ban", event_type="ad_ban", start_tick=3, params={"size": 0.9})]
    sim = _sim(ticks=30, events=ev)
    betano = next(o for o in sim.market.operators if o.operator_id == "betano")
    ds = next(o for o in sim.market.operators if o.operator_id == "ds_licens")
    betano_pivot = (betano.brand - 0.58) + (betano.product_breadth - 0.70)
    ds_pivot = (ds.brand - 0.90) + (ds.product_breadth - 0.60)
    assert betano_pivot > 0.05, "the challenger must pivot"
    assert betano_pivot > ds_pivot, "aggressiveness scales the pivot"
    ops = [d for d in sim.recent_decisions if d.get("actor_type") == "operator"]
    assert ops and all(d["action"] == "reallocate" for d in ops)
    assert ops[0]["explanation"]["main_drivers"], "the why must be logged"


# --------------------------------------------------------------------------- #
# 11 — entry/M&A realism
def test_consolidator_buys_podium_not_weakest():
    cfg = load_preset("consolidation_wave")
    cfg.ticks = 48
    sim = GamblingSimulation(cfg)
    sim.run()
    mna = [e for e in sim.events_log if e.event_type == "m&a"]
    assert mna, "the consolidation wave must produce an acquisition"
    target = mna[0].payload["detail"].removeprefix("acquired ")
    assert target != "longtail", "podium strategy: buy a strong brand, not the cheapest"


def test_challenger_enters_without_ai_gate():
    """A sponsorship-led Betano-style entry must be possible on market economics
    alone — no AI frontier required (critic finding)."""
    cfg = load_preset("dk_baseline")
    cfg.ticks = 24
    cfg.gambling = {**(cfg.gambling or {}), "ai_enabled": True, "entry_enabled": True,
                    "ai_frontier_growth": 0.0, "ai_frontier_start": 0.0}
    sim = GamblingSimulation(cfg)
    sim.run()
    assert "challenger" in sim.entry.entered
    assert "bigtech" not in sim.entry.entered      # still frontier-gated
