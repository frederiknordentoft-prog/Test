// Hverdag · hoved: strikhue med ombuk og kvast. earMode 'through': ørerne går op gennem to huller.
// Huen tegner hullerne; ørerne ender i en blød bund nede i hullet (arterne tegner den), og hullets
// forkant (`rim`) lægges oven på ørernes rod (review G0-r1, fund 3). Højlyset ligger på kuplen,
// mindst 6 enheder fra hullerne.
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, litCopy, ribs, scallop, softBand, spline, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Kuplen (venstre halvdel, top → bund på midterlinjen). (0,0) = headTop. */
const DOME = symmetric([
  [0, -11], [-18, -9.2], [-34, -2.6], [-46, 7.6], [-52.5, 18.5], [-54, 27], [0, 27],
])
/** Strik-linjer, der følger kuplen. */
const KNIT: Vec[][] = [-30, -15, 0, 15, 30].map((x) => [
  [x * 1.2, 16],
  [x * 1.02, 5],
  [x * 0.62, -5],
  [x * 0.22, -9],
])

/** Hullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter kuplens rundning. */
const HOLE = { rx: 11.5, ry: 4.6, rot: 24 }
const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}

/** Hullets forkant: en halvmåne under hullets nederste kant (strikkens tykkelse), spidse ender. */
function lip(h: { x: number; y: number; rot: number }, th = 2.8): string {
  const outer: Vec[] = []
  const inner: Vec[] = []
  for (let i = 0; i <= 6; i++) {
    const t = (Math.PI * i) / 6
    outer.push([HOLE.rx * Math.cos(t), HOLE.ry * Math.sin(t) + th * Math.sin(t)])
    inner.push([HOLE.rx * Math.cos(t), HOLE.ry * Math.sin(t)])
  }
  const pts = [...outer, ...inner.slice(1, -1).reverse()]
  return blob(xf(pts, { rot: h.rot, dx: h.x, dy: h.y }), 0.7)
}

const front: ItemArt = ({ c, sw, a, local, holes }) => {
  const lit = litCopy(DOME, [-26, -8], 0.9)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  return (
    <>
      <path d={blob(DOME, 0.9)} fill={c.mainShade} />
      <path d={blob(lit, 0.9)} fill={c.main} />
      <path d={join(...KNIT.map((k) => spline(k)))} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.55} strokeLinecap="round" />
      <path d={blob(DOME, 0.9)} fill="none" {...stroke} />
      {holes && <path d={join(ellipse(hl.x, hl.y, HOLE.rx, HOLE.ry, hl.rot), ellipse(hr.x, hr.y, HOLE.rx, HOLE.ry, hr.rot))} fill={c.outline} opacity={0.85} />}
      <path d={softBand(-54, 54, 12.5, 27.5, 4, 3)} fill={c.trim} {...stroke} />
      <path d={ribs(-52, 52, 15.5, 25.5, 14, 3.5)} fill="none" stroke={c.trimShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={scallop(0, -15, 10.5, 10, 8, 0.62, -90)} fill={c.accent} {...stroke} />
      {/* Matte højlys: et lille på kuplen mellem hullerne og et på kvasten (intet plastikglans). */}
      <path d={join(ellipse(-6, -6, 4.4, 2.1, -22), ellipse(-4.4, -17.8, 2.6, 1.9, -20))} fill={c.highlight} />
    </>
  )
}

/** Hullernes forkant over ørernes rod (kun når ørerne går gennem huller). */
const rim: ItemArt = ({ c, sw, a, local }) => (
  <path
    d={join(lip(holeAt(local, a.earBaseL, -1)), lip(holeAt(local, a.earBaseR, 1)))}
    fill={c.main}
    stroke={c.outline}
    strokeWidth={sw * 0.8}
    strokeLinejoin="round"
  />
)

export const hverdagHead: ItemDef = {
  id: 'hverdag-head',
  set: 'hverdag',
  slot: 'head',
  nameClip: 'name.item.hverdag-head',
  source: { kind: 'level', level: 2 },
  colorways: [
    fabric('tomat', 'tomatrød', 'tomato', 'cream', 'cream'),
    fabric('himmel', 'himmelblå', 'sky', 'snow', 'sunflower'),
    fabric('mint', 'mintgrøn', 'mint', 'cream', 'rose'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 116, earMode: 'through' },
  hides: ['mane-front'],
  icon: { box: [-59, -27, 118, 58] },
}

export default hverdagHead
