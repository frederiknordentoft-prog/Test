// Engine rules R1–R11 (see the normative header of src/math/engine.ts). A referee re-derives every Step of
// real spins independently from the SpinResult alone; plus targeted cases for each rule.
import { describe, it, expect } from 'vitest';
import { spinBase, compileModel, clusterWinOre, markUp, PAY_UNIT, type Model } from '../src/math/engine.ts';
import { spinRng, makeSpinId } from '../src/math/rng.ts';
import { CONFIG, type MathConfig } from '../src/math/config.ts';
import { bucketOf } from '../src/math/grid.ts';
import { hashOf } from '../src/math/hash.ts';
import { SYM, type SpinResult, type Sym } from '../src/math/types.ts';

const isLow = (s: number) => s <= 3;

/** Independent referee: checks one SpinResult against R2–R10. Returns the recomputed total. */
export function referee(r: SpinResult, cfg: MathConfig, stormLike = false): number {
  const n = r.cols * r.rows;
  const scale = r.mode === 'storm' ? cfg.stormPayScale : cfg.payScale;
  const cap = r.mode === 'storm' ? cfg.stormMarkCap : cfg.baseMarkCap;
  expect(r.initial.length).toBe(n);
  expect(r.steps.length).toBeGreaterThanOrEqual(1);
  expect(r.steps[0].grid).toEqual(r.initial);
  // suns: ≤1 per column, exactly the SUN cells of the initial grid
  const suns = r.initial.map((s, i) => (s === SYM.SUN ? i : -1)).filter((i) => i >= 0);
  expect([...r.sunCells].sort((a, b) => a - b)).toEqual(suns);
  const perCol = new Map<number, number>();
  for (const s of suns) perCol.set(Math.floor(s / r.rows), (perCol.get(Math.floor(s / r.rows)) ?? 0) + 1);
  for (const v of perCol.values()) expect(v).toBe(1);
  let marks = r.marksBefore.slice();
  let raw = 0, charge = 0;
  for (let k = 0; k < r.steps.length; k++) {
    const st = r.steps[k];
    const last = k === r.steps.length - 1;
    // suns never disappear
    expect(st.grid.filter((s) => s === SYM.SUN).length).toBe(suns.length);
    if (last) {
      expect(st.clusters).toEqual([]);
      expect(st.removed).toEqual([]);
      expect(st.moves).toEqual([]);
      expect(st.refill).toEqual([]);
      expect(st.markChanges).toEqual([]);
      expect(st.charge).toBe(0);
      expect(st.stepWinOre).toBe(0);
      break;
    }
    expect(st.clusters.length).toBeGreaterThan(0);
    // R5/R6: mult from marks BEFORE this step, integer øre rounding
    let stepWin = 0;
    const union = new Set<number>();
    for (const cl of st.clusters) {
      expect(cl.sym).toBeLessThan(7);
      expect(cl.cells.some((c) => st.grid[c] === cl.sym)).toBe(true);
      expect(cl.cells.every((c) => st.grid[c] === cl.sym || st.grid[c] === SYM.WILD)).toBe(true);
      expect(cl.size).toBe(cl.cells.length);
      let sum = 0;
      for (const c of cl.cells) { if (marks[c] >= 2) sum += marks[c]; union.add(c); }
      expect(cl.mult).toBe(Math.max(1, sum));
      const unit = Math.round(cfg.paytable[cl.sym][bucketOf(cl.size)] * scale * PAY_UNIT);
      expect(cl.payX).toBe(unit / PAY_UNIT);
      expect(cl.winOre).toBe(Math.floor((unit * cl.mult * r.stakeOre + 5000) / 10000));
      stepWin += cl.winOre;
    }
    expect(st.stepWinOre).toBe(stepWin);
    raw += stepWin;
    expect([...st.removed].sort((a, b) => a - b)).toEqual([...union].sort((a, b) => a - b));
    // R9 charge (base only)
    let c = 0;
    for (const i of st.removed) c += st.grid[i] === SYM.WILD ? 3 : isLow(st.grid[i]) ? 1 : 2;
    expect(st.charge).toBe(r.mode === 'storm' ? 0 : c);
    charge += st.charge;
    // R5 upgrades: +1 level, winning wild +2, cap
    const next = marks.slice();
    for (const i of st.removed) next[i] = markUp(marks[i], st.grid[i] === SYM.WILD ? 2 : 1, cap);
    const changes = st.removed.filter((i) => next[i] !== marks[i]).map((i) => ({ cell: i, from: marks[i], to: next[i] }));
    expect(st.markChanges).toEqual(changes);
    marks = next;
    // R7 cascade: replaying moves + refill on this grid reproduces the next grid
    const g: (Sym | -1)[] = st.grid.slice();
    for (const i of st.removed) g[i] = -1;
    const after: (Sym | -1)[] = g.slice();
    const movedFrom = new Set<number>();
    for (const m of st.moves) {
      expect(Math.floor(m.from / r.rows)).toBe(Math.floor(m.to / r.rows)); // same column
      expect(m.to).toBeGreaterThan(m.from);                                 // falls down
      expect(g[m.from]).not.toBe(-1);
      movedFrom.add(m.from);
    }
    for (const m of st.moves) if (!st.moves.some((o) => o.to === m.from)) after[m.from] = -1;
    for (const m of st.moves) after[m.to] = g[m.from];
    for (const f of st.refill) {
      expect(f.sym).not.toBe(SYM.SUN);
      expect(after[f.cell]).toBe(-1);
      after[f.cell] = f.sym;
    }
    expect(after).toEqual(r.steps[k + 1].grid);
    // gravity: refills are exactly the top rows of each column
    for (let col = 0; col < r.cols; col++) {
      const rows = st.refill.filter((f) => Math.floor(f.cell / r.rows) === col).map((f) => f.cell % r.rows).sort((a, b) => a - b);
      const removedInCol = st.removed.filter((i) => Math.floor(i / r.rows) === col).length;
      expect(rows).toEqual(Array.from({ length: removedInCol }, (_, i) => i));
    }
  }
  expect(r.marksAfter).toEqual(marks);
  // R8/R9 suns & total
  const nS = suns.length;
  const sunPay = r.mode === 'base' && nS === 3 ? cfg.sunPayX * r.stakeOre : 0;
  expect(r.sunPayOre).toBe(sunPay);
  if (r.mode === 'base') {
    expect(r.triggers.stormB).toBe(nS >= 4);
    expect(r.chargeGained).toBe(charge + (nS === 3 ? cfg.sunCharge : 0));
  } else {
    expect(r.chargeGained).toBe(0);
    expect(r.triggers.stormB).toBe(false);
    expect(r.anticipation).toBeNull();
  }
  const total = raw + sunPay;
  if (!stormLike) {
    const capOre = cfg.maxWinX * r.stakeOre;
    expect(r.totalOre).toBe(Math.min(total, capOre));
    expect(r.capped).toBe(total > capOre);
    expect(r.clusterWinOre).toBe(r.totalOre - r.sunPayOre);
  }
  // R10 anticipation
  if (r.mode === 'base') {
    let want: number | null = null;
    for (let k = 1; k < r.cols; k++) {
      if (suns.filter((s) => Math.floor(s / r.rows) < k).length === 3) { want = k; break; }
    }
    expect(r.anticipation).toEqual(want === null ? null : { fromCol: want });
  }
  return total;
}

describe('engine referee (R2–R10) on real spins', () => {
  it('2 000 base spins + 500 perk spins pass every rule check', () => {
    let wins = 0, cascades = 0, antic = 0, sun3 = 0, stormB = 0, perkMultWins = 0;
    for (let i = 0; i < 2000; i++) {
      const r = spinBase(spinRng(0xc0ffee, 'base', i), 200);
      expect(r.mode).toBe('base');
      expect(r.perk).toBe(false);
      expect(r.marksBefore.every((m) => m === 0)).toBe(true);
      referee(r, CONFIG);
      if (r.totalOre > 0) wins++;
      if (r.steps.length > 2) cascades++;
      if (r.anticipation) antic++;
    }
    for (let i = 0; i < 500; i++) {
      const r = spinBase(spinRng(0xc0ffee, 'perk', i), 340, { perk: true });
      expect(r.perk).toBe(true);
      expect(r.marksBefore.filter((m) => m === 2).length).toBe(4);
      expect(r.marksBefore.filter((m) => m !== 0 && m !== 2).length).toBe(0);
      referee(r, CONFIG);
      if (r.steps[0].clusters.some((c) => c.mult > 1)) perkMultWins++;
    }
    // rare-event coverage via a targeted scan (suns)
    for (let i = 0; i < 40000 && (sun3 < 5 || stormB < 2); i++) {
      const r = spinBase(spinRng(0x5a5a, 'base', i), 100);
      if (r.sunCells.length === 3) { sun3++; referee(r, CONFIG); }
      if (r.sunCells.length >= 4) { stormB++; referee(r, CONFIG); }
    }
    expect(wins).toBeGreaterThan(700);
    expect(cascades).toBeGreaterThan(100);
    expect(perkMultWins).toBeGreaterThan(10);
    expect(sun3).toBeGreaterThanOrEqual(5);
    expect(stormB).toBeGreaterThanOrEqual(2);
    void antic;
  });
});

describe('mark reading A, wild double upgrade, charge (R5, R9)', () => {
  it('markUp ladder and caps', () => {
    const seq: number[] = [];
    let m = 0;
    for (let i = 0; i < 9; i++) { m = markUp(m, 1, 32); seq.push(m); }
    expect(seq).toEqual([1, 2, 4, 8, 16, 32, 32, 32, 32]);
    expect(markUp(0, 2, 32)).toBe(2);
    expect(markUp(1, 2, 32)).toBe(4);
    expect(markUp(16, 2, 32)).toBe(32);
    expect(markUp(64, 2, 128)).toBe(128);
  });

  it('cluster win rounding is round-half-up on exact integers', () => {
    expect(clusterWinOre(4000, 1, 50)).toBe(20);      // 0.4× of 0,50 kr
    expect(clusterWinOre(2781, 1, 50)).toBe(14);      // 13.905 → 14
    expect(clusterWinOre(1000, 1, 5)).toBe(1);        // 0.5 → 1 (half up)
    expect(clusterWinOre(3000, 3, 200)).toBe(180);
  });
});

/** Reads the engine grid of a spin as symbols; used to hunt specific situations deterministically. */
function findSpin(pred: (r: SpinResult) => boolean, domain: 'base' | 'perk' = 'base', perk = false, limit = 200000): SpinResult {
  for (let i = 0; i < limit; i++) {
    const r = spinBase(spinRng(0xabcdef, domain, i), 100, { perk });
    if (pred(r)) return r;
  }
  throw new Error('situation not found');
}

describe('rule cases found in the real engine stream', () => {
  it('reading A: a cell that wins twice pays x2 only from its SECOND win on (frost first)', () => {
    const r = findSpin((x) => x.steps.length >= 3 && x.steps[1].clusters.some((c) => c.cells.some((cell) => x.steps[0].removed.includes(cell))));
    const s0 = r.steps[0], s1 = r.steps[1];
    // step 0: all mults are 1 (no marks before)
    expect(s0.clusters.every((c) => c.mult === 1)).toBe(true);
    // after step 0 the removed cells are frost (1) — not yet a multiplier
    for (const ch of s0.markChanges) expect(ch.from).toBe(0);
    for (const ch of s0.markChanges) expect(ch.to === 1 || ch.to === 2).toBe(true); // 2 only for a winning wild
    // step 1 multiplier = Σ marks ≥ 2 before step 1 (wild double-upgrades are the only x2 after one win)
    const after0 = new Map(s0.markChanges.map((c) => [c.cell, c.to]));
    for (const cl of s1.clusters) {
      const sum = cl.cells.reduce((a, c) => a + ((after0.get(c) ?? 0) >= 2 ? after0.get(c)! : 0), 0);
      expect(cl.mult).toBe(Math.max(1, sum));
    }
  });

  it('a WILD in a win goes up two levels, other cells one', () => {
    const r = findSpin((x) => x.steps[0].clusters.some((c) => c.cells.some((cell) => x.steps[0].grid[cell] === SYM.WILD)));
    const s0 = r.steps[0];
    for (const ch of s0.markChanges) expect(ch.to).toBe(s0.grid[ch.cell] === SYM.WILD ? 2 : 1);
  });

  it('a WILD shared by two clusters is counted in both (mult and cells) and charges once', () => {
    const r = findSpin((x) => x.steps.some((st) => st.clusters.length >= 2 && st.clusters.some((a, i) => st.clusters.some((b, j) => j > i && a.cells.some((c) => b.cells.includes(c))))), 'perk', true);
    const st = r.steps.find((s) => s.clusters.length >= 2)!;
    const shared = st.clusters[0].cells.filter((c) => st.clusters.slice(1).some((b) => b.cells.includes(c)));
    const all = st.clusters.flatMap((c) => c.cells);
    expect(new Set(st.removed).size).toBe(st.removed.length);
    expect(st.removed.length).toBeLessThan(all.length); // union, not multiset
    for (const c of shared.length ? shared : [all.find((c, i) => all.indexOf(c) !== i)!]) expect(st.grid[c]).toBe(SYM.WILD);
  });

  it('suns stay in the grid through the cascade and fall with gravity', () => {
    const r = findSpin((x) => x.sunCells.length > 0 && x.steps.length >= 3 && x.steps[0].moves.some((m) => x.steps[0].grid[m.from] === SYM.SUN));
    const mv = r.steps[0].moves.find((m) => r.steps[0].grid[m.from] === SYM.SUN)!;
    expect(r.steps[1].grid[mv.to]).toBe(SYM.SUN);
    expect(r.steps[0].removed.includes(mv.from)).toBe(false);
  });

  it('exactly 3 suns pay 3× + 150 charge; 4+ suns trigger route B only', () => {
    const r3 = findSpin((x) => x.sunCells.length === 3);
    expect(r3.sunPayOre).toBe(CONFIG.sunPayX * 100);
    expect(r3.chargeGained).toBe(r3.steps.reduce((a, s) => a + s.charge, 0) + CONFIG.sunCharge);
    expect(r3.triggers.stormB).toBe(false);
    const r4 = findSpin((x) => x.sunCells.length >= 4);
    expect(r4.sunPayOre).toBe(0);
    expect(r4.chargeGained).toBe(r4.steps.reduce((a, s) => a + s.charge, 0));
    expect(r4.triggers.stormB).toBe(true);
  });

  it('anticipation = first k < cols with exactly 3 suns in columns < k', () => {
    const r = findSpin((x) => x.anticipation !== null);
    const k = r.anticipation!.fromCol;
    const inFirst = (kk: number) => r.sunCells.filter((s) => Math.floor(s / r.rows) < kk).length;
    expect(inFirst(k)).toBe(3);
    expect(inFirst(k - 1)).toBeLessThan(3);
    expect(k).toBeLessThan(r.cols);
    // 3 suns with the last one in the last column → no column remains → no anticipation
    const late = findSpin((x) => x.sunCells.length === 3 && x.sunCells.some((s) => Math.floor(s / x.rows) === x.cols - 1) && x.sunCells.filter((s) => Math.floor(s / x.rows) < x.cols - 1).length === 2);
    expect(late.anticipation).toBeNull();
  });
});

describe('spin total cap (R8) on a model with a tiny max win', () => {
  it('caps T at maxWinX·stake and flags it; the cascade still resolves', () => {
    const cfg: MathConfig = { ...CONFIG, maxWinX: 1 };
    const model: Model = compileModel(cfg);
    let seen = 0;
    for (let i = 0; i < 3000 && seen < 5; i++) {
      const r = spinBase(spinRng(99, 'base', i), 200, { model });
      const raw = r.steps.reduce((a, s) => a + s.stepWinOre, 0) + r.sunPayOre;
      if (raw > 200) {
        seen++;
        expect(r.capped).toBe(true);
        expect(r.totalOre).toBe(200);
        expect(r.steps[r.steps.length - 1].clusters).toEqual([]);
      } else expect(r.capped).toBe(false);
    }
    expect(seen).toBe(5);
  });
});

describe('determinism, ids and golden values', () => {
  it('same (seed, domain, idx) → identical SpinResult; spinId defaults to the rng provenance', () => {
    const a = spinBase(spinRng(0x1a2b3c4d, 'base', 42), 200);
    const b = spinBase(spinRng(0x1a2b3c4d, 'base', 42), 200);
    expect(a).toEqual(b);
    expect(a.spinId).toBe('NL-1a2b3c4d-B000042');
    expect(a.spinId).toBe(makeSpinId(0x1a2b3c4d, 'base', 42));
    expect(spinBase(spinRng(1, 'perk', 7), 200, { perk: true, spinId: 'X' }).spinId).toBe('X');
    const c = spinBase(spinRng(0x1a2b3c4d, 'base', 43), 200);
    expect(c).not.toEqual(a);
  });

  it('stake only scales the pays (outcome identical at every stake)', () => {
    for (let i = 0; i < 300; i++) {
      const a = spinBase(spinRng(5, 'base', i), 50), b = spinBase(spinRng(5, 'base', i), 10000);
      expect(b.initial).toEqual(a.initial);
      expect(b.steps.length).toBe(a.steps.length);
      expect(b.chargeGained).toBe(a.chargeGained);
      expect(b.totalOre).toBe(a.totalOre * 200); // base pays are multiples of 0.1× → exact øre at 50 øre
    }
  });

  it('golden: fixed-rule model (frozen config) — locks the rule set independently of tuning', () => {
    const frozen: MathConfig = {
      ...CONFIG,
      weights: [26, 25, 23, 22, 10, 8, 6, 2.2], stormWeights: [26, 25, 23, 22, 10, 8, 6, 3], pSun: 0.069, pSunStorm: 0.06,
      paytable: [
        [0.3, 0.4, 0.5, 0.7, 1, 1.5, 3, 8], [0.3, 0.4, 0.5, 0.7, 1, 1.5, 3, 8], [0.4, 0.5, 0.6, 0.8, 1.2, 2, 4, 10],
        [0.4, 0.5, 0.7, 1, 1.5, 2.5, 5, 12], [0.6, 0.8, 1, 1.5, 2.5, 4, 10, 40], [0.8, 1, 1.5, 2, 3, 6, 15, 80], [1.5, 2, 3, 5, 8, 15, 40, 200],
      ],
      payScale: 2, stormPayScale: 1, K: 12000, modelHash: 'frozen',
    };
    const model = compileModel(frozen);
    const results = [];
    let sum = 0;
    for (let i = 0; i < 200; i++) {
      const r = spinBase(spinRng(0x60d, 'base', i), 200, { model });
      sum += r.totalOre;
      results.push(r);
    }
    const perk = spinBase(spinRng(0x60d, 'perk', 1), 300, { model, perk: true });
    expect({ sum, hash: hashOf(results).slice(0, 16), perk: hashOf(perk).slice(0, 16) }).toEqual(GOLDEN_FROZEN);
  });

  it('golden: shipped CONFIG (update when modelHash changes)', () => {
    const r = spinBase(spinRng(0xdecade, 'base', 1234), 200);
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += spinBase(spinRng(0xdecade, 'base', i), 200).totalOre;
    expect({ modelHash: CONFIG.modelHash.slice(0, 16), spin: hashOf(r).slice(0, 16), sum1000: sum }).toEqual(GOLDEN_SHIPPED);
  });
});

const GOLDEN_FROZEN = { sum: 33000, hash: '05e8c85946849919', perk: 'bb483987d071bcee' };
const GOLDEN_SHIPPED = { modelHash: 'a346b7d2622ae003', spin: '34a98ac648b09b9e', sum1000: 170140 };
