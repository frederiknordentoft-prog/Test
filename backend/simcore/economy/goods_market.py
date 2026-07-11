"""Real-economy goods loop: customers -> firms -> suppliers, with pro-rata
rationing on both supplier capacity and firm inventory.

Coupling to the capital market happens through exactly three channels
(docs/architecture.md §10):
1. fundamentals -> market: listed firms' smoothed earnings set the fundamental
   value per share that fundamentalist investors trade against;
2. market -> firms: Tobin-q (price/fundamental) scales investment appetite
   (read by FirmModel via econ features);
3. credit both ways: loan losses hit banks, bank tightening raises loan rates,
   defaults follow (CreditSystem).

Event hooks: actors carry multiplicative factors in internal_state —
``capacity_factor`` (stoppage, cyberattack), ``cost_index`` (commodity spike),
``income_factor`` (demand shock). Defaults are 1.0.
"""
from __future__ import annotations

from typing import TYPE_CHECKING

import numpy as np

from simcore.agents.actor import Actor
from simcore.information.signals import Signal
from simcore.models.actions import Action, ActionIntent
from simcore.models.actor_state import ActorType
from simcore.models.config import SimConfig

if TYPE_CHECKING:
    from simcore.agents.population import PopulationArrays
    from simcore.information.signals import SignalBus
    from simcore.markets.asset import MarketState
    from simcore.markets.credit import CreditSystem
    from simcore.networks.layers import MultiLayerNetwork

CAPEX_UNITS_OF_INPUT = 3.0  # capacity units cost ~3x an input unit


class GoodsMarket:
    def __init__(self, config: SimConfig, actors: list[Actor], net: "MultiLayerNetwork", rng: np.random.Generator):
        self.config = config
        self.actors = actors
        self.net = net
        self.rng = rng
        self.firms = [a for a in actors if a.actor_type == ActorType.FIRM]
        self.suppliers = [a for a in actors if a.actor_type == ActorType.SUPPLIER]
        self.customers = [a for a in actors if a.actor_type == ActorType.CUSTOMER]
        self.employment_index = 1.0
        self.util_baseline = 0.5  # recalibrated by Simulation._calibrate_economy
        if self.firms:
            self.util_baseline = max(float(np.mean([f.econ.utilization for f in self.firms])), 0.05)
        self.avg_price_baseline = (
            float(np.mean([f.econ.price for f in self.firms])) if self.firms else 10.0
        )
        self.firm_defaults_total = 0
        self.supplier_failures_total = 0

    # ------------------------------------------------------------------ #
    def step(
        self,
        tick: int,
        goods_intents: list[ActionIntent],
        market: "MarketState",
        bus: "SignalBus",
        arrays: "PopulationArrays",
    ) -> dict:
        cfg = self.config.economy
        by_actor: dict[int, list[ActionIntent]] = {}
        for it in goods_intents:
            by_actor.setdefault(it.actor_id, []).append(it)

        production_target: dict[int, float] = {}
        purchases: dict[int, float] = {}

        # 1. apply price / production / investment / switching intents
        for actor_id, intents in by_actor.items():
            actor = self.actors[actor_id]
            if not actor.state.alive or actor.econ is None:
                continue
            e = actor.econ
            for it in intents:
                if it.action == Action.SET_PRICE and it.qty > 0:
                    e.price = float(it.qty)
                elif it.action == Action.PRODUCE:
                    production_target[actor_id] = float(it.qty)
                elif it.action == Action.INVEST and it.qty > 0:
                    capex = it.qty * CAPEX_UNITS_OF_INPUT * self._avg_supplier_price()
                    if actor.state.cash > capex:
                        actor.state.cash -= capex
                        e.capacity += float(it.qty)
                        e.employees = e.capacity / 10.0
                elif it.action == Action.PURCHASE:
                    purchases[actor_id] = float(it.qty)
                elif it.action == Action.SWITCH_FIRM:
                    self._switch_firm(actor)

        # 2. input ordering, supplier rationing, production
        supplier_orders: dict[int, dict[int, float]] = {s.id: {} for s in self.suppliers}
        firm_targets: dict[int, float] = {}
        for firm in self.firms:
            if not firm.state.alive:
                continue
            e = firm.econ
            cap_factor = float(firm.state.internal_state.get("capacity_factor", 1.0))
            cap = e.capacity * cap_factor
            target = min(production_target.get(firm.id, cap * e.utilization), cap)
            links = [s for s in self.net.neighbors("supplier", firm.id)
                     if self.actors[s].state.alive]
            if not links:
                target = 0.0
            est_unit = self._avg_supplier_price() + cfg.wage_per_capacity
            afford = firm.state.cash / max(est_unit, 1e-9)
            target = float(np.clip(target, 0.0, max(afford, 0.0)))
            firm_targets[firm.id] = target
            if target <= 0 or not links:
                continue
            strengths = np.array(
                [self.net.layers["supplier"].edges[firm.id, s].get("strength", 0.5) for s in links]
            )
            strengths = strengths / strengths.sum()
            for s, w in zip(links, strengths):
                supplier_orders[s][firm.id] = target * float(w)

        deliveries: dict[int, float] = {f.id: 0.0 for f in self.firms}
        input_costs: dict[int, float] = {f.id: 0.0 for f in self.firms}
        for supplier in self.suppliers:
            if not supplier.state.alive:
                continue
            e = supplier.econ
            orders = supplier_orders.get(supplier.id, {})
            total = sum(orders.values())
            cap_factor = float(supplier.state.internal_state.get("capacity_factor", 1.0))
            cap = e.capacity * cap_factor
            ratio = 1.0 if total <= cap else (cap / total if total > 0 else 0.0)
            delivered_total = 0.0
            for firm_id, q in orders.items():
                d = q * ratio
                deliveries[firm_id] += d
                input_costs[firm_id] += d * e.price
                delivered_total += d
            cost_index = float(supplier.state.internal_state.get("cost_index", 1.0))
            revenue = delivered_total * e.price
            costs = delivered_total * e.unit_cost * cost_index
            e.revenue = revenue
            e.earnings = revenue - costs
            e.earnings_smoothed = cfg.earnings_smoothing * e.earnings_smoothed + (1 - cfg.earnings_smoothing) * e.earnings
            e.utilization = delivered_total / max(cap, 1e-9)
            supplier.state.cash += e.earnings
            # organic capacity adaptation: expand when persistently maxed out
            if e.utilization > 0.9:
                e.capacity *= 1.02
            elif e.utilization < 0.15:
                e.capacity *= 0.995
            e.loss_streak = e.loss_streak + 1 if e.earnings < 0 else 0
            if e.loss_streak >= cfg.supplier_fail_losses or supplier.state.cash < -0.5 * supplier.state.initial_wealth:
                self._fail_supplier(tick, supplier, bus, arrays)

        for firm in self.firms:
            if not firm.state.alive:
                continue
            e = firm.econ
            produced = deliveries[firm.id]
            wages = produced * cfg.wage_per_capacity
            firm.state.cash -= input_costs[firm.id] + wages
            e.inventory += produced
            e.utilization = produced / max(e.capacity, 1e-9)
            firm.state.internal_state["wages_paid"] = wages
            firm.state.internal_state["input_cost"] = input_costs[firm.id]
            # supplier substitution: persistently under-supplied firms add a source
            target = firm_targets.get(firm.id, 0.0)
            if target > 0 and produced < 0.7 * target:
                streak = int(firm.state.internal_state.get("supply_shortfall", 0)) + 1
                if streak >= 3:
                    self._add_supplier_link(firm)
                    streak = 0
                firm.state.internal_state["supply_shortfall"] = streak
            else:
                firm.state.internal_state["supply_shortfall"] = 0

        # 3. customer purchases with inventory rationing
        firm_demand_units: dict[int, float] = {f.id: 0.0 for f in self.firms}
        alloc: list[tuple[int, int, float]] = []  # (customer, firm, spend)
        for customer in self.customers:
            if not customer.state.alive:
                continue
            spend = min(purchases.get(customer.id, 0.0), max(customer.state.cash, 0.0))
            if spend <= 0:
                continue
            links = [f for f in self.net.neighbors("customer", customer.id) if self.actors[f].state.alive]
            if not links:
                self._switch_firm(customer)
                links = [f for f in self.net.neighbors("customer", customer.id) if self.actors[f].state.alive]
                if not links:
                    continue
            e = customer.econ
            prices = np.array([max(self.actors[f].econ.price, 1e-9) for f in links])
            strengths = np.array(
                [self.net.layers["customer"].edges[customer.id, f].get("strength", 0.5) for f in links]
            )
            weights = strengths * prices ** (-self.config.economy.demand_elasticity)
            weights = weights / weights.sum()
            for f, w in zip(links, weights):
                spend_f = spend * float(w)
                alloc.append((customer.id, f, spend_f))
                firm_demand_units[f] += spend_f / max(self.actors[f].econ.price, 1e-9)

        sold_ratio: dict[int, float] = {}
        for firm in self.firms:
            e = firm.econ
            demand = firm_demand_units.get(firm.id, 0.0)
            sold = min(demand, e.inventory)
            sold_ratio[firm.id] = sold / demand if demand > 0 else 0.0
            e.revenue = sold * e.price
            e.inventory -= sold
            firm.state.cash += e.revenue
            firm.state.internal_state["demand_units"] = demand
            firm.state.internal_state["sold_units"] = sold

        total_spent = 0.0
        for customer_id, firm_id, spend_f in alloc:
            actual = spend_f * sold_ratio.get(firm_id, 0.0)
            self.actors[customer_id].state.cash -= actual
            total_spent += actual
            if sold_ratio.get(firm_id, 0.0) < 0.5:  # rationed -> dissatisfaction
                c = self.actors[customer_id]
                c.econ.loyalty = max(0.05, c.econ.loyalty - 0.05)

        # 4. firm earnings, fundamentals (coupling channel 1), distress
        firm_defaults: list[int] = []
        rate_shift = max(0.0, market.risk_free_rate - self.config.market.risk_free_rate)
        discount = self.config.economy.discount_rate + rate_shift
        for firm in self.firms:
            if not firm.state.alive:
                continue
            e = firm.econ
            earnings = e.revenue - firm.state.internal_state.get("input_cost", 0.0) - firm.state.internal_state.get("wages_paid", 0.0)
            shock = float(firm.state.internal_state.pop("earnings_shock", 0.0))
            earnings *= 1.0 - shock
            e.earnings = earnings
            e.earnings_smoothed = cfg.earnings_smoothing * e.earnings_smoothed + (1 - cfg.earnings_smoothing) * earnings
            e.loss_streak = e.loss_streak + 1 if earnings < 0 else 0
            if e.listed_asset and e.listed_asset in market.assets:
                asset = market.assets[e.listed_asset]
                asset.fundamental = max(e.earnings_smoothed, 0.0) / (discount * max(e.shares_outstanding, 1.0))
            if firm.state.cash < -0.25 * max(firm.state.initial_wealth, 1.0) and e.loss_streak >= 3:
                self._fail_firm(tick, firm, market, bus, arrays)
                firm_defaults.append(firm.id)

        # 5. employment + income propagation, next-period budgets
        utils = [f.econ.utilization for f in self.firms if f.state.alive]
        if utils:
            target = float(np.clip(np.mean(utils) / max(self.util_baseline, 0.05), 0.2, 1.5))
            self.employment_index = (
                cfg.employment_smoothing * self.employment_index
                + (1 - cfg.employment_smoothing) * target
            )
        for customer in self.customers:
            if not customer.state.alive:
                continue
            e = customer.econ
            income_factor = float(customer.state.internal_state.get("income_factor", 1.0))
            income = e.base_income * income_factor * (0.6 + 0.4 * self.employment_index)
            customer.state.cash += income
            e.budget = income

        alive_prices = [f.econ.price for f in self.firms if f.state.alive]
        if alive_prices:
            self.avg_price_baseline = 0.98 * self.avg_price_baseline + 0.02 * float(np.mean(alive_prices))

        return {
            "total_production": sum(deliveries.values()),
            "total_sales_value": total_spent,
            "avg_firm_price": float(np.mean(alive_prices)) if alive_prices else 0.0,
            "employment_index": self.employment_index,
            "firm_defaults": firm_defaults,
        }

    # ------------------------------------------------------------------ #
    def _avg_supplier_price(self) -> float:
        alive = [s.econ.price for s in self.suppliers if s.state.alive]
        return float(np.mean(alive)) if alive else 4.25

    def _add_supplier_link(self, firm: Actor) -> None:
        linked = set(self.net.neighbors("supplier", firm.id))
        candidates = [s for s in self.suppliers if s.state.alive and s.id not in linked]
        if not candidates:
            return
        best = min(candidates, key=lambda s: s.econ.utilization)
        self.net.layers["supplier"].add_edge(
            firm.id, best.id, strength=float(self.rng.uniform(0.3, 0.7)),
            trust=0.5, exposure=0.5, dependency=0.5,
        )
        self.net.invalidate("supplier")

    def _switch_firm(self, customer: Actor) -> None:
        alive_firms = [f for f in self.firms if f.state.alive]
        if not alive_firms:
            return
        links = self.net.neighbors("customer", customer.id)
        candidates = [f for f in alive_firms if f.id not in links]
        if not candidates:
            return
        cheapest = min(candidates, key=lambda f: f.econ.price)
        old = None
        if links:
            linked_alive = [f for f in links if self.actors[f].state.alive]
            if linked_alive:
                old = max(linked_alive, key=lambda f: self.actors[f].econ.price)
        self.net.rewire_customer(customer.id, old, cheapest.id, self.rng)

    def _fail_supplier(self, tick: int, supplier: Actor, bus: "SignalBus", arrays: "PopulationArrays") -> None:
        supplier.state.alive = False
        supplier.state.bankrupt_tick = tick
        self.supplier_failures_total += 1
        affected = self.net.neighbors("supplier", supplier.id)
        self.net.remove_actor(supplier.id)
        # substitution: most firms find another supplier, with weaker terms
        alive_sup = [s for s in self.suppliers if s.state.alive and s.id != supplier.id]
        for firm_id in affected:
            if alive_sup and self.rng.random() < 0.7:
                sub = alive_sup[int(self.rng.integers(0, len(alive_sup)))]
                self.net.layers["supplier"].add_edge(
                    firm_id, sub.id, strength=float(self.rng.uniform(0.2, 0.6)),
                    trust=0.5, exposure=0.5, dependency=0.5,
                )
        self.net.invalidate("supplier")
        bus.emit(
            tick,
            Signal("supplier_failure", None, -0.6, -0.4, 0.9, 1.0, supplier.name, tick, social=True,
                   meta={"duration": 4}),
            arrays,
            publicity=0.4,
        )

    def _fail_firm(self, tick: int, firm: Actor, market: "MarketState", bus: "SignalBus", arrays: "PopulationArrays") -> None:
        firm.state.alive = False
        firm.state.bankrupt_tick = tick
        self.firm_defaults_total += 1
        e = firm.econ
        if e.listed_asset and e.listed_asset in market.assets:
            market.assets[e.listed_asset].fundamental *= 0.05
        self.net.remove_actor(firm.id)
        bus.emit(
            tick,
            Signal("firm_bankruptcy", e.listed_asset, -1.0, -0.6, 0.95, 1.0, firm.name, tick, social=True,
                   meta={"duration": 6}),
            arrays,
            publicity=0.8,
        )

    # ------------------------------------------------------------------ #
    def econ_features(
        self,
        credit: "CreditSystem",
        market: "MarketState",
        systemic_score_lagged: dict[int, float],
        default_rate: float,
    ) -> dict[int, dict]:
        """Role-specific perceived features served into Observations."""
        out: dict[int, dict] = {}
        prices = market.prices()
        for firm in self.firms:
            if not firm.state.alive:
                continue
            e = firm.econ
            links = [s for s in self.net.neighbors("supplier", firm.id) if self.actors[s].state.alive]
            input_price = (
                float(np.mean([self.actors[s].econ.price for s in links])) if links else self._avg_supplier_price()
            )
            tobin_q = 1.0
            if e.listed_asset and e.listed_asset in market.assets:
                asset = market.assets[e.listed_asset]
                tobin_q = prices[e.listed_asset] / max(asset.fundamental, 1e-9)
            out[firm.id] = {
                "demand_units": firm.state.internal_state.get("demand_units", e.capacity * 0.5),
                "sold_units": firm.state.internal_state.get("sold_units", 0.0),
                "input_price": input_price,
                "tobin_q": float(np.clip(tobin_q, 0.1, 5.0)),
                "equity_ratio": 1.0,
            }
        for s in self.suppliers:
            if not s.state.alive:
                continue
            out[s.id] = {
                "utilization": s.econ.utilization,
                "cost_index": float(s.state.internal_state.get("cost_index", 1.0)),
            }
        for c in self.customers:
            if not c.state.alive:
                continue
            links = [f for f in self.net.neighbors("customer", c.id) if self.actors[f].state.alive]
            if links:
                link_prices = [self.actors[f].econ.price for f in links]
                avg_price = float(np.mean(link_prices))
                gap = (max(link_prices) - avg_price) / max(avg_price, 1e-9)
            else:
                avg_price, gap = self.avg_price_baseline, 0.0
            out[c.id] = {
                "avg_price": avg_price,
                "baseline_price": self.avg_price_baseline,
                "own_firm_price_gap": gap,
            }
        for actor in self.actors:
            if actor.actor_type == ActorType.BANK and actor.state.alive:
                feats = credit.bank_features(actor.id, self.actors)
                feats["systemic_score"] = systemic_score_lagged.get(actor.id, 0.0)
                out[actor.id] = feats
            elif actor.actor_type == ActorType.REGULATOR and actor.state.alive:
                out[actor.id] = {
                    "systemic_score": systemic_score_lagged.get(actor.id, 0.0),
                    "default_rate": default_rate,
                }
        return out
