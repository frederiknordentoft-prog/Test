import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng, seedState } from '../../src/sim/rng';
import { stepMut } from '../../src/sim/step';
import { offshoreAndele, offshoreDynPp, offshoreRefPp, markedTotalBsi, ugentligtOffshoreBrand } from '../../src/sim/offshore';
import { regelEffekt, effektivBonus, ugentligRegulering, aktiverRegel } from '../../src/sim/regulation';
import { sanktioner, inddragLicens } from '../../src/sim/trust';
import { trendEffekt, startTrend, ugentligeTrends } from '../../src/sim/trends';
import { effektivCac, licenseretBsiKurve } from '../../src/sim/customers';
import { effektivAfgift } from '../../src/sim/economy';
import { SPORTSKALENDER } from '../../src/data/trends';
import { OFFSHORE_FORMEL } from '../../src/data/offshore';
import { ugeFor } from '../../src/sim/time';
import type { Action, GameState } from '../../src/sim/types';
import { fejl, koer, nyt } from './helpers';

const act = (s: GameState, a: Action) => applyActionMut(s, makeRng(s.rngState), a);
const rng = () => makeRng(seedState(5));

describe('Offshore-model (7.8)', () => {
  it('kasino lækker 3x mere end betting', () => {
    const a = offshoreAndele(10);
    expect(a.kasino).toBeCloseTo(0.15, 5);
    expect(a.betting).toBeCloseTo(0.05, 5);
  });
  it('højere afgift og strenghed giver mere offshore; blokering og kvalitet giver mindre', () => {
    const s = nyt();
    koer(s, 1);
    const basis = offshoreDynPp(s, 'dk');
    s.markeder.dk.afgiftTillaeg = 10;
    expect(offshoreDynPp(s, 'dk') - basis).toBeCloseTo(OFFSHORE_FORMEL.afgift * 10, 5);
    s.markeder.dk.afgiftTillaeg = 0;
    s.markeder.dk.strenghed = 4;
    expect(offshoreDynPp(s, 'dk')).toBeGreaterThan(basis);
    s.markeder.dk.strenghed = 2;
    s.markeder.dk.blokering.betaling = 0;
    expect(offshoreDynPp(s, 'dk')).toBeCloseTo(basis - OFFSHORE_FORMEL.betaling, 5);
    s.markeder.dk.blokering.betaling = null;
    for (const p of s.produkter) p.kvalitet = 0.95;
    expect(offshoreDynPp(s, 'dk')).toBeLessThan(basis);
  });
  it('DNS-blokering halveres efter 2 år', () => {
    const s = nyt();
    s.markeder.dk.blokering.dns = 0;
    s.uge = 10;
    const tidlig = offshoreDynPp(s, 'dk');
    s.uge = 110;
    const sen = offshoreDynPp(s, 'dk');
    expect(sen).toBeGreaterThan(tidlig);
  });
  it('krypto-boom lægger procentpoint på begge vertikaler', () => {
    const s = nyt();
    koer(s, 1);
    startTrend(s, 'kryptoBoom', 52);
    expect(trendEffekt(s, 'dk').offshorePp).toBe(5);
    koer(s, 1);
    const ref = offshoreAndele(offshoreDynPp(s, 'dk'));
    expect(s.markeder.dk.offshore.betting - ref.betting).toBeCloseTo(0.05, 3);
  });
  it('markedets total = licenseret kurve / (1 − reference-offshore)', () => {
    const uge = ugeFor(2024, 6);
    const ref = offshoreAndele(offshoreRefPp('dk', uge)).kasino;
    expect(markedTotalBsi('dk', 'kasino', uge)).toBeCloseTo(licenseretBsiKurve('dk', 'kasino', uge) / (1 - ref), 6);
  });
});

describe('Markeder og licenser', () => {
  it('Sverige åbner i 2019 med signal; Norge kan aldrig få licens', () => {
    const s = nyt();
    s.kapital = 50;
    act(s, { t: 'applyLicense', market: 'se', vertical: 'betting' });
    expect(fejl(s)[0]).toMatch(/åbner/);
    s.uge = ugeFor(2019, 0) - 1;
    stepMut(s, []);
    expect(s.markeder.se.aaben).toBe(true);
    expect(s.signaler.some((x) => x.k === 'markedAabner' && x.marked === 'se')).toBe(true);
    s.signaler = [];
    act(s, { t: 'applyLicense', market: 'no', vertical: 'kasino' });
    expect(fejl(s)[0]).toMatch(/monopol/);
    s.signaler = [];
    act(s, { t: 'applyLicense', market: 'se', vertical: 'betting' });
    expect(s.markeder.se.vertikaler.betting.status).toBe('ansoegt');
    koer(s, 20);
    expect(s.markeder.se.licens).toBe('aktiv');
  });
  it('konkurrenterne går ind, når et marked åbner', () => {
    const s = nyt();
    s.uge = ugeFor(2019, 0) - 1;
    stepMut(s, []);
    const ejere = new Set(s.produkter.filter((p) => p.aktiv && p.markeder.includes('se')).map((p) => p.ejer));
    expect(ejere.has('bet356')).toBe(true);
    expect(ejere.size).toBeGreaterThanOrEqual(4);
  });
  it('UK beskatter kasino 40 % fra april 2026', () => {
    const s = nyt();
    s.uge = ugeFor(2026, 4);
    stepMut(s, []);
    expect(effektivAfgift(s, 'uk', 'kasino', 0.04)).toBeCloseTo(0.4, 5);
    expect(effektivAfgift(s, 'uk', 'betting', 0.08)).toBeCloseTo(0.15, 5);
  });
  it('Tyskland beskatter indsats: høj margin giver lavere effektiv afgift', () => {
    const s = nyt();
    expect(effektivAfgift(s, 'de', 'kasino', 0.03)).toBeGreaterThan(effektivAfgift(s, 'de', 'kasino', 0.06));
  });
});

describe('Regulering (7.7)', () => {
  it('historiske regler annonceres i forvejen og træder i kraft på datoen (Spilpakke 1)', () => {
    const s = nyt();
    s.markeder.dk.licens = 'aktiv';
    s.uge = ugeFor(2026, 6) - 30;
    ugentligRegulering(s, rng());
    expect(s.planlagteRegler.some((p) => p.regelId === 'dkSpilpakke1')).toBe(true);
    expect(s.signaler.some((x) => x.k === 'regel' && x.varsel)).toBe(true);
    s.uge = ugeFor(2026, 6);
    ugentligRegulering(s, rng());
    expect(s.markeder.dk.regler).toContain('dkSpilpakke1');
    expect(regelEffekt(s, 'dk').bonusMax).toBe(1);
    expect(regelEffekt(s, 'dk').cac.tv).toBeCloseTo(0.4, 5);
  });
  it('bonusloft begrænser den effektive bonus i markedet', () => {
    const s = nyt();
    s.bonusNiveau = 3;
    expect(effektivBonus(s, 'dk')).toBe(3);
    aktiverRegel(s, rng(), 'dk', 'bonusloft');
    expect(effektivBonus(s, 'dk')).toBe(1);
  });
  it('lukkede kanaler og dyrere CAC fra regler', () => {
    const s = nyt();
    const foer = effektivCac(s, 'tv', 'dk')!;
    aktiverRegel(s, rng(), 'dk', 'reklamevindue');
    expect(effektivCac(s, 'tv', 'dk')!).toBeCloseTo(foer * 1.4, 3);
    aktiverRegel(s, rng(), 'dk', 'streamerForbud');
    expect(regelEffekt(s, 'dk').lukket).toContain('streamere');
  });
  it('pres ≥ 3 planlægger en dynamisk regel 52-104 uger ude og nulstiller presset til 1', () => {
    const s = nyt();
    s.uge = 100;
    s.markeder.dk.politiskPres = 3.2;
    ugentligRegulering(s, rng());
    const p = s.planlagteRegler.find((x) => x.marked === 'dk' && x.dynamisk)!;
    expect(p).toBeDefined();
    expect(p.ikrafttraedelseUge - 100).toBeGreaterThanOrEqual(52);
    expect(p.ikrafttraedelseUge - 100).toBeLessThanOrEqual(104);
    expect(s.markeder.dk.politiskPres).toBe(1);
    s.uge = p.ikrafttraedelseUge;
    ugentligRegulering(s, rng());
    expect(s.markeder.dk.regler).toContain(p.regelId);
  });
  it('afgiftsstigning hæver afgiften 3-8 pp', () => {
    const s = nyt();
    aktiverRegel(s, rng(), 'dk', 'afgiftsstigning');
    expect(s.markeder.dk.afgiftTillaeg).toBeGreaterThanOrEqual(3);
    expect(s.markeder.dk.afgiftTillaeg).toBeLessThanOrEqual(8);
    expect(effektivAfgift(s, 'dk', 'kasino', 0.04)).toBeCloseTo(0.2 + s.markeder.dk.afgiftTillaeg / 100, 5);
  });
  it('R11: kanalisering under målet i 2 år udløser blokering eller lempelse', () => {
    let blokering = 0;
    let lempelse = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = nyt(seed);
      s.uge = 200;
      s.markeder.dk.kanalisering = 0.8;
      s.markeder.dk.lavKanaliseringUger = 103;
      ugentligRegulering(s, makeRng(seedState(seed)));
      const p = s.planlagteRegler.find((x) => x.dynamisk);
      if (p?.regelId === 'betalingsblokering' || p?.regelId === 'dnsBlokering') blokering++;
      if (p?.regelId === 'lempelse') lempelse++;
      expect(s.markeder.dk.lavKanaliseringUger).toBe(0);
    }
    expect(blokering).toBeGreaterThan(8);
    expect(lempelse).toBeGreaterThan(2);
    expect(blokering).toBeGreaterThan(lempelse);
  });
});

describe('Tilsynstillid og sanktioner (7.12)', () => {
  function med(trin: 0 | 1 | 2 | 3, tillid: number): GameState {
    const s = nyt();
    s.markeder.dk.licens = 'aktiv';
    s.markeder.dk.vertikaler.betting.status = 'aktiv';
    s.markeder.dk.tilsynstillid = tillid;
    s.markeder.dk.sanktion.trin = trin;
    return s;
  }
  it('trappen går påbud → bøde → gennemgang → inddragelse', () => {
    const s = med(0, 5);
    const r = makeRng(seedState(1));
    for (let i = 0; i < 30 && s.markeder.dk.licens !== 'inddraget'; i++) {
      if (s.markeder.dk.licens === 'suspenderet') s.markeder.dk.licens = 'aktiv';
      sanktioner(s, r);
    }
    const trin = s.signaler.filter((x) => x.k === 'sanktion').map((x) => (x as { trin: number }).trin);
    expect(trin).toEqual([1, 2, 3, 4]);
    expect(s.markeder.dk.licens).toBe('inddraget');
  });
  it('bøden trækkes fra kassen; gennemgang suspenderer licensen i 8 uger', () => {
    const s = med(1, 30);
    s.kapital = 10;
    const r = makeRng(seedState(2));
    for (let i = 0; i < 20 && s.markeder.dk.sanktion.trin < 2; i++) sanktioner(s, r);
    expect(s.kapital).toBeLessThan(10);
    s.markeder.dk.tilsynstillid = 20;
    for (let i = 0; i < 20 && s.markeder.dk.sanktion.trin < 3; i++) sanktioner(s, r);
    expect(s.markeder.dk.licens).toBe('suspenderet');
    expect(s.markeder.dk.suspenderetTil).toBe(s.uge + 8);
  });
  it('ingen sanktion over grænsen, og rolige kvartaler fører trappen ned', () => {
    const s = med(2, 80);
    const r = makeRng(seedState(3));
    for (let i = 0; i < 4; i++) sanktioner(s, r);
    expect(s.signaler.some((x) => x.k === 'sanktion')).toBe(false);
    expect(s.markeder.dk.sanktion.trin).toBe(1);
  });
  it('tabt dansk licens koster −15 i tilsynstillid i alle andre markeder', () => {
    const s = nyt();
    const foer = s.markeder.se.tilsynstillid;
    inddragLicens(s, 'dk', 'test');
    expect(s.markeder.se.tilsynstillid).toBe(foer - 15);
    expect(s.markeder.dk.spillerKunder.betting).toBe(0);
  });
  it('suspenderede markeder giver ingen BSI', () => {
    const s = nyt();
    koer(s, 13);
    s.markeder.dk.licens = 'suspenderet';
    s.markeder.dk.suspenderetTil = s.uge + 8;
    s.markeder.dk.spillerKunder.betting = 1000;
    stepMut(s, []);
    expect(s.markeder.dk.spillerBsiPrUge.betting).toBe(0);
    expect(s.markeder.dk.spillerKunder.betting).toBeLessThan(1000);
  });
});

describe('Trends og sportskalender (7.9)', () => {
  it('VM/EM starter på de rigtige år og hæver betting', () => {
    const vm22 = SPORTSKALENDER.find((x) => x.titel === 'VM 2022')!;
    expect(vm22.uge).toBeGreaterThan(ugeFor(2022, 10));
    const s = nyt();
    const em = SPORTSKALENDER[0];
    s.uge = em.uge - 1;
    stepMut(s, []);
    expect(s.trends.some((t) => t.id === 'em')).toBe(true);
    expect(trendEffekt(s, 'dk').bettingBsi).toBeGreaterThan(0.1);
    expect(trendEffekt(s, 'us').bettingBsi).toBe(0);
    s.uge = em.uge + em.uger;
    ugentligeTrends(s, rng());
    expect(s.trends.some((t) => t.id === 'em')).toBe(false);
  });
  it('covid i 2020 sænker betting og hæver kasino', () => {
    const s = nyt();
    s.uge = ugeFor(2020, 2) + 1;
    stepMut(s, []);
    const e = trendEffekt(s, 'dk');
    expect(e.bettingBsi).toBeLessThan(-0.5);
    expect(e.kasinoBsi).toBeGreaterThan(0.1);
  });
  it('dokumentarer hæver presset i ét marked', () => {
    const s = nyt();
    const foer = s.markeder.dk.politiskPres;
    startTrend(s, 'dokumentar', 26, undefined, ['dk']);
    expect(s.markeder.dk.politiskPres).toBe(foer + 1);
    expect(s.markeder.se.politiskPres).toBe(foer);
  });
});

describe('Offshore-fristelsen (6.10)', () => {
  it('kræver et lanceret produkt og koster opstart; giver grå BSI fra Norge og offshore-puljer', () => {
    const s = nyt();
    act(s, { t: 'setOffshoreBrand', aktiv: true });
    expect(fejl(s)[0]).toMatch(/lanceret/);
    s.produkter.push({ ...s.produkter[0], id: 'mig', ejer: 'spiller', typeId: 'slotsAggregator', kvalitet: 0.7 });
    s.kapital = 10;
    s.signaler = [];
    act(s, { t: 'setOffshoreBrand', aktiv: true });
    expect(s.offshoreBrand).toBe(true);
    expect(s.kapital).toBe(8);
    expect(s.flags).toContain('haftOffshoreBrand');
    koer(s, 1);
    expect(s.markeder.no.offshoreBrandBsiPrUge).toBeGreaterThan(0);
  });
  it('afsløring inddrager licenserne i alle regulerede markeder', () => {
    let afsloeret: GameState | null = null;
    for (let seed = 1; seed <= 400 && !afsloeret; seed++) {
      const s = nyt();
      s.offshoreBrand = true;
      s.produkter.push({ ...s.produkter[0], id: 'mig', ejer: 'spiller' });
      s.markeder.dk.licens = 'aktiv';
      ugentligtOffshoreBrand(s, makeRng(seedState(seed)));
      if ((s.markeder.dk.licens as string) === 'inddraget') afsloeret = s;
    }
    expect(afsloeret).not.toBeNull();
    expect(afsloeret!.offshoreBrand).toBe(false);
    expect(afsloeret!.ventendeEvents.some((e) => e.eventId === 'offshoreAfsloeret')).toBe(true);
  });
});
