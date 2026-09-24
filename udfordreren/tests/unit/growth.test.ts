import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng } from '../../src/sim/rng';
import { stepMut } from '../../src/sim/step';
import { ugentligStaff } from '../../src/sim/staff';
import { kontraktKvalitet } from '../../src/sim/contracts';
import { naesteRunde, kvartalsmoede } from '../../src/sim/investors';
import { ugentligGalla, galaScores } from '../../src/sim/gala';
import { xpTilNaeste } from '../../src/data/roles';
import { JOB_ADS, OFFICES } from '../../src/data/costs';
import { EXPOS } from '../../src/data/expos';
import type { Action, GameState, LiveProduct } from '../../src/sim/types';
import { fejl, koer, nyt } from './helpers';

const act = (s: GameState, a: Action) => applyActionMut(s, makeRng(s.rngState), a);

describe('Medarbejdere', () => {
  it('jobannonce giver kandidater; ansættelse kræver plads', () => {
    const s = nyt();
    s.kapital = 10;
    act(s, { t: 'postJobAd', niveau: 2 });
    expect(s.kandidater.length).toBe(JOB_ADS[1].antal);
    act(s, { t: 'hire', kandidatId: s.kandidater[0].id });
    expect(fejl(s)[0]).toMatch(/pladser/);
    s.kontor = 'kaelder';
    s.signaler = [];
    act(s, { t: 'hire', kandidatId: s.kandidater[0].id });
    expect(fejl(s)).toEqual([]);
    expect(s.staff.length).toBe(3);
  });
  it('headhunter giver bedre kandidater end jobportalen', () => {
    const snit = (niveau: 1 | 3) => {
      const s = nyt(11);
      s.kapital = 100;
      let sum = 0;
      for (let i = 0; i < 10; i++) {
        act(s, { t: 'postJobAd', niveau });
        for (const k of s.kandidater) sum += Object.values(k.stats).reduce((a, b) => a + b, 0);
      }
      return sum;
    };
    expect(snit(3)).toBeGreaterThan(snit(1) * 1.4);
  });
  it('energi falder under arbejde og genoprettes i hvile', () => {
    const s = nyt();
    const m = s.staff[0];
    ugentligStaff(s, makeRng(s.rngState), { [m.id]: 'projekt' });
    expect(m.energi).toBeLessThan(100);
    const e = m.energi;
    ugentligStaff(s, makeRng(s.rngState), {});
    expect(m.energi).toBeGreaterThan(e);
  });
  it('erfaring giver niveau og bedre stats', () => {
    const s = nyt();
    const m = s.staff[0];
    const foer = { ...m.stats };
    m.erfaring = xpTilNaeste(1) - 1;
    ugentligStaff(s, makeRng(s.rngState), { [m.id]: 'projekt' });
    expect(m.niveau).toBe(2);
    expect(m.stats.matematik).toBeGreaterThan(foer.matematik);
    expect(s.signaler.some((x) => x.k === 'niveauOp')).toBe(true);
  });
  it('ledig-signal når nogen går fra arbejde til ingenting', () => {
    const s = nyt();
    const m = s.staff[0];
    ugentligStaff(s, makeRng(s.rngState), { [m.id]: 'projekt' });
    s.signaler = [];
    ugentligStaff(s, makeRng(s.rngState), {});
    expect(s.signaler.find((x) => x.k === 'ledig')).toEqual({ k: 'ledig', staffIds: [m.id], ingenOpgaver: true });
  });
  it('træning koster penge og indsigt og løfter en stat', () => {
    const s = nyt();
    const m = s.staff[0];
    s.indsigt = 10;
    const foer = m.stats.matematik;
    act(s, { t: 'train', staffId: m.id, stat: 'matematik' });
    expect(m.stats.matematik).toBeGreaterThan(foer);
    expect(s.indsigt).toBe(7);
    expect(s.kapital).toBeLessThan(2);
  });
  it('rolleskift kræver niveau (kundeservice → compliance ved niveau 4)', () => {
    const s = nyt();
    s.kontor = 'kaelder';
    s.kapital = 5;
    s.indsigt = 50;
    act(s, { t: 'postJobAd', niveau: 1 });
    const k = s.kandidater[0];
    k.rolle = 'kundeservice';
    act(s, { t: 'hire', kandidatId: k.id });
    const m = s.staff[s.staff.length - 1];
    m.niveau = 3;
    s.signaler = [];
    act(s, { t: 'changeRole', staffId: m.id, nyRolle: 'compliance' });
    expect(fejl(s)[0]).toMatch(/niveau 4/);
    m.niveau = 4;
    s.signaler = [];
    act(s, { t: 'changeRole', staffId: m.id, nyRolle: 'compliance' });
    expect(fejl(s)).toEqual([]);
    expect(m.rolle).toBe('compliance');
  });
  it('udvikler → AI-ingeniør først fra 2026; marketing → CRM-specialist', () => {
    const s = nyt();
    s.indsigt = 50;
    const dev = s.staff.find((m) => m.rolle === 'udvikler')!;
    dev.niveau = 6;
    act(s, { t: 'changeRole', staffId: dev.id, nyRolle: 'aiIngenioer' });
    expect(fejl(s)[0]).toMatch(/2026/);
    s.uge = 52 * 14 + 1;
    s.signaler = [];
    act(s, { t: 'changeRole', staffId: dev.id, nyRolle: 'aiIngenioer' });
    expect(dev.rolle).toBe('aiIngenioer');
    const mk = { ...dev, id: 'mk', rolle: 'marketing' as const, niveau: 5 };
    s.staff.push(mk);
    const salg = mk.stats.salg;
    act(s, { t: 'changeRole', staffId: 'mk', nyRolle: 'marketing' });
    const m2 = s.staff.find((m) => m.id === 'mk')!;
    expect(m2.specialisering).toBe('crm');
    expect(m2.stats.salg).toBeGreaterThan(salg);
  });
  it('stiftere kan ikke fyres', () => {
    const s = nyt();
    act(s, { t: 'fire', staffId: s.staff[0].id });
    expect(fejl(s)[0]).toMatch(/stifter/);
  });
});

describe('Kontraktopgaver', () => {
  it('2-3 tilbud, binder folk og betaler ved levering', () => {
    const s = nyt();
    expect(s.kontraktTilbud.length).toBeGreaterThanOrEqual(2);
    expect(s.kontraktTilbud.length).toBeLessThanOrEqual(3);
    const t = s.kontraktTilbud[0];
    const m = s.staff[0];
    const forventet = t.betaling * kontraktKvalitet(t, [m]);
    act(s, { t: 'takeContract', contractId: t.id, staff: [m.id] });
    expect(s.kontraktopgaver.length).toBe(1);
    const kap = s.kapital;
    let betalt = 0;
    for (let i = 0; i < t.uger; i++) {
      stepMut(s, []);
      for (const x of s.signaler) if (x.k === 'kontraktFaerdig') betalt = x.betaling;
    }
    expect(betalt).toBeCloseTo(forventet, 2);
    expect(s.kontraktopgaver.length).toBe(0);
    expect(s.milepaele.foersteKontrakt).toBe(0);
    expect(s.kapital).toBeLessThan(kap + betalt + 0.01);
  });
  it('færre og dårligere betalte opgaver efter 2016', () => {
    const tael = (aar: number) => {
      let n = 0;
      let sum = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const s = nyt(seed);
        s.uge = (aar - 2012) * 52;
        s.kontraktTilbud = [];
        for (let i = 0; i < 20; i++) {
          stepMut(s, []);
          n += s.kontraktTilbud.length;
          sum += s.kontraktTilbud.reduce((a, b) => a + b.betaling, 0);
        }
      }
      return { n, snit: sum / Math.max(1, n) };
    };
    const foer = tael(2013);
    const efter = tael(2018);
    expect(efter.n).toBeLessThan(foer.n);
    expect(efter.snit).toBeLessThan(foer.snit);
  });
});

describe('Kontor', () => {
  it('kælder kræver kapital; kontor kræver også en Guldkupon', () => {
    const s = nyt();
    s.kapital = 0.5;
    act(s, { t: 'upgradeOffice' });
    expect(s.kontor).toBe('garage');
    s.kapital = 20;
    act(s, { t: 'upgradeOffice' });
    expect(s.kontor).toBe('kaelder');
    s.signaler = [];
    act(s, { t: 'upgradeOffice' });
    expect(s.kontor).toBe('kaelder');
    expect(fejl(s)[0]).toMatch(/Guldkupon/);
    s.milepaele.foersteGuldkupon = 10;
    act(s, { t: 'upgradeOffice' });
    expect(s.kontor).toBe('kontor');
    expect(s.kapital).toBeCloseTo(20 - OFFICES[1].pris - OFFICES[2].pris, 5);
  });
});

describe('2.0-versioner', () => {
  function medOriginal(s: GameState, alder: number): LiveProduct {
    const p: LiveProduct = {
      id: 'orig', navn: 'Kuponen', ejer: 'spiller', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, kvalitet: 0.6,
      lanceretUge: s.uge - alder, anmeldelser: [], total40: 30, guldkupon: false, hallOfFame: false, bsiPrUge: {}, samletBsi: 0, aktiv: true,
      features: [], fejl: 0, version: 1, bedstePlacering: {}, ugerITop10: 0, params: { spaending: 100, originalitet: 100, teknik: 100, tryghed: 100 },
    };
    s.produkter.push(p);
    return p;
  }
  it('starter med +20 % af originalens params og samme type/tema', () => {
    const s = nyt();
    koer(s, 60);
    medOriginal(s, 60);
    act(s, { t: 'startProject', project: { navn: 'Kuponen 2.0', typeId: 'prematch', themeId: 'haandbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.3, efterfoelgerAf: 'orig' } });
    expect(fejl(s)[0]).toMatch(/samme type og tema/);
    s.signaler = [];
    act(s, { t: 'startProject', project: { navn: 'Kuponen 2.0', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.3, efterfoelgerAf: 'orig' } });
    const p = s.projekter.find((x) => x.navn === 'Kuponen 2.0')!;
    expect(p.params.spaending).toBeCloseTo(20, 5);
  });
  it('lanceringen pensionerer originalen og tæller versionen op', () => {
    const s = nyt();
    koer(s, 60);
    medOriginal(s, 80);
    s.projekter = [];
    act(s, { t: 'startProject', project: { navn: 'Kuponen 2.0', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.3, efterfoelgerAf: 'orig' } });
    const p = s.projekter[0];
    p.klar = true;
    p.fase = 'test';
    act(s, { t: 'launch', projectId: p.id });
    const ny = s.produkter.find((x) => x.navn === 'Kuponen 2.0')!;
    expect(ny.version).toBe(2);
    expect(ny.efterfoelgerAf).toBe('orig');
    expect(s.produkter.find((x) => x.id === 'orig')!.aktiv).toBe(false);
  });
});

describe('Messer, gala og runder', () => {
  it('messevarsel, booking og resultat', () => {
    const s = nyt();
    const e = EXPOS.find((x) => x.id === 'sportsmessen')!;
    koer(s, e.ugeIAar - e.varselUger - 1);
    stepMut(s, []);
    expect(s.signaler.some((x) => x.k === 'messeVarsel' && x.expoId === e.id)).toBe(true);
    s.kapital = 5;
    act(s, { t: 'bookExpoStand', expoId: e.id, stoerrelse: 2 });
    expect(s.messeBookinger.length).toBe(1);
    const indsigt = s.indsigt;
    koer(s, e.varselUger - 1);
    stepMut(s, []);
    const res = s.signaler.find((x) => x.k === 'messe');
    expect(res && res.k === 'messe' && res.stoerrelse).toBe(2);
    expect(s.indsigt).toBeGreaterThan(indsigt);
  });
  it('gallaen i december afgøres mod konkurrenterne og giver belønning', () => {
    const s = nyt();
    koer(s, 49);
    s.aarAkk.bedsteTotal40 = 40;
    s.aarAkk.lanceringer = 1;
    const hype = s.hype;
    stepMut(s, []);
    expect(s.uge % 52).toBe(50);
    const g = s.galla.find((x) => x.aar === 2012)!;
    expect(g.kategorier.length).toBe(5);
    expect(g.vundet).toContain('produkt');
    expect(s.hype).toBeGreaterThan(hype);
    expect(s.signaler.some((x) => x.k === 'galla')).toBe(true);
  });
  it('uden lanceringer nomineres man ikke til Årets produkt', () => {
    const s = nyt();
    const sc = galaScores(s, makeRng(s.rngState));
    expect(sc.find((x) => x.id === 'produkt')!.nomineret).toBe(false);
    ugentligGalla(s, makeRng(s.rngState)); // ikke december → intet
    expect(s.galla.length).toBe(0);
  });
  it('runder kræver lanceringer og BSI, giver kapital og udvander', () => {
    const s = nyt();
    expect(naesteRunde(s).ok).toBe(false);
    act(s, { t: 'raiseRound' });
    expect(s.investorer.runde).toBe('ingen');
    for (let i = 0; i < 2; i++) s.produkter.push({ ...s.produkter[0], id: `sp${i}`, ejer: 'spiller' });
    s.bsiHistorik = Array(13).fill(0.05);
    expect(naesteRunde(s).ok).toBe(true);
    const kap = s.kapital;
    s.signaler = [];
    act(s, { t: 'raiseRound' });
    expect(s.investorer.runde).toBe('angel');
    expect(s.kapital).toBe(kap + 5);
    expect(s.investorer.ejerandelStiftere).toBeCloseTo(0.85, 5);
    expect(naesteRunde(s).def?.id).toBe('seed');
    expect(naesteRunde(s).ok).toBe(false);
  });
  it('kvartalsmøde evaluerer mål, giver stjerner og nye mål; pres kun med investorer', () => {
    const s = nyt();
    act(s, { t: 'takeContract', contractId: s.kontraktTilbud[0].id, staff: [s.staff[0].id] });
    koer(s, 12);
    stepMut(s, []);
    expect(s.uge).toBe(13);
    const sig = s.signaler.find((x) => x.k === 'kvartal');
    expect(sig && sig.k === 'kvartal' && sig.opfyldt).toBe(1);
    expect(s.investorer.stjerner).toBe(1);
    expect(s.investorer.pres).toBe(0);
    expect(s.kvartalsmaal.length).toBeGreaterThanOrEqual(1);
    expect(s.historik.length).toBe(1);
    s.investorer.runde = 'angel';
    s.kvartalsmaal = s.kvartalsmaal.map((g) => ({ ...g, kind: 'guldkupon', maal: 32 }));
    s.uge = 25;
    kvartalsmoede(s, makeRng(s.rngState));
    expect(s.uge).toBe(25);
    s.uge = 26;
    kvartalsmoede(s, makeRng(s.rngState));
    expect(s.investorer.pres).toBeGreaterThan(0);
  });
});

describe('Events', () => {
  it('ventende events løses med valg og effekter', () => {
    const s = nyt();
    s.ventendeEvents.push({ eventId: 'espresso', uge: 0, ctx: {} });
    const e0 = s.staff[0].energi = 50;
    act(s, { t: 'eventChoice', eventId: 'espresso', valg: 0 });
    expect(s.ventendeEvents.length).toBe(0);
    expect(s.staff[0].energi).toBe(e0 + 25);
    expect(s.flags).toContain('espresso');
    expect(s.eventLog[0]).toEqual({ uge: 0, eventId: 'espresso', valg: 0 });
  });
  it('medarbejder-event kan få en person til at forlade firmaet', () => {
    const s = nyt();
    const m = { ...s.staff[1], id: 'x1', stifter: false };
    s.staff.push(m);
    s.ventendeEvents.push({ eventId: 'headhunt', uge: 0, ctx: { staffId: 'x1', navn: m.navn } });
    act(s, { t: 'eventChoice', eventId: 'headhunt', valg: 1 });
    expect(s.staff.some((x) => x.id === 'x1')).toBe(false);
  });
});

describe('Auto-pause', () => {
  it('faseskift pauser kun ved tomt hold; ledige kun uden aktivt projekt', async () => {
    const { pauserFor } = await import('../../src/sim/signals');
    expect(pauserFor({ k: 'fase', projectId: 'p', til: 'design', tomtHold: false })).toBe(false);
    expect(pauserFor({ k: 'fase', projectId: 'p', til: 'design', tomtHold: true })).toBe(true);
    expect(pauserFor({ k: 'ledig', staffIds: ['a'], ingenOpgaver: false })).toBe(false);
    expect(pauserFor({ k: 'ledig', staffIds: ['a'], ingenOpgaver: true })).toBe(true);
    expect(pauserFor({ k: 'anmeldelse', productId: 'x' })).toBe(true);
    expect(pauserFor({ k: 'point', projectId: 'p', staffId: 's', params: { spaending: 1, originalitet: 1, teknik: 1, tryghed: 1 }, fejl: 0, fjernet: 0 })).toBe(false);
  });
});

describe('Standardhold og events', () => {
  it('nyt projekt får de op til 3 stærkeste udhvilede pr. fase', () => {
    const s = nyt();
    s.kontor = 'kaelder';
    s.kapital = 10;
    for (let i = 0; i < 3; i++) s.staff.push({ ...s.staff[1], id: `ex${i}`, stifter: false, energi: i === 0 ? 10 : 90 });
    act(s, { t: 'startProject', project: { navn: 'X', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.15 } });
    const p = s.projekter[0];
    for (const f of ['koncept', 'design', 'teknik', 'test'] as const) {
      expect(p.faseTildeling[f].length).toBeLessThanOrEqual(3);
      expect(p.faseTildeling[f]).not.toContain('ex0');
    }
  });
  it('samme event kommer ikke igen inden for cooldown, og der er luft mellem events', async () => {
    const { ugentligeEvents, EVENT_COOLDOWN } = await import('../../src/sim/events');
    const s = nyt();
    s.uge = 60;
    s.eventLog.push({ uge: 58, eventId: 'journalist', valg: 0 });
    for (let i = 0; i < 50; i++) ugentligeEvents(s, makeRng(s.rngState));
    expect(s.ventendeEvents.length).toBe(0); // under 4 uger siden sidste event
    s.uge = 58 + EVENT_COOLDOWN - 1;
    s.markeder.dk.spillerKunder.betting = 5000;
    for (let i = 0; i < 400 && s.ventendeEvents.length === 0; i++) ugentligeEvents(s, makeRng(s.rngState));
    expect(s.ventendeEvents.some((e) => e.eventId === 'journalist')).toBe(false);
  });
});

describe('Hjem fra kontrakt', () => {
  it('folk, der kommer hjem fra en opgave, hopper på det aktive projekt', () => {
    const s = nyt();
    const t = s.kontraktTilbud[0];
    const ude = s.staff[1];
    act(s, { t: 'takeContract', contractId: t.id, staff: [ude.id] });
    act(s, { t: 'startProject', project: { navn: 'P', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.07, intensitet: 3, budget: 0.15 } });
    const p = s.projekter[0];
    expect(p.faseTildeling.koncept).not.toContain(ude.id);
    koer(s, t.uger);
    const q = s.projekter[0];
    expect(q.faseTildeling[q.fase]).toContain(ude.id);
    expect(q.faseTildeling.test).toContain(ude.id);
  });
});
