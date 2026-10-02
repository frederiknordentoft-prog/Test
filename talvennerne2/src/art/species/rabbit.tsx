// Kaninen – guldstandarden for stilen (bølge 1). Tre racer:
// - upright: stående ører; det højre øre har et lille knæk (kaninens ejerbare særpræg).
// - lop: vædderen med lange, smalle hængeører forbi kinderne og en synlig ørebase (krone).
// - lionhead: løvehoved med en manke af strøgne totter, skæg under hagen og korte ører.
// Fælles: armene forsvinder ind under hovedet (åben skulder, når de løftes), lårbule, lange
// fremadrettede bagfødder, en stor halekvast med luft til foden og brystfnug under hagen.
// Alle former beskrives med punkter og husets primitiver (ingen path-literaler).
import { OpenLimb, ROUND, hatted, limbLoop, padsPath, pawWebs } from '../parts/kit'
import type { PawWebs } from '../parts/kit'
import { Pivot } from '../rig/Rig'
import { blob, ellipse, join, mirrorX, ribbon, scallop, spline, xf } from '../rig/shapes'
import type { Vec } from '../rig/shapes'
import type { Part, SidePart, SpeciesDef, Stage } from '../rig/types'
import { RABBIT_COLORWAYS } from './rabbit.colorways'

const round = ROUND
const hair = (pal: { gradient?: readonly string[]; mane: string }, gradientId: string) => (pal.gradient ? `url(#${gradientId})` : pal.mane)

// ---------------------------------------------------------------------------------------------
// Ører (lokalt: basen i (0,0), peger op). Venstre øre tegnes; riggen spejler det højre.

/** Stående øre: langt blad, lidt mere bug på ydersiden, rund spids. */
const UPRIGHT_EAR: Vec[] = [
  [0, 10], [-7.8, 7], [-9.6, -6], [-11.4, -21], [-11, -35], [-8.2, -47], [-4.2, -53.4], [0, -55],
  [4.4, -53.2], [7.9, -47.2], [10.4, -35], [10.6, -21], [9, -6], [7.6, 7],
]
const UPRIGHT_INNER: Vec[] = [
  [0, -2], [-4.6, -8], [-6, -21], [-5.6, -34], [-3.4, -44], [0, -47.5], [3.4, -44.2], [5.4, -34],
  [5.6, -21], [4.4, -8],
]

/**
 * Knækket: punkter over knækket drejes om (0, KINK) – blødt over et par enheder, så konturen
 * bøjer i stedet for at knække skarpt. Negativ vinkel = udad for det (spejlede) højre øre.
 */
const KINK = -31
const KINK_ROT = -40
function kink(pts: readonly Vec[]): Vec[] {
  return pts.map(([x, y]) => {
    const w = Math.min(1, Math.max(0, (KINK + 2 - y) / 8))
    if (w === 0) return [x, y] as Vec
    return xf([[x, y]], { rot: KINK_ROT * w, about: [0, KINK] })[0]
  })
}
const KINKED_EAR = kink(UPRIGHT_EAR)
const KINKED_INNER = kink(UPRIGHT_INNER)
/** Folden ved knækket (en kort, buet streg tværs over øret). */
const CREASE: Vec[] = [[-9.4, KINK - 0.5], [-2, KINK - 3.2], [6.4, KINK - 2.2]]

const earScale = (stage: Stage) => (stage === 1 ? { sx: 1.08, sy: 0.84 } : stage === 3 ? { sy: 0.97 } : {})

const UPRIGHT_HATTED = hatted(UPRIGHT_EAR, -4, 5)
const KINKED_HATTED = hatted(KINKED_EAR, -4, 5)

const UprightEar: SidePart = ({ pal, sw, stage, side, hat }) => {
  const s = earScale(stage)
  const kinked = side === 'R'
  // Under en hue med ørehuller ender øret i en blød bund nede i hullet.
  const shape = hat === 'through' ? (kinked ? KINKED_HATTED : UPRIGHT_HATTED) : kinked ? KINKED_EAR : UPRIGHT_EAR
  const outer = xf(shape, s)
  const inner = xf(kinked ? KINKED_INNER : UPRIGHT_INNER, s)
  return (
    <>
      <path d={blob(outer)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(inner)} fill={pal.inner} />
      {kinked && !pal.silhouette && <path d={spline(xf(CREASE, s))} fill="none" stroke={pal.earOutline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

/**
 * Vædderøre: ørebasen rejser sig som en krone over issen, og øret hænger smalt ned forbi kinden,
 * så spidsen når under hagen. Tegnes foran hovedet (ingen klip); indersiden ses som en lyserød
 * stribe nederst, hvor øret drejer let fremad.
 */
/**
 * Vædderøret tegnes bag hovedet (`ears.behind`), så hovedets kontur løber ubrudt hen over ørebasen.
 * Ørets inderside er trukket ind under hovedet øverst, så der aldrig er en sprække med baggrund mellem
 * øre og hoved (review G1-r3, K1): øre og hoved er én samlet fyldflade under konturerne. Babyen har lige
 * så lange, men smallere ører, der når ned til skulderen (K6).
 */
const LOP_SPINE: Vec[] = [[10, 5], [3, -8], [-6, -7.5], [-14, -2], [-20, 10], [-23.5, 27], [-24.5, 46], [-23.5, 65], [-21, 82], [-18, 96]]
/**
 * Indersidens punkter (de første i limbLoop) skubbes ind mod hovedet: 8 enheder øverst (under hovedet)
 * og 6 enheder resten af vejen, så øret ligger ind over skulder og arm uden en sprække imellem.
 */
const LOP_CAP = 7
const tuckInner = (loop: readonly Vec[], n: number): Vec[] =>
  loop.map(([x, y], i) => {
    // Spidsens bue følger med og aftager rundt om spidsen, så indersiden går blødt over i spidsen.
    if (i >= n) return i < n + LOP_CAP - 1 ? ([x + 6 * (1 - (i - n + 1) / LOP_CAP), y] as Vec) : ([x, y] as Vec)
    const k = y <= 16 ? 1 : y >= 38 ? 0 : (38 - y) / 22
    return [x + 6 + 2 * k, y] as Vec
  })
const LOP_EAR = tuckInner(limbLoop(LOP_SPINE, 15, 17.5, LOP_CAP), LOP_SPINE.length)
const LOP_INNER = ribbon([[-19.4, 40], [-19.8, 56], [-18.8, 72], [-16.6, 86], [-15.6, 94]], [0, 5.5, 7, 6, 0])

const LopEar: SidePart = ({ pal, sw, stage }) => {
  const s = stage === 1 ? { sx: 0.88, sy: 0.9 } : {}
  return (
    <>
      <path d={blob(xf(LOP_EAR, s))} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
      <path d={blob(xf(LOP_INNER, s), 0.8)} fill={pal.inner} opacity={0.9} />
    </>
  )
}

/** Løvehovedets ører: kortere end den oprette kanins, men lange nok til at rejse sig klart over manken (K6). */
const SHORT_EAR = xf(UPRIGHT_EAR, { sy: 0.84, sx: 1.04 })
const SHORT_HATTED = hatted(SHORT_EAR, -4, 4.5)
const SHORT_INNER = xf(UPRIGHT_INNER, { sy: 0.82, sx: 1.02 })
const ShortEar: SidePart = ({ pal, sw, hat }) => (
  <>
    <path d={blob(hat === 'through' ? SHORT_HATTED : SHORT_EAR)} fill={pal.earFur} stroke={pal.earOutline} strokeWidth={sw} {...round} />
    <path d={blob(SHORT_INNER)} fill={pal.inner} />
  </>
)

// ---------------------------------------------------------------------------------------------
// Arme. Hvilende: kort, buttet arm hvis top forsvinder ind under hovedet (skulderen er skjult).
// Løftet (jubel, vink, tænker): tegnes foran hovedet med åben kontur, hvor armen vokser ud af brystet.

const PAW_ROT = -26
/** Hvilende arm (lodret, før drejningen): kort og buttet med en rund pote, der hviler mod brystet. */
const PAW_RAW: Vec[] = [
  [-7.6, -13], [-9.2, -3], [-9.8, 6], [-10.8, 13.5], [-10.6, 20], [-7.6, 25.2], [-2.2, 27.4], [3.4, 27.2],
  [8.4, 24.6], [10.8, 19], [10.2, 11], [9, 2], [8, -6], [0, -15],
]
const PAW: Vec[] = xf(PAW_RAW, { rot: PAW_ROT })
/** Ærmet: armen fra skulderen til manchetten, en anelse løsere end armen (lodret ramme). */
const SLEEVE: Vec[] = [
  [0, -17], [-9, -14.5], [-10.8, -3.5], [-11.4, 5], [-12, 12.5], [-6, 13.8], [0, 14.2], [6, 13.8], [11.8, 12.5],
  [11, 3], [9.8, -5], [9, -14],
]
const PAW_TOE_LINES: Vec[][] = [
  [[-3.4, 26.6], [-3, 22]],
  [[2.4, 26.8], [2.2, 22.2]],
]
const PAW_TOES = PAW_TOE_LINES.map((t) => xf(t, { rot: PAW_ROT }))

const Paw: SidePart = ({ pal, sw, lod }) => (
  <>
    <path d={blob(PAW)} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
    {lod === 'full' && <path d={join(...PAW_TOES.map((t) => spline(t)))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
  </>
)

/** Løftede arme (lokalt om skulderen). Roden ligger på brystet; konturen er åben dér. */
const UP_SPINES = {
  cheer: [[7.5, 20], [-1.5, 10], [-11.5, 0], [-20.5, -10], [-27.5, -20]] as Vec[],
  wave: [[8.5, 19], [-3.5, 14], [-16.5, 11], [-26.5, 4], [-31.5, -7], [-33.5, -21]] as Vec[],
  think: [[5.5, 20], [11.5, 12], [17.5, 5], [21.5, -1]] as Vec[],
  // Ups: albuen ud til siden og poten op bag nakken (tegnes bag hovedet, så spidsen skjules).
  oops: [[3, 12], [-8, 7], [-19, 3], [-27, -4], [-29.5, -15], [-26, -27], [-20, -37], [-14.5, -45]] as Vec[],
}
const UP_LOOPS = {
  cheer: limbLoop(UP_SPINES.cheer, 15, 18.5),
  wave: limbLoop(UP_SPINES.wave, 15, 18.5),
  think: limbLoop(UP_SPINES.think, 15, 18),
  oops: limbLoop(UP_SPINES.oops, 15, 17),
}
const tipOf = (s: readonly Vec[]) => s[s.length - 1]

const PawUp: SidePart = ({ pal, sw, mood, lod }) => {
  const kind = mood === 'wave' ? 'wave' : mood === 'think' ? 'think' : mood === 'oops' ? 'oops' : 'cheer'
  const [tx, ty] = tipOf(UP_SPINES[kind])
  // Poten vender håndfladen mod os ved jubel og vink (puder), og ses fra siden ved tænker (tålinjer);
  // bag nakken (ups) er poten skjult af hovedet.
  const detail =
    kind === 'oops'
      ? null
      : kind === 'think'
      ? lod === 'full' && <path d={join(spline([[tx + 1.5, ty - 6], [tx + 5, ty - 3.5]]), spline([[tx + 3, ty - 1], [tx + 6.6, ty + 1.6]]))} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />
      : !pal.silhouette && <path d={padsPath(tx, ty + 0.5, 8.2, kind === 'wave' ? -4 : -38)} fill={pal.inner} />
  return (
    <OpenLimb loop={UP_LOOPS[kind]} fill={pal.fur} stroke={pal.outline} sw={sw}>
      {detail}
    </OpenLimb>
  )
}

/**
 * Fyld bag kroppen ved armene (lokalt om skulderen som `UP_SPINES`; højre side spejlet): langs armen,
 * ind under hagen og ned i brystet. Kun lommen mellem arm, hage, øre og krop bliver synlig, så der aldrig
 * ses baggrund inde i figuren (huller-lint, review G1-r3). Nøgle: humør og side.
 */
const CHEER_WEB: Vec[] = [[7.5, 20], [-1.5, 10], [-11.5, 0], [-19, -9], [-10, -15], [4, -12], [22, -2], [20, 14]]
const WEBS: PawWebs = {
  cheer: { L: CHEER_WEB, R: CHEER_WEB },
  oops: {
    R: [
      [3, 12], [-8, 7], [-19, 3], [-25, -5], [-22, -18], [-20.7, -20.4], [-19.4, -23.9], [-17.6, -27.6], [-16, -28.4],
      [-14.9, -28], [-11.7, -20], [-9, -20], [6, -12], [14, -4], [12, 8],
    ],
  },
}
/**
 * Racernes ekstra fyld pr. stadie, skabt fra lommernes hylstre over alle animationsbilleder: babyens store
 * hoved, vædderens hængeører og løvehovedets kindtotter lukker vinduer mod armene.
 */
const UPRIGHT_WEBS: Record<Stage, PawWebs> = {
  1: { wave: { R: [[-25.3, -19.4], [-23.1, -19.4], [4.3, -3.4], [4.3, -0.5], [-2.1, 4.5], [-9.7, 4.5], [-16.2, 2.6], [-20, -0.5], [-23.4, -7.6], [-25.7, -16]] } },
  2: {},
  3: {},
}
const LION_WEBS: Record<Stage, PawWebs> = {
  1: { wave: { R: [[-20.7, -4.9], [-15.1, -6.9], [-13.2, -6.5], [-4.8, -1.1], [-2.9, 3], [-4.4, 4.5], [-9.7, 4.5], [-16.2, 2.6], [-20, -0.5], [-21.1, -3.1]] } },
  2: { wave: { R: [[-19.2, -1], [-9.7, -4.7], [-8.6, -4.3], [-4.7, 2.9], [-4.7, 5.1], [-5.8, 5.5], [-9.7, 5.5], [-14.2, 4.4], [-17.5, 2.9], [-19.2, 1.2]] } },
  3: { wave: { R: [[-14.7, 3.6], [-13.9, 2], [-11.6, 0.6], [-9.5, -0.3], [-8.4, 0.1], [-7.1, 4], [-7.5, 5.1], [-8.6, 5.5], [-11.9, 5.5], [-14.3, 4.7]] } },
}
const LOP_WEBS: Record<Stage, PawWebs> = {
  1: {
    wave: { R: [[-21.1, -13], [-18.1, -14.5], [-14.7, -13.3], [4.3, -3.4], [4.3, -0.5], [-2.1, 4.5], [-9.7, 4.5], [-16.2, 2.6], [-20, -0.5], [-21.9, -4.6]] },
  },
  2: {
    wave: {
      L: [[-17, -0.2], [-15.4, -1.8], [-13, -1.3], [-10.8, -0.4], [-7.6, 7.6], [-6.8, 9.9], [-7.2, 11.3], [-9.9, 14.9], [-12.1, 14.9], [-16.4, 2.4]],
      R: [[-14.6, -11.6], [-13.6, -14.3], [-10.3, -14.3], [6.4, -3.8], [6.4, -1], [4.2, 1.2], [-2.5, 5.5], [-9.7, 5.5], [-13, 4.5], [-14.6, -4.3]],
    },
    think: { R: [[-16.4, -0.4], [-14.7, -0.8], [-2.5, 3.5], [-1.6, 5.1], [-2.5, 6.8], [-8.6, 12.9], [-10.8, 13.8], [-11.9, 13.4], [-15.7, 5.1], [-16.8, 1.8]] },
    oops: { L: [[-17, -0.2], [-15.7, -2.1], [-14, -2.5], [-11.3, -1.3], [-6.8, 9.6], [-7.3, 11.5], [-9.4, 14], [-12.1, 14.4], [-13.1, 12.2], [-16.9, 1.3]] },
    sleep: {
      R: [[-16.2, -0.3], [-15.1, -0.7], [-10.9, 0.9], [-9.2, 2.5], [-6, 9.4], [-6.6, 11.2], [-9.4, 14.7], [-12.2, 14.7], [-14.3, 9.1], [-16.6, 1.4]],
    },
  },
  3: {
    wave: { R: [[-10.6, -10.3], [-9.2, -12.8], [-6.1, -13.3], [7.8, -4], [7.8, -1.4], [0.4, 4.7], [-2.6, 6], [-5.8, 6], [-9.2, 5.1], [-9.6, 4]] },
    think: { R: [[-12, -0.8], [-10.5, -1.2], [-0.6, 2.5], [-0.2, 3.6], [-0.6, 5.1], [-4.7, 9.3], [-6.8, 10.1], [-9.2, 9.3], [-10.1, 7.3], [-12.4, 1.2]] },
  },
}
/** Fyld bag alt ved armene (se `pawWebs`): lommernes udvidede hylstre pr. race, stadie, humør og side. */
const PAW_WEBS: Partial<Record<string, Partial<Record<Stage, PawWebs>>>> = {
  lionhead: {
    2: {
      think: { L: [[24.9, -99.9], [25.3, -101], [26.4, -101.4], [27.5, -101], [27.9, -99.9], [27.5, -98.8], [26.4, -98.4], [25.3, -98.8]] },
      wave: { R: [[23.8, -101], [24.2, -102.1], [25.3, -102.5], [26.4, -102.1], [26.8, -101], [26.4, -99.9], [25.3, -99.5], [24.2, -99.9]] },
    },
    3: {
      oops: { L: [[-13.4, 15.1], [-13, 14], [-12.5, 13.6], [-11.4, 13.2], [-10.3, 13.6], [-9.9, 14.7], [-10.3, 15.8], [-10.8, 16.2], [-11.9, 16.6], [-13, 16.2]] },
      sleep: { R: [[-15.2, 18.6], [-14.8, 17.5], [-13.7, 17.1], [-12.6, 17.5], [-12.2, 18.6], [-12.6, 19.7], [-13.7, 20.1], [-14.8, 19.7]] },
      think: { R: [[-14.7, 17.9], [-14.3, 16.8], [-13.2, 16.4], [-12.1, 16.8], [-11.7, 17.9], [-12.1, 19], [-13.2, 19.4], [-14.3, 19]] },
      wave: { L: [[-13.4, 15.1], [-13, 14], [-12.5, 13.6], [-11.4, 13.2], [-10.3, 13.6], [-9.9, 14.7], [-10.3, 15.8], [-10.8, 16.2], [-11.9, 16.6], [-13, 16.2]] },
    },
  },
  lop: {
    1: {
      cheer: { R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
      happy: { R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
      idle: { R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
      oops: { R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
      sleep: { R: [[[-18.8, 5.8], [-18.4, 4.7], [-17.3, 4.3], [-16.2, 4.7], [-15.8, 5.8], [-16.2, 6.9], [-17.3, 7.3], [-18.4, 6.9]], [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]]] },
      think: { L: [[-18.1, -8.4], [-17.7, -9.5], [-16.6, -9.9], [-15.5, -9.5], [-15.1, -8.4], [-15.5, -7.3], [-16.6, -6.9], [-17.7, -7.3]], R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
      wave: { R: [[-34, 66.8], [-33.6, 65.7], [-32.9, 65.3], [-31, 64.6], [-29.9, 65], [-29.5, 66.4], [-29.9, 67.5], [-31.8, 68.3], [-32.5, 68.3], [-33.6, 67.9]] },
    },
    2: {
      cheer: { R: [[[-14, 16.1], [-13.6, 15], [-12.6, 13.8], [-11.5, 13.4], [-10.4, 13.8], [-10, 14.9], [-10.4, 16], [-11.4, 17.2], [-12.5, 17.6], [-13.6, 17.2]], [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]]] },
      happy: { L: [[-12.9, -5.4], [-12.5, -6.5], [-11.4, -6.9], [-10.3, -6.5], [-9.9, -5.4], [-9.9, -4.3], [-10.3, -3.2], [-11.4, -2.8], [-12.5, -3.2], [-12.9, -4.3]], R: [[[-12.3, -5.4], [-11.9, -6.5], [-10.8, -6.9], [-9.7, -6.5], [-9.3, -5.4], [-9.3, -4.9], [-9.7, -3.8], [-10.8, -3.4], [-11.9, -3.8], [-12.3, -4.9]], [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]]] },
      idle: { R: [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]] },
      oops: { R: [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]] },
      sleep: { L: [[-14, 15.1], [-13.6, 14], [-10.8, 10], [-9.7, 9.6], [-8.6, 10], [-8.2, 11.6], [-8.6, 12.7], [-11.4, 16.2], [-12.5, 16.6], [-13.6, 16.2]], R: [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]] },
      think: { R: [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]] },
      wave: { R: [[-34.6, 66.2], [-34.2, 65.1], [-33.1, 64.7], [-28.1, 63.6], [-27, 64], [-26.6, 65.1], [-27.5, 66.8], [-31.3, 69.1], [-32.4, 69.5], [-33.5, 69.1]] },
    },
    3: {
      cheer: { R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      happy: { R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      idle: { R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      oops: { R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      sleep: { L: [[-14.3, 16.2], [-13.9, 15.1], [-12.8, 14.7], [-11.7, 15.1], [-11.3, 16.2], [-11.7, 17.3], [-12.8, 17.7], [-13.9, 17.3]], R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      think: { L: [[-11.5, 12.8], [-11.1, 11.7], [-10, 11.3], [-8.9, 11.7], [-8.5, 12.8], [-8.9, 13.9], [-10, 14.3], [-11.1, 13.9]], R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
      wave: { R: [[-37.9, 69.3], [-37.5, 68.2], [-35.6, 66.8], [-34.5, 66.4], [-33.4, 66.8], [-33, 67.9], [-33.4, 69], [-35.3, 70.4], [-36.4, 70.8], [-37.5, 70.4]] },
    },
  },
}

const PawBack = pawWebs(WEBS, { upright: UPRIGHT_WEBS, lop: LOP_WEBS, lionhead: LION_WEBS }, PAW_WEBS)

// ---------------------------------------------------------------------------------------------
// Bagben: lårbule og lange, fremadrettede bagfødder med tæer forrest. Stor (stadie 3) har større fødder.

/** Lårbulen (venstre), modelrum. */
const HAUNCH_L = { cx: 67, cy: 203, rx: 19.5, ry: 18, rot: -12 }
/** Bagfoden (venstre): hælen gemt under låret, tæerne frem og ud mod beskueren. */
const FOOT_L: Vec[] = [
  [71, 207], [61, 208.5], [51, 211.5], [43, 215.5], [38.5, 220.5], [40.5, 225], [48, 226.3], [59, 225.4],
  [69, 222.6], [75.5, 217], [75.5, 210],
]
const FOOT_TOES_L: Vec[][] = [
  [[44, 225.2], [45.6, 221]],
  [[49.8, 226], [51, 221.6]],
]
const HEEL: Vec = [70, 215]
const footScale = (stage: Stage) => (stage === 3 ? 1.12 : 1)

const Feet: Part = ({ pal, sw, stage, lod }) => {
  const k = footScale(stage)
  const big = (pts: readonly Vec[]) => (k === 1 ? [...pts] : xf(pts, { sx: k, about: HEEL }))
  const pair = (pts: readonly Vec[]) => [big(pts), mirrorX(big(pts), 100)]
  const h = HAUNCH_L
  const haunches = join(ellipse(h.cx, h.cy, h.rx, h.ry, h.rot), ellipse(200 - h.cx, h.cy, h.rx, h.ry, -h.rot))
  const [fl, fr] = pair(FOOT_L)
  const toes = FOOT_TOES_L.flatMap((t) => pair(t).map((p) => spline(p)))
  return (
    <>
      <path d={haunches} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      <path d={join(blob(fl), blob(fr))} fill={pal.fur} stroke={pal.outline} strokeWidth={sw} {...round} />
      {lod === 'full' && <path d={join(...toes)} fill="none" stroke={pal.outline} strokeWidth={sw * 0.5} {...round} />}
    </>
  )
}

/** Bomuldshalen: en stor, fnugget kvast, lysere end pelsen, med luft ned til foden. */
const Tail: Part = ({ pal, sw, ids }) => {
  const fill = pal.gradient ? `url(#${ids.gradient})` : pal.belly
  return <path d={scallop(6, -3, 13.5, 12.5, 9, 0.64, -100)} fill={fill} stroke={pal.outline} strokeWidth={sw} {...round} />
}

// ---------------------------------------------------------------------------------------------
// Ansigt: næse (med næse-vip), knurhår

const NOSE: Vec[] = [[0, 3.4], [-3.2, 1.2], [-4.6, -1.6], [-3, -3.2], [0, -3.4], [3, -3.2], [4.6, -1.6], [3.2, 1.2]]

/** Knurhår (lokalt om næsen): rødderne sidder ved næsen, så de følger med i næsevippet. */
const whisk = (s: number): string =>
  join(
    spline([[s * 14, 1], [s * 23, -1], [s * 30, -0.5]]),
    spline([[s * 14, 5], [s * 23, 6], [s * 29, 8.5]]),
  )
const WHISKERS = join(whisk(-1), whisk(1))

const Muzzle: Part = ({ pal, sw, a, still, lod }) => (
  <Pivot at={a.muzzle} cls="a-sig" still={still}>
    {!pal.silhouette && lod === 'full' && <path d={WHISKERS} fill="none" stroke={pal.outline} strokeOpacity={0.45} strokeWidth={sw * 0.42} {...round} />}
    <path d={blob(NOSE)} fill={pal.nose} stroke={pal.outline} strokeWidth={sw * 0.42} {...round} />
    {!pal.silhouette && <path d={ellipse(-1.3, -1.6, 1.4, 0.9, -15)} fill={pal.highlight} />}
  </Pivot>
)

/** Lille pandetot mellem ørerne: to lokker, klippet til "uden for hovedet", så roden er sømløs. */
const TUFT: Vec[] = [
  [92.5, 61], [93.2, 55.5], [95.6, 51.2], [98.2, 49.6], [100.4, 50.4], [101.8, 47.2], [104.2, 44.8],
  [107.2, 44.2], [106.2, 46.8], [106.9, 51.4], [108, 61],
]
const TUFT_BIG = xf(TUFT, { sx: 1.18, about: [100, 61] })
const Tuft: Part = ({ pal, sw, ids }) => (
  <path d={blob(TUFT_BIG, 1)} fill={hair(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} clipPath={`url(#${ids.outsideHead})`} {...round} />
)

/** Lys mave klippet til kroppen og et fnug af brystpels lige under hagen (større på stor). */
const BodyDeco: Part = ({ pal, a, ids, sw, stage }) => {
  const b = a.bodyCenter
  const k = stage === 3 ? 1.3 : 1
  const fluff = scallop(100, 151, 13 * k, 7.5 * k, 7, 0.62, 0)
  return (
    <>
      <path d={ellipse(b.x, b.y + 16, a.bodyRx * 0.6, a.bodyRy * 0.66)} fill={pal.belly} clipPath={`url(#${ids.bodyClip})`} />
      <path d={fluff} fill={pal.belly} stroke={pal.outline} strokeWidth={sw * 0.6} strokeLinejoin="round" />
    </>
  )
}

// ---------------------------------------------------------------------------------------------
// Hollænder-mønster (c4): farvede ører og øjenpletter med en bred hvid blis. Forfra ses den hvide
// forpart, så kroppen forbliver hvid (bagparten er farvet, men vender væk).

const DUTCH_HEAD_L: Vec[] = [
  [52, 70], [66, 59], [80, 61], [88, 73], [91, 91], [90, 108], [84, 119], [72, 121.5], [58, 116], [48, 101], [46, 84],
]

const DutchHead: Part = ({ pal, ids }) => (
  <path d={join(blob(DUTCH_HEAD_L), blob(mirrorX(DUTCH_HEAD_L, 100)))} fill={pal.pattern} clipPath={`url(#${ids.headClip})`} />
)

// ---------------------------------------------------------------------------------------------
// Halsflæse: regnbuen får en flæse i regnbuens farver (gradienten er tilladt i manke og hale);
// løvehovedet får en blød uldkrans med en mørkere inderkrans og en lille uldsky i panden.

/** Regnbuens halsflæse (i kroppens lag under trøjen; løvehovedet har sin manke i stedet). */
const RainbowRuff: Part = ({ pal, sw, ids, colorway, breed, stage }) => {
  if (colorway !== 'rainbow' || pal.silhouette || breed === 'lionhead') return null
  const k = stage === 3 ? 1.12 : stage === 1 ? 1.1 : 1
  // Klippet til kroppen og smal nok til at ligge på brystfladen inden for armene, der tegnes ovenpå
  // (review G1-r3, K4): enderne stikker aldrig ud forbi armene eller kropskonturen.
  return <path d={scallop(100, 151 + 1 * k, 25 * k, 12.5 * k, 8, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${ids.bodyClip})`} />
}

// Manken: fyldige kindtotter på begge sider og en lille krave under hagen – ikke en jævn uldring om hele
// hovedet, som læses som et lam (review G1-r2, K6). Toppen af hovedet er fri, så ørerne rejser sig klart.
const LION_CHEEKS = join(scallop(53, 121, 19, 30, 7, 0.62, -90), scallop(147, 121, 19, 30, 7, 0.62, -90))
const LION_MANE = join(LION_CHEEKS, scallop(100, 147, 36, 11, 9, 0.6, 0))
/** Babyen (stort hoved på en lille krop) får en kortere krave, så trøjen ses under den (review G1-r2, K8). */
const LION_MANE_BABY = join(LION_CHEEKS, scallop(100, 144, 33, 8, 9, 0.6, 0))
const LION_INNER = join(scallop(57, 125, 13, 22, 6, 0.58, -75), scallop(143, 125, 13, 22, 6, 0.58, -105))

const LionMane: Part = ({ pal, sw, ids, stage }) => (
  <>
    <path d={stage === 1 ? LION_MANE_BABY : LION_MANE} fill={hair(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
    {!pal.silhouette && <path d={LION_INNER} fill={pal.shade} opacity={0.55} />}
  </>
)

/** Løvehovedets runde pandetot: en lille uldsky mellem ørerne (kun det, der stikker op over hovedet). */
const LION_TUFT = scallop(100, 57, 19, 11, 7, 0.64, -90)
const LionTuft: Part = ({ pal, sw, ids }) => (
  <path d={LION_TUFT} fill={hair(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} clipPath={`url(#${ids.outsideHead})`} {...round} />
)

// ---------------------------------------------------------------------------------------------

export const rabbit: SpeciesDef = {
  id: 'rabbit',
  name: 'Kanin',
  nameClip: 'name.species.rabbit',
  family: 'lagomorph',
  body: 'round',
  breeds: [
    { id: 'upright', name: 'stående ører', fx: { x: 177, y: 92 }, ears: { splay: 10 } },
    {
      id: 'lop',
      name: 'vædder',
      fx: { x: 177, y: 54 },
      ears: { splay: 0, clip: false, hang: true, behind: true },
      // Halen sidder lidt lavere, så den aldrig rører det hængende øre og lukker en sprække inde.
      anchors: { earBaseL: { x: 66, y: 62 }, earBaseR: { x: 134, y: 62 }, earGap: 60, tailBase: { x: 155, y: 201 } },
      parts: { Ear: LopEar },
      // Hængeørerne bevæger sig ikke med humøret (de svajer blidt i alle humør).
      poses: {
        happy: { earL: 0, earR: 0 }, cheer: { earL: 0, earR: 0 }, think: { earL: 0, earR: 0 },
        oops: { earL: 0, earR: 0 }, sleep: { earL: 0, earR: 0, pawL: 8 }, wave: { earL: 0, earR: 0 },
      },
      bounds: { head: { x0: 30, y0: 46, x1: 170, y1: 178 } },
    },
    {
      id: 'lionhead',
      name: 'løvehoved',
      fx: { x: 171, y: 78 },
      ears: { splay: 12 },
      anchors: { earBaseL: { x: 74, y: 57 }, earBaseR: { x: 126, y: 57 } },
      parts: { Ear: ShortEar, ManeBack: LionMane, ManeFront: LionTuft },
      maneGrowth: 1.1,
      // Halsgenstanden (tørklæde, bandana, kompas) ligger oven på kraven under hagen (review G1-r4, B4).
      neckOverMane: true,
      bounds: { head: { x0: 28, y0: 18, x1: 172, y1: 168 } },
    },
  ],
  colorways: RABBIT_COLORWAYS,
  magic: ['gold', 'rainbow'],
  // Kaninen har de længste ører: hovedet sidder lidt lavere og er lidt mindre end standarden.
  anchors: {
    headCenter: { x: 100, y: 101 },
    headRx: 55,
    headRy: 47.5,
    headTop: { x: 100, y: 55.5 },
    headWidth: 102,
    earBaseL: { x: 71, y: 63 },
    earBaseR: { x: 129, y: 63 },
    hornBase: { x: 100, y: 57 },
    eyeL: { x: 78, y: 106 },
    eyeR: { x: 122, y: 106 },
    eyeRx: 10.4,
    eyeRy: 12.9,
    muzzle: { x: 100, y: 123.5 },
    mouth: { x: 100, y: 132 },
    cheekL: { x: 67, y: 123 },
    cheekR: { x: 133, y: 123 },
    neck: { x: 100, y: 148.5 },
    bodyCenter: { x: 100, y: 183 },
    bodyRx: 49,
    bodyRy: 43,
    bodyWidth: 98,
    shoulderL: { x: 72.5, y: 147 },
    shoulderR: { x: 127.5, y: 147 },
    pawL: { x: 84, y: 171 },
    pawR: { x: 116, y: 171 },
    footL: { x: 58, y: 218 },
    footR: { x: 142, y: 218 },
    tailBase: { x: 153, y: 192 },
  },
  bounds: {
    head: { x0: 38, y0: 6, x1: 162, y1: 150 },
    body: { x0: 36, y0: 138, x1: 176, y1: 228 },
  },
  // Tankebobler og Zzz (fælles regel, review G1-r2 pkt. 5.2): hver race har sit anker i fri luft med
  // mindst 8 enheder til hoved, ører, manke og horn i alle stadier og inden for den sikre zone; moods-
  // arkets lint tjekker alle racer og stadier.
  fx: { x: 172, y: 72 },
  face: { idleMouth: 'cat-w', buckTeeth: true, cheeks: true },
  ears: { splay: 10 },
  signature: 'nose-wiggle',
  // Guldets glansbånd på venstre flanke under armen (armene dækker standardbuen øverst til venstre).
  goldBand: [148, 196],
  parts: {
    Ear: UprightEar,
    Paw,
    PawUp,
    PawBack,
    pawUpTip: { cheer: { x: -27.5, y: -20 }, wave: { x: -33.5, y: -21 }, think: { x: 21.5, y: -1 }, oops: { x: -14.5, y: -45 } },
    upArms: {
      cheer: { spine: UP_SPINES.cheer, w0: 15, w1: 18.5, tip: 10 },
      wave: { spine: UP_SPINES.wave, w0: 15, w1: 18.5, tip: 10 },
      think: { spine: UP_SPINES.think, w0: 15, w1: 18, tip: 9.5 },
      oops: { spine: UP_SPINES.oops, w0: 15, w1: 17, tip: 9 },
    },
    limb: { rot: PAW_ROT, sleeve: () => blob(SLEEVE), cuff: { y: 13, half: 11.6 } },
    Feet,
    Tail,
    Muzzle,
    BodyDeco,
    Ruff: RainbowRuff,
    ManeFront: Tuft,
    Pattern: { head: DutchHead },
  },
}

export default rabbit
