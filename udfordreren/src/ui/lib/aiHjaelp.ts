// AI-sporet: rene hjælpere til AI-laboratoriet, akt-skiftet og agenter i projektfaser.
// Spejler sim-kernens formler (src/sim/agents.ts og src/sim/world.ts) uden at ændre state — bruges kun til visning.
import type { AgentFunktion, AiAgent, AiScenarieId, GameState, MarketId, PlatformKind, WorldAssessment, WorldScenario } from '../../sim/types';
import type { IkonNavn } from '../components/kit';
import { AGENTER, AGENT_IDS, AI, AI_EFFEKT, AI_SCENARIER, BOERSLICENS, TRANSFORMATION, VERDENSSCENARIER, VERDENSVURDERINGER } from '../../data/ai';
import { RESEARCH_BY_ID } from '../../data/research';
import { PLATFORM_KINDS } from '../../data/platforms';
import { CHANNELS } from '../../data/acquisition';
import { TRUST } from '../../data/trust';
import { agentEffekt, agentStatus, aiMarkedsEffekt, dataFaktor, hyperStatus, kraevetForskning, transformationStatus, transformationsKandidater } from '../../sim/selectors';
import { aarFor, AI_AKT_UGE } from '../../sim/time';

// ---------- Formatering ----------

/** 0,1234 → "12 %" (eller med decimaler) */
export function procentTekst(v: number, dec = 0): string {
  return `${(v * 100).toFixed(dec).replace('.', ',')} %`;
}

/** Fortegnsprocent: +3,5 % / −2 % */
export function fortegnProcent(v: number, dec = 1): string {
  const r = Math.round(v * 100 * 10 ** dec) / 10 ** dec;
  if (r === 0) return '0 %';
  const s = Math.abs(r).toFixed(dec).replace('.', ',').replace(/,0+$/, '');
  return `${r > 0 ? '+' : '−'}${s} %`;
}

export function decimal(v: number, dec = 1): string {
  return (Math.round(v * 10 ** dec) / 10 ** dec).toFixed(dec).replace('.', ',');
}

// ---------- Agenter ----------

/** Et visningsnavn: "Agent Tre" eller funktionens navn */
export function agentNavn(a: AiAgent): string {
  return a.navn ?? AGENTER[a.funktion].navn;
}

export function erAgent(s: GameState, id: string): boolean {
  return s.agenter.some((a) => a.id === id);
}

export const AGENT_IKON: Record<AgentFunktion, IkonNavn> = {
  trading: 'hitliste',
  indhold: 'terning',
  kundeservice: 'hoejttaler',
  crm: 'klokke',
  risiko: 'skjold',
  compliance: 'paragraf',
  udvikling: 'terminal',
};

const PLATFORM_NAVN: Record<PlatformKind, string> = Object.fromEntries(PLATFORM_KINDS.map((k) => [k.id, k.navn])) as Record<PlatformKind, string>;

/** Hvor agentens data kommer fra, og om de rækker (dataejerskab ≥ 0,3) */
export function agentData(s: GameState, f: AgentFunktion): { kilde: string; vaerdi: number; faktor: number; ok: boolean } {
  const d = AGENTER[f].data;
  const vaerdi =
    d === 'snit'
      ? (s.platforme.kontoplatform.dataejerskab + s.platforme.sportsbook.dataejerskab + s.platforme.kasinoplatform.dataejerskab) / 3
      : s.platforme[d].dataejerskab;
  const faktor = dataFaktor(s, f);
  return { kilde: d === 'snit' ? 'alle platforme i snit' : PLATFORM_NAVN[d].toLowerCase(), vaerdi, faktor, ok: faktor > 0 };
}

export const DATA_ADVARSEL = 'Dataejerskab under 0,3: agenten gør ingen forskel.';

/** De faser, en agentfunktion kan arbejde i (tom = kun drift) */
export function agentFaser(f: AgentFunktion): string[] {
  const faser = AGENTER[f].faser;
  if (!faser) return [];
  const navn: Record<string, string> = { koncept: 'koncept', design: 'design', teknik: 'teknik', test: 'test' };
  return Object.entries(faser)
    .filter(([, v]) => (v ?? 0) > 0)
    .map(([k]) => navn[k] ?? k);
}

/** Hvad agenten laver lige nu (projekt og fase), hvis den er tildelt et aktivt projekt */
export function agentOpgave(s: GameState, id: string): string | null {
  for (const p of s.projekter) {
    if (p.klar) continue;
    if (p.faseTildeling[p.fase].includes(id)) return `Arbejder på ${p.navn} (${p.fase})`;
  }
  for (const p of s.projekter) {
    if (p.klar) continue;
    if (Object.values(p.faseTildeling).some((ids) => ids.includes(id))) return `Klar til ${p.navn}`;
  }
  return null;
}

export type Udrulning = {
  funktion: AgentFunktion;
  ok: boolean;
  grund?: string;
  pris: number;
  compute: number;
  forskning: string | null; // navnet på den krævede forskning
  forskningOk: boolean;
  data: ReturnType<typeof agentData>;
};

/** Alle funktioner med status til "Sæt agent i drift" */
export function udrulninger(s: GameState): Udrulning[] {
  return AGENT_IDS.map((f) => {
    const st = agentStatus(s, f);
    const krav = kraevetForskning(f);
    return {
      funktion: f,
      ok: st.ok,
      grund: st.grund,
      pris: st.pris,
      compute: st.compute,
      forskning: krav ? (RESEARCH_BY_ID[krav]?.navn ?? krav) : null,
      forskningOk: !krav || s.forskning.ulaast.includes(krav),
      data: agentData(s, f),
    };
  });
}

/** Overvågningsløn pr. uge for én agent (0,1 medarbejder pr. 0,1 overvågning — spec 7.13) */
export function overvaagningsLoen(s: GameState, overvaagning: number): number {
  const snit = s.staff.length ? s.staff.reduce((a, m) => a + m.loenPrUge, 0) / s.staff.length : 0.012;
  return overvaagning * AI.overvaagningLoen * snit;
}

/** Forventede AI-uheld pr. år ved en given fejlrate (ugentlig risiko = fejlrate × uheldFaktor) */
export function uheldPrAar(fejl: number): number {
  return 52 * fejl * AI.uheldFaktor;
}


// ---------- Effekter ----------

export type EffektLinje = { id: string; label: string; tekst: string; ikon: IkonNavn; farve: string; aktiv: boolean; titel?: string };

/** agentEffekt(s) oversat til læsbare linjer */
export function agentEffektLinjer(s: GameState): EffektLinje[] {
  const e = agentEffekt(s);
  const komp = (v: number) => (v === 0 ? 'ingen' : fortegnProcent(v));
  return [
    { id: 'bsi', label: 'BSI pr. kunde', tekst: `Betting ${komp(e.bettingArpu)} · kasino ${komp(e.kasinoArpu)}`, ikon: 'penge', farve: 'var(--color-gold)', aktiv: e.bettingArpu > 0 || e.kasinoArpu > 0, titel: 'Fra trading- og CRM-agenter' },
    { id: 'churn', label: 'Churn', tekst: e.churn === 0 ? 'ingen' : fortegnProcent(e.churn), ikon: 'folk', farve: 'var(--color-sky)', aktiv: e.churn < 0, titel: 'Fra kundeservice- og CRM-agenter (negativ = færre forlader jer)' },
    { id: 'indhold', label: 'Indholdsudgift', tekst: e.indholdPct === 0 ? 'ingen' : `−${decimal(e.indholdPct * 100, 1)} pp aggregator`, ikon: 'terning', farve: 'var(--color-violet)', aktiv: e.indholdPct > 0, titel: 'Indholdsagenter laver kasinoindhold selv' },
    { id: 'tillid', label: 'Tilsynstillid', tekst: e.tillidPrKvartal === 0 ? 'ingen' : `+${decimal(e.tillidPrKvartal, 1)} pr. kvartal`, ikon: 'skjold', farve: 'var(--color-good)', aktiv: e.tillidPrKvartal > 0, titel: 'Fra compliance-agenter (kræver mennesker ved roret)' },
    { id: 'by', label: 'Byens beskyttelse', tekst: e.byBeskyttelse === 0 ? 'ingen' : `+${decimal(e.byBeskyttelse, 2)}`, ikon: 'hus', farve: 'var(--color-good)', aktiv: e.byBeskyttelse > 0, titel: 'Risikoagenter fanger tidlige tegn på problemspil' },
    {
      id: 'risikokrav',
      label: 'AI-risikokrav',
      tekst: e.risikoOk ? 'opfyldt' : 'ikke opfyldt',
      ikon: e.risikoOk ? 'flueben' : 'oeje',
      farve: e.risikoOk ? 'var(--color-good)' : 'var(--color-warn)',
      aktiv: true,
      titel: 'Kræver en risikoagent med overvågning ≥ 0,6 og egne data',
    },
    { id: 'compute', label: 'Compute', tekst: `${kroner(e.compute)}/uge`, ikon: 'chip', farve: 'var(--color-cyan)', aktiv: e.compute > 0, titel: 'Falder ca. 30 % om året' },
    { id: 'loen', label: 'Overvågningsløn', tekst: `${kroner(e.overvaagningLoen)}/uge`, ikon: 'oeje', farve: 'var(--color-cyan)', aktiv: e.overvaagningLoen > 0, titel: 'Menneskene, der holder øje med agenterne' },
  ];
}

/** Små beløb i t. kr., større i mio. */
export function kroner(mio: number): string {
  const a = Math.abs(mio);
  const t = mio < 0 ? '−' : '';
  if (a >= 1) return `${t}${decimal(a, 1)} mio.`;
  return `${t}${Math.round(a * 1000).toLocaleString('da-DK')} t. kr.`;
}

/** aiMarkedsEffekt(s, m) forklaret i linjer */
export function markedsEffektLinjer(s: GameState, m: MarketId): EffektLinje[] {
  const e = aiMarkedsEffekt(s, m);
  const farve = (v: number, godNaarPositiv = true) => (v === 0 ? 'var(--color-muted)' : (v > 0) === godNaarPositiv ? 'var(--color-good)' : 'var(--color-bad)');
  const ikon = (v: number, godNaarPositiv = true): IkonNavn => (v === 0 ? 'streg' : (v > 0) === godNaarPositiv ? 'op' : 'ned');
  return [
    { id: 'betting', label: 'Betting-BSI pr. kunde', tekst: fortegnProcent(e.bettingArpu), ikon: ikon(e.bettingArpu), farve: farve(e.bettingArpu), aktiv: e.bettingArpu !== 0 },
    { id: 'kasino', label: 'Kasino-BSI pr. kunde', tekst: fortegnProcent(e.kasinoArpu), ikon: ikon(e.kasinoArpu), farve: farve(e.kasinoArpu), aktiv: e.kasinoArpu !== 0 },
    { id: 'churn', label: 'Churn', tekst: fortegnProcent(e.churn), ikon: ikon(e.churn, false), farve: farve(e.churn, false), aktiv: e.churn !== 0 },
    { id: 'tilgang', label: 'Tilgang', tekst: fortegnProcent(e.tilgang), ikon: ikon(e.tilgang), farve: farve(e.tilgang), aktiv: e.tilgang !== 0 },
  ];
}

// ---------- Verdensbilledet 2026 ----------

export type VerdensKort = { id: WorldScenario; navn: string; sandsynlighed: number; tekst: string; effekt: string; trukket: boolean };
export type VurderingsKort = { id: WorldAssessment; navn: string; sandsynlighed: number; tekst: string; trukket: boolean; aar: number | null };

export function verdensbillede(s: GameState, scenarier?: readonly WorldScenario[], vurderinger?: readonly WorldAssessment[]): { scenarier: VerdensKort[]; vurderinger: VurderingsKort[] } {
  return {
    scenarier: VERDENSSCENARIER.map((v) => ({ ...v, trukket: scenarier ? scenarier.includes(v.id) : (s.verdensscenarier[v.id] ?? 0) > 0 })),
    vurderinger: VERDENSVURDERINGER.map((v) => {
      const uge = s.verdensVurderinger[v.id];
      const trukket = vurderinger ? vurderinger.includes(v.id) || uge !== undefined : uge !== undefined;
      return { id: v.id, navn: v.navn, sandsynlighed: v.sandsynlighed, tekst: v.tekst, trukket, aar: uge !== undefined ? aarFor(uge) : null };
    }),
  };
}

// ---------- AI-scenarier ----------

export type AiScenarieKort = { id: AiScenarieId; navn: string; styrke: number; fraAar: number; mekanik: string; vinder: string; taber: string; startet: boolean };

export function aiScenarier(s: GameState): AiScenarieKort[] {
  const aar = aarFor(s.uge);
  return AI_SCENARIER.map((a) => ({ id: a.id, navn: a.navn, styrke: s.aiScenarier[a.id] ?? 0, fraAar: a.fraAar, mekanik: a.mekanik, vinder: a.vinder, taber: a.taber, startet: aar >= a.fraAar }));
}

// ---------- Fristelsen: hyperpersonalisering ----------

export type HyperInfo = {
  ok: boolean;
  grund?: string;
  aktiv: boolean;
  /** BSI-gevinst pr. kunde, hvis den slås til nu (0,05-0,1) */
  gevinst: number;
  foerst: boolean;
  kopieret: boolean;
  risikoOk: boolean;
  tillidPrKvartal: number;
  kopiOmUger: number | null;
};

export function hyperInfo(s: GameState): HyperInfo {
  const st = hyperStatus(s);
  const h = s.hyperpersonalisering;
  const foersteUge = h.foersteUge ?? s.uge;
  const startUge = h.aktiv && h.startUge !== null ? h.startUge : s.uge;
  const foerst = startUge - foersteUge < 13 && aarFor(foersteUge) <= 2027;
  const kopieret = h.foersteUge !== null && s.uge - h.foersteUge >= AI_EFFEKT.hyperKopiUger;
  const basis = foerst ? AI_EFFEKT.hyperArpu[1] : AI_EFFEKT.hyperArpu[0];
  return {
    ok: st.ok,
    grund: st.grund,
    aktiv: h.aktiv,
    gevinst: basis * (kopieret ? AI_EFFEKT.hyperEfterKopi : 1),
    foerst,
    kopieret,
    risikoOk: agentEffekt(s).risikoOk,
    tillidPrKvartal: TRUST.hyperUdenRisiko,
    kopiOmUger: h.foersteUge !== null && !kopieret ? h.foersteUge + AI_EFFEKT.hyperKopiUger - s.uge : null,
  };
}

// ---------- AI-transformation ----------

/** Hvor mange medarbejdere én agent erstatter (spejler src/sim/agents.ts) */
const PR_AGENT: Partial<Record<AgentFunktion, number>> = { kundeservice: 4, crm: 2, udvikling: 2, indhold: 2, trading: 1 };

export type TransformationInfo = {
  andel: 0.25 | 0.5;
  ok: boolean;
  grund?: string;
  antal: number;
  pris: number;
  loenSparet: number; // pr. uge
  indsigtTab: number;
  nyeAgenter: number;
  navne: string[];
};

export function transformationInfo(s: GameState, andel: 0.25 | 0.5): TransformationInfo {
  const st = transformationStatus(s, andel);
  const kandidater = transformationsKandidater(s);
  const valgte = kandidater.slice(0, st.antal);
  let loen = 0;
  let tab = 0;
  const prF: Partial<Record<AgentFunktion, number>> = {};
  const navne: string[] = [];
  for (const v of valgte) {
    const m = s.staff.find((x) => x.id === v.staffId);
    if (!m) continue;
    loen += m.loenPrUge;
    tab += TRANSFORMATION.indsigtTab * (m.niveau / 5);
    prF[v.funktion] = (prF[v.funktion] ?? 0) + 1;
    navne.push(m.navn.split(' ')[0]);
  }
  const nye = (Object.entries(prF) as [AgentFunktion, number][]).reduce((a, [f, n]) => a + Math.ceil(n / (PR_AGENT[f] ?? 1)), 0);
  return { andel, ok: st.ok, grund: st.grund, antal: st.antal, pris: st.pris, loenSparet: loen, indsigtTab: tab, nyeAgenter: nye, navne };
}

export const TRANSFORMATION_OMDOEMME = TRANSFORMATION.omdoemme;
export const BOERS = BOERSLICENS;

// ---------- Agent-API-kanalen ----------

export type Krav = { ok: boolean; tekst: string };

export function agentApiKrav(s: GameState): { krav: Krav[]; aktiv: boolean; kanalNavn: string } {
  const aar = aarFor(s.uge);
  const kanal = CHANNELS.aiAgentApi;
  const node = RESEARCH_BY_ID.agentApi;
  const data = s.platforme.kontoplatform.dataejerskab;
  const krav: Krav[] = [
    { ok: aar >= kanal.fraAar, tekst: `Fra ${kanal.fraAar}${aar < kanal.fraAar ? ` (om ${kanal.fraAar - aar} år)` : ''}` },
    { ok: s.forskning.ulaast.includes('agentApi'), tekst: `Forskningen "${node?.navn ?? 'Agent-API'}"` },
    { ok: data + 1e-9 >= 0.6, tekst: `Dataejerskab på kontoplatformen ≥ 0,6 (nu ${decimal(data, 1)})` },
    { ok: (s.marketingMix.aiAgentApi ?? 0) > 0, tekst: 'Et budget på kanalen under Marked' },
  ];
  return { krav, aktiv: krav.every((k) => k.ok), kanalNavn: kanal.navn };
}

// ---------- Tid til laboratoriet ----------

export function ugerTilLab(s: GameState): number {
  return Math.max(0, AI_AKT_UGE - s.uge);
}
