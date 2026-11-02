/**
 * Match store: owns the simulation, the book and the Monte Carlo client, runs the real-time loop
 * (one tick per 100 ms; `speed` substeps per tick) and publishes two kinds of updates:
 *  - `view`: coarse numbers for React, at most 4 Hz, immediately on discrete changes;
 *  - `frame`: every tick, for canvas layers that draw imperatively.
 */
import { FootballSim, type MatchEvent } from '../engine/football/sim';
import { CS_N, display, fmtLine, goalsOf, minuteLabel, type Display, type Quote } from '../engine/football/display';
import { price1x2, windowGoal } from '../engine/football/dp';
import { Book, MAX_STAKE, POOL_TAKE, type BookEvent, type ExitKind, type ExitOrder, type LimitOrder, type PoolResult, type Position } from '../engine/book/portfolio';
import { SUB } from '../engine/football/params';
import type { McMode } from '../engine/mc/client';
import type { McRequest } from '../engine/mc/paths';
import { largestRemainder, powerAsks } from '../engine/lib/quote';
import type { Leg, McResult } from '../engine/mc/paths';
import { FREE_PLAY, minuteOf, type Timeline } from '../engine/director/timeline';
import { hashSeed } from '../engine/lib/rng';

import { cellLabel, cellOf, cellPossible, csCells, focusSpec, isOutcome, O25_ID, OUTCOME_ID, OUTCOME_LABEL, OUTCOME_SHORT, type Focus, type FocusSpec, type Outcome } from './focus';

export { csCells, csId, cellLabel, cellPossible, focusSpec, nextFocus, O25_ID, U25_ID, OUTCOME_ID, OUTCOME_LABEL, OUTCOME_SHORT, RGB_O25, RGB_OUTCOME, HEX_FOCUS } from './focus';
export type { Focus, FocusSpec, Outcome } from './focus';

/** Score-map cells under this probability are closed ("for usandsynligt"). */
export const CS_MIN_P = 0.03;
/** Contracts that can carry a stop-loss or take-profit: a quote every substep and a line in the fan. */
export const EXIT_CONTRACTS = ['1x2:F', '1x2:X', '1x2:B', O25_ID] as const;

// The Parken pool: a simulated crowd on 1X2 until halftime. Money grows with the crowd's order flow.
export const POOL_P0 = 180000;
const POOL_PER_KR = 4;
const POOL_WHALE_CAP = 2000;
const POOL_N0 = 3100;
const POOL_N_PER_TRADE = 9;
/** The crowd leans home: FCK money is overweight against the model price. */
const POOL_BIAS = [1.035, 0.985, 0.985];
const POOL_TAU = 1; // game minutes

export interface PoolView {
  open: boolean;
  closed: boolean; // locked at halftime
  total: number; // crowd + yours
  n: number; // number of stakes in the pool
  sides: number[]; // crowd + yours, per side
  user: number[];
  /** Pool odds right now for one more krone on each side, after the house take. */
  odds: number[];
  take: number;
  result: PoolResult | null;
  winner: Outcome | null;
}

export interface Pending {
  contract: string;
  label: string;
  kr: number;
  lockedAsk: number;
  startMs: number;
  state: 'lock' | 'requote';
  newAsk?: number;
}
export interface Toast { id: number; text: string; tone: 'info' | 'good' | 'bad' }
export interface PositionView { id: string; label: string; shares: number; avg: number; value: number; atWin: number; bid: number; pnl: number; stake: number; settled: Position['settled'] }
export interface BuildQuote { id: string; legs: Leg[]; label: string; joint: number; legP: number[]; naive: number; ask: number; bid: number; tooUnlikely: boolean }

export interface MatchView {
  k: number;
  t: number;
  minute: string;
  phase: FootballSim['phase'];
  h: number;
  a: number;
  red: [number, number];
  halted: boolean;
  haltKind: 'goal' | 'red' | 'var' | null;
  focus: Focus;
  spec: FocusSpec;
  d: Display;
  /** Monte Carlo tally per stratum of the focus (null until a result of the right kind arrives). */
  counts: number[] | null;
  saldo: number;
  available: number;
  value: number;
  positions: PositionView[];
  limits: LimitOrder[];
  exits: ExitOrder[];
  pool: PoolView;
  pending: Pending | null;
  toasts: Toast[];
  speed: number;
  mcMode: McMode;
  mcMs: number;
  lastEventId: number;
  ghostStatus: string | null;
  staked: number;
  paidOut: number;
  demo: boolean;
}

export interface Ghost { contract: string; t: Float32Array; v: Float32Array }

/** What the store needs from a Monte Carlo runner (worker client in the app, direct in tests). */
export interface McLike { mode: McMode; lastMs: number; run(req: McRequest): Promise<McResult | null>; dispose(): void }

type Listener = () => void;

export class MatchStore {
  sim: FootballSim;
  book = new Book();
  mc: McLike;
  /** Clock (ms). Tests replace it with a virtual clock. */
  clock: () => number = () => performance.now();
  tl: Timeline;
  focus: Focus = 0;
  speed = 1;
  /** Real-time speed segments for the demo: [fromMinute, toMinute, speed]. */
  segments: [number, number, number][] = [];
  view: MatchView;
  mcResult: McResult | null = null;
  mcEvent = 0; // bumps when a result after an event arrives (fan burn / bloom)
  ghost: Ghost | null = null;
  build: { legs: Leg[]; quote: BuildQuote | null; result: McResult | null } = { legs: [], quote: null, result: null };
  buildQuotes = new Map<string, BuildQuote>();
  contracts = new Map<string, { label: string }>();
  demo = false;
  paused = false;
  private disp: Display;
  private viewL = new Set<Listener>();
  private frameL = new Set<Listener>();
  private eventL = new Set<(e: MatchEvent) => void>();
  private lastViewMs = 0;
  private dirty = false;
  private ticks = 0;
  private toastId = 1;
  private seenEvents = 0;
  private lastMcTick = -999;
  private mcPending = false;
  private raf = 0;
  private acc = 0;
  private lastMs = 0;
  private holdUntil = 0; // spol is suspended while the user is busy
  private pending: Pending | null = null;
  private toasts: Toast[] = [];
  private settledWindows = new Set<string>();
  private eventDirty = true;
  /** Pool state, advanced every substep from the crowd's trades (deterministic). */
  private poolP = POOL_P0;
  private poolN = POOL_N0;
  private poolW: number[] = [1 / 3, 1 / 3, 1 / 3];
  private poolCrowdAtClose: number[] | null = null;

  constructor(tl: Timeline = FREE_PLAY, mc: McLike) {
    this.tl = tl;
    this.sim = new FootballSim(tl);
    this.mc = mc;
    this.poolW = this.poolTarget();
    this.disp = display(this.sim, this.focus);
    this.view = this.buildView();
  }

  // --- subscriptions ---
  subscribeView = (l: Listener) => {
    this.viewL.add(l);
    return () => this.viewL.delete(l);
  };
  getView = () => this.view;
  onFrame(l: Listener): () => void {
    this.frameL.add(l);
    return () => this.frameL.delete(l);
  }
  onEvent(l: (e: MatchEvent) => void): () => void {
    this.eventL.add(l);
    return () => this.eventL.delete(l);
  }

  // --- real-time loop ---
  start(): void {
    if (this.raf) return;
    this.lastMs = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(400, now - this.lastMs);
      this.lastMs = now;
      if (!this.paused) {
        this.acc += dt;
        let n = 0;
        while (this.acc >= 100 && n < 3) {
          this.tick(now);
          this.acc -= 100;
          n++;
        }
        if (n === 3) this.acc = 0;
      }
      this.flushView(now);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  dispose(): void {
    this.stop();
    this.mc.dispose();
  }

  /** Effective speed: demo segments, suspended while the user is mid-action or a big moment plays. */
  effectiveSpeed(now: number): number {
    if (now < this.holdUntil || this.pending || this.sim.halt || this.sim.phase === 'pre') return 1;
    const seg = this.segments.find(([a, b]) => this.sim.t >= a && this.sim.t < b);
    return seg ? seg[2] : this.speed;
  }

  /** Suspends fast-forward for `ms` (gestures, trays, big moments). */
  holdSpeed(ms: number): void {
    this.holdUntil = Math.max(this.holdUntil, this.clock() + ms);
  }

  tick(now = this.clock()): void {
    const sp = this.effectiveSpeed(now);
    for (let i = 0; i < sp; i++) {
      this.sim.step();
      this.afterStep();
    }
    this.ticks++;
    // The full display (windows, branches, headline) every third tick or right after an event;
    // the 1X2 quotes, which buying uses, every tick straight from the simulation.
    if (this.ticks % 3 === 0 || this.eventDirty) {
      this.disp = display(this.sim, this.focus);
      this.eventDirty = false;
    } else {
      const sim = this.sim;
      this.disp = {
        ...this.disp,
        outcomes: this.disp.outcomes.map((q, i) => ({ ...q, ask: sim.ask[i], bid: sim.bid[i], p: sim.mid[i] })),
        // Over/Under 2.5 is the simulation's own quote: buying reads it fresh, like 1X2.
        totals: this.disp.totals.map((q) => (q.id === O25_ID ? { ...q, ask: sim.o25Ask[0], bid: sim.o25Bid[0], p: sim.o25Mid } : q.id === 'tot:2.5:U' ? { ...q, ask: sim.o25Ask[1], bid: sim.o25Bid[1], p: 1 - sim.o25Mid } : q)),
      };
    }
    this.processPending(now);
    this.maybeMc(sp);
    this.dirty = true;
    this.frameL.forEach((l) => l());
  }

  /** Live quote of a contract that can carry exits (1X2 and Over/Under 2.5), straight from the sim. */
  private liveQuote(c: string): { ask: number; bid: number; mid: number } | null {
    const sim = this.sim;
    const i = OUTCOME_ID.indexOf(c as (typeof OUTCOME_ID)[number]);
    if (i >= 0) return { ask: sim.ask[i], bid: sim.bid[i], mid: sim.mid[i] };
    if (c === O25_ID) return { ask: sim.o25Ask[0], bid: sim.o25Bid[0], mid: sim.o25Mid };
    if (c === 'tot:2.5:U') return { ask: sim.o25Ask[1], bid: sim.o25Bid[1], mid: 1 - sim.o25Mid };
    return null;
  }

  private afterStep(): void {
    const sim = this.sim;
    // Exits first: a stop that fires frees the position before any buy limit looks at the price.
    const fired = this.book.checkExits((c) => this.liveQuote(c), sim.halted, sim.k, sim.t, sim.reopenK);
    for (const x of fired) {
      const f = x.fill!;
      this.toast(x.kind === 'stop' ? `Stop-loss udløst: solgt ${f.shares} @ kurs ${f.price}` : `Gevinst sikret: solgt ${f.shares} @ kurs ${f.price} · ${fmtKr(f.kr)}`, x.kind === 'stop' ? 'bad' : 'good');
    }
    this.advancePool();
    // Buy limits on 1X2 (the fan's price traps).
    const fills = this.book.checkLimits(
      (c) => {
        const i = OUTCOME_ID.indexOf(c as (typeof OUTCOME_ID)[number]);
        return i >= 0 ? { ask: sim.ask[i], mid: sim.mid[i] } : null;
      },
      sim.halted,
      sim.k,
      sim.t,
    );
    for (const f of fills) {
      const oi = OUTCOME_ID.indexOf(f.contract as (typeof OUTCOME_ID)[number]);
      const lots = this.book.positions.get(f.contract)?.lots;
      if (oi >= 0 && lots?.length) lots[lots.length - 1].baseline = this.baseline(oi as Outcome);
    }
    for (const f of fills) this.toast(`Købsgrænse fyldt: ${f.fill?.shares} andele @ kurs ${f.fill?.price}${f.fill && f.fill.gapBetter > 0 ? ` · ${f.fill.gapBetter} point bedre` : ''}`, 'good');
    // New events: settlement and listeners.
    while (this.seenEvents < sim.events.length) {
      const e = sim.events[this.seenEvents++];
      this.settleOn(e);
      if (e.kind === 'goal' || e.kind === 'var-start' || e.kind === 'var-verdict' || e.kind === 'red' || e.kind === 'whale' || e.kind === 'reopen' || e.kind === 'fulltime' || e.kind === 'kickoff' || e.kind === 'half') {
        this.eventL.forEach((l) => l(e));
        this.dirty = true;
        this.eventDirty = true;
        this.lastViewMs = 0; // publish immediately
        if (e.kind === 'goal' || e.kind === 'reopen' || e.kind === 'var-verdict' || e.kind === 'kickoff') this.lastMcTick = -999;
      }
    }
    // Windows that ended without a goal settle as "Tørvejr".
    for (const w of this.disp.windows) {
      if (sim.t >= w.b && !this.settledWindows.has(w.ja.id)) {
        const scored = goalsOf(sim.events).some((g) => g.t >= w.a && g.t < w.b);
        if (!scored) {
          this.settledWindows.add(w.ja.id);
          this.settle(w.ja.id, 0);
          this.settle(w.nej.id, 100);
        }
      }
    }
    // Dragged (multi-bar) windows that ended without a goal.
    for (const p of this.book.positions.values()) {
      const m = /^w:(\d+)-(\d+):([JN])$/.exec(p.id);
      if (!m || p.settled || sim.t < Number(m[2])) continue;
      if (!goalsOf(sim.events).some((g) => g.t >= Number(m[1]) && g.t < Number(m[2]))) this.settle(p.id, m[3] === 'N' ? 100 : 0);
    }
    const ag = this.disp.afterGoal;
    if (ag && sim.t >= ag.b && !this.settledWindows.has(ag.ja.id)) {
      this.settledWindows.add(ag.ja.id);
      if (!goalsOf(sim.events).some((g) => g.t > ag.a && g.t < ag.b)) {
        this.settle(ag.ja.id, 0);
        this.settle(ag.nej.id, 100);
      }
    }
  }

  private settle(contract: string, value: 0 | 100): void {
    const p = this.book.settle(contract, value, this.sim.k, this.sim.t);
    if (p && p.shares > 0) this.toast(value === 100 ? `${p.label}: +${fmtKr(p.settled?.payout ?? 0)}` : `${p.label}: afregnet til 0`, value === 100 ? 'good' : 'bad');
  }

  /** Confirmed goals up to and including event `e` (VAR-annulled goals never emit a goal event). */
  private confirmedThrough(e: MatchEvent): number {
    let n = 0;
    for (const x of this.sim.events) {
      if (x.id > e.id) break;
      if (x.kind === 'goal') n++;
    }
    return n;
  }

  private settleOn(e: MatchEvent): void {
    const sim = this.sim;
    if (e.kind === 'goal') {
      const n = e.goalNo ?? 0; // includes annulled goals: the key of "after the goal" windows
      const team = e.team as 0 | 1;
      // Next goal is keyed by confirmed goals, exactly as the display names it.
      const total = this.confirmedThrough(e);
      this.settle(`ng${total}:F`, team === 0 ? 100 : 0);
      this.settle(`ng${total}:B`, team === 1 ? 100 : 0);
      this.settle(`ng${total}:N`, 0);
      // Over a line settles at the confirmed goal that crosses it; Under goes to 0 at the same moment.
      for (const id of [...this.book.positions.keys()]) {
        const tm = /^tot:([\d.]+):([OU])$/.exec(id);
        if (tm && total > Number(tm[1])) this.settle(id, tm[2] === 'O' ? 100 : 0);
        const cells = csCells(id);
        if (cells && !cells.some(([h, a]) => cellPossible(h, a, sim.h, sim.a))) this.settle(id, 0);
      }
      if (this.focus === 'o25' && total > 2.5) {
        this.focus = 0;
        this.lastMcTick = -999;
      }
      for (const id of this.book.positions.keys()) {
        const m = /^w:(\d+)-(\d+):([JN])$/.exec(id);
        if (m && e.t >= Number(m[1]) && e.t < Number(m[2])) {
          this.settledWindows.add(`w:${m[1]}-${m[2]}:J`);
          this.settle(id, m[3] === 'J' ? 100 : 0);
        }
        const ag = /^ag(\d+):([JN])$/.exec(id);
        if (ag && Number(ag[1]) < n) {
          const prev = goalsOf(sim.events).find((g) => g.n === Number(ag[1]));
          if (prev && e.t < prev.t + 5) this.settle(id, ag[2] === 'J' ? 100 : 0);
        }
      }
    } else if (e.kind === 'var-verdict') {
      const n = sim.events.filter((x) => x.kind === 'var-start').length;
      this.settle(`var${n}:J`, e.varOk ? 100 : 0);
      this.settle(`var${n}:N`, e.varOk ? 0 : 100);
    } else if (e.kind === 'fulltime') {
      const res = sim.h > sim.a ? 0 : sim.h === sim.a ? 1 : 2;
      OUTCOME_ID.forEach((id, i) => this.settle(id, i === res ? 100 : 0));
      this.settle('dc:1X', res !== 2 ? 100 : 0);
      this.settle('dc:X2', res !== 0 ? 100 : 0);
      const n = goalsOf(sim.events).length + 1;
      this.settle(`ng${n}:N`, 100);
      this.settle(`ng${n}:F`, 0);
      this.settle(`ng${n}:B`, 0);
      const [ch, ca] = cellOf(sim.h, sim.a);
      for (const id of [...this.book.positions.keys()]) {
        if (id.startsWith('byg:')) this.settle(id, this.buildHits(id) ? 100 : 0);
        else if (/^(w:|ag)/.test(id)) this.settle(id, id.endsWith(':N') ? 100 : 0);
        const tm = /^tot:([\d.]+):([OU])$/.exec(id);
        if (tm) this.settle(id, (sim.h + sim.a > Number(tm[1])) === (tm[2] === 'O') ? 100 : 0);
        const cells = csCells(id);
        if (cells) this.settle(id, cells.some(([h, a]) => h === ch && a === ca) ? 100 : 0);
      }
      if (this.poolCrowdAtClose) {
        const r = this.book.settlePool(res as Outcome, this.poolCrowdAtClose, sim.k, sim.t, 'Parken-puljen');
        if (r) this.toast(r.refund ? `Puljen refunderet: ${fmtKr(r.payout)}` : r.payout > 0 ? `Puljen udbetalt: +${fmtKr(r.payout)}` : 'Puljen: din side tabte', r.payout > 0 ? 'good' : 'bad');
      }
    } else if (e.kind === 'half') {
      this.closePool();
    }
  }

  // --- the Parken pool ---

  /** Crowd weights: the model's fair 1X2 with a home lean (not the market mid, so whales cannot be faded). */
  private poolTarget(): number[] {
    const f = this.sim.fair.map((x, i) => x * POOL_BIAS[i]);
    const s = f[0] + f[1] + f[2];
    return f.map((x) => x / s);
  }

  get poolOpen(): boolean {
    const sim = this.sim;
    return !this.poolCrowdAtClose && (sim.phase === 'pre' || sim.phase === '1H') && !sim.halted;
  }

  private advancePool(): void {
    const sim = this.sim;
    if (this.poolCrowdAtClose) return;
    // Trades of this substep, read from the end (the list is trimmed, so never by index).
    for (let i = sim.trades.length - 1; i >= 0 && sim.trades[i].k === sim.k; i--) {
      const tr = sim.trades[i];
      if (tr.side < 0) continue;
      this.poolP += Math.min(tr.kr, tr.whale ? POOL_WHALE_CAP : tr.kr) * POOL_PER_KR;
      this.poolN += POOL_N_PER_TRADE;
    }
    // The crowd re-bets while trading is halted, so a goal is priced in before the pool reopens.
    const target = this.poolTarget();
    const al = sim.halted ? 1 : 1 - Math.exp(-SUB / POOL_TAU);
    this.poolW = this.poolW.map((w, i) => w + al * (target[i] - w));
  }

  private crowdSides(): number[] {
    return this.poolW.map((w) => this.poolP * w);
  }

  private closePool(): void {
    if (this.poolCrowdAtClose) return;
    this.poolW = this.poolTarget();
    this.poolCrowdAtClose = this.crowdSides();
  }

  stakePool(side: Outcome, kr: number): void {
    if (!this.poolOpen) {
      this.toast(this.poolCrowdAtClose ? 'Puljen er lukket ved pausen' : 'Puljen åbner efter stoppet', 'bad');
      return;
    }
    const r = this.book.stakePool({ side, kr, k: this.sim.k, t: this.sim.t, label: `Parken-puljen: ${OUTCOME_LABEL[side]}` });
    this.toast(r.ok ? `I puljen: ${fmtKr(Math.round(kr))} på ${OUTCOME_SHORT[side]}` : r.reason, r.ok ? 'good' : 'bad');
    this.publish();
  }

  poolView(): PoolView {
    const crowd = this.poolCrowdAtClose ?? this.crowdSides();
    const user = this.book.poolUser();
    const sides = crowd.map((c, i) => c + user[i]);
    const total = sides[0] + sides[1] + sides[2];
    const sim = this.sim;
    const res = sim.phase === 'FT' || sim.phase === 'closed' ? ((sim.h > sim.a ? 0 : sim.h === sim.a ? 1 : 2) as Outcome) : null;
    return {
      open: this.poolOpen,
      closed: !!this.poolCrowdAtClose,
      total,
      n: this.poolN + this.book.poolStakes.length,
      sides,
      user,
      odds: sides.map((sd) => (total * (1 - POOL_TAKE)) / Math.max(1, sd)),
      take: POOL_TAKE,
      result: this.book.poolResult,
      winner: res,
    };
  }

  private buildHits(id: string): boolean {
    const q = this.buildQuotes.get(id);
    if (!q) return false;
    const sim = this.sim;
    const goals = goalsOf(sim.events);
    return q.legs.every((leg) => {
      if (leg.kind === 'udfald') return (sim.h > sim.a ? 0 : sim.h === sim.a ? 1 : 2) === leg.o;
      if (leg.kind === 'maal') return sim.h + sim.a >= leg.n;
      if (leg.kind === 'btts') return sim.h > 0 && sim.a > 0;
      return goals.some((g) => g.t >= leg.a && g.t < leg.b);
    });
  }

  // --- Monte Carlo ---
  private maybeMc(sp: number): void {
    const sim = this.sim;
    if (this.mcPending || sim.phase === 'closed') return;
    const due = this.ticks - this.lastMcTick >= (sp > 1 ? 12 : 8);
    if (!due) return;
    this.lastMcTick = this.ticks;
    this.mcPending = true;
    const req = this.mcRequest(this.focus, undefined);
    void this.mc.run(req).then((r) => {
      this.mcPending = false;
      if (!r) return;
      this.mcResult = r;
      this.mcEvent++;
      this.dirty = true;
      this.frameL.forEach((l) => l());
    });
  }

  mcRequest(focus: Focus, legs: Leg[] | undefined): McRequest {
    const sim = this.sim;
    return {
      id: this.ticks,
      seed: hashSeed(`${this.tl.seed}|mc`),
      params: sim.p,
      state: {
        t: sim.t,
        end: sim.end,
        h: sim.h,
        a: sim.a,
        pi: sim.pi,
        excite: [...sim.excite] as [number, number],
        red: [...sim.red] as [number, number],
        zone: sim.zone,
        goals: goalsOf(sim.events).map((g) => ({ t: g.t, team: g.team })),
      },
      n: 5000,
      kind: focus === 'o25' && !legs ? 'o25' : 'outcome',
      probs: focus === 'o25' && !legs ? [sim.o25Mid, 1 - sim.o25Mid] : [sim.mid[0], sim.mid[1], sim.mid[2]],
      focus: isOutcome(focus) ? focus : 0,
      askNow: focus === 'o25' && !legs ? sim.o25AskRaw[0] : sim.askRaw[isOutcome(focus) ? focus : 0],
      legs,
    };
  }

  /** Focus spec for the current (or a given) focus. */
  spec(f: Focus = this.focus): FocusSpec {
    return focusSpec(this.sim, f);
  }

  /** The Monte Carlo result if it matches the focus kind (strands are in the focused contract's price). */
  mcFor(f: Focus = this.focus): McResult | null {
    const r = this.mcResult;
    if (!r) return null;
    return (r.kind === 'o25') === (f === 'o25') ? r : null;
  }

  // --- quotes for any contract ---
  quote(contract: string): Quote | null {
    const d = this.disp;
    const all = [...d.outcomes, ...d.dc, ...d.next, ...d.windows.flatMap((w) => [w.ja, w.nej]), ...(d.afterGoal ? [d.afterGoal.ja, d.afterGoal.nej] : []), ...(d.varQuote ? [d.varQuote.ja, d.varQuote.nej] : [])];
    const q = all.find((x) => x.id === contract) ?? d.totals.find((x) => x.id === contract);
    if (q) return q;
    const cells = csCells(contract);
    if (cells) return this.csQuote(contract, cells);
    const b = this.buildQuotes.get(contract);
    if (b) return { id: b.id, label: b.label, ask: b.ask, bid: b.bid, p: b.joint };
    // Any goal window [a, b) dragged across several bars in Målvejret.
    const m = /^w:(\d+)-(\d+):([JN])$/.exec(contract);
    if (m) {
      const a = Number(m[1]);
      const bb = Number(m[2]);
      const sim = this.sim;
      const scored = goalsOf(sim.events).some((g) => g.t >= a && g.t < bb);
      const pr = scored ? 1 : sim.t >= bb ? 0 : windowGoal(sim.p, sim.priceState(), Math.max(a, sim.t), bb);
      const pc = Math.min(0.995, Math.max(0.005, pr));
      const [ja, nej] = powerAsks([pc, 1 - pc], 0.09).map((x) => Math.max(1, Math.min(99, Math.round(x * 100))));
      const label = `Mål ${a}–${bb >= 90 ? '90+' : bb}′`;
      return m[3] === 'J' ? { id: contract, label, ask: ja, bid: Math.max(1, ja - 3), p: pc } : { id: contract, label: `Tørvejr ${a}–${bb >= 90 ? '90+' : bb}′`, ask: nej, bid: Math.max(1, nej - 3), p: 1 - pc };
    }
    return null;
  }

  /**
   * Final score: one cell has a multiplicative 15 % margin; a region takes 10 % on the sum. The
   * region is also capped by the sum of its cell asks, so it never costs more than buying the cells
   * one by one. (An earlier cap of "sum less (n − 1)" removed a point per extra cell even when a
   * cell's rounding was near zero, and priced large regions below fair. With 15 % per cell against
   * 10 % on the sum the cap cannot bind; it stays as a no-arbitrage guard.)
   */
  private csQuote(contract: string, cells: [number, number][]): Quote {
    const cp = cells.map(([h, a]) => this.disp.cells[h * CS_N + a]);
    const ps = cp.reduce((x, y) => x + y, 0);
    const cellAsk = (p: number) => Math.max(1, Math.min(99, Math.ceil(100 * p * 1.15 - 1e-9)));
    let ask: number;
    if (cells.length === 1) ask = cellAsk(ps);
    else ask = Math.max(1, Math.min(99, Math.ceil(100 * ps * 1.1 - 1e-9), cp.reduce((x, p) => x + cellAsk(p), 0)));
    const bid = Math.max(1, Math.min(ask - 2, Math.floor(100 * ps * 0.92)));
    const label = cells.length === 1 ? `Slutresultat ${cellLabel(cells[0][0], cells[0][1])}` : `Slutresultat: ${cells.map(([h, a]) => cellLabel(h, a)).join(', ')}`;
    return { id: contract, label, ask, bid, p: ps };
  }

  /** Why a contract cannot be bought right now, or null when it is open. */
  closedReason(contract: string): string | null {
    const sim = this.sim;
    if (sim.phase === 'FT' || sim.phase === 'closed') return 'Kampen er slut';
    if (sim.halt?.kind === 'var') return contract.startsWith('var') ? null : 'Kun "Målet står?" er åben under VAR';
    if (sim.halt) return 'Handlen er stoppet';
    const tm = /^tot:([\d.]+):[OU]$/.exec(contract);
    if (tm) return sim.h + sim.a > Number(tm[1]) ? `Linjen ${fmtLine(Number(tm[1]))} er allerede passeret` : this.quote(contract) ? null : 'Ukendt kontrakt';
    const cells = csCells(contract);
    if (cells) {
      const live = cells.filter(([h, a]) => cellPossible(h, a, sim.h, sim.a));
      if (!live.length) return 'Resultatet er ikke længere muligt';
      return this.quote(contract)!.p < CS_MIN_P ? 'For usandsynligt (under 3 %)' : null;
    }
    return this.isOpen(contract) ? null : 'Handlen er stoppet';
  }

  isOpen(contract: string): boolean {
    const sim = this.sim;
    if (sim.phase === 'FT' || sim.phase === 'closed') return false;
    if (sim.halt?.kind === 'var') return contract.startsWith('var');
    if (sim.halt) return false;
    const w = this.disp.windows.find((x) => x.ja.id === contract || x.nej.id === contract);
    if (w) return w.open;
    const m = /^w:(\d+)-(\d+):[JN]$/.exec(contract);
    if (m) return sim.t < Number(m[2]) - 1 && !goalsOf(sim.events).some((g) => g.t >= Number(m[1]) && g.t < Number(m[2]));
    const ag = this.disp.afterGoal;
    if (ag && (ag.ja.id === contract || ag.nej.id === contract)) return ag.open;
    if (contract.startsWith('tot:') || contract.startsWith('cs:')) return this.closedReason(contract) === null;
    // Unknown or stale contracts (an old next-goal number) are never open.
    return this.quote(contract) !== null;
  }

  // --- actions ---
  setFocus(f: Focus): void {
    if (this.focus === f) return;
    if (f === 'o25' && this.sim.h + this.sim.a > 2.5) return;
    this.focus = f;
    this.disp = display(this.sim, f);
    this.lastMcTick = -999;
    this.publish();
  }

  /** Starts the 1.5 s price lock. */
  requestBuy(contract: string, kr: number): void {
    const q = this.quote(contract);
    if (!q) return;
    if (!this.isOpen(contract)) {
      this.toast(this.closedReason(contract) ?? 'Handlen er stoppet', 'bad');
      return;
    }
    if (kr > MAX_STAKE) kr = MAX_STAKE;
    this.contracts.set(contract, { label: q.label });
    this.pending = { contract, label: this.labelOf(contract, q.label), kr, lockedAsk: q.ask, startMs: this.clock(), state: 'lock' };
    this.publish();
  }

  acceptRequote(): void {
    const p = this.pending;
    if (!p || p.state !== 'requote') return;
    const q = this.quote(p.contract);
    if (!q || !this.isOpen(p.contract)) {
      this.pending = null;
      this.toast('Handlen er stoppet', 'bad');
      return;
    }
    this.fill(p.contract, p.label, p.kr, q.ask);
    this.pending = null;
    this.publish();
  }

  cancelPending(): void {
    this.pending = null;
    this.publish();
  }

  private processPending(now: number): void {
    const p = this.pending;
    if (!p || p.state !== 'lock' || now - p.startMs < 1500) return;
    const q = this.quote(p.contract);
    if (!q || !this.isOpen(p.contract)) {
      this.pending = null;
      this.toast('Handlen er stoppet', 'bad');
      return;
    }
    if (q.ask <= p.lockedAsk + 1) {
      this.fill(p.contract, p.label, p.kr, Math.min(q.ask, p.lockedAsk));
      this.pending = null;
    } else {
      this.pending = { ...p, state: 'requote', newAsk: q.ask };
    }
    this.lastViewMs = 0;
  }

  private fill(contract: string, label: string, kr: number, ask: number): void {
    const sim = this.sim;
    const oi = OUTCOME_ID.indexOf(contract as (typeof OUTCOME_ID)[number]);
    const mid = oi >= 0 ? sim.mid[oi] : (this.quote(contract)?.p ?? ask / 100);
    const baseline = oi >= 0 ? this.baseline(oi as Outcome) : undefined;
    const r = this.book.buy({ contract, label, kr, ask, k: sim.k, t: sim.t, mid, baseline });
    if (!r.ok) {
      this.toast(r.reason, 'bad');
      return;
    }
    this.toast(`Købt ${r.shares} andele @ kurs ${ask} · ved sejr ${fmtKr(r.shares)}`, 'good');
    if (oi >= 0) this.freezeGhost(contract, oi as Outcome);
    this.holdSpeed(1500);
  }

  /** Baseline for the move grade: the fair price now and 10 game minutes later with no events. */
  private baseline(oi: Outcome): [number, number] {
    const sim = this.sim;
    const s = sim.priceState();
    const dt = Math.min(10, Math.max(0, sim.end - sim.t));
    const later = price1x2(sim.p, { ...s, t: sim.t + dt, pi: s.pi * Math.exp(-sim.p.theta * dt), excite: [s.excite[0] * Math.exp(-dt / sim.p.tauE), s.excite[1] * Math.exp(-dt / sim.p.tauE)] });
    return [sim.fair[oi], later[oi]];
  }

  sell(contract: string, shares: number): void {
    const q = this.quote(contract);
    if (!q) return;
    if (!this.isOpen(contract)) {
      this.toast('Salg åbner efter stoppet', 'bad');
      return;
    }
    const r = this.book.sell({ contract, shares, bid: q.bid, k: this.sim.k, t: this.sim.t });
    if (r.ok) this.toast(`Solgt ${shares} andele @ kurs ${q.bid} · ${fmtKr(r.kr)}`, 'good');
    else this.toast(r.reason, 'bad');
    this.publish();
  }

  placeLimit(focus: Focus, level: number, kr: number): void {
    if (!isOutcome(focus)) return;
    const r = this.book.placeLimit({ contract: OUTCOME_ID[focus], label: OUTCOME_LABEL[focus], level, kr, k: this.sim.k, ask: this.sim.ask[focus] });
    this.toast(r.ok ? `Købsgrænse sat: ${OUTCOME_SHORT[focus]} ved kurs ${Math.round(level)} · ${kr} kr` : r.reason, r.ok ? 'info' : 'bad');
    this.publish();
  }

  cancelLimit(id: number): void {
    this.book.cancelLimit(id);
    this.publish();
  }

  /** Stop-loss or take-profit on a held position (1X2 or Over/Under 2.5). */
  placeExit(contract: string, kind: ExitKind, level: number): boolean {
    const q = (EXIT_CONTRACTS as readonly string[]).includes(contract) ? this.liveQuote(contract) : null;
    if (!q) {
      this.toast('Sikring findes kun på 1X2 og Over 2,5', 'bad');
      return false;
    }
    const r = this.book.placeExit({ contract, kind, level, bid: q.bid, k: this.sim.k });
    this.toast(r.ok ? (kind === 'stop' ? `Stop-loss sat ved kurs ${r.order.level}` : `Sikr gevinst sat ved kurs ${r.order.level}`) : r.reason, r.ok ? 'info' : 'bad');
    this.publish();
    return r.ok;
  }

  cancelExit(id: number): void {
    this.book.cancelExit(id);
    this.publish();
  }

  exitsFor(contract: string): ExitOrder[] {
    return this.book.exits.filter((x) => x.status === 'aktiv' && x.contract === contract);
  }

  /** Spøgelseslinjen: median of the winning strands for this outcome, frozen at purchase. */
  private freezeGhost(contract: string, o: Outcome): void {
    const r = this.mcFor(o);
    if (!r || this.focus !== o) return;
    const win = r.strands.filter((s) => s.outcome === o);
    if (win.length < 3) return;
    const n = r.tPts.length;
    const v = new Float32Array(n);
    const col: number[] = [];
    for (let k = 0; k < n; k++) {
      col.length = 0;
      for (const s of win) col.push(s.v[k]);
      col.sort((x, y) => x - y);
      v[k] = col[Math.floor(col.length / 2)];
    }
    this.ghost = { contract, t: r.tPts.slice(), v };
  }

  ghostStatus(): string | null {
    const g = this.ghost;
    const f = this.focus;
    if (!g || !isOutcome(f) || g.contract !== OUTCOME_ID[f]) return null;
    const pos = this.book.positions.get(g.contract);
    if (!pos || pos.shares === 0 || pos.settled) return null;
    const t = this.sim.t;
    let k = 0;
    while (k < g.t.length - 1 && g.t[k + 1] <= t) k++;
    const pace = g.v[k];
    const diff = Math.round(this.sim.askRaw[f] - pace);
    return diff >= 0 ? `Foran vindertempo · +${diff} point` : `Bag vindertempo · ${diff} point`;
  }

  // --- Byg ---
  setLegs(legs: Leg[]): void {
    this.build.legs = legs;
    this.build.quote = null;
    if (!legs.length) {
      this.build.result = null;
      this.publish();
      return;
    }
    const req = this.mcRequest(0, legs);
    void this.mc.run(req).then((r) => {
      if (!r || !r.byg || this.build.legs !== legs) return;
      const b = r.byg;
      // 1X2 legs are scaled to the displayed price so a leg matches the hero (reviewer: p_DP / p_MC).
      const legP = legs.map((leg, i) => (leg.kind === 'udfald' ? this.sim.mid[leg.o] : b.legP[i]));
      const scale = legs.reduce((acc, leg, i) => (leg.kind === 'udfald' && b.legP[i] > 0 ? acc * (this.sim.mid[leg.o] / b.legP[i]) : acc), 1);
      const joint = Math.min(0.99, b.joint * scale);
      const naive = legP.reduce((x, y) => x * y, 1);
      const ask = Math.min(99, Math.max(1, Math.round(powerAsks([joint, 1 - joint], 0.12)[0] * 100)));
      const id = `byg:${legs.map(legKey).join('+')}`;
      const quote: BuildQuote = { id, legs, label: legs.map(legLabel).join(' + '), joint, legP, naive, ask, bid: Math.max(1, ask - 4), tooUnlikely: joint < 0.05 };
      this.build.quote = quote;
      this.build.result = r;
      this.buildQuotes.set(id, quote);
      this.publish();
    });
  }

  // --- toasts and view ---
  toast(text: string, tone: Toast['tone']): void {
    const t = { id: this.toastId++, text, tone };
    this.toasts = [...this.toasts.slice(-2), t];
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.publish();
    }, 2800);
    this.publish();
  }

  publish(): void {
    this.dirty = true;
    this.lastViewMs = 0;
  }

  private flushView(now: number): void {
    if (!this.dirty || now - this.lastViewMs < 250) return;
    this.dirty = false;
    this.lastViewMs = now;
    this.view = this.buildView();
    this.viewL.forEach((l) => l());
  }

  /** Forces a synchronous view update (tests and QA). */
  flushNow(): void {
    this.view = this.buildView();
    this.viewL.forEach((l) => l());
  }

  private labelOf(contract: string, fallback: string): string {
    const i = OUTCOME_ID.indexOf(contract as (typeof OUTCOME_ID)[number]);
    if (i >= 0) return OUTCOME_LABEL[i];
    const tm = /^tot:([\d.]+):([OU])$/.exec(contract);
    if (tm) return `${tm[2] === 'O' ? 'Over' : 'Under'} ${fmtLine(Number(tm[1]))} mål`;
    if (contract.endsWith(':N') && contract.startsWith('w:')) return `Tørvejr ${fallback.replace(/^Mål /, '')}`;
    if (contract.endsWith(':N') && contract.startsWith('var')) return 'Målet annulleres';
    if (contract.endsWith(':N') && contract.startsWith('ag')) return 'Efter målet: intet nyt mål';
    return fallback;
  }

  private buildView(): MatchView {
    const sim = this.sim;
    const bidOf = (c: string) => this.quote(c)?.bid ?? null;
    const positions: PositionView[] = [...this.book.positions.values()]
      .filter((p) => p.shares > 0 || p.settled || p.sold.length)
      .map((p) => {
        const bid = bidOf(p.id) ?? 0;
        const value = p.settled ? 0 : (p.shares * bid) / 100;
        const stake = p.lots.reduce((s, l) => s + (l.shares * l.price) / 100, 0);
        const back = p.proceeds + (p.settled?.payout ?? 0);
        return { id: p.id, label: p.label, shares: p.shares, avg: p.shares ? (p.cost / p.shares) * 100 : 0, value, atWin: p.shares, bid, pnl: value + back - stake, stake, settled: p.settled };
      });
    const value = this.book.value(bidOf);
    const tot = this.book.totals();
    return {
      k: sim.k,
      t: sim.t,
      minute: sim.phase === 'pre' ? 'Før kamp' : sim.phase === 'HT' ? 'Pause' : sim.phase === 'FT' || sim.phase === 'closed' ? 'Slut' : minuteLabel(sim.t),
      phase: sim.phase,
      h: sim.h,
      a: sim.a,
      red: [...sim.red] as [number, number],
      halted: sim.halted,
      haltKind: sim.halt?.kind ?? null,
      focus: this.focus,
      spec: this.spec(),
      d: this.disp,
      counts: this.mcFor()?.counts ?? null,
      saldo: this.book.saldo,
      available: this.book.available,
      value,
      positions,
      limits: this.book.limits.slice(),
      exits: this.book.exits.slice(),
      pool: this.poolView(),
      pending: this.pending,
      toasts: this.toasts,
      speed: this.effectiveSpeed(this.clock()),
      mcMode: this.mc.mode,
      mcMs: this.mc.lastMs,
      lastEventId: sim.events.length ? sim.events[sim.events.length - 1].id : 0,
      ghostStatus: this.ghostStatus(),
      staked: tot.staked,
      paidOut: tot.paidOut,
      demo: this.demo,
    };
  }

  /** Director: inserts an event at the current minute (free play). */
  fire(kind: 'goalF' | 'goalB' | 'var' | 'red' | 'whale'): void {
    const at = this.sim.t + 0.02;
    const m = Math.floor(at);
    const s = Math.round((at - m) * 60);
    const atStr = `${m}:${String(s).padStart(2, '0')}`;
    const ev =
      kind === 'goalF' ? { at: atStr, type: 'goal' as const, team: 0 as const }
      : kind === 'goalB' ? { at: atStr, type: 'goal' as const, team: 1 as const }
      : kind === 'var' ? { at: atStr, type: 'goal' as const, team: 0 as const, var: { secs: 8, p0: 0.7, verdict: (this.sim.k % 2 ? 'godkendt' : 'annulleret') as 'godkendt' | 'annulleret' } }
      : kind === 'red' ? { at: atStr, type: 'red' as const, team: 1 as const }
      : { at: atStr, type: 'whale' as const, team: 2 as const, kr: 25000 };
    this.sim.addEvent(ev);
  }

  limitsFor(f: Focus): LimitOrder[] {
    const c = this.spec(f).contract;
    return this.book.limits.filter((l) => l.status === 'aktiv' && l.contract === c);
  }

  entryFor(f: Focus): number | null {
    const p = this.book.positions.get(this.spec(f).contract);
    if (!p || !p.lots.length || p.shares === 0) return null;
    return p.lots[p.lots.length - 1].price;
  }

  log(): BookEvent[] {
    return this.book.log;
  }
}

export function fmtKr(v: number): string {
  return `${new Intl.NumberFormat('da-DK', { minimumFractionDigits: Math.abs(v - Math.round(v)) > 0.004 ? 2 : 0, maximumFractionDigits: 2 }).format(v)} kr`;
}

export function legKey(l: Leg): string {
  return l.kind === 'udfald' ? `u${l.o}` : l.kind === 'maal' ? `m${l.n}` : l.kind === 'btts' ? 'btts' : `v${l.a}-${l.b}`;
}

export function legLabel(l: Leg): string {
  if (l.kind === 'udfald') return ['FCK vinder', 'Uafgjort', 'BIF vinder'][l.o];
  if (l.kind === 'maal') return `Mindst ${l.n} mål`;
  if (l.kind === 'btts') return 'Begge scorer';
  return `Mål ${l.a}–${l.b >= 90 ? '90+' : l.b}′`;
}

export { largestRemainder, minuteOf };
