// Kontaktarkenes geometri-lints (SPEC §11 pipeline pkt. 5), kørt i Chromium via getBBox og
// isPointInFill. scripts/sheets.mjs kalder window.__lint() for hver rute og fejler ved fund.
import { SAFE } from '../art/rig/anchors'
import { BAKKE, ENG, SKOV } from '../art/scenes/palette'

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
  /** Største elementtal i en verdensscene (kortets baggrund), hvis arket har scener. */
  maxScene?: number
  /** Kendte lommer (huller-lint'en, `KNOWN_POCKETS`): fejler ikke, men står her med review-henvisningen. */
  known?: string[]
}

/** Tankebobler og Zzz holder mindst så mange enheder fri af hoved, ører, manke og horn (review G1-r2, pkt. 5.2). */
export const FX_CLEAR = 8

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

  // Bobler og Zzz (statiske kort): ingen del af hovedgruppen (hoved, ører, manke, horn) inden for
  // FX_CLEAR enheder af hvert fx-elements bbox. Samples på et gitter med 2 enheders afstand.
  const fx = opts.safeZone ? [...root.querySelectorAll<SVGGeometryElement>('[data-fx]')] : []
  const headGroup = root.querySelector<SVGGElement>('[data-part="head"]')
  if (fx.length && headGroup) {
    checks++
    const rootM = root.getScreenCTM()!
    // Kun dyrets egne dele (hoved, ører, manke, horn); hatte tæller ikke med.
    const shapes = [...headGroup.querySelectorAll<SVGGeometryElement>(DRAWN)]
      .filter((el) => !inDefs(el) && !el.closest('[data-item]'))
      .map((el) => ({ el, v: visible(el), inv: el.getScreenCTM()!.inverse(), clips: clipsOf(el, root).map((c) => ({ shape: c.shape, inv: c.ref.getScreenCTM()!.inverse() })) }))
      .filter((s) => (s.v.fill || s.v.stroke) && s.v.opacity > 0.001)
    let hit: string | null = null
    for (const f of fx) {
      // Afstand til fx-formen: prikker er cirkler (centrum ± r), Z'er er deres bbox; punkter højst
      // FX_CLEAR enheder fra formen samples.
      const b = boxIn(f, root, 0)
      const circle = f.tagName === 'circle'
      const cx = (b.x0 + b.x1) / 2
      const cy = (b.y0 + b.y1) / 2
      const r = (b.x1 - b.x0) / 2
      const near = (x: number, y: number) =>
        circle
          ? Math.hypot(x - cx, y - cy) <= r + FX_CLEAR
          : Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1)) <= FX_CLEAR
      for (let x = b.x0 - FX_CLEAR; x <= b.x1 + FX_CLEAR && !hit; x += 2)
        for (let y = b.y0 - FX_CLEAR; y <= b.y1 + FX_CLEAR && !hit; y += 2) {
          if (!near(x, y)) continue
          const scr = new DOMPoint(x, y).matrixTransform(rootM)
          for (const s of shapes) {
            const p = scr.matrixTransform(s.inv)
            if (!((s.v.fill && s.el.isPointInFill(p)) || (s.v.stroke && s.el.isPointInStroke(p)))) continue
            if (s.clips.some((c) => !c.shape.isPointInFill(scr.matrixTransform(c.inv)))) continue
            hit = `(${x.toFixed(0)},${y.toFixed(0)})`
            break
          }
        }
      if (hit) break
    }
    if (hit) errors.push(`${label}: tankeboble/Zzz er tættere end ${FX_CLEAR} enheder på hoved, ører eller manke ved ${hit}`)
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
      // Genstande, der med vilje rækker ud over silhuetten (ItemDef.reach: ballon, net), holdes i den
      // sikre zone i stedet for artens hull.
      const reach = g.dataset.reach !== undefined
      const out = reach
        ? box.x0 < SAFE.x0 - 0.05 || box.x1 > SAFE.x1 + 0.05 || box.y0 < SAFE.y0 - 0.05 || box.y1 > SAFE.y1 + 0.05
        : box.x0 < hull.x0 - m || box.x1 > hull.x1 + m || box.y0 < hull.y0 - m || box.y1 > hull.y1 + m
      if (out) errors.push(`${label}: ${g.dataset.item} ${fmt(box)} går ud over ${reach ? 'den sikre zone' : `artens hull ${fmt(hull)} + ${m}`}`)
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
  // Kort "på dyret" viser altid genstanden (review G2-r1, B11): på dyret skal genstanden være tegnet, og et slot,
  // arten selv fylder (uglens vinger), viser genstanden alene med en lås – aldrig bare dyret.
  for (const card of document.querySelectorAll<HTMLElement>('.sh-card[data-card="worn"],.sh-card[data-card="locked"]')) {
    res.checks++
    const locked = card.dataset.card === 'locked'
    const shown = locked
      ? !!card.querySelector('svg[data-item-icon]') && !!card.querySelector('[data-lock]')
      : [...card.querySelectorAll<SVGGElement>('svg.rig [data-item]')].some((g) => g.querySelector(DRAWN))
    if (!shown) res.errors.push(`${card.dataset.label}: kortet viser ${locked ? 'ikke genstanden og låsen' : 'ingen genstand på dyret'}`)
  }
  // Et kort med dyret skærer aldrig gennem øjnene (rubrikken; review G2-r3 B16: håndkortene på alle arter, også i
  // siderne): øjnene og pandaens øjenpletter ligger helt inden for kortets beskæring eller helt uden for den.
  for (const card of document.querySelectorAll<HTMLElement>('.sh-card')) {
    for (const svg of card.querySelectorAll<SVGSVGElement>('svg.rig')) {
      const vb = svg.viewBox.baseVal
      const view: Box = { x0: vb.x, y0: vb.y, x1: vb.x + vb.width, y1: vb.y + vb.height }
      res.checks++
      const cut = [...svg.querySelectorAll<SVGGeometryElement>(EYE_PARTS)]
        .map((el) => ({ part: el.dataset.part, box: drawnBox(el, svg) }))
        .find(({ box }) => box && !whole(box, view, EYE_TOL))
      if (cut?.box) res.errors.push(`${card.dataset.label}: kortet ${fmt(view)} skærer gennem ${cut.part === 'eyes' ? 'øjnene' : 'øjenpletterne'} ${fmt(cut.box)}`)
    }
  }
}

/** Øjnene og det, der hører til dem (pandaens øjenpletter): et kort på dyret skærer aldrig gennem dem (review G2-r3 B16). */
export const EYE_PARTS = '[data-part="eyes"],[data-part="eye-patch"]'
/** Tolerance (enheder), før en kant regnes for at skære gennem øjnene (antialias og afrunding af viewBox). */
const EYE_TOL = 0.5
/** Boksen ligger helt inden for `view` eller helt uden for den (ikke skåret over af en kant). */
const whole = (b: Box, view: Box, tol: number) =>
  (b.x0 >= view.x0 - tol && b.x1 <= view.x1 + tol && b.y0 >= view.y0 - tol && b.y1 <= view.y1 + tol) ||
  b.x1 <= view.x0 + tol || b.x0 >= view.x1 - tol || b.y1 <= view.y0 + tol || b.y0 >= view.y1 - tol

/** En verdensscene (kortets baggrund) må højst have så mange SVG-elementer, så kortskærmen holder sig under 1.500. */
export const SCENE_BUDGET = 400

/** Verdensscener (svg[data-scene]): elementbudget, ingen forbudte elementer, og scenen dækker hele sin ramme. */
function lintScenes(res: LintResult) {
  for (const svg of document.querySelectorAll<SVGSVGElement>('svg[data-scene]')) {
    const label = svg.closest<HTMLElement>('[data-label]')?.dataset.label ?? `scene ${svg.dataset.scene}`
    const total = svg.querySelectorAll('*').length + 1
    res.checks += 2
    res.maxScene = Math.max(res.maxScene ?? 0, total)
    if (total > SCENE_BUDGET) res.errors.push(`${label}: ${total} SVG-elementer i scenen (> ${SCENE_BUDGET})`)
    const bad = svg.querySelector('filter,mask,image,text,foreignObject')
    if (bad) res.errors.push(`${label}: forbudt element <${bad.tagName}> i scenen`)
    // scenearkets ramme (data-scene-panel) skal være dækket helt af scenen: ingen papir rundt om tegningen
    const frame = svg.closest<HTMLElement>('[data-scene-panel]')
    if (frame) {
      res.checks++
      const a = frame.getBoundingClientRect()
      const b = svg.getBoundingClientRect()
      if (b.left > a.left + 0.5 || b.top > a.top + 0.5 || b.right < a.right - 0.5 || b.bottom < a.bottom - 0.5)
        res.errors.push(`${label}: scenen dækker ikke hele rammen (${b.width.toFixed(0)}·${b.height.toFixed(0)} i ${a.width.toFixed(0)}·${a.height.toFixed(0)})`)
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Tomme papirflader i scenearkene (review G2-r2 §5.1): det samlede scenark på 149 megapixel havde store flader,
// som helsidesoptagelsen aldrig tegnede – papirfarve i stedet for himmel, bakker og skov. DOM'en kan ikke se det,
// så scripts/sheets.mjs giver de optagne pixel (hvert panel for sig og oversigten) til lintScenePixels. En tegnet
// scene har ingen store, helt ensfarvede og papirlyse flader: himlen er en gradient, og bakkernes flader er
// farvede. Kun arkets egne farver (papir og cellens hvide) tæller som tomme; små hvide ting (blomster, uld) er under grænsen.

/** Cellen (CSS-px), der tjekkes for at være helt ensfarvet. */
export const BLANK_CELL = 8
/** Den største sammenhængende ensfarvede, papirfarvede flade, et scenepanel må have (andel af panelet). */
export const BLANK_MAX_SHARE = 0.015
/** Rammens hjørner er runde (12 px) og viser arkets hvide celle: kanten tjekkes ikke. */
const BLANK_INSET = 12

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
/** Et scenepanel på arket (CSS-px fra sidens øverste venstre hjørne) og skitsens flader, der ikke tæller. */
export interface ScenePanel extends Rect {
  name: string
  skip: Rect[]
}

const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
/**
 * Det, en flade viser, når scenen ikke blev tegnet dér: arkets papir (#FFF8EC), cellens hvide og himlens nederste
 * farve, der er flad under horisonten og ellers altid dækket af bakker og skov (en optagelse, hvor kun himlen kom med).
 */
const PAPER: readonly (readonly [number, number, number])[] = [[255, 248, 236], [255, 255, 255], ...[ENG.skyBottom, BAKKE.skyBottom, SKOV.skyBottom].map(rgbOf)]
/** Papirfarvet (±3 pr. kanal). Scenernes egne lyse flader (fjerne bakker i start, himlens gradient, skyer) er det ikke. */
export const paperLike = (r: number, g: number, b: number) => PAPER.some(([pr, pg, pb]) => Math.abs(r - pr) <= 3 && Math.abs(g - pg) <= 3 && Math.abs(b - pb) <= 3)

/**
 * Den største sammenhængende flade af helt ensfarvede, papirfarvede celler i `rect` (pixel) af et RGBA-billede med
 * bredden W: andel af rektanglet og fladens boks (pixel). Celler, der rører et `skip`-rektangel, tæller ikke.
 */
export function blankArea(
  px: Uint8ClampedArray,
  W: number,
  rect: Rect,
  cell: number,
  skip: readonly Rect[] = [],
  like: (r: number, g: number, b: number) => boolean = paperLike,
): { share: number; box: Rect | null } {
  const cols = Math.floor(rect.w / cell)
  const rows = Math.floor(rect.h / cell)
  if (cols < 1 || rows < 1) return { share: 0, box: null }
  const flat = new Uint8Array(cols * rows)
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const x0 = Math.round(rect.x + i * cell)
      const y0 = Math.round(rect.y + j * cell)
      const x1 = Math.round(rect.x + (i + 1) * cell)
      const y1 = Math.round(rect.y + (j + 1) * cell)
      if (skip.some((s) => x1 > s.x && x0 < s.x + s.w && y1 > s.y && y0 < s.y + s.h)) continue
      const q = (y0 * W + x0) * 4
      const [r, g, b] = [px[q], px[q + 1], px[q + 2]]
      if (!like(r, g, b)) continue
      let same = true
      for (let y = y0; y < y1 && same; y++)
        for (let x = x0; x < x1; x++) {
          const p = (y * W + x) * 4
          if (px[p] !== r || px[p + 1] !== g || px[p + 2] !== b) {
            same = false
            break
          }
        }
      if (same) flat[j * cols + i] = 1
    }
  let best = 0
  let box: Rect | null = null
  const stack: number[] = []
  for (let c0 = 0; c0 < flat.length; c0++) {
    if (flat[c0] !== 1) continue
    flat[c0] = 2
    stack.push(c0)
    let n = 0
    let [i0, j0, i1, j1] = [cols, rows, 0, 0]
    while (stack.length) {
      const c = stack.pop()!
      n++
      const i = c % cols
      const j = (c - i) / cols
      ;[i0, j0, i1, j1] = [Math.min(i0, i), Math.min(j0, j), Math.max(i1, i), Math.max(j1, j)]
      for (const d of [i > 0 ? c - 1 : -1, i < cols - 1 ? c + 1 : -1, j > 0 ? c - cols : -1, j < rows - 1 ? c + cols : -1])
        if (d >= 0 && flat[d] === 1) {
          flat[d] = 2
          stack.push(d)
        }
    }
    if (n > best) {
      best = n
      box = { x: rect.x + i0 * cell, y: rect.y + j0 * cell, w: (i1 - i0 + 1) * cell, h: (j1 - j0 + 1) * cell }
    }
  }
  return { share: best / (cols * rows), box }
}

/** Scenearkets paneler (data-scene-panel) og skitsens flader i dem, i CSS-px fra sidens øverste venstre hjørne. */
export function scenePanels(): ScenePanel[] {
  const page = (el: Element): Rect => {
    const r = el.getBoundingClientRect()
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
  }
  return [...document.querySelectorAll<HTMLElement>('[data-scene-panel]')].map((el) => ({
    name: el.dataset.scenePanel ?? '',
    ...page(el),
    skip: [...el.querySelectorAll('[data-scene-sketch] > *')].map(page),
  }))
}

/**
 * Tomme papirflader i en optagelse (PNG i base64) af scenearket: `panels` i CSS-px, `scale` pixel pr. CSS-px og
 * `origin` optagelsens øverste venstre hjørne (CSS-px). Fejler, hvis et panel har en sammenhængende, helt ensfarvet
 * og papirfarvet flade på over BLANK_MAX_SHARE af panelet.
 */
export async function lintScenePixels(png: string, panels: readonly ScenePanel[], scale: number, origin: { x: number; y: number }): Promise<{ errors: string[]; checks: number; maxShare: number }> {
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const px = g.getImageData(0, 0, bmp.width, bmp.height).data
  const toPx = (r: Rect, inset = 0): Rect => ({ x: (r.x - origin.x + inset) * scale, y: (r.y - origin.y + inset) * scale, w: (r.w - 2 * inset) * scale, h: (r.h - 2 * inset) * scale })
  const errors: string[] = []
  let maxShare = 0
  for (const p of panels) {
    const rect = toPx(p, BLANK_INSET)
    rect.x = Math.max(0, rect.x)
    rect.y = Math.max(0, rect.y)
    rect.w = Math.min(rect.w, bmp.width - rect.x)
    rect.h = Math.min(rect.h, bmp.height - rect.y)
    const { share, box } = blankArea(px, bmp.width, rect, BLANK_CELL * scale, p.skip.map((s) => toPx(s)))
    maxShare = Math.max(maxShare, share)
    if (share > BLANK_MAX_SHARE && box) {
      const at = (v: number, o: number) => (v / scale + origin[o === 0 ? 'x' : 'y'] - (o === 0 ? p.x : p.y)).toFixed(0)
      errors.push(`${p.name}: tom papirflade på ${(share * 100).toFixed(1)} % af panelet ved (${at(box.x, 0)}–${at(box.x + box.w, 0)}, ${at(box.y, 1)}–${at(box.y + box.h, 1)})`)
    }
  }
  return { errors, checks: panels.length, maxShare }
}

// ---------------------------------------------------------------------------------------------
// Tomme felter i pasformsmatrixen (review G2-r3 §6.1): det samlede ark på 165 megapixel havde 420 af 2124 celler, som
// helsidesoptagelsen aldrig tegnede – papirfarve i stedet for cellens hvide felt med dyret. Matrixen er nu én side pr.
// sæt, og scripts/sheets.mjs giver optagelsen til lintBlankCells, der tjekker hvert felt for sig: et tegnet felt er
// hvidt med dyret på, så papirfarve i feltet betyder, at (en del af) det ikke blev tegnet, og et felt uden tegning
// (kun hvidt og papir) er tomt.

/** Arkets papir (#FFF8EC, ±3 pr. kanal): et tegnet felt er hvidt, så papir i feltet er en flise, der ikke blev tegnet. */
export const paperOnly = (r: number, g: number, b: number) => Math.abs(r - 255) <= 3 && Math.abs(g - 248) <= 3 && Math.abs(b - 236) <= 3
/** Den største sammenhængende papirflade, et felt må have (andel af feltet inden for kanten); en utegnet flise dækker langt mere, og pelsens lyseste flader (hamsterens creme) højst ca. 4 %. */
export const CELL_PAPER_MAX = 0.1
/** Mindste andel af feltet, der er tegning (hverken hvidt eller papir): ellers er feltet tomt. */
export const CELL_INK_MIN = 0.05
/** Feltets runde hjørner (8 px) og kant tjekkes ikke. */
const CELL_INSET = 8

/** Pasformsmatrixens felter (CSS-px fra sidens øverste venstre hjørne) med deres label. */
export function matrixCells(): (Rect & { name: string })[] {
  return [...document.querySelectorAll<HTMLElement>('.sh-matrix')].map((el) => {
    const r = el.getBoundingClientRect()
    return { name: el.dataset.label ?? '', x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }
  })
}

/**
 * Tomme felter i en optagelse (PNG i base64) af pasformsmatrixen: `cells` i CSS-px, `scale` pixel pr. CSS-px og
 * `origin` optagelsens øverste venstre hjørne. Fejler, hvis et felt har en sammenhængende papirflade over
 * CELL_PAPER_MAX af feltet (en flise, der ikke blev tegnet), eller hvis under CELL_INK_MIN af feltet er tegning.
 */
export async function lintBlankCells(png: string, cells: readonly (Rect & { name: string })[], scale: number, origin: { x: number; y: number }): Promise<{ errors: string[]; checks: number; maxPaper: number; minInk: number }> {
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob())
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.drawImage(bmp, 0, 0)
  const px = g.getImageData(0, 0, bmp.width, bmp.height).data
  const errors: string[] = []
  let maxPaper = 0
  let minInk = 1
  for (const c of cells) {
    const x0 = Math.max(0, Math.round((c.x - origin.x + CELL_INSET) * scale))
    const y0 = Math.max(0, Math.round((c.y - origin.y + CELL_INSET) * scale))
    const x1 = Math.min(bmp.width, Math.round((c.x - origin.x + c.w - CELL_INSET) * scale))
    const y1 = Math.min(bmp.height, Math.round((c.y - origin.y + c.h - CELL_INSET) * scale))
    if (x1 <= x0 || y1 <= y0) {
      errors.push(`${c.name}: feltet ligger uden for optagelsen`)
      continue
    }
    const { share } = blankArea(px, bmp.width, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, BLANK_CELL * scale, [], paperOnly)
    let ink = 0
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const p = (y * bmp.width + x) * 4
        const white = px[p] >= 252 && px[p + 1] >= 252 && px[p + 2] >= 252
        if (!white && !paperOnly(px[p], px[p + 1], px[p + 2])) ink++
      }
    const inkShare = ink / ((x1 - x0) * (y1 - y0))
    maxPaper = Math.max(maxPaper, share)
    minInk = Math.min(minInk, inkShare)
    if (share > CELL_PAPER_MAX) errors.push(`${c.name}: feltet er ikke tegnet helt (papir på ${(share * 100).toFixed(0)} % af feltet)`)
    else if (inkShare < CELL_INK_MIN) errors.push(`${c.name}: feltet er tomt (tegning på ${(inkShare * 100).toFixed(1)} % af feltet)`)
  }
  return { errors, checks: cells.length, maxPaper, minInk }
}

declare global {
  interface Window {
    __scenePanels?: typeof scenePanels
    __lintScenePixels?: typeof lintScenePixels
    __matrixCells?: typeof matrixCells
    __lintBlankCells?: typeof lintBlankCells
  }
}
// scripts/sheets.mjs kalder dem direkte i scenearkenes og pasformsmatrixens sider (efter optagelsen).
if (typeof window !== 'undefined')
  Object.assign(window, { __scenePanels: scenePanels, __lintScenePixels: lintScenePixels, __matrixCells: matrixCells, __lintBlankCells: lintBlankCells })

// ---------------------------------------------------------------------------------------------
// Huller og sømme (review G1-r3, forbedring 1): figuren rasteriseres alene (uden glimt, aura og skygge), og
// baggrund, der ikke hænger sammen med billedets kant, er lukket inden for yderkonturen. Review G2-r2 (§3.1,
// §6 Proces pkt. 2): baggrunden er figurens alfakanal (ikke en farvetærskel på magenta, der afhang af
// konturens farve), og lommerne søges både fint og i arkets egen opløsning:
// - fint (HOLE_FINE px pr. enhed): sømme og sprækker. En lomme, der kun hænger sammen med baggrunden gennem
//   en sprække smallere end HOLE_GAP, er også lukket (review G1-r4, R1); smalle lukkede områder (tykkelse
//   under HOLE_THICK enheder) er sømme eller sprækker.
// - i arket (HOLE_SHEET px pr. enhed, holes-arkets 64 px-felter i 2x): et lukket område på blot 1 pixel
//   fejler (review G2-r2: "på mindst 1 px"). Arkets pixelgitter kan ligge hvor som helst over figuren, så
//   alle HOLE_SUB² forskydninger af gitteret prøves (arealmiddel af den fine rasterisering).
// Glimtene ✦ (data-part="fx") fjernes før rasteriseringen, så deres midte aldrig tæller. Kendte lommer hos
// arter, som andre agenter ejer, står i KNOWN_POCKETS med henvisning til reviewet og fejler ikke.

/** Arkets opløsning (px pr. enhed): holes-arkets felter er 64 CSS-px brede for 200 enheder, taget i 2x. */
export const HOLE_SHEET = 0.64
/** Fine delpixel pr. arkpixel: figuren rasteriseres i HOLE_SHEET · HOLE_SUB px pr. enhed. */
export const HOLE_SUB = 5
/** Pixel pr. enhed ved den fine rasterisering. */
const HOLE_FINE = HOLE_SHEET * HOLE_SUB
/** Lommer i arkets opløsning, hvis tyngdepunkter ligger så tæt (enheder) i forskellige gitre, er den samme lomme. */
const HOLE_MERGE = 6
/** Baggrund: figurens alfa under denne værdi (af 255), altså mindst 75 % baggrund i pixlen. */
export const HOLE_ALPHA = 64
/** Lukkede områder, der er tyndere end dette (enheder), tæller som søm/sprække. */
export const HOLE_THICK = 4
/** Mindste areal (enheder²), der tæller i den fine søgning (antialiasing i samlinger giver enkelte pixel). */
export const HOLE_MIN_AREA = 1.5
/** Streng tilstand: én lukket fin pixel på mindst 0,25 enh² er nok (review G1-r3, K1-tjekket). */
export const HOLE_MIN_AREA_STRICT = 0.25
/** Sprækker smallere end dette (enheder) lukkes, før baggrunden fyldes fra kanten (review G1-r4, R1). */
export const HOLE_GAP = 1

/**
 * Kendte lommer og sprækker, som artens egen agent retter: de fejler ikke, men står i lint-rapporten
 * (`known`). Mønsteret matcher cellens `data-holes` ("art race stadie farve humør").
 */
export const KNOWN_POCKETS: readonly { match: RegExp; ref: string }[] = [
  // Tom (review G2-r3 §3.1 og §6.2: en lint, der kan "kende" en fejl væk, fejler ikke længere på den). De fem lommer,
  // der stod her (lam · 3 · jubel, vædder · 2 · tænker, hamster · 3 · hvile (to) og panda · 3 · sover), er fyldt med
  // pels bag delene i stillbilleder (ARTFIX-E), så lint'en fejler igen på enhver lukket lomme.
]

/** Kendt lomme for en celle (review-henvisningen), eller null. */
export function knownPocket(cell: string): string | null {
  return KNOWN_POCKETS.find((k) => k.match.test(cell))?.ref ?? null
}

interface Hole {
  area: number
  thick: number
  x: number
  y: number
  /** Kun lukket, når sprækker smallere end HOLE_GAP regnes som lukkede (hænger ellers sammen med baggrunden). */
  nearly: boolean
  /** Fundet i arkets opløsning: `area` er da arkpixel, og `phases` er antallet af gitterforskydninger med lommen. */
  sheet?: { px: number; phases: number }
}

/** Figurens alfakanal (uden glimt, aura og skygge) i `scale` px pr. enhed. */
async function figureAlpha(svg: SVGSVGElement, scale: number): Promise<{ a: Uint8Array; W: number; H: number }> {
  const vb = svg.viewBox.baseVal
  const W = Math.round(vb.width * scale)
  const H = Math.round(vb.height * scale)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('width', String(W))
  clone.setAttribute('height', String(H))
  // Kun figuren: glimt, aura, skygge og andre fx svæver frit og er ikke en del af yderkonturen.
  for (const el of clone.querySelectorAll('[data-part="fx"],[data-part="aura"],[data-part="shadow"]')) el.remove()
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d', { willReadFrequently: true })!
  g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const a = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) a[p] = d[p * 4 + 3]
  return { a, W, H }
}

async function holesIn(svg: SVGSVGElement): Promise<Hole[]> {
  const vb = svg.viewBox.baseVal
  const { a, W, H } = await figureAlpha(svg, HOLE_FINE)
  return [...fineHoles(a, W, H, vb), ...sheetHoles(a, W, H, vb)]
}

/** Sømme, sprækker og lommer i den fine rasterisering (med sprække-lukning, se HOLE_GAP). */
function fineHoles(a: Uint8Array, W: number, H: number, vb: DOMRect): Hole[] {
  const N = W * H
  // 1 = baggrund, 2 = baggrund nået fra kanten.
  const m = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (a[p] < HOLE_ALPHA) m[p] = 1
  // Lukkede områder uden sprække-lukning (ægte lukkede pixels) huskes, før sprækkerne lukkes nedenfor.
  const plain = flood(m, W, H, null, 0)
  // Afstanden fra hver baggrundspixel til figuren: pixels nærmere end HOLE_GAP/2 er væg, så en sprække
  // smallere end HOLE_GAP lukker; derefter vokser den nåede baggrund tilbage op til figuren.
  const gap = (HOLE_GAP * HOLE_FINE) / 2
  const toFig = chamfer(m, W, H, (v) => v === 1)
  const open = flood(m, W, H, toFig, gap)
  for (let p = 0; p < N; p++) m[p] = m[p] === 1 ? (open[p] ? 2 : 1) : 0
  grow(m, W, H, Math.ceil(gap) + 1)
  // Afstand (chamfer) fra hver lukket pixel til nærmeste ikke-lukkede pixel: tykkelsen er 2 · maks.
  const dist = chamfer(m, W, H, (v) => v === 1)
  // Sammenhængende lukkede områder.
  const out: Hole[] = []
  const stack: number[] = []
  for (let p0 = 0; p0 < N; p0++) {
    if (m[p0] !== 1) continue
    let area = 0
    let maxD = 0
    let sx = 0
    let sy = 0
    let closed = false
    m[p0] = 3
    stack.push(p0)
    while (stack.length) {
      const p = stack.pop()!
      area++
      maxD = Math.max(maxD, dist[p])
      if (!plain[p]) closed = true
      const x = p % W
      sx += x
      sy += (p - x) / W
      const visit = (q: number) => {
        if (m[q] === 1) {
          m[q] = 3
          stack.push(q)
        }
      }
      if (x > 0) visit(p - 1)
      if (x < W - 1) visit(p + 1)
      if (p >= W) visit(p - W)
      if (p < N - W) visit(p + W)
    }
    out.push({ area: area / HOLE_FINE ** 2, thick: (2 * maxD) / HOLE_FINE, x: vb.x + sx / area / HOLE_FINE, y: vb.y + sy / area / HOLE_FINE, nearly: !closed })
  }
  return out
}

/**
 * Lommer i arkets opløsning: den fine alfa middelværdi-nedskaleres HOLE_SUB gange for hver af de HOLE_SUB²
 * forskydninger af arkets pixelgitter, og lukket baggrund (alfa under HOLE_ALPHA, ikke forbundet med kanten)
 * samles pr. sted (afrundet til 4 enheder) med største pixeltal og antal forskydninger.
 */
function sheetHoles(a: Uint8Array, W: number, H: number, vb: DOMRect): Hole[] {
  const S = HOLE_SUB
  // Summeret arealtabel, så hver arkpixel er fire opslag.
  const I = new Float64Array((W + 1) * (H + 1))
  for (let y = 0; y < H; y++) {
    let row = 0
    for (let x = 0; x < W; x++) {
      row += a[y * W + x]
      I[(y + 1) * (W + 1) + x + 1] = I[y * (W + 1) + x + 1] + row
    }
  }
  // Lommer samles på tværs af forskydningerne efter sted (tyngdepunkter inden for HOLE_MERGE enheder).
  const found: (Hole & { at: Set<number> })[] = []
  for (let oy = 0; oy < S; oy++)
    for (let ox = 0; ox < S; ox++) {
      // En ring af tom baggrund om gitteret, så kanten altid er baggrund.
      const w = Math.floor((W - ox) / S) + 2
      const h = Math.floor((H - oy) / S) + 2
      const m = new Uint8Array(w * h)
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const x0 = ox + (x - 1) * S
          const y0 = oy + (y - 1) * S
          const mean = (I[(y0 + S) * (W + 1) + x0 + S] - I[y0 * (W + 1) + x0 + S] - I[(y0 + S) * (W + 1) + x0] + I[y0 * (W + 1) + x0]) / (S * S)
          m[y * w + x] = mean < HOLE_ALPHA ? 1 : 0
        }
      for (let x = 0; x < w; x++) m[x] = m[(h - 1) * w + x] = 1
      for (let y = 0; y < h; y++) m[y * w] = m[y * w + w - 1] = 1
      const reached = flood(m, w, h, null, 0)
      const stack: number[] = []
      for (let p0 = 0; p0 < w * h; p0++) {
        if (m[p0] !== 1 || reached[p0]) continue
        let px = 0
        let sx = 0
        let sy = 0
        m[p0] = 3
        stack.push(p0)
        while (stack.length) {
          const p = stack.pop()!
          px++
          const x = p % w
          sx += x
          sy += (p - x) / w
          for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w])
            if (q >= 0 && q < w * h && m[q] === 1 && !reached[q]) {
              m[q] = 3
              stack.push(q)
            }
        }
        const ux = vb.x + (ox + (sx / px - 1) * S + S / 2) / HOLE_FINE
        const uy = vb.y + (oy + (sy / px - 1) * S + S / 2) / HOLE_FINE
        const phase = oy * S + ox
        const near = found.find((f) => Math.hypot(f.x - ux, f.y - uy) <= HOLE_MERGE)
        if (!near) found.push({ area: px / HOLE_SHEET ** 2, thick: 0, x: ux, y: uy, nearly: false, sheet: { px, phases: 1 }, at: new Set([phase]) })
        else {
          near.at.add(phase)
          near.sheet = { px: Math.max(near.sheet!.px, px), phases: near.at.size }
          if (px >= near.sheet.px) Object.assign(near, { area: px / HOLE_SHEET ** 2, x: ux, y: uy })
        }
      }
    }
  return found.map(({ at: _, ...h }) => h)
}

/**
 * Baggrund nået fra billedets kant (4-naboskab) gennem pixels med m = 1; med `wall` kun gennem pixels, hvis
 * afstand til figuren er over `min` (kantens pixels er altid frø). Returnerer 1 for nåede pixels.
 */
function flood(m: Uint8Array, W: number, H: number, wall: Float32Array | null, min: number): Uint8Array {
  const N = W * H
  const r = new Uint8Array(N)
  const stack: number[] = []
  const pass = (p: number) => m[p] === 1 && !r[p] && (!wall || wall[p] > min)
  const seed = (p: number) => {
    if (m[p] === 1 && !r[p]) {
      r[p] = 1
      stack.push(p)
    }
  }
  for (let x = 0; x < W; x++) {
    seed(x)
    seed((H - 1) * W + x)
  }
  for (let y = 0; y < H; y++) {
    seed(y * W)
    seed(y * W + W - 1)
  }
  while (stack.length) {
    const p = stack.pop()!
    const x = p % W
    const visit = (q: number) => {
      if (pass(q)) {
        r[q] = 1
        stack.push(q)
      }
    }
    if (x > 0) visit(p - 1)
    if (x < W - 1) visit(p + 1)
    if (p >= W) visit(p - W)
    if (p < N - W) visit(p + W)
  }
  return r
}

/** Chamfer-afstand (pixels) fra hver pixel, der opfylder `inside`, til nærmeste pixel, der ikke gør. */
function chamfer(m: Uint8Array, W: number, H: number, inside: (v: number) => boolean): Float32Array {
  const N = W * H
  const dist = new Float32Array(N)
  for (let p = 0; p < N; p++) dist[p] = inside(m[p]) ? 1e9 : 0
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (!dist[p]) continue
      let v = dist[p]
      if (x > 0) v = Math.min(v, dist[p - 1] + 1)
      if (y > 0) v = Math.min(v, dist[p - W] + 1)
      if (x > 0 && y > 0) v = Math.min(v, dist[p - W - 1] + 1.414)
      if (x < W - 1 && y > 0) v = Math.min(v, dist[p - W + 1] + 1.414)
      dist[p] = v
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const p = y * W + x
      if (!dist[p]) continue
      let v = dist[p]
      if (x < W - 1) v = Math.min(v, dist[p + 1] + 1)
      if (y < H - 1) v = Math.min(v, dist[p + W] + 1)
      if (x < W - 1 && y < H - 1) v = Math.min(v, dist[p + W + 1] + 1.414)
      if (x > 0 && y < H - 1) v = Math.min(v, dist[p + W - 1] + 1.414)
      dist[p] = v
    }
  return dist
}

/** Den nåede baggrund (m = 2) vokser `steps` pixels (8-naboskab) ind i den øvrige baggrund (m = 1). */
function grow(m: Uint8Array, W: number, H: number, steps: number): void {
  let front: number[] = []
  for (let p = 0; p < W * H; p++) if (m[p] === 2) front.push(p)
  for (let s = 0; s < steps; s++) {
    const next: number[] = []
    for (const p of front) {
      const x = p % W
      for (const q of [p - 1, p + 1, p - W, p + W, p - W - 1, p - W + 1, p + W - 1, p + W + 1]) {
        if (q < 0 || q >= W * H) continue
        const qx = q % W
        if (Math.abs(qx - x) > 1) continue
        if (m[q] === 1) {
          m[q] = 2
          next.push(q)
        }
      }
    }
    front = next
  }
}

/** I arkets opløsning fejler en lomme, der er lukket i mindst så mange af de HOLE_SUB² gitterforskydninger. */
export const HOLE_SHEET_PHASES = 22

/**
 * Lint for `holes`-arket: ingen sømme, sprækker eller lukkede områder med baggrund inden for figurernes
 * yderkontur. En celle med data-holes-mode="strict" må slet ikke have lukket baggrund i den fine søgning
 * (kaninen, K1-beviset); de andre arter ("thin") fejler på sprækker og lukkede områder fra HOLE_MIN_AREA (review
 * G1-r4, R1). Næsten lukkede lommer (kun lukket af en sprække under HOLE_GAP) tæller fra HOLE_MIN_AREA, så
 * antialiasing i en konkav kant ikke fejler. I arkets opløsning fejler alle arter fra 1 lukket pixel (review
 * G2-r2 §3.1). Kendte lommer (KNOWN_POCKETS) fejler ikke, men noteres i `known`.
 */
async function lintHoles(res: LintResult): Promise<void> {
  for (const cell of document.querySelectorAll<HTMLElement>('[data-holes]')) {
    const svg = cell.querySelector<SVGSVGElement>('svg.rig')
    if (!svg) continue
    res.checks++
    const strict = cell.dataset.holesMode === 'strict'
    const bad = (await holesIn(svg)).filter((h) =>
      h.sheet ? h.sheet.phases >= HOLE_SHEET_PHASES : h.area >= (strict && !h.nearly ? HOLE_MIN_AREA_STRICT : HOLE_MIN_AREA),
    )
    if (!bad.length) continue
    const label = cell.dataset.holes ?? ''
    const known = knownPocket(label)
    for (const h of bad) {
      const at = `ved (${h.x.toFixed(0)},${h.y.toFixed(0)})`
      const what = h.sheet
        ? `${label}: lukket lomme i arkets opløsning (${h.sheet.px} px, ${h.sheet.phases}/${HOLE_SUB ** 2} gitre) ${at}`
        : `${label}: ${h.nearly ? 'næsten ' : ''}lukket ${h.thick < HOLE_THICK ? 'søm/sprække' : 'område'} med baggrund (${h.area.toFixed(1)} enh², ${h.thick.toFixed(1)} enh tyk) ${at}`
      if (known) (res.known ??= []).push(`${what} · kendt: ${known}`)
      else res.errors.push(what)
    }
  }
}

/** Kør alle lints på siden. Hver rig kan slå tjek til med data-lint="safe fit". */
export async function runLints(): Promise<LintResult> {
  const res = runSyncLints()
  await lintHoles(res)
  return res
}

function runSyncLints(): LintResult {
  const rigs = [...document.querySelectorAll<SVGSVGElement>('svg.rig')]
  const res: LintResult = { rigs: rigs.length, items: 0, checks: 0, errors: [], maxAnimal: 0, maxItem: 0 }
  lintCards(res)
  lintScenes(res)
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
