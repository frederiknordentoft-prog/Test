/**
 * Focus: what the fan, the instrument head, the share bar and the tray follow. One of the three
 * 1X2 outcomes, or Over 2.5 goals. Every reader goes through `focusSpec`, so nothing indexes the
 * three-slot 1X2 arrays with a focus that may not be an outcome.
 */
import type { FootballSim, MatchEvent } from '../engine/football/sim';
import type { Focus } from '../engine/football/display';

export type { Focus };
export type Outcome = 0 | 1 | 2;

export const OUTCOME_ID = ['1x2:F', '1x2:X', '1x2:B'] as const;
export const OUTCOME_LABEL = ['FCK vinder', 'Uafgjort', 'BIF vinder'] as const;
export const OUTCOME_SHORT = ['FCK', 'X', 'BIF'] as const;
export const O25_ID = 'tot:2.5:O';
export const U25_ID = 'tot:2.5:U';

/** Data colours (r,g,b): FCK ice cyan, draw grey, BIF yellow; Over pink, Under grey. */
export const RGB_OUTCOME = ['92,225,255', '150,158,172', '255,210,0'] as const;
export const RGB_O25 = ['255,95,162', '150,158,172'] as const;
export const HEX_FOCUS: Record<string, string> = { '0': '#5ce1ff', '1': '#c8ced8', '2': '#ffd200', o25: '#ff5fa2' };

export interface FocusSpec {
  focus: Focus;
  isO25: boolean;
  contract: string;
  label: string; // "FCK vinder" / "Over 2,5 mål"
  short: string; // "FCK" / "Over 2,5"
  /** "udbetaler 100 …" clause. */
  payoff: string;
  askRaw: number;
  ask: number;
  bid: number;
  p: number;
  /** Raw ask history at sample i (stride-free). */
  hist: (i: number) => number;
  /** Reopen gap of the focused contract on a reopen event. */
  gapOf: (e: MatchEvent) => number | undefined;
  /** Strata of the Monte Carlo tally: labels and colours; `stratum` is the one that pays. */
  strata: { label: string; rgb: string }[];
  stratum: number;
  rgb: string;
  hex: string;
  canLimit: boolean;
  canGhost: boolean;
  /** Settled already (Over 2.5 after the third goal). */
  done: boolean;
}

export function isOutcome(f: Focus): f is Outcome {
  return f !== 'o25';
}

export function focusSpec(sim: FootballSim, f: Focus): FocusSpec {
  if (f === 'o25') {
    const done = sim.h + sim.a > 2.5;
    return {
      focus: f,
      isO25: true,
      contract: O25_ID,
      label: 'Over 2,5 mål',
      short: 'Over 2,5',
      payoff: 'udbetaler 100 ved 3+ mål',
      askRaw: sim.o25AskRaw[0],
      ask: sim.o25Ask[0],
      bid: sim.o25Bid[0],
      p: sim.o25Mid,
      hist: (i) => sim.hist.o25Ask[i],
      gapOf: (e) => e.gapO25,
      strata: [{ label: 'Over', rgb: RGB_O25[0] }, { label: 'Under', rgb: RGB_O25[1] }],
      stratum: 0,
      rgb: RGB_O25[0],
      hex: HEX_FOCUS.o25,
      canLimit: false,
      canGhost: false,
      done,
    };
  }
  return {
    focus: f,
    isO25: false,
    contract: OUTCOME_ID[f],
    label: OUTCOME_LABEL[f],
    short: OUTCOME_SHORT[f],
    payoff: `udbetaler 100 hvis ${f === 1 ? 'uafgjort' : `${OUTCOME_SHORT[f]} vinder`}`,
    askRaw: sim.askRaw[f],
    ask: sim.ask[f],
    bid: sim.bid[f],
    p: sim.mid[f],
    hist: (i) => sim.hist.ask[i * 3 + f],
    gapOf: (e) => e.gap?.[f],
    strata: OUTCOME_SHORT.map((label, i) => ({ label, rgb: RGB_OUTCOME[i] })),
    stratum: f,
    rgb: RGB_OUTCOME[f],
    hex: HEX_FOCUS[String(f)],
    canLimit: true,
    canGhost: true,
    done: false,
  };
}

/** Cycles FCK → X → BIF → Over 2,5 → FCK; skips Over 2,5 once it is settled. */
export function nextFocus(f: Focus, o25Open: boolean): Focus {
  if (f === 0) return 1;
  if (f === 1) return 2;
  if (f === 2) return o25Open ? 'o25' : 0;
  return 0;
}

// --- final score (cs:) contracts ------------------------------------------------------------------

/** Cell key "h-a" (5 means 5+). A contract is `cs:` + sorted cell keys joined by ".". */
export function csId(cells: readonly [number, number][]): string {
  const keys = [...new Set(cells.map(([h, a]) => `${h}-${a}`))].sort((x, y) => {
    const [xh, xa] = x.split('-').map(Number);
    const [yh, ya] = y.split('-').map(Number);
    return xh - yh || xa - ya;
  });
  return `cs:${keys.join('.')}`;
}

export function csCells(contract: string): [number, number][] | null {
  if (!contract.startsWith('cs:')) return null;
  const out: [number, number][] = [];
  for (const k of contract.slice(3).split('.')) {
    const m = /^(\d)-(\d)$/.exec(k);
    if (!m) return null;
    const h = Number(m[1]);
    const a = Number(m[2]);
    if (h > 5 || a > 5) return null;
    out.push([h, a]);
  }
  return out.length ? out : null;
}

/** A final-score cell is still reachable from the current score (5 = 5+ is reachable from 5 up). */
export function cellPossible(h: number, a: number, nowH: number, nowA: number): boolean {
  return (h === 5 ? true : nowH <= h) && (a === 5 ? true : nowA <= a);
}

export function cellOf(h: number, a: number): [number, number] {
  return [Math.min(5, h), Math.min(5, a)];
}

export function cellLabel(h: number, a: number): string {
  return `${h === 5 ? '5+' : h}–${a === 5 ? '5+' : a}`;
}
