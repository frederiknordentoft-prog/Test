# Agent Market Simulator — Architecture

> **Purpose statement:** This system is an *analysis and learning tool* for exploring
> plausible reaction patterns, second/third-order effects, feedback loops, systemic
> risk and emergent behavior in ecosystems of heterogeneous actors. It is **not** a
> financial forecasting model, and its outputs must never be presented as predictions.

## 1. Goals and non-goals

**Goals**

- A generic, modular, tick-based agent simulation engine for 300+ (scalable to 1000+)
  autonomous, heterogeneous actors.
- A financial market plus a simple real-economy layer (firms, suppliers, customers)
  with two-way coupling, so financial and real shocks propagate into each other.
- Structured stochasticity: action probabilities are shaped by each actor's traits,
  state, memory and context — never uniform randomness, never determinism.
- Emergent outcomes: feedback loops (stop-loss cascades, margin spirals, credit
  crunches) arise from actor interaction. No scenario conclusion is hardcoded.
- Full reproducibility from a single master seed.
- Explainable decisions: every logged action carries the drivers that actually
  produced it, extracted from the decision computation itself.

**Non-goals (MVP)**

- Microstructure realism (limit order books, intra-tick sequencing).
- Calibration to real market data or prediction of real outcomes.
- Per-actor LLM reasoning (an adapter interface exists; it is never called in MVP).

## 2. Key model assumptions

1. **Batch time.** Time advances in discrete ticks (minute/hour/day/week/quarter is a
   labeling choice; dynamics parameters are expressed per tick). All actors act
   *simultaneously* within a tick: they observe end-of-previous-tick state, submit
   intents, and a batch clearing resolves them. This removes ordering artifacts.
2. **Simplified price formation.** One call auction per asset per tick. Price impact
   is a bounded function of net order imbalance relative to market depth (see §6).
   Transparent and O(N) — chosen over an order book because the object of study is
   aggregate feedback, not microstructure.
3. **Heterogeneity as data.** Actor types are profiles (trait distributions, allowed
   actions, decision-model mixtures, balance-sheet templates), not subclasses. Traits
   are drawn from configurable distributions (beta, lognormal, gamma, normal, pareto).
4. **Bounded rationality.** Actors perceive distorted, delayed observations, use
   simple heuristics/rules/utility approximations, have finite memory, and make
   probabilistic (not optimal) choices.
5. **Asymmetric information.** An information layer delivers signals with per-actor
   delay and noise; rumors propagate over a social network; price moves are
   themselves public signals (which is what makes herding-on-price possible).
6. **Real economy is a single goods loop.** Customers buy from firms, firms buy
   inputs from suppliers. Coupling to the capital market flows through exactly three
   channels (fundamentals → market; market → cost of capital/investment; credit
   conditions both ways). Labor markets, multi-good production and inventories beyond
   a single buffer are out of scope for MVP.
7. **Money is not strictly conserved.** Banks create credit; the depth pool absorbs
   residual order flow. The model tracks balance sheets per actor but does not
   enforce a closed monetary system.

## 3. System overview

```
┌────────────────────────────────────────────────────────────────────┐
│ frontend/ (React + TS + Vite, Recharts, Zustand)                   │
│   SetupPage ── ConfigForm/PresetPicker      RunPage ── charts      │
└──────────────▲────────────────────────────────▲────────────────────┘
               │ REST (config, results)          │ WebSocket (live frames)
┌──────────────┴────────────────────────────────┴────────────────────┐
│ backend/api (FastAPI)                                              │
│   routes/{runs,configs,results,montecarlo,ws}  runner.py (threads) │
└──────────────▲─────────────────────────────────────────────────────┘
               │ plain Python calls (no HTTP)
┌──────────────┴─────────────────────────────────────────────────────┐
│ backend/simcore  — pure engine, no FastAPI imports                 │
│  engine/      Simulation (tick pipeline), RngHub, clock            │
│  models/      SimConfig, Traits, ActorState, ActionIntent, Event   │
│  agents/      Actor, TypeProfiles, PopulationFactory               │
│  decisions/   stochastic core + rule/heuristic/utility/adaptive    │
│  markets/     Asset, BatchAuction, MarginEngine, CreditSystem      │
│  economy/     goods market loop                                    │
│  networks/    generators, MultiLayerNetwork                        │
│  information/ SignalBus, perception distortion                     │
│  events/      event library, scheduler, scenarios                  │
│  analytics/   indicators, systemic risk score, Monte Carlo         │
│  persistence/ SQLite DAO, Recorder, export                         │
│  config/      YAML loader, presets                                 │
└─────────────────────────────────────────────────────────────────────┘
```

The `simcore` / `api` split is the load-bearing decision: the engine is importable by
tests, the benchmark, the headless CLI and Monte Carlo with zero web dependencies.

## 4. Data model

### Actor (composition, not inheritance)

```python
Actor
├── id: int                  # stable index; also RNG stream key
├── actor_type: ActorType    # enum: retail, institutional, hedge_fund, bank,
│                            #       firm, supplier, customer, regulator, media
├── name: str
├── traits: Traits           # frozen dataclass — drawn once at init
├── state: ActorState        # mutable — evolves every tick
├── econ: EconState | None   # extra block for firm/supplier/customer
├── model: DecisionModel     # injected strategy object
└── rng: np.random.Generator # actor's own stream
```

`Traits` (drawn from per-type distributions): risk_tolerance, loss_aversion,
patience, time_horizon, information_quality, information_delay,
analytical_capability, adaptability, herd_tendency, trust_level, market_power,
network_influence, memory_length, overconfidence, survival_threshold,
action_threshold, regulatory_constraint.

`ActorState`: cash, positions {asset: qty (negative = short)}, margin_debt, loans,
sentiment, stress, confidence, expected_return/expected_risk per asset, reputation,
alive, memory (bounded deque of tick records), peak_wealth, strategy_scores,
internal_state (free-form dict).

`EconState` (economy actors only): price, unit_cost, capacity, inventory, employees,
revenue, earnings_smoothed, budget, loyalty, supplier links etc.

The union of these fields covers the required actor schema (unique_id, actor_type,
objectives via type profile, wealth/liquidity/leverage derived from state,
relationships in the network layers, historical_actions in the decision log).

### Population arrays (columnar mirror)

For hot loops the engine maintains NumPy arrays synced from actor state each tick:
`wealth, cash, leverage, sentiment, stress, alive, market_power, info_quality,
info_delay, herd`. Perception, margin checks, clearing, analytics and signal
propagation read these arrays — only `decide()` iterates Python objects.

## 5. Tick lifecycle (12 stages)

```
1. events        EventScheduler fires due/probabilistic events → effects + signals
2. globals       risk-free rate, credit conditions, employment index update
3. information   SignalBus delivers due signals per actor (delay), rumor spread step
4. perception    per-actor distorted Observation built (noise, delay, bias) [vectorized]
5. update        actors update sentiment, stress, expectations, memory
6. decide        each living actor's DecisionModel → ActionIntents + Explanation
                 (actor order shuffled per tick with the scheduler stream — harmless
                  by construction, see §8, but shuffled anyway for hygiene)
7. margin        MarginEngine converts margin breaches into forced sell intents
8. clearing      BatchAuction per asset: fills, new price, spread, volume
9. economy       goods market step (every econ_period ticks): demand, production,
                 credit, defaults → bankruptcies rewire networks
10. feedback     mark-to-market, wealth/leverage refresh, bankruptcy checks,
                 fundamentals → market signal emission
11. record       Recorder buffers asset ticks, metrics, decisions, trades, events
12. indicators   vectorized analytics + systemic risk score; frame pushed to UI
```

## 6. Market clearing (BatchAuction)

Per asset, per tick:

- Net imbalance: `Q = B − S_vol − m_f · S_forced` where forced sales (margin calls,
  bankruptcy unwinds) carry multiplier `m_f = 1.5` (aggressive flow consumes more
  liquidity). B and S are share quantities.
- Depth: `D_t = D_base · (L_t / L_base) / (1 + κ·σ_t)` — depth grows with the
  liquidity pool `L_t` (moved by provide/withdraw_liquidity actions) and shrinks
  with EWMA volatility `σ_t`.
- **Price update (log space, bounded):**

  `log p*_t = log p_{t−1} + α·tanh(Q_t / D_t) + β·s̄_t·σ_base + ε_t`

  where `s̄_t` is the size-weighted mean sentiment of participants and
  `ε_t ~ N(0, σ_noise²)` from the asset's own RNG stream. `tanh` bounds any single
  tick's impact to ±α — the anti-explosion guard. Actor size and market power enter
  through order quantity, so big actors move price more without special-casing.
- Spread: `spread_t = spread_min + c₁·σ_t + c₂·|Q|/(B+S+ε)`. Buys pay
  `p*·(1+spread/2)`; sells receive `p*·(1−spread/2)`.
- Fills: the smaller side fills 100%; the larger side fills pro rata with ratio
  `f = min(1, (min(B,S) + ρ·D_t) / max(B,S))` — the depth pool absorbs up to `ρ·D_t`
  shares. **Forced orders fill first** within their side; unfilled forced flow rolls
  to the next tick with escalating multiplier — this is how liquidity spirals emerge.
- Volatility: `σ²_t = λ·σ²_{t−1} + (1−λ)·r_t²`, `r_t = log(p*_t/p_{t−1})`.

### Margin engine

Runs before clearing each tick. Equity ratio = `(cash + Σ pos·p − debt) / gross
exposure`. Below `maintenance_margin` → emit forced sell intents sized to restore
`initial_margin` plus buffer. Cascades emerge because forced sales depress `p*`,
which triggers the next round of margin checks next tick.

## 7. Decision framework

Single interface for every model:

```python
model.decide(actor, obs: Observation, ctx: DecisionContext, rng) -> Decision
# Decision(intents: list[ActionIntent], explanation: Explanation)
```

**Structured stochasticity — the shared core** (`decisions/stochastic.py`):

```
drivers = [Driver(name, value, weight), ...]   # weights come from traits
z       = Σ wᵢ·dᵢ
p_act   = 1 / (1 + exp(−k·z))                  # k (decisiveness) falls with patience
act     = rng.random() < p_act
size    ∝ base(wealth) · |z| · risk_tolerance · (1 − stress·loss_aversion) · jitter
```

`Explanation.main_drivers` = top-3 drivers by `|wᵢ·dᵢ|`; `decision_probability =
p_act`. Because the explanation is extracted from the same variables that produced
the action, it cannot drift from behavior (and a unit test asserts the logged
drivers reproduce `z`).

**Model plug-ins** differ only in how they produce drivers and sizing:

| Model      | Driver production |
|------------|-------------------|
| rule-based | threshold rules (stop-loss, expected-return threshold, risk mandate) emitting a dominant driver |
| heuristic  | momentum, mean-reversion vs. anchor, imitation of peers, availability/recency weighting |
| utility    | CRRA mean-variance target weight `w* = (E[r] − r_f)/(γσ²)`; the gap to target is the driver |
| adaptive   | wraps K sub-strategies with scores `S_k ← (1−η)S_k + η·pnl_k`, softmax selection; scores logged as drivers |
| economic   | rule cores for pricing/production/purchasing/credit decisions of firms, suppliers, customers, banks |
| llm        | interface stub only (same signature, `prompt_context` builder); never called in MVP |

Model choice per actor is drawn at init from the type profile's mixture weights.

## 8. Reproducibility (RNG design)

`RngHub` builds a `numpy SeedSequence` tree from the master seed:

```
SeedSequence(master)
 ├─ population stream      (trait draws, network generation)
 ├─ scheduler stream       (actor-order shuffles, tie-breaks)
 ├─ event stream           (occurrence draws, magnitudes)
 ├─ signal stream          (delays, rumor propagation draws)
 ├─ per-asset streams[i]   (price noise)
 └─ per-actor streams[i]   (decision draws)
```

Order-independence holds by construction: (a) every actor draws only from its own
generator, so shuffling execution order never shifts anyone's random sequence;
(b) actors observe only end-of-previous-tick state and all contested allocation
(fills, credit, goods rationing) is pro-rata batch, never first-come. The core is
single-threaded. A CI test runs the same seed twice and asserts identical state
hashes.

## 9. Information & networks

- `MultiLayerNetwork`: named NetworkX graphs (MVP layers: `social`, `information`,
  `customer` (customer→firm), `supplier` (firm→supplier), `credit` (borrower→bank)),
  edges carry `{strength, trust, exposure, dependency}`. Generators: random
  (Erdős–Rényi), small-world (Watts–Strogatz), scale-free (Barabási–Albert),
  clustered (stochastic block-ish). Cached sparse adjacency for propagation.
- `SignalBus`: `Signal(topic, payload, magnitude, truth_value, credibility,
  source_id, created_tick, reach)`. Delivery tick per audience member =
  `created + round(channel_delay · actor.information_delay)`. Rumors spread per tick
  over the social layer with per-edge pass-through probability ∝ edge strength ×
  receiver herd_tendency × signal salience.
- **Perception distortion** when building observations: multiplicative noise scaled
  by `(1 − information_quality)`; features indexed from a history ring buffer at
  `t − delay`; confirmation bias shrinks signals that conflict with current
  sentiment; a credibility gate (`rng < trust × credibility`) decides whether a
  rumor is believed. Actors adjust trust in sources whose signals proved false.

## 10. Real-economy layer

Every `econ_period` ticks:

1. **Customers**: budget = base income × employment index; demand per linked firm
   `∝ budget_share · (p_f/p̄)^(−ε) · (1 + sentiment)`; high price/stress → defer or
   switch firms (loyalty and herd-driven).
2. **Firms**: adaptive markup pricing (raise if sold out, cut if inventory piles
   up); order inputs from linked suppliers (pro-rata rationing when capacity is
   short); produce; pay input costs, wages, interest; smooth earnings. Cash < 0 →
   request bank loan; denied + below survival threshold → default → bankruptcy event
   (equity → ~0, network links rewire).
3. **Suppliers**: reprice on cost index + utilization; fail on sustained losses.

**Exactly three coupling channels** to the capital market:

1. *Fundamentals → market*: listed firm `i`'s fundamental per share =
   `smoothed_earnings_i / discount_rate`; fundamentalist investors trade the gap.
2. *Market → firms*: cost of capital and investment rate scale with
   `p_equity / fundamental` (Tobin-q-lite); a crashed price raises funding cost.
3. *Credit both ways*: bank loan losses raise bank stress → credit conditions
   tighten → loan rates rise for everyone → more defaults (credit-crunch loop).

`economy.enabled: false` must leave the pure market simulation fully functional
(unit-tested).

## 11. Events & scenarios

`Event`: name, description, start_tick (or per-tick probability), duration,
magnitude, targets (actor types/ids/sectors/assets), direct effects (parameter
deltas), signal spec (public/private, credibility, truth), escalation rule.
Scenario = named event sequence + config overlay. MVP library: unexpected rate hike,
profit warning, supplier stoppage, social-media rumor, large institutional sell-off.
Margin-call cascades are *not* an event — they emerge.

## 12. Analytics & systemic risk score

Per tick (vectorized): price/volume/volatility/spread/liquidity per asset; drawdown;
wealth Gini; wealth HHI concentration; mean & p95 leverage; default and bankruptcy
rates; sentiment mean (overall and per type); share of actors under survival
threshold; price-vs-fundamental gap; supplier dependency HHI.

**Systemic risk score (0–100, documented, deliberately simple):** weighted mean of
six normalized components — mean leverage (z vs. config baseline), EWMA volatility,
liquidity depletion (1 − L_t/L_base), forced-sale share of volume, credit tightness,
share of stressed actors. Weights in config, default equal. It is a *dashboard
heuristic*, not a validated risk measure, and the docs say so.

## 13. Persistence

SQLite (WAL), single writer = sim thread via `Recorder` (buffered `executemany`
flush every 25 ticks). Tables: `runs, asset_ticks, metrics, actor_snapshots (every
N ticks), trades, decisions (drivers JSON), events, population, mc_batches,
mc_members`. Live charts read in-memory ring buffers, never SQLite. Export: SQLite →
pandas → CSV/JSON (Parquet and HTML report in phase 2).

## 14. API & execution model

The sim loop is CPU-bound pure Python → it runs in a **thread** (not an asyncio
task), holding a `RunHandle{sim, thread, pause/stop events, step_budget,
target_tps}` registered in an in-process `SimulationRegistry`. Finished runs reload
from SQLite; live runs die with the process (accepted for MVP).

REST: `POST /api/runs`, `POST /api/runs/{id}/(start|pause|resume|stop|step)`,
`GET /api/runs`, `GET /api/runs/{id}`, `/metrics`, `/actors`, `/decisions`,
`/trades`, `/events`, `/export`, `GET /api/presets`, `POST /api/montecarlo`.
WebSocket `/api/runs/{id}/ws` streams coalesced frames (≤10/s, latest wins):
`{tick, prices, vol, spread, volume, liquidity, aggregates, new_events}`. Anything
heavy is REST on demand.

## 15. Testing strategy

- **Unit**: population init & distributions, RNG reproducibility (state hash, two
  `PYTHONHASHSEED`s), clearing math (imbalance sign → price direction, bounds,
  pro-rata fills, forced priority), margin trigger, decision cores (drivers ↔
  explanation consistency), network generators, event effects, economy step,
  bankruptcy, export, API routes (TestClient).
- **Statistical integration** (paired seeds / common random numbers — baseline vs.
  treatment share seed lists so population noise cancels; 12 pairs, small configs):
  1. negative shock lowers mean post-shock prices (mean Δ < −margin and ≥10/12
     seeds directionally negative);
  2. high leverage produces fatter downside (P5 drawdown ratio > threshold);
  3. concentrated supplier structure is more fragile under supplier stoppage
     (higher firm default rate, paired form).
  Marked `@pytest.mark.statistical`; excluded from the default fast suite.

## 16. Performance

Budget: 300 actors × 5 assets × 1000 ticks ≤ ~60 s on a laptop. 3×10⁵ `decide()`
calls at 50–150 µs ≈ 15–45 s; all other stages are vectorized (~10 ms/tick).
`scripts/benchmark.py` prints per-stage timing so regressions are visible. The
1000-actor fast path (batched driver matrices per model type) is phase 2.

## 17. Main tradeoffs

| Decision | Chosen | Rejected | Why |
|---|---|---|---|
| Price formation | batch call auction, bounded impact | limit order book | transparency, O(N), object of study is aggregate feedback |
| Actor types | data profiles + composition | subclass hierarchy | avoids logic fragmentation, keeps vectorization possible |
| Decide loop | per-actor Python | full vectorization | explainability and model heterogeneity; fast enough at 300–1000 |
| Sim execution | thread per run | asyncio task | CPU-bound loop would starve the event loop |
| Persistence | sqlite3 + DAO | ORM | hot write path, tiny schema |
| Frontend charts | Recharts | Plotly.js | bundle size, declarative speed; Plotly used server-side later |

## 18. Phase plan

- **Phase 1 (delivered)**: end-to-end engine with 9 actor types (incl. regulator &
  media), 12 events, 11 scenarios, 5 presets; Setup + Run pages; tests; benchmark.
- **Phase 2 (delivered)**: network visualization; Monte Carlo UI; run comparison
  (with SQLite fallback for archived runs); per-event reaction analysis built from
  the actual decision logs; Parquet + self-contained HTML report + SVG chart
  downloads; saved scenarios; request/config validation hardening.
- **Phase 3 (open)**: vectorized decide fast path for 1000+ actors; parallel Monte
  Carlo; LLM adapter wiring for key actors; custom network editor; labor market;
  multi-good economy; distribution editor UI.
