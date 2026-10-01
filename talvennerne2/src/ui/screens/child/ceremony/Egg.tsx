// The egg of the hatch (SPEC §5.8: three taps, about 5 s): a speckled egg that wobbles on each tap
// and cracks a little more, then splits so the new friend can pop out. Drawn here as UI (tokens,
// transform and opacity only), not as an animal.
import type { CSSProperties } from 'react'
import { cx } from '../../../design/cx'

/** Egg outline in a 120 x 150 box, pointier at the top. */
const SHELL = 'M60 6C88 6 112 52 112 88C112 122 89 144 60 144S8 122 8 88C8 52 32 6 60 6z'
const SPECKLES: readonly [number, number, number][] = [[38, 50, 6], [76, 40, 4.5], [86, 86, 7], [30, 98, 5], [62, 116, 6], [58, 70, 3.5]]
/** Cracks per tap: each tap adds one more. */
const CRACKS = [
  'M20 80l14 -6l8 9l12 -8',
  'M54 75l10 7l12 -9l10 8l14 -6',
  'M100 70l-4 10l6 4',
]
/** Where the shell splits when it opens: a zigzag across the middle. */
const ZIGZAG = 'L100 74L88 84L76 72L64 84L52 72L40 84L28 72L16 84L8 76'
const TOP = `M8 76C10 48 32 6 60 6S110 48 112 76${ZIGZAG}Z`
const BOTTOM = `M8 76C8 120 30 144 60 144S112 120 112 76${ZIGZAG}Z`

export function Egg({ taps, open, className, style }: { taps: number; open: boolean; className?: string; style?: CSSProperties }) {
  return (
    <svg className={cx('tv-egg2', open && 'is-open', className)} viewBox="0 0 120 150" style={style} aria-hidden data-taps={taps}>
      <ellipse className="tv-egg2__shadow" cx="60" cy="144" rx="40" ry="6" />
      {open ? (
        <>
          <path className="tv-egg2__shell tv-egg2__half is-top" d={TOP} />
          <path className="tv-egg2__shell tv-egg2__half is-bottom" d={BOTTOM} />
        </>
      ) : (
        <g className="tv-egg2__body" key={taps}>
          <path className="tv-egg2__shell" d={SHELL} />
          {SPECKLES.map(([x, y, r], i) => (
            <circle key={i} className="tv-egg2__speckle" cx={x} cy={y} r={r} />
          ))}
          <path className="tv-egg2__shine" d="M34 36c6-10 14-16 22-18" />
          {CRACKS.slice(0, taps).map((d, i) => (
            <path key={i} className="tv-egg2__crack" d={d} />
          ))}
        </g>
      )}
    </svg>
  )
}
