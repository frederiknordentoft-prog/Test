// <Rig>: ét dyr i fast lagorden (17 lag, SPEC §6.4) med stadier, humør og tøj.
//
// Struktur (verden = viewBox 0 0 200 240):
//   defs · aura · jordskygge
//   g.a-fig                                  hop/jubel (pivot = fodpunktet, indlejret i keyframes)
//     g[krop: stadie]  g.a-body              lag 2–9 i modelrummet (ånding om fodpunktet)
//     g[translate(hals) scale]  g.a-head  g[translate(−hals)]   lag 10–16 i modelrummet
//     fx                                     lag 17 i verdensrummet
// Animerede dele bruger pivot-mønsteret: <g transform="translate(px py)"><g class="a-…">lokalt</g></g>
// med transform-origin 0 0. Kun transform og opacity animeres (rig.css).
import { useEffect, useId, useRef } from 'react'
import type { CSSProperties, ReactElement, ReactNode, Ref } from 'react'
import { Aura, Cheeks, Eyes, GroundShadow, MOOD_FACE, MOOD_GAZE, Mouth, ShadowGradient, Sparkles, SweatDrop, ThoughtDots, Zzz, around } from '../parts/house'
import { OUTLINE, modelAnchors, regionTransforms, worldAnchors } from './anchors'
import { defaultHead, templateBody } from './bodies'
import { fitItem, fitTransform, inverseTransform, toLocal } from './fit'
import { MAGIC, derivePalette, itemPalette, silhouettePalette } from './palette'
import { ellipse, fmt3, join, n, outside, tf } from './shapes'
import type {
  AnchorSet, BreedDef, BreedId, ColorwayDef, ColorwayId, FaceStyle, MagicColorwayId, Mood, Outfit, Palette, PartCtx,
  Pose, PoseXf, Pt, RigIds, SidePart, Slot, SpeciesDef, SpeciesParts, Stage, Worn,
} from './types'
import './rig.css'

export type RigMode = 'animated' | 'static'

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
  /** CSS-bredde; højden følger formatet 5:6. */
  size?: number | string
  className?: string
  style?: CSSProperties
  /** Oplæst/tilgængeligt navn. Uden titel er grafikken dekorativ. */
  title?: string
  /** Sort silhuet (silhuet-arket). */
  silhouette?: boolean
  /** Frys animationen på tidspunktet t sekunder (filmstrimler). */
  freezeAt?: number
  /** Beskæring: 'full' (standard, 200x240), 'head' (hoved og hat, til butikskort) eller 'bust'. */
  crop?: RigCrop
}

export type RigCrop = 'full' | 'head' | 'bust'
/** Højde/bredde for en beskæring. */
export function cropAspect(crop: RigCrop): number {
  const [, , w, h] = CROPS[crop].split(' ').map(Number)
  return h / w
}
/** viewBox pr. beskæring. */
export const CROPS: Record<RigCrop, string> = {
  full: '0 0 200 240',
  head: '22 0 156 156',
  bust: '10 0 180 190',
}

// ---------------------------------------------------------------------------------------------
// Poser: statisk nøgleramme pr. humør (animeret tilstand bruger keyframes i rig.css).

type Xf = PoseXf

export const POSES: Record<Mood, Pose> = {
  idle: {},
  happy: { earL: -6, earR: -6, pawL: 34, pawR: 34, tail: 12 },
  cheer: { fig: { rot: -3 }, head: { rot: -2, y: 1 }, earL: -9, earR: -4, pawL: 124, pawR: 124, tail: 14 },
  think: { head: { rot: 8, y: 3 }, earL: 6, earR: -8 },
  oops: { head: { rot: -4, y: 1.5 }, earL: -14, earR: -11, pawL: 6, pawR: 6 },
  sleep: { head: { rot: 6, y: 3 }, earL: -18, earR: -16, body: { sy: 0.985 } },
  wave: { head: { rot: -4 }, earL: -4, earR: 5, pawR: 118 },
}

const G = { x: 100, y: 226 }

/** Transform om fodpunktet (hop, ånding): translate(G) · xf · translate(−G). */
function aboutGround(x: Xf | undefined): string | undefined {
  if (!x) return undefined
  const inner = tf({ x: x.x, y: x.y, rot: x.rot, sx: x.sx, sy: x.sy })
  return inner ? `translate(${G.x} ${G.y}) ${inner} translate(${-G.x} ${-G.y})` : undefined
}

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

/** Den statiske nøglepose: riggens standard ← artens ← racens (pr. felt). */
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
      <g className={still ? undefined : cls} transform={still ? tf(pose ?? {}) : undefined}>
        {children}
      </g>
    </g>
  )
}

/** Miljøet for en render: unikt id-præfiks og (i animeret DOM) refs til pupil-tracking. */
export interface RigEnv {
  uid: string
  gazeRef?: Ref<SVGGElement>
  glintRef?: Ref<SVGGElement>
}

/** <Rig> i DOM'en: unikke id'er og pupil-tracking lægges oven på den rene render. */
export function Rig(props: RigProps) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const g = gazeInputs(props)
  const { gazeRef, glintRef } = useGaze(g.enabled, props.lookAt, g.eye, g.scale, g.fallback, g.shape)
  return rigElement(props, { uid, gazeRef, glintRef })
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
    outfit, lookAt, size, className, style, title, silhouette = false, freezeAt, crop = 'full',
  } = props
  const breed: BreedId = props.breed ?? def.breeds[0].id
  const still = mode === 'static'
  const animated = !still
  const uid = env.uid
  const ids: RigIds = { uid, bodyClip: `${uid}b`, headClip: `${uid}h`, outsideHead: `${uid}e`, gradient: `${uid}g` }
  const shadowId = `${uid}s`
  const itemClipId = `${uid}i`
  const earClipId = ids.outsideHead

  const a = modelAnchors(def, breed)
  const R = regionTransforms(a, stage)
  const w = worldAnchors(a, stage)
  const parts = resolveParts(def, breed)
  const breedDef = resolveBreed(def, breed)
  const base = resolvePalette(def, breed, colorway)
  const pal: Palette = silhouette ? silhouettePalette(base) : base
  const face = MOOD_FACE[mood]
  const faceStyle = resolveFace(def, breed)
  const mouth = face.mouth === 'idle' ? faceStyle.idleMouth : face.mouth
  const pose: Pose = still ? resolvePose(def, breed, mood) : {}
  const seed = props.seed ?? hashSeed(`${def.id}${breed}${colorway}${stage}`)

  // Stregbredder kompenseres, så konturen er 3,2 i verdensrummet på alle stadier.
  const swBody = OUTLINE / R.body.s
  const swHead = OUTLINE / R.head.s
  const ctx = (sw: number): PartCtx => ({ pal, a, stage, mood, breed, colorway, sw, ids, still })

  const bodyD = (parts.body ?? templateBody(def.body))(a, 0, stage)
  const headD = (parts.head ?? defaultHead)(a, 0, stage)
  // Indvendige klip (kontur/2 inde), så skygger og mønstre aldrig dækker konturen.
  const bodyClipD = (parts.body ?? templateBody(def.body))(a, -swBody / 2, stage)
  const headClipD = (parts.head ?? defaultHead)(a, -swHead / 2, stage)

  // Tøj
  const worn = (slot: Slot): Worn | undefined => (def.occupies?.includes(slot) ? undefined : outfit?.[slot])
  const hides = new Set(Object.values(outfit ?? {}).flatMap((x) => x?.item.hides ?? []))
  const bodyWorn = worn('body')

  const eyeMidWorld = { x: (w.eyeL.x + w.eyeR.x) / 2, y: (w.eyeL.y + w.eyeR.y) / 2 }
  const { gazeRef, glintRef } = env
  const staticGaze = still ? gazeFor(lookAt, eyeMidWorld, R.head.s) ?? MOOD_GAZE[mood] : undefined

  const renderItem = (slot: Slot, layer: 'front' | 'back', region: number, clip?: string) => {
    const wItem = worn(slot)
    if (!wItem) return null
    const item = wItem.item
    const art =
      layer === 'back'
        ? item.art.back
        : slot === 'body'
          ? (item.art.bodyShapes?.[def.body] ?? item.art.front)
          : item.art.front
    if (!art) return null
    const fit = fitItem(item, a, def)
    const c = itemPalette(item.colorways[wItem.colorway ?? 0], silhouette)
    const sw = OUTLINE / (region * fit.scale)
    return (
      <g data-item={item.id} data-slot={slot} data-layer={layer} clipPath={clip ? `url(#${clip})` : undefined}>
        <g transform={fitTransform(fit)}>
          {art({
            c, a, sw, body: def.body, earMode: fit.earMode, ids,
            local: (p) => toLocal(fit, p),
            solo: false,
            restroke: (color) => (
              <path d={bodyD} transform={inverseTransform(fit)} fill="none" stroke={color ?? c.outline} strokeWidth={n(swBody)} strokeLinejoin="round" />
            ),
          })}
        </g>
      </g>
    )
  }

  // Poter (venstre tegnes, højre spejles). Håndgenstanden ligger i højre pote under selve poten.
  const paw = (side: 'L' | 'R', Part: SidePart) => {
    const at = side === 'L' ? a.shoulderL : a.shoulderR
    const rot = side === 'L' ? pose.pawL : pose.pawR
    const handItem = side === 'R' ? worn('hand') : undefined
    let hand: ReactNode = null
    if (handItem) {
      // Håndgenstanden placeres ved pawR i modelrummet og føres ind i potens lokale (spejlede) ramme.
      hand = <g transform={`scale(-1 1) translate(${n(-at.x)} ${n(-at.y)})`}>{renderItem('hand', 'front', R.body.s)}</g>
    }
    return (
      <g transform={`translate(${n(at.x)} ${n(at.y)})${side === 'R' ? ' scale(-1 1)' : ''}`}>
        <g className={animated ? `a-paw a-paw-${side.toLowerCase()}` : undefined} transform={rot ? `rotate(${n(rot)})` : undefined}>
          {hand}
          <Part {...ctx(swBody)} side={side} />
        </g>
      </g>
    )
  }

  const ear = (side: 'L' | 'R', Part: SidePart) => {
    const at = side === 'L' ? a.earBaseL : a.earBaseR
    const splay = earRig?.splay ?? 0
    const rot = side === 'L' ? pose.earL : pose.earR
    return (
      <g transform={`translate(${n(at.x)} ${n(at.y)})${side === 'R' ? ' scale(-1 1)' : ''}${splay ? ` rotate(${n(-splay)})` : ''}`}>
        <g className={animated ? `a-ear a-ear-${side.toLowerCase()}` : undefined} transform={rot ? `rotate(${n(rot)})` : undefined}>
          <Part {...ctx(swHead)} side={side} />
        </g>
      </g>
    )
  }

  const scaled = (at: Pt, s: number, node: ReactNode) =>
    s === 1 ? node : <g transform={`translate(${n(at.x)} ${n(at.y)}) scale(${fmt3(s)}) translate(${n(-at.x)} ${n(-at.y)})`}>{node}</g>

  const Tail = parts.Tail
  const Horn = parts.Horn
  const Wings = parts.Wings
  const Ear = parts.Ear
  const earRig = breedDef?.ears ?? def.ears
  const earClip = !!Ear && !hides.has('ears') && earRig?.clip !== false
  // Klippet "uden for hovedet" defineres, når ører eller pandetot kan bruge det.
  const outsideClip = earClip || (!!parts.ManeFront && !hides.has('mane-front'))
  const P = parts.Pattern
  const pattern = resolveColorway(def, colorway).pattern ?? 'none'
  const shade = shading(a)
  const showFx = !silhouette

  // fx-positioner (verdensrum)
  // Tanker, Z'er og svedperle sidder til højre for hovedet, fri af øret.
  const fxHead = { x: w.headCenter.x + w.headRx * 0.96, y: w.headCenter.y - w.headRy * 0.5 }
  const fxSweat = { x: w.headCenter.x + w.headRx * 0.62, y: w.headCenter.y - w.headRy * 0.55 }
  const sparkle = pal.sparkle && showFx && (colorway === 'gold' || colorway === 'starwhite' || (star && stage === 3))

  // Hop må gerne gå uden for kanvasset (overflow synlig); en beskåret rig (butikskort) klipper.
  const rootStyle = {
    ...(crop !== 'full' ? { overflow: 'hidden' } : null),
    ...style,
    '--rig-t': `${(freezeAt ?? seed * 3.1).toFixed(3)}s`,
    '--blink': `${(4.3 + seed * 1.6).toFixed(2)}s`,
  } as CSSProperties

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={CROPS[crop]}
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
            <path d={outside(headClipD)} clipRule="evenodd" fillRule="evenodd" />
          </clipPath>
        )}
        {bodyWorn && (
          <clipPath id={itemClipId}>
            <path d={(parts.body ?? templateBody(def.body))(a, 2, stage)} />
          </clipPath>
        )}
        {!silhouette && <ShadowGradient id={shadowId} />}
        {pal.gradient && (
          <linearGradient id={ids.gradient} x1="0" y1="0" x2="0" y2="1">
            {pal.gradient.map((c, i) => (
              <stop key={i} offset={fmt3(i / (pal.gradient!.length - 1))} stopColor={c} />
            ))}
          </linearGradient>
        )}
      </defs>

      {/* Stjerneformens aura bag alt. */}
      {star && stage === 3 && showFx && <Aura c={{ x: w.headCenter.x, y: (w.headCenter.y + w.bodyCenter.y) / 2 }} r={86} className={animated ? 'a-aura' : undefined} />}

      {/* 1 · jordskygge */}
      {!silhouette && (
        <g transform={still && pose.shadow ? aboutGround({ sx: pose.shadow }) : undefined}>
          <GroundShadow id={shadowId} cx={G.x} cy={G.y - 1} rx={w.bodyRx * 1.18} className={animated ? 'a-shadow' : undefined} />
        </g>
      )}

      <g className={animated ? 'a-fig' : undefined} transform={aboutGround(pose.fig)}>
        {/* Krop (lag 2–9) */}
        <g transform={`translate(${n(R.body.tx)} ${n(R.body.ty)}) scale(${fmt3(R.body.s)})`}>
          <g className={animated ? 'a-body' : undefined} transform={aboutGround(pose.body)}>
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
            {/* Hovedets kastede skygge på kroppen lige under hagen (dybde, samme regel på alle stadier). */}
            {!silhouette && (
              <path d={chinShadow(a, R)} fill={pal.shade} clipPath={`url(#${ids.bodyClip})`} />
            )}
            {/* 6 · body-item (klippet til kroppen +2) */}
            {renderItem('body', 'front', R.body.s, itemClipId)}
            {/* 7–8 · hånd + poter */}
            {paw('L', parts.Paw)}
            {paw('R', parts.Paw)}
            {/* 9 · neck-item */}
            {renderItem('neck', 'front', R.body.s)}
            {renderItem('back', 'back', R.body.s)}
          </g>
        </g>

        {/* Hoved (lag 10–16) om halsleddet */}
        <g transform={`translate(${n(R.neckWorld.x)} ${n(R.neckWorld.y)}) scale(${fmt3(R.head.s)})`}>
          <g className={animated ? 'a-head' : undefined} transform={tf(pose.head ?? {})}>
            <g transform={`translate(${n(-a.neck.x)} ${n(-a.neck.y)})`}>
              {/* 10 · mane-back (+ hattens bagdel) */}
              {parts.ManeBack && scaled(a.headCenter, R.xf.mane, parts.ManeBack(ctx(swHead / R.xf.mane)))}
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
              <Mouth at={a.mouth} shape={mouth} pal={pal} sw={swHead} buckTeeth={faceStyle.buckTeeth} />
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
              {/* 13 · face-item */}
              {renderItem('face', 'front', R.head.s)}
              {/* 14 · mane-front */}
              {parts.ManeFront && !hides.has('mane-front') && scaled(a.headTop, R.xf.mane, parts.ManeFront(ctx(swHead / R.xf.mane)))}
              {/* 15 · head-item */}
              {renderItem('head', 'front', R.head.s)}
              {/* 16 · ører, horn */}
              {Ear && !hides.has('ears') && (
                <g clipPath={earClip ? `url(#${earClipId})` : undefined}>
                  {ear('L', Ear)}
                  {ear('R', Ear)}
                </g>
              )}
              {Horn && (
                <g transform={`translate(${n(a.hornBase.x)} ${n(a.hornBase.y)}) scale(${fmt3(R.xf.horn)})`}>
                  <g className={animated ? 'a-horn' : undefined}>{Horn(ctx(swHead / R.xf.horn))}</g>
                </g>
              )}
            </g>
          </g>
        </g>

        {/* 17 · fx (verdensrum) */}
        <g data-part="fx">
        {showFx && mood === 'think' && <ThoughtDots at={fxHead} s={R.head.s} sw={OUTLINE} animated={animated} />}
        {showFx && mood === 'sleep' && <Zzz at={{ x: fxHead.x - 2, y: fxHead.y + 8 }} s={R.head.s} sw={OUTLINE} animated={animated} />}
        {showFx && mood === 'oops' && <SweatDrop at={fxSweat} s={R.head.s} sw={OUTLINE} className={animated ? 'a-sweat' : undefined} />}
        {sparkle && (
          <Sparkles
            pts={around({ x: w.headCenter.x, y: (w.headCenter.y + w.bodyCenter.y) / 2 }, w.headRx + 28, [-150, -32, 200])}
            size={9 * R.head.s}
            fill={pal.sparkle!}
            stroke={pal.outline}
            sw={OUTLINE}
            className={animated ? 'a-twinkle' : undefined}
          />
        )}
        </g>
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

/** Cel-skyggens "lyse" ellipser (skyggen = kroppen minus den lyse ellipse) og hovedets højlys. */
function shading(a: AnchorSet) {
  const h = a.headCenter
  const b = a.bodyCenter
  return {
    head: ellipse(h.x - 7, h.y - 9, a.headRx * 1.02, a.headRy * 1.04),
    body: ellipse(b.x - 9, b.y - 12, a.bodyRx * 1.02, a.bodyRy * 1.06),
    gloss: join(
      ellipse(h.x - a.headRx * 0.5, h.y - a.headRy * 0.6, a.headRx * 0.2, a.headRy * 0.12, -32),
      ellipse(h.x - a.headRx * 0.2, h.y - a.headRy * 0.8, a.headRx * 0.055, a.headRy * 0.055),
    ),
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
