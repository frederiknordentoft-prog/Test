// <Rig>: ét dyr i fast lagorden (17 lag, SPEC §6.4) med stadier, humør og tøj.
//
// Struktur (verden = viewBox 0 0 200 240):
//   defs · aura · jordskygge
//   g.a-fig                                  hop/jubel (pivot = fodpunktet, indlejret i keyframes)
//     g[krop: stadie]  g.a-body              lag 2–9 i modelrummet (ånding om fodpunktet)
//     g[translate(hals) scale]  g.a-head  g[translate(−hals)]   lag 10–16 i modelrummet
//     g[krop: stadie]  g.a-body              løftede poter foran hovedet (jubel, vink, tænker)
//     fx                                     lag 17 i verdensrummet
// Animerede dele bruger pivot-mønsteret: <g transform="translate(px py)"><g class="a-…">lokalt</g></g>
// med transform-origin 0 0. Kun transform og opacity animeres (rig.css). Humørets nøglepose sættes
// som attribut i begge tilstande; i animeret tilstand svinger keyframes (0 % = posen) om den.
import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react'
import { Aura, Cheeks, Eyes, GroundShadow, MOOD_FACE, MOOD_GAZE, Mouth, ShadowGradient, Sparkles, SweatDrop, ThoughtDots, Zzz, around } from '../parts/house'
import { OUTLINE, SAFE, apply, modelAnchors, regionTransforms, worldAnchors } from './anchors'
import type { Affine } from './anchors'
import { defaultHead, templateBody } from './bodies'
import { fitItem, fitTransform, inverseTransform, toLocal } from './fit'
import { visibleBox } from './ItemIcon'
import { about, applyMat, chain, invert, rotate as rotMat, scale as scaleMat, translate as moveMat, xfMat } from './hold'
import { mixHex } from './oklch'
import { INK, MAGIC, derivePalette, itemPalette, silhouettePalette } from './palette'
import { ellipse, fmt3, join, lune, n, outside, rect, spline, tf } from './shapes'
import type { Vec } from './shapes'
import { armholeArch, bentSleeve, longArm } from './sleeve'
import type {
  AnchorSet, BreedDef, BreedId, Box, ColorwayDef, ColorwayId, FaceStyle, FigureBounds, FitResult, HandHold, ItemDef,
  MagicColorwayId, Mood, Outfit, Palette, PartCtx, PawPose, Pose, PoseXf, Pt, RigIds, SidePart, Slot,
  SpeciesDef, SpeciesParts, Stage, Worn,
} from './types'
import './rig.css'

export type RigMode = 'animated' | 'static'
/** Detaljeniveau. 'small' (≤ 64 px): tykkere og mørkere kontur, ingen hårfine streger, figuren fylder rammen. */
export type RigLod = 'full' | 'small'
/** Små ikoner (≤ 64 CSS-px) får automatisk det lille detaljeniveau. */
export const SMALL_LOD_PX = 64

export interface RigProps {
  species: SpeciesDef
  breed?: BreedId
  stage?: Stage
  colorway?: ColorwayId
  /** Stjerneform: aura og glimmer (kun stadie 3). */
  star?: boolean
  mood?: Mood
  /** 'animated' (buddy + højst 2 andre pr. skærm) eller 'static' (album, butik, billeder). */
  mode?: RigMode
  outfit?: Outfit
  /** Punkt i viewBox-koordinater, som pupillerne følger (højst 3 enheder, lerp 0,2 pr. frame). */
  lookAt?: Pt | null
  /** Fase og blinkperiode pr. instans (deterministisk). */
  seed?: number
  /** CSS-bredde; højden følger beskæringens format. */
  size?: number | string
  className?: string
  style?: CSSProperties
  /** Oplæst/tilgængeligt navn. Uden titel er grafikken dekorativ. */
  title?: string
  /** Sort silhuet (silhuet-arket). */
  silhouette?: boolean
  /** Frys animationen på tidspunktet t sekunder (filmstrimler). */
  freezeAt?: number
  /**
   * Beskæring (beregnet ud fra stadiets ankre, så den følger figuren):
   * 'full' (200x240), 'fit' (hele figuren, 5:6), 'head' (hoved og hat), 'torso' (mund til hofte),
   * 'bust' (hoved og overkrop), 'crown' (hele hovedet med ører og horn), 'wide' (hoved og overkrop i
   * hele den sikre zones bredde: til genstande, der rækker ud, som ballon og net). Kvadratiske undtagen
   * full/fit.
   * Små ikoner bruger 'fit' som standard.
   */
  crop?: RigCrop
  /** 'auto' (standard): 'small' når size ≤ 64 px. */
  lod?: RigLod | 'auto'
}

export type RigCrop = 'full' | 'fit' | 'head' | 'torso' | 'bust' | 'crown' | 'wide'

/** Højde/bredde for en beskæring. */
export function cropAspect(crop: RigCrop): number {
  return crop === 'full' || crop === 'fit' ? 1.2 : 1
}

export function lodFor(size: RigProps['size'], lod: RigProps['lod']): RigLod {
  if (lod && lod !== 'auto') return lod
  return typeof size === 'number' && size <= SMALL_LOD_PX ? 'small' : 'full'
}

// ---------------------------------------------------------------------------------------------
// Poser: nøglepose pr. humør (animeret tilstand svinger om den med keyframes i rig.css).
// Poter: et tal er en hvilende pote roteret om skulderen; { up: true } bruger artens løftede pote
// (PawUp) foran hovedet. Arterne finjusterer via SpeciesDef.poses / BreedDef.poses.

type Xf = PoseXf

export const POSES: Record<Mood, Pose> = {
  idle: {},
  happy: { earL: -6, earR: -6, pawL: 30, pawR: 30, tail: 12 },
  // Jubel: begge arme op i et V, ørerne rejst, figuren strækker sig.
  cheer: { fig: { rot: -2 }, body: { sy: 1.02 }, head: { rot: -3, y: -1 }, earL: 7, earR: 7, pawL: { up: true }, pawR: { up: true }, tail: 14 },
  // Tænker: hovedet på skrå, poten på hagen.
  think: { head: { rot: 8, y: 2 }, earL: 6, earR: -8, pawR: { up: true }, tail: -6 },
  // Ups (legende "tehepero"): blink og tunge, hovedet på skrå, og poten kradser bag nakken
  // (kat, hest og enhjørning løfter i stedet poten op til munden).
  oops: { head: { rot: -7, y: 1 }, earL: -12, earR: -2, pawL: 0, pawR: { up: true, behind: true }, tail: 8 },
  // Sover: sammensunket, hovedet tungt, ørerne nede.
  sleep: { body: { sy: 0.965 }, head: { rot: 7, y: 6 }, earL: -26, earR: -22, pawL: -4, pawR: -4 },
  // Vinker: poten løftet ved siden af hovedet med bøjet albue, hovedet vippet mod den.
  wave: { head: { rot: -7, y: 1 }, earL: -4, earR: 6, pawR: { up: true }, tail: 10 },
}

const G = { x: 100, y: 226 }
/** Ørerne klippes en anelse inden for hovedets kontur, så ørets fyld dækker konturen helt (ingen søm). */
export const EAR_SEAM = 0.9
/** Ærmegabet på ærmeløst kropstøj: buens top under skulderleddet (armens ramme), hvor benet kommer ud. */
export const ARMHOLE_Y = 2

/** Transform om fodpunktet (hop, ånding): translate(G) · xf · translate(−G). */
function aboutGround(x: Xf | undefined): string | undefined {
  if (!x) return undefined
  const inner = tf({ x: x.x, y: x.y, rot: x.rot, sx: x.sx, sy: x.sy })
  return inner ? `translate(${G.x} ${G.y}) ${inner} translate(${-G.x} ${-G.y})` : undefined
}

const pawPose = (p: number | PawPose | undefined): PawPose => (typeof p === 'number' ? { rot: p } : (p ?? {}))

// ---------------------------------------------------------------------------------------------

function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

export function resolveColorway(def: SpeciesDef, id: ColorwayId): ColorwayDef {
  if (id === 'gold' || id === 'rainbow' || id === 'starwhite') return def.colorways[id] ?? MAGIC[id]
  return def.colorways[id]
}

export function resolveParts(def: SpeciesDef, breed: BreedId): SpeciesParts {
  const b = def.breeds.find((x) => x.id === breed)
  return { ...def.parts, ...b?.parts }
}

export function resolveBreed(def: SpeciesDef, breed: BreedId): BreedDef | undefined {
  return def.breeds.find((x) => x.id === breed)
}

/** Racens ansigt oven på artens. */
export function resolveFace(def: SpeciesDef, breed: BreedId): FaceStyle {
  return { ...def.face, ...resolveBreed(def, breed)?.face }
}

/** Nøgleposen: riggens standard ← artens ← racens (pr. felt). */
export function resolvePose(def: SpeciesDef, breed: BreedId, mood: Mood): Pose {
  return { ...POSES[mood], ...def.poses?.[mood], ...resolveBreed(def, breed)?.poses?.[mood] }
}

/** Den afledte palet for (art, race, farve) – før en evt. silhuet. */
export function resolvePalette(def: SpeciesDef, breed: BreedId, colorway: ColorwayId): Palette {
  const base = derivePalette(resolveColorway(def, colorway))
  const tint = resolveBreed(def, breed)?.palette
  return tint ? tint(base, colorway) : base
}

/** De magiske farver, som (art, race) findes i. Stjernehvid findes kun som enhjørningeføllet. */
export function magicOf(def: SpeciesDef, breed: BreedId): readonly MagicColorwayId[] {
  return resolveBreed(def, breed)?.magic ?? def.magic
}

/** Små størrelser: konturen ca. 35 % mørkere mod husets ink (læsbar på hvid pels ved 48 px). */
function lodPalette(p: Palette): Palette {
  const dk = (c: string) => mixHex(c, INK, 0.35)
  return { ...p, outline: dk(p.outline), earOutline: dk(p.earOutline), maneOutline: dk(p.maneOutline), patternOutline: dk(p.patternOutline) }
}

// ---------------------------------------------------------------------------------------------
// Grænsebokse og beskæring

const box = (x0: number, y0: number, x1: number, y1: number): Box => ({ x0, y0, x1, y1 })
const mapBox = (m: Affine, b: Box): Box => box(m.s * b.x0 + m.tx, m.s * b.y0 + m.ty, m.s * b.x1 + m.tx, m.s * b.y1 + m.ty)
const unionBox = (a: Box, b: Box): Box => box(Math.min(a.x0, b.x0), Math.min(a.y0, b.y0), Math.max(a.x1, b.x1), Math.max(a.y1, b.y1))

/** Figurens grænsebokse i modelrummet: race ← art ← skøn ud fra ankrene. */
export function figureBounds(def: SpeciesDef, breed: BreedId): FigureBounds {
  const a = modelAnchors(def, breed)
  const b = resolveBreed(def, breed)
  const h = a.headCenter
  const est: FigureBounds = {
    head: box(h.x - a.headRx * 1.06, a.headTop.y - 10, h.x + a.headRx * 1.06, h.y + a.headRy * 1.02),
    body: box(a.bodyCenter.x - a.bodyRx - 16, a.neck.y - 4, a.bodyCenter.x + a.bodyRx + 22, a.ground.y),
  }
  return {
    head: b?.bounds?.head ?? def.bounds?.head ?? est.head,
    body: b?.bounds?.body ?? def.bounds?.body ?? est.body,
  }
}

/** Grænseboksene i verdensrummet (viewBox) for (art, race, stadie). */
export function worldBounds(def: SpeciesDef, breed: BreedId, stage: Stage): FigureBounds & { all: Box } {
  const a = modelAnchors(def, breed)
  const R = regionTransforms(a, stage)
  const fb = figureBounds(def, breed)
  const head = mapBox(R.head, fb.head)
  const body = mapBox(R.body, fb.body)
  return { head, body, all: unionBox(head, body) }
}

/** Boks → viewBox med luft `pad` (andel) og formatet h/w = aspect, centreret. */
function viewBoxAround(b: Box, pad: number, aspect: number): string {
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  let W = (b.x1 - b.x0) * (1 + pad)
  let H = (b.y1 - b.y0) * (1 + pad)
  if (H / W < aspect) H = W * aspect
  else W = H / aspect
  return `${n(cx - W / 2)} ${n(cy - H / 2)} ${n(W)} ${n(H)}`
}

/** En genstands tegnede boks (fra `icon.box`) i modelrummet. */
function itemModelBox(item: ItemDef, fit: FitResult): Box | null {
  const ib = item.icon?.box
  if (!ib) return null
  const [x, y, w, h] = ib
  const t = (fit.rot * Math.PI) / 180
  const pts = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([px, py]) => ({
    x: fit.x + (px * Math.cos(t) - py * Math.sin(t)) * fit.scale,
    y: fit.y + (px * Math.sin(t) + py * Math.cos(t)) * fit.scale,
  }))
  return box(Math.min(...pts.map((p) => p.x)), Math.min(...pts.map((p) => p.y)), Math.max(...pts.map((p) => p.x)), Math.max(...pts.map((p) => p.y)))
}

/** viewBox for en beskæring, beregnet ud fra stadiets ankre (og hatten, hvis den bæres). */
export function cropViewBox(def: SpeciesDef, breed: BreedId, stage: Stage, crop: RigCrop, outfit?: Outfit): string {
  if (crop === 'full') return '0 0 200 240'
  const a = modelAnchors(def, breed)
  const R = regionTransforms(a, stage)
  const w = worldAnchors(a, stage)
  const wb = worldBounds(def, breed, stage)
  if (crop === 'fit') return viewBoxAround(wb.all, 0.06, 1.2)
  if (crop === 'head') {
    let b = box(w.headCenter.x - w.headRx * 1.12, w.headTop.y - w.headRy * 0.3, w.headCenter.x + w.headRx * 1.12, w.headCenter.y + w.headRy * 1.04)
    const hat = outfit?.head && !def.occupies?.includes('head') ? outfit.head.item : null
    const ib = hat ? itemModelBox(hat, fitItem(hat, a, def)) : null
    if (ib) b = unionBox(b, mapBox(R.head, ib))
    // En ansigtsgenstand, der når under munden (skægget), kommer med til hagen (review G1-r4, B5).
    const mask = outfit?.face && !def.occupies?.includes('face') ? outfit.face.item : null
    const fb = mask ? itemModelBox(mask, fitItem(mask, a, def)) : null
    if (fb && fb.y1 > a.mouth.y) b = unionBox(b, mapBox(R.head, fb))
    return viewBoxAround(b, 0.08, 1)
  }
  if (crop === 'crown') {
    // Hele hovedet med ører og horn (racens hovedboks) ned til hagen: til hornets glimt i nærbilleder.
    const b = box(wb.head.x0, wb.head.y0, wb.head.x1, w.headCenter.y + w.headRy * 1.04)
    return viewBoxAround(b, 0.08, 1)
  }
  if (crop === 'torso') {
    // Kropsslottet: fra mund og hage til hoften – aldrig gennem øjnene (review G1-r2, E4). Kvadratet
    // vokser nedad og til siderne, aldrig op i ansigtet.
    const eyeBottom = Math.max(w.eyeL.y, w.eyeR.y) + w.eyeRy
    const top = Math.max(w.mouth.y + 2, eyeBottom + 4)
    const bottom = w.bodyCenter.y + w.bodyRy * 0.82
    const side = Math.max(w.bodyRx * 2.6, bottom - top) * 1.06
    return `${n(w.bodyCenter.x - side / 2)} ${n(top - side * 0.02)} ${n(side)} ${n(side)}`
  }
  if (crop === 'wide') {
    // Hoved og overkrop i hele den sikre zones bredde: genstande, der rækker ud (ballonen ved skulderen,
    // nettets bøjle ved hovedet), kommer med på et kvadratisk kort.
    const b = box(SAFE.x0, w.headTop.y - w.headRy * 0.5, SAFE.x1, w.bodyCenter.y + w.bodyRy * 0.5)
    return viewBoxAround(b, 0.02, 1)
  }
  // bust: hoved (uden de højeste ører) og overkrop
  const b = box(w.headCenter.x - w.headRx * 1.15, w.headTop.y - w.headRy * 0.35, w.headCenter.x + w.headRx * 1.15, w.bodyCenter.y + w.bodyRy * 0.4)
  return viewBoxAround(b, 0.04, 1)
}

/** Pupil-tracking: lerp 0,2 pr. rAF mod målet, højst 3 enheder. Stopper når den er i ro. */
function useGaze(
  enabled: boolean,
  target: Pt | null | undefined,
  eyeWorld: Pt,
  scale: number,
  fallback: Pt | undefined,
  /** Øjenformen: nye grupper i DOM'en kræver at transformen sættes igen. */
  shapeKey: string,
) {
  const gazeRef = useRef<SVGGElement>(null)
  const glintRef = useRef<SVGGElement>(null)
  const cur = useRef({ x: 0, y: 0 })
  const tx = target ? target.x : NaN
  const ty = target ? target.y : NaN
  useEffect(() => {
    if (!enabled) return
    let goal = { x: 0, y: 0 }
    if (Number.isFinite(tx)) {
      const dx = tx - eyeWorld.x
      const dy = ty - eyeWorld.y
      const d = Math.hypot(dx, dy)
      const m = d > 0 ? (3 * Math.min(1, d / 60)) / d : 0
      goal = { x: (dx * m) / scale, y: (dy * m) / scale }
    } else if (fallback) goal = fallback
    let raf = 0
    const step = () => {
      const c = cur.current
      c.x += (goal.x - c.x) * 0.2
      c.y += (goal.y - c.y) * 0.2
      const done = Math.abs(goal.x - c.x) < 0.01 && Math.abs(goal.y - c.y) < 0.01
      if (done) {
        c.x = goal.x
        c.y = goal.y
      }
      gazeRef.current?.setAttribute('transform', `translate(${c.x.toFixed(2)} ${c.y.toFixed(2)})`)
      glintRef.current?.setAttribute('transform', `translate(${(c.x * 0.45).toFixed(2)} ${(c.y * 0.45).toFixed(2)})`)
      if (!done) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [enabled, tx, ty, eyeWorld.x, eyeWorld.y, scale, fallback, shapeKey])
  return { gazeRef, glintRef }
}

/** Pivot-hjælper til arter: <g translate(at)> <g class=cls> lokale koordinater </g></g>. */
export function Pivot({ at, cls, still, pose, children }: { at: Pt; cls: string; still: boolean; pose?: Xf; children: ReactNode }) {
  return (
    <g transform={`translate(${n(at.x)} ${n(at.y)})`}>
      <g className={still ? undefined : cls} transform={tf(pose ?? {})}>
        {children}
      </g>
    </g>
  )
}

/** Hovedets nik (næsevippets overshoot): en ekstra gruppe om hovedets indhold, kun når den animeres. */
function Nod({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? <g className="a-nod">{children}</g> : <>{children}</>
}

/** Miljøet for en render: unikt id-præfiks og (i animeret DOM) refs til pupil-tracking. */
export interface RigEnv {
  uid: string
  gazeRef?: Ref<SVGGElement>
  glintRef?: Ref<SVGGElement>
  rootRef?: Ref<SVGSVGElement>
}

/**
 * Butikskortet med en håndgenstand på dyret (beskæringen 'wide', review G1-r4, B2): kortet beskæres om poten
 * og genstanden, så genstanden fylder mindst 1/3 af kortet. Genstandens retning regnes ud under tegningen,
 * så boksen måles i DOM'en (uden DOM bruges den brede beskæring). Siden er poten med genstanden plus luft,
 * dog mindst `min` og højst `max` gange genstandens største led.
 */
export const HAND_CARD = { pad: 1.3, min: 1.8, max: 2.7 } as const

function handCardBox(root: SVGSVGElement): string | null {
  const item = root.querySelector<SVGGElement>('[data-slot="hand"]')
  const paw = item?.closest<SVGGElement>('[data-part^="paw-"]')
  if (!item || !paw || typeof item.getBBox !== 'function') return null
  const ib = visibleBox(root, item)
  const pb = visibleBox(root, paw)
  if (!ib || !pb) return null
  const big = Math.max(ib.x1 - ib.x0, ib.y1 - ib.y0)
  const side = Math.min(Math.max(Math.max(pb.x1 - pb.x0, pb.y1 - pb.y0) * HAND_CARD.pad, big * HAND_CARD.min), big * HAND_CARD.max)
  // Midten trækkes mod genstanden, så den står midt på kortet med poten, der holder den, ved siden af.
  const cx = 0.6 * (ib.x0 + ib.x1) / 2 + 0.4 * (pb.x0 + pb.x1) / 2
  const cy = 0.6 * (ib.y0 + ib.y1) / 2 + 0.4 * (pb.y0 + pb.y1) / 2
  return `${n(cx - side / 2)} ${n(cy - side / 2)} ${n(side)} ${n(side)}`
}

/**
 * Ansigtskortet med en genstand, der når under munden (skægget, review G2-r2 B5): kortet går så mange enheder
 * under genstandens synlige spids (konturen medregnet). Den erklærede ikonboks (`icon.box`) rammer ikke skæggets
 * spids på de lange hestemuler, så spidsen måles i DOM'en ligesom håndkortet; uden DOM bruges den erklærede boks.
 */
export const FACE_CARD_BELOW = 7

function faceCardBox(root: SVGSVGElement): string | null {
  const item = root.querySelector<SVGGElement>('[data-slot="face"]')
  if (!item || typeof item.getBBox !== 'function') return null
  const ib = visibleBox(root, item)
  const vb = root.viewBox.baseVal
  if (!ib || !vb.width) return null
  // Kvadratet beholder sin top og vokser, så bunden ligger FACE_CARD_BELOW under spidsen.
  const side = ib.y1 + OUTLINE / 2 + FACE_CARD_BELOW - vb.y
  if (side <= vb.height) return null
  return `${n(vb.x + vb.width / 2 - side / 2)} ${n(vb.y)} ${n(side)} ${n(side)}`
}

/** <Rig> i DOM'en: unikke id'er og pupil-tracking lægges oven på den rene render. */
export function Rig(props: RigProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const g = gazeInputs(props)
  const { gazeRef, glintRef } = useGaze(g.enabled, props.lookAt, g.eye, g.scale, g.fallback, g.shape)
  const rootRef = useRef<SVGSVGElement>(null)
  const handCard = props.crop === 'wide' && !!props.outfit?.hand
  const faceCard = props.crop === 'head' && !!props.outfit?.face && reachesBelowMouth(props)
  // Efter hver render (før maling, så intet blinker): React rører ikke viewBox igen, så længe den beregnede
  // beskæring er uændret.
  useLayoutEffect(() => {
    const root = rootRef.current
    if ((!handCard && !faceCard) || !root) return
    const vb = handCard ? handCardBox(root) : faceCardBox(root)
    if (vb) root.setAttribute('viewBox', vb)
  })
  return rigElement(props, { uid, gazeRef, glintRef, rootRef: handCard || faceCard ? rootRef : undefined })
}

/** Ansigtsgenstanden når under munden (skægget): ansigtskortet beskæres da om hele genstanden (B5). */
function reachesBelowMouth(props: RigProps): boolean {
  const def = props.species
  const mask = props.outfit?.face && !def.occupies?.includes('face') ? props.outfit.face.item : null
  if (!mask) return false
  const a = modelAnchors(def, props.breed ?? def.breeds[0].id)
  const fb = itemModelBox(mask, fitItem(mask, a, def))
  return !!fb && fb.y1 > a.mouth.y
}

function gazeInputs(props: RigProps) {
  const def = props.species
  const breed: BreedId = props.breed ?? def.breeds[0].id
  const stage = props.stage ?? 2
  const mood = props.mood ?? 'idle'
  const a = modelAnchors(def, breed)
  const w = worldAnchors(a, stage)
  return {
    enabled: props.mode !== 'static' && !props.silhouette,
    eye: { x: (w.eyeL.x + w.eyeR.x) / 2, y: (w.eyeL.y + w.eyeR.y) / 2 },
    scale: regionTransforms(a, stage).head.s,
    fallback: MOOD_GAZE[mood],
    shape: MOOD_FACE[mood].eyes,
  }
}

/**
 * Den rene render (ingen hooks): samme træ som <Rig>, men kan kaldes overalt – også under en
 * anden komponents render og i Node. staticSvg.ts serialiserer den til et billede.
 */
export function rigElement(props: RigProps, env: RigEnv): ReactElement {
  const {
    species: def, stage = 2, colorway = 'c1', star = false, mood = 'idle', mode = 'animated',
    outfit, lookAt, size, className, style, title, silhouette = false, freezeAt,
  } = props
  const breed: BreedId = props.breed ?? def.breeds[0].id
  const lod = lodFor(size, props.lod)
  // Små ikoner viser hele figuren tæt beskåret (babyen fylder rammen som de andre stadier).
  const crop: RigCrop = props.crop ?? (lod === 'small' ? 'fit' : 'full')
  const still = mode === 'static'
  const animated = !still
  const uid = env.uid
  const ids: RigIds = { uid, bodyClip: `${uid}b`, headClip: `${uid}h`, outsideHead: `${uid}e`, gradient: `${uid}g` }
  const shadowId = `${uid}s`
  const itemClipId = `${uid}i`
  const earClipId = ids.outsideHead
  const holeClipId = `${uid}o`
  const hornClipId = `${uid}n`
  const sleeveClipId = `${uid}v`
  const scarfClipId = `${uid}k`
  const armholeClipId = `${uid}a`

  const a = modelAnchors(def, breed)
  const R = regionTransforms(a, stage)
  const w = worldAnchors(a, stage)
  const parts = resolveParts(def, breed)
  const breedDef = resolveBreed(def, breed)
  const base = resolvePalette(def, breed, colorway)
  const pal: Palette = silhouette ? silhouettePalette(base) : lod === 'small' ? lodPalette(base) : base
  const face = MOOD_FACE[mood]
  const faceStyle = resolveFace(def, breed)
  const mouth = face.mouth === 'idle' ? faceStyle.idleMouth : face.mouth
  // Næsevippet (kaninens signatur, review G1-r4, K2): i animeret tilstand løftes overlæben (hvilemundens
  // 'cat-w') med næsen, og hovedet nikker på overshoot-framen (rig.css: a-lip og a-nod, kun i hvile).
  const nod = animated && def.signature === 'nose-wiggle'
  const lip = nod && mouth === 'cat-w'
  const pose = resolvePose(def, breed, mood)
  const seed = props.seed ?? hashSeed(`${def.id}${breed}${colorway}${stage}`)

  // Stregbredder kompenseres, så konturen er 3,2 i verdensrummet på alle stadier (·1,3 i små ikoner).
  const OUT = OUTLINE * (lod === 'small' ? 1.3 : 1)
  const swBody = OUT / R.body.s
  const swHead = OUT / R.head.s

  // Tøj
  const worn = (slot: Slot): Worn | undefined => (def.occupies?.includes(slot) ? undefined : outfit?.[slot])
  const hides = new Set(Object.values(outfit ?? {}).flatMap((x) => x?.item.hides ?? []))
  const bodyWorn = worn('body')
  const headWorn = worn('head')
  const hat = headWorn ? fitItem(headWorn.item, a, def).earMode : null

  const Ear = parts.Ear
  const earRig = breedDef?.ears ?? def.ears
  const earsShown = !!Ear && !hides.has('ears')
  const earsBehind = !!earRig?.behind
  // Hatte med ørehuller: ørerne klippes ved hullet, og hullets forkant lægges oven på roden.
  const holes = hat === 'through' && earsShown && earRig?.clip !== false && !!headWorn?.item.art.rim
  // Arter tegner selv en afrundet ørebund i hullet (ctx.hat); klippet er kun et værn for andre.
  const holeY = Math.min(a.earBaseL.y, a.earBaseR.y) + 3
  // Hornhul (review G1-r2, E1): hatten tegner et hul over hornets rod, og hornet skjules under hullets
  // nederste kant (forkanten i `rim` ligger ovenpå), så hornet går op gennem huen og aldrig over kanten.
  const hornHat = parts.Horn && holes && headWorn?.item.hornHole ? headWorn : undefined
  const hornHole = (() => {
    if (!hornHat) return null
    const h = hornHat.item.hornHole!
    const fit = fitItem(hornHat.item, a, def)
    const base = toLocal(fit, a.hornBase)
    const local = { x: base.x, y: base.y - h.lift }
    // Hatte med hornhul drejes ikke; centrum i modelrummet og hullets halvakser.
    return { local, cx: fit.x + local.x * fit.scale, cy: fit.y + local.y * fit.scale, rx: h.rx * fit.scale, ry: h.ry * fit.scale }
  })()

  // Ansigtsgenstande i panden (eventyrbriller) flytter op om en hat med ørehuller og tegnes efter den.
  const faceOnHat = hat === 'through' && !!worn('face')?.item.onHat
  // Uden hat ligger de oven på pandelokken, så en stor lok (shetlandføllet) ikke skjuler dem (review G1-r4, T11).
  const faceOverMane = !faceOnHat && !!worn('face')?.item.onHat && !!parts.ManeFront && !hides.has('mane-front')
  // Arterne ser 'through' kun, når ørerne faktisk går gennem huller (og tegner da en afrundet ørebund).
  const hatCtx = holes ? 'through' : hat === 'under' ? 'under' : null
  const ctx = (sw: number): PartCtx => ({ pal, a, stage, mood, breed, colorway, sw, ids, still, lod, pose, hat: hatCtx, clothed: !!bodyWorn })

  const bodyFn = parts.body ?? templateBody(def.body)
  const headFn = parts.head ?? defaultHead
  const bodyD = bodyFn(a, 0, stage)
  const headD = headFn(a, 0, stage)
  // Indvendige klip (kontur/2 inde), så skygger og mønstre aldrig dækker konturen; de ligger 0,4
  // enheder ind under stregen, så antialiasing ikke efterlader en hårfin lys søm langs konturen.
  const bodyClipD = bodyFn(a, -swBody / 2 + 0.4, stage)
  const headClipD = headFn(a, -swHead / 2 + 0.4, stage)

  const eyeMidWorld = { x: (w.eyeL.x + w.eyeR.x) / 2, y: (w.eyeL.y + w.eyeR.y) / 2 }
  const { gazeRef, glintRef } = env
  const staticGaze = still ? gazeFor(lookAt, eyeMidWorld, R.head.s) ?? MOOD_GAZE[mood] : undefined

  const renderItem = (slot: Slot, layer: 'front' | 'back' | 'rim' | 'straps', region: number, clip?: string, hold?: HandHold) => {
    const wItem = worn(slot)
    if (!wItem) return null
    if (layer === 'rim' && !holes) return null
    const item = wItem.item
    const art =
      layer === 'back'
        ? item.art.back
        : layer === 'rim'
          ? item.art.rim
          : layer === 'straps'
            ? item.art.straps
            : slot === 'body'
              ? (item.art.bodyShapes?.[def.body] ?? item.art.front)
              : item.art.front
    if (!art) return null
    const fit = fitItem(item, a, def)
    const c = itemPalette(item.colorways[wItem.colorway ?? 0], silhouette)
    const sw = OUT / (region * fit.scale)
    return (
      <g data-item={item.id} data-slot={slot} data-layer={layer} data-reach={item.reach ? '' : undefined} clipPath={clip ? `url(#${clip})` : undefined}>
        <g transform={fitTransform(fit)}>
          {art({
            c, a, sw, body: def.body, earMode: fit.earMode, ids, stage,
            local: (p) => toLocal(fit, p),
            solo: false,
            holes,
            hold,
            hat,
            horn: slot === 'head' ? (hornHole?.local ?? null) : null,
            showcase: crop === 'wide' || undefined,
            restroke: (color) => (
              <path d={slot === 'body' && sleeveSeams ? join(bodyD, sleeveSeams) : bodyD} transform={inverseTransform(fit)} fill="none" stroke={color ?? c.outline} strokeWidth={n(swBody)} strokeLinejoin="round" strokeLinecap={slot === 'body' && sleeveSeams ? 'round' : undefined} />
            ),
          })}
        </g>
      </g>
    )
  }

  const upL = !!pawPose(pose.pawL).up && !!parts.PawUp
  const upR = !!pawPose(pose.pawR).up && !!parts.PawUp

  // Ærmer (kropstøj med ærmer på arter, der har en armkontur). Tegnes på hvilende poter.
  const sleeveArt = bodyWorn?.item.art.sleeve
  const limb = parts.limb
  // Lodrette forben med skulderleddet langt under hovedet (kat, hvalp, hest, enhjørning; review G1-r4, T5):
  // ærmet trækkes op til skulderen under hovedets kant (se sleeve.ts). Hestens ærme er ca. 20 % smallere
  // forneden.
  const bodyFit = bodyWorn ? fitItem(bodyWorn.item, a, def) : null
  const longTop = a.neck.y - a.shoulderL.y - 4
  const longLimb = !!limb && limb.rot === 0 && longTop < -20
  const long = sleeveArt && limb && longLimb
    ? longArm(longTop, limb.cuff.y, (limb.cuff.half - 0.4) * (def.family === 'equine' ? 1.25 : 1.06), limb.cuff.half - 0.4)
    : null
  // Skulderleddet i trøjens lokale koordinater, så ærmets striber ligger i trøjens højde.
  const armOrigin = (side: 'L' | 'R'): Pt => {
    const at = side === 'L' ? a.shoulderL : a.shoulderR
    return { x: (at.x - bodyFit!.x) / bodyFit!.scale, y: (at.y - bodyFit!.y) / bodyFit!.scale }
  }
  // Overdelens sidelinjer (modelrummet, kun på hvilende arme): de streges sammen med kropskonturen i
  // trøjens `restroke`, så de ligger i trøjens eget stof (under halsudskæringen) og koster ingen elementer.
  const sleeveSeams = long
    ? join(
        ...(['L', 'R'] as const)
          .filter((side) => !(side === 'L' ? upL : upR))
          .flatMap((side) => {
            const at = side === 'L' ? a.shoulderL : a.shoulderR
            const m = side === 'L' ? 1 : -1
            return long.seams.map((line) => spline(line.map(([x, y]) => [at.x + m * x, at.y + y] as Vec)))
          }),
      )
    : ''
  // Ærmeløst kropstøj (vesten) på lodrette forben (review G1-r4, punkt 2): benet kommer ud af et ærmegab lige
  // under skulderleddet. Genstanden tegner kantbåndet; riggen klipper benet over det, så vesten ses dér, og
  // benet ikke ligger som en kasse oven på vesten.
  const armholeArt = bodyWorn?.item.art.armhole
  // Buen er lidt bredere end benet (manchettens halve bredde er benet plus ærmets luft).
  const arch = armholeArt && limb && longLimb ? armholeArch(limb.cuff.half * (def.family === 'equine' ? 1.04 : 0.9), ARMHOLE_Y) : null
  const armhole = (side: 'L' | 'R') => {
    if (!armholeArt || !arch || !bodyWorn || !bodyFit) return null
    const c = itemPalette(bodyWorn.item.colorways[bodyWorn.colorway ?? 0], silhouette)
    const node = armholeArt({
      c, sw: swBody, edge: arch.edge, y: ARMHOLE_Y + 5.2, origin: armOrigin(side), s: bodyFit.scale, stage, body: def.body,
    })
    return node ? (
      <g data-item={bodyWorn.item.id} data-slot="body" data-layer={`armhole-${side}`}>
        {node}
      </g>
    ) : null
  }
  // Ærmegabet på de hvilende forben (en løftet arm har ærmeløst tøjs rod i `sleeveUp`).
  const legHoles = { L: upL ? null : armhole('L'), R: upR ? null : armhole('R') }
  const sleeve = (side: 'L' | 'R') => {
    if (!sleeveArt || !limb || !bodyWorn) return null
    const c = itemPalette(bodyWorn.item.colorways[bodyWorn.colorway ?? 0], silhouette)
    return (
      <g data-item={bodyWorn.item.id} data-slot="body" data-layer={`sleeve-${side}`} transform={limb.rot ? `rotate(${n(limb.rot)})` : undefined}>
        {sleeveArt({
          c, sw: swBody, sleeve: limb.sleeve(stage), cuff: limb.cuff, clipId: sleeveClipId, stage, body: def.body,
          long: long ? { d: long.d, s: bodyFit!.scale, origin: armOrigin(side) } : undefined,
        })}
      </g>
    )
  }
  // En løftet pote "bag hovedet" tegnes i kroppens lag, så hovedet dækker spidsen.
  const behindL = upL && !!pawPose(pose.pawL).behind
  const behindR = upR && !!pawPose(pose.pawR).behind

  // Ærmet på en løftet arm følger armens rygrad (samme form på begge sider; højre spejles).
  const sleeveUpArt = bodyWorn?.item.art.sleeveUp
  const upArm = parts.upArms?.[mood]
  const bent = bodyWorn && sleeveUpArt && upArm && (upL || upR) ? bentSleeve(upArm) : null
  const sleeveUp = (side: 'L' | 'R') => {
    if (!bent || !sleeveUpArt || !bodyWorn) return null
    const c = itemPalette(bodyWorn.item.colorways[bodyWorn.colorway ?? 0], silhouette)
    return (
      <g data-item={bodyWorn.item.id} data-slot="body" data-layer={`sleeve-${side}`}>
        {sleeveUpArt({ c, sw: swBody, ...bent })}
      </g>
    )
  }

  // Håndgenstanden i nøgleposen (HandHold): hele kæden fra genstandens ramme til verdensrummet
  // (figur, kroppens region og ånding, potens drejning eller løftede spids, pasformen) og hovedet med
  // sin region og hældning, så genstanden kan placere sig i forhold til hovedet i alle humør.
  const figM = about(G, pose.fig)
  const handHold = (item: ItemDef, at: Pt, rot: number, tip: Pt | undefined, front: boolean): HandHold => {
    const fit = fitItem(item, a, def)
    const pawM = chain(moveMat(at.x, at.y), scaleMat(-1, 1), rotMat(rot))
    const gripM = tip ? chain(moveMat(tip.x, tip.y), scaleMat(-1, 1), moveMat(-a.pawR.x, -a.pawR.y)) : chain(scaleMat(-1, 1), moveMat(-at.x, -at.y))
    const toWorld = chain(
      figM, moveMat(R.body.tx, R.body.ty), scaleMat(R.body.s), about(G, pose.body), pawM, gripM,
      moveMat(fit.x, fit.y), rotMat(fit.rot), scaleMat(fit.scale),
    )
    const fromWorld = invert(toWorld)
    const headM = chain(figM, moveMat(R.neckWorld.x, R.neckWorld.y), scaleMat(R.head.s), xfMat(pose.head), moveMat(-a.neck.x, -a.neck.y))
    const hc = applyMat(headM, a.headCenter)
    const hb = figureBounds(def, breed).head
    const corners = [applyMat(headM, { x: hb.x0, y: hb.y0 }), applyMat(headM, { x: hb.x1, y: hb.y0 }), applyMat(headM, { x: hb.x0, y: hb.y1 }), applyMat(headM, { x: hb.x1, y: hb.y1 })]
    const hbox = box(Math.min(...corners.map((q) => q.x)), Math.min(...corners.map((q) => q.y)), Math.max(...corners.map((q) => q.x)), Math.max(...corners.map((q) => q.y)))
    const hs = R.head.s * (pose.head?.sx ?? 1)
    const fxOn = showFx && (mood === 'think' || mood === 'sleep')
    return {
      local: (p) => applyMat(fromWorld, p),
      grip: applyMat(toWorld, { x: 0, y: 0 }),
      head: {
        x: hc.x, y: hc.y, rx: a.headRx * hs, ry: a.headRy * R.head.s * (pose.head?.sy ?? pose.head?.sx ?? 1), s: hs, mouth: applyMat(headM, a.mouth), box: hbox,
        eyes: [applyMat(headM, a.eyeL), applyMat(headM, a.eyeR)],
        eye: { rx: a.eyeRx * R.xf.eye * hs, ry: a.eyeRy * R.xf.eye * hs },
      },
      fx: fxOn ? applyMat(figM, fxHead) : null,
      front,
      mood,
    }
  }

  // Poter (venstre tegnes, højre spejles). Håndgenstanden ligger i højre pote under selve poten.
  // `outer` lægger kroppens region foran (løftede poter tegnes uden for kroppens gruppe).
  const paw = (side: 'L' | 'R', outer = '') => {
    const at = side === 'L' ? a.shoulderL : a.shoulderR
    const pp = pawPose(side === 'L' ? pose.pawL : pose.pawR)
    const up = side === 'L' ? upL : upR
    const Part: SidePart = up ? parts.PawUp! : parts.Paw
    const handItem = side === 'R' ? worn('hand') : undefined
    let hand: ReactNode = null
    if (handItem) {
      const tip = up ? parts.pawUpTip?.[mood] : undefined
      // Håndgenstanden placeres ved pawR i modelrummet og føres ind i potens lokale (spejlede) ramme;
      // en løftet pote bærer den ved sin spids.
      const hold = handHold(handItem.item, at, pp.rot ?? 0, tip, up && !(side === 'L' ? behindL : behindR))
      hand = tip ? (
        <g transform={`translate(${n(tip.x)} ${n(tip.y)}) scale(-1 1) translate(${n(-a.pawR.x)} ${n(-a.pawR.y)})`}>{renderItem('hand', 'front', R.body.s, undefined, hold)}</g>
      ) : (
        <g transform={`scale(-1 1) translate(${n(-at.x)} ${n(-at.y)})`}>{renderItem('hand', 'front', R.body.s, undefined, hold)}</g>
      )
    }
    const hole = up ? null : legHoles[side]
    return (
      <g data-part={`paw-${side.toLowerCase()}`} transform={`${outer}translate(${n(at.x)} ${n(at.y)})${side === 'R' ? ' scale(-1 1)' : ''}`}>
        <g className={animated ? `a-paw a-paw-${side.toLowerCase()}${up ? ' a-up' : ''}` : undefined} transform={pp.rot ? `rotate(${n(pp.rot)})` : undefined}>
          {hand}
          {hole ? (
            <g clipPath={`url(#${armholeClipId})`}>
              <Part {...ctx(swBody)} side={side} />
            </g>
          ) : (
            <Part {...ctx(swBody)} side={side} />
          )}
          {up ? sleeveUp(side) : (sleeve(side) ?? hole)}
        </g>
      </g>
    )
  }

  // Hornet om sin rod; gennem et hornhul klippes det (i hornets egen ramme) under hullets nederste kant.
  const horn = (hole: typeof hornHole) => {
    const k = stage === 3 ? (breedDef?.hornGrowth ?? R.xf.horn) : R.xf.horn
    const b = a.hornBase
    const clip = hole && (() => {
      const lx = (x: number) => n((x - b.x) / k)
      const ly = (y: number) => n((y - b.y) / k)
      const r = (v: number) => n(v / k)
      return `M-400 -400H400V${ly(hole.cy)}H${lx(hole.cx + hole.rx)}A${r(hole.rx)} ${r(hole.ry)} 0 0 1 ${lx(hole.cx - hole.rx)} ${ly(hole.cy)}H-400Z`
    })()
    return (
      <g transform={`translate(${n(b.x)} ${n(b.y)}) scale(${fmt3(k)})`} clipPath={clip ? `url(#${hornClipId})` : undefined}>
        {clip && (
          <clipPath id={hornClipId}>
            <path d={clip} />
          </clipPath>
        )}
        {Horn!(ctx(swHead / k))}
      </g>
    )
  }

  // Fyld bag alt ved armen (i skulderens ramme uden animation); arten tegner kun, hvor der er en lomme.
  const pawBack = (side: 'L' | 'R') => {
    const at = side === 'L' ? a.shoulderL : a.shoulderR
    const web = parts.PawBack?.({ ...ctx(swBody), side })
    return web ? (
      <g data-part="armpit" transform={`translate(${n(at.x)} ${n(at.y)})${side === 'R' ? ' scale(-1 1)' : ''}`}>
        {web}
      </g>
    ) : null
  }

  const ear = (side: 'L' | 'R', Part: NonNullable<SpeciesParts['Ear']>) => {
    const at = side === 'L' ? a.earBaseL : a.earBaseR
    const splay = earRig?.splay ?? 0
    const rot = side === 'L' ? pose.earL : pose.earR
    return (
      <g transform={`translate(${n(at.x)} ${n(at.y)})${side === 'R' ? ' scale(-1 1)' : ''}${splay ? ` rotate(${n(-splay)})` : ''}`}>
        <g className={animated ? `a-ear a-ear-${side.toLowerCase()}${earRig?.hang ? ' a-hang' : ''}` : undefined} transform={rot ? `rotate(${n(rot)})` : undefined}>
          <Part {...ctx(swHead)} side={side} />
        </g>
      </g>
    )
  }

  const scaled = (at: Pt, s: number, node: ReactNode) =>
    s === 1 ? node : <g transform={`translate(${n(at.x)} ${n(at.y)}) scale(${fmt3(s)}) translate(${n(-at.x)} ${n(-at.y)})`}>{node}</g>

  const Tail = parts.Tail
  const Horn = parts.Horn
  // Mankens vækst på stadie 3 (racen kan dæmpe den, fx løvehovedets krave).
  const maneK = stage === 3 ? (breedDef?.maneGrowth ?? R.xf.mane) : R.xf.mane
  const Wings = parts.Wings
  const earClip = earsShown && earRig?.clip !== false && !holes
  // Klippet "uden for hovedet" (lidt inden for konturen, så roden er sømløs) til ører og pandelok.
  const outsideClip = earClip || (!!parts.ManeFront && !hides.has('mane-front'))
  const P = parts.Pattern
  const pattern = resolveColorway(def, colorway).pattern ?? 'none'
  const shade = shading(a, colorway === 'gold' && !silhouette, def.goldBand)
  const showFx = !silhouette

  // fx-positioner (verdensrum). Tanker og Z'er sidder til højre for hovedet, fri af øret.
  const fxModel = breedDef?.fx ?? def.fx ?? { x: a.headCenter.x + a.headRx + 10, y: a.headCenter.y - a.headRy * 0.32 }
  const fxHead = apply(R.head, fxModel)
  const fxSweat = { x: w.headCenter.x + w.headRx * 0.62, y: w.headCenter.y - w.headRy * 0.55 }
  const sparkle = pal.sparkle && showFx && (colorway === 'gold' || colorway === 'starwhite' || (star && stage === 3))

  const viewBox = cropViewBox(def, breed, stage, crop, outfit)
  // Hop må gerne gå uden for kanvasset (overflow synlig); en beskåret rig (butikskort) klipper.
  const rootStyle = {
    ...(crop !== 'full' ? { overflow: 'hidden' } : null),
    ...style,
    '--rig-t': `${(freezeAt ?? seed * 3.1).toFixed(3)}s`,
    '--blink': `${(4.3 + seed * 1.6).toFixed(2)}s`,
  } as CSSProperties

  const bodyRegion = `translate(${n(R.body.tx)} ${n(R.body.ty)}) scale(${fmt3(R.body.s)})`
  // Jubel: halsgenstanden tegnes efter de løftede arme og klippes til "uden for hovedet" (hovedets kontur
  // ført fra hovedets ramme ind i kroppens), så den ligger under hagen som ellers, men oven på armenes rod.
  // Løvehovedets krave (review G1-r4, B4): halsgenstanden ligger på samme måde oven på manken under hagen.
  const scarfOver =
    worn('neck') && ((mood === 'cheer' && upL && upR && !behindL && !behindR) || !!breedDef?.neckOverMane)
      ? {
          head:
            `${aboutGround({ sx: 1 / (pose.body?.sx ?? 1), sy: 1 / (pose.body?.sy ?? pose.body?.sx ?? 1) }) ?? ''} ` +
            `scale(${fmt3(1 / R.body.s)}) translate(${n(R.neckWorld.x - R.body.tx)} ${n(R.neckWorld.y - R.body.ty)}) ` +
            `scale(${fmt3(R.head.s)}) ${tf(pose.head ?? {}) ?? ''} translate(${n(-a.neck.x)} ${n(-a.neck.y)})`,
        }
      : null
  const sleeveClip = bodyWorn && sleeveArt && limb && (!upL || !upR)

  return (
    <svg
      ref={env.rootRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      width={size}
      height={typeof size === 'number' ? n(size * cropAspect(crop)) : undefined}
      className={['rig', className].filter(Boolean).join(' ')}
      data-mood={mood}
      data-species={def.id}
      data-hat-top={n(w.headTop.y - w.headWidth * 0.55)}
      data-static={still ? '' : undefined}
      data-frozen={freezeAt !== undefined ? '' : undefined}
      style={rootStyle}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      overflow={crop === 'full' ? 'visible' : 'hidden'}
    >
      <defs>
        <clipPath id={ids.bodyClip}>
          <path d={bodyClipD} />
        </clipPath>
        <clipPath id={ids.headClip}>
          <path d={headClipD} />
        </clipPath>
        {outsideClip && (
          <clipPath id={earClipId}>
            <path d={outside(headFn(a, -swHead / 2 - EAR_SEAM, stage))} clipRule="evenodd" fillRule="evenodd" />
          </clipPath>
        )}
        {holes && (
          <clipPath id={holeClipId}>
            <path d={rect(-200, -200, 600, 200 + holeY)} />
          </clipPath>
        )}
        {bodyWorn && (
          <clipPath id={itemClipId}>
            <path d={bodyFn(a, swBody / 2 - 0.1, stage)} />
          </clipPath>
        )}
        {arch && (legHoles.L || legHoles.R) && (
          <clipPath id={armholeClipId}>
            <path d={arch.clip} />
          </clipPath>
        )}
        {sleeveClip && (
          <clipPath id={sleeveClipId}>
            <path d={long ? long.d : limb!.sleeve(stage)} />
          </clipPath>
        )}
        {!silhouette && <ShadowGradient id={shadowId} />}
        {pal.gradient && (
          <linearGradient id={ids.gradient} x1="0" y1="0" x2="0" y2="1">
            {/* Flade striber: hårde stop ved båndgrænserne (første og sidste farve forlænges af gradienten). */}
            {pal.gradient.slice(0, -1).flatMap((c, i) => {
              const at = fmt3((i + 1) / pal.gradient!.length)
              return [<stop key={`${i}a`} offset={at} stopColor={c} />, <stop key={`${i}b`} offset={at} stopColor={pal.gradient![i + 1]} />]
            })}
          </linearGradient>
        )}
      </defs>

      {/* Stjerneformens aura bag alt. */}
      {star && stage === 3 && showFx && <Aura c={{ x: w.headCenter.x, y: (w.headCenter.y + w.bodyCenter.y) / 2 }} r={86} className={animated ? 'a-aura' : undefined} />}

      {/* 1 · jordskygge (gruppen kun når posen skalerer skyggen) */}
      {!silhouette &&
        (pose.shadow ? (
          <g transform={aboutGround({ sx: pose.shadow })}>
            <GroundShadow id={shadowId} cx={G.x} cy={G.y - 1} rx={w.bodyRx * 1.18} className={animated ? 'a-shadow' : undefined} />
          </g>
        ) : (
          <GroundShadow id={shadowId} cx={G.x} cy={G.y - 1} rx={w.bodyRx * 1.18} className={animated ? 'a-shadow' : undefined} />
        ))}

      <g className={animated ? 'a-fig' : undefined} transform={aboutGround(pose.fig)}>
        {/* Krop (lag 2–9) */}
        <g transform={bodyRegion}>
          <g className={animated ? 'a-body' : undefined} transform={aboutGround(pose.body)}>
            {/* Fyld bag alt ved armene: en lomme mellem arm, hoved, øre, manke, hale og krop viser aldrig baggrund. */}
            {pawBack('L')}
            {pawBack('R')}
            {/* 2 · back-item */}
            {renderItem('back', 'front', R.body.s)}
            {renderItem('neck', 'back', R.body.s)}
            {/* 3 · vinger, hale */}
            {Wings && (
              <g transform={`translate(${n(a.back.x)} ${n(a.back.y)}) scale(${fmt3(R.xf.wings)})`}>
                <g className={animated ? 'a-wings' : undefined}>{Wings(ctx(swBody / R.xf.wings))}</g>
              </g>
            )}
            {Tail && (
              <g transform={`translate(${n(a.tailBase.x)} ${n(a.tailBase.y)})${R.xf.tail !== 1 ? ` scale(${fmt3(R.xf.tail)})` : ''}`}>
                <g className={animated ? 'a-tail' : undefined} transform={pose.tail ? `rotate(${n(pose.tail)})` : undefined}>
                  {Tail(ctx(swBody / R.xf.tail))}
                </g>
              </g>
            )}
            {/* 4 · fødder */}
            {parts.Feet(ctx(swBody))}
            {/* 5 · krop + mønster + skygge */}
            <path d={bodyD} fill={pal.fur} stroke={pal.outline} strokeWidth={n(swBody)} strokeLinejoin="round" />
            {pattern !== 'none' && P?.body?.(ctx(swBody))}
            {parts.BodyDeco?.(ctx(swBody))}
            {!silhouette && shade.body && (
              <path d={outside(shade.body)} fill={pal.shade} fillRule="evenodd" clipPath={`url(#${ids.bodyClip})`} />
            )}
            {/* Krave/halsflæse: under kropstøjet og hagens skygge (med kropstøj kan delen klippe sig til
                kroppen via ctx.clothed, så intet titter frem over trøjens skuldre). */}
            {parts.Ruff?.(ctx(swBody))}
            {/* Hovedets kastede skygge på kroppen lige under hagen (dybde, samme regel på alle stadier). */}
            {!silhouette && <path d={chinShadow(a, R)} fill={pal.shade} clipPath={`url(#${ids.bodyClip})`} />}
            {/* Guld: et smalt glansbånd på kroppen. */}
            {shade.bodyBand && <path d={shade.bodyBand} fill={pal.highlight} clipPath={`url(#${ids.bodyClip})`} />}
            {/* 6 · body-item (klippet til kroppen +2) */}
            {renderItem('body', 'front', R.body.s, itemClipId)}
            {/* 6b · ryggenstandens stropper (over kropstøjet, under poterne) */}
            {renderItem('back', 'straps', R.body.s)}
            {/* 7–8 · hånd + poter (hvilende) */}
            {(!upL || behindL) && paw('L')}
            {(!upR || behindR) && paw('R')}
            {/* 9 · neck-item (i jubel først efter de løftede arme, se nedenfor) */}
            {!scarfOver && renderItem('neck', 'front', R.body.s)}
            {renderItem('back', 'back', R.body.s)}
          </g>
        </g>

        {/* Hoved (lag 10–16) om halsleddet; data-part="head" bruges af bobleklaringens lint. */}
        <g data-part="head" transform={`translate(${n(R.neckWorld.x)} ${n(R.neckWorld.y)}) scale(${fmt3(R.head.s)})`}>
          <g className={animated ? 'a-head' : undefined} transform={tf(pose.head ?? {})}>
            <Nod on={nod}>
            <g transform={`translate(${n(-a.neck.x)} ${n(-a.neck.y)})`}>
              {/* 10 · mane-back (+ hattens bagdel) og ører bag hovedet (vædderen) */}
              {parts.ManeBack && scaled((breedDef?.maneOrigin ?? def.maneOrigin) === 'headTop' ? a.headTop : a.headCenter, maneK, parts.ManeBack(ctx(swHead / maneK)))}
              {earsShown && earsBehind && ear('L', Ear!)}
              {earsShown && earsBehind && ear('R', Ear!)}
              {renderItem('head', 'back', R.head.s)}
              {/* 11 · hoved + mønster + skygge */}
              <path d={headD} fill={pal.fur} stroke={pal.outline} strokeWidth={n(swHead)} strokeLinejoin="round" />
              {pattern !== 'none' && P?.head?.(ctx(swHead))}
              {!silhouette && shade.head && (
                <path d={outside(shade.head)} fill={pal.shade} fillRule="evenodd" clipPath={`url(#${ids.headClip})`} />
              )}
              {parts.HeadDeco?.(ctx(swHead))}
              {!silhouette && <path d={shade.gloss} fill={pal.highlight} />}
              {/* 12 · ansigt */}
              {faceStyle.cheeks !== false && <Cheeks a={a} pal={pal} />}
              {parts.Muzzle?.(ctx(swHead))}
              {lip ? (
                <g className="a-lip">
                  <Mouth at={a.mouth} shape={mouth} pal={pal} sw={swHead} buckTeeth={faceStyle.buckTeeth} />
                </g>
              ) : (
                <Mouth at={a.mouth} shape={mouth} pal={pal} sw={swHead} buckTeeth={faceStyle.buckTeeth} />
              )}
              <Eyes
                a={a}
                shape={face.eyes}
                pal={pal}
                scale={R.xf.eye}
                sw={swHead}
                animated={animated}
                gaze={staticGaze}
                gazeRef={gazeRef}
                glintRef={glintRef}
              />
              {/* 13 · face-item (eventyrbriller på en hat tegnes efter hatten, se faceOnHat) */}
              {!faceOnHat && !faceOverMane && renderItem('face', 'front', R.head.s)}
              {/* 14 · mane-front (eventyrbriller i panden ligger oven på pandelokken) */}
              {parts.ManeFront && !hides.has('mane-front') && scaled(a.headTop, R.xf.mane, parts.ManeFront(ctx(swHead / R.xf.mane)))}
              {faceOverMane && renderItem('face', 'front', R.head.s)}
              {/* 15 · head-item (ører og horn ligger over hatte, SPEC §7; en hat mellem ørerne på en art
                  med horn sidder vippet bag hornet, se fit.ts) */}
              {renderItem('head', 'front', R.head.s)}
              {faceOnHat && renderItem('face', 'front', R.head.s)}
              {/* 16 · ører, horn (+ hattens hulkant over ørernes rod) */}
              {earsShown && !earsBehind && (
                <g clipPath={earClip ? `url(#${earClipId})` : holes ? `url(#${holeClipId})` : undefined}>
                  {ear('L', Ear!)}
                  {ear('R', Ear!)}
                </g>
              )}
              {/* Hornet gennem et hornhul: under hullets forkant (rim); ellers øverst. */}
              {Horn && hornHole && horn(hornHole)}
              {renderItem('head', 'rim', R.head.s)}
              {Horn && !hornHole && horn(null)}
            </g>
            </Nod>
          </g>
        </g>

        {/* Løftede poter foran hovedet (jubel, vink, tænker, ups): kroppens region og nøglepose lagt ind i
            potens egen transform (ingen ekstra grupper; de ånder ikke med, hvad ingen kan se på en løftet pote). */}
        {upL && !behindL && paw('L', `${bodyRegion} ${aboutGround(pose.body) ?? ''} `)}
        {upR && !behindR && paw('R', `${bodyRegion} ${aboutGround(pose.body) ?? ''} `)}
        {/* Jubel: halsgenstanden (tørklædet) ligger oven på de løftede armes rod under hagen, så ærmerne
            og rygsækkens stropper ikke danner et X over brystet (review G1-r4, T10). */}
        {scarfOver && (
          <g transform={`${bodyRegion} ${aboutGround(pose.body) ?? ''}`}>
            <clipPath id={scarfClipId}>
              <path d={outside(headD)} transform={scarfOver.head} clipRule="evenodd" />
            </clipPath>
            {renderItem('neck', 'front', R.body.s, scarfClipId)}
          </g>
        )}

        {/* 17 · fx (verdensrum; hvert fx-element bærer data-part="fx") */}
        {showFx && mood === 'think' && <ThoughtDots at={fxHead} s={R.head.s} sw={OUT} animated={animated} />}
        {showFx && mood === 'sleep' && <Zzz at={fxHead} s={R.head.s} sw={OUT} animated={animated} />}
        {showFx && mood === 'oops' && <SweatDrop at={fxSweat} s={R.head.s} sw={OUT} className={animated ? 'a-sweat' : undefined} />}
        {sparkle && (
          <Sparkles
            pts={around({ x: w.headCenter.x, y: (w.headCenter.y + w.bodyCenter.y) / 2 }, w.headRx + 28 * R.head.s, [-150, -32, 200])}
            size={9 * R.head.s}
            fill={pal.sparkle!}
            stroke={pal.outline}
            sw={OUT}
            className={animated ? 'a-twinkle' : undefined}
          />
        )}
      </g>
    </svg>
  )
}

/**
 * Hovedets skygge på kroppen: hovedets underside (fra hovedregionen) ført ind i kroppens modelrum
 * og forskudt lidt ned, så kun en smal halvmåne under hagen ses.
 */
function chinShadow(a: AnchorSet, R: ReturnType<typeof regionTransforms>): string {
  const c = { x: a.headCenter.x * R.head.s + R.head.tx, y: a.headCenter.y * R.head.s + R.head.ty }
  const k = R.head.s / R.body.s
  const cx = (c.x - R.body.tx) / R.body.s + 2
  const cy = (c.y - R.body.ty) / R.body.s + 6.5
  return ellipse(cx, cy + a.headRy * k * 0.1, a.headRx * k * 0.86, a.headRy * k * 0.94)
}

/**
 * Cel-skyggens "lyse" ellipser (skyggen = kroppen minus den lyse ellipse) og hovedets højlys.
 * Guld får desuden et smalt glansbånd på hoved og krop (metallisk, uden gradient).
 */
function shading(a: AnchorSet, goldBand: boolean, arc: readonly [number, number] = [196, 244]) {
  const h = a.headCenter
  const b = a.bodyCenter
  return {
    head: ellipse(h.x - 7, h.y - 9, a.headRx * 1.02, a.headRy * 1.04),
    body: ellipse(b.x - 9, b.y - 12, a.bodyRx * 1.02, a.bodyRy * 1.06),
    gloss: join(
      ellipse(h.x - a.headRx * 0.5, h.y - a.headRy * 0.6, a.headRx * 0.2, a.headRy * 0.12, -32),
      ellipse(h.x - a.headRx * 0.2, h.y - a.headRy * 0.8, a.headRx * 0.055, a.headRy * 0.055),
      goldBand && lune(h.x + 4, h.y + 2, a.headRx * 0.86, a.headRy * 0.86, 2.6, 200, 250),
    ),
    bodyBand: goldBand ? lune(b.x + 6, b.y + 4, a.bodyRx * 0.82, a.bodyRy * 0.86, 3, arc[0], arc[1]) : null,
  }
}

function gazeFor(target: Pt | null | undefined, eye: Pt, scale: number): Pt | undefined {
  if (!target) return undefined
  const dx = target.x - eye.x
  const dy = target.y - eye.y
  const d = Math.hypot(dx, dy)
  if (d === 0) return undefined
  const m = (3 * Math.min(1, d / 60)) / d
  return { x: (dx * m) / scale, y: (dy * m) / scale }
}

export type { RigIds }
