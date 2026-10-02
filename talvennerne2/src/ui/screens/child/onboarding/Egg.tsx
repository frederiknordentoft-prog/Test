// The eggs of the first friend (SPEC §8 onboarding, §6.2): four starter eggs with a little animal
// peeking out over the broken rim, and the chosen egg that cracks on the first two taps and splits
// on the third. One tint per starter so the four eggs differ at a glance; colours come from tokens
// (onboarding.css). Only transform and opacity move.
import { useId } from 'react'
import type { ReactNode } from 'react'
import { blob, ellipse, join, lune, poly } from '../../../../art/materials/geom'
import type { V2 } from '../../../../art/materials/geom'
import type { SpeciesId } from '../../../../engine/types'
import { cx } from '../../../design/cx'
import { Critter, isDrawn, useAnimalImage, type AnimalLook } from './art'

/** viewBox 0 0 120 160. */
const SHELL: V2[] = [[60, 8], [87.3, 21.5], [105.5, 57.5], [110, 98], [96.4, 134], [60, 152], [23.6, 134], [10, 98], [14.5, 57.5], [32.7, 21.5]]
const SHELL_D = blob(SHELL, 0.95)
/** Where the shell breaks: a zigzag across the egg. */
const RIM: V2[] = [[0, 72], [12, 64], [24, 76], [36, 64], [48, 76], [60, 64], [72, 76], [84, 64], [96, 76], [108, 64], [120, 72]]
const RIM_D = poly(RIM, false)
const rimPts = RIM.map(([x, y]) => `${x} ${y}`).join('L')
const BELOW_D = `M0 200L${rimPts}L120 200z`
const ABOVE_D = `M0 -40L${rimPts}L120 -40z`
/** The first crack is the middle of the rim; the second runs all the way across. */
const CRACK_1 = poly(RIM.slice(3, 8), false)
const SPOTS = join(ellipse(40, 44, 7, 5), ellipse(78, 34, 5, 4), ellipse(90, 92, 8, 6), ellipse(30, 108, 6, 5), ellipse(66, 124, 7, 5), ellipse(54, 86, 4, 3))
const SHADE = lune(60, 96, 52, 12, 14)
const SHINE = join(ellipse(36, 50, 7, 13), ellipse(32, 72, 3, 4))

export type EggTint = 'rabbit' | 'cat' | 'puppy' | 'horse' | 'neutral'

export const tintOf = (species: SpeciesId): EggTint =>
  species === 'rabbit' || species === 'cat' || species === 'puppy' || species === 'horse' ? species : 'neutral'

/** The shell (or the part of it inside `clip`), its spots and light kept inside the outline. */
function Shell({ clip, inside }: { clip: string; inside: string }) {
  return (
    <g clipPath={`url(#${clip})`}>
      <path d={SHELL_D} className="tv-oegg__shell" />
      <g clipPath={`url(#${inside})`}>
        <path d={SPOTS} className="tv-oegg__spots" />
        <path d={SHADE} className="tv-oegg__shade" />
        <path d={SHINE} className="tv-oegg__shine" />
      </g>
      <path d={SHELL_D} className="tv-oegg__line" />
    </g>
  )
}

/**
 * A starter egg with its baby peeking over the broken rim (the eggs to choose from). `look` is the
 * breed and colour the baby will hatch with (onboarding/flow.ts starterLooks), so the egg shows the
 * friend that comes out; without it the species' first colour.
 */
export function PeekEgg({ species, look, className }: { species: SpeciesId; look?: AnimalLook; className?: string }) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  const head = useAnimalImage(isDrawn(species) ? (look ?? { species, stage: 1 }) : null, { crop: 'head' })
  return (
    <svg viewBox="0 0 120 160" className={cx('tv-oegg', `tv-oegg--${tintOf(species)}`, className)} aria-hidden overflow="visible">
      <defs>
        <clipPath id={`${id}b`}>
          <path d={BELOW_D} />
        </clipPath>
        <clipPath id={`${id}s`}>
          <path d={SHELL_D} />
        </clipPath>
      </defs>
      <path d={ellipse(60, 70, 44, 9)} className="tv-oegg__hole" />
      <g className="tv-oegg__peek">
        {isDrawn(species) ? (
          head && <image href={head} x="12" y="-18" width="96" height="96" />
        ) : (
          <Critter viewBox="40 62 120 120" x={14} y={-8} width={92} height={92} />
        )}
      </g>
      <Shell clip={`${id}b`} inside={`${id}s`} />
      <path d={RIM_D} clipPath={`url(#${id}s)`} className="tv-oegg__rim" />
    </svg>
  )
}

export interface HatchEggProps {
  species: SpeciesId
  /** 0 whole, 1 a small crack, 2 cracked across. */
  cracks: 0 | 1 | 2
  /** The third tap: the top flies off and `children` (the baby) rises out of the lower shell. */
  split: boolean
  /** Changes on every tap: replays the wobble. */
  tapKey?: number
  children?: ReactNode
  className?: string
}

/** The chosen egg: three taps to hatch. */
export function HatchEgg({ species, cracks, split, tapKey = 0, children, className }: HatchEggProps) {
  const id = useId().replace(/[^A-Za-z0-9_-]/g, '')
  return (
    <div className={cx('tv-hatch', `tv-oegg--${tintOf(species)}`, split && 'is-split', className)} data-cracks={cracks}>
      <div className="tv-hatch__baby">{split && children}</div>
      <div key={tapKey} className={cx('tv-hatch__wobble', tapKey > 0 && !split && 'is-wobbling')}>
        <svg viewBox="0 0 120 160" className="tv-oegg tv-hatch__egg" aria-hidden overflow="visible">
          <defs>
            <clipPath id={`${id}b`}>
              <path d={BELOW_D} />
            </clipPath>
            <clipPath id={`${id}a`}>
              <path d={ABOVE_D} />
            </clipPath>
            <clipPath id={`${id}s`}>
              <path d={SHELL_D} />
            </clipPath>
          </defs>
          <Shell clip={`${id}b`} inside={`${id}s`} />
          <g className="tv-hatch__top">
            <Shell clip={`${id}a`} inside={`${id}s`} />
          </g>
          <g clipPath={`url(#${id}s)`}>
            <path d={CRACK_1} className={cx('tv-oegg__crack', cracks >= 1 && !split && 'is-shown')} />
            <path d={RIM_D} className={cx('tv-oegg__crack', cracks >= 2 && !split && 'is-shown')} />
            <path d={RIM_D} className={cx('tv-oegg__rim', !split && 'is-hidden')} />
          </g>
        </svg>
      </div>
    </div>
  )
}
