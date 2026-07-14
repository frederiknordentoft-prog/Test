import { describe, it, expect } from 'vitest';
import { computeSchedule, totalMinutes, RECIPES, type PlanInput, type MilestoneId } from './schedule';

const MIN = 60000;

// Date.UTC gives a fixed epoch independent of the machine timezone, so every
// assertion below is about epoch-ms differences and is fully deterministic.
function base(overrides: Partial<PlanInput> = {}): PlanInput {
  return {
    finishAt: Date.UTC(2026, 6, 12, 10, 15),
    temp: 'normal',
    coldProofHours: 12,
    hasActiveStarter: false,
    size: 'small',
    delays: {},
    ...overrides,
  };
}

const byId = (input: PlanInput): Record<string, number> =>
  Object.fromEntries(computeSchedule(input).map((m) => [m.id, m.at] as const));

describe('computeSchedule', () => {
  it('matches the spec example (normal kitchen, 12h cold proof): finish − 26h15m = feed', () => {
    const input = base();
    const at = byId(input);
    expect(totalMinutes(input)).toBe(1575); // 26h15m
    expect(at.done).toBe(input.finishAt);
    expect(at.feed).toBe(input.finishAt - 1575 * MIN);
    // Every phase gap, in order.
    expect((at.mix - at.feed) / MIN).toBe(360); // activation, normal
    expect((at.salt - at.mix) / MIN).toBe(30);
    expect((at.fold1 - at.salt) / MIN).toBe(30);
    expect((at.fold4 - at.fold1) / MIN).toBe(90); // 3 × 30
    expect((at.shape - at.fold4) / MIN).toBe(180); // first rise, normal
    expect((at.fridge - at.shape) / MIN).toBe(15);
    expect((at.preheat - at.fridge) / MIN).toBe(720); // cold proof 12h
    expect((at.bake - at.preheat) / MIN).toBe(45);
    expect((at.cool - at.bake) / MIN).toBe(45);
    expect((at.done - at.cool) / MIN).toBe(60);
  });

  it('drops feed + the activation wait when the starter is already active', () => {
    const input = base({ hasActiveStarter: true });
    const ms = computeSchedule(input);
    expect(ms.find((m) => m.id === 'feed')).toBeUndefined();
    const mix = ms.find((m) => m.id === 'mix')!;
    expect(mix.canDelay).toBe(false); // no wait before the first action
    expect(totalMinutes(input)).toBe(1215); // 1575 − 360
    expect(mix.at).toBe(input.finishAt - 1215 * MIN);
  });

  it('delay pushes that step + all later steps + finish, and pins earlier steps', () => {
    const before = byId(base());
    // Reducer semantics for "+1h at first rise": delays.shape=60 AND finishAt+=60.
    const after = byId({ ...base(), finishAt: base().finishAt + 60 * MIN, delays: { shape: 60 } });

    const pinned: MilestoneId[] = ['feed', 'mix', 'salt', 'fold1', 'fold2', 'fold3', 'fold4'];
    for (const id of pinned) expect(after[id]).toBe(before[id]);

    const shifted: MilestoneId[] = ['shape', 'fridge', 'preheat', 'bake', 'cool', 'done'];
    for (const id of shifted) expect((after[id] - before[id]) / MIN).toBe(60);
  });

  it('varies activation and first rise by temperature', () => {
    const gap = (input: PlanInput, id: MilestoneId) =>
      computeSchedule(input).find((m) => m.id === id)!.gapBeforeMin;
    expect(gap(base({ temp: 'cool' }), 'mix')).toBe(480);
    expect(gap(base({ temp: 'warm' }), 'mix')).toBe(240);
    expect(gap(base({ temp: 'cool' }), 'shape')).toBe(240);
    expect(gap(base({ temp: 'warm' }), 'shape')).toBe(120);
  });

  it('always produces strictly increasing times across every combination', () => {
    for (const temp of ['cool', 'normal', 'warm'] as const) {
      for (const coldProofHours of [8, 12, 16] as const) {
        for (const hasActiveStarter of [false, true]) {
          const ms = computeSchedule(base({ temp, coldProofHours, hasActiveStarter }));
          for (let i = 1; i < ms.length; i++) {
            expect(ms[i].at).toBeGreaterThan(ms[i - 1].at);
          }
        }
      }
    }
  });

  it('handles a finish time in the past without throwing', () => {
    const ms = computeSchedule(base({ finishAt: Date.UTC(2000, 0, 1, 12, 0) }));
    expect(ms[0].id).toBe('feed');
    expect(ms[ms.length - 1].id).toBe('done');
  });

  it('exposes the correct recipe quantities', () => {
    expect(RECIPES.small).toEqual({ starter: 50, water: 175, flour: 250, salt: 5 });
    expect(RECIPES.large).toEqual({ starter: 100, water: 350, flour: 500, salt: 10 });
  });
});
