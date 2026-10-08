// What a card asks, on the card (QA3b P3, P4): questions whose key words were only in the voice show
// them beside their picture as well, read off the task's own question (task.speech), so the card and
// the voice always agree.
//   A heap whose question names a fraction ("Hvor mange er tre fjerdedele af tolv gulerødder?",
//   fractionOfSet on cards or keys) shows it over the heap: "¾ af 12".
//   A coordinate net asked on cards (gridCoords) shows which way is asked, along (→ ?) or up (↑ ?),
//   and the point the question names ("Du skal sætte punktet seks, en …"): "(6, 1)". The pair is
//   plain ink without the grid kind's arrows and colours, so it does not say which number is up.
import type { ReactNode } from 'react'
import type { SpeechPart, Task } from '../../engine/types'
import { SpokenText } from '../design/SpokenText'
import { cx } from '../design/cx'
import { formatNumber } from '../task/answers'
import { FracText } from '../task/faces'
import './askLines.css'

type Asked = Pick<Task, 'prompt' | 'speech' | 'kind'>

const clipsOf = (speech: readonly SpeechPart[]) => speech.flatMap((p) => ('clip' in p ? [p.clip] : []))

/** The fraction of the heap the question asks for, and the heap's size; null for any other card. */
export function heapFraction(task: Asked | undefined): { n: number; d: number; total: number } | null {
  if (!task || task.prompt.scene !== 'objects') return null
  const frac = task.speech.find((p): p is Extract<SpeechPart, { frac: unknown }> => 'frac' in p)
  if (frac) return { n: frac.frac.n, d: frac.frac.d, total: task.prompt.n }
  return clipsOf(task.speech).includes('frag.halvdelen_af') ? { n: 1, d: 2, total: task.prompt.n } : null
}

const ALONG = ['s.gridCoords.readAlong', 's.gridCoords.howFarAlong']
const UP = ['s.gridCoords.readUp', 's.gridCoords.howFarUp']

/** A number asked of a coordinate net on cards: the axis ('x' along, 'y' up) and the point named. */
export function coordAsk(task: Asked | undefined): { axis: 'x' | 'y'; named: [number, number] | null } | null {
  if (!task || task.kind !== 'choice' || task.prompt.scene !== 'grid' || !task.prompt.coords) return null
  const clips = clipsOf(task.speech)
  const axis = clips.some((c) => ALONG.includes(c)) ? 'x' : clips.some((c) => UP.includes(c)) ? 'y' : null
  if (!axis) return null
  // "Du skal sætte punktet tre, to": the two numbers after the clip are the point
  const at = task.speech.findIndex((p) => 'clip' in p && p.clip === 's.gridCoords.toPlace')
  const nums = at < 0 ? [] : task.speech.slice(at + 1, at + 3).flatMap((p) => ('num' in p ? [p.num] : []))
  return { axis, named: nums.length === 2 ? [nums[0], nums[1]] : null }
}

/** The heap with its fraction over it: "¾ af 12". */
export function HeapFraction({ task, children }: { task: Asked | undefined; children: ReactNode }) {
  const f = heapFraction(task)
  if (!f) return children
  return (
    <span className="tv-ask tv-ask--heap" data-ask="heap">
      <span className="tv-ask__line">
        <FracText n={f.n} d={f.d} />
        <SpokenText clip="s.fractionOfSet.of" silent className="tv-ask__word" />
        <span className="tv-ask__num">{formatNumber(f.total)}</span>
      </span>
      {children}
    </span>
  )
}

/** The net with the way asked under it (and the point the question names). */
export function CoordAsk({ task, children }: { task: Asked | undefined; children: ReactNode }) {
  const a = coordAsk(task)
  if (!a) return children
  return (
    <span className="tv-ask tv-ask--coord" data-ask={a.axis}>
      {children}
      <span className="tv-ask__line">
        {a.named && (
          <span className="tv-ask__pair" data-named={a.named.join(',')}>
            {`(${formatNumber(a.named[0])}, ${formatNumber(a.named[1])})`}
          </span>
        )}
        <span className={cx('tv-ask__way', `is-${a.axis}`)}>
          <svg className="tv-ask__arrow" viewBox="0 0 24 24" aria-hidden>
            <path d={a.axis === 'x' ? 'M3 12h16m-6-6 6 6-6 6' : 'M12 21V5m-6 6 6-6 6 6'} />
          </svg>
          <span className="tv-ask__blank">{'?'}</span>
        </span>
      </span>
    </span>
  )
}
