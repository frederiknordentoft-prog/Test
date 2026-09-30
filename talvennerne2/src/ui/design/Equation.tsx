// Renders a prompt equation (Term[] from src/engine/types.ts) in the task type: 56/72 px, weight 900,
// tabular digits. Operators use the house notation (· : −); a blank is a dashed answer slot that can
// show what the child has typed.
import type { ReactNode } from 'react'
import type { Op, Term } from '../../engine/types'
import { useSpeech } from './speech'
import { cx } from './cx'

const OP_GLYPH: Record<Op, string> = { '+': '+', '−': '−', '·': '·', ':': ':', '=': '=', '<': '<', '>': '>' }

export interface EquationProps {
  terms: Term[]
  /** What the child has entered in the (first) blank; shows "?" when empty. */
  entry?: ReactNode
  /** Visual state of the blank slot. */
  slot?: 'empty' | 'active' | 'good' | 'oops'
  size?: 'task' | 'answer'
  className?: string
}

/** Minus in numbers is always U+2212, never a hyphen. */
export const formatNumber = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n))

export function Equation({ terms, entry, slot = 'empty', size = 'task', className }: EquationProps) {
  const speech = useSpeech()
  let blankSeen = false
  return (
    <span className={cx('tv-eq', `tv-eq--${size}`, className)} role="math">
      {terms.map((t, i) => {
        if ('n' in t) return <span key={i} className="tv-eq__n">{formatNumber(t.n)}</span>
        if ('op' in t) return <span key={i} className={cx('tv-eq__op', t.op === '·' && 'tv-eq__op--dot')}>{OP_GLYPH[t.op]}</span>
        if ('blank' in t) {
          const first = !blankSeen
          blankSeen = true
          const shown = first && entry !== undefined && entry !== null && entry !== ''
          return (
            <span key={i} className={cx('tv-eq__blank', `is-${first ? slot : 'empty'}`, shown && 'has-entry')}>
              {shown ? entry : '?'}
            </span>
          )
        }
        return <span key={i} className="tv-eq__text">{speech.text(t.text)}</span>
      })}
    </span>
  )
}
