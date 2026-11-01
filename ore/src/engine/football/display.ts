/**
 * Display layer: everything the screen shows besides the 1X2 quotes, computed once per tick from
 * the simulation state. Nothing here feeds back into the state, so it cannot break determinism.
 */
import { powerAsks } from '../lib/quote';
import { nextGoal, price1x2, rateGrid, windowGoal, windowShare, type PriceState } from './dp';
import type { FootballSim, MatchEvent } from './sim';

export interface Quote { id: string; label: string; ask: number; bid: number; p: number }
export interface WindowQuote { a: number; b: number; p: number; share: number; ja: Quote; nej: Quote; open: boolean; settled: null | 'ja' | 'nej'; running: boolean }
export interface Branch { label: string; price: number; weight: number; team: 0 | 1 | null }
export interface Display {
  outcomes: Quote[]; // FCK, X, BIF
  dc: Quote[]; // 1X, X2
  next: Quote[]; // next goal FCK / Ingen / BIF
  nextIndex: number;
  windows: WindowQuote[];
  afterGoal: WindowQuote | null;
  varQuote: { ja: Quote; nej: Quote; ghosts: [number, number] } | null;
  branches: Branch[];
  horizon: number;
  headline: string;
  cause: { text: string; key: string } | null;
}

const NAMES = ['FCK', 'X', 'BIF'];

function binary(id: string, label: string, p: number, margin: number, spread: number): [Quote, Quote] {
  const [ja, nej] = powerAsks([p, 1 - p], margin).map((v) => Math.max(1, Math.min(99, Math.round(v * 100))));
  return [
    { id: `${id}:J`, label, ask: ja, bid: Math.max(1, ja - spread), p },
    { id: `${id}:N`, label, ask: nej, bid: Math.max(1, nej - spread), p: 1 - p },
  ];
}

export function minuteLabel(t: number): string {
  if (t > 90) return `90+${Math.ceil(t - 90 - 1e-6)}′`;
  return `${Math.floor(t)}′`;
}

export function windowLabel(a: number, b: number, end: number): string {
  const to = b >= end - 1e-6 ? '90+' : `${b}`;
  return `${a}–${to}′`;
}

/** Goals confirmed so far, with times (VAR-annulled goals excluded). */
export function goalsOf(events: MatchEvent[]): { t: number; team: 0 | 1; n: number }[] {
  return events.filter((e) => e.kind === 'goal').map((e) => ({ t: e.t, team: e.team as 0 | 1, n: e.goalNo ?? 0 }));
}

export function display(sim: FootballSim, focus: 0 | 1 | 2): Display {
  const s: PriceState = sim.priceState();
  const p = sim.p;
  const grid = rateGrid(p, s, true);
  const goals = goalsOf(sim.events);
  const outcomes: Quote[] = [0, 1, 2].map((i) => ({ id: `1x2:${'FXB'[i]}`, label: NAMES[i], ask: sim.ask[i], bid: sim.bid[i], p: sim.mid[i] }));

  const dcDefs: [string, string, number, number][] = [['dc:1X', 'FCK eller X', 0, 1], ['dc:X2', 'X eller BIF', 1, 2]];
  const dc = dcDefs.map(([id, label, i, j]) => {
    const pp = sim.mid[i] + sim.mid[j];
    const ask = Math.min(Math.round(powerAsks([pp, 1 - pp], 0.04)[0] * 100), sim.ask[i] + sim.ask[j] - 1, 99);
    return { id, label, ask, bid: Math.max(1, ask - 3), p: pp };
  });

  const ng = nextGoal(p, s, grid);
  const ngAsk = powerAsks(ng, 0.05).map((v) => Math.max(1, Math.min(99, Math.round(v * 100))));
  const nextIndex = goals.length + 1;
  const next: Quote[] = [0, 1, 2].map((i) => ({ id: `ng${nextIndex}:${'FNB'[i]}`, label: ['Næste mål FCK', 'Ingen flere mål', 'Næste mål BIF'][i], ask: ngAsk[i], bid: Math.max(1, ngAsk[i] - 3), p: ng[i] }));

  // Goal windows: every 5-minute block from the running one to full time. The last block runs to the end.
  const windows: WindowQuote[] = [];
  const startA = Math.floor(Math.min(sim.t, 89.99) / 5) * 5;
  for (let a = Math.min(startA, 85); a < 90; a += 5) {
    const b = a + 5 >= 90 ? sim.end : a + 5;
    const running = sim.t >= a && sim.t < b;
    const scored = goals.find((g) => g.t >= a && g.t < b);
    const pr = scored ? 1 : sim.t >= b ? 0 : windowGoal(p, s, Math.max(a, sim.t), b, grid);
    const share = windowShare(p, s, Math.max(a, sim.t), b, grid);
    const [ja, nej] = binary(`w:${a}-${Math.round(b)}`, `Mål ${windowLabel(a, b, sim.end)}`, Math.min(0.995, Math.max(0.005, pr)), 0.09, 3);
    const open = !scored && sim.t < b - 1 && !sim.halted;
    windows.push({ a, b, p: pr, share, ja, nej, open, settled: scored ? 'ja' : sim.t >= b ? 'nej' : null, running });
  }

  // After-goal window: the five minutes after the latest goal.
  let afterGoal: WindowQuote | null = null;
  const last = goals[goals.length - 1];
  if (last && sim.t < last.t + 5 && sim.phase !== 'FT' && sim.phase !== 'closed') {
    const a = last.t;
    const b = Math.min(sim.end, last.t + 5);
    const later = goals.find((g) => g.t > a && g.t < b);
    const pr = later ? 1 : windowGoal(p, s, Math.max(a, sim.t), b, grid);
    const [ja, nej] = binary(`ag${last.n}`, `Efter målet: nyt mål inden ${minuteLabel(b)}`, Math.min(0.995, Math.max(0.005, pr)), 0.1, 3);
    afterGoal = { a, b, p: pr, share: windowShare(p, s, Math.max(a, sim.t), b, grid), ja, nej, open: !later && sim.t < b - 1 && !sim.halted, settled: later ? 'ja' : null, running: true };
  }

  // VAR: "Målet står?" and the two ghost prices of the focused outcome.
  let varQuote: Display['varQuote'] = null;
  const vs = sim.snapshot().var;
  if (vs) {
    const [ja, nej] = binary(`var${sim.events.filter((e) => e.kind === 'var-start').length}`, 'Målet står?', vs.p, 0.08, 4);
    const dOk = s.d + (vs.goalTeam === 0 ? 1 : -1);
    const ok = price1x2(p, { ...s, d: dOk, excite: [s.excite[0] + p.kappa, s.excite[1] + p.kappa], pi: s.pi * 0.3 });
    const no = price1x2(p, s);
    const askOf = (pp: number[]) => Math.round(powerAsks(pp, 0.03)[focus] * 100);
    varQuote = { ja, nej, ghosts: [askOf(ok), askOf(no)] };
  }

  // Branches for the focused outcome: the price right after each first event within the horizon.
  const horizon = Math.max(1, Math.min(10, (sim.end - sim.t) / 2));
  let lf = 0;
  let lb = 0;
  const steps = Math.min(grid.n, Math.round(horizon / 0.25));
  const dd = Math.max(-8, Math.min(8, s.d)) + 8;
  let surv = 1;
  for (let k = 0; k < steps; k++) {
    const hh = grid.h[k * 17 + dd];
    const aa = grid.a[k * 17 + dd];
    lf += surv * hh;
    lb += surv * aa;
    surv *= 1 - hh - aa;
  }
  const after = (d: number, exc: boolean, dt: number) =>
    price1x2(p, { ...s, t: Math.min(sim.end, s.t + dt), d, pi: exc ? s.pi * 0.3 : s.pi * Math.exp(-p.theta * dt), excite: exc ? [s.excite[0] + p.kappa, s.excite[1] + p.kappa] : [s.excite[0] * Math.exp(-dt / p.tauE), s.excite[1] * Math.exp(-dt / p.tauE)] });
  const bAsk = (pp: number[]) => powerAsks(pp, 0.03)[focus] * 100;
  const branches: Branch[] = [
    { label: 'Mål FCK', price: bAsk(after(s.d + 1, true, 0)), weight: lf, team: 0 },
    { label: `Intet mål ${Math.round(horizon)}′`, price: bAsk(after(s.d, false, horizon)), weight: surv, team: null },
    { label: 'Mål BIF', price: bAsk(after(s.d - 1, true, 0)), weight: lb, team: 1 },
  ];

  // Målvejret headline: the first window end by which a goal is more likely than not.
  let headline = '';
  for (const w of windows) {
    if (w.b <= sim.t) continue;
    const cum = windowGoal(p, s, sim.t, w.b, grid);
    if (cum >= 0.5) {
      headline = `Et mål er sandsynligt inden ${w.b >= sim.end - 1e-6 ? 'slutfløjt' : `${w.b}′`} (${Math.round(cum * 100)} %)`;
      break;
    }
  }
  if (!headline && sim.phase !== 'FT' && sim.phase !== 'closed') {
    const cum = windowGoal(p, s, sim.t, sim.end, grid);
    headline = `Et mål resten af kampen: ${Math.round(cum * 100)} %`;
  }
  if (sim.phase === 'FT' || sim.phase === 'closed') headline = `Slutfløjt · ${sim.h}–${sim.a}`;

  return { outcomes, dc, next, nextIndex, windows, afterGoal, varQuote, branches, horizon, headline, cause: cause(sim, focus) };
}

/** Explains the focused price move over the last 2 game minutes in plain Danish. */
export function cause(sim: FootballSim, focus: 0 | 1 | 2): { text: string; key: string } | null {
  const [ev, tm, pr, fl] = sim.attribution(focus);
  const arrow = (v: number) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v))} øre`;
  const recent = sim.events.filter((e) => sim.t - e.t <= 2 && (sim.k - e.k) <= 80 * 3);
  const score = `${sim.h}–${sim.a}`;
  if (Math.abs(ev) >= 1) {
    const e = [...recent].reverse().find((x) => x.kind === 'goal' || x.kind === 'red' || x.kind === 'var-verdict');
    if (e) {
      const who = e.team === 0 ? 'FCK' : 'BIF';
      const what = e.kind === 'goal' ? `mål ${who} ${minuteLabel(e.t)}${e.varOk ? ' (VAR godkendt)' : ''}` : e.kind === 'red' ? `rødt kort ${who}` : e.varOk ? 'VAR: målet står' : 'VAR: målet annulleret';
      return { text: `${arrow(ev)}: ${what}`, key: `ev-${e.id}` };
    }
  }
  const comps: [number, string][] = [[tm, 'tid'], [pr, 'pres'], [fl, 'flow']];
  comps.sort((x, y) => Math.abs(y[0]) - Math.abs(x[0]));
  const [v, kind] = comps[0];
  if (Math.abs(v) < 1) return { text: 'Rolig handel · under 1 øre på 2 kampmin', key: 'calm' };
  if (kind === 'tid') return { text: `${arrow(v)}: tiden løber (${score})`, key: 'time' };
  if (kind === 'pres') {
    const presser: 0 | 1 = sim.pi >= 0 ? 0 : 1;
    const corners = sim.events.filter((e) => e.kind === 'corner' && e.team === presser && sim.t - e.t <= 4).length;
    const who = presser === 0 ? 'FCK' : 'BIF';
    if (corners >= 2) return { text: `${arrow(v)}: ${corners} hjørnespark til ${who} på 4 kampmin`, key: `corners-${presser}` };
    return { text: `${arrow(v)}: ${who} presser`, key: `press-${presser}` };
  }
  const whale = [...sim.trades].reverse().find((t) => t.whale && sim.t - t.t <= 2);
  if (whale) return { text: `${arrow(v)}: storordre ${NAMES[whale.o]}`, key: `whale-${whale.k}` };
  return { text: `${arrow(v)}: ${v >= 0 ? 'købspres' : 'salgspres'} på ${NAMES[focus]}`, key: `flow-${v >= 0 ? 1 : -1}` };
}
