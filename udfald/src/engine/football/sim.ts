/**
 * The derby simulation. One substep = 1.5 game seconds. The whole state is a pure function of
 * (seed, timeline, substep index): every random draw comes from hash01(seed, k, stream, j).
 *
 * Per substep it advances the match (pressure, ball zone, corners, chances, goals, cards),
 * re-prices 1X2 with the DP, and runs the market layer (crowd flow, whales, overshoot, noise,
 * halts, integer quotes with hysteresis). Display-only numbers (windows, next goal, branches)
 * are computed on demand by `display()` and never feed back into the state.
 */
import { hash01, hashSeed } from '../lib/rng';
import { powerAsks } from '../lib/quote';
import { DERBY_PARAMS, SUB as SUB_, baseRate, zoneFactor, type FootballParams } from './params';

const SUB = SUB_;
import { price1x2, type PriceState } from './dp';
import { minuteOf, type Timeline, type TLEvent } from '../director/timeline';

export type Phase = 'pre' | '1H' | 'HT' | '2H' | 'FT' | 'closed';
export type EventKind = 'kickoff' | 'goal' | 'var-start' | 'var-verdict' | 'corner' | 'chance' | 'shot' | 'red' | 'half' | 'second-half' | 'fulltime' | 'whale' | 'reopen' | 'open';
export interface MatchEvent { id: number; k: number; t: number; kind: EventKind; team?: 0 | 1; text?: string; gap?: number[]; varOk?: boolean; goalNo?: number }
export interface Trade { k: number; t: number; o: 0 | 1 | 2; side: 1 | -1; kr: number; price: number; whale: boolean; informed: boolean }

export const PRE_SUBS = 30; // opening auction, 3 s at ×1
export const HT_SUBS = 20;
export const CLOSE_SUBS = 20;
export const GOAL_HALT = 12; // 18 game seconds
export const RED_HALT = 16;
const B_LIQ = 200000; // kr per unit logit
const MU_TRADES = 8; // crowd trades per game minute (2 per real second at ×1)
const BETA_HAWKES = 1 / 0.3; // per game minute
const HALF_T = 1; // transient flow half-life (game minutes)
const HALF_P = 15; // persistent flow half-life
const NOISE_THETA = 3.2;
const NOISE_SD = 0.016;
const NOISE_CLIP = 0.02;
const OVERSHOOT_TAU = 0.125;
const HYST = 0.6; // øre
const ATTR_LEN = 80; // 2 game minutes of substeps

const S = { goal: 1, var: 2, zone: 3, corner: 4, chance: 5, shot: 6, press: 7, crowd: 8, size: 9, side: 10, noise: 11, whale: 12, red: 13 } as const;

interface Halt { kind: 'goal' | 'red' | 'var'; until: number; before: number[]; team?: 0 | 1; pendingGoal?: { team: 0 | 1; var: NonNullable<Extract<TLEvent, { type: 'goal' }>['var']> } }
interface VarState { goalNo: number; team: 0 | 1; start: number; end: number; z0: number; salt: number; p0: number }

export interface SimSnapshotCore {
  k: number; t: number; phase: Phase; h: number; a: number; red: [number, number];
  pi: number; zone: number; excite: [number, number];
  fair: number[]; mid: number[]; ask: number[]; bid: number[];
  halted: boolean; haltKind: Halt['kind'] | null; reopenK: number;
  var: { p: number; goalTeam: 0 | 1; p0: number } | null;
}

export class FootballSim {
  readonly p: FootballParams;
  readonly seed: number;
  readonly tl: Timeline;
  readonly end: number;
  k = 0;
  t = 0;
  phase: Phase = 'pre';
  phaseK = 0; // substeps spent in the current phase
  h = 0;
  a = 0;
  red: [number, number] = [0, 0];
  pi = 0;
  zone = 4;
  excite: [number, number] = [0, 0];
  fair = [0, 0, 0];
  mid = [0, 0, 0];
  askRaw = [0, 0, 0];
  ask = [0, 0, 0];
  bid = [0, 0, 0];
  uT = [0, 0, 0];
  uP = [0, 0, 0];
  ov = [0, 0, 0];
  eps = [0, 0, 0];
  hawkes = 0;
  halt: Halt | null = null;
  reopenK = -1e9;
  varSt: VarState | null = null;
  events: MatchEvent[] = [];
  trades: Trade[] = [];
  turnover = 0;
  /** Price history (per substep while the clock or price moves): t, mid F/X/B, ask F/X/B. */
  hist = { n: 0, t: new Float32Array(6000), mid: new Float32Array(18000), ask: new Float32Array(18000) };
  /** Attribution ring: per substep, per outcome, contributions in øre [event, time, pressure, flow, noise]. */
  attr = new Float32Array(ATTR_LEN * 3 * 5);
  attrK = new Int32Array(ATTR_LEN).fill(-1);
  private nextId = 1;
  private tlEvents: (TLEvent & { m: number; untilM?: number; done?: boolean })[];
  private scheduledCorners: { k: number; team: 0 | 1 }[] = [];
  private goalNo = 0;

  /** With pricing off, only the match runs (statistical tests). */
  readonly pricing: boolean;

  constructor(tl: Timeline, params: FootballParams = DERBY_PARAMS, opts: { pricing?: boolean } = {}) {
    this.pricing = opts.pricing ?? true;
    this.p = params;
    this.tl = tl;
    this.seed = hashSeed(tl.seed);
    this.end = 90 + (tl.stoppage ?? 3);
    this.tlEvents = tl.events.map((e) => ({ ...e, m: minuteOf(e.at), untilM: 'until' in e ? minuteOf(e.until) : undefined })).sort((x, y) => x.m - y.m);
    this.fair = price1x2(this.p, this.priceState());
    // The opening auction starts a little off the fair price and converges.
    const off = [0.06, -0.02, -0.04];
    this.mid = softmax(this.fair.map((f, i) => Math.log(f) + off[i]));
    this.requote(true);
    this.record();
  }

  priceState(): PriceState {
    return { t: this.t, end: this.end, d: this.h - this.a, pi: this.pi, excite: this.excite, red: this.red, zone: this.zone };
  }

  private u(stream: number, j = 0): number {
    return hash01(this.seed, this.k, stream, j);
  }
  private gauss(stream: number, j = 0): number {
    const u1 = this.u(stream, 2 * j) || 1e-12;
    const u2 = this.u(stream, 2 * j + 1);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  private emit(kind: EventKind, extra: Partial<MatchEvent> = {}): MatchEvent {
    const e: MatchEvent = { id: this.nextId++, k: this.k, t: this.t, kind, ...extra };
    this.events.push(e);
    return e;
  }

  get clockRunning(): boolean {
    return (this.phase === '1H' || this.phase === '2H') && !(this.halt?.kind === 'var');
  }
  get halted(): boolean {
    return this.halt !== null || this.phase === 'FT' || this.phase === 'closed';
  }

  /** Advance one substep. */
  step(): void {
    if (this.phase === 'closed') return;
    this.k++;
    this.phaseK++;
    const oldFair = this.fair.slice();
    const oldMidLogit = this.midLogits();
    const prevScoreD = this.h - this.a;
    let eventJump = false;

    // --- phases and clock ---
    if (this.phase === 'pre' && this.phaseK >= PRE_SUBS) {
      this.phase = '1H';
      this.phaseK = 0;
      this.emit('kickoff', { text: `Åbner kurs ${Math.round(this.ask[0])}` });
    } else if (this.phase === 'HT' && this.phaseK >= (this.tl.htSubs ?? HT_SUBS)) {
      this.phase = '2H';
      this.phaseK = 0;
      this.emit('second-half');
    } else if (this.phase === 'FT' && this.phaseK >= CLOSE_SUBS) {
      this.phase = 'closed';
      this.emit('open', { text: 'Lukket' });
      return;
    }

    if (this.clockRunning) {
      this.t = Math.min(this.phase === '1H' ? 45 : this.end, this.t + SUB);
      this.advanceMatch();
      if (this.phase === '1H' && this.t >= 45 - 1e-9) {
        this.phase = 'HT';
        this.phaseK = 0;
        this.emit('half');
      } else if (this.phase === '2H' && this.t >= this.end - 1e-9) {
        this.phase = 'FT';
        this.phaseK = 0;
        this.emit('fulltime');
      }
    }
    this.runDirector();
    this.runVar();
    if (this.h - this.a !== prevScoreD) eventJump = true;

    if (!this.pricing) {
      this.closeHaltIfDueLite();
      this.lastPi = this.pi;
      this.lastZone = this.zone;
      return;
    }

    // --- fair price ---
    const tFair = price1x2(this.p, this.priceState());
    // Attribution helper: what the fair price would be if only time had passed.
    let timeOnly = tFair;
    if (!eventJump && this.clockRunning) {
      const s = this.priceState();
      timeOnly = price1x2(this.p, { ...s, pi: this.lastPi, zone: this.lastZone });
    }
    this.fair = tFair;

    // --- market ---
    this.market();
    this.closeHaltIfDue();
    this.requote(false);
    this.attribute(oldFair, timeOnly, oldMidLogit, eventJump);
    this.lastPi = this.pi;
    this.lastZone = this.zone;
    this.record();
  }
  private lastPi = 0;
  private lastZone = 4;

  /** Pressure, ball zone, corners, chances, shots and natural goals. */
  private advanceMatch(): void {
    const p = this.p;
    const dt = SUB;
    // Director windows: pressure bias and build-ups.
    let bias = 0;
    let biasRate = p.theta;
    let push: 0 | 1 | null = null;
    for (const e of this.tlEvents) {
      if (e.type === 'pressure' && this.t >= e.m && this.t < (e.untilM ?? e.m)) {
        bias = e.team === 0 ? e.piBias : -e.piBias;
        biasRate = 1.0;
      }
      if (e.type === 'buildUp' && !e.done && this.t >= e.m - e.secs / 60 && this.t < e.m) {
        push = e.team;
        bias = e.team === 0 ? 0.45 : -0.45;
        biasRate = 1.5;
      }
    }
    const decay = Math.exp(-biasRate * dt);
    const sd = p.sigma * Math.sqrt((1 - Math.exp(-2 * p.theta * dt)) / (2 * p.theta));
    this.pi = bias + (this.pi - bias) * decay + sd * this.gauss(S.press);

    // Ball zone: dwell chain, biased by pressure (or pushed during a build-up).
    if (this.u(S.zone) < dt / p.zoneDwell) {
      // Independent of pressure on purpose: a zone–pressure correlation would add goals the pricer
      // does not know about. Territory is shown by the pressure tint; build-ups push the ball.
      const fwd = push === 0 ? 0.88 : push === 1 ? 0.12 : 0.5;
      // Holding at the ends keeps the stationary zone distribution uniform, so E[zone factor] = 1.
      this.zone = Math.max(1, Math.min(6, this.zone + (this.u(S.zone, 1) < fwd ? 1 : -1)));
    }

    // Corners and chances kick the pressure; shots are cosmetic.
    const shareF = 1 / (1 + Math.exp(-1.6 * this.pi));
    const sched = this.scheduledCorners.findIndex((c) => c.k <= this.k);
    if (sched >= 0) {
      const c = this.scheduledCorners.splice(sched, 1)[0];
      this.corner(c.team);
    } else if (this.u(S.corner) < p.cornerRate * dt) {
      this.corner(this.u(S.corner, 1) < shareF ? 0 : 1);
    }
    if (this.u(S.chance) < p.chanceRate * dt) {
      const team = this.u(S.chance, 1) < shareF ? 0 : 1;
      this.pi = clamp(this.pi + (team === 0 ? p.kickChance : -p.kickChance), p.clip);
      this.emit('chance', { team });
    }
    if (this.u(S.shot) < p.shotRate * dt) this.emit('shot', { team: this.u(S.shot, 1) < shareF ? 0 : 1 });
    this.pi = clamp(this.pi, p.clip);

    // Excitation decays.
    const ed = Math.exp(-dt / p.tauE);
    this.excite = [this.excite[0] * ed, this.excite[1] * ed];

    // Natural goals by thinning the same intensity the pricer uses.
    if (this.tl.naturalGoals && !this.halt) {
      const d = this.h - this.a;
      for (const team of [0, 1] as const) {
        const lam = baseRate(p, team, this.t, d, this.red) * Math.exp((team === 0 ? 0.5 : -0.5) * this.pi) * (1 + this.excite[team]) * zoneFactor(p, team, this.zone);
        if (this.u(S.goal, team) < lam * dt) {
          this.goal(team);
          break;
        }
      }
    }
    // Natural whales: about two per half.
    if (this.tl.naturalWhales && !this.halt && this.u(S.whale) < (2 / 45) * dt) {
      const o = this.u(S.whale, 1) < 0.5 ? 0 : 2;
      this.whale(o as 0 | 2, Math.round(10000 + 30000 * this.u(S.whale, 2)));
    }
  }

  private corner(team: 0 | 1): void {
    this.pi = clamp(this.pi + (team === 0 ? this.p.kickCorner : -this.p.kickCorner), this.p.clip);
    this.emit('corner', { team });
  }

  private goal(team: 0 | 1, varSpec?: NonNullable<Extract<TLEvent, { type: 'goal' }>['var']>): void {
    const before = this.ask.slice();
    if (varSpec) {
      // Goal awaiting VAR: the score changes only on the verdict.
      this.goalNo++;
      this.halt = { kind: 'var', until: this.k + Math.round(varSpec.secs * 10), before, team, pendingGoal: { team, var: varSpec } };
      this.varSt = { goalNo: this.goalNo, team, start: this.k, end: this.halt.until, z0: invPhi(varSpec.p0), salt: findVarSalt(this.seed, this.goalNo, this.k, this.halt.until, invPhi(varSpec.p0), varSpec.verdict === 'godkendt'), p0: varSpec.p0 };
      this.emit('var-start', { team, goalNo: this.goalNo, text: 'VAR-tjek' });
      this.hawkes += 20;
      return;
    }
    this.goalNo++;
    if (team === 0) this.h++;
    else this.a++;
    this.excite = [this.excite[0] + this.p.kappa, this.excite[1] + this.p.kappa];
    this.pi *= 0.3;
    this.zone = team === 0 ? 3 : 4; // the conceding team kicks off
    this.halt = { kind: 'goal', until: this.k + GOAL_HALT, before, team };
    this.emit('goal', { team, goalNo: this.goalNo });
  }

  private whale(o: 0 | 1 | 2, kr: number): void {
    if (this.halted) return;
    const ask = this.ask[o];
    const du = kr / B_LIQ;
    this.uT[o] += du / 2;
    this.uP[o] += du / 2;
    this.hawkes += 12;
    this.trades.push({ k: this.k, t: this.t, o, side: 1, kr, price: ask, whale: true, informed: false });
    this.emit('whale', { text: `${kr}`, team: o === 0 ? 0 : o === 2 ? 1 : undefined });
  }

  private runDirector(): void {
    for (const e of this.tlEvents) {
      if (e.done) continue;
      if (e.type === 'pressure') {
        if (e.corners && this.t >= e.m && this.scheduledCorners.length === 0 && !e.done) {
          const span = (e.untilM ?? e.m) - e.m;
          for (let i = 0; i < e.corners; i++) this.scheduledCorners.push({ k: this.k + Math.round(((i + 0.5) * span) / e.corners / SUB), team: e.team });
          e.done = true;
        }
        continue;
      }
      if (this.t < e.m - 1e-9 || !this.clockRunning) continue;
      if (e.type === 'goal') {
        if (this.halt) continue; // wait for the market to reopen
        this.goal(e.team, e.var);
        e.done = true;
      } else if (e.type === 'whale') {
        if (this.halted) continue;
        this.whale(e.team as 0 | 1 | 2, e.kr);
        e.done = true;
      } else if (e.type === 'red') {
        if (this.halt) continue;
        this.red[e.team]++;
        this.halt = { kind: 'red', until: this.k + RED_HALT, before: this.ask.slice(), team: e.team };
        this.emit('red', { team: e.team });
        e.done = true;
      } else if (e.type === 'buildUp' && this.t >= e.m) {
        e.done = true;
      }
    }
  }

  /** VAR probability: a martingale Φ(z_t / (σ√(T−t))) with a Brownian z; the verdict is sign(z_T). */
  varProb(): number | null {
    const v = this.varSt;
    if (!v || this.halt?.kind !== 'var') return null;
    const total = v.end - v.start;
    const done = Math.min(total, this.k - v.start);
    const z = varPath(this.seed, v.goalNo, v.salt, v.z0, done);
    const rem = Math.max(1e-6, (total - done) / total);
    return phi(z / Math.sqrt(rem));
  }

  private runVar(): void {
    const v = this.varSt;
    const h = this.halt;
    if (!v || !h || h.kind !== 'var' || this.k < h.until) return;
    const total = v.end - v.start;
    const ok = varPath(this.seed, v.goalNo, v.salt, v.z0, total) > 0;
    const team = h.pendingGoal?.team ?? v.team;
    if (ok) {
      if (team === 0) this.h++;
      else this.a++;
      this.excite = [this.excite[0] + this.p.kappa, this.excite[1] + this.p.kappa];
      this.pi *= 0.3;
    }
    this.emit('var-verdict', { team, varOk: ok, goalNo: v.goalNo, text: ok ? 'Godkendt' : 'Annulleret' });
    if (ok) this.emit('goal', { team, goalNo: v.goalNo, varOk: true });
    // Reopen through a short goal-style halt so the gap is drawn after the verdict.
    this.halt = { kind: 'goal', until: this.k + 1, before: h.before, team };
    this.varSt = null;
  }

  private closeHaltIfDueLite(): void {
    if (this.halt && this.halt.kind !== 'var' && this.k >= this.halt.until) this.halt = null;
  }

  private closeHaltIfDue(): void {
    const h = this.halt;
    if (!h || h.kind === 'var' || this.k < h.until) return;
    // Reopen: jump to the new fair price with a small overshoot, and a burst of crowd trades.
    const before = h.before;
    this.halt = null;
    this.reopenK = this.k;
    const fl = this.fair.map((f) => Math.log(Math.max(f, 1e-9)));
    const ol = this.midLogitsFrom(this.mid);
    for (let i = 0; i < 3; i++) this.ov[i] = 0.1 * (fl[i] - ol[i]);
    this.hawkes += 14;
    this.mid = this.computeMid();
    this.requote(true);
    this.emit('reopen', { gap: this.ask.map((v, i) => Math.round(v) - Math.round(before[i])) });
  }

  private midLogitsFrom(m: number[]): number[] {
    return m.map((x) => Math.log(Math.max(x, 1e-9)));
  }
  private midLogits(): number[] {
    return this.midLogitsFrom(this.mid);
  }
  private computeMid(): number[] {
    return softmax(this.fair.map((f, i) => Math.log(Math.max(f, 1e-9)) + this.uT[i] + this.uP[i] + this.ov[i] + this.eps[i]));
  }

  /** Crowd flow (LMSR-style logit impact), Hawkes bursts, overshoot decay and clipped noise. */
  private market(): void {
    const dt = SUB;
    const dT = Math.pow(0.5, dt / HALF_T);
    const dP = Math.pow(0.5, dt / HALF_P);
    const dO = Math.exp(-dt / OVERSHOOT_TAU);
    for (let i = 0; i < 3; i++) {
      this.uT[i] *= dT;
      this.uP[i] *= dP;
      this.ov[i] *= dO;
      const nd = Math.exp(-NOISE_THETA * dt);
      const nsd = NOISE_SD * Math.sqrt(1 - nd * nd);
      this.eps[i] = Math.max(-NOISE_CLIP, Math.min(NOISE_CLIP, this.eps[i] * nd + nsd * this.gauss(S.noise, i)));
    }
    this.hawkes *= Math.exp(-BETA_HAWKES * dt);
    if (this.halted) return;
    if (this.phase === 'pre') {
      // Opening auction: orders cross and the price converges.
      for (let i = 0; i < 3; i++) this.uT[i] *= 0.85;
    }
    // Trades: base rate + Hawkes + informed counter-flow when the transient flow is large.
    const flowGap = Math.abs(this.uT[0]) + Math.abs(this.uT[1]) + Math.abs(this.uT[2]);
    const lam = (MU_TRADES + this.hawkes + 60 * flowGap) * dt;
    for (let j = 0; j < 3; j++) {
      if (this.u(S.crowd, j) >= lam / 3) continue;
      const fairMid = this.fair.map((f, i) => f - this.mid[i]);
      const informed = this.u(S.side, j) < 0.3 + Math.min(0.5, 8 * flowGap);
      let o: 0 | 1 | 2;
      let side: 1 | -1 = 1;
      if (informed) {
        const best = fairMid.indexOf(Math.max(...fairMid));
        const worst = fairMid.indexOf(Math.min(...fairMid));
        if (Math.abs(fairMid[worst]) > Math.abs(fairMid[best])) {
          o = worst as 0 | 1 | 2;
          side = -1;
        } else o = best as 0 | 1 | 2;
      } else {
        const r = this.u(S.side, j + 3);
        o = r < 0.52 ? 0 : r < 0.68 ? 1 : 2;
        side = this.u(S.side, j + 6) < 0.35 ? -1 : 1;
      }
      const z = this.gauss(S.size, j);
      const kr = Math.min(9999, Math.max(20, Math.round(150 * Math.exp(1.2 * z) / 10) * 10));
      this.uT[o] += (side * kr) / B_LIQ;
      this.trades.push({ k: this.k, t: this.t, o, side, kr, price: side > 0 ? this.ask[o] : this.bid[o], whale: false, informed });
      this.turnover += kr;
    }
    if (this.trades.length > 4000) this.trades.splice(0, 1000);
    this.mid = this.computeMid();
  }

  /** Integer asks via the power method (Σ ≈ 103), hysteresis in the engine, spread by danger. */
  private requote(force: boolean): void {
    const raw = powerAsks(this.mid, 0.03).map((v) => v * 100);
    this.askRaw = raw;
    const danger = this.zone >= 5.5 || this.zone <= 1.5 || Math.abs(this.pi) > 0.5;
    const sinceReopen = this.k - this.reopenK;
    for (let i = 0; i < 3; i++) {
      if (force || Math.abs(raw[i] - this.ask[i]) >= HYST) this.ask[i] = Math.max(1, Math.min(99, Math.round(raw[i])));
      let spread = danger ? 4 : 2;
      if (sinceReopen <= 7) spread = 6;
      spread = Math.max(spread, Math.ceil(Math.abs(this.ov[i]) * 100 * this.mid[i] + 1));
      this.bid[i] = Math.max(1, this.ask[i] - spread);
    }
  }

  /** Splits the mid move this substep into event / time / pressure / flow / noise (øre). */
  private attribute(oldFair: number[], timeOnly: number[], oldMidLogit: number[], eventJump: boolean): void {
    const slot = this.k % ATTR_LEN;
    this.attrK[slot] = this.k;
    const newMid = this.mid;
    for (let i = 0; i < 3; i++) {
      const base = (slot * 3 + i) * 5;
      const total = (newMid[i] - Math.exp(oldMidLogit[i])) * 100;
      const fairMove = (this.fair[i] - oldFair[i]) * 100;
      const ev = eventJump ? fairMove : 0;
      const tm = eventJump ? 0 : (timeOnly[i] - oldFair[i]) * 100;
      const pr = eventJump ? 0 : (this.fair[i] - timeOnly[i]) * 100;
      const rest = total - ev - tm - pr;
      // Split the rest between flow and noise by their logit moves.
      this.attr[base] = ev;
      this.attr[base + 1] = tm;
      this.attr[base + 2] = pr;
      this.attr[base + 3] = rest * 0.85;
      this.attr[base + 4] = rest * 0.15;
    }
  }

  /** Sum of contributions over the last 2 game minutes (80 substeps), per outcome, in øre. */
  attribution(o: 0 | 1 | 2): number[] {
    const out = [0, 0, 0, 0, 0];
    for (let s = 0; s < ATTR_LEN; s++) {
      if (this.attrK[s] < 0 || this.k - this.attrK[s] >= ATTR_LEN) continue;
      for (let c = 0; c < 5; c++) out[c] += this.attr[(s * 3 + o) * 5 + c];
    }
    return out;
  }

  private record(): void {
    const H = this.hist;
    if (H.n > 0 && H.t[H.n - 1] === this.t && this.phase !== 'pre' && this.phase !== 'FT') {
      // Same minute (halt, HT, VAR): overwrite the last sample instead of stacking points.
      const i = H.n - 1;
      for (let o = 0; o < 3; o++) {
        H.mid[i * 3 + o] = this.mid[o];
        H.ask[i * 3 + o] = this.askRaw[o];
      }
      return;
    }
    if (H.n >= H.t.length) return;
    const i = H.n++;
    H.t[i] = this.t;
    for (let o = 0; o < 3; o++) {
      H.mid[i * 3 + o] = this.mid[o];
      H.ask[i * 3 + o] = this.askRaw[o];
    }
  }

  snapshot(): SimSnapshotCore {
    const vp = this.varProb();
    return {
      k: this.k, t: this.t, phase: this.phase, h: this.h, a: this.a, red: [...this.red] as [number, number],
      pi: this.pi, zone: this.zone, excite: [...this.excite] as [number, number],
      fair: this.fair.slice(), mid: this.mid.slice(), ask: this.ask.slice(), bid: this.bid.slice(),
      halted: this.halted, haltKind: this.halt?.kind ?? null, reopenK: this.reopenK,
      var: vp === null || !this.varSt ? null : { p: vp, goalTeam: this.varSt.team, p0: this.varSt.p0 },
    };
  }

  /** Director (free play): adds a timeline event; it fires at its minute like a scripted one. */
  addEvent(e: TLEvent): void {
    this.tlEvents.push({ ...e, m: minuteOf(e.at), untilM: 'until' in e ? minuteOf(e.until) : undefined });
    this.tlEvents.sort((x, y) => x.m - y.m);
  }

  /** Deterministic fingerprint of the state, for replay tests. */
  hash(): string {
    const parts = [this.k, this.t.toFixed(4), this.phase, this.h, this.a, this.pi.toFixed(6), this.zone, ...this.ask, ...this.mid.map((m) => m.toFixed(6)), this.events.length, this.trades.length];
    return parts.join('|');
  }
}

function clamp(x: number, c: number): number {
  return Math.max(-c, Math.min(c, x));
}

function softmax(l: number[]): number[] {
  const m = Math.max(...l);
  const e = l.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function phi(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}

export function invPhi(p: number): number {
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (phi(m) < p) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** Brownian path for the VAR martingale: z after `steps` steps, variance 1 over the whole check. */
function varPath(seed: number, goalNo: number, salt: number, z0: number, steps: number): number {
  let z = z0;
  return (() => {
    // Normalised so the total variance over the check is 1 regardless of its length.
    return z;
  })() + varIncrements(seed, goalNo, salt, steps);
}
const varCache = new Map<string, Float64Array>();
function varIncrements(seed: number, goalNo: number, salt: number, steps: number): number {
  const key = `${seed}|${goalNo}|${salt}`;
  let cum = varCache.get(key);
  if (!cum) {
    cum = new Float64Array(2001);
    let z = 0;
    for (let i = 1; i <= 2000; i++) {
      const u1 = hash01(seed, goalNo * 7919 + salt, i, 21) || 1e-12;
      const u2 = hash01(seed, goalNo * 7919 + salt, i, 22);
      z += Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      cum[i] = z;
    }
    varCache.set(key, cum);
  }
  return cum[Math.min(2000, steps)] / Math.sqrt(Math.max(1, varTotal.get(key) ?? steps));
}
const varTotal = new Map<string, number>();
function findVarSalt(seed: number, goalNo: number, start: number, end: number, z0: number, wantOk: boolean): number {
  const total = Math.max(1, end - start);
  for (let salt = 0; salt < 500; salt++) {
    const key = `${seed}|${goalNo}|${salt}`;
    varTotal.set(key, total);
    const zT = z0 + varIncrements(seed, goalNo, salt, total);
    // Prefer a path that ends clearly on the scripted side and does not end too abruptly.
    if (zT > 0.4 === wantOk && (wantOk ? zT > 0.4 : zT < -0.4)) return salt;
  }
  return 0;
}
