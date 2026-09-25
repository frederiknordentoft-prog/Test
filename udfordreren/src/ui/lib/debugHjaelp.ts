// Debug-hjælpere (spec 6.20, kun ?debug=1). Alle muterer en KOPI af state inde i useGame.getState().debugSaet(...),
// aldrig spillets levende state. Rene funktioner uden React.
import type { AgentFunktion, AktivReaktion, AiScenarieId, GameState, LiveProduct, MarketId, ReaktionsRegel, WorldAssessment, WorldScenario } from '../../sim/types';
import { MARKETS } from '../../data/markets';
import { R1, R2, R5, REAKTIONS_REGLER } from '../../data/reactionRules';
import { VERDENSSCENARIER, VERDENSVURDERINGER } from '../../data/ai';
import { hjemmebane } from '../../sim/charts';
import { nyAgent } from '../../sim/agents';
import { aarligBsi } from '../../sim/economy';
import { clamp, nyId, nyhed, signal } from '../../sim/util';

// ---------- Konkurrentreaktion ----------

export const REGLER: ReaktionsRegel[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12'];

/** Udløs en konkurrentreaktion efter regel-id (samme spor som simulationen: aktiv effekt, nyhed og signal) */
export function debugReaktion(s: GameState, regel: ReaktionsRegel, competitorId: string | undefined, m: MarketId): void {
  const c = competitorId ? s.konkurrenter.find((x) => x.id === competitorId) : undefined;
  const navn = c?.navn ?? 'En konkurrent';
  const mNavn = MARKETS[m].navn;
  if (regel === 'R2') {
    if (!c) return;
    const pris = Math.round(Math.max(5, aarligBsi(s)) * ((R2.multipel[0] + R2.multipel[1]) / 2) * 10) / 10;
    s.opkoebstilbud = { competitorId: c.id, pris, udloeberUge: s.uge + R2.udloeb, markedsandel: s.markeder[m].andele.spiller ?? 0 };
    nyhed(s, `${c.navn} byder ${Math.round(pris)} mio. kr. for hele ${s.firmaNavn}. (R2: ${REAKTIONS_REGLER.R2.navn})`, 'konkurrent');
    signal(s, { k: 'tilbud', competitorId: c.id, pris });
    return;
  }
  let effekt: AktivReaktion['effekt'] = {};
  let slutUge = s.uge;
  let tekst = `${navn} reagerer i ${mNavn}: ${REAKTIONS_REGLER[regel].saa}.`;
  if (regel === 'R1') {
    effekt = { marketingMult: R1.marketing, cacSpiller: R1.cac };
    slutUge = s.uge + R1.uger;
    tekst = `Bonuskrig! ${navn} skruer marketingen op i ${mNavn}. Jeres CAC +25 % i et år.`;
  } else if (regel === 'R5') {
    effekt = { marketingMult: R5.marketing };
    slutUge = s.uge + R5.uger;
    tekst = `${navn} skærer 30 % af marketingen i ${mNavn} efter afgiftsstigningen.`;
  } else if (regel === 'R8') {
    const ms = s.markeder[m];
    ms.tilsynstillid = clamp(ms.tilsynstillid - 6, 0, 100);
    if (ms.sanktion.trin === 0) ms.sanktion.trin = 1;
    tekst = `${MARKETS[m].tilsyn} giver ${s.firmaNavn} påbud: bonus, VIP og reklametryk er for aggressivt (tillid −6).`;
  } else if (regel === 'R9') {
    s.markeder[m].politiskPres = clamp(s.markeder[m].politiskPres + 1, 0, 5);
    tekst = `Medieskandale i ${mNavn}${c ? ` om ${c.navn}` : ''}. Presset på politikerne stiger.`;
  }
  const r: AktivReaktion = { id: nyId(s, 'r'), regel, competitorId: regel === 'R8' ? undefined : c?.id, marked: m, startUge: s.uge, slutUge, effekt, tekst };
  s.reaktioner.push(r);
  s.reaktionsTaeller[regel] = (s.reaktionsTaeller[regel] ?? 0) + 1;
  if (c && regel !== 'R8') c.sidsteHandling = tekst;
  nyhed(s, `${tekst} (${regel}: ${REAKTIONS_REGLER[regel].navn})`, 'konkurrent');
  signal(s, { k: 'reaktion', regel, tekst, competitorId: r.competitorId, marked: m });
}

// ---------- Verdensscenarier og AI-scenarier ----------

export type VerdensValg = WorldScenario | WorldAssessment | 'aiKrav';

export const VERDENS_VALG: { id: VerdensValg; navn: string }[] = [
  ...VERDENSSCENARIER.map((v) => ({ id: v.id as VerdensValg, navn: `Scenarie: ${v.navn}` })),
  ...VERDENSVURDERINGER.map((v) => ({ id: v.id as VerdensValg, navn: `Vurdering: ${v.navn}` })),
  { id: 'aiKrav', navn: 'Hændelse: Ansvarlig AI som krav' },
];

const EUROPA: MarketId[] = ['dk', 'uk', 'se', 'de', 'nl', 'fi'];

/** Tving et verdensscenarie eller en vurdering: markér det og planlæg dets hændelser til denne uge (udføres ved næste step) */
export function tvingVerden(s: GameState, id: VerdensValg): void {
  const plan = (h: string) => {
    s.verdensHaendelser = s.verdensHaendelser.filter((x) => x.udfoert || x.id !== h);
    s.verdensHaendelser.push({ id: h, uge: s.uge, udfoert: false });
  };
  if (VERDENSSCENARIER.some((v) => v.id === id)) s.verdensscenarier[id as WorldScenario] = 1;
  if (VERDENSVURDERINGER.some((v) => v.id === id)) s.verdensVurderinger[id as WorldAssessment] = s.uge + 1;
  switch (id) {
    case 'afgiftsvinter':
      plan('afgiftsvinter');
      for (const m of EUROPA.filter((x) => s.markeder[x].aaben).slice(0, 3)) plan(`afgift:${m}`);
      break;
    case 'kanaliseringensTilbagetog':
      plan('lempelse:nl');
      plan('lempelse:de');
      plan('differentiering:se');
      break;
    case 'pmOmvaeltning':
      plan('hoejesteret');
      break;
    case 'denHaardeHaand':
      plan('skandale');
      break;
    default:
      plan(id);
  }
}

export function tvingAiScenarie(s: GameState, id: AiScenarieId, styrke: number): void {
  s.aiScenarier[id] = clamp(styrke, 0, 1);
}

// ---------- Agenter ----------

/** Tilføj en agent uden pris og uden loft (debug) */
export function tilfoejAgent(s: GameState, funktion: AgentFunktion, overvaagning: number): void {
  const a = nyAgent(s, funktion, overvaagning);
  s.agenter.push(a);
  signal(s, { k: 'agent', agentId: a.id, funktion, handling: 'ny' });
}

// ---------- Sim-værdierne bag hitlisten ----------

export type HitlisteRaekke = {
  p: LiveProduct;
  placering: number | null;
  nye: number;
  hitlisteTal: number;
  hjemmebane: number;
  score: number;
  bsi: number;
};

/** Alle aktive produkter i et marked, rangeret som hitlisten gør: hitlisteTal × hjemmebane (se src/sim/charts.ts) */
export function hitlisteRaekker(s: GameState, m: MarketId, antal = 15): HitlisteRaekke[] {
  const placering = new Map(s.markeder[m].top10.map((e) => [e.productId, e.placering]));
  return s.produkter
    .filter((p) => p.aktiv && p.markeder.includes(m))
    .map((p) => {
      const nye = p.nyeSpillerePrUge?.[m] ?? 0;
      const tal = p.hitlisteTal?.[m] ?? nye;
      const hb = hjemmebane(s, p.ejer, m);
      return { p, placering: placering.get(p.id) ?? null, nye, hitlisteTal: tal, hjemmebane: hb, score: tal * hb, bsi: p.bsiPrUge[m] ?? 0 };
    })
    .sort((a, b) => b.score - a.score || b.bsi - a.bsi)
    .slice(0, antal);
}
