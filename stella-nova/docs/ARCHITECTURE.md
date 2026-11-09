# Stella Nova — architecture and working rules

Read `docs/GDD.md` (rules, art bible, audio bible, timing) and `src/core/types.ts` + `src/core/config.ts` (contracts, constants) before writing code. This file says who owns what and how the modules meet.

## Module map and ownership

| Path | Owner | Exports |
|---|---|---|
| `src/core/*` | foundation (frozen) | config, types, rng, anim, ease, loop, format, events |
| `src/render/stage.ts`, `env.ts` | foundation (frozen) | `Stage`, `CameraRig`, `buildEnvironment` |
| `src/math/*` | math | `createEngine()`, `MODEL`, `simulate()`, `createSimulator()`, CLI |
| `src/render/orrery.ts` (+ `orrery/*`) | orrery | `Orrery` |
| `src/render/symbols.ts` (+ `symbols/*`) | symbols | `SymbolFactory`, `SymbolView` |
| `src/render/vfx.ts` (+ `vfx/*`) | vfx | `Vfx`, `BeamHandle` |
| `src/render/sky.ts` (+ `sky/*`) | sky | `Sky` |
| `src/render/view.ts` | view assembly | `createGameView(): IGameView` |
| `src/audio/*` | audio | `createAudio(): IAudio` |
| `src/ui/*` | hud | `createHud(): IHud` |
| `src/game/*`, `src/main.ts`, `index.html` | director | `createDirector()`, boot |
| `sandbox/<name>.html`, `src/sandbox/<name>.ts` | each module's own | dev page |

**Rules for every agent**

- Edit only files you own. `src/core/*`, `src/render/stage.ts` and `src/render/env.ts` are frozen. If the contract is missing something, solve it inside your module and say so in your final report.
- No git commands. No new npm dependencies.
- No external assets and no network requests at runtime: no images, fonts, audio files, fetch. Textures are drawn in code (canvas or shader).
- `npx tsc -p tsconfig.json --noEmit` type-checks the whole tree. Other agents are writing files at the same time, so only errors in your own files are yours. Yours must be zero.
- Timing: use `anim` (`src/core/anim.ts`) for every delay and tween in render and game code. No `setTimeout`, `setInterval`, `requestAnimationFrame`, `performance.now()` or `Date.now()` there. Exceptions: the audio scheduler (AudioContext time is real time) and CSS transitions in the HUD.
- Randomness: outcome code uses only the engine's own `Rng`. Presentation code uses `cosmetic` from `src/core/rng.ts` (or `stage.rng`). Never `Math.random()` in `src/math` or `src/game`.
- Danish for everything the player reads. English for code, identifiers and comments.
- Comments explain why, not what. No banner art.

## World conventions (render)

- Y up. The orrery lies in the XZ plane at the origin. Spoke `s` is at clockwise angle `s * STEP_ANGLE` from −Z seen from above: `x = sin(a) * r`, `z = −cos(a) * r`. Use `cellXZ(ring, spoke)`.
- A ring's angle is **clockwise-positive**. Three.js `rotation.y` is counter-clockwise seen from above, so `group.rotation.y = -angle`.
- +1 notch = `STEP_ANGLE` clockwise = symbol at spoke `s` moves to spoke `s + 1`.
- Units: ring radii 1.25 / 2.25 / 3.25 / 4.25, band width 0.94, bezel 4.76–5.12, hub radius 0.74. Nothing that must stay on screen may extend past `FIT_RADIUS` (5.22). The camera frames exactly that disc. Decoration may reach further out (it is cropped on narrow screens).
- Heights: ring `r`'s enamel top surface is at `RING_Y[r]` (0.12 / 0.08 / 0.04 / 0.0, a shallow stepped dais). A symbol's centre is at `cellY(r) = RING_Y[r] + SYMBOL_Y`. The star's centre is at `(0, STAR_Y, 0)` with `STAR_Y = 0.62`.
- The camera looks from +Z and above toward the origin. Screen-up is −Z.

## Look conventions (render)

- Linear HDR. `OutputPass` does ACES + sRGB. `ShaderMaterial`s output linear colour and include neither `<tonemapping_fragment>` nor `<colorspace_fragment>`.
- Bloom threshold is 1.0. Lit-from-within values are 1.5–6. Keep ordinary lit surfaces below 1 so the board stays crisp. Bloom is a reward, not a fog.
- `stage.uTime` is the shared time uniform object. Put that same object in your uniforms.
- `stage.env.pmrem` is already `scene.environment`. `stage.env.cube` is a mip-mapped `samplerCube` (linear HDR) for custom shaders.
- `stage.keyLight` casts the only shadows (high quality only). `castShadow` on symbols and raised brass, `receiveShadow` on bands and base plate.
- Additive particles: `depthWrite: false`, `blending: AdditiveBlending`, premultiplied colour values above 1 where they should bloom.
- Colour from `PALETTE` and `SYMBOLS[id].color`. Do not invent neighbouring hues.

## Performance budget (whole game)

- 60 fps on an integrated GPU and a recent phone.
- Draw calls ≤ 160, triangles ≤ 350k, live particles ≤ 8k, no per-frame allocations in update paths (reuse vectors, typed arrays, pools).
- No `MeshPhysicalMaterial.transmission` (it re-renders the scene). Fake refraction in the shader with `stage.env.cube`.
- One bloom, one final pass. No extra full-screen passes.
- Canvas textures: at most 2048² for one-off hero textures, 1024² otherwise. Build them once at init.
- Every module honours `stage.quality` (`low | medium | high`) and `stage.reducedMotion`.

## Render sub-module APIs

These are the shapes `view.ts` is written against. Owners may add members, not rename or remove them.

```ts
// src/render/orrery.ts
export interface RingRig {
  readonly index: number;
  /** Rotates about Y. Bands, rims and sockets are children. */
  readonly group: THREE.Group;
  /** SPOKES anchors at the cell centres (y = SYMBOL_Y) for angle 0. Symbols are parented here. */
  readonly sockets: THREE.Object3D[];
  /** Radians, clockwise-positive. Setter writes group.rotation.y = -angle. */
  angle: number;
  /** 0..1 edge glow (win, hint, drag). */
  glow: number;
  /** 0..1 whirl energy: rims heat up while the ring spins. */
  heat: number;
}
export interface CentralStar {
  readonly group: THREE.Group;
  readonly light: THREE.PointLight;
  /** 0..1 Nova charge: size, whiteness, corona turbulence. */
  charge: number;
  /** 0..2 transient boost (stardust arriving, nova swell). Decays by itself toward 0. */
  energy: number;
  /** World position of the star's centre. */
  readonly position: THREE.Vector3;
}
export class Orrery {
  readonly group: THREE.Group;
  readonly rings: RingRig[];
  readonly star: CentralStar;
  constructor(stage: Stage);
  /** 0..1 glow of the fixed spoke marker on the bezel and the lane it points down. */
  setSpokeGlow(spoke: number, v01: number): void;
  /** 0..1 "unlocked" look for the nudge: rings lift a hair, rims shimmer. */
  unlocked: number;
  /** 0 = base, 1 = Kometnat. Cooler metal, comet-lit. */
  modeBlend: number;
  update(dt: number): void;
  dispose(): void;
}

// src/render/symbols.ts
export interface SymbolView {
  readonly id: SymbolId;
  /** Origin at the symbol centre, +Y up, sized for its ring. Choreography tweens position/scale/rotation of this object. */
  readonly object: THREE.Object3D;
  /** 0..1 win highlight: brighter core, faster sparkle. */
  glow: number;
  /** 0..1 pushed back: darker, desaturated. */
  dim: number;
  /** Clockwise angle of the ring this symbol rides. Celestial bodies counter-rotate to stay upright. */
  ringAngle: number;
}
export class SymbolFactory {
  constructor(stage: Stage);
  /** Compile programs and build geometries up front so the first spin does not hitch. */
  warmup(): void;
  acquire(id: SymbolId, ring: number): SymbolView;
  release(view: SymbolView): void;
  /** Idle life for all live symbols. */
  update(dt: number): void;
  dispose(): void;
}

// src/render/vfx.ts
export interface BeamHandle {
  /** 0..1 */
  intensity: number;
  fadeOut(seconds: number): Promise<void>;
  dispose(): void;
}
export class Vfx {
  readonly group: THREE.Group;
  constructor(stage: Stage);
  update(dt: number): void;
  /** Gem shatter: shards, sparks, a bloom pop. */
  burst(pos: THREE.Vector3, color: THREE.ColorRepresentation, power?: number): void;
  /** Small metal sparks (ring stop, detent). */
  sparks(pos: THREE.Vector3, color: THREE.ColorRepresentation, count?: number, speed?: number): void;
  /** Additive pop. */
  flash(pos: THREE.Vector3, color: THREE.ColorRepresentation, size?: number): void;
  /** Dust that curls from a cell into the star. Resolves on arrival. */
  stardust(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, opts?: { count?: number; duration?: number }): Promise<void>;
  /** A shooting star from the sky into a cell. Resolves on impact. */
  shootingStar(to: THREE.Vector3, color: THREE.ColorRepresentation, opts?: { duration?: number }): Promise<void>;
  /** World-space ring plus stage.fx.shock* refraction. */
  shockwave(center: THREE.Vector3, opts?: { duration?: number; maxRadius?: number; color?: THREE.ColorRepresentation }): Promise<void>;
  /** A great comet crossing the whole frame. */
  cometPass(opts?: { duration?: number }): Promise<void>;
  /** Light from the star out along a spoke through `count` rings. */
  beam(spoke: number, count: 3 | 4, color: THREE.ColorRepresentation): BeamHandle;
  /** Faint preview of a beam. */
  ghostBeam(spoke: number, count: 3 | 4, color: THREE.ColorRepresentation): BeamHandle;
  /** Star-trail arcs behind a whirling ring's symbols. speed01 = 0 hides them. angle = the ring's current angle. */
  setTrail(ring: number, speed01: number, colors: THREE.ColorRepresentation[], angle: number, dir: 1 | -1): void;
  /** Big-win fountain of stars and gold. 0 stops. */
  fountain(tier: 0 | 1 | 2 | 3): void;
  /** 0..1 density of the dust motes drifting in the star's light. */
  ambient: number;
  dispose(): void;
}

// src/render/sky.ts
export class Sky {
  readonly group: THREE.Group;
  constructor(stage: Stage);
  /** 0 = observatory night, 1 = Kometnat. */
  modeBlend: number;
  /** 0..1 excitement: nebula brightness and flow. */
  energy: number;
  update(dt: number): void;
  dispose(): void;
}
```

### Notch bookkeeping (view assembly)

Symbols stay parented to their socket for their whole life. The view keeps an integer notch offset `k` per ring: socket `j` currently sits at spoke `(j + k) mod 8`, and the ring's rest angle is `k * STEP_ANGLE`. A nudge or tick changes `k` by ±1 and tweens the angle. `setGrid` / `spinStop` put the symbol for `grid[r][s]` in socket `(s − k) mod 8`.

## Sandbox pages and screenshots

Each render module has a dev page: `sandbox/<name>.html` loading `src/sandbox/<name>.ts`, built on `createSandbox()` from `src/sandbox/harness.ts`. See `sandbox/stage.html` + `src/sandbox/stage.ts` for the pattern. Call `sandboxReady()` when the scene is built. Attach anything you want to drive from a script to `debug` (`window.__SN`).

```bash
npx vite --port <your port> &                     # dev server (each agent has its own port)
node tools/shot.cjs http://127.0.0.1:<port>/sandbox/<name>.html shots/<name>/01.png --advance=800
node tools/shot.cjs "<url>?inset=60,0,230,0" shots/<name>/mobile.png --mobile --dpr=1 --advance=800
node tools/shot.cjs <url> --script=tools/<your-scenario>.cjs    # multi-shot scenario
```

`--advance=ms` pauses the loop and steps the simulation deterministically before the shot. `--eval="..."` runs page JS first (use it to call your debug hooks). Rendering is software WebGL in this container: a frame takes about a second, so step with `--advance` instead of waiting in real time, and keep DPR 1 unless you are checking crispness.

**Look at your screenshots.** Open each PNG with the Read tool and judge it against the art bible like an art director: is it readable at phone size, is anything blown out or muddy, does it look expensive? Iterate until it does. Kill your dev server when you are done.

## Flow (director)

```
splash → onStart → audio.unlock → view.intro → READY
READY --onSpin--> engine.spin(bet) → play beats …
   spinStart  : view.spinStart, audio.whirl
   spinStop   : await view.spinStop(grid)
   wins       : await view.showWins, hud win count, floatText per line
   cascade    : await view.cascade(beat)
   nova       : hud.novaBanner + await view.nova
   awaitNudge : (auto-nudge or autoplay) → engine.nudge(best)
                else view.setNudgeActive(true), wait for drag / pass
   nudge      : await view.applyNudge  (or the drag already moved it)
   freeSpinsTrigger : celebrateScatters, hud.freeSpinsIntro, view.setMode('free')
   spinEnd    : big win? → hud.bigWin + view.bigWin ; wallet += total
→ free spins left? spin again automatically : READY
```

The view emits `ViewCue`s at exact animation moments. The director maps cues to `audio.sfx` and haptics, so sound follows what is seen.
