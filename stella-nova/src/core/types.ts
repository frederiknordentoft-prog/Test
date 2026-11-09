/**
 * STELLA NOVA — module contracts.
 *
 * Four facades talk to each other only through these interfaces:
 *
 *   IEngine    (src/math)   pure outcome maths, no DOM, no three.js
 *   IGameView  (src/render) everything drawn in WebGL
 *   IAudio     (src/audio)  synthesised music + sfx
 *   IHud       (src/ui)     DOM chrome on top of the canvas
 *
 * The Director (src/game) owns the wallet and the flow. It asks the engine for
 * Beats and plays them back through view / audio / hud.
 *
 * DO NOT EDIT from feature modules. Implement against it; if something is
 * missing, add it to your own module and report it in your final summary.
 */

import type { SymbolId } from './config';

export type { SymbolId } from './config';

// ───────────────────────────── Board data ─────────────────────────────

/** grid[ring][spoke]. ring 0 = innermost. */
export type Grid = SymbolId[][];

export interface Cell {
  ring: number;
  spoke: number;
}

export type GameMode = 'base' | 'free';

/** One paying alignment: 3 or 4 matching symbols from the centre outward. */
export interface LineWin {
  spoke: number;
  /** Paying symbol. SYM.WILD when the line is wilds only. */
  symbol: SymbolId;
  count: 3 | 4;
  /** The matched cells, ring 0 first. */
  cells: Cell[];
  /** Paytable value as a multiple of the total bet, before the multiplier. */
  pay: number;
  /** Amount in øre, after the multiplier. */
  amount: number;
}

export interface NudgeChoice {
  ring: number;
  /** +1 = one notch clockwise (seen from above), −1 = counter-clockwise. */
  dir: 1 | -1;
}

/** What a nudge would give right now. */
export interface NudgeOption extends NudgeChoice {
  lines: LineWin[];
  /** Sum of line amounts in øre, at the multiplier that would apply. */
  amount: number;
}

export interface Refill {
  cell: Cell;
  symbol: SymbolId;
}

// ───────────────────────────── Engine beats ─────────────────────────────

export interface BeatSpinStart {
  type: 'spinStart';
  mode: GameMode;
  bet: number;
  /** 1-based index of this free spin, when mode === 'free'. */
  freeSpinIndex?: number;
  freeSpinsTotal?: number;
}

export interface BeatSpinStop {
  type: 'spinStop';
  grid: Grid;
  scatters: Cell[];
  /**
   * Per ring: true when this ring's stop deserves a drum-roll (the rings
   * already stopped hold a live setup that this ring can complete).
   * Derived from the real outcome only. Never fabricate a near-miss.
   */
  anticipation: boolean[];
}

export interface BeatWins {
  type: 'wins';
  lines: LineWin[];
  ladderIndex: number;
  multiplier: number;
  /** øre won in this evaluation step (after multiplier). */
  stepAmount: number;
  /** øre won so far in this spin. */
  totalAmount: number;
  novaChargeBefore: number;
  novaChargeAfter: number;
  novaThreshold: number;
}

export interface BeatCascade {
  type: 'cascade';
  /** Cells whose symbols burst. */
  removed: Cell[];
  /** New symbols dropping into those same cells. */
  refills: Refill[];
  /** Grid after the refill, before the tick. */
  gridAfterRefill: Grid;
  /** Notches each ring advances after the refill (signed). */
  tick: number[];
  /** Grid after the tick. This is what gets evaluated next. */
  grid: Grid;
  nextLadderIndex: number;
  nextMultiplier: number;
}

export interface BeatNova {
  type: 'nova';
  /** Cells that turn wild (rings 0 and 1, scatters excluded). */
  converted: Cell[];
  grid: Grid;
}

export interface BeatAwaitNudge {
  type: 'awaitNudge';
  /** All 8 options (4 rings × 2 directions), winning or not. */
  options: NudgeOption[];
  /** The best option. Only emitted when best.amount > 0. */
  best: NudgeOption;
}

export interface BeatNudge {
  type: 'nudge';
  choice: NudgeChoice;
  grid: Grid;
}

export interface BeatNudgeSkipped {
  type: 'nudgeSkipped';
  reason: 'noWinningMove' | 'passed';
}

export interface BeatFreeSpinsTrigger {
  type: 'freeSpinsTrigger';
  /** Spins awarded by this trigger. */
  count: number;
  scatters: Cell[];
  retrigger: boolean;
  remaining: number;
}

export interface BeatSpinEnd {
  type: 'spinEnd';
  mode: GameMode;
  /** øre won in this spin. */
  totalAmount: number;
  /** totalAmount / bet. */
  totalMultiple: number;
  /** True when the max-win cap ended the spin. */
  capped: boolean;
  freeSpinsRemaining: number;
  /** Present on the last free spin: the whole feature's win in øre. */
  freeSpinsTotalAmount?: number;
  freeSpinsEnded?: boolean;
}

export type Beat =
  | BeatSpinStart
  | BeatSpinStop
  | BeatWins
  | BeatCascade
  | BeatNova
  | BeatAwaitNudge
  | BeatNudge
  | BeatNudgeSkipped
  | BeatFreeSpinsTrigger
  | BeatSpinEnd;

// ───────────────────────────── Engine ─────────────────────────────

/** Demo rigs: force the outcome of the next paid spin. Clearly a demo tool. */
export type RigKind = 'nova' | 'freeSpins' | 'bigWin' | 'megaWin' | 'supernovaWin' | 'chain' | 'nudgeWin' | 'dead';

export interface EngineSnapshot {
  mode: GameMode;
  grid: Grid;
  novaCharge: number;
  novaThreshold: number;
  freeSpinsRemaining: number;
  freeSpinsTotal: number;
  freeSpinsWin: number;
  ladderIndex: number;
  multiplier: number;
  awaitingNudge: boolean;
  /** Bet the current free-spin round is played at. */
  activeBet: number;
}

export interface PaytableEntry {
  symbol: SymbolId;
  /** Multiples of the total bet. */
  pay3: number;
  pay4: number;
}

export interface ModelStats {
  /** Return to player with the greedy best nudge every spin, 0..1. */
  rtp: number;
  /** Return to player if the nudge is never used. */
  rtpNoNudge: number;
  /** Share of paid spins that pay anything. */
  hitFrequency: number;
  /** Share of paid spins that pay at least the bet. */
  hitFrequencyAtLeastBet: number;
  /** Standard deviation of the per-spin return, in bets. */
  stdDev: number;
  /** 1 in N paid spins. */
  freeSpinsEvery: number;
  novaEvery: number;
  /** RTP contribution by source, sums to rtp. */
  breakdown: { base: number; nudge: number; nova: number; freeSpins: number };
  /** Spins simulated for these figures. */
  sampleSize: number;
  maxObservedMultiple: number;
}

export interface ModelInfo {
  name: string;
  version: string;
  paytable: PaytableEntry[];
  /** Multiplier by cascade index. The last value repeats. */
  ladder: number[];
  /** Free spins awarded for 3 or 4 comets in the base game (at most one comet per ring). */
  freeSpinsAward: { 3: number; 4: number };
  /** Extra spins for 2 or 3 comets during free spins (ring 0 is the wild wreath there). */
  retriggerAward: { 2: number; 3: number };
  maxWinMultiple: number;
  novaThreshold: number;
  stats: ModelStats;
}

export interface IEngine {
  readonly model: ModelInfo;
  snapshot(): EngineSnapshot;
  /**
   * Start a paid spin (base mode) or the next free spin (free mode; `bet` is
   * ignored and the round's bet is used). Returns beats up to and including
   * either `awaitNudge` or `spinEnd`. Throws while a nudge is pending.
   */
  spin(bet: number): Beat[];
  /** Resolve the pending nudge. null = pass. Returns beats up to `spinEnd`. */
  nudge(choice: NudgeChoice | null): Beat[];
  /** Pure preview of a nudge on the current grid. Valid while awaiting a nudge. */
  previewNudge(choice: NudgeChoice): NudgeOption;
  /** Force the next paid spin's outcome (demo menu). */
  rig(kind: RigKind): void;
}

// ───────────────────────────── View ─────────────────────────────

export type Quality = 'low' | 'medium' | 'high';
export type BigWinTier = 1 | 2 | 3;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewLayout {
  /** CSS pixels of the canvas container. */
  width: number;
  height: number;
  /**
   * CSS pixels covered by HUD chrome on each side. The orrery is centred in,
   * and fitted to, the rectangle that remains.
   */
  insets: Insets;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Moments inside a view animation that other modules react to (sound,
 * haptics, HUD pops). The view emits them at the exact frame they happen.
 */
export type ViewCue =
  | { type: 'whirlStart' }
  | { type: 'ringNotch'; ring: number; speed: number }
  | { type: 'ringStop'; ring: number; isLast: boolean }
  | { type: 'anticipation'; ring: number; on: boolean }
  | { type: 'scatterLand'; cell: Cell; countSoFar: number }
  | { type: 'beamFire'; spoke: number; count: 3 | 4; symbol: SymbolId; index: number; of: number }
  | { type: 'gemBurst'; cell: Cell; symbol: SymbolId; index: number }
  | { type: 'stardustArrive'; amount: number }
  | { type: 'refillLand'; cell: Cell; symbol: SymbolId; index: number }
  | { type: 'tick' }
  | { type: 'nudgeDetent'; ring: number; dir: 1 | -1 }
  | { type: 'nudgeCommit'; ring: number; dir: 1 | -1 }
  | { type: 'nudgeCancel'; ring: number }
  | { type: 'novaCharge' }
  | { type: 'novaFlash' }
  | { type: 'novaShockwave' }
  | { type: 'wildTransform'; cell: Cell; index: number }
  | { type: 'cometPass' }
  | { type: 'modeShift'; mode: GameMode };

export interface SpinStopOptions {
  turbo: boolean;
  anticipation: boolean[];
  scatters: Cell[];
}

export interface IGameView {
  readonly canvas: HTMLCanvasElement;

  init(container: HTMLElement, opts: { quality: Quality; reducedMotion: boolean }): Promise<void>;
  setLayout(layout: ViewLayout): void;
  /** Advance all view-side simulation by dt seconds. No rendering. */
  update(dt: number): void;
  /** Draw one frame. */
  render(): void;
  setQuality(q: Quality): void;
  setReducedMotion(on: boolean): void;
  onCue(cb: (cue: ViewCue) => void): void;
  dispose(): void;

  // Board ---------------------------------------------------------------
  /** Place symbols instantly, rings at rest. */
  setGrid(grid: Grid): void;
  /** Rings wind back, then whirl. Returns immediately; whirl continues until spinStop. */
  spinStart(opts: { turbo: boolean }): void;
  /** Swap in the outcome while blurred, then stop rings 0→3. Resolves when the last ring has settled. */
  spinStop(grid: Grid, opts: SpinStopOptions): Promise<void>;
  /** Beams from the star through the winning cells, symbols pulse. */
  showWins(lines: LineWin[], opts: { multiplier: number; ladderIndex: number; turbo: boolean }): Promise<void>;
  /** Burst → stardust into the star → shooting-star refills → rings tick. */
  cascade(beat: BeatCascade, opts: { turbo: boolean }): Promise<void>;
  /** Supernova: swell, silence, flash, shockwave, rings 0–1 turn wild. */
  nova(converted: Cell[], grid: Grid, opts: { turbo: boolean }): Promise<void>;
  /** 0..1 fill of the central star. */
  setNovaCharge(v01: number, opts?: { animate?: boolean }): void;

  // Nudge ---------------------------------------------------------------
  /**
   * Which ring is under this pointer, and the pointer's polar angle on the
   * orrery plane (radians, same convention as spokeAngle). null = not on a ring.
   */
  pickRing(clientX: number, clientY: number): { ring: number; angle: number } | null;
  /** Rings look unlocked and invite a drag. */
  setNudgeActive(active: boolean): void;
  /** Live drag: visual rotation offset of one ring from its rest notch, radians. */
  setRingOffset(ring: number, offsetRad: number): void;
  /** End of drag: commit one notch in `dir`, or spring back when dir is 0. */
  releaseRing(ring: number, dir: 0 | 1 | -1): Promise<void>;
  /** Rotate a ring one notch without a drag (auto-nudge, keyboard). */
  applyNudge(choice: NudgeChoice): Promise<void>;
  /** Faint beams for what a drag would win. null clears. */
  previewLines(lines: { spoke: number; count: 3 | 4; symbol: SymbolId }[] | null): void;
  /** Pulse a ring with a direction arrow. null clears. */
  setHint(choice: NudgeChoice | null): void;

  // Modes & celebrations ---------------------------------------------------
  /** Base ↔ free-spins world. In free mode ring 0 is the eternal wreath of wilds. */
  setMode(mode: GameMode, opts?: { animate?: boolean }): Promise<void>;
  celebrateScatters(cells: Cell[]): Promise<void>;
  /** Start (tier) or stop (null) the big-win spectacle. */
  bigWin(tier: BigWinTier | null): void;
  /** Slow orbiting camera for the splash screen. */
  attract(on: boolean): void;
  /** Camera sweep from splash framing to play framing. */
  intro(): Promise<void>;
  shake(amount: number): void;
  /**
   * A small render of the real 3D symbol as a PNG data URL (transparent
   * background), for the paytable. Call after init.
   */
  thumbnail(id: SymbolId, sizePx: number): string;

  // Screen-space anchors (CSS px, relative to the canvas container) ---------
  cellScreen(cell: Cell): ScreenPoint;
  spokeTipScreen(spoke: number): ScreenPoint;
  starScreen(): ScreenPoint;
}

// ───────────────────────────── Audio ─────────────────────────────

export type MusicState = 'splash' | 'base' | 'spin' | 'tension' | 'free' | 'nova' | 'bigwin';

export type SfxName =
  | 'uiTap'
  | 'uiToggle'
  | 'uiOpen'
  | 'uiClose'
  | 'betUp'
  | 'betDown'
  | 'spinStart'
  | 'ringNotch'
  | 'ringStop'
  | 'scatterLand'
  | 'beamFire'
  | 'lineWin'
  | 'gemBurst'
  | 'stardust'
  | 'refillLand'
  | 'tick'
  | 'multiplierUp'
  | 'nudgeReady'
  | 'nudgeDetent'
  | 'nudgeCommit'
  | 'nudgeCancel'
  | 'hint'
  | 'novaCharge'
  | 'novaReady'
  | 'novaSwell'
  | 'novaFlash'
  | 'novaShockwave'
  | 'wildTransform'
  | 'cometPass'
  | 'freeSpinsTrigger'
  | 'freeSpinsStart'
  | 'freeSpinsEnd'
  | 'bigWinStart'
  | 'countTick'
  | 'countEnd'
  | 'smallWin'
  | 'noWin'
  | 'error';

export interface SfxParams {
  /** Position in a sequence (ring 0–3, cascade step, n-th refill…). Drives pitch. */
  index?: number;
  /** Size of the moment, 0..3. Drives richness. */
  tier?: number;
  /** 0..1 */
  gain?: number;
  /** −1..1 */
  pan?: number;
  /** Symbol the sound belongs to, when relevant. */
  symbol?: SymbolId;
}

export interface IAudio {
  /** True once the AudioContext is running. */
  readonly ready: boolean;
  /** Call from a user gesture. Builds the graph and starts music. Safe to call twice. */
  unlock(): Promise<void>;
  setMuted(muted: boolean): void;
  setVolume(bus: 'master' | 'music' | 'sfx', v01: number): void;
  music(state: MusicState): void;
  sfx(name: SfxName, p?: SfxParams): void;
  /** Continuous whirl of the rings. intensity 0..1 follows ring speed. */
  whirl(on: boolean, intensity?: number): void;
  /** Rising tension bed while a ring is in anticipation. */
  tension(on: boolean): void;
  /** Pause / resume everything (tab hidden). */
  suspend(on: boolean): void;
}

// ───────────────────────────── HUD ─────────────────────────────

export type SpinButtonState = 'ready' | 'spinning' | 'nudge' | 'auto' | 'free' | 'disabled';

export interface HudCallbacks {
  onStart(): void;
  onSpin(): void;
  onSkip(): void;
  onBet(dir: 1 | -1): void;
  /** Start autoplay with n spins, or stop when null. */
  onAuto(count: number | null): void;
  onTurbo(on: boolean): void;
  onAutoNudge(on: boolean): void;
  onNudgePass(): void;
  /** Keyboard / button nudge without a drag. */
  onNudgeChoice(choice: NudgeChoice): void;
  onMute(muted: boolean): void;
  onVolume(bus: 'music' | 'sfx', v01: number): void;
  onQuality(q: Quality): void;
  onDemo(action: RigKind | 'addBalance' | 'resetBalance'): void;
}

/** Live figures from a running Monte Carlo simulation (the info panel's maths lab). */
export interface SimProgress {
  spins: number;
  target: number;
  rtp: number;
  hitFrequency: number;
  freeSpinsTriggers: number;
  novaTriggers: number;
  maxMultiple: number;
  done: boolean;
}

/** Starts a simulation that reports in chunks without blocking the frame. */
export type Simulator = (spins: number, onProgress: (p: SimProgress) => void) => { cancel(): void };

export interface IHud {
  init(root: HTMLElement, cb: HudCallbacks, model: ModelInfo): void;
  /** Real symbol renders for the paytable (id → data URL). Until set, the HUD draws its own SVG stand-ins. */
  setSymbolIcons(icons: Record<number, string>): void;
  /** Hook for the maths lab's "run simulation" button. */
  setSimulator(sim: Simulator): void;
  /** Restyle chrome for the free-spins world. */
  setMode(mode: GameMode): void;
  setQuality(q: Quality): void;
  /** Persistent one-line status under the orrery. null clears. */
  setMessage(text: string | null, kind?: 'info' | 'win' | 'feature'): void;
  /** CSS px of chrome covering the canvas on each side, for ViewLayout. */
  getInsets(): Insets;
  /** Advance count-ups and timers. Driven by the game loop. */
  update(dt: number): void;

  showSplash(on: boolean): void;
  setBalance(amount: number, opts?: { animate?: boolean }): void;
  setBet(amount: number, limits: { canDec: boolean; canInc: boolean }): void;
  /** Win field. countSeconds > 0 counts up from the current value. */
  setWin(amount: number, opts?: { countSeconds?: number }): void;
  setSpinState(state: SpinButtonState): void;
  setMultiplier(ladderIndex: number, value: number, opts?: { pulse?: boolean }): void;
  setNovaCharge(v01: number): void;
  setFreeSpins(info: { remaining: number; total: number; win: number } | null): void;
  setAuto(remaining: number | null): void;
  setTurbo(on: boolean): void;
  setAutoNudge(on: boolean): void;
  setMuted(on: boolean): void;
  /** "Dit træk" prompt. best is used for the optional hint text. */
  nudgePrompt(info: { on: boolean; bestAmount?: number }): void;
  toast(text: string, kind?: 'info' | 'win' | 'feature'): void;
  /** Floating label at a canvas-relative CSS px position. */
  floatText(at: ScreenPoint, text: string, kind?: 'line' | 'mult' | 'feature'): void;
  /** Full-screen count-up. Resolves when finished or skipped. */
  bigWin(tier: BigWinTier, amount: number, opts: { seconds: number }): Promise<void>;
  /** Ask a running bigWin / intro / outro to finish now. */
  skip(): void;
  freeSpinsIntro(count: number, retrigger: boolean): Promise<void>;
  freeSpinsOutro(totalAmount: number): Promise<void>;
  novaBanner(): Promise<void>;
}
