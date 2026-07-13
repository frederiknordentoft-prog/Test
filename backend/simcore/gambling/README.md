# Gambling domain (v2)

A market-share / attraction model of the **Danish gambling market**, built on
the same engine primitives as the finance domain (RngHub, the stochastic
decision core, the event scheduler, the Recorder). Selected with
`sim_domain: "gambling"` on a `SimConfig`; the API picks the `GamblingSimulation`
class via `make_simulation()` in `api/runner.py`.

## Purpose (unchanged from the brief)

Simulate **market size, market share and number of customers** across four
product tracks — **lotteries, scratch cards, online casino, sports betting** —
and understand how **stakeholders / customers / competitors** react to shocks,
especially wild AI development and adoption.

> This is an illustrative **foresight** tool, not a forecast. Per the design
> perspective, the most important output is *which conclusions are robust across
> the assumptions*, not any single number.

## Market physics (post red-team rework)

Three independent expert critiques (econometrician, market practitioner, UI)
were run against the first build; the market core was reworked accordingly:

- **Outside option ("spiller ikke")** in every track's choice set, with a
  segment-dependent β (low-risk players exit first). Total demand is therefore
  *elastic*: maximal tightening shrinks the market (~−20 % in the default
  calibration) instead of mechanically re-routing every krone offshore. The
  baseline outside share is calibrated jointly with the unlicensed delta
  (alternating bisection) to `participation_start`.
- **The heavy tail is behavioural, not cosmetic**: log-spend is drawn with a
  risk-dependent location (`risk_spend_coupling`), the offshore-propensity axis
  shifts utility toward unlicensed alternatives (`offshore_affinity_beta`), and
  `spend_sigma` defaults to 1.70 (top-5 % ≈ 50-70 % of BSI per international
  priors). Under tightening the top spenders leak offshore ~3× more than the
  breadth — emergently.
- **Customer counts are endogenous**: expected customers per track follow the
  players' per-tick participation probabilities, so policy/AI/entry move them.
- **Policy acts on operator attributes, mediated by per-segment betas** — an ad
  ban zeroes licensed `marketing_reach`, bonus rules cut the `bonus` attribute
  (β3), tax passes through to RTP, enforcement raises unlicensed friction. The
  asymmetry that motivates the whole Spilpakke analysis (acquisition-led Betano
  hit ~2-3× harder than brand/retail DS) emerges from the betas.
- **Baseline growth matches the dossier**: per-track `growth_rate` (casino
  +14.7 %/yr, sports +1.2 %, monopoly flat) plus an optional mean-one
  `baseline_noise`; AI engagement is the *residual* growth channel on top.

## Build order (etaper)

- **Etape 0:** `GamblingConfig` (4 tracks, validated), the `sim_domain`
  switch, a `GamblingSimulation` skeleton, the sports-calendar feature, and the
  parameter register. Baseline reproduces the 2024/25 anchors per track.
- **Etape 1:** heavy-tailed 5-axis player population + customer counts.
- **Etape 2:** multinomial-logit operator choice → market share; channelization
  engine (licensed / offshore / prediction); Danske Spil split into two agents.
- **Etape 3:** AI diffusion + entry/exit/M&A. (*Truly endogenous per-tick
  operator decisions — budget reallocation across marketing/bonus/brand/product
  when channels close — are the next planned wave; operator attributes are
  currently static between policy effects.*)
- **Etape 4:** stakeholder reactions + the four feedback loops.
- **Etape 5:** scenarios + Monte Carlo distributions + robustness report + UI.

## Honest data limitation

The ideal calibration would backtest against Spillemyndigheden's monthly
statistics (2012→now, ~170 observations). That raw series is **not** in this
repo and network access may be restricted, so calibration uses the **2024/25
anchor points** from the research dossier as documented defaults. "Reproduce
historical BSI" is therefore an *anchor match* (hit the known per-track levels
and the known dynamics — e.g. casino overtaking betting), not a full 14-year
fit.

Two contested facts are handled as ranges, not points:

- **Channelization**: 72 % (H2 Gambling Capital) … 91.5 % (Spillemyndigheden).
  Modelled as an interval; only conclusions robust across it are reported.
- **Operator market shares / income concentration**: no official DK source. The
  income-concentration parameter is flagged `red` in `params.yaml` and must be
  swept in sensitivity analysis.

The four modelled tracks sum to ~8.7 bn DKK BSI; total Danish BSI (~11.0 bn)
additionally includes land-based casino and gaming machines, out of scope here.

## Files

| File | Role |
|---|---|
| `config.py` | `GamblingConfig`, `TrackConfig`, `CalendarConfig` (validated) |
| `calendar.py` | sports-intensity seasonality feature |
| `params.yaml` / `params.py` | source-annotated parameter register + loader |
| `market.py` | per-track market-size computation (→ attraction market in Etape 2) |
| `indicators.py` | assembles the per-tick metrics dict (named series) |
| `simulation.py` | `GamblingSimulation` tick pipeline |
| `presets/` | `dk_baseline` lives in `simcore/config/presets/` (auto-discovered) |
