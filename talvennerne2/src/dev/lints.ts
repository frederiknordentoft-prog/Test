// Kontaktarkenes geometri-lints (SPEC §11 pipeline pkt. 5), kørt i Chromium via getBBox og
// isPointInFill. scripts/sheets.mjs kalder window.__lint() for hver rute og fejler ved fund.
import { SAFE } from '../art/rig/anchors'

export const BUDGET = { animal: 90, item: 25 } as const
/** Genstandens bbox skal ligge inden for artens hull + 6 enheder. */
export const HULL_MARGIN = 6
/** Brillers glas må højst have 25 % opacitet over øjnene. */
export const GLASS_OPACITY = 0.25

export interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface LintResult {
  rigs: number
  items: number
  checks: number
  errors: string[]
  /** Største elementtal pr. dyr og pr. genstand (til rapporten). */
  maxAnimal: number
  maxItem: number
  /** Mindste andel af butikskortet, en genstand alene fylder (største led), hvis arket har kort. */
  minCardFill?: number
}

/** Genstanden alene skal fylde mindst halvdelen af butikskortet (review G0-r1, fund 1; mål 75–80 %). */
export const CARD_FILL_MIN = 0.5

const DRAWN = 'path,ellipse,circle,rect,polygon,polyline,line'
const EMPTY: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }

const union = (a: Box, b: Box): Box => ({
  x0: Math.min(a.x0, b.x0),
  y0: Math.min(a.y0, b.y0),
  x1: Math.max(a.x1, b.x1),
  y1: Math.max(a.y1, b.y1),
})
const intersect = (a: Box, b: Box): Box => ({
  x0: Math.max(a.x0, b.x0),
  y0: Math.max(a.y0, b.y0),
  x1: Math.min(a.x1, b.x1),
  y1: Math.min(a.y1, b.y1),
})
const valid = (b: Box) => b.x1 >= b.x0 && b.y1 >= b.y0
const fmt = (b: Box) => `(${b.x0.toFixed(1)},${b.y0.toFixed(1)})–(${b.x1.toFixed(1)},${b.y1.toFixed(1)})`

/** Matrix fra elementets lokale rum til rod-svg'ens brugerrum (viewBox). */
function toRoot(el: SVGGraphicsElement, root: SVGSVGElement): DOMMatrix {
  return root.getScreenCTM()!.inverse().multiply(el.getScreenCTM()!)
}

function boxIn(el: SVGGraphicsElement, root: SVGSVGElement, pad = 0): Box {
  const b = el.getBBox()
  const m = toRoot(el, root)
  const pts = [
    new DOMPoint(b.x - pad, b.y - pad),
    new DOMPoint(b.x + b.width + pad, b.y - pad),
    new DOMPoint(b.x - pad, b.y + b.height + pad),
    new DOMPoint(b.x + b.width + pad, b.y + b.height + pad),
  ].map((p) => p.matrixTransform(m))
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}

function inDefs(el: Element): boolean {
  return !!el.closest('defs,clipPath,linearGradient,radialGradient')
}

/** Klippenes geometri (clipPath-børn) for elementet og dets forfædre. */
function clipsOf(el: Element, root: SVGSVGElement): { ref: SVGGraphicsElement; shape: SVGGeometryElement }[] {
  const out: { ref: SVGGraphicsElement; shape: SVGGeometryElement }[] = []
  for (let e: Element | null = el; e && e !== root; e = e.parentElement) {
    const cp = e.getAttribute('clip-path')
    const m = cp && /url\(#([^)]+)\)/.exec(cp)
    if (!m) continue
    const clip = root.querySelector(`[id="${m[1]}"]`)
    const shape = clip?.querySelector(DRAWN) as SVGGeometryElement | null
    if (shape) out.push({ ref: e as SVGGraphicsElement, shape })
  }
  return out
}

function visible(el: SVGGraphicsElement): { fill: boolean; stroke: boolean; opacity: number } {
  const cs = getComputedStyle(el)
  let opacity = Number(cs.opacity)
  for (let e = el.parentElement; e && e.tagName !== 'svg'; e = e.parentElement) opacity *= Number(getComputedStyle(e).opacity)
  const fill = cs.fill !== 'none' && Number(cs.fillOpacity) > 0
  const stroke = cs.stroke !== 'none' && Number(cs.strokeWidth.replace('px', '')) > 0
  return { fill, stroke, opacity }
}

/** Den tegnede bbox (inkl. halv stregbredde, beskåret af klip) i rodens brugerrum. */
function drawnBox(el: SVGGeometryElement, root: SVGSVGElement): Box | null {
  const v = visible(el)
  if ((!v.fill && !v.stroke) || v.opacity <= 0.001) return null
  const sw = v.stroke ? Number(getComputedStyle(el).strokeWidth.replace('px', '')) : 0
  let box = boxIn(el, root, sw / 2)
  for (const c of clipsOf(el, root)) box = intersect(box, clipBoxIn(c, root))
  return valid(box) ? box : null
}

/** clipPath-geometri ligger i det refererende elements brugerrum. */
function clipBoxIn(c: { ref: SVGGraphicsElement; shape: SVGGeometryElement }, root: SVGSVGElement): Box {
  const b = c.shape.getBBox()
  const m = toRoot(c.ref, root)
  const pts = [
    new DOMPoint(b.x, b.y),
    new DOMPoint(b.x + b.width, b.y),
    new DOMPoint(b.x, b.y + b.height),
    new DOMPoint(b.x + b.width, b.y + b.height),
  ].map((p) => p.matrixTransform(m))
  return {
    x0: Math.min(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)),
    x1: Math.max(...pts.map((p) => p.x)),
    y1: Math.max(...pts.map((p) => p.y)),
  }
}

function unionOf(els: SVGGeometryElement[], root: SVGSVGElement): Box {
  return els.reduce<Box>((acc, el) => {
    const b = drawnBox(el, root)
    return b ? union(acc, b) : acc
  }, EMPTY)
}

/** Punkter (i skærmkoordinater) der ligger inde i øjnene. */
function eyeSamples(eye: SVGGeometryElement): DOMPoint[] {
  const b = eye.getBBox()
  const m = eye.getScreenCTM()!
  const pts: DOMPoint[] = []
  for (let i = 0; i <= 12; i++)
    for (let j = 0; j <= 8; j++) {
      const p = new DOMPoint(b.x + (b.width * i) / 12, b.y + (b.height * j) / 8)
      if (eye.isPointInFill(p)) pts.push(p.matrixTransform(m))
    }
  return pts
}

function covers(el: SVGGeometryElement, screen: DOMPoint, root: SVGSVGElement): boolean {
  const local = screen.matrixTransform(el.getScreenCTM()!.inverse())
  const v = visible(el)
  const hit = (v.fill && el.isPointInFill(local)) || (v.stroke && el.isPointInStroke(local))
  if (!hit) return false
  for (const c of clipsOf(el, root)) {
    const p = screen.matrixTransform(c.ref.getScreenCTM()!.inverse())
    if (!c.shape.isPointInFill(p)) return false
  }
  return true
}

export function lintRig(root: SVGSVGElement, label: string, opts: { safeZone: boolean; fit: boolean }): { errors: string[]; checks: number; animal: number; items: number[] } {
  const errors: string[] = []
  let checks = 0
  const itemGroups = [...root.querySelectorAll<SVGGElement>('[data-item]')]
  const itemEls = new Set<Element>(itemGroups.flatMap((g) => [g, ...g.querySelectorAll('*')]))
  const total = root.querySelectorAll('*').length
  const animal = total - itemEls.size
  checks++
  if (animal > BUDGET.animal) errors.push(`${label}: ${animal} elementer i dyret (> ${BUDGET.animal})`)
  const itemCounts = itemGroups.map((g) => g.querySelectorAll('*').length + 1)
  itemGroups.forEach((g, i) => {
    checks++
    if (itemCounts[i] > BUDGET.item) errors.push(`${label}: genstanden ${g.dataset.item} har ${itemCounts[i]} elementer (> ${BUDGET.item})`)
  })

  const drawn = [...root.querySelectorAll<SVGGeometryElement>(DRAWN)].filter((el) => !inDefs(el))
  if (opts.safeZone) {
    checks++
    const all = unionOf(drawn, root)
    if (all.x0 < SAFE.x0 - 0.05 || all.x1 > SAFE.x1 + 0.05 || all.y0 < SAFE.y0 - 0.05 || all.y1 > SAFE.y1 + 0.05)
      errors.push(`${label}: uden for sikker zone x ${SAFE.x0}–${SAFE.x1}, y ${SAFE.y0}–${SAFE.y1}: ${fmt(all)}`)
  }

  if (opts.fit && itemGroups.length) {
    const body = drawn.filter((el) => !itemEls.has(el) && !el.closest('[data-part="shadow"],[data-part="aura"],[data-part="fx"]'))
    const bodyHull = unionOf(body, root)
    // Hovedgenstande må rage op over hovedet (hattezonen), også på arter uden høje ører.
    const hatTop = Number(root.dataset.hatTop ?? NaN)
    const eye = root.querySelector<SVGGeometryElement>('[data-part="eyes"]')
    const samples = eye ? eyeSamples(eye) : []
    for (const g of itemGroups) {
      const els = [...g.querySelectorAll<SVGGeometryElement>(DRAWN)].filter((el) => !inDefs(el))
      const box = unionOf(els, root)
      const hull = g.dataset.slot === 'head' && Number.isFinite(hatTop) ? { ...bodyHull, y0: Math.min(bodyHull.y0, hatTop) } : bodyHull
      checks++
      const m = HULL_MARGIN
      if (box.x0 < hull.x0 - m || box.x1 > hull.x1 + m || box.y0 < hull.y0 - m || box.y1 > hull.y1 + m)
        errors.push(`${label}: ${g.dataset.item} ${fmt(box)} går ud over artens hull ${fmt(hull)} + ${m}`)
      checks++
      if (!eye) {
        errors.push(`${label}: fandt ingen øjne at tjekke mod`)
        continue
      }
      const glass = g.dataset.slot === 'face'
      let hits = 0
      for (const el of els) {
        const v = visible(el)
        if (glass && v.opacity <= GLASS_OPACITY) continue
        for (const s of samples) if (covers(el, s, root)) hits++
      }
      if (hits > 0) errors.push(`${label}: ${g.dataset.item} dækker øjnene (${hits} prøvepunkter)`)
    }
  }
  return { errors, checks, animal, items: itemCounts }
}

/** Butikskort med genstanden alene: den synlige tegning (klip medregnet) skal fylde kortet. */
function lintCards(res: LintResult) {
  const cards = [...document.querySelectorAll<HTMLElement>('.sh-card[data-card="item"]')]
  for (const card of cards) {
    const svg = card.querySelector<SVGSVGElement>('svg[data-item-icon]')
    if (!svg) continue
    const els = [...svg.querySelectorAll<SVGGeometryElement>(DRAWN)].filter((el) => !inDefs(el))
    const box = unionOf(els, svg)
    const vb = svg.viewBox.baseVal
    const rect = svg.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    const fill = Math.max(((box.x1 - box.x0) / vb.width) * rect.width, ((box.y1 - box.y0) / vb.height) * rect.height) / Math.min(cardRect.width, cardRect.height)
    res.checks++
    res.minCardFill = Math.min(res.minCardFill ?? 1, fill)
    if (!(fill >= CARD_FILL_MIN)) res.errors.push(`${card.dataset.label}: genstanden fylder kun ${(fill * 100).toFixed(0)} % af kortet (< ${CARD_FILL_MIN * 100} %)`)
  }
}

/** Kør alle lints på siden. Hver rig kan slå tjek til med data-lint="safe fit". */
export function runLints(): LintResult {
  const rigs = [...document.querySelectorAll<SVGSVGElement>('svg.rig')]
  const res: LintResult = { rigs: rigs.length, items: 0, checks: 0, errors: [], maxAnimal: 0, maxItem: 0 }
  lintCards(res)
  rigs.forEach((svg, i) => {
    const mode = svg.closest<HTMLElement>('[data-lint]')?.dataset.lint ?? ''
    const label = svg.closest<HTMLElement>('[data-label]')?.dataset.label ?? `rig ${i + 1}`
    const r = lintRig(svg, label, { safeZone: mode.includes('safe'), fit: mode.includes('fit') })
    res.checks += r.checks
    res.errors.push(...r.errors)
    res.items += r.items.length
    res.maxAnimal = Math.max(res.maxAnimal, r.animal)
    res.maxItem = Math.max(res.maxItem, ...r.items, 0)
  })
  return res
}
