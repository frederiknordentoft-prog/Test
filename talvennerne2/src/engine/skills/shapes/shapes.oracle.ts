// Independent oracles for shapes2D. Which figure a card or an item really is, is read off the
// drawing itself: the materials' Shape2D is rendered with its corner marks, and the corners are
// measured — how many, right angles, equal sides — the way a teacher checks a figure. SPEC §2.3's
// hierarchy (kvadrat ⊂ rektangel ⊂ firkant) then follows from the definitions, so "alle rektangler"
// takes in the squares without being told. The spoken question names the figure asked for. The
// registry skips *.oracle.ts files, so none of this reaches the app.
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Shape2D } from '../../../art/materials/Shapes'
import type { ShapeId } from '../../types'

type V = readonly [number, number]

export interface Drawn {
  /** Corner points of the drawn polygon, in drawing order (none for a round figure). */
  corners: V[]
  /** A whole circle: no corners and one round outline. */
  round: boolean
}

const drawings = new Map<string, Drawn>()

/** The figure the materials draw for a shape in a variant, measured from its corner marks. */
export function drawn(shape: ShapeId, variant: number): Drawn {
  const key = `${shape}:${variant}`
  const known = drawings.get(key)
  if (known) return known
  const svg = renderToStaticMarkup(createElement(Shape2D, { shape, variant, mark: 'corners' }))
  // each corner mark is a radius-5 dot: M(x−5) y a5 5 0 1 0 10 0 a5 5 0 1 0 −10 0 z
  const corners = [...svg.matchAll(/M(-?[\d.]+) (-?[\d.]+)a5 5 0 1 0 10 0a5 5 0 1 0 -10 0z/g)].map((m) => [Number(m[1]) + 5, Number(m[2])] as const)
  const round = corners.length === 0 && /a([\d.]+) \1 0 1 0 ([\d.]+) 0a\1 \1 0 1 0 -\2 0z/.test(svg)
  const d: Drawn = { corners, round }
  drawings.set(key, d)
  return d
}

const sub = (p: V, q: V): V => [p[0] - q[0], p[1] - q[1]]
const length = (v: V): number => Math.hypot(v[0], v[1])
const sidesOf = (c: readonly V[]): V[] => c.map((p, i) => sub(c[(i + 1) % c.length], p))

/** Every corner within 1° of a right angle (the marks are rounded to 0.01). */
function allRightAngles(c: readonly V[]): boolean {
  const s = sidesOf(c)
  return s.every((v, i) => {
    const w = s[(i + 1) % s.length]
    return Math.abs(v[0] * w[0] + v[1] * w[1]) / (length(v) * length(w)) < Math.sin(Math.PI / 180)
  })
}

/** All sides equally long, within 1 %. */
function allSidesEqual(c: readonly V[]): boolean {
  const l = sidesOf(c).map(length)
  return Math.max(...l) - Math.min(...l) < 0.01 * Math.max(...l)
}

/**
 * Is the drawn figure a `target`? By definition: a circle is round, a triangle has three corners, a
 * firkant four, a rectangle four right angles, a square four right angles and four equal sides, a
 * pentagon five corners, a hexagon six, an octagon eight.
 */
export function isMember(d: Drawn, target: ShapeId): boolean {
  const n = d.corners.length
  switch (target) {
    case 'circle':
      return d.round
    case 'triangle':
      return n === 3
    case 'quadrilateral':
      return n === 4
    case 'rectangle':
      return n === 4 && allRightAngles(d.corners)
    case 'square':
      return n === 4 && allRightAngles(d.corners) && allSidesEqual(d.corners)
    case 'rhombus':
      return n === 4 && allSidesEqual(d.corners)
    case 'pentagon':
      return n === 5
    case 'hexagon':
      return n === 6
    case 'octagon':
      return n === 8
    default:
      throw new Error(`no definition of ${target} in the oracle`)
  }
}

/** SPEC §2.3 by name: a square is a rectangle, a rectangle (and every four-sided figure) a firkant. */
export function specIsA(x: ShapeId, y: ShapeId): boolean {
  if (x === y) return true
  if (y === 'quadrilateral') return ['square', 'rectangle', 'rhombus', 'trapezoid'].includes(x)
  return x === 'square' && (y === 'rectangle' || y === 'rhombus')
}

// ─── Cards, questions and prototypes ────────────────────────────────────────

/** 'shape:<shape>:<variant>' → the figure. */
export function shapeToken(token: string): { shape: ShapeId; variant: number } {
  const m = /^shape:([a-z]+):(\d)$/.exec(token)
  if (!m) throw new Error(`not a shape card: ${token}`)
  return { shape: m[1] as ShapeId, variant: Number(m[2]) }
}

/** shp:<shape>:<variant> → the figure the fact is about. */
export function factFigure(id: string): { shape: ShapeId; variant: number } {
  const m = /^shp:([a-z]+):(\d)$/.exec(id)
  if (!m) throw new Error(`not a shapes2D id: ${id}`)
  return { shape: m[1] as ShapeId, variant: Number(m[2]) }
}

const NOUNS: Readonly<Record<string, readonly [ShapeId, 'def' | 'pl']>> = {
  cirklen: ['circle', 'def'], cirkler: ['circle', 'pl'], trekanten: ['triangle', 'def'], trekanter: ['triangle', 'pl'],
  firkanten: ['quadrilateral', 'def'], firkanter: ['quadrilateral', 'pl'], kvadratet: ['square', 'def'], kvadrater: ['square', 'pl'],
  rektanglet: ['rectangle', 'def'], rektangler: ['rectangle', 'pl'], femkanten: ['pentagon', 'def'], femkanter: ['pentagon', 'pl'],
  sekskanten: ['hexagon', 'def'], sekskanter: ['hexagon', 'pl'], ottekanten: ['octagon', 'def'], ottekanter: ['octagon', 'pl'],
}

/** "Tryk på trekanten." → one triangle; "Tryk på alle trekanter." → every triangle. Null otherwise. */
export function askedFor(text: string): { target: ShapeId; all: boolean } | null {
  const m = /^Tryk på (alle )?([a-zæøå]+)\.$/.exec(text)
  const noun = m ? NOUNS[m[2]] : undefined
  if (!m || !noun) return null
  const all = m[1] !== undefined
  // one figure takes the definite singular, all of them the plural
  return all === (noun[1] === 'pl') ? { target: noun[0], all } : null
}

/**
 * prototypeOnly (pædagogik §3.2) is about figures that do not "stand nicely": turned (variant 1),
 * stretched or skew (2) and small (3). A pattern (4) or an outline (5) changes the surface, not the
 * form, and every variant of a circle is a circle in the same position (the materials never draw an
 * ellipse) — those are read as prototypical. SPEC's wording "varianter ≠ standard" is wider.
 */
export const isPrototypical = (shape: ShapeId, variant: number): boolean => shape === 'circle' || ![1, 2, 3].includes(variant)
