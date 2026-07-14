import { describe, it, expect } from 'vitest';
import { computeSchedule, computeScheduleSafe, type Milestone, type PlanInput, type Temp } from './schedule';
import { formatColdProof } from './format';

// These tests assert wall-clock behaviour, so they must run in a fixed zone.
// The test script sets TZ=Europe/Copenhagen; guard so a bare `vitest` run fails loudly.
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const MIN = 60000;
const CP_MAX = 24 * 60;
const CP_MIN = 6 * 60;

const HUMAN = new Set([
  'feed', 'mix', 'salt', 'fold1', 'fold2', 'fold3', 'fold4', 'shape', 'fridge', 'preheat', 'bake', 'cool',
]);

const isNight = (at: number): boolean => {
  const d = new Date(at);
  const m = d.getHours() * 60 + d.getMinutes();
  return m >= 23 * 60 || m < 6 * 60;
};

const humanNightSteps = (ms: Milestone[]): string[] =>
  ms.filter((m) => HUMAN.has(m.id) && isNight(m.at)).map((m) => m.id);

const at = (ms: Milestone[], id: string): number => ms.find((m) => m.id === id)!.at;

// Local wall-clock finish (interpreted in TZ). month is 0-indexed.
const finishAt = (y: number, mo: number, d: number, h: number, mi = 0): number =>
  new Date(y, mo, d, h, mi, 0, 0).getTime();

function mk(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    finishAt: finishAt(2026, 6, 15, 17, 0),
    temp: 'normal',
    coldProofHours: 12,
    hasActiveStarter: false,
    size: 'large',
    delays: {},
    ...overrides,
  };
}

describe('computeScheduleSafe — night avoidance', () => {
  it('runs in Europe/Copenhagen (deterministic wall-clock)', () => {
    expect(TZ).toBe('Europe/Copenhagen');
  });

  it('leaves an already night-free plan untouched', () => {
    // Morning finish + 12h proof: everything falls in daytime already.
    const input = mk({ finishAt: finishAt(2026, 6, 15, 10, 0) });
    const { milestones, adjustment } = computeScheduleSafe(input);
    expect(humanNightSteps(milestones)).toEqual([]);
    expect(adjustment.status).toBe('ok');
    expect(adjustment.effectiveColdProofMin).toBe(12 * 60);
    expect(adjustment.note).toBeNull();
  });

  it('extends the cold proof for an afternoon finish (~15½ h), finish unchanged', () => {
    const input = mk({ finishAt: finishAt(2026, 6, 15, 17, 0) });
    const { milestones, adjustment } = computeScheduleSafe(input);
    expect(humanNightSteps(milestones)).toEqual([]);
    expect(adjustment.coldProofChanged).toBe(true);
    expect(adjustment.effectiveColdProofMin).toBeGreaterThan(15 * 60);
    expect(adjustment.effectiveColdProofMin).toBeLessThan(16 * 60);
    expect(at(milestones, 'done')).toBe(input.finishAt); // finish 'keep'
    expect(adjustment.finishNudgedTo).toBeNull();
    expect(adjustment.note).toContain('Koldhævningen er forlænget');
  });

  it('produces a night-free plan for every temperature', () => {
    for (const temp of ['cool', 'normal', 'warm'] as Temp[]) {
      const { milestones, adjustment } = computeScheduleSafe(mk({ temp }));
      expect(humanNightSteps(milestones)).toEqual([]);
      expect(adjustment.effectiveColdProofMin).toBeGreaterThanOrEqual(CP_MIN);
      expect(adjustment.effectiveColdProofMin).toBeLessThanOrEqual(CP_MAX);
    }
  });

  it('handles an active starter (shorter cluster) night-free', () => {
    const { milestones } = computeScheduleSafe(mk({ hasActiveStarter: true }));
    expect(milestones.find((m) => m.id === 'feed')).toBeUndefined();
    expect(humanNightSteps(milestones)).toEqual([]);
  });

  it('trims the cold proof slightly (≤2h) when the head only just pokes into night', () => {
    // warm + active (D≈4.75h), cp8, evening finish 21:05 → head lands ~05:50.
    const input = mk({ temp: 'warm', hasActiveStarter: true, coldProofHours: 8, finishAt: finishAt(2026, 6, 15, 21, 5) });
    const { milestones, adjustment } = computeScheduleSafe(input);
    expect(humanNightSteps(milestones)).toEqual([]);
    expect(adjustment.coldProofChanged).toBe(true);
    expect(adjustment.effectiveColdProofMin).toBeLessThan(8 * 60); // shortened, not extended
    expect(8 * 60 - adjustment.effectiveColdProofMin).toBeLessThanOrEqual(2 * 60);
    expect(adjustment.note).toContain('forkortet');
  });

  it('snaps an infeasible early-morning finish when policy.finish = "snap"', () => {
    const input = mk({ finishAt: finishAt(2026, 6, 15, 4, 0) });
    const { milestones, adjustment } = computeScheduleSafe(input, { finish: 'snap' });
    expect(adjustment.finishNudgedTo).toBe(finishAt(2026, 6, 15, 8, 30));
    expect(at(milestones, 'done')).toBe(adjustment.finishNudgedTo);
    expect(humanNightSteps(milestones)).toEqual([]);
  });

  it('keeps an infeasible finish and warns (default policy)', () => {
    const input = mk({ finishAt: finishAt(2026, 6, 15, 4, 0) });
    const { milestones, adjustment } = computeScheduleSafe(input);
    expect(adjustment.status).toBe('nightUnavoidable');
    expect(adjustment.nightSteps).toEqual(expect.arrayContaining(['preheat', 'bake', 'cool']));
    expect(at(milestones, 'done')).toBe(input.finishAt); // unchanged
    expect(adjustment.note).toContain('kan ikke undgås');
  });

  it('warns (does not adjust) when policy.coldProof = "keep"', () => {
    const { adjustment } = computeScheduleSafe(mk(), { coldProof: 'keep' });
    expect(adjustment.effectiveColdProofMin).toBe(12 * 60);
    expect(adjustment.status).toBe('nightUnavoidable');
    expect(adjustment.nightSteps.length).toBeGreaterThan(0);
  });

  it('is a passthrough when avoidNight = false', () => {
    const input = mk();
    const { milestones, adjustment } = computeScheduleSafe(input, { avoidNight: false });
    const plain = computeSchedule(input);
    expect(milestones.map((m) => m.at)).toEqual(plain.map((m) => m.at));
    expect(adjustment.applied).toBe(false);
  });

  it('re-avoids the night after a manual delay (reducer semantics)', () => {
    const input = mk();
    // Reducer: delay shape by 60 ⇒ finishAt += 60m AND delays.shape += 60.
    const delayed: PlanInput = {
      ...input,
      finishAt: input.finishAt + 60 * MIN,
      delays: { ...input.delays, shape: 60 },
    };
    const { milestones } = computeScheduleSafe(delayed);
    expect(humanNightSteps(milestones)).toEqual([]);
  });

  it('stays night-free across DST transitions (spring forward & fall back)', () => {
    // DK 2026: spring forward Sun 29 Mar, fall back Sun 25 Oct.
    for (const f of [finishAt(2026, 2, 30, 17, 0), finishAt(2026, 9, 26, 17, 0)]) {
      const { milestones } = computeScheduleSafe(mk({ finishAt: f }));
      expect(humanNightSteps(milestones)).toEqual([]);
    }
  });

  it('handles a multi-day span (cool, 16h) with strictly increasing, night-free times', () => {
    const { milestones } = computeScheduleSafe(mk({ temp: 'cool', coldProofHours: 16 }));
    for (let i = 1; i < milestones.length; i++) {
      expect(milestones[i].at).toBeGreaterThan(milestones[i - 1].at);
    }
    expect(humanNightSteps(milestones)).toEqual([]);
  });

  it('reports nightUnavoidable when a huge manual delay makes the cluster unplaceable', () => {
    // A 10h extra first rise balloons the cluster past a full daytime window.
    const input = mk({ delays: { shape: 600 } });
    const { adjustment } = computeScheduleSafe(input);
    expect(adjustment.status).toBe('nightUnavoidable');
    expect(adjustment.nightSteps.length).toBeGreaterThan(0);
    expect(adjustment.effectiveColdProofMin).toBeLessThanOrEqual(CP_MAX);
  });

  it('formats cold-proof durations for humans', () => {
    expect(formatColdProof(931)).toBe('15 t 31 min');
    expect(formatColdProof(720)).toBe('12 t');
    expect(formatColdProof(0)).toBe('0 t');
  });
});
