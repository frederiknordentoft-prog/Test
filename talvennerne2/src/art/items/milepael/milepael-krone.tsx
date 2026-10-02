// Milepæl · hoved (niveau 50): Legendekronen. En åben krone: et guldbånd med tre ædelsten om hovedet og
// takker med perler, der rejser sig over issen. earMode 'through': ørerne står op gennem kronens åbne top;
// riggen klipper dem ved båndet, og båndets forside tegnes igen oven på ørernes rod (`rim`), så de ser ud
// til at komme op inde fra kronen. Enhjørningens horn går op gennem kronen på samme måde (hornhul), og
// den midterste takke springes over, så hornet står frit. Båndet lægges i ørebasernes højde (hængeører:
// en fast højde), og takkerne fordeles mellem ørerne. Et lille glimt på den højeste takke.
// (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, circle, ellipse, join, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef } from '../../rig/types'

/** Båndets halve højde, hvor meget det hænger midtpå (perspektiv), og standardhøjden under issen. */
const BAND_H = 6.4
const SAG = 3
const BAND_Y = 12
/** Takkernes højde over båndet: midten højest. */
const TALL = 23
const SHORT = 16

interface Crown {
  /** Båndets midterlinje (y) og halve bredde; takkernes x og højde. */
  y: number
  w: number
  peaks: { x: number; h: number }[]
}

/** Kronens mål for bæreren: båndet i ørebasernes højde (eller fast), lidt bredere end ørerne. */
function crownOf(p: Pick<ItemArtProps, 'a' | 'local' | 'holes' | 'horn'>): Crown {
  const el = p.local(p.a.earBaseL)
  const er = p.local(p.a.earBaseR)
  const y = p.holes ? (el.y + er.y) / 2 - 1 : BAND_Y
  const w = Math.max(40, Math.min(48, (er.x - el.x) / 2 + 15))
  const side = w - 7
  const peaks = [
    { x: -side, h: SHORT },
    { x: -side / 2, h: SHORT + 3 },
    ...(p.horn ? [] : [{ x: 0, h: TALL }]),
    { x: side / 2, h: SHORT + 3 },
    { x: side, h: SHORT },
  ]
  return { y, w, peaks }
}

/** Båndets kant (y ved x): hænger lidt nedad midtpå. */
const sagAt = (c: Crown, x: number) => SAG * (1 - (x / c.w) ** 2)

/** Båndet som lukket form (top- og bundkant følger hinanden). */
function band(c: Crown): string {
  const xs = Array.from({ length: 9 }, (_, i) => -c.w + (2 * c.w * i) / 8)
  const top: Vec[] = xs.map((x) => [x, c.y - BAND_H + sagAt(c, x)])
  const bot: Vec[] = xs.map((x) => [x, c.y + BAND_H + sagAt(c, x)] as Vec).reverse()
  return blob([...top, [c.w + 2, c.y], ...bot, [-c.w - 2, c.y]], 0.7)
}

/** Takkerne: en savtakket kant oven på båndet, med en blød spids under hver perle. */
function peaks(c: Crown): string {
  const base = (x: number) => c.y - BAND_H + sagAt(c, x) + 1.5
  const pts: Vec[] = [[-c.w, base(-c.w)]]
  c.peaks.forEach((p, i) => {
    const prev = i === 0 ? -c.w : (c.peaks[i - 1].x + p.x) / 2
    const next = i === c.peaks.length - 1 ? c.w : (p.x + c.peaks[i + 1].x) / 2
    const valley = (x: number) => base(x) - 3.2
    if (i > 0) pts.push([prev, valley(prev)])
    pts.push([p.x - 3.4, base(p.x) - p.h * 0.55], [p.x, base(p.x) - p.h], [p.x + 3.4, base(p.x) - p.h * 0.55])
    if (i === c.peaks.length - 1) pts.push([next, base(next)])
  })
  pts.push([c.w, base(c.w) + 4], [-c.w, base(-c.w) + 4])
  return blob(pts, 0.35)
}

/** Hele kronen: takker med perler og glimt, båndet og ædelstenene. */
function crown(p: ItemArtProps) {
  const { c, sw } = p
  const C = crownOf(p)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const tip = (x: number, h: number) => [x, C.y - BAND_H + sagAt(C, x) + 1.5 - h - 1.6] as const
  const pearls = join(...C.peaks.map((q) => circle(...tip(q.x, q.h), q.h === TALL ? 3.8 : 3)))
  const top = C.peaks.reduce((m, q) => (q.h > m.h ? q : m), C.peaks[0])
  const glint = tip(top.x, top.h)
  const y = (x: number) => C.y + sagAt(C, x)
  const side = C.w * 0.58
  return (
    <>
      <path d={peaks(C)} fill={c.main} {...stroke} />
      <path d={join(...C.peaks.map((q) => ellipse(q.x - 1.2, C.y - BAND_H + sagAt(C, q.x) - q.h * 0.42, 1.1, q.h * 0.22, 8)))} fill={c.highlight} />
      <path d={pearls} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.8} />
      <path d={band(C)} fill={c.main} {...stroke} />
      <path d={join(ellipse(-side, y(-side), 3.8, 3.1, 0), ellipse(side, y(side), 3.8, 3.1, 0))} fill={c.trim} stroke={c.outline} strokeWidth={sw * 0.6} />
      <path d={circle(0, y(0), 4.6)} fill={c.accent} stroke={c.outline} strokeWidth={sw * 0.6} />
      <path
        d={join(
          circle(-1.5, y(0) - 1.6, 1.3), ellipse(-side - 1.1, y(-side) - 1, 1.1, 0.8, 0), ellipse(side - 1.1, y(side) - 1, 1.1, 0.8, 0),
          ...C.peaks.map((q) => circle(tip(q.x, q.h)[0] - 1, tip(q.x, q.h)[1] - 1, 1)),
        )}
        fill={c.highlight}
      />
      <path d={star(glint[0] + 6.5, glint[1] - 4, 6, 1.5)} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.45} strokeLinejoin="round" />
    </>
  )
}

/** Hængeører (ingen huller): kronen tegnes i hattens lag, og ørerne hænger ned over den. */
const front: ItemArt = (p) => (p.holes ? null : crown(p))
/** Ører og horn gennem kronen: hele kronen tegnes oven på deres rod, så de står op inde fra den. */
const rim: ItemArt = (p) => crown(p)

export const milepaelKrone: ItemDef = {
  id: 'milepael-krone',
  set: 'milepael',
  slot: 'head',
  nameClip: 'name.item.milepael-krone',
  source: { kind: 'level', level: 50 },
  colorways: [
    fabric('guld', 'guld', 'gold', 'sky', 'tomato'),
    fabric('soelv', 'sølv', 'silver', 'rose', 'violet'),
    fabric('rosaguld', 'rosaguld', 'coral', 'mint', 'berry'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 96, earMode: 'through' },
  hornHole: { lift: 4, rx: 7.4, ry: 2.6 },
  icon: { box: [-50, -18, 100, 38] },
}

export default milepaelKrone
