# Kuglebanen 2.0

A deterministic physics **logic puzzle** where you engineer a machine. Every
level shows you a **ghost preview** of exactly how the ball will arrive — a
dashed line from the drop point up to the first piece *you* placed. The game
gives you the input; you design the function: place a limited inventory of
pieces (ramp, bouncer, funnel, booster, portal) into fixed slots, pick the
right ball (iron, wood, basketball — **mass matters**), and send the ball to
the target.

Each of the 14 levels has three solver-proven layers:

- **★1** — the ball reaches the target
- **★2** — ★1 *and* every star coin collected in the same run
- **★3** — ★2 using at most **par** pieces, where par is *derived by the
  solver* (the minimum piece count over all coin-complete wins), never
  hand-authored

There is no randomness, no chance. The same placement always produces the
bit-identical outcome — every collision sound, coin pickup and shattered plank
included. Worlds unlock at 6★ and 16★ (max 42★).

> UI language is Danish (vælg bane, placér brik, slip kuglen …). The code and
> this README are in English.

---

## Tech stack

Vite · React + TypeScript (strict) · Tailwind CSS · Zustand · Dexie
(IndexedDB, schema v2 with a live-user migration) · Matter.js (deterministic,
headless-capable) · Web Audio (oscillators only, no assets) · Vitest ·
vite-plugin-pwa.

---

## Run it

```bash
npm install

npm run dev            # dev server (http://localhost:5173)
npm run build          # typecheck + production build (installable PWA)
npm run preview        # serve the production build (service worker + offline)

npm run typecheck      # tsc --noEmit, zero errors
npm run lint           # eslint
npm test               # Vitest: determinism + mechanics + preview + pack guarantees
npm run solve:levels   # prove the whole pack (stars, par, density); writes solver-report.json
```

`npm run solve:levels k13` solves a single level by id (report file untouched).

### How to play

1. **Vælg bane** — worlds unlock as you earn stars.
2. Watch the **dashed preview**: that is exactly how the ball will arrive.
3. Pick a piece from the palette and **tap a slot** to place it. The radial
   ring opens with only that piece's valid angles — **one tap** selects.
   Tap a placed piece to reopen the ring; **×** returns it to your inventory.
4. Pick a **ball** if the level offers a choice. Iron smashes breakable
   planks; the basketball never can — sometimes the ball *is* the puzzle.
5. **Slip kuglen** — the run replays the precomputed deterministic
   trajectory with material sounds, coin plings and (on a win) slow-mo +
   a star count-up.
6. Chase ★3: beat the level coin-complete within par.

Progress (stars, current level, placements, sound preference) is saved to
IndexedDB via Dexie, so reloading mid-level restores exactly where you were —
offline too, once installed as a PWA.

---

## The pieces

| Piece | Danish | Behaviour |
|-------|--------|-----------|
| `ramp` | Rampe | Long plank — the workhorse deflector. |
| `bouncer` | Trampolin | Springy pad (restitution 0.9) — adds energy, arcs higher than any ramp. |
| `funnel` | Tragt | Wide-gap ∨. Passes a centred ball, catches/redirects a skewed one. |
| `booster` | Booster | On contact **sets** the ball's velocity to `max(arrival, BOOST_SPEED)` along its arrow — "fires you THIS way at THIS speed". Full 360° domain. |
| `portal` | Portal | You place the **entry**; the level owns the exit. Speed is preserved, direction becomes the exit's angle. |

Every piece is a **static** body; orientation is an index into a global
16-step 22.5° table, restricted per type to its meaningful **domain** (ramp
and bouncer 8 half-turn steps, funnel five near-upright tilts, booster all 16,
portal none). The ball is the only moving body — this is what makes the
simulation deterministic and the solver's search space finite.

### The balls

| Ball | Danish | Mass | Feel |
|------|--------|-----:|------|
| `iron` | Jern | ≈ 12.7 | Dense, dead bounce. Smashes any authored plank at ordinary speeds. |
| `wood` | Trækugle | ≈ 3.1 | Middle ground. Breaks planks only when arriving fast. |
| `basketball` | Basketball | ≈ 1.3 | Springy. Never breaks a plank — bounces over instead. |

Mass is mechanical in 2.0: a **breakable plank** shatters iff
`impactSpeed × ball.mass ≥ breakImpulse`. Each level declares which balls the
player may choose (`balls`) — levels where the choice *is* the puzzle offer
several and require the right one.

### Level elements

Walls, pegs and fail zones as in v1, plus **breakable planks** (impulse
threshold), **star coins** (sensor discs, swept-path pickup so a fast ball
can't tunnel past one) and the **portal exit** (position + firing angle,
always drawn).

---

## Project structure

```
data/levels.ts            The 14-level pack (3 worlds) + getLevel()
scripts/solve-level.ts    CLI: prove the pack, write solver-report.json, exit != 0 on any failure
scripts/calibrate.ts      Level-design aid: throw map, per-level diagnostics, arc traces
solver-report.json        Committed solver proof — the app reads par from it
src/types.ts              Core data contracts (LevelDef, Breakable, StarCoin, …)
src/physics/
  constants.ts            Tuning: timestep, materials, rotation table + domains, ball specs
  pieces.ts               Matter body factories (incl. restoring materials Body.setStatic wipes)
  simulate.ts             buildWorld() + simulate() + previewRun() — the deterministic core
  solver.ts               solveLevel(): stars, par, density over ball × slot × domain
  simulate.test.ts        Determinism, mechanics semantics, preview-prefix, pack guarantees
src/game/
  progression.ts          Star scoring, par lookup (from the report), world unlocks
  audio.ts                Oscillator-only Web Audio juice (impact pitch, plings, arpeggio)
  inventory.ts, strings.ts
src/render/
  renderer.ts             Draws the exact Matter bodies + zones/coins/portal + ghost preview
  particles.ts            Seeded-PRNG particle bursts (coin/break/win)
src/store/gameStore.ts    Zustand store: placements, stars, picker, gating, tutorial
src/db/                   Dexie v2 (`gameProgress`) + migration test + persistence hook
src/components/           GameCanvas, RadialPicker, StarRow, BallPicker, LevelSelect, …
```

The physics core (`src/physics`) has **no DOM dependency** — the very same
`simulate()` runs in the browser (preview + replay), in Node (solver + tests).
What you see on screen is a replay of the precomputed trajectory, so it is
guaranteed identical to what the solver proved. The ghost preview is that same
run truncated at your machine's first touch — an exact prefix by construction.

---

## How to add a level

1. Add a `LevelDef` to `data/levels.ts`. Coordinates are board pixels
   (440×680 shipped). New in 2.0: `world`, `intent` (the ONE thing the level
   teaches), `balls`, and optionally `coins`, `breakables`, `portalExit`
   (required iff the inventory has a portal). Keep **slots ≤ 5** and total
   **inventory ≤ 4** — that is what keeps the solver exhaustive and fast.

2. **Prove it:**

   ```bash
   npm run solve:levels
   ```

   The CLI fails unless *every* level: reaches ★1/★2/★3, has par ≤ 3, rejects
   the empty placement on **all** its balls, and fits the strictly *falling*
   solution-density curve inside its world — and the whole pack verifies in
   under 5 minutes. Fix the level, never the verifier.

3. Re-run `npm test` (the fast suite cross-checks the committed report
   against live physics) and commit `solver-report.json` together with the
   level — the app reads each level's **par** from it.

Design tips (measured — see the calibration comment in `data/levels.ts`):
a ramp throws ~±180-210 px from a 190 px fall; the bouncer arcs ~40 px higher
than any ramp; floor-roll targets need `|671 − zoneY| < radius`; place a
mid-air "ring" target on a measured arc when floor targets attract too many
sloppy wins; decoy sockets that *share scarce inventory* lower solution
density without multiplying wins.

---

## Determinism (how it's guaranteed)

- Fixed timestep `Engine.update(engine, 1000/60)`; sleeping disabled; no RNG
  in the loop. Matter's global id/seed counters reset at the top of every
  `buildWorld`; bodies created in a fixed order; placements sorted by slot id.
- The ball is the only dynamic body. New 2.0 mechanics run inside the same
  per-tick pipeline in a fixed order: step → breakables (new contacts) →
  boosters → win/fail + coins on the post-step pose → portal teleport.
- Broken-plank bookkeeping lives in per-run locals — never module state.
- Sounds are derived from trajectory deltas and event ticks; particle bursts
  use a PRNG seeded by (level id, tick). `Math.random()` appears nowhere in
  `src/`.

`npm test` asserts bit-identical trajectories (position + spin) across runs
for every mechanic and ball, placement-order independence, kravspec mechanic
semantics, the preview-prefix property, the Dexie v1→v2 migration, and the
committed solver report against live physics.

---

## Assumptions & scope

**In scope:** single-player puzzle, 14 pre-built levels in 3 star-gated
worlds, fixed candidate slots, limited inventory, solver-proven star economy,
local-only persistence, installable offline PWA, deterministic audio/particle
juice, and a desktop-optimised two-column layout with keyboard controls
(Space = drop, Esc = close the angle picker).

**Explicitly not built (non-goals):** level editor, sharing/backend,
multiplayer, accounts, monetisation, any randomness, free placement,
simultaneous balls. (Stretch idea, unbuilt: multi-drop levels.)

**Assumptions:** modern browser with IndexedDB, Canvas and Web Audio; tuned
for portrait phones (100dvh layout, safe areas, big tap targets, no scrolling
in the game view — verified at 390×844).

See **DECISIONS.md** for the one-line rationale behind each notable choice,
and **docs/kravspec-v2.md** for the full 2.0 design document.
