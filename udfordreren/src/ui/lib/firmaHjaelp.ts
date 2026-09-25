// Firma-sporet: rene hjælpere til personale, kontrakter, marked, firma og kalenderdialoger.
// Spejler sim-kernens formler (kun visning) — ændrer aldrig state.
import type {
  AcqChannel,
  ContractOffer,
  GameState,
  LiveProduct,
  QuarterGoal,
  QuarterHistory,
  Staff,
  StatKey,
  Vertical,
} from '../../sim/types';
import type { IkonNavn } from '../components/kit';
import type { EventEffect } from '../../data/events';
import type { ResearchNode } from '../../data/research';
import { useGame } from '../../store/gameStore';
import { kontraktKvalitet } from '../../sim/contracts';
import { forskningsEffekt } from '../../sim/insight';
import { effektivCac, kanalTilgaengelig, markedsKunder, portefoeljeStyrke, spillerKunderTotal } from '../../sim/customers';
import { effektTekst } from '../../sim/events';
import { CHANNELS } from '../../data/acquisition';
import { BONUS_TILGANG, OFFICE_BY_ID } from '../../data/costs';
import { BALANCE } from '../../data/balance';
import { VERTICALS } from '../../data/verticals';
import { PLATFORM_MODELS } from '../../data/platforms';
import { RESEARCH_BY_ID } from '../../data/research';
import { ugeIAar } from '../../sim/time';

// ---------- Stats og roller ----------

export const STAT_NAVN: Record<StatKey, string> = {
  kreativitet: 'Kreativitet',
  teknik: 'Teknik',
  matematik: 'Matematik',
  salg: 'Salg',
  ansvar: 'Ansvar',
  udholdenhed: 'Udholdenhed',
};
export const STAT_KORT: Record<StatKey, string> = {
  kreativitet: 'Kre',
  teknik: 'Tek',
  matematik: 'Mat',
  salg: 'Salg',
  ansvar: 'Ans',
  udholdenhed: 'Udh',
};
export const STAT_FARVE: Record<StatKey, string> = {
  kreativitet: 'var(--color-violet)',
  teknik: 'var(--color-sky)',
  matematik: 'var(--color-cyan)',
  salg: 'var(--color-pink)',
  ansvar: 'var(--color-good)',
  udholdenhed: 'var(--color-warn)',
};

export function energiFarve(e: number): string {
  return e >= 60 ? 'var(--color-good)' : e >= 30 ? 'var(--color-warn)' : 'var(--color-bad)';
}

export function tillidFarve(t: number): string {
  return t >= 60 ? 'var(--color-good)' : t >= 40 ? 'var(--color-warn)' : 'var(--color-bad)';
}

/** "3 uger" / "1 uge" */
export function uger(n: number): string {
  const v = Math.max(0, Math.round(n));
  return `${v} uge${v === 1 ? '' : 'r'}`;
}

/** Alder i uger som venlig tekst: "12 uger", "1 år og 8 uger" */
export function alderTekst(n: number): string {
  const v = Math.max(0, Math.round(n));
  if (v < 52) return uger(v);
  const aar = Math.floor(v / 52);
  const rest = v % 52;
  return rest === 0 ? `${aar} år` : `${aar} år og ${uger(rest)}`;
}

/** Procent uden overflødige decimaler: 0,2 → "20 %", 0,053 → "5,3 %" */
export function procent(v: number, dec = 1): string {
  const p = v * 100;
  const t = Math.abs(p - Math.round(p)) < 0.05 ? String(Math.round(p)) : p.toFixed(dec).replace('.', ',');
  return `${t.replace('-', '−')} %`;
}

/** Fjern kildemarkeringer som [F], [D], [F/A] fra datatekster */
export function rensNote(note: string): string {
  // Kildemarkeringer ud; markedskoder i data-noter ("i dk") vises som i resten af UI'et ("i DK")
  return note
    .replace(/\s*\[[FDA/]+\]/g, '')
    .replace(/\bi (dk|fi|uk|se|nl|us)\b/g, (_, k: string) => `i ${k.toUpperCase()}`)
    .trim();
}

// ---------- Kontraktopgaver ----------

/** Hvem er allerede på en kontraktopgave? */
export function paaKontrakt(s: GameState): Set<string> {
  return new Set(s.kontraktopgaver.flatMap((c) => c.staff));
}

/** Standardvalg til en opgave: den bedst egnede ledige person (foretrukken rolle tæller ×1,15) */
export function standardKontraktHold(s: GameState, t: ContractOffer): string[] {
  const optaget = paaKontrakt(s);
  const iProjekt = new Set<string>();
  for (const p of s.projekter) if (!p.klar) for (const id of p.faseTildeling[p.fase]) iProjekt.add(id);
  const kandidater = s.staff
    .filter((m) => !optaget.has(m.id))
    .map((m) => ({ m, score: m.stats[t.stat] * (m.rolle === t.rolle ? 1.15 : 1) - (iProjekt.has(m.id) ? 12 : 0) }))
    .sort((a, b) => b.score - a.score);
  return kandidater.length ? [kandidater[0].m.id] : [];
}

/** Forventet betaling og indsigt (samme formel som ugentligeKontrakter) */
export function kontraktForventning(s: GameState, t: ContractOffer, ids: readonly string[]): { q: number; betaling: number; indsigt: number } {
  const hold = ids.map((id) => s.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
  if (hold.length === 0) return { q: 0, betaling: 0, indsigt: 0 };
  const q = kontraktKvalitet(t, hold);
  const eff = forskningsEffekt(s);
  return {
    q,
    betaling: Math.round(t.betaling * q * 1000) / 1000,
    indsigt: Math.round(t.indsigt * Math.min(1.5, q) * (1 + eff.indsigt)),
  };
}

// ---------- Marketing ----------

/** Forventede nye kunder pr. uge fra én kanal i dk ved et givet ugentligt forbrug (spejler kanalTilgang + fordeling) */
export function kanalKunderPrUge(s: GameState, k: AcqChannel, spend: number): number {
  if (k === 'crm' || spend <= 0 || !kanalTilgaengelig(s, k)) return 0;
  const ms = s.markeder.dk;
  if (ms.licens !== 'aktiv') return 0;
  const cac = effektivCac(s, k, 'dk');
  if (!cac) return 0;
  const effSpend = spend / (1 + spend / CHANNELS[k].maetning);
  const nye = ((effSpend * 1e6) / cac) * (1 + BONUS_TILGANG[s.bonusNiveau]);
  // Fordeling på vertikaler med produkter; kasinokunder er dyrere
  let taeller = 0;
  let naevner = 0;
  for (const v of ['betting', 'kasino'] as Vertical[]) {
    const st = ms.vertikaler[v].status === 'aktiv' ? portefoeljeStyrke(s, 'dk', v) : 0;
    const w = st * markedsKunder(s, 'dk', v);
    naevner += w;
    taeller += w / VERTICALS[v].cacFaktor;
  }
  return naevner > 0 ? (nye * taeller) / naevner : 0;
}

// ---------- Events ----------

export type EffektChip = { tekst: string; tone: 'god' | 'skidt' | 'neutral'; ikon: IkonNavn };

const EFFEKT_STIL: { k: keyof EventEffect; ikon: IkonNavn; omvendt?: boolean; neutral?: boolean }[] = [
  { k: 'kapital', ikon: 'penge' },
  { k: 'bsiUger', ikon: 'penge' },
  { k: 'indsigt', ikon: 'indsigt' },
  { k: 'hype', ikon: 'hype' },
  { k: 'omdoemme', ikon: 'stjerne' },
  { k: 'tillid', ikon: 'skjold' },
  { k: 'energiAlle', ikon: 'lyn' },
  { k: 'kunderPct', ikon: 'folk' },
  { k: 'marketingPct', ikon: 'hoejttaler', neutral: true },
  { k: 'pres', ikon: 'advarsel', omvendt: true },
  { k: 'vaerdiPct', ikon: 'diamant' },
  { k: 'staffLoenPct', ikon: 'penge', omvendt: true },
  // Fase 3-5: tilsyn i alle markeder, politisk pres, byen, agenter og minimumsmarketing
  { k: 'tillidAlle', ikon: 'skjold' },
  { k: 'politiskPres', ikon: 'paragraf', omvendt: true },
  { k: 'byRisiko', ikon: 'folk', omvendt: true },
  { k: 'agentOvervaagning', ikon: 'oeje' },
  { k: 'marketingMin', ikon: 'hoejttaler', neutral: true },
];

/** Effekter uden fortegn (til/fra eller et bestemt niveau) — tekster fra effektTekst */
const EFFEKT_FAST: { k: 'agentFra' | 'hyperFra' | 'vipNiveau' | 'bonusNiveau'; ikon: IkonNavn }[] = [
  { k: 'agentFra', ikon: 'terminal' },
  { k: 'hyperFra', ikon: 'chip' },
  { k: 'vipNiveau', ikon: 'krone' },
  { k: 'bonusNiveau', ikon: 'penge' },
];

function dansk(t: string): string {
  return t.replace(/(\d)\.(\d)/g, '$1,$2').replace(/-(\d)/g, '−$1');
}

/** Effekt-chips til et eventvalg (tekster fra sim-kernens effektTekst) med tone og ikon */
export function effektChips(eff: EventEffect, ctx: Record<string, string | number>): EffektChip[] {
  const ud: EffektChip[] = [];
  for (const st of EFFEKT_STIL) {
    const v = eff[st.k];
    if (typeof v !== 'number' || v === 0) continue;
    const tekst = effektTekst({ [st.k]: v } as EventEffect)[0];
    if (!tekst) continue;
    const positiv = st.omvendt ? v < 0 : v > 0;
    ud.push({ tekst: dansk(tekst), tone: st.neutral ? 'neutral' : positiv ? 'god' : 'skidt', ikon: st.ikon });
  }
  if (eff.staffEnergi) {
    const navn = typeof ctx.navn === 'string' ? ctx.navn.split(' ')[0] : 'medarbejderen';
    ud.push({ tekst: `${eff.staffEnergi > 0 ? '+' : '−'}${Math.abs(eff.staffEnergi)} energi til ${navn}`, tone: eff.staffEnergi > 0 ? 'god' : 'skidt', ikon: 'lyn' });
  }
  if (eff.staffForlader) ud.push({ tekst: effektTekst({ staffForlader: true })[0] ?? 'medarbejderen forlader firmaet', tone: 'skidt', ikon: 'doer' });
  for (const st of EFFEKT_FAST) {
    const v = eff[st.k];
    if (v === undefined || v === false) continue;
    const tekst = effektTekst({ [st.k]: v } as EventEffect)[0];
    if (tekst) ud.push({ tekst: dansk(tekst), tone: 'neutral', ikon: st.ikon });
  }
  if (ud.length === 0) ud.push({ tekst: 'Ingen ændring', tone: 'neutral', ikon: 'streg' });
  return ud;
}

// ---------- Kvartalsmøder ----------

type KvartalMinde = { maal: QuarterGoal[]; pres: number; stjerner: number; nyeIds: string };
let kvartalMinde: KvartalMinde | null = null;
const idNoegle = (maal: readonly QuarterGoal[]) => maal.map((m) => m.id).join('|');

// Sim-kernen erstatter kvartalsmålene i samme step, som kvartalsmødet holdes. Husk derfor de forrige mål,
// så kvartalsdialogen kan vise dem med ✓/✗.
useGame.subscribe((st, prev) => {
  const g = st.game;
  const p = prev.game;
  if (!g || !p || g === p) return;
  // Kun et almindeligt ugeskift i samme spil (ikke indlæsning, nyt spil eller debug-hop)
  if (g.seed !== p.seed || g.firmaNavn !== p.firmaNavn || g.uge !== p.uge + 1) {
    if (g.seed !== p.seed || g.uge < p.uge) kvartalMinde = null;
    return;
  }
  const ny = idNoegle(g.kvartalsmaal);
  if (ny !== idNoegle(p.kvartalsmaal)) kvartalMinde = { maal: p.kvartalsmaal, pres: p.investorer.pres, stjerner: p.investorer.stjerner, nyeIds: ny };
});

/** Det forrige kvartals mål (hvis vi så skiftet ske i denne session) */
export function forrigeKvartal(g: GameState): KvartalMinde | null {
  return kvartalMinde && kvartalMinde.nyeIds === idNoegle(g.kvartalsmaal) ? kvartalMinde : null;
}

/** Genskab evalueringen af et forrige mål ud fra historikrækken (samme regler som evaluerMaal) */
export function evaluerForrigeMaal(g: GameState, m: QuarterGoal, h: QuarterHistory | undefined): boolean | null {
  if (m.opfyldt !== null) return m.opfyldt;
  if (!h) return null;
  switch (m.kind) {
    case 'lancer': return h.lanceringer >= m.maal;
    case 'kunder': return h.kunder >= m.maal;
    case 'bsi': return h.bsi >= m.maal;
    case 'top10': return h.top10;
    case 'tillid': return g.markeder.dk.tilsynstillid >= m.maal;
    case 'overskud': return h.resultat >= 0;
    case 'anmeldelse': return h.bedsteTotal40 >= m.maal;
    case 'guldkupon': return h.bedsteTotal40 >= 32;
    case 'kontrakt': return g.milepaele.foersteKontrakt !== undefined;
    case 'projekt': return g.milepaele.foersteProjekt !== undefined;
  }
}

export const MAAL_IKON: Record<QuarterGoal['kind'], IkonNavn> = {
  lancer: 'raket',
  kunder: 'folk',
  bsi: 'penge',
  top10: 'hitliste',
  tillid: 'skjold',
  overskud: 'penge',
  anmeldelse: 'stjerne',
  guldkupon: 'trofae',
  kontrakt: 'kontrakt',
  projekt: 'produkt',
};

/** Uger til næste kvartalsmøde og dets navn */
export function naesteKvartalsmoede(uge: number): { uger: number; kvartal: number } {
  const u = ugeIAar(uge);
  const til = 13 - (u % 13);
  const naesteU = (u + til) % 52;
  return { uger: til, kvartal: Math.floor(naesteU / 13) + 1 };
}

// ---------- Produkter og hitliste ----------

export function bsiUge(p: LiveProduct): number {
  return Object.values(p.bsiPrUge).reduce((a: number, b) => a + (b ?? 0), 0);
}

/** Placering i dk blandt alle aktive produkter (samme sortering som beregnTop10) */
/** Samme rangering som hitlisten i sim-kernen: ugens nye spillere, derefter BSI */
export function dkRangliste(s: GameState): LiveProduct[] {
  const nye = (p: LiveProduct) => p.nyeSpillerePrUge?.dk ?? 0;
  return s.produkter
    .filter((p) => p.aktiv && nye(p) > 0)
    .sort((a, b) => nye(b) - nye(a) || (b.bsiPrUge.dk ?? 0) - (a.bsiPrUge.dk ?? 0) || (a.id < b.id ? -1 : 1));
}

// ---------- Gallaen ----------

export type Nominering = { id: string; nomineret: boolean; hint: string };

/** Er spilleren p.t. nomineret i gallaens kategorier? (samme betingelser som galaScores) */
export function gallaNomineringer(s: GameState): Nominering[] {
  const innov = s.aarAkk.nyeKombinationer + s.aarAkk.nyeFeatures;
  const tillid = s.aarAkk.tillidUger > 0 ? s.aarAkk.tillidSum / s.aarAkk.tillidUger : 0;
  const kunder = spillerKunderTotal(s);
  const pk = s.platforme.kontoplatform;
  return [
    { id: 'produkt', nomineret: s.aarAkk.lanceringer > 0, hint: 'Lancér et produkt i år' },
    { id: 'innovation', nomineret: innov > 0, hint: 'Prøv en ny kombination eller feature' },
    { id: 'ansvarlig', nomineret: tillid >= 72, hint: `Tilsynstillid på 72 i snit (nu ${Math.round(tillid)})` },
    { id: 'udfordrer', nomineret: kunder >= 5000, hint: 'Mindst 5.000 kunder' },
    { id: 'platform', nomineret: pk.model !== 'whiteLabel', hint: `Kræver mere end ${PLATFORM_MODELS.whiteLabel.navn.toLowerCase()} (senere)` },
  ];
}

// ---------- Forskning ----------

const dybdeCache = new Map<string, number>();
export function forskningsDybde(n: ResearchNode): number {
  const c = dybdeCache.get(n.id);
  if (c !== undefined) return c;
  const d = n.kraever.length === 0 ? 0 : 1 + Math.max(...n.kraever.map((k) => (RESEARCH_BY_ID[k] ? forskningsDybde(RESEARCH_BY_ID[k]) : 0)));
  dybdeCache.set(n.id, d);
  return d;
}

const PARAM_ORD: Record<string, string> = { spaending: 'spænding', originalitet: 'originalitet', teknik: 'teknik', tryghed: 'tryghed' };

export function forskningsEffektTekst(n: ResearchNode): string[] {
  const e = n.effekt;
  const t: string[] = [];
  const p = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)} %`;
  if (e.paramBonus) for (const [k, v] of Object.entries(e.paramBonus)) if (v) t.push(`${p(v)} ${PARAM_ORD[k] ?? k}`);
  if (e.fejl) t.push(`${p(e.fejl)} fejl`);
  if (e.churn) t.push(`${p(e.churn)} churn`);
  if (e.cac) t.push(`${p(e.cac)} CAC`);
  if (e.arpu) t.push(`${p(e.arpu)} BSI pr. kunde`);
  if (e.indsigt) t.push(`${p(e.indsigt)} indsigt`);
  if (e.boost) t.push(`${p(e.boost)} boost`);
  if (e.tillid) t.push(`+${String(e.tillid).replace('.', ',')} tillid/kvartal`);
  return t;
}

/** Fornavn — med efternavnets forbogstav, hvis flere i firmaet deler fornavnet */
export function kortNavn(m: Pick<Staff, 'id' | 'navn'>, alle: readonly Pick<Staff, 'id' | 'navn'>[]): string {
  const dele = m.navn.split(' ');
  const fornavn = dele[0];
  const dublet = alle.some((x) => x.id !== m.id && x.navn.split(' ')[0] === fornavn);
  return dublet && dele.length > 1 ? `${fornavn} ${dele[dele.length - 1][0]}.` : fornavn;
}

// ---------- Kassen: tendens og hvor længe den rækker ----------

/** Ugens faste drift: BSI minus løbende omkostninger (uden kontraktbetalinger og engangsudgifter som projektbudgetter) */
export function fastDrift(g: GameState): number {
  const r = g.regnskab;
  const husleje = OFFICE_BY_ID[g.kontor].husleje + (spillerKunderTotal(g) * BALANCE.driftPrKunde) / 1e6;
  return r.bsi - (r.afgift + r.revenueShare + r.betalinger + r.bonus + r.indhold + r.marketing + r.loen + r.licenser + husleje);
}

/** Gennemsnitligt ugentligt resultat over (ca.) de seneste 13 uger. Kontraktbetalinger og engangsudgifter tæller med,
 *  men udjævnes. I spillets første uger (for lidt historik) bruges den faste drift. */
export function ugentligTendens(g: GameState): number {
  const n = ugeIAar(g.uge) % 13; // uger talt med i kvartalAkk
  const forrige = g.historik[g.historik.length - 1];
  if (forrige) return (g.kvartalAkk.resultat + (forrige.resultat * (13 - n)) / 13) / 13;
  if (n >= 4) return g.kvartalAkk.resultat / n;
  return fastDrift(g);
}

export type Kassetid = { uger: number; tendens: number } | null;

/** Hvor mange uger rækker kassen med det nuværende forbrug? null = kassen vokser (eller står stille). */
export function kassenRaekker(g: GameState): Kassetid {
  const tendens = ugentligTendens(g);
  if (!(tendens < -0.0005) || g.kapital <= 0) return null;
  return { uger: Math.floor(g.kapital / -tendens), tendens };
}

// ---------- Kvartalsmål: løbende mål vises som fremdrift, ikke som opfyldt ----------

export type MaalVisning = { status: 'ok' | 'mangler' | 'undervejs'; note?: string; noteGod?: boolean };

/** Visning af et kvartalsmål midt i kvartalet. Løbende summer (overskud) afgøres først ved kvartalsmødet. */
export function maalVisning(g: GameState, m: QuarterGoal, ok: boolean): MaalVisning {
  if (m.kind === 'overskud') {
    const r = g.kvartalAkk.resultat;
    const uger = ugeIAar(g.uge) % 13;
    const tal = `${r >= 0 ? '+' : '−'}${Math.round(Math.abs(r) * 1000).toLocaleString('da-DK')} t. kr.`;
    return { status: 'undervejs', note: uger === 0 ? 'Kvartalet er lige begyndt' : `Resultat indtil nu: ${tal}`, noteGod: r >= 0 };
  }
  return { status: ok ? 'ok' : 'mangler' };
}
