// Shape and solid names plus the measuring units (SPEC §10.1–10.2).
import type { ClipId, ShapeId, SolidId } from '../../engine/types'
import type { Wave } from '../catalog'
import { UNIT_WORDS, type MeasureUnit } from '../measure'
import { SHAPE_WORDS, SOLID_WORDS, shapeClip, shapeWords, solidClip, solidWords } from '../nouns'

const table: Record<ClipId, string> = {}
for (const form of ['mid', 'end'] as const) {
  for (const kind of ['indef', 'def', 'pl'] as const) {
    for (const shape of Object.keys(SHAPE_WORDS) as ShapeId[]) table[shapeClip(shape, kind, form)] = shapeWords(shape, kind)
    for (const solid of Object.keys(SOLID_WORDS) as SolidId[]) table[solidClip(solid, kind, form)] = solidWords(solid, kind)
  }
  for (const unit of Object.keys(UNIT_WORDS) as MeasureUnit[]) table[`noun.unit.${unit}.${form}`] = UNIT_WORDS[unit]
}

export const clips = table

/** The four basic shapes are 0. klasse (shapes2D); the rest and all units arrive in wave 2. */
export function wave(id: ClipId): Wave {
  return /^noun\.shape\.(circle|triangle|square|rectangle)\./.test(id) ? 1 : 2
}

export function pack(id: ClipId): string {
  if (id.startsWith('noun.unit.')) return 'measure-2'
  return `shapes-${wave(id)}`
}
