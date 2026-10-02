// What the drawn figures of the materials library are (src/art/materials/Shapes.tsx, read by hand),
// for the shapes skills of 1.–2. klasse (SK2-GEO): corners, symmetry about the vertical line through
// the middle, a symmetry line at all, four equal sides and right angles. Every rule goes through
// drawnClass (isA.ts), so a turned square drawn as the generic firkant counts as the square it is.
// No SkillDef default export: the registry skips this file.
import type { ShapeId } from '../../types'
import { drawnClass, isA } from './isA'

/** A figure as the materials draw it: shape and variant (0 standard, 1 turned, 2 stretched/skew, 3 small, 4 patterned, 5 outline). */
export interface Fig {
  shape: ShapeId
  variant: number
}

/** Corners of each figure (the semicircle has two where the arc meets the straight side). */
export const CORNERS: Readonly<Record<ShapeId, number>> = {
  circle: 0, semicircle: 2, triangle: 3, quadrilateral: 4, square: 4, rectangle: 4, rhombus: 4, trapezoid: 4,
  pentagon: 5, hexagon: 6, octagon: 8,
}

/** Variants 3–5 reuse variant 0's outline (small, patterned, outline only). */
const outline = (variant: number): number => (variant >= 3 ? 0 : variant)

/**
 * Is the vertical line through the middle of the drawing (Shape2D's cut 'equal', x = 50) a line of
 * symmetry? Read off the geometry: the turned rectangle (−28°), the square turned 18° and the sheared
 * rhombus are halved by it but not mirrored; the skew figures and a turned triangle are neither. The
 * irregular hexagon and octagon pull every other corner in, which keeps their vertical mirror line;
 * the irregular pentagon does not.
 */
export function mirroredByMiddle({ shape, variant }: Fig): boolean {
  const v = outline(variant)
  switch (shape) {
    case 'circle':
    case 'octagon':
    case 'hexagon':
      return true
    case 'triangle':
    case 'trapezoid':
      return v !== 1 && v !== 2 ? true : shape === 'trapezoid' && v === 1
    case 'quadrilateral':
    case 'square':
      return v !== 2
    case 'rectangle':
      return v !== 1
    case 'rhombus':
      return v !== 2
    case 'pentagon':
      return v !== 2
    case 'semicircle':
      return v === 0
  }
}

/**
 * Does the figure have a line of symmetry at all (in any direction)? Every circle, regular polygon,
 * rectangle, rhombus and the isosceles trapezoid has one; only the skew triangle, the skew firkant,
 * the irregular pentagon and the skew trapezoid have none.
 */
export function hasMirrorLine({ shape, variant }: Fig): boolean {
  const v = outline(variant)
  if (v !== 2) return true
  return !['triangle', 'quadrilateral', 'pentagon', 'trapezoid'].includes(shape)
}

/** Four equal sides: squares and rhombi (also the turned square drawn as a firkant). */
export const fourEqualSides = (f: Fig): boolean => isA(drawnClass(f.shape, f.variant), 'rhombus')

/** Four right angles: squares and rectangles (the generic firkant is a rectangle in four variants). */
export const rightAngles = (f: Fig): boolean => isA(drawnClass(f.shape, f.variant), 'rectangle')

/** Turned, stretched and small figures are the ones a prototype-only eye misses; a circle has none. */
export const prototypical = ({ shape, variant }: Fig): boolean => shape === 'circle' || ![1, 2, 3].includes(variant)

export const figToken = (f: Fig): string => `${f.shape}.${f.variant}`
export function parseFig(t: string): Fig {
  const [shape, variant] = t.split('.')
  return { shape: shape as ShapeId, variant: Number(variant) }
}
