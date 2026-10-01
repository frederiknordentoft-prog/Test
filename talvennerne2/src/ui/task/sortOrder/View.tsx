// sortOrder (SPEC §3.2): 3–5 cards. Tapped in order, each card hops to the next free place on the
// shelf; a tap on a placed card sends it back. When every card is placed, the tick hands the order in.
import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AnswerValue } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { Icon } from '../../design/Icon'
import { usePress } from '../../design/usePress'
import { cx } from '../../design/cx'
import { orderValue, splitTokens } from '../answers'
import { CheckButton } from '../CheckButton'
import { OptionFace } from '../faces'
import { hop } from '../motion'
import type { FaceProps, TaskViewProps } from '../types'

export function SortOrderView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const n = task.options.length
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

  // after an answer the shelf shows what was handed in
  const shelf: (number | null)[] = Array.from({ length: n }, (_, k) => placed[k] ?? null)
  const givenOrder = mode !== 'input' && given !== null ? splitTokens(given) : null
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'
  return (
    <div ref={root} className={cx('tv-sort', `tv-sort--n${n}`, `is-${mode}`)} data-kind="sortOrder">
      <div className={cx('tv-sort__shelf', `is-${state}`)}>
        {shelf.map((i, k) => {
          const value: AnswerValue | null = givenOrder ? (givenOrder[k] ?? null) : i !== null ? task.options[i] : null
          return (
            <div key={k} className={cx('tv-sort__place', value !== null && 'is-full')} data-place={k}>
              {value !== null && (
                <SortCard
                  disabled={!input}
                  state={state}
                  onPress={(el) => i !== null && unplace(i, el)}
                  data-shelf-card={i ?? undefined}
                >
                  <OptionFace task={task} value={value} size="sm" className="tv-sort__face" />
                </SortCard>
              )}
            </div>
          )
        })}
        {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
      </div>
      <div className="tv-sort__arrow" aria-hidden>
        <Icon name="next" size={22} strokeWidth={2.6} />
      </div>
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
