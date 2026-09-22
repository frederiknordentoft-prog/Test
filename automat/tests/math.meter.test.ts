// R11/R12 meter: locked stake (floor, charge-weighted), tiers & perks, route A / B / A+B.
import { describe, it, expect } from 'vitest';
import { newMeter, kpOf, lockedStakeOre, addCharge, resetMeter, stormDecision, tiersBetween } from '../src/math/meter.ts';
import { CONFIG } from '../src/math/config.ts';
import { TIERS, kpFromCharge } from '../src/game/tiers.ts';

const K = CONFIG.K;

describe('meter', () => {
  it('empty meter: Kp 0, locked stake falls back to the default stake', () => {
    const m = newMeter();
    expect(m).toEqual({ charge: 0, stakeSumOre: 0 });
    expect(kpOf(m)).toBe(0);
    expect(lockedStakeOre(m)).toBe(CONFIG.defaultStakeOre);
  });

  it('locked stake = floor(Σ charge·stake / Σ charge) in whole øre', () => {
    const m = newMeter();
    addCharge(m, 10, 50);
    addCharge(m, 20, 10000);
    expect(m).toEqual({ charge: 30, stakeSumOre: 10 * 50 + 20 * 10000 });
    expect(lockedStakeOre(m)).toBe(Math.floor((500 + 200000) / 30)); // 6683.33 → 6683
    addCharge(m, 7, 200);
    expect(lockedStakeOre(m)).toBe(Math.floor((500 + 200000 + 1400) / 37));
    addCharge(m, 0, 10000); // a dead spin changes nothing
    expect(lockedStakeOre(m)).toBe(Math.floor((500 + 200000 + 1400) / 37));
  });

  it('kpOf is continuous and matches tiers.kpFromCharge', () => {
    const m = newMeter();
    for (const c of [1, 10, 50, 100, 500, 2000, 6000, 12000]) {
      m.charge = Math.min(c, K);
      expect(kpOf(m)).toBeCloseTo(kpFromCharge(m.charge, K), 12);
    }
    m.charge = K;
    expect(kpOf(m)).toBe(9);
  });

  it('addCharge reports every tier crossed (several at once) and stormA at K', () => {
    const m = newMeter();
    let r = addCharge(m, Math.ceil(TIERS[3].frac * K), 200); // jumps Kp 0 → 3 (e.g. a 3-sun spin)
    expect(r.tiersCrossed).toEqual([1, 2, 3]);
    expect(r.kpBefore).toBe(0);
    expect(r.kpAfter).toBeGreaterThanOrEqual(3);
    expect(r.kpAfter).toBeLessThan(3.01);
    expect(r.stormA).toBe(false);
    r = addCharge(m, 1, 200);
    expect(r.tiersCrossed).toEqual([]);
    r = addCharge(m, K, 200);
    expect(r.tiersCrossed).toEqual([4, 5, 6, 7, 8, 9]);
    expect(r.stormA).toBe(true);
    expect(r.tiersCrossed.filter((t) => TIERS[t].perk)).toEqual([5, 7]);
  });

  it('perk tiers are Kp 3, 5, 7 and each is crossed exactly once per cycle', () => {
    expect(TIERS.filter((t) => t.perk).map((t) => t.kp)).toEqual([3, 5, 7]);
    const m = newMeter();
    const crossed: number[] = [];
    while (m.charge < K) crossed.push(...addCharge(m, 7, 100).tiersCrossed);
    expect(crossed).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(tiersBetween(0, K, K)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('route A → storm at the LOCKED stake and the meter resets', () => {
    const m = newMeter();
    addCharge(m, K - 5, 50);
    const r = addCharge(m, 10, 10000);
    expect(r.stormA).toBe(true);
    const d = stormDecision(m, 10000, r.stormA, false)!;
    expect(d).toEqual({ route: 'A', stakeOre: Math.floor(((K - 5) * 50 + 10 * 10000) / (K + 5)), resetMeter: true });
    resetMeter(m);
    expect(m).toEqual({ charge: 0, stakeSumOre: 0 });
  });

  it('route B → storm at the spin stake, meter kept; A+B → one storm at the spin stake and reset', () => {
    const m = newMeter();
    addCharge(m, 100, 200);
    expect(stormDecision(m, 600, false, true)).toEqual({ route: 'B', stakeOre: 600, resetMeter: false });
    expect(stormDecision(m, 600, true, true)).toEqual({ route: 'AB', stakeOre: 600, resetMeter: true });
    expect(stormDecision(m, 600, false, false)).toBeNull();
  });
});
