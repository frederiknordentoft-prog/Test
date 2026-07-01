# Kuglebanen

A deterministic physics **logic puzzle**. Each level has a fixed board with static
obstacles, a drop point at the top, and a target zone at the bottom. Before you
drop the ball, you place a **limited inventory** of movable pieces (ramp, funnel,
bouncer, spinner) into **fixed candidate slots** so that the ball's deterministic
path carries it into the target.

There is no randomness, no chance, no RTP. The same placement always produces the
same outcome — it's a puzzle to be **solved**, not a game of chance. Every shipped
level is proven solvable by a headless solver that runs the exact same simulation.

> UI language is Danish (vælg bane, placér brik, slip kuglen …). The code and this
> README are in English.

---

## Tech stack

Vite · React + TypeScript (strict) · Tailwind CSS · Zustand · Dexie (IndexedDB) ·
Matter.js (deterministic, headless-capable) · Vitest · vite-plugin-pwa.

---

## Run it

```bash
npm install

npm run dev            # dev server (http://localhost:5173)
npm run build          # typecheck + production build (installable PWA)
npm run preview        # serve the production build (service worker + offline)

npm run typecheck      # tsc --noEmit, zero errors
npm run lint           # eslint
npm test               # Vitest: determinism proof + level-pack guarantees
npm run solve:levels   # solve every level headlessly; writes solver-report.json
```

`npm run solve:levels l3` solves a single level by id.

### How to play

1. **Vælg bane** — pick a level from the list.
2. Choose a piece type from the palette (it shows how many of each you have left).
3. **Tryk på et felt** (tap a slot) to drop the piece in. Tap it again to **rotate**
   it (four fixed steps). The little **×** returns it to your inventory.
4. You can never place more pieces than the level's inventory allows.
5. **Slip kuglen** — the ball drops and follows its deterministic path.
6. See the result (**Vundet!** / **Ikke i mål**). **Prøv igen** to retry with the
   same placements (still editable), **Ryd brikker** to clear, or **Næste bane**.

Progress (current level, placements, completed levels) is saved to IndexedDB via
Dexie, so reloading mid-level restores exactly where you were — offline too, once
installed as a PWA.

---

## The pieces

| Piece | Danish | Behaviour |
|-------|--------|-----------|
| `ramp` | Rampe | Long plank — the workhorse. Strong directional throw (~±215 px). |
| `funnel` | Tragt | Wide-gap ∨. Passes a centred ball, deflects an off-centre/tilted one. |
| `bouncer` | Trampolin | Short, very springy pad — energetic bounce. |
| `spinner` | Kryds | 4-blade pinwheel — an orientation-sensitive "wildcard" kick. |

Every piece is a **static** body; its orientation is set by a rotation index into a
fixed table (`ROTATION_STEPS = [-45°, -22.5°, +22.5°, +45°]`). The **ball is the
only moving body**, which is what makes the whole simulation deterministic and the
solver's search space finite.

---

## Project structure

```
data/levels.ts            The shipped level pack (static data) + getLevel()
scripts/solve-level.ts    CLI: solve every level, write solver-report.json, exit != 0 if any fail
src/types.ts              Core data contracts (LevelDef, Slot, PlacedPiece, …)
src/physics/
  constants.ts            Tuning: timestep, gravity, materials, rotation table, piece specs
  pieces.ts               Matter body factories for pieces and obstacles
  simulate.ts             buildWorld() + simulate() — the deterministic core (no DOM)
  solver.ts               solveLevel() — brute-force search over slot/type/rotation
  simulate.test.ts        Determinism proof + level-pack guarantees (Vitest)
src/render/renderer.ts    Draws the Matter bodies + zones + ball to a canvas
src/store/gameStore.ts    Zustand store: placements, inventory rules, run state, view
src/game/                 Inventory helpers + Danish UI strings
src/db/                   Dexie table `gameProgress` + persistence hook
src/components/           GameCanvas, InventoryBar, Controls, GameView, LevelSelect, InstallPrompt
```

The physics core (`src/physics`) has **no DOM dependency**, so the very same
`simulate()` runs in the browser (to animate the ball) and in Node (for the solver
and tests). What you see on screen is a replay of the precomputed trajectory, so it
is guaranteed identical to what the solver computed.

---

## How to add a level

1. Add a `LevelDef` to the `LEVELS` array in **`data/levels.ts`**. Coordinates are
   in board pixels (the canvas scales the board to fit the screen).

   ```ts
   {
     id: 'l7',                          // unique id
     name: 'Min bane',
     boardWidth: 440,
     boardHeight: 680,
     dropPoint: { x: 220, y: 24 },      // top
     targetZone: { position: { x: 360, y: 650 }, radius: 30 },
     failZones: [                       // optional
       { position: { x: 120, y: 650 }, radius: 40 },
     ],
     staticObstacles: [
       { position: { x: 300, y: 430 }, shape: 'peg', size: { x: 11 } }, // size.x = radius
       { position: { x: 220, y: 320 }, shape: 'wall', size: { x: 60, y: 10 } }, // half-extents
     ],
     slots: [
       { id: 'a', position: { x: 220, y: 200 }, allowedTypes: [] }, // [] = any type fits
       { id: 'b', position: { x: 300, y: 380 }, allowedTypes: ['ramp'] },
     ],
     inventory: { ramp: 1, funnel: 1 }, // how many of each piece the player gets
   }
   ```

2. **Verify it is solvable and non-trivial:**

   ```bash
   npm run solve:levels
   ```

   The script fails (exit code 1) if any level is unsolvable **or** can be won with
   no pieces at all (not a real puzzle). Design tips that make levels tractable:

   - Targets sit near the floor, on the ball's roll path — a thrown ball rolls into
     them. Keep the target away from where an unaided drop lands (~x of the drop),
     otherwise the empty placement wins.
   - One `ramp`/`funnel`/`bouncer` throws the ball ~±150–235 px horizontally from a
     slot ~180 px below the drop. Size the board around that.
   - If a level comes out unsolvable, **fix the level's layout** (move the target /
     slots / obstacles). Don't loosen the win check.

3. That's it — the level shows up in the level-select list automatically.

---

## Determinism (how it's guaranteed)

- Fixed timestep: `Engine.update(engine, 1000/60)` every tick — never a wall clock.
- Matter's global id/seed counters are reset at the start of every `buildWorld`, and
  bodies are created in a fixed order (and placements are sorted internally), so two
  runs of the same setup produce **bit-identical** trajectories.
- Engine sleeping is disabled; there is no RNG in the step. Win/fail is decided by
  distance-to-zone checks each tick, with settle and timeout guards.

`npm test` asserts the trajectory is byte-for-byte identical across two runs, that
the outcome is independent of placement array order, and that every shipped level is
solvable with an example solution that actually wins.

---

## Assumptions & scope

**In scope (MVP):** single-player puzzle, 6 pre-built levels, fixed candidate slots,
limited inventory, one target zone per level (fail zones optional), local-only
persistence, headless solver, installable offline PWA.

**Explicitly not built (non-goals):** level editor, level sharing/backend, online
multiplayer, accounts, monetisation/ads, any randomness or chance mechanic,
multi-target scoring.

**Assumptions:**

- Pieces are static deflectors oriented by a discrete rotation index (not free
  continuous placement) — this is what keeps the level solver tractable.
- The board is fully enclosed by walls; a run fails via a fail zone, by the ball
  settling, or by timeout (~12 s of simulated time).
- Modern browser with IndexedDB and Canvas. Tuned for portrait phone screens; tap
  targets are large and `touch-action: manipulation` avoids iOS double-tap zoom.

See **DECISIONS.md** for the one-line rationale behind each notable choice.
