// Ankre og stadier (SPEC §6.4). Modelrummet er artens stadie-2-ramme; stadiet lægges på som to
// uniforme region-transformationer (krop om fodpunktet, hoved om halsleddet) oven i figur-skalaen.
import type { AnchorSet, BodyKind, BreedId, PointAnchorName, Pt, SpeciesDef, Stage, StageTransform } from './types'

/** Kanvas og sikker zone. */
export const VIEWBOX = { w: 200, h: 240 } as const
export const GROUND_Y = 226
export const SAFE = { x0: 6, x1: 194, y0: 4, y1: 234 } as const
/** Konturbredde i verdensrummet. */
export const OUTLINE = 3.2

/** Standardankre for stadie 2 med skabelonen `round` (kunst-forslaget §2.1, + skuldre og øjenmål). */
export const DEFAULT_ANCHORS: AnchorSet = {
  ground: { x: 100, y: GROUND_Y },
  headCenter: { x: 100, y: 96 },
  headRx: 56,
  headRy: 50,
  headTop: { x: 100, y: 48 },
  headWidth: 104,
  earBaseL: { x: 70, y: 58 },
  earBaseR: { x: 130, y: 58 },
  earGap: 60,
  hornBase: { x: 100, y: 50 },
  eyeL: { x: 78, y: 100 },
  eyeR: { x: 122, y: 100 },
  eyeRx: 10,
  eyeRy: 12.5,
  muzzle: { x: 100, y: 120 },
  mouth: { x: 100, y: 128 },
  cheekL: { x: 66, y: 118 },
  cheekR: { x: 134, y: 118 },
  neck: { x: 100, y: 146 },
  neckWidth: 58,
  bodyCenter: { x: 100, y: 182 },
  bodyRx: 50,
  bodyRy: 44,
  bodyWidth: 100,
  chest: { x: 100, y: 170 },
  back: { x: 100, y: 168 },
  shoulderL: { x: 80, y: 164 },
  shoulderR: { x: 120, y: 164 },
  pawL: { x: 76, y: 206 },
  pawR: { x: 124, y: 206 },
  handRot: -20,
  footL: { x: 70, y: 222 },
  footR: { x: 130, y: 222 },
  tailBase: { x: 146, y: 208 },
}

/**
 * Skabelonernes afvigelser fra `round` (udgangspunkter for bølge 2–4; arterne finjusterer selv).
 * - pear: smal top og bred bund, hoved og krop smelter sammen (pingvin, egern, pindsvin, ugle, Pip).
 * - tall: højere, smallere krop med synlige forben (hest, enhjørning, pegasus, hvalp, ræv, drage).
 */
const TEMPLATE_DELTA: Record<BodyKind, Partial<AnchorSet>> = {
  round: {},
  pear: {
    headCenter: { x: 100, y: 100 },
    headRx: 52,
    headRy: 48,
    headTop: { x: 100, y: 54 },
    headWidth: 98,
    neck: { x: 100, y: 146 },
    neckWidth: 62,
    bodyCenter: { x: 100, y: 180 },
    bodyRx: 56,
    bodyRy: 46,
    bodyWidth: 112,
    shoulderL: { x: 74, y: 160 },
    shoulderR: { x: 126, y: 160 },
    pawL: { x: 64, y: 196 },
    pawR: { x: 136, y: 196 },
  },
  tall: {
    headCenter: { x: 100, y: 88 },
    headRx: 54,
    headRy: 48,
    headTop: { x: 100, y: 42 },
    headWidth: 100,
    earBaseL: { x: 72, y: 52 },
    earBaseR: { x: 128, y: 52 },
    eyeL: { x: 79, y: 92 },
    eyeR: { x: 121, y: 92 },
    muzzle: { x: 100, y: 114 },
    mouth: { x: 100, y: 122 },
    cheekL: { x: 68, y: 110 },
    cheekR: { x: 132, y: 110 },
    neck: { x: 100, y: 136 },
    neckWidth: 50,
    bodyCenter: { x: 100, y: 178 },
    bodyRx: 44,
    bodyRy: 48,
    bodyWidth: 88,
    chest: { x: 100, y: 160 },
    back: { x: 100, y: 160 },
    shoulderL: { x: 84, y: 156 },
    shoulderR: { x: 116, y: 156 },
    pawL: { x: 84, y: 214 },
    pawR: { x: 116, y: 214 },
    footL: { x: 72, y: 222 },
    footR: { x: 128, y: 222 },
    tailBase: { x: 140, y: 204 },
  },
}

/**
 * Stadiernes transformationer (SPEC §6.4). Faktorerne for hoved, krop, øjne, manke, hale, horn og
 * vinger er SPEC'ens (relativt til stadie 2). Figurskalaen er ændret efter review G0-r1 (fund 7:
 * "stor" skal være 10–15 % højere og mere moden): stadie 2 tegnes i 0,9 af modelrummet, så stadie 3
 * kan vokse til fuld størrelse uden at forlade kanvasset, og babyen er stadig 0,86 af stadie 2.
 * Stadie 3 har desuden lidt mindre øjne i forhold til hovedet og en kraftigere krop.
 */
export const STAGE_FIG = 0.9
export const STAGE_XF: Record<Stage, StageTransform> = {
  1: { fig: 0.86 * STAGE_FIG, body: 0.85, head: 1.08, eye: 1.15, mane: 1, tail: 1, horn: 1, wings: 1 },
  2: { fig: STAGE_FIG, body: 1, head: 1, eye: 1, mane: 1, tail: 1, horn: 1, wings: 1 },
  3: { fig: 1, body: 1.08, head: 0.96, eye: 0.92, mane: 1.3, tail: 1.3, horn: 1.25, wings: 1.2 },
}

export const HEAD_POINTS = [
  'headCenter', 'headTop', 'hornBase', 'earBaseL', 'earBaseR', 'eyeL', 'eyeR',
  'muzzle', 'mouth', 'cheekL', 'cheekR',
] as const satisfies readonly PointAnchorName[]
export const BODY_POINTS = [
  'ground', 'neck', 'bodyCenter', 'chest', 'back', 'shoulderL', 'shoulderR',
  'pawL', 'pawR', 'footL', 'footR', 'tailBase',
] as const satisfies readonly PointAnchorName[]

/** Standardankre for en skabelon (før artens overskrivninger). */
export function templateAnchors(kind: BodyKind): AnchorSet {
  return { ...DEFAULT_ANCHORS, ...TEMPLATE_DELTA[kind] }
}

/** Modelrummets ankre for (art, race): skabelon ← art ← race. earGap følger ørebaserne. */
export function modelAnchors(def: SpeciesDef, breed: BreedId): AnchorSet {
  const b = def.breeds.find((x) => x.id === breed)
  const over = { ...def.anchors, ...b?.anchors }
  const a: AnchorSet = { ...templateAnchors(def.body), ...over }
  if (over.earGap === undefined) a.earGap = Math.abs(a.earBaseR.x - a.earBaseL.x)
  return a
}

/** Uniform skalering + flytning: p' = s·p + t. */
export interface Affine {
  s: number
  tx: number
  ty: number
}

export const apply = (m: Affine, p: Pt): Pt => ({ x: m.s * p.x + m.tx, y: m.s * p.y + m.ty })

export interface RegionTransforms {
  xf: StageTransform
  /** Kroppens region: model → verden. */
  body: Affine
  /** Hovedets region: model → verden. */
  head: Affine
  /** Halsleddet i verdensrummet (hovedets pivot). */
  neckWorld: Pt
}

export function regionTransforms(a: AnchorSet, stage: Stage): RegionTransforms {
  const xf = STAGE_XF[stage]
  const G = a.ground
  const sb = xf.fig * xf.body
  const body: Affine = { s: sb, tx: G.x * (1 - sb), ty: G.y * (1 - sb) }
  const neckWorld = apply(body, a.neck)
  const sh = xf.fig * xf.head
  const head: Affine = { s: sh, tx: neckWorld.x - sh * a.neck.x, ty: neckWorld.y - sh * a.neck.y }
  return { xf, body, head, neckWorld }
}

/** Ankrene i verdensrummet (viewBox) for (art, race, stadie). */
export function worldAnchors(model: AnchorSet, stage: Stage): AnchorSet {
  const { xf, body, head } = regionTransforms(model, stage)
  const w: AnchorSet = { ...model }
  for (const k of HEAD_POINTS) w[k] = apply(head, model[k])
  for (const k of BODY_POINTS) w[k] = apply(body, model[k])
  w.headRx = model.headRx * head.s
  w.headRy = model.headRy * head.s
  w.headWidth = model.headWidth * head.s
  w.earGap = model.earGap * head.s
  w.eyeRx = model.eyeRx * head.s * xf.eye
  w.eyeRy = model.eyeRy * head.s * xf.eye
  w.neckWidth = model.neckWidth * body.s
  w.bodyRx = model.bodyRx * body.s
  w.bodyRy = model.bodyRy * body.s
  w.bodyWidth = model.bodyWidth * body.s
  return w
}

/** Det endelige ankersæt (verdensrummet) for (art, race, stadie). */
export function computeAnchors(def: SpeciesDef, breed: BreedId, stage: Stage): AnchorSet {
  return worldAnchors(modelAnchors(def, breed), stage)
}

/** Alle tal i ankersættet er endelige (lint: ingen NaN). */
export function anchorsFinite(a: AnchorSet): boolean {
  return Object.values(a).every((v) =>
    typeof v === 'number' ? Number.isFinite(v) : Number.isFinite(v.x) && Number.isFinite(v.y),
  )
}
