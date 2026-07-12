import numpy as np

from simcore.agents.actor import Actor, new_actor_state
from simcore.markets.asset import MarketState
from simcore.markets.clearing import BatchAuction, _Order
from simcore.models.actor_state import ActorType, Traits
from simcore.models.config import AssetConfig, MarketConfig


def make_actor(i=0, cash=10_000.0, positions=None, can_short=False, can_leverage=False):
    state = new_actor_state(cash)
    state.positions = dict(positions or {})
    return Actor(
        id=i, actor_type=ActorType.RETAIL, name=f"a{i}", traits=Traits(), state=state,
        rng=np.random.default_rng(1), can_short=can_short, can_leverage=can_leverage,
    )


def setup_market(noise=0.0):
    mkt = MarketConfig(noise_sigma=noise)
    assets = [AssetConfig(asset_id="X", initial_price=100.0, shares_outstanding=100_000)]
    market = MarketState.create(assets, mkt, history_window=64)
    market.sentiment_index = 0.0
    return mkt, market, BatchAuction(mkt)


def test_buy_imbalance_raises_price_sell_lowers():
    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    rng = np.random.default_rng(0)
    buyer = make_actor(0, cash=1e6)
    auction.clear_asset(0, asset, [_Order(buyer, 500.0, False, 1.0, "buy")], market, rng)
    assert asset.price > 100.0

    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    seller = make_actor(1, cash=0.0, positions={"X": 1000.0})
    auction.clear_asset(0, asset, [_Order(seller, -500.0, False, 1.0, "sell")], market, rng)
    assert asset.price < 100.0


def test_price_impact_is_bounded():
    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    seller = make_actor(0, positions={"X": 1e9})
    auction.clear_asset(0, asset, [_Order(seller, -1e9, False, 1.0, "sell")], market,
                        np.random.default_rng(0))
    move = abs(np.log(asset.price / 100.0))
    assert move <= mkt.impact_alpha + 1e-9


def test_forced_orders_fill_first():
    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    asset.sigma = 0.0  # no volatility shrink -> effective depth == depth_shares
    depth_budget = mkt.absorb_rho * asset.depth_shares  # sell budget with zero buyers
    forced_qty = depth_budget * 0.6
    voluntary_qty = depth_budget * 2.0
    forced = make_actor(0, positions={"X": forced_qty})
    voluntary = make_actor(1, positions={"X": voluntary_qty})
    forced.state.pending_forced["X"] = forced_qty
    orders = [
        _Order(forced, -forced_qty, True, 1.5, "sell"),
        _Order(voluntary, -voluntary_qty, False, 1.0, "sell"),
    ]
    trades = auction.clear_asset(0, asset, orders, market, np.random.default_rng(0))
    by_actor = {t.actor_id: t for t in trades}
    assert by_actor[0].qty >= forced_qty * 0.999, "forced order must fill fully"
    assert by_actor[1].qty < voluntary_qty * 0.5, "voluntary majority order must be rationed"


def test_settlement_updates_cash_positions_and_entry():
    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    buyer = make_actor(0, cash=100_000)
    auction.clear_asset(0, asset, [_Order(buyer, 100.0, False, 1.0, "buy")], market,
                        np.random.default_rng(0))
    assert buyer.state.positions["X"] > 0
    assert buyer.state.cash < 100_000
    assert "X" in buyer.state.internal_state["entry_price"]


def test_price_floor_holds():
    mkt, market, auction = setup_market()
    asset = market.assets["X"]
    asset.price = 0.011
    seller = make_actor(0, positions={"X": 1e9})
    for _ in range(20):
        auction.clear_asset(0, asset, [_Order(seller, -1e9, False, 1.0, "sell")], market,
                            np.random.default_rng(0))
    assert asset.price >= mkt.price_floor


def test_liquidity_pool_moves_with_intents():
    from simcore.models.actions import Action, ActionIntent, Domain

    mkt, market, auction = setup_market()
    actor = make_actor(0, cash=10_000)
    pool0 = market.liquidity_pool
    auction.apply_liquidity_intents(
        [ActionIntent(0, Action.PROVIDE_LIQUIDITY, Domain.MARKET, None, 5_000)], [actor], market
    )
    assert market.liquidity_pool == pool0 + 5_000
    assert actor.state.provided_liquidity == 5_000
    auction.apply_liquidity_intents(
        [ActionIntent(0, Action.WITHDRAW_LIQUIDITY, Domain.MARKET, None, 5_000)], [actor], market
    )
    assert market.liquidity_pool == pool0
    assert actor.state.cash == 10_000
