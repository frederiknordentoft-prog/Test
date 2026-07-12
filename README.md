# Agent Market Simulator

A generic, modular, visual **agent-based simulation environment** where hundreds of
autonomous, heterogeneous actors — retail investors, institutions, hedge funds, banks,
firms, suppliers, customers, regulators and media — make decisions and interact over
time on a financial market coupled to a simple real economy.

> ⚠️ **This is an analysis and learning tool, not a forecasting model.**
> The goal is a controlled experimental environment for exploring *plausible reaction
> patterns*, second- and third-order effects, feedback loops, systemic risk and
> emergent behavior. Outputs are scenario explorations, never predictions, and must
> not be presented as financial advice or forecasts.

## Version 2 — Danish gambling market (branch foresight)

A second simulation **domain** models the **Danish gambling market** for Danske
Spil: the headline outputs are **market size, market share and number of
customers** across four product tracks — **lotteries, scratch cards, online
casino, sports betting** — and how **stakeholders / customers / competitors**
react to shocks, especially **wild AI development and adoption**.

Pick it on the Setup page (**🎲 Gambling market**) or with `domain: "gambling"`
on the API; runs are monthly. Highlights:

- **Players** drawn on five orthogonal, freely-combinable axes (heavy-tailed
  spend, vertical preference, latent risk, age×gender, offshore propensity) —
  never an average player.
- **Attraction market**: a multinomial-logit operator choice → market share, a
  **channelization engine** (licensed vs. **offshore + prediction markets**, both
  non-optional), and **Danske Spil split into two agents** (Lotteri Spil
  monopoly, Licens Spil competition).
- **AI diffusion**: a rising frontier with per-operator S-curve adoption feeding
  personalization + market growth; **entry/exit/M&A** with a frontier-gated
  big-tech entrant.
- **Four feedback loops**: the channelization **false positive** (tightening
  lowers *measured* harm while hidden offshore harm rises), the delayed political
  agent (overshoot), the **udlodning** coalition (resistance to tightening), and
  consolidation (HHI). State **tax revenue** is an output — the core tension.
- **Robustness**, not point estimates: channelization is treated as an interval
  (72–92 %) and income concentration as the #1 uncertain parameter; the
  robustness analysis reports which conclusions hold across the assumption grid.
- Nine policy-grounded presets (`dk_baseline`, `spilpakke_1`,
  `spilpakke_2_prediction`, `prediction_market_surge`, `crash_games_licensed`,
  `wild_ai_boom`, `consolidation_wave`, `light_touch`, `responsible_first`).

> Illustrative **foresight**, not a forecast — calibrated to 2024/25 anchors with
> documented uncertainty. See **[backend/simcore/gambling/README.md](backend/simcore/gambling/README.md)**
> for the model, the parameter register and the honest data limitation.

## What it does

- **300+ heterogeneous actors** (scales to 1000+), each with its own objectives,
  resources, risk tolerance, time horizon, information quality/delay, memory, biases,
  decision logic, relationships and market power — drawn from configurable
  distributions (beta, lognormal, gamma, power-law), never clones.
- **Financial market**: batch call auction per asset per tick with bounded
  order-imbalance price impact, bid-ask spread, liquidity pool, short selling,
  leverage, margin calls and forced-sale escalation. Big actors move prices more;
  crowds of small actors move them together.
- **Real economy**: customers buy from firms, firms buy inputs from suppliers, with
  pro-rata rationing, adaptive pricing, investment, bank credit and bankruptcies —
  coupled to the market via fundamentals, Tobin-q investment and credit conditions.
- **Information layer**: signals with per-actor delay and noise, social-network rumor
  contagion, media amplification, confirmation bias and per-source trust that decays
  when sources are caught lying.
- **Events & scenarios**: 12 generic event types (rate hikes, profit warnings,
  supplier stoppages, rumors, sell-offs, credit tightening, capital requirements,
  commodity spikes, demand drops, tech news, cyberattacks, margin shocks) and 11
  predefined scenarios; custom events via the UI.
- **Emergence, not scripts**: stop-loss cascades, margin spirals, liquidity droughts
  and credit crunches arise from actor interaction. No scenario outcome is hardcoded.
- **Explainability**: every logged decision carries the *actual* drivers that produced
  it (`main_drivers`, `decision_probability`, `stress_level`) — extracted from the
  decision computation, not invented after the fact.
- **Reproducibility**: a single master seed drives a SeedSequence tree (one RNG stream
  per actor/asset/subsystem); identical seeds give identical runs, verified by state
  hashes in CI.
- **Monte Carlo**: run the same scenario across many seeds headless and read
  distributions (median, percentiles, worst case) instead of single paths — with a
  dedicated UI showing percentile tables and outcome histograms.
- **Network visualization**: force-directed view of any relationship layer (social,
  information, customer, supplier, credit); node size = market power, color = actor
  type or sentiment, white ring = systemically important (top-decile centrality).
- **Run comparison**: overlay any metric across 2–4 runs (baseline vs. shock,
  different seeds, leverage regimes); archived runs are reloaded from SQLite.
- **Reaction analysis**: click any event to see who reacted, how, and *why* (driver
  frequencies from the actual decision logs), how the reaction spread tick by tick,
  and second-order effects (margin calls, defaults, credit tightening) in the window.
- **Saved scenarios**: save any setup (preset + overrides + custom events) as a named
  scenario and reload it later.

## Architecture

See **[docs/architecture.md](docs/architecture.md)** for assumptions, the data model,
the 12-stage tick lifecycle, clearing formulas, decision models, and tradeoffs.

```
backend/
  simcore/            pure simulation engine (no web dependencies)
    engine/           tick pipeline, RNG tree, clock
    models/           config schema, traits/state, actions, events
    agents/           actor, type profiles, population factory
    decisions/        rule-based, heuristics, utility, adaptive, economic, LLM stub
    markets/          assets, batch auction, margin engine, credit system
    economy/          goods market loop
    networks/         generators + multi-layer relationship network
    information/      signal bus, perception distortion
    events/           event library, scheduler, scenarios
    analytics/        indicators, systemic risk score, Monte Carlo
    persistence/      SQLite recorder, export
    config/presets/   named preset configurations
  api/                FastAPI: run control, results, WebSocket, Monte Carlo
  scripts/            benchmark.py, run_headless.py
  tests/              unit + statistical integration tests
frontend/             React + TypeScript + Vite + Recharts + Zustand
configs/              your own experiment configs (YAML)
data/                 SQLite database + exports (created at runtime)
```

## Quick start (no Docker)

Requirements: Python 3.11+, Node 20+.

```bash
# backend
cd backend
python -m venv .venv && source .venv/bin/activate   # or use uv
pip install -e ".[dev]"
uvicorn api.main:app --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev            # http://localhost:5173 (proxies /api to :8000)
```

Or build the frontend once and let FastAPI serve everything on one port:

```bash
cd frontend && npm install && npm run build
cd ../backend && uvicorn api.main:app --port 8000   # http://localhost:8000
```

### Docker

```bash
docker compose up --build   # http://localhost:8000
```

*(The compose setup is provided for convenience but was not runnable in the
development sandbox — the non-Docker path above is the fully verified one.)*

### Headless / CLI

```bash
cd backend
python scripts/run_headless.py --preset credit_crunch --seed 7        # single run + CSV export
python scripts/run_headless.py --preset stable_market --montecarlo 20 # 20-seed distribution
python scripts/benchmark.py --actors 300 --ticks 1000                 # performance check
```

## Using the UI

1. **Setup page** — pick a preset (Stable Market, Highly Leveraged, Retail Mania,
   Supply Chain Crisis, Credit Crunch or the default), set actor count, ticks, seed,
   tick resolution, optionally attach a scenario and/or add custom events.
2. **Run page** — start / pause / step (1 or 10 ticks) / change speed / stop / reset.
   - *Market*: asset prices with event markers, price index vs. systemic risk, volume,
     liquidity & credit tightness & forced-sale share, spread, leverage.
   - *Actors*: per-type table (alive/bankrupt, wealth, sentiment, stress, leverage),
     wealth distribution, sentiment/stress/inequality time series, richest actors.
   - *Decisions & events*: live decision log with driver chips (why each actor acted)
     and the event timeline.
   - *Network*: force-graph of the chosen relationship layer with systemic-importance
     highlighting.
3. **Monte Carlo page** — run a preset/scenario across N seeds and read distributions.
4. **Compare page** — overlay a metric across selected runs with a summary table.
5. **Export** (CSV / JSON / Parquet) writes config, population, metrics, asset ticks,
   trades, decisions and events to `data/exports/<run_id>/`; **HTML report** produces
   a self-contained analysis document with embedded interactive charts; every chart
   in the UI has an SVG download button.

## Key API endpoints

```
POST /api/runs                      create (preset_id | config, seed, ticks, scenario, events)
POST /api/runs/{id}/start|pause|resume|stop|reset
POST /api/runs/{id}/step {n}        run n ticks then pause
POST /api/runs/{id}/speed {tps}
GET  /api/runs/{id}                 status + headline metrics
GET  /api/runs/{id}/metrics|assets|actors|decisions|trades|events|network|export
GET  /api/runs/{id}/report          self-contained HTML analysis report
GET  /api/runs/{id}/events/{i}/reactions?window=15   reaction analysis for one event
WS   /api/runs/{id}/ws              live frames (≤10/s, coalesced)
GET  /api/presets | /api/scenarios | /api/event-types
GET/POST/DELETE /api/configs        saved scenarios (reload with saved_id)
POST /api/montecarlo                multi-seed batch; GET /api/montecarlo/{id}
```

Interactive docs at `http://localhost:8000/docs`.

## Model summary

| Layer | Mechanism |
|---|---|
| Price formation | per-asset batch auction; `log p' = log p + α·tanh(Q/D) + β·s̄·σ₀ + ε`; forced sales weighted up and filled first; unfilled forced flow rolls with escalating pressure |
| Depth | `D = depth_frac·shares · (L/L₀) / (1+κσ)` — falls when liquidity is withdrawn or volatility spikes |
| Margin | equity/gross < maintenance → forced de-risking to initial margin; cascades emerge |
| Decisions | drivers → `z = Σ wᵢdᵢ` → `p = logistic(k(|z|−threshold))` → seeded draw → size scaled by risk tolerance, stress, loss aversion; explanation = the same drivers |
| Decision models | rule-based (stop-loss/mandates/entry), momentum, mean-reversion/anchoring, imitation, fundamentalist value, mean-variance utility, adaptive strategy-switching (softmax over scored strategies), plus firm/supplier/customer/bank/regulator/media models; optional LLM adapter (stub) |
| Information | per-actor delay + noise scaled by information quality; rumor contagion over the social graph; credibility gate `rng < trust×credibility`; corrections reduce trust in lying sources |
| Real economy | demand ∝ budget·price^−ε; adaptive markup pricing; supplier rationing & substitution; wages→employment→income feedback; loans, defaults, bankruptcies |
| Coupling | fundamentals = smoothed earnings / discount rate (rate hikes discount fundamentals); Tobin-q gates investment; loan losses tighten credit for everyone |
| Systemic risk score | 0–100 weighted mean of leverage, volatility, liquidity depletion, forced-sale share, credit tightness, stressed-actor share — a documented dashboard heuristic, **not** a validated risk measure |

## Tests

```bash
cd backend
pytest                    # 100+ unit tests (~15 s): finance + gambling domains;
                          # population, RNG reproducibility
                          # (incl. PYTHONHASHSEED variation), clearing math, margin,
                          # decision cores & explanation consistency, networks,
                          # events, economy, credit, export, API end-to-end,
                          # reaction analysis, HTML report, parquet, saved scenarios,
                          # request validation, archived-run fallback; and the
                          # gambling domain (Etape 0-5): calibration/anchors,
                          # 5-axis population, logit shares & channelization,
                          # AI diffusion & entry/M&A, the four loops & the
                          # channelization false positive, Monte Carlo & robustness
pytest -m statistical     # 3 paired-seed integration tests (~minutes):
                          #  1. negative shocks lower average post-shock prices
                          #  2. high leverage fattens downside (deeper drawdowns)
                          #  3. concentrated supplier bases are more fragile
```

Statistical tests use common random numbers (baseline and treatment share seeds) and
interval/sign assertions — individual runs may deviate; the *distribution* must not.

## Performance

Benchmark on a typical laptop: **300 actors × 5 assets × 1000 ticks ≈ 75 s**
(~13 ticks/s), single-threaded. Everything except the per-actor `decide()` call is
vectorized (NumPy + sparse adjacency). `scripts/benchmark.py` prints per-tick timing.

## Known limitations

- The market model is a stylized batch auction — no intra-tick microstructure.
- Money is not strictly conserved (banks create credit; the depth pool absorbs
  residual flow); balance sheets are tracked per actor but the monetary system is open.
- Long baseline runs show boom-bust cycles and can drift — this is emergent herding
  behavior, tunable via presets, not calibrated to any real market.
- Live runs exist in process memory; a server restart keeps SQLite history (metrics
  and run listings survive as archived runs) but drops run control. Regulator/media
  actors are simple first versions.
- Monte Carlo runs sequentially (parallelism is a roadmap item).

## Roadmap

Vectorized decide fast path for 1000+ actors, parallel Monte Carlo, richer
regulator/media behavior, LLM-driven key actors via the existing adapter interface,
custom network editor, labor market, PNG chart export (server-side rendering).

## License / intent

Built as an internal experimentation tool. Simulation outputs are illustrative,
sensitive to assumptions, and unsuitable as a basis for investment decisions.
