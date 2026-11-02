# Research brief: a Danish sportsbook prototype that doesn't look like a sportsbook

> Arbejdstitlen ØRE er siden ændret til **UDFALD**, og prisenheden til **kurs** (2. nov. 2026). Teksten nedenfor er bevaret, som den blev besluttet.

**Scope:** mobile-only (390×844, one thumb). Hero match is FC København vs Brøndby IF at Parken; the second sport is men's handball. Odds are fictional. Synthesised from 7 research lenses (markets, games, broadcast, consumer, outliers, market design, tech). "Unverified" flags from the lenses are kept.

---

## 1. Ten governing insights

1. **Price every outcome in øre per 1 kr payout, so "up" always means "more likely".** Decimal odds run backwards and squash the scale, so they can't be charted like a stock. A 0–100 price makes every finance visual usable. *Example:* "FCK-sejr 54 øre · 54 %" with a "Vis som odds (1,85)" toggle, after Polymarket's "Buy Yes 34¢" and Kalshi/Robinhood's "72¢ · 72% chance".

2. **One seeded simulation must drive every pixel.** If health bars, the score grid, strands, combos and crowd counters come from separate random generators, the visuals disagree and the prototype reads as fake. *Example:* a Web Worker re-simulates the rest of the match 10–20k times every 0.5–2 s. 1X2, windows, scoreline regions, correlated combos and the drawn strands are all queries over that one cloud.

3. **Every move needs a visible cause.** Stack four layers (time decay, pressure drift, order flow, event jumps) and annotate them. *Example:* a chip on the line reads "+6 øre: 3 hjørnespark på 4 min", and a whale trade in the tape sends a shockwave across the chart. The NYT needle backlash showed that unexplained jitter reads as unreliable.

4. **Football is a jump process, so build its rhythm from expiring markets, not from noise.** *Example:* a rolling "Mål 60–65'" contract decays in a sawtooth and snaps to 100 on a goal. Handball (about 60 goals per 60 min) behaves like a Brownian walk and gives stock-like flicker for free.

5. **Set motion in tempo tiers and keep the digits calm.** *Example:* F1 Live Timing removed its flashing gap animations after about 1,000 animations per 90 s overwhelmed fans. Use tiers from T0 (ambient breathing) to T4 (your slip's outcome). Hit-stop is reserved for goals. Digits roll at ≤4 Hz while shapes animate at 60 fps.

6. **Show the distribution and let users own a region of it.** *Example:* ECMWF-style future strands, a 6×6 scoreline terrain you lasso, and quantile dots that read "Du ejer 7 af 20 fremtider = 35 % → 2,70".

7. **Give every number a baseline and every forecast a payoff.** *Example:* Orad's swimming world-record line becomes a ghost line for each open bet. Amazon Prime Vision's "Defensive Alerts" becomes pre-corner halos with a 12-second "Hvem vinder hovedstødet?" market.

8. **Make bet composition a game stage, not a form.** *Example:* Balatro-style chips × mult resolving leg by leg, a Slay the Spire "pick 1 of 3" draft every 15', and FUT chemistry lines explaining "Naiv 7,80 → Korreleret 5,40".

9. **A bet is a position the user manages.** *Example:* "Sælg 142 kr (+42 %)", draggable take-profit/stop-loss lines, "Lås gevinst: +64 kr uanset resultat" (Betfair green-up), and "Theta +3,20 kr/min" on an Under 2,5.

10. **The crowd is the heartbeat between events, and skill is the identity beyond wins.** *Example:* "Kuponer i live 12.408 / 31.920" with a kill feed, a penalty-zone heatmap of about 40,000 taps, and closing-line-value (CLV) judgments ("PERFEKT", "Brilliant !!") that still fire on losing bets. Premium means restraint: dark surfaces, chrome that stays still, team-colour bursts and no confetti. Robinhood had to drop its confetti.

---

## 2. Top 30 borrowable mechanics (deduplicated, ranked by N + W + F)

N = novelty, W = visual wow, F = prototype feasibility, each 1–5. Cycling-only mechanics (Chapatte Cone, terrain profile) are in §6.

1. **Ghost Line** [OUTLIER]. *Sports broadcast:* Orad's Virtual World Record Line (Nine Network, 2000), the OR/WR lines at Paris 2024, Mario Kart ghosts. Every open bet draws a dashed "spøgelse" on the live chart: the path the match must follow for the bet to win (cumulative xG pace for Over 2,5, the required win-probability path for "FCK vinder"). The gap is shaded ice-white when ahead and amber when behind, with a head label like "+0,38 xG foran". Swipe to cycle between your bets. **5/5/5 = 15**

2. **Målvejret: goal nowcast spectrum.** *Weather plus audio:* the Apple Weather / Dark Sky next-hour rain chart and the FabFilter Pro-Q spectrum. Bars for the remaining 5-minute windows show P(next goal in that window). They bounce with pressure and slide left with the clock, under a headline like "Mål sandsynligt inden 72' (61 %)". Tap a bar for a window bet, or drag across bars to price a wider window under the thumb. In handball each bar is 30 s. **5/5/5 = 15**

3. **Match sequencer** [OUTLIER]. *Music production:* Elektron trig conditions, Teenage Engineering OP-XY step components, graphic EQ. The "Byg" screen is 3 tracks (Mål, Hjørne, Kort) × 18 five-minute steps. LED fill shows each slice's probability, and long-press adds a condition ("kun hvis FCK fører"). Live, a playhead sweeps across: hit steps flash and play a note, missed steps go dark. A simple mode is a 10-band goal-time EQ with presets ("Sen dramatik", "Lynstart"). A stretch variant is synth knobs (Mål/Kaos/Tempo) plus an ADSR envelope for *when* the drama happens. Everything is priced as a joint query on the simulation. **5/5/5 = 15**

4. **Kuponer i live, kill feed and bloodstains** [OUTLIER]. *Battle royale and Souls games:* Fortnite/Apex players-remaining counters, Dark Souls bloodstains. A pill shows "Kuponer i live 12.408 / 31.920". The feed reads "67' #9 ⚽ → 4.812 kuponer elimineret". Your slip gets a placement ("Top 3 %") and a "SURVIVED" stamp. Red stains on the match scrubber are sized by how many slips died there, and tapping one replays the moment. **5/5/5 = 15**

5. **Scoreline terrain** [OUTLIER]. *Options payoff diagrams* (Robinhood P&L chart, OptionStrat heatmaps) plus the *Fortnite storm*. A 6×6 grid of final scores: opacity is market probability and tint is your portfolio P&L if that score happens. On a goal, impossible cells burn out and their probability flows to neighbours. A storm ring closes on plausible scores as time runs out. Lasso cells to buy a region, priced at Σp plus margin. **5/5/4 = 14**

6. **Ghost branches and "Schrödinger" VAR** [OUTLIER]. *Options Greeks* (tastytrade/Robinhood delta and theta) and racing-game ghost cars. Three dashed branches leave the live tip: "Mål FCK → 78 øre", "Mål BIF → 31 øre" and "Ingen mål 10 min → 49 øre". Opacity is probability, and a branch solidifies when it happens. During a VAR check two ghost prices hang ("Godkendt 81 / Annulleret 52"). After key moments a counterfactual ghost appears ("Hvis straffen var gået ind"). **5/5/4 = 14**

7. **Futures fan** [OUTLIER]. *Meteorology:* ECMWF ensemble spaghetti, the NHC cone, the Bank of England fan chart. 30–50 translucent simulated goal-difference strands run from NU to 90', with a bold median and p10–p90 bands. Strands re-seed with a stagger on goals. A shot off the post lands as an "observation" dot that pulls the strands toward it, showing the model updating. Scrub to a strand to read its storyline, and "Køb denne fremtid" buys that cluster. **5/5/4 = 14**

8. **Liquidity heat field and stop-loss cascade** [OUTLIER]. *Order-flow analytics:* the Bookmap heatmap, Coinglass/Hyperliquid liquidation maps. Behind the line, heat bands show where crowd orders rest (a "wall" at 50 øre) and where stop-losses cluster. Trades appear as bubbles sized by √stake (mint for buys, coral for sells). After a BIF goal the price runs through the walls and the stops pop in a chain. Trader layer only. **5/5/4 = 14**

9. **Price topography and spatial limit orders** [OUTLIER]. *Sailing and NFL AR graphics:* America's Cup LiveLine (Emmy 2012), Sportvision's yellow first-down line, Karun Singh's xT grid. Faint isolines on the pitch carry the "Næste mål FCK" price if the ball reached them, from 2,40 at midfield to 1,65 at the box edge. The price slides as the ball moves. Long-press a line to arm "Køb hvis bolden krydser her". **5/5/4 = 14**

10. **Pass-network constellation builder** [OUTLIER]. *Football analytics:* StatsBomb-style pass networks. Players are stars at their live average positions and edges thicken as passes accumulate. Drag through 2–3 stars to compose "A → B → mål" (assist plus scorer). Thick edges price short and thin edges long, and the drawn line ignites with the combined price. **5/5/4 = 14**

11. **Rhythm highway for micro-events** [OUTLIER]. *Rhythm games:* Guitar Hero, Beat Saber. Model-predicted micro-events in the next 60 s (corner, shot on target, free kick) flow down a lane toward a strike line, with note size equal to probability. Tap before the line to back the event. Hits burst and misses fade. In handball there are home/away lanes with roughly one note per goal, and PERFECT/GREAT is judged by how early you were relative to the price. **5/5/4 = 14**

12. **Kursuret: rising-odds clock** [OUTLIER]. *Flower auctions:* the Royal FloraHolland clock at Aalsmeer, inverted. A boosted contract's odds hand sweeps from 3,10 to 6,00 over 45 s while a capacity ring (200 slots) drains as others stop it. Press and hold to stop the clock, release to buy. If it sells out, the clock shatters. Danish law treats boosts as promotions, so label it as one. **5/5/4 = 14**

13. **Chemistry lines.** *EA SPORTS FC Ultimate Team.* Bet-builder legs sit as cards on a mini pitch. Green links mean positive correlation (the price contracts) and red links mean anti-correlation. A header reads "Naiv 7,80 → Korreleret 5,40". Drag a card off and its links snap. Correlations are pairwise phi coefficients from the simulation. **5/5/4 = 14**

14. **Chips × Mult slip scoring.** *Balatro* (2025 Apple Design Award). Stake is blue chips and each leg's odds is red mult. On swipe-up, legs fire left to right: card bounce, digit roll (400 ms, 50 ms stagger), a rising pentatonic note, then the payout slams in with shake proportional to its size. The sequence replays when a leg settles. Always show the real payout, unlike Balatro's hidden preview. **4/5/5 = 14**

15. **Hold-to-stake.** *Messaging:* WhatsApp/iMessage voice notes. Hold any outcome chip or chart point. A ring grows and the stake steps 10 → 25 → 50 → 100 → 250 → 500 → 1.000 kr over about 2 s. The payout floats above the thumb. Slide up to lock (the chip springs into the top pill) or slide left to cancel. Releasing without a slide leaves the bet armed for 3 s with a "Lås" button. **5/4/5 = 14**

16. **Draft nodes** [OUTLIER]. *Roguelikes:* Slay the Spire card rewards, Hades boons. At 0', 15', 30', HT, 60' and 75', three market cards fan in with rarity frames set by price: <2,0 white, 2–5 blue, 5–15 purple, 15+ orange with a beam. Pick one for your "Run-deck" and the other two burn. The deck is scored at full time. A seeded "Daily Run" gives everyone the same offers and produces a shareable emoji grid. **5/4/5 = 14**

17. **Skill chain.** *Forza Horizon, Tony Hawk.* Micro-calls ("Næste hjørne: FCK eller BIF?") build an unbanked yellow multiplier (x1,4 → x2,1 → x3,3). Pull down to "Indkassér" with a coin cascade. A wrong call shatters the chain into glass. **5/4/5 = 14**

18. **Seismograph and aftershock markets** [OUTLIER]. *Seismology:* magnitude scale, Omori's law. A scrolling ink trace of |dP/dt| runs along the bottom of the screen. Events write "M 6,4 — Rødt kort". Every M6+ spawns a 5-minute "Efterskælv" market priced from a decaying hazard. **5/4/5 = 14**

19. **Hypothetical-outcome flicker** [OUTLIER]. *Uncertainty-vis research:* HOPs (Hullman et al. 2015; Kale et al. 2018). A combo slip "plays its future": the scoreboard flickers through simulated final scores at about 3 fps ("2-1 ✓", "1-1 ✗") with a tally, so 12 % feels like 1 in 8. **5/4/5 = 14**

20. **Power cards and Jokers.** *Kings League secret weapons, Balatro Jokers, TFT augments.* Three cards per match: "Dobbelt mål (2 min)", "Joker" (reprice one bet once) and "Skjold" (red-card insurance). Drag a card onto the timeline to burn a glowing window. In the prototype these award points or cosmetics, or are labelled, because of Danish bonus rules. **5/4/5 = 14**

21. **Passive-play pips** [OUTLIER]. *Handball officiating:* the IHF rule of at most 4 passes after the passive-play warning (since 1 July 2022). When the referee's arm goes up, 4 pips appear and "Mål i dette angreb?" opens. The market reprices after every pass and settles at a goal or turnover. **5/4/5 = 14**

22. **Range brush and distribution sculptor.** *Kalshi bracket markets, Uniswap v3 ranges, Paradigm Distribution Markets (Dec 2024), quantile dotplots (Kay et al., CHI 2016).* Drag two handles over a live histogram: corners 8–11, first-goal minute, or handball total goals 52–58. The price is the probability mass inside the range. Buckets that are already past collapse and their mass flows to the rest. Handball pro mode lets you pinch your own bell curve against the market's. **5/4/5 = 14**

23. **Pres-indeks Up/Down and Manhattan blocks.** *Polymarket 5/15-minute "Up or Down" markets, the cricket "Manhattan".* A derived pressure index with its published formula on a chip, a horizontal "price to beat" and a 4:59 countdown ring; the user picks Op or Ned, and the next round starts automatically. Beneath it, mirrored 5-minute pressure blocks you bet on by height (lav/mellem/høj). **5/4/5 = 14**

24. **Price traps: limit lines and peak-hold** [OUTLIER for peak-hold]. *TradingView/Hyperliquid order lines; Ableton/Logic peak-hold meters.* Long-press the chart at 30 øre to create "Køb BIF ved 30 øre · 200 kr" with a drag handle. A goal gaps through the line and a fill burst plays. Each selection's LED meter has a peak-hold tick at the best price of the last 60 s that falls slowly. Tap the tick to set a trap there. **5/4/5 = 14**

25. **Straffespark-Kahoot.** *Kahoot!, HQ Trivia, the BeReal window.* A penalty triggers a takeover for everyone: tap one of 9 goal zones within 8 s. At lock, a heatmap of all taps blooms, then the ball's path animates into its zone. The same template works for free kicks and VAR (Står / Annulleres). **4/5/5 = 14**

26. **Ringene with F1 sector colours.** *Apple Fitness rings; F1 mini-sectors.* Each bet-builder leg is a concentric ring that fills live (an Under leg drains instead). Closing a ring fires a spark. The combined price sits in the centre. A sector strip colours each leg green (on track), purple (ahead of price-implied pace), yellow (behind) or red (dead). **4/5/5 = 14**

27. **Fever finale.** *Peggle Extreme Fever, FC walkout reveals.* When a slip is one event from winning after 85', time-scale drops to 0,5–0,6×, a vignette and heartbeat appear, and the payout trembles. At the whistle there's a burst and the user's equipped "Vinder-hymne". Tap to skip, always. **4/5/5 = 14**

28. **Annotated chart, replay scrub and trading halt.** *TradingView Bar Replay, Robinhood scrub, earnings markers, NYSE/Nasdaq LULD halts, fighting-game hit-stop.* Goal, card, VAR and substitution pins sit on the line. Dragging rewinds the score and minute in the header. On an event, all charts freeze for 80 ms, then show a hatched "HANDEL STOPPET · VAR-tjek" band, and reopen with a labelled gap ("+31 pp"). **4/5/4 = 13**

29. **Intent and forecast chips.** *Slay the Spire enemy intents, AWS F1 "Battle Forecast", Prime Vision "Defensive Alerts".* Above each crest, next-10-minute chips: a sword for goal threat (31 %), a flag for corner (62 %), a boot for card pressure. A trailing team gets "Udligning forventet om ~11 min · sværhed: HØJ" with a shrinking arc. Pre-corner halos open flash markets. Every chip is tappable. **4/4/5 = 13**

30. **Bet vitals ward.** *ICU monitors, the IEC 60601-1-8 (2020) auditory-icon alarms, Philips sweep-erase trace.* "Mine spil" becomes a wall of monitor tiles. Each has an ECG sweep at match tempo and an "SpO2" readout for cash-out as % of stake. Three alarm priorities each have their own sound. A dead bet flatlines. A "Defibrillator" hedge charges for 1,5 s before offering a rescue price. **4/4/5 = 13**

**Also strong (13 each, cut for length):** CLV entry judgments (rhythm-game PERFEKT/MISS; chess.com Brilliant/Blunder). "Synk med TV" (a Shazam-style orb that delays app reveals to match the user's TV; no one solves the 5–40 s spoiler gap). Lineup IPO with a 90-second opening auction (Nasdaq Opening Cross). Parken-puljen parimutuel pools (Twitch Predictions plus Danish Tips heritage). Snap/Retreat stake verbs (Marvel Snap). Fighting-game health bars with recoverable damage. Hawk-Eye/walkout settlement reveals. Pulse-duel penalties (WHOOP heart rate on NBC). Live Galton board. Price-impact slider (Uniswap).

**Foundations, not ranked:** øre shares with a trade ticket; position cards (P&L band, TP/SL, "Sælg", green-up); combo as its own ticker; trade tape and Top Holders; copying a calibrated forecaster (eToro plus Brier score).

**Wildcards:**
- "Derby-VIX", a volatility index that trades chaos itself
- Second-order markets ("Handler FCK over 70 øre ved 75'?")
- "Tegn kampen": draw your momentum curve and it's priced as a barrier-option corridor
- Coach-press mention markets (Kalshi announcer markets)
- A Jylland vs Sjælland round index

---

## 3. Visualization pattern library (12)

1. **Breathing Line (hero chart).** A thin probability line over a soft gradient with a pulsing head, event pins, your entry dot and P&L band, the ghost line and ghost branches. *Render:* custom Canvas2D. Use a preallocated Float32Array ring buffer with LTTB downsampling to about 1 point per CSS px. Glow comes from a double stroke (6 px at 15 % alpha, then 2 px), never shadowBlur. The head is a pre-rendered gradient sprite that follows a critically damped spring between 10 Hz ticks. Budget under 1.5 ms per frame. Timeframe pills: "Live 5m / 15m / Kamp / Før kamp / Sæson".
2. **Probability river (1X2 stream).** FCK, Uafgjort and BIF as stacked bands summing to 100 %. Goals snap, the draw band swells at 0-0, and halts show as hatched gaps. It doubles as the shareable post-match receipt. *Render:* d3-shape stack with curveMonotoneX on Canvas, appended per tick. Halts use a CanvasPattern hatch.
3. **Scoreline terrain.** A 6×6 grid with "5+" edges: opacity is probability, tint is P&L on a diverging scale. Cells burn out and mass flows; the storm ring is optional. *Render:* CSS grid animating transform and opacity only, from an 11×11 internal Poisson convolution. Lasso uses pointer events and polygon hit-testing.
4. **Ghost branches and ghost race.** Scenario paths fan out from the tip, and the bet's pace line races the real line with the fill flipping colour at crossings. *Render:* SVG paths over the canvas with Motion pathLength. clipPath fills the area between lines. Scenario prices come from what-if states in the simulation.
5. **Futures fan.** Strands, quantile bands and assimilation dots. *Render:* Canvas with additive blending ("lighter") at alpha 0.08–0.2. The worker returns 50 sampled paths plus per-minute quantiles using common random numbers. Cross-fade over 250–400 ms. Cap at about 50 strands and DPR 2.
6. **Nowcast spectrum.** Forward bars plus a one-line Danish headline. *Render:* 18 DOM bars animated with transform: scaleY. Peak caps fall at 0,3 units/s. Price pills use NumberFlow at ≤2 Hz.
7. **Order-flow heat field with bubbles** (Trader layer, with an optional Betfair-style ladder). *Render:* a PixiJS texture grid (time buckets × 1-øre levels) with alpha from volume and bubble radius from √stake. Use a Bookmap-like orange/blue heat palette so it doesn't fight team colours.
8. **Tremor needle.** A semicircle gauge from FCK through Uafgjort to BIF. The needle wanders inside the live p25–p75 range over a p5–p95 wedge, and its tremor amplitude falls as the match resolves. *Render:* SVG with a simplex-noise target and a spring (stiffness about 120, damping about 8). **The printed number never jitters.** Label the band "typisk udsving".
9. **Market map home (treemap, or ATC radar as an alternative).** Round tiles sized by turnover and coloured by 15-minute change. Tiles flash on goals and morph into the match screen when tapped. *Render:* d3-hierarchy squarify, relaid out at ≤1 Hz. Colour comes from a registered `@property --chg` in OKLCH color-mix, and the morph uses a React `<ViewTransition>`. The radar variant redraws a Canvas at rgba(0,0,0,0.08) per frame for a phosphor fade.
10. **Seismic drum / sweep trace.** A bottom strip showing |dP/dt| or match intensity, ECG-style. *Render:* a persistent canvas where each frame clears only a narrow strip ahead of the sweep, making it the cheapest live chart possible.
11. **Pressure flow-field pitch (data twin).** 2–5k particles flow along an attacking-pressure vector field built from a 16×12 xT grid, pool near the box under pressure, and burst on shots. Diegetic price chips float over players. *Render:* PixiJS ParticleContainer with one soft-dot texture, a RenderTexture faded at alpha 0.08 for trails, and resolution ≤2. Give it its own low-poly art direction so it doesn't look like Sportradar's Live Match Tracker.
12. **Kinetic numerals.** Odometer digits with a 600 ms green/red flash and a trend glyph. *Render:* @number-flow/react with tabular-nums at ≤4 Hz per number. Roboto Flex, animating only the GRAD axis, which changes weight without reflow.

**Global layers:**
- **Certainty-saturation palette (VSUP):** OKLCH chroma = certainty^1.5 × max, quantised to 4 levels. The UI starts the derby desaturated and "develops" into FCK ice-white/blue or Brøndby yellow. A late equaliser drains the colour back out over 400 ms.
- **Juice tiers:** T0 ambient breathing, T1 digit roll, T2 a held market moves (±2–4 px chip shake), T3 match event (80–100 ms hit-stop, ±8 px / 1° shake, shockwave, sound), T4 slip outcome (Fever or reveal). Only one T3 or T4 runs at a time.
- **Two layers of detail:** a "Fan" layer (living line, ghost branches, one-tap betting) and a "Trader" layer (ladder, heat field, TP/SL). Show at most 2 overlays at once, as Sportradar 4Sight does.

---

## 4. Market design shortlist (10)

| # | Bet type | Pricing | Settlement |
|---|---|---|---|
| 1 | **1X2 as øre shares** (river and needle) | Dixon–Coles in-play intensities → Skellam on remaining goals. Power-method margin of about 3–5 %; the buy prices visibly sum to 101–103 (exchange view). | At full time. Sellable any time at the bid. |
| 2 | **Næste mål** (3-way) | Λ_h/(Λ_h+Λ_a)·(1−e^{−(Λ_h+Λ_a)}), with "ingen" = e^{−ΣΛ}. | On the next goal or the final whistle. |
| 3 | **Rolling 5-min windows** (goal, corner, shot) plus the EQ basket | p = 1 − exp(−∫λ dt) over the remaining window, closed form, 8–10 % margin. The EQ basket is a sum of window contracts. | At window end; snaps to 100 on a hit. |
| 4 | **Pres-indeks Op/Ned** | Index as an OU process: P(X_T > X_0) ≈ Φ(drift·τ / (σ√τ)). | On a published formula (e.g. 1,0×xG + 0,1×final-third entries + 0,05×corners per 5 min) shown on a "Afregnes på" chip. |
| 5 | **Scoreline region** (terrain lasso) | Σ cell probabilities from the Poisson convolution plus margin. | At full time. |
| 6 | **Range/bracket** (corners, first-goal minute, handball total) | Mass inside the brackets from the Monte Carlo histogram. Distribution-sculptor mode pays k·(g(x)−f(x)) with a σ floor. | On the official stat at full time. |
| 7 | **Correlated combo** (its own ticker, chemistry lines) | Joint hit-rate in the simulation cloud (never a product of legs), 10–15 % margin. Shown as "Naiv → Korreleret". | Pays only if all legs hit. Sellable mid-match. |
| 8 | **Event-spawned binaries and hvis/så conditionals** (VAR verdict, aftershock, "BIF udligner HVIS #9 skiftes ind før 65'") | VAR uses a live "VAR-sandsynlighed". Aftershock uses an Omori-style decaying hazard. Conditionals use P(B\|A) from the simulation, as in Gnosis Conditional Tokens. | On the decision or at window end. Stake refunded if the condition fails. |
| 9 | **Parken-puljen** (parimutuel) | Multiplier = pool ÷ side × 0,90, with the 10 % take visible. No book risk. | Pro-rata on the result; refunded if unresolved. |
| 10 | **Handball possession contracts and capped supremacy spread** | Possession Markov chain: P(goal\|possession) ≈ 0,55–0,60, +15 pp in power play. The spread is "Aalborg-overlegenhed 4,0–4,5" at 10 kr/goal, capped at ±10 goals so maximum loss ≤ stake. | Per possession; spread at full time. |

**Alternates:**
- Season "buy a band" fan charts (e.g. "Brøndby slutter 2.–3.")
- Kursuret boost clock
- xG "Uheldsforsikring" (parametric insurance)
- Kursfrys, a paid 30-second price lock. The July 2026 Hopper FTC settlement means the fee and cap must be shown up front.

---

## 5. Pricing engine recommendation

Use two layers on one seeded clock: **fundamental model → market layer**. The simulation steps at 10 Hz with a fixed timestep and rendering interpolates at 60 fps. For the demo, compress the match so 1 game minute ≈ 4 s (about 6–7 minutes in total). Add a 1:1 toggle, plus a **demo-director** panel that can trigger a goal, VAR, a red card or a whale trade on demand.

```
Pre-match (Dixon–Coles): λ_FCK ≈ 1.60, λ_BIF ≈ 1.10, ρ ≈ −0.08  → ~50/25/25 fair, Over 2.5 ≈ 51%
In-play intensity:  λ_i(t) = (λ_i/90) · s(t) · m_score · m_red · exp(π_i(t)) · (1 + α·xT(ball zone))
   s(t): 0.85 → 1.25 over the match; m_score: trailing 1.15–1.20, leading 0.90
   m_red: 0.70 for side a man down, 1.15–1.20 opponent (2026 preprint, ~30% drop – unverified)
   π_i: Ornstein–Uhlenbeck pressure  dπ = −θπ dt + σ dW,  θ ≈ 0.05/s, σ ≈ 0.15, clipped
Remaining goals: N_i ~ Poisson(Λ_i), Λ_i = ∫_t^90 λ_i ; 1X2 via Skellam; windows 1 − e^{−∫λ}
Shots: generated from λ, each xG ~ Beta(mean ≈ 0.11) → goals, shots, xG stay consistent
Monte Carlo worker: 10–20k continuations every 0.5–2 s, common random numbers (mulberry32/sfc32)
   → correct-score matrix, hazard per 5-min window, fan quantiles, phi-correlation matrix
Margin (power method): offer π_i = p_i^k, solve k<1 so Σπ_i = 1 + m ; odds = 1/π_i
```

**Market layer** (this is what makes the price feel alive):
- **Micro-noise:** OU jitter on the **logit** of the displayed price (θ ≈ 0,8/s, σ ≈ 0,3–0,5 pp at rest), so the price stays inside 0–100 and reverts to fair.
- **Order flow:** an LMSR crowd book, C(q) = b·ln Σe^{q_i/b}, p_i = e^{q_i/b}/Σe^{q_j/b}. Set b so a median 150 kr ticket moves ≤0,1 pp.
  - Arrivals are a Poisson process at about 2/s with log-normal sizes.
  - About 30 % of flow is "informed" and trades toward fair; there is a home-fan bias.
  - Whales (≥10.000 kr) arrive 1–3 times per half.
  - After events, a Hawkes burst λ(t) = μ + Σα e^{−β(t−t_k)} produces an overshoot that then reverts.
  - Every trade lands in the tape, which is the visible cause of each tick.
- **Event jumps:** a 10–20 s halt (until the decision for VAR), then a gap reopen. Limit orders inside the gap fill in a cascade.
- **Spread:** widens in dangerous phases, freezes during halts, tightens in calm. The book and tape come from the same agents, so the book is never crossed.
- **Margin layers:** about 3–5 % on core 1X2, 8–10 % on micro/window markets, 10–15 % on combos, a visible 10 % take on pools, about 20 % load on option-like add-ons.
- **Cash-out** = stake × odds_taken × p_now × (1 − 3 % haircut). Theta is the per-minute change in that value with no events.
- **Handball:** a possession chain of about 30 s, 7m throws, timeouts, and empty-net 7-vs-6. Target 60–63 goals; the Champions League 2025/26 average was 62,7. Cross-check win probability against Stern: P = Φ((d + μτ)/(σ√τ)), σ ≈ 1 goal/√min.
- **Don't** use Brownian or pm-AMM maths for football. Paradigm says pm-AMM suits steady-information sports like basketball, not soccer.

---

## 6. Second sport: handball (recommended) vs cycling

**Recommendation: men's handball, Aalborg Håndbold vs GOG.** Six of seven lenses chose it.
- **It's in season.** On 1 November the road cycling season is over, so cycling could only be shown as a replay.
- **It moves differently from football.** About 60 goals in 60 minutes behaves like a Brownian walk, which gives continuous stock-like movement next to football's jumps.
- **It has native micro-markets:** passive-play pips, 2-minute power-play windows ("Overtal-plus/minus" over 120 s), possession contracts roughly every 30 s, and a lead-change "oscilloscope".
- **It has national pull:** Denmark won the men's World Championships 2019–2025, Olympic gold in 2024 and the EURO 2026 final (34–27 vs Germany in Herning), and the World Championship is in January 2027.

**Risk:** handball shares football's visual grammar (two teams, a court, a score). Give it its own signature:
- an oscilloscope of score difference with bets on lead changes ("zero crossings")
- a CS2-style round-history strip with "4-0 RUN" badges
- the rhythm highway
- the distribution sculptor
- a BBC-style swingometer

**Cycling as a stretch screen** (the broadcast lens's pick, for maximum visual contrast):
- a fictional "Storebælt-etapen" replay (an homage to the 2022 Roskilde–Nyborg stage)
- a **Chapatte Cone**: breakaway gap against km to go, with chase rates of 60–90 s per 10 km, priced as a first-passage time and marked "Forventet indhentning: km 7,4" [OUTLIER, 5/5/5]
- a crosswind echelon market on the bridge
- a 2,5D terrain profile with group blobs

---

## 7. Danish context (as found, with flags)

**Superliga 2026/27** (per Wikipedia as of 30 Oct 2026, via the lens):
- **Clubs:** AGF, Brøndby, FCK, AC Horsens (promoted), Lyngby (promoted, 1st Division champions), FC Midtjylland, FC Nordsjælland, OB, Randers, Silkeborg, Sønderjyske, Viborg. Vejle and Fredericia were relegated.
- **Format:** 22 rounds, then a top-6/bottom-6 split, 32 rounds in total, ending 30 May 2027.
- **Table:** FCM 28, FCK 26, Viborg 20, FCN 20, Brøndby 19, Horsens 16, OB 14, AGF 12 (defending champions), Silkeborg 12, Randers 11, Lyngby 11, Sønderjyske 8.
- **Derby context:** Brøndby lost the first derby 0–1 at home, so the hero match is the return derby at Parken (capacity 38,009).
- **Unverified:** Elyounoussi (FCK) as top scorer on 7, Bo Svensson at FCK and Jakob Poulsen at AGF. Use "Angriber #9"-style anonymised players and typographic monograms instead of crests.

**Handball:**
- **League:** Bambuni Herreligaen (renamed from HTH Herreligaen), 14 teams, in season in November.
- **2025/26:** Aalborg Håndbold were champions (9th title, beating Skanderborg Aarhus in the final), GOG 3rd, Mors-Thy 4th. KIF Kolding came up via the playoff; Grindsted and HØJ went down.
- **Unverified:** the 14th team for 2026/27.

**Oddset baseline (the thing to escape):**
- Danske Spil, running on OpenBet since 2014. iOS app v2.82.0, 4.3★ from about 55k ratings.
- A browse-by-country list of decimal-odds buttons, "100+ specials per match" in accordions, and a "kupon" slip, a metaphor inherited from Tips (paper coupons since 1949, Tips 13 since 1975).
- Streaming and scoreboards, but no price history; odds just flash up or down.
- **Unverified:** whether Oddset currently has a bet builder or cash-out, and its decimal separator.
- **Pitch framing:** replace the coupon with a portfolio of positions, the button list with probability spaces, and static odds with price history.

**Legal (brief):**
- A real product needs a Spillemyndigheden licence. Polymarket.com has been blocked since August 2026 (Frederiksberg ruling of 8 July; 98 domains), so don't use crypto or USDC language.
- Odds boosts count as promotions: capped at DKK 1,000, terms at most one click away, and at least 60 days to meet conditions.
- No markets on events reserved for under-18s.
- A match-fixing order took effect 1 July 2025. Avoid player card/discipline markets and markets fans can influence (crowd noise). Use those as price inputs only.
- Spreads must be capped. ROFUS self-exclusion would be required.
- None of this blocks a fictional prototype.

**Colour:** FCK and Brøndby both use blue. Use FCK ice-white/cyan and Brøndby yellow (#FFD200), and keep up/down colours (mint/coral) separate from team colours, always paired with arrows or shapes.

---

## 8. Tech recommendation

**Existing repo** (`/home/user/Test/sportsbook-x`, v0.2, verified):
- Already pins React 19.3.1, Vite 8.3.5, TypeScript 7.0.2, Motion 14.9.0, Vitest 5.0.5 and axe-core 4.14.0.
- Has `src/odds/{feed,rng,model,momentum,factline,format}.ts` and `qa/qa.cjs` (axe, Long Tasks under 4× throttle, reduced motion).
- **Conflicts with this brief, so the team must retire or replace them:**
  - The model uses independent Poisson per team; it needs Dixon–Coles plus correlated Monte Carlo.
  - "Kombinér" assumes independence.
  - Probability is shown only on scrub.
  - The tests enforce anti-compulsion wording.

**Stack** (npm-verified 2026-11-01 by the tech lens):
- **Keep the existing pins** listed above.
- **Add:** pixi.js 8.22.0 (one WebGL layer, imperative, `preference:'webgl'`, `autoStart:false`, resolution ≤2), @number-flow/react 0.6.2, d3-hierarchy 3.1.2, d3-shape (stack/area), simplex-noise 4.0.3, and raw Web Audio.
- **Optional:** lightweight-charts 5.2.1 for a "Pro" candle view only.
- **Rejected:** three/r3f (bundle size), @pixi/react (per-frame reconciler cost), Rive/dotLottie (WASM under an undocumented CSP rule, and they need authored assets), lottie-web (eval), GSAP (revocable licence, redundant with Motion), uPlot (owns its redraw), Tone.js. Other lenses suggested some of these; the tech lens's CSP reasoning wins.

**Pipeline:**
1. A pricing worker (ES module) returns transferable Float32Arrays.
2. An engine on the main thread runs a fixed 100 ms step: feed events, pressure, OU jitter, Hawkes flow, margin, halts. It writes a double-buffered snapshot.
3. **One** frame loop (Motion `frame.update`) interpolates, draws Canvas2D charts, calls `app.render()` on Pixi, and sets ≤20 CSS variables.
4. React reads only coarse state through `useSyncExternalStore` (score, minute bucket, halt, slip), at ≤2 commits/s. Navigation goes through startTransition and `<ViewTransition>`; gestures use Motion springs with velocity handoff.
5. **Kick-off gate** ("Tryk for at gå på banen"). One tap lifts WebKit's cross-origin iframe rAF throttle, resumes the AudioContext, sets `navigator.audioSession.type='playback'` and grants sticky activation for Android vibrate.

**Performance budgets:**
- p95 frame ≤16,7 ms at 1× and ≤33 ms at 4× CPU throttle; dropped frames under 5 %.
- Frame-loop JS ≤4 ms; no long tasks or long-animation-frames over 50 ms; ≤5 layouts/s.
- React commits ≤3/s; heap growth under 5 MB per 60 s; CLS 0.
- Initial JS ≤350 KB gzip; first live frame ≤1,5 s at 4×.
- One WebGL context and at most 4 visible 2D canvases.
- An adaptive quality governor steps down if p90 exceeds 18 ms (particles ×0,5 → trails off → resolution 1,5/1 → FX at 30 fps).
- Under reduced motion: no shake or hit-stop, a static FX frame, and data updates still run.

**QA:**
- **Performance:** extend Playwright 1.63.0 (pre-installed). Chromium with swiftshader flags, iPhone 13 and Pixel 7 contexts. Use the CDP CPU throttle at 4× and 6× and observers for long-animation-frame, longtask and layout-shift. Run with FX on and off, because headless GPU timings are meaningless.
- **Visual:** use `page.clock` on the seeded simulation to take golden screenshots at key moments, with `animations:'disabled'` because NumberFlow uses WAAPI. Record one 30 s scripted video.
- **Artifact parity:** inject the artifact CSP and assert zero violations and zero requests to other hosts. Run a cross-origin iframe harness.
- **Real devices:** an iPhone in the Claude iOS app with Web Inspector, and Android Chrome via remote debugging. WebKit isn't installed in this environment.

**Artifact/CSP constraints:**
- Cross-origin sandboxed iframe; `connect-src 'self'`; Google Fonts only (Roboto Flex plus Inter Tight).
- No service worker. Workers from the artifact's own files or blob: URLs are fine.
- No SharedArrayBuffer (no COOP/COEP); WASM support is uncertain.
- Hash routes must be plain `#kamp` names, not `#/paths`. Use `vite base './'`, target es2022, worker format 'es', and publish a multi-file dist.

**iOS:**
- No `navigator.vibrate`, and the checkbox-switch haptic trick is reportedly patched in iOS 26.5 (single source). Carry feedback with motion and sound instead.
- Low Power Mode caps the frame rate at about 30 fps.
- Don't depend on WebGPU: support inside WKWebView is unconfirmed.
- Avoid shadowBlur, and avoid backdrop-filter over canvases that redraw every frame.

---

## 9. Pitfalls and cautionary tales

- **Motion without meaning.** Random jitter reads as fake. The NYT needle was called anxiety-inducing because readers took its motion for unreliable data. Fox's World Cup momentum graphic had no unit or caption (Defector's critique). Every move needs a cause chip, a band label and a toggle.
- **Overload.** F1's roughly 1,000 animations per 90 s; Sportradar 4Sight's limit of 2 overlays; the "Christmas tree" effect on a 390 px screen. Use one hero animation per screen, still chrome, and Fan/Trader layers.
- **Incoherent mock data.** Visuals and prices from different generators, Monte Carlo prices flickering without common random numbers, a crossed order book, or Galton balls not pre-decided from the simulation will all be spotted at once.
- **Naive combo pricing.** Kalshi's combos drew 2026 press about more than $100M in retail losses (about 15 % of cost basis), with under 3 % resolving Yes in one period. Price combos jointly and show the correlation.
- **Football Index** (collapsed 2021 after cutting dividends from about 14p to 3p). Never frame products as "aktier/investering". No perpetual house-backed assets, and no discretionary changes to payout formulas.
- **Cone misreading** (NHC). Fans need visible strands or fading edges so the band isn't read as a guarantee.
- **Gamey or casino styling.** Confetti, gems, mascots and linear easing kill the AAA feel. Robinhood's Massachusetts settlement made it "permanently cease" confetti. Never sell randomised packs; reveals only stage known outcomes.
- **Theatre fatigue.** Pokémon TCG Pocket players ask for skips. Every repeated sequence needs tap-to-skip or 3× speed.
- **Hidden payout.** Balatro hides its score preview; a sportsbook can't. The real potential payout must always be visible, even mid-animation.
- **Probability misperception.** Sid Meier's GDC 2010 talk: players feel 3:1 should always win. Add frequency framing ("3 af 4 kampe som denne").
- **Novel-data settlement.** xG differs by provider, and Sofascore doesn't publish its momentum weights. Show a settlement-source chip on every novel market.
- **Platform realities.** No iOS haptics, audio needs a gesture, thermal throttling after 5–10 minutes, view transitions block input, and per-tick React state causes jank.
- **Research caveats.** Much of the 2025–26 prediction-market material (combo volumes, Polymarket US micro-markets, Squads, native comment badges) comes from secondary or affiliate sources. Game-feel numbers are community analyses, so tune them by feel. Some broadcast sources returned 403/429 errors. Biometric heart rate is GDPR Article 9 health data.

---

## 10. Industries represented

Prediction markets · retail and pro trading · options · stock exchanges · betting exchanges · crypto order-flow · DeFi · crypto governance (futarchy) · social trading · central banking · parametric insurance · travel revenue management · flower auctions · video games (roguelike, card battler, fighting, battle royale, rhythm, racing, sports, Souls-like, casual/pachinko) · esports HUDs · live streaming (Twitch) · creator football (Kings League) · sports broadcast (swimming, F1, NFL, cricket, sailing, cycling, golf) · officiating tech (Hawk-Eye, IHF) · football analytics · meteorology · seismology · medicine (patient monitors) · music production · election data journalism · uncertainty-vis/HCI research · consumer weather · fitness/wearables · messaging · dating apps · short-form video · live quiz/EdTech · mobile OS (Dynamic Island) · air traffic control · music recognition · physics teaching (Galton board).

**Suggested guaranteed set** (each owns one visible hero mechanic; together they clear the minimum of 3 comfortably):
1. **Finance / prediction markets:** øre shares, Breathing Line, halt and gap, price traps
2. **Video games:** Chips × Mult, draft nodes, kill feed, Fever
3. **Meteorology:** Målvejret nowcast, futures fan
4. **Music production:** match sequencer
5. **Sports broadcast:** Ghost Line, intent chips
6. **Seismology** (optional sixth): shock drum with aftershock markets
