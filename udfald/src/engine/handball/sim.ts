/**
 * Live handball simulation, one substep (0.75 game s) per step().
 *
 * The sim draws each attack's plan from the shared chain (planAttack, path 0) when the attack
 * starts and reveals it substep by substep. The state at k is a pure function of
 * (seed, timeline, naturalGoals, k): stepTo(k) from scratch, step() k times and a second
 * instance all give identical snapshots, and stepping backwards replays from kick-off.
 *
 * Director timeline:
 *  - { k, type: 'goal', team }: a forced goal at substep k. If the team has the ball, the attack
 *    ends as a goal; otherwise the attack in progress ends as a turnover and the team scores on
 *    the counter. Either way the conceding team throws off.
 *  - { type: 'bias', fromK, toK, team, amount }: adds `amount` to the team's goal probability
 *    for attacks that start in [fromK, toK). Negative amounts suppress goals (−1 = no natural goals).
 *  - naturalGoals: false makes every unscripted finish a miss or a save.
 * Because the attack timing never depends on goal probabilities, bias and naturalGoals change
 * only which finishes go in, never when attacks end.
 */
import { advantage, attackP, ChainState, EndResult, Phase, PlanEv, planAttack, Suspension, Via } from './chain';
import { FIXTURE, HandballParams, HB_PARAMS, K_END, K_HALF, SUBSTEP_S, Team, tOf } from './params';

export type TimelineEntry =
  | { k: number; type: 'goal'; team: Team }
  | { type: 'bias'; fromK: number; toK: number; team: Team; amount: number };

export type EventKind = 'goal' | 'turnover' | '7m' | 'suspension' | 'passive';
/** How a goal or turnover came about. 'forced' marks director goals (and the turnover before a counter goal). */
export type EventVia = Via | 'forced';

export interface HbEvent {
  k: number;
  t: number;
  kind: EventKind;
  /** goal: scorer; turnover: team that lost the ball; 7m and passive: attacking team; suspension: team that lost a player. */
  team: Team;
  via?: EventVia;
  /** Score after the event. */
  h: number;
  a: number;
}

export interface AttackRecord {
  team: Team;
  startK: number;
  endK: number;
  /** 'cut' = ended by the halftime or full-time buzzer. */
  result: EndResult | 'cut';
  via: EventVia;
  /** Natural goal draw / threshold of the finish (< 1 = goal), Infinity when no goal was possible. */
  m: number;
  p: number;
}

export interface HandballSnapshot extends ChainState {
  /** Game minutes, 0–60. */
  t: number;
  half: 1 | 2;
  over: boolean;
  attackElapsedS: number;
  passive: { active: boolean; passesLeft: number };
  powerplay: { team: Team; untilT: number } | null;
  /** The most recent events (oldest first), at most RECENT_EVENTS. */
  events: HbEvent[];
}

export interface SimOptions {
  seed?: number;
  timeline?: readonly TimelineEntry[];
  naturalGoals?: boolean;
  params?: HandballParams;
}

export const RECENT_EVENTS = 12;

type Bias = Extract<TimelineEntry, { type: 'bias' }>;
type Forced = Extract<TimelineEntry, { type: 'goal' }>;

export class HandballSim {
  readonly seed: number;
  readonly params: HandballParams;
  readonly naturalGoals: boolean;
  private readonly forced: Forced[];
  private readonly biases: Bias[];

  private _k = 0;
  private h = 0;
  private a = 0;
  private team: Team = 0;
  private phase: Phase | 'over' = 'play';
  private plan: PlanEv[] = [];
  private cursor = 0;
  private attackStartK = 0;
  private attackPowerplay = false;
  private attackPr = 0;
  private stageStartK = 0;
  private passesLeft = 0;
  private sevenAtK = 0;
  private susp: Suspension[] = [];
  private fi = 0;
  private log: HbEvent[] = [];
  private attackLog: AttackRecord[] = [];
  private readonly diff = new Int16Array(K_END + 1);
  private readonly poss = new Uint8Array(K_END + 1);

  constructor(opts: SimOptions = {}) {
    this.seed = opts.seed ?? FIXTURE.seed;
    this.params = opts.params ?? HB_PARAMS;
    this.naturalGoals = opts.naturalGoals ?? true;
    const tl = opts.timeline ?? [];
    this.forced = tl
      .filter((e): e is Forced => e.type === 'goal')
      .map((e, i) => ({ e, i }))
      .sort((x, y) => x.e.k - y.e.k || x.i - y.i)
      .map((x) => x.e);
    this.biases = tl.filter((e): e is Bias => e.type === 'bias');
    this.reset();
  }

  get k(): number {
    return this._k;
  }

  reset(): void {
    this._k = 0;
    this.h = 0;
    this.a = 0;
    this.susp = [];
    this.fi = 0;
    this.log = [];
    this.attackLog = [];
    this.diff.fill(0);
    this.poss.fill(0);
    this.startAttack(0, 0);
  }

  step(): void {
    if (this._k >= K_END) return;
    const k = ++this._k;
    if (k === K_END) {
      this.closeAttack('cut', 'play', Infinity);
      this.phase = 'over';
      this.plan = [];
      this.record(k);
      return;
    }
    if (k === K_HALF) {
      this.closeAttack('cut', 'play', Infinity);
      this.startAttack(1, k);
    }
    while (this.fi < this.forced.length && this.forced[this.fi].k <= k) {
      const f = this.forced[this.fi++];
      if (f.k === k) this.forceGoal(f.team);
    }
    while (this.cursor < this.plan.length && this.plan[this.cursor].k <= k) {
      const ev = this.plan[this.cursor++];
      this.apply(ev);
    }
    this.record(k);
  }

  /** Advance (or replay from kick-off, if k is in the past) to substep k. */
  stepTo(k: number): void {
    const target = Math.max(0, Math.min(K_END, Math.floor(k)));
    if (target < this._k) this.reset();
    while (this._k < target) this.step();
  }

  /** Goal difference (AaH − GOG) at substep k ≤ current k. */
  diffAt(k: number): number {
    return this.diff[Math.max(0, Math.min(this._k, Math.floor(k)))];
  }

  /** Team in possession at substep k ≤ current k. */
  possessionAt(k: number): Team {
    return this.poss[Math.max(0, Math.min(this._k, Math.floor(k)))] as Team;
  }

  /** Goal difference per substep, index 0..k (a view, no copy; do not write to it). */
  diffHistory(): Int16Array {
    return this.diff.subarray(0, this._k + 1);
  }

  /** Every event so far, oldest first (do not mutate). */
  allEvents(): readonly HbEvent[] {
    return this.log;
  }

  eventsSince(k: number): HbEvent[] {
    let i = this.log.length;
    while (i > 0 && this.log[i - 1].k > k) i--;
    return this.log.slice(i);
  }

  /** Finished attacks so far (used by the director to place forced goals on natural attack ends). */
  attacks(): readonly AttackRecord[] {
    return this.attackLog;
  }

  snapshot(): HandballSnapshot {
    const k = this._k;
    const susp = this.susp.filter((s) => s.untilK > k).map((s) => ({ team: s.team, untilK: s.untilK }));
    return {
      k,
      t: tOf(k),
      h: this.h,
      a: this.a,
      d: this.h - this.a,
      half: k < K_HALF ? 1 : 2,
      over: this.phase === 'over',
      possession: this.team,
      phase: this.phase,
      attackStartK: this.attackStartK,
      stageStartK: this.stageStartK,
      passesLeft: this.passesLeft,
      sevenAtK: this.sevenAtK,
      attackPowerplay: this.attackPowerplay,
      suspensions: susp,
      attackElapsedS: (k - this.attackStartK) * SUBSTEP_S,
      passive: { active: this.phase === 'passive', passesLeft: this.phase === 'passive' ? this.passesLeft : 0 },
      powerplay: powerplayOf(k, susp),
      events: this.log.slice(-RECENT_EVENTS).map((e) => ({ ...e })),
    };
  }

  private record(k: number) {
    this.diff[k] = this.h - this.a;
    this.poss[k] = this.team;
  }

  private biasAt(team: Team, k: number): number {
    let b = 0;
    for (const x of this.biases) if (x.team === team && k >= x.fromK && k < x.toK) b += x.amount;
    return b;
  }

  private startAttack(team: Team, k: number) {
    const pp = advantage(team, k, this.susp) > 0;
    let p = 0;
    if (this.naturalGoals) {
      p = attackP(this.params, team, pp) + this.biasAt(team, k);
      p = Math.max(0, Math.min(this.params.pCap, p));
    }
    this.team = team;
    this.phase = 'play';
    this.attackStartK = k;
    this.stageStartK = k;
    this.attackPowerplay = pp;
    this.attackPr = p;
    this.passesLeft = 0;
    this.sevenAtK = 0;
    this.plan = planAttack(this.params, this.seed, 0, team, k, p, this.params.pGoal[team]);
    this.cursor = 0;
  }

  private closeAttack(result: AttackRecord['result'], via: EventVia, m: number) {
    if (this.phase === 'over') return;
    this.attackLog.push({ team: this.team, startK: this.attackStartK, endK: this._k, result, via, m, p: this.attackPr });
  }

  private emit(kind: EventKind, team: Team, via?: EventVia) {
    const k = this._k;
    const ev: HbEvent = { k, t: tOf(k), kind, team, h: this.h, a: this.a };
    if (via) ev.via = via;
    this.log.push(ev);
  }

  private score(team: Team, via: EventVia) {
    if (team === 0) this.h++;
    else this.a++;
    this.emit('goal', team, via);
  }

  private forceGoal(team: Team) {
    const k = this._k;
    const other: Team = team === 0 ? 1 : 0;
    if (this.team !== team) {
      this.closeAttack('turnover', 'forced', Infinity);
      this.emit('turnover', this.team, 'forced');
      this.team = team;
      this.attackStartK = k;
      this.attackPr = 0;
    }
    this.closeAttack('goal', 'forced', 0);
    this.score(team, 'forced');
    this.startAttack(other, k);
  }

  private apply(ev: PlanEv) {
    const k = this._k;
    switch (ev.t) {
      case 'passive':
        this.phase = 'passive';
        this.passesLeft = 4;
        this.stageStartK = k;
        this.emit('passive', this.team);
        return;
      case 'pass':
        this.passesLeft = Math.max(0, this.passesLeft - 1);
        this.stageStartK = k;
        return;
      case '7m':
        this.phase = '7m';
        this.sevenAtK = k + this.params.sevenDelayK;
        this.emit('7m', this.team);
        return;
      case 'end': {
        const team = this.team;
        const other: Team = team === 0 ? 1 : 0;
        this.closeAttack(ev.r, ev.via, ev.m);
        if (ev.r === 'goal') {
          this.score(team, ev.via);
          this.startAttack(other, k);
        } else if (ev.r === 'turnover') {
          this.emit('turnover', team, ev.via);
          this.startAttack(other, k);
        } else {
          this.susp = this.susp.filter((s) => s.untilK > k);
          this.susp.push({ team: other, untilK: k + this.params.suspensionK });
          this.emit('suspension', other);
          this.startAttack(team, k);
        }
      }
    }
  }
}

/** The team with more players on court and when that advantage ends, or null at equal strength. */
export function powerplayOf(k: number, susp: readonly Suspension[]): { team: Team; untilT: number } | null {
  const active = susp.filter((s) => s.untilK > k).sort((x, y) => x.untilK - y.untilK);
  const adv0 = advantage(0, k, active);
  if (adv0 === 0) return null;
  const team: Team = adv0 > 0 ? 0 : 1;
  let lead = Math.abs(adv0);
  for (const s of active) {
    lead += s.team === team ? 1 : -1;
    if (lead <= 0) return { team, untilT: tOf(s.untilK) };
  }
  return { team, untilT: tOf(active[active.length - 1].untilK) };
}
