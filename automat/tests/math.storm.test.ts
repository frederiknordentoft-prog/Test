// R13 Solstorm: start marks, persistent plasma marks, Stormbølge, retrigger, no charge, cap, guarantee,
// one rng stream per storm (replay/resume exactly like Game.ts), fast path == API path, golden storm.
import { describe, it, expect } from 'vitest';
import { createStorm, stormSpin, finishStorm, playStorm, stormDone, waveBefore, simStorm, STORM_OUT, type StormState } from '../src/math/storm.ts';
import { compileModel, markUp, PAY_UNIT } from '../src/math/engine.ts';
import { spinRng, Xoshiro128ss } from '../src/math/rng.ts';
import { CONFIG, type MathConfig } from '../src/math/config.ts';
import { bucketOf } from '../src/math/grid.ts';
import { hashOf } from '../src/math/hash.ts';
import { SYM, type SpinResult, type StormSpinMeta } from '../src/math/types.ts';

/** Plays a storm the way Game.runStorm does: spinRng(seed, 'storm', 100000 + idx), one stream. */
function gameStorm(seed: number, idx: number, stake: number, cfgModel = compileModel(CONFIG)) {
  const rng = spinRng(seed, 'storm', 100000 + idx);
  const st = createStorm(rng, stake, cfgModel);
  const spins: { result: SpinResult; meta: StormSpinMeta }[] = [];
  while (st.spinIndex < st.spinsTotal) spins.push(stormSpin(st, rng, `S${idx}-${st.spinIndex}`, cfgModel));
  return { st, spins, sum: finishStorm(st, cfgModel) };
}

/** Compact storm referee: pays from marks-before, upgrades, cascade replay, no charge, no sun pay. */
function refereeStormSpin(r: SpinResult, cfg: MathConfig): void {
  expect(r.mode).toBe('storm');
  expect(r.cols * r.rows).toBe(64);
  let marks = r.marksBefore.slice();
  for (let k = 0; k < r.steps.length - 1; k++) {
    const s = r.steps[k];
    let win = 0;
    for (const cl of s.clusters) {
      const sum = cl.cells.reduce((a, c) => a + (marks[c] >= 2 ? marks[c] : 0), 0);
      expect(cl.mult).toBe(Math.max(1, sum));
      const unit = Math.round(cfg.paytable[cl.sym][bucketOf(cl.size)] * cfg.stormPayScale * PAY_UNIT);
      expect(cl.winOre).toBe(Math.floor((unit * cl.mult * r.stakeOre + 5000) / 10000));
      win += cl.winOre;
    }
    expect(s.stepWinOre).toBe(win);
    expect(s.charge).toBe(0);
    const next = marks.slice();
    for (const i of s.removed) next[i] = markUp(marks[i], s.grid[i] === SYM.WILD ? 2 : 1, cfg.stormMarkCap);
    marks = next;
    const after = s.grid.slice() as number[];
    for (const i of s.removed) after[i] = -1;
    const g = after.slice();
    for (const m of s.moves) if (!s.moves.some((o) => o.to === m.from)) after[m.from] = -1;
    for (const m of s.moves) after[m.to] = g[m.from];
    for (const f of s.refill) { expect(f.sym).not.toBe(SYM.SUN); after[f.cell] = f.sym; }
    expect(after).toEqual(r.steps[k + 1].grid);
  }
  expect(r.steps[r.steps.length - 1].clusters).toEqual([]);
  expect(r.marksAfter).toEqual(marks);
  expect(r.sunPayOre).toBe(0);
  expect(r.chargeGained).toBe(0);
  expect(r.triggers.stormB).toBe(false);
  expect(r.anticipation).toBeNull();
  const raw = r.steps.reduce((a, s) => a + s.stepWinOre, 0);
  if (r.capped) expect(r.totalOre).toBeLessThan(raw);
  else expect(r.totalOre).toBe(raw);
  expect(r.clusterWinOre).toBe(r.totalOre);
}

describe('Solstorm rules (R13)', () => {
  it('createStorm: 8×8, 6 distinct x2 start marks, 10 spins', () => {
    for (let i = 0; i < 50; i++) {
      const st = createStorm(spinRng(9, 'storm', i), 300);
      expect(st.marks.length).toBe(64);
      expect(st.marks.filter((m) => m === 2).length).toBe(CONFIG.stormStartMarks);
      expect(st.marks.filter((m) => m !== 0 && m !== 2).length).toBe(0);
      expect(st).toMatchObject({ stakeOre: 300, spinsTotal: 10, spinIndex: 0, winOre: 0, maxMark: 2, capped: false });
    }
  });

  it('Stormbølge before storm spin index 3, 7, 11, 15, 19 only', () => {
    expect([...Array(20).keys()].filter(waveBefore)).toEqual([3, 7, 11, 15, 19]);
  });

  it('60 full storms: marks persist, waves double only marks ≥ 2 (cap 128), retriggers +3 (≤ 20), no charge', () => {
    let waves = 0, retriggers = 0;
    for (let i = 0; i < 60; i++) {
      const { st, spins, sum } = gameStorm(0x5701, i, 200);
      let prevAfter: number[] | null = null;
      let total = 0, expectTotal = 10;
      spins.forEach(({ result, meta }, k) => {
        expect(meta.index).toBe(k);
        refereeStormSpin(result, CONFIG);
        const start = prevAfter ?? null;
        if (meta.wave) {
          waves++;
          expect(waveBefore(k)).toBe(true);
          if (start) expect(meta.wave.before).toEqual(start);
          expect(meta.wave.after).toEqual(meta.wave.before.map((m) => (m >= 2 ? Math.min(128, m * 2) : m)));
          expect(result.marksBefore).toEqual(meta.wave.after);
        } else {
          expect(waveBefore(k)).toBe(false);
          if (start) expect(result.marksBefore).toEqual(start);
        }
        if (result.sunCells.length >= 3) {
          const add = Math.min(3, 20 - expectTotal);
          expect(result.triggers.retriggerSpins).toBe(add);
          expectTotal += add;
          if (add > 0) retriggers++;
        } else expect(result.triggers.retriggerSpins).toBe(0);
        expect(meta.total).toBe(expectTotal);
        prevAfter = result.marksAfter;
        total += result.totalOre;
      });
      expect(spins.length).toBe(st.capped ? spins.length : expectTotal);
      expect(st.winOre).toBe(total);
      expect(sum.winOre).toBe(total);
      expect(sum.spins).toBe(spins.length);
      expect(sum.maxMark).toBe(Math.max(2, ...spins.map((s) => Math.max(...s.result.marksAfter))));
      expect(sum.guaranteeOre).toBe(Math.max(0, CONFIG.guaranteeX * 200 - total));
      expect(stormDone(st)).toBe(true);
      expect(() => stormSpin(st, spinRng(1, 'storm', 1), 'x')).toThrow();
    }
    expect(waves).toBeGreaterThanOrEqual(120);
    void retriggers;
  });

  it('finds a retrigger and a max-length storm cap of 20 spins in the real stream', () => {
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const { spins } = gameStorm(0xa11, i, 100);
      if (spins.some((s) => s.result.triggers.retriggerSpins > 0)) {
        found = true;
        expect(spins.length).toBeGreaterThan(10);
        expect(spins.length).toBeLessThanOrEqual(20);
      }
    }
    expect(found).toBe(true);
  });

  it('guarantee: winOre + guaranteeOre ≥ 30× stake, shown separately', () => {
    const st: StormState = { stakeOre: 200, spinsTotal: 10, spinIndex: 10, marks: new Array(64).fill(0), winOre: 1234, maxMark: 2, capped: false };
    expect(finishStorm(st)).toEqual({ stakeOre: 200, spins: 10, winOre: 1234, guaranteeOre: 6000 - 1234, maxMark: 2, capped: false });
    st.winOre = 7000;
    expect(finishStorm(st).guaranteeOre).toBe(0);
  });

  it('max-win cap over the whole storm ends the storm (tiny cap model)', () => {
    const model = compileModel({ ...CONFIG, maxWinX: 20 });
    let seen = 0;
    for (let i = 0; i < 200 && seen < 3; i++) {
      const rng = spinRng(77, 'storm', i);
      const st = createStorm(rng, 100, model);
      while (!stormDone(st)) stormSpin(st, rng, 'c', model);
      if (st.capped) {
        seen++;
        expect(st.winOre).toBe(2000);
        expect(st.spinsTotal).toBe(st.spinIndex);
        expect(finishStorm(st, model)).toMatchObject({ winOre: 2000, guaranteeOre: 0, capped: true });
      } else {
        expect(st.winOre).toBeLessThan(2000);
        // guarantee floor is clamped to the max win: min(30, 20)·stake
        expect(finishStorm(st, model).guaranteeOre).toBe(Math.max(0, 2000 - st.winOre));
      }
    }
    expect(seen).toBe(3);
  });
});

describe('storm determinism, replay and the simulator fast path', () => {
  it('replaying the same (seed, idx) reproduces the storm bit for bit (one rng stream)', () => {
    const a = gameStorm(0xfeed, 3, 500), b = gameStorm(0xfeed, 3, 500);
    expect(a.spins).toEqual(b.spins);
    expect(a.sum).toEqual(b.sum);
    const c = gameStorm(0xfeed, 4, 500);
    expect(c.spins[0].result.initial).not.toEqual(a.spins[0].result.initial);
  });

  it('resume like Game.runStorm: silently replay k spins, continue → identical tail', () => {
    const full = gameStorm(0xbeef, 11, 200);
    for (const k of [0, 1, 4, 9]) {
      const rng = spinRng(0xbeef, 'storm', 100000 + 11);
      const st = createStorm(rng, 200);
      for (let i = 0; i < k; i++) stormSpin(st, rng, `S11-${i}`);
      const tail: { result: SpinResult; meta: StormSpinMeta }[] = [];
      while (st.spinIndex < st.spinsTotal) tail.push(stormSpin(st, rng, `S11-${st.spinIndex}`));
      expect(tail).toEqual(full.spins.slice(k));
      expect(finishStorm(st)).toEqual(full.sum);
    }
  });

  it('playStorm helper = the game pattern', () => {
    const g = gameStorm(0x1234, 0, 200);
    const p = playStorm(0x1234, 'storm', 100000, 200, { spinId: (k) => `S0-${k}` });
    expect(p.spins).toEqual(g.spins);
    expect(p.summary).toEqual(g.sum);
  });

  it('simStorm (simulator fast path) gives exactly the API totals', () => {
    const model = compileModel(CONFIG);
    const rng = new Xoshiro128ss();
    for (let i = 0; i < 150; i++) {
      const g = gameStorm(0x51, i, 200, model);
      rng.seedSpin(0x51, 'storm', 100000 + i);
      simStorm(model, rng, 200);
      expect({ win: STORM_OUT.winOre, spins: STORM_OUT.spins, maxMark: STORM_OUT.maxMark, capped: STORM_OUT.capped }).toEqual({ win: g.sum.winOre, spins: g.sum.spins, maxMark: g.sum.maxMark, capped: g.sum.capped });
    }
  });

  it('golden: a full storm (shipped CONFIG; update when modelHash changes)', () => {
    const g = gameStorm(0xc0de, 1, 200);
    expect({ modelHash: CONFIG.modelHash.slice(0, 16), spins: g.spins.length, winOre: g.sum.winOre, guaranteeOre: g.sum.guaranteeOre, maxMark: g.sum.maxMark, hash: hashOf(g.spins).slice(0, 16) }).toEqual(GOLDEN_STORM);
  });
});

const GOLDEN_STORM = { modelHash: 'a346b7d2622ae003', spins: 10, winOre: 105324, guaranteeOre: 0, maxMark: 128, hash: 'fe76ecc86ffe704c' };
