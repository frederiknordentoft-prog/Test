import { describe, expect, it } from 'vitest';
import { hashSeed } from '../src/engine/lib/rng';
import {
  chainStats,
  drift,
  FIXTURE,
  fastForwardTo,
  HALLEN20,
  HALLEN20_START_K,
  HALLEN20_WINDOW_K,
  HandballSim,
  HB_PARAMS,
  K_END,
  K_HALF,
  K_PER_MIN,
  KICKOFF,
  kOf,
  mcTriggerProb,
  mcWinProbs,
  nextAttackGoal,
  Phi,
  quotes,
  runPath,
  sigmaPerMinute,
  stateAt,
  tOf,
  triggerProb,
  triggerQuote,
  winProbs,
} from '../src/engine/handball';
import type { ChainState, HandballSnapshot } from '../src/engine/handball';

const MC_PATHS = 6000;
const seedOf = (i: number) => hashSeed(`AaH-GOG·2026·${i}`);

/** A live snapshot whose phase matches `pred`, from the fixture's natural match. */
function findSnapshot(pred: (s: HandballSnapshot) => boolean, fromK = 0): HandballSnapshot {
  const sim = new HandballSim();
  sim.stepTo(fromK);
  while (sim.k < K_END) {
    sim.step();
    const s = sim.snapshot();
    if (pred(s)) return s;
  }
  throw new Error('no such snapshot');
}

describe('handball: fixture and clock', () => {
  it('uses the fixture seed and 0.75 s substeps (80 per minute, 4 800 per match)', () => {
    expect(FIXTURE.seed).toBe(hashSeed('AaH-GOG·2026'));
    expect(K_PER_MIN).toBe(80);
    expect(K_HALF).toBe(2400);
    expect(K_END).toBe(4800);
    expect(tOf(3040)).toBe(38);
    const sim = new HandballSim();
    sim.stepTo(kOf(12.5));
    expect(sim.snapshot().t).toBeCloseTo(12.5, 9);
  });

  it('Φ is accurate', () => {
    expect(Phi(0)).toBeCloseTo(0.5, 7);
    expect(Phi(1.959963985)).toBeCloseTo(0.975, 6);
    expect(Phi(-2.326347874)).toBeCloseTo(0.01, 6);
  });
});

describe('handball: determinism', () => {
  const checkpoints = [1, 777, 2399, 2400, 3040, 3426, 4123, K_END];

  it('two independent runs with the same seed and timeline give identical snapshots and history', () => {
    const a = new HandballSim({ timeline: HALLEN20 });
    const b = new HandballSim({ seed: FIXTURE.seed, timeline: [...HALLEN20], naturalGoals: true });
    for (const k of checkpoints) {
      a.stepTo(k);
      b.stepTo(k);
      expect(JSON.stringify(a.snapshot())).toBe(JSON.stringify(b.snapshot()));
    }
    expect(Array.from(a.diffHistory())).toEqual(Array.from(b.diffHistory()));
    expect(a.allEvents()).toEqual(b.allEvents());
  });

  it('stepping one substep at a time equals stepTo, and stepping back replays from kick-off', () => {
    const one = new HandballSim();
    const jump = new HandballSim();
    for (const k of checkpoints) {
      while (one.k < k) one.step();
      jump.stepTo(k);
      expect(JSON.stringify(one.snapshot())).toBe(JSON.stringify(jump.snapshot()));
    }
    const back = new HandballSim();
    back.stepTo(K_END);
    back.stepTo(3040);
    const fresh = new HandballSim();
    fresh.stepTo(3040);
    expect(JSON.stringify(back.snapshot())).toBe(JSON.stringify(fresh.snapshot()));
  });

  it('the live sim and the fast Monte Carlo runner are the same chain (path 0)', () => {
    for (let i = 0; i < 30; i++) {
      const seed = seedOf(1000 + i);
      const sim = new HandballSim({ seed });
      sim.stepTo(K_END);
      const s = sim.snapshot();
      const r = runPath(HB_PARAMS, seed, 0, KICKOFF, K_END);
      expect([r.h, r.a]).toEqual([s.h, s.a]);
    }
  });

  it('the difference history changes only at goals and diffAt reads it', () => {
    const sim = new HandballSim();
    sim.stepTo(K_END);
    const hist = sim.diffHistory();
    expect(hist.length).toBe(K_END + 1);
    const goalKs = new Set(sim.allEvents().filter((e) => e.kind === 'goal').map((e) => e.k));
    for (let k = 1; k <= K_END; k++) {
      if (hist[k] !== hist[k - 1]) expect(goalKs.has(k)).toBe(true);
      expect(sim.diffAt(k)).toBe(hist[k]);
    }
    const s = sim.snapshot();
    expect(hist[K_END]).toBe(s.h - s.a);
    expect(s.over).toBe(true);
  });
});

describe('handball: calibration over 200 seeded matches', () => {
  it('mean total 58–64, AaH a mild favourite, 3–4 suspensions per team, ≈ 33 s attacks', () => {
    const N = 200;
    let goals = 0;
    let margin = 0;
    let wins = 0;
    let susp = 0;
    let attacks = 0;
    for (let i = 0; i < N; i++) {
      const sim = new HandballSim({ seed: seedOf(i) });
      sim.stepTo(K_END);
      const s = sim.snapshot();
      goals += s.h + s.a;
      margin += s.d;
      if (s.d > 0) wins++;
      susp += sim.allEvents().filter((e) => e.kind === 'suspension').length;
      attacks += sim.attacks().length;
    }
    const meanTotal = goals / N;
    expect(meanTotal).toBeGreaterThanOrEqual(58);
    expect(meanTotal).toBeLessThanOrEqual(64);
    expect(wins / N).toBeGreaterThanOrEqual(0.5);
    expect(wins / N).toBeLessThanOrEqual(0.65);
    expect(margin / N).toBeGreaterThan(0.5);
    expect(margin / N).toBeLessThan(3.5);
    expect(susp / N / 2).toBeGreaterThanOrEqual(3);
    expect(susp / N / 2).toBeLessThanOrEqual(4);
    const attackS = (K_END * 0.75) / (attacks / N);
    expect(attackS).toBeGreaterThan(30);
    expect(attackS).toBeLessThan(36);
  });

  it('the analytic chain statistics agree: ≈ 61 goals, AaH ≈ +2', () => {
    const st = chainStats();
    expect(st.goalsPerMatch).toBeGreaterThan(59);
    expect(st.goalsPerMatch).toBeLessThan(63);
    expect(st.marginPerMatch).toBeGreaterThan(1.5);
    expect(st.marginPerMatch).toBeLessThan(2.5);
    expect(st.suspensionsPerTeam).toBeGreaterThan(3);
    expect(st.suspensionsPerTeam).toBeLessThan(4);
  });
});

describe('handball: σ and μ', () => {
  it('analytic σ per minute matches the simulated goal-difference spread within 10 %', () => {
    const n = 2000;
    let s1 = 0;
    let s2 = 0;
    for (let p = 1; p <= n; p++) {
      const r = runPath(HB_PARAMS, FIXTURE.seed, p, KICKOFF, K_END);
      const d = r.h - r.a;
      s1 += d;
      s2 += d * d;
    }
    const mean = s1 / n;
    const simSigma = Math.sqrt((s2 / n - mean * mean) / 60);
    const sigma = sigmaPerMinute(HB_PARAMS);
    expect(sigma).toBeGreaterThan(0.55);
    expect(sigma).toBeLessThan(0.75);
    expect(Math.abs(sigma / simSigma - 1)).toBeLessThan(0.1);
    // drift: about +2 goals over a match, and a running AaH power play adds to it
    const mu = drift(HB_PARAMS, stateAt(0, 0, 0, 0));
    expect(mu * 60).toBeGreaterThan(1.5);
    expect(mu * 60).toBeLessThan(2.5);
    const pp: ChainState = { ...stateAt(kOf(38), 21, 20, 1), suspensions: [{ team: 1, untilK: kOf(40) }] };
    expect(drift(HB_PARAMS, pp, 5)).toBeGreaterThan(drift(HB_PARAMS, stateAt(kOf(38), 21, 20, 1), 5));
  });
});

describe('handball: passive play and power play', () => {
  it('next-attack goal probability falls ≈ 58 → 49 → 41 → 30 % as the passes run out', () => {
    const s = (passesLeft: number): ChainState => ({ ...stateAt(kOf(20), 10, 10, 0), phase: 'passive', passesLeft });
    const want = [0.58, 0.49, 0.41, 0.3];
    for (let i = 0; i < 4; i++) expect(Math.abs(nextAttackGoal(s(4 - i)) - want[i])).toBeLessThan(0.015);
    expect(nextAttackGoal(stateAt(kOf(20), 10, 10, 0))).toBeGreaterThan(0.58);
    expect(nextAttackGoal({ ...stateAt(kOf(20), 10, 10, 1), attackPowerplay: true })).toBeGreaterThan(
      nextAttackGoal(stateAt(kOf(20), 10, 10, 1)) + 0.12,
    );
  });

  it('the sim counts passes down 4 → 0 at 2–4 s per pass, and a suspension gives 2:00 power play', () => {
    const sim = new HandballSim();
    let seen = 0;
    let lastPasses = -1;
    let lastK = 0;
    while (sim.k < K_END && seen < 30) {
      sim.step();
      const s = sim.snapshot();
      if (s.passive.active) {
        if (lastPasses < 0) expect(s.passive.passesLeft).toBe(4);
        else if (s.passive.passesLeft !== lastPasses) {
          expect(s.passive.passesLeft).toBe(lastPasses - 1);
          const gapS = (s.k - lastK) * 0.75;
          expect(gapS).toBeGreaterThanOrEqual(2);
          expect(gapS).toBeLessThanOrEqual(4);
          seen++;
        }
        if (s.passive.passesLeft !== lastPasses) lastK = s.k;
        lastPasses = s.passive.passesLeft;
      } else lastPasses = -1;
    }
    expect(seen).toBeGreaterThan(5);

    const susp = findSnapshot((s) => s.events.some((e) => e.kind === 'suspension' && e.k === s.k));
    const ev = susp.events[susp.events.length - 1];
    expect(ev.kind).toBe('suspension');
    expect(susp.powerplay?.team).toBe(ev.team === 0 ? 1 : 0);
    expect(susp.powerplay?.untilT).toBeCloseTo(susp.t + 2, 9);
    expect(susp.possession).toBe(susp.powerplay?.team);
  });
});

describe('handball: Stern win prices vs Monte Carlo of the chain', () => {
  const cases: [string, ChainState][] = [
    ['38:00 AaH 21–20, AaH ball', stateAt(kOf(38), 21, 20, 0)],
    ['30:00 15–15, GOG throws off', stateAt(kOf(30), 15, 15, 1)],
    ['50:00 AaH 26–28, AaH ball', stateAt(kOf(50), 26, 28, 0)],
    ['passive play', findSnapshot((s) => s.phase === 'passive' && s.passesLeft === 3, kOf(5))],
  ];
  for (const [name, s] of cases) {
    it(`${name}: within ±3 pp`, () => {
      const bm = winProbs(s);
      const mc = mcWinProbs(s, MC_PATHS);
      expect(bm[0] + bm[1] + bm[2]).toBeCloseTo(1, 9);
      for (let i = 0; i < 3; i++) expect(Math.abs(bm[i] - mc[i])).toBeLessThan(0.03);
    });
  }

  it('handles τ → 0 and full time', () => {
    expect(winProbs(stateAt(K_END, 30, 29))).toEqual([1, 0, 0]);
    expect(winProbs(stateAt(K_END, 29, 29))).toEqual([0, 1, 0]);
    const late = winProbs(stateAt(K_END - 1, 30, 29, 1));
    expect(late[0]).toBeGreaterThan(0.99);
    const p = winProbs(stateAt(kOf(59.5), 30, 30, 1));
    expect(p[1]).toBeGreaterThan(0.7);
  });
});

describe('handball: trigger (first passage) vs Monte Carlo of the chain', () => {
  const cases: [string, ChainState, number, number][] = [
    ["38:00 +1 → Aalborg +4 før 45'", stateAt(kOf(38), 21, 20, 0), 4, 45],
    ["38:00 +1 → Aalborg +4 før 50'", stateAt(kOf(38), 21, 20, 0), 4, 50],
    ["38:00 +1 → føringsskifte (−1) før 50'", stateAt(kOf(38), 21, 20, 0), -1, 50],
    ["38:00 +1, GOG ball → føringsskifte før slut", stateAt(kOf(38), 21, 20, 1), -1, 60],
    ["50:00 0 → Aalborg +1 før 52'", stateAt(kOf(50), 26, 26, 0), 1, 52],
    ["45:00 −2, GOG ball → GOG +5 før slut", stateAt(kOf(45), 24, 26, 1), -5, 60],
    ["20:00 +2, GOG ball → +4 før 35' (across halftime)", stateAt(kOf(20), 12, 10, 1), 4, 35],
  ];
  for (const [name, s, level, deadline] of cases) {
    it(`${name}: within ±3 pp`, () => {
      const p = triggerProb(s, level, deadline);
      const mc = mcTriggerProb(s, level, deadline, MC_PATHS);
      expect(Math.abs(p - mc)).toBeLessThan(0.03);
    });
  }

  it('is 1 at the level, 0 after the deadline, and grows with the deadline', () => {
    const s = stateAt(kOf(38), 21, 20, 0);
    expect(triggerProb(s, 1, 45)).toBe(1);
    expect(triggerProb(s, 4, 37)).toBe(0);
    expect(triggerProb(s, 4, 50)).toBeGreaterThan(triggerProb(s, 4, 45));
    expect(triggerProb(s, 5, 45)).toBeLessThan(triggerProb(s, 4, 45));
  });
});

describe('handball: quotes in øre', () => {
  it('AaH / X / GOG asks sum to 104 ± 1 øre', () => {
    for (const s of [stateAt(0, 0, 0, 0), stateAt(kOf(38), 21, 20, 0), stateAt(kOf(30), 15, 15, 1), stateAt(kOf(50), 26, 28, 0), stateAt(kOf(55), 29, 29, 1)]) {
      const q = quotes(s);
      for (const x of q) expect(Number.isInteger(x) && x >= 0 && x <= 100).toBe(true);
      expect(Math.abs(q[0] + q[1] + q[2] - 104)).toBeLessThanOrEqual(1);
    }
  });

  it('trigger ask carries an 8 % power-method margin and settles at 100 once hit', () => {
    const s = stateAt(kOf(38), 21, 20, 0);
    const p = triggerProb(s, 4, 45);
    const ask = triggerQuote(s, 4, 45);
    expect(ask).toBeGreaterThan(Math.round(p * 100));
    expect(ask).toBeLessThan(Math.round(p * 100) + 8);
    expect(triggerQuote(s, 1, 45)).toBe(100);
    expect(triggerQuote(s, 4, 30)).toBe(0);
  });
});

describe('handball: director and HALLEN20', () => {
  it('fast-forwards deterministically to 38:00 at AaH 21–20', () => {
    const s = fastForwardTo().snapshot();
    expect(s.k).toBe(HALLEN20_START_K);
    expect([s.h, s.a, s.d]).toEqual([21, 20, 1]);
    expect(JSON.stringify(fastForwardTo().snapshot())).toBe(JSON.stringify(s));
  });

  it('Aalborg reaches +4 between 42:00 and 44:00 on a run of goals with GOG turnovers in between', () => {
    const sim = fastForwardTo();
    sim.stepTo(HALLEN20_WINDOW_K[1]);
    let hitK = -1;
    for (let k = HALLEN20_START_K; k <= sim.k; k++) {
      if (sim.diffAt(k) >= 4) {
        hitK = k;
        break;
      }
    }
    expect(hitK).toBeGreaterThanOrEqual(HALLEN20_WINDOW_K[0]);
    expect(hitK).toBeLessThan(HALLEN20_WINDOW_K[1]);
    const seg = sim.eventsSince(HALLEN20_START_K).filter((e) => e.k <= hitK);
    expect(seg.filter((e) => e.kind === 'goal' && e.team === 0).length).toBe(3);
    expect(seg.filter((e) => e.kind === 'goal' && e.team === 1).length).toBe(0);
    const aahGoals = seg.filter((e) => e.kind === 'goal').map((e) => e.k);
    const gogTurnoversBetween = seg.filter((e) => e.kind === 'turnover' && e.team === 1 && e.k > aahGoals[0] && e.k < aahGoals[2]);
    expect(gogTurnoversBetween.length).toBeGreaterThanOrEqual(1);
    // after the +4 goal the match runs naturally again
    sim.stepTo(K_END);
    expect(sim.allEvents().some((e) => e.kind === 'goal' && e.k > hitK && e.via !== 'forced')).toBe(true);
  });

  it('forced goals, bias and naturalGoals: false behave as documented', () => {
    const base = new HandballSim();
    base.stepTo(kOf(10));
    const s0 = base.snapshot();
    const other = s0.possession === 0 ? 1 : 0;
    const k = s0.k + 1;
    const sim = new HandballSim({ timeline: [{ k, type: 'goal', team: other }] });
    sim.stepTo(k);
    const ev = sim.snapshot().events.slice(-2);
    expect(ev.map((e) => e.kind)).toEqual(['turnover', 'goal']);
    expect(ev[1].team).toBe(other);
    expect(sim.snapshot().possession).toBe(s0.possession);

    const quiet = new HandballSim({ naturalGoals: false, timeline: [{ k: 400, type: 'goal', team: 1 }] });
    quiet.stepTo(K_END);
    expect([quiet.snapshot().h, quiet.snapshot().a]).toEqual([0, 1]);

    let plain = 0;
    let boosted = 0;
    for (let i = 0; i < 20; i++) {
      const a = new HandballSim({ seed: seedOf(i) });
      const b = new HandballSim({ seed: seedOf(i), timeline: [{ type: 'bias', fromK: 0, toK: K_END, team: 0, amount: 0.15 }] });
      a.stepTo(K_END);
      b.stepTo(K_END);
      plain += a.snapshot().h;
      boosted += b.snapshot().h;
      // bias changes which finishes go in, never when attacks end
      expect(b.attacks().map((r) => r.endK)).toEqual(a.attacks().map((r) => r.endK));
    }
    expect(boosted - plain).toBeGreaterThan(20 * 4);
  });
});
