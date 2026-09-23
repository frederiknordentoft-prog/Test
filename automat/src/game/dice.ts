// Terningen: the dice rule, the store shape and its ONE mutator. Pure: no DOM, no Pixi.
// A die is status only — it never expires, is never spent and never changes any win, odds or RTP.
import { fmtInt } from '../core/format.ts';

export const DICE_GOAL = 1948;
export const DICE_MIN_X = 10;

/** One die for a spin whose OWN total is ≥ 10× the stake it was evaluated at. Integer øre, exact: 10,00× counts, 9,99× does not. */
export const diceFor = (totalOre: number, stakeOre: number): boolean => stakeOre > 0 && totalOre >= DICE_MIN_X * stakeOre;

export interface DiceStore {
  v: 1;
  count: number;              // real dice; never expire, never spent
  seed: number;               // uint32, per-player gate fill order (newSessionSeed() at creation)
  firstAt: number | null;     // epoch ms of die nr. 1
  lastAt: number | null;
  helloSeen: boolean;         // first-visit introduction shown (once, ever)
  introSeen: boolean;         // first-die card shown (once, ever)
  unlock: 'none' | 'pending' | 'seen';
  offered: boolean;           // the 1948 card was shown (it is never shown again)
  unlockedAt: number | null;  // set only by a REAL ceremony (seal-break beat or skip)
}

export function diceDefaults(seed: number): DiceStore {
  return { v: 1, count: 0, seed: seed >>> 0, firstAt: null, lastAt: null, helloSeen: false, introSeen: false, unlock: 'none', offered: false, unlockedAt: null };
}

/** THE only mutator. Returns the accession number (the new count). */
export function addDie(d: DiceStore, now: number): number {
  d.count++; d.lastAt = now; if (d.firstAt === null) d.firstAt = now;
  if (d.count >= DICE_GOAL && d.unlock === 'none') d.unlock = 'pending';
  return d.count;
}

export const fmtDice = (n: number) => (n <= 9999 ? String(n) : fmtInt(n));   // "1948", never "1.948"
export const diceWord = (n: number) => (n === 1 ? 'terning' : 'terninger');

/** What renderers read (HUD, GateView, chamber DOM): never the store itself. */
export interface DiceView { count: number; unlock: DiceStore['unlock']; mode: 'real' | 'preview' | 'demo' }

export const realDiceView = (d: DiceStore): DiceView => ({ count: d.count, unlock: d.unlock, mode: 'real' });
/** Fixed preview steps (drawer): no 1947, no slider — the "all lit, closed" image is only reachable by real play. */
export const PREVIEW_STEPS = [0, 25, 250, 1000, 1948] as const;
export type PreviewStep = (typeof PREVIEW_STEPS)[number];
/** Preview/demo views: 1948 shows the OPEN gate (never "pending"). */
export const previewDiceView = (n: PreviewStep, mode: 'preview' | 'demo' = 'preview'): DiceView => ({ count: n, unlock: n >= DICE_GOAL ? 'seen' : 'none', mode });
