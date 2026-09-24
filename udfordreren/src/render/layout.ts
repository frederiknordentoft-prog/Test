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

export type Plads = { i: number; x: number; y: number; raekke: number };
export type Felt = { x: number; y: number; w: number; h: number };

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
  cert: Felt;
  kuponer: Felt;
  plaketter: Felt;
  skilt: Felt | null;
  paere: { x: number; y: number } | null; // bar pære (garagen)
  ur: { x: number; y: number } | null; // vægur (7×7), viseren følger ugen
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

const LAYOUTS: Record<OfficeTier, Layout> = {
  garage: byg('garage', {
    zoom: 2,
    w: 160,
    h: 90,
    vaegH: 46,
    rows: [{ y: 70, xs: [14, 44] }],
    hylde: { x: 52, y: 25, w: 48, h: 2 },
    tv: { x: 72, y: 47, w: 22, h: 17 },
    cert: { x: 38, y: 10, w: 13, h: 11 },
    kuponer: { x: 52, y: 29, w: 24, h: 14 },
    plaketter: { x: 78, y: 29, w: 22, h: 13 },
    skilt: null,
    paere: { x: 70, y: 13 },
    ur: { x: 88, y: 8 },
  }),
  kaelder: byg('kaelder', {
    zoom: 2,
    w: 160,
    h: 90,
    vaegH: 46,
    rows: [{ y: 70, xs: [7, 35, 63, 91, 119] }],
    hylde: { x: 48, y: 35, w: 52, h: 2 },
    tv: { x: 104, y: 12, w: 28, h: 20 },
    cert: { x: 32, y: 12, w: 13, h: 11 },
    kuponer: { x: 48, y: 10, w: 26, h: 16 },
    plaketter: { x: 78, y: 12, w: 22, h: 12 },
    skilt: null,
    paere: null,
    ur: { x: 35, y: 27 },
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
    cert: { x: 139, y: 12, w: 13, h: 11 },
    kuponer: { x: 154, y: 42, w: 32, h: 16 },
    plaketter: { x: 190, y: 42, w: 32, h: 16 },
    skilt: { x: 155, y: 12, w: 70, h: 11 },
    paere: null,
    ur: { x: 140, y: 28 },
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
    cert: { x: 240, y: 22, w: 13, h: 11 },
    kuponer: { x: 126, y: 40, w: 36, h: 14 },
    plaketter: { x: 164, y: 40, w: 36, h: 14 },
    skilt: { x: 122, y: 5, w: 136, h: 14 },
    paere: null,
    ur: { x: 244, y: 38 },
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
    cert: { x: 222, y: 20, w: 13, h: 11 },
    kuponer: { x: 82, y: 37, w: 46, h: 14 },
    plaketter: { x: 132, y: 37, w: 46, h: 14 },
    skilt: { x: 78, y: 3, w: 164, h: 14 },
    paere: null,
    ur: { x: 225, y: 36 },
  }),
};

export function layoutFor(tier: OfficeTier): Layout {
  const l = LAYOUTS[tier] ?? LAYOUTS.garage;
  // Sikkerhed: antallet af borde følger altid spillets pladser
  const n = OFFICE_BY_ID[tier]?.pladser ?? l.pladser.length;
  if (n !== l.pladser.length && import.meta.env.DEV) console.warn(`Kontorlayout ${tier}: ${l.pladser.length} borde, men ${n} pladser`);
  return l;
}

/** Hvor mange pokaler kan hylden rumme? (pokal = 9 px inkl. kant, 8 px afstand) */
export function hyldeKapacitet(l: Layout): number {
  return Math.max(1, Math.floor((l.hylde.w - 2) / 8));
}
