// The round's stone path (SPEC §5.7: the only progress HUD during a round, no numbers). One pebble
// per task along a gentle wave; answered stones light up with a paw print, the current one wears a
// ring (or the buddy, passed as SVG in `marker`), and a flag waits at the end. `planks` draws the
// mastery-trial bridge instead: every correct first try lays a plank.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { blob, circle, ellipse, hash01, join, n, roundRect } from '../../art/materials/geom'
import type { V2 } from '../../art/materials/geom'
import { cx } from './cx'

export interface ProgressStonesProps {
  total: number
  /** Stones already passed (answered tasks). */
  done: number
  /** Paws glow while the child has a streak (kombo "poteaftryk lyser"). */
  glow?: boolean
  variant?: 'stones' | 'planks'
  /** SVG content drawn standing on the current stone, e.g. a small buddy rig (≈ 40 units tall). */
  marker?: ReactNode
  className?: string
  /** Accessible description; the path itself never shows numbers. */
  label?: string
}

const GAP = 44
const H = 64
const BASE_Y = 42

const wave = (i: number) => Math.sin(i * 0.95) * 4

function pebble(x: number, y: number, rx: number, ry: number, seed: number): string {
  const pts: V2[] = []
  const k = 9
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + seed
    const j = 1 + (hash01(seed * 31 + i) - 0.5) * 0.14
    pts.push([x + Math.cos(a) * rx * j, y + Math.sin(a) * ry * j])
  }
  return blob(pts, 1)
}

function paw(x: number, y: number, s: number): string {
  return join(
    ellipse(x, y + 2.2 * s, 3.6 * s, 2.9 * s),
    ellipse(x - 4.3 * s, y - 1.6 * s, 1.5 * s, 1.8 * s),
    ellipse(x - 1.5 * s, y - 4.1 * s, 1.5 * s, 1.9 * s),
    ellipse(x + 1.5 * s, y - 4.1 * s, 1.5 * s, 1.9 * s),
    ellipse(x + 4.3 * s, y - 1.6 * s, 1.5 * s, 1.8 * s),
  )
}

function flag(x: number, y: number): string {
  // pole + pennant, drawn as two closed shapes
  return join(roundRect(x - 1.4, y - 30, 2.8, 30, 1.4), `M${n(x + 1)} ${n(y - 29)}l15 5.5-15 5.5z`)
}

export function ProgressStones({ total, done, glow, variant = 'stones', marker, className, label }: ProgressStonesProps) {
  const count = Math.max(1, Math.round(total))
  const passed = Math.max(0, Math.min(count, Math.round(done)))
  const width = GAP * count + 44
  const geo = useMemo(() => {
    const stones = Array.from({ length: count }, (_, i) => {
      const x = 24 + i * GAP
      const y = BASE_Y + wave(i)
      return { x, y }
    })
    const goal = { x: 24 + count * GAP - 4, y: BASE_Y + wave(count) }
    return { stones, goal }
  }, [count])
  const current = passed < count ? geo.stones[passed] : geo.goal

  if (variant === 'planks') {
    const pw = GAP - 6
    return (
      <svg
        className={cx('tv-stones tv-stones--planks', glow && 'is-glowing', className)}
        viewBox={`0 0 ${width} ${H}`}
        role="img"
        aria-label={label}
      >
        <path className="tv-planks__rope" d={`M4 ${BASE_Y - 20}C${width * 0.3} ${BASE_Y - 8} ${width * 0.7} ${BASE_Y - 8} ${width - 4} ${BASE_Y - 20}`} />
        {geo.stones.map((s, i) => {
          const d = roundRect(s.x - pw / 2, BASE_Y - 8, pw, 16, 4)
          return i < passed ? (
            <g key={i} className="tv-plank is-laid">
              <path d={d} />
              <path className="tv-plank__grain" d={`M${s.x - pw / 4} ${BASE_Y}h${pw / 3}`} />
            </g>
          ) : (
            <path key={i} className="tv-plank is-gap" d={d} />
          )
        })}
        <path className="tv-planks__rope" d={`M4 ${BASE_Y + 12}H${width - 4}`} />
        <path className="tv-stones__flag" d={flag(geo.goal.x + 6, BASE_Y - 8)} />
      </svg>
    )
  }

  return (
    <svg className={cx('tv-stones', glow && 'is-glowing', className)} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={label}>
      <path
        className="tv-stones__trail"
        d={geo.stones
          .slice(0, -1)
          .map((s, i) => {
            const t = geo.stones[i + 1]
            return `M${n(s.x + 13)} ${n(s.y + 1)}L${n(t.x - 13)} ${n(t.y + 1)}`
          })
          .join('')}
      />
      {geo.stones.map((s, i) => {
        const isDone = i < passed
        const isCurrent = i === passed
        const rx = isCurrent ? 15 : 13
        const ry = isCurrent ? 11 : 9.5
        return (
          <g key={i} className={cx('tv-stone', isDone && 'is-done', isCurrent && 'is-current')}>
            <path className="tv-stone__shadow" d={ellipse(s.x + 1, s.y + ry * 0.75, rx * 0.95, ry * 0.45)} />
            <path className="tv-stone__body" d={pebble(s.x, s.y, rx, ry, i + 1)} />
            <path className="tv-stone__hi" d={ellipse(s.x - rx * 0.35, s.y - ry * 0.45, rx * 0.32, ry * 0.2)} />
            {isDone && <path className="tv-stone__paw" d={paw(s.x, s.y + 0.5, 0.95)} />}
          </g>
        )
      })}
      <g className={cx('tv-stones__goal', passed >= count && 'is-reached')}>
        <path className="tv-stone__shadow" d={ellipse(geo.goal.x + 7, geo.goal.y + 8, 13, 4.5)} />
        <path className="tv-stone__body tv-stone__body--goal" d={pebble(geo.goal.x + 6, geo.goal.y, 14, 10, 97)} />
        <path className="tv-stones__flag" d={flag(geo.goal.x + 6, geo.goal.y - 2)} />
      </g>
      {!marker && passed < count && <path className="tv-stones__ring" d={circle(current.x, current.y, 19)} />}
      {marker && (
        <g className="tv-stones__marker" style={{ transform: `translate(${n(current.x)}px, ${n(current.y - 8)}px)` }}>
          {marker}
        </g>
      )}
    </svg>
  )
}
