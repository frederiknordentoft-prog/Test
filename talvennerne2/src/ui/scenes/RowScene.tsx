// Prompt 'row' (order20, skipCount, patterns): stepping stones along a path. A gap is a dashed stone
// that shows what the child types; with `step` a small hop arc stands between the stones (+2, +10).
import type { ReactNode } from 'react'
import type { Prompt } from '../../engine/types'
import { cx } from '../design/cx'
import { formatNumber } from '../task/answers'
import { PatternToken } from '../task/faces'

type Row = Extract<Prompt, { scene: 'row' }>

function cellFace(c: number | string): ReactNode {
  if (typeof c === 'number') return <span className="tv-row__num">{formatNumber(c)}</span>
  if (c.startsWith('pat:')) return <PatternToken token={c.slice(4)} px={56} />
  return <span className="tv-row__num tv-row__num--small">{c}</span>
}

const shown = (e: ReactNode | undefined): e is ReactNode => e !== undefined && e !== null && e !== ''

/**
 * `entry` goes in the first gap (a typed or tapped answer); `entries` fills the gaps one by one (an
 * order or a pattern handed in: each part in its own stone, never all of them in the first).
 */
export function RowScene({ prompt, entry, entries, slot = 'empty' }: { prompt: Row; entry?: ReactNode; entries?: readonly ReactNode[]; slot?: 'empty' | 'active' | 'good' | 'oops' }) {
  let gapIndex = -1
  const many = prompt.cells.length > 6
  return (
    <div className={cx('tv-row', many && 'tv-row--many')} role="img" style={{ ['--row-n' as string]: prompt.cells.length }}>
      {prompt.cells.map((c, i) => {
        const gap = c === null
        if (gap) gapIndex += 1
        const fill = !gap ? undefined : entries ? entries[gapIndex] : gapIndex === 0 ? entry : undefined
        const mine = gap && (entries ? shown(fill) : gapIndex === 0)
        return (
          <span key={i} className="tv-row__step">
            {i > 0 && prompt.step ? <span className="tv-row__hop" aria-hidden>{`+${prompt.step}`}</span> : null}
            <span className={cx('tv-row__stone', gap && 'is-gap', mine && `is-${slot}`)}>
              {gap ? shown(fill) ? fill : <span className="tv-row__q">?</span> : cellFace(c)}
            </span>
          </span>
        )
      })}
    </div>
  )
}
