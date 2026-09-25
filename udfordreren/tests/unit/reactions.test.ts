import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng, seedState } from '../../src/sim/rng';
import {
  aggressivitet, featureFordel, konkurrentMarketing, kvartalsReaktioner, nyeFeatures, r12Aktiv, spillerCacTillaeg,
  sponsorOmkostningPrUge, sponsorRabat, ugentligeReaktioner,
} from '../../src/sim/reactions';
import { markedsindtog, ugentligeKonkurrenter } from '../../src/sim/competitors';
import { ugentligRegulering } from '../../src/sim/regulation';
import { startTrend } from '../../src/sim/trends';
import { ugeFor } from '../../src/sim/time';
import { platformKvalitet, ugentligePlatforme } from '../../src/sim/platforms';
import { PLATFORM_MODELS, MIGRERING } from '../../src/data/platforms';
import { R1, R2, R3_FORDEL, R4, R5, R7 } from '../../src/data/reactionRules';
import { KONKURRENT_EVENTS, SPONSORATER } from '../../src/data/competitorEvents';
import { KANALISERINGSMAAL } from '../../src/data/regulationTimeline';
import type { Action, GameState, LiveProduct, MarketId } from '../../src/sim/types';
import { fejl, koer, nyt } from './helpers';

const act = (s: GameState, a: Action) => applyActionMut(s, makeRng(s.rngState), a);
const rng = (n = 5) => makeRng(seedState(n));
const konk = (s: GameState, id: string) => s.konkurrenter.find((c) => c.id === id)!;

/** Kør kvartalsreaktioner med skiftende seeds, indtil betingelsen er opfyldt */
function indtil(s: GameState, ok: (s: GameState) => boolean, forsoeg = 200): boolean {
  for (let i = 0; i < forsoeg; i++) {
    kvartalsReaktioner(s, rng(100 + i));
    if (ok(s)) return true;
  }
  return false;
}

function spillerProdukt(s: GameState, features: string[], markeder: MarketId[] = ['dk']): LiveProduct {
  const p = structuredClone(s.produkter.find((x) => x.ejer !== 'spiller' && x.aktiv)!);
  p.id = 'p-test';
  p.ejer = 'spiller';
  p.features = features;
  p.markeder = markeder;
  return p;
}

describe('R1 bonuskrig', () => {
  it('hurtig vækst over 5 % giver gigant-marketing ×1,5 og spillerens CAC +25 % i et år', () => {
    const s = nyt();
    koer(s, 1);
    s.andelHistorik.dk = [0.03, 0.035, 0.04, 0.045];
    s.markeder.dk.andele.spiller = 0.07;
    kvartalsReaktioner(s, rng());
    const r = s.reaktioner.find((x) => x.regel === 'R1');
    expect(r).toBeDefined();
    expect(konk(s, r!.competitorId!).arketype).toBe('globalGigant');
    expect(spillerCacTillaeg(s, 'dk')).toBeCloseTo(R1.cac, 5);
    expect(konkurrentMarketing(s, r!.competitorId!, 'dk')).toBeCloseTo(R1.marketing, 5);
    expect(konkurrentMarketing(s, r!.competitorId!, 'uk')).toBe(1);
    expect(r!.slutUge - s.uge).toBe(R1.uger);
    expect(s.reaktionsTaeller.R1).toBe(1);
    expect(s.signaler.some((x) => x.k === 'reaktion' && x.regel === 'R1')).toBe(true);
  });
  it('ingen bonuskrig ved lav andel eller langsom vækst', () => {
    const s = nyt();
    koer(s, 1);
    s.andelHistorik.dk = [0.065, 0.066, 0.067, 0.068];
    s.markeder.dk.andele.spiller = 0.07;
    kvartalsReaktioner(s, rng());
    expect(s.reaktionsTaeller.R1).toBe(0);
  });
});

describe('R2 opkøbstilbud', () => {
  function klar(): GameState {
    const s = nyt();
    koer(s, 1);
    s.platforme.sportsbook.model = 'hybrid';
    s.markeder.dk.andele.spiller = 0.1;
    return s;
  }
  it('kræver hybrid/egen platform og andel over 8 %', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.andele.spiller = 0.1;
    expect(indtil(s, (x) => !!x.opkoebstilbud, 60)).toBe(false);
  });
  it('byder 3-5× årlig BSI fra en aktør med opkøbslyst ≥ 4; afslag gør byderen mere aggressiv i 2 år', () => {
    const s = klar();
    expect(indtil(s, (x) => !!x.opkoebstilbud)).toBe(true);
    const t = s.opkoebstilbud!;
    const c = konk(s, t.competitorId);
    expect(c.opkoebslyst).toBeGreaterThanOrEqual(R2.minOpkoebslyst);
    expect(t.pris).toBeGreaterThan(0);
    expect(s.reaktionsTaeller.R2).toBe(1);
    const foer = aggressivitet(s, c);
    expect(act(s, { t: 'afvisTilbud' })).toBe(true);
    expect(s.opkoebstilbud).toBeNull();
    expect(aggressivitet(s, c)).toBe(foer + R2.aggressivitet);
    expect(s.reaktioner.find((r) => r.regel === 'R2' && r.effekt.aggressivitet)!.slutUge - s.uge).toBe(R2.uger);
  });
  it('tilbuddet udløber af sig selv', () => {
    const s = klar();
    indtil(s, (x) => !!x.opkoebstilbud);
    s.uge = s.opkoebstilbud!.udloeberUge;
    ugentligeReaktioner(s, rng());
    expect(s.opkoebstilbud).toBeNull();
  });
  it('accepteret tilbud slutter spillet som exit', () => {
    const s = klar();
    indtil(s, (x) => !!x.opkoebstilbud);
    expect(act(s, { t: 'acceptOffer', competitorId: s.opkoebstilbud!.competitorId })).toBe(true);
    expect(s.slut?.id).toBe('exit');
  });
});

describe('R3 kopiering', () => {
  it('nye features kopieres af op til 3 konkurrenter; fordelen halveres pr. kopi', () => {
    const s = nyt();
    koer(s, 1);
    const p = spillerProdukt(s, ['cashout-test']);
    nyeFeatures(s, rng(), p);
    expect(s.featureFordele['cashout-test']).toBeDefined();
    expect(featureFordel(s)).toBeCloseTo(R3_FORDEL.pr, 5);
    const kopier = s.planlagteKopier.filter((k) => k.feature === 'cashout-test');
    expect(kopier.length).toBeGreaterThan(0);
    expect(kopier.length).toBeLessThanOrEqual(R3_FORDEL.maxKopister);
    expect(Math.min(...kopier.map((k) => k.uge - s.uge))).toBeGreaterThanOrEqual(26);
    const foerste = Math.min(...kopier.map((k) => k.uge));
    s.uge = foerste;
    ugentligeReaktioner(s, rng());
    expect(s.featureFordele['cashout-test'].kopier).toBeGreaterThanOrEqual(1);
    expect(featureFordel(s)).toBeLessThanOrEqual(R3_FORDEL.pr / 2 + 1e-9);
    expect(s.reaktionsTaeller.R3).toBeGreaterThanOrEqual(1);
  });
  it('features, konkurrenterne allerede har, giver ingen fordel', () => {
    const s = nyt();
    koer(s, 1);
    const c = s.produkter.find((x) => x.ejer !== 'spiller' && x.aktiv && x.markeder.includes('dk'))!;
    c.features = ['kendt'];
    nyeFeatures(s, rng(), spillerProdukt(s, ['kendt']));
    expect(s.featureFordele.kendt).toBeUndefined();
  });
  it('fordelen er loftet til 15 %', () => {
    const s = nyt();
    koer(s, 1);
    nyeFeatures(s, rng(), spillerProdukt(s, ['a', 'b', 'c', 'd', 'e']));
    expect(featureFordel(s)).toBeCloseTo(R3_FORDEL.maks, 5);
  });
});

describe('R4 markedsindtog', () => {
  it('giganter og appFirst går ind med dobbelt marketing i 6-8 kvartaler', () => {
    const s = nyt();
    koer(s, 1);
    markedsindtog(s, rng(), 'se');
    const r4 = s.reaktioner.filter((r) => r.regel === 'R4' && r.marked === 'se');
    expect(r4.length).toBeGreaterThan(0);
    for (const r of r4) {
      const c = konk(s, r.competitorId!);
      expect(['globalGigant', 'appFirst']).toContain(c.arketype);
      expect(konkurrentMarketing(s, c.id, 'se')).toBe(R4.marketing);
      const kv = (r.slutUge - s.uge) / 13;
      expect(kv).toBeGreaterThanOrEqual(R4.kvartaler[0]);
      expect(kv).toBeLessThanOrEqual(R4.kvartaler[1]);
    }
  });
});

describe('R5 tilbagetog', () => {
  it('afgiftsstigning ≥ 5 pp får den svageste gigant/nordiske gruppe til at skære marketing', () => {
    const s = nyt();
    koer(s, 1);
    kvartalsReaktioner(s, rng());
    s.markeder.dk.afgift += 0.06;
    kvartalsReaktioner(s, rng());
    const r = s.reaktioner.find((x) => x.regel === 'R5' && x.marked === 'dk');
    expect(r).toBeDefined();
    expect(['globalGigant', 'nordiskLicensgruppe']).toContain(konk(s, r!.competitorId!).arketype);
    expect(r!.effekt.marketingMult).toBe(R5.marketing);
  });
  it('en lille stigning udløser intet', () => {
    const s = nyt();
    koer(s, 1);
    kvartalsReaktioner(s, rng());
    s.markeder.dk.afgift += 0.03;
    kvartalsReaktioner(s, rng());
    expect(s.reaktionsTaeller.R5).toBe(0);
  });
});

describe('R6 og historiske konkurrenttiltag', () => {
  const fransk = KONKURRENT_EVENTS.find((e) => e.id === 'fljKinfolk')!;
  function foerTiltag(s: GameState): void {
    s.konkurrentHistorik = KONKURRENT_EVENTS.filter((e) => e.uge < fransk.uge).map((e) => e.id);
    s.uge = fransk.uge;
  }
  it('statsejet opkøb giver exit fra grå markeder', () => {
    const s = nyt();
    koer(s, 1);
    foerTiltag(s);
    ugentligeKonkurrenter(s, rng());
    expect(konk(s, 'unibit').ejetAf).toBe(fransk.opkoeb!.ejer);
    expect(s.reaktionsTaeller.R6).toBe(1);
    expect(s.signaler.some((x) => x.k === 'konkurrentNyhed')).toBe(true);
  });
  it('aflyses pænt, hvis spilleren selv har købt målet', () => {
    const s = nyt();
    koer(s, 1);
    konk(s, 'unibit').ejetAf = 'spiller';
    foerTiltag(s);
    ugentligeKonkurrenter(s, rng());
    expect(konk(s, 'unibit').ejetAf).toBe('spiller');
    expect(s.reaktionsTaeller.R6).toBe(0);
    expect(s.konkurrentHistorik).toContain('fljKinfolk');
  });
});

describe('R7 sponsorauktion', () => {
  const sp = SPONSORATER[0];
  it('auktion annonceres, spilleren kan byde og vinde med CAC-rabat og årlig betaling', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.licens = 'aktiv';
    s.kapital = 50;
    s.uge = sp.uge - R7.varselUger;
    ugentligeReaktioner(s, rng());
    expect(s.sponsorAuktion?.id).toBe(sp.id);
    expect(s.signaler.some((x) => x.k === 'sponsorAuktion')).toBe(true);
    expect(act(s, { t: 'bydSponsorat', bud: sp.mindstebud * 0.5 })).toBe(false);
    expect(act(s, { t: 'bydSponsorat', bud: sp.mindstebud * 3 })).toBe(true);
    s.uge = sp.uge;
    ugentligeReaktioner(s, rng());
    expect(s.sponsorAuktion).toBeNull();
    const vundet = s.sponsorater.find((x) => x.id === sp.id)!;
    expect(vundet.ejer).toBe('spiller');
    expect(sponsorRabat(s, sp.marked)).toBe(R7.cacRabat);
    expect(sponsorOmkostningPrUge(s)).toBeCloseTo(vundet.bud / 52, 5);
    expect(s.reaktionsTaeller.R7).toBe(1);
  });
  it('uden bud vinder en konkurrent (appFirst foretrækkes)', () => {
    const s = nyt();
    koer(s, 1);
    s.uge = sp.uge - R7.varselUger;
    ugentligeReaktioner(s, rng());
    s.uge = sp.uge;
    ugentligeReaktioner(s, rng());
    const x = s.sponsorater.find((y) => y.id === sp.id)!;
    expect(x.ejer).not.toBe('spiller');
    expect(konk(s, x.ejer).arketype).toBe('appFirst');
    expect(sponsorRabat(s, sp.marked)).toBe(0);
  });
});

describe('R8 aggressivitetspåbud', () => {
  it('høj aggressivitet i 2 kvartaler giver påbud; tredje gang ny regel for alle', () => {
    const s = nyt();
    koer(s, 1);
    s.markeder.dk.licens = 'aktiv';
    s.bonusNiveau = 3;
    s.vipProgram = 3;
    const tillid = s.markeder.dk.tilsynstillid;
    kvartalsReaktioner(s, rng(1));
    expect(s.reaktionsTaeller.R8).toBe(0);
    kvartalsReaktioner(s, rng(2));
    expect(s.reaktionsTaeller.R8).toBe(1);
    expect(s.markeder.dk.tilsynstillid).toBeLessThanOrEqual(tillid - 6);
    const regler = s.markeder.dk.regler.length;
    for (let i = 3; i <= 6; i++) kvartalsReaktioner(s, rng(i));
    expect(s.reaktionsTaeller.R8).toBe(3);
    expect(s.markeder.dk.regler.length).toBeGreaterThan(regler);
  });
});

describe('R9 medieskandale', () => {
  it('øger det politiske pres', () => {
    const s = nyt();
    koer(s, 1);
    const pres = s.markeder.dk.politiskPres;
    expect(indtil(s, (x) => x.reaktioner.some((r) => r.regel === 'R9' && r.marked === 'dk'))).toBe(true);
    expect(s.markeder.dk.politiskPres).toBeGreaterThan(pres);
  });
});

describe('R10 statskassen', () => {
  it('en krise kan give en varslet afgiftsstigning', () => {
    const s = nyt();
    koer(s, 1);
    s.uge = ugeFor(2026, 0); // de faste afgiftsforløb følger virkeligheden til 2026
    startTrend(s, 'inflation', 520);
    expect(s.trends.some((t) => (t.effekt.afgiftRisiko ?? 0) > 0)).toBe(true);
    expect(indtil(s, (x) => x.reaktionsTaeller.R10 > 0)).toBe(true);
    expect(s.planlagteRegler.some((p) => p.regelId === 'afgiftsstigning' && p.ikrafttraedelseUge > s.uge)).toBe(true);
  });
});

describe('R11 kanalisering', () => {
  it('to år under målet udløser en reaktion', () => {
    const s = nyt();
    koer(s, 1);
    s.uge = ugeFor(2027, 0); // R11 gælder i AI-akten
    const m = (Object.keys(KANALISERINGSMAAL) as MarketId[]).find((x) => s.markeder[x].aaben)!;
    s.markeder[m].kanalisering = 0.1;
    s.markeder[m].lavKanaliseringUger = 103;
    ugentligRegulering(s, rng());
    expect(s.reaktionsTaeller.R11).toBe(1);
    expect(s.markeder[m].lavKanaliseringUger).toBe(0);
  });
});

describe('R12 ansvarlig AI', () => {
  it('risikoagent med overvågning ≥ 0,6 tæller og halverer påbudsrisikoen', () => {
    const s = nyt();
    koer(s, 1);
    expect(r12Aktiv(s)).toBe(false);
    s.agenter.push({ id: 'a1', funktion: 'risiko', kapacitet: 1, computePrUge: 0.01, fejlrate: 0.05, overvaagning: 0.7 });
    expect(r12Aktiv(s)).toBe(true);
    kvartalsReaktioner(s, rng());
    expect(s.reaktionsTaeller.R12).toBe(1);
    s.agenter[0].overvaagning = 0.4;
    expect(r12Aktiv(s)).toBe(false);
  });
});

describe('Platforme (6.12)', () => {
  function medUdviklere(n: number): GameState {
    const s = nyt();
    koer(s, 1);
    s.kapital = 100;
    const dev = s.staff.find((m) => m.rolle === 'udvikler')!;
    while (s.staff.filter((m) => m.rolle === 'udvikler').length < n) s.staff.push({ ...structuredClone(dev), id: `dev${s.staff.length}` });
    return s;
  }
  it('migrering koster capex, sænker kvaliteten undervejs og bliver færdig', () => {
    const s = medUdviklere(2);
    const kap = s.kapital;
    expect(act(s, { t: 'choosePlatform', kind: 'kasinoplatform', model: 'hybrid' })).toBe(true);
    expect(s.kapital).toBeCloseTo(kap - PLATFORM_MODELS.hybrid.capex, 5);
    const p = s.platforme.kasinoplatform;
    expect(p.migrererTil).toBe('hybrid');
    expect(platformKvalitet(s, 'kasinoplatform')).toBeCloseTo(p.kvalitet * MIGRERING.kvalitetUnder, 5);
    s.uge = p.migreringFaerdigUge!;
    ugentligePlatforme(s, rng());
    expect(p.model).toBe('hybrid');
    expect(p.migrererTil).toBeNull();
    expect(p.dataejerskab).toBe(PLATFORM_MODELS.hybrid.dataejerskab);
  });
  it('afbrudt migrering giver halvdelen tilbage', () => {
    const s = medUdviklere(2);
    const kap = s.kapital;
    act(s, { t: 'choosePlatform', kind: 'kasinoplatform', model: 'hybrid' });
    expect(act(s, { t: 'choosePlatform', kind: 'kasinoplatform', model: s.platforme.kasinoplatform.model })).toBe(true);
    expect(s.platforme.kasinoplatform.migrererTil).toBeNull();
    expect(s.kapital).toBeCloseTo(kap - PLATFORM_MODELS.hybrid.capex * (1 - MIGRERING.afbrydRefusion), 5);
  });
  it('egen platform kræver 4 udviklere; turnkey-sportsbook kræver Kombi', () => {
    const s = medUdviklere(2);
    expect(act(s, { t: 'choosePlatform', kind: 'sportsbook', model: 'egen' })).toBe(false);
    expect(fejl(s).at(-1)).toMatch(/4 udviklere/);
    expect(act(s, { t: 'choosePlatform', kind: 'sportsbook', model: 'turnkey' })).toBe(false);
    s.flags.push('kombiB2B');
    expect(act(s, { t: 'choosePlatform', kind: 'sportsbook', model: 'turnkey' })).toBe(true);
  });
  it('egen platform kan sælges B2B med nedkøling og giver ugentlig indtægt', () => {
    const s = medUdviklere(1);
    const p = s.platforme.sportsbook;
    expect(act(s, { t: 'sellPlatformB2B', kind: 'sportsbook' })).toBe(false);
    p.model = 'egen';
    p.kvalitet = 90;
    s.omdoemme = 100;
    let solgt = false;
    for (let i = 0; i < 20 && !solgt; i++) {
      p.sidsteB2bUge = null;
      s.rngState = seedState(300 + i);
      expect(act(s, { t: 'sellPlatformB2B', kind: 'sportsbook' })).toBe(true);
      solgt = p.b2bKunder > 0;
    }
    expect(solgt).toBe(true);
    expect(act(s, { t: 'sellPlatformB2B', kind: 'sportsbook' })).toBe(false);
    expect(fejl(s).at(-1)).toMatch(/klar igen/);
    expect(ugentligePlatforme(s, rng())).toBeGreaterThan(0);
    expect(act(s, { t: 'sellPlatformB2B', kind: 'kontoplatform' })).toBe(false);
  });
});

describe('Opkøb af konkurrenter', () => {
  it('mindre konkurrenter kan købes; produkter og licenser følger med', () => {
    const s = nyt();
    koer(s, 1);
    s.kapital = 500;
    const c = konk(s, 'komNu');
    const prod = s.produkter.filter((p) => p.aktiv && p.ejer === 'komNu').map((p) => p.id);
    expect(prod.length).toBeGreaterThan(0);
    expect(act(s, { t: 'acquire', competitorId: 'komNu' })).toBe(true);
    expect(c.ejetAf).toBe('spiller');
    expect(c.tilstede).toBe(false);
    for (const id of prod) expect(s.produkter.find((p) => p.id === id)!.ejer).toBe('spiller');
    expect(s.markeder.dk.licens).toBe('aktiv');
    expect(s.signaler.some((x) => x.k === 'opkoeb')).toBe(true);
  });
  it('giganter og statsselskaber er ikke til salg', () => {
    const s = nyt();
    koer(s, 1);
    s.kapital = 5000;
    expect(act(s, { t: 'acquire', competitorId: 'bet356' })).toBe(false);
    expect(act(s, { t: 'acquire', competitorId: 'danskeLykke' })).toBe(false);
  });
});

describe('Signaler i fase 4', () => {
  it('opkøbstilbud, sponsorauktion, bonuskrig og påbud pauser; kopiering og markedsindtog gør ikke', async () => {
    const { pauserFor } = await import('../../src/sim/signals');
    expect(pauserFor({ k: 'tilbud', competitorId: 'betssen', pris: 10 })).toBe(true);
    expect(pauserFor({ k: 'sponsorAuktion', navn: 'Superligaen', marked: 'dk' })).toBe(true);
    expect(pauserFor({ k: 'reaktion', regel: 'R1', tekst: '' })).toBe(true);
    expect(pauserFor({ k: 'reaktion', regel: 'R8', tekst: '' })).toBe(true);
    expect(pauserFor({ k: 'reaktion', regel: 'R3', tekst: '' })).toBe(false);
    expect(pauserFor({ k: 'reaktion', regel: 'R9', tekst: '' })).toBe(false);
    expect(pauserFor({ k: 'konkurrentNyhed', tekst: '' })).toBe(false);
  });
});
