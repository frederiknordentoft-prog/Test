// Pirat · hoved: en pirathat (tospids) med opbøjet skygge, guldbort langs kanten og et venligt
// dødningehoved med korslagte knogler midt foran. earMode 'through' som huen: ørerne går op gennem to
// huller i hattens front; hatten tegner hullerne, ørerne ender i en blød bund nede i hullet (arterne
// tegner den), og hullets forkant (`rim`) lægges oven på ørernes rod. Enhjørningen får et hornhul højt i
// fronten med en guldkant (en malje), og mærket sidder midt foran under det, så trekantshatten og kraniet
// står frit og centreret (review G1-r4, T7). Cel-skyggen er en halvmåne nederst til højre.
// (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, capsule, circle, ellipse, join, litCopy, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Hatten forfra: toppen buer op midtpå, hjørnerne vender op og ud, og kanten forneden følger issen. */
const HAT = symmetric([
  [0, -27], [-17, -25.5], [-31, -19.5], [-43.5, -10], [-52.5, -2.5], [-56.5, -4.5], [-55.6, 2.5], [-49.4, 12.5],
  [-37, 18.5], [-19, 21.5], [0, 22.5],
])
/** Guldborten: et bånd lige inden for toppens kant, fra hjørne til hjørne. */
const TRIM_TOP: Vec[] = [[-52.5, -2.5], [-43.5, -10], [-31, -19.5], [-17, -25.5], [0, -27], [17, -25.5], [31, -19.5], [43.5, -10], [52.5, -2.5]]
const TRIM_IN: Vec[] = [[49.4, 2.2], [40.6, -4.6], [29.2, -13.4], [16, -19.4], [0, -21], [-16, -19.4], [-29.2, -13.4], [-40.6, -4.6], [-49.4, 2.2]]
const TRIM = blob([...TRIM_TOP, ...TRIM_IN], 0.6)

/** Hullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter hattens rundning (som huen). */
const HOLE = { rx: 11.5, ry: 4.6, rot: 20 }
const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}
/** Hornhullet (enhjørningen): højt i fronten, lidt bredere end hornet dér, så kraniet har plads under det. */
const HORN_HOLE = { lift: 15, rx: 8.2, ry: 3 }
/** Maljens guldkant om hornhullet (bredde og højde ud over hullet) og afstanden ned til kraniet. */
const GROMMET = { w: 2.6, h: 2.2, gap: 2.4 }

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

/** Mærket: midt foran; med horn midt foran under hornhullets malje og lidt mindre, så det står frit. */
const BADGE_HORN = 0.82
const badgeAt = (horn: Pt | null | undefined): Pt =>
  horn ? { x: horn.x, y: horn.y + HORN_HOLE.ry + GROMMET.h + GROMMET.gap + 7.2 * BADGE_HORN } : { x: 0, y: -5 }

/**
 * Dødningehovedet (rundt med to øjne) og de korslagte knogler bag det. Knoglerne, knoerne og hovedet er
 * hver sin sti, så overlappende former med modsat omløbsretning ikke slår huller i fyldet.
 */
function skull(b: Pt, k = 1) {
  const bones = join(capsule([b.x - 10 * k, b.y + 7.4 * k], [b.x + 10 * k, b.y - 3 * k], 2.7 * k), capsule([b.x - 10 * k, b.y - 3 * k], [b.x + 10 * k, b.y + 7.4 * k], 2.7 * k))
  const knobs = join(...[[-10.8, 8.2], [10.8, 8.2], [-10.8, -3.8], [10.8, -3.8]].map(([x, y]) => circle(b.x + x * k, b.y + y * k, 3 * k)))
  const head = join(circle(b.x, b.y, 7.2 * k), ellipse(b.x, b.y + 5.8 * k, 4.4 * k, 3 * k, 0))
  const eyes = join(ellipse(b.x - 2.7 * k, b.y + 0.6 * k, 1.8 * k, 2.1 * k, 0), ellipse(b.x + 2.7 * k, b.y + 0.6 * k, 1.8 * k, 2.1 * k, 0))
  return { bones, knobs, head, eyes }
}

/** Maljen om hornhullet: en guldring (ydre ellipse minus hullet), som hornet går op igennem. */
const grommet = (h: Pt) =>
  join(ellipse(h.x, h.y, HORN_HOLE.rx + GROMMET.w, HORN_HOLE.ry + GROMMET.h), ellipse(h.x, h.y, HORN_HOLE.rx, HORN_HOLE.ry))

const front: ItemArt = ({ c, sw, a, local, holes, horn }) => {
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const lit = litCopy(HAT, [-24, -14], 0.9)
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const s = horn ? skull(badgeAt(horn), BADGE_HORN) : skull(badgeAt(horn))
  const shine = horn ? { x: horn.x + 22, y: -10 } : { x: -22, y: -14 }
  return (
    <>
      <path d={blob(HAT, 0.75)} fill={c.mainShade} />
      <path d={blob(lit, 0.75)} fill={c.main} />
      <path d={TRIM} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.7} strokeLinejoin="round" />
      <path d={blob(HAT, 0.75)} fill="none" {...stroke} />
      {horn && <path d={grommet(horn)} fill={c.trim} fillRule="evenodd" stroke={c.trimOutline} strokeWidth={sw * 0.6} />}
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

/** Hullernes forkant over ørernes rod (kun når ørerne går gennem huller); hornhullets forkant er maljens guld. */
const rim: ItemArt = ({ c, sw, a, local, horn }) => (
  <>
    <path
      d={join(lip(holeAt(local, a.earBaseL, -1)), lip(holeAt(local, a.earBaseR, 1)))}
      fill={c.main}
      stroke={c.outline}
      strokeWidth={sw * 0.8}
      strokeLinejoin="round"
    />
    {horn && (
      <path
        d={lip({ x: horn.x, y: horn.y, rot: 0 }, HORN_HOLE.rx, HORN_HOLE.ry, GROMMET.h)}
        fill={c.trim}
        stroke={c.trimOutline}
        strokeWidth={sw * 0.6}
        strokeLinejoin="round"
      />
    )}
  </>
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
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 113, earMode: 'through' },
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-58.5, -29, 117, 53] },
}

export default piratHead
