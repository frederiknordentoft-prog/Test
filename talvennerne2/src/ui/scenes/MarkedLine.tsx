// A number line with some numbers marked (review r1 P2-7): "Hvilket tal er størst?" asks about the
// numbers on the cards, so the one line the task shows marks exactly those — a dot on the line and a
// ring round the number — and the strategy hops along the same line. The marks are drawn over the
// materials' NumberLine in its own coordinates (NL, xOf), so both scale as one picture.
import { NL, NumberLine, xOf } from '../../art/materials/NumberLine'
import { cx } from '../design/cx'

export interface MarkedLineProps {
  min: number
  max: number
  marks: readonly number[]
  hops?: number[]
  /** An empty line: only its ends are numbered. */
  endsOnly?: boolean
  className?: string
}

export function MarkedLine({ min, max, marks, hops, endsOnly, className }: MarkedLineProps) {
  const shown = marks.filter((v) => v >= min && v <= max)
  return (
    <span className={cx('tv-markedline', className)} data-marks={shown.join(',')}>
      <NumberLine min={min} max={max} hops={hops} endsOnly={endsOnly} className="tv-markedline__line" />
      {/* the same box as the line's own svg (class, size, viewBox), so the CSS sizes both alike */}
      <svg className="tv-mat tv-markedline__marks" viewBox={`0 0 ${NL.W} ${NL.H}`} width={NL.W} height={NL.H} aria-hidden overflow="visible">
        {shown.map((v) => {
          const x = xOf(v, min, max)
          return (
            <g key={v} className="tv-markedline__mark">
              <rect className="tv-markedline__ring" x={x - 17} y={NL.Y + 15} width={34} height={34} rx={12} />
              <circle className="tv-markedline__dot" cx={x} cy={NL.Y} r={10} />
            </g>
          )
        })}
      </svg>
    </span>
  )
}
