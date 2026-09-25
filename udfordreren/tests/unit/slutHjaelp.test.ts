// UI-hjælpere til slutskærmen, Arkivet, New Game+ og debug-menuen (fase 6). Rene funktioner.
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { ARKIV } from '../../src/data/archive';
import { arkivHint, arkivListe, arkivOpslag, nyhedArkivId } from '../../src/ui/lib/arkivHjaelp';
import { aarTekst, byUdvikling, ngPlusValg, tidslinjePrAar, trofaeer } from '../../src/ui/lib/slutHjaelp';
import { debugReaktion, hitlisteRaekker, tilfoejAgent, tvingVerden } from '../../src/ui/lib/debugHjaelp';
import { fletArv } from '../../src/store/persistence';
import { arvFra } from '../../src/sim/newgameplus';
import { koer, nyt } from './helpers';

describe('Arkivet (UI)', () => {
  it('alle opslag har et hint, og låste/ulåste følger game.arkiv', () => {
    const liste = arkivListe({ arkiv: ['a1', 'a6'] });
    expect(liste.length).toBe(ARKIV.length);
    expect(liste.filter((r) => !r.laast).map((r) => r.opslag.id)).toEqual(['a1', 'a6']);
    for (const r of liste) expect(r.hint).toMatch(/^Låses op/);
  });
  it('hintene bygger på lande, parodinavne og årstal', () => {
    expect(arkivHint('a6')).toContain('Sverige åbner');
    expect(arkivHint('a3')).toContain('Danske Lykke');
    expect(arkivHint('a18')).toContain('bet builder');
    expect(arkivHint('a11')).toContain('hvis Norge åbner');
  });
  it('alias-id\'er fra konkurrenter og nyheder oversættes', () => {
    expect(arkivOpslag('dk-statsselskab')?.id).toBe('a3');
    expect(nyhedArkivId({ arkivId: 'a15' })).toBe('a15');
    expect(nyhedArkivId({ arkivId: 'global-gigant-1' })).toBeUndefined();
    expect(nyhedArkivId({})).toBeUndefined();
  });
});

describe('Slutskærmen (UI)', () => {
  it('tidslinjen har alle år fra start til slut', () => {
    const s = nyt();
    s.tidslinje = [{ uge: 3, tekst: 'Start', kind: 'firma' }, { uge: 52 * 3 + 2, tekst: 'Pris', kind: 'pris' }];
    s.uge = 52 * 4;
    const aar = tidslinjePrAar(s);
    expect(aar.map((a) => a.aar)).toEqual([2012, 2013, 2014, 2015, 2016]);
    expect(aar[3].punkter.length).toBe(1);
    expect(tidslinjePrAar(s, 'firma').flatMap((a) => a.punkter).length).toBe(1);
  });
  it('gallapriserne samles pr. kategori, og milepælene sorteres', () => {
    const s = nyt();
    s.galla = [
      { aar: 2014, vundet: ['produkt'], kategorier: [] },
      { aar: 2015, vundet: ['produkt', 'udfordrer'], kategorier: [] },
    ];
    s.milepaele = { foersteLancering: 20, foersteKontrakt: 2 };
    const t = trofaeer(s);
    expect(t.gallaIalt).toBe(3);
    expect(t.galla[0]).toMatchObject({ id: 'produkt', aar: [2014, 2015] });
    expect(t.milepaele.map((m) => m.id)).toEqual(['foersteKontrakt', 'foersteLancering']);
    expect(aarTekst([2014, 2015, 2019])).toBe('2014-2019');
  });
  it('byens udvikling springer tomme år over', () => {
    const s = nyt();
    s.byAarlig = [
      { aar: 2012, rekreativ: 0, engageret: 0, vip: 0, risiko: 0, problem: 0 },
      { aar: 2013, rekreativ: 0.5, engageret: 0.3, vip: 0.1, risiko: 0.07, problem: 0.03 },
    ];
    expect(byUdvikling(s).map((r) => r.aar)[0]).toBe(2013);
  });
  it('New Game+ bruger samme firma og stiftere; USA-starten er altid betting', () => {
    const s = nyt(1, 'kasino');
    const o = ngPlusValg(s, 'usa2018', arvFra(s), 5);
    expect(o).toMatchObject({ seed: 5, firmaNavn: s.firmaNavn, startVertikal: 'betting', mode: 'usa2018', tutorial: false });
    expect(ngPlusValg(s, 'aiNative2026', undefined).startVertikal).toBe('kasino');
  });
  it('arven flettes: sete kombinationer og højeste niveauer bevares', () => {
    const a = arvFra(nyt());
    const b = arvFra(nyt());
    a.kombinationsbog.x = { set: true, bedste40: 30 };
    a.niveauer.type.prematch = 7;
    b.kombinationsbog.x = { set: true, bedste40: 20 };
    b.kombinationsbog.y = { set: true, bedste40: 25 };
    const f = fletArv(a, b);
    expect(f.kombinationsbog.x.bedste40).toBe(30);
    expect(f.kombinationsbog.y.set).toBe(true);
    expect(f.niveauer.type.prematch).toBe(7);
  });
});

describe('Debug-menuen (UI)', () => {
  it('en tvunget reaktion får effekt, nyhed og signal', () => {
    const s = koer(nyt(), 2);
    s.signaler = [];
    debugReaktion(s, 'R1', 'bet356', 'dk');
    expect(s.reaktioner.some((r) => r.regel === 'R1' && r.competitorId === 'bet356')).toBe(true);
    expect(s.signaler.some((x) => x.k === 'reaktion')).toBe(true);
    debugReaktion(s, 'R2', 'betssen', 'dk');
    expect(s.opkoebstilbud?.competitorId).toBe('betssen');
  });
  it('et tvunget scenarie udføres i næste uge', () => {
    const s = koer(nyt(), 2);
    tvingVerden(s, 'denHaardeHaand');
    koer(s, 1);
    expect(s.verdensscenarier.denHaardeHaand).toBe(1);
    expect(s.flags).toContain('haardHaand');
  });
  it('agent og hitlistens sim-værdier', () => {
    const s = koer(nyt(), 3);
    tilfoejAgent(s, 'risiko', 0.6);
    expect(s.agenter.length).toBe(1);
    const r = hitlisteRaekker(s, 'dk');
    expect(r.length).toBeGreaterThan(0);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    // Statsselskabet har hjemmebane i Danmark i starten
    expect(r.some((x) => x.hjemmebane > 1)).toBe(true);
  });
});
