"""Simulation: the tick-pipeline orchestrator (docs/architecture.md §5).

Stages per tick:
 1. events            2. globals/corrections   3. information delivery
 4. perception        5. state update           6. decide (shuffled order)
 7. margin calls      8. market clearing        9. economy & credit
10. feedback/bankruptcy  11. recording         12. indicators
"""
from __future__ import annotations

import hashlib
import uuid
from collections import deque
from typing import Callable

import numpy as np

from simcore.agents.population import PopulationFactory
from simcore.analytics.indicators import compute_indicators
from simcore.analytics.systemic import systemic_risk_score
from simcore.decisions.base import DecisionContext
from simcore.economy.goods_market import GoodsMarket
from simcore.engine.rng import RngHub
from simcore.events.scheduler import EventScheduler
from simcore.information.perception import PerceptionEngine
from simcore.information.signals import Signal, SignalBus
from simcore.markets.asset import MarketState
from simcore.markets.clearing import BatchAuction
from simcore.markets.credit import CreditSystem
from simcore.markets.margin import MarginEngine
from simcore.models.actions import Action, ActionIntent, Domain
from simcore.models.actor_state import ActorType
from simcore.models.config import SimConfig
from simcore.networks.layers import MultiLayerNetwork
from simcore.persistence.db import connect
from simcore.persistence.recorder import Recorder


class Simulation:
    def __init__(self, config: SimConfig, db_path: str | None = None, run_id: str | None = None,
                 label: str = ""):
        self.config = config
        self.run_id = run_id or uuid.uuid4().hex[:12]
        self.hub = RngHub(config.seed, config.n_actors, len(config.assets))
        self.actors, self.arrays = PopulationFactory(config, self.hub).build()
        self.market = MarketState.create(config.assets, config.market, config.recording.history_window)
        self.net = MultiLayerNetwork.build(config, self.actors, self.hub.population)
        self.bus = SignalBus(len(self.actors), self.hub.signals)
        self.perception = PerceptionEngine(config, self.actors, self.arrays, self.net, self.hub.perception)
        bank_ids = [a.id for a in self.actors if a.actor_type == ActorType.BANK]
        self.credit = CreditSystem(config, bank_ids)
        self.credit.bind_actors(self.actors)
        self.goods = GoodsMarket(config, self.actors, self.net, self.hub.economy) if config.economy.enabled else None
        self._calibrate_economy()
        self.margin_engine = MarginEngine()
        self.auction = BatchAuction(config.market)
        self.scheduler = EventScheduler(config.events)

        self.tick = 0
        self.internal: dict = {}
        self.event_intents: list[ActionIntent] = []
        self.pending_unwinds: list[ActionIntent] = []
        self.prev_wealth = self.arrays.wealth.copy()
        self.own_returns = np.zeros(len(self.actors))
        self.systemic_history: list[float] = []
        self._last_systemic = 0.0
        self.metrics_history: list[dict] = []
        self.events_log: list = []
        self.recent_decisions: deque = deque(maxlen=3000)
        self.recent_trades: deque = deque(maxlen=3000)

        self.recorder: Recorder | None = None
        if db_path:
            conn = connect(db_path)
            self.recorder = Recorder(conn, self.run_id, config.recording.flush_interval)
            self.recorder.register_run(self, label)

    # ------------------------------------------------------------------ #
    def _calibrate_economy(self) -> None:
        """Set initial firm earnings/utilization to the steady state implied by
        the actual customer network and prices, so fundamentals start
        consistent with initial asset prices instead of drifting at t=0."""
        if self.goods is None:
            return
        cfg = self.config.economy
        firms = self.goods.firms
        customers = self.goods.customers
        suppliers = self.goods.suppliers
        if not firms:
            return
        avg_sup = float(np.mean([s.econ.price for s in suppliers])) if suppliers else 4.25
        unit_cost_est = avg_sup + cfg.wage_per_capacity
        demand_units: dict[int, float] = {f.id: 0.0 for f in firms}
        g = self.net.layers["customer"]
        for c in customers:
            links = [f for f in self.net.neighbors("customer", c.id)]
            if not links:
                continue
            prices = np.array([self.actors[f].econ.price for f in links])
            strengths = np.array([g.edges[c.id, f].get("strength", 0.5) for f in links])
            w = strengths * prices ** (-cfg.demand_elasticity)
            w = w / w.sum()
            spend = c.econ.base_income * cfg.base_demand_budget_share
            for f, wf, pf in zip(links, w, prices):
                demand_units[f] += spend * float(wf) / max(float(pf), 1e-9)
        for firm in firms:
            e = firm.econ
            d = demand_units.get(firm.id, 0.0)
            sold_est = min(d, e.capacity)
            e.unit_cost = unit_cost_est
            e.earnings = sold_est * max(e.price - unit_cost_est, 0.05)
            e.earnings_smoothed = e.earnings
            e.utilization = sold_est / max(e.capacity, 1e-9)
            e.inventory = 0.4 * d
            firm.state.internal_state["demand_units"] = d
            firm.state.internal_state["sold_units"] = sold_est
            if e.listed_asset:
                p0 = next(a.initial_price for a in self.config.assets if a.asset_id == e.listed_asset)
                e.shares_outstanding = max(e.earnings_smoothed, 1.0) / (cfg.discount_rate * p0)
        self.goods.util_baseline = max(
            float(np.mean([f.econ.utilization for f in firms])), 0.05
        )
        self._sync_listed_assets()

    def _sync_listed_assets(self) -> None:
        """Listed firms define share counts and fundamentals of their assets."""
        cfg = self.config
        if not cfg.economy.enabled:
            return
        for actor in self.actors:
            if actor.econ is not None and actor.econ.listed_asset in self.market.assets:
                asset = self.market.assets[actor.econ.listed_asset]
                asset.shares_outstanding = actor.econ.shares_outstanding
                asset.fundamental = max(actor.econ.earnings_smoothed, 0.0) / (
                    cfg.economy.discount_rate * max(actor.econ.shares_outstanding, 1.0)
                )
                asset.depth_shares = max(
                    cfg.market.depth_frac * asset.shares_outstanding, cfg.market.depth_base
                )

    # ------------------------------------------------------------------ #
    def step(self) -> dict[str, float]:
        t = self.tick
        cfg = self.config
        self.event_intents = []

        # 1. external events
        for rec in self.scheduler.process(self):
            self.events_log.append(rec)
            if self.recorder:
                self.recorder.event(rec)

        # 2. global updates (rates/credit move via events & actors); corrections release
        self.bus.release_corrections(t, self.arrays)

        # 3. information delivery + one hop of social contagion
        signals_by_actor = self.bus.collect(t)
        self.bus.social_step(t, self.net, self.arrays)

        # 4. perception: distorted observations
        fundamentals = {aid: a.fundamental for aid, a in self.market.assets.items()}
        default_rate = self.credit.defaults_total / max(1, len(self.actors))
        if self.goods is not None:
            econ_feats = self.goods.econ_features(
                self.credit, self.market, self._lagged_systemic(), default_rate
            )
        else:
            econ_feats = self._institutional_features(default_rate)
        obs_list = self.perception.build_observations(
            t, self.market, signals_by_actor, self.own_returns, econ_feats, fundamentals
        )

        ctx = DecisionContext(
            tick=t,
            asset_ids=list(self.market.assets),
            market=cfg.market,
            config=cfg,
            systemic_score=self._last_systemic,
        )

        # 5. internal state updates (sentiment, stress, expectations, memory)
        for a in self.actors:
            obs = obs_list[a.id]
            if a.state.alive and obs is not None:
                a.update_state(obs, ctx)

        # 6. decisions in shuffled order
        market_intents: list[ActionIntent] = []
        goods_intents: list[ActionIntent] = []
        credit_intents: list[ActionIntent] = []
        liquidity_intents: list[ActionIntent] = []
        info_intents: list[ActionIntent] = []
        self.perception.reset_action_directions()
        sample = cfg.recording.decision_log_sample
        for idx in self.hub.shuffled_indices(len(self.actors)):
            actor = self.actors[idx]
            obs = obs_list[actor.id]
            if not actor.state.alive or obs is None or actor.model is None:
                continue
            decision = actor.model.decide(actor, obs, ctx)
            direction = 0.0
            for intent in decision.intents:
                if intent.action in (Action.PROVIDE_LIQUIDITY, Action.WITHDRAW_LIQUIDITY):
                    liquidity_intents.append(intent)
                elif intent.domain == Domain.MARKET:
                    market_intents.append(intent)
                    direction += intent.qty if intent.action in (Action.BUY, Action.COVER) else -intent.qty
                elif intent.domain == Domain.GOODS:
                    goods_intents.append(intent)
                elif intent.domain == Domain.CREDIT:
                    credit_intents.append(intent)
                elif intent.domain == Domain.INFO:
                    info_intents.append(intent)
            if direction != 0.0:
                self.perception.record_action_direction(actor.id, float(np.sign(direction)))
            if decision.intents or (
                decision.explanation is not None and self.hub.scheduler.random() < 0.05 * sample
            ):
                if self.hub.scheduler.random() < sample:
                    self._log_decision(t, actor, decision)

        # 7. margin calls + pending bankruptcy unwinds
        forced_intents, _calls = self.margin_engine.generate_forced_intents(self.actors, self.market)
        forced_intents.extend(self.pending_unwinds)
        self.pending_unwinds = []

        # 8. clearing
        self.auction.apply_liquidity_intents(liquidity_intents, self.actors, self.market)
        all_market = market_intents + self.event_intents + forced_intents
        orders_by_asset = self.auction.build_orders(all_market, self.actors, self.market)
        for i, (aid, asset) in enumerate(self.market.assets.items()):
            trades = self.auction.clear_asset(t, asset, orders_by_asset[aid], self.market, self.hub.assets[i])
            for tr in trades:
                self.recent_trades.append(tr)
                if self.recorder:
                    self.recorder.trade(tr)

        # 9. economy & credit
        condition_intents = []
        prices = self.market.prices()
        for intent in credit_intents:
            if intent.action == Action.REQUEST_LOAN:
                self.credit.request_loan(self.actors[intent.actor_id], intent.qty, prices)
            elif intent.action == Action.SET_CREDIT_CONDITIONS:
                condition_intents.append(intent)
        if condition_intents:
            self.credit.apply_condition_intents(condition_intents, self.actors, self.market)
        econ_agg = None
        if self.goods is not None and t % cfg.economy.econ_period == 0:
            econ_agg = self.goods.step(t, goods_intents, self.market, self.bus, self.arrays)
        defaulted = self.credit.service_loans(self.actors, self.market.prices())
        for actor_id in defaulted:
            self._kill_actor(self.actors[actor_id], reason="default")
        self.credit.credit_interest_income(self.actors)
        for intent in info_intents:
            self._emit_actor_signal(intent)

        # 10. feedback: mark-to-market, returns, bankruptcy checks
        self.margin_engine.accrue_margin_interest(self.actors, self.market)
        prices = self.market.prices()
        self.arrays.sync(self.actors, prices)
        new_wealth = self.arrays.wealth
        denom = np.maximum(np.abs(self.prev_wealth), 1e-9)
        self.own_returns = np.clip((new_wealth - self.prev_wealth) / denom, -1.0, 1.0)
        self.prev_wealth = new_wealth.copy()
        for actor in self.actors:
            s = actor.state
            if not s.alive or s.initial_wealth <= 0:
                continue
            if actor.actor_type in (ActorType.REGULATOR, ActorType.MEDIA):
                continue
            if s.wealth(prices) <= 0.02 * s.initial_wealth:
                self._kill_actor(actor, reason="bankruptcy")

        # 11. recording
        if self.recorder:
            for aid, asset in self.market.assets.items():
                self.recorder.asset_tick(t, aid, asset.price, asset.fundamental,
                                         asset.volume, asset.sigma, asset.spread)
            interval = cfg.recording.snapshot_interval
            if t % interval == 0 or t == cfg.ticks - 1:
                for actor in self.actors:
                    self.recorder.snapshot(t, actor, prices)

        # 12. indicators
        metrics = compute_indicators(self, econ_agg)
        score = systemic_risk_score(self, metrics)
        metrics["systemic_risk"] = score
        self._last_systemic = score
        self.systemic_history.append(score)
        self.metrics_history.append({"tick": t, **metrics})
        if self.recorder:
            self.recorder.metrics(t, metrics)
            self.recorder.maybe_flush(t)

        self.tick += 1
        return metrics

    # ------------------------------------------------------------------ #
    def run(self, n_ticks: int | None = None,
            on_tick: Callable[[int, dict], None] | None = None,
            should_stop: Callable[[], bool] | None = None) -> None:
        n = n_ticks if n_ticks is not None else self.config.ticks
        for _ in range(n):
            if should_stop is not None and should_stop():
                break
            metrics = self.step()
            if on_tick is not None:
                on_tick(self.tick, metrics)
        if self.recorder:
            self.recorder.flush()
            self.recorder.set_status("finished" if self.tick >= self.config.ticks else "stopped", self.tick)

    # ------------------------------------------------------------------ #
    def _kill_actor(self, actor, reason: str) -> None:
        s = actor.state
        if not s.alive:
            return
        s.alive = False
        s.bankrupt_tick = self.tick
        self.arrays.alive[actor.id] = False
        self.pending_unwinds.extend(MarginEngine.bankruptcy_unwind(actor, self.market))
        self.net.remove_actor(actor.id)
        self.bus.emit(
            self.tick,
            Signal(f"{reason}_{actor.actor_type.value}", None, -0.5, -0.3, 0.9, 1.0,
                   actor.name, self.tick, social=True, meta={"duration": 4}),
            self.arrays,
            publicity=0.25,
        )

    def _emit_actor_signal(self, intent: ActionIntent) -> None:
        actor = self.actors[intent.actor_id]
        meta = intent.meta
        sig = Signal(
            topic=meta.get("topic", "announcement"),
            asset_id=intent.asset_id,
            magnitude=float(intent.qty),
            sentiment_hint=float(np.clip(intent.qty, -1.0, 1.0)),
            credibility=float(meta.get("credibility", 0.7)),
            truth=float(meta.get("truth", 1.0)),
            source=actor.name,
            created_tick=self.tick,
            social=bool(meta.get("amplify", True)),
            meta={"duration": int(meta.get("duration", 4))},
        )
        self.bus.emit(self.tick, sig, self.arrays, publicity=float(meta.get("publicity", 0.5)))

    def _log_decision(self, tick: int, actor, decision) -> None:
        e = decision.explanation
        first = decision.intents[0] if decision.intents else None
        self.recent_decisions.append(
            {
                "tick": tick,
                "actor_id": actor.id,
                "actor_type": actor.actor_type.value,
                "model": e.model_name if e else actor.state.strategy,
                "action": first.action.value if first else "hold",
                "asset_id": first.asset_id if first else None,
                "qty": round(first.qty, 3) if first else 0.0,
                "explanation": e.to_dict() if e else None,
            }
        )
        if self.recorder:
            self.recorder.decision(tick, actor, decision)

    def _lagged_systemic(self) -> dict[int, float]:
        out: dict[int, float] = {}
        hist = self.systemic_history
        for a in self.actors:
            if a.actor_type in (ActorType.BANK, ActorType.REGULATOR):
                d = int(a.traits.information_delay)
                if len(hist) > d:
                    out[a.id] = hist[-1 - d] / 100.0
                elif hist:
                    out[a.id] = hist[0] / 100.0
                else:
                    out[a.id] = 0.0
        return out

    def _institutional_features(self, default_rate: float) -> dict[int, dict]:
        """Bank/regulator features when the economy layer is disabled."""
        lagged = self._lagged_systemic()
        out: dict[int, dict] = {}
        for a in self.actors:
            if a.actor_type == ActorType.BANK and a.state.alive:
                feats = self.credit.bank_features(a.id, self.actors)
                feats["systemic_score"] = lagged.get(a.id, 0.0)
                out[a.id] = feats
            elif a.actor_type == ActorType.REGULATOR and a.state.alive:
                out[a.id] = {"systemic_score": lagged.get(a.id, 0.0), "default_rate": default_rate}
        return out

    # ------------------------------------------------------------------ #
    def state_hash(self) -> str:
        h = hashlib.sha256()
        for asset in self.market.assets.values():
            h.update(np.float64(asset.price).tobytes())
            h.update(np.float64(asset.sigma).tobytes())
        h.update(np.round(self.arrays.wealth, 6).tobytes())
        h.update(np.round(self.arrays.sentiment, 6).tobytes())
        h.update(self.arrays.alive.tobytes())
        for a in self.actors:
            for k in sorted(a.state.positions):
                h.update(k.encode())
                h.update(np.float64(round(a.state.positions[k], 6)).tobytes())
        return h.hexdigest()
