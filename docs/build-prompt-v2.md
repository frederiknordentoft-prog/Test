# Build: Kuglebanen 2.0 — autonomous one-shot rebuild spec

## Role & standard
You are a principal full-stack engineer and game programmer. Rebuild Kuglebanen to the 2.0
design end-to-end, unattended, to a production-quality bar. Do not stop to ask questions —
make the best decision, log it to DECISIONS.md (one line: decision + why), and keep going
until the Definition of Done is met and verified. A green build/test run is the minimum bar,
not the goal: the game must be playable, solvable, and *feel* good when exercised like a
player would, and it must end up live at the same public URL.

## Design source of truth
Read `docs/kravspec-v2.md` FIRST and treat it as the design source of truth: pillars, exact
mechanic semantics (rotation domains, booster velocity-set, portal entry/exit, breakable
impulse threshold, coins, preview rule), the star/par economy, the 14-level content plan with
per-level intent, UX flows, juice spec, and acceptance criteria. Where that document and this
prompt conflict: kravspec wins on design, this prompt wins on process. Do not re-litigate
either.

## Goal
Replace Kuglebanen v1 **in place** on this branch (`claude/kuglebanen-physics-puzzle-7dusdm`)
with Kuglebanen 2.0: a deterministic physics logic-puzzle PWA (Danish UI) where the player
sees a ghost-preview of the ball's arrival, engineers a machine from slot-placed pieces
(ramp, bouncer, funnel, booster, portal), picks the right ball (iron/wood/basketball — mass
matters via breakable planks), and chases solver-verified star tiers (target / all coins /
par pieces). 14 levels in 3 worlds with a measured, decreasing solution-density curve.
No randomness anywhere; same inputs ⇒ bit-identical outcome.

## Definition of Done (executable — the run is not finished until ALL pass)
- [ ] `npm run typecheck`, `npm run lint`, `npm run build`, `npm test` all pass clean
- [ ] Vitest determinism proof: bit-identical trajectory (position + spin) across two runs,
      for every mechanic (breakable break/no-break, portal teleport, booster, coins) and
      every ball type; placement-order independence
- [ ] Vitest preview proof: the ghost-preview trajectory is an exact prefix of the real run's
      trajectory for the same placements + ball
- [ ] `npm run solve:levels`: for every one of the 14 shipped levels proves ★1, ★2 and ★3
      achievable, derives `par` (iterative deepening — first depth with a coin-complete win),
      records solution density, verifies no level is winnable with 0 pieces on ANY allowed
      ball, verifies density decreases monotonically within each world, writes
      `solver-report.json`, exits 0, and completes the full pack in ≤ 5 minutes
- [ ] Vitest level-pack tests validate the committed `solver-report.json` example solutions
      against live physics (fast suite, < 10 s — the exhaustive search lives ONLY in
      solve:levels; never put it in vitest)
- [ ] Playwright at iPhone viewport 390×844 (fresh IndexedDB): tutorial overlays → place via
      slot tap → rotate via radial picker (single tap per angle) → ball gating respected →
      ghost preview visible and updating on edits → drop → coin pickup → star count-up →
      ★-persistence → world unlock at the star thresholds → reload restores mid-level state →
      `document.documentElement.scrollHeight <= window.innerHeight + 2` in game view →
      zero console errors
- [ ] Dexie schema v2 migration: loading a database containing a v1 `gameProgress` row must
      not throw; progress intentionally resets (new economy), preferences carry over where
      present. Include a unit test that writes a v1-shaped row and hydrates
- [ ] Installable PWA; offline reload works (service worker precache)
- [ ] Deployed live at `https://frederiknordentoft-prog.github.io/Test/kuglebanen/` with the
      new build's asset hash verified in the served HTML; `/vm/`, `/elpriser/` and the hub
      landing page byte-untouched
- [ ] README.md rewritten for 2.0 (what it is, how to run, how to add a level incl. star/par
      workflow); DECISIONS.md appended, not rewritten

## Architecture (locked — do not re-decide)
- Vite + React + TS (strict) + Tailwind + Zustand + Dexie + Matter.js. Keep the existing
  toolchain, `package.json` scripts, ESLint/TS configs, and `VITE_BASE` handling in
  `vite.config.ts` exactly as they are unless a change is forced; log any forced change.
- Determinism recipe (proven in v1 — reuse verbatim): fixed timestep
  `Engine.update(engine, 1000/60)`; reset Matter's module-global `_nextId`/`_seed` at the top
  of every `buildWorld`; sleeping disabled; the ball is the ONLY dynamic body; placements
  sorted by slotId before body creation; fixed body-creation order. Extend the reset to any
  NEW module-level state you introduce (e.g. broken-plank bookkeeping must live per-world,
  not module-global).
- New mechanics are implemented inside the same headless `simulate()` used by browser, solver
  and tests: breakables (remove static body mid-sim when `impactSpeed × ball.mass ≥
  breakImpulse`), portal (sensor entry → teleport to authored exit, speed preserved, direction
  = exit angle, 10-tick cooldown), booster (on contact set ball velocity to
  `max(|v|, BOOST_SPEED)` along the booster axis), coins (sensor pickup recorded per tick).
  `SimResult` must report: result, reason, steps, trajectory (x, y, spin angle per tick),
  coinsCollected (ids in pickup order), breakablesBroken (ids), and the tick of first
  player-piece contact (for the preview rule).
- Rendering stays replay-of-precomputed-trajectory on canvas (what you see IS what the solver
  computed). The ghost preview is the same `simulate()` truncated at first player-piece
  contact, drawn dashed. Slow-mo is a replay-speed ramp only. Particles use a seeded PRNG
  (seed = level id) — never `Math.random()` anywhere in src/.
- Audio: Web Audio oscillators only (no asset files), driven by trajectory deltas; a muted
  flag in the store, persisted.
- Single-screen view-state toggle (no router). One Dexie table `gameProgress`, schema v2 with
  an `upgrade` migration from v1.

## Key contracts (source of truth for data shape — extend, don't fork)
```ts
type Vec2 = { x: number; y: number }
type PieceType = 'ramp' | 'bouncer' | 'funnel' | 'booster' | 'portal'
type BallType = 'iron' | 'wood' | 'basketball'

// 16-step global angle table (22.5°); per-type domain of valid indices:
// ramp [0..7] · bouncer [0..7] · funnel [0,1,2,14,15] · booster [0..15] · portal [0]
// rotationIndexToRadians(type, index) is the single source of truth; store + solver validate
// indices against the domain; the radial picker renders exactly the domain.

type Slot = { id: string; position: Vec2; allowedTypes: PieceType[] } // [] = any
type Zone = { position: Vec2; radius: number }
type StaticObstacle = { position: Vec2; shape: 'wall' | 'peg'; size?: { x: number; y?: number }; rotation?: number }
type Breakable = { id: string; position: Vec2; size: { x: number; y: number }; rotation?: number; breakImpulse: number }
type StarCoin = { id: string; position: Vec2; radius: number }

type LevelDef = {
  id: string; world: 1 | 2 | 3; name: string; intent: string // designer note from kravspec §6
  boardWidth: number; boardHeight: number
  dropPoint: Vec2
  targetZone: Zone; failZones?: Zone[]
  staticObstacles: StaticObstacle[]
  breakables?: Breakable[]
  coins?: StarCoin[]
  portalExit?: { position: Vec2; rotation: number } // required iff inventory includes portal
  slots: Slot[]                                     // ≤ 5 per level
  inventory: Partial<Record<PieceType, number>>     // total ≤ 4 per level
  balls: BallType[]                                 // 1–3 allowed balls
}

type PlacedPiece = { slotId: string; type: PieceType; rotation: number } // index into 16-table
type Stars = 0 | 1 | 2 | 3

type LevelSolveReport = {
  levelId: string; par: number
  star1: boolean; star2: boolean; star3: boolean
  example: { ballType: BallType; placements: PlacedPiece[] } // a ★2-at-par solution
  solutionDensity: number    // ★1 winners / candidates tried
  candidatesTried: number; elapsedMs: number
  stopReason: 'exhausted' | 'solutionCap' | 'candidateCap' | 'timeBudget'
}
```

## Plan — vertical slices, each gated (build in this order)
### Phase 1 — physics core 2.0, proven headless
Extend types/constants/pieces/simulate with rotation domains, booster, portal, breakables,
coins, first-player-piece-contact tick. Write a throwaway harness (`_smoke.ts`, gitignored)
that proves each mechanic headless in Node: iron breaks a plank / basketball doesn't; portal
preserves speed and redirects; booster velocity-set; coin pickup ticks; determinism
bit-identical across all of it.
Gate: harness output shows every mechanic behaving per kravspec §4, deterministically.

### Phase 2 — solver 2.0 + author the 14 levels iteratively
Solver: iterative deepening by piece count over ball × slot → (type, rotation-domain)
assignments; first coin-complete win depth = par; collect star tiers, density, budgets
(candidate cap + per-level time budget). Then author the 14 levels from kravspec §6 ONE
world at a time, running the solver as you design — fix the level, never the verifier. Use
the v1 trick: when a level is unsolvable, dump per-single-piece landing positions to guide
target/slot placement.
Gate: `npm run solve:levels` passes the full DoD solver line (all tiers, par ≤ 3, density
monotone per world, no empty win on any ball, ≤ 5 min, exit 0).

### Phase 3 — UI 2.0
Ghost preview layer (dashed, live-updating), radial angle picker (domain-only), ball gating
per level, star HUD + count-up result panel with the "what you're missing" hint, world-grouped
level select with locks and par display, Dexie v2 migration, tutorial overlays on level 1.
Gate: full Playwright flow from the DoD passes at 390×844.

### Phase 4 — juice + docs + deploy
Web Audio engine (collision pitch by impact, material timbres, coin plings, win arpeggio,
fail thud, mute toggle), slow-mo target approach, seeded particles, visual polish pass.
Rewrite README, append DECISIONS. Then deploy (see Deploy runbook) and verify live.
Gate: every remaining DoD checkbox, verified on the live URL.

## Self-verification loop (after EVERY phase)
1. typecheck + lint + build + test + (from Phase 2) solve:levels.
2. Exercise the new slice like a player via Playwright at 390×844; read the screenshots you
   take — actually look at them for visual regressions, don't just assert selectors.
3. Anything failing or feeling wrong: fix and repeat. Do not advance a phase until its gate
   is green. After Phase 4, re-read kravspec §11 + this DoD and confirm every line against
   the actual built, deployed result.

## Deploy runbook (proven in v1 — follow exactly)
1. Commit + push the app branch first (`git push -u origin claude/kuglebanen-physics-puzzle-7dusdm`,
   retry ×4 with backoff on network failure only).
2. Build the deployable bundle: `VITE_BASE=/Test/kuglebanen/ npm run build`.
3. `git fetch origin claude/wc2026-tournament-app-k42mv8 && git worktree add /home/user/hub
   claude/wc2026-tournament-app-k42mv8` (reset hard to origin if the worktree already existed).
4. Replace ONLY the `kuglebanen/` folder in the hub worktree with `dist/`. NEVER touch `vm/`,
   `elpriser/`, `notes/`, `index.html` (the landing card already exists) or `.github/`.
   Verify with `git status` that only `kuglebanen/` changed before committing.
5. Commit, push the hub branch (same retry rule) — this triggers the Pages workflow
   (`deploy-pages.yml`).
6. Poll the live URL for the NEW asset hash (grep the served HTML for the `index-*.js`
   filename from your dist) — background loop, ~6 s interval, give it a few minutes. Then
   verify: JS served as `application/javascript`, manifest scoped to `/Test/kuglebanen/`,
   `/vm/` and `/elpriser/` still 200 with their original titles.
7. Remove the worktree.

## Operational notes (hard-won in the v1 sessions — trust these)
- Browser automation: `npm install --no-save playwright-core`; launch with
  `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`. Never run
  `playwright install`.
- Wipe IndexedDB (`indexedDB.deleteDatabase('kuglebanen')` + reload) at the start of every
  scripted scenario; use `waitUntil: 'load'` or `'domcontentloaded'` — `networkidle` can hang
  once the service worker is registered.
- Testing the sub-path build locally: run BOTH build and preview with
  `VITE_BASE=/Test/kuglebanen/` — previewing a sub-path build at base `/` serves index.html
  as the JS fallback (200 but `text/html`) and burns an hour. Check content-type, not just
  status.
- Kill stray dev/preview servers (`pkill -f vite`) before starting new ones; leftover servers
  on other ports cause phantom 404s.
- Matter globals reset (`Common._nextId = 0; Common._seed = 0`) is the determinism linchpin.
- The exhaustive solve lives in `solve:levels` only; vitest reads `solver-report.json` so the
  suite stays fast. When a pack test fails after a physics change, the fix is: re-run
  `npm run solve:levels`, then re-run tests.
- Playwright scripts live at repo root as `_*.mjs` (gitignored pattern already in place);
  delete them when done. Screenshots go to the scratchpad dir; READ them.
- No `Date.now()`/`Math.random()` in src/ — seeded PRNG util for visuals; timestamps only in
  scripts if ever needed.

## Autonomy & decision policy
Never halt to ask the human. At any unspecified fork (exact plank sizes, colour values, level
geometry, audio frequencies), choose the most reasonable option consistent with kravspec +
this architecture, append one line to DECISIONS.md, and continue. One goal per commit; clear
messages; keep diffs reviewable. Commit at every phase gate at minimum.

## Scope boundaries & guardrails
- In scope: everything in kravspec §1–§8 + the 14-level pack + solver 2.0 + deploy.
- Stretch ONLY if every DoD box is already green: multi-drop levels (kravspec §10).
- Explicitly NOT in this build: level editor, sharing/backend, multiplayer, accounts,
  monetization, any randomness, free placement.
- Never weaken the solver or tests to make a level pass — fix the level.
- Never touch `vm/`, `elpriser/` or the hub landing page. Never commit secrets. Never delete
  the v1 git history — 2.0 replaces v1 as ordinary commits on the same branch.

## Deliverable
Kuglebanen 2.0 live at the same URL, README.md + DECISIONS.md updated, solver-report.json
proving the whole pack (stars, par, density), and a clean green gate. Stop only when every
Definition-of-Done box is checked and verified against the deployed result.
