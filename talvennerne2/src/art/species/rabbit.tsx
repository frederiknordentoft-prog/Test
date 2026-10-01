// Kaninen – guldstandarden for stilen (bølge 1). Tre racer:
// - upright: stående ører; det højre øre har et lille knæk (kaninens ejerbare særpræg).
// - lop: vædderen med lange, smalle hængeører forbi kinderne og en synlig ørebase (krone).
// - lionhead: løvehoved med en manke af strøgne totter, skæg under hagen og korte ører.
// Fælles: armene forsvinder ind under hovedet (åben skulder, når de løftes), lårbule, lange
// fremadrettede bagfødder, en stor halekvast med luft til foden og brystfnug under hagen.
// Alle former beskrives med punkter og husets primitiver (ingen path-literaler).
import { OpenLimb, ROUND, hatted, limbLoop, padsPath } from '../parts/kit'
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
 * Vædderøret: roden fortsætter 6 enheder ind over hovedet (kun fyld, ingen kontur ved roden), så der
 * aldrig er en sprække mellem ørets bund og hovedet (review G1-r2, K1). Babyen har lige så lange, men
 * smallere ører, der når ned til skulderen (K6), så den ikke læses som en hvalp.
 */
const LOP_SPINE: Vec[] = [[10, 5], [3, -8], [-6, -7.5], [-14, -2], [-20, 10], [-23.5, 27], [-24.5, 46], [-23.5, 65], [-21, 82], [-18, 96]]
const LOP_EAR = limbLoop(LOP_SPINE, 15, 17.5, 7)
const LOP_INNER = ribbon([[-19.4, 40], [-19.8, 56], [-18.8, 72], [-16.6, 86], [-15.6, 94]], [0, 5.5, 7, 6, 0])
/** Kilen mellem ørets inderkant og hovedets kontur (inden for øre ∪ hoved), kun fyld. */
const LOP_WEDGE: Vec[] = [[8, 0], [0, -1], [-8, 1.5], [-13, 6], [-17, 13], [-20, 21], [-15, 22], [-9, 14], [-3, 9], [4, 6]]

const LopEar: SidePart = ({ pal, sw, stage }) => {
  const s = stage === 1 ? { sx: 0.88, sy: 1.02 } : {}
  return (
    <OpenLimb loop={xf(LOP_EAR, s)} fill={pal.earFur} stroke={pal.earOutline} sw={sw} trim={2} trimEnd={1} extra={blob(xf(LOP_WEDGE, s), 0.5)}>
      <path d={blob(xf(LOP_INNER, s), 0.8)} fill={pal.inner} opacity={0.9} />
    </OpenLimb>
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
  // Klippet til kroppen, så flæsens ender aldrig stikker ud over kropskonturen som spidser.
  return <path d={scallop(100, 151 + 1 * k, 38 * k, 12.5 * k, 11, 0.6, -90)} fill={`url(#${ids.gradient})`} stroke={pal.maneOutline} strokeWidth={sw} strokeLinejoin="round" clipPath={`url(#${ids.bodyClip})`} />
}

// Manken: fyldige kindtotter på begge sider og en lille krave under hagen – ikke en jævn uldring om hele
// hovedet, som læses som et lam (review G1-r2, K6). Toppen af hovedet er fri, så ørerne rejser sig klart.
const LION_MANE = join(
  scallop(53, 121, 19, 30, 7, 0.62, -90),
  scallop(147, 121, 19, 30, 7, 0.62, -90),
  scallop(100, 147, 36, 11, 9, 0.6, 0),
)
const LION_INNER = join(scallop(57, 125, 13, 22, 6, 0.58, -75), scallop(143, 125, 13, 22, 6, 0.58, -105))

const LionMane: Part = ({ pal, sw, ids }) => (
  <>
    <path d={LION_MANE} fill={hair(pal, ids.gradient)} stroke={pal.maneOutline} strokeWidth={sw} {...round} />
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
    { id: 'upright', name: 'stående ører', ears: { splay: 10 } },
    {
      id: 'lop',
      name: 'vædder',
      ears: { splay: 0, clip: false, hang: true },
      anchors: { earBaseL: { x: 66, y: 62 }, earBaseR: { x: 134, y: 62 }, earGap: 60 },
      parts: { Ear: LopEar },
      // Hængeørerne bevæger sig ikke med humøret (de svajer blidt i alle humør).
      poses: {
        happy: { earL: 0, earR: 0 }, cheer: { earL: 0, earR: 0 }, think: { earL: 0, earR: 0 },
        oops: { earL: 0, earR: 0 }, sleep: { earL: 0, earR: 0 }, wave: { earL: 0, earR: 0 },
      },
      bounds: { head: { x0: 30, y0: 46, x1: 170, y1: 178 } },
    },
    {
      id: 'lionhead',
      name: 'løvehoved',
      ears: { splay: 12 },
      anchors: { earBaseL: { x: 74, y: 57 }, earBaseR: { x: 126, y: 57 } },
      parts: { Ear: ShortEar, ManeBack: LionMane, ManeFront: LionTuft },
      maneGrowth: 1.1,
      bounds: { head: { x0: 28, y0: 18, x1: 172, y1: 168 } },
      fx: { x: 172, y: 70 },
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
    tailBase: { x: 152, y: 176 },
  },
  bounds: {
    head: { x0: 38, y0: 6, x1: 162, y1: 150 },
    body: { x0: 36, y0: 138, x1: 176, y1: 228 },
  },
  // Tankeprikker og Z'er ud for kinden, under det knækkede øre.
  fx: { x: 166, y: 98 },
  face: { idleMouth: 'cat-w', buckTeeth: true, cheeks: true },
  ears: { splay: 10 },
  signature: 'nose-wiggle',
  // Guldets glansbånd på venstre flanke under armen (armene dækker standardbuen øverst til venstre).
  goldBand: [148, 196],
  parts: {
    Ear: UprightEar,
    Paw,
    PawUp,
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
