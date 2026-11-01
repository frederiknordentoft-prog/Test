/**
 * Hall store: Aalborg–GOG. One substep (0.75 game s) per 100 ms at ×1, so a game minute lasts 8 s.
 * Contracts: 1X2 (power method, 4 %) and triggers ("Aalborg +N før M′", first passage, 8 %).
 * The book is shared with the derby, so there is one saldo.
 */
import { HandballSim, type HandballSnapshot, type HbEvent } from '../engine/handball/sim';
import { quotes, triggerProb, triggerQuote, nextAttackGoal, winProbs } from '../engine/handball/pricing';
import { HALLEN20, HALLEN20_START_K, fastForwardTo } from '../engine/handball/director';
import { K_END, kOf } from '../engine/handball/params';
import { Book } from '../engine/book/portfolio';
import { largestRemainder } from '../engine/lib/quote';

export interface Trigger { level: number; deadline: number }
export interface HallenView {
  k: number;
  t: number;
  minute: string;
  h: number;
  a: number;
  over: boolean;
  asks: [number, number, number];
  futures: [number, number, number];
  possession: 0 | 1;
  attackS: number;
  passive: { active: boolean; passesLeft: number };
  powerplay: { team: 0 | 1; leftS: number } | null;
  nextGoal: number;
  trigger: Trigger;
  triggerAsk: number;
  triggerP: number;
  positions: { id: string; label: string; shares: number; avg: number; settled: null | { value: 0 | 100 } }[];
  toasts: { id: number; text: string; tone: 'good' | 'bad' | 'info' }[];
  flashK: number;
  saldo: number;
}

export const HB_IDS = ['hb:1x2:A', 'hb:1x2:X', 'hb:1x2:G'] as const;
export const HB_LABELS = ['Aalborg vinder', 'Uafgjort', 'GOG vinder'] as const;

function minuteOf(t: number, over: boolean): string {
  if (over) return 'Slut';
  return `${Math.floor(t)}′`;
}

export class HallenStore {
  sim: HandballSim;
  book: Book;
  speed = 1;
  trigger: Trigger = { level: 4, deadline: 45 };
  demo = false;
  private view: HallenView;
  private viewL = new Set<() => void>();
  private frameL = new Set<() => void>();
  private raf = 0;
  private acc = 0;
  private last = 0;
  private lastView = 0;
  private dirty = false;
  private toastId = 1;
  private toasts: HallenView['toasts'] = [];
  private seen = 0;
  private flashK = -1;
  private triggers = new Map<string, Trigger & { label: string }>();

  constructor(book: Book = new Book(), opts: { demo?: boolean } = {}) {
    this.book = book;
    this.demo = Boolean(opts.demo);
    this.sim = this.demo ? fastForwardTo(HALLEN20_START_K, HALLEN20) : new HandballSim({});
    if (this.demo) {
      this.speed = 2;
      this.trigger = { level: 4, deadline: 45 };
    }
    this.seen = this.sim.allEvents().length;
    this.view = this.build();
  }

  subscribe = (l: () => void) => {
    this.viewL.add(l);
    return () => this.viewL.delete(l);
  };
  getView = () => this.view;
  onFrame(l: () => void): () => void {
    this.frameL.add(l);
    return () => this.frameL.delete(l);
  }

  start(): void {
    if (this.raf) return;
    this.last = performance.now();
    const loop = (now: number) => {
      this.acc += Math.min(400, now - this.last);
      this.last = now;
      let n = 0;
      while (this.acc >= 100 && n < 3) {
        this.tick();
        this.acc -= 100;
        n++;
      }
      if (n === 3) this.acc = 0;
      if (this.dirty && now - this.lastView > 250) {
        this.dirty = false;
        this.lastView = now;
        this.view = this.build();
        this.viewL.forEach((l) => l());
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  tick(): void {
    if (this.sim.k >= K_END) return;
    for (let i = 0; i < this.speed && this.sim.k < K_END; i++) {
      this.sim.step();
      this.settleTriggers();
    }
    const evs = this.sim.allEvents();
    while (this.seen < evs.length) this.onEvent(evs[this.seen++]);
    if (this.sim.k >= K_END) this.settleFull();
    this.dirty = true;
    this.frameL.forEach((l) => l());
  }

  private onEvent(e: HbEvent): void {
    void e;
  }

  snap(): HandballSnapshot {
    return this.sim.snapshot();
  }

  /** Difference trace for the scope: the last `n` samples spread over the match so far. */
  trace(n: number): number[] {
    const hist = this.sim.diffHistory();
    const k = this.sim.k;
    if (k < 2) return [0];
    const out: number[] = [];
    for (let i = 0; i < n; i++) out.push(hist[Math.floor((i / (n - 1)) * (k - 1))]);
    return out;
  }

  setTrigger(t: Partial<Trigger>): void {
    this.trigger = { ...this.trigger, ...t };
    this.publish();
  }

  triggerId(t: Trigger = this.trigger): string {
    return `hb:trig:${t.level}:${t.deadline}`;
  }

  buy(kind: 'A' | 'X' | 'G' | 'trig', kr: number): void {
    const s = this.snap();
    if (s.over) return this.toast('Kampen er slut', 'bad');
    let id: string;
    let label: string;
    let ask: number;
    let p: number;
    if (kind === 'trig') {
      const t = this.trigger;
      if (t.deadline <= s.t) return this.toast('Fristen er passeret', 'bad');
      id = this.triggerId();
      label = `Aalborg ${t.level > 0 ? '+' : ''}${t.level} før ${t.deadline >= 60 ? 'slut' : `${t.deadline}′`}`;
      ask = triggerQuote(s, t.level, t.deadline);
      p = triggerProb(s, t.level, t.deadline);
      if (ask >= 100) return this.toast('Niveauet er allerede nået', 'bad');
      this.triggers.set(id, { ...t, label });
    } else {
      const i = kind === 'A' ? 0 : kind === 'X' ? 1 : 2;
      id = HB_IDS[i];
      label = HB_LABELS[i];
      ask = quotes(s)[i];
      p = winProbs(s)[i];
    }
    const r = this.book.buy({ contract: id, label, kr, ask, k: s.k, t: s.t, mid: p });
    if (r.ok) this.toast(`Købt ${r.shares} andele @ ${ask} · ved ramning ${r.shares} kr`, 'good');
    else this.toast(r.reason, 'bad');
    this.publish();
  }

  /** A trigger pays 100 the first time the lead touches its level, 0 at its deadline. */
  private settleTriggers(): void {
    const s = this.sim;
    const t = (s.k * 0.75) / 60;
    const d = s.diffAt(s.k);
    for (const [id, tr] of this.triggers) {
      const pos = this.book.positions.get(id);
      if (!pos || pos.settled) continue;
      const hit = tr.level >= 0 ? d >= tr.level : d <= tr.level;
      if (hit) {
        this.book.settle(id, 100, s.k, t);
        this.flashK = s.k;
        this.toast(`${tr.label}: ramt · +${pos.shares} kr`, 'good');
      } else if (t >= tr.deadline) {
        this.book.settle(id, 0, s.k, t);
        this.toast(`${tr.label}: fristen udløb`, 'bad');
      }
    }
  }

  private settleFull(): void {
    const s = this.snap();
    const res = s.h > s.a ? 0 : s.h === s.a ? 1 : 2;
    HB_IDS.forEach((id, i) => {
      const p = this.book.positions.get(id);
      if (p && !p.settled) this.book.settle(id, i === res ? 100 : 0, s.k, s.t);
    });
  }

  toast(text: string, tone: 'good' | 'bad' | 'info'): void {
    const t = { id: this.toastId++, text, tone };
    this.toasts = [...this.toasts.slice(-2), t];
    setTimeout(() => {
      this.toasts = this.toasts.filter((x) => x.id !== t.id);
      this.publish();
    }, 2600);
    this.publish();
  }

  publish(): void {
    this.dirty = true;
    this.lastView = 0;
  }

  private build(): HallenView {
    const s = this.snap();
    const asks = quotes(s);
    const wp = winProbs(s);
    const tr = this.trigger;
    const triggerP = tr.deadline > s.t ? triggerProb(s, tr.level, tr.deadline) : 0;
    const triggerAsk = tr.deadline > s.t ? triggerQuote(s, tr.level, tr.deadline) : 0;
    const positions = [...this.book.positions.values()]
      .filter((p) => p.id.startsWith('hb:'))
      .map((p) => ({ id: p.id, label: p.label, shares: p.shares, avg: p.shares ? (p.cost / p.shares) * 100 : 0, settled: p.settled ? { value: p.settled.value } : null }));
    return {
      k: s.k,
      t: s.t,
      minute: minuteOf(s.t, s.over),
      h: s.h,
      a: s.a,
      over: s.over,
      asks,
      futures: largestRemainder(wp, 100) as [number, number, number],
      possession: s.possession,
      attackS: s.attackElapsedS,
      passive: s.passive,
      powerplay: s.powerplay ? { team: s.powerplay.team, leftS: Math.max(0, Math.round((s.powerplay.untilT - s.t) * 60)) } : null,
      nextGoal: nextAttackGoal(s),
      trigger: tr,
      triggerAsk,
      triggerP,
      positions,
      toasts: this.toasts,
      flashK: this.flashK,
      saldo: this.book.saldo,
    };
  }
}

export { kOf };
