// Catalogue nouns for shapes and solids (SPEC §10.2 `noun.*`): indefinite with article, definite and
// plural, in mid and end form, e.g. `noun.shape.triangle.indef.end` → "en trekant".
import type { ClipId, ShapeId, SolidId, SpeechForm } from '../engine/types'

export type NounCase = 'indef' | 'def' | 'pl'

type Forms = readonly [indef: string, def: string, pl: string]

export const SHAPE_WORDS: Readonly<Record<ShapeId, Forms>> = {
  circle: ['en cirkel', 'cirklen', 'cirkler'],
  triangle: ['en trekant', 'trekanten', 'trekanter'],
  quadrilateral: ['en firkant', 'firkanten', 'firkanter'],
  square: ['et kvadrat', 'kvadratet', 'kvadrater'],
  rectangle: ['et rektangel', 'rektanglet', 'rektangler'],
  pentagon: ['en femkant', 'femkanten', 'femkanter'],
  hexagon: ['en sekskant', 'sekskanten', 'sekskanter'],
  octagon: ['en ottekant', 'ottekanten', 'ottekanter'],
  semicircle: ['en halvcirkel', 'halvcirklen', 'halvcirkler'],
  rhombus: ['en rombe', 'romben', 'romber'],
  trapezoid: ['et trapez', 'trapezet', 'trapezer'],
}

export const SOLID_WORDS: Readonly<Record<SolidId, Forms>> = {
  sphere: ['en kugle', 'kuglen', 'kugler'],
  cube: ['en terning', 'terningen', 'terninger'],
  cuboid: ['en kasse', 'kassen', 'kasser'],
  cylinder: ['en cylinder', 'cylinderen', 'cylindre'],
  cone: ['en kegle', 'keglen', 'kegler'],
  pyramid: ['en pyramide', 'pyramiden', 'pyramider'],
}

const CASE_INDEX: Readonly<Record<NounCase, 0 | 1 | 2>> = { indef: 0, def: 1, pl: 2 }

export function shapeWords(shape: ShapeId, kind: NounCase): string {
  return SHAPE_WORDS[shape][CASE_INDEX[kind]]
}

export function solidWords(solid: SolidId, kind: NounCase): string {
  return SOLID_WORDS[solid][CASE_INDEX[kind]]
}

export function shapeClip(shape: ShapeId, kind: NounCase, form: SpeechForm): ClipId {
  return `noun.shape.${shape}.${kind}.${form}`
}

export function solidClip(solid: SolidId, kind: NounCase, form: SpeechForm): ClipId {
  return `noun.solid.${solid}.${kind}.${form}`
}
