// Sim-rettelser fra fase 4-6-spiltesten: byen under hyperpersonalisering, AI-uheldenes pris, værdiansættelse,
// investorpres, Norges licensregime og AI-øjeblikke i tidslinjen.
import { describe, expect, it } from 'vitest';
import { byDrivere } from '../../src/sim/town';
import { eventChoice, udloesEvent } from '../../src/sim/events';
import { aarligBsi } from '../../src/sim/economy';
import { resultatMargin, vaerdiansaettelse } from '../../src/sim/investors';
import { licensPris } from '../../src/sim/markets';
import { setHyperpersonalisering } from '../../src/sim/world';
import { BY } from '../../src/data/town';
import { MARKETS } from '../../src/data/markets';
import { R8 } from '../../src/data/reactionRules';
import { koer, nyt } from './helpers';

describe('Byen under hyperpersonalisering', () => {
  it('uden risikoagent: flere glider mod gul/rød, og færre kommer tilbage', () => {
    const s = nyt();
    const foer = byDrivere(s, 'dk');
    s.hyperpersonalisering.aktiv = true;
    const uden = byDrivere(s, 'dk');
    expect(uden.skade / foer.skade).toBeCloseTo(1 + BY.hyper, 5);
    expect(uden.bedring).toBe(BY.hyperBedring);
    s.agenter.push({ id: 'r', funktion: 'risiko', kapacitet: 3, computePrUge: 0.02, fejlrate: 0.01, overvaagning: 0.8 });
    s.platforme.kontoplatform.dataejerskab = 1;
    const med = byDrivere(s, 'dk');
    expect(med.bedring).toBe(1);
    expect(med.skade).toBeLessThan(uden.skade);
  });
});

describe('AI-uheldenes pris følger firmaets størrelse', () => {
  it('bsiUger koster så mange ugers gennemsnitlige BSI', () => {
    const s = nyt();
    s.bsiHistorik = Array(13).fill(40);
    s.kapital = 1000;
    udloesEvent(s, 'aiUheld_trading', { agentId: 'x', navn: 'Agent Et' });
    expect(eventChoice(s, 'aiUheld_trading', 0)).toBe(true);
    // −0,6 mio. fast og én uges BSI (40 mio.)
    expect(s.kapital).toBeCloseTo(1000 - 0.6 - aarligBsi(s) / 52, 5);
  });
});

describe('Værdiansættelse', () => {
  it('en negativ kasse trækker værdien ned', () => {
    const s = nyt();
    s.bsiHistorik = Array(13).fill(10);
    s.kapital = 100;
    const plus = vaerdiansaettelse(s);
    s.kapital = -100;
    expect(vaerdiansaettelse(s)).toBeCloseTo(plus - 200, 1);
  });
  it('et underskud det seneste år giver en lavere multipel end et overskud', () => {
    const s = nyt();
    s.bsiHistorik = Array(13).fill(10);
    s.kapital = 0;
    const kvartal = (resultat: number) => ({ aar: 2020, kvartal: 1, bsi: 130, resultat, kapital: 0, kunder: 0, lanceringer: 0, bedsteTotal40: 0, top10: false });
    s.historik = [kvartal(20), kvartal(20), kvartal(20), kvartal(20)];
    const overskud = vaerdiansaettelse(s);
    expect(resultatMargin(s)).toBeCloseTo(20 / 130, 5);
    s.historik = [kvartal(-100), kvartal(-100), kvartal(-100), kvartal(-100)];
    expect(vaerdiansaettelse(s)).toBeLessThan(overskud * 0.5);
  });
});

describe('Investorpres', () => {
  it('bestyrelsesmødet kommer højst én gang om året', () => {
    const s = nyt();
    koer(s, 1);
    s.investorer.runde = 'seed';
    s.investorer.pres = 5;
    s.eventLog.push({ uge: s.uge, eventId: 'investorPres', valg: 2 });
    s.uge = 12;
    koer(s, 1); // kvartalsslut i uge 13
    expect(s.ventendeEvents.some((e) => e.eventId === 'investorPres')).toBe(false);
    s.eventLog = [];
    s.investorer.pres = 5;
    s.uge = 25;
    koer(s, 1);
    expect(s.ventendeEvents.some((e) => e.eventId === 'investorPres')).toBe(true);
  });
});

describe('Norge efter monopolet', () => {
  it('licensen koster og tager tid, og der er afgift', () => {
    const s = nyt();
    s.verdensVurderinger.norgeAabner = 0;
    koer(s, 1);
    expect(s.markeder.no.aaben).toBe(true);
    const pris = licensPris(s, 'no');
    expect(pris.gebyr).toBe(MARKETS.no.licensGebyr);
    expect(pris.gebyr).toBeGreaterThan(0);
    expect(pris.uger).toBeGreaterThan(0);
    expect(s.markeder.no.afgift).toBeGreaterThan(0.1);
    expect(s.nyheder.some((n) => n.tekst.includes(MARKETS.no.beskrivelseAaben!))).toBe(true);
  });
});

describe('AI-øjeblikke i tidslinjen og R8', () => {
  it('hyperpersonalisering til og fra står i tidslinjen', () => {
    const s = nyt();
    s.hyperpersonalisering.aktiv = true;
    expect(setHyperpersonalisering(s, false)).toBe(true);
    expect(s.tidslinje.at(-1)).toMatchObject({ kind: 'ai', tekst: 'Hyperpersonalisering slået fra.' });
  });
  it('R8 koster branchens omdømme som i spec 7.6', () => {
    expect(R8.omdoemme).toBe(-1);
  });
});
