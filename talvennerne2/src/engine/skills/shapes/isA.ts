// Figurernes begrebshierarki (SPEC §2.3): which figure is also which.
//   square ⊂ rectangle ⊂ quadrilateral, square ⊂ rhombus ⊂ quadrilateral, trapezoid ⊂ quadrilateral,
//   cube ⊂ cuboid.
// A trapezoid here is the drawn one: exactly one pair of parallel sides, so a rectangle is not a
// trapezoid. Rules for every shapes task (content test): a distractor is never an instance of the
// answer, and every instance of the answer is in the answer set ("alle rektangler" includes squares).
import type { ShapeId, SolidId } from '../../types'

export type Figure = ShapeId | SolidId

const PARENTS: Readonly<Record<Figure, readonly Figure[]>> = {
  circle: [],
  semicircle: [],
  triangle: [],
  quadrilateral: [],
  rectangle: ['quadrilateral'],
  rhombus: ['quadrilateral'],
  square: ['rectangle', 'rhombus'],
  trapezoid: ['quadrilateral'],
  pentagon: [],
  hexagon: [],
  octagon: [],
  sphere: [],
  cube: ['cuboid'],
  cuboid: [],
  cylinder: [],
  cone: [],
  pyramid: [],
}

/** Is every `x` also a `y`? Reflexive and transitive: isA('square', 'quadrilateral') is true. */
export function isA(x: Figure, y: Figure): boolean {
  return x === y || PARENTS[x].some((p) => isA(p, y))
}

/**
 * The most specific class a materials variant actually draws (src/art/materials/Shapes.tsx): the
 * generic 'quadrilateral' is a 66 × 56 rectangle in variants 0, 3, 4 and 5, a square turned 45° in
 * variant 1, and only variant 2 is a general four-sided figure. Every other shape draws itself (the
 * stretched square is a turned square, the rectangles are never square, the rhombi never square).
 */
export function drawnClass(shape: ShapeId, variant: number): ShapeId {
  if (shape !== 'quadrilateral') return shape
  return variant === 1 ? 'square' : variant === 2 ? 'quadrilateral' : 'rectangle'
}

/** Does the drawn figure count as a `target`? */
export const shows = (shape: ShapeId, variant: number, target: ShapeId): boolean => isA(drawnClass(shape, variant), target)
