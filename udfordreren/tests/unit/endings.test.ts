import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng, seedState } from '../../src/sim/rng';
import { afslut, eftermaele, eftertanke, klassificer, kvartalsSlut, laasOpArkiv } from '../../src/sim/endings';
import { nytSpil, arvFra, MODE_START, MODE_KAPITAL } from '../../src/sim/newgameplus';
import { SIDSTE_UGE } from '../../src/sim/time';
import { KONKURS_UGER } from '../../src/data/costs';
import { ARKIV, ARKIV_BY_ID, EFTERTANKE } from '../../src/data/archive';
import { SLUT_IDS, SLUT_KRAV } from '../../src/data/endings';
import { nyhed } from '../../src/sim/util';
import type { Action, GameState } from '../../src/sim/types';
import { koer, nyt } from './helpers';

const act = (s: GameState, a: Action) => applyActionMut(s, makeRng(s.rngState), a);

function godtEftermaele(s: GameState): void {
  s.eftermaeleAkk = { tillidSum: 90 * 500, tillidUger: 500, risikoSum: 0.04 * 100, risikoProever: 100, maxSanktion: 0, dkTabt: false };
  s.galla = [{ aar: 2020, vundet: ['produkt', 'innovation', 'ansvar', 'udfordrer', 'platform'], kategorier: [] }, { aar: 2021, vundet: ['produkt', 'ansvar', 'udfordrer', 'innovation', 'platform'], kategorier: [] }];
  for (const p of s.produkter.filter((x) => x.ejer !== 'spiller').slice(0, 6)) {
    const q = structuredClone(p);
    q.id = `${p.id}-g`;
    q.ejer = 'spiller';
    q.guldkupon = true;
    q.hallOfFame = true;
    s.produkter.push(q);
  }
  for (let i = 0; i < 30; i++) s.kombinationsbog[`k${i}`] = { set: true, bedste40: 30 };
}

describe('Slutninger (6.17)', () => {
  it('der er otte slutninger', () => {
    expect(SLUT_IDS.length).toBe(8);
  });
  it('konkurs efter otte uger i minus', () => {
    const s = nyt();
    koer(s, 1);
    for (let i = 0; i < KONKURS_UGER + 2 && !s.slut; i++) {
      s.kapital = -5;
      koer(s, 1);
    }
    expect(s.slut?.id).toBe('konkurs');
    expect(s.slut?.vaerdi).toBe(0);
  });
  it('accepteret tilbud giver exit med prisen som værdi', () => {
    const s = nyt();
    koer(s, 1);
    s.opkoebstilbud = { competitorId: 'betssen', pris: 40, udloeberUge: s.uge + 8, markedsandel: 0.1 };
    expect(act(s, { t: 'acceptOffer', competitorId: 'betssen' })).toBe(true);
    expect(s.slut).toMatchObject({ id: 'exit', vaerdi: 40, stifterVaerdi: 40 });
  });
  it('Danske Lykke kan byde på en mindre udfordrer, og så er det den slutning', () => {
    const s = nyt();
    koer(s, 1);
    s.uge = 52 * 6;
    s.markeder.dk.licens = 'aktiv';
    s.markeder.dk.andele.spiller = 0.04;
    let n = 0;
    while (!s.opkoebstilbud && n < 500) kvartalsSlut(s, makeRng(seedState(n++)));
    expect(s.opkoebstilbud?.competitorId).toBe('danskeLykke');
    expect(act(s, { t: 'acceptOffer', competitorId: 'danskeLykke' })).toBe(true);
    expect(s.slut?.id).toBe('danskeLykke');
  });
  it('tabt dansk licens uden andre bærende markeder slutter spillet', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.licens = 'inddraget';
    koer(s, 1);
    expect(s.slut?.id).toBe('tabtLicens');
  });
  it('tabt dansk licens med et bærende marked fortsætter', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.licens = 'inddraget';
    s.markeder.uk.licens = 'aktiv';
    s.markeder.uk.spillerKunder = { betting: 5000, kasino: 0 };
    koer(s, 1);
    expect(s.slut).toBeNull();
  });
  it('ved tidens ende klassificeres slutningen', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.licens = 'aktiv';
    s.uge = SIDSTE_UGE - 1;
    koer(s, 1);
    expect(s.slut).not.toBeNull();
    expect(SLUT_IDS).toContain(s.slut!.id);
    expect(s.signaler.some((x) => x.k === 'slut')).toBe(true);
  });
  it('klassifikationen dækker de fem slutninger ved tidens ende', () => {
    const basis = () => {
      const s = nyt();
      koer(s, 1);
      s.markeder.dk.licens = 'aktiv';
      return s;
    };
    const svag = basis();
    expect(klassificer(svag)).toBe('danskeLykke');
    const rig = basis();
    rig.bsiHistorik = Array(13).fill(SLUT_KRAV.boersVaerdi);
    expect(klassificer(rig)).toBe('boersnotering');
    const b2b = basis();
    b2b.platforme.sportsbook.b2bKunder = SLUT_KRAV.leverandoerKunder;
    expect(klassificer(b2b)).toBe('leverandoer');
    const ai = basis();
    for (let i = 0; i < SLUT_KRAV.aiAgenter; i++) ai.agenter.push({ id: `a${i}`, funktion: 'udvikling', kapacitet: 4, computePrUge: 0.05, fejlrate: 0.02, overvaagning: 0.6 });
    expect(klassificer(ai)).toBe('aiNativeLeder');
    const ansvarlig = basis();
    godtEftermaele(ansvarlig);
    expect(eftermaele(ansvarlig).total).toBeGreaterThanOrEqual(SLUT_KRAV.ansvarligEftermaele);
    expect(klassificer(ansvarlig)).toBe('ansvarligUdfordrer');
    ansvarlig.flags.push('haftOffshoreBrand');
    expect(klassificer(ansvarlig)).not.toBe('ansvarligUdfordrer');
    const tabt = basis();
    tabt.markeder.dk.licens = 'inddraget';
    expect(klassificer(tabt)).toBe('tabtLicens');
  });
  it('eftermælet er 0-100 og består af seks dele', () => {
    const s = nyt();
    koer(s, 1);
    const e = eftermaele(s);
    expect(e.dele.length).toBe(6);
    expect(e.total).toBeGreaterThanOrEqual(0);
    godtEftermaele(s);
    const g = eftermaele(s);
    expect(g.total).toBeLessThanOrEqual(100);
    for (const d of g.dele) expect(d.point).toBeLessThanOrEqual(d.maks);
  });
  it('slutningen registrerer værdi, stifternes andel og eftermæle', () => {
    const s = nyt();
    koer(s, 1);
    s.investorer.ejerandelStiftere = 0.5;
    afslut(s, 'boersnotering', 100);
    expect(s.slut).toMatchObject({ id: 'boersnotering', vaerdi: 100, stifterVaerdi: 50 });
    afslut(s, 'konkurs');
    expect(s.slut?.id).toBe('boersnotering');
  });
});

describe('Eftertanke og Arkivet (6.17, 6.18)', () => {
  it('Arkivet har et opslag pr. fakta i 7.15, og alle eftertankekort peger på et opslag', () => {
    expect(ARKIV.length).toBe(18);
    for (const k of EFTERTANKE) expect(ARKIV_BY_ID[k.arkivId]).toBeDefined();
  });
  it('tre kort ved slutningen', () => {
    const s = nyt();
    koer(s, 1);
    s.flags.push('haftOffshoreBrand');
    s.markeder.se.licens = 'aktiv';
    const k = eftertanke(s);
    expect(k.length).toBe(3);
    expect(k[0].id).toBe('offshore');
  });
  it('opslag låses op af nyheder, markeder og konkurrenter', () => {
    const s = nyt();
    expect(s.arkiv).toContain('a1');
    nyhed(s, 'Test', 'konkurrent', 'a15');
    expect(s.arkiv).toContain('a15');
    laasOpArkiv(s, 'us-pm');
    expect(s.arkiv).toContain('a14');
    laasOpArkiv(s, 'fiktiv-ai');
    expect(s.arkiv.length).toBe(3);
  });
});

describe('New Game+ (6.17)', () => {
  const opts = { seed: 9, firmaNavn: 'Plus', stiftere: ['oddssaetteren', 'udvikleren'] as [string, string], startVertikal: 'betting' as const, tutorial: false };
  it('kombinationsbogen og niveauerne bevares', () => {
    const gammel = nyt(3);
    gammel.kombinationsbog['prematch|fodbold'] = { set: true, bedste40: 33 };
    gammel.niveauer.type.prematch = 4;
    const s = nytSpil({ ...opts, arv: arvFra(gammel) });
    expect(s.kombinationsbog['prematch|fodbold']?.bedste40).toBe(33);
    expect(s.niveauer.type.prematch).toBe(4);
    expect(s.uge).toBe(0);
  });
  it('2018-start i USA', () => {
    const s = nytSpil({ ...opts, mode: 'usa2018' });
    expect(s.uge).toBe(MODE_START.usa2018);
    expect(s.mode).toBe('usa2018');
    expect(s.markeder.us.licens).toBe('aktiv');
    expect(s.markeder.dk.licens).toBe('ingen');
    expect(s.kapital).toBe(MODE_KAPITAL.usa2018);
    expect(s.staff.length).toBe(2);
    expect(s.produkter.some((p) => p.ejer === 'spiller')).toBe(false);
    koer(s, 4);
    expect(s.slut).toBeNull();
  });
  it('AI-native fra 2026 starter med agenter, og verdensbilledet trækkes i første uge', () => {
    const s = nytSpil({ ...opts, mode: 'aiNative2026' });
    expect(s.agenter.length).toBe(3);
    expect(s.markeder.dk.licens).toBe('aktiv');
    koer(s, 1);
    expect(s.flags).toContain('aktTo');
    expect(s.signaler.some((x) => x.k === 'aktSkift')).toBe(true);
  });
});
