// Isbjørnen (Stjernefjeldet, bølge 3): skabelonen `round`, én race (std). Artstrækkene står i silhuetten, så isbjørnen
// aldrig læses som en panda, en hamster eller en hvalp (review G2-r1 §2 og integratorens fire blinde for-test):
// - hovedet sidder lavt og fremme foran skuldrene og er vendt en trekvart mod venstre, så den lange snude med lige,
//   "romersk" profil stikker ud af omridset (pandaen og hamsteren har runde hoveder uden snude),
// - meget små, runde ører lavt bag på hovedet (klippet uden for hovedet, så de sidder bag det; med hat titter de frem
//   ved hattens kant; pandaens store ører sidder højt),
// - en krop, der er bredere end høj, med en ryglinje, der stiger bag hovedet og falder mod hoften til højre,
// - kraftige forben med store, flade poter, den nære bagpote og en halestump ved hoften, og
// - artens kendetegn (som pandaens bambus): en lille fisk på jorden ved venstre forpote med løftet, kløvet halefinne.
// Hvid pels på papirfarven bæres af konturen og cel-skyggen (og en fold langs snudens ryg, der viser dens længde).
// Signaturen er snuse-næsen: næsen snuser tre gange med squash og et overshoot, mens hovedet løfter sig mod luften
// (`a-sniff` om snusets led på snudens ryg og hovedets løft i hvile, rig.css): næsetippen løfter sig 6,8–8 enheder i
// hvert snus (review G3-r1 A2). Alle former er punkter og husets primitiver.
import { ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { mixHex } from '../rig/oklch'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, frame, join, offsetLoop, poly, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { AnchorSet, OutlineFn, Palette, Part, PartCtx, SidePart, SpeciesDef, Stage } from '../rig/types'
import { FISH, POLARBEAR_COLORWAYS } from './polarbear.colorways'

const round = ROUND
/** Trædepuder og kløer (sort i silhuet). */
const pads = (pal: Palette) => pal.pattern
/** Snudens og pelsens bløde folder: en tone mellem pelsen og konturen. */
const crease = (pal: Palette) => mixHex(pal.shade, pal.outline, 0.35)

// ---------------------------------------------------------------------------------------------
// Hoved (trekvart, vendt mod venstre): en rund isse og en lang snude med lige "romersk" profil fra panden til næsen, i én
// sømløs kontur. Punkterne er forskydninger fra hovedets centrum ved headRx 44 og headRy 38 (skaleres med ankrene).

const HEAD_PTS: Vec[] = [
  [0, -38], [-20, -36.5], [-33, -30], [-42, -20], [-49.4, -9.4], [-55.8, 0.6], [-61.4, 9.4], [-65.8, 17], [-68, 23], [-66.6, 28.4],
  [-60.4, 31.8], [-50, 35], [-38, 38.6], [-24, 41.2], [-8, 41], [8, 38], [24, 31], [36, 20.4], [43.4, 6], [44, -8], [39, -21],
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
// Ører: meget små og runde, lavt og bagud på hovedet (lokalt: roden i (0,0), peger op). De tegnes i ørernes lag over
// hatten og klippes uden for hovedet (review G3-r1 T1), så de uden hat sidder bag hovedet som før og med hat titter frem
// ved hattens kant (gennem hattens ørehuller med en afrundet bund), ligesom pandaens og hamsterens ører.

const EAR_R = 7.4
const EAR: Vec[] = xf([[0, 6], [-7.4, 3], [-9.6, -4.6], [-7, -12.6], [0, -15.6], [7, -12.6], [9.6, -4.6], [7.4, 3]], { sx: 0.86 })
/** Øret i en hat med ørehuller: den del, der titter op gennem hullet, med en afrundet bund. */
const EAR_HATTED = hatted(EAR, -2, 3)
const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.1, sy: 1.1 } : {})

const Ear: SidePart = ({ pal, sw, stage, hat, ids }) => {
  const s = earScale(stage)
  const k = s.sx ?? 1
  return (
    <>
      <path d={blob(xf(hat === 'through' ? EAR_HATTED : EAR, s), 0.9)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      {!pal.silhouette && <path d={ellipse(0.6 * k, -5.8 * k, EAR_R * 0.48 * k, EAR_R * 0.54 * k)} fill={pal.gradient ? `url(#${ids.gradient})` : pal.inner} />}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Snude: den lyse snude langs hovedets venstre side, en fold langs den lige, "romerske" snudeprofil (ingen knæk fra
// pande til næse), en stor, blank næse
// for enden (signaturen snuser) og en lille næsefure ned mod munden.

const NOSE: Vec[] = xf([[0, 5.2], [-4.4, 3.4], [-8, -0.2], [-8, -3.4], [-4, -5], [0, -5.4], [4, -5], [8, -3.4], [8, -0.2], [4.4, 3.4]], { rot: -18 })
/** Næsens plads og folden langs snudens ryg (forskydninger fra hovedets centrum). */
const NOSE_AT: Vec = [-62.6, 19.8]
const BRIDGE: Vec[] = [[-27, -6.6], [-38, -0.4], [-47.6, 6.2], [-55.4, 12.6]]

/**
 * Snusets led (review G3-r1 A2): på snudens ryg over og bag næsen. Signaturens squash (rig.css `rig-sniff`) virker om
 * leddet, så næsetippen løfter sig 6,8–8 enheder op og lidt frem i hvert af de tre snus (med overshoot ned imellem) og
 * squasher samtidig, i stedet for kun at trykkes sammen på stedet; hovedet løfter sig desuden mod luften.
 */
const SNIFF_JOINT: Vec = [16, -28]
const NOSE_D = blob(xf(NOSE, { dx: -SNIFF_JOINT[0], dy: -SNIFF_JOINT[1] }), 0.85)

const Snout: Part = ({ pal, sw, a, ids, lod, still }) => {
  const sil = pal.silhouette
  const [nx, ny] = onHead(a, NOSE_AT)
  const [mx, my] = onHead(a, [-44, 25])
  const [jx, jy] = SNIFF_JOINT
  return (
    <>
      {!sil && <path d={ellipse(mx, my, 28, 15, -14)} fill={pal.belly} clipPath={`url(#${ids.headClip})`} />}
      {!sil && lod === 'full' && <path d={spline(BRIDGE.map((v) => onHead(a, v)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
      <Pivot at={{ x: nx + jx, y: ny + jy }} cls="a-sniff" still={still}>
        <path d={NOSE_D} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
        {!sil && <path d={ellipse(-3 - jx, -2.4 - jy, 2.8, 1.4, -26)} fill={pal.highlight} />}
        {/* Næsefuren følger næsen i snuset. */}
        {!sil && <path d={spline([[2.4 - jx, 5 - jy], [4.6 - jx, 10.4 - jy]])} fill="none" stroke={pal.ink} strokeWidth={sw * 0.6} {...round} />}
      </Pivot>
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Forben (lokalt om skulderen): kraftige søjler, der står lodret ned til jorden og breder sig ud i store poter med
// tåfolder og kløer. Konturen er åben ved skulderen (roden gemmer sig under hovedet og i kroppen).

const LEG: Vec[] = xf([
  [13, -12], [13.4, 4], [13.4, 18], [13.8, 30], [15.8, 40], [20, 46.6], [22, 53.4], [20.4, 59.4], [11.6, 62.4], [-1, 63.2], [-13.4, 62.4],
  [-21, 59], [-22, 52.2], [-17.6, 43], [-12.8, 30], [-12.8, 18], [-12.6, 4], [-12.2, -12],
], { sy: 0.9, dy: -1.2 })
const TOES: Vec[][] = [[[-7.4, 47.6], [-7.2, 53.2]], [[5.2, 47.6], [5.6, 53.2]]]
const CLAWS: Vec[] = [[-14, 54.6], [-1, 55.6], [12, 54.8]]
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

/**
 * Potens greb om håndgenstandene (review G3-r1 T2/B2, SPEC A17, som pandaens skjold): forbenet er en bred søjle, der
 * ellers skjuler lup, gulerod, scepter, kikkert og slikkepind (fit-regel 5: poten over håndtaget). De tegnes derfor over
 * benet (`handGrip`), og bagefter tegnes poten – benet under `GRIP_CUT` i benets ramme – igen oven på genstandens greb
 * med tæer og kløer. Klippets kant buer som knoerne på en pote og får en blød fold.
 */
const GRIP_CUT = 41
const GRIP_EDGE: Vec[] = [[-24, GRIP_CUT + 2.6], [-12, GRIP_CUT - 1.2], [0, GRIP_CUT - 2.2], [12, GRIP_CUT - 1.2], [24, GRIP_CUT + 2.6]]
const GRIP_CLIP = poly([[-40, 90], [-40, GRIP_CUT + 4], ...GRIP_EDGE, [40, GRIP_CUT + 4], [40, 90]])
const gripClip = (ids: PartCtx['ids']) => `${ids.uid}pg`
/**
 * Håndgenstandene, isbjørnen holder foran forbenet med poten om grebet: også raketten og stjernestaven, der selv står
 * foran poten (`art.over`), får tåspidserne over den nederste del (review G3-r1 T3). Skjoldet har sin egen rem.
 */
const GRIP_ITEMS = ['opdager-hand', 'rytter-hand', 'kongelig-hand', 'pirat-hand', 'milepael-slikkepind', 'hverdag-hand', 'astronaut-hand', 'talmagiker-hand'] as const

const PawGrip: SidePart = ({ pal, sw, ids, lod }) => (
  <>
    <clipPath id={gripClip(ids)}>
      <path d={GRIP_CLIP} />
    </clipPath>
    <path d={blob(LEG, 0.8)} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${gripClip(ids)})`} />
    <path d={spline(GRIP_EDGE)} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.7} clipPath={`url(#${gripClip(ids)})`} {...round} />
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
      idle: { L: [[[-15.6, -24.5], [-15.4, -25.4], [-14.7, -26], [-13.8, -26.3], [-11.9, -26.3], [-9.6, -25.9], [-8.7, -25.7], [-8.1, -25], [-7.8, -24.1], [-7.8, -23.7], [-8.1, -22.8], [-9.1, -21.7], [-10.6, -21], [-11.5, -20.7], [-12.3, -20.7], [-13.2, -21], [-15.4, -23.2], [-15.6, -24.1]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]], [[-15.6, -24.5], [-15.4, -25.4], [-14.7, -26], [-13.8, -26.3], [-11.9, -26.3], [-9.6, -25.9], [-8.7, -25.7], [-8.1, -25], [-7.8, -24.1], [-7.8, -23.7], [-8.1, -22.8], [-9.1, -21.7], [-10.6, -21], [-11.5, -20.7], [-12.3, -20.7], [-13.2, -21], [-15.4, -23.2], [-15.6, -24.1]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]]], R: [[[-9, -38.2], [-9.2, -39.1], [-9.9, -39.8], [-10.6, -40.2], [-11.6, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.9, -36.3], [-9.2, -36.9], [-9, -37.9]], [[-9, -38.2], [-9.2, -39.1], [-9.9, -39.8], [-10.6, -40.2], [-11.6, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.9, -36.3], [-9.2, -36.9], [-9, -37.9]]] },
      happy: { L: [[[-36.2, -23.7], [-34.4, -26.9], [-32.8, -27.8], [-22.6, -27.4], [-9.6, -25.9], [-8.1, -25], [-7.8, -23.7], [-9.1, -21.7], [-14.8, -18.3], [-16.9, -18.1], [-35.2, -21.7], [-36.2, -23.3]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]]], R: [[-9, -38.2], [-9.2, -39.1], [-9.9, -39.8], [-10.6, -40.2], [-11.6, -40.4], [-12.3, -40.4], [-13.2, -40.2], [-14.7, -38.8], [-14.9, -37.9], [-14.9, -37.5], [-14.7, -36.6], [-14, -35.9], [-13.1, -35.7], [-11.6, -35.7], [-10.6, -35.9], [-9.9, -36.3], [-9.2, -36.9], [-9, -37.9]] },
      cheer: { L: [[-38, 33.6], [-37.7, 32.8], [-36.2, 31.4], [-35.3, 31.2], [-34.9, 31.2], [-34, 31.5], [-33.4, 32.2], [-33.2, 33.1], [-33.2, 34.2], [-33.5, 35.1], [-34.2, 35.7], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 34.9], [-38, 34]], R: [[-19.5, -48], [-19.8, -48.9], [-21.3, -50.3], [-22.2, -50.5], [-22.6, -50.5], [-23.5, -50.2], [-24.9, -48.8], [-25.1, -47.8], [-25.1, -47.5], [-24.8, -46.6], [-24.1, -46], [-23.2, -45.8], [-21.3, -45.8], [-20.4, -46.1], [-19.7, -46.8], [-19.5, -47.7]] },
      think: { L: [[[-13.7, -25.2], [-13.5, -26.1], [-12.8, -26.8], [-11.9, -27], [-10, -27], [-8.1, -26.7], [-7.2, -26.4], [-6.5, -25.8], [-6.3, -24.8], [-6.3, -24.5], [-6.5, -23.5], [-7.2, -22.9], [-9.1, -21.7], [-10, -21.5], [-10.4, -21.5], [-11.3, -21.7], [-13.5, -23.9], [-13.7, -24.8]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]]] },
      oops: { L: [[[-22.1, -19.5], [-21.9, -20.4], [-21.2, -21.1], [-20.3, -21.3], [-16.9, -21.3], [-15.9, -21.1], [-15.3, -20.4], [-15, -19.5], [-15, -19.1], [-15.3, -18.2], [-17.1, -16.4], [-18, -16.2], [-19.1, -16.2], [-20, -16.4], [-21.9, -18.2], [-22.1, -19.1]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]]], R: [[-5.2, -39], [-5.4, -39.9], [-6.1, -40.6], [-7.2, -41.3], [-8.1, -41.6], [-8.5, -41.6], [-9.4, -41.3], [-11.2, -39.5], [-11.5, -38.6], [-11.5, -38.2], [-11.2, -37.3], [-10.6, -36.7], [-9.7, -36.4], [-8.5, -36.4], [-7, -36.8], [-6.1, -37], [-5.4, -37.7], [-5.2, -38.6]] },
      sleep: { L: [[[-16.8, -23.1], [-16.5, -24.1], [-15.9, -24.8], [-15, -25], [-13.1, -25], [-12.1, -24.8], [-11, -24.4], [-10.3, -23.7], [-10.1, -22.7], [-10.1, -22.3], [-10.3, -21.4], [-11, -20.7], [-12.1, -19.9], [-13.1, -19.7], [-13.8, -19.7], [-14.7, -19.9], [-16.5, -21.8], [-16.8, -22.7]], [[-38.1, 33.6], [-37.8, 32.6], [-36.4, 31.2], [-35.5, 30.9], [-35.1, 30.9], [-34.2, 31.2], [-33.5, 31.8], [-33.3, 32.8], [-33.3, 34], [-33.5, 34.9], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 34.9], [-38.1, 34]]] },
      wave: { L: [[[-22.1, -19.5], [-21.9, -20.4], [-21.2, -21.1], [-20.3, -21.3], [-16.9, -21.3], [-15.9, -21.1], [-15.3, -20.4], [-15, -19.5], [-15, -19.1], [-15.3, -18.2], [-17.1, -16.4], [-18, -16.2], [-19.1, -16.2], [-20, -16.4], [-21.9, -18.2], [-22.1, -19.1]], [[-38.1, 33.7], [-37.8, 32.8], [-36.4, 31.3], [-35.5, 31.1], [-35.1, 31.1], [-34.2, 31.3], [-33.5, 32], [-33.3, 32.9], [-33.3, 34.1], [-33.5, 35], [-34.2, 35.6], [-35.1, 35.9], [-36.2, 35.9], [-37.1, 35.6], [-37.8, 35], [-38.1, 34.1]]], R: [[-5.2, -39], [-6.1, -40.6], [-21.1, -53.4], [-22.3, -53.1], [-24.8, -50], [-24.5, -48.7], [-14.4, -35.5], [-13.1, -35.3], [-6.1, -37], [-5.2, -38.6]] },
    },
    2: {
      idle: { L: [[[-11.3, -24.8], [-11.2, -25.4], [-10.7, -25.9], [-10, -26.1], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.9, -22.2], [-8.6, -22.1], [-8.9, -22.1], [-9.6, -22.2], [-11.2, -23.8], [-11.3, -24.5]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]], [[-11.3, -24.8], [-11.2, -25.4], [-10.7, -25.9], [-10, -26.1], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.9, -22.2], [-8.6, -22.1], [-8.9, -22.1], [-9.6, -22.2], [-11.2, -23.8], [-11.3, -24.5]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]]], R: [[[-6.7, -38.2], [-6.8, -38.8], [-7.6, -39.6], [-8.3, -39.8], [-8.8, -39.8], [-9.5, -39.6], [-10.5, -38.6], [-10.7, -37.9], [-10.7, -37.6], [-10.5, -36.9], [-10.1, -36.5], [-9.4, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-6.8, -37.2], [-6.7, -37.9]], [[-6.7, -38.2], [-6.8, -38.8], [-7.6, -39.6], [-8.3, -39.8], [-8.8, -39.8], [-9.5, -39.6], [-10.5, -38.6], [-10.7, -37.9], [-10.7, -37.6], [-10.5, -36.9], [-10.1, -36.5], [-9.4, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-6.8, -37.2], [-6.7, -37.9]]] },
      happy: { L: [[[-11.3, -24.8], [-11.2, -25.4], [-10.7, -25.9], [-10, -26.1], [-6.7, -26.1], [-6, -25.9], [-5.5, -25.4], [-5.3, -24.8], [-5.3, -24.5], [-5.5, -23.8], [-6, -23.3], [-7.9, -22.2], [-8.6, -22.1], [-8.9, -22.1], [-9.6, -22.2], [-11.2, -23.8], [-11.3, -24.5]], [[-35.2, 4.9], [-35, 4.3], [-34.6, 3.8], [-33.9, 3.6], [-33.3, 3.6], [-32.7, 3.8], [-32.1, 4.1], [-31.6, 4.6], [-31.4, 5.2], [-31.4, 5.5], [-31.6, 6.2], [-32.4, 6.9], [-33.1, 7.1], [-33.3, 7.1], [-34, 6.9], [-35, 5.9], [-35.2, 5.2]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]]], R: [[-6.7, -38.2], [-6.8, -38.8], [-7.6, -39.6], [-8.3, -39.8], [-8.8, -39.8], [-9.5, -39.6], [-10.5, -38.6], [-10.7, -37.9], [-10.7, -37.6], [-10.5, -36.9], [-10.1, -36.5], [-9.4, -36.3], [-8.3, -36.3], [-7.6, -36.5], [-6.8, -37.2], [-6.7, -37.9]] },
      cheer: { L: [[-36.4, 34.3], [-36.2, 33.6], [-35.1, 32.6], [-34.4, 32.5], [-34.1, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.9, 34.7], [-33.1, 35.3], [-33.6, 35.8], [-34.2, 35.9], [-35.1, 35.9], [-35.7, 35.7], [-36.2, 35.2], [-36.4, 34.5]], R: [[[-13.9, -45.8], [-14.1, -46.5], [-15.3, -47.8], [-16.1, -48.5], [-16.7, -48.7], [-17.3, -48.7], [-18, -48.5], [-19.2, -47.1], [-19.4, -46.5], [-19.4, -46.2], [-19.2, -45.6], [-18.7, -45.1], [-16.4, -44.1], [-15.7, -43.9], [-15.2, -43.9], [-14.5, -44.1], [-14.1, -44.6], [-13.9, -45.3]], [[-5.6, -38.2], [-5.8, -38.9], [-7.4, -40.4], [-9.7, -42.2], [-10.4, -42.4], [-10.7, -42.4], [-11.3, -42.2], [-11.8, -41.7], [-12, -41], [-11.9, -40.5], [-11.7, -39.8], [-10, -37.1], [-9.5, -36.7], [-8.8, -36.5], [-6.9, -36.6], [-6.2, -36.8], [-5.7, -37.3], [-5.6, -38]]] },
      think: { L: [[[-9.4, -25.9], [-9.2, -26.6], [-8.7, -27], [-8.1, -27.2], [-7.2, -27.2], [-5.6, -26.9], [-4.9, -26.8], [-4.4, -26.3], [-4.2, -25.6], [-4.2, -25.1], [-4.4, -24.4], [-4.9, -23.9], [-6, -23.3], [-6.7, -23.2], [-6.9, -23.2], [-7.6, -23.3], [-9.2, -24.9], [-9.4, -25.6]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]]], R: [[-14.2, -36.2], [-14.3, -36.9], [-14.8, -37.4], [-15.5, -37.6], [-16.1, -37.6], [-16.7, -37.4], [-17.5, -36.6], [-17.7, -35.9], [-17.7, -35.7], [-17.5, -35], [-17, -34.5], [-16.3, -34.3], [-15.5, -34.3], [-14.8, -34.5], [-14.3, -35], [-14.2, -35.7]] },
      oops: { L: [[[-18.6, -20.1], [-18.4, -20.7], [-17.9, -21.2], [-16.2, -22], [-15.6, -22.2], [-13.3, -22.2], [-12.7, -22], [-12.2, -21.6], [-12, -20.9], [-12, -20.6], [-12.2, -19.9], [-12.7, -19.5], [-15.2, -17.8], [-15.8, -17.6], [-16.4, -17.6], [-17.1, -17.8], [-18.4, -19.1], [-18.6, -19.8]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]]], R: [[-3.1, -38.4], [-3.2, -39.1], [-4.6, -40.4], [-5.2, -40.6], [-5.5, -40.6], [-6.2, -40.4], [-7.5, -39.1], [-7.7, -38.4], [-7.7, -38.2], [-7.5, -37.5], [-7, -37], [-6.3, -36.8], [-4.4, -36.8], [-3.7, -37], [-3.2, -37.5], [-3.1, -38.2]] },
      sleep: { L: [[[-11.3, -24.6], [-11.2, -25.3], [-10.7, -25.8], [-10, -26], [-8.3, -26], [-7.7, -25.8], [-6.8, -25.5], [-6.3, -25], [-6.2, -24.3], [-6.2, -24], [-6.3, -23.3], [-6.8, -22.8], [-7.9, -22.3], [-8.6, -22.1], [-9.2, -22.1], [-9.8, -22.3], [-11.2, -23.6], [-11.3, -24.3]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.6], [-34.4, 32.4], [-34.2, 32.4], [-33.5, 32.6], [-33, 33.1], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.4], [-33.5, 35.9], [-34.2, 36.1], [-35, 36.1], [-35.7, 35.9], [-36.2, 35.4], [-36.3, 34.7]]], R: [[-14.2, -36.1], [-14.3, -36.8], [-14.8, -37.3], [-15.5, -37.5], [-16.3, -37.5], [-17, -37.3], [-17.8, -36.5], [-17.9, -35.8], [-17.9, -35.5], [-17.8, -34.8], [-17.3, -34.3], [-16.6, -34.2], [-16.1, -34.2], [-15.4, -34.3], [-14.8, -34.6], [-14.3, -35.1], [-14.2, -35.8]] },
      wave: { L: [[[-18.8, -20.6], [-18.2, -21.8], [-16.4, -22.5], [-13.3, -22.2], [-12.2, -21.6], [-12, -20.6], [-12.7, -19.5], [-15.8, -17.6], [-16.8, -17.8], [-18.8, -20.3]], [[-36.3, 34.4], [-36.2, 33.7], [-35.1, 32.7], [-34.4, 32.5], [-34.2, 32.5], [-33.5, 32.7], [-33, 33.2], [-32.8, 33.8], [-32.8, 34.7], [-33, 35.3], [-33.5, 35.8], [-34.2, 36], [-35, 36], [-35.7, 35.8], [-36.2, 35.3], [-36.3, 34.7]]], R: [[-3.1, -38.4], [-3.2, -39.1], [-4.6, -40.4], [-5.2, -40.6], [-5.5, -40.6], [-6.2, -40.4], [-7.5, -39.1], [-7.7, -38.4], [-7.7, -38.2], [-7.5, -37.5], [-7, -37], [-6.3, -36.8], [-4.4, -36.8], [-3.7, -37], [-3.2, -37.5], [-3.1, -38.2]] },
    },
    3: {
      idle: { L: [[[-9.6, -25.3], [-9.4, -25.9], [-9, -26.3], [-8.5, -26.4], [-8, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.5, -23], [-7.1, -22.8], [-7.3, -22.8], [-7.9, -23], [-9.4, -24.5], [-9.6, -25.1]], [[-9.6, -25.3], [-9.4, -25.9], [-9, -26.3], [-8.5, -26.4], [-8, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.5, -23], [-7.1, -22.8], [-7.3, -22.8], [-7.9, -23], [-9.4, -24.5], [-9.6, -25.1]]], R: [[[-5.2, -38], [-5.3, -38.5], [-6.2, -39.4], [-6.7, -39.5], [-7.2, -39.5], [-7.8, -39.4], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.3, -36.6], [-5.7, -36.8], [-5.3, -37.2], [-5.2, -37.7]], [[-5.2, -38], [-5.3, -38.5], [-6.2, -39.4], [-6.7, -39.5], [-7.2, -39.5], [-7.8, -39.4], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.3, -36.6], [-5.7, -36.8], [-5.3, -37.2], [-5.2, -37.7]]] },
      happy: { L: [[[-9.6, -25.3], [-9.4, -25.9], [-9, -26.3], [-8.5, -26.4], [-8, -26.4], [-5.2, -26.2], [-4.7, -26], [-4.3, -25.6], [-4.1, -25.1], [-4.1, -24.9], [-4.3, -24.3], [-4.7, -23.9], [-6.5, -23], [-7.1, -22.8], [-7.3, -22.8], [-7.9, -23], [-9.4, -24.5], [-9.6, -25.1]], [[-34.4, 4.8], [-34.2, 4.2], [-33.8, 3.8], [-33.2, 3.7], [-32.5, 3.7], [-32, 3.8], [-31.6, 4.2], [-31.4, 4.8], [-31.4, 5.5], [-31.6, 6], [-32, 6.4], [-32.5, 6.6], [-32.8, 6.6], [-33.3, 6.4], [-34.2, 5.6], [-34.4, 5]]], R: [[-5.2, -38], [-5.3, -38.5], [-6.2, -39.4], [-6.7, -39.5], [-7.2, -39.5], [-7.8, -39.4], [-8.6, -38.5], [-8.8, -38], [-8.8, -37.7], [-8.6, -37.2], [-8.2, -36.8], [-7.7, -36.6], [-6.3, -36.6], [-5.7, -36.8], [-5.3, -37.2], [-5.2, -37.7]] },
      cheer: { L: [[-35.6, 34.5], [-35.5, 34], [-34.6, 33.2], [-34, 33.1], [-33.8, 33.1], [-33.2, 33.2], [-32.8, 33.6], [-32.7, 34.2], [-32.7, 34.9], [-32.9, 35.4], [-33.3, 35.8], [-33.9, 35.9], [-34.6, 35.9], [-35.1, 35.7], [-35.5, 35.3], [-35.6, 34.8]], R: [[-4.4, -38.1], [-11.7, -45.7], [-13, -46.4], [-13.7, -46.2], [-15.4, -44.1], [-15.2, -43.3], [-9.4, -36.3], [-8.7, -36.2], [-4.9, -36.9], [-4.4, -37.9]] },
      think: { L: [[-7.3, -26], [-6.7, -27], [-5, -27.1], [-3.3, -26.7], [-2.7, -25.8], [-2.9, -25], [-4.7, -23.9], [-5.7, -23.7], [-6.7, -24.3], [-7.3, -25.8]] },
      oops: { L: [[-15.4, -20.7], [-15.2, -21.2], [-14.8, -21.6], [-14.3, -21.8], [-13.3, -22], [-12.9, -22], [-12.3, -21.9], [-11.9, -21.5], [-11.8, -20.9], [-11.8, -20.7], [-11.9, -20.1], [-12.5, -19.5], [-13, -19.3], [-13.6, -19.1], [-14, -19.1], [-14.6, -19.3], [-15.2, -19.9], [-15.4, -20.5]], R: [[-1.7, -38.2], [-1.9, -38.7], [-3, -39.9], [-3.5, -40], [-4, -40], [-4.5, -39.9], [-5.6, -38.7], [-5.8, -38.2], [-5.8, -38], [-5.6, -37.4], [-5.2, -37], [-4.7, -36.9], [-2.8, -36.9], [-2.3, -37], [-1.9, -37.4], [-1.7, -38]] },
      sleep: { L: [[-8.9, -25.5], [-8.3, -26.5], [-7.3, -26.6], [-5.6, -26.2], [-4.5, -25.6], [-4.4, -24.7], [-4.9, -23.7], [-6.4, -23.1], [-7.4, -23.3], [-8.9, -25.2]], R: [[-11.9, -36.6], [-12, -37.1], [-12.7, -37.8], [-13.2, -38], [-13.5, -38], [-14, -37.8], [-14.9, -36.9], [-15, -36.3], [-15, -36.1], [-14.9, -35.5], [-14.5, -35.1], [-13.9, -34.9], [-13.2, -34.9], [-12.7, -35.1], [-12, -35.8], [-11.9, -36.3]] },
      wave: { L: [[-17, -20.7], [-16.4, -21.6], [-13.2, -22.8], [-12.4, -23], [-11.2, -22.6], [-10.6, -21.6], [-10.8, -20.8], [-13.9, -18.6], [-15, -18.4], [-16.8, -19.9]], R: [[-1.7, -38.2], [-1.9, -38.7], [-3, -39.9], [-3.5, -40], [-4, -40], [-4.5, -39.9], [-5.6, -38.7], [-5.8, -38.2], [-5.8, -38], [-5.6, -37.4], [-5.2, -37], [-4.7, -36.9], [-2.8, -36.9], [-2.3, -37], [-1.9, -37.4], [-1.7, -38]] },
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
// Bag kroppen: den nære bagpote ved hoften, en lille halestump og fisken: artens kendetegn (som pandaens bambus), en
// lille fisk, der ligger på jorden ved venstre forpote med hovedet under poten og halefinnen ude til venstre, så den
// også står i sort silhuet. Den ligger der i alle humør og stadier (også med tøj og håndgenstande i højre pote).

const HIND_NEAR = { cx: 150, cy: 219.4, rx: 18.6, ry: 8, rot: 4 }
const HIND_TOES: Vec[][] = [[[156, 214.4], [157.2, 220.4]], [[163.4, 215.6], [164.4, 221.2]]]
const TAIL_STUB = { cx: 167.4, cy: 191, rx: 8.2, ry: 7.4, rot: 20 }

/** Fisken lokalt (hovedet mod højre, halen mod venstre), lagt på jorden og vippet, så halefinnen løfter sig. */
const FISH_AT = { rot: 14, sx: 1.22, dx: 56, dy: 215.2 }
const fishPts = (pts: readonly Vec[]) => xf(pts, FISH_AT)
const FISH_BODY = fishPts([[22, 0.6], [17.4, -5.6], [8, -8.4], [-4, -8.2], [-13.6, -5.4], [-18.6, 0], [-13.6, 5.6], [-4, 8.4], [8, 8.6], [17.4, 6.4]])
const FISH_TAIL = fishPts([[-16, 0], [-25.6, -10.6], [-30.4, -10], [-26.4, 0], [-30.4, 10], [-25.6, 10.6]])
const FISH_BELLY = fishPts([[15, 4.4], [6, 7], [-5, 6.8], [-12, 3.6], [-4, 3.4], [7, 3.4]])
const FISH_STRIPES = [fishPts([[-7, -7], [-8.4, 0], [-7, 7]]), fishPts([[0, -7.8], [-1.2, 0], [0, 7.8]])]
const FISH_EYE = fishPts([[13.6, -1.8]])[0]
const FISH_D = { body: blob(FISH_BODY, 0.9), tail: blob(FISH_TAIL, 0.75), belly: blob(FISH_BELLY, 0.9) }

const Fish: Part = ({ pal, sw, lod }) => {
  const sil = pal.silhouette
  return (
    <>
      <path d={FISH_D.tail} fill={sil ? pal.fur : FISH.fin} stroke={sil ? pal.fur : FISH.outline} strokeWidth={sw * 0.8} {...round} />
      <path d={FISH_D.body} fill={sil ? pal.fur : FISH.body} stroke={sil ? pal.fur : FISH.outline} strokeWidth={sw * 0.8} {...round} />
      {!sil && <path d={FISH_D.belly} fill={FISH.belly} />}
      {!sil && lod === 'full' && <path d={join(...FISH_STRIPES.map((l) => spline(l)))} fill="none" stroke={FISH.stripe} strokeWidth={sw * 0.5} {...round} />}
      {!sil && <path d={ellipse(FISH_EYE[0], FISH_EYE[1], 1.8, 1.8)} fill={FISH.outline} />}
    </>
  )
}

const Feet: Part = (p) => {
  const { pal, sw, lod, ids } = p
  const e = (o: typeof HIND_NEAR) => ellipse(o.cx, o.cy, o.rx, o.ry, o.rot)
  return (
    <>
      {/* Regnbuen (review G3-r1 A1): halestumpen bærer de fire flade striber. */}
      {pal.gradient ? (
        <>
          <path d={e(TAIL_STUB)} fill={`url(#${ids.gradient})`} stroke={pal.outline} strokeWidth={sw} {...round} />
          <path d={e(HIND_NEAR)} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
        </>
      ) : (
        <path d={join(e(TAIL_STUB), e(HIND_NEAR))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      )}
      {lod === 'full' && !pal.silhouette && <path d={join(...HIND_TOES.map((t) => spline(t)))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
      {Fish(p)}
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Krop: en lys mave, en blød pelstot under hagen og lårets fold ved hoften. Regnbuen (review G3-r1 A1): i stedet for
// maven en bred smæk med de fire flade striber, der går ud over forbenene på begge sider og hen over flanken. Den ligger
// i kravens lag over cel-skyggen (`Ruff`), så alle fire striber ses i hvile, også ved 48 px.

const TUFT: Vec[][] = [[[86, 146], [89, 151.4], [91.4, 147.6]], [[96.6, 147.6], [99, 151.4], [102, 146]]]
const THIGH: Vec[] = [[128, 214], [128.6, 200], [136, 189], [148, 184], [158, 186.4]]

const BodyDeco: Part = ({ pal, a, ids, sw, lod }) => (
  <>
    {!pal.gradient && (
      <path d={ellipse(a.bodyCenter.x - 12, a.bodyCenter.y + 8, a.bodyRx * BODY_WIDE * 0.5, a.bodyRy * 0.76)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
    )}
    {lod === 'full' && !pal.silhouette && <path d={join(...TUFT.map((t) => spline(t)), spline(THIGH))} fill="none" stroke={crease(pal)} strokeWidth={sw * 0.5} {...round} />}
  </>
)

/** Regnbuens smæk (kun regnbuen): de fire flade striber over cel-skyggen, klippet til kroppen. */
const RainbowBib: Part = ({ pal, a, ids }) =>
  pal.gradient ? (
    <path d={ellipse(a.bodyCenter.x - 2, a.bodyCenter.y + 15, a.bodyRx * BODY_WIDE * 0.93, a.bodyRy * 0.76)} fill={`url(#${ids.gradient})`} clipPath={`url(#${ids.bodyClip})`} />
  ) : null

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
    // Ørerne sidder lavt bag på hovedet og lidt ude til siden, så de titter frem ved hattens kant (review G3-r1 T1).
    earBaseL: { x: 71, y: 69 },
    earBaseR: { x: 131, y: 72 },
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
    footL: { x: 52, y: 220 },
    footR: { x: 150, y: 220 },
    tailBase: { x: 167, y: 191 },
  },
  bounds: {
    head: { x0: 22, y0: 50, x1: 142, y1: 145 },
    body: { x0: 16, y0: 128, x1: 176, y1: 229 },
  },
  // Snuden og næsen rækker ud til venstre for hovedets ellipse; hovedudsnittet tager dem med (QA3b P2-6).
  snoutBox: { x0: 20, y0: 104, x1: 60, y1: 142 },
  // Tankebobler og Zzz (fælles regel): til højre for kinden under øret med mindst 8 enheders luft.
  fx: { x: 164, y: 106 },
  face: { idleMouth: 'smile', cheeks: true },
  ears: { splay: 22 },
  // Lup, gulerod, scepter, kikkert, slikkepind, ballonens snor, raket og stjernestav holdes foran det brede forben, og
  // poten griber om den nederste del (review G3-r1 T2/B2 og T3, SPEC A17, som pandaens skjold).
  handGrip: { items: GRIP_ITEMS, Grip: PawGrip },
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
    Ruff: RainbowBib,
  },
}

export default polarbear
