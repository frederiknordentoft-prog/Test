// Opdager · krop: en ærmeløs opdagervest med V-hals, kantbånd, knapper og to lommer med klap. Kropstøj
// klippes af riggen til artens krop (konturen/2 udenfor); vesten klipper sig selv til sin egen form
// (V-hals, dybe ærmegab ved skuldrene og en kort kant ved hoften), så pelsen ses i halsen, ved
// skuldrene og under kanten, og streger kroppens kontur igen inden for den. Armene tegnes oven på
// vesten uden ærmer; en løftet arm (jubel, vink, tænker, ups) får et kantbånd ved roden, så den ser ud
// til at komme ud af ærmegabet i alle poser. Et hvilende, lodret forben (kat, hvalp, hest, enhjørning)
// kommer ud af et ærmegab med kantbånd lige under skulderleddet, og riggen klipper benet over båndet, så
// det ikke ligger som en kasse oven på vesten (review G1-r4, punkt 2). Lommerne sidder ud mod siderne, så de ses ved siden af
// poter og forben på alle arter. Babyens korte torso får kanten og lommerne højere oppe. Én parametrisk
// tegning giver de 3 grundformer (round/pear/tall). (0,0) = bodyCenter, tegnet ved bodyWidth 100.
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, outside, poly, rect, ribbon, spline } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ArmholeArt, BodyKind, ItemArt, ItemDef, SleeveUpArt } from '../../rig/types'

interface Cut {
  /** V-halsens bund og halve bredde foroven, ærmegabets bund og stroppens bredde, kanten og lommerne. */
  vBottom: number
  vHalf: number
  arm: number
  strap: number
  hem: number
  pocket: number
}

const CUTS: Record<BodyKind, Cut> = {
  round: { vBottom: -12, vHalf: 13, arm: -16, strap: 11, hem: 17, pocket: -2 },
  pear: { vBottom: -10, vHalf: 13, arm: -14, strap: 11, hem: 19, pocket: 0 },
  tall: { vBottom: -18, vHalf: 12, arm: -22, strap: 10, hem: 13, pocket: -6 },
}
/** Babyens torso er kortere: kanten og lommerne sidder højere. */
const BABY_LIFT = 6
/** Kanten buer nedad midtpå (kroppens rundning set forfra). */
const SAG = 2.6
const TOP = -72
const SIDE = 64

/** Punkter på en kvadratisk Bézier (glatte kurver af korte linjestykker). */
function qpts(a: Vec, c: Vec, b: Vec, n = 8): Vec[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n
    const u = 1 - t
    return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as Vec
  })
}

/** Vestens form og kanterne (V-hals, ærmegab, kant) for et snit og en løftet kant. */
function cut(k: Cut, lift: number) {
  const hem = k.hem - lift
  const s = k.vHalf + k.strap
  // Ærmegabet: fra stroppen ned og ud til siden (venstre side; højre spejles).
  const armL = qpts([-s, TOP], [-s - 2, k.arm + 4], [-SIDE, k.arm], 10)
  const armR = armL.map(([x, y]) => [-x, y] as Vec).reverse()
  // Kanten fra venstre mod højre, buet nedad midtpå.
  const hemPts = qpts([-SIDE, hem], [0, hem + SAG * 2], [SIDE, hem], 8)
  const shape = poly([[0, k.vBottom], [-k.vHalf, TOP], ...armL, ...hemPts, ...armR, [k.vHalf, TOP]])
  const vNeck = poly([[-k.vHalf, TOP], [0, k.vBottom], [k.vHalf, TOP]], false)
  return { shape, vNeck, arms: [poly(armL, false), poly(armR, false)], hem: poly(hemPts, false) }
}

/** Lommerne med klap og knap ud mod siderne. */
function pockets(y: number) {
  const w = 17
  const h = 13
  const xs = [-37, 20]
  return {
    bags: join(...xs.map((x) => rect(x, y, w, h, 3.2))),
    flaps: join(...xs.map((x) => rect(x - 1, y - 1.5, w + 2, 5.6, 2.2))),
    buttons: join(...xs.map((x) => circle(x + w / 2, y + 2.3, 1.7))),
  }
}

/** Vesten lagt fladt (ikon uden bærer): V-hals, stropper, ærmegab og kant. */
const FLAT = (() => {
  const k: Cut = { vBottom: -10, vHalf: 13, arm: -14, strap: 11, hem: 20, pocket: 0 }
  const armL = qpts([-24, -40], [-25, -18], [-40, -14], 8)
  const armR = armL.map(([x, y]) => [-x, y] as Vec).reverse()
  const hemPts = qpts([-42, 20], [0, 28], [42, 20], 8)
  return { k, shape: poly([[0, -10], [-13, -40], ...armL, ...hemPts, ...armR, [13, -40]]) }
})()

const vest = (kind: BodyKind): ItemArt => ({ c, sw, ids, restroke, solo, stage }) => {
  const clip = `${ids.uid}-ov-${solo ? 'flat' : kind}`
  const k = solo ? FLAT.k : CUTS[kind]
  const lift = !solo && stage === 1 ? BABY_LIFT : 0
  const g = cut(k, lift)
  const shape = solo ? FLAT.shape : g.shape
  const p = pockets(k.pocket - lift)
  // Skyggen: alt uden for en lys ellipse forskudt op mod venstre.
  const lit = ellipse(-8, -12, 51, 47.5)
  const edges = solo ? shape : join(g.vNeck, ...g.arms, g.hem)
  return (
    <>
      <clipPath id={clip}>
        <path d={shape} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <path d={rect(-80, -80, 160, 120)} fill={c.main} />
        <path d={outside(lit)} fill={c.mainShade} fillRule="evenodd" />
        <path d={spline([[0, k.vBottom + 2], [0.4, 4], [0, 40]])} fill="none" stroke={c.outline} strokeWidth={sw * 0.5} strokeLinecap="round" />
        <path d={p.bags} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
        <path d={p.flaps} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
        <path d={join(p.buttons, circle(0, k.vBottom + 7 - lift * 0.4, 2), circle(0, k.vBottom + 16 - lift * 0.6, 2))} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} />
        {!solo && restroke()}
      </g>
      <path d={edges} fill="none" stroke={c.trimOutline} strokeWidth={sw * 2} strokeLinejoin="round" strokeLinecap="round" />
      <path d={edges} fill="none" stroke={c.trim} strokeWidth={sw * 0.9} strokeLinejoin="round" strokeLinecap="round" />
    </>
  )
}

/**
 * Den løftede arm kommer ud af ærmegabet: vestens stof dækker armens rod på brystet, og kantbåndet
 * ligger, hvor armen kommer ud.
 */
const sleeveUp: SleeveUpArt = ({ c, sw, root, rootEdge }) =>
  root && rootEdge ? (
    <>
      <path d={root} fill={c.main} />
      <path d={rootEdge} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
    </>
  ) : null

/**
 * Ærmegabet på et hvilende, lodret forben (armens ramme): et kantbånd, der buer hen over benets rod, hvor
 * benet kommer ud af vesten. Kun når roden ligger inden for vesten et stykke over kanten (ellers hænger
 * benet under vesten og tegnes som før).
 */
const armhole: ArmholeArt = ({ c, sw, edge, y, origin, s, stage, body: kind }) => {
  const hem = CUTS[kind].hem - (stage === 1 ? BABY_LIFT : 0)
  if (origin.y + y / s > hem - 2) return null
  // Samme kantbånd som vestens egne kanter (V-hals, ærmegab og kant): 2 · sw bredt med en lys midte på 0,9 · sw.
  return <path d={blob(ribbon(edge, sw * 1.45), 0.8)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.55} strokeLinejoin="round" />
}

export const opdagerBody: ItemDef = {
  id: 'opdager-body',
  set: 'opdager',
  slot: 'body',
  nameClip: 'name.item.opdager-body',
  source: { kind: 'finale', world: 'eng' },
  colorways: [
    fabric('oliven', 'olivengrøn', 'olive', 'cocoa', 'gold'),
    fabric('sand', 'sandfarvet', 'sand', 'olive', 'cocoa'),
    fabric('havblaa', 'havblå', 'teal', 'cream', 'gold'),
  ],
  art: {
    front: vest('round'),
    bodyShapes: { round: vest('round'), pear: vest('pear'), tall: vest('tall') },
    sleeveUp,
    armhole,
  },
  fit: { anchor: 'bodyCenter', scaleBy: 'bodyWidth', baseScale: 1, baseWidth: 100 },
  icon: { box: [-43, -42, 86, 70] },
}

export default opdagerBody
