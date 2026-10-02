// Rytter · hoved: en ridehjelm med fløjlsbetræk, en kort skygge fortil, et bånd og en knap på toppen.
// earMode 'through' som huen: ørerne går op gennem to huller i kuplen, og hullets forkant (`rim`) lægges
// oven på ørernes rod (review G1-r4: hatte har øre- og hornhuller med kant). Enhjørningen får et hornhul
// over hornets rod, og knappen flytter til venstre for hornet. Skyggen er en flad halvmåne under kuplens
// forkant; den holder sig over øjnene på alle arter og stadier. Pandelokken og uldtoppen ligger under
// hjelmen. (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, litCopy, softBand, spline, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Kuplen (venstre halvdel, top → bund på midterlinjen): rund og tætsiddende. */
const DOME = symmetric([
  [0, -18], [-17, -15.8], [-31, -8.4], [-40.4, 2], [-45, 12.6], [-46.4, 21.6], [0, 24],
])
/** Skyggen fortil: en flad halvmåne under kuplens forkant (oversiden gemmer sig under båndet). */
const PEAK: Vec[] = [
  [-37, 19.5], [-18, 21.5], [0, 22], [18, 21.5], [37, 19.5], [31.5, 25.4], [17, 29.6], [0, 31], [-17, 29.6], [-31.5, 25.4],
]
/** Fløjlets syninger: to meridianer fra knappen ned mod båndet. */
const SEAMS: Vec[][] = [-1, 1].map((s) => [
  [s * 3, -17.4],
  [s * 13, -10.5],
  [s * 19.5, 0.5],
  [s * 22, 12],
])

/** Hullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter kuplens rundning (som huen). */
const HOLE = { rx: 11.5, ry: 4.6, rot: 24 }
const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}
/** Hornhullet (enhjørningen): en flad ellipse lidt bredere end hornets rod (se `hornHole`). */
const HORN_HOLE = { lift: 9, rx: 9.2, ry: 3.6 }

/** Hullets forkant: en halvmåne under hullets nederste kant (hjelmens tykkelse), spidse ender. */
function lip(h: { x: number; y: number; rot: number }, rx = HOLE.rx, ry = HOLE.ry, th = 2.6): string {
  const outer: Vec[] = []
  const inner: Vec[] = []
  for (let i = 0; i <= 6; i++) {
    const t = (Math.PI * i) / 6
    outer.push([rx * Math.cos(t), ry * Math.sin(t) + th * Math.sin(t)])
    inner.push([rx * Math.cos(t), ry * Math.sin(t)])
  }
  return blob(xf([...outer, ...inner.slice(1, -1).reverse()], { rot: h.rot, dx: h.x, dy: h.y }), 0.7)
}

/** Knappen på toppen: midt på, eller til venstre for et horn (så hornet står frit). */
const buttonAt = (horn: Pt | null | undefined): Pt => (horn ? { x: horn.x - 19, y: -13 } : { x: 0, y: -18.5 })

const front: ItemArt = ({ c, sw, a, local, holes, horn }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lit = litCopy(DOME, [-24, -10], 0.9)
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const btn = buttonAt(horn)
  // Kuplens højlys ligger mindst 6 enheder fra alle huller (med horn: ude til højre for hornhullet).
  const shine = horn ? { x: horn.x + 21, y: -3 } : { x: -12, y: -7 }
  return (
    <>
      <path d={blob(PEAK, 0.8)} fill={c.mainShade} {...stroke} />
      <path d={blob(DOME, 0.9)} fill={c.mainShade} />
      <path d={blob(lit, 0.9)} fill={c.main} />
      <path d={join(...SEAMS.map((s) => spline(s)))} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.55} strokeLinecap="round" />
      <path d={blob(DOME, 0.9)} fill="none" {...stroke} />
      {holes && (
        <path
          d={join(
            ellipse(hl.x, hl.y, HOLE.rx, HOLE.ry, hl.rot),
            ellipse(hr.x, hr.y, HOLE.rx, HOLE.ry, hr.rot),
            horn ? ellipse(horn.x, horn.y, HORN_HOLE.rx, HORN_HOLE.ry) : '',
          )}
          fill={c.outline}
          opacity={0.85}
        />
      )}
      <path d={softBand(-44.5, 44.5, 15.4, 21.8, 2.6, 2.8)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={circle(btn.x, btn.y, 4.6)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.8} />
      {/* Fløjlets matte højlys på kuplen, en glans på skyggen og et lille på knappen. */}
      <path
        d={join(ellipse(shine.x, shine.y, 4.8, 2.3, -24), ellipse(-14, 25.2, 7, 1.3, 4), ellipse(btn.x - 1.5, btn.y - 1.6, 1.6, 1.1, -20))}
        fill={c.highlight}
      />
    </>
  )
}

/** Hullernes forkant over ørernes (og hornets) rod (kun når ørerne går gennem huller). */
const rim: ItemArt = ({ c, sw, a, local, horn }) => (
  <path
    d={join(
      lip(holeAt(local, a.earBaseL, -1)),
      lip(holeAt(local, a.earBaseR, 1)),
      horn ? lip({ x: horn.x, y: horn.y, rot: 0 }, HORN_HOLE.rx, HORN_HOLE.ry, 2.4) : '',
    )}
    fill={c.main}
    stroke={c.outline}
    strokeWidth={sw * 0.8}
    strokeLinejoin="round"
  />
)

export const rytterHead: ItemDef = {
  id: 'rytter-head',
  set: 'rytter',
  slot: 'head',
  nameClip: 'name.item.rytter-head',
  source: { kind: 'chest', nodeId: 'w1-dobbelt-chest' },
  colorways: [
    fabric('marine', 'marineblå', 'navy', 'silver', 'gold'),
    fabric('roed', 'rød', 'tomato', 'cream', 'navy'),
    fabric('havgroen', 'havgrøn', 'teal', 'sand', 'sunflower'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 96, earMode: 'through' },
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-48, -25, 96, 57.5] },
}

export default rytterHead
