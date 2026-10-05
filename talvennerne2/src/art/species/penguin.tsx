// Pingvinen (Stjernefjeldet, bølge 3): skabelonen `pear`, én race (std). Artstrækkene står i silhuetten, så pingvinen
// aldrig læses som en ugle (review G2-r4-blind og integratorens for-test):
// - et glat, rundt hoved uden ører eller fjertotter, der glider over i en pæreformet krop (smal top, bred bund),
// - luffer, der stritter skråt ud fra skuldrene (uglens vinger hænger langs siden), og
// - store, flade svømmefødder med tre tæer, der stikker frem forneden.
// I farve bærer ansigtet arten: en mørk hætte med en hvid, hjerteformet ansigtsmaske, et kraftigt næb og en hvid mave.
// Kejserpingvinen (c2) har gyldne ørepletter, klippepingvinen (c3) gule fjerbryn. Lufferne er pingvinens arme: den
// hængende luffe ligger i kroppens lag, og kun spidsen tegnes på poten oven på en håndgenstand, så luffen griber om den
// (som uglens vinge, review G2-r2 B14 og SPEC A17). Signaturen er vinge-klappet: lufferne slår ud og klapper ind mod
// kroppen tre gange med et overshoot og en pause (`a-paw` i hvile, rig.css). Alle former er punkter og husets primitiver.
import { ROUND, limbLoop, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { STAGE_XF } from '../rig/anchors'
import { mixHex } from '../rig/oklch'
import { blob, bun, ellipse, join, lune, mirrorX, outside, spline, symmetric, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, PartCtx, SidePart, SpeciesDef, Stage } from '../rig/types'
import { PENGUIN_COLORWAYS } from './penguin.colorways'

const round = ROUND
/** Maskens og mavens cel-skygge: en lys tone mellem fronten og skyggen. */
const frontShade = (pal: Palette) => (pal.silhouette ? pal.fur : mixHex(pal.belly, pal.shade, 0.24))
/** Accenten (kejserens øreplet, klippepingvinens fjerbryn); mangler den, er mønsterfarven pelsen. */
const accent = (pal: Palette) => (!pal.silhouette && pal.pattern !== pal.fur ? pal.pattern : null)

// ---------------------------------------------------------------------------------------------
// Hoved: glat og rundt, en anelse smallere forneden, så det glider over i kroppen (ingen ører).

const penguinHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  bun({
    cx: a.headCenter.x,
    cy: a.headCenter.y + a.headRy * 0.08,
    rx: a.headRx + inflate,
    top: a.headRy * 1.08 + inflate,
    bottom: a.headRy * 0.92 + inflate,
    eTop: 2.15,
    eBottom: 2.05,
    taper: 0.04,
  })

/** Hovedets lyse ellipse i riggens cel-skygge (Rig.tsx `shading`): skyggen er hovedet uden for den. */
const headLit = (a: AnchorSet) => ellipse(a.headCenter.x - 7, a.headCenter.y - 9, a.headRx * 1.02, a.headRy * 1.04)

// ---------------------------------------------------------------------------------------------
// Ansigtsmasken: hvid og hjerteformet om øjnene med en mørk spids ned mellem dem, og hele vejen ned til hagen
// (lokalt om midten mellem øjnene). Den vokser med øjnene på ungen og har sin egen lyse cel-skygge.

const MASK_HALF: Vec[] = [
  [0, -7], [-5.6, -14.6], [-13.6, -19.4], [-23.4, -19.4], [-31.6, -14.4], [-36.6, -5.6], [-38.6, 5], [-37.6, 16.4], [-33, 26.6],
  [-24.6, 35], [-13, 40.6], [0, 42.6],
]
const MASK = symmetric(MASK_HALF)
const maskClip = (ids: PartCtx['ids']) => `${ids.uid}pm`

/** Kejserens ørepletter (lokalt om midten mellem øjnene, venstre side; højre spejles) og klippepingvinens fjerbryn. */
const PATCH: Vec[] = [[-30, 35], [-36.8, 28.6], [-41.8, 20.4], [-45, 10.4], [-41, 12.6], [-36, 19], [-31.4, 25.6], [-27.6, 31.4]]
const BROW: Vec[] = [
  [-10.6, -15.4], [-19, -18.2], [-27.4, -18], [-34.4, -15.6], [-40.6, -19.6], [-37.4, -12.6], [-43.4, -12.2], [-37, -8.4], [-30.4, -12.2],
  [-21.6, -14.4], [-13.4, -12.6],
]

const Face: Part = ({ pal, a, ids, stage, colorway, sw }) => {
  if (pal.silhouette) return null
  const k = 1 + (STAGE_XF[stage].eye - 1) * 0.85
  const ox = (a.eyeL.x + a.eyeR.x) / 2
  const oy = (a.eyeL.y + a.eyeR.y) / 2
  const at = (pts: readonly Vec[]) => xf(pts, { sx: k, dx: ox, dy: oy })
  const mask = blob(at(MASK), 0.9)
  const acc = accent(pal)
  const patches = acc && colorway === 'c2' ? join(blob(at(PATCH), 0.8), blob(mirrorX(at(PATCH), ox), 0.8)) : null
  const brows = acc && colorway === 'c3' ? join(blob(at(BROW), 0.7), blob(mirrorX(at(BROW), ox), 0.7)) : null
  return (
    <>
      <clipPath id={maskClip(ids)}>
        <path d={mask} />
      </clipPath>
      <path d={mask} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />
      <g clipPath={`url(#${ids.headClip})`}>
        <path d={outside(headLit(a))} fill={frontShade(pal)} fillRule="evenodd" clipPath={`url(#${maskClip(ids)})`} />
      </g>
      {patches && <path d={patches} fill={acc!} clipPath={`url(#${ids.headClip})`} />}
      {brows && <path d={brows} fill={acc!} stroke={mixHex(acc!, pal.outline, 0.5)} strokeWidth={sw * 0.4} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Næbbet: et kraftigt næb mellem øjnene, der peger nedad, med en lys overside og en midterlinje.

const BEAK: Vec[] = xf([[0, -7.4], [6.6, -6.6], [9, -3], [7.2, 2], [3.6, 6.6], [0, 9.4], [-3.6, 6.6], [-7.2, 2], [-9, -3], [-6.6, -6.6]], { sx: 0.88 })

const Beak: Part = ({ pal, sw, a, lod }) => {
  const m = a.muzzle
  return (
    <>
      <path d={blob(xf(BEAK, { dx: m.x, dy: m.y }), 0.8)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
      {!pal.silhouette && lod === 'full' && (
        <path d={spline([[m.x - 6.4, m.y - 1], [m.x, m.y + 0.8], [m.x + 6.4, m.y - 1]])} fill="none" stroke={mixHex(pal.nose, pal.outline, 0.5)} strokeWidth={sw * 0.4} {...round} />
      )}
      {!pal.silhouette && <path d={ellipse(m.x - 2.6, m.y - 3.8, 2.6, 1.4, -14)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Lufferne (pingvinens arme, lokalt om skulderen): flade, spidse luffer, der stritter skråt ud fra kroppen, med en
// lys forkant og åben kontur ved roden. Løftet bliver luffen en smal, spids vinge, der vinker.

const PAW_ROT = 38
/** Luffen lodret (roden øverst, spidsen nedad); punkterne starter og slutter ved roden. */
const FLIPPER: Vec[] = [
  [8.4, -8], [9.6, 4], [9, 16], [7, 27], [4, 37], [0.6, 44.6], [-2.6, 46.8], [-5.2, 44], [-7.4, 36], [-9.4, 24], [-10, 12], [-9.6, 1], [-7.4, -8],
]
/** Ærmet: luffen fra roden til manchetten (lodret ramme), en anelse løsere end luffen. */
const SLEEVE: Vec[] = [[-10, -10], [-12.6, 1], [-13.4, 12], [-12.8, 22], [0, 25.4], [12.4, 22], [12.6, 12], [11.8, 1], [9.6, -10], [0, -12]]

const FLIPPER_POSED = xf(FLIPPER, { rot: PAW_ROT })
const FLIPPER_D = blob(FLIPPER_POSED, 0.9)
const FLIPPER_EDGE = spline(FLIPPER_POSED.slice(1, -1), 0.9)
/** Den lyse forkant langs luffens inderside (mod kroppen). */
const FLIPPER_SHINE = spline(xf([[5.8, 2], [6.2, 14], [4.8, 26], [2.4, 35]], { rot: PAW_ROT }))
/**
 * Luffespidsen (som uglens vingespids): under denne linje (luffens egen ramme, vinkelret på luffen) tegnes spidsen på
 * poten oven på håndgenstanden, så luffen griber om den; resten af luffen ligger i kroppens lag under genstanden.
 */
const GRIP_CUT = 31
/** Klippet under spidsens kant i luffens ramme: en blød bue som en knyttet luffe (aldrig en lige kant). */
const GRIP_EDGE = `M-40 ${GRIP_CUT + 50}V${GRIP_CUT + 1}Q-5 ${GRIP_CUT - 3.6} 40 ${GRIP_CUT + 1}V${GRIP_CUT + 50}Z`

const flipperFill = (pal: Palette) => pal.fur

/** Hele den hængende luffe: fyld, lys forkant og kontur (åben ved roden). */
const FlipperShape = ({ pal, sw, lod }: Pick<PartCtx, 'pal' | 'sw' | 'lod'>) => (
  <>
    <path d={FLIPPER_D} fill={flipperFill(pal)} />
    {lod === 'full' && !pal.silhouette && <path d={FLIPPER_SHINE} fill="none" stroke={pal.highlight} strokeWidth={sw * 0.9} {...round} />}
    <path d={FLIPPER_EDGE} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
  </>
)

const gripClip = (ids: PartCtx['ids']) => `${ids.uid}fg`
const gripClipClothed = (ids: PartCtx['ids']) => `${ids.uid}fgk`

/** Luffespidsen alene (fyld og kontur, klippet i luffens ramme under `GRIP_CUT`). */
const Tip = ({ pal, sw, clip }: { pal: Palette; sw: number; clip: string }) => (
  <g transform={`rotate(${PAW_ROT})`}>
    <path d={blob(FLIPPER, 0.9)} fill={flipperFill(pal)} stroke={pal.outline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${clip})`} />
  </g>
)

/**
 * Luffespidsen over håndgenstanden, når pingvinen bærer kropstøj (SPEC A17, `handOverSleeve`): riggen lægger genstanden
 * over den hængende luffe og ærmet og tegner så denne del, så spidsen stadig griber om genstanden.
 */
const FlipperGrip: SidePart = ({ pal, sw, ids }) => (
  <>
    <clipPath id={gripClipClothed(ids)}>
      <path d={GRIP_EDGE} />
    </clipPath>
    <Tip pal={pal} sw={sw} clip={gripClipClothed(ids)} />
  </>
)

/**
 * Den hængende luffe på poten. Uden kropstøj ligger luffen selv i kroppens lag (`FlipperBodies`), og poten tegner kun
 * spidsen oven på en håndgenstand. Med kropstøj tegnes hele luffen her under ærmet, og genstanden lægges ovenpå.
 */
const Paw: SidePart = (p) => (p.clothed ? <FlipperShape {...p} /> : <Tip pal={p.pal} sw={p.sw} clip={gripClip(p.ids)} />)

/**
 * Lufferne i kroppens lag (under kropstøjet og håndgenstanden, over kroppen): hver hvilende luffe i potens egen ramme
 * og med potens animationsklasser, så luffe og spids følges ad (også i vinge-klappet). Spidsens klip defineres her.
 */
const FlipperBodies: Part = (p) => {
  if (p.clothed) return null
  const sides = (['L', 'R'] as const).filter((s) => {
    const pp = s === 'L' ? p.pose.pawL : p.pose.pawR
    return !(typeof pp === 'object' && pp.up)
  })
  return (
    <>
      <clipPath id={gripClip(p.ids)}>
        <path d={GRIP_EDGE} />
      </clipPath>
      {sides.map((s) => {
        const pp = s === 'L' ? p.pose.pawL : p.pose.pawR
        const rot = typeof pp === 'number' ? pp : (pp?.rot ?? 0)
        const at = s === 'L' ? p.a.shoulderL : p.a.shoulderR
        const place = `translate(${at.x} ${at.y})${s === 'R' ? ' scale(-1 1)' : ''}`
        return p.still ? (
          <g key={s} transform={`${place}${rot ? ` rotate(${rot})` : ''}`}>
            <FlipperShape {...p} />
          </g>
        ) : (
          <g key={s} transform={place}>
            <g className={`a-paw a-paw-${s.toLowerCase()}`} transform={rot ? `rotate(${rot})` : undefined}>
              <FlipperShape {...p} />
            </g>
          </g>
        )
      })}
    </>
  )
}

/** Løftede luffer (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[8, 4], [1, -4], [-8, -13], [-16, -23], [-22, -33]] as Vec[],
  wave: [[9, 4], [-1, -1], [-11, -7], [-19, -15], [-23, -26], [-24, -37]] as Vec[],
  // Tænker: luffespidsen under næbbet.
  think: [[8, 6], [15, 0], [21, -6], [25, -12]] as Vec[],
  // Ups: luffen op til kinden (genert "hov"), tungen ude.
  oops: [[8, 6], [9, -4], [10, -13], [10.5, -20], [10, -26]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 18, w1: 9 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')
/** Den lyse forkant langs den løftede luffe (fra midten mod spidsen). */
const upShine = (s: readonly Vec[]) => spline(xf(s.slice(Math.max(1, Math.floor(s.length / 2) - 1)), { dx: 2.2, dy: 1.2 }))

const PawUp: SidePart = ({ pal, sw, mood, lod }) => {
  const kind = kindOf(mood)
  const loop = UP_LOOPS[kind]
  return (
    <>
      <path d={blob(loop)} fill={flipperFill(pal)} />
      {lod === 'full' && !pal.silhouette && <path d={upShine(UP_SPINES[kind])} fill="none" stroke={pal.highlight} strokeWidth={sw * 0.9} {...round} />}
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    </>
  )
}

/** Fyld bag alt ved lufferne (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

// ---------------------------------------------------------------------------------------------
// Fronten (efter kroppens skygge, før kropstøjet): den hvide mave med sin egne lyse cel-skygge (kroppens mørke
// skyggehalvmåne ville ellers skære ind i den hvide mave), og de store svømmefødder foran kroppen.

const bellyOf = (a: AnchorSet) => ({ cx: a.bodyCenter.x, cy: a.bodyCenter.y + 9, rx: a.bodyRx * 0.74, ry: a.bodyRy * 0.82 })

/** Svømmefoden (venstre; højre spejles) i modelrummet: hælen under kroppen, tre runde tæer, der peger ud og frem. */
const FOOT: Vec[] = [
  [93, 214.6], [86, 214.2], [78.6, 216], [71.6, 219.6], [67.4, 223.6], [68.6, 227.2], [72.6, 226.6], [75, 229.4], [79.6, 228],
  [82.6, 230.4], [87, 228.6], [92.4, 227.4], [95.4, 222.4],
]
const WEBS: Vec[][] = [[[88, 218.6], [80, 223.2], [75.6, 226.2]], [[89.6, 219.4], [85, 225], [83.4, 228]]]
const FOOT_D = join(blob(FOOT, 0.82), blob(mirrorX(FOOT, 100), 0.82))
const WEBS_D = join(...[...WEBS, ...WEBS.map((w) => mirrorX(w, 100))].map((w) => spline(w)))

const Front: Part = ({ pal, sw, a, ids, lod }) => {
  const b = bellyOf(a)
  return (
    <>
      <path d={ellipse(b.cx, b.cy, b.rx, b.ry)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      {!pal.silhouette && <path d={lune(b.cx, b.cy, b.rx, b.ry, b.rx * 0.2, -28, 118)} fill={frontShade(pal)} clipPath={`url(#${ids.bodyClip})`} />}
      <path d={FOOT_D} fill={pal.inner} stroke={pal.outline} strokeWidth={sw * 0.8} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={WEBS_D} fill="none" stroke={mixHex(pal.inner, pal.outline, 0.45)} strokeWidth={sw * 0.45} {...round} />}
    </>
  )
}

/** Bag kroppen: intet (pingvinens korte hale er gemt bag den siddende krop). */
const Feet: Part = () => null

// ---------------------------------------------------------------------------------------------

export const penguin: SpeciesDef = {
  id: 'penguin',
  name: 'Pingvin',
  nameClip: 'name.species.penguin',
  family: 'bird',
  body: 'pear',
  breeds: [{ id: 'std', name: 'pingvin' }],
  colorways: PENGUIN_COLORWAYS,
  magic: ['gold', 'rainbow'],
  // Med kropstøj tegnes hele luffen og ærmet på poten, så håndgenstanden lægges oven på dem, og spidsen griber om den
  // (SPEC A17, `FlipperGrip`); uden kropstøj griber spidsen den foran luffen (se `Paw`). Løftede luffer som før.
  handOverSleeve: FlipperGrip,
  anchors: {
    headCenter: { x: 100, y: 98 },
    headRx: 47,
    headRy: 43,
    headTop: { x: 100, y: 55 },
    headWidth: 96,
    // Ingen ører: ørebaserne er virtuelle og styrer kun, hvor bred en hat mellem ørerne må være.
    earBaseL: { x: 74, y: 64 },
    earBaseR: { x: 126, y: 64 },
    hornBase: { x: 100, y: 57 },
    eyeL: { x: 81, y: 98 },
    eyeR: { x: 119, y: 98 },
    eyeRx: 9.8,
    eyeRy: 12.2,
    muzzle: { x: 100, y: 115 },
    mouth: { x: 100, y: 128.5 },
    cheekL: { x: 68, y: 114 },
    cheekR: { x: 132, y: 114 },
    neck: { x: 100, y: 142 },
    neckWidth: 56,
    bodyCenter: { x: 100, y: 180 },
    bodyRx: 52,
    bodyRy: 46,
    bodyWidth: 104,
    chest: { x: 100, y: 162 },
    back: { x: 100, y: 164 },
    shoulderL: { x: 68, y: 150 },
    shoulderR: { x: 132, y: 150 },
    pawL: { x: 42, y: 182 },
    pawR: { x: 158, y: 182 },
    handRot: -20,
    footL: { x: 82, y: 222 },
    footR: { x: 118, y: 222 },
    tailBase: { x: 100, y: 222 },
  },
  bounds: {
    head: { x0: 44, y0: 46, x1: 156, y1: 146 },
    body: { x0: 18, y0: 128, x1: 182, y1: 231 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden med mindst 8 enheders luft.
  fx: { x: 168, y: 112 },
  face: { idleMouth: 'smile', cheeks: true },
  signature: 'wing-clap',
  // Guldets glansbånd på kroppens venstre flanke over luffen.
  goldBand: [196, 236],
  // Ups: luffen op til kinden (luffen når ikke om bag nakken).
  poses: {
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: penguinHead,
    Paw,
    PawUp,
    PawBack: pawWebs({}, PAW_WEBS),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 7 }])),
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 22, half: 12.6 } },
    Feet,
    Muzzle: Beak,
    HeadDeco: Face,
    // Maven, fødderne og (uden kropstøj) de hængende luffer under håndgenstanden.
    Ruff: (p) => (
      <>
        {Front(p)}
        {FlipperBodies(p)}
      </>
    ),
  },
}

export default penguin
