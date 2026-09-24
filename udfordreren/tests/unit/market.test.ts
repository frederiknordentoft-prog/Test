import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng } from '../../src/sim/rng';
import { stepMut } from '../../src/sim/step';
import { beregnTop10 } from '../../src/sim/charts';
import { markedsKunder, effektivCac, kundeAndel, lanceringsKunder, ugentligeKunder, spillerKunderTotal } from '../../src/sim/customers';
import { ugentligOekonomi, effektivAfgift } from '../../src/sim/economy';
import { CHANNELS } from '../../src/data/acquisition';
import type { GameState, LiveProduct } from '../../src/sim/types';
import { koer, nyt } from './helpers';

function lancerEt(s: GameState, total40 = 26): LiveProduct {
  const p: LiveProduct = {
    id: 'lpX', navn: 'Testodds', ejer: 'spiller', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3,
    kvalitet: 0.6, lanceretUge: s.uge, anmeldelser: [], total40, guldkupon: false, hallOfFame: false, bsiPrUge: {}, samletBsi: 0,
    aktiv: true, features: [], fejl: 0, version: 1, bedstePlacering: {}, ugerITop10: 0, params: { spaending: 1, originalitet: 1, teknik: 1, tryghed: 1 },
  };
  s.produkter.push(p);
  s.markeder.dk.vertikaler.betting.status = 'aktiv';
  s.markeder.dk.licens = 'aktiv';
  lanceringsKunder(s, p);
  return p;
}

describe('Hitlisten', () => {
  it('rangerer efter ugens nye spillere med pile og NY!', () => {
    const s = nyt();
    koer(s, 1);
    const t1 = s.markeder.dk.top10;
    expect(t1.length).toBe(10);
    const nye = t1.map((e) => s.produkter.find((p) => p.id === e.productId)!.nyeSpillerePrUge?.dk ?? 0);
    for (let i = 1; i < nye.length; i++) expect(nye[i - 1]).toBeGreaterThanOrEqual(nye[i]);
    expect(t1.every((e) => e.ny)).toBe(true);
    koer(s, 1);
    expect(s.markeder.dk.top10.every((e) => !e.ny && e.forrige !== null)).toBe(true);
  });
  it('Danske Lykke og tre konkurrenter er med fra start', () => {
    const s = nyt();
    koer(s, 1);
    const ejere = new Set(s.markeder.dk.top10.map((e) => s.produkter.find((p) => p.id === e.productId)!.ejer));
    expect(ejere.has('danskeLykke')).toBe(true);
    expect(ejere.size).toBeGreaterThanOrEqual(4);
  });
  it('en stærk lancering stormer Top 10 og giver milepæl', () => {
    const s = nyt();
    koer(s, 12);
    lancerEt(s, 36);
    koer(s, 1);
    expect(s.milepaele.foersteTop10).toBeDefined();
    expect(s.markeder.dk.top10.some((e) => e.productId === 'lpX')).toBe(true);
  });
  it('beregnTop10 ignorerer lukkede produkter', () => {
    const s = nyt();
    koer(s, 1);
    const id = s.markeder.dk.top10[0].productId;
    s.produkter.find((p) => p.id === id)!.aktiv = false;
    expect(beregnTop10(s, 'dk').some((e) => e.productId === id)).toBe(false);
  });
});

describe('Kundeøkonomi', () => {
  it('markedets kunder følger markedsstørrelse / ARPU', () => {
    const s = nyt();
    expect(markedsKunder(s, 'dk', 'kasino')).toBeCloseTo(1.8e9 / 7000, -3);
  });
  it('CAC følger kanalen og stiger med andel (1 + andel² · 3)', () => {
    const s = nyt();
    const a = effektivCac(s, 'soeg', 'dk')!;
    expect(a).toBeCloseTo(CHANNELS.soeg.cac!, -1);
    s.markeder.dk.spillerKunder.betting = markedsKunder(s, 'dk', 'betting') * 0.4;
    expect(kundeAndel(s, 'dk')).toBeGreaterThan(0.1);
    expect(effektivCac(s, 'soeg', 'dk')!).toBeGreaterThan(a);
  });
  it('lanceringsbølgen kommer ind over nogle uger; churn uden marketing får kunderne til at falde bagefter', () => {
    const s = nyt();
    koer(s, 12);
    const p = lancerEt(s);
    const pulje = p.ventendeSpillere!.dk!;
    expect(pulje).toBeGreaterThan(200);
    expect(spillerKunderTotal(s)).toBe(0);
    s.hype = 0;
    s.uge += 1;
    ugentligeKunder(s, makeRng(s.rngState));
    const uge1 = spillerKunderTotal(s);
    expect(uge1).toBeGreaterThan(pulje * 0.4);
    expect(p.nyeSpillerePrUge!.dk!).toBeGreaterThan(pulje * 0.45);
    for (let i = 0; i < 8; i++) {
      s.uge += 1;
      ugentligeKunder(s, makeRng(s.rngState));
    }
    const top = spillerKunderTotal(s);
    for (let i = 0; i < 30; i++) {
      s.uge += 1;
      ugentligeKunder(s, makeRng(s.rngState));
    }
    expect(spillerKunderTotal(s)).toBeLessThan(top);
  });
  it('bedre anmeldelser giver en markant større lanceringsbølge', () => {
    const a = nyt(3);
    const b = nyt(3);
    koer(a, 12);
    koer(b, 12);
    const svag = lancerEt(a, 18).ventendeSpillere!.dk!;
    const staerk = lancerEt(b, 34).ventendeSpillere!.dk!;
    expect(staerk).toBeGreaterThan(svag * 3);
  });
  it('marketing giver flere kunder end ingen marketing', () => {
    const a = nyt(9);
    const b = nyt(9);
    for (const s of [a, b]) {
      koer(s, 12);
      lancerEt(s);
    }
    b.marketingMix.soeg = 0.05;
    for (let i = 0; i < 20; i++) {
      stepMut(a, []);
      stepMut(b, []);
    }
    expect(spillerKunderTotal(b)).toBeGreaterThan(spillerKunderTotal(a));
  });
  it('betting-hold varierer mere end kasino (favoritsejre)', () => {
    const s = nyt();
    const b: number[] = [];
    const k: number[] = [];
    for (let i = 0; i < 150; i++) {
      stepMut(s, []);
      b.push(s.holdFaktor.dk!.betting);
      k.push(s.holdFaktor.dk!.kasino);
    }
    const sd = (xs: number[]) => {
      const m = xs.reduce((x, y) => x + y, 0) / xs.length;
      return Math.sqrt(xs.reduce((x, y) => x + (y - m) ** 2, 0) / xs.length);
    };
    expect(sd(b)).toBeGreaterThan(sd(k) * 3);
    expect(Math.min(...b)).toBeLessThan(0.8);
  });
  it('regnskabet trækker afgift, revenue share og løn', () => {
    const s = nyt();
    koer(s, 12);
    lancerEt(s);
    const foer = s.kapital;
    s.uge += 1;
    const kunder = ugentligeKunder(s, makeRng(s.rngState));
    const r = ugentligOekonomi(s, kunder, 0);
    expect(r.bsi).toBeGreaterThan(0);
    expect(r.afgift).toBeCloseTo(r.bsi * 0.2, 6);
    expect(r.revenueShare).toBeCloseTo(r.bsi * 0.3, 6);
    expect(r.loen).toBeGreaterThan(0);
    expect(s.kapital).toBeCloseTo(foer + r.resultat, 6);
  });
  it('dk-afgiften stiger til 28 % i 2021', () => {
    const s = nyt();
    expect(effektivAfgift(s, 'dk', 'kasino', 0.04)).toBe(0.2);
    s.uge = 52 * 9 + 1;
    stepMut(s, []);
    expect(s.markeder.dk.afgiftPrVertikal.kasino).toBe(0.28);
  });
  it('konkurs efter 8 uger med negativ kapital', () => {
    const s = nyt();
    s.kapital = -5;
    koer(s, 9);
    expect(s.slut?.id).toBe('konkurs');
  });
});

describe('Anden vertikal og kryds-salg', () => {
  it('kan søge den anden vertikal og får kryds-salg ved første lancering', () => {
    const s = nyt();
    koer(s, 12);
    lancerEt(s);
    s.kapital = 5;
    applyActionMut(s, makeRng(s.rngState), { t: 'applyLicense', market: 'dk', vertical: 'kasino' });
    expect(s.markeder.dk.vertikaler.kasino.status).toBe('ansoegt');
    koer(s, 12);
    expect(s.markeder.dk.vertikaler.kasino.status).toBe('aktiv');
    const betting = s.markeder.dk.spillerKunder.betting;
    expect(betting).toBeGreaterThan(0);
    const kasino: LiveProduct = { ...s.produkter.find((p) => p.id === 'lpX')!, id: 'lpK', typeId: 'slotsAggregator', themeId: 'eventyr', margin: 0.04, lanceretUge: s.uge };
    s.produkter.push(kasino);
    lanceringsKunder(s, kasino);
    expect(kasino.ventendeSpillere!.dk!).toBeGreaterThanOrEqual(betting * 0.2);
    expect(s.milepaele.andenVertikal).toBe(s.uge);
    koer(s, 3);
    expect(s.markeder.dk.spillerKunder.kasino).toBeGreaterThan(betting * 0.15);
  });
});
