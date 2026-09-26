// Kontorets geometri pr. trin. Alle koordinater er i "scene-pixels"; scenen er 320×180 / zoom.
// Garage og kælder tegnes med zoom 2 (160×90 scene) — trangt og hyggeligt med store figurer. Fra kontoret zoomes ud til fuld 320×180.
import type { OfficeTier } from '../sim/types';
import { OFFICE_BY_ID } from '../data/costs';

export const CANVAS_W = 320;
export const CANVAS_H = 180;

/** Bordets bredde (skærm + person). Personrammen starter ved x+11; bordpladen ved y. */
export const BORD_W = 24;
export const PERSON_DX = 11;
/** Skærm (inkl. kant) og selve skærmfladen relativt til bordets øverste venstre hjørne */
export const MONITOR = { x: 1, y: -9, w: 9, h: 8 } as const;
export const SKAERM = { x: 2, y: -8, w: 7, h: 6 } as const;

/** Serverskab (AI-akten): bredde inkl. kant */
export const SKAB_W = 8;
/** Lille licensbevis på væggen (inkl. ramme) */
export const LICENS_W = 9;
export const LICENS_H = 8;

export type Plads = { i: number; x: number; y: number; raekke: number };
export type Felt = { x: number; y: number; w: number; h: number };
export type Punkt = { x: number; y: number };

/** AI-akten: hvor serverskabe og hologram-agenter står */
export type AiZone = {
  /** Skabspladser i den rækkefølge, de fyldes (x = venstre kant, y = bund) */
  skabe: Punkt[];
  /** Skabenes højde i dette trin */
  skabH: number;
  /** Hologrammernes fødder, i den rækkefølge de fyldes */
  holo: Punkt[];
};

export type Layout = {
  tier: OfficeTier;
  zoom: 1 | 2;
  w: number;
  h: number;
  vaegH: number;
  pladser: Plads[];
  /** Bordplade-y for hver række (sorteret oppefra) */
  raekker: number[];
  hylde: Felt; // pokalhylde: planke ved (x, y), pokaler står oven på
  tv: Felt;
  /** Licensbeviser: ét pr. marked med licens, i den rækkefølge de hænges op */
  licenser: Punkt[];
  kuponer: Felt;
  plaketter: Felt;
  skilt: Felt | null;
  paere: { x: number; y: number } | null; // bar pære (garagen)
  ur: { x: number; y: number } | null; // vægur (7×7), viseren følger ugen
  /** Vinduer (lyser igennem mørket i AI-akten) */
  vinduer: Felt[];
  /** Vitrineskab om pokalhylden (de største trin) */
  vitrine: boolean;
  ai: AiZone;
};

function raekke(y: number, xs: number[], r: number, start: number): Plads[] {
  return xs.map((x, k) => ({ i: start + k, x, y, raekke: r }));
}

function byg(tier: OfficeTier, def: Omit<Layout, 'pladser' | 'raekker' | 'tier'> & { rows: { y: number; xs: number[] }[] }): Layout {
  const pladser: Plads[] = [];
  def.rows.forEach((row, r) => pladser.push(...raekke(row.y, row.xs, r, pladser.length)));
  const { rows, ...rest } = def;
  return { tier, ...rest, pladser, raekker: rows.map((x) => x.y) };
}

const spredt = (n: number, fra: number, afstand: number) => Array.from({ length: n }, (_, i) => fra + i * afstand);
const punkter = (xs: number[], y: number): Punkt[] => xs.map((x) => ({ x, y }));
/** Gitter af punkter (kolonner × rækker) */
const gitter = (x0: number, y0: number, kol: number, rk: number, dx: number, dy: number): Punkt[] =>
  Array.from({ length: kol * rk }, (_, i) => ({ x: x0 + (i % kol) * dx, y: y0 + Math.floor(i / kol) * dy }));

const LAYOUTS: Record<OfficeTier, Layout> = {
  garage: byg('garage', {
    zoom: 2,
    w: 160,
    h: 90,
    vaegH: 46,
    rows: [{ y: 70, xs: [14, 44] }],
    hylde: { x: 52, y: 25, w: 48, h: 2 },
    tv: { x: 72, y: 47, w: 22, h: 17 },
    licenser: gitter(38, 10, 1, 4, 10, 9),
    kuponer: { x: 52, y: 29, w: 24, h: 14 },
    plaketter: { x: 78, y: 29, w: 22, h: 13 },
    skilt: null,
    paere: { x: 70, y: 13 },
    ur: { x: 88, y: 8 },
    vinduer: [{ x: 110, y: 12, w: 44, h: 3 }],
    vitrine: false,
    // AI-akten: bilen er kørt ud for at gøre plads til serverne
    ai: { skabe: punkter([150, 141, 132, 123, 114, 105], 58), skabH: 26, holo: [...punkter([108, 120, 132, 144, 155], 86), ...punkter([114, 126, 138, 150], 73)] },
  }),
  kaelder: byg('kaelder', {
    zoom: 2,
    w: 160,
    h: 90,
    vaegH: 46,
    rows: [{ y: 70, xs: [7, 35, 63, 91, 119] }],
    hylde: { x: 48, y: 35, w: 52, h: 2 },
    tv: { x: 104, y: 12, w: 28, h: 20 },
    licenser: gitter(33, 11, 1, 2, 10, 9),
    kuponer: { x: 48, y: 10, w: 26, h: 16 },
    plaketter: { x: 78, y: 12, w: 22, h: 12 },
    skilt: null,
    paere: null,
    ur: { x: 36, y: 33 },
    vinduer: [{ x: 6, y: 12, w: 22, h: 10 }],
    vitrine: false,
    // Vandvarmeren og flyttekasserne har måttet vige for skabe og to hologrammer
    ai: { skabe: punkter([151, 143, 135], 50), skabH: 34, holo: punkter([155, 147], 84) },
  }),
  kontor: byg('kontor', {
    zoom: 1,
    w: 320,
    h: 180,
    vaegH: 66,
    rows: [
      { y: 104, xs: spredt(5, 36, 52) },
      { y: 150, xs: spredt(5, 36, 52) },
    ],
    hylde: { x: 154, y: 36, w: 68, h: 2 },
    tv: { x: 228, y: 12, w: 32, h: 22 },
    licenser: [...gitter(139, 12, 1, 3, 10, 9), ...gitter(229, 40, 3, 2, 10, 9)],
    kuponer: { x: 154, y: 42, w: 32, h: 16 },
    plaketter: { x: 190, y: 42, w: 32, h: 16 },
    skilt: { x: 155, y: 12, w: 70, h: 11 },
    paere: null,
    ur: { x: 141, y: 42 },
    vinduer: [
      { x: 10, y: 11, w: 58, h: 34 },
      { x: 266, y: 11, w: 44, h: 34 },
    ],
    vitrine: false,
    // Kaffehjørnet er blevet til et serverhjørne
    ai: {
      skabe: [...punkter([310, 301, 292, 283, 274], 74), ...punkter([4, 13], 74)],
      skabH: 24,
      holo: [...gitter(281, 98, 3, 3, 12, 27), ...gitter(8, 98, 2, 2, 12, 27)],
    },
  }),
  etage: byg('etage', {
    zoom: 1,
    w: 320,
    h: 180,
    vaegH: 58,
    rows: [
      { y: 90, xs: spredt(6, 20, 48) },
      { y: 126, xs: spredt(6, 20, 48) },
      { y: 162, xs: spredt(6, 20, 48) },
    ],
    hylde: { x: 126, y: 36, w: 72, h: 2 },
    tv: { x: 204, y: 20, w: 32, h: 22 },
    licenser: gitter(240, 22, 2, 4, 10, 9),
    kuponer: { x: 126, y: 40, w: 36, h: 14 },
    plaketter: { x: 164, y: 40, w: 36, h: 14 },
    skilt: { x: 122, y: 5, w: 136, h: 14 },
    paere: null,
    ur: { x: 224, y: 47 },
    vinduer: [
      { x: 2, y: 5, w: 114, h: 43 },
      { x: 264, y: 5, w: 56, h: 43 },
    ],
    vitrine: true,
    ai: {
      skabe: [...punkter([310, 301, 292, 283, 274, 265], 65), ...punkter([22, 31, 40, 49], 65)],
      skabH: 22,
      holo: [...gitter(297, 84, 2, 3, 12, 36), { x: 9, y: 120 }, { x: 9, y: 156 }],
    },
  }),
  hovedkontor: byg('hovedkontor', {
    zoom: 1,
    w: 320,
    h: 180,
    vaegH: 54,
    rows: [
      { y: 88, xs: spredt(10, 8, 31) },
      { y: 124, xs: spredt(10, 8, 31) },
      { y: 160, xs: spredt(10, 8, 31) },
    ],
    hylde: { x: 82, y: 32, w: 96, h: 2 },
    tv: { x: 184, y: 18, w: 32, h: 22 },
    licenser: [...gitter(222, 20, 2, 2, 10, 9), ...gitter(186, 44, 2, 1, 10, 9), ...gitter(222, 38, 2, 1, 10, 9)],
    kuponer: { x: 82, y: 37, w: 46, h: 14 },
    plaketter: { x: 132, y: 37, w: 46, h: 14 },
    skilt: { x: 78, y: 3, w: 164, h: 14 },
    paere: null,
    ur: { x: 207, y: 45 },
    vinduer: [
      { x: 4, y: 5, w: 66, h: 40 },
      { x: 250, y: 5, w: 66, h: 40 },
    ],
    vitrine: true,
    ai: {
      skabe: [...spredt(7, 250, 9).map((x) => ({ x, y: 63 })), ...spredt(7, 7, 9).reverse().map((x) => ({ x, y: 63 }))],
      skabH: 19,
      holo: [...punkter([262, 274, 286, 298, 310], 67), ...punkter([10, 22, 34, 46, 58], 67), ...punkter([100, 124, 148, 172], 67)],
    },
  }),
};

export function layoutFor(tier: OfficeTier): Layout {
  const l = LAYOUTS[tier] ?? LAYOUTS.garage;
  // Sikkerhed: antallet af borde følger altid spillets pladser
  const n = OFFICE_BY_ID[tier]?.pladser ?? l.pladser.length;
  // (import.meta.env findes kun under Vite — layoutet bruges også af unit tests)
  if (n !== l.pladser.length && (import.meta as { env?: { DEV?: boolean } }).env?.DEV) console.warn(`Kontorlayout ${tier}: ${l.pladser.length} borde, men ${n} pladser`);
  return l;
}

/** Hvor mange pokaler kan hylden rumme? (pokal = 9 px inkl. kant, 8 px afstand) */
export function hyldeKapacitet(l: Layout): number {
  return Math.max(1, Math.floor((l.hylde.w - 2) / 8));
}

/** Agenter pr. serverskab */
export const AGENTER_PR_SKAB = 2;

/** Antal serverskabe for n agenter i et trin (mindst ét: AI-laboratoriet har altid et skab klar) */
export function antalSkabe(l: Layout, agenter: number): number {
  return Math.min(l.ai.skabe.length, Math.max(1, Math.ceil(agenter / AGENTER_PR_SKAB)));
}
