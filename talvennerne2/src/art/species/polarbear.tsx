// Isbjørnen (Stjernefjeldet, bølge 3): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så isbjørnen
// aldrig læses som en panda, en hamster eller en hvalp (review G2-r1 §2 og integratorens to blinde for-test):
// - hovedet sidder lavt og fremme foran skuldrene og er vendt en trekvart mod venstre, så den lange snude stikker ud af
//   omridset (pandaen og hamsteren har runde hoveder uden snude),
// - små, runde ører lavt bag på hovedet (tegnet bag hovedet; pandaens store ører sidder højt),
// - en krop, der er bredere end høj, med en lang ryglinje, der stiger bag hovedet og falder mod hoften til højre, og
// - fire tydelige, kraftige poter: forbenene står lodret ned til jorden, og bagpoterne og en halestump ses bag kroppen.
// Hvid pels på papirfarven bæres af konturen og cel-skyggen (og en fold langs snudens ryg, der viser dens længde).
// Signaturen er snuse-næsen: næsen snuser tre gange med squash og et overshoot, mens hovedet løfter sig mod luften
// (`a-sniff` om næsen og hovedets løft i hvile, rig.css). Alle former er punkter og husets primitiver.
import { ROUND, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, offsetLoop, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { POLARBEAR_COLORWAYS } from './polarbear.colorways'

const round = ROUND
/** Trædepuder og kløer (sort i silhuet). */
const pads = (pal: Palette) => pal.pattern
/** Snudens og pelsens bløde folder: en tone mellem pelsen og konturen. */
const crease = (pal: Palette) => mixHex(pal.shade, pal.outline, 0.35)

// ---------------------------------------------------------------------------------------------
// Hoved (trekvart, vendt mod venstre): en rund isse og en lang snude, der går ud til venstre og en anelse nedad, i én
// sømløs kontur. Punkterne er forskydninger fra hovedets centrum ved headRx 44 og headRy 38 (skaleres med ankrene).

const HEAD_PTS: Vec[] = [
  [0, -38], [-20, -36.5], [-34, -29], [-42, -17], [-44.6, -4], [-49, 4], [-56, 9], [-62, 13.6], [-66, 19], [-67, 24.6], [-63.6, 29.4],
  [-56, 32.4], [-46, 35.6], [-34, 39.4], [-20, 41.4], [-4, 40.6], [12, 37], [26, 30], [37, 19], [43.6, 5], [44, -8], [39, -21],
  [28, -31.5], [14, -37],
]
const bearHead: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(HEAD_PTS.map(([x, y]) => [x / 44, y / 38] as Vec), a.headCenter.x, a.headCenter.y, a.headRx, a.headRy), inflate), 0.86)
/** Et punkt på hovedet (forskydning ved headRx 44 og headRy 38) i modelrummet. */
const onHead = (a: AnchorSet, [x, y]: Vec): Vec => [a.headCenter.x + (x * a.headRx) / 44, a.headCenter.y + (y * a.headRy) / 38]

// ---------------------------------------------------------------------------------------------
// Krop: bredere end høj, med brystet til venstre under hovedet, en ryglinje, der stiger bag hovedet og falder mod hoften
// til højre, og flad bund (ikke en kugle).

const BODY_PTS: Vec[] = [
  [-0.12, -1.12], [-0.42, -1.0], [-0.68, -0.8], [-0.86, -0.54], [-0.96, -0.2], [-0.99, 0.2], [-0.95, 0.56], [-0.84, 0.86], [-0.58, 1.0],
  [-0.2, 1.03], [0.2, 1.03], [0.58, 1.0], [0.88, 0.84], [1.01, 0.5], [1.0, 0.1], [0.9, -0.3], [0.74, -0.74], [0.48, -1.06],
  [0.18, -1.2],
]
/** Kroppens bredde i forhold til ankeret bodyRx (jordskyggen og tøjet regner med bodyRx; kroppen er bredere end høj). */
const BODY_WIDE = 60 / 53
const bearBody: OutlineFn = (a: AnchorSet, inflate: number) =>
  blob(offsetLoop(frame(BODY_PTS, a.bodyCenter.x, a.bodyCenter.y, a.bodyRx * BODY_WIDE, a.bodyRy), inflate), 0.9)

// ---------------------------------------------------------------------------------------------
// Ører: små og runde, lavt og bagud på hovedets sider (bag hovedet, lokalt: roden i (0,0), peger op).

const EAR_R = 9.6
const EAR: Vec[] = xf([[0, 6], [-7.4, 3], [-9.6, -4.6], [-7, -12.6], [0, -15.6], [7, -12.6], [9.6, -4.6], [7.4, 3]], { sx: 1.12 })
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Ear: SidePart = ({ pal, sw, stage }) => {
  const s = earScale(stage)
  const k = s.sx ?? 1
  return (
    <>
      <path d={blob(xf(EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={ellipse(0.6 * k, -5.8 * k, EAR_R * 0.48 * k, EAR_R * 0.54 * k)} fill={pal.inner} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Snude: den lyse snude langs hovedets venstre side, en fold langs snudens ryg (dens længde), en stor, blank næse
// for enden (signaturen snuser) og en lille næsefure ned mod munden.

const NOSE: Vec[] = xf([[0, 5.2], [-4.4, 3.4], [-8, -0.2], [-8, -3.4], [-4, -5], [0, -5.4], [4, -5], [8, -3.4], [8, -0.2], [4.4, 3.4]], { rot: -18 })
/** Næsens plads og folden langs snudens ryg (forskydninger fra hovedets centrum). */
const NOSE_AT: Vec = [-60.6, 18.6]
const BRIDGE: Vec[] = [[-24, 2.6], [-36, 6.4], [-47, 11], [-54.4, 14.6]]

const Snout: Part = ({ pal, sw, a, ids, lod, still }) => {
  const sil = pal.silhouette
  const [nx, ny] = onHead(a, NOSE_AT)
  const [mx, my] = onHead(a, [-44, 25])
  return (
    <>
      {!sil && <path d={ellipse(mx, my, 28, 15, -14)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!sil && lod === 'full' && <path d={spline(BRIDGE.map((v) => onHead(a, v)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
      <Pivot at={{ x: nx, y: ny }} cls="a-sniff" still={still}>
        <path d={blob(NOSE, 0.85)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
        {!sil && <path d={ellipse(-3, -2.4, 2.8, 1.4, -26)} fill={pal.highlight} />}
      </Pivot>
      {!sil && <path d={spline([[nx + 2.4, ny + 5], [nx + 4.6, ny + 10.4]])} fill="none" stroke={pal.ink} strokeWidth={sw * 0.6} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben (lokalt om skulderen): kraftige søjler, der står lodret ned til jorden og breder sig ud i store poter med
// tåfolder og kløer. Konturen er åben ved skulderen (roden gemmer sig under hovedet og i kroppen).

const LEG: Vec[] = xf([
  [13, -12], [13.4, 4], [13.4, 18], [13.8, 30], [15.4, 39], [18.4, 46], [19, 53.4], [15.6, 59.6], [8, 62.6], [-1.4, 63.2], [-10.4, 62],
  [-16.4, 57.4], [-16.6, 50], [-14, 41.6], [-12.8, 30], [-12.8, 18], [-12.6, 4], [-12.2, -12],
], { sy: 0.9, dy: -1.2 })
const TOES: Vec[][] = [[[-5.6, 47], [-5.2, 52.6]], [[4.2, 47], [4.6, 52.8]]]
const CLAWS: Vec[] = [[-10.4, 54.4], [-0.6, 55.6], [9.4, 54.8]]
const clawsAt = (pts: readonly Vec[], r = 2.3) => join(...pts.map(([x, y]) => ellipse(x, y, r * 0.86, r)))
/** Ærmet: fra skulderen ned til manchetten over poten (lodret ramme), en anelse løsere end benet. */
const LEG_SLEEVE: Vec[] = [
  [-14, -14], [-14.6, 0], [-15, 14], [-15.2, 26], [-15.4, 35], [0, 37.6], [15.4, 35], [15.2, 26], [15, 14], [14.6, 0], [14, -14], [0, -16],
]

const Leg: SidePart = ({ pal, sw, lod }) => (
  <>
    <path d={blob(LEG, 0.8)} fill={pal.fur} />
    <path d={spline(LEG.slice(1, -1), 0.8)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && !pal.silhouette && <path d={join(...TOES.map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
    <path d={clawsAt(CLAWS)} fill={pads(pal)} />
  </>
)

/** Løftede forben (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  // Glad: poterne ud til siden i brysthøjde, tegnet drejet −30°, så glad-hoppets 30° (rig.css) bringer dem på plads.
  happy: xf([[3, 4], [-7, -1], [-17, -5], [-26, -8], [-34, -9]], { rot: -30 }),
  cheer: [[6, 6], [0, -3], [-8, -13], [-16, -23], [-22, -33]] as Vec[],
  wave: [[7, 6], [-3, 1], [-14, -4], [-23, -12], [-27, -24], [-28, -36]] as Vec[],
  // Tænker: poten under snuden.
  think: [[6, 7], [13, 1], [19, -6], [22, -12]] as Vec[],
  // Ups: poten op til kinden ved snuden (genert "hov"), tungen ude.
  oops: [[6, 7], [7, -4], [8, -13], [8.5, -20], [8, -25]] as Vec[],
}
type UpKind = keyof typeof UP_SPINES
const UP_W = { w0: 23, w1: 24 }
const UP_LOOPS = Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, limbLoop(s, UP_W.w0, UP_W.w1)])) as Record<UpKind, Vec[]>
const tipOf = (s: readonly Vec[]) => s[s.length - 1]
const kindOf = (mood: string): UpKind => (mood in UP_SPINES ? (mood as UpKind) : 'cheer')

const PawUp: SidePart = ({ pal, sw, mood }) => {
  const kind = kindOf(mood)
  const [tx, ty] = tipOf(UP_SPINES[kind])
  const loop = UP_LOOPS[kind]
  const palm = kind === 'cheer' || kind === 'wave' || kind === 'happy'
  return (
    <>
      <path d={blob(loop)} fill={pal.fur} />
      <path d={spline(loop)} fill="none" stroke={pal.outline} strokeWidth={sw} {...round} />
      {palm && !pal.silhouette && <path d={padsPath(tx, ty + 0.6, 10.6, kind === 'wave' ? -4 : kind === 'happy' ? -64 : -32)} fill={pads(pal)} />}
    </>
  )
}

/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {}

/**
 * Lommerne i nøgleposerne (review G2-r1 §1.4 og §5): pels i skyggetone bag alt mellem løftet pote og kind, snude eller
 * krop, så der aldrig ses baggrund inde i figuren. Kun i stillbilleder (album, butik og kontaktark): i animationen åbner
 * og lukker lommerne, mens poten bevæger sig, så et fast fyld ville ses mod baggrunden dér. Hylstrene er målt på
 * magenta (4 px pr. enhed, sprækker under 2,6 enheder lukket, udvidet 1,2 enheder) i skulderens ramme (højre side
 * spejlet) pr. race, stadie, humør og side.
 */
const KEY_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  std: {
    1: {
      idle: { L: [[[-15.6, -24.5], [-15.4, -25.4], [-14.7, -26], [-13.8, -26.3], [-11.5, -26.3], [-9.6, -25.9], [-8.7, -25.7], [-8.1, -25], [-7.8, -24.1], [-7.8, -23.7], [-8.1, -22.8], [-9.1, -21.7], [-10.6, -21], [-11.5, -20.7], [-12.3, -20.7], [-13.2, -21], [-15.4, -23.2], [-15.6, -24.1]], [[-15.6, -24.5], [-15.4, -25.4], [-14.7, -26], [-13.8, -26.3], [-11.5, -26.3], [-9.6, -25.9], [-8.7, -25.7], [-8.1, -25], [-7.8, -24.1], [-7.8, -23.7], [-8.1, -22.8], [-9.1, -21.7], [-10.6, -21], [-11.5, -20.7], [-12.3, -20.7], [-13.2, -21], [-15.4, -23.2], [-15.6, -24.1]]], R: [[[-9.4, -38.2], [-9.6, -39.1], [-10.3, -39.8], [-11, -40.2], [-11.9, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.6, -36.9], [-9.4, -37.9]], [[-9.4, -38.2], [-9.6, -39.1], [-10.3, -39.8], [-11, -40.2], [-11.9, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.6, -36.9], [-9.4, -37.9]]] },
      happy: { L: [[-36.2, -23.7], [-34.4, -26.9], [-32.8, -27.8], [-11.5, -26.3], [-8.7, -25.7], [-7.8, -24.1], [-8.1, -22.8], [-14, -18.7], [-15.7, -18.1], [-34.3, -21.5], [-35.9, -22.4]], R: [[-9.4, -38.2], [-9.6, -39.1], [-10.3, -39.8], [-11, -40.2], [-11.9, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.6, -36.9], [-9.4, -37.9]] },
      cheer: { R: [[-19.9, -48], [-20.2, -48.9], [-21.7, -50.3], [-22.6, -50.5], [-23, -50.5], [-23.9, -50.2], [-25.2, -48.7], [-25.5, -47.8], [-25.4, -47.5], [-25.2, -46.6], [-24.5, -45.9], [-23.6, -45.7], [-21.7, -45.8], [-20.8, -46.1], [-20.1, -46.8], [-19.9, -47.7]] },
      think: { L: [[-13.4, -25.2], [-12.4, -26.8], [-9.6, -27], [-7.2, -26.4], [-6.3, -24.8], [-6.5, -23.5], [-9.1, -21.7], [-10.4, -21.5], [-12, -22.4], [-13.4, -24.8]] },
      oops: { L: [[-21.7, -19.9], [-21.5, -20.8], [-20.8, -21.5], [-19.9, -21.7], [-17.6, -21.7], [-16.7, -21.5], [-15.9, -21.1], [-15.3, -20.4], [-15, -19.5], [-15, -19.1], [-15.3, -18.2], [-17.1, -16.4], [-18, -16.2], [-18.4, -16.2], [-19.3, -16.4], [-21.5, -18.6], [-21.7, -19.5]], R: [[-5.9, -39], [-6.2, -39.9], [-6.8, -40.6], [-7.6, -41], [-8.5, -41.2], [-8.9, -41.2], [-9.8, -41], [-11.2, -39.5], [-11.5, -38.6], [-11.5, -38.2], [-11.2, -37.3], [-10.6, -36.7], [-9.7, -36.4], [-8.5, -36.4], [-7.6, -36.7], [-6.8, -37], [-6.2, -37.7], [-5.9, -38.6]] },
      sleep: { L: [[-16.4, -23.1], [-16.2, -24.1], [-15.5, -24.8], [-14.6, -25], [-13.1, -25], [-12.1, -24.8], [-11, -24.4], [-10.3, -23.7], [-10.1, -22.7], [-10.1, -22.3], [-10.3, -21.4], [-11, -20.7], [-12.1, -19.9], [-13.1, -19.7], [-13.4, -19.7], [-14.3, -19.9], [-16.2, -21.8], [-16.4, -22.7]] },
      wave: { L: [[-21.7, -19.9], [-21.5, -20.8], [-20.8, -21.5], [-19.9, -21.7], [-17.6, -21.7], [-16.7, -21.5], [-15.9, -21.1], [-15.3, -20.4], [-15, -19.5], [-15, -19.1], [-15.3, -18.2], [-17.1, -16.4], [-18, -16.2], [-18.4, -16.2], [-19.3, -16.4], [-21.5, -18.6], [-21.7, -19.5]], R: [[-5.9, -39], [-6.8, -40.6], [-21.1, -53], [-22.7, -52.7], [-24.8, -50], [-24.5, -48.7], [-14.4, -35.5], [-13.1, -35.3], [-7.6, -36.7], [-6.2, -37.7]] },
    },
    2: {
      idle: { L: [[[-11.1, -25.1], [-10.9, -25.7], [-10.4, -26.2], [-9.7, -26.4], [-8.6, -26.4], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.7, -22.5], [-8.3, -22.3], [-8.6, -22.3], [-9.3, -22.5], [-10.9, -24.1], [-11.1, -24.8]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]], [[-11.1, -25.1], [-10.9, -25.7], [-10.4, -26.2], [-9.7, -26.4], [-8.6, -26.4], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.7, -22.5], [-8.3, -22.3], [-8.6, -22.3], [-9.3, -22.5], [-10.9, -24.1], [-11.1, -24.8]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]]], R: [[[-6.9, -37.9], [-7.1, -38.6], [-8.2, -39.6], [-8.8, -39.8], [-9.1, -39.8], [-9.8, -39.6], [-10.8, -38.6], [-11, -37.9], [-11, -37.6], [-10.8, -36.9], [-10.3, -36.5], [-9.7, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-7.1, -36.9], [-6.9, -37.6]], [[-6.9, -37.9], [-7.1, -38.6], [-8.2, -39.6], [-8.8, -39.8], [-9.1, -39.8], [-9.8, -39.6], [-10.8, -38.6], [-11, -37.9], [-11, -37.6], [-10.8, -36.9], [-10.3, -36.5], [-9.7, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-7.1, -36.9], [-6.9, -37.6]]] },
      happy: { L: [[[-11.1, -25.1], [-10.9, -25.7], [-10.4, -26.2], [-9.7, -26.4], [-8.6, -26.4], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.7, -22.5], [-8.3, -22.3], [-8.6, -22.3], [-9.3, -22.5], [-10.9, -24.1], [-11.1, -24.8]], [[-35.2, 4.9], [-35, 4.3], [-34.6, 3.8], [-33.9, 3.6], [-33.3, 3.6], [-32.7, 3.8], [-32.1, 4.1], [-31.6, 4.6], [-31.4, 5.2], [-31.4, 5.5], [-31.6, 6.2], [-32.4, 6.9], [-33.1, 7.1], [-33.3, 7.1], [-34, 6.9], [-35, 5.9], [-35.2, 5.2]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]]], R: [[-6.9, -37.9], [-7.1, -38.6], [-8.2, -39.6], [-8.8, -39.8], [-9.1, -39.8], [-9.8, -39.6], [-10.8, -38.6], [-11, -37.9], [-11, -37.6], [-10.8, -36.9], [-10.3, -36.5], [-9.7, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-7.1, -36.9], [-6.9, -37.6]] },
      cheer: { R: [[[-13.9, -45.8], [-14.1, -46.5], [-15.3, -47.8], [-16.1, -48.5], [-16.7, -48.7], [-17.3, -48.7], [-18, -48.5], [-19.2, -47.1], [-19.4, -46.5], [-19.4, -46.2], [-19.2, -45.6], [-18.7, -45.1], [-16.4, -44.1], [-15.7, -43.9], [-15.2, -43.9], [-14.5, -44.1], [-14.1, -44.6], [-13.9, -45.3]], [[-5.9, -38.2], [-6.1, -38.9], [-6.9, -39.6], [-9.1, -41.4], [-9.8, -41.6], [-10.1, -41.6], [-10.8, -41.4], [-11.2, -40.9], [-11.4, -40.2], [-11.4, -39.7], [-11.2, -39], [-10, -37.1], [-9.5, -36.7], [-8.8, -36.5], [-7.1, -36.6], [-6.5, -36.8], [-6, -37.3], [-5.9, -37.9]]] },
      think: { L: [[[-9.4, -25.9], [-9.2, -26.6], [-8.7, -27], [-8.1, -27.2], [-6.9, -27.2], [-5.6, -26.9], [-4.9, -26.8], [-4.4, -26.3], [-4.2, -25.6], [-4.2, -25.1], [-4.4, -24.4], [-4.9, -23.9], [-6, -23.3], [-6.7, -23.2], [-6.9, -23.2], [-7.6, -23.3], [-9.2, -24.9], [-9.4, -25.6]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]]] },
      oops: { L: [[[-18.6, -20.1], [-18.4, -20.7], [-17.9, -21.2], [-15.9, -22.3], [-15.3, -22.5], [-13.1, -22.5], [-12.4, -22.3], [-11.9, -21.8], [-11.7, -21.2], [-11.7, -20.9], [-11.9, -20.2], [-12.7, -19.5], [-15.2, -17.8], [-15.8, -17.6], [-16.4, -17.6], [-17.1, -17.8], [-18.4, -19.1], [-18.6, -19.8]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]]], R: [[-3.3, -38.4], [-3.5, -39.1], [-4.3, -39.9], [-4.8, -40.2], [-5.5, -40.3], [-6.1, -40.3], [-6.7, -40.2], [-7.8, -39.1], [-7.9, -38.4], [-7.9, -38.2], [-7.8, -37.5], [-7.3, -37], [-6.6, -36.8], [-4.7, -36.8], [-4, -37], [-3.5, -37.5], [-3.3, -38.2]] },
      sleep: { L: [[-11.3, -24.9], [-10.7, -26.1], [-9.2, -26.3], [-7.4, -25.8], [-6.3, -25], [-6.2, -24], [-6.8, -22.8], [-8.6, -22.1], [-9.6, -22.3], [-11.3, -24.6]] },
      wave: { L: [[[-18.8, -20.6], [-18.7, -21.3], [-18.2, -21.8], [-17.1, -22.3], [-16.4, -22.5], [-13.1, -22.5], [-12.4, -22.3], [-11.9, -21.8], [-11.7, -21.2], [-11.7, -20.9], [-11.9, -20.2], [-12.7, -19.5], [-15.2, -17.8], [-15.8, -17.6], [-16.1, -17.6], [-16.8, -17.8], [-18.7, -19.7], [-18.8, -20.3]], [[-33.6, 44.1], [-33.4, 43.4], [-32.3, 42.4], [-31.7, 42.2], [-31.4, 42.2], [-30.7, 42.4], [-30.2, 42.9], [-30.1, 43.6], [-30.1, 44.4], [-30.2, 45.1], [-30.7, 45.5], [-31.4, 45.7], [-32.2, 45.7], [-32.9, 45.5], [-33.4, 45.1], [-33.6, 44.4]]], R: [[[8.9, -108.2], [8.7, -108.8], [7.7, -109.9], [7, -110.1], [6.7, -110.1], [6.1, -109.9], [5.6, -109.4], [5.4, -108.7], [5.4, -107.9], [5.6, -107.2], [6.1, -106.7], [6.7, -106.6], [7.6, -106.6], [8.2, -106.7], [8.7, -107.2], [8.9, -107.9]], [[-3.3, -38.4], [-3.5, -39.1], [-4.3, -39.9], [-4.8, -40.2], [-5.5, -40.3], [-6.1, -40.3], [-6.7, -40.2], [-7.8, -39.1], [-7.9, -38.4], [-7.9, -38.2], [-7.8, -37.5], [-7.3, -37], [-6.6, -36.8], [-4.7, -36.8], [-4, -37], [-3.5, -37.5], [-3.3, -38.2]]] },
    },
    3: {
      idle: { L: [[[-9.1, -25.3], [-9, -25.9], [-8.6, -26.3], [-8, -26.4], [-7.1, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.1, -23.2], [-6.6, -23], [-7.1, -23], [-7.6, -23.2], [-9, -24.5], [-9.1, -25.1]], [[-9.1, -25.3], [-9, -25.9], [-8.6, -26.3], [-8, -26.4], [-7.1, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.1, -23.2], [-6.6, -23], [-7.1, -23], [-7.6, -23.2], [-9, -24.5], [-9.1, -25.1]]], R: [[[-5.4, -38], [-5.6, -38.5], [-6, -38.9], [-6.4, -39.2], [-7, -39.3], [-7.4, -39.3], [-8, -39.2], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.5, -36.6], [-6, -36.8], [-5.6, -37.2], [-5.4, -37.7]], [[-5.4, -38], [-5.6, -38.5], [-6, -38.9], [-6.4, -39.2], [-7, -39.3], [-7.4, -39.3], [-8, -39.2], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.5, -36.6], [-6, -36.8], [-5.6, -37.2], [-5.4, -37.7]]] },
      happy: { L: [[[-9.1, -25.3], [-9, -25.9], [-8.6, -26.3], [-8, -26.4], [-7.1, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.1, -23.2], [-6.6, -23], [-7.1, -23], [-7.6, -23.2], [-9, -24.5], [-9.1, -25.1]], [[-34.4, 4.8], [-34.2, 4.2], [-33.8, 3.8], [-33.2, 3.7], [-32.5, 3.7], [-32, 3.8], [-31.6, 4.2], [-31.4, 4.8], [-31.4, 5.5], [-31.6, 6], [-32, 6.4], [-32.5, 6.6], [-32.8, 6.6], [-33.3, 6.4], [-34.2, 5.6], [-34.4, 5]]], R: [[-5.4, -38], [-5.6, -38.5], [-6, -38.9], [-6.4, -39.2], [-7, -39.3], [-7.4, -39.3], [-8, -39.2], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.5, -36.6], [-6, -36.8], [-5.6, -37.2], [-5.4, -37.7]] },
      cheer: { R: [[-4.6, -38.1], [-11.5, -45.5], [-12.7, -46.2], [-13.5, -46], [-15.1, -43.9], [-15, -43.1], [-9.4, -36.3], [-8.7, -36.2], [-5.7, -36.8], [-4.7, -37.3]] },
      think: { L: [[-7, -26], [-6.9, -26.6], [-6.5, -27], [-5.9, -27.1], [-4.8, -27.1], [-3.8, -26.9], [-3.3, -26.7], [-2.9, -26.3], [-2.7, -25.8], [-2.7, -25.5], [-2.9, -25], [-3.3, -24.6], [-4.2, -24.1], [-4.8, -24], [-5.2, -24], [-5.8, -24.1], [-6.9, -25.2], [-7, -25.8]] },
      oops: { L: [[[-13.5, -21.4], [-13.4, -21.9], [-12.5, -22.8], [-11.9, -23], [-11.3, -23], [-10.7, -22.8], [-10.3, -22.4], [-10.1, -21.8], [-10.1, -21.6], [-10.3, -21.1], [-10.7, -20.6], [-11.4, -20.2], [-11.9, -20], [-12.4, -20], [-13, -20.2], [-13.4, -20.6], [-13.5, -21.1]], [[-15.4, -20.7], [-15.2, -21.2], [-14.8, -21.6], [-14.3, -21.8], [-13.3, -22], [-12.9, -22], [-12.3, -21.9], [-11.9, -21.5], [-11.8, -20.9], [-11.8, -20.7], [-11.9, -20.1], [-12.5, -19.5], [-13, -19.3], [-13.6, -19.1], [-14, -19.1], [-14.6, -19.3], [-15.2, -19.9], [-15.4, -20.5]]], R: [[[8.9, -99.1], [8.8, -99.6], [8.2, -100.3], [7.6, -100.4], [7.4, -100.4], [6.8, -100.3], [6.4, -99.9], [6.3, -99.3], [6.3, -98.6], [6.4, -98.1], [6.8, -97.6], [7.4, -97.5], [7.8, -97.5], [8.4, -97.6], [8.8, -98.1], [8.9, -98.6]], [[-1.9, -38.2], [-2.1, -38.7], [-2.5, -39.2], [-3.4, -39.9], [-4, -40], [-4.2, -40], [-4.8, -39.9], [-5.9, -38.7], [-6, -38.2], [-6, -38], [-5.9, -37.4], [-5.5, -37], [-4.9, -36.9], [-3, -36.9], [-2.5, -37], [-2.1, -37.4], [-1.9, -38]]] },
      sleep: { L: [[[-8.7, -25.5], [-8.1, -26.5], [-6.9, -26.6], [-5.4, -26.2], [-4.5, -25.6], [-4.4, -24.7], [-4.9, -23.7], [-6.4, -23.1], [-7.4, -23.3], [-8.5, -24.6]], [[-32.7, 44.3], [-32.6, 43.8], [-31.9, 43.1], [-31.4, 43], [-30.9, 43], [-30.4, 43.1], [-30, 43.5], [-29.8, 44.1], [-29.8, 44.6], [-30, 45.2], [-30.4, 45.6], [-30.9, 45.7], [-31.6, 45.7], [-32.2, 45.6], [-32.6, 45.2], [-32.7, 44.6]]], R: [[-11.9, -36.6], [-12, -37.1], [-12.4, -37.6], [-13, -37.7], [-13.7, -37.7], [-14.2, -37.6], [-14.9, -36.9], [-15, -36.3], [-15, -36.1], [-14.9, -35.5], [-14.5, -35.1], [-13.9, -34.9], [-13.2, -34.9], [-12.7, -35.1], [-12, -35.8], [-11.9, -36.3]] },
      wave: { L: [[-17, -20.7], [-16.4, -21.6], [-13.4, -22.8], [-11.3, -23], [-10.3, -22.4], [-10.1, -21.6], [-10.7, -20.6], [-13.9, -18.6], [-15, -18.4], [-16.8, -19.9]], R: [[-1.9, -38.2], [-2.1, -38.7], [-2.5, -39.2], [-3.4, -39.9], [-4, -40], [-4.2, -40], [-4.8, -39.9], [-5.9, -38.7], [-6, -38.2], [-6, -38], [-5.9, -37.4], [-5.5, -37], [-4.9, -36.9], [-3, -36.9], [-2.5, -37], [-2.1, -37.4], [-1.9, -38]] },
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
// Bag kroppen: bagpoterne, der stikker frem under kroppen (den nære til højre ved hoften, den fjerne til venstre bag
// forbenene), og en lille halestump ved hoften.

const HIND_NEAR = { cx: 150, cy: 219.4, rx: 18.6, ry: 8, rot: 4 }
const HIND_FAR = { cx: 50, cy: 220.6, rx: 13.4, ry: 6.6, rot: -6 }
const HIND_TOES: Vec[][] = [[[156, 214.4], [157.2, 220.4]], [[163.4, 215.6], [164.4, 221.2]]]
const TAIL_STUB = { cx: 167.4, cy: 191, rx: 8.2, ry: 7.4, rot: 20 }

const Feet: Part = ({ pal, sw, lod }) => {
  const e = (o: typeof HIND_NEAR) => ellipse(o.cx, o.cy, o.rx, o.ry, o.rot)
  return (
    <>
      <path d={join(e(TAIL_STUB), e(HIND_NEAR), e(HIND_FAR))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && !pal.silhouette && <path d={join(...HIND_TOES.map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: en lys mave (regnbuen: fire flade striber), en blød pelstot under hagen og lårets fold ved hoften.

const TUFT: Vec[][] = [[[86, 146], [89, 151.4], [91.4, 147.6]], [[96.6, 147.6], [99, 151.4], [102, 146]]]
const THIGH: Vec[] = [[128, 214], [128.6, 200], [136, 189], [148, 184], [158, 186.4]]

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) => (
  <>
    <path d={ellipse(a.bodyCenter.x - 12, a.bodyCenter.y + 8, a.bodyRx * BODY_WIDE * 0.5, a.bodyRy * 0.76)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.belly} clipPath={`url(#${ids.bodyClip})`} />
    {lod === 'full' && !pal.silhouette && <path d={join(...TUFT.map((t) => spline(t)), spline(THIGH))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
  </>
)

// ---------------------------------------------------------------------------------------------

export const polarbear: SpeciesDef = {
  id: 'polarbear',
  name: 'Isbjørn',
  nameClip: 'name.species.polarbear',
  family: 'bear',
  body: 'round',
  breeds: [{ id: 'std', name: 'isbjørn' }],
  colorways: POLARBEAR_COLORWAYS,
  magic: ['gold', 'rainbow'],
  anchors: {
    // Hovedet sidder lavt og fremme (til venstre) foran skuldrene; ansigtet er vendt en trekvart mod venstre.
    headCenter: { x: 94, y: 100 },
    headRx: 44,
    headRy: 38,
    // Hatte sidder på issen: ankeret ligger over den, så skyggen og kanten går fri af øjnene.
    headTop: { x: 96, y: 54 },
    headWidth: 96,
    earBaseL: { x: 76, y: 68 },
    earBaseR: { x: 126, y: 70 },
    // Hatte mellem ørerne sidder på issen.
    earGap: 56,
    hornBase: { x: 96, y: 64 },
    eyeL: { x: 76, y: 98 },
    eyeR: { x: 112, y: 97 },
    eyeRx: 9.2,
    eyeRy: 11.6,
    muzzle: { x: 60, y: 122 },
    mouth: { x: 60, y: 135 },
    cheekL: { x: 68, y: 115 },
    cheekR: { x: 121, y: 113 },
    neck: { x: 94, y: 142 },
    neckWidth: 54,
    bodyCenter: { x: 106, y: 184 },
    bodyRx: 53,
    bodyRy: 42,
    bodyWidth: 104,
    chest: { x: 90, y: 166 },
    back: { x: 112, y: 170 },
    shoulderL: { x: 80, y: 168 },
    shoulderR: { x: 112, y: 170 },
    pawL: { x: 80, y: 216 },
    pawR: { x: 112, y: 216 },
    handRot: -20,
    footL: { x: 50, y: 220 },
    footR: { x: 150, y: 220 },
    tailBase: { x: 167, y: 191 },
  },
  bounds: {
    head: { x0: 22, y0: 50, x1: 142, y1: 145 },
    body: { x0: 30, y0: 128, x1: 176, y1: 229 },
  },
  // Tankebobler og Zzz (fælles regel): til højre for kinden under øret med mindst 8 enheders luft.
  fx: { x: 164, y: 106 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 22, behind: true, clip: false },
  signature: 'sniff',
  // Guldets glansbånd på ryggen bag hovedet.
  goldBand: [290, 330],
  // Ups: poten op til kinden ved snuden (de kraftige forben når ikke om bag nakken).
  poses: {
    happy: { pawL: { up: true, rot: 30 }, pawR: { up: true, rot: 30 } },
    oops: { pawL: 0, pawR: { up: true } },
  },
  parts: {
    head: bearHead,
    body: bearBody,
    Ear,
    Paw: Leg,
    PawUp,
    PawBack: withKeyWebs(pawWebs({}, PAW_WEBS)),
    pawUpTip: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { x: tipOf(s)[0], y: tipOf(s)[1] }])),
    upArms: Object.fromEntries(Object.entries(UP_SPINES).map(([k, s]) => [k, { spine: s, w0: UP_W.w0, w1: UP_W.w1, tip: 8 }])),
    limb: { rot: 0, sleeve: () => blob(LEG_SLEEVE), cuff: { y: 35, half: 15.4 } },
    Feet,
    Muzzle: Snout,
    BodyDeco,
  },
}

export default polarbear
