// Counters in ten-frames for the strategy pictures: plus as two colours, minus as counters taken
// away (faded with a stroke through them), "fyld op til ti" as counters moving into the first
// frame. Each counter may carry an animation delay; with calm motion everything simply stands in
// its end state (the keyframes only ever animate *into* the drawn state).
import type { CSSProperties } from 'react'
import { circle, ellipse, join, roundRect, segments } from '../../art/materials/geom'
import { HIGHLIGHT, MAT } from '../../art/materials/palette'
import { cx } from '../design/cx'

export interface Cell {
  tone: 'a' | 'b' | null
  /** Taken away (minus). */
  struck?: boolean
  /** Arrives (fades and drops in) after this many ms. */
  arrive?: number
  /** Leaves (is struck or lifts away) after this many ms. */
  leave?: number
  /** A ghost outline where a counter was. */
  ghost?: boolean
}

const CELL = 44
const PAD = 8

/** One ten-frame (2 x 5) with up to ten cells. */
export function Frame({ cells, size = 200, className }: { cells: Cell[]; size?: number; className?: string }) {
  const W = CELL * 5 + PAD * 2
  const H = CELL * 2 + PAD * 2
  const f = MAT.frame
  const lines = segments([
    ...[1, 2, 3, 4].map((i) => [PAD + i * CELL, PAD, PAD + i * CELL, PAD + 2 * CELL] as const),
    [PAD, PAD + CELL, PAD + 5 * CELL, PAD + CELL] as const,
  ])
  return (
    <svg className={cx('tv-frame', className)} viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} aria-hidden>
      <path d={roundRect(PAD - 4, PAD - 4, W - 2 * PAD + 8, H - 2 * PAD + 8, 14)} fill={f.fill} stroke={f.outline} strokeWidth={3} />
      <path d={lines} stroke={f.outline} strokeOpacity={0.5} strokeWidth={2} />
      {cells.slice(0, 10).map((c, i) => {
        const cx0 = PAD + (i % 5) * CELL + CELL / 2
        const cy0 = PAD + Math.floor(i / 5) * CELL + CELL / 2
        if (c.ghost) return <path key={i} d={circle(cx0, cy0, 14)} className="tv-counter__ghost" />
        if (!c.tone) return null
        const t = c.tone === 'a' ? MAT.counterA : MAT.counterB
        const style: CSSProperties = {}
        if (c.arrive !== undefined) style.animationDelay = `${c.arrive}ms`
        return (
          <g
            key={i}
            className={cx('tv-counter', c.arrive !== undefined && 'is-arriving', c.struck && 'is-struck', c.leave !== undefined && 'is-leaving')}
            style={{ ...style, transformOrigin: `${cx0}px ${cy0}px`, ...(c.leave !== undefined ? { ['--leave' as string]: `${c.leave}ms` } : {}) }}
          >
            <path d={circle(cx0, cy0, 15)} fill={t.fill} />
            <path d={ellipse(cx0 - 5, cy0 - 6, 4.2, 2.6)} fill={HIGHLIGHT} />
            <path d={circle(cx0, cy0, 15)} fill="none" stroke={t.outline} strokeWidth={2.6} />
            {c.struck && <path className="tv-counter__x" d={join(`M${cx0 - 12} ${cy0 + 12}L${cx0 + 12} ${cy0 - 12}`)} />}
          </g>
        )
      })}
    </svg>
  )
}

/** The given cells, then empty ones up to a full frame. */
export function cells(spec: readonly Cell[], total = 10): Cell[] {
  const out: Cell[] = spec.slice(0, total)
  while (out.length < total) out.push({ tone: null })
  return out
}
