"""Asset state and the aggregate market state.

Each asset keeps a ring buffer of prices so the perception layer can serve
delayed observations and moving-average anchors in O(1).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from simcore.models.config import AssetConfig, MarketConfig


class Asset:
    def __init__(self, cfg: AssetConfig, mkt: MarketConfig, history_window: int):
        self.asset_id = cfg.asset_id
        self.price = cfg.initial_price
        self.prev_price = cfg.initial_price
        self.initial_price = cfg.initial_price
        self.fundamental = cfg.fundamental_value
        self.sigma = cfg.initial_volatility
        self.sigma_base = cfg.initial_volatility
        self.spread = mkt.spread_min
        self.volume = 0.0
        self.forced_volume = 0.0
        self.shares_outstanding = cfg.shares_outstanding
        self.depth_shares = max(mkt.depth_frac * cfg.shares_outstanding, mkt.depth_base)
        self._window = history_window
        self._hist = np.full(history_window, cfg.initial_price, dtype=float)
        self._t = 0

    def record_price(self, price: float) -> None:
        self.prev_price = self.price
        self.price = price
        self._t += 1
        self._hist[self._t % self._window] = price

    def price_at_lag(self, lag: int) -> float:
        lag = min(max(lag, 0), self._window - 1, self._t)
        return float(self._hist[(self._t - lag) % self._window])

    def moving_average(self, window: int = 20) -> float:
        w = min(window, self._t + 1, self._window)
        if w <= 0:
            return self.price
        idx = (self._t - np.arange(w)) % self._window
        return float(self._hist[idx].mean())

    def trailing_return(self, window: int) -> float:
        past = self.price_at_lag(window)
        if past <= 0:
            return 0.0
        return float(np.log(self.price / past))

    @property
    def last_return(self) -> float:
        if self.prev_price <= 0:
            return 0.0
        return float(np.log(self.price / self.prev_price))


@dataclass
class MarketState:
    assets: dict[str, Asset]
    liquidity_pool: float
    liquidity_pool0: float
    risk_free_rate: float
    # runtime-adjustable copies of margin rules (regulators can move them)
    maintenance_margin: float
    initial_margin: float
    max_leverage: float
    baseline_maintenance: float = 0.25
    credit_tightness: float = 0.15
    sentiment_index: float = 0.0
    margin_calls_tick: int = 0
    margin_calls_total: int = 0
    extras: dict = field(default_factory=dict)

    @classmethod
    def create(cls, asset_cfgs: list[AssetConfig], mkt: MarketConfig, history_window: int) -> "MarketState":
        assets = {a.asset_id: Asset(a, mkt, history_window) for a in asset_cfgs}
        float_value = sum(a.price * a.shares_outstanding for a in assets.values())
        pool0 = max(0.05 * float_value, 1.0)
        return cls(
            assets=assets,
            liquidity_pool=pool0,
            liquidity_pool0=pool0,
            risk_free_rate=mkt.risk_free_rate,
            maintenance_margin=mkt.maintenance_margin,
            initial_margin=mkt.initial_margin,
            max_leverage=mkt.max_leverage,
            baseline_maintenance=mkt.maintenance_margin,
        )

    @property
    def liquidity_index(self) -> float:
        return max(self.liquidity_pool / self.liquidity_pool0, 0.05)

    def prices(self) -> dict[str, float]:
        return {aid: a.price for aid, a in self.assets.items()}
