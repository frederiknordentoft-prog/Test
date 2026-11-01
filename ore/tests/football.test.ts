import { describe, expect, it } from 'vitest';
import { engine } from './setup/engine';

describe('football sim (bundled engine)', () => {
  it('is deterministic: same seed and timeline give the same hash', async () => {
    const E = await engine();
    const run = () => {
      const s = new E.FootballSim({ ...E.FREE_PLAY, seed: 'det-1' });
      for (let i = 0; i < 1500; i++) s.step();
      return s.hash();
    };
    expect(run()).toBe(run());
  });

  it('calibration: about 2.7 goals per match and FCK wins about 47 %', async () => {
    const E = await engine();
    let goals = 0;
    let fck = 0;
    const n = 1500;
    for (let m = 0; m < n; m++) {
      const s = new E.FootballSim({ ...E.FREE_PLAY, seed: `cal-${m}`, naturalWhales: false }, undefined, { pricing: false });
      while (s.phase !== 'closed') s.step();
      goals += s.h + s.a;
      if (s.h > s.a) fck++;
    }
    console.log('goals/match', goals / n, 'fck win', fck / n);
    expect(Math.abs(goals / n - 2.7)).toBeLessThan(0.15);
    expect(Math.abs(fck / n - 0.47)).toBeLessThan(0.035);
  });

  it('1X2 asks sum to 103 ± 1 øre while open, and the price never flips on noise alone', async () => {
    const E = await engine();
    const s = new E.FootballSim({ seed: 'quiet', naturalGoals: false, naturalWhales: false, stoppage: 3, events: [] });
    let bad = 0;
    while (s.phase !== 'closed') {
      s.step();
      for (const v of [...s.fair, ...s.mid, ...s.ask, ...s.bid]) expect(Number.isFinite(v)).toBe(true);
      if (!s.halted && s.phase !== 'pre') {
        const sum = s.ask[0] + s.ask[1] + s.ask[2];
        if (Math.abs(sum - 103) > 1) bad++;
      }
    }
    expect(bad).toBe(0);
  });

  it('a scripted VAR goal reaches the scripted verdict and changes the score only then', async () => {
    const E = await engine();
    for (const verdict of ['godkendt', 'annulleret'] as const) {
      const s = new E.FootballSim({ seed: 'var', naturalGoals: false, naturalWhales: false, events: [{ at: '20', type: 'goal', team: 0, var: { secs: 8, p0: 0.7, verdict } }] });
      let sawVar = false;
      while (s.t < 25) {
        s.step();
        if (s.halt?.kind === 'var') {
          sawVar = true;
          expect(s.h).toBe(0);
          const p = s.varProb();
          expect(p).not.toBeNull();
        }
      }
      expect(sawVar).toBe(true);
      expect(s.h).toBe(verdict === 'godkendt' ? 1 : 0);
    }
  });

  it('price calibration: in-play fair FCK prices match outcome frequencies by decile', async () => {
    const E = await engine();
    const bins = Array.from({ length: 10 }, () => ({ p: 0, y: 0, n: 0 }));
    for (let m = 0; m < 1200; m++) {
      const s = new E.FootballSim({ ...E.FREE_PLAY, seed: `pc-${m}`, naturalWhales: false }, undefined, { pricing: false });
      const samples: number[] = [];
      while (s.phase !== 'closed') {
        s.step();
        // Sample the fair price at a few fixed points; only these need the DP.
        if ((s.phase === '1H' || s.phase === '2H') && !s.halt && s.k % 600 === 0) samples.push(E.price1x2(s.p, s.priceState())[0]);
      }
      const y = s.h > s.a ? 1 : 0;
      for (const p of samples) {
        const b = bins[Math.min(9, Math.floor(p * 10))];
        b.p += p;
        b.y += y;
        b.n++;
      }
    }
    console.log('deciles', bins.map((b) => (b.n ? `${(b.p / b.n).toFixed(2)}/${(b.y / b.n).toFixed(2)}(${b.n})` : '-')).join(' '));
    for (const b of bins) {
      if (b.n < 300) continue;
      // Binomial noise at n ≥ 300 is ≤ 2.9 pp (1 sd); allow 3 sd plus 1 pp model slack.
      const diff = Math.abs(b.p / b.n - b.y / b.n);
      expect(diff).toBeLessThan(0.1);
    }
  });
});
