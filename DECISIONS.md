# DECISIONS

One line per decision: what + why. Locked architecture from the spec is not re-litigated here.

- **Branch dedicated to Kuglebanen; removed the electricity-dashboard files** — this branch (`claude/kuglebanen-physics-puzzle-7dusdm`) is for Kuglebanen; the dashboard is preserved on the default branch and its own branch, so removing the 3 stray files keeps this project's diff clean and lets Vite own `index.html`.
- **Project lives at repo root** — the spec references `data/levels.ts`, `scripts/solve-level.ts`, root `package.json` scripts, `README.md`, so root layout is expected.
- **React 18.3 (not 19)** — maximal ecosystem/type stability for a one-shot build; nothing here needs React 19 features.
- **Tailwind v3.4 classic setup (postcss + config file)** — most predictable, battle-tested path vs. the newer v4 CSS-first engine.
- **Single tsconfig covering app + data + scripts** — the physics core is shared between the Vite app and the Node/tsx solver; one strict config with `node` + `vite/client` types keeps `tsc --noEmit` covering everything.
- **Did not run `npm audit fix --force`** — the reported vulns were in transitive build tooling; the vitest 2→3 bump (below) cleared them, so `npm audit` now reports 0.
- **Bumped Vitest to v3** — Vitest v2 pulled its own nested Vite 5, conflicting with the app's Vite 6 plugin types; v3 dedupes to a single Vite 6 and also resolved the audit warnings.

## Physics & determinism
- **The ball is the only dynamic body; every piece is a static deflector oriented by its rotation index** — makes the simulation trivially deterministic and bounds the solver's search to slot × type × rotation.
- **Reset Matter's global `_nextId`/`_seed` at the start of every `buildWorld`** — guarantees bit-identical body ids across runs so two simulations of the same setup produce identical trajectories.
- **Fixed timestep (`Engine.update(engine, 1000/60)`), sleeping disabled, `MAX_STEPS=720`** — no wall-clock, no engine RNG; win/fail decided by distance-to-zone checks each tick, plus settle/timeout guards.
- **Browser replays the precomputed trajectory rather than stepping Matter live** — the on-screen animation is guaranteed identical to the solver's headless result; physics is fully decoupled from the render loop. Static pieces/obstacles are still drawn as real Matter bodies.
- **Low ball restitution (0.16) + high floor friction** — a straight drop falls true and settles near where it lands instead of drifting; springy pieces still bounce because Matter uses `max()` restitution at the contact.

## Pieces & levels
- **Four static pieces**: ramp (long plank, strong directional throw ±~215px), funnel (wide-gap ∨ that passes a centred ball and deflects an off-centre/tilted one — gap widened to 34px after an early wedging bug), bouncer (short springy pad), spinner (4-blade pinwheel — an orientation-sensitive wildcard).
- **Rotation table = 4 steps at [-45°, -22.5°, +22.5°, +45°]** — four distinct useful slopes; symmetric bars read as 4 orientations.
- **Board fully enclosed (4 walls)** — keeps the ball in play; fails come from fail-zones, settling, or timeout.
- **`StaticObstacle.size` extended to `{x, y?}`** — walls use half-extents, pegs use `x` as radius (spec's contract had no sizing).
- **Every shipped level verified solvable and non-trivial via the solver core during design** — targets sit near the floor on the ball's roll path; each level rejects the empty (no-piece) placement so it is a real puzzle.

## App architecture
- **Simple view-state toggle (Zustand `view`), no React Router** — level-select ⇄ game is a single boolean; a router would be overkill (spec allowed either).
- **Slots interacted with via DOM buttons overlaid on the canvas** — large, reliable tap targets (iOS-safe) instead of canvas hit-testing; tap empty = place active type, tap filled = rotate, × = remove.
- **Persist `view` alongside level/placements/completed in the single `gameProgress` row** — so a mid-level reload returns to the exact level and placements.

## Post-DoD polish
- **Filled slot buttons are translucent with a rotating glyph** — the opaque disc hid the piece; now the real (accurately rotated) canvas body shows through and the glyph rotates with it, so rotation is visible, not just a degree label.
- **Palette auto-advances when a piece type is exhausted** — placing your last ramp selects the next available type, so the next slot tap isn't a silent no-op.
- **"Nulstil fremgang" on level select** — lets the player clear completed levels/placements (confirmed dialog); persisted immediately via Dexie.
