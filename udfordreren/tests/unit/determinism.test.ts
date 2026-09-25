import { describe, expect, it } from 'vitest';
import { hashState, stableStringify } from '../../src/sim/hash';
import { step } from '../../src/sim/step';
import { makeRng, seedState } from '../../src/sim/rng';
import { validerSave, importerJson, eksporterJson } from '../../src/store/persistence';
import { balanceretBot } from '../../sim/bots/balanced';
import { nyt } from './helpers';
import type { GameState } from '../../src/sim/types';

function spil(seed: number, uger: number): GameState {
  let s = nyt(seed);
  for (let i = 0; i < uger && !s.slut; i++) s = step(s, balanceretBot.beslut(s));
  return s;
}

describe('RNG', () => {
  it('sfc32 giver samme sekvens for samme seed og forskellig for forskellige', () => {
    const a = makeRng(seedState(7));
    const b = makeRng(seedState(7));
    const c = makeRng(seedState(8));
    const sa = Array.from({ length: 20 }, () => a.next());
    const sb = Array.from({ length: 20 }, () => b.next());
    const sc = Array.from({ length: 20 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const x of sa) expect(x >= 0 && x < 1).toBe(true);
  });
  it('int og weighted holder sig i intervallet', () => {
    const r = makeRng(seedState(1));
    for (let i = 0; i < 500; i++) {
      const v = r.int(2, 5);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(5);
    }
    expect(r.weighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
  });
});

describe('Determinisme', () => {
  it('samme seed og samme beslutninger giver identisk state-hash (kørt to gange)', () => {
    const a = spil(123, 260);
    const b = spil(123, 260);
    expect(hashState(a)).toBe(hashState(b));
    expect(a.uge).toBe(260);
  });
  it('forskellige seeds giver forskellige forløb', () => {
    expect(hashState(spil(1, 60))).not.toBe(hashState(spil(2, 60)));
  });
  it('step er ren: input-state ændres ikke', () => {
    const s = nyt(5);
    const foer = stableStringify(s);
    step(s, [{ t: 'postJobAd', niveau: 1 }]);
    expect(stableStringify(s)).toBe(foer);
  });
  it('stabil stringify er uafhængig af nøglerækkefølge', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }));
  });
});

describe('Save/load', () => {
  it('gem → indlæs giver identisk hash, og spillet fortsætter identisk', () => {
    const s = spil(77, 150);
    const json = eksporterJson(s);
    const indlaest = importerJson(json)!;
    expect(indlaest).not.toBeNull();
    expect(hashState(indlaest)).toBe(hashState(s));
    let a = s;
    let b = indlaest;
    for (let i = 0; i < 40; i++) {
      a = step(a, balanceretBot.beslut(a));
      b = step(b, balanceretBot.beslut(b));
    }
    expect(hashState(a)).toBe(hashState(b));
  });
  it('korrupte filer afvises pænt', () => {
    expect(importerJson('ikke json')).toBeNull();
    expect(importerJson('{"state":{"version":1}}')).toBeNull();
    expect(validerSave(null)).toBeNull();
    expect(validerSave({ version: 2, uge: 'x' })).toBeNull();
  });
  it('saves fra ældre builds får de nye felter udfyldt', () => {
    const s = spil(3, 30) as unknown as Record<string, unknown>;
    const gammel = structuredClone(s);
    for (const k of ['by', 'verdensHaendelser', 'hyperpersonalisering', 'boerslicens', 'reaktioner', 'sponsorater']) delete gammel[k];
    delete (gammel.markeder as Record<string, Record<string, unknown>>).dk.sanktion;
    const g = validerSave(gammel);
    expect(g).not.toBeNull();
    expect(g!.by.length).toBe(200);
    expect(g!.hyperpersonalisering.aktiv).toBe(false);
    expect(g!.markeder.dk.sanktion.trin).toBe(0);
  });
});
