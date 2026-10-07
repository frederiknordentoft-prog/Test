// sortOrder (SPEC §3.2): 3–5 cards. Tapped in order, each card hops to the next free place on the
// shelf; a tap on a placed card sends it back. When every card is placed, the tick hands the order in.
//
// When the question is a row of stepping stones ("Tæl videre fra 8": 8 ? ? ? ?), the view draws that
// row itself and the stones with a "?" are the shelf (review r1 P2-6): the row is shown once, on one
// line in every format, and the given numbers stand where the cards go. An answer stays in its
// places afterwards, card by card — struck through when it was wrong.
import { useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type { AnswerValue, Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { Icon } from '../../design/Icon'
import { SpokenText } from '../../design/SpokenText'
import { usePress } from '../../design/usePress'
import { cx } from '../../design/cx'
import { orderValue, splitTokens } from '../answers'
import { CheckButton } from '../CheckButton'
import { OptionFace } from '../faces'
import { hop } from '../motion'
import type { FaceProps, TaskViewProps } from '../types'

/** The row of stones the cards go into: the prompt's own row when it has a gap for every card. */
export function shelfCells(task: Task): (AnswerValue | null)[] {
  const p = task.prompt
  if (p.scene === 'row' && sortOrderOwnsPrompt(task)) return [...p.cells]
  return Array.from({ length: task.options.length }, () => null)
}

/**
 * Which way fractions are put in order (QA3a P2-3): their row of empty places has a step, down (< 0,
 * the biggest first) or up (the smallest first), and the view writes "Størst" and "Mindst" at its
 * ends. 0: no direction is drawn — numbers in order (every sortOrder of 0.–2. klasse) keep their
 * plain arrow, also a count on in tens whose row only has places.
 */
export function shelfDirection(task: Task): -1 | 0 | 1 {
  const p = task.prompt
  if (task.optionView !== 'fraction' || p.scene !== 'row' || !p.step || !sortOrderOwnsPrompt(task) || p.cells.some((c) => c !== null)) return 0
  return p.step < 0 ? -1 : 1
}

/** The view draws a stepping-stone row itself, so the round leaves the prompt card out. */
export function sortOrderOwnsPrompt(task: Task): boolean {
  return task.prompt.scene === 'row' && task.prompt.cells.filter((c) => c === null).length === task.options.length
}

export function SortOrderView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const n = task.options.length
  const cells = shelfCells(task)
  const direction = shelfDirection(task)
  const fixed = cells.filter((c) => c !== null).length
  // placed[k] is the index of the option on shelf place k
  const [placed, setPlaced] = useState<number[]>([])
  const root = useRef<HTMLDivElement>(null)
  const flight = useRef<{ sel: string; from: DOMRect } | null>(null)
  const input = mode === 'input'

  useLayoutEffect(() => {
    const f = flight.current
    flight.current = null
    const el = f && root.current?.querySelector<HTMLElement>(f.sel)
    if (f && el) hop(el, f.from, el.getBoundingClientRect())
  }, [placed])

  const place = (i: number, from: Element) => {
    if (!input || placed.includes(i) || placed.length >= n) return
    onActivity()
    playSfx('flyv')
    flight.current = { sel: `[data-shelf-card="${i}"]`, from: from.getBoundingClientRect() }
    setPlaced((p) => [...p, i])
  }
  const unplace = (i: number, from: Element) => {
    if (!input) return
    onActivity()
    playSfx('fjern')
    flight.current = { sel: `[data-pool-card="${i}"]`, from: from.getBoundingClientRect() }
    setPlaced((p) => p.filter((x) => x !== i))
  }

  // after an answer the shelf shows what was handed in, card by card
  const givenOrder = mode !== 'input' && given !== null ? splitTokens(given) : null
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'
  // given stones are narrower than the places, so a whole row fits one line on a phone, but never
  // narrower than their number: a three-digit start stone shows all of 641 (UI-fund 4)
  const columns = cells.map((c) => (c === null ? 'minmax(0, 1fr)' : 'minmax(min-content, 0.5fr)')).join(' ')
  let k = -1
  return (
    <div
      ref={root}
      className={cx('tv-sort', `tv-sort--n${n}`, fixed > 0 && 'tv-sort--row', `is-${mode}`)}
      style={{ '--cells': cells.length } as CSSProperties}
      data-kind="sortOrder"
    >
      <div className={cx('tv-sort__shelf', `is-${state}`)} style={{ gridTemplateColumns: columns }} role="img">
        {cells.map((c, j) => {
          if (c !== null) {
            return (
              <div key={j} className="tv-sort__given" data-given-stone={String(c)}>
                <OptionFace task={task} value={c} size="sm" className="tv-sort__face" />
              </div>
            )
          }
          k += 1
          const i = placed[k] ?? null
          const value: AnswerValue | null = givenOrder ? (givenOrder[k] ?? null) : i !== null ? task.options[i] : null
          return (
            <div key={j} className={cx('tv-sort__place', value !== null && 'is-full')} data-place={k}>
              {value !== null ? (
                <SortCard
                  disabled={!input}
                  state={state}
                  onPress={(el) => i !== null && unplace(i, el)}
                  data-shelf-card={i ?? undefined}
                >
                  <OptionFace task={task} value={value} size="sm" className="tv-sort__face" />
                </SortCard>
              ) : (
                <span className="tv-sort__q" aria-hidden>
                  ?
                </span>
              )}
              {mode === 'wrong' && value !== null && <span className="tv-strike" aria-hidden />}
            </div>
          )
        })}
      </div>
      {direction === 0 ? (
        <div className="tv-sort__arrow" aria-hidden>
          <Icon name="next" size={22} strokeWidth={2.6} />
        </div>
      ) : (
        <ShelfEnds down={direction < 0} />
      )}
      <div className="tv-sort__pool">
        {task.options.map((o, i) => (
          <div key={String(o)} className="tv-sort__spot">
            {!placed.includes(i) && !givenOrder && (
              <SortCard disabled={!input} state="idle" onPress={(el) => place(i, el)} data-pool-card={i} data-option={String(o)}>
                <OptionFace task={task} value={o} size="sm" className="tv-sort__face" />
              </SortCard>
            )}
          </div>
        ))}
      </div>
      <div className="tv-sort__foot">
        <CheckButton
          valid={placed.length === n}
          stateKey={placed.join(',')}
          enabled={input}
          taskId={task.id}
          onCheck={() => onSubmit(orderValue(placed.map((i) => task.options[i])))}
        />
      </div>
    </div>
  )
}

const ENDS: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '0 6px', boxSizing: 'border-box', color: 'var(--color-ink-2)' }
const END: CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, fontSize: 17, fontWeight: 900, whiteSpace: 'nowrap' }
const LINE: CSSProperties = { flex: 1, display: 'flex', justifyContent: 'center', height: 3, alignItems: 'center', background: 'var(--color-line-2)', borderRadius: 2, color: 'var(--color-ink-3)' }

/** A bar as big as the fraction at that end: long beside "Størst", short beside "Mindst". */
const bar = (big: boolean): CSSProperties => ({
  display: 'block', width: big ? 26 : 8, height: 12, borderRadius: 3, background: 'var(--color-primary)', opacity: big ? 1 : 0.75,
})

/** "Størst ——→ Mindst" (or the other way) under the places, from the first place to the last. */
function ShelfEnds({ down }: { down: boolean }) {
  const end = (big: boolean) => (
    <span style={END} data-sort-end={big ? 'biggest' : 'smallest'}>
      <span style={bar(big)} aria-hidden />
      <SpokenText clip={big ? 's.kind.sortOrder.biggest' : 's.kind.sortOrder.smallest'} silent />
    </span>
  )
  return (
    <div className="tv-sort__ends" style={ENDS} data-sort-dir={down ? 'down' : 'up'}>
      {end(down)}
      <span style={LINE} aria-hidden>
        <span style={{ display: 'grid', placeItems: 'center', padding: '0 4px', background: 'var(--color-paper)', borderRadius: 999 }}>
          <Icon name="next" size={20} strokeWidth={2.6} />
        </span>
      </span>
      {end(!down)}
    </div>
  )
}

function SortCard({
  disabled, state, onPress, children, ...data
}: { disabled: boolean; state: 'idle' | 'good' | 'oops'; onPress(el: Element): void; children: ReactNode } & Record<`data-${string}`, string | number | undefined>) {
  const { pressProps } = usePress(disabled)
  return (
    <button
      type="button"
      className={cx('tv-sortcard tv-touch', `is-${state}`)}
      disabled={disabled}
      onClick={(e) => onPress(e.currentTarget)}
      {...pressProps}
      {...data}
    >
      <span className="tv-sortcard__face">{children}</span>
    </button>
  )
}

/** The cards in a row, small (the struck order, the confirm button). */
export function SortOrderFace({ task, value, size }: FaceProps) {
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-face__row tv-face__row--cards')}>
      {splitTokens(value).map((v, i) => (
        <span key={i} className="tv-minicard">
          <OptionFace task={task} value={v} size="sm" />
        </span>
      ))}
    </span>
  )
}
