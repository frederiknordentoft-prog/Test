# HANDOFF — Roulette Vertical Slice

> Read this together with `PROJECT_INSTRUCTIONS.md` (the full original spec).
> This file = current status, decisions made, how to run, how to continue.

## What this project is (one paragraph)

A near-photorealistic European single-zero roulette wheel rendered live in the
browser with React Three Fiber. The core principle: **RNG decides the winning
number; physics only illustrates it.** Ball trajectories are pre-baked keyframe
data in the *stationary* bowl frame; the *rotor* (numbered disc) is rotated
per-spin to a computed final angle so the RNG-chosen number ends up under the
ball's capture angle. Playback is deterministic keyframe interpolation, never a
live simulation — so the same `(seed, N, k)` always produces the identical
on-screen animation. See PROJECT_INSTRUCTIONS.md → "CORE ARCHITECTURE".

## Current status: Phase 0 COMPLETE ✅

The build proceeds phase by phase (0 → 5). Only **Phase 0** is done so far.

| Phase | What | State |
|------|------|-------|
| 0 | Scaffold + parametric wheel geometry + number↔angle mapping + debug tool | ✅ done, committed, pushed |
| 1 | Trajectory baking pipeline (`scripts/bake-trajectories.mjs`, K=2) | ⬜ next |
| 2 | Playback engine (RNG → animation, spin sequence, assertion) | ⬜ |
| 3 | Realism pass (HDRI, PBR materials, chrome ball, motion blur, post) | ⬜ |
| 4 | Audio & camera feel | ⬜ |
| 5 | Variety, deterministic replay/audit, README, perf | ⬜ |

### What Phase 0 delivered

- **Vite + React + TS** scaffold with three, @react-three/fiber, @react-three/drei,
  @react-three/postprocessing + postprocessing, zustand, leva. Renderer set to
  `ACESFilmicToneMapping` + `SRGBColorSpace`.
- **Strict two-group separation** (mandatory per spec):
  - `src/components/BowlGroup.tsx` — STATIONARY: lathe bowl, banked ball track,
    sloped apron, 8 alternating (vertical/horizontal) deflector diamonds seated
    on the apron slope, and a red **reference marker** at world angle 0 (+Z).
  - `src/components/RotorGroup.tsx` — ROTATES: pocket floor ring, 37 **instanced**
    frets, conical number ring, polished rim band, center cone + turret. Only this
    group's `rotation.y` changes. Currently driven from the zustand store.
- **Exact number↔angle math** in `src/lib/wheel.ts`:
  - `POCKET_SEQUENCE` (canonical clockwise order), colors, dimensions in one
    `WHEEL` constant.
  - `pocketAngleDeg(N)`, `rotorAngleForNumber(N, worldAngle)` and its inverse
    `pocketAtWorldAngle(theta, phi)` — **Phase 2 will use this exact pair** for the
    spin sequence and the post-spin assertion.
- **Textures** (`src/lib/textures.ts`): the conical number ring and the flat
  pocket floor are both `LatheGeometry` (cylindrical UVs), painted by one canvas
  strip so each pocket's color band + number sits at exactly its mathematical
  angle. (Watch the UV seam — bands are drawn at x-W, x, x+W.)
- **Debug tool** (`src/components/DebugPanel.tsx`): type any number 0–36 → rotor
  rotates it under the marker; panel shows index/angle and a live inverse-math
  self-check.

### Angle convention (IMPORTANT — keep consistent in later phases)

- Angles are radians around +Y. A point "at angle a" is at `(sin a, y, cos a)*r`,
  so `a = 0` is **+Z** and increasing `a` is **counter-clockwise seen from above**.
- The pocket sequence runs **clockwise** seen from above, so pocket index `i` sits
  at rotor-local angle `-i * POCKET_STEP`.
- With `rotor.rotation.y = phi`, a pocket at local angle `a` is at world angle
  `a + phi`. Hence `rotorAngleForNumber(N, worldAngle) = worldAngle - localAngle(N)`.

### Deviations / additions vs the spec

- Added `?cam=top` URL param (straight top-down camera) for mapping screenshots.
- Added `scripts/screenshot.mjs` + `scripts/fps-check.mjs` — a headless Chromium
  (Playwright) self-verification harness. Useful in every later phase. These are
  dev-only; Playwright is a devDependency.
- The app lives in the **`roulette/`** subfolder of the repo (the repo root had an
  unrelated electricity-dashboard prototype on other branches; left untouched).

### Verified (Phase 0 Done-when)

- Number↔angle mapping exact: `scripts/check-mapping.mjs` passes 444 round-trips +
  spot checks. Visually confirmed via top-down screenshots (canonical sequence and
  red/black/green correct).
- Console clean except two harmless three.js deprecation warnings (`THREE.Clock`,
  `PCFSoftShadowMap`) emitted by drei internals.
- **60 fps NOT verifiable in CI/cloud** — the build container has no GPU
  (SwiftShader software rasterizer ~3 fps, meaningless). Scene is ~12 draw calls
  with instanced frets + small textures, so 60 fps on real hardware is expected.
  **Confirm on a real machine.**

## How to run / test

Requires Node.js 20+ (built and tested on Node 22).

```bash
cd roulette
npm install
npm run dev          # → http://localhost:5173
```

Then in the browser:
- Drag to orbit, scroll to zoom (OrbitControls).
- Debug panel (top-left): type 0–36, press **Align** / Enter → that number rotates
  under the red marker, with a live self-check.
- `http://localhost:5173/?cam=top` → top-down view to eyeball the sequence/colors.

Other commands:
```bash
npm run build        # tsc -b + vite build (type-check; must stay green)
node --experimental-strip-types scripts/check-mapping.mjs   # number↔angle math
# Optional headless screenshots (installs a browser the first time):
npx playwright install chromium
node scripts/screenshot.mjs http://localhost:5173 0 7 26 32
```

## How to continue (for the next Claude)

1. Read `PROJECT_INSTRUCTIONS.md` fully, then this file.
2. Follow the phase rules: implement one phase, self-verify the **Done-when**
   criteria, `git commit -m "Phase N: ..."`, then pause and report. Wait for the
   user's "continue" before the next phase.
3. **Next up is Phase 1** — the offline trajectory baker (`scripts/bake-trajectories.mjs`,
   Option A procedural, K=2 as a config constant) writing
   `public/trajectories/traj_*.json` + `index.json` in the documented schema, with
   `captureAngle`, `events`, `settleFrame`, plus per-trajectory validation.
4. Honor the **Guardrails** (esp.: RNG decides, not physics; keep BowlGroup and
   RotorGroup separated; parametric geometry only; assert pocket-under-ball == N
   after every spin in Phase 2+).

## Key files map

```
roulette/
  PROJECT_INSTRUCTIONS.md   # full original spec (read first)
  HANDOFF.md                # this file
  README.md                 # short status + commands
  src/
    lib/wheel.ts            # constants + number↔angle math (the heart)
    lib/textures.ts         # canvas strip textures for ring + pocket floor
    store.ts                # zustand: rotorAngle (Phase 2 will drive the spin here)
    components/
      Scene.tsx             # Canvas, camera, lights, OrbitControls, ?cam=top
      BowlGroup.tsx         # stationary frame
      RotorGroup.tsx        # rotating frame
      DebugPanel.tsx        # number → marker alignment + self-check
  scripts/
    check-mapping.mjs       # 444-case math verification
    screenshot.mjs          # headless visual check
    fps-check.mjs           # headless fps probe (meaningless without GPU)
```

## Git

- Branch: `claude/roulette-wheel-slice-vg0tav`
- Phase 0 is committed and pushed to that branch.
