"""Etape 1 (gambling domain): the player universe — heavy-tailed spend on five
orthogonal axes, calibrated to the per-track anchors, plus customer counts and
income concentration. DoD: aggregate BSI per track matches the anchors, customer
counts are coherent, and income concentration responds to its (flagged) knob."""
import numpy as np
import pytest

from simcore.config.loader import load_preset
from simcore.gambling.config import GamblingConfig
from simcore.gambling.population import (
    build_population,
    calibrate_track_scale,
    concentration,
    customer_counts,
    player_track_spend,
)
from simcore.gambling.simulation import GamblingSimulation

BN_TO_MIO = 1000.0


def _pop(**over):
    gcfg = GamblingConfig(**over)
    rng = np.random.default_rng(7)
    return gcfg, build_population(gcfg, rng)


# --------------------------------------------------------------------------- #
# five axes
def test_population_axes_shapes_and_ranges():
    gcfg, pop = _pop(population=2000)
    assert pop.n == 2000
    assert pop.pref.shape == (2000, 4)
    np.testing.assert_allclose(pop.pref.sum(axis=1), 1.0, atol=1e-9)  # preferences normalize
    assert pop.risk.min() >= 0.0 and pop.risk.max() <= 1.0
    assert pop.offshore.min() >= 0.0 and pop.offshore.max() <= 1.0
    assert pop.age.min() >= 18.0


def test_axes_are_not_a_single_persona():
    """Young men must be a distinct class: higher mean risk than older women."""
    gcfg, pop = _pop(population=4000)
    young_men = (pop.age < 25) & (pop.male > 0.5)
    older_women = (pop.age > 45) & (pop.male < 0.5)
    assert pop.risk[young_men].mean() > pop.risk[older_women].mean() + 0.05
    # ...and they tilt toward casino/sports vs lottery/scratch
    tracks = pop.track_ids
    ci, si = tracks.index("casino"), tracks.index("sports")
    li = tracks.index("lottery")
    ym_action = pop.pref[young_men][:, [ci, si]].mean()
    ow_action = pop.pref[older_women][:, [ci, si]].mean()
    assert ym_action > ow_action
    assert pop.pref[older_women][:, li].mean() > pop.pref[young_men][:, li].mean()


# --------------------------------------------------------------------------- #
# heavy tail / concentration
def test_spend_is_heavy_tailed():
    gcfg, pop = _pop(population=5000, spend_sigma=1.1)
    top5 = concentration(pop.budget, 0.05)
    assert top5 > 0.20, "top 5% of players should hold a large BSI share"


def test_concentration_responds_to_sigma():
    _g_lo, lo = _pop(population=5000, spend_sigma=0.5)
    _g_hi, hi = _pop(population=5000, spend_sigma=1.8)
    assert concentration(hi.budget, 0.05) > concentration(lo.budget, 0.05) + 0.05


# --------------------------------------------------------------------------- #
# calibration + customers
def test_calibration_matches_track_anchors():
    gcfg, pop = _pop(population=3000)
    scale = calibrate_track_scale(pop, gcfg)
    base = player_track_spend(pop, scale).sum(axis=0)   # per-track monthly (mio)
    for i, t in enumerate(gcfg.tracks):
        assert base[i] == pytest.approx(t.annual_bsi / 12 * BN_TO_MIO, rel=1e-9)


def test_customer_counts_coherent():
    gcfg, pop = _pop(population=1000, represented_customers=2_500_000)
    c = customer_counts(pop, gcfg)
    assert c["_unique"] == pytest.approx(2_500_000, rel=1e-9)   # every agent plays >=1 track
    per_track_sum = sum(c[t.track_id] for t in gcfg.tracks)
    assert per_track_sum >= c["_unique"]                         # multi-homing
    assert all(c[t.track_id] > 0 for t in gcfg.tracks)


# --------------------------------------------------------------------------- #
# simulation emits the new series
def _sim(**over):
    cfg = load_preset("dk_baseline")
    cfg.ticks = 12
    if over:
        cfg.gambling = {**(cfg.gambling or {}), **over}
    sim = GamblingSimulation(cfg)
    sim.run()
    return sim


def test_sim_emits_customer_and_concentration_series():
    sim = _sim()
    last = sim.metrics_history[-1]
    for key in ("customers_total", "customers_casino", "customers_sports",
                "top5pct_bsi_share", "top1pct_bsi_share", "young_share", "at_risk_share"):
        assert key in last
    assert last["customers_total"] == pytest.approx(2_500_000, rel=1e-9)
    assert 0.0 < last["top5pct_bsi_share"] <= 1.0


def test_sim_anchor_match_preserved_with_population():
    """Population-driven BSI must still reproduce the Etape-0 anchor match."""
    sim = _sim()
    for track_id, annual in (("lottery", 2.0), ("scratch", 1.0), ("casino", 3.5)):
        series = [m[f"bsi_{track_id}"] for m in sim.metrics_history]
        assert series[0] == pytest.approx(annual / 12 * BN_TO_MIO, rel=1e-3)


def test_sim_income_concentration_lever_feeds_through():
    """The flagged income-concentration knob (spend_sigma) must change the
    simulated concentration metric — i.e. the lever actually feeds the model."""
    lo = _sim(spend_sigma=0.5).metrics_history[-1]["top5pct_bsi_share"]
    hi = _sim(spend_sigma=1.8).metrics_history[-1]["top5pct_bsi_share"]
    assert hi > lo + 0.05
