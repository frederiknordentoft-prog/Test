// A thing as a small picture for the wardrobe and the shop: its drawing in one of its three colours,
// a pale outline drawing for a thing the child does not have yet, and — while a thing is not drawn —
// a neutral stand-in: the slot's glyph in the set's colour (hollow for an outline), which turns into
// the drawing by itself when the art lands in src/art/items.
import type { CSSProperties } from 'react'
import { ITEM_BY_ID } from '../../../../content/catalog'
import type { ItemColor, ItemId } from '../../../../engine/types'
import { ItemIcon } from '../../../../art/rig/ItemIcon'
import { FABRIC } from '../../../../art/rig/palette'
import type { Colorway, ItemDef } from '../../../../art/rig/types'
import { cx } from '../../../design/cx'
import { useItemDef } from '../map/art'
import { SlotGlyph } from './glyphs'
import { SET_TONE, toneStyle } from './tones'
import './shared.css'

/** The outline look: near-white cloth; the rig derives a soft grey line from it. */
const GHOST: Colorway = { id: 'ghost', name: '', main: FABRIC.snow, trim: FABRIC.snow, accent: FABRIC.silver }
const ghosts = new WeakMap<ItemDef, ItemDef>()

function ghostOf(def: ItemDef): ItemDef {
  let g = ghosts.get(def)
  if (!g) {
    g = { ...def, colorways: [GHOST, GHOST, GHOST] }
    ghosts.set(def, g)
  }
  return g
}

export interface ItemThumbProps {
  item: ItemId
  color?: ItemColor
  /** CSS px; without it the picture fills the box the stylesheet gives `.tv-wr-thumb`. */
  size?: number
  /** An outline: the child does not have it yet. */
  ghost?: boolean
  className?: string
}

export function ItemThumb({ item, color = 0, size, ghost = false, className }: ItemThumbProps) {
  const def = useItemDef(item)
  const meta = ITEM_BY_ID[item]
  const shown = def ? (ghost ? ghostOf(def) : def) : null
  const style: CSSProperties = { ...toneStyle(SET_TONE[meta.set]), ...(size ? { width: size, height: size } : {}) }
  return (
    <span
      className={cx('tv-wr-thumb', ghost && 'is-ghost', !shown && 'is-placeholder', `is-c${color}`, className)}
      style={style}
      aria-hidden
      data-thumb={item}
      data-drawn={def ? '' : undefined}
    >
      {shown ? (
        <ItemIcon item={shown} colorway={ghost ? 0 : color} size={size ?? 96} />
      ) : (
        <span className="tv-wr-thumb__stand">
          <SlotGlyph slot={meta.slot} size="62%" strokeWidth={ghost ? 1.8 : 2.1} hollow={ghost} className="tv-wr-thumb__glyph" />
        </span>
      )}
    </span>
  )
}
