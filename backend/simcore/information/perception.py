"""Perception: builds each actor's distorted Observation.

Distortions applied per actor:
- observation noise scaled by (1 - information_quality)
- price/momentum features served at lag = information_delay
- confirmation bias: signals conflicting with current sentiment are shrunk
- credibility gate: a signal is believed only if rng < trust * credibility
  (trust per source adapts when corrections reveal a source lied)

The numeric core (lagged prices, noise matrices, peer aggregates) is
vectorized; the per-actor loop only assembles small dicts.
"""
from __future__ import annotations

import numpy as np

from simcore.agents.actor import Actor
from simcore.agents.population import PopulationArrays
from simcore.decisions.base import Observation, PerceivedSignal
from simcore.information.signals import Signal
from simcore.markets.asset import MarketState
from simcore.models.config import SimConfig
from simcore.networks.layers import MultiLayerNetwork

OBS_NOISE_SCALE = 0.01


class PerceptionEngine:
    def __init__(self, config: SimConfig, actors: list[Actor], arrays: PopulationArrays,
                 net: MultiLayerNetwork, rng: np.random.Generator):
        self.config = config
        self.actors = actors
        self.arrays = arrays
        self.net = net
        self.rng = rng
        self.last_action_dir = np.zeros(arrays.n)  # +1 bought, -1 sold last tick

    def build_observations(
        self,
        tick: int,
        market: MarketState,
        signals_by_actor: dict[int, list[Signal]],
        own_returns: np.ndarray,
        econ_features: dict[int, dict],
        fundamentals: dict[str, float],
    ) -> list[Observation | None]:
        arrays = self.arrays
        n = arrays.n
        asset_ids = list(market.assets.keys())
        n_assets = len(asset_ids)

        # --- vectorized numeric core ------------------------------------
        delays = arrays.info_delay
        unique_delays = np.unique(delays)
        lag_prices = {}   # delay -> np[n_assets]
        lag_mom = {}
        for d in unique_delays:
            lag_prices[int(d)] = np.array([market.assets[a].price_at_lag(int(d)) for a in asset_ids])
            lag_mom[int(d)] = np.array(
                [market.assets[a].price_at_lag(int(d)) / max(market.assets[a].price_at_lag(int(d) + 10), 1e-9) - 1.0
                 for a in asset_ids]
            )
        prev_prices = {int(d): np.array([market.assets[a].price_at_lag(int(d) + 1) for a in asset_ids])
                       for d in unique_delays}
        vols = np.array([market.assets[a].sigma for a in asset_ids])
        mas = np.array([market.assets[a].moving_average(20) for a in asset_ids])
        funds = np.array([fundamentals.get(a, market.assets[a].fundamental) for a in asset_ids])

        noise_scale = OBS_NOISE_SCALE * (1.0 - arrays.info_quality)
        noise = self.rng.normal(0.0, 1.0, size=(n, n_assets)) * noise_scale[:, None]
        fund_noise = self.rng.normal(0.0, 1.0, size=(n, n_assets)) * (noise_scale[:, None] * 2.0)

        # peer aggregates over the social layer
        adj = self.net.adjacency("social")
        deg = np.asarray(adj.sum(axis=1)).ravel()
        deg[deg == 0] = 1.0
        peer_sent = np.asarray(adj @ arrays.sentiment).ravel() / deg
        peer_flow = np.tanh(np.asarray(adj @ self.last_action_dir).ravel() / deg * 2.0)

        # global sentiment index: size-weighted over market participants
        mp = arrays.is_market & arrays.alive
        weights = np.where(mp, np.maximum(arrays.wealth, 0.0), 0.0)
        market_sent = float((weights * arrays.sentiment).sum() / max(weights.sum(), 1e-9))
        market.sentiment_index = market_sent

        credibility_draws = self.rng.random(n * 4)  # pool of uniforms for signal gates
        draw_idx = 0

        obs_list: list[Observation | None] = [None] * n
        for actor in self.actors:
            i = actor.id
            if not actor.state.alive:
                continue
            d = int(delays[i])
            base_p = lag_prices[d]
            prev_p = prev_prices[d]
            perceived_p = base_p * (1.0 + noise[i])
            perceived_prev = np.maximum(prev_p * (1.0 + 0.5 * noise[i]), 1e-9)
            returns_1 = perceived_p / perceived_prev - 1.0
            perceived_funds = funds * (1.0 + fund_noise[i])

            # signals: credibility gate + confirmation bias
            perceived_signals: list[PerceivedSignal] = []
            for sig in signals_by_actor.get(i, ()):  # noqa: B020
                trust = actor.state.trust_in_sources.get(sig.source, actor.traits.trust_level)
                gate_u = credibility_draws[draw_idx % credibility_draws.size]
                draw_idx += 1
                if gate_u > trust * sig.credibility:
                    continue  # not believed
                hint = sig.sentiment_hint
                if hint * actor.state.sentiment < 0:  # conflicts with current view
                    hint *= 1.0 - 0.5 * abs(actor.state.sentiment)
                mag = sig.magnitude * (1.0 + noise[i][0])
                perceived_signals.append(
                    PerceivedSignal(sig.topic, sig.asset_id, float(mag), sig.credibility, sig.source, float(hint))
                )
                if sig.meta.get("corrects"):
                    src = sig.meta["corrects"]
                    prev_trust = actor.state.trust_in_sources.get(src, actor.traits.trust_level)
                    actor.state.trust_in_sources[src] = max(0.05, prev_trust * 0.6)

            obs_list[i] = Observation(
                tick=tick,
                own_wealth=float(arrays.wealth[i]),
                own_return=float(own_returns[i]),
                prices={a: float(max(p, 1e-9)) for a, p in zip(asset_ids, perceived_p)},
                returns_1={a: float(r) for a, r in zip(asset_ids, returns_1)},
                momentum={a: float(m) for a, m in zip(asset_ids, lag_mom[d])},
                volatility={a: float(v) for a, v in zip(asset_ids, vols)},
                ma_anchor={a: float(m) for a, m in zip(asset_ids, mas)},
                fundamentals={a: float(max(f, 0.0)) for a, f in zip(asset_ids, perceived_funds)},
                peer_sentiment=float(peer_sent[i]),
                peer_net_flow=float(peer_flow[i]),
                market_sentiment=market_sent,
                credit_tightness=market.credit_tightness,
                risk_free_rate=market.risk_free_rate,
                signals=perceived_signals,
                econ=econ_features.get(i, {}),
            )
        return obs_list

    def record_action_direction(self, actor_id: int, direction: float) -> None:
        self.last_action_dir[actor_id] = direction

    def reset_action_directions(self) -> None:
        self.last_action_dir[:] = 0.0
