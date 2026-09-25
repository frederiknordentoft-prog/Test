// AI-laboratoriet og agenterne (spec 6.16, 7.13). Agenter har kapacitet, compute (falder 30 % om året), fejlrate og
// overvågning. Effekten skaleres med dataejerskab (kræver mindst 0,3). Lav overvågning giver AI-uheld.
import type { AgentFunktion, AiAgent, GameState, Phase, Project } from './types';
import type { Rng } from './rng';
import { AGENTER, AI, TRANSFORMATION } from '../data/ai';
import { RESEARCH } from '../data/research';
import { AI_AKT_UGE } from './time';
import { afvis, betal, clamp, nyId, nyhed, saetFlag, signal } from './util';
import { udloesEvent } from './events';
import { PRODUCT_TYPES } from '../data/productTypes';

const TAL = ['Et', 'To', 'Tre', 'Fire', 'Fem', 'Seks', 'Syv', 'Otte', 'Ni', 'Ti', 'Elleve', 'Tolv', 'Tretten', 'Fjorten'];

export function aiLabAaben(s: GameState): boolean {
  return s.uge >= AI_AKT_UGE;
}

/** Compute pr. uge for en agent af en funktion i en given uge (falder 30 % om året fra 2026) */
export function computePris(funktion: AgentFunktion, uge: number): number {
  const aar = Math.max(0, (uge - AI_AKT_UGE) / 52);
  return AGENTER[funktion].compute2026 * Math.pow(1 - AI.computeFaldPrAar, aar);
}

export function fejlrate(funktion: AgentFunktion, overvaagning: number): number {
  const [f0, f1] = AGENTER[funktion].fejl;
  return f0 + (f1 - f0) * clamp(overvaagning, 0, 1);
}

/** Dataejerskab for en agentfunktion (0 under 0,3 — spec 7.13) */
export function dataFaktor(s: GameState, funktion: AgentFunktion): number {
  const d = AGENTER[funktion].data;
  const v = d === 'snit'
    ? (s.platforme.kontoplatform.dataejerskab + s.platforme.sportsbook.dataejerskab + s.platforme.kasinoplatform.dataejerskab) / 3
    : s.platforme[d].dataejerskab;
  return v + 1e-9 >= AI.minData ? v : 0;
}

/** Forskning, der låser en funktion op (null = ingen krav) */
export function kraevetForskning(funktion: AgentFunktion): string | null {
  const n = RESEARCH.find((r) => r.laaser === funktion);
  return n ? n.id : null;
}

export function maxAgenter(s: GameState): number {
  const ai = s.staff.filter((m) => m.rolle === 'aiIngenioer').length;
  return AI.maxAgenterBasis + AI.maxPrAiIngenioer * ai + (s.forskning.ulaast.includes('agentOrkestrering') ? AI.maxMedOrkestrering : 0);
}

export function agentStatus(s: GameState, funktion: AgentFunktion): { ok: boolean; grund?: string; pris: number; compute: number } {
  const res = { pris: AI.opstart, compute: computePris(funktion, s.uge) };
  if (!aiLabAaben(s)) return { ok: false, grund: 'AI-laboratoriet åbner i 2026.', ...res };
  const krav = kraevetForskning(funktion);
  if (krav && !s.forskning.ulaast.includes(krav)) {
    const n = RESEARCH.find((r) => r.id === krav)!;
    return { ok: false, grund: `Kræver forskningen "${n.navn}".`, ...res };
  }
  if (s.agenter.length >= maxAgenter(s)) return { ok: false, grund: `Plads til ${maxAgenter(s)} agenter. Ansæt AI-ingeniører eller forsk i orkestrering.`, ...res };
  if (s.kapital < AI.opstart) return { ok: false, grund: 'Ikke råd til opstarten.', ...res };
  return { ok: true, ...res };
}

export function deployAgent(s: GameState, funktion: AgentFunktion, overvaagning: number): boolean {
  if (!AGENTER[funktion]) return afvis(s, 'Ukendt agentfunktion.');
  const st = agentStatus(s, funktion);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke sætte agenten i drift.');
  if (!betal(s, AI.opstart, 'opstarten af agenten')) return false;
  const a = nyAgent(s, funktion, overvaagning);
  s.agenter.push(a);
  nyhed(s, `${s.firmaNavn} sætter ${a.navn} i drift som ${AGENTER[funktion].navn.toLowerCase()}.${dataFaktor(s, funktion) === 0 ? ' Men uden egne data (dataejerskab under 0,3) gør den ingen forskel.' : ''}`, 'firma');
  signal(s, { k: 'agent', agentId: a.id, funktion, handling: 'ny' });
  return true;
}

export function nyAgent(s: GameState, funktion: AgentFunktion, overvaagning: number): AiAgent {
  const def = AGENTER[funktion];
  const nr = s.agenter.length + s.transformation.reduce((x, t) => x + t.erstattet, 0);
  const o = clamp(Math.round(overvaagning * 10) / 10, 0, 1);
  return {
    id: nyId(s, 'ag'),
    funktion,
    kapacitet: def.kapacitet,
    computePrUge: computePris(funktion, s.uge),
    fejlrate: fejlrate(funktion, o),
    overvaagning: o,
    navn: `Agent ${TAL[nr % TAL.length]}`,
    startUge: s.uge,
    uheld: 0,
  };
}

export function retireAgent(s: GameState, agentId: string): boolean {
  const a = s.agenter.find((x) => x.id === agentId);
  if (!a) return afvis(s, 'Agenten findes ikke.');
  s.agenter = s.agenter.filter((x) => x.id !== agentId);
  for (const p of s.projekter) for (const f of Object.keys(p.faseTildeling) as Phase[]) p.faseTildeling[f] = p.faseTildeling[f].filter((id) => id !== agentId);
  nyhed(s, `${a.navn ?? 'En agent'} slukkes.`, 'firma');
  signal(s, { k: 'agent', agentId, funktion: a.funktion, handling: 'pensioneret' });
  return true;
}

export function setOvervaagning(s: GameState, agentId: string, overvaagning: number): boolean {
  const a = s.agenter.find((x) => x.id === agentId);
  if (!a) return afvis(s, 'Agenten findes ikke.');
  a.overvaagning = clamp(Math.round(overvaagning * 10) / 10, 0, 1);
  a.fejlrate = fejlrate(a.funktion, a.overvaagning);
  return true;
}

// ---------- Effekter ----------

/** Menneskeligt tilsyn: risiko- og compliance-agenter kræver compliance-folk for fuld effekt (spec 6.16) */
export function menneskeligtTilsyn(s: GameState): number {
  const agenter = s.agenter.filter((a) => a.funktion === 'risiko' || a.funktion === 'compliance').length;
  if (agenter === 0) return 1;
  const folk = s.staff.filter((m) => m.rolle === 'compliance').length;
  return clamp(AI.menneskeligtTilsyn.uden + (1 - AI.menneskeligtTilsyn.uden) * (folk / agenter), AI.menneskeligtTilsyn.uden, 1);
}

export type AgentEffekt = {
  bettingArpu: number;
  kasinoArpu: number;
  churn: number; // negativ = lavere churn
  indholdPct: number; // reduktion af aggregatorandelen
  tillidPrKvartal: number;
  byBeskyttelse: number;
  risikoOk: boolean; // risikoagent med overvågning ≥ 0,6 (R12 og AI-krav)
  compute: number;
  overvaagningLoen: number;
};

export function agentEffekt(s: GameState): AgentEffekt {
  const e: AgentEffekt = { bettingArpu: 0, kasinoArpu: 0, churn: 0, indholdPct: 0, tillidPrKvartal: 0, byBeskyttelse: 0, risikoOk: false, compute: 0, overvaagningLoen: 0 };
  if (s.agenter.length === 0) return e;
  const E = AI.effekt;
  const tilsyn = menneskeligtTilsyn(s);
  const snitLoen = s.staff.length ? s.staff.reduce((a, m) => a + m.loenPrUge, 0) / s.staff.length : 0.012;
  let ks = 0;
  let crm = 0;
  for (const a of s.agenter) {
    e.compute += a.computePrUge;
    e.overvaagningLoen += a.overvaagning * AI.overvaagningLoen * snitLoen;
    const d = dataFaktor(s, a.funktion);
    const k = a.kapacitet * d;
    switch (a.funktion) {
      case 'trading': e.bettingArpu += E.tradingArpu * k; break;
      case 'indhold': e.indholdPct += E.indholdPct * k; break;
      case 'kundeservice': ks += E.kundeserviceChurn * k; break;
      case 'crm':
        crm += E.crmChurn * k;
        e.bettingArpu += E.crmArpu * k;
        e.kasinoArpu += E.crmArpu * k;
        break;
      case 'risiko':
        e.byBeskyttelse += E.risikoBeskyttelse * k * a.overvaagning * tilsyn;
        if (a.overvaagning >= 0.6 && d > 0) e.risikoOk = true;
        break;
      case 'compliance': e.tillidPrKvartal += E.complianceTillid * k * tilsyn; break;
      case 'udvikling': break;
    }
  }
  e.bettingArpu = Math.min(0.15, e.bettingArpu);
  e.kasinoArpu = Math.min(0.06, e.kasinoArpu);
  e.churn = -Math.min(0.15, ks) - Math.min(0.1, crm);
  e.indholdPct = Math.min(0.08, e.indholdPct);
  e.tillidPrKvartal = Math.min(2, e.tillidPrKvartal);
  return e;
}

// ---------- Agenter i projektfaser ----------

/** Kan agenten arbejde i denne fase af projektet? Returnerer fasevægten (0 = nej) */
export function agentFaseVaegt(a: AiAgent, p: Project, fase: Phase): number {
  const def = AGENTER[a.funktion];
  if (!def.faser) return 0;
  if (def.vertikal && def.vertikal !== PRODUCT_TYPES[p.typeId].vertikal) return 0;
  return def.faser[fase] ?? 0;
}

/** Rå point for en agent-uge (før holdvægt) */
export function agentPoint(s: GameState, a: AiAgent, p: Project, fase: Phase): number {
  const d = dataFaktor(s, a.funktion);
  return a.kapacitet * AI.pointPrKapacitet * agentFaseVaegt(a, p, fase) * (d > 0 ? 0.4 + 0.6 * d : 0);
}

// ---------- Ugentligt: compute-pris og uheld ----------

export function ugentligeAgenter(s: GameState, rng: Rng): void {
  for (const a of s.agenter) {
    a.computePrUge = computePris(a.funktion, s.uge);
    a.fejlrate = fejlrate(a.funktion, a.overvaagning);
    if (s.ventendeEvents.length === 0 && rng.chance(a.fejlrate * AI.uheldFaktor)) {
      a.uheld = (a.uheld ?? 0) + 1;
      s.aiUheld += 1;
      udloesEvent(s, `aiUheld_${a.funktion}`, { agentId: a.id, navn: a.navn ?? 'Agenten' });
    }
  }
}

// ---------- AI-transformationen (spec 6.16) ----------

/** Hvor mange medarbejdere én agent erstatter ved transformationen */
const PR_AGENT: Partial<Record<AgentFunktion, number>> = { kundeservice: 4, crm: 2, udvikling: 2, indhold: 2, trading: 1, risiko: 1 };

export function transformationsKandidater(s: GameState): { staffId: string; funktion: AgentFunktion }[] {
  const res: { staffId: string; funktion: AgentFunktion }[] = [];
  for (const m of [...s.staff].sort((a, b) => a.niveau - b.niveau || (a.id < b.id ? -1 : 1))) {
    if (m.stifter) continue;
    const f = AGENT_FOR_ROLLE[m.rolle];
    if (!f) continue;
    const krav = kraevetForskning(f);
    if (krav && !s.forskning.ulaast.includes(krav)) continue;
    res.push({ staffId: m.id, funktion: f });
  }
  return res;
}

const AGENT_FOR_ROLLE: Partial<Record<string, AgentFunktion>> = Object.fromEntries(
  Object.values(AGENTER).filter((d) => d.erstatter).map((d) => [d.erstatter as string, d.id]),
);

export function transformationStatus(s: GameState, andel: number): { ok: boolean; grund?: string; antal: number; pris: number } {
  const k = transformationsKandidater(s);
  const antal = Math.max(1, Math.round(k.length * andel));
  const loen = k.slice(0, antal).reduce((a, x) => a + (s.staff.find((m) => m.id === x.staffId)?.loenPrUge ?? 0), 0);
  const pris = loen * TRANSFORMATION.fratraedelseUger;
  if (!aiLabAaben(s)) return { ok: false, grund: 'AI-laboratoriet åbner i 2026.', antal: 0, pris };
  if (k.length === 0) return { ok: false, grund: 'Ingen stillinger, som agenterne kan overtage endnu.', antal: 0, pris };
  if (s.kapital < pris) return { ok: false, grund: `Fratrædelserne koster ${Math.round(pris * 10) / 10} mio. kr.`, antal, pris };
  return { ok: true, antal, pris };
}

export function aiTransformation(s: GameState, andel: number): boolean {
  const a = andel >= 0.5 ? TRANSFORMATION.andele[1] : TRANSFORMATION.andele[0];
  const st = transformationStatus(s, a);
  if (!st.ok) return afvis(s, st.grund ?? 'Kan ikke gennemføre transformationen.');
  const valgte = transformationsKandidater(s).slice(0, st.antal);
  if (!betal(s, st.pris, 'fratrædelserne')) return false;
  const prFunktion: Partial<Record<AgentFunktion, number>> = {};
  let tab = 0;
  for (const v of valgte) {
    const m = s.staff.find((x) => x.id === v.staffId)!;
    tab += TRANSFORMATION.indsigtTab * (m.niveau / 5);
    prFunktion[v.funktion] = (prFunktion[v.funktion] ?? 0) + 1;
    for (const p of s.projekter) for (const f of Object.keys(p.faseTildeling) as Phase[]) p.faseTildeling[f] = p.faseTildeling[f].filter((id) => id !== m.id);
    for (const c of s.kontraktopgaver) c.staff = c.staff.filter((id) => id !== m.id);
  }
  s.staff = s.staff.filter((m) => !valgte.some((v) => v.staffId === m.id));
  // Viden forsvinder med folkene
  s.indsigt = Math.max(0, s.indsigt - tab);
  let nye = 0;
  for (const [f, antal] of Object.entries(prFunktion) as [AgentFunktion, number][]) {
    const n = Math.ceil(antal / (PR_AGENT[f] ?? 1));
    for (let i = 0; i < n; i++) {
      s.agenter.push(nyAgent(s, f, TRANSFORMATION.overvaagning));
      nye += 1;
    }
  }
  s.transformation.push({ uge: s.uge, erstattet: valgte.length });
  saetFlag(s, 'aiTransformeret');
  nyhed(s, `${s.firmaNavn} erstatter ${valgte.length} stillinger med ${nye} AI-agenter. Omkostningerne falder, men viden og stemning forsvinder med folkene.`, 'firma');
  signal(s, { k: 'transformation', erstattet: valgte.length });
  udloesEvent(s, 'aiTransformationDebat', { antal: valgte.length });
  return true;
}
