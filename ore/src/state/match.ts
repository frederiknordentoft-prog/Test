/**
 * Match store: owns the simulation, the book and the Monte Carlo client, runs the real-time loop
 * (one tick per 100 ms; `speed` substeps per tick) and publishes two kinds of updates:
 *  - `view`: coarse numbers for React, at most 4 Hz, immediately on discrete changes;
 *  - `frame`: every tick, for canvas layers that draw imperatively.
 */
import { FootballSim, type MatchEvent } from '../engine/football/sim';
import { display, goalsOf, minuteLabel, type Display, type Quote } from '../engine/football/display';
import { price1x2, windowGoal } from '../engine/football/dp';
import { Book, MAX_STAKE, type BookEvent, type LimitOrder, type Position } from '../engine/book/portfolio';
import type { McMode } from '../engine/mc/client';
import type { McRequest } from '../engine/mc/paths';
import { largestRemainder, powerAsks } from '../engine/lib/quote';
import type { Leg, McResult } from '../engine/mc/paths';
import { FREE_PLAY, minuteOf, type Timeline } from '../engine/director/timeline';
import { hashSeed } from '../engine/lib/rng';

export type Focus = 0 | 1 | 2;
export const OUTCOME_ID = ['1x2:F', '1x2:X', '1x2:B'] as const;
export const OUTCOME_LABEL = ['FCK vinder', 'Uafgjort', 'BIF vinder'] as const;
export const OUTCOME_SHORT = ['FCK', 'X', 'BIF'] as const;

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
  d: Display;
  counts: [number, number, number] | null;
  saldo: number;
  available: number;
  value: number;
  positions: PositionView[];
  limits: LimitOrder[];
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

  constructor(tl: Timeline = FREE_PLAY, mc: McLike) {
    this.tl = tl;
    this.sim = new FootballSim(tl);
    this.mc = mc;
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
    this.disp = display(this.sim, this.focus);
    this.processPending(now);
    this.maybeMc(sp);
    this.dirty = true;
    this.frameL.forEach((l) => l());
  }

  private afterStep(): void {
    const sim = this.sim;
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
    for (const f of fills) this.toast(`Købsgrænse fyldt: ${f.fill?.shares} andele @ ${f.fill?.price}${f.fill && f.fill.gapBetter > 0 ? ` · ${f.fill.gapBetter} øre bedre` : ''}`, 'good');
    // New events: settlement and listeners.
    while (this.seenEvents < sim.events.length) {
      const e = sim.events[this.seenEvents++];
      this.settleOn(e);
      if (e.kind === 'goal' || e.kind === 'var-start' || e.kind === 'var-verdict' || e.kind === 'red' || e.kind === 'whale' || e.kind === 'reopen' || e.kind === 'fulltime' || e.kind === 'kickoff' || e.kind === 'half') {
        this.eventL.forEach((l) => l(e));
        this.dirty = true;
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

  private settleOn(e: MatchEvent): void {
    const sim = this.sim;
    if (e.kind === 'goal') {
      const n = e.goalNo ?? 0;
      const team = e.team as 0 | 1;
      this.settle(`ng${n}:F`, team === 0 ? 100 : 0);
      this.settle(`ng${n}:B`, team === 1 ? 100 : 0);
      this.settle(`ng${n}:N`, 0);
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
      for (const id of [...this.book.positions.keys()]) {
        if (id.startsWith('byg:')) this.settle(id, this.buildHits(id) ? 100 : 0);
        else if (/^(w:|ag)/.test(id)) this.settle(id, id.endsWith(':N') ? 100 : 0);
      }
    }
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
    const due = this.ticks - this.lastMcTick >= (sp > 1 ? 10 : 5);
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
      probs: [sim.mid[0], sim.mid[1], sim.mid[2]],
      focus,
      askNow: sim.askRaw[focus],
      legs,
    };
  }

  // --- quotes for any contract ---
  quote(contract: string): Quote | null {
    const d = this.disp;
    const all = [...d.outcomes, ...d.dc, ...d.next, ...d.windows.flatMap((w) => [w.ja, w.nej]), ...(d.afterGoal ? [d.afterGoal.ja, d.afterGoal.nej] : []), ...(d.varQuote ? [d.varQuote.ja, d.varQuote.nej] : [])];
    const q = all.find((x) => x.id === contract);
    if (q) return q;
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
    return true;
  }

  // --- actions ---
  setFocus(f: Focus): void {
    if (this.focus === f) return;
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
      this.toast(this.sim.halt?.kind === 'var' ? 'Kun "Målet står?" er åben under VAR' : 'Handlen er stoppet', 'bad');
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
    // Baseline for the move grade: the fair price now and 10 game minutes later with no events.
    let baseline: [number, number] | undefined;
    if (oi >= 0) {
      const s = sim.priceState();
      const dt = Math.min(10, Math.max(0, sim.end - sim.t));
      const later = price1x2(sim.p, { ...s, t: sim.t + dt, pi: s.pi * Math.exp(-sim.p.theta * dt), excite: [s.excite[0] * Math.exp(-dt / sim.p.tauE), s.excite[1] * Math.exp(-dt / sim.p.tauE)] });
      baseline = [sim.fair[oi], later[oi]];
    }
    const r = this.book.buy({ contract, label, kr, ask, k: sim.k, t: sim.t, mid, baseline });
    if (!r.ok) {
      this.toast(r.reason, 'bad');
      return;
    }
    this.toast(`Købt ${r.shares} andele @ ${ask} · ved sejr ${fmtKr(r.shares)}`, 'good');
    if (oi >= 0) this.freezeGhost(contract, oi as Focus);
    this.holdSpeed(1500);
  }

  sell(contract: string, shares: number): void {
    const q = this.quote(contract);
    if (!q) return;
    if (!this.isOpen(contract)) {
      this.toast('Salg åbner efter stoppet', 'bad');
      return;
    }
    const r = this.book.sell({ contract, shares, bid: q.bid, k: this.sim.k, t: this.sim.t });
    if (r.ok) this.toast(`Solgt ${shares} andele @ ${q.bid} · ${fmtKr(r.kr)}`, 'good');
    else this.toast(r.reason, 'bad');
    this.publish();
  }

  placeLimit(focus: Focus, level: number, kr: number): void {
    const r = this.book.placeLimit({ contract: OUTCOME_ID[focus], label: OUTCOME_LABEL[focus], level, kr, k: this.sim.k, ask: this.sim.ask[focus] });
    this.toast(r.ok ? `Købsgrænse sat: ${OUTCOME_SHORT[focus]} ved ${Math.round(level)} øre · ${kr} kr` : r.reason, r.ok ? 'info' : 'bad');
    this.publish();
  }

  cancelLimit(id: number): void {
    this.book.cancelLimit(id);
    this.publish();
  }

  /** Spøgelseslinjen: median of the winning strands for this outcome, frozen at purchase. */
  private freezeGhost(contract: string, o: Focus): void {
    const r = this.mcResult;
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
    if (!g || g.contract !== OUTCOME_ID[this.focus]) return null;
    const pos = this.book.positions.get(g.contract);
    if (!pos || pos.shares === 0 || pos.settled) return null;
    const t = this.sim.t;
    let k = 0;
    while (k < g.t.length - 1 && g.t[k + 1] <= t) k++;
    const pace = g.v[k];
    const diff = Math.round(this.sim.askRaw[this.focus] - pace);
    return diff >= 0 ? `Foran vindertempo · +${diff} øre` : `Bag vindertempo · ${diff} øre`;
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
      d: this.disp,
      counts: this.mcResult?.counts ?? null,
      saldo: this.book.saldo,
      available: this.book.available,
      value,
      positions,
      limits: this.book.limits.slice(),
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
    return this.book.limits.filter((l) => l.status === 'aktiv' && l.contract === OUTCOME_ID[f]);
  }

  entryFor(f: Focus): number | null {
    const p = this.book.positions.get(OUTCOME_ID[f]);
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
