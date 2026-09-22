# NORDLYS: modulkontrakter

Denne fil er den bindende grænseflade mellem modulerne. Hvert modul ejer sine egne filer og må **ikke** ændre andres.

Delte filer, som kun må læses: `src/math/types.ts`, `src/core/palette.ts`, `src/game/tiers.ts`, `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `PLAN.md`, `docs/*`. Har du brug for en ændring i en delt fil, så beskriv den i din slutrapport.

**Stack:**

| Pakke | Detaljer |
|---|---|
| pixi.js | 8.21 (WebGL2 via `preference:'webgl'`) |
| gsap | 3.15 |
| pixi-filters | 6.1.5 |
| TypeScript | 6 med `erasableSyntaxOnly`: ingen `enum`, `namespace` eller parameter properties. Brug `as const` og unions. |

**Imports:** skriv `.ts`-endelser, fx `import { SYM } from '../../math/types.ts'`. Shaders lægges inline som template-strenge i `.ts`-filer, altså ingen `?raw`.

**Shaders:**
- Skriv altid `#version 300 es` som første linje i fragment-shaderen **og** vertex-shaderen, efterfulgt af `precision highp float;`.
- Brug `in`/`out` og `out vec4 finalColor;`.
- Pixi v8 indsætter selv version-headeren, når fragment-kilden indeholder `#version 300 es`.
- Mesh-vertex-shaders bruger `uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix`.
- Filter-vertex-shaders bruger Pixi's standard: `aPosition`, `uInputSize`, `uOutputFrame` og `uOutputTexture`. Se `node_modules/pixi.js/lib/filters/defaults/defaultFilter.vert.mjs`.
- Konstruér altid filtre med `resolution: 'inherit'`, medmindre du med vilje vil have lavere opløsning (fx bloom).

**Ingen `Math.random`** i `src/math`. Kosmetisk tilfældighed går gennem `src/core/cosmeticRng.ts`, som er givet, deterministisk og kan seedes.

**Performance:**
- Hot loops må ikke allokere: genbrug objekter og typed arrays.
- Mål: 60 fps på en mellemklasse-telefon.
- Hold fragment-shaders billige, dvs. få oktaver og ingen løkker over 8 iterationer i fuld opløsning.

**Visuel dom:** Se PLAN.md §6 for palet og stil. Det skal ligne et AAA-slot fra 2026: rige lag, glød, dybde og præcision. Det må aldrig ligne programmør-kunst.

---

## 1. Matematik: `src/math/*`, `sim/*`, `tests/math.*.test.ts`

Alt er rent TypeScript. Det må ikke bruge DOM, Pixi, gsap, `import.meta.env` eller `?raw`, og det skal kunne køres med `node` (type stripping i Node 22).

```ts
// rng.ts
export interface Rng { u32(): number; next(): number /* [0,1) */; int(n: number): number /* [0,n) */ }
export function spinRng(sessionSeed: number, domain: 'base' | 'storm' | 'perk' | 'demo', idx: number): Rng; // xoshiro128** via splitmix32
export function newSessionSeed(): number; // crypto.getRandomValues

// config.ts: re-exports the tuned values from config.generated.ts
export interface MathConfig {
  cols: number; rows: number; stormCols: number; stormRows: number;
  weights: number[];            // base weights per Sym 0..7 (no SUN)
  stormWeights: number[];
  pSun: number; pSunStorm: number;
  paytable: number[][];         // [sym 0..6][bucket 0..7] × stake, buckets: 5,6,7,8,9-10,11-12,13-15,16+
  payScale: number; stormPayScale: number;
  K: number;                    // charge to Kp 9
  baseMarkCap: number;          // 32
  stormMarkCap: number;         // 128
  stormSpins: number;           // 10
  stormStartMarks: number;      // 6
  retriggerSpins: number;       // 3
  maxStormSpins: number;        // 20
  guaranteeX: number;           // 30
  maxWinX: number;              // 10000
  sunPayX: number;              // 3
  sunCharge: number;            // 150
  stakesOre: number[];          // [50,100,200,400,600,1000,2000,5000,10000]
  defaultStakeOre: number;      // 200
  modelHash: string;
}
export const CONFIG: MathConfig;
export const REPORT: {          // shown in the rules screen, from the last full sim
  rtp: number; rtpMin: number; meterShare: number; hitRate: number; netWinRate: number; ldwShareOfHits: number;
  stormRate: number;            // storms per paid spin (A+B)
  routeARate: number; routeBRate: number; avgSpinsToKp9: number;
  stormMeanX: number; stormP10X: number; stormP50X: number; stormP90X: number; stormP99X: number;
  guaranteeUseRate: number; baseSdX: number; blendedSdX: number;
  perStormSpinRtp: number;      // ≈ 20 (=2000 %)
  baseSpinRtp: number;          // base-only RTP incl. suns (≈ 0.81)
  kpMedianSpins: number[];      // median spins to reach Kp 1..9
  spinsSimulated: number; stormsSimulated: number; variants: { rtp: number; payScale: number; stormPayScale: number }[];
};

// engine.ts: base spin (also used for perk "Ladet spin")
export function spinBase(rng: Rng, stakeOre: number, opts?: { perk?: boolean; spinId?: string }): SpinResult;

// storm.ts
export interface StormState { stakeOre: number; spinsTotal: number; spinIndex: number; marks: number[]; winOre: number; maxMark: number; capped: boolean }
export function createStorm(rng: Rng, stakeOre: number): StormState;              // places stormStartMarks random x2 marks
export function stormSpin(state: StormState, rng: Rng, spinId: string): { result: SpinResult; meta: StormSpinMeta }; // mutates state
export function finishStorm(state: StormState): StormSummary;                     // applies guarantee (shown as its own line)

// meter.ts
export interface MeterState { charge: number; stakeSumOre: number }
export function newMeter(): MeterState;
export function kpOf(m: MeterState): number;                                       // continuous 0..9 (tiers.kpFromCharge)
export function lockedStakeOre(m: MeterState): number;                             // floor(stakeSumOre / charge), fallback default stake
export function addCharge(m: MeterState, charge: number, stakeOre: number): { kpBefore: number; kpAfter: number; tiersCrossed: number[]; stormA: boolean }; // mutates
export function resetMeter(m: MeterState): void;
```

**Normative regler:** se PLAN.md §2–§5. Ved uklarhed vælger du, dokumenterer det øverst i `engine.ts` og tester det.

## 2. Symbol-art: `src/render/art/*`

```ts
export type Edition = 'base' | 'storm';
export interface SymbolSet {
  edition: Edition; cellPx: number;       // texture px size of one cell (square)
  textures: Texture[];                    // length 9, index = Sym; transparent bg, symbol fills ~86% of cell
  glow: Texture;                          // soft additive glow, same size (tint per symbol at runtime)
}
export interface CellFx {
  cellBg: Texture;     // subtle glass cell backdrop (base)
  frost: Texture;      // frost-mark overlay (mark = 1): icy rime + inner glow
  markRing: Texture;   // multiplier ring/pill backdrop for x2..x32 (text drawn by the game)
  plasmaBg: Texture;   // storm lava cell backdrop (mark ≥ 2 in storm)
  stormBg: Texture;    // obsidian storm cell backdrop
}
export function bakeSymbols(renderer: Renderer, opts: { edition: Edition; cellPx: number; env: [number, number, number][] }): SymbolSet;           // sync
export function bakeSymbolsAsync(renderer: Renderer, opts: { edition: Edition; cellPx: number; env: [number, number, number][] }): Promise<SymbolSet>; // one symbol per frame (rAF)
export function bakeCellFx(renderer: Renderer, cellPx: number): CellFx;
```

- `env` holds 3 RGB colours (0..1) from the sky's aurora ramp. The crystals reflect them, and they are baked again whenever the Kp tier changes.
- Everything is baked to `RenderTexture` via shader meshes. Baking must be idempotent (callable again after context loss).

## 3. Sky and world: `src/render/sky/*`

```ts
export interface SkyParams {
  kp: number;        // continuous 0..9 → tiers.skyAt()
  storm: number;     // 0..1 blend to the Solstorm sky (crimson void + plasma sun)
  glow: number;      // 0..1 charge-glow envelope (≤10 % luminance lift at 1)
  cme: number;       // 0..1 CME plasma front progress (top → bottom) during the cinematic, 0 = off
  sun: number;       // 0..1 plasma sun rising in the storm void
  time: number;      // seconds
}
export class SkyLayer extends Container {
  constructor(renderer: Renderer);
  resize(w: number, h: number, horizonY: number): void;   // CSS px; horizonY = y of the sea horizon
  update(p: SkyParams): void;                             // per frame, allocation-free
  envColors(): [number, number, number][];                // 3 current aurora colours for crystal reflections
}
```

Contents: sky gradient, Milky Way, stars (baked), aurora curtains (live, half resolution), the Møns Klint silhouette (baked), the sea with a reflection of the sky, and horizon haze.

## 4. Typography: `src/render/type/*`

```ts
export type IsStyle = 'ice' | 'gold' | 'molten' | 'plasma' | 'muted';
export class IsText extends Container {
  constructor(opts: { text: string; size: number /* cap height in CSS px */; style: IsStyle; tracking?: number; align?: 'center' | 'left' | 'right' });
  text: string;        // setter rebuilds the glyph sprites
  reveal: number;      // 0..1 stroke reveal (arc-length)
  glow: number;        // 0..2
  sweep: number;       // light sweep position -0.2..1.2
  readonly letters: Container[]; // per glyph, for animation (scale/rotation/alpha)
  readonly textWidth: number;
}
export function installIsfont(renderer: Renderer): void; // builds the CPU SDF atlas (BufferImageSource); idempotent
```

Glyph set: A–Z, ÆØÅ, 0–9 and `. , : % × + − - / · !`, plus space.

## 5. Audio: `src/audio/*`

```ts
export type Sfx = 'tap' | 'stakeUp' | 'stakeDown' | 'spin' | 'land' | 'chime' | 'shatter' | 'returnTick' | 'nettoCross'
  | 'markUp' | 'mote' | 'levelUp' | 'sun' | 'anticipation' | 'countTick' | 'win' | 'bigWin'
  | 'stormSwell' | 'stormRiser' | 'impact' | 'glassXL' | 'drop808' | 'letterSlam' | 'waveBoom' | 'reform' | 'summary' | 'fade';
export class GameAudio {
  readonly ctx: AudioContext | null;
  unlock(): Promise<void>;                          // call from the first user gesture (iOS-safe)
  play(name: Sfx, opts?: { col?: number; step?: number; level?: number; when?: number; gain?: number }): void;
  startBase(): void; setBaseLayers(n: number): void; // 1..5 layers, changes land on the next bar
  startStorm(atCtxTime: number): void; stormLevel(x: number): void; stopStorm(): void;
  duck(db: number, seconds: number): void;
  now(): number; latency(): number;                  // audio clock (s) and output latency (s)
  setMuted(b: boolean): void; setVolumes(music: number, sfx: number): void;
  suspend(): void; resume(): void;
}
export const audio: GameAudio;
```

- `col`: column 0..7 for the bell tone.
- `step`: cascade step for the chime ladder.
- `level`: win tier 1..5, or the mark level.

## 6. Post-processing: `src/render/fx/UberPost.ts`, `src/render/fx/Bloom.ts`

```ts
export class UberPost extends Filter {
  ca: number; vignette: number; grain: number; exposure: number; storm: number /*grade blend 0..1*/;
  zoom: number; zoomCenter: [number, number] /*0..1*/; glitch: number; heat: number; time: number;
  rings: Float32Array; // 3 rings × (x, y, radius, strength), x/y in 0..1
  cinematic: boolean;  // swaps to the full variant (zoom/rings/glitch/heat)
}
export function createBloom(): Filter & { threshold: number; strength: number }; // ~quarter-res bloom
```

## 7. Particles and shatter: `src/render/fx/Particles.ts`, `src/render/fx/Shatter.ts`, `src/render/fx/Motes.ts`

```ts
export type ParticleKind = 'spark' | 'ember' | 'snow' | 'dust' | 'shardlet' | 'glint';
export class Particles extends Container {
  constructor(max: number);
  emit(kind: ParticleKind, x: number, y: number, n: number, o?: { color?: number; speed?: number; spread?: number; angle?: number; life?: number; gravity?: number; size?: number }): void;
  update(dt: number): void; setBudget(max: number): void;
}
export class CellShatter extends Container {
  burst(tex: Texture, cx: number, cy: number, size: number, o: { warm: boolean }): void; // 9-seed Voronoi pieces of the symbol texture
  update(dt: number): void;
}
export class ScreenShatter extends Container {
  constructor(renderer: Renderer);
  start(frame: Texture, impact: { x: number; y: number }, o?: { cells?: number }): void; // 48 Voronoi shards of a captured frame
  crackReveal: number;   // 0..1 glowing cracks before the shards separate
  update(dt: number): void; readonly done: boolean;
}
export class Motes extends Container {
  launch(from: { x: number; y: number }, to: { x: number; y: number }, n: number, o?: { color?: number; dur?: number; onArrive?: () => void }): void; // helix along a field line
  update(dt: number): void;
}
```
