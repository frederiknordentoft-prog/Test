// Milepæl · hoved (niveau 10): regnbuehue. En strikhue med fire flade, vandrette regnbuestriber
// (regnbuereglen: aldrig en blød gradient), et hvidt ombuk med rib, en skypompon og en lille stjerne på
// ombukket. earMode 'through' som Hverdags hue: ørerne går op gennem to huller, og hullets forkant (`rim`)
// i stribens farve lægges oven på ørernes rod; enhjørningen får et hornhul, og pomponen flytter til venstre
// for hornet. Striberne klippes til kuplen, og cel-skyggen er en gennemsigtig ink-halvmåne, så hver stribe
// får sin egen mørkere tone. (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, ellipse, join, litCopy, outside, rect, ribs, scallop, softBand, star, symmetric, xf } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef, Pt } from '../../rig/types'

/** Kuplen (venstre halvdel, top → bund på midterlinjen) som Hverdags hue. */
const DOME = symmetric([
  [0, -11], [-18, -9.2], [-34, -2.6], [-46, 7.6], [-52.5, 18.5], [-54, 27], [0, 27],
])
/** Stribernes grænser (y) fra toppen ned til ombukket. */
const BANDS = [-12, -4.6, 1.2, 7, 28]

/** Hullet: en skrå ellipse ved ørebasen (lidt over den), drejet efter kuplens rundning. */
const HOLE = { rx: 11.5, ry: 4.6, rot: 24 }
const holeAt = (local: ItemArtProps['local'], p: Pt, side: 1 | -1) => {
  const q = local({ x: p.x, y: p.y - 3 })
  return { x: q.x, y: q.y, rot: side * HOLE.rot }
}
/** Hornhullet (enhjørningen): en flad ellipse lidt bredere end hornets rod. */
const HORN_HOLE = { lift: 9, rx: 9.2, ry: 3.6 }

/** Hullets forkant: en halvmåne under hullets nederste kant (strikkens tykkelse), spidse ender. */
function lip(h: { x: number; y: number; rot: number }, rx = HOLE.rx, ry = HOLE.ry, th = 2.8): string {
  const outer: Vec[] = []
  const inner: Vec[] = []
  for (let i = 0; i <= 6; i++) {
    const t = (Math.PI * i) / 6
    outer.push([rx * Math.cos(t), ry * Math.sin(t) + th * Math.sin(t)])
    inner.push([rx * Math.cos(t), ry * Math.sin(t)])
  }
  return blob(xf([...outer, ...inner.slice(1, -1).reverse()], { rot: h.rot, dx: h.x, dy: h.y }), 0.7)
}

/** Stribens farve ved højden y (striberne er farvesættets ekstra stoffer, ellers hovedfarven). */
const stripeAt = (stripes: readonly string[], y: number) => {
  const i = BANDS.findIndex((b, j) => j > 0 && y < b)
  return stripes[Math.max(0, Math.min(stripes.length - 1, (i < 0 ? BANDS.length : i) - 1))]
}

/** Pomponen: en lille sky midt på toppen, eller 20 enheder til venstre for et horn. */
const pomAt = (horn: Pt | null | undefined): Pt => (horn ? { x: horn.x - 20, y: -13 } : { x: 0, y: -15 })

const front: ItemArt = ({ c, sw, a, local, holes, horn, ids }) => {
  const stripes = c.stripes ?? [c.main, c.main, c.main, c.main]
  const lit = litCopy(DOME, [-26, -8], 0.9)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const pom = pomAt(horn)
  const clip = `${ids.uid}-rh`
  const shine = horn ? { x: horn.x + 22, y: 2 } : { x: -8, y: -4 }
  return (
    <>
      <clipPath id={clip}>
        <path d={blob(DOME, 0.9)} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        {stripes.map((s, i) => (
          <path key={i} d={rect(-60, BANDS[i], 120, BANDS[i + 1] - BANDS[i] + (i < stripes.length - 1 ? 0.6 : 0))} fill={s} />
        ))}
        <path d={join(outside(blob(lit, 0.9)))} fill={c.ink} fillRule="evenodd" opacity={0.14} />
      </g>
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
      <path d={softBand(-54, 54, 12.5, 27.5, 4, 3)} fill={c.trim} {...stroke} />
      <path d={ribs(-52, 52, 15.5, 25.5, 14, 3.5)} fill="none" stroke={c.trimShade} strokeWidth={sw * 0.5} strokeLinecap="round" />
      <path d={star(-26, 21, 5.6, 1.6, 4, 8)} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.45} strokeLinejoin="round" />
      <path d={scallop(pom.x, pom.y, 11.5, 9.4, 9, 0.64, -90)} fill={c.trim} {...stroke} />
      <path d={join(ellipse(shine.x, shine.y, 4.4, 2.1, -22), ellipse(pom.x - 4.6, pom.y - 2.4, 2.8, 1.8, -20))} fill={c.highlight} />
    </>
  )
}

/** Hullernes forkant over ørernes (og hornets) rod, i stribens farve dér, hvor hullet sidder. */
const rim: ItemArt = ({ c, sw, a, local, horn }) => {
  const stripes = c.stripes ?? [c.main]
  const hl = holeAt(local, a.earBaseL, -1)
  const hr = holeAt(local, a.earBaseR, 1)
  const lips: [string, string][] = [
    [lip(hl), stripeAt(stripes, hl.y + 3)],
    [lip(hr), stripeAt(stripes, hr.y + 3)],
    ...(horn ? [[lip({ x: horn.x, y: horn.y, rot: 0 }, HORN_HOLE.rx, HORN_HOLE.ry, 2.6), stripeAt(stripes, horn.y + 2)] as [string, string]] : []),
  ]
  // Hullerne i samme stribe deler én sti.
  const byColor = new Map<string, string[]>()
  for (const [d, col] of lips) byColor.set(col, [...(byColor.get(col) ?? []), d])
  return (
    <>
      {[...byColor].map(([col, ds]) => (
        <path key={col} d={join(...ds)} fill={col} stroke={c.outline} strokeWidth={sw * 0.8} strokeLinejoin="round" />
      ))}
    </>
  )
}

export const milepaelRegnbuehue: ItemDef = {
  id: 'milepael-regnbuehue',
  set: 'milepael',
  slot: 'head',
  nameClip: 'name.item.milepael-regnbuehue',
  source: { kind: 'level', level: 10 },
  colorways: [
    fabric('regnbue', 'regnbue', 'violet', 'snow', 'sunflower', 'tomato', 'sunflower', 'leaf', 'sky'),
    fabric('pastel', 'pastel', 'lilac', 'snow', 'sunflower', 'rose', 'sunflower', 'mint', 'lilac'),
    fabric('nordlys', 'nordlys', 'navy', 'cream', 'sunflower', 'berry', 'violet', 'sky', 'teal'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 116, earMode: 'through' },
  hides: ['mane-front'],
  hornHole: HORN_HOLE,
  icon: { box: [-59, -26, 118, 57] },
}

export default milepaelRegnbuehue
