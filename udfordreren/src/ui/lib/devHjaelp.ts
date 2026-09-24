// Dev-sporet: rene hjælpere til udviklingsloopet (projekter, tildeling, kombinationsbog, anmeldelser).
// Spejler sim-kernens formler (src/sim/projects.ts) uden at ændre state — bruges kun til visning.
import type { GameState, LiveProduct, MarketId, ParamKey, Params, Phase, Project, ProductTypeId, Review, Staff, ThemeId, Vertical } from '../../sim/types';
import type { IkonNavn } from '../components/kit';
import type { Fit } from '../../data/compatibility';
import { personPoint, budgetFaktor, minBudgetUge } from '../../sim/projects';
import { niveauFaktor, NIVEAU_TAERSKLER, niveauForXp } from '../../sim/levels';
import { forskningsEffekt } from '../../sim/insight';
import { passiveEffekter } from '../../sim/staff';
import { BALANCE } from '../../data/balance';
import { PRODUCT_TYPES } from '../../data/productTypes';
import { TEMA_ORD, TYPE_ORD } from '../../data/names';
import { RESEARCH } from '../../data/research';
import { REVIEWER_BY_ID } from '../../data/reviewers';
import { ratioer } from '../../sim/reviews';

export const FASE_NAVN: Record<Phase, string> = { koncept: 'Koncept', design: 'Design', teknik: 'Teknik', test: 'Test' };
export const FASE_STAT_TEKST: Record<Phase, string> = {
  koncept: 'Kreativitet',
  design: 'Kreativitet + matematik',
  teknik: 'Teknik',
  test: 'Teknik + ansvar',
};
export const FASE_GIVER: Record<Phase, string> = {
  koncept: 'Mest originalitet',
  design: 'Spænding og originalitet',
  teknik: 'Teknik — men også fejl',
  test: 'Fjerner fejl, giver tryghed',
};

export const PARAM_NAVN: Record<ParamKey, string> = { spaending: 'Spænding', originalitet: 'Originalitet', teknik: 'Teknik', tryghed: 'Tryghed' };
export const PARAM_KORT: Record<ParamKey, string> = { spaending: 'Spæn', originalitet: 'Orig', teknik: 'Tek', tryghed: 'Tryg' };
export const PARAM_FARVE: Record<ParamKey, string> = {
  spaending: 'var(--color-pink)',
  originalitet: 'var(--color-violet)',
  teknik: 'var(--color-sky)',
  tryghed: 'var(--color-good)',
};
export const PARAM_IKON: Record<ParamKey, IkonNavn> = { spaending: 'hype', originalitet: 'stjerne', teknik: 'tandhjul', tryghed: 'skjold' };

/** Kombinationsvurdering 1-5 → farve og ikon (aldrig kun farve) */
export const FIT_STIL: Record<Fit, { farve: string; ikon: IkonNavn }> = {
  1: { farve: 'var(--color-bad)', ikon: 'ned' },
  2: { farve: 'var(--color-warn)', ikon: 'streg' },
  3: { farve: 'var(--color-sky)', ikon: 'op' },
  4: { farve: 'var(--color-good)', ikon: 'stjerne' },
  5: { farve: 'var(--color-gold)', ikon: 'krone' },
};

export const INTENSITET_NAVN: Record<1 | 2 | 3 | 4 | 5, string> = { 1: 'Rolig', 2: 'Afdæmpet', 3: 'Normal', 4: 'Intens', 5: 'Maks' };

/** Den stat-score, sim-kernen bruger i en fase (før rolle- og energifaktor) */
export function faseStat(m: Staff, fase: Phase): number {
  const st = m.stats;
  if (fase === 'koncept') return st.kreativitet;
  if (fase === 'design') return 0.6 * st.kreativitet + 0.4 * st.matematik;
  if (fase === 'teknik') return st.teknik;
  return 0.6 * st.teknik + 0.4 * st.ansvar;
}

export type HoldBidrag = { id: string; raa: number; vaegt: number; point: number; plads: number };
export type HoldEstimat = { bidrag: HoldBidrag[]; total: number; params: Params; fejl: number; fjernet: number };

/**
 * Forventet ugentlig udbytte for et hold i en fase (gennemsnit uden tilfældig variation).
 * Samme formel som ugentligtProjekt: sorteret efter styrke, n-te person vægtes holdVaegt^(n-1).
 */
export function holdEstimat(s: GameState, p: Project, fase: Phase, ids: readonly string[]): HoldEstimat {
  const type = PRODUCT_TYPES[p.typeId];
  const eff = forskningsEffekt(s, type.vertikal);
  const passiv = passiveEffekter(s);
  const lvl = niveauFaktor(s, p.typeId, p.themeId, BALANCE.niveauBonus);
  const bud = budgetFaktor(p.budget, minBudgetUge(p.typeId, p.startUge));
  const fordeling = BALANCE.fordeling[fase];
  const hold = ids.map((id) => s.staff.find((m) => m.id === id)).filter((m): m is Staff => !!m);
  const sorteret = hold.map((m) => ({ m, raa: personPoint(m, p, fase) })).sort((a, b) => b.raa - a.raa);
  const params: Params = { spaending: 0, originalitet: 0, teknik: 0, tryghed: 0 };
  let total = 0;
  let fejl = 0;
  let fjernet = 0;
  const bidrag: HoldBidrag[] = sorteret.map(({ m, raa }, i) => {
    const vaegt = Math.pow(BALANCE.holdVaegt, i);
    const point = raa * vaegt * lvl * bud * BALANCE.pointSkala;
    total += point;
    for (const k of Object.keys(params) as ParamKey[]) params[k] += point * fordeling[k] * (1 + eff.paramBonus[k]);
    if (fase === 'teknik') {
      fejl +=
        BALANCE.fejlBasis *
        (1.25 - m.stats.teknik / 100) *
        (1.5 - 0.5 * (m.energi / 100)) *
        (0.8 + 0.1 * (p.intensitet - 1)) *
        (0.6 + type.risiko / 20) *
        Math.max(0.3, 1 + eff.fejl + passiv.fejl);
    } else if (fase === 'test') {
      fjernet +=
        (BALANCE.testFjernBasis + m.stats.teknik * BALANCE.testFjernTeknik + m.stats.ansvar * BALANCE.testFjernAnsvar) *
        vaegt *
        (0.55 + 0.45 * (m.energi / 100));
    }
    return { id: m.id, raa, vaegt, point, plads: i };
  });
  return { bidrag, total, params, fejl, fjernet };
}

/** Forslag til produktnavn ud fra tema- og typeord (kosmetisk tilfældighed er fin i UI) */
export function foreslaaNavn(typeId: ProductTypeId, themeId: ThemeId, r: () => number = Math.random): string {
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
  const tema = pick(TEMA_ORD[themeId] ?? ['Nyt']);
  const type = pick(TYPE_ORD[typeId] ?? ['Spil']);
  if (tema.toLowerCase().includes(type.toLowerCase())) return tema;
  return r() < 0.7 ? `${tema} ${type}` : `${type} ${tema}`;
}

const TYPE_FEATURE_NAVN: Record<string, string> = {
  live: 'Live-odds',
  betBuilder: 'Bet builder',
  eventKontrakter: 'Event-kontrakter',
  egneSlots: 'Egne automater',
  livekasino: 'Live-borde',
  jackpot: 'Fælles jackpot',
  aiSlots: 'Genereret indhold',
};

export function featureNavn(f: string): string {
  return RESEARCH.find((r) => r.feature === f)?.navn ?? TYPE_FEATURE_NAVN[f] ?? f;
}

/** Niveau 1-10 og fremdrift mod næste niveau ud fra xp */
export function niveauFremdrift(xp: number): { niveau: number; andel: number; tilNaeste: number | null; ialt: number } {
  const niveau = niveauForXp(xp);
  if (niveau >= NIVEAU_TAERSKLER.length) return { niveau, andel: 1, tilNaeste: null, ialt: xp };
  const fra = NIVEAU_TAERSKLER[niveau - 1];
  const til = NIVEAU_TAERSKLER[niveau];
  return { niveau, andel: (xp - fra) / (til - fra), tilNaeste: til - xp, ialt: xp };
}

/** Licensstatus for en vertikal i et marked, med uger til den er klar */
export function licensInfo(s: GameState, v: Vertical, m: MarketId = 'dk'): { status: 'ingen' | 'ansoegt' | 'aktiv'; uger: number } {
  const lic = s.markeder[m].vertikaler[v];
  if (lic.status === 'aktiv' && s.markeder[m].licens === 'aktiv') return { status: 'aktiv', uger: 0 };
  if (lic.status === 'ingen') return { status: 'ingen', uger: 0 };
  return { status: 'ansoegt', uger: Math.max(0, (lic.klarUge ?? s.uge) - s.uge) };
}

export function ugerTekst(n: number): string {
  return `${n} uge${n === 1 ? '' : 'r'}`;
}

/** Halveringstid som venlig tekst */
export function levetidTekst(uger: number): string {
  if (uger >= 52) {
    const aar = Math.round(uger / 52);
    return `ca. ${aar} år`;
  }
  return `${uger} uger`;
}

/** Procent med dansk komma, uden overflødige decimaler */
export function pctKort(v: number, dec = 1): string {
  const p = v * 100;
  const tekst = Math.abs(p - Math.round(p)) < 1e-6 ? String(Math.round(p)) : p.toFixed(dec).replace('.', ',');
  return `${tekst} %`;
}

export function marginInterval(typeId: ProductTypeId): string {
  const t = PRODUCT_TYPES[typeId];
  return `${pctKort(t.marginMin).replace(' %', '')}-${pctKort(t.marginMax)}`;
}

/** Samlet udviklingstid i uger for en type (koncept + design + teknik + test) */
export function udviklingsUger(typeId: ProductTypeId): number {
  const t = PRODUCT_TYPES[typeId];
  return BALANCE.koncetUger + t.designUger + t.teknikUger + BALANCE.testUger;
}

/** 2.0-version: uger siden originalen og om der er straf for tidlig relancering */
export function efterfoelgerInfo(s: GameState, original: LiveProduct): { uger: number; tidlig: boolean; ventUger: number } {
  const uger = Math.max(0, s.uge - original.lanceretUge);
  return { uger, tidlig: uger < 52, ventUger: Math.max(0, 52 - uger) };
}

/** Var produktet spillerens første forsøg med kombinationen? (ingen tidligere egne produkter med samme type × tema) */
export function varFoersteForsoeg(s: GameState, p: LiveProduct): boolean {
  return !s.produkter.some(
    (x) => x.ejer === 'spiller' && x.id !== p.id && x.typeId === p.typeId && x.themeId === p.themeId && x.lanceretUge <= p.lanceretUge,
  );
}

/** Indsigt tjent ved lanceringen (samme formel som launch()) */
export function lanceringsIndsigt(s: GameState, total40: number, guldkupon: boolean): number {
  const eff = forskningsEffekt(s);
  return Math.round((4 + total40 / 5) * (guldkupon ? 1.5 : 1) * (1 + eff.indsigt)) + (guldkupon ? 10 : 0);
}

/** Forventet hype-løft fra en kampagne (samme formel som launchCampaign) */
export function kampagneHype(hype: number, budget: number): number {
  return 25 * (1 - Math.exp(-budget / 0.4)) * (1 - hype / 120);
}

/** Farve for en anmelderscore 1-10 */
export function scoreFarve(n: number): string {
  if (n <= 3) return 'var(--color-bad)';
  if (n <= 5) return 'var(--color-warn)';
  if (n <= 7) return 'var(--color-ink)';
  if (n <= 9) return 'var(--color-good)';
  return 'var(--color-gold)';
}

/** Skal versionsmærket (fx "2.0") vises ved siden af navnet? Ikke hvis navnet allerede slutter på versionen. */
export function visVersion(navn: string, version: number): boolean {
  return version > 1 && !navn.trim().endsWith(`${version}.0`);
}

// ---------- Anmeldelser: citater og dom i kontekst ----------

/** Forbrugerpostens "for dyrt"-citater giver kun mening, når marginen faktisk er over standard */
const FOR_DYRT = new Set(['Dyrt for pengene.', 'Kunderne betaler for garagelejen.', 'Priserne kunne være skarpere.']);

/** Citatet, som det skal vises: garage-citater kun i garagen, og "for dyrt" kun ved høj margin.
 *  Findes der ikke et passende alternativ i samme scoreinterval, vises det oprindelige citat. */
export function visCitat(s: GameState, p: LiveProduct, a: Review): string {
  const r = REVIEWER_BY_ID[a.anmelder];
  const interval = r?.citater.find((b) => b.includes(a.citat));
  if (!r || !interval) return a.citat;
  const iGarage = s.milepaele.kaelder === undefined || p.lanceretUge < s.milepaele.kaelder;
  const hoejMargin = p.margin > PRODUCT_TYPES[p.typeId].marginStd * 1.02;
  const passer = (c: string) => (iGarage || !/garage/i.test(c)) && !(a.anmelder === 'forbrugerposten' && !hoejMargin && FOR_DYRT.has(c));
  if (passer(a.citat)) return a.citat;
  const alt = interval.filter(passer);
  if (alt.length === 0) return a.citat;
  let h = 0;
  for (const ch of p.id + a.anmelder) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return alt[h % alt.length];
}

/** Den parameter, produktet halter mest efter markedsstandarden på (null uden parametre) */
export function svagesteParam(s: GameState, p: LiveProduct): ParamKey | null {
  if (!p.params) return null;
  const r = ratioer(s, { typeId: p.typeId, params: p.params, markeder: p.markeder });
  return (Object.keys(r) as ParamKey[]).reduce((a, b) => (r[b] < r[a] ? b : a));
}

/** Dommen under totalen: tager højde for forrige lancering og hvor mange, firmaet har lanceret */
export function anmeldelsesDom(total: number, forrige: number | null, antal: number, svagest: ParamKey | null): string {
  if (total >= 36) return 'Et mesterværk. Branchen taler ikke om andet.';
  if (total >= 32) return forrige !== null && total - forrige >= 3 ? `Et brag af en lancering — ${total - forrige} point bedre end sidst!` : 'Et brag af en lancering!';
  const hint = svagest ? ` I halter mest efter på ${PARAM_NAVN[svagest]}.` : '';
  if (forrige !== null) {
    const d = total - forrige;
    if (d >= 3) return `Bedre end sidst: +${d}! ${total >= 26 ? 'Kunderne er på vej.' : 'I er på vej op.'}`;
    if (d <= -3) return `${d} i forhold til sidst. Markedet har flyttet sig.${hint}`;
    if (total >= 26) return 'Solidt igen! Kunderne er på vej.';
    return `På niveau med sidst — og markedet kræver lidt mere hvert år.${hint}`;
  }
  if (total >= 26) return 'Solidt! Kunderne er på vej.';
  if (antal <= 1) return total >= 18 ? 'Et fint første skridt. Næste version bliver skarpere.' : 'Hårdt publikum. Men alle store starter et sted.';
  return `Anmelderne var ikke imponerede.${hint || ' Næste gang bliver skarpere.'}`;
}
