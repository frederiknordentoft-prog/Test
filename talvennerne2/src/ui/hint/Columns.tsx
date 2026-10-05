// Column arithmetic for the strategy pictures (HintVisual 'columns' and the forgotCarry and
// smallerFromLarger films): hundreds, tens and ones under little block pictures instead of letters,
// the carried ten above its column, a borrowed ten shown as the digit it was taken from going down by
// one and the column that needed it getting ten more. Every step can wait for its turn (delays in ms);
// calm motion shows the finished sum at once.
//
// Exchanging is planned the way a child does it, right to left (regroupPlan): a column that lends goes
// down by one, the column that borrows gets ten more, and both are written above the columns. Two
// exchanges in a row (512 − 278) write the tens twice — 0 after lending to the ones, then 10 when they
// borrow from the hundreds — and an exchange across a zero (403 − 158) takes a hundred to ten tens first
// and then a ten to the ones, so the zero is written 10 and then 9. A digit that is written over again is
// struck when the next one comes. A column with one exchange is drawn exactly as it always was.
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

/** A digit written above a column: the column lent a ten ('lent', one less) or got one ('got', ten more). */
export interface ColumnMark {
  value: number
  kind: 'lent' | 'got'
  /** When it appears in the film (ms). */
  ms: number
}

export interface ColumnPlan {
  places: number
  /** Digits per column, left to right (a, b and the result). */
  A: number[]
  B: number[]
  R: number[]
  /** Plus: the ten carried into each column, or null. */
  carries: (number | null)[]
  /** Minus: the digits written above each column in the order they come; the last is the one it works with. */
  marks: ColumnMark[][]
  /** When each column's result digit appears (ms). */
  resultAt: number[]
}

/** The first result, the ones, appears after T0; each column to the left STEP later (ms). */
const T0 = 500
const STEP = 1100
/** The extra time an exchange across a zero takes per zero it crosses (a hundred to tens, then a ten to ones). */
const CHAIN = 700
/** Exchanges are written this long before the result of the column that needed them. */
const LEAD = 300
/** borrowNoDecrement: the lent digit pulses this long after it is written. */
const PULSE = 500
/** A carried ten lands this long after the result of the column it comes from. */
const CARRY = 500

const digitsOf = (n: number, places: number) =>
  Array.from({ length: places }, (_, i) => Math.floor(n / 10 ** (places - 1 - i)) % 10)

/**
 * The columns of a ± b and what is written above them, with the film's timing. Exchanges go right to
 * left: a column whose digit is too small borrows from the nearest column to its left that has
 * something, and every zero in between first gets ten (from the left) and then lends one (to the right).
 */
export function regroupPlan(a: number, b: number, op: '+' | '−'): ColumnPlan {
  const result = op === '+' ? a + b : a - b
  const places = Math.max(String(a).length, String(b).length, String(Math.abs(result)).length, 2)
  const A = digitsOf(a, places)
  const B = digitsOf(b, places)
  const R = digitsOf(Math.abs(result), places)
  const carries: (number | null)[] = Array.from({ length: places }, () => null)
  const marks: ColumnMark[][] = Array.from({ length: places }, () => [])
  const resultAt: number[] = Array.from({ length: places }, () => 0)
  if (op === '+') {
    let c = 0
    for (let i = places - 1; i >= 0; i--) {
      if (c > 0) carries[i] = c
      c = A[i] + B[i] + c >= 10 ? 1 : 0
      resultAt[i] = T0 + (places - 1 - i) * STEP
    }
    return { places, A, B, R, carries, marks, resultAt }
  }
  const top = [...A]
  let time = T0
  for (let i = places - 1; i >= 0; i--) {
    if (i > 0 && top[i] < B[i]) {
      let lender = i - 1
      while (lender > 0 && top[lender] === 0) lender--
      if (top[lender] > 0) {
        // one step per column on the way: the lender gives ten to the next column, which gives one on …
        const zeros = i - 1 - lender
        time += zeros * CHAIN
        const start = time - LEAD - zeros * CHAIN
        for (let s = 0; s <= zeros; s++) {
          const from = lender + s
          top[from] -= 1
          marks[from].push({ value: top[from], kind: 'lent', ms: start + s * CHAIN })
          top[from + 1] += 10
          marks[from + 1].push({ value: top[from + 1], kind: 'got', ms: start + s * CHAIN })
        }
      }
    }
    resultAt[i] = time
    time += STEP
  }
  return { places, A, B, R, carries, marks, resultAt }
}

function At({ ms, film, children, className, style }: { ms: number; film: boolean; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx(className, film && 'tv-step')} style={film ? { ...style, animationDelay: `${ms}ms` } : style}>
      {children}
    </span>
  )
}

/** The digit after lending, pulsing for borrowNoDecrement once it is down by one (transform only). */
function Lent({ mark, film, stressLent }: { mark: ColumnMark; film: boolean; stressLent: boolean }) {
  if (!stressLent) return <>{mark.value}</>
  return (
    <span className={cx('tv-cols__pulse', film && 'is-film')} style={film ? { animationDelay: `${mark.ms + PULSE}ms` } : undefined}>
      {mark.value}
    </span>
  )
}

/** One exchange above a column, drawn as it always was. */
function Mark({ mark, film, stressLent }: { mark: ColumnMark; film: boolean; stressLent: boolean }) {
  if (mark.kind === 'got') {
    return (
      <At ms={mark.ms} film={film} className="tv-cols__plus10">
        {mark.value}
      </At>
    )
  }
  return (
    <At ms={mark.ms} film={film} className={cx('tv-cols__lent', stressLent && 'is-stress')}>
      <Lent mark={mark} film={film} stressLent={stressLent} />
    </At>
  )
}

/** A column written over (0 then 10, or 10 then 9): side by side, the earlier digit struck when the next comes. */
function Marks({ marks, film, stressLent }: { marks: ColumnMark[]; film: boolean; stressLent: boolean }) {
  return (
    <span className="tv-cols__marks">
      {marks.map((m, k) => {
        const next = marks[k + 1]
        return (
          <At
            key={k}
            ms={m.ms}
            film={film}
            className={cx(m.kind === 'lent' ? 'tv-cols__lent' : 'tv-cols__plus10', next && 'is-replaced', next && film && 'is-film')}
            style={next && film ? ({ ['--gone' as string]: `${next.ms}ms` } as CSSProperties) : undefined}
          >
            {m.kind === 'lent' ? <Lent mark={m} film={film} stressLent={stressLent} /> : m.value}
          </At>
        )
      })}
    </span>
  )
}

export function Columns({ a, b, op, regroup = false, film = false, stressLent = false, className }: ColumnsProps) {
  const { places, A, B, R, carries, marks, resultAt } = regroupPlan(a, b, op)
  const leading = (row: number[], i: number) => i < places - 1 && row.slice(0, i + 1).every((d) => d === 0)
  const icon = (i: number) => (places - 1 - i === 0 ? 'unit' : places - 1 - i === 1 ? 'rod' : 'flat')
  const changed = (i: number) => regroup && op === '−' && marks[i].length > 0

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
            <At ms={resultAt[i + 1] + CARRY} film={film} className="tv-cols__carried">
              {carries[i]}
            </At>
          )}
          {changed(i) && marks[i].length === 1 && <Mark mark={marks[i][0]} film={film} stressLent={stressLent} />}
          {changed(i) && marks[i].length > 1 && <Marks marks={marks[i]} film={film} stressLent={stressLent} />}
        </span>
      ))}

      <span className="tv-cols__op" aria-hidden />
      {A.map((d, i) => (
        <span
          key={`a${i}`}
          className={cx('tv-cols__d', changed(i) && 'is-changed', changed(i) && film && 'is-film')}
          style={film ? { ['--at' as string]: `${resultAt[i] - LEAD}ms` } : undefined}
        >
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
        <At key={`r${i}`} ms={resultAt[i]} film={film} className="tv-cols__d tv-cols__res">
          {leading(R, i) ? '' : d}
        </At>
      ))}
    </div>
  )
}
