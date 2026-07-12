import numpy as np

from simcore.markets.asset import MarketState
from simcore.markets.margin import MarginEngine
from simcore.models.config import AssetConfig, MarketConfig
from tests.unit.test_clearing import make_actor


def setup_market():
    mkt = MarketConfig()
    assets = [AssetConfig(asset_id="X", initial_price=100.0)]
    return MarketState.create(assets, mkt, 64)


def test_breach_generates_forced_sell_sized_to_restore_margin():
    market = setup_market()
    actor = make_actor(0, cash=0.0, positions={"X": 100.0}, can_leverage=True)
    actor.state.margin_debt = 8_000.0  # wealth 2000, gross 10000 -> ratio 0.2 < 0.25
    intents, calls = MarginEngine().generate_forced_intents([actor], market)
    assert calls == 1
    assert len(intents) == 1
    intent = intents[0]
    assert intent.forced
    # target gross = wealth / initial_margin = 2000 / 0.4 = 5000 -> sell ~50 shares
    assert 45.0 <= intent.qty <= 55.0


def test_no_breach_no_call():
    market = setup_market()
    actor = make_actor(0, cash=5_000.0, positions={"X": 100.0}, can_leverage=True)
    actor.state.margin_debt = 1_000.0  # wealth 14000, gross 10000 -> fine
    intents, calls = MarginEngine().generate_forced_intents([actor], market)
    assert calls == 0 and intents == []


def test_unleveraged_long_actor_never_margin_called():
    market = setup_market()
    actor = make_actor(0, cash=0.0, positions={"X": 100.0})
    intents, calls = MarginEngine().generate_forced_intents([actor], market)
    assert calls == 0


def test_short_position_breach_forces_cover():
    market = setup_market()
    actor = make_actor(0, cash=11_000.0, positions={"X": -100.0}, can_short=True)
    # wealth = 11000 - 10000 = 1000; gross = 10000 -> ratio 0.1 < 0.25
    intents, calls = MarginEngine().generate_forced_intents([actor], market)
    assert calls == 1
    assert intents[0].action.value == "cover"


def test_bankruptcy_unwind_liquidates_everything():
    market = setup_market()
    actor = make_actor(0, positions={"X": 42.0})
    intents = MarginEngine.bankruptcy_unwind(actor, market)
    assert len(intents) == 1 and intents[0].qty == 42.0 and intents[0].forced
