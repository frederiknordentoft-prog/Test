// The neutral stand-in for a child's friend whose species is not drawn yet: an egg-shaped little
// creature with a friendly face, no ears, no species — never another animal (review P1-2). The
// onboarding's eggs, the buddy beside the task, the map, the wardrobe and the ceremonies all show
// this same figure, and each of them switches to the real drawing by itself once the species file
// lands in src/art/species/ (the registry lists the files that exist).
//
//   <Critter mood="happy" />                 the whole figure on the rig's 200 by 240 canvas
//   <Critter mood="happy" crop="head" />     only the face (round pictures: the map's top bar)
import { blob, circle, ellipse, join } from '../../../../art/materials/geom'
import type { V2 } from '../../../../art/materials/geom'
import type { Mood } from '../../../../engine/types'
import { cx } from '../../../design/cx'
import './critter.css'

/** The parts of the 200 by 240 canvas a picture can show, framed like the rig's crops. */
export type CritterCrop = 'full' | 'fit' | 'head'
export const CRITTER_BOX: Readonly<Record<CritterCrop, string>> = {
  full: '0 0 200 240',
  /** 5:6 around the figure, like the rig's 'fit'. */
  fit: '28 68 144 172',
  /** A square around the face. */
  head: '40 62 120 120',
}

/** viewBox 0 0 200 240 like the rig, standing on the same ground line (y = 226). */
const BODY: V2[] = [[100, 70], [138, 86], [158, 134], [154, 188], [128, 222], [100, 228], [72, 222], [46, 188], [42, 134], [62, 86]]

export interface CritterProps {
  mood?: Mood
  className?: string
  /** Which part of the canvas to show (default: the whole figure). */
  crop?: CritterCrop
  /** Any other part of the 200 by 240 canvas (e.g. only the face when it peeks out of an egg). */
  viewBox?: string
  /** Placement when nested inside another SVG. */
  x?: number
  y?: number
  width?: number
  height?: number
}

/**
 * A neutral egg-shaped little creature. It stands where an undrawn species would stand, so layouts
 * do not change when the drawing arrives.
 */
export function Critter({ mood = 'idle', className, crop = 'full', viewBox, ...place }: CritterProps) {
  const happy = mood === 'happy' || mood === 'cheer' || mood === 'wave'
  // Nested in another SVG it keeps the given box (a CSS width would override the attributes).
  const nested = place.width !== undefined
  return (
    <svg
      viewBox={viewBox ?? CRITTER_BOX[crop]}
      className={cx(nested ? 'tv-critter-in' : 'tv-critter', className)}
      aria-hidden
      overflow="hidden"
      data-critter=""
      {...place}
    >
      <ellipse cx="100" cy="228" rx="52" ry="7" className="tv-critter__shadow" />
      <path d={blob(BODY, 0.9)} className="tv-critter__body" />
      <path d={ellipse(100, 186, 34, 30)} className="tv-critter__belly" />
      <path d={join(circle(80, 140, 9), circle(120, 140, 9))} className="tv-critter__eye" />
      <path d={join(circle(83, 136, 3.2), circle(123, 136, 3.2))} className="tv-critter__glint" />
      <path d={join(ellipse(66, 160, 9, 5.5), ellipse(134, 160, 9, 5.5))} className="tv-critter__cheek" />
      <path d={happy ? 'M88 158q12 13 24 0' : 'M91 160q9 7 18 0'} className="tv-critter__mouth" />
    </svg>
  )
}
