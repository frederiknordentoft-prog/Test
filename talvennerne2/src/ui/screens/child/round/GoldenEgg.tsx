// The golden egg (SPEC §5.4, V1): after three right in a row it flutters in on little wings and
// hovers by the task. One right answer catches it; a wrong answer or "Spring over" lets it fly on —
// missing it costs nothing, and there is no clock on it.
import { blob, circle, ellipse, join, lune, starPoints, poly } from '../../../../art/materials/geom'
import type { V2 } from '../../../../art/materials/geom'
import { cx } from '../../../design/cx'

export type EggState = 'arrive' | 'wait' | 'caught' | 'gone'

const EGG: V2[] = [[40, 8], [52, 14], [60, 30], [62, 48], [56, 64], [40, 72], [24, 64], [18, 48], [20, 30], [28, 14]]
const WING: V2[] = [[0, 0], [-10, -12], [-24, -16], [-30, -8], [-26, 0], [-30, 6], [-20, 10], [-8, 8]]
const wingPath = blob(WING, 0.8)
const sparkle = (x: number, y: number, r: number) => poly(starPoints(x, y, r, r * 0.38, 4, 0))

export function GoldenEgg({ state, className }: { state: EggState; className?: string }) {
  return (
    <div className={cx('tv-egg', `is-${state}`, className)} aria-hidden data-egg={state}>
      <svg viewBox="-36 -10 152 96" className="tv-egg__svg">
        <g className="tv-egg__wing tv-egg__wing--l" style={{ transformOrigin: '22px 34px' }}>
          <path d={wingPath} transform="translate(22 34)" className="tv-egg__feather" />
        </g>
        <g className="tv-egg__wing tv-egg__wing--r" style={{ transformOrigin: '58px 34px' }}>
          <path d={wingPath} transform="translate(58 34) scale(-1 1)" className="tv-egg__feather" />
        </g>
        <path d={blob(EGG, 0.95)} className="tv-egg__shell" />
        <path d={lune(40, 44, 20, 6, 6)} className="tv-egg__shade" />
        <path d={join(ellipse(31, 26, 5, 8.5), circle(30, 41, 2.6))} className="tv-egg__shine" />
        <path d={blob(EGG, 0.95)} className="tv-egg__line" />
        <path d={join('M24 50l6-5 6 5 6-5 6 5 6-5 5 4')} className="tv-egg__zig" />
        <path d={join(sparkle(70, 8, 7), sparkle(10, 66, 5), sparkle(74, 60, 4))} className="tv-egg__sparkle" />
      </svg>
    </div>
  )
}
