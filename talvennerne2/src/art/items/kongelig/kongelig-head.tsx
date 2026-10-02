// Kongelig · hoved: et diadem. Et smalt metalbånd om hovedet med en buet front, der rejser sig fra
// siderne til en høj midterbue med en stor dråbesten; to mindre buer med runde sten flankerer den, og
// perler sidder på spidserne. earMode 'through' som kronen: ørerne står op gennem den åbne top, riggen
// klipper dem ved båndet, og hele diademet tegnes oven på deres rod (`rim`), så de ser ud til at komme op
// bag det. Enhjørningens horn går op gennem diademet (hornhul): midterbuen sænkes til en lille sten under
// hornet, så hornet står frit mellem de to sidebuer. Båndet lægges i ørebasernes højde (ører bag hovedet
// og hængeører: en fast højde). (0,0) = headTop, tegnet ved headWidth 104.
import { fabric } from '../../rig/palette'
import { blob, circle, drop, ellipse, join, spline, star } from '../../rig/shapes'
import type { Vec } from '../../rig/shapes'
import type { ItemArt, ItemArtProps, ItemDef } from '../../rig/types'

/** Båndets halve højde, hvor meget det hænger midtpå (perspektiv), og standardhøjden under issen. */
const BAND_H = 3.4
const SAG = 3
const BAND_Y = 13
/** Buernes højde over båndet: midten, de indre og de ydre sidebuer. */
const MID = 22
const INNER = 12.5
const OUTER = 6

interface Tiara {
  /** Båndets midterlinje (y) og halve bredde; om midterbuen er med (intet horn). */
  y: number
  w: number
  mid: boolean
}

/** Diademets mål for bæreren: båndet i ørebasernes højde (eller fast), lidt bredere end ørerne. */
function tiaraOf(p: Pick<ItemArtProps, 'a' | 'local' | 'holes' | 'horn'>): Tiara {
  const el = p.local(p.a.earBaseL)
  const er = p.local(p.a.earBaseR)
  const y = p.holes ? (el.y + er.y) / 2 : BAND_Y
  const w = Math.max(38, Math.min(46, (er.x - el.x) / 2 + 13))
  return { y, w, mid: !p.horn }
}

/** Båndets kant (y ved x): hænger lidt nedad midtpå. */
const sagAt = (t: Tiara, x: number) => SAG * (1 - (x / t.w) ** 2)

/** Spidserne (x, højde over båndet) fra venstre mod højre. */
function tips(t: Tiara): Vec[] {
  const xs: Vec[] = [[-0.78 * t.w, OUTER], [-0.44 * t.w, INNER], [0.44 * t.w, INNER], [0.78 * t.w, OUTER]]
  return t.mid ? [...xs.slice(0, 2), [0, MID], ...xs.slice(2)] : xs
}

/** Fronten: buer, der rejser sig fra båndet, med bløde dale imellem. */
function plate(t: Tiara): string {
  const base = (x: number) => t.y - BAND_H + sagAt(t, x) + 1.2
  const ts = tips(t)
  const pts: Vec[] = [[-t.w, base(-t.w)]]
  ts.forEach(([x, h], i) => {
    const prevX = i === 0 ? -t.w : (ts[i - 1][0] + x) / 2
    if (i > 0) pts.push([prevX, base(prevX) - Math.min(h, ts[i - 1][1]) * 0.32])
    pts.push([x - 4.2, base(x) - h * 0.62], [x, base(x) - h], [x + 4.2, base(x) - h * 0.62])
  })
  pts.push([t.w, base(t.w)], [t.w, base(t.w) + 3.4], [-t.w, base(-t.w) + 3.4])
  return blob(pts, 0.45)
}

/** Båndet som lukket form (top- og bundkant følger hinanden). */
function band(t: Tiara): string {
  const xs = Array.from({ length: 9 }, (_, i) => -t.w + (2 * t.w * i) / 8)
  const top: Vec[] = xs.map((x) => [x, t.y - BAND_H + sagAt(t, x)])
  const bot: Vec[] = xs.map((x) => [x, t.y + BAND_H + sagAt(t, x)] as Vec).reverse()
  return blob([...top, [t.w + 1.6, t.y], ...bot, [-t.w - 1.6, t.y]], 0.7)
}

/** Hele diademet: front med filigran, perler, sten, båndet og glimt. */
function tiara(p: ItemArtProps) {
  const { c, sw } = p
  const T = tiaraOf(p)
  const stroke = { stroke: c.outline, strokeWidth: sw, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  const base = (x: number) => T.y - BAND_H + sagAt(T, x) + 1.2
  const ts = tips(T)
  // Filigran: en indre bue i hver af de høje buer.
  const fil = join(...ts.filter(([, h]) => h > OUTER).map(([x, h]) => spline([[x - 3.2, base(x) - 1], [x - 2.6, base(x) - h * 0.55], [x, base(x) - h * 0.78], [x + 2.6, base(x) - h * 0.55], [x + 3.2, base(x) - 1]])))
  const pearls = join(...ts.map(([x, h]) => circle(x, base(x) - h - 1.4, h === MID ? 3.4 : 2.6)))
  const y = (x: number) => T.y + sagAt(T, x)
  const side = T.w * 0.44
  // Sten: runde i sidebuerne og en dråbe midt på (eller en lille sten under hornet).
  const gems = join(ellipse(-side, base(-side) - INNER * 0.4, 2.7, 3.1), ellipse(side, base(side) - INNER * 0.4, 2.7, 3.1))
  const big = T.mid ? drop(0, base(0) - MID * 0.36, 4.6) : circle(0, y(0), 3.2)
  const top = T.mid ? ([0, base(0) - MID - 1.4] as const) : ([side, base(side) - INNER - 1.4] as const)
  return (
    <>
      <path d={plate(T)} fill={c.main} {...stroke} />
      <path d={fil} fill="none" stroke={c.mainShade} strokeWidth={sw * 0.55} strokeLinecap="round" />
      <path d={pearls} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.7} />
      <path d={band(T)} fill={c.main} {...stroke} />
      <path d={gems} fill={c.trim} stroke={c.trimOutline} strokeWidth={sw * 0.6} />
      <path d={big} fill={c.accent} stroke={c.accentOutline} strokeWidth={sw * 0.65} strokeLinejoin="round" />
      <path
        d={join(
          ellipse(T.mid ? -1.6 : -1.1, (T.mid ? base(0) - MID * 0.36 : y(0)) - 1.6, 1.3, 1.6, 0),
          ellipse(-side - 0.9, base(-side) - INNER * 0.4 - 1.1, 0.9, 1.1, 0), ellipse(side - 0.9, base(side) - INNER * 0.4 - 1.1, 0.9, 1.1, 0),
          ...ts.map(([x, h]) => circle(x - 0.9, base(x) - h - 2.3, 0.8)),
          ellipse(-T.w * 0.62, y(-T.w * 0.62) - 0.9, 3, 0.9, 0),
        )}
        fill={c.highlight}
      />
      <path d={star(top[0] + 6.2, top[1] - 3.6, 5.6, 1.4)} fill={c.main} stroke={c.outline} strokeWidth={sw * 0.45} strokeLinejoin="round" />
    </>
  )
}

/** Hængeører og ører bag hovedet (ingen huller): diademet tegnes i hattens lag. */
const front: ItemArt = (p) => (p.holes ? null : tiara(p))
/** Ører og horn gennem diademet: hele diademet tegnes oven på deres rod. */
const rim: ItemArt = (p) => tiara(p)

export const kongeligHead: ItemDef = {
  id: 'kongelig-head',
  set: 'kongelig',
  slot: 'head',
  nameClip: 'name.item.kongelig-head',
  source: { kind: 'chest', nodeId: 'w2-veksling-chest' },
  colorways: [
    fabric('guld', 'guld', 'gold', 'sky', 'berry'),
    fabric('soelv', 'sølv', 'silver', 'mint', 'violet'),
    fabric('rosa', 'rosa', 'rose', 'snow', 'teal'),
  ],
  art: { front, rim },
  fit: { anchor: 'headTop', scaleBy: 'headWidth', baseScale: 1, baseWidth: 92, earMode: 'through' },
  hornHole: { lift: 4, rx: 7.4, ry: 2.6 },
  icon: { box: [-47, -19.5, 94, 41] },
}

export default kongeligHead
