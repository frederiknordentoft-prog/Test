import { describe, expect, it } from 'vitest';
import { engine } from './setup/engine';

/**
 * Total goals and final scores: one score grid gives 1X2, Over/Under and every cell; the backward
 * totals pass and the Monte Carlo agree with it; Over 2.5 is calibrated in play; adding the Over
 * 2.5 quote left the 1X2 simulation bit for bit unchanged.
 */
const STATES = [
  { t: 0, end: 93, d: 0, pi: 0, excite: [0, 0] as [number, number], red: [0, 0] as [number, number], zone: 4, h: 0, a: 0 },
  { t: 30, end: 93, d: 1, pi: 0.3, excite: [0.4, 0.4] as [number, number], red: [0, 0] as [number, number], zone: 5, h: 1, a: 0 },
  { t: 55, end: 93, d: -1, pi: -0.4, excite: [0, 0] as [number, number], red: [0, 1] as [number, number], zone: 2, h: 0, a: 1 },
  { t: 80, end: 93, d: 0, pi: 0.1, excite: [0, 0] as [number, number], red: [0, 0] as [number, number], zone: 4, h: 1, a: 1 },
];

describe('totals and final scores', () => {
  it('the score grid sums to 1, its 1X2 equals price1x2 and its Over equals totalsBack', async () => {
    const E = await engine();
    const p = E.DERBY_PARAMS;
    for (const st of STATES) {
      const grid = E.rateGrid(p, st, true);
      const sg = E.scoreGrid(p, st, st.h, st.a, grid);
      expect(sg.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 12);
      const fg = E.fromGrid(sg, st.h, st.a);
      const x12 = E.price1x2(p, st, grid);
      for (let i = 0; i < 3; i++) expect(Math.abs(fg.x12[i] - x12[i])).toBeLessThan(1e-11);
      for (const L of [0.5, 1.5, 2.5, 3.5, 4.5]) expect(Math.abs(fg.over(L) - E.totalsBack(p, st, st.h + st.a, L, grid))).toBeLessThan(1e-11);
      let cells = 0;
      for (let h = 0; h < 6; h++) for (let a = 0; a < 6; a++) cells += fg.cell(h, a);
      expect(cells).toBeCloseTo(1, 12);
    }
  });

  it('Monte Carlo "3+ goals" is within 2 points of the grid, and its strands start at the ask and end at 0 or 100', async () => {
    const E = await engine();
    const p = E.DERBY_PARAMS;
    for (const st of STATES) {
      const pOver = E.totalsBack(p, st, st.h + st.a, 2.5);
      const r = await E.runMc({ id: 1, seed: 77, params: p, state: { t: st.t, end: st.end, h: st.h, a: st.a, pi: st.pi, excite: st.excite, red: st.red, zone: st.zone, goals: [] }, n: 6000, probs: [pOver, 1 - pOver], focus: 0, askNow: 61, kind: 'o25' });
      expect(r.kind).toBe('o25');
      expect(Math.abs(r.mcShares[0] - pOver)).toBeLessThan(0.02);
      expect(r.counts[0] + r.counts[1]).toBe(100);
      for (const s of r.strands) {
        expect(s.v[0]).toBeCloseTo(61, 3);
        expect(s.v[s.v.length - 1]).toBe(s.stratum === 0 ? 100 : 0);
      }
    }
  });

  it('Over 2.5 is calibrated in play: per decile, realised within 3.5 points + 3 SE of the price', async () => {
    const E = await engine();
    const p = E.DERBY_PARAMS;
    const preds: { p: number; y: number }[] = [];
    const kick: { p: number; y: number }[] = [];
    for (let m = 0; m < 1500; m++) {
      const sim = new E.FootballSim({ ...E.FREE_PLAY, seed: `o25-${m}`, naturalWhales: false }, p, { pricing: false });
      const marks = [0, 15, 30, 45.5, 60, 75];
      const at: number[] = [];
      while (sim.phase !== 'closed') {
        sim.step();
        if (marks.length && sim.t >= marks[0] && (sim.phase === '1H' || sim.phase === '2H') && !sim.halt) {
          marks.shift();
          at.push(sim.h + sim.a > 2.5 ? 1 : E.totalsBack(p, sim.priceState(), sim.h + sim.a, 2.5));
        }
      }
      const y = sim.h + sim.a > 2.5 ? 1 : 0;
      at.forEach((q, i) => {
        if (q < 1) preds.push({ p: q, y });
        if (i === 0) kick.push({ p: q, y });
      });
    }
    preds.sort((x, y) => x.p - y.p);
    const rows: string[] = [];
    for (let dcl = 0; dcl < 10; dcl++) {
      const bin = preds.slice(Math.floor((dcl * preds.length) / 10), Math.floor(((dcl + 1) * preds.length) / 10));
      const mp = bin.reduce((s, x) => s + x.p, 0) / bin.length;
      const my = bin.reduce((s, x) => s + x.y, 0) / bin.length;
      const se = Math.sqrt(Math.max(mp * (1 - mp), 0.01) / bin.length);
      rows.push(`${(mp * 100).toFixed(1)}→${(my * 100).toFixed(1)}`);
      expect(Math.abs(my - mp)).toBeLessThan(0.035 + 3 * se);
    }
    const kp = kick.reduce((s, x) => s + x.p, 0) / kick.length;
    const ky = kick.reduce((s, x) => s + x.y, 0) / kick.length;
    // Documented: the DP ignores the excitation of goals not yet scored, so it sits a little low at kickoff.
    console.log(`o25 deciles (price→realised %): ${rows.join('  ')} · kickoff ${(kp * 100).toFixed(1)}→${(ky * 100).toFixed(1)}`);
  });

  it('golden hashes: the Over 2.5 quote did not change the 1X2 simulation', async () => {
    const E = await engine();
    const run = (tl: typeof E.FREE_PLAY, n: number) => {
      const s = new E.FootballSim(tl);
      let i = 0;
      while (s.phase !== 'closed' && i < n) {
        s.step();
        i++;
      }
      return s.hash();
    };
    // Captured from the commit before Over 2.5 was added (5d727d8).
    expect(run({ ...E.FREE_PLAY, seed: 'det-1' }, 1500)).toBe('1500|36.7750|1H|2|0|-0.107975|2|91|9|3|0.905221|0.075319|0.019461|25|353');
    expect(run({ ...E.FREE_PLAY, seed: 'golden-2' }, 1e9)).toBe('3788|93.0000|closed|1|2|0.318963|1|1|1|99|0.000000|0.000000|1.000000|51|848');
    expect(run(E.DEMO90, 1e9)).toBe('3918|93.0000|closed|2|1|0.563855|3|99|1|1|0.999902|0.000098|0.000000|57|867');
  });
});
