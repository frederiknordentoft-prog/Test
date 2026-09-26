// Rene hjælpere til slutskærmen (spec 6.17): slutningens tone, tidslinjen pr. år, trofæhylden, byens udvikling
// og New Game+-valgene. Ingen React og ingen mutation.
import type { GameState, Milestone, NewGameOptions, NewGamePlusArv, TidslinjePunkt, TownProfile } from '../../sim/types';
/** Ikonnavn fra kit.tsx (holdt som streng her, så filen kan testes uden JSX) */
type IkonNavn = string;
import { SLUTNINGER, type SlutId } from '../../data/endings';
import { GALA_CATEGORIES } from '../../data/galaCategories';
import { aarFor } from '../../sim/time';
import { byTal } from '../../sim/town';
import { BY_PROFILER as BY_PROFILER_BY, PROFIL_STIL } from './byHjaelp';

export type Tone = 'godt' | 'blandet' | 'skidt';

export const TONE: Record<Tone, { navn: string; ikon: IkonNavn; farve: string; pixel: [string, string, string]; side: string }> = {
  godt: { navn: 'En god slutning', ikon: 'stjerne', farve: 'var(--color-good)', pixel: ['#fff1a8', 'var(--color-gold)', '#f59f1a'], side: '#8c4a12' },
  blandet: { navn: 'En blandet slutning', ikon: 'streg', farve: 'var(--color-warn)', pixel: ['#b9fff8', 'var(--color-cyan)', '#2fb5aa'], side: '#1c5f66' },
  skidt: { navn: 'En hård slutning', ikon: 'kryds', farve: 'var(--color-bad)', pixel: ['#ffb3b3', 'var(--color-bad)', '#b83a3a'], side: '#5e1a1a' },
};

export function slutInfo(id: string): { titel: string; tekst: string; tone: Tone } {
  const d = SLUTNINGER[id as SlutId];
  return d ? { titel: d.titel, tekst: d.tekst, tone: d.tone } : { titel: 'Spillet er slut', tekst: 'Et kapitel er slut. Her er jeres regnskab.', tone: 'blandet' };
}

// ---------- Tidslinje ----------

export type TidslinjeKind = TidslinjePunkt['kind'];

export const TIDSLINJE_KIND: Record<TidslinjeKind, { navn: string; ikon: IkonNavn; farve: string }> = {
  produkt: { navn: 'Produkter', ikon: 'produkt', farve: 'var(--color-sky)' },
  marked: { navn: 'Markeder', ikon: 'kort', farve: 'var(--color-good)' },
  firma: { navn: 'Firma', ikon: 'firma', farve: 'var(--color-gold)' },
  pris: { navn: 'Priser', ikon: 'trofae', farve: 'var(--color-violet)' },
  ai: { navn: 'AI', ikon: 'chip', farve: 'var(--color-cyan)' },
  verden: { navn: 'Verden', ikon: 'globus', farve: 'var(--color-muted)' },
  krise: { navn: 'Kriser', ikon: 'advarsel', farve: 'var(--color-bad)' },
};

export const TIDSLINJE_KINDS = Object.keys(TIDSLINJE_KIND) as TidslinjeKind[];

export type TidslinjeAar = { aar: number; punkter: TidslinjePunkt[] };

/** Tidslinjen grupperet pr. år — alle år fra start til slut, også de stille (så tiden kan ses) */
export function tidslinjePrAar(s: Pick<GameState, 'tidslinje' | 'uge' | 'slut'>, filter?: TidslinjeKind | 'alle'): TidslinjeAar[] {
  const alle = [...s.tidslinje].sort((a, b) => a.uge - b.uge);
  const punkter = !filter || filter === 'alle' ? alle : alle.filter((p) => p.kind === filter);
  const slutAar = aarFor(s.slut?.uge ?? s.uge);
  const startAar = Math.min(slutAar, alle.length ? aarFor(alle[0].uge) : slutAar);
  const ud: TidslinjeAar[] = [];
  for (let aar = startAar; aar <= slutAar; aar++) ud.push({ aar, punkter: punkter.filter((p) => aarFor(p.uge) === aar) });
  return ud;
}

export function antalPrKind(s: Pick<GameState, 'tidslinje'>): Record<TidslinjeKind, number> {
  const t = Object.fromEntries(TIDSLINJE_KINDS.map((k) => [k, 0])) as Record<TidslinjeKind, number>;
  for (const p of s.tidslinje) t[p.kind] += 1;
  return t;
}

// ---------- Trofæhylden ----------

export const MILEPAEL_NAVN: Record<Milestone, string> = {
  foersteKontrakt: 'Første opgave',
  foersteProjekt: 'Første projekt',
  foersteLancering: 'Første lancering',
  foersteTop10: 'Første Top 10',
  foersteNr1Dk: 'Nr. 1 i Danmark',
  foersteGuldkupon: 'Første Guldkupon',
  foersteHallOfFame: 'Første Hall of Fame',
  foersteGallapris: 'Første gallapris',
  andenVertikal: 'Anden vertikal',
  foersteRunde: 'Første runde',
  kaelder: 'Kælderen',
  kontor: 'Kontoret',
};

export type Trofaeer = {
  guld: { id: string; navn: string; total40: number; aar: number; hallOfFame: boolean }[];
  hallOfFame: number;
  /** Gallapriser samlet pr. kategori (flest først) */
  galla: { id: string; navn: string; aar: number[] }[];
  gallaIalt: number;
  milepaele: { id: Milestone; navn: string; aar: number }[];
};

export function trofaeer(s: Pick<GameState, 'produkter' | 'galla' | 'milepaele'>): Trofaeer {
  const guld = s.produkter
    .filter((p) => p.ejer === 'spiller' && (p.guldkupon || p.hallOfFame))
    .sort((a, b) => a.lanceretUge - b.lanceretUge)
    .map((p) => ({ id: p.id, navn: p.navn, total40: p.total40, aar: aarFor(p.lanceretUge), hallOfFame: p.hallOfFame }));
  const navn = (id: string) => GALA_CATEGORIES.find((c) => c.id === id)?.navn ?? id;
  const prKategori = new Map<string, number[]>();
  for (const g of s.galla) for (const id of g.vundet) prKategori.set(id, [...(prKategori.get(id) ?? []), g.aar]);
  const galla = [...prKategori.entries()]
    .map(([id, aar]) => ({ id, navn: navn(id), aar: [...aar].sort((a, b) => a - b) }))
    .sort((a, b) => b.aar.length - a.aar.length || a.aar[0] - b.aar[0]);
  const gallaIalt = galla.reduce((a, g) => a + g.aar.length, 0);
  const milepaele = (Object.entries(s.milepaele) as [Milestone, number | undefined][])
    .filter((x): x is [Milestone, number] => typeof x[1] === 'number')
    .sort((a, b) => a[1] - b[1])
    .map(([id, uge]) => ({ id, navn: MILEPAEL_NAVN[id] ?? id, aar: aarFor(uge) }));
  return { guld, hallOfFame: guld.filter((g) => g.hallOfFame).length, galla, gallaIalt, milepaele };
}

/** "2014", "2014 og 2019" eller "2014-2031" */
export function aarTekst(aar: number[]): string {
  if (aar.length === 0) return '';
  if (aar.length === 1) return String(aar[0]);
  if (aar.length === 2) return `${aar[0]} og ${aar[1]}`;
  return `${aar[0]}-${aar[aar.length - 1]}`;
}

// ---------- Eftertanke ----------

/**
 * Et eftertankekort i to dele: jeres vej (uden rigtige navne, vises på kortet) og "I virkeligheden …"
 * (med rigtige navne — vises kun i Arkivet, der kan slås fra).
 */
export function delEftertanke(tekst: string): { jeres: string; virkelighed: string | null } {
  const i = tekst.indexOf('I virkeligheden');
  if (i < 0) return { jeres: tekst, virkelighed: null };
  const jeres = tekst.slice(0, i).trim();
  return { jeres: jeres || 'Hvordan gik det egentlig i virkeligheden?', virkelighed: tekst.slice(i).trim() };
}

export type EftertankeKort = { id: string; titel: string; tekst: string; arkivId: string };

/** "I virkeligheden …"-delen af et arkivkort (fra archive.ts), eller null */

/** Slutskærmens tre eftertankekort (spec 6.17): sim-kernen vælger altid tre, så UI'et viser dem som de er */
export function eftertankeKort(_s: GameState, valgt: readonly EftertankeKort[]): EftertankeKort[] {
  return valgt.slice(0, 3).map((k) => ({ ...k }));
}

// ---------- Byens udvikling ----------

export type ByProfil = Exclude<TownProfile, 'churnet'>;
/** Samme rækkefølge, navne og farver som Byen-panelet (byHjaelp), så slutskærmens diagram ligner byen */
export const BY_PROFILER: readonly ByProfil[] = BY_PROFILER_BY;

/** VIP = guld, risiko = gul, problem = rød; rekreativ og engageret i neutrale toner (UI-brief fase 5) */
const BY_IKON: Record<ByProfil, IkonNavn> = { rekreativ: 'folk', engageret: 'hype', vip: 'krone', risiko: 'advarsel', problem: 'kryds' };
export const BY_PROFIL: Record<ByProfil, { navn: string; ikon: IkonNavn; farve: string }> = Object.fromEntries(
  BY_PROFILER.map((p) => [p, { navn: PROFIL_STIL[p].navn, ikon: BY_IKON[p], farve: PROFIL_STIL[p].farve }]),
) as Record<ByProfil, { navn: string; ikon: IkonNavn; farve: string }>;

export type ByAar = { aar: number; nu?: boolean } & Record<ByProfil, number>;

/** Byens sammensætning pr. år (andele af de aktive). Er det sidste år ikke gjort op endnu, tilføjes "nu". */
export function byUdvikling(s: GameState): ByAar[] {
  // År uden aktive kunder (alle andele 0) siger intet om byen: spring dem over
  const ud: ByAar[] = s.byAarlig.filter((r) => BY_PROFILER.some((p) => r[p] > 0)).map((r) => ({ ...r }));
  const t = byTal(s);
  const sidste = aarFor(s.slut?.uge ?? s.uge);
  if (t.aktive > 0 && (ud.length === 0 || ud[ud.length - 1].aar < sidste)) {
    ud.push({ aar: sidste, nu: true, rekreativ: t.rekreativ / t.aktive, engageret: t.engageret / t.aktive, vip: t.vip / t.aktive, risiko: t.risiko / t.aktive, problem: t.problem / t.aktive });
  }
  return ud;
}

/** Risiko + problem i første og sidste år (til en kort opsummering under diagrammet) */
export function byRoedAndel(r: Pick<ByAar, 'risiko' | 'problem'>): number {
  return r.risiko + r.problem;
}

// ---------- New Game+ ----------

export type StartMode = 'normal' | 'usa2018' | 'aiNative2026';

/** New Game+ fra slutskærmen: titelskærmen åbner med firmanavn, stiftere og vertikal forvalgt (og arven slået til),
 *  så man kan vælge om, før garagen åbner. Læses og nulstilles af titelskærmen. */
export const titelForvalg: { v: { navn: string; stiftere: string[]; vertikal: GameState['startVertikal'] } | null } = { v: null };
export type UlaastMode = Exclude<StartMode, 'normal'>;

export const MODE_INFO: Record<StartMode, { titel: string; kort: string; tekst: string; start: string; ikon: IkonNavn; farve: string; aar: number }> = {
  normal: {
    titel: 'New Game+',
    kort: 'Garagen 2012',
    tekst: 'Forfra i garagen i 2012 — men kombinationsbogen og alle niveauer er med.',
    start: 'Den klassiske start: en garage, to bærbare og januar 2012.',
    ikon: 'hus',
    farve: 'var(--color-gold)',
    aar: 2012,
  },
  usa2018: {
    titel: '2018-start i USA',
    kort: 'USA 2018',
    tekst: 'Højesteret har lige åbnet for sportsbetting. I starter med en bettinglicens i USA og en verden, der allerede er i gang.',
    start: 'Sommeren 2018: bettinglicens i USA fra dag ét. Verden har kørt i seks år uden jer.',
    ikon: 'globus',
    farve: 'var(--color-sky)',
    aar: 2018,
  },
  aiNative2026: {
    titel: 'AI-native fra 2026',
    kort: 'AI-native 2026',
    tekst: 'Start lige før AI-akten med dansk licens, en hybrid kontoplatform og tre agenter fra dag ét.',
    start: 'Nytår 2026: dansk licens, hybrid kontoplatform og tre AI-agenter. To mennesker og en flåde.',
    ikon: 'chip',
    farve: 'var(--color-cyan)',
    aar: 2026,
  },
};

export function nytSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/** Startvalg til New Game+ fra et afsluttet spil: samme firma og stiftere, nyt seed, arven med */
export function ngPlusValg(s: Pick<GameState, 'firmaNavn' | 'stiftere' | 'startVertikal'>, mode: StartMode, arv: NewGamePlusArv | undefined, seed = nytSeed()): NewGameOptions {
  const stiftere: [string, string] = [s.stiftere[0] ?? 'oddssaetteren', s.stiftere[1] ?? 'udvikleren'];
  return { seed, firmaNavn: s.firmaNavn, stiftere, startVertikal: mode === 'usa2018' ? 'betting' : s.startVertikal, tutorial: false, mode, arv };
}

/** Antal sete kombinationer og samlede niveauer i en arv (til knapperne) */
export function arvOpsummering(arv: NewGamePlusArv | null | undefined): { kombinationer: number; niveauer: number } {
  if (!arv) return { kombinationer: 0, niveauer: 0 };
  const kombinationer = Object.values(arv.kombinationsbog).filter((k) => k.set).length;
  const niveauer = [...Object.values(arv.niveauer.type), ...Object.values(arv.niveauer.tema)].reduce((a, n) => a + Math.max(0, n - 1), 0);
  return { kombinationer, niveauer };
}
