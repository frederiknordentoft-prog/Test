// Independent oracles for the shapes skills of 1.–2. klasse (sidesCorners, shapes3D, sortShapes,
// symmetry, composeShapes) and the measuring the fractions oracle shares (halves), ORK2c. Written by
// another agent than the generators (SPEC A5, §15.1). A plane figure is what the materials draw: the
// corners are read off Shape2D's own corner marks (shapes.oracle.ts), a dividing line off its own
// dashed line, and from those the oracle measures what a teacher checks — how many corners, four equal
// sides, four right angles, a line of symmetry (the figure folds onto itself), two parts of equal area.
// Solids, everyday things and their properties, and the pattern blocks' areas are the oracle's own
// tables. The spoken question names what is asked. SPEC §2.3's hierarchy (kvadrat ⊂ rektangel ⊂ firkant,
// terning ⊂ kasse) follows from the definitions. The registry skips *.oracle.ts files.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Shape2D } from '../../../art/materials/Shapes'
import type { ShapeId, SolidId } from '../../types'
import { drawn } from './shapes.oracle'

type V = readonly [number, number]

const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]]
const len = (v: V): number => Math.hypot(v[0], v[1])
const dist = (p: V, q: V): number => len(sub(p, q))

// ─── Measuring a drawn plane figure ────────────────────────────────────────

export interface Figure {
  /** Corner points in drawing order (none for a circle; the two ends of the straight side for a semicircle). */
  corners: V[]
  round: boolean
  /** A whole circle's centre and radius, as drawn. */
  circle: { c: V; r: number } | null
  semicircle: boolean
}

const figures = new Map<string, Figure>()

/** The drawn figure, measured: corner marks, and a circle's centre and radius from its outline. */
export function figure(shape: ShapeId, variant: number): Figure {
  const key = `${shape}:${variant}`
  const known = figures.get(key)
  if (known) return known
  const d = drawn(shape, variant)
  let circle: Figure['circle'] = null
  if (d.round) {
    const svg = renderToStaticMarkup(createElement(Shape2D, { shape, variant }))
    const m = /M(-?[\d.]+) (-?[\d.]+)a([\d.]+) \3 0 1 0 ([\d.]+) 0a\3 \3 0 1 0 -\4 0z/.exec(svg)
    if (m) circle = { c: [Number(m[1]) + Number(m[3]), Number(m[2])], r: Number(m[3]) }
  }
  const f: Figure = { corners: [...d.corners], round: d.round, circle, semicircle: !d.round && d.corners.length === 2 }
  figures.set(key, f)
  return f
}

/** The x of the dashed dividing line Shape2D draws for a cut (vertical, through the whole figure). */
export function cutX(shape: ShapeId, variant: number, cut: 'equal' | 'unequal'): number | null {
  const svg = renderToStaticMarkup(createElement(Shape2D, { shape, variant, cut }))
  const m = /M(-?[\d.]+) -2V102/.exec(svg)
  return m ? Number(m[1]) : null
}

const sidesOf = (c: readonly V[]): V[] => c.map((p, i) => sub(c[(i + 1) % c.length], p))

/** Every corner within 1° of a right angle. */
export function rightAnglesAll(c: readonly V[]): boolean {
  const s = sidesOf(c)
  return s.every((v, i) => {
    const w = s[(i + 1) % s.length]
    return Math.abs(v[0] * w[0] + v[1] * w[1]) / (len(v) * len(w)) < Math.sin(Math.PI / 180)
  })
}

/** All sides equally long, within 1 %. */
export function sidesEqual(c: readonly V[]): boolean {
  const l = sidesOf(c).map(len)
  return Math.max(...l) - Math.min(...l) < 0.01 * Math.max(...l)
}

/** Corners as the child counts them: a semicircle's two, a polygon's, none on a circle. */
export const cornerCount = (f: Figure): number => f.corners.length

const near = (a: number, b: number, tol = 0.05) => Math.abs(a - b) <= tol

/** Does the vertical line x = X fold the drawn figure onto itself? */
export function mirroredAbout(f: Figure, X: number): boolean {
  if (f.round) return f.circle !== null && near(f.circle.c[0], X)
  const flip = (p: V): V => [2 * X - p[0], p[1]]
  if (f.semicircle) {
    // the arc follows its two ends: it is mirrored when the ends swap (a straight side across the line)
    const [a, b] = f.corners
    const fa = flip(a)
    return near(fa[0], b[0]) && near(fa[1], b[1]) && !near(a[0], b[0])
  }
  return f.corners.every((p) => f.corners.some((q) => near(flip(p)[0], q[0]) && near(flip(p)[1], q[1])))
}

/**
 * Does the figure have a line of symmetry at all? A circle and a semicircle always do. A polygon does
 * when some reversal of its corners keeps every distance (the fold maps corners to corners).
 */
export function hasSymmetryLine(f: Figure): boolean {
  if (f.round || f.semicircle) return true
  const c = f.corners
  const n = c.length
  for (let k = 0; k < n; k++) {
    const perm = (i: number) => (((k - i) % n) + n) % n
    let ok = true
    for (let i = 0; ok && i < n; i++) {
      for (let j = i + 1; ok && j < n; j++) {
        const d1 = dist(c[i], c[j])
        const d2 = dist(c[perm(i)], c[perm(j)])
        if (Math.abs(d1 - d2) > 0.005 * Math.max(d1, d2) + 0.02) ok = false
      }
    }
    if (ok) return true
  }
  return false
}

// ─── Areas: halves ──────────────────────────────────────────────────────────

const shoelace = (c: readonly V[]): number => Math.abs(c.reduce((s, p, i) => s + p[0] * c[(i + 1) % c.length][1] - c[(i + 1) % c.length][0] * p[1], 0)) / 2

/** The part of a polygon left of x = X (Sutherland–Hodgman against one half-plane). */
function clipLeft(c: readonly V[], X: number): V[] {
  const out: V[] = []
  for (let i = 0; i < c.length; i++) {
    const p = c[i]
    const q = c[(i + 1) % c.length]
    const pin = p[0] <= X
    const qin = q[0] <= X
    if (pin) out.push(p)
    if (pin !== qin) {
      const t = (X - p[0]) / (q[0] - p[0])
      out.push([X, p[1] + t * (q[1] - p[1])])
    }
  }
  return out
}

/** Areas of the two parts a vertical line x = X cuts the drawn figure into (left, right). */
export function partsAt(f: Figure, X: number): [number, number] {
  if (f.round && f.circle) {
    const { c, r } = f.circle
    const whole = Math.PI * r * r
    const dx = Math.max(-r, Math.min(r, X - c[0]))
    // the circular segment beyond the chord at distance |dx| from the centre
    const h = r - Math.abs(dx)
    const seg = r * r * Math.acos((r - h) / r) - (r - h) * Math.sqrt(Math.max(0, 2 * r * h - h * h))
    const left = dx >= 0 ? whole - seg : seg
    return [left, whole - left]
  }
  const whole = shoelace(f.corners)
  const left = shoelace(clipLeft(f.corners, X))
  return [left, whole - left]
}

/** Is the figure cut into two halves (equal area within 1 %)? */
export function halvedAt(f: Figure, X: number): boolean {
  const [l, r] = partsAt(f, X)
  return Math.abs(l - r) <= 0.01 * (l + r)
}

// ─── The figure a question asks about ──────────────────────────────────────

/** sortShapes questions, read off the spoken text: which drawn figures are members. */
export function sortRule(text: string): ((f: Figure) => boolean) | null {
  if (text.endsWith('med tre hjørner.')) return (f) => !f.semicircle && cornerCount(f) === 3
  if (text.endsWith('med fire hjørner.')) return (f) => !f.semicircle && cornerCount(f) === 4
  if (text.endsWith('uden hjørner.')) return (f) => cornerCount(f) === 0
  if (text.endsWith('med fire lige lange sider.')) return (f) => cornerCount(f) === 4 && sidesEqual(f.corners)
  if (text.endsWith('med fire rette hjørner.')) return (f) => cornerCount(f) === 4 && rightAnglesAll(f.corners)
  return null
}

// ─── Solids and things (the oracle's own tables) ───────────────────────────

/** The Danish names the voice uses: "kuglen", "alle, der har form som en kasse". */
export const SOLID_NAMES: Readonly<Record<SolidId, readonly string[]>> = {
  sphere: ['kugle', 'kuglen'], cube: ['terning', 'terningen'], cuboid: ['kasse', 'kassen'],
  cylinder: ['cylinder', 'cylinderen'], cone: ['kegle', 'keglen'], pyramid: ['pyramide', 'pyramiden'],
}

/** What shape each everyday thing the materials draw has: a ball and a marble are spheres, a block a cube … */
export const THING_SOLID: Readonly<Record<string, SolidId>> = {
  ball: 'sphere', marble: 'sphere', cube: 'cube', book: 'cuboid', straw: 'cylinder', carrot: 'cone',
}

/** SPEC §2.3: a cube is a cuboid (a terning is a kasse). */
export const solidIsA = (x: SolidId, y: SolidId): boolean => x === y || (x === 'cube' && y === 'cuboid')

export type SolidProp = 'rolls' | 'stacks' | 'flat'
/** Rolls: a curved surface. Stacks: a flat top and bottom. Only flat sides: no curved surface. */
export const SOLID_HAS: Readonly<Record<SolidProp, readonly SolidId[]>> = {
  rolls: ['sphere', 'cylinder', 'cone'], stacks: ['cube', 'cuboid', 'cylinder'], flat: ['cube', 'cuboid', 'pyramid'],
}
/** A thing where the property is not clear to a child: a straw lying down is not obviously stackable. */
export const UNCLEAR_THINGS: Readonly<Record<SolidProp, readonly string[]>> = { rolls: [], stacks: ['straw'], flat: [] }

/** The solid a card shows: 'solid:<id>' or 'obj:<thing>'. */
export function cardSolid(card: string): SolidId | null {
  if (card.startsWith('solid:')) return card.slice(6) as SolidId
  if (card.startsWith('obj:')) return THING_SOLID[card.slice(4)] ?? null
  return null
}

/** What a shapes3D question asks for, from the spoken text. */
export type SolidAsk = { by: 'name'; solid: SolidId } | { by: 'prop'; prop: SolidProp } | { by: 'thing' }

export function solidAsk(text: string): SolidAsk | null {
  if (text === 'Hvilken figur har samme form som tingen?') return { by: 'thing' }
  const props: readonly [RegExp, SolidProp][] = [[/kan trille\?|kan trille\.$/, 'rolls'], [/stable\?|stables[.?]$/, 'stacks'], [/kun (har )?flade sider[.?]$|har kun flade sider[.?]$/, 'flat']]
  for (const [re, prop] of props) if (re.test(text)) return { by: 'prop', prop }
  const m = /(?:Tryk på |form som en |form som et )([a-zæøå]+)[.?]$/.exec(text)
  if (m) {
    for (const [solid, names] of Object.entries(SOLID_NAMES)) if (names.includes(m[1])) return { by: 'name', solid: solid as SolidId }
  }
  return null
}

/** Does a card (or a thing) fit the question: the named solid with the hierarchy, or the property? */
export function fitsAsk(ask: Exclude<SolidAsk, { by: 'thing' }>, s: SolidId): boolean {
  return ask.by === 'name' ? solidIsA(s, ask.solid) : SOLID_HAS[ask.prop].includes(s)
}

// ─── Pattern blocks (composeShapes): areas with side 1 ─────────────────────

const R3 = Math.sqrt(3)
/** Area of each pattern block, all sides 1 (the big ones have sides 2); a circle and its half of one radius. */
export const BLOCK_AREA: Readonly<Record<string, number>> = {
  triangle: R3 / 4, // equilateral
  rhombus: R3 / 2, // 60° and 120°
  trapezoid: (3 * R3) / 4, // sides 1, 1, 1 and 2
  hexagon: (3 * R3) / 2, // regular
  square: 1,
  'big-triangle': R3, // side 2
  'big-square': 4, // side 2
  circle: Math.PI,
  semicircle: Math.PI / 2,
}

/** How many pieces cover a whole, by area (null when it is not a whole number). */
export function piecesPer(whole: string, piece: string): number | null {
  const k = BLOCK_AREA[whole] / BLOCK_AREA[piece]
  return Number.isFinite(k) && Math.abs(k - Math.round(k)) < 1e-9 ? Math.round(k) : null
}

/** Danish nouns of the blocks: singular indefinite and plural (and "små …", "en stor …"). */
const BLOCK_WORDS: readonly [string, string, string][] = [
  ['trekant', 'trekanter', 'triangle'], ['rombe', 'romber', 'rhombus'], ['trapez', 'trapezer', 'trapezoid'],
  ['sekskant', 'sekskanter', 'hexagon'], ['kvadrat', 'kvadrater', 'square'], ['cirkel', 'cirkler', 'circle'],
  ['halvcirkel', 'halvcirkler', 'semicircle'],
]
const blockOf = (word: string, plural: boolean): string | null => BLOCK_WORDS.find((w) => w[plural ? 1 : 0] === word)?.[2] ?? null

/**
 * A composeShapes question from its spoken text: "Hvor mange trekanter skal der til for at lave en
 * sekskant?" (make) or "Du har seks trekanter. Hvor mange romber kan du lave af dem?" (take).
 */
export function composeAsk(text: string): { piece: string; whole: string; have: string | null } | null {
  let m = /^Hvor mange (små )?([a-zæøå]+) skal der til for at lave (?:en|et) (stor |stort )?([a-zæøå]+)\?$/.exec(text)
  if (m) {
    const piece = blockOf(m[2], true)
    const base = blockOf(m[4], false)
    if (!piece || !base) return null
    const whole = m[3] ? `big-${base}` : base
    return (m[1] !== undefined) === (m[3] !== undefined) ? { piece, whole, have: null } : null
  }
  m = /^Du har ([a-zæøå]+) ([a-zæøå]+)\. Hvor mange ([a-zæøå]+) kan du lave af dem\?$/.exec(text)
  if (m) {
    const piece = blockOf(m[2], true)
    const whole = blockOf(m[3], true)
    return piece && whole ? { piece, whole, have: m[1] } : null
  }
  return null
}
