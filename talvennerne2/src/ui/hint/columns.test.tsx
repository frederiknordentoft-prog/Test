// The column picture and its films (HintVisual 'columns', the forgotCarry, smallerFromLarger and
// borrowNoDecrement films): exchanging across a zero (403 − 158) and two exchanges in a row (512 − 278)
// are written as a child writes them, and every picture with one exchange per column — all of sub100's
// two-digit films — is exactly what it was before the fix, compared with a frozen copy of that component.
import type { CSSProperties, ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Base10Block } from '../../art/materials'
import { cx } from '../design/cx'
import { makeRng } from '../../engine/rng'
import { Columns, regroupPlan, type ColumnMark } from './Columns'

// ─── The component before the fix (frozen, for the comparison only) ─────────

const legacyDigits = (n: number, places: number) => Array.from({ length: places }, (_, i) => Math.floor(n / 10 ** (places - 1 - i)) % 10)

function LegacyAt({ ms, film, children, className, style }: { ms: number; film: boolean; children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <span className={cx(className, film && 'tv-step')} style={film ? { ...style, animationDelay: `${ms}ms` } : style}>
      {children}
    </span>
  )
}

function LegacyColumns({ a, b, op, regroup = false, film = false, stressLent = false }: { a: number; b: number; op: '+' | '−'; regroup?: boolean; film?: boolean; stressLent?: boolean }) {
  const result = op === '+' ? a + b : a - b
  const places = Math.max(String(a).length, String(b).length, String(Math.abs(result)).length, 2)
  const A = legacyDigits(a, places)
  const B = legacyDigits(b, places)
  const R = legacyDigits(Math.abs(result), places)
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
  const T0 = 500
  const STEP = 1100
  const at = (i: number) => T0 + (places - 1 - i) * STEP
  const leading = (row: number[], i: number) => i < places - 1 && row.slice(0, i + 1).every((d) => d === 0)
  const icon = (i: number) => (places - 1 - i === 0 ? 'unit' : places - 1 - i === 1 ? 'rod' : 'flat')
  return (
    <div className={cx('tv-cols', undefined)} style={{ ['--places' as string]: places }} role="img">
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
            <LegacyAt ms={at(i + 1) + 500} film={film} className="tv-cols__carried">
              {carries[i]}
            </LegacyAt>
          )}
          {regroup && op === '−' && lent[i] !== null && (
            <LegacyAt ms={at(i + 1) - 300} film={film} className={cx('tv-cols__lent', stressLent && 'is-stress')}>
              {stressLent ? (
                <span className={cx('tv-cols__pulse', film && 'is-film')} style={film ? { animationDelay: `${at(i + 1) + 200}ms` } : undefined}>
                  {lent[i]}
                </span>
              ) : (
                lent[i]
              )}
            </LegacyAt>
          )}
          {regroup && op === '−' && borrowed[i] && (
            <LegacyAt ms={at(i) - 300} film={film} className="tv-cols__plus10">
              {A[i] + 10}
            </LegacyAt>
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
        <LegacyAt key={`r${i}`} ms={at(i)} film={film} className="tv-cols__d tv-cols__res">
          {leading(R, i) ? '' : d}
        </LegacyAt>
      ))}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The sweeps render thousands of pictures; the container shares its CPU with the voice generation. */
const SLOW = 120_000

/** The three pictures the round shows: the still columns, the borrow (or carry) film, and the borrowNoDecrement film. */
const VARIANTS = [
  { regroup: true },
  { regroup: true, film: true },
  { regroup: true, film: true, stressLent: true },
  { regroup: false },
] as const

const html = (a: number, b: number, op: '+' | '−', v: (typeof VARIANTS)[number]) => renderToStaticMarkup(<Columns a={a} b={b} op={op} {...v} />)
const legacy = (a: number, b: number, op: '+' | '−', v: (typeof VARIANTS)[number]) => renderToStaticMarkup(<LegacyColumns a={a} b={b} op={op} {...v} />)

/** What is written above each column, as "value(kind)" lists. */
const written = (a: number, b: number) => regroupPlan(a, b, '−').marks.map((ms) => ms.map((m: ColumnMark) => `${m.value}${m.kind === 'lent' ? '↓' : '↑'}`))

/** The carry row's text per column, from the markup. */
function carryRow(markup: string): string[] {
  const cells = [...markup.matchAll(/<span class="tv-cols__carry"(?: style="[^"]*")?>(.*?)<\/span>(?=<span class="tv-cols__(?:carry|op)")/g)].map((m) => m[1])
  return cells.map((c) => [...c.matchAll(/>(-?\d+)</g)].map((m) => m[1]).join(' '))
}

/** Is a − b exchanged at most once per column, never across a zero? (Then the old picture was right.) */
function simple(a: number, b: number): boolean {
  return regroupPlan(a, b, '−').marks.every((m) => m.length <= 1) && written(a, b).flat().every((w) => !w.startsWith('-'))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('exchanging in the column picture', () => {
  it('exchanges across a zero: 403 − 158 writes the hundreds 3, the tens 10 and then 9, the ones 13', () => {
    expect(written(403, 158)).toEqual([['3↓'], ['10↑', '9↓'], ['13↑']])
    const plan = regroupPlan(403, 158, '−')
    // a hundred to ten tens first, then a ten to the ones: two steps before the ones' result
    expect(plan.marks[1].map((m) => m.ms)).toEqual([200, 900])
    expect(plan.marks[2][0].ms).toBe(900)
    expect(plan.resultAt).toEqual([3400, 2300, 1200])
    for (const v of VARIANTS.slice(0, 3)) {
      const row = carryRow(html(403, 158, '−', v))
      expect(row, JSON.stringify(v)).toEqual(['3', '10 9', '13'])
    }
  })

  it('exchanges twice in a row: 512 − 278 writes the tens 0 and then 10, never 11', () => {
    expect(written(512, 278)).toEqual([['4↓'], ['0↓', '10↑'], ['12↑']])
    expect(regroupPlan(512, 278, '−').marks[1].map((m) => m.ms)).toEqual([200, 1300])
    for (const v of VARIANTS.slice(0, 3)) expect(carryRow(html(512, 278, '−', v)), JSON.stringify(v)).toEqual(['4', '0 10', '12'])
  })

  it('also crosses two zeros (1000 − 7) and a zero after a whole hundred (500 − 36)', () => {
    expect(written(1000, 7)).toEqual([['0↓'], ['10↑', '9↓'], ['10↑', '9↓'], ['10↑']])
    expect(written(500, 36)).toEqual([['4↓'], ['10↑', '9↓'], ['10↑']])
    // sub100Borrow's 100 − 37 crossed the zero too, and was drawn with "-1" before the fix
    expect(written(100, 37)).toEqual([['0↓'], ['10↑', '9↓'], ['10↑']])
    expect(carryRow(legacy(100, 37, '−', VARIANTS[1]))).toEqual(['0', '-1 10', '10'])
  })

  it('strikes the digit written over when the next one comes, and stacks the over-written column (QA3a P3-4)', () => {
    const film = html(403, 158, '−', VARIANTS[1])
    // the new digit above the old one, in a taller row: "10 9" never reads as 109
    expect(film).toContain('<span class="tv-cols__marks" style="flex-direction:column-reverse;align-items:center;gap:1px;line-height:1">')
    expect(film).toContain('<span class="tv-cols__carry" style="height:42px">')
    expect(html(512, 278, '−', VARIANTS[0])).toContain('<span class="tv-cols__marks" style="flex-direction:column-reverse')
    // 100 − 37 (sub100Borrow, 2. klasse) keeps its picture, side by side
    expect(html(100, 37, '−', VARIANTS[0])).toContain('<span class="tv-cols__marks">')
    expect(html(100, 37, '−', VARIANTS[0])).not.toContain('height:42px')
    expect(film).toMatch(/class="tv-cols__plus10 is-replaced is-film tv-step" style="--gone:900ms;animation-delay:200ms">10</)
    expect(film).toMatch(/class="tv-cols__lent tv-step" style="animation-delay:900ms">9</)
    const still = html(403, 158, '−', VARIANTS[0])
    expect(still).toMatch(/class="tv-cols__plus10 is-replaced">10</)
    expect(still).not.toContain('--gone')
  })

  it('works with the digits it writes: every three-digit difference ends each column on its own result', () => {
    for (let a = 100; a <= 999; a++) {
      for (let b = 1; b <= a; b++) {
        const plan = regroupPlan(a, b, '−')
        for (let i = 0; i < plan.places; i++) {
          const top = plan.marks[i].length > 0 ? plan.marks[i][plan.marks[i].length - 1].value : plan.A[i]
          if (top - plan.B[i] !== plan.R[i] || top < 0 || top > 19) throw new Error(`${a} − ${b}: column ${i} works with ${top}`)
        }
      }
    }
  }, SLOW)

  it('never writes a negative digit or 11 over a column that lent before it borrowed', () => {
    for (const [a, b] of [[403, 158], [512, 278], [600, 245], [302, 9], [710, 85], [811, 299]]) {
      for (const v of VARIANTS.slice(0, 3)) {
        const row = carryRow(html(a, b, '−', v)).join(' | ')
        expect(row, `${a} − ${b}`).not.toMatch(/-|−/)
      }
    }
    expect(carryRow(html(512, 278, '−', VARIANTS[1]))[1]).not.toContain('11')
  })
})

describe('the films that were right stay as they were', () => {
  it('draws every two-digit difference — the live sub100 films — exactly as before, in all three pictures', () => {
    let n = 0
    for (let a = 10; a <= 99; a++) {
      for (let b = 0; b <= a; b++) {
        for (const v of VARIANTS) {
          expect(html(a, b, '−', v), `${a} − ${b} ${JSON.stringify(v)}`).toBe(legacy(a, b, '−', v))
          n++
        }
      }
    }
    expect(n).toBe(4 * 4995)
  }, SLOW)

  it('draws sums exactly as before (two- and three-digit sums drawn at random; the fix is in the exchanges only)', () => {
    const rng = makeRng(17)
    for (let k = 0; k < 1500; k++) {
      const a = k % 2 === 0 ? rng.between(10, 99) : rng.between(100, 899)
      const b = rng.between(1, a < 100 ? 99 : 999 - a)
      for (const v of VARIANTS) expect(html(a, b, '+', v), `${a} + ${b}`).toBe(legacy(a, b, '+', v))
    }
  }, SLOW)

  it('draws a three-digit difference with one exchange per column, never across a zero, exactly as before', () => {
    const rng = makeRng(23)
    let seen = 0
    for (let k = 0; k < 2000; k++) {
      const a = rng.between(100, 999)
      const b = rng.between(1, a)
      if (!simple(a, b)) continue
      seen++
      for (const v of VARIANTS) expect(html(a, b, '−', v), `${a} − ${b}`).toBe(legacy(a, b, '−', v))
    }
    expect(seen).toBeGreaterThan(500)
  }, SLOW)
})
