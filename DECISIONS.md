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

## Enhancement round (angles, balls, graphics, full-screen)
- **Rotation offered in 22.5° steps incl. 0°** — `ROTATION_STEPS` is now the 8 angles 0/22.5/…/157.5°; labels show the exact degrees (Danish comma, e.g. "112,5°"). Bars get every orientation; shaped pieces get fine control. The old ±45/±22.5 set is a subset, so nothing regressed.
- **Three selectable ball types** — `iron` (dense, barely bounces — equals the original tuning, so it's the default and keeps every level solvable), `wood` (controlled middle), `basketball` (larger, springy). Only restitution/friction/air/radius differ; density is cosmetic because a ball colliding with a *static* body reflects independently of its mass. The solver now searches ball × placements and prefers iron in examples; the CLI + tests confirm no level is trivially winnable (empty) on ANY ball.
- **Physics records ball spin** — each trajectory frame carries the ball angle so the on-screen ball visibly rolls; still bit-identical across runs.
- **Graphics lift** — top-lit sphere shading + per-type rolling textures (iron pits, wood grain rings, basketball seams), gradient-shaded pieces with drop shadows, a subtle board grid, a glowing target, and the amber path trail.
- **Full-screen iPhone fit** — `100dvh` flex column with safe-area insets; the board scales to the *available height* (not just width) so the whole game fits with no scrolling. Verified at a 390×844 iPhone viewport (document height == viewport height).
- **Level-pack tests read `solver-report.json`** — the exhaustive search stays in `npm run solve:levels`; the fast test suite cross-checks the committed report's example solutions against live physics (and fails if a level drifts out of sync), keeping vitest ~1.5 s.
