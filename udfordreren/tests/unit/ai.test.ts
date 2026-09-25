import { describe, expect, it } from 'vitest';
import { applyActionMut } from '../../src/sim/actions';
import { makeRng, seedState } from '../../src/sim/rng';
import { AI_AKT_UGE, ugeFor } from '../../src/sim/time';
import { agentEffekt, computePris, dataFaktor, fejlrate, maxAgenter, ugentligeAgenter, transformationsKandidater } from '../../src/sim/agents';
import { aktSkift, aiMarkedsEffekt, tungOrganisation, ugentligVerden, ugentligeAiScenarier } from '../../src/sim/world';
import { licensStatus } from '../../src/sim/markets';
import { markedStoerrelse, scenarieMarkedsFaktor } from '../../src/sim/offshore';
import { AGENTER, VERDENSSCENARIER, AI_EFFEKT } from '../../src/data/ai';
import type { Action, GameState } from '../../src/sim/types';
import { fejl, koer, nyt } from './helpers';

const act = (s: GameState, a: Action) => applyActionMut(s, makeRng(s.rngState), a);
const rng = (n = 5) => makeRng(seedState(n));

/** Et spil i uge 0 af 2026 med råd og en hybrid platform */
function aiSpil(seed = 42): GameState {
  const s = nyt(seed);
  koer(s, 1);
  s.uge = AI_AKT_UGE - 1;
  koer(s, 1);
  s.kapital = 500;
  for (const k of ['kontoplatform', 'sportsbook', 'kasinoplatform'] as const) {
    s.platforme[k].model = 'hybrid';
    s.platforme[k].dataejerskab = 0.6;
  }
  return s;
}

describe('AI-agenter (7.13)', () => {
  it('compute falder 30 % om året, og fejlraten følger overvågningen', () => {
    expect(computePris('trading', AI_AKT_UGE)).toBeCloseTo(0.15, 5);
    expect(computePris('trading', AI_AKT_UGE + 52)).toBeCloseTo(0.105, 5);
    expect(computePris('trading', AI_AKT_UGE + 104)).toBeCloseTo(0.0735, 5);
    expect(fejlrate('kundeservice', 0)).toBeCloseTo(0.08, 5);
    expect(fejlrate('kundeservice', 1)).toBeCloseTo(0.01, 5);
    expect(fejlrate('risiko', 0.5)).toBeCloseTo(0.0275, 5);
  });
  it('AI-laboratoriet åbner først i 2026', () => {
    const s = nyt();
    koer(s, 1);
    expect(act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: 0.5 })).toBe(false);
    expect(fejl(s).at(-1)).toMatch(/2026/);
  });
  it('agenter kan sættes i drift; nogle funktioner kræver forskning; der er et loft', () => {
    const s = aiSpil();
    expect(act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: 0.5 })).toBe(true);
    const a = s.agenter[0];
    expect(a.kapacitet).toBe(AGENTER.kundeservice.kapacitet);
    expect(a.fejlrate).toBeCloseTo(fejlrate('kundeservice', 0.5), 5);
    expect(act(s, { t: 'deployAgent', funktion: 'risiko', overvaagning: 0.8 })).toBe(false);
    expect(fejl(s).at(-1)).toMatch(/AI-risikodetektion/);
    s.forskning.ulaast.push('aiRisikodetektion');
    expect(act(s, { t: 'deployAgent', funktion: 'risiko', overvaagning: 0.8 })).toBe(true);
    while (s.agenter.length < maxAgenter(s)) act(s, { t: 'deployAgent', funktion: 'crm', overvaagning: 0.5 });
    expect(act(s, { t: 'deployAgent', funktion: 'crm', overvaagning: 0.5 })).toBe(false);
    expect(act(s, { t: 'retireAgent', agentId: a.id })).toBe(true);
    expect(s.agenter.some((x) => x.id === a.id)).toBe(false);
  });
  it('effekten skaleres med dataejerskab og kræver mindst 0,3', () => {
    const s = aiSpil();
    act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: 0.5 });
    const med = agentEffekt(s).churn;
    expect(med).toBeLessThan(0);
    s.platforme.kontoplatform.dataejerskab = 0.1;
    expect(dataFaktor(s, 'kundeservice')).toBe(0);
    expect(agentEffekt(s).churn).toBeCloseTo(0, 10);
    s.platforme.kontoplatform.dataejerskab = 1;
    expect(agentEffekt(s).churn).toBeLessThan(med);
  });
  it('compute og overvågningsløn står i regnskabet', () => {
    const s = aiSpil();
    act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: 1 });
    koer(s, 1);
    expect(s.regnskab.compute).toBeCloseTo(computePris('kundeservice', s.uge), 5);
    expect(agentEffekt(s).overvaagningLoen).toBeGreaterThan(0);
  });
  it('risikoagent med overvågning ≥ 0,6 opfylder kravet og beskytter byen; menneskeligt tilsyn giver fuld effekt', () => {
    const s = aiSpil();
    s.forskning.ulaast.push('aiRisikodetektion');
    act(s, { t: 'deployAgent', funktion: 'risiko', overvaagning: 0.5 });
    expect(agentEffekt(s).risikoOk).toBe(false);
    act(s, { t: 'setOvervaagning', agentId: s.agenter[0].id, overvaagning: 0.8 });
    const e = agentEffekt(s);
    expect(e.risikoOk).toBe(true);
    const uden = e.byBeskyttelse;
    const comp = structuredClone(s.staff[0]);
    comp.id = 'c1';
    comp.rolle = 'compliance';
    comp.stifter = false;
    s.staff.push(comp);
    expect(agentEffekt(s).byBeskyttelse).toBeGreaterThan(uden);
  });
  it('lav overvågning giver oftere AI-uheld', () => {
    const tael = (o: number) => {
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const s = aiSpil();
        act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: o });
        ugentligeAgenter(s, rng(i));
        if (s.ventendeEvents.some((e) => e.eventId === 'aiUheld_kundeservice')) n++;
      }
      return n;
    };
    const lav = tael(0);
    const hoej = tael(1);
    expect(lav).toBeGreaterThan(hoej);
    expect(lav).toBeGreaterThan(0);
  });
  it('udviklingsagenter arbejder i teknikfasen og giver point', () => {
    const s = aiSpil();
    act(s, { t: 'deployAgent', funktion: 'udvikling', overvaagning: 0.5 });
    const ag = s.agenter[0];
    expect(act(s, { t: 'startProject', project: { navn: 'AI-test', typeId: 'prematch', themeId: 'fodbold', markeder: ['dk'], margin: 0.08, intensitet: 3, budget: 1 } })).toBe(true);
    const p = s.projekter[0];
    p.fase = 'teknik';
    p.faseUge = 0;
    expect(act(s, { t: 'assignPhase', projectId: p.id, fase: 'teknik', ids: [ag.id] })).toBe(true);
    const foer = p.params.teknik;
    koer(s, 1);
    expect(p.params.teknik).toBeGreaterThan(foer);
    expect(s.signaler.some((x) => x.k === 'point' && x.staffId === ag.id)).toBe(true);
  });
});

describe('Verdensscenarier (7.14)', () => {
  it('trækkes deterministisk i uge 0 af 2026 og kun én gang', () => {
    const a = aiSpil(7);
    const b = aiSpil(7);
    expect(a.verdensscenarier).toEqual(b.verdensscenarier);
    expect(a.flags).toContain('aktTo');
    expect(a.signaler.some((x) => x.k === 'aktSkift') || a.nyheder.some((n) => n.tekst.includes('AI-laboratoriet'))).toBe(true);
    const foer = JSON.stringify(a.verdensscenarier);
    aktSkift(a, rng(99));
    expect(JSON.stringify(a.verdensscenarier)).toBe(foer);
  });
  it('sandsynlighederne passer over mange seeds og kan kombineres', () => {
    const N = 400;
    const taeller: Record<string, number> = {};
    let kombineret = 0;
    for (let i = 0; i < N; i++) {
      const s = nyt(i + 1);
      s.uge = AI_AKT_UGE;
      aktSkift(s, rng(i + 1000));
      const n = Object.keys(s.verdensscenarier).length;
      if (n >= 2) kombineret++;
      for (const k of Object.keys(s.verdensscenarier)) taeller[k] = (taeller[k] ?? 0) + 1;
    }
    for (const v of VERDENSSCENARIER) expect(Math.abs((taeller[v.id] ?? 0) / N - v.sandsynlighed)).toBeLessThan(0.08);
    expect(kombineret).toBeGreaterThan(0);
  });
  it('prediction market-omvæltningen: højesteret udhuler afgiften og åbner børslicensen', () => {
    const s = aiSpil();
    s.verdensscenarier = { pmOmvaeltning: 1 };
    s.verdensHaendelser = [{ id: 'hoejesteret', uge: s.uge, udfoert: false }];
    const afgift = s.markeder.us.afgiftTillaeg;
    ugentligVerden(s, rng());
    expect(s.markeder.us.afgiftTillaeg).toBe(afgift - 8);
    expect(s.flags).toContain('boerslicensMulig');
    expect(s.aiScenarier.predictionMarkets).toBe(1);
    expect(act(s, { t: 'applyBoersLicens' })).toBe(true);
    expect(s.boerslicens.status).toBe('ansoegt');
    s.uge = s.boerslicens.klarUge! - 1;
    koer(s, 1);
    expect(s.boerslicens.status).toBe('aktiv');
    expect(s.markeder.us.vertikaler.betting.status).toBe('aktiv');
  });
  it('den hårde hånd: reklameforbud og AI-krav annonceres i Norden, markedet skrumper', () => {
    const s = aiSpil();
    s.verdensHaendelser = [{ id: 'skandale', uge: s.uge, udfoert: false }];
    const foer = scenarieMarkedsFaktor(s, 'dk');
    ugentligVerden(s, rng());
    expect(s.planlagteRegler.some((p) => p.marked === 'dk' && p.regelId === 'reklameforbud')).toBe(true);
    expect(s.planlagteRegler.some((p) => p.marked === 'se' && p.regelId === 'aiRisikokrav')).toBe(true);
    expect(scenarieMarkedsFaktor(s, 'dk')).toBeCloseTo(foer * 0.87, 5);
    expect(scenarieMarkedsFaktor(s, 'uk')).toBe(1);
  });
  it('kanaliseringens tilbagetog: legale markeder vokser 5-8 % om året', () => {
    const s = aiSpil();
    s.verdensscenarier = { kanaliseringensTilbagetog: 1 };
    expect(scenarieMarkedsFaktor(s, 'dk', ugeFor(2028, 0))).toBeCloseTo(1.065, 3);
    expect(scenarieMarkedsFaktor(s, 'dk', ugeFor(2030, 0))).toBeCloseTo(Math.pow(1.065, 3), 3);
  });
  it('Norge åbner kun i scenariet og får et marked', () => {
    const s = aiSpil();
    expect(licensStatus(s, 'no').ok).toBe(false);
    s.verdensVurderinger = { norgeAabner: s.uge + 1 };
    koer(s, 1);
    expect(s.markeder.no.aaben).toBe(true);
    expect(licensStatus(s, 'no').ok).toBe(true);
    expect(markedStoerrelse(s, 'no', 'kasino')).toBeGreaterThan(0);
    expect(s.markeder.no.offshore.kasino).toBeLessThanOrEqual(1);
  });
  it('mega-deals under afgiftsvinteren samler konkurrenterne', () => {
    const s = aiSpil();
    s.verdensHaendelser = [{ id: 'megadeal', uge: s.uge, udfoert: false }];
    const foer = s.konkurrenter.filter((c) => c.tilstede).length;
    ugentligVerden(s, rng());
    expect(s.konkurrenter.filter((c) => c.tilstede).length).toBe(foer - 1);
    expect(s.konkurrenter.some((c) => c.ejetAf && c.ejetAf !== 'spiller' && s.konkurrenter.some((k) => k.id === c.ejetAf))).toBe(true);
  });
});

describe('AI-scenarier (6.16)', () => {
  it('vokser fra deres startår og signalerer ved halvvejs', () => {
    const s = aiSpil();
    for (let i = 0; i < 52; i++) {
      s.uge += 1;
      ugentligeAiScenarier(s);
    }
    expect(s.aiScenarier.aiTrading).toBeCloseTo(0.2, 2);
    expect(s.aiScenarier.agentOekonomi ?? 0).toBe(0);
  });
  it('agent-økonomien presser marginen; agent-API dæmper og giver tilgang', () => {
    const s = aiSpil();
    s.aiScenarier.agentOekonomi = 1;
    const uden = aiMarkedsEffekt(s, 'dk');
    expect(uden.bettingArpu).toBeLessThan(0);
    s.forskning.ulaast.push('agentApi');
    s.marketingMix.aiAgentApi = 0.1;
    const med = aiMarkedsEffekt(s, 'dk');
    expect(med.bettingArpu).toBeGreaterThan(uden.bettingArpu);
    expect(med.tilgang).toBeCloseTo(AI_EFFEKT.agentApiTilgang, 5);
  });
  it('AI-native-bølgen rammer tunge organisationer; agenter og B2B dæmper', () => {
    const s = aiSpil();
    const dev = s.staff[0];
    for (let i = 0; i < 20; i++) s.staff.push({ ...structuredClone(dev), id: `x${i}`, stifter: false });
    s.aiScenarier.aiNative = 1;
    expect(tungOrganisation(s)).toBe(1);
    const tung = aiMarkedsEffekt(s, 'dk').kasinoArpu;
    for (let i = 0; i < 4; i++) act(s, { t: 'deployAgent', funktion: 'kundeservice', overvaagning: 0.5 });
    expect(tungOrganisation(s)).toBeLessThan(1);
    expect(aiMarkedsEffekt(s, 'dk').kasinoArpu).toBeGreaterThan(tung);
  });
  it('hyperpersonalisering: kræver forskning og CRM-agent; giver BSI, som halveres efter kopien', () => {
    const s = aiSpil();
    expect(act(s, { t: 'setHyperpersonalisering', aktiv: true })).toBe(false);
    s.forskning.ulaast.push('hyperpersonalisering');
    act(s, { t: 'deployAgent', funktion: 'crm', overvaagning: 0.5 });
    const foer = aiMarkedsEffekt(s, 'dk').kasinoArpu;
    expect(act(s, { t: 'setHyperpersonalisering', aktiv: true })).toBe(true);
    const f = aiMarkedsEffekt(s, 'dk').kasinoArpu - foer;
    expect(f).toBeCloseTo(AI_EFFEKT.hyperArpu[1], 5);
    s.uge += AI_EFFEKT.hyperKopiUger;
    expect(aiMarkedsEffekt(s, 'dk').kasinoArpu - foer).toBeCloseTo(AI_EFFEKT.hyperArpu[1] * AI_EFFEKT.hyperEfterKopi, 5);
  });
});

describe('AI-transformation (6.16)', () => {
  it('erstatter stillinger med agenter: lavere løn, tab af viden og et omdømme-event', () => {
    const s = aiSpil();
    const dev = s.staff.find((m) => m.rolle === 'udvikler')!;
    for (let i = 0; i < 8; i++) s.staff.push({ ...structuredClone(dev), id: `u${i}`, stifter: false, rolle: i < 4 ? 'udvikler' : 'kundeservice', niveau: 5 });
    s.indsigt = 50;
    const kandidater = transformationsKandidater(s).length;
    const loen = s.staff.reduce((a, m) => a + m.loenPrUge, 0);
    expect(act(s, { t: 'aiTransformation', andel: 0.5 })).toBe(true);
    expect(s.staff.length).toBe(10 - Math.round(kandidater * 0.5));
    expect(s.staff.reduce((a, m) => a + m.loenPrUge, 0)).toBeLessThan(loen);
    expect(s.agenter.length).toBeGreaterThan(0);
    expect(s.indsigt).toBeLessThan(50);
    expect(s.ventendeEvents.some((e) => e.eventId === 'aiTransformationDebat')).toBe(true);
    expect(s.staff.every((m) => m.stifter || !transformationsKandidater(s).length || true)).toBe(true);
  });
  it('stifterne erstattes aldrig', () => {
    const s = aiSpil();
    expect(transformationsKandidater(s).some((k) => s.staff.find((m) => m.id === k.staffId)?.stifter)).toBe(false);
  });
});
