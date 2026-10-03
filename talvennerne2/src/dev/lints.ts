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
}

/** En verdensscene (kortets baggrund) må højst have så mange SVG-elementer, så kortskærmen holder sig under 1.500. */
export const SCENE_BUDGET = 400

/** Verdensscener (svg[data-scene]): elementbudget og ingen forbudte elementer. */
function lintScenes(res: LintResult) {
  for (const svg of document.querySelectorAll<SVGSVGElement>('svg[data-scene]')) {
    const label = svg.closest<HTMLElement>('[data-label]')?.dataset.label ?? `scene ${svg.dataset.scene}`
    const total = svg.querySelectorAll('*').length + 1
    res.checks += 2
    res.maxScene = Math.max(res.maxScene ?? 0, total)
    if (total > SCENE_BUDGET) res.errors.push(`${label}: ${total} SVG-elementer i scenen (> ${SCENE_BUDGET})`)
    const bad = svg.querySelector('filter,mask,image,text,foreignObject')
    if (bad) res.errors.push(`${label}: forbudt element <${bad.tagName}> i scenen`)
  }
}

// ---------------------------------------------------------------------------------------------
// Huller og sømme (review G1-r3, forbedring 1): figuren rasteriseres på magenta; baggrund, der ikke
// hænger sammen med billedets kant, er lukket inden for yderkonturen. Smalle lukkede områder
// (tykkelse under HOLE_THICK enheder) er sømme eller sprækker. Review G1-r4 (R1): en lomme, der kun hænger
// sammen med baggrunden gennem en sprække smallere end HOLE_GAP, er også lukket (den ses lukket ved
// arkenes størrelser), og lukkede områder fejler for alle arter – ikke kun sprækkerne. Kendte lommer hos
// arter, som andre agenter ejer, står i KNOWN_POCKETS med henvisning til reviewet og fejler ikke.

/** Pixel pr. enhed ved rasteriseringen. */
const HOLE_SCALE = 2
/** Lukkede områder, der er tyndere end dette (enheder), tæller som søm/sprække. */
export const HOLE_THICK = 4
/** Mindste areal (enheder²), der tæller (antialiasing i samlinger giver enkelte pixel). */
export const HOLE_MIN_AREA = 1.5
/** Streng tilstand: én lukket magenta-pixel er nok (review G1-r3, K1-tjekket). */
export const HOLE_MIN_AREA_STRICT = 1 / HOLE_SCALE ** 2
/** Sprækker smallere end dette (enheder) lukkes, før baggrunden fyldes fra kanten (review G1-r4, R1). */
export const HOLE_GAP = 1

/**
 * Kendte lommer og sprækker (review G1-r4), som artens egen agent retter: de fejler ikke, men står i
 * lint-rapporten (`known`). Mønsteret matcher cellens `data-holes` ("art race stadie farve humør").
 */
// Tom siden ARTFIX-B2 og ARTFIX-B3 (3/10): alle tolv arters lommer er fyldt (i stillbillederne,
// KEY_WEBS) eller åbnet. En ny kendt lomme står her med sin review-henvisning, indtil artens agent retter den.
export const KNOWN_POCKETS: readonly { match: RegExp; ref: string }[] = []

/** Kendt lomme for en celle (review-henvisningen), eller null. */
export function knownPocket(cell: string): string | null {
  return KNOWN_POCKETS.find((k) => k.match.test(cell))?.ref ?? null
}

const isMagenta = (d: Uint8ClampedArray, i: number) => d[i] > 200 && d[i + 1] < 90 && d[i + 2] > 200

interface Hole {
  area: number
  thick: number
  x: number
  y: number
  /** Kun lukket, når sprækker smallere end HOLE_GAP regnes som lukkede (hænger ellers sammen med baggrunden). */
  nearly: boolean
}

async function holesIn(svg: SVGSVGElement): Promise<Hole[]> {
  const vb = svg.viewBox.baseVal
  const W = Math.round(vb.width * HOLE_SCALE)
  const H = Math.round(vb.height * HOLE_SCALE)
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
  g.fillStyle = '#FF00FF'
  g.fillRect(0, 0, W, H)
  g.drawImage(img, 0, 0, W, H)
  const d = g.getImageData(0, 0, W, H).data
  const N = W * H
  // 1 = magenta (baggrund), 2 = baggrund nået fra kanten.
  const m = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (isMagenta(d, p * 4)) m[p] = 1
  // Lukkede områder uden sprække-lukning (ægte lukkede pixels) huskes, før sprækkerne lukkes nedenfor.
  const plain = flood(m, W, H, null, 0)
  // Afstanden fra hver baggrundspixel til figuren: pixels nærmere end HOLE_GAP/2 er væg, så en sprække
  // smallere end HOLE_GAP lukker; derefter vokser den nåede baggrund tilbage op til figuren.
  const gap = (HOLE_GAP * HOLE_SCALE) / 2
  const toFig = chamfer(m, W, H, (v) => v === 1)
  const open = flood(m, W, H, toFig, gap)
  for (let p = 0; p < N; p++) m[p] = m[p] === 1 ? (open[p] ? 2 : 1) : 0
  grow(m, W, H, Math.ceil(gap) + 1)
  // Afstand (chamfer) fra hver lukket pixel til nærmeste ikke-lukkede pixel: tykkelsen er 2 · maks.
  const dist = new Float32Array(N)
  for (let p = 0; p < N; p++) dist[p] = m[p] === 1 ? 1e9 : 0
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
    out.push({ area: area / HOLE_SCALE ** 2, thick: (2 * maxD) / HOLE_SCALE, x: vb.x + sx / area / HOLE_SCALE, y: vb.y + sy / area / HOLE_SCALE, nearly: !closed })
  }
  return out
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

/**
 * Lint for `holes`-arket: ingen sømme, sprækker eller lukkede områder med baggrund inden for figurernes
 * yderkontur. En celle med data-holes-mode="strict" må slet ikke have lukket baggrund (kaninen, K1-beviset);
 * de andre arter ("thin") fejler på sprækker og på lukkede områder fra HOLE_MIN_AREA (review G1-r4, R1).
 * Næsten lukkede lommer (kun lukket af en sprække under HOLE_GAP) tæller fra HOLE_MIN_AREA, så antialiasing
 * i en konkav kant ikke fejler. Kendte lommer (KNOWN_POCKETS) fejler ikke, men noteres i `known`.
 */
async function lintHoles(res: LintResult): Promise<void> {
  for (const cell of document.querySelectorAll<HTMLElement>('[data-holes]')) {
    const svg = cell.querySelector<SVGSVGElement>('svg.rig')
    if (!svg) continue
    res.checks++
    const strict = cell.dataset.holesMode === 'strict'
    const bad = (await holesIn(svg)).filter((h) => h.area >= (strict && !h.nearly ? HOLE_MIN_AREA_STRICT : HOLE_MIN_AREA))
    if (!bad.length) continue
    const label = cell.dataset.holes ?? ''
    const known = knownPocket(label)
    for (const h of bad) {
      const what = `${label}: ${h.nearly ? 'næsten ' : ''}lukket ${h.thick < HOLE_THICK ? 'søm/sprække' : 'område'} med baggrund (${h.area.toFixed(1)} enh², ${h.thick.toFixed(1)} enh tyk) ved (${h.x.toFixed(0)},${h.y.toFixed(0)})`
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
