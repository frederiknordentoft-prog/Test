// Pingvinen (Stjernefjeldet, bølge 3): skabelonen `pear`, én race (std). Artstrækkene står i silhuetten, så pingvinen
// aldrig læses som en ugle eller en fugleunge (review G2-r4-blind og integratorens to blinde for-test):
// - hovedet er vendt en trekvart mod venstre, så næbbet stikker ud af omridset som en tydelig spids,
// - en høj bowlingkegle-krop (smal top, bred bund), hvor det glatte hoved uden ører glider over i kroppen,
// - lange luffer, der hænger nedad og udad, store svømmefødder under maven og en lille spids hale bagtil.
// I farve bærer ansigtet arten: en mørk hætte med en hvid ansigtsmaske, et kraftigt næb og en hvid mave.
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
  [0, -6], [-4, -13.4], [-10.4, -18.6], [-18.8, -19.2], [-26, -14.6], [-30.6, -6], [-32.4, 5], [-31.4, 16.4], [-27.4, 26.6],
  [-20.6, 34.6], [-11, 40], [0, 42],
]
/** Masken følger trekvart-vendingen: den vender lidt mod venstre (smallere på den fjerne side). */
const MASK = symmetric(MASK_HALF).map(([x, y]) => [x < 0 ? x * 1.04 : x * 1.1, y] as Vec)
const maskClip = (ids: PartCtx['ids']) => `${ids.uid}pm`

/** Kejserens ørepletter (lokalt om midten mellem øjnene, venstre side; højre spejles) og klippepingvinens fjerbryn. */
const PATCH: Vec[] = [[-25, 35], [-31.8, 28.6], [-36.8, 20.4], [-40, 10.4], [-36, 12.6], [-31, 19], [-26.4, 25.6], [-22.6, 31.4]]
const BROW: Vec[] = [
  [-7.6, -15.4], [-15, -18.2], [-22.4, -18], [-28.4, -15.6], [-34.6, -19.6], [-31.4, -12.6], [-37.4, -12.2], [-31, -8.4], [-25.4, -12.2],
  [-17.6, -14.4], [-10.4, -12.6],
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
// Næbbet (trekvart): et langt, kraftigt næb, der går fra ansigtet ud til venstre og en anelse nedad og stikker ud af
// hovedets omrids som en tydelig spids (også i sort silhuet). Lokalt om næbbets rod (`muzzle`): en lys overside, en
// næbspalte og et lille højlys.

const BEAK: Vec[] = [
  [8, -8.4], [0, -9.4], [-10, -8.2], [-19.6, -5.6], [-28, -2], [-34, 2], [-37.4, 6.2], [-36.4, 9.2], [-31, 8.4], [-22, 8.6],
  [-12, 9.6], [-2, 10], [6.6, 8.4], [10.4, 0.6],
]
/** Næbspalten og næbryggen (den mørkere overkant, så næbbet læses som et fuglenæb og ikke som en gulerod). */
const BEAK_SLIT: Vec[] = [[4, 2.4], [-8, 2.6], [-20, 3.6], [-31, 6.2]]
const BEAK_RIDGE: Vec[] = [[4, -7.6], [-8, -7.4], [-19, -4.6], [-28.6, -0.6], [-34.6, 4]]

const Beak: Part = ({ pal, sw, a, lod }) => {
  const m = a.muzzle
  const at = (pts: readonly Vec[]) => xf(pts, { dx: m.x, dy: m.y })
  return (
    <>
      <path d={blob(at(BEAK), 0.82)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.6} {...round} />
      {!pal.silhouette && lod === 'full' && (
        <path d={join(spline(at(BEAK_SLIT)), spline(at(BEAK_RIDGE)))} fill="none" stroke={mixHex(pal.nose, pal.outline, 0.5)} strokeWidth={sw * 0.42} {...round} />
      )}
      {!pal.silhouette && <path d={ellipse(m.x - 9, m.y - 3.2, 7, 1.6, 10)} fill={pal.highlight} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Lufferne (pingvinens arme, lokalt om skulderen): flade, spidse luffer, der stritter skråt ud fra kroppen, med en
// lys forkant og åben kontur ved roden. Løftet bliver luffen en smal, spids vinge, der vinker.

const PAW_ROT = 42
/** Luffen lodret (roden øverst, spidsen nedad); punkterne starter og slutter ved roden. */
const FLIPPER: Vec[] = [
  [8.4, -3], [9.8, 7], [9.4, 19], [7.6, 31], [4.6, 42.4], [0.8, 52.4], [-2.6, 55.6], [-5.4, 52.4], [-7.8, 42.4], [-9.8, 29.4], [-10.4, 15],
  [-9.8, 4], [-7.4, -3],
]
/** Ærmet: luffen fra roden til manchetten (lodret ramme), en anelse løsere end luffen. */
const SLEEVE: Vec[] = [[-10, -6], [-12.6, 3], [-13.4, 13], [-12.8, 22], [0, 25.4], [12.4, 22], [12.6, 13], [11.8, 3], [9.6, -6], [0, -8]]

const FLIPPER_POSED = xf(FLIPPER, { rot: PAW_ROT })
const FLIPPER_D = blob(FLIPPER_POSED, 0.9)
const FLIPPER_EDGE = spline(FLIPPER_POSED.slice(1, -1), 0.9)
/** Den lyse forkant langs luffens inderside (mod kroppen). */
const FLIPPER_SHINE = spline(xf([[6, 6], [6.6, 18], [5.4, 30], [2.8, 42]], { rot: PAW_ROT }))
/**
 * Luffespidsen (som uglens vingespids): under denne linje (luffens egen ramme, vinkelret på luffen) tegnes spidsen på
 * poten oven på håndgenstanden, så luffen griber om den; resten af luffen ligger i kroppens lag under genstanden.
 */
const GRIP_CUT = 38
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
  cheer: [[3, 0], [-5, -8], [-14, -17], [-23, -26], [-30, -36]] as Vec[],
  wave: [[4, 0], [-6, -5], [-16, -11], [-25, -19], [-30, -30], [-31, -41]] as Vec[],
  // Tænker: luffespidsen under næbbet.
  think: [[3, 2], [11, -4], [18, -10], [23, -16]] as Vec[],
  // Ups: luffen op til kinden (genert "hov"), tungen ude.
  oops: [[3, 2], [4, -8], [5, -17], [5.5, -24], [5, -30]] as Vec[],
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

/**
 * Lommerne i nøgleposerne (review G2-r1 §1.4 og §5): pels i skyggetone bag alt mellem løftet luffe og kind eller
 * krop, så der aldrig ses baggrund inde i figuren. Kun i stillbilleder (album, butik og kontaktark): i animationen åbner
 * og lukker lommerne, mens luffen bevæger sig, så et fast fyld ville ses mod baggrunden dér. Hylstrene er målt på
 * magenta (4 px pr. enhed, sprækker under 2,6 enheder lukket, udvidet 1,2 enheder) i skulderens ramme (højre side
 * spejlet) pr. race, stadie, humør og side.
 */
const KEY_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  std: {
    1: {
      idle: { L: [[[-35, 41.6], [-34.8, 40.7], [-34.1, 40], [-33.2, 39.8], [-32.4, 39.8], [-31.5, 40], [-30.9, 40.7], [-30.6, 41.6], [-30.6, 42.8], [-30.9, 43.7], [-31.5, 44.3], [-32.4, 44.6], [-32.8, 44.6], [-33.7, 44.3], [-34.8, 43.3], [-35, 42.4]], [[-35, 41.6], [-34.8, 40.7], [-34.1, 40], [-33.2, 39.8], [-32.4, 39.8], [-31.5, 40], [-30.9, 40.7], [-30.6, 41.6], [-30.6, 42.8], [-30.9, 43.7], [-31.5, 44.3], [-32.4, 44.6], [-32.8, 44.6], [-33.7, 44.3], [-34.8, 43.3], [-35, 42.4]]], R: [[[-30.6, 41.6], [-30.9, 40.7], [-31.5, 40], [-32.4, 39.8], [-33.2, 39.8], [-34.1, 40], [-34.8, 40.7], [-35, 41.6], [-35, 42.4], [-34.8, 43.3], [-33.7, 44.3], [-32.8, 44.6], [-32.4, 44.6], [-31.5, 44.3], [-30.9, 43.7], [-30.6, 42.8]], [[-30.6, 41.6], [-30.9, 40.7], [-31.5, 40], [-32.4, 39.8], [-33.2, 39.8], [-34.1, 40], [-34.8, 40.7], [-35, 41.6], [-35, 42.4], [-34.8, 43.3], [-33.7, 44.3], [-32.8, 44.6], [-32.4, 44.6], [-31.5, 44.3], [-30.9, 43.7], [-30.6, 42.8]]] },
      happy: { L: [[-32.7, 19.6], [-32.5, 18.7], [-31.8, 18], [-30.9, 17.8], [-29.8, 17.8], [-28.9, 18], [-28.2, 18.7], [-27.9, 19.6], [-27.9, 20.7], [-28.2, 21.6], [-28.9, 22.3], [-29.8, 22.5], [-30.2, 22.5], [-31.1, 22.3], [-32.5, 20.9], [-32.7, 20]], R: [[-27.9, 19.6], [-28.2, 18.7], [-28.9, 18], [-29.8, 17.8], [-30.9, 17.8], [-31.8, 18], [-32.5, 18.7], [-32.7, 19.6], [-32.7, 20], [-32.5, 20.9], [-31.1, 22.3], [-30.2, 22.5], [-29.8, 22.5], [-28.9, 22.3], [-28.2, 21.6], [-27.9, 20.7]] },
      cheer: { R: [[-26.3, -43.7], [-26.6, -44.5], [-27, -45.3], [-27.7, -45.9], [-28.6, -46.1], [-29, -46.1], [-29.9, -45.8], [-31.3, -44.4], [-31.5, -43.5], [-31.4, -42.7], [-31.2, -41.9], [-30.5, -41.2], [-29.6, -41], [-28, -41.1], [-27.1, -41.3], [-26.5, -42], [-26.3, -42.9]] },
      think: { L: [[-35, 41.6], [-34.8, 40.7], [-34.1, 40], [-33.2, 39.8], [-32.4, 39.8], [-31.5, 40], [-30.9, 40.7], [-30.6, 41.6], [-30.6, 42.8], [-30.9, 43.7], [-31.5, 44.3], [-32.4, 44.6], [-32.8, 44.6], [-33.7, 44.3], [-34.8, 43.3], [-35, 42.4]] },
      oops: { L: [[-35, 41.6], [-34.8, 40.7], [-34.1, 40], [-33.2, 39.8], [-32.4, 39.8], [-31.5, 40], [-30.9, 40.7], [-30.6, 41.6], [-30.6, 42.8], [-30.9, 43.7], [-31.5, 44.3], [-32.4, 44.6], [-32.8, 44.6], [-33.7, 44.3], [-34.8, 43.3], [-35, 42.4]] },
      sleep: { R: [[-30.6, 44.9], [-30.9, 44], [-31.5, 43.3], [-32.4, 43.1], [-33.6, 43.1], [-34.5, 43.3], [-35.2, 44], [-35.4, 44.9], [-35.4, 45.3], [-35.2, 46.3], [-33.7, 47.8], [-32.8, 48], [-32.4, 48], [-31.5, 47.8], [-30.9, 47.1], [-30.6, 46.1]] },
      wave: { L: [[-35, 41.6], [-34.8, 40.7], [-34.1, 40], [-33.2, 39.8], [-32.4, 39.8], [-31.5, 40], [-30.9, 40.7], [-30.6, 41.6], [-30.6, 42.8], [-30.9, 43.7], [-31.5, 44.3], [-32.4, 44.6], [-32.8, 44.6], [-33.7, 44.3], [-34.8, 43.3], [-35, 42.4]], R: [[[-23.8, -46.2], [-24.8, -49], [-25.8, -50.4], [-27.1, -50.6], [-29.8, -48.6], [-30.1, -47.3], [-28.8, -45.3], [-26.4, -43.9], [-24.7, -44.2], [-23.8, -45.8]], [[-4.8, -24.5], [-22.1, -43.3], [-23.7, -44.2], [-25, -43.9], [-25.9, -42.4], [-25.1, -35.5], [-24.5, -32.3], [-21.9, -26.2], [-17.8, -21.4], [-12.8, -18], [-11.2, -17.4], [-9.5, -17.6], [-5.4, -22.1], [-4.8, -23.7]]] },
    },
    2: {
      idle: { L: [[[-34.1, 40.8], [-33.9, 40.2], [-33.2, 39.4], [-32.5, 39.2], [-31.9, 39.2], [-31.3, 39.4], [-30.8, 39.9], [-30.6, 40.6], [-30.6, 41.7], [-30.8, 42.3], [-31.3, 42.8], [-31.9, 43], [-32.2, 43], [-32.9, 42.8], [-33.9, 41.8], [-34.1, 41.1]], [[-34.1, 40.8], [-33.9, 40.2], [-33.2, 39.4], [-32.5, 39.2], [-31.9, 39.2], [-31.3, 39.4], [-30.8, 39.9], [-30.6, 40.6], [-30.6, 41.7], [-30.8, 42.3], [-31.3, 42.8], [-31.9, 43], [-32.2, 43], [-32.9, 42.8], [-33.9, 41.8], [-34.1, 41.1]]], R: [[[-30.6, 40.6], [-30.8, 39.9], [-31.3, 39.4], [-31.9, 39.2], [-32.5, 39.2], [-33.2, 39.4], [-33.9, 40.2], [-34.1, 40.8], [-34.1, 41.1], [-33.9, 41.8], [-32.9, 42.8], [-32.2, 43], [-31.9, 43], [-31.3, 42.8], [-30.8, 42.3], [-30.6, 41.7]], [[-30.6, 40.6], [-30.8, 39.9], [-31.3, 39.4], [-31.9, 39.2], [-32.5, 39.2], [-33.2, 39.4], [-33.9, 40.2], [-34.1, 40.8], [-34.1, 41.1], [-33.9, 41.8], [-32.9, 42.8], [-32.2, 43], [-31.9, 43], [-31.3, 42.8], [-30.8, 42.3], [-30.6, 41.7]]] },
      happy: { L: [[-31.1, 18.9], [-30.9, 18.2], [-30.4, 17.7], [-29.7, 17.6], [-28.9, 17.6], [-28.2, 17.7], [-27.7, 18.2], [-27.6, 18.9], [-27.6, 19.7], [-27.7, 20.4], [-28.2, 20.9], [-28.9, 21.1], [-29.2, 21.1], [-29.8, 20.9], [-30.9, 19.8], [-31.1, 19.2]], R: [[-27.6, 18.9], [-27.7, 18.2], [-28.2, 17.7], [-28.9, 17.6], [-29.7, 17.6], [-30.4, 17.7], [-30.9, 18.2], [-31.1, 18.9], [-31.1, 19.2], [-30.9, 19.8], [-29.8, 20.9], [-29.2, 21.1], [-28.9, 21.1], [-28.2, 20.9], [-27.7, 20.4], [-27.6, 19.7]] },
      cheer: { L: [[-26.8, -40.7], [-24.9, -42.8], [-24, -43], [-22.9, -42.3], [-20.8, -37.6], [-20.7, -36.4], [-21.4, -35.3], [-22.3, -35.1], [-24.3, -36.7], [-26.6, -39.8]], R: [[-4.6, -24.1], [-4.8, -24.7], [-5.6, -25.4], [-10.8, -29.9], [-11.4, -30], [-11.7, -30], [-12.4, -29.8], [-14.2, -27.9], [-14.3, -27.3], [-14.3, -27], [-14.1, -26.4], [-12.5, -24.8], [-7.9, -21.2], [-7.2, -21], [-6.9, -21], [-6.3, -21.2], [-4.7, -22.9], [-4.6, -23.5]] },
      think: { L: [[-34.1, 40.8], [-33.9, 40.2], [-33.2, 39.4], [-32.5, 39.2], [-31.9, 39.2], [-31.3, 39.4], [-30.8, 39.9], [-30.6, 40.6], [-30.6, 41.7], [-30.8, 42.3], [-31.3, 42.8], [-31.9, 43], [-32.2, 43], [-32.9, 42.8], [-33.9, 41.8], [-34.1, 41.1]] },
      oops: { L: [[-34.1, 40.8], [-33.9, 40.2], [-33.2, 39.4], [-32.5, 39.2], [-31.9, 39.2], [-31.3, 39.4], [-30.8, 39.9], [-30.6, 40.6], [-30.6, 41.7], [-30.8, 42.3], [-31.3, 42.8], [-31.9, 43], [-32.2, 43], [-32.9, 42.8], [-33.9, 41.8], [-34.1, 41.1]] },
      wave: { L: [[-34.1, 40.8], [-33.9, 40.2], [-33.2, 39.4], [-32.5, 39.2], [-31.9, 39.2], [-31.3, 39.4], [-30.8, 39.9], [-30.6, 40.6], [-30.6, 41.7], [-30.8, 42.3], [-31.3, 42.8], [-31.9, 43], [-32.2, 43], [-32.9, 42.8], [-33.9, 41.8], [-34.1, 41.1]] },
    },
    3: {
      idle: { L: [[[-33.4, 40.2], [-33.3, 39.6], [-32.9, 39.2], [-32.4, 39], [-31.9, 38.9], [-31.4, 38.9], [-30.8, 39], [-30.4, 39.4], [-30.3, 40], [-30.3, 40.4], [-30.4, 41], [-30.7, 41.5], [-31.1, 41.9], [-31.6, 42], [-31.9, 42], [-32.4, 41.9], [-33.3, 41], [-33.4, 40.4]], [[-33.4, 40.2], [-33.3, 39.6], [-32.9, 39.2], [-32.4, 39], [-31.9, 38.9], [-31.4, 38.9], [-30.8, 39], [-30.4, 39.4], [-30.3, 40], [-30.3, 40.4], [-30.4, 41], [-30.7, 41.5], [-31.1, 41.9], [-31.6, 42], [-31.9, 42], [-32.4, 41.9], [-33.3, 41], [-33.4, 40.4]]], R: [[[-30.3, 40], [-30.4, 39.4], [-30.8, 39], [-31.4, 38.9], [-31.9, 38.9], [-32.4, 39], [-32.9, 39.2], [-33.3, 39.6], [-33.4, 40.2], [-33.4, 40.4], [-33.3, 41], [-32.4, 41.9], [-31.9, 42], [-31.6, 42], [-31.1, 41.9], [-30.7, 41.5], [-30.4, 41], [-30.3, 40.4]], [[-30.3, 40], [-30.4, 39.4], [-30.8, 39], [-31.4, 38.9], [-31.9, 38.9], [-32.4, 39], [-32.9, 39.2], [-33.3, 39.6], [-33.4, 40.2], [-33.4, 40.4], [-33.3, 41], [-32.4, 41.9], [-31.9, 42], [-31.6, 42], [-31.1, 41.9], [-30.7, 41.5], [-30.4, 41], [-30.3, 40.4]]] },
      happy: { L: [[-30.6, 18.4], [-30.5, 17.9], [-30.1, 17.5], [-29.5, 17.3], [-28.4, 17.3], [-27.8, 17.5], [-27.4, 17.9], [-27.3, 18.4], [-27.3, 18.9], [-27.4, 19.5], [-27.6, 19.9], [-28.1, 20.3], [-28.6, 20.5], [-28.8, 20.5], [-29.4, 20.3], [-30.5, 19.2], [-30.6, 18.7]], R: [[-27.3, 18.4], [-27.4, 17.9], [-27.8, 17.5], [-28.4, 17.3], [-29.5, 17.3], [-30.1, 17.5], [-30.5, 17.9], [-30.6, 18.4], [-30.6, 18.7], [-30.5, 19.2], [-29.4, 20.3], [-28.8, 20.5], [-28.6, 20.5], [-28.1, 20.3], [-27.6, 19.9], [-27.4, 19.5], [-27.3, 18.9]] },
      cheer: { L: [[-11.4, -24.8], [-10.8, -25.8], [-9.6, -25.9], [-8.4, -25.2], [-5.7, -22.9], [-5.6, -22.1], [-6.4, -21], [-7.2, -20.9], [-10.5, -23.2], [-11.4, -24.6]] },
      think: { L: [[-33.4, 40.2], [-33.3, 39.6], [-32.9, 39.2], [-32.4, 39], [-31.9, 38.9], [-31.4, 38.9], [-30.8, 39], [-30.4, 39.4], [-30.3, 40], [-30.3, 40.4], [-30.4, 41], [-30.7, 41.5], [-31.1, 41.9], [-31.6, 42], [-31.9, 42], [-32.4, 41.9], [-33.3, 41], [-33.4, 40.4]] },
      oops: { L: [[-33.4, 40.2], [-33.3, 39.6], [-32.9, 39.2], [-32.4, 39], [-31.9, 38.9], [-31.4, 38.9], [-30.8, 39], [-30.4, 39.4], [-30.3, 40], [-30.3, 40.4], [-30.4, 41], [-30.7, 41.5], [-31.1, 41.9], [-31.6, 42], [-31.9, 42], [-32.4, 41.9], [-33.3, 41], [-33.4, 40.4]] },
      sleep: { L: [[-33.2, 43.6], [-33, 43], [-32.6, 42.6], [-32.1, 42.4], [-31.6, 42.4], [-31.1, 42.6], [-30.7, 43], [-30.5, 43.6], [-30.5, 44.3], [-30.7, 44.9], [-31.1, 45.3], [-31.6, 45.4], [-31.9, 45.4], [-32.4, 45.3], [-33, 44.6], [-33.2, 44]], R: [[-30.5, 43.6], [-30.7, 43], [-31.1, 42.6], [-31.6, 42.4], [-32.1, 42.4], [-32.6, 42.6], [-33, 43], [-33.2, 43.6], [-33.2, 44], [-33, 44.6], [-32.4, 45.3], [-31.9, 45.4], [-31.6, 45.4], [-31.1, 45.3], [-30.7, 44.9], [-30.5, 44.3]] },
      wave: { L: [[-33.4, 40.2], [-33.3, 39.6], [-32.9, 39.2], [-32.4, 39], [-31.9, 38.9], [-31.4, 38.9], [-30.8, 39], [-30.4, 39.4], [-30.3, 40], [-30.3, 40.4], [-30.4, 41], [-30.7, 41.5], [-31.1, 41.9], [-31.6, 42], [-31.9, 42], [-32.4, 41.9], [-33.3, 41], [-33.4, 40.4]] },
    },
  },
}
const KeyWebs = pawWebs({}, KEY_WEBS)
/** Armenes faste fyld og, i stillbilleder, nøgleposernes lommer i skyggetone (se `KEY_WEBS`). */
const withKeyWebs = (webs: SidePart): SidePart => (p) => {
  const key = p.still ? KeyWebs({ ...p, pal: { ...p.pal, fur: p.pal.silhouette ? p.pal.fur : p.pal.shade } }) : null
  const web = webs(p)
  return key && web ? (
    <>
      {web}
      {key}
    </>
  ) : (key ?? web)
}

// ---------------------------------------------------------------------------------------------
// Fronten (efter kroppens skygge, før kropstøjet): den hvide mave med sin egne lyse cel-skygge (kroppens mørke
// skyggehalvmåne ville ellers skære ind i den hvide mave), og de store svømmefødder foran kroppen.

const bellyOf = (a: AnchorSet) => ({ cx: a.bodyCenter.x, cy: a.bodyCenter.y + 9, rx: a.bodyRx * 0.74, ry: a.bodyRy * 0.82 })

/** Svømmefoden (venstre; højre spejles) i modelrummet: hælen under maven, tre runde tæer, der spreder sig ud og frem. */
const FOOT: Vec[] = [
  [95, 213], [87, 212.4], [78.4, 214.4], [70.4, 218.6], [65.4, 223.4], [66.6, 227.8], [71.4, 227.2], [74, 230.6], [79.4, 229],
  [82.8, 231.8], [88, 229.8], [94.2, 228.4], [97.6, 222.4],
]
const WEBS: Vec[][] = [[[89.4, 217.2], [80, 222.8], [74.6, 226.8]], [[91.2, 218.2], [86, 225], [83.8, 229.2]]]
const FOOT_D = join(blob(xf(FOOT, { dy: -2.6 }), 0.82), blob(mirrorX(xf(FOOT, { dy: -2.6 }), 100), 0.82))
const WEBS_D = join(...[...WEBS, ...WEBS.map((w) => mirrorX(w, 100))].map((w) => spline(xf(w, { dy: -2.6 }))))

/** Halen bag kroppen (modelrum): en lille, spids hale, der stikker ud bag højre hofte og hviler på jorden. */
const TAIL: Vec[] = [[124, 204], [136, 207.6], [148, 213.4], [158.6, 221.6], [161, 225.6], [152, 225.4], [138, 223.6], [126, 220.4]]
const TAIL_D = blob(TAIL, 0.75)

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

/** Bag kroppen: den spidse hale (pelsen, sort i silhuet). */
const Feet: Part = ({ pal, sw }) => <path d={TAIL_D} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />

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
    headCenter: { x: 100, y: 88 },
    headRx: 42,
    headRy: 40,
    headTop: { x: 100, y: 47 },
    headWidth: 84,
    // Ingen ører: ørebaserne er virtuelle og styrer kun, hvor bred en hat mellem ørerne må være.
    earBaseL: { x: 76, y: 56 },
    earBaseR: { x: 124, y: 56 },
    hornBase: { x: 100, y: 49 },
    // Trekvart: næbbet går ud til venstre fra ansigtets midte (øjnene sidder om hovedets midte, så briller passer).
    eyeL: { x: 82, y: 88 },
    eyeR: { x: 118, y: 88 },
    eyeRx: 9.4,
    eyeRy: 11.8,
    muzzle: { x: 93, y: 108 },
    mouth: { x: 95, y: 121 },
    cheekL: { x: 72, y: 105 },
    cheekR: { x: 128, y: 105 },
    neck: { x: 100, y: 130 },
    neckWidth: 52,
    bodyCenter: { x: 100, y: 168 },
    bodyRx: 50,
    bodyRy: 58,
    bodyWidth: 96,
    chest: { x: 100, y: 150 },
    back: { x: 100, y: 156 },
    shoulderL: { x: 80, y: 146 },
    shoulderR: { x: 120, y: 146 },
    pawL: { x: 45, y: 186 },
    pawR: { x: 155, y: 186 },
    handRot: -20,
    footL: { x: 82, y: 222 },
    footR: { x: 118, y: 222 },
    tailBase: { x: 140, y: 214 },
  },
  bounds: {
    head: { x0: 36, y0: 40, x1: 144, y1: 132 },
    body: { x0: 18, y0: 112, x1: 182, y1: 233 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden med mindst 8 enheders luft.
  fx: { x: 162, y: 100 },
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
    PawBack: withKeyWebs(pawWebs({}, PAW_WEBS)),
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
