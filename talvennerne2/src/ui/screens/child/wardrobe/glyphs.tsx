// Own glyphs for the wardrobe and the shop, drawn like the design icons (src/ui/design/icons.ts): a
// 24 grid, stroke 2 in currentColor, round caps and joins, a duotone body (`tv-icon__fill`, 18 %)
// and small always-filled details. One per slot (the body slot uses the dock's T-shirt) and one per
// piece of decor. They stand in for things that are not drawn yet, so a thing never looks broken.
import type { CSSProperties } from 'react'
import type { DecorId, Slot } from '../../../../engine/types'
import { ICONS } from '../../../design/icons'
import type { IconDef } from '../../../design/icons'
import { cx } from '../../../design/cx'

const q = (v: number) => String(Math.round(v * 100) / 100)
const circle = (cx: number, cy: number, r: number) =>
  `M${q(cx - r)} ${q(cy)}a${q(r)} ${q(r)} 0 1 0 ${q(2 * r)} 0a${q(r)} ${q(r)} 0 1 0 ${q(-2 * r)} 0z`
const roundRect = (x: number, y: number, w: number, h: number, r: number) =>
  `M${q(x + r)} ${q(y)}h${q(w - 2 * r)}a${q(r)} ${q(r)} 0 0 1 ${q(r)} ${q(r)}v${q(h - 2 * r)}a${q(r)} ${q(r)} 0 0 1 ${q(-r)} ${q(r)}` +
  `h${q(-(w - 2 * r))}a${q(r)} ${q(r)} 0 0 1 ${q(-r)} ${q(-r)}v${q(-(h - 2 * r))}a${q(r)} ${q(r)} 0 0 1 ${q(r)} ${q(-r)}z`

// ─── Slots ──────────────────────────────────────────────────────────────────

const HAT_DOME = 'M5 15a7 7 0 0 1 14 0z'
const HAT_BRIM = roundRect(4, 15, 16, 4.5, 1.5)
const HAND =
  'M8 21.5C6.6 20 5.4 18.2 4.3 15.6L3.4 13.4a1.25 1.25 0 0 1 2.2-1.1L7 14.2V6.8a1.25 1.25 0 0 1 2.5 0V11' +
  'V5.2a1.25 1.25 0 0 1 2.5 0V11V6a1.25 1.25 0 0 1 2.5 0v5.5V8.2a1.25 1.25 0 0 1 2.5 0V15c0 2.6-.6 4.8-1.5 6.5z'
const SCARF_BAND = 'M4.5 7.5c3.6 2.6 11.4 2.6 15 0v3.4c-3.6 2.6-11.4 2.6-15 0z'
const SCARF_TAIL = 'M13.4 12.6l3.4-.7 1.7 7.8-3.4.7z'
const PACK = 'M6.5 9a3.5 3.5 0 0 1 3.5-3.5h4A3.5 3.5 0 0 1 17.5 9v10a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19z'

export const SLOT_GLYPHS: Readonly<Record<Slot, IconDef>> = {
  head: {
    stroke: ['M5 15a7 7 0 0 1 14 0', HAT_BRIM, circle(12, 6, 2)],
    fill: [HAT_DOME, HAT_BRIM, circle(12, 6, 2)],
  },
  face: {
    stroke: [circle(7.5, 13.5, 3.5), circle(16.5, 13.5, 3.5), 'M11 13.2c.6-.8 1.4-.8 2 0', 'M4 13.2L2.6 11', 'M20 13.2l1.4-2.2'],
    fill: [circle(7.5, 13.5, 3.5), circle(16.5, 13.5, 3.5)],
  },
  neck: {
    stroke: [SCARF_BAND, SCARF_TAIL, 'M15.3 20.4l.3 1.4', 'M17.4 19.9l.3 1.4'],
    fill: [SCARF_BAND, SCARF_TAIL],
  },
  body: ICONS.shirt,
  back: {
    stroke: [PACK, 'M10 5.5v-.9a2 2 0 0 1 4 0v.9', 'M6.5 11.5h11', roundRect(9, 14, 6, 4.5, 1)],
    fill: [PACK],
  },
  hand: {
    stroke: [HAND],
    fill: [HAND],
  },
}

/** New colours (the shop's colour shelf): a painter's palette. */
const PALETTE = 'M12 3.5c-4.9 0-8.5 3.6-8.5 8.1 0 4.4 3.4 7.9 7.6 7.9 1.3 0 1.9-.8 1.9-1.7 0-1.2-1-1.6-1-2.7 0-1.1.9-1.8 2-1.8h2.3c2.6 0 4.2-1.8 4.2-4.1C20.5 5.9 16.6 3.5 12 3.5z'
export const PALETTE_GLYPH: IconDef = {
  stroke: [PALETTE],
  fill: [PALETTE],
  solid: [circle(7.6, 11.3, 1.35), circle(9.6, 7.4, 1.35), circle(14, 6.6, 1.35), circle(17.2, 9.4, 1.2)],
}

// ─── Decor ──────────────────────────────────────────────────────────────────

const PETALS = [-90, -18, 54, 126, 198].map((deg) => {
  const r = (deg * Math.PI) / 180
  return circle(12 + 3.2 * Math.cos(r), 8.5 + 3.2 * Math.sin(r), 2)
})
const BED = roundRect(3.5, 17, 17, 4.5, 1)
const LANTERN_GLASS = roundRect(8.5, 7.5, 7, 10, 0.8)
const BENCH_BACK = roundRect(5, 6, 14, 4.5, 1)
const BENCH_SEAT = roundRect(3.5, 12.5, 17, 3, 1)
const SWING_SEAT = roundRect(7.5, 15, 9, 2.4, 1)
const POND = 'M3 17.5c0-1.9 4-3.5 9-3.5s9 1.6 9 3.5-4 3.5-9 3.5-9-1.6-9-3.5z'
const DUCK = 'M7.5 14.3c0-2 1.8-3 4-3h3c1.8 0 3 1 3 2.6 0 1.5-1.4 2.4-3.4 2.4H10c-1.5 0-2.5-.8-2.5-2z'
const HOUSE = 'M8 9.5h8v5.5H8z'
const ROOF = 'M6.5 9.5L12 4.5l5.5 5z'
const BASIN = 'M4 15h16l-1.5 4.6a1.4 1.4 0 0 1-1.3 1H6.8a1.4 1.4 0 0 1-1.3-1z'
const BOWL = 'M8.5 9.5h7c0 1.2-1.6 2-3.5 2s-3.5-.8-3.5-2z'
const ARCH = 'M3.5 18a8.5 8.5 0 0 1 17 0h-3a5.5 5.5 0 0 0-11 0z'

export const DECOR_GLYPHS: Readonly<Record<DecorId, IconDef>> = {
  'pynt-blomsterbed': {
    stroke: [...PETALS, circle(12, 8.5, 1.5), 'M12 12.6V17', 'M12 15.4c1.2-1.6 2.8-1.9 3.6-1.6-.3 1.4-1.8 2.2-3.6 1.6z', BED],
    fill: [...PETALS, BED],
  },
  'pynt-lygte': {
    stroke: [circle(12, 3.8, 1.3), 'M8.5 7.5l1.5-2.4h4l1.5 2.4', LANTERN_GLASS, roundRect(7.5, 17.5, 9, 2.6, 0.8)],
    fill: [LANTERN_GLASS],
    solid: ['M12 15.6c-1.3 0-2-1-1.6-2.2.3-.9 1.2-1.5 1.6-2.6.5 1 1.4 1.7 1.6 2.6.4 1.2-.3 2.2-1.6 2.2z'],
  },
  'pynt-baenk': {
    stroke: [BENCH_BACK, BENCH_SEAT, 'M6.5 10.5v2', 'M17.5 10.5v2', 'M6 15.5V20', 'M18 15.5V20'],
    fill: [BENCH_BACK, BENCH_SEAT],
  },
  'pynt-gynge': {
    stroke: ['M3.5 4h17', 'M5 4L3 21', 'M19 4l2 17', 'M9 4v11', 'M15 4v11', SWING_SEAT],
    fill: [SWING_SEAT],
  },
  'pynt-dam': {
    stroke: [POND, DUCK, circle(16, 9, 2.2), 'M18.1 8.9l2.2.4-2 1'],
    fill: [POND, DUCK, circle(16, 9, 2.2)],
    solid: [circle(16.4, 8.6, 0.45)],
  },
  'pynt-traehus': {
    stroke: [ROOF, HOUSE, 'M11 12h2v3h-2z', 'M10.8 15h2.4v6.5h-2.4z', circle(4.8, 13.4, 2), circle(19.2, 13.4, 2), 'M10.8 18c-2-.3-3.5-1.6-4.4-3.2', 'M13.2 17.6c2-.3 3.5-1.6 4.4-3.2', 'M7 21.5h10'],
    fill: [ROOF, HOUSE, circle(4.8, 13.4, 2), circle(19.2, 13.4, 2)],
  },
  'pynt-springvand': {
    stroke: [BASIN, BOWL, 'M10.8 15v-3.6h2.4V15', 'M12 9.5V4.4', 'M12 4.6c-2.3 0-3.8 1.6-4.3 4', 'M12 4.6c2.3 0 3.8 1.6 4.3 4'],
    fill: [BASIN, BOWL],
  },
  'pynt-regnbuebue': {
    stroke: ['M3.5 18a8.5 8.5 0 0 1 17 0', 'M6.5 18a5.5 5.5 0 0 1 11 0', 'M9.5 18a2.5 2.5 0 0 1 5 0', 'M2.5 20.5h19'],
    fill: [ARCH],
  },
}

export interface GlyphProps {
  def: IconDef
  size?: number | string
  strokeWidth?: number
  /** Outline only (a thing the child does not have yet). */
  hollow?: boolean
  className?: string
  style?: CSSProperties
}

/** Renders a glyph like <Icon> does (same classes, so calm mode and duotone rules apply). */
export function Glyph({ def, size = 28, strokeWidth = 2, hollow, className, style }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={cx('tv-icon', className)}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
    >
      {!hollow && def.fill?.map((d, i) => <path key={`f${i}`} d={d} className="tv-icon__fill" fill="currentColor" stroke="none" opacity={0.18} />)}
      {def.stroke.map((d, i) => (
        <path key={`s${i}`} d={d} />
      ))}
      {!hollow && def.solid?.map((d, i) => <path key={`d${i}`} d={d} fill="currentColor" stroke="none" />)}
    </svg>
  )
}

export const SlotGlyph = ({ slot, ...rest }: Omit<GlyphProps, 'def'> & { slot: Slot }) => <Glyph def={SLOT_GLYPHS[slot]} {...rest} />
export const DecorGlyph = ({ id, ...rest }: Omit<GlyphProps, 'def'> & { id: DecorId }) => <Glyph def={DECOR_GLYPHS[id]} {...rest} />
