// The hatching egg of Dyrehaven (SPEC §5.7): a speckled egg in its nest that glows when it is warm
// enough and cracks a little more with each of the three taps. Drawn as UI with token colours; the
// wobble and the glow move with transform and opacity only.
import { cx } from '../../../design/cx'

const SHELL = 'M60 8C87 8 108 52 108 88C108 120 87 140 60 140S12 120 12 88C12 52 33 8 60 8z'
/** Speckles as one path of small ellipses. */
const SPECKLES = [[40, 52, 6, 5], [76, 42, 4.5, 4], [84, 88, 7, 6], [34, 98, 5, 4.5], [62, 114, 6, 5], [58, 72, 3.5, 3]]
  .map(([x, y, rx, ry]) => `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`)
  .join('')
/** One crack more per tap. */
const CRACKS = ['M22 84l13-6l8 9l12-8', 'M55 76l10 7l12-9l10 8l13-6', 'M60 40l-6 10l8 6l-5 10']

export function EggArt({ taps = 0, ready = false, className }: { taps?: number; ready?: boolean; className?: string }) {
  return (
    <svg className={cx('zoo-egg', ready && 'is-ready', className)} viewBox="0 0 120 160" aria-hidden data-taps={taps}>
      {ready && <circle className="zoo-egg__glow" cx="60" cy="86" r="58" />}
      <path className="zoo-egg__nest" d="M10 132c14 20 86 20 100 0c-6 16-22 22-50 22S16 148 10 132z" />
      <g className="zoo-egg__body">
        <path className="zoo-egg__shell" d={SHELL} />
        <path className="zoo-egg__speckle" d={SPECKLES} />
        <path className="zoo-egg__shine" d="M36 40c6-10 13-16 21-18" />
        {CRACKS.slice(0, Math.min(taps, CRACKS.length)).map((d, i) => (
          <path key={i} className="zoo-egg__crack" d={d} />
        ))}
      </g>
    </svg>
  )
}
