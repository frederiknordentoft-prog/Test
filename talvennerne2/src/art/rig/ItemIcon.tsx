// Genstandsikon til butik, garderobe og kister: genstanden alene (`solo`) på en usynlig mannequin
// (standardankrene for `round`). Samme tegning og stofpalet som på dyret; kropstøj tegner sin
// egen flade silhuet. Ikonet beskæres efter genstandens egen boks (`icon.box`), så den fylder ca.
// 78 % af kortet (review G0-r1, fund 1). Mangler boksen, måles den synlige tegning i DOM'en
// (klip medregnet), og indtil da bruges en fast beskæring pr. slot.
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { DEFAULT_ANCHORS, OUTLINE } from './anchors'
import { templateBody } from './bodies'
import { fitItem, fitTransform, inverseTransform, toLocal } from './fit'
import { itemPalette } from './palette'
import type { FitResult, ItemArtProps, ItemDef, Slot } from './types'

/** Andel af kortet, genstanden fylder (største led). */
export const ICON_FILL = 0.78

/** Fast beskæring pr. slot (x, y, w, h) i modelrummet, når genstanden hverken har boks eller kan måles. */
export const ICON_CROP: Record<Slot, readonly [number, number, number, number]> = {
  head: [36, -8, 128, 128],
  face: [44, 58, 112, 112],
  neck: [52, 110, 96, 96],
  body: [36, 124, 128, 128],
  back: [30, 120, 140, 140],
  hand: [86, 150, 76, 76],
}

/** Kvadratisk viewBox om en boks (modelrum), så boksens største led fylder `fill`. */
function squareBox(x: number, y: number, w: number, h: number, fill = ICON_FILL): string {
  const side = Math.max(w, h) / fill
  const cx = x + w / 2
  const cy = y + h / 2
  return `${(cx - side / 2).toFixed(1)} ${(cy - side / 2).toFixed(1)} ${side.toFixed(1)} ${side.toFixed(1)}`
}

/** Genstandens egen boks ført gennem pasformen på mannequinen (modelrum). */
export function iconViewBox(item: ItemDef, fit: FitResult): string | null {
  const b = item.icon?.box
  if (!b) return null
  const [x, y, w, h] = b
  return squareBox(fit.x + x * fit.scale, fit.y + y * fit.scale, w * fit.scale, h * fit.scale)
}

type Bounds = { x0: number; y0: number; x1: number; y1: number }

/** Den synlige bbox i rodens brugerrum: elementernes bbox snævret ind af deres klip (getBBox ignorerer klip). */
function visibleBox(root: SVGSVGElement, g: SVGGElement): Bounds | null {
  const toRoot = (el: SVGGraphicsElement) => root.getScreenCTM()!.inverse().multiply(el.getScreenCTM()!)
  const boxOf = (el: SVGGraphicsElement, b: DOMRect): Bounds => {
    const m = toRoot(el)
    const pts = [
      new DOMPoint(b.x, b.y), new DOMPoint(b.x + b.width, b.y),
      new DOMPoint(b.x, b.y + b.height), new DOMPoint(b.x + b.width, b.y + b.height),
    ].map((p) => p.matrixTransform(m))
    return { x0: Math.min(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), x1: Math.max(...pts.map((p) => p.x)), y1: Math.max(...pts.map((p) => p.y)) }
  }
  let acc: Bounds | null = null
  for (const el of g.querySelectorAll<SVGGeometryElement>('path,ellipse,circle,rect')) {
    if (el.closest('defs,clipPath')) continue
    let b = boxOf(el, el.getBBox())
    for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
      const m = /url\(#([^)]+)\)/.exec(e.getAttribute('clip-path') ?? '')
      const shape = m ? root.querySelector<SVGGraphicsElement>(`[id="${m[1]}"] > *`) : null
      if (!shape) continue
      const c = boxOf(e as SVGGraphicsElement, shape.getBBox())
      b = { x0: Math.max(b.x0, c.x0), y0: Math.max(b.y0, c.y0), x1: Math.min(b.x1, c.x1), y1: Math.min(b.y1, c.y1) }
    }
    if (b.x1 <= b.x0 || b.y1 <= b.y0) continue
    acc = acc ? { x0: Math.min(acc.x0, b.x0), y0: Math.min(acc.y0, b.y0), x1: Math.max(acc.x1, b.x1), y1: Math.max(acc.y1, b.y1) } : b
  }
  return acc
}

export function ItemIcon({ item, colorway = 0, size = 64, title }: { item: ItemDef; colorway?: 0 | 1 | 2; size?: number; title?: string }) {
  const uid = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const svg = useRef<SVGSVGElement>(null)
  const content = useRef<SVGGElement>(null)
  const a = DEFAULT_ANCHORS
  const fit = fitItem(item, a, { id: 'rabbit', family: 'lagomorph' })
  const declared = iconViewBox(item, fit)
  const [measured, setMeasured] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (declared) return
    const root = svg.current
    const g = content.current
    if (!root || !g || typeof g.getBBox !== 'function') return
    const b = visibleBox(root, g)
    if (b) setMeasured(squareBox(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0))
  }, [item, colorway, declared])

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
    holes: false,
    stage: 2,
  }
  return (
    <svg
      ref={svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={declared ?? measured ?? `${x} ${y} ${w} ${h}`}
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
