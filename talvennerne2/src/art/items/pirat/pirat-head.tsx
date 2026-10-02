// Pirat · hoved: en pirathat (tospids) med opbøjet skygge, guldbort langs kanten og et venligt
// dødningehoved med korslagte knogler midt foran. earMode 'through' som huen: ørerne går op gennem to
// huller i hattens front; hatten tegner hullerne, ørerne ender i en blød bund nede i hullet (arterne
// tegner den), og hullets forkant (`rim`) lægges oven på ørernes rod. Enhjørningen får et hornhul midt i
// fronten, og mærket flytter til venstre for hornet. Cel-skyggen er en halvmåne nederst til højre.
// (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, capsule, circle, ellipse, join, litCopy, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Hatten forfra: toppen buer op midtpå, hjørnerne vender op og ud, og kanten forneden følger issen. */
const HAT = symmetric([
  [0, -27], [-18, -25.5], [-34, -19.5], [-48, -10], [-58.5, -2.5], [-63, -4.5], [-62, 2.5], [-55, 12.5],
  [-40, 18.5], [-20, 21.5], [0, 22.5],
])
/** Guldborten: et bånd lige inden for toppens kant, fra hjørne til hjørne. */
const TRIM_TOP: Vec[] = [[-58.5, -2.5], [-48, -10], [-34, -19.5], [-18, -25.5], [0, -27], [18, -25.5], [34, -19.5], [48, -10], [58.5, -2.5]]
const TRIM_IN: Vec[] = [[55, 2.2], [45, -4.6], [32, -13.4], [17, -19.4], [0, -21], [-17, -19.4], [-32, -13.4], [-45, -4.6], [-55, 2.2]]
const TRIM = blob([...TRIM_TOP, ...TRIM_IN], 0.6)

/** Hullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter hattens rundning (som huen). */
const HOLE = { rx: 11.5, ry: 4.6, rot: 20 }
const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}
/** Hornhullet (enhjørningen): en flad ellipse lidt bredere end hornets rod. */
const HORN_HOLE = { lift: 9, rx: 9.2, ry: 3.6 }

/** Hullets forkant: en halvmåne under hullets nederste kant (filtens tykkelse), spidse ender. */
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

/** Mærket: midt foran, eller til venstre for et horn. */
const badgeAt = (horn: Pt | null | undefined): Pt => (horn ? { x: horn.x - 25, y: -2 } : { x: 0, y: -5 })

/**
 * Dødningehovedet (rundt med to øjne) og de korslagte knogler bag det. Knoglerne, knoerne og hovedet er
 * hver sin sti, så overlappende former med modsat omløbsretning ikke slår huller i fyldet.
 */
function skull(b: Pt) {
  const bones = join(capsule([b.x - 10, b.y + 7.4], [b.x + 10, b.y - 3], 2.7), capsule([b.x - 10, b.y - 3], [b.x + 10, b.y + 7.4], 2.7))
  const knobs = join(...[[-10.8, 8.2], [10.8, 8.2], [-10.8, -3.8], [10.8, -3.8]].map(([x, y]) => circle(b.x + x, b.y + y, 3)))
  const head = join(circle(b.x, b.y, 7.2), ellipse(b.x, b.y + 5.8, 4.4, 3, 0))
  const eyes = join(ellipse(b.x - 2.7, b.y + 0.6, 1.8, 2.1, 0), ellipse(b.x + 2.7, b.y + 0.6, 1.8, 2.1, 0))
  return { bones, knobs, head, eyes }
}

const front: ItemArt = ({ c, sw, a, local, holes, horn }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lit = litCopy(HAT, [-24, -14], 0.9)
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const s = skull(badgeAt(horn))
  const shine = horn ? { x: horn.x + 22, y: -10 } : { x: -22, y: -14 }
  return (
    <>
      <path d={blob(HAT, 0.75)} fill={c.mainShade} />
      <path d={blob(lit, 0.75)} fill={c.main} />
      <path d={TRIM} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={blob(HAT, 0.75)} fill="none" {...stroke} />
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
      <path d={s.bones} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} strokeLinejoin="round" />
      <path d={s.knobs} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.4} />
      <path d={s.head} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.55} />
      <path d={s.eyes} fill={c.outline} />
      <path d={ellipse(shine.x, shine.y, 5, 1.9, -18)} fill={c.highlight} />
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

export const piratHead: ItemDef = {
  id: 'pirat-head',
  set: 'pirat',
  slot: 'head',
  nameClip: 'name.item.pirat-head',
  source: { kind: 'shop', price: 120 },
  colorways: [
    fabric('sort', 'sort', 'charcoal', 'gold', 'snow'),
    fabric('brun', 'læderbrun', 'cocoa', 'sunflower', 'cream'),
    fabric('roed', 'rød', 'tomato', 'sunflower', 'snow'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 126, earMode: 'through' },
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-65, -29, 130, 53] },
}

export default piratHead
