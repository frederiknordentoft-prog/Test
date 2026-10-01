// Genstandsikon til butik, garderobe og kister: genstanden alene (`solo`) på en usynlig mannequin
// (standardankrene for `round`). Samme tegning og stofpalet som på dyret; kropstøj tegner sin
// egen flade silhuet. I DOM'en beskæres ikonet automatisk til genstandens bbox.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_ANCHORS, OUTLINE } from './anchors'
import { templateBody } from './bodies'
import { fitItem, fitTransform, inverseTransform, toLocal } from './fit'
import { itemPalette } from './palette'
import type { ItemArtProps, ItemDef, Slot } from './types'

/** Fast beskæring pr. slot (x, y, w, h) i modelrummet, når der ikke kan måles (statisk markup). */
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
  const content = useRef<SVGGElement>(null)
  const [fitBox, setFitBox] = useState<string | null>(null)
  useLayoutEffect(() => {
    const g = content.current
    if (!g || typeof g.getBBox !== 'function') return
    const b = g.getBBox()
    const side = Math.max(b.width, b.height) * 1.08 + OUTLINE * 2
    const cx = b.x + b.width / 2
    const cy = b.y + b.height / 2
    setFitBox(`${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`)
  }, [item, colorway])

  const a = DEFAULT_ANCHORS
  const fit = fitItem(item, a, { id: 'rabbit', family: 'lagomorph' })
  const c = itemPalette(item.colorways[colorway])
  const bodyD = templateBody('round')(a, 0, 2)
  const [x, y, w, h] = ICON_CROP[item.slot]
  const art = item.slot === 'body' ? (item.art.bodyShapes?.round ?? item.art.front) : item.art.front
  const props: ItemArtProps = {
    c,
    a,
    sw: OUTLINE / fit.scale,
    body: 'round',
    earMode: fit.earMode,
    ids: { uid, bodyClip: '', headClip: '', outsideHead: '', gradient: '' },
    local: (p) => toLocal(fit, p),
    restroke: (color) => (
      <path d={bodyD} transform={inverseTransform(fit)} fill="none" stroke={color ?? c.outline} strokeWidth={OUTLINE} strokeLinejoin="round" />
    ),
    solo: true,
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={fitBox ?? `${x} ${y} ${w} ${h}`}
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-item-icon={item.id}
    >
      <g ref={content}>
        <g transform={fitTransform(fit)}>
          {item.art.back?.(props)}
          {art(props)}
        </g>
      </g>
    </svg>
  )
}
