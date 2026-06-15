# Roulette Vertical Slice — Build Prompt (React Three Fiber, pre-baked trajectories)

> This is the ORIGINAL full specification the project is built against. A new
> Claude Code session should read this first, then read HANDOFF.md for the
> current status and how to continue.

## Role & operating rules

You are the lead engineer building a **near-photorealistic European roulette wheel** on the web using React Three Fiber. The ball bounces and rattles realistically into a pocket, but **the outcome is decided by an RNG, not by physics** — physics only *illustrates* a pre-decided result. Work **phase by phase**. Do not jump ahead.

**Rules for every phase:**

1. Read the phase Goal + Tasks, then implement.
1. After implementing, verify the **Done-when** acceptance criteria yourself (run it, check the console, reason about each criterion).
1. Commit per phase: `git commit -m "Phase N: <summary>"`.
1. Then **pause and report** what you did, what works, what you couldn’t verify. Wait for my “continue”.
1. If a tool/API behaves differently than described, adapt and tell me — this is a strong starting point, not gospel.
1. Target 60 fps in a browser.

-----

## CORE ARCHITECTURE — read this first, it drives everything

**The outcome is authoritative and comes from RNG. The animation is a lookup + playback, never a live simulation that decides anything.**

The key physical insight that makes this clean: in a real wheel, the **deflectors (diamonds) are mounted on the stationary bowl**, while only the **numbered rotor spins**. So the ball’s trajectory (rim spiral, drop, deflector bounces) lives in the **stationary frame** and is independent of which number wins. The winning number is set by **where the rotor comes to rest** under the ball.

Therefore we **decouple** two things:

- **Ball trajectory** = a pre-baked path in the stationary frame. Bakes the visually interesting part (spiral, drop, rattle). Ends at a known **capture angle θ** (the world angle where the ball settles to rotor level).
- **Rotor final angle φ** = computed *per spin* so that the RNG-chosen number sits under θ at settle. The rotor’s motion is a **procedural ease-out curve**, not baked.

**Consequence:** we only need a small library of ball trajectories for *visual variety*. **Start with K = 2 baked ball trajectories.** Each one can produce **any** of the 37 numbers by adjusting the rotor’s final angle. So 2 baked trajectories already give all 37 outcomes *and* 2 distinct-looking spins per number. If 2 ball bounces ever feel repetitive across many spins, bake more (K = 10, 20); the numbers are always free.

**Spin sequence at runtime:**

1. `rng()` → winning number `N` (0–36). This is authoritative and seedable.
1. Pick a random baked trajectory `k` from the library (gives ball-bounce variety).
1. Compute rotor target angle `φ` so `pocketAngle(N)` aligns under trajectory `k`’s capture angle `θ_k` at settle time. Add a few extra full rotor turns for drama.
1. Generate the rotor’s smooth decel curve from its current angle to `φ` over the trajectory’s duration.
1. Play: drive the ball along the baked keyframes (interpolated) in the stationary frame; rotate the rotor along its curve beneath it. At capture, the ball drops into the pocket and co-rotates with the rotor for the final beauty shot.
1. The pocket under the ball at rest **must equal N**. Assert this every spin.

**Why this is auditable / fair:** the visible spin is a deterministic function of `(N, k, seed)` — same inputs always produce the identical on-screen animation on any platform, because playback is keyframe interpolation, not floating-point physics. RNG decides; physics never does.

-----

## Wheel specification — European single-zero (37 pockets)

- 37 pockets: `0`–`36`. Single green zero. (This is the European/Danish wheel.)
- **Canonical pocket order, clockwise starting at 0** (use this exact sequence for geometry + number ring):
  `0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26`
- Pocket angular width: `360 / 37 ≈ 9.7297°`. `pocketAngle(N) = indexInSequence(N) * (360/37)`.
- Colors: 0 = green. Reds: `1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36`. The rest (non-zero) are black.

**Geometry, two reference groups (this separation is mandatory):**

- `BowlGroup` (STATIONARY): outer bowl, the banked/inclined ball track (rim), the lower ball track, **8 deflectors/diamonds** (alternating orientation), the center cone/turret. The ball lives and bounces in this frame.
- `RotorGroup` (ROTATES): the spinning disc with 37 **frets** (pocket dividers), the 37 pocket floors, the number ring, and the central spindle top. Only this group’s Y-rotation changes to set the outcome.

Model these as clean parametric geometry (lathe/extrude/instanced frets), not imported meshes — it must be procedurally correct so pocket angles map exactly to numbers.

-----

## Trajectory data format (what the bake produces, what the player consumes)

Each baked trajectory is compact data, **not video**. Store one file per trajectory in `public/trajectories/` plus an index.

Per trajectory:

```jsonc
{
  "id": "traj_00",
  "fps": 60,
  "duration": 6.2,                 // seconds, ball phase
  "captureAngle": 184.3,           // degrees, world angle where ball settles to rotor level
  "frames": [                      // sampled ball transform in the STATIONARY/world frame
    // each frame: [x, y, z, qx, qy, qz, qw]  (position + ball's own spin quaternion)
    [ ... ], ...
  ],
  "events": [                      // collision markers for audio/FX, indexed by frame
    { "frame": 142, "type": "deflector", "intensity": 0.8 },
    { "frame": 171, "type": "fret",      "intensity": 0.4 }
  ],
  "settleFrame": 360               // frame at which the ball is captured (co-rotation begins after)
}
```

- Frames as a flat `Float32Array` is fine (7 floats/frame). ~6s × 60fps × 7 × 4 bytes ≈ 10 KB/trajectory. Trivial.
- Position is in the stationary frame so the player can rotate the rotor independently underneath.
- `events` are emitted by the baker (it knows when the ball hit a deflector/fret) so Phase 4 audio doesn’t have to re-detect collisions.
- The player **interpolates** between frames for smooth 60+ fps regardless of bake fps.

-----

## Baking approach (Phase 1)

The baker is an **offline Node script** (`scripts/bake-trajectories.mjs`, run with `node`). It runs **once**; its output ships. Cross-platform determinism of the bake itself is NOT required — only the playback must be deterministic, and keyframe playback always is.

Two viable methods — **start with Option A**, it’s reliable and controllable:

- **Option A — procedural / analytical (recommended start).** Author the ball motion as phases: (1) decaying spiral on the banked rim (angular velocity decays via drag; radius slowly shrinks), (2) detachment when centripetal demand drops below gravity, (3) parabolic drop to the deflector ring, (4) a few **damped bounces** off the nearest deflector positions (reflect velocity with energy loss + small randomized scatter), (5) settle to capture angle θ, recording the frame. Fully controllable, no tunneling, no engine. Inject small per-bake randomness so the 2 trajectories differ.
- **Option B — headless rigid body (`cannon-es`, pure JS in Node).** More emergent feel. Use a fine fixed timestep (≥240 Hz) and continuous collision / thick-enough deflector colliders to avoid tunneling through thin frets. Only attempt after A works, if A doesn’t look organic enough.

Either way the baker must:

- Produce **K = 2** trajectories to start (make K a config constant so it’s a one-line change later).
- Sample at 60 fps into the data format above, record `captureAngle`, `settleFrame`, and `events`.
- **Validate** each trajectory: monotonic-ish energy decay (no unphysical speed-ups), ball stays within the track radius until drop, no NaNs, settles to a stable capture, total duration in a sane range (~5–8 s). Print a summary; fail loudly if a trajectory is degenerate.
- Write `public/trajectories/index.json` listing the trajectories.

-----

## Phase 0 — Scaffold & correct wheel geometry

**Goal:** A correct, parametric European wheel rendered, with the two-group separation.
**Tech:** Vite + React + TypeScript, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` + `postprocessing`, `zustand`, `leva` (dev only).
**Tasks:**

- Scaffold and install. Renderer: `ACESFilmicToneMapping`, `outputColorSpace = SRGB`.
- Build `BowlGroup` (stationary) and `RotorGroup` (rotates) as parametric geometry: bowl, banked ball track, 8 deflectors, 37 frets + pocket floors, number ring with the **canonical sequence** and correct red/black/green, center cone + spindle.
- Implement `pocketAngle(N)` and a debug overlay that, given a number, rotates the rotor so that number faces a marked reference angle — to prove the number↔angle mapping is exact.
- Placeholder materials for now.
  **Done-when:** the wheel looks structurally right; entering any N in the debug tool puts that exact number at the reference mark; console clean; 60 fps.

## Phase 1 — Baking pipeline

**Goal:** Produce K=2 valid ball trajectories as data.
**Tasks:**

- Build `scripts/bake-trajectories.mjs` per the Baking approach (start with Option A).
- Add `npm run bake`. Output `public/trajectories/traj_*.json` (or `.bin`) + `index.json`, with `captureAngle`, `events`, `settleFrame`.
- Run the validation; print a per-trajectory report.
  **Done-when:** `npm run bake` writes 2 validated trajectories with sane durations and capture angles; no degenerate paths; data matches the documented schema.

## Phase 2 — Playback engine (RNG → animation)

**Goal:** A correct, deterministic spin.
**Tasks:**

- Load trajectories. Implement a seedable `rng()` and `spin(N?)` (if N omitted, draw from rng). Expose current result in zustand.
- Implement the **spin sequence** from CORE ARCHITECTURE: pick trajectory k, compute rotor target φ so `pocketAngle(N)` lands under `captureAngle_k` (plus extra full turns), generate the rotor ease-out curve over the trajectory duration.
- Drive the ball by interpolating baked frames in the stationary frame; rotate the rotor by its curve. After `settleFrame`, parent the ball to the rotor so it co-rotates to rest.
- Run the clock on a **fixed timestep accumulator** decoupled from render frame rate.
- **Assert** after every spin: the pocket physically under the ball == N. Log a warning if not (off-by-one in angle math is the likely bug).
- Add a “Spin” button + show the result number.
  **Done-when:** repeated spins always seat the ball in pocket N; same `(seed, N, k)` reproduces the identical visible animation; motion is smooth; the ball visibly bounces then settles; assertion never fires.

## Phase 3 — The realism pass (materials, lighting, motion) — where “lækker” lives

**Goal:** Near-photorealistic look. Realism is lighting + materials + ball reflection, not polygon count.
**Tasks:**

- HDRI via drei `<Environment>` (studio/indoor) for reflections + ambient; one warm key light with soft shadows.
- PBR materials: polished metal rim and frets (low roughness, metalness 1), lacquered wood bowl (clearcoat feel), green baize/felt where appropriate, and a **chrome or ceramic ball** with sharp specular and crisp environment reflection — the ball’s moving reflection is the single biggest realism cue, get it right.
- **Motion blur** on the fast-moving ball (velocity-based; from the interpolated trajectory). Contact shadow under the ball. Heavy AO down in the frets/pockets.
- Post-processing: ACES tone mapping, subtle Bloom (high threshold — only speculars bloom), Vignette, SMAA. Optional subtle DOF for the beauty shot.
- Expose key params via `leva` (exposure, bloom, ball roughness, blur amount).
  **Done-when:** the ball reads as real metal/ceramic with a moving reflection; rim and frets have believable specular; frets are grounded by AO/contact shadow; bloom is tasteful; still ~60 fps.

## Phase 4 — Audio & camera feel

**Goal:** Sell the realism through sound and framing.
**Tasks:**

- Rolling sound loop while the ball is on the track, **pitch/volume tied to ball speed** (derive speed from the trajectory).
- Discrete **clack** on each `event` (deflector vs fret variants, volume from `intensity`) — these come from the baked `events`, perfectly synced.
- Settle “thunk” + optional ambient room tone.
- Camera: dynamic follow during the spin, then a cut/ease to a top-down or low beauty angle at settle. Subtle shake on hard deflector hits.
- UI: trigger spin, show last result + a short history strip.
  **Done-when:** clacks line up exactly with visible bounces; rolling pitch tracks speed; camera makes the settle feel dramatic; a stranger reads it as a real wheel spinning.

## Phase 5 — Variety, audit & polish

**Goal:** Production-credible slice.
**Tasks:**

- If the two ball bounces feel repetitive, raise K in the baker and re-bake (note in README how).
- **Auditability:** implement a deterministic replay — given a stored `(seed, N, k)`, reproduce the exact visible spin. Add a tiny “verify” mode that runs all 37 numbers and asserts correct seating for each.
- README: document the **“RNG decides, physics illustrates”** architecture, the stationary-bowl / rotating-rotor decoupling, the modeling simplifications (e.g. fret-level rattle baked in the stationary frame), and the bake/replay workflow.
- Performance pass (instanced frets, texture sizes, draw calls).
- Note (do not build) where a real product would plug a **certified server-side RNG** in place of the local `rng()`, and where a betting/payout layer would attach — out of scope for the slice.
  **Done-when:** all 37 numbers verify correct seating; replay is bit-identical visually; README explains the fairness model; it looks and sounds polished.

-----

## Guardrails

- The ball trajectory must NEVER decide the outcome. RNG → number → rotor angle. If you ever find the displayed number depending on physics, that’s a bug.
- Keep `BowlGroup` (stationary) and `RotorGroup` (rotating) strictly separated; the ball is in the bowl frame until `settleFrame`.
- Don’t ship video. Ship trajectory **data**; render live.
- Make K (trajectory count) a single config constant.
- Don’t commit large generated assets needlessly; the trajectory JSON is small and SHOULD be committed (it’s the deterministic source of truth) — but regenerable via `npm run bake`.
- Prefer parametric geometry over imported meshes so number↔angle mapping stays exact.
- After every spin, assert pocket-under-ball == N.
