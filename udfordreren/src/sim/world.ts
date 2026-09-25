// Akt-skiftet 2026 og verdensbilledet (spec 6.16, 7.14): verdensscenarier trækkes med seed i uge 0 af 2026 og styrer
// events og kurver resten af spillet. AI-scenarierne (styrke 0-1) vokser ud fra verden og spillerens tilstand.
import type { AiScenarieId, Competitor, GameState, MarketId, WorldAssessment, WorldScenario } from './types';
import type { Rng } from './rng';
import { VERDENSSCENARIER, VERDENSVURDERINGER, AI_SCENARIER, AI_EFFEKT, BOERSLICENS } from '../data/ai';
import { MARKETS } from '../data/markets';
import { AI_AKT_UGE, aarDecimal, aarFor, ugeFor } from './time';
import { aendrPres, afvis, betal, clamp, nyhed, saetFlag, signal } from './util';
import { annoncer } from './regulation';
import { startTrend } from './trends';
import { agentEffekt } from './agents';

const EUROPA: MarketId[] = ['dk', 'uk', 'se', 'de', 'nl', 'fi'];
export const NORDEN: MarketId[] = ['dk', 'se', 'fi'];

export function harScenarie(s: GameState, id: WorldScenario): boolean {
  return (s.verdensscenarier[id] ?? 0) > 0;
}
export function harVurdering(s: GameState, id: WorldAssessment): boolean {
  return s.verdensVurderinger[id] !== undefined;
}

function planlaeg(s: GameState, id: string, uge: number): void {
  s.verdensHaendelser.push({ id, uge, udfoert: false });
}

/** Akt-skiftet: AI-laboratoriet åbner, og verdensbilledet trækkes (robust over for hop i tid) */
export function aktSkift(s: GameState, rng: Rng): void {
  if (s.uge < AI_AKT_UGE || s.flags.includes('aktTo')) return;
  saetFlag(s, 'aktTo');
  const scenarier: WorldScenario[] = [];
  for (const v of VERDENSSCENARIER) {
    if (rng.chance(v.sandsynlighed)) {
      s.verdensscenarier[v.id] = 1;
      scenarier.push(v.id);
    }
  }
  const vurderinger: WorldAssessment[] = [];
  for (const v of VERDENSVURDERINGER) {
    if (rng.chance(v.sandsynlighed)) {
      const uge = rng.int(v.uger[0], v.uger[1]);
      s.verdensVurderinger[v.id] = uge;
      vurderinger.push(v.id);
      planlaeg(s, v.id, uge);
    }
  }
  for (const a of AI_SCENARIER) s.aiScenarier[a.id] ??= 0;

  // Planlæg scenariernes hændelser
  if (scenarier.includes('afgiftsvinter')) {
    const markeder = EUROPA;
    const antal = rng.int(3, 4);
    const valgte: MarketId[] = [];
    while (valgte.length < antal) {
      const m = rng.pick(markeder.filter((x) => !valgte.includes(x)));
      valgte.push(m);
    }
    for (const m of valgte) planlaeg(s, `afgift:${m}`, rng.int(ugeFor(2026, 8), ugeFor(2028, 26)));
    planlaeg(s, 'afgiftsvinter', AI_AKT_UGE + 4);
    for (let aar = 2027; aar <= 2034; aar += 2) planlaeg(s, 'megadeal', rng.int(ugeFor(aar, 0), ugeFor(aar, 50)));
  }
  if (scenarier.includes('kanaliseringensTilbagetog')) {
    planlaeg(s, 'lempelse:nl', rng.int(ugeFor(2027, 0), ugeFor(2028, 40)));
    planlaeg(s, 'lempelse:de', rng.int(ugeFor(2027, 20), ugeFor(2029, 20)));
    planlaeg(s, 'differentiering:se', rng.int(ugeFor(2026, 30), ugeFor(2027, 40)));
  }
  if (scenarier.includes('pmOmvaeltning')) planlaeg(s, 'hoejesteret', rng.int(ugeFor(2027, 0), ugeFor(2028, 45)));
  if (scenarier.includes('denHaardeHaand')) planlaeg(s, 'skandale', rng.int(ugeFor(2026, 20), ugeFor(2027, 30)));
  // Ansvarlig AI som krav omkring 2029 (70 %, spec 6.16)
  if (rng.chance(AI_EFFEKT.ansvarligAiChance)) planlaeg(s, 'aiKrav', rng.int(ugeFor(2028, 40), ugeFor(2029, 40)));

  nyhed(s, `Et nyt kapitel: ${s.firmaNavn} åbner AI-laboratoriet. Verdensbilledet 2026: ${scenarier.length ? scenarier.map((id) => VERDENSSCENARIER.find((v) => v.id === id)!.navn).join(', ') : 'ingen store omvæltninger'}.`, 'verden');
  signal(s, { k: 'aktSkift', scenarier, vurderinger });
}

function verdensNyhed(s: GameState, id: string, titel: string, tekst: string): void {
  nyhed(s, `${titel}: ${tekst}`, 'verden');
  signal(s, { k: 'verdensNyhed', id, titel, tekst });
}

/** Ugentlig: udfør planlagte verdenshændelser */
export function ugentligVerden(s: GameState, rng: Rng): void {
  for (const h of s.verdensHaendelser) {
    if (h.udfoert || s.uge < h.uge) continue;
    h.udfoert = true;
    udfoer(s, rng, h.id);
  }
  s.verdensHaendelser = s.verdensHaendelser.filter((h) => !h.udfoert || s.uge - h.uge < 520);
}

function udfoer(s: GameState, rng: Rng, id: string): void {
  const [kind, arg] = id.split(':') as [string, MarketId | undefined];
  switch (kind) {
    case 'afgiftsvinter':
      startTrend(s, 'afgiftsvinter', ugeFor(2035, 51) - s.uge);
      if (!s.trends.some((t) => t.id === 'kryptoBoom')) startTrend(s, 'kryptoBoom', 78);
      break;
    case 'afgift':
      if (arg && s.markeder[arg].aaben) annoncer(s, arg, 'afgiftsstigning', s.uge + rng.int(26, 52), true, rng);
      break;
    case 'megadeal':
      megadeal(s, rng);
      break;
    case 'lempelse':
      if (arg && s.markeder[arg].aaben) annoncer(s, arg, 'lempelse', s.uge + 26, true);
      break;
    case 'differentiering':
      if (arg && s.markeder[arg].aaben) annoncer(s, arg, 'afgiftsdifferentiering', s.uge + 26, true);
      break;
    case 'hoejesteret': {
      verdensNyhed(s, 'hoejesteret', 'Højesteret i USA', 'Event-kontrakter hører under den føderale råvaretilsynsmyndighed. Delstaternes spilafgifter udhules, og en børslicens åbner en ny vej ind i USA.');
      const us = s.markeder.us;
      us.afgiftTillaeg = clamp(us.afgiftTillaeg - 8, -30, 40);
      s.aiScenarier.predictionMarkets = 1;
      saetFlag(s, 'boerslicensMulig');
      for (const m of ['dk', 'se', 'nl', 'de', 'fi'] as MarketId[]) aendrPres(s, m, 1, 'EU-debat om event-kontrakter');
      break;
    }
    case 'skandale': {
      verdensNyhed(s, 'skandale', 'Den store skandale', 'En afsløring om spilselskabers jagt på sårbare kunder vender hele Norden. Politikerne lover totalt reklameforbud, AI-risikoscoring og økonomiske tjek.');
      saetFlag(s, 'haardHaand');
      for (const m of NORDEN) {
        if (!s.markeder[m].aaben) continue;
        annoncer(s, m, 'reklameforbud', s.uge + 39, true);
        if (!s.markeder[m].regler.includes('aiRisikokrav')) annoncer(s, m, 'aiRisikokrav', s.uge + 52, true);
        if (!s.markeder[m].regler.includes('affordability')) annoncer(s, m, 'affordability', s.uge + 52, true);
        aendrPres(s, m, 2, 'Den store skandale');
      }
      s.aiScenarier.ansvarligAi = Math.max(s.aiScenarier.ansvarligAi ?? 0, 0.6);
      break;
    }
    case 'aiKrav': {
      const kandidater = NORDEN.filter((m) => s.markeder[m].aaben && !s.markeder[m].regler.includes('aiRisikokrav') && !s.planlagteRegler.some((p) => p.marked === m && p.regelId === 'aiRisikokrav'));
      const valgte: MarketId[] = [];
      while (valgte.length < 2 && kandidater.length > valgte.length) valgte.push(rng.pick(kandidater.filter((m) => !valgte.includes(m))));
      for (const m of valgte) annoncer(s, m, 'aiRisikokrav', s.uge + 26, true);
      if (valgte.length) verdensNyhed(s, 'aiKrav', 'Ansvarlig AI bliver et krav', `Tilsynene i ${valgte.map((m) => MARKETS[m].navn).join(' og ')} vil kræve AI-baseret risikodetektion om et halvt år.`);
      break;
    }
    case 'norgeAabner':
      // Selve åbningen sker i markets.ts (norgeAaben), så konkurrenterne går ind som ved andre markeder
      verdensNyhed(s, 'norgeAabner', 'Norge åbner', 'Stortinget afskaffer monopolet og indfører et licenssystem. Det grå spillemarked kan nu blive hvidt.');
      break;
    case 'euHarmonisering':
      verdensNyhed(s, 'euHarmonisering', 'EU-harmonisering', 'EU vedtager fælles regler for onlinespil. De træder i kraft om et år.');
      for (const m of ['dk', 'se', 'de', 'nl', 'fi'] as MarketId[]) if (s.markeder[m].aaben) annoncer(s, m, 'euHarmonisering', s.uge + 52, true);
      break;
    case 'sverigeSaenker':
      if (s.markeder.se.aaben) annoncer(s, 'se', 'afgiftssaenkning', s.uge + 13, true);
      break;
  }
}

/** Konsolidering: en gigant køber en mindre konkurrent (mindst én mega-deal pr. 2 år under afgiftsvinteren) */
function megadeal(s: GameState, rng: Rng): void {
  const koebere = s.konkurrenter.filter((c) => c.tilstede && !c.ejetAf && c.arketype === 'globalGigant');
  const maal = s.konkurrenter.filter((c) => c.tilstede && !c.ejetAf && (c.arketype === 'nordiskLicensgruppe' || c.arketype === 'appFirst' || c.arketype === 'lokalSpecialist'));
  if (!koebere.length || !maal.length) return;
  const k = rng.weighted(koebere, (c) => c.opkoebslyst);
  const m = rng.pick(maal);
  overtag(s, k, m);
  nyhed(s, `Mega-deal: ${k.navn} køber ${m.navn}. Afgiftsvinteren presser de mindre spillere sammen.`, 'konkurrent', m.arkivId);
  signal(s, { k: 'konkurrentNyhed', tekst: `${k.navn} køber ${m.navn}.`, arkivId: m.arkivId });
}

function overtag(s: GameState, koeber: Competitor, maal: Competitor): void {
  maal.ejetAf = koeber.id;
  maal.tilstede = false;
  maal.sidsteHandling = `Købt af ${koeber.navn}.`;
  koeber.sidsteHandling = `Købte ${maal.navn}.`;
  for (const m of maal.markeder) if (!koeber.markeder.includes(m)) koeber.markeder.push(m);
  for (const p of s.produkter) if (p.aktiv && p.ejer === maal.id) p.ejer = koeber.id;
  s.planlagteKopier = s.planlagteKopier.filter((k) => k.competitorId !== maal.id);
}

// ---------- AI-scenarier ----------

export function ugentligeAiScenarier(s: GameState): void {
  if (s.uge < AI_AKT_UGE) return;
  const aar = aarDecimal(s.uge);
  for (const a of AI_SCENARIER) {
    if (aar < a.fraAar || a.vaekstPrAar <= 0) continue;
    const foer = s.aiScenarier[a.id] ?? 0;
    let vaekst = a.vaekstPrAar / 52;
    if (a.id === 'agentOekonomi' && harScenarie(s, 'pmOmvaeltning')) vaekst *= 1.3;
    if (a.id === 'aiNative' && !s.konkurrenter.some((c) => c.arketype === 'aiNative' && c.tilstede)) vaekst = 0;
    const nu = clamp(foer + vaekst, 0, 1);
    s.aiScenarier[a.id] = nu;
    if (foer < 0.5 && nu >= 0.5) {
      nyhed(s, `${a.navn} tager fart: ${a.mekanik}`, 'verden');
      signal(s, { k: 'aiScenarie', id: a.id, titel: a.navn });
    }
  }
  // Hyperpersonalisering: branchen tager den til sig; spillerens forspring forsvinder, når den kopieres
  const h = s.hyperpersonalisering;
  const branche = h.foersteUge !== null ? clamp((s.uge - h.foersteUge) / AI_EFFEKT.hyperKopiUger, 0, 1) : clamp((aar - 2027) / 4, 0, 1) * 0.5;
  s.aiScenarier.hyperpersonalisering = branche;
  if (h.foersteUge !== null && s.uge === h.foersteUge + AI_EFFEKT.hyperKopiUger) {
    nyhed(s, 'Konkurrenterne har kopieret hyperpersonaliseringen. Forspringet er væk, men risikoen er der stadig.', 'konkurrent');
    signal(s, { k: 'reaktion', regel: 'R3', tekst: 'Konkurrenterne har kopieret jeres hyperpersonalisering.' });
  }
}

export function aiStyrke(s: GameState, id: AiScenarieId): number {
  return s.aiScenarier[id] ?? 0;
}

/** Spillerens ARPU- og churn-effekter fra AI-scenarierne i et marked */
export type AiMarkedsEffekt = { bettingArpu: number; kasinoArpu: number; churn: number; tilgang: number };

export function aiMarkedsEffekt(s: GameState, m: MarketId): AiMarkedsEffekt {
  const e: AiMarkedsEffekt = { bettingArpu: 0, kasinoArpu: 0, churn: 0, tilgang: 0 };
  if (s.uge < AI_AKT_UGE) return e;
  const ae = agentEffekt(s);
  e.bettingArpu += ae.bettingArpu;
  e.kasinoArpu += ae.kasinoArpu;
  e.churn += ae.churn;
  // Agent-økonomien: marginpres; agent-API og tillid dæmper; lukket kontoplatform giver churn
  const ao = aiStyrke(s, 'agentOekonomi');
  if (ao > 0) {
    const api = agentApiAktiv(s);
    const tillid = s.markeder[m].tilsynstillid >= 70 ? 0.8 : 1;
    const pres = AI_EFFEKT.agentOekonomiMargin * ao * (api ? 0.25 : 1) * tillid;
    e.bettingArpu -= pres;
    e.kasinoArpu -= pres;
    const lukket = s.platforme.kontoplatform.model === 'whiteLabel' || s.platforme.kontoplatform.model === 'turnkey';
    if (lukket) e.churn += AI_EFFEKT.agentOekonomiChurnLukket * ao;
    if (api) e.tilgang += AI_EFFEKT.agentApiTilgang * ao;
  }
  // AI-trading: live-omsætning og marginer til dem med egen sportsbook og trading-agent
  const at = aiStyrke(s, 'aiTrading');
  if (at > 0) {
    const sb = s.platforme.sportsbook.model;
    const live = s.produkter.some((p) => p.aktiv && p.ejer === 'spiller' && p.markeder.includes(m) && (p.typeId === 'livebetting' || p.typeId === 'betBuilder'));
    if (live) e.bettingArpu += AI_EFFEKT.aiTradingLive * at;
    const vinder = (sb === 'egen' || sb === 'hybrid') && s.agenter.some((a) => a.funktion === 'trading');
    if (vinder) e.bettingArpu += AI_EFFEKT.aiTradingVinder * at;
    else if (sb === 'whiteLabel' || sb === 'turnkey') e.bettingArpu -= AI_EFFEKT.aiTradingTaber * at;
  }
  // AI-native-bølgen: tunge organisationer mister margin; transformation eller B2B dæmper
  const an = aiStyrke(s, 'aiNative');
  if (an > 0) {
    const tung = tungOrganisation(s);
    e.bettingArpu -= AI_EFFEKT.aiNativeMargin * an * tung;
    e.kasinoArpu -= AI_EFFEKT.aiNativeMargin * an * tung;
  }
  // Hyperpersonalisering: +5-10 % for førstebevægere, 40 % tilbage efter kopien
  const h = s.hyperpersonalisering;
  if (h.aktiv && h.foersteUge !== null) {
    const foerst = h.startUge !== null && h.startUge - h.foersteUge < 13 && aarFor(h.foersteUge) <= 2027 ? AI_EFFEKT.hyperArpu[1] : AI_EFFEKT.hyperArpu[0];
    const kopieret = s.uge - h.foersteUge >= AI_EFFEKT.hyperKopiUger;
    const f = foerst * (kopieret ? AI_EFFEKT.hyperEfterKopi : 1);
    e.bettingArpu += f;
    e.kasinoArpu += f;
  }
  // Prediction markets i USA: sports-BSI −5 til −15 % (ud over trenden) — børslicensen vender det
  if (m === 'us') {
    const pm = aiStyrke(s, 'predictionMarkets');
    // Trenden tager allerede ca. 5 %; styrken lægger op til 10 pp oveni (i alt −5 til −15 %)
    if (pm > 0 && s.boerslicens.status !== 'aktiv') e.bettingArpu -= (AI_EFFEKT.predictionSport[1] - AI_EFFEKT.predictionSport[0]) * pm;
  }
  return e;
}

/** 0-1: hvor tung organisationen er (mange mennesker, få agenter). B2B-kunder dæmper. */
export function tungOrganisation(s: GameState): number {
  const staff = s.staff.length;
  if (staff <= 8) return 0.2;
  const agenter = s.agenter.length;
  const b2b = s.platforme.sportsbook.b2bKunder + s.platforme.kasinoplatform.b2bKunder;
  return clamp(1 - (agenter * 4) / staff, 0, 1) * (b2b >= 3 ? 0.5 : 1);
}

export function agentApiAktiv(s: GameState): boolean {
  return s.forskning.ulaast.includes('agentApi') && (s.marketingMix.aiAgentApi ?? 0) > 0;
}

// ---------- Fristelsen: hyperpersonalisering ----------

export function hyperStatus(s: GameState): { ok: boolean; grund?: string } {
  if (s.uge < AI_AKT_UGE) return { ok: false, grund: 'Hyperpersonalisering kommer med AI-akten i 2026.' };
  if (!s.forskning.ulaast.includes('hyperpersonalisering')) return { ok: false, grund: 'Kræver forskningen "Hyperpersonalisering".' };
  if (!s.agenter.some((a) => a.funktion === 'crm')) return { ok: false, grund: 'Kræver en CRM-agent.' };
  return { ok: true };
}

export function setHyperpersonalisering(s: GameState, aktiv: boolean): boolean {
  const h = s.hyperpersonalisering;
  if (aktiv === h.aktiv) return true;
  if (aktiv) {
    const st = hyperStatus(s);
    if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke slå hyperpersonalisering til.');
    h.aktiv = true;
    h.startUge = s.uge;
    h.foersteUge ??= s.uge;
    saetFlag(s, 'hyperBrugt');
    nyhed(s, `${s.firmaNavn} slår hyperpersonalisering til: hver kunde får sine egne tilbud, beskeder og spil.`, 'firma');
  } else {
    h.aktiv = false;
    h.startUge = null;
    nyhed(s, `${s.firmaNavn} slår hyperpersonaliseringen fra.`, 'firma');
  }
  return true;
}

// ---------- Børslicens i USA (kun under prediction market-omvæltningen) ----------

export function boersStatus(s: GameState): { ok: boolean; grund?: string } {
  if (!s.flags.includes('boerslicensMulig')) return { ok: false, grund: 'Kun muligt, hvis event-kontrakter bliver føderale i USA.' };
  if (s.boerslicens.status !== 'ingen') return { ok: false, grund: s.boerslicens.status === 'aktiv' ? 'I har allerede børslicens.' : 'Ansøgningen behandles.' };
  if (s.kapital < BOERSLICENS.gebyr) return { ok: false, grund: `Kræver ${BOERSLICENS.gebyr} mio. kr.` };
  return { ok: true };
}

export function applyBoersLicens(s: GameState): boolean {
  const st = boersStatus(s);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke søge børslicens.');
  if (!betal(s, BOERSLICENS.gebyr, 'børslicensen')) return false;
  s.boerslicens = { status: 'ansoegt', klarUge: s.uge + BOERSLICENS.uger };
  nyhed(s, `${s.firmaNavn} søger børslicens i USA for at handle event-kontrakter.`, 'firma');
  return true;
}

export function ugentligBoerslicens(s: GameState): void {
  const b = s.boerslicens;
  if (b.status !== 'ansoegt' || b.klarUge === null || s.uge < b.klarUge) return;
  b.status = 'aktiv';
  const us = s.markeder.us;
  // Børslicensen giver adgang til betting-vertikalen i USA uden delstatsafgifter
  if (us.vertikaler.betting.status === 'ingen') us.vertikaler.betting = { status: 'aktiv', klarUge: s.uge };
  if (us.licens === 'ingen' || us.licens === 'ansoegt') us.licens = 'aktiv';
  nyhed(s, `${s.firmaNavn} har fået børslicens i USA. Event-kontrakter kan nu sælges i hele landet.`, 'marked');
  signal(s, { k: 'licens', marked: 'us', vertikal: 'betting' });
}
