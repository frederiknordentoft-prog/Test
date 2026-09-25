import { describe, expect, it } from 'vitest';
import { beregnAnmeldelser, markedsStandard, paramQ, scoreFraQ, anmelderQ, kvalitetFra } from '../../src/sim/reviews';
import { makeRng, seedState } from '../../src/sim/rng';
import { GULDKUPON_TOTAL, HALL_OF_FAME_TOTAL, HALL_OF_FAME_TYPENIVEAU, REVIEWERS } from '../../src/data/reviewers';
import type { Params } from '../../src/sim/types';
import { nyt } from './helpers';

const lige = (v: number): Params => ({ spaending: v, originalitet: v, teknik: v, tryghed: v });

describe('Anmeldelser', () => {
  it('fire anmeldere giver 1-10 og total /40 med citater', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const r = beregnAnmeldelser(s, makeRng(seedState(1)), {
      typeId: 'prematch', themeId: 'fodbold', params: lige(std), fejl: 0, margin: 0.07, intensitet: 3, markeder: ['dk'], tidligEfterfoelger: false,
    });
    expect(r.anmeldelser.map((a) => a.anmelder)).toEqual(REVIEWERS.map((x) => x.id));
    for (const a of r.anmeldelser) {
      expect(a.score).toBeGreaterThanOrEqual(1);
      expect(a.score).toBeLessThanOrEqual(10);
      expect(a.citat.length).toBeGreaterThan(3);
    }
    expect(r.total40).toBe(r.anmeldelser.reduce((x, y) => x + y.score, 0));
    expect(r.total40).toBeGreaterThanOrEqual(16);
    expect(r.total40).toBeLessThanOrEqual(32);
  });

  it('Guldkupon ved ≥ 32 og Hall of Fame ved ≥ 36 (og mesterskab i genren)', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const rng = makeRng(seedState(3));
    const input = { typeId: 'livebetting' as const, themeId: 'fodbold' as const, params: lige(std * 4), fejl: 0, margin: 0.07, intensitet: 3 as const, markeder: ['dk' as const], tidligEfterfoelger: false };
    const nybegynder = beregnAnmeldelser(s, makeRng(seedState(3)), input);
    expect(nybegynder.total40).toBeGreaterThanOrEqual(HALL_OF_FAME_TOTAL);
    expect(nybegynder.hallOfFame).toBe(false);
    s.niveauer.type.livebetting = HALL_OF_FAME_TYPENIVEAU;
    const staerk = beregnAnmeldelser(s, rng, input);
    expect(staerk.total40).toBeGreaterThanOrEqual(HALL_OF_FAME_TOTAL);
    expect(staerk.guldkupon).toBe(true);
    expect(staerk.hallOfFame).toBe(true);
    const svag = beregnAnmeldelser(s, rng, { typeId: 'prematch', themeId: 'eventyr', params: lige(std * 0.3), fejl: 10, margin: 0.1, intensitet: 5, markeder: ['dk'], tidligEfterfoelger: false });
    expect(svag.total40).toBeLessThan(GULDKUPON_TOTAL);
    expect(svag.guldkupon).toBe(false);
    expect(svag.hallOfFame).toBe(false);
  });

  it('flere fejl sænker især Tilsynet', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const base = { typeId: 'prematch' as const, themeId: 'fodbold' as const, params: lige(std), margin: 0.07, intensitet: 3, markeder: ['dk' as const], tidligEfterfoelger: false };
    const uden = anmelderQ(s, { ...base, fejl: 0 });
    const med = anmelderQ(s, { ...base, fejl: 12 });
    expect(uden.tilsynet - med.tilsynet).toBeGreaterThan(uden.branchebladet - med.branchebladet);
  });

  it('lav margin glæder Forbrugerposten; høj intensitet koster hos Tilsynet', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const base = { typeId: 'prematch' as const, themeId: 'fodbold' as const, params: lige(std), fejl: 0, markeder: ['dk' as const], tidligEfterfoelger: false };
    expect(anmelderQ(s, { ...base, margin: 0.05, intensitet: 3 }).forbrugerposten).toBeGreaterThan(anmelderQ(s, { ...base, margin: 0.1, intensitet: 3 }).forbrugerposten);
    expect(anmelderQ(s, { ...base, margin: 0.07, intensitet: 1 }).tilsynet).toBeGreaterThan(anmelderQ(s, { ...base, margin: 0.07, intensitet: 5 }).tilsynet);
  });

  it('fit (kombinationsbog) påvirker Spillerforum', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const base = { typeId: 'livebetting' as const, params: lige(std), fejl: 0, margin: 0.09, intensitet: 3, markeder: ['dk' as const], tidligEfterfoelger: false };
    expect(anmelderQ(s, { ...base, themeId: 'fodbold' }).spillerforum).toBeGreaterThan(anmelderQ(s, { ...base, themeId: 'retro' }).spillerforum);
  });

  it('tidlig 2.0-version straffes med −30 %', () => {
    const s = nyt();
    const std = markedsStandard(s, 'prematch');
    const base = { typeId: 'prematch' as const, themeId: 'fodbold' as const, params: lige(std), fejl: 0, margin: 0.07, intensitet: 3, markeder: ['dk' as const] };
    const normal = anmelderQ(s, { ...base, tidligEfterfoelger: false });
    const tidlig = anmelderQ(s, { ...base, tidligEfterfoelger: true });
    expect(tidlig.branchebladet).toBeCloseTo(normal.branchebladet * 0.7, 5);
  });

  it('markedsstandarden stiger med årstallet — ikke med spillerens egne topscorer', () => {
    const s = nyt();
    const a = markedsStandard(s, 'prematch');
    s.uge = 52 * 4;
    const b = markedsStandard(s, 'prematch');
    expect(b).toBeGreaterThan(a * 1.5);
    const foer = markedsStandard(s, 'prematch');
    s.produkter.push({ ...s.produkter[0], id: 'x', ejer: 'spiller', total40: 40, kvalitet: 0.99 });
    expect(markedsStandard(s, 'prematch')).toBe(foer);
  });

  it('mætning: q og score er monotone og loftede', () => {
    expect(paramQ(0)).toBe(0);
    expect(paramQ(1)).toBeCloseTo(0.632, 3);
    expect(paramQ(5)).toBeLessThan(1);
    expect(scoreFraQ(0.2)).toBeLessThan(scoreFraQ(0.6));
    expect(scoreFraQ(0.99)).toBeLessThanOrEqual(10);
    expect(kvalitetFra(lige(1), 5, 0)).toBeGreaterThan(kvalitetFra(lige(1), 1, 0));
  });
});
