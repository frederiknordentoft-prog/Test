/**
 * The user's book: fictional saldo, positions in whole shares, buy limits with reserved funds,
 * exits (stop-loss / take-profit, one cancels the other), sales at the bid, settlement to 100 or 0,
 * and stakes in the Parken pool. Prices are in kurs per share (1 share pays 1 kr).
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
export type ExitKind = 'stop' | 'take';
export interface ExitOrder { id: number; contract: string; label: string; kind: ExitKind; level: number; k: number; status: 'aktiv' | 'udløst' | 'annulleret'; fill?: { price: number; shares: number; kr: number; k: number; t: number } }
export interface PoolStake { side: 0 | 1 | 2; kr: number; k: number; t: number }
export interface PoolResult { winner: 0 | 1 | 2; payout: number; refund: boolean; k: number; t: number }
export type BookEvent =
  | { kind: 'buy'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number }
  | { kind: 'sell'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number; via?: ExitKind }
  | { kind: 'pool-stake'; k: number; t: number; side: 0 | 1 | 2; label: string; kr: number }
  | { kind: 'pool-settle'; k: number; t: number; winner: 0 | 1 | 2; label: string; payout: number; refund: boolean }
  | { kind: 'limit-fill'; k: number; t: number; contract: string; label: string; shares: number; price: number; kr: number; better: number }
  | { kind: 'settle'; k: number; t: number; contract: string; label: string; value: 0 | 100; payout: number };

export const START_SALDO = 5000;
export const MAX_STAKE = 1000;
export const MAX_LIMITS = 3;
/** The house keeps this share of the pool. */
export const POOL_TAKE = 0.1;
/** A stop fires only once the market has been open this many substeps after a reopen. */
export const STOP_REOPEN_GUARD = 7;
/** A stop compares against ask − 2, so a wider spread alone never fires it. */
export const STOP_ASK_OFFSET = 2;

/**
 * Pool payout for the user's stakes: winning stake ÷ winning side × pool × (1 − take).
 * Sides include the user's own money. An empty winning side refunds every stake.
 */
export function poolPayout(user: readonly number[], crowd: readonly number[], winner: 0 | 1 | 2, take = POOL_TAKE): { payout: number; refund: boolean } {
  const side = (i: number) => crowd[i] + user[i];
  const pool = side(0) + side(1) + side(2);
  if (side(winner) <= 1e-9) return { payout: user[0] + user[1] + user[2], refund: true };
  return { payout: (user[winner] / side(winner)) * pool * (1 - take), refund: false };
}

export class Book {
  saldo = START_SALDO;
  positions = new Map<string, Position>();
  limits: LimitOrder[] = [];
  exits: ExitOrder[] = [];
  poolStakes: PoolStake[] = [];
  poolResult: PoolResult | null = null;
  log: BookEvent[] = [];
  private nextLimit = 1;
  private nextExit = 1;

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

  sell(o: { contract: string; shares: number; bid: number; k: number; t: number; via?: ExitKind }): { ok: true; kr: number } | { ok: false; reason: string } {
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
    this.log.push({ kind: 'sell', k: o.k, t: o.t, contract: o.contract, label: p.label, shares: n, price: o.bid, kr, ...(o.via ? { via: o.via } : {}) });
    if (p.shares === 0) this.cancelExitsOf(o.contract);
    return { ok: true, kr };
  }

  placeLimit(o: { contract: string; label: string; level: number; kr: number; k: number; ask: number }): { ok: true; order: LimitOrder } | { ok: false; reason: string } {
    if (this.limits.filter((l) => l.status === 'aktiv').length >= MAX_LIMITS) return { ok: false, reason: `Højst ${MAX_LIMITS} aktive købsgrænser` };
    if (o.level >= o.ask) return { ok: false, reason: 'Kursen er allerede under grænsen. Køb nu i stedet?' };
    if (o.kr > this.available) return { ok: false, reason: 'Ikke nok på saldoen' };
    const stop = this.activeExit(o.contract, 'stop');
    if (stop && stop.level >= o.level) return { ok: false, reason: `Dit stop-loss på kurs ${stop.level} ville sælge før grænsen køber` };
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

  /** Settles every held share of a contract at 100 or 0. */
  settle(contract: string, value: 0 | 100, k: number, t: number): Position | null {
    const p = this.positions.get(contract);
    if (!p || p.settled) return null;
    const payout = (p.shares * value) / 100;
    this.saldo += payout;
    p.settled = { value, payout, k, t };
    for (const l of this.limits) if (l.contract === contract && l.status === 'aktiv') l.status = 'annulleret';
    this.cancelExitsOf(contract);
    this.log.push({ kind: 'settle', k, t, contract, label: p.label, value, payout });
    return p;
  }

  // --- exits: stop-loss and take-profit ------------------------------------------------------

  activeExit(contract: string, kind: ExitKind): ExitOrder | undefined {
    return this.exits.find((x) => x.contract === contract && x.kind === kind && x.status === 'aktiv');
  }

  /** Suggested levels from the average entry: stop 15 below, take 25 above, kept on the right side of the bid. */
  static exitSuggestion(avgEntry: number, bid: number): { stop: number; take: number } {
    const c = (v: number) => Math.max(1, Math.min(99, Math.round(v)));
    return { stop: c(Math.min(avgEntry - 15, bid - 1)), take: c(Math.max(avgEntry + 25, bid + 1)) };
  }

  /**
   * Places (or moves) the stop or take on a position. At most one of each per position. A stop must
   * sit below the bid, a take above it; a stop at or above an active buy limit on the same contract
   * is refused (it would sell before the limit buys).
   */
  placeExit(o: { contract: string; kind: ExitKind; level: number; bid: number; k: number }): { ok: true; order: ExitOrder } | { ok: false; reason: string } {
    const p = this.positions.get(o.contract);
    if (!p || p.shares < 1 || p.settled) return { ok: false, reason: 'Ingen åben position at sikre' };
    const level = Math.round(o.level);
    if (level < 1 || level > 99) return { ok: false, reason: 'Niveauet skal ligge mellem 1 og 99' };
    if (o.kind === 'stop' && level >= o.bid) return { ok: false, reason: `Stop-loss skal ligge under salgskursen ${o.bid}` };
    if (o.kind === 'take' && level <= o.bid) return { ok: false, reason: `Sikr gevinst skal ligge over salgskursen ${o.bid}` };
    if (o.kind === 'stop') {
      const lim = this.limits.find((l) => l.contract === o.contract && l.status === 'aktiv' && level >= l.level);
      if (lim) return { ok: false, reason: `Din købsgrænse på kurs ${lim.level} ville købe efter stoppet` };
    }
    const old = this.activeExit(o.contract, o.kind);
    if (old) old.status = 'annulleret';
    const order: ExitOrder = { id: this.nextExit++, contract: o.contract, label: p.label, kind: o.kind, level, k: o.k, status: 'aktiv' };
    this.exits.push(order);
    return { ok: true, order };
  }

  cancelExit(id: number): void {
    const x = this.exits.find((e) => e.id === id);
    if (x && x.status === 'aktiv') x.status = 'annulleret';
  }

  private cancelExitsOf(contract: string): void {
    for (const x of this.exits) if (x.contract === contract && x.status === 'aktiv') x.status = 'annulleret';
  }

  /**
   * Fires exits, never during a halt. Stop: ask − 2 ≤ level and the market has been open more than
   * 7 substeps since the last reopen; it sells everything at the bid, which may be below the level
   * ("til første kurs efter stoppet"). Take: bid ≥ level, so the fill is never below the level.
   * One fired exit cancels the other. Runs before buy limits.
   */
  checkExits(quote: (contract: string) => { ask: number; bid: number } | null, halted: boolean, k: number, t: number, reopenK: number): ExitOrder[] {
    if (halted) return [];
    const fired: ExitOrder[] = [];
    for (const x of this.exits) {
      if (x.status !== 'aktiv') continue;
      const p = this.positions.get(x.contract);
      if (!p || p.shares < 1 || p.settled) {
        x.status = 'annulleret';
        continue;
      }
      const q = quote(x.contract);
      if (!q) continue;
      const hit = x.kind === 'stop' ? q.ask - STOP_ASK_OFFSET <= x.level && k - reopenK > STOP_REOPEN_GUARD : q.bid >= x.level;
      if (!hit) continue;
      const shares = p.shares;
      const r = this.sell({ contract: x.contract, shares, bid: q.bid, k, t, via: x.kind });
      if (!r.ok) continue;
      x.status = 'udløst';
      x.fill = { price: q.bid, shares, kr: r.kr, k, t };
      fired.push(x);
    }
    return fired;
  }

  // --- the Parken pool -------------------------------------------------------------------------

  /** The user's stakes per side (kr). */
  poolUser(): [number, number, number] {
    const u: [number, number, number] = [0, 0, 0];
    for (const s of this.poolStakes) u[s.side] += s.kr;
    return u;
  }

  stakePool(o: { side: 0 | 1 | 2; kr: number; k: number; t: number; label: string }): { ok: true } | { ok: false; reason: string } {
    if (this.poolResult) return { ok: false, reason: 'Puljen er afgjort' };
    const kr = Math.round(o.kr);
    if (kr < 1) return { ok: false, reason: 'Indsatsen er for lille' };
    if (kr > MAX_STAKE) return { ok: false, reason: `Højst ${MAX_STAKE} kr pr. indsats` };
    if (kr > this.available + 1e-9) return { ok: false, reason: 'Ikke nok på saldoen' };
    this.saldo -= kr;
    this.poolStakes.push({ side: o.side, kr, k: o.k, t: o.t });
    this.log.push({ kind: 'pool-stake', k: o.k, t: o.t, side: o.side, label: o.label, kr });
    return { ok: true };
  }

  /** Pays the pool out once (idempotent). `crowd` is the crowd's money per side at the close. */
  settlePool(winner: 0 | 1 | 2, crowd: readonly number[], k: number, t: number, label: string): PoolResult | null {
    if (this.poolResult || this.poolStakes.length === 0) return null;
    const { payout, refund } = poolPayout(this.poolUser(), crowd, winner);
    this.saldo += payout;
    this.poolResult = { winner, payout, refund, k, t };
    this.log.push({ kind: 'pool-settle', k, t, winner, label, payout, refund });
    return this.poolResult;
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
      if (e.kind === 'buy' || e.kind === 'limit-fill' || e.kind === 'pool-stake') staked += e.kr;
      if (e.kind === 'sell') paidOut += e.kr;
      if (e.kind === 'settle' || e.kind === 'pool-settle') paidOut += e.payout;
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
