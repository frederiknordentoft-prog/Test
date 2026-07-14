"""Investment / deal-returns — the capital-fund lens.

The competitor-intelligence layer (``economics.py``) gives every operator a P&L
and answers *"how does the business perform?"*. A capital fund asks the next
question: *"what return do I make, at what risk, and what kills the thesis?"*

This module lays a private-equity investment case over the market simulation.
A ``DealConfig`` establishes an *owned* operator — a greenfield challenger the
fund backs, an incumbent it buys out, or the long tail it rolls up — finances it
(equity + optional leverage), and holds it for ``hold_years``. The simulation
supplies the owned operator's EBITDA *path* endogenously (its share moves with
competition, AI diffusion and regulation — none of it scripted), and this module
turns that path into the numbers an investment committee reads:

- **IRR / MOIC** on the equity, from the equity cash-flow vector.
- **EV/EBITDA** at entry and exit; **payback**.
- the classic PE **value-creation bridge**: equity gain decomposed into EBITDA
  growth × multiple expansion × deleveraging/FCF.
- run across Monte Carlo seeds → a **distribution** of returns (p5 downside,
  probability of capital loss), never a single number.

Everything reuses the existing engine: the owned operator is placed via the
normal operator/entrant machinery, its cash runway via ``economics``, and its
monthly EBIT via the ``ebit_op_{id}`` metric already emitted each tick. Opt-in:
with no deal the market runs exactly as before, so every calibration anchor holds.

Illustrative foresight — NOT investment advice. Returns are conditional on the
model's assumptions and are shown as distributions with explicit uncertainty.
"""
from __future__ import annotations

from typing import Callable

import numpy as np

from simcore.gambling.config import DealConfig, GamblingConfig, OperatorConfig
from simcore.gambling.simulation import GamblingSimulation
from simcore.models.config import SimConfig

# Deal-level summary keys aggregated into a distribution across seeds.
DEAL_SUMMARY_KEYS = [
    "deal_irr",        # equity IRR (fraction/yr)
    "deal_moic",       # multiple of invested capital (x)
    "equity_value",    # exit equity value (mio DKK)
    "ev_ebitda_exit",  # implied EV/EBITDA at exit (x)
    "payback_years",   # years to return the equity from distributions (hold+1 if never)
]


# --------------------------------------------------------------------------- #
# Small finance helpers (no scipy — a bisection IRR is enough and keeps runs
# reproducible/portable).
def irr(cashflows: list[float], lo: float = -0.95, hi: float = 5.0,
        tol: float = 1e-7, iters: int = 200) -> float | None:
    """Internal rate of return of an annual cash-flow vector (cashflows[0] at
    t=0). Returns None when there is no sign change (e.g. a total loss with no
    positive flow), which the caller renders as an undefined/────— IRR."""
    def npv(r: float) -> float:
        return float(sum(cf / (1.0 + r) ** t for t, cf in enumerate(cashflows)))

    f_lo, f_hi = npv(lo), npv(hi)
    if f_lo == 0.0:
        return lo
    if f_lo * f_hi > 0.0:
        return None
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        f_mid = npv(mid)
        if abs(f_mid) < tol:
            return mid
        if f_lo * f_mid < 0.0:
            hi = mid
        else:
            lo, f_lo = mid, f_mid
    return 0.5 * (lo + hi)


def _percentiles(vals: np.ndarray) -> dict[str, float]:
    """The 8-number distribution summary used across the analytics stack."""
    return {
        "min": float(vals.min()),
        "p5": float(np.percentile(vals, 5)),
        "p25": float(np.percentile(vals, 25)),
        "median": float(np.percentile(vals, 50)),
        "p75": float(np.percentile(vals, 75)),
        "p95": float(np.percentile(vals, 95)),
        "max": float(vals.max()),
        "mean": float(vals.mean()),
    }


# --------------------------------------------------------------------------- #
# Config assembly: establish the owned operator for a deal archetype.
def _apply_deal_to_config(base: SimConfig, deal: DealConfig) -> tuple[SimConfig, GamblingConfig]:
    """Return a (SimConfig, GamblingConfig) where the deal's owned operator is
    established. Greenfield moves the backed entrant to a t0 incumbent; buyout /
    rollup fold the operational improvement into ``operator_overrides``."""
    cfg = base.model_copy(deep=True)
    cfg.sim_domain = "gambling"
    cfg.ticks = deal.hold_years * 12
    gcfg = GamblingConfig.model_validate(cfg.gambling or {})

    if deal.archetype == "greenfield":
        ent = next((e for e in gcfg.entrants if e.operator_id == deal.target), None)
        if ent is None:
            raise ValueError(
                f"greenfield target '{deal.target}' is not a known entrant "
                f"({[e.operator_id for e in gcfg.entrants]})")
        # The fund launches it at t0 — present from month 0, still ramping brand
        # and reach from a low base (a funded greenfield must still build share).
        op = OperatorConfig(**{k: getattr(ent, k) for k in OperatorConfig.model_fields})
        op.entry_tick = 0
        gcfg.entrants = [e for e in gcfg.entrants if e.operator_id != deal.target]
        gcfg.operators = list(gcfg.operators) + [op]
    else:  # buyout / rollup — the target must be an existing operator.
        ids = {o.operator_id for o in gcfg.operators}
        if deal.target not in ids:
            raise ValueError(
                f"{deal.archetype} target '{deal.target}' is not a current operator ({sorted(ids)})")

    if deal.improvement:
        merged = dict(gcfg.operator_overrides.get(deal.target, {}))
        merged.update(deal.improvement)
        gcfg.operator_overrides = {**gcfg.operator_overrides, deal.target: merged}

    cfg.gambling = gcfg.model_dump()
    # Re-validate so operator_overrides / improvement apply and invariants hold.
    return cfg, GamblingConfig.model_validate(cfg.gambling)


def _annual_ebitda(history: list[dict], oid: str, hold_years: int) -> list[float]:
    """Owned operator's EBITDA per hold-year (mio DKK/yr) from the monthly
    ``ebit_op_{oid}`` metric. EBIT here is already after gambling tax, marketing,
    bonus and opex (see economics.py), i.e. an operating-profit proxy."""
    monthly = [float(m.get(f"ebit_op_{oid}", 0.0)) for m in history]
    annual: list[float] = []
    for y in range(hold_years):
        seg = monthly[y * 12:(y + 1) * 12]
        if seg:
            annual.append(float(sum(seg)))
    return annual or [0.0]


def _ttm_nav_path(history: list[dict], oid: str, deal: DealConfig,
                  net_debt_entry: float, net_debt_exit: float) -> list[float]:
    """Monthly equity NAV over the hold: trailing-12-month EBITDA × a multiple
    that re-rates linearly entry→exit, minus net debt interpolated entry→exit.
    An approximation for the uncertainty fan, not the settled exit value."""
    monthly = [float(m.get(f"ebit_op_{oid}", 0.0)) for m in history]
    T = len(monthly)
    if T == 0:
        return []
    nav: list[float] = []
    for t in range(T):
        window = monthly[max(0, t - 11):t + 1]
        ttm = sum(window) * 12.0 / len(window)          # annualized run-rate
        frac = t / (T - 1) if T > 1 else 1.0
        mult = deal.entry_multiple + (deal.exit_multiple - deal.entry_multiple) * frac
        nd = net_debt_entry + (net_debt_exit - net_debt_entry) * frac
        nav.append(max(ttm * mult - nd, 0.0))
    return nav


# --------------------------------------------------------------------------- #
def evaluate_deal(base: SimConfig, deal: DealConfig, seed: int) -> dict:
    """Run one seed of the deal and compute PE returns from the owned operator's
    EBITDA path. Returns a dict with a ``summary`` (the distribution keys), the
    value-creation ``bridge``, and the monthly ``nav_path``."""
    cfg, _ = _apply_deal_to_config(base, deal)
    cfg.seed = int(seed)
    sim = GamblingSimulation(cfg)
    if deal.archetype == "greenfield":
        # The committed equity IS the cash runway the challenger burns while it
        # builds share; if it runs out the operator folds in-sim (a real loss).
        sim.economics.register_runway(deal.target, deal.committed_capital)
    sim.run()

    annual = _annual_ebitda(sim.metrics_history, deal.target, deal.hold_years)
    entry_ebitda = annual[0]
    exit_ebitda = annual[-1]

    # Entry structure ------------------------------------------------------- #
    if deal.archetype == "greenfield":
        equity_entry = max(deal.committed_capital, 1e-6)
        # Bookkeeping so the value bridge stays exact: committed capital sits as
        # net cash (negative net debt) against the entry enterprise value.
        net_debt_entry = entry_ebitda * deal.entry_multiple - equity_entry
    else:
        ev_entry = max(entry_ebitda, 0.0) * deal.entry_multiple
        net_debt_entry = deal.leverage * max(entry_ebitda, 0.0)
        equity_entry = max(ev_entry - net_debt_entry + deal.transaction_cost, 1e-6)

    # Debt schedule over the hold: positive free cash flow sweeps debt, the rest
    # is distributed; burn years draw down the net-cash / add to net debt.
    net_debt = net_debt_entry
    distributions: list[float] = []
    for ebitda_y in annual:
        interest = deal.debt_rate_annual * max(net_debt, 0.0)
        fcf = ebitda_y - interest
        if fcf >= 0.0:
            pay = min(fcf, max(net_debt, 0.0))
            net_debt -= pay
            distributions.append(fcf - pay)
        else:
            net_debt -= fcf                      # fcf < 0 → net debt rises (cash burned)
            distributions.append(0.0)
    net_debt_exit = net_debt

    # Exit ------------------------------------------------------------------ #
    ev_exit = max(exit_ebitda, 0.0) * deal.exit_multiple
    equity_exit = max(ev_exit - net_debt_exit, 0.0)

    # Equity cash-flow vector → IRR / MOIC.
    flows = [0.0] * (deal.hold_years + 1)
    flows[0] = -equity_entry
    for y, div in enumerate(distributions):
        flows[y + 1] += div
    flows[deal.hold_years] += equity_exit
    r = irr(flows)
    total_value = float(sum(distributions) + equity_exit)
    moic = total_value / equity_entry

    # Payback: first year cumulative distributions cover the equity (else hold+1).
    cum = 0.0
    payback = deal.hold_years + 1
    for y, div in enumerate(distributions, start=1):
        cum += div
        if cum >= equity_entry:
            payback = y
            break

    # Value-creation bridge (sums exactly to total_value − equity_entry).
    bridge = {
        "ebitda_growth": (exit_ebitda - entry_ebitda) * deal.entry_multiple,
        "multiple": (deal.exit_multiple - deal.entry_multiple) * exit_ebitda,
        "deleverage_fcf": (net_debt_entry - net_debt_exit) + float(sum(distributions)),
    }

    nav_path = _ttm_nav_path(sim.metrics_history, deal.target, deal,
                             net_debt_entry, net_debt_exit)

    summary = {
        "deal_irr": float(r) if r is not None else -1.0,
        "deal_moic": float(moic),
        "equity_value": float(equity_exit),
        "ev_ebitda_exit": float(deal.exit_multiple),
        "payback_years": float(payback),
        "seed": int(seed),
    }
    detail = {
        "entry_ebitda": float(entry_ebitda), "exit_ebitda": float(exit_ebitda),
        "equity_entry": float(equity_entry), "equity_exit": float(equity_exit),
        "net_debt_entry": float(net_debt_entry), "net_debt_exit": float(net_debt_exit),
        "total_distributions": float(sum(distributions)),
        "total_value": total_value, "irr_defined": r is not None,
    }
    return {"summary": summary, "bridge": bridge, "detail": detail, "nav_path": nav_path}


# --------------------------------------------------------------------------- #
def deal_monte_carlo(base: SimConfig, deal: DealConfig, seeds: list[int],
                     on_progress: Callable[[int, int], None] | None = None,
                     should_stop: Callable[[], bool] | None = None) -> dict:
    """Run the deal across seeds and aggregate into a returns distribution (the
    IC's real question: not one number, but the spread and the downside)."""
    rows: list[dict] = []
    bridges: list[dict] = []
    details: list[dict] = []
    navs: list[list[float]] = []
    for i, seed in enumerate(seeds):
        if should_stop is not None and should_stop():
            break
        res = evaluate_deal(base, deal, seed)
        rows.append(res["summary"])
        bridges.append(res["bridge"])
        details.append(res["detail"])
        navs.append(res["nav_path"])
        if on_progress is not None:
            on_progress(i + 1, len(seeds))

    percentiles: dict[str, dict[str, float]] = {}
    for key in DEAL_SUMMARY_KEYS:
        vals = np.array([r[key] for r in rows]) if rows else np.array([0.0])
        percentiles[key] = _percentiles(vals)

    # Bridge components are additive → the mean bridge still sums to the mean
    # equity gain, so an average is a faithful representative decomposition.
    bridge = {k: float(np.mean([b[k] for b in bridges])) if bridges else 0.0
              for k in ("ebitda_growth", "multiple", "deleverage_fcf")}
    bridge["equity_entry"] = float(np.mean([d["equity_entry"] for d in details])) if details else 0.0
    bridge["equity_exit"] = float(np.mean([d["equity_exit"] for d in details])) if details else 0.0

    nav_fan = _nav_fan(navs)
    prob_loss = float(np.mean([1.0 if r["deal_moic"] < 1.0 else 0.0 for r in rows])) if rows else 0.0
    median = {k: percentiles[k]["median"] for k in DEAL_SUMMARY_KEYS}

    return {
        "n_runs": len(rows),
        "archetype": deal.archetype, "target": deal.target,
        "hold_years": deal.hold_years, "leverage": deal.leverage,
        "entry_multiple": deal.entry_multiple, "exit_multiple": deal.exit_multiple,
        "runs": rows,
        "percentiles": percentiles,
        "median": median,
        "bridge": bridge,
        "nav_fan": nav_fan,
        "prob_loss": prob_loss,
    }


def _nav_fan(navs: list[list[float]]) -> dict[str, list[float]]:
    lengths = [len(s) for s in navs if s]
    if not lengths:
        return {"ticks": [], "p5": [], "p50": [], "p95": []}
    n = min(lengths)
    arr = np.array([s[:n] for s in navs if s])
    return {
        "ticks": list(range(n)),
        "p5": np.percentile(arr, 5, axis=0).round(2).tolist(),
        "p50": np.percentile(arr, 50, axis=0).round(2).tolist(),
        "p95": np.percentile(arr, 95, axis=0).round(2).tolist(),
    }
