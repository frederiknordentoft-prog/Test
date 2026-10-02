// Column arithmetic for the strategy pictures (HintVisual 'columns' and the forgotCarry and
// smallerFromLarger films): hundreds, tens and ones under little block pictures instead of letters,
// the carried ten above its column, a borrowed ten shown as the tens digit going down by one and
// the ones getting ten more. Every step can wait for its turn (delays in ms); calm motion shows
// the finished sum at once.
import type { CSSProperties, ReactNode } from 'react'
import { Base10Block } from '../../art/materials'
import { cx } from '../design/cx'

export interface ColumnsProps {
  a: number
  b: number
  op: '+' | '−'
  /** Show the carry (plus) or the borrow (minus). */
  regroup?: boolean
  /** Animate the steps: ones, then the carried or borrowed ten, then tens (and hundreds). */
  film?: boolean
  /** borrowNoDecrement: the digit a ten was lent from is the point, so it pulses once it is down by one. */
  stressLent?: boolean
  className?: string
}

const digitsOf = (n: number, places: number) =>
  Array.from({ length: places }, (_, i) => Math.floor(n / 10 ** (places - 1 - i)) % 10)

function At({ ms, film, children, className, style }: { ms: number; film: boolean; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx(className, film && 'tv-step')} style={film ? { ...style, animationDelay: `${ms}ms` } : style}>
      {children}
    </span>
  )
}

export function Columns({ a, b, op, regroup = false, film = false, stressLent = false, className }: ColumnsProps) {
  const result = op === '+' ? a + b : a - b
  const places = Math.max(String(a).length, String(b).length, String(Math.abs(result)).length, 2)
  const A = digitsOf(a, places)
  const B = digitsOf(b, places)
  const R = digitsOf(Math.abs(result), places)
  // per column (left to right): carry into it (plus) or the digit after lending (minus)
  const carries: (number | null)[] = Array.from({ length: places }, () => null)
  const lent: (number | null)[] = Array.from({ length: places }, () => null)
  const borrowed: boolean[] = Array.from({ length: places }, () => false)
  if (op === '+') {
    let c = 0
    for (let i = places - 1; i >= 0; i--) {
      if (c > 0) carries[i] = c
      c = A[i] + B[i] + c >= 10 ? 1 : 0
    }
  } else {
    const top = [...A]
    for (let i = places - 1; i > 0; i--) {
      if (top[i] < B[i]) {
        top[i] += 10
        top[i - 1] -= 1
        borrowed[i] = true
        lent[i - 1] = top[i - 1]
      }
    }
  }
  // the step at which each column's result appears (ones first)
  const T0 = 500
  const STEP = 1100
  const at = (i: number) => T0 + (places - 1 - i) * STEP
  const leading = (row: number[], i: number) => i < places - 1 && row.slice(0, i + 1).every((d) => d === 0)
  const icon = (i: number) => (places - 1 - i === 0 ? 'unit' : places - 1 - i === 1 ? 'rod' : 'flat')

  return (
    <div className={cx('tv-cols', className)} style={{ ['--places' as string]: places }} role="img">
      <span className="tv-cols__op" aria-hidden />
      {A.map((_, i) => (
        <span key={`h${i}`} className={cx('tv-cols__head', `is-${icon(i)}`)}>
          <Base10Block kind={icon(i)} unit={icon(i) === 'unit' ? 13 : icon(i) === 'rod' ? 2.6 : 1.5} />
        </span>
      ))}

      <span className="tv-cols__op" aria-hidden />
      {A.map((_, i) => (
        <span key={`c${i}`} className="tv-cols__carry">
          {regroup && op === '+' && carries[i] !== null && (
            <At ms={at(i + 1) + 500} film={film} className="tv-cols__carried">
              {carries[i]}
            </At>
          )}
          {regroup && op === '−' && lent[i] !== null && (
            <At ms={at(i + 1) - 300} film={film} className={cx('tv-cols__lent', stressLent && 'is-stress')}>
              {stressLent ? (
                // after it has come down by one, it pulses twice (transform only)
                <span className={cx('tv-cols__pulse', film && 'is-film')} style={film ? { animationDelay: `${at(i + 1) + 200}ms` } : undefined}>
                  {lent[i]}
                </span>
              ) : (
                lent[i]
              )}
            </At>
          )}
          {regroup && op === '−' && borrowed[i] && (
            <At ms={at(i) - 300} film={film} className="tv-cols__plus10">
              {A[i] + 10}
            </At>
          )}
        </span>
      ))}

      <span className="tv-cols__op" aria-hidden />
      {A.map((d, i) => (
        <span key={`a${i}`} className={cx('tv-cols__d', regroup && op === '−' && (lent[i] !== null || borrowed[i]) && 'is-changed', regroup && op === '−' && (lent[i] !== null || borrowed[i]) && film && 'is-film')} style={film ? { ['--at' as string]: `${at(i) - 300}ms` } : undefined}>
          {leading(A, i) ? '' : d}
        </span>
      ))}

      <span className="tv-cols__op">{op}</span>
      {B.map((d, i) => (
        <span key={`b${i}`} className="tv-cols__d">
          {leading(B, i) ? '' : d}
        </span>
      ))}

      <span className="tv-cols__rule" aria-hidden />

      <span className="tv-cols__op" aria-hidden />
      {R.map((d, i) => (
        <At key={`r${i}`} ms={at(i)} film={film} className="tv-cols__d tv-cols__res">
          {leading(R, i) ? '' : d}
        </At>
      ))}
    </div>
  )
}
