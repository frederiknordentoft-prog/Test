// sim:quick — the simulator kernels use exactly the engine code paths of the game; fixed-seed golden values.
import { describe, it, expect } from 'vitest';
import { OUT, compileModel, simBaseSpin, spinBase } from '../src/math/engine.ts';
import { Xoshiro128ss, spinRng } from '../src/math/rng.ts';
import { CONFIG } from '../src/math/config.ts';
import { newMeter, addCharge, lockedStakeOre } from '../src/math/meter.ts';
import { jobBase, jobStorm, MeterSim } from '../sim/core.ts';
import { pAtLeast, pExactly, meterCycles } from '../sim/tune.ts';
import { SeedPlan, disjointRanges } from '../sim/seeds.ts';

describe('simulator fast path = game API', () => {
  it('simBaseSpin gives the same totals, charge, suns and triggers as spinBase (base + perk)', () => {
    const model = compileModel(CONFIG);
    const rng = new Xoshiro128ss();
    for (const [domain, perk] of [['base', false], ['perk', true]] as const) {
      for (let i = 0; i < 3000; i++) {
        const r = spinBase(spinRng(0x7777, domain, i), 200, { perk });
        rng.seedSpin(0x7777, domain, i);
        simBaseSpin(model, rng, 200, perk);
        expect({ t: OUT.totalOre, c: OUT.charge, s: OUT.sunCount, b: OUT.stormB, a: OUT.anticipation, sun: OUT.sunPayOre, cap: OUT.capped })
          .toEqual({ t: r.totalOre, c: r.chargeGained, s: r.sunCells.length, b: r.triggers.stormB, a: r.anticipation ? r.anticipation.fromCol : -1, sun: r.sunPayOre, cap: r.capped });
      }
    }
  });

  it('MeterSim (sim) and meter.ts (game) agree on locked stake, tiers and route A', () => {
    const cfg = { ...CONFIG, K: 1000 };
    const a = newMeter(), b = new MeterSim(cfg);
    let x = 1;
    for (let i = 0; i < 5000; i++) {
      x = (Math.imul(x, 48271) + 11) >>> 0;
      const c = x % 23, stake = CONFIG.stakesOre[(x >>> 8) % CONFIG.stakesOre.length];
      const r = addCharge(a, c, stake, cfg);
      const mask = b.add(c, stake);
      expect(r.tiersCrossed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((t) => mask & (1 << t)));
      expect(b.locked()).toBe(lockedStakeOre(a, cfg));
      expect(b.charge >= cfg.K).toBe(r.stormA);
      if (r.stormA) { a.charge = 0; a.stakeSumOre = 0; b.reset(); }
    }
  });
});

describe('sim:quick golden values (fixed seed, exact)', () => {
  it('decomposition kernel, 20 000 paid spins', () => {
    const st = jobBase({ kind: 'base', cfg: CONFIG, seed: 0x51a, from: 0, count: 20000, stake: 200, perkSeed: 0x51a, perkFrom: 0 });
    const got = { sumX: Math.round(st.sumX * 200), hits: st.hits, net: st.net, ldw: st.ldw, eq: st.eq, sumC: st.sumC, sun3: st.sun3, sun4: st.sun4, perks: st.perkSpins, perkX: Math.round(st.perkSumX * 200), stormB: st.stormB, cyclesA: st.cyclesA };
    expect(got).toEqual(GOLDEN_BASE);
  });
  it('storm kernel, 300 storms', () => {
    const st = jobStorm({ kind: 'storm', cfg: CONFIG, seed: 0x51b, from: 0, count: 300, stake: 200 });
    expect({ sumW: Math.round(st.sumW * 200), sumG: Math.round(st.sumG * 200), guar: st.guarUsed, spins: st.spins, retr: st.retr, capped: st.capped }).toEqual(GOLDEN_STORMS);
  });
});

describe('tuner closed forms and seed hygiene', () => {
  it('P(k suns) closed form matches brute force over 2^6 column patterns', () => {
    const p = CONFIG.pSun;
    const brute = new Array(7).fill(0);
    for (let m = 0; m < 64; m++) {
      let k = 0, pr = 1;
      for (let c = 0; c < 6; c++) { if (m & (1 << c)) { k++; pr *= p; } else pr *= 1 - p; }
      brute[k] += pr;
    }
    expect(pExactly(p, 6, 3)).toBeCloseTo(brute[3], 14);
    expect(pAtLeast(p, 6, 4)).toBeCloseTo(brute[4] + brute[5] + brute[6], 14);
  });

  it('renewal cycles: constant charge c → cycle of ceil(K/c) − 3 paid spins (3 perk spins)', () => {
    const ch = new Uint16Array(100000).fill(5);
    const r = meterCycles(ch, 1000);
    expect(r.meanLen).toBe(200 - 3);
    expect(r.overshoot).toBe(0);
  });

  it('SeedPlan never hands out overlapping splitmix ranges', () => {
    const plan = new SeedPlan([{ seed: 1, domain: 'base', from: 0, n: 1e8 }]);
    const s = plan.alloc('x', 1, [{ domain: 'base', n: 1e8 }, { domain: 'perk', n: 1e6 }]);
    expect(s).not.toBe(1);
    for (let i = 0; i < plan.taken.length; i++) for (let k = i + 1; k < plan.taken.length; k++) expect(disjointRanges(plan.taken[i], plan.taken[k])).toBe(true);
    expect(disjointRanges({ seed: 1, domain: 'base', from: 0, n: 10 }, { seed: 1, domain: 'base', from: 5, n: 10 })).toBe(false);
    expect(disjointRanges({ seed: 1, domain: 'base', from: 0, n: 10 }, { seed: 1, domain: 'base', from: 11, n: 10 })).toBe(true);
  });
});

const GOLDEN_BASE = { sumX: 3157640, hits: 8941, net: 5721, ldw: 3017, eq: 203, sumC: 112272, sun3: 114, sun4: 8, perks: 29, perkX: 13220, stormB: 8, cyclesA: 9 };
const GOLDEN_STORMS = { sumW: 11484276, sumG: 90799, guar: 40, spins: 3084, retr: 28, capped: 0 };
