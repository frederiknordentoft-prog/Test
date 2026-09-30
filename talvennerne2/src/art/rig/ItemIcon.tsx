// Genstandsikon til butik, garderobe og kister: genstanden alene på en usynlig mannequin
// (standardankrene for `round`), beskåret til slottets område. Samme tegning som på dyret.
import { useId } from 'react'
import { DEFAULT_ANCHORS, OUTLINE } from './anchors'
import { templateBody } from './bodies'
import { fitItem, fitTransform, inverseTransform, toLocal } from './fit'
import { itemPalette } from './palette'
import type { ItemArtProps, ItemDef, Slot } from './types'

/** Beskæring pr. slot (x, y, w, h) i modelrummet. Formatet er kvadratisk. */
export const ICON_CROP: Record<Slot, readonly [number, number, number, number]> = {
  head: [36, -8, 128, 128],
  face: [44, 58, 112, 112],
  neck: [52, 110, 96, 96],
  body: [36, 124, 128, 128],
  back: [30, 120, 140, 140],
  hand: [86, 150, 76, 76],
}

export function ItemIcon({ item, colorway = 0, size = 64, title }: { item: ItemDef; colorway?: 0 | 1 | 2; size?: number; title?: string }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const a = DEFAULT_ANCHORS
  const fit = fitItem(item, a, { id: 'rabbit', family: 'lagomorph' })
  const c = itemPalette(item.colorways[colorway])
  const body = templateBody('round')
  const bodyD = body(a, 0, 2)
  const [x, y, w, h] = ICON_CROP[item.slot]
  const art = item.slot === 'body' ? (item.art.bodyShapes?.round ?? item.art.front) : item.art.front
  const clip = item.slot === 'body' ? `${uid}c` : undefined
  const sw = OUTLINE / fit.scale
  const props: ItemArtProps = {
    c, a, sw, body: 'round', earMode: fit.earMode,
    ids: { uid, bodyClip: '', headClip: '', gradient: '' },
    local: (p) => toLocal(fit, p),
    restroke: (color) => (
      <path d={bodyD} transform={inverseTransform(fit)} fill="none" stroke={color ?? c.outline} strokeWidth={OUTLINE} strokeLinejoin="round" />
    ),
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${x} ${y} ${w} ${h}`}
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-item-icon={item.id}
    >
      {clip && (
        <defs>
          <clipPath id={clip}>
            <path d={body(a, 2, 2)} />
          </clipPath>
        </defs>
      )}
      <g clipPath={clip ? `url(#${clip})` : undefined}>
        <g transform={fitTransform(fit)}>
          {item.art.back?.(props)}
          {art(props)}
        </g>
      </g>
    </svg>
  )
}
