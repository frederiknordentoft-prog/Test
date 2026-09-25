// UI-hjælpere til Byen-panelet: forklaringen af driverne skal gå op med sim-kernens byDrivere().
import { describe, expect, it } from 'vitest';
import { byDrivere, byTal, risikoAndel } from '../../src/sim/town';
import type { GameState, TownPerson } from '../../src/sim/types';
import { byDriverForklaring, byMarkeder, byOversigt, driverMarked, risikoInfo, tillidLinjer } from '../../src/ui/lib/byHjaelp';
import { nyt } from './helpers';

function medBy(): GameState {
  const s = nyt(11);
  s.markeder.dk.licens = 'aktiv';
  s.markeder.dk.spillerKunder = { betting: 20000, kasino: 0 };
  s.markeder.uk.spillerKunder = { betting: 4000, kasino: 1000 };
  const profiler: TownPerson['profil'][] = ['rekreativ', 'rekreativ', 'engageret', 'vip', 'risiko', 'problem', 'rekreativ', 'engageret', 'rekreativ', 'rekreativ'];
  s.by.slice(0, 120).forEach((p, i) => {
    p.profil = profiler[i % profiler.length];
    p.marked = i % 4 === 0 ? 'uk' : 'dk';
  });
  const p = structuredClone(s.produkter.find((x) => x.ejer !== 'spiller')!);
  p.id = 'p-by';
  p.ejer = 'spiller';
  p.markeder = ['dk'];
  p.intensitet = 5;
  s.produkter.push(p);
  return s;
}

describe('byHjaelp', () => {
  it('driverforklaringen ganger og lægger sammen til byDrivere()', () => {
    const s = medBy();
    const tjek = () => {
      for (const m of ['dk', 'uk'] as const) {
        const d = byDrivere(s, m);
        const f = byDriverForklaring(s, m);
        expect(f.skade).toBeCloseTo(d.skade, 10);
        expect(f.beskyttelse).toBeCloseTo(d.beskyttelse, 10);
      }
    };
    tjek();
    s.bonusNiveau = 3;
    s.vipProgram = 2;
    s.marketingMix.tv = 0.3;
    s.hyperpersonalisering.aktiv = true;
    s.forskning.ulaast.push('ansvarligtSpil1', 'ansvarligtSpil2');
    s.markeder.dk.regler.push('affordability');
    s.staff[0].rolle = 'compliance';
    tjek();
  });

  it('oversigten tæller som byTal og ignorerer dem, der er holdt op', () => {
    const s = medBy();
    const o = byOversigt(s);
    expect(o.aktive).toBe(byTal(s).aktive);
    const dk = byOversigt(s, 'dk');
    expect(dk.aktive).toBe(byTal(s, 'dk').aktive);
    expect(Object.values(o.andel).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(Object.values(o.vaerdiAndel).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    // Guld og rød fylder mere i pengene end i folkene
    expect(o.vaerdiAndel.vip).toBeGreaterThan(o.andel.vip);
    expect(o.vaerdiAndel.problem).toBeGreaterThan(o.andel.problem);
  });

  it('filter, risiko og tillid følger markederne med pixelfolk', () => {
    const s = medBy();
    expect(byMarkeder(s).map((x) => x.m)).toEqual(['dk', 'uk']);
    expect(driverMarked(s)).toBe('dk');
    expect(driverMarked(s, 'uk')).toBe('uk');
    expect(risikoInfo(s).andel).toBeCloseTo(risikoAndel(s)!, 10);
    expect(tillidLinjer(s).map((l) => l.m)).toEqual(['dk', 'uk']);
    const tom = nyt(12);
    expect(byMarkeder(tom)).toEqual([]);
    expect(driverMarked(tom)).toBeNull();
    expect(risikoInfo(tom).andel).toBeNull();
  });
});
