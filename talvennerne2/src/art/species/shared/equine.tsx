// Fælles dele til hest og enhjørning (skabelonen `tall`): det lange hoved med mule, bladformede
// ører, forben med hove (åben kontur ved brystet), løftede forben, lårbuler med baghove, manke,
// pandelok og hale bygget af lokker, samt hestens aftegninger (blis, æbleskimmel, broget).
// Manken er ét path af flere lokker, så lokkernes konturer selv tegner hårets fald (ingen ekstra
// streger). Hestens signatur (manke-kast) pakker manken i en pivot med klassen `a-toss`.
import type { ReactNode } from 'react'
import { OpenLimb, ROUND, hatted, limbLoop } from '../../parts/kit'
import { Pivot } from '../../rig/Rig'
import { outlineOf, shadeOf } from '../../rig/palette'
import { blob, ellipse, frame, join, mirrorX, offsetLoop, ribbon, spline, star, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, Stage } from '../../rig/types'

export const round = ROUND

// ---------------------------------------------------------------------------------------------
// Ankre (stadie 2, skabelonen tall): hovedet er et "jordnøddeformet" kranium med mule forneden.

export const EQUINE_ANCHORS: Partial<AnchorSet> = {
  headCenter: { x: 100, y: 86 },
  headRx: 48,
  headRy: 42,
  headTop: { x: 100, y: 44 },
  headWidth: 96,
  earBaseL: { x: 71, y: 54 },
  earBaseR: { x: 129, y: 54 },
  hornBase: { x: 100, y: 55 },
  eyeL: { x: 76.5, y: 92 },
  eyeR: { x: 123.5, y: 92 },
  eyeRx: 10.4,
  eyeRy: 12.6,
  muzzle: { x: 100, y: 131 },
  mouth: { x: 100, y: 141.5 },
  cheekL: { x: 63, y: 109 },
  cheekR: { x: 137, y: 109 },
  neck: { x: 100, y: 142 },
  neckWidth: 50,
  bodyCenter: { x: 100, y: 182 },
  bodyRx: 41,
  bodyRy: 44,
  bodyWidth: 82,
  chest: { x: 100, y: 162 },
  back: { x: 100, y: 162 },
  shoulderL: { x: 87.5, y: 168 },
  shoulderR: { x: 112.5, y: 168 },
  pawL: { x: 88, y: 220 },
  pawR: { x: 112, y: 220 },
  footL: { x: 60, y: 220 },
  footR: { x: 140, y: 220 },
  tailBase: { x: 140, y: 190 },
}

// ---------------------------------------------------------------------------------------------
// Hoved: bredt kranium, en blød talje under kinderne og en rund mule forneden.

const HEAD_HALF: Vec[] = [
  [0, -1.0], [-0.4, -0.965], [-0.72, -0.8], [-0.93, -0.52], [-1.01, -0.16], [-0.98, 0.2], [-0.88, 0.48],
  [-0.77, 0.7], [-0.72, 0.92], [-0.73, 1.12], [-0.65, 1.3], [-0.43, 1.43], [0, 1.48],
]
const HEAD_UNIT = symmetric(HEAD_HALF)
export const equineHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_UNIT, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate))

// ---------------------------------------------------------------------------------------------
// Ører: blade med spids, let udadvendte.

const EAR: Vec[] = [
  [0, 10], [-8, 7], [-11.2, -2], [-11.6, -12], [-9.2, -22], [-4.8, -29.6], [-0.8, -33.2], [1.8, -31.4], [5.2, -24.4],
  [7.8, -14.4], [8.8, -3.4], [7, 6],
]
const EAR_INNER: Vec[] = [
  [0, -1.6], [-6, -4.2], [-6.7, -12], [-4.8, -20.4], [-1.8, -25.8], [0.9, -24.2], [3.4, -17.2], [4.4, -8.4], [3.8, -2.8],
]
const EAR_HATTED = hatted(EAR, -4, 4.5)

export const EquineEar: SidePart = ({ pal, sw, stage, hat }) => {
  const s = stage === 1 ? { sx: 1.08, sy: 1.04 } : {}
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s))} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(xf(EAR_INNER, s))} fill={pal.inner} />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Hove: en afrundet trapez (bredest forneden). Løftede hove viser sålen med en lys hestesko.

export const hoofColor = (pal: Palette) => pal.hoof ?? shadeOf(pal.mane)
export const hoofLine = (pal: Palette) => pal.outline

/** Hoven om (cx, top) med bredde w og højde h, drejet `rot` grader om toppen. */
export function hoof(cx: number, top: number, w: number, h: number, rot = 0): string {
  const pts: Vec[] = [
    [cx - w * 0.42, top], [cx - w * 0.47, top + h * 0.4], [cx - w * 0.5, top + h * 0.85], [cx - w * 0.36, top + h],
    [cx, top + h * 1.04], [cx + w * 0.36, top + h], [cx + w * 0.5, top + h * 0.85], [cx + w * 0.47, top + h * 0.4],
    [cx + w * 0.42, top],
  ]
  return blob(rot ? xf(pts, { rot, about: [cx, top] }) : pts, 0.8)
}

// ---------------------------------------------------------------------------------------------
// Forben (lokalt om skulderen): buttet søjle fra brystet ned til jorden; hoven forneden.

const LEG_SPINE: Vec[] = [[0, -6], [0.2, 9], [0.4, 24], [0.6, 38], [0.8, 46]]
const LEG = limbLoop(LEG_SPINE, 15.5, 14.5, 6)
/** Ærmet: forbenet fra brystet til manchetten over knæet (lodret ramme). */
const LEG_SLEEVE: Vec[] = [[-9, -8], [-9.2, 6], [-9, 20], [0, 21.4], [9, 20], [9.2, 6], [9, -8], [0, -10]]
export const EQUINE_LIMB = { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 20, half: 10.2 } }

/** Benets længde pr. race (shetlands korte ben er en kortere søjle; skulderen flyttes ned). */
export function makeLeg(k = 1): SidePart {
  const spine = LEG_SPINE.map(([x, y]) => [x, y * k] as Vec)
  const loop = limbLoop(spine, 15.5, 14.5, 6)
  const bottom = spine[spine.length - 1][1]
  return ({ pal, sw }) => (
    <OpenLimb loop={k === 1 ? LEG : loop} fill={pal.fur} stroke={pal.outline} sw={sw} trim={1}>
      <path d={hoof(0.8, bottom - 2, 17.5, 10.6)} fill={hoofColor(pal)} stroke={hoofLine(pal)} strokeWidth={sw} {...round} />
    </OpenLimb>
  )
}

/** Løftede forben (roden højere oppe på brystet). Jubel: V; vink: bøjet knæ; tænker/ups: hoven til hagen. */
const UP_SPINES = {
  cheer: [[1, -4], [-6, -14], [-14, -25], [-22, -36], [-28, -46]] as Vec[],
  wave: [[2, -4], [-9, -9], [-21, -12], [-30, -20], [-33, -33], [-33, -45]] as Vec[],
  think: [[-1, -4], [5, -13], [10, -21], [13, -28]] as Vec[],
  oops: [[-2, -4], [-4, -14], [-6, -24], [-6.5, -33]] as Vec[],
}
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, v]) => [k, limbLoop(v, 15, 15, 6)])) as Record<keyof typeof UP_SPINES, Vec[]>
export const EQUINE_UP_TIP = { cheer: { x: -28, y: -46 }, wave: { x: -33, y: -45 }, think: { x: 13, y: -28 }, oops: { x: -6.5, y: -33 } }

export const EquineLegUp: SidePart = ({ pal, sw, mood }) => {
  const kind = mood === 'wave' ? 'wave' : mood === 'think' ? 'think' : mood === 'oops' ? 'oops' : 'cheer'
  const spine = UP_SPINES[kind]
  const [tx, ty] = spine[spine.length - 1]
  const [px, py] = spine[spine.length - 2]
  // Hoven sidder for enden af benet i benets retning; ved jubel og vink vender sålen mod os.
  const l = Math.hypot(tx - px, ty - py) || 1
  const dir: Vec = [(tx - px) / l, (ty - py) / l]
  const ang = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI - 90
  const start: Vec = [tx - dir[0] * 3, ty - dir[1] * 3]
  const sole = kind === 'cheer' || kind === 'wave'
  return (
    <OpenLimb loop={UP_LOOPS[kind]} fill={pal.fur} stroke={pal.outline} sw={sw}>
      <path d={hoof(start[0], start[1], 17, 10.4, ang)} fill={hoofColor(pal)} stroke={hoofLine(pal)} strokeWidth={sw} {...round} />
      {sole && !pal.silhouette && <path d={ellipse(start[0] + dir[0] * 5.6, start[1] + dir[1] * 5.6, 4.6, 3.2, ang)} fill={pal.belly} opacity={0.7} />}
    </OpenLimb>
  )
}

// ---------------------------------------------------------------------------------------------
// Bagben: kraftige lårbuler og baghove, der titter frem forrest.

const HAUNCH = { cx: 61, cy: 203, rx: 20.5, ry: 19.5, rot: -20 }

export function makeFeet(k = 1): Part {
  return ({ pal, sw, stage }) => {
    const g = stage === 3 ? 1.06 : 1
    const h = HAUNCH
    const haunches = join(ellipse(h.cx, h.cy, h.rx * k * g, h.ry * k * g, h.rot), ellipse(200 - h.cx, h.cy, h.rx * k * g, h.ry * k * g, -h.rot))
    const hooves = join(hoof(52, 214.6, 16.5 * g, 10.4 * g, 8), hoof(148, 214.6, 16.5 * g, 10.4 * g, -8))
    return (
      <>
        <path d={haunches} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
        <path d={hooves} fill={hoofColor(pal)} stroke={hoofLine(pal)} strokeWidth={sw} {...round} />
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Mule: lys oval forneden med næsebor (to skrå dråber) – munden tegnes af huset.

export function makeMuzzle(w = 1): Part {
  return ({ pal, a, ids }) => {
    const m = a.muzzle
    const nost = join(ellipse(m.x - 10.5 * w, m.y - 0.5, 2.6, 3.9, 24), ellipse(m.x + 10.5 * w, m.y - 0.5, 2.6, 3.9, -24))
    return (
      <>
        {!pal.silhouette && <path d={ellipse(m.x, m.y + 1.5, 30 * w, 16)} fill={pal.muzzle ?? pal.belly} clipPath={`url(#${ids.headClip})`} />}
        {!pal.silhouette && <path d={nost} fill={pal.outline} opacity={0.82} />}
      </>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Hår: manke, pandelok og hale af lokker. `locks` er en liste af rygrade med bredder; hver lok
// bliver et lukket bånd med spids ende, og alle lokker samles i ét path.

export interface Lock {
  spine: Vec[]
  widths: number[]
}

export const lockPath = (locks: readonly Lock[]) => join(...locks.map((l) => blob(ribbon(l.spine, l.widths), 0.9)))

export const hairFill = (pal: Palette, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : pal.mane)

/**
 * En hårdel tegnet som én kontur med lokkespidser (`contour`), hårstrå som bløde linjer i en mørkere
 * tone (`strands`) og evt. en stribe i mane2 (fjordhestens mørke midte, enhjørningens striber).
 */
export function hairShape(
  contour: readonly Vec[] | readonly (readonly Vec[])[],
  opts: { strands?: readonly Vec[][]; stripe?: readonly Vec[]; pivot?: { at: Vec; cls: string }; tension?: number } = {},
): Part {
  const loops = (Array.isArray(contour[0]?.[0]) ? contour : [contour]) as readonly (readonly Vec[])[]
  const d = join(...loops.map((l) => blob(l, opts.tension ?? 0.82)))
  const strands = opts.strands ? join(...opts.strands.map((st) => spline(st))) : null
  const stripe = opts.stripe ? blob(opts.stripe, 0.82) : null
  return ({ pal, sw, ids, still, lod }) => {
    const body: ReactNode = (
      <>
        <path d={d} fill={hairFill(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
        {stripe && pal.mane2 && !pal.gradient && !pal.silhouette && <path d={stripe} fill={pal.mane2} />}
        {strands && lod === 'full' && !pal.silhouette && (
          <path d={strands} fill="none" stroke={pal.maneOutline} strokeOpacity={0.35} strokeWidth={sw * 0.5} {...round} />
        )}
      </>
    )
    if (!opts.pivot) return body
    const [px, py] = opts.pivot.at
    return (
      <Pivot at={{ x: px, y: py }} cls={opts.pivot.cls} still={still}>
        <g transform={`translate(${-px} ${-py})`}>{body}</g>
      </Pivot>
    )
  }
}

/** En hårdel (manke eller pandelok): lokkerne i manens farve med en evt. stribe i mane2. */
export function hairPart(locks: readonly Lock[], opts: { stripe?: readonly Lock[]; pivot?: { at: Vec; cls: string } } = {}): Part {
  const d = lockPath(locks)
  const stripe = opts.stripe ? lockPath(opts.stripe) : null
  return ({ pal, sw, ids, still }) => {
    const body: ReactNode = (
      <>
        <path d={d} fill={hairFill(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
        {stripe && pal.mane2 && !pal.gradient && !pal.silhouette && <path d={stripe} fill={pal.mane2} />}
      </>
    )
    if (!opts.pivot) return body
    // Pivot: lokale koordinater om pivotpunktet (lokkerne flyttes ind i rammen).
    const [px, py] = opts.pivot.at
    return (
      <Pivot at={{ x: px, y: py }} cls={opts.pivot.cls} still={still}>
        <g transform={`translate(${-px} ${-py})`}>{body}</g>
      </Pivot>
    )
  }
}

// ---------------------------------------------------------------------------------------------
// Hestens aftegninger: blis (fuks), stjerne (sort), æbleskimmel (skimmel) og brogede plader.

/** Blis: en hvid stribe fra panden ned over næseryggen til mulen (lokalt om hovedets centrum, enhed). */
const BLAZE: Vec[] = [[0, -0.86], [-0.12, -0.7], [-0.1, -0.2], [-0.08, 0.4], [-0.18, 0.9], [0, 1.0], [0.18, 0.9], [0.08, 0.4], [0.1, -0.2], [0.12, -0.7]]

export const BlazeHead: Part = ({ pal, a, ids, colorway }) => {
  const c = a.headCenter
  // Sort: kun en lille stjerne i panden; fuks: en hel blis.
  const d = colorway === 'c3' ? star(c.x, c.y - a.headRy * 0.5, 8, 3.4, 4) : blob(frame(BLAZE, c.x, c.y, a.headRx, a.headRy), 0.9)
  return <path d={d} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
}

/** Æbleskimmel: ringe af lysere pels på krop og lår (én path). */
const DAPPLES: Vec[] = [
  [-0.6, -0.1], [-0.25, 0.05], [0.15, -0.05], [0.55, 0.0], [-0.45, 0.35], [-0.05, 0.38], [0.38, 0.33], [-0.72, 0.62], [0.72, 0.6],
  [-0.2, 0.7], [0.22, 0.72], [0.0, -0.4], [-0.45, -0.45], [0.45, -0.45],
]
export const DappleBody: Part = ({ pal, a, ids }) => {
  const b = a.bodyCenter
  const d = join(...DAPPLES.map(([u, v], i) => ellipse(b.x + u * a.bodyRx, b.y + v * a.bodyRy, 4.6 + (i % 3), 3.8 + (i % 2))))
  return <path d={d} fill={pal.pattern} clipPath={`url(#${ids.bodyClip})`} />
}

/** Broget: en plade over venstre øje og øre og store plader på kroppen. */
const PINTO_HEAD: Vec[] = [[-1.1, -0.9], [-0.4, -1.1], [-0.1, -0.7], [-0.16, -0.1], [-0.5, 0.25], [-1.05, 0.15]]
const PINTO_BODY_A: Vec[] = [[-1.1, -0.5], [-0.4, -0.7], [-0.1, -0.2], [-0.35, 0.35], [-1.1, 0.5]]
const PINTO_BODY_B: Vec[] = [[1.1, -0.1], [0.55, 0.05], [0.4, 0.5], [0.75, 0.95], [1.1, 0.9]]

export const PintoHead: Part = ({ pal, a, ids }) => (
  <path d={blob(frame(PINTO_HEAD, a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), 0.9)} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
)
export const PintoBody: Part = ({ pal, a, ids }) => (
  <path
    d={join(blob(frame(PINTO_BODY_A, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx, a.bodyRy), 0.9), blob(frame(PINTO_BODY_B, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx, a.bodyRy), 0.9))}
    fill={pal.pattern}
    clipPath={`url(#${ids.bodyClip})`}
  />
)

/** Mønster pr. colorway (hestens c1 blis, c2 æbleskimmel, c3 stjerne, c5 broget). */
export const HorsePatternHead: Part = (p) => (p.colorway === 'c5' ? PintoHead(p) : p.colorway === 'c1' || p.colorway === 'c3' ? BlazeHead(p) : null)
export const HorsePatternBody: Part = (p) => (p.colorway === 'c5' ? PintoBody(p) : p.colorway === 'c2' ? DappleBody(p) : null)

// ---------------------------------------------------------------------------------------------
// Fjordhestens blakkede tone: pelsen blandes mod creme, manken bliver tofarvet (lys med mørk stribe).

export function dunPalette(mix: (a: string, b: string, t: number) => string, cream: string, dark: string) {
  return (p: Palette): Palette => {
    if (p.silhouette || p.gradient) return p
    const fur = mix(p.fur, cream, 0.42)
    return {
      ...p,
      fur,
      earFur: fur,
      shade: shadeOf(fur),
      outline: outlineOf(mix(p.fur, dark, 0.35)),
      earOutline: outlineOf(mix(p.fur, dark, 0.35)),
      maneOutline: outlineOf(mix(p.fur, dark, 0.35)),
      mane: mix(fur, cream, 0.7),
      mane2: mix(p.mane, dark, 0.55),
    }
  }
}

export const stageScale = (stage: Stage, s1: number, s3: number) => (stage === 1 ? s1 : stage === 3 ? s3 : 1)

/** Flyt punkter lodret (racer, hvis hoved sidder højere eller lavere). */
export const dy = (pts: readonly Vec[], d: number): Vec[] => pts.map(([x, y]) => [x, y + d] as Vec)

export { mirrorX }
