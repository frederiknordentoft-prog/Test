// Terningen: the dice rule, the store shape and its TWO count mutators (addDie, settleGamble). Pure: no DOM, no Pixi.
// A die is status only — it never expires and never changes any win, odds or RTP. Dice are never spent by the game;
// only the player's own choice (Kvit eller dobbelt / 3 for 1, one fair throw) can stake NEW dice, never older ones.
import { fmtInt } from '../core/format.ts';
import { resolveGamble, type GambleBet } from '../math/gamble.ts';

export const DICE_GOAL = 1948;
export const DICE_MIN_X = 10;

/** One die for a spin whose OWN total is ≥ 10× the stake it was evaluated at. Integer øre, exact: 10,00× counts, 9,99× does not. */
export const diceFor = (totalOre: number, stakeOre: number): boolean => stakeOre > 0 && totalOre >= DICE_MIN_X * stakeOre;

export type GambleChoice = 'keep' | GambleBet;
/** The one open choice for the NEW dice of one award (a spin's die, or all of a storm's dice together). `settled` is
 *  written at the choice press (before any reveal); the choice closes (null) once the result has been shown. */
export interface PendingGamble {
  id: string;                 // the awarding spin id (storm: the storm's base id)
  source: 'spin' | 'storm';
  stake: number;              // the new dice at stake (already counted)
  at: number;                 // epoch ms of the offer
  settled?: { choice: GambleBet; face: number; gid: string; payout: number };
}
/** Audit trail (menu "Dine valg"): gid/face are null for keep. */
export interface GambleLogEntry {
  gid: string | null; id: string; source: PendingGamble['source']; choice: GambleChoice;
  stake: number; face: number | null; payout: number; at: number;
}
export const GAMBLE_LOG_MAX = 50;

export interface DiceStore {
  v: 1;
  count: number;              // real dice; never expire, never spent by the game
  seed: number;               // uint32, per-player gate fill order (newSessionSeed() at creation)
  firstAt: number | null;     // epoch ms of die nr. 1
  lastAt: number | null;
  helloSeen: boolean;         // first-visit introduction shown (once, ever)
  introSeen: boolean;         // first-die card shown (once, ever)
  unlock: 'none' | 'pending' | 'seen';
  offered: boolean;           // the 1948 card was shown (it is never shown again)
  unlockedAt: number | null;  // set only by a REAL ceremony (seal-break beat or skip)
  gamble: PendingGamble | null;
  gambleLog: GambleLogEntry[];
}

export function diceDefaults(seed: number): DiceStore {
  return { v: 1, count: 0, seed: seed >>> 0, firstAt: null, lastAt: null, helloSeen: false, introSeen: false, unlock: 'none', offered: false, unlockedAt: null, gamble: null, gambleLog: [] };
}

/** THE award mutator. Returns the accession number (the new count). */
export function addDie(d: DiceStore, now: number): number {
  d.count++; d.lastAt = now; if (d.firstAt === null) d.firstAt = now;
  if (d.count >= DICE_GOAL && d.unlock === 'none') d.unlock = 'pending';
  return d.count;
}

// ---------------------------------------------------------------- Kvit eller dobbelt (one choice per award)
/** May NEW dice be offered? Never the first-ever die (its card comes first), never while the gate is 'pending'
 *  (all tiles lit and not yet opened: new dice are always kept), never with a choice already open. */
export const canOffer = (d: DiceStore, allowed: boolean): boolean => allowed && d.introSeen && d.unlock !== 'pending' && !d.gamble;

/** Opens the choice for `g.stake` dice that are already counted. Refuses a second choice, a stake < 1 or one the
 *  count does not hold (only new dice can be staged, so the count can never go below its pre-award value). */
export function openGamble(d: DiceStore, g: PendingGamble): boolean {
  if (d.gamble || !Number.isInteger(g.stake) || g.stake < 1 || d.count < g.stake) return false;
  d.gamble = { id: g.id, source: g.source, stake: g.stake, at: g.at };
  return true;
}

/** THE only count mutator besides addDie: settles the open choice with a committed face (ignored for keep).
 *  count += payout − stake (a loss returns it to its pre-award value, never below). Never touches 'seen'. */
export function settleGamble(d: DiceStore, choice: GambleChoice, face: number, gid: string, now: number): { payout: number; delta: number; count: number } {
  const g = d.gamble;
  if (!g || g.settled) throw new Error('no open choice');
  const payout = choice === 'keep' ? g.stake : resolveGamble(choice, g.stake, face).payout;
  const delta = payout - g.stake;
  d.count += delta;
  if (payout > g.stake) d.lastAt = now;
  if (d.count >= DICE_GOAL && d.unlock === 'none') d.unlock = 'pending';
  // defensive, unreachable (no choice is offered while 'pending'): 'pending' always means count ≥ 1948
  else if (d.count < DICE_GOAL && d.unlock === 'pending' && !d.offered) d.unlock = 'none';
  d.gambleLog.push({ gid: choice === 'keep' ? null : gid, id: g.id, source: g.source, choice, stake: g.stake, face: choice === 'keep' ? null : face, payout, at: now });
  if (d.gambleLog.length > GAMBLE_LOG_MAX) d.gambleLog.splice(0, d.gambleLog.length - GAMBLE_LOG_MAX);
  if (choice === 'keep') d.gamble = null;
  else g.settled = { choice, face, gid, payout };
  return { payout, delta, count: d.count };
}
/** After the result has been shown: the choice closes (a reload before this shows the same result again). */
export function clearSettled(d: DiceStore): void { d.gamble = null; }

/** Deep copy (demo snapshots must not share the choice or the log with the real store). */
export function cloneDice(d: DiceStore): DiceStore {
  const g = d.gamble;
  return { ...d, gamble: g ? { ...g, ...(g.settled ? { settled: { ...g.settled } } : {}) } : null, gambleLog: d.gambleLog.map((e) => ({ ...e })) };
}
/** Dice counted but not yet in the chamber: the stake of an open choice, or the payout of a settled one. */
export const stagedOf = (d: DiceStore): number => (d.gamble ? (d.gamble.settled?.payout ?? d.gamble.stake) : 0);

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
