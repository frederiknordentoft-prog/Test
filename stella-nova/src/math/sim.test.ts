import { describe, expect, it } from 'vitest';
import { LOW_SYMBOLS } from '../core/config.ts';
import { Rng } from '../core/rng.ts';
import type { SimProgress } from '../core/types.ts';
import { createKernel } from './kernel.ts';
import { compileModel, MODEL, PARAMS, validateParams } from './model.ts';
import { createSimulator, finalize, mergeTotals, simulate, simulateTotals } from './sim.ts';

describe('model', () => {
  it('has a monotone paytable in 0.1 steps and a rising ladder from x1', () => {
    expect(() => validateParams(PARAMS)).not.toThrow();
    for (let i = 0; i < 8; i++) {
      expect(Number.isInteger(PARAMS.pay3[i]) && Number.isInteger(PARAMS.pay4[i])).toBe(true);
      expect(PARAMS.pay4[i]).toBeGreaterThan(PARAMS.pay3[i]);
      if (i > 0) expect(PARAMS.pay3[i] >= PARAMS.pay3[i - 1] && PARAMS.pay4[i] >= PARAMS.pay4[i - 1]).toBe(true);
    }
    for (const id of LOW_SYMBOLS) expect(PARAMS.pay3[id]).toBeGreaterThanOrEqual(2);
    expect(MODEL.ladder[0]).toBe(1);
    expect(MODEL.ladder.every((m, i) => i === 0 || m > MODEL.ladder[i - 1])).toBe(true);
    expect(MODEL.paytable.map((p) => p.pay3)).toEqual(PARAMS.pay3.map((p) => p / 10));
    expect(MODEL).toMatchObject({ maxWinMultiple: 5000, freeSpinsAward: { 3: 8, 4: 12 }, retriggerAward: { 2: 2, 3: 5 } });
  });

  it('carries measured figures inside the GDD targets', () => {
    const s = MODEL.stats;
    expect(s.sampleSize).toBeGreaterThanOrEqual(50_000_000);
    expect(Math.abs(s.rtp - 0.96)).toBeLessThanOrEqual(0.0015);
    expect(s.hitFrequency).toBeGreaterThanOrEqual(0.38);
    expect(s.hitFrequency).toBeLessThanOrEqual(0.52);
    expect(s.freeSpinsEvery).toBeGreaterThanOrEqual(120);
    expect(s.freeSpinsEvery).toBeLessThanOrEqual(200);
    expect(s.novaEvery).toBeGreaterThanOrEqual(50);
    expect(s.novaEvery).toBeLessThanOrEqual(90);
    expect(s.breakdown.freeSpins / s.rtp).toBeGreaterThanOrEqual(0.2);
    expect(s.breakdown.freeSpins / s.rtp).toBeLessThanOrEqual(0.3);
    expect(s.stdDev).toBeGreaterThanOrEqual(5);
    expect(s.stdDev).toBeLessThanOrEqual(10);
    expect(s.breakdown.base + s.breakdown.nudge + s.breakdown.nova + s.breakdown.freeSpins).toBeCloseTo(s.rtp, 4);
    expect(s.rtpNoNudge).toBeGreaterThan(0);
    expect(s.rtpNoNudge).toBeLessThan(s.rtp);
  });
});

describe('simulator', () => {
  it('draws the same stream as core/rng', () => {
    for (const seed of [0, 1, 0xdeadbeef]) {
      const kernel = createKernel(compileModel());
      kernel.seed(seed);
      expect(Array.from(kernel.rng, (x) => x >>> 0)).toEqual(new Rng(seed).state());
    }
  });

  it('is deterministic, and merged runs add up', () => {
    const a = simulateTotals({ spins: 20000, seed: 5, policy: 'greedy' });
    const b = simulateTotals({ spins: 20000, seed: 5, policy: 'greedy' });
    expect({ ...a, elapsedMs: 0 }).toEqual({ ...b, elapsedMs: 0 });
    const c = simulateTotals({ spins: 10000, seed: 6, policy: 'greedy' });
    const merged = finalize(mergeTotals([a, c]));
    expect(merged.spins).toBe(30000);
    expect(merged.totalWin).toBe(finalize(a).totalWin + finalize(c).totalWin);
    expect(merged.seeds).toEqual([5, 6]);
    expect(() => mergeTotals([a, simulateTotals({ spins: 10, seed: 1, policy: 'none' })])).toThrow();
  });

  it('agrees with the published figures on a fresh sample', () => {
    const r = simulate({ spins: 400_000, seed: 314159, policy: 'greedy' });
    const s = MODEL.stats;
    expect(Math.abs(r.rtp - s.rtp)).toBeLessThan(4 * r.standardError);
    expect(Math.abs(r.hitFrequency - s.hitFrequency)).toBeLessThan(0.005);
    expect(Math.abs(r.freeSpins.every - s.freeSpinsEvery)).toBeLessThan(15);
    expect(Math.abs(r.nova.everyAll - s.novaEvery)).toBeLessThan(5);
    expect(r.breakdown.base + r.breakdown.nudge + r.breakdown.nova + r.breakdown.freeSpins).toBeCloseTo(r.rtp, 9);
    expect(r.buckets.reduce((sum, b) => sum + b.count, 0)).toBe(r.spins);
    expect(r.maxMultiple).toBeLessThanOrEqual(5000 * 40);
    const passive = simulate({ spins: 200_000, seed: 314159, policy: 'none' });
    expect(passive.breakdown.nudge).toBe(0);
    expect(passive.rtp).toBeLessThan(r.rtp);
  });

  it('runs in slices in the browser and reports the end', async () => {
    const last = await new Promise<SimProgress>((resolve) => {
      createSimulator({ seed: 8 })(30000, (p) => {
        if (p.done) resolve(p);
      });
    });
    expect(last).toMatchObject({ spins: 30000, target: 30000, done: true });
    expect(last.rtp).toBeCloseTo(simulate({ spins: 30000, seed: 8, policy: 'greedy' }).rtp, 12);
  });
});
