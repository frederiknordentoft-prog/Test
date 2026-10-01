// Opdager · hoved: en tropehjelm (safarihat) med bred skygge, læderbånd og et lille blad i båndet.
// earMode 'through' som huen: ørerne går op gennem to huller i kuplen; hatten tegner hullerne, ørerne
// ender i en blød bund nede i hullet (arterne tegner den), og hullets forkant (`rim`) lægges oven på
// ørernes rod. Enhjørningen får et hornhul over hornets rod, og knappen på toppen flytter til venstre
// for hornet. Skyggen er en flad ellipse bag kuplen, så dens forkant ses som en halvmåne under kuplen;
// den holder sig over øjnene på alle arter og stadier. (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, litCopy, lune, softBand, spline, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Kuplen (venstre halvdel, top → bund på midterlinjen). */
const DOME = symmetric([
  [0, -19.5], [-17, -17], [-31, -9.6], [-39.6, 0.6], [-44, 11], [-45, 20.5], [0, 23],
])
/** Skyggen: en flad ellipse bag kuplen; forkanten ses under kuplen. */
const BRIM = { cx: 0, cy: 18.2, rx: 63, ry: 8.4 }
/** Kuplens syninger (meridianer fra knappen ned til båndet). */
const SEAMS: Vec[][] = [-1, 1].map((s) => [
  [s * 2.6, -17.5],
  [s * 12, -11],
  [s * 18, 0],
  [s * 20, 11],
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
const buttonAt = (horn: Pt | null | undefined): Pt => (horn ? { x: horn.x - 19, y: -14 } : { x: 0, y: -19.5 })

/** Bladet i båndet (venstre side): en lille spids blad-form med midterribbe. */
const LEAF: Vec[] = xf([[0, -6.5], [3, -3], [3.2, 1.5], [0, 6], [-3.2, 1.5], [-3, -3]], { rot: -38, dx: -27, dy: 12.6 })
const LEAF_RIB = spline(xf([[0, -4.6], [0.3, 0], [0, 4.2]], { rot: -38, dx: -27, dy: 12.6 }))

const front: ItemArt = ({ c, sw, a, local, holes, horn }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lit = litCopy(DOME, [-24, -10], 0.9)
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const btn = buttonAt(horn)
  // Kuplens højlys ligger mindst 6 enheder fra alle huller (med horn: ude til højre for hornhullet).
  const shine = horn ? { x: horn.x + 21, y: -2 } : { x: -10, y: -8 }
  return (
    <>
      <path d={ellipse(BRIM.cx, BRIM.cy, BRIM.rx, BRIM.ry)} fill={c.main} {...stroke} />
      <path d={lune(BRIM.cx, BRIM.cy, BRIM.rx - sw / 2, BRIM.ry - sw / 2, 2.4, 22, 158)} fill={c.mainShade} />
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
      <path d={softBand(-42.5, 42.5, 11.6, 19.6, 2.4, 2.8)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw} strokeLinejoin="round" />
      <path d={blob(LEAF, 0.8)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={LEAF_RIB} fill="none" stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinecap="round" />
      <path d={circle(btn.x, btn.y, 4.4)} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.8} />
      {/* Matte højlys: et på kuplen og et på knappen (intet plastikglans). */}
      <path d={join(ellipse(shine.x, shine.y, 4.6, 2.2, -24), ellipse(btn.x - 1.4, btn.y - 1.5, 1.6, 1.1, -20))} fill={c.highlight} />
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

export const opdagerHead: ItemDef = {
  id: 'opdager-head',
  set: 'opdager',
  slot: 'head',
  nameClip: 'name.item.opdager-head',
  source: { kind: 'chest', nodeId: 'w0-former-chest' },
  colorways: [
    fabric('sand', 'sandfarvet', 'sand', 'cocoa', 'leaf'),
    fabric('oliven', 'olivengrøn', 'olive', 'cream', 'sunflower'),
    fabric('himmel', 'himmelblå', 'sky', 'navy', 'leaf'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 126, earMode: 'through' },
  hornHole: HORN_HOLE,
  icon: { box: [-65, -26, 130, 55] },
}

export default opdagerHead
