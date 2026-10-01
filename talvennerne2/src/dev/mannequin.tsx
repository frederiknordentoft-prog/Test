// Grå mannequiner for de tre kropsskabeloner (lineup-arket): standardhoved, -krop, poter og fødder.
// Kun til udviklere af nye arter – viser skabelonernes ankre og proportioner.
import { capsule, ellipse, join } from '../art/rig/shapes'
import type { ColorwayDef, NaturalColorwayId, Part, SidePart, SpeciesDef } from '../art/rig/types'
import { BODY_KINDS } from '../art/rig/types'

const GREY: ColorwayDef = { id: 'c1', name: 'grå', fur: '#DAD6E6' }
const colorways = Object.fromEntries(
  (['c1', 'c2', 'c3', 'c4', 'c5', 'c6'] as NaturalColorwayId[]).map((c) => [c, { ...GREY, id: c }]),
) as Record<NaturalColorwayId, ColorwayDef>

const Paw: SidePart = ({ pal, sw }) => (
  <path d={capsule([0, 0], [0, 26], 7, 8)} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} strokeLinejoin="round" />
)
const Feet: Part = ({ pal, sw, a }) => (
  <path d={join(ellipse(a.footL.x, a.footL.y, 16, 8), ellipse(a.footR.x, a.footR.y, 16, 8))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} />
)

export const mannequins: SpeciesDef[] = BODY_KINDS.map((body) => ({
  id: 'rabbit',
  name: `Mannequin (${body})`,
  nameClip: 'dev.mannequin',
  family: 'lagomorph',
  body,
  breeds: [{ id: 'std', name: 'standard' }],
  colorways,
  magic: [],
  face: { idleMouth: 'smile', cheeks: true },
  parts: { Paw, Feet },
}))
