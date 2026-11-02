import { describe, expect, it } from 'vitest';
import { engine } from './setup/engine';

const state = (t: number, h = 0, a = 0, pi = 0) => ({ t, end: 93, h, a, pi, excite: [0, 0] as [number, number], red: [0, 0] as [number, number], zone: 4, goals: [] as { t: number; team: 0 | 1 }[] });

describe('Monte Carlo (bundled engine)', () => {
  it('MC 1X2 shares agree with the DP pricer at several states', async () => {
    const E = await engine();
    const p = E.DERBY_PARAMS;
    const diffs: number[] = [];
    for (const [t, h, a, pi] of [[0, 0, 0, 0], [27, 0, 0, 0.4], [55, 0, 1, -0.2], [70, 1, 1, 0], [85, 2, 1, 0.3]] as const) {
      const s = state(t, h, a, pi);
      const dp = E.price1x2(p, { t, end: 93, d: h - a, pi, excite: [0, 0], red: [0, 0], zone: 4 });
      const r = await E.runMc({ id: 1, seed: 7, params: p, state: s, n: 5000, probs: dp as [number, number, number], focus: 0, askNow: dp[0] * 100 });
      for (let i = 0; i < 3; i++) diffs.push(Math.abs(r.mcShares[i] - dp[i]));
    }
    const mean = diffs.reduce((x, y) => x + y, 0) / diffs.length;
    console.log('mean |MC-DP|', mean.toFixed(4), 'max', Math.max(...diffs).toFixed(4));
    expect(mean).toBeLessThan(0.012);
    expect(Math.max(...diffs)).toBeLessThan(0.03);
  });

  it('100 strands: tally equals the displayed price, start at the ask, end at 0 or 100', async () => {
    const E = await engine();
    const probs: [number, number, number] = [0.52, 0.27, 0.21];
    const r = await E.runMc({ id: 1, seed: 7, params: E.DERBY_PARAMS, state: state(27), n: 5000, probs, focus: 0, askNow: 53.4 });
    expect(r.strands).toHaveLength(100);
    expect(r.counts).toEqual(E.largestRemainder(probs, 100));
    for (const s of r.strands) {
      expect(Math.abs(s.v[0] - 53.4)).toBeLessThan(1e-3);
      const end = s.v[s.v.length - 1];
      expect(end === 100 || end === 0).toBe(true);
      expect(end === 100).toBe(s.outcome === 0);
    }
  });

  it('is stable: one game minute later without events, at most 5 of 100 strands change', async () => {
    const E = await engine();
    const run = async (t: number) => {
      const dp = E.price1x2(E.DERBY_PARAMS, { t, end: 93, d: 0, pi: 0, excite: [0, 0], red: [0, 0], zone: 4 }) as [number, number, number];
      const r = await E.runMc({ id: 1, seed: 7, params: E.DERBY_PARAMS, state: state(t), n: 5000, probs: dp, focus: 0, askNow: dp[0] * 100 });
      return new Set(r.strands.map((s) => s.id));
    };
    const a = await run(30);
    const b = await run(31);
    let changed = 0;
    b.forEach((id) => {
      if (!a.has(id)) changed++;
    });
    expect(changed).toBeLessThanOrEqual(5);
  });

  it('Byg: joint price from the same paths, survivors match the joint probability, correlation shows', async () => {
    const E = await engine();
    const legs = [{ kind: 'udfald' as const, o: 0 as const }, { kind: 'maal' as const, n: 3 }];
    const r = await E.runMc({ id: 1, seed: 7, params: E.DERBY_PARAMS, state: state(27), n: 5000, probs: [0.5, 0.27, 0.23], focus: 0, askNow: 51, legs });
    const b = r.byg!;
    expect(b.joint).toBeLessThanOrEqual(Math.min(...b.legP));
    const survivors = r.strands.filter((s) => s.cell === 3).length;
    expect(Math.abs(survivors - 100 * b.joint)).toBeLessThan(1);
    expect(b.cellCounts.reduce((x, y) => x + y, 0)).toBe(100);
    console.log('legP', b.legP.map((v) => v.toFixed(3)), 'joint', b.joint.toFixed(3), 'naive', (b.legP[0] * b.legP[1]).toFixed(3));
  });
});
