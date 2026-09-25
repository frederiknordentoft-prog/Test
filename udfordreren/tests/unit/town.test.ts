import { describe, expect, it } from 'vitest';
import { makeRng, seedState } from '../../src/sim/rng';
import { byArpuFaktor, byTal, byTillid, risikoAndel, ugentligBy } from '../../src/sim/town';
import { tillidsPoster } from '../../src/sim/trust';
import { BY } from '../../src/data/town';
import type { GameState } from '../../src/sim/types';
import { koer, nyt } from './helpers';

/** Et spil med 10.000 kunder i dk og ét aktivt produkt */
function medKunder(seed = 42): GameState {
  const s = nyt(seed);
  koer(s, 1);
  s.markeder.dk.licens = 'aktiv';
  s.markeder.dk.spillerKunder = { betting: 10000, kasino: 0 };
  const p = structuredClone(s.produkter.find((x) => x.ejer !== 'spiller')!);
  p.id = 'p-by';
  p.ejer = 'spiller';
  p.markeder = ['dk'];
  p.intensitet = 3;
  s.produkter.push(p);
  return s;
}

/** Kør byen n gange (hver 4. uge) uden resten af simulationen */
function kørBy(s: GameState, gange: number, seed = 1): void {
  for (let i = 0; i < gange; i++) {
    s.uge = Math.ceil((s.uge + 1) / BY.interval) * BY.interval;
    ugentligBy(s, makeRng(seedState(seed * 1000 + i)));
  }
}

const snit = (f: (seed: number) => number, n = 12) => Array.from({ length: n }, (_, i) => f(i + 1)).reduce((a, b) => a + b, 0) / n;

describe('Spillerbyen (6.14)', () => {
  it('200 personer; byen fylder op i takt med kunderne', () => {
    const s = nyt();
    expect(s.by.length).toBe(200);
    expect(byTal(s).aktive).toBe(0);
    const k = medKunder();
    kørBy(k, 1);
    expect(byTal(k).aktive).toBe(Math.round(BY.aktivePrDekade * 4));
  });
  it('neutrale valg giver 5-15 % i risiko eller problem', () => {
    const andel = snit((seed) => {
      const s = medKunder(seed);
      kørBy(s, 120, seed);
      return risikoAndel(s) ?? 0;
    });
    expect(andel).toBeGreaterThan(0.05);
    expect(andel).toBeLessThan(0.15);
  });
  it('høj intensitet, bonus og VIP gør byen rød; beskyttelsesværktøjer flytter folk tilbage', () => {
    const koer = (opsaet: (s: GameState) => void) =>
      snit((seed) => {
        const s = medKunder(seed);
        opsaet(s);
        kørBy(s, 120, seed);
        return risikoAndel(s) ?? 0;
      });
    const neutral = koer(() => {});
    const aggressiv = koer((s) => {
      s.produkter.find((p) => p.id === 'p-by')!.intensitet = 5;
      s.bonusNiveau = 3;
      s.vipProgram = 3;
    });
    const beskyttet = koer((s) => {
      s.forskning.ulaast.push('ansvarligtSpil1', 'ansvarligtSpil2', 'tidligIntervention');
    });
    expect(aggressiv).toBeGreaterThan(neutral + 0.06);
    expect(beskyttet).toBeLessThan(neutral);
  });
  it('en rød by koster tilsynstillid og giver lidt mere BSI pr. kunde', () => {
    const s = medKunder();
    kørBy(s, 1);
    const aktive = s.by.filter((p) => p.profil !== 'churnet');
    aktive.forEach((p, i) => { p.profil = i % 3 === 0 ? 'problem' : 'engageret'; p.vaerdi = BY.vaerdi[p.profil]; });
    expect(byTillid(s, 'dk')).toBeLessThan(0);
    expect(tillidsPoster(s, 'dk').some((x) => x.tekst.includes('risiko eller problem'))).toBe(true);
    expect(byArpuFaktor(s, 'dk')).toBeGreaterThan(1);
  });
  it('byhistorier er korte og kommer med mellemrum', () => {
    const s = medKunder();
    s.bonusNiveau = 3;
    kørBy(s, 60);
    expect(s.byHistorier.length).toBeGreaterThan(0);
    for (let i = 1; i < s.byHistorier.length; i++) expect(s.byHistorier[i - 1].uge - s.byHistorier[i].uge).toBeGreaterThanOrEqual(BY.historieMellemrum);
    for (const h of s.byHistorier) expect(h.tekst.length).toBeLessThan(160);
  });
  it('kunder i et marked uden licens forsvinder fra byen', () => {
    const s = medKunder();
    kørBy(s, 2);
    s.markeder.dk.spillerKunder = { betting: 0, kasino: 0 };
    kørBy(s, 1);
    expect(byTal(s).aktive).toBe(0);
  });
});
