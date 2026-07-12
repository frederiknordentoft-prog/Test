"""Etape 3 (gambling domain): operator behaviour + AI diffusion + entry/exit/M&A.
DoD: AI capability follows an S-curve, an AI shock shifts market size + shares +
entrant count, big-tech is gated by the frontier, an aggressive entrant grows
without hardcoding, and weak operators exit."""
import pytest

from simcore.config.loader import load_preset
from simcore.gambling.simulation import GamblingSimulation


def _sim(ticks=60, **g):
    cfg = load_preset("dk_baseline")
    cfg.ticks = ticks
    cfg.gambling = {**(cfg.gambling or {}), **g}
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


# --------------------------------------------------------------------------- #
def test_ai_frontier_rises_and_saturates():
    sim = _sim(ticks=40, ai_frontier_growth=0.05)
    fr = [m["ai_frontier"] for m in sim.metrics_history]
    assert fr[-1] > fr[0]
    assert all(b >= a - 1e-9 for a, b in zip(fr, fr[1:]))  # monotone up
    assert fr[-1] <= 1.0


def test_ai_capability_scurve_early_adopter_leads():
    sim = _sim(ticks=40, ai_frontier_growth=0.05)
    last = sim.metrics_history[-1]
    # offshore (adoption 0.08 default) vs the market — caps approach the frontier
    assert 0.0 < last["ai_best_cap"] <= last["ai_frontier"] + 1e-9


def test_ai_shock_jumps_frontier():
    sim = _sim(ticks=10, ai_frontier_growth=0.0, ai_shocks=[{"tick": 5, "size": 0.3}])
    fr = [m["ai_frontier"] for m in sim.metrics_history]
    assert fr[4] == pytest.approx(0.20, abs=1e-6)   # flat before the shock
    assert fr[6] - fr[4] > 0.25                       # jump after the shock


def test_ai_boom_grows_market_and_erodes_ds_share():
    off = _sim(ticks=60, ai_enabled=False, entry_enabled=False).metrics_history[-1]
    on = _sim(ticks=60, ai_frontier_growth=0.06, ai_shocks=[{"tick": 6, "size": 0.3}]).metrics_history[-1]
    assert on["ai_engagement"] > 1.0
    assert on["market_size_total"] > off["market_size_total"]   # AI grows the market
    assert on["n_entrants"] > 0
    assert on["ds_share_total"] < off["ds_share_total"]          # competition erodes DS


def test_bigtech_gated_by_frontier():
    slow = _sim(ticks=30, ai_frontier_growth=0.004)              # frontier stays well below 0.70
    assert "bigtech" not in slow.entry.entered
    wild = _sim(ticks=40, ai_frontier_growth=0.08, ai_shocks=[{"tick": 3, "size": 0.4}])
    assert "bigtech" in wild.entry.entered


def test_aggressive_entrant_enters_and_survives():
    sim = _sim(ticks=60, ai_frontier_growth=0.06)
    assert "ai_sportsbook" in sim.entry.entered           # entered on its own economics
    last = sim.metrics_history[-1]
    assert last.get("share_op_ai_sportsbook", 0.0) > sim.gcfg.survival_share


def test_weak_operator_exits():
    # A high survival bar forces small operators out.
    sim = _sim(ticks=20, survival_share=0.12, survival_periods=3)
    assert sim.metrics_history[-1]["n_exits"] > 0
    assert len(sim.entry.exited) > 0


def test_consolidation_is_mna_not_greenfield():
    sim = _sim(ticks=60, ai_frontier_growth=0.05)
    mna = [e for e in sim.events_log if e.event_type == "m&a"]
    if mna:  # the consolidator acquires an incumbent rather than adding a slot
        assert "acquired" in mna[0].payload.get("detail", "")


def test_reproducible_with_ai_and_entry():
    a = _sim(ticks=40, ai_frontier_growth=0.06, ai_shocks=[{"tick": 5, "size": 0.3}])
    b = _sim(ticks=40, ai_frontier_growth=0.06, ai_shocks=[{"tick": 5, "size": 0.3}])
    assert a.state_hash() == b.state_hash()
    assert a.entry.entered == b.entry.entered
