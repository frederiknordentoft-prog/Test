/**
 * The outcome engine: GDD section 3 told as a stream of Beats.
 *
 * It runs on the same compiled tables as the kernel and draws from an
 * identical sfc32 stream in the same order (first stop ring by ring, then one
 * draw per refilled cell), so for a given seed and nudge policy the engine
 * and the simulator pay exactly the same (sim.test.ts holds them to that).
 *
 * Beat grammar of one spin:
 *   spinStart spinStop (wins cascade)* [nova (wins cascade)*]
 *   then awaitNudge (spin() returns; nudge() carries on) or nudgeSkipped
 *   [freeSpinsTrigger] spinEnd
 * A spin stopped by the cap ends right after its last cascade.
 *
 * Demo rigs never touch the rules. A rig looks, with the kernel, for a seed
 * whose natural spin shows what was asked for, and plays that one spin from
 * it. Candidates come from a stream of their own, so the outcome stream is
 * exactly where it would have been without the rig.
 *
 * Executed by Node directly as well: explicit .ts extensions, erasable syntax only.
 */
import { BET_LEVELS, BIG_WIN_TIERS, RING_DIR, RINGS, SPOKES, SYM } from '../core/config.ts';
import { entropySeed, Rng } from '../core/rng.ts';
import type {
  Beat,
  BeatSpinEnd,
  Cell,
  EngineSnapshot,
  GameMode,
  Grid,
  IEngine,
  LineWin,
  NudgeChoice,
  NudgeOption,
  Refill,
  RigKind,
  SymbolId,
} from '../core/types.ts';
import { createKernel, OUT_AWARD, OUT_INITIAL_CHAIN, OUT_NOVA, OUT_OFFERED } from './kernel.ts';
import { COMET_DEN, compileModel, KIND_FREE_INIT, KIND_FREE_REFILL, KIND_INIT, KIND_REFILL, MODEL, modelInfoOf, NO_LINE, PARAMS, STATS } from './model.ts';
import type { CompiledModel, ModelParams } from './model.ts';

const WILD = SYM.WILD;
const SCATTER = SYM.SCATTER;
const CELLS = RINGS * SPOKES;
const COMET_SCALE = COMET_DEN / 4294967296;
/** Kernel spins a rig may try before it gives up and lets the spin fall naturally. */
const RIG_ATTEMPTS = 3_000_000;
/** Tier floors in tenths of the bet. */
const BIG = BIG_WIN_TIERS[0].min * 10;
const MEGA = BIG_WIN_TIERS[1].min * 10;
const SUPERNOVA = BIG_WIN_TIERS[2].min * 10;

/** The board before the first spin: every symbol on show, nothing lined up. */
export const INITIAL_GRID: readonly (readonly number[])[] = [
  [7, 0, 4, 1, 5, 2, 6, 3],
  [1, 5, 2, 6, 3, 7, 0, 4],
  [4, 3, 9, 0, 6, 1, 5, 2],
  [2, 6, 1, 8, 0, 4, 3, 5],
];

export interface EngineOptions {
  /** Defaults to entropySeed(). */
  seed?: number;
  /** Defaults to the shipped PARAMS. For tests and calibration. */
  model?: ModelParams;
}

const defaultModel: { cm: CompiledModel | null } = { cm: null };
function shippedModel(): CompiledModel {
  if (!defaultModel.cm) defaultModel.cm = compileModel(PARAMS);
  return defaultModel.cm;
}

function flatten(grid: readonly (readonly number[])[]): Uint8Array {
  const b = new Uint8Array(CELLS);
  for (let r = 0; r < RINGS; r++) for (let s = 0; s < SPOKES; s++) b[r * SPOKES + s] = grid[r][s];
  return b;
}

function unflatten(b: Uint8Array): Grid {
  const grid: Grid = [];
  for (let r = 0; r < RINGS; r++) grid.push(Array.from(b.subarray(r * SPOKES, (r + 1) * SPOKES)) as SymbolId[]);
  return grid;
}

/** +1 notch moves the symbol at spoke s to spoke s + 1: new[s] = old[(s − dir + 8) % 8]. */
function rotateRing(b: Uint8Array, ring: number, dir: number): void {
  const base = ring * SPOKES;
  const old = b.slice(base, base + SPOKES);
  for (let s = 0; s < SPOKES; s++) b[base + s] = old[(s - dir + SPOKES) % SPOKES];
}

/** The paying lines on a board. `unit` is øre per tenth of a bet. Returns the unmultiplied sum in tenths too. */
function linesOn(cm: CompiledModel, b: Uint8Array, mult: number, unit: number): { lines: LineWin[]; tenths: number } {
  const lines: LineWin[] = [];
  let tenths = 0;
  for (let s = 0; s < SPOKES; s++) {
    const t = cm.TRI[b[s] | (b[SPOKES + s] << 4) | (b[2 * SPOKES + s] << 8)];
    if (t === NO_LINE) continue;
    const k = t | (b[3 * SPOKES + s] << 4);
    const count = cm.CNT[k] as 3 | 4;
    const cells: Cell[] = [];
    for (let r = 0; r < count; r++) cells.push({ ring: r, spoke: s });
    const pay = cm.PAYT[k];
    lines.push({ spoke: s, symbol: cm.LINESYM[k] as SymbolId, count, cells, pay: pay / 10, amount: pay * mult * unit });
    tenths += pay;
  }
  return { lines, tenths };
}

/** Line amounts may not add up to more than `room` øre (the cap). */
function fitToRoom(lines: LineWin[], room: number): number {
  let sum = 0;
  for (const line of lines) {
    if (line.amount > room - sum) line.amount = room - sum;
    sum += line.amount;
  }
  return sum;
}

/** Pure line evaluation of any grid, for tests and tools. Amounts are in øre at `bet` and `multiplier`. */
export function evaluateGrid(grid: readonly (readonly number[])[], opts: { multiplier?: number; bet?: number; model?: ModelParams } = {}): LineWin[] {
  const cm = opts.model ? compileModel(opts.model) : shippedModel();
  return linesOn(cm, flatten(grid), opts.multiplier ?? 1, (opts.bet ?? 100) / 10).lines;
}

/** A grid with one ring turned one notch, as a nudge or a tick does it. */
export function rotatedGrid(grid: readonly (readonly number[])[], ring: number, dir: 1 | -1): Grid {
  const b = flatten(grid);
  rotateRing(b, ring, dir);
  return unflatten(b);
}

export function createEngine(opts: EngineOptions = {}): IEngine {
  const params = opts.model ?? PARAMS;
  const cm = opts.model ? compileModel(params) : shippedModel();
  const model = opts.model ? modelInfoOf(params, STATS) : MODEL;
  const seed = (opts.seed ?? entropySeed()) >>> 0;
  const mainRng = new Rng(seed);
  const rigRng = new Rng((seed ^ 0x51e11a0a) >>> 0);
  const probe = createKernel(cm);

  const g = flatten(INITIAL_GRID);
  let mode: GameMode = 'base';
  let charge = 0;
  let freeRemaining = 0;
  let freeTotal = 0;
  let freeWin = 0;
  let activeBet = 0;
  let pendingRig: RigKind | null = null;

  // The spin in progress. It survives the pause at awaitNudge.
  let rng = mainRng;
  let spinMode: GameMode = 'base';
  let unit = 0;
  let ladder = 0;
  let total = 0;
  let comets = 0;
  let scatters: Cell[] = [];
  let novaUsed = false;
  let nudgeUsed = false;
  let capped = false;
  let awaiting = false;

  const ladderIndex = (): number => (ladder < cm.ladderLast ? ladder : cm.ladderLast);

  function pick(k: number): number {
    return cm.PICK[cm.OFF[k] + ((rng.u32() * cm.SCALE[k]) | 0)];
  }

  /** Eight weighted symbols, then the ring's one possible comet (same draws as the kernel). */
  function fillRing(kind: number, ring: number): void {
    const k = kind * RINGS + ring;
    const base = ring * SPOKES;
    for (let s = 0; s < SPOKES; s++) g[base + s] = pick(k);
    if (((rng.u32() * COMET_SCALE) | 0) < cm.COMET[k]) {
      const spoke = rng.u32() >>> 29;
      g[base + spoke] = SCATTER;
      comets++;
      scatters.push({ ring, spoke });
    }
  }

  /**
   * Drum-roll flags (GDD section 4), from the stopped rings only.
   * Ring 2: a Saturn / Sun / wild pair on rings 0–1, or the comets are one short.
   * Ring 3: three of a high symbol on rings 0–2, or the comets are one short or already home.
   * In Kometnat ring 0 is wild on every spoke, so a "pair" there would fire on almost
   * every spin and mean nothing: only comets (one short of +2) wind up ring 2.
   */
  function anticipation(): boolean[] {
    const flags = [false, false, false, false];
    const need = spinMode === 'free' ? 1 : 2;
    let inner = 0;
    let middle = 0;
    for (const c of scatters) {
      if (c.ring < 2) inner++;
      if (c.ring < 3) middle++;
    }
    flags[2] = inner >= need;
    flags[3] = middle >= need;
    for (let s = 0; s < SPOKES; s++) {
      const a = g[s];
      const b = g[SPOKES + s];
      if (spinMode === 'base' && a >= SYM.SATURN && a <= WILD && b >= SYM.SATURN && b <= WILD && (a === b || a === WILD || b === WILD)) flags[2] = true;
      const t = cm.TRI[a | (b << 4) | (g[2 * SPOKES + s] << 8)];
      if (t !== NO_LINE && t >= SYM.MOON) flags[3] = true;
    }
    return flags;
  }

  function optionFor(choice: NudgeChoice): { option: NudgeOption; tenths: number } {
    const b = g.slice();
    rotateRing(b, choice.ring, choice.dir);
    const mult = cm.LADDER[ladderIndex()];
    const { lines, tenths } = linesOn(cm, b, mult, unit);
    const amount = fitToRoom(lines, (cm.capTenths - total) * unit);
    return { option: { ring: choice.ring, dir: choice.dir, lines, amount }, tenths };
  }

  function finishSpin(beats: Beat[]): void {
    const bet = activeBet;
    const totalAmount = total * unit;
    const award = spinMode === 'free' ? cm.AWARD_FREE[comets] : cm.AWARD_BASE[comets];
    if (spinMode === 'free') freeWin += totalAmount;
    if (award > 0) {
      if (spinMode === 'base') {
        mode = 'free';
        freeRemaining = award;
        freeTotal = award;
        freeWin = 0;
      } else {
        freeRemaining += award;
        freeTotal += award;
      }
      beats.push({ type: 'freeSpinsTrigger', count: award, scatters: scatters.slice(), retrigger: spinMode === 'free', remaining: freeRemaining });
    }
    const end: BeatSpinEnd = { type: 'spinEnd', mode: spinMode, totalAmount, totalMultiple: totalAmount / bet, capped, freeSpinsRemaining: freeRemaining };
    if (spinMode === 'free' && freeRemaining === 0) {
      end.freeSpinsTotalAmount = freeWin;
      end.freeSpinsEnded = true;
      mode = 'base';
    }
    beats.push(end);
    rng = mainRng;
  }

  /** Evaluate, cascade, Nova, nudge offer: the kernel's loop, with beats. */
  function continueSpin(beats: Beat[]): void {
    const refillKind = (spinMode === 'free' ? KIND_FREE_REFILL : KIND_REFILL) * RINGS;
    const firstBurstRing = spinMode === 'free' ? 1 : 0;
    for (;;) {
      const li = ladderIndex();
      const mult = cm.LADDER[li];
      const { lines, tenths } = linesOn(cm, g, mult, unit);
      if (lines.length > 0) {
        let step = tenths * mult;
        if (total + step >= cm.capTenths) {
          step = cm.capTenths - total;
          capped = true;
          fitToRoom(lines, step * unit);
        }
        total += step;

        // Burst and refill in line order: spokes ascending, ring 0 outward.
        const removed: Cell[] = [];
        const refills: Refill[] = [];
        for (const line of lines) {
          for (let r = firstBurstRing; r < line.count; r++) {
            const cell: Cell = { ring: r, spoke: line.spoke };
            const symbol = pick(refillKind + r) as SymbolId;
            g[r * SPOKES + line.spoke] = symbol;
            removed.push(cell);
            refills.push({ cell, symbol });
          }
        }
        const chargeBefore = charge;
        charge += removed.length;
        beats.push({
          type: 'wins',
          lines,
          ladderIndex: li,
          multiplier: mult,
          stepAmount: step * unit,
          totalAmount: total * unit,
          novaChargeBefore: chargeBefore,
          novaChargeAfter: charge,
          novaThreshold: cm.threshold,
        });

        const gridAfterRefill = unflatten(g);
        for (let r = 0; r < RINGS; r++) rotateRing(g, r, RING_DIR[r]);
        ladder++;
        const next = ladderIndex();
        beats.push({ type: 'cascade', removed, refills, gridAfterRefill, tick: [...RING_DIR], grid: unflatten(g), nextLadderIndex: next, nextMultiplier: cm.LADDER[next] });
        if (capped) break;
        continue;
      }

      // The chain is dead: Nova first, then the player's move, then the end.
      if (charge >= cm.threshold && !novaUsed) {
        const converted: Cell[] = [];
        for (let i = 0; i < 2 * SPOKES; i++) {
          if (g[i] !== SCATTER && g[i] !== WILD) {
            g[i] = WILD;
            converted.push({ ring: i >> 3, spoke: i & 7 });
          }
        }
        charge = 0;
        novaUsed = true;
        beats.push({ type: 'nova', converted, grid: unflatten(g) });
        continue;
      }
      if (nudgeUsed) break;
      nudgeUsed = true;

      // All eight moves. Best: highest pay, ties to the lowest ring, then clockwise.
      const options: NudgeOption[] = [];
      let best: NudgeOption | null = null;
      let bestTenths = 0;
      for (let ring = 0; ring < RINGS; ring++) {
        for (const dir of [1, -1] as const) {
          const { option, tenths: pay } = optionFor({ ring, dir });
          options.push(option);
          if (pay > bestTenths) {
            bestTenths = pay;
            best = option;
          }
        }
      }
      if (!best) {
        beats.push({ type: 'nudgeSkipped', reason: 'noWinningMove' });
        break;
      }
      awaiting = true;
      beats.push({ type: 'awaitNudge', options, best });
      return;
    }
    finishSpin(beats);
  }

  function rigMatches(kind: RigKind, win: number): boolean {
    const out = probe.out;
    // No Kometnat riding along, and no winning move left over: the spin is
    // then the same whatever the player does at the nudge.
    const clean = out[OUT_AWARD] === 0;
    const settled = out[OUT_OFFERED] === 0;
    switch (kind) {
      case 'dead':
        return win === 0 && clean && settled && out[OUT_NOVA] === 0;
      case 'nudgeWin':
        return out[OUT_INITIAL_CHAIN] === 0 && out[OUT_NOVA] === 0 && out[OUT_OFFERED] === 1 && clean && win >= 20;
      case 'chain':
        return out[OUT_INITIAL_CHAIN] >= 3 && clean;
      case 'bigWin':
        return win >= BIG && win < MEGA && clean && settled;
      case 'megaWin':
        return win >= MEGA && win < SUPERNOVA && clean && settled;
      case 'supernovaWin':
        return win >= SUPERNOVA && clean && settled;
      case 'freeSpins':
        return out[OUT_AWARD] > 0;
      case 'nova':
        return out[OUT_NOVA] === 1 && out[OUT_INITIAL_CHAIN] >= 1 && clean;
      default:
        return false;
    }
  }

  /** Point this spin's draws at a seed whose natural outcome is what the rig asks for. */
  function applyRig(kind: RigKind): void {
    const chargeBefore = charge;
    // The star is topped up so the spin's first win fills it and the Nova follows at the dead point.
    if (kind === 'nova') charge = Math.max(charge, cm.threshold - 1);
    for (let i = 0; i < RIG_ATTEMPTS; i++) {
      const candidate = rigRng.u32();
      probe.seed(candidate);
      probe.setCharge(charge);
      const win = probe.playSpin(false, true);
      if (rigMatches(kind, win)) {
        rng = new Rng(candidate);
        return;
      }
    }
    charge = chargeBefore;
  }

  function spin(bet: number): Beat[] {
    if (awaiting) throw new Error('A nudge is pending: resolve it with nudge() before the next spin.');
    if (mode === 'base') {
      if (!(BET_LEVELS as readonly number[]).includes(bet)) throw new Error(`Bet ${bet} is not one of BET_LEVELS.`);
      activeBet = bet;
    }
    spinMode = mode;
    unit = activeBet / 10;
    ladder = 0;
    total = 0;
    comets = 0;
    scatters = [];
    novaUsed = false;
    nudgeUsed = false;
    capped = false;
    rng = mainRng;

    const beats: Beat[] = [];
    if (spinMode === 'free') {
      beats.push({ type: 'spinStart', mode: 'free', bet: activeBet, freeSpinIndex: freeTotal - freeRemaining + 1, freeSpinsTotal: freeTotal });
      freeRemaining--;
      for (let s = 0; s < SPOKES; s++) g[s] = WILD;
      for (let r = 1; r < RINGS; r++) fillRing(KIND_FREE_INIT, r);
    } else {
      beats.push({ type: 'spinStart', mode: 'base', bet: activeBet });
      if (pendingRig) {
        const kind = pendingRig;
        pendingRig = null;
        applyRig(kind);
      }
      for (let r = 0; r < RINGS; r++) fillRing(KIND_INIT, r);
    }
    beats.push({ type: 'spinStop', grid: unflatten(g), scatters: scatters.slice(), anticipation: anticipation() });
    continueSpin(beats);
    return beats;
  }

  function checkChoice(choice: NudgeChoice): void {
    if (!Number.isInteger(choice.ring) || choice.ring < 0 || choice.ring >= RINGS || (choice.dir !== 1 && choice.dir !== -1)) {
      throw new Error('A nudge turns one ring (0–3) one notch (+1 or −1).');
    }
  }

  function nudge(choice: NudgeChoice | null): Beat[] {
    if (!awaiting) throw new Error('No nudge is pending.');
    const beats: Beat[] = [];
    if (choice === null) {
      awaiting = false;
      beats.push({ type: 'nudgeSkipped', reason: 'passed' });
      finishSpin(beats);
      return beats;
    }
    checkChoice(choice);
    awaiting = false;
    rotateRing(g, choice.ring, choice.dir);
    beats.push({ type: 'nudge', choice: { ring: choice.ring, dir: choice.dir }, grid: unflatten(g) });
    continueSpin(beats);
    return beats;
  }

  function snapshot(): EngineSnapshot {
    const li = ladderIndex();
    return {
      mode,
      grid: unflatten(g),
      novaCharge: charge,
      novaThreshold: cm.threshold,
      freeSpinsRemaining: freeRemaining,
      freeSpinsTotal: freeTotal,
      freeSpinsWin: freeWin,
      ladderIndex: li,
      multiplier: cm.LADDER[li],
      awaitingNudge: awaiting,
      activeBet,
    };
  }

  return {
    model,
    snapshot,
    spin,
    nudge,
    previewNudge(choice: NudgeChoice): NudgeOption {
      checkChoice(choice);
      return optionFor(choice).option;
    },
    rig(kind: RigKind): void {
      pendingRig = kind;
    },
  };
}
