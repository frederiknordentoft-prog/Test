/**
 * The user's book: fictional saldo, positions in whole shares, buy limits with reserved funds,
 * sales at the bid and settlement to 100 or 0 øre. Prices are in øre per share (1 share pays 1 kr).
 */
export interface Lot { k: number; t: number; shares: number; price: number; midAtEntry: number; baseline?: [number, number] }
export interface Position {
  id: string;
  label: string;
  shares: number; // held now
  cost: number; // kr paid for the shares still held
  lots: Lot[];
  sold: { k: number; t: number; shares: number; price: number }[];
  proceeds: number;
  settled: null | { value: 0 | 100; payout: number; k: number; t: number };
}
export interface LimitOrder { id: number; contract: string; label: string; level: number; kr: number; reserved: number; k: number; status: 'aktiv' | 'fyldt' | 'annulleret'; fill?: { price: number; shares: number; k: number; gapBetter: number } }
export type BookEvent =
  | { kind: 'buy'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number }
  | { kind: 'sell'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number }
  | { kind: 'limit-fill'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number; better: number }
  | { kind: 'settle'; k: number; t: number; contract: string; label: string; value: 0 | 100; payout: number };

export const START_SALDO = 5000;
export const MAX_STAKE = 1000;
export const MAX_LIMITS = 3;

export class Book {
  saldo = START_SALDO;
  positions = new Map<string, Position>();
  limits: LimitOrder[] = [];
  log: BookEvent[] = [];
  private nextLimit = 1;

  /** Whole shares for a stake: k = ⌊100·S / ask⌋, cost k·ask/100 kr. */
  static sharesFor(kr: number, ask: number): { shares: number; cost: number } {
    const shares = Math.floor((100 * kr) / ask + 1e-9);
    return { shares, cost: (shares * ask) / 100 };
  }

  get reserved(): number {
    return this.limits.filter((l) => l.status === 'aktiv').reduce((s, l) => s + l.reserved, 0);
  }
  get available(): number {
    return this.saldo - this.reserved;
  }

  private pos(id: string, label: string): Position {
    let p = this.positions.get(id);
    if (!p) {
      p = { id, label, shares: 0, cost: 0, lots: [], sold: [], proceeds: 0, settled: null };
      this.positions.set(id, p);
    }
    return p;
  }

  buy(o: { contract: string; label: string; kr: number; ask: number; k: number; t: number; mid: number; baseline?: [number, number] }): { ok: true; shares: number; cost: number } | { ok: false; reason: string } {
    if (o.kr > MAX_STAKE) return { ok: false, reason: `Højst ${MAX_STAKE} kr pr. køb` };
    const { shares, cost } = Book.sharesFor(o.kr, o.ask);
    if (shares < 1) return { ok: false, reason: 'Indsatsen er for lille til én andel' };
    if (cost > this.available + 1e-9) return { ok: false, reason: 'Ikke nok på saldoen' };
    const p = this.pos(o.contract, o.label);
    if (p.settled) return { ok: false, reason: 'Kontrakten er afregnet' };
    this.saldo -= cost;
    p.shares += shares;
    p.cost += cost;
    p.lots.push({ k: o.k, t: o.t, shares, price: o.ask, midAtEntry: o.mid, baseline: o.baseline });
    this.log.push({ kind: 'buy', k: o.k, t: o.t, contract: o.contract, label: o.label, shares, price: o.ask, kr: cost });
    return { ok: true, shares, cost };
  }

  sell(o: { contract: string; shares: number; bid: number; k: number; t: number }): { ok: true; kr: number } | { ok: false; reason: string } {
    const p = this.positions.get(o.contract);
    if (!p || p.shares < 1) return { ok: false, reason: 'Ingen andele at sælge' };
    if (p.settled) return { ok: false, reason: 'Kontrakten er afregnet' };
    const n = Math.min(p.shares, Math.max(1, Math.round(o.shares)));
    const kr = (n * o.bid) / 100;
    const avg = p.cost / p.shares;
    p.cost -= avg * n;
    p.shares -= n;
    p.proceeds += kr;
    p.sold.push({ k: o.k, t: o.t, shares: n, price: o.bid });
    this.saldo += kr;
    this.log.push({ kind: 'sell', k: o.k, t: o.t, contract: o.contract, label: p.label, shares: n, price: o.bid, kr });
    return { ok: true, kr };
  }

  placeLimit(o: { contract: string; label: string; level: number; kr: number; k: number; ask: number }): { ok: true; order: LimitOrder } | { ok: false; reason: string } {
    if (this.limits.filter((l) => l.status === 'aktiv').length >= MAX_LIMITS) return { ok: false, reason: `Højst ${MAX_LIMITS} aktive købsgrænser` };
    if (o.level >= o.ask) return { ok: false, reason: 'Kursen er allerede under grænsen. Køb nu i stedet?' };
    if (o.kr > this.available) return { ok: false, reason: 'Ikke nok på saldoen' };
    const order: LimitOrder = { id: this.nextLimit++, contract: o.contract, label: o.label, level: Math.round(o.level), kr: o.kr, reserved: o.kr, k: o.k, status: 'aktiv' };
    this.limits.push(order);
    return { ok: true, order };
  }

  cancelLimit(id: number): void {
    const l = this.limits.find((x) => x.id === id);
    if (l && l.status === 'aktiv') l.status = 'annulleret';
  }

  /**
   * Fills buy limits when the ask is at or below the level, never during a halt. Right after a
   * reopen the fill is at the first ask after the gap (which may be better than the level).
   */
  checkLimits(quote: (contract: string) => { ask: number; mid: number } | null, halted: boolean, k: number, t: number): LimitOrder[] {
    if (halted) return [];
    const filled: LimitOrder[] = [];
    for (const l of this.limits) {
      if (l.status !== 'aktiv') continue;
      const q = quote(l.contract);
      if (!q || q.ask > l.level) continue;
      const { shares, cost } = Book.sharesFor(l.kr, q.ask);
      if (shares < 1) continue;
      l.status = 'fyldt';
      l.reserved = 0;
      const p = this.pos(l.contract, l.label);
      this.saldo -= cost;
      p.shares += shares;
      p.cost += cost;
      p.lots.push({ k, t, shares, price: q.ask, midAtEntry: q.mid });
      l.fill = { price: q.ask, shares, k, gapBetter: l.level - q.ask };
      this.log.push({ kind: 'limit-fill', k, t, contract: l.contract, label: l.label, shares, price: q.ask, kr: cost, better: l.level - q.ask });
      filled.push(l);
    }
    return filled;
  }

  /** Settles every held share of a contract at 100 or 0 øre. */
  settle(contract: string, value: 0 | 100, k: number, t: number): Position | null {
    const p = this.positions.get(contract);
    if (!p || p.settled) return null;
    const payout = (p.shares * value) / 100;
    this.saldo += payout;
    p.settled = { value, payout, k, t };
    for (const l of this.limits) if (l.contract === contract && l.status === 'aktiv') l.status = 'annulleret';
    this.log.push({ kind: 'settle', k, t, contract, label: p.label, value, payout });
    return p;
  }

  /** Market value of open positions at the bid (kr). */
  value(bidOf: (contract: string) => number | null): number {
    let v = 0;
    for (const p of this.positions.values()) {
      if (p.settled || p.shares === 0) continue;
      const b = bidOf(p.id);
      if (b !== null) v += (p.shares * b) / 100;
    }
    return v;
  }

  totals(): { staked: number; paidOut: number } {
    let staked = 0;
    let paidOut = 0;
    for (const e of this.log) {
      if (e.kind === 'buy' || e.kind === 'limit-fill') staked += e.kr;
      if (e.kind === 'sell') paidOut += e.kr;
      if (e.kind === 'settle') paidOut += e.payout;
    }
    return { staked, paidOut };
  }
}

/**
 * Move grade from closing-line value in logit space: how far the mid moved in your favour within
 * 10 game minutes (or until the next goal), minus what time alone would have done.
 */
export type Grade = 'Brillant !!' | 'Godt køb !' | 'Præcist' | 'Unøjagtigt ?!' | 'Fejlkøb ??';
export function grade(midEntry: number, midR: number, baseEntry: number, baseR: number): { clv: number; grade: Grade } {
  const lg = (p: number) => Math.log(Math.min(0.999, Math.max(0.001, p)) / (1 - Math.min(0.999, Math.max(0.001, p))));
  const clv = lg(midR) - lg(midEntry) - (lg(baseR) - lg(baseEntry));
  const g: Grade = clv >= 0.3 ? 'Brillant !!' : clv >= 0.1 ? 'Godt køb !' : clv > -0.1 ? 'Præcist' : clv > -0.3 ? 'Unøjagtigt ?!' : 'Fejlkøb ??';
  return { clv, grade: g };
}
