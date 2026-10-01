// fillSlots (SPEC §3.2): k empty places and a palette. A tap on the palette fills the next empty
// place; a tap on a filled place empties it. When the prompt is a row with gaps (a bead pattern, a
// skip-count), the gaps themselves are the places, so the row is drawn here; a fraction answer is
// set as numerator over denominator.
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { AnswerValue, Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { usePress } from '../../design/usePress'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { slotCount, slotsValue, splitTokens } from '../answers'
import { CheckButton } from '../CheckButton'
import { OptionFace } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

/** A row with gaps is the question and the answer at once. */
export const fillSlotsOwnsPrompt = (t: Task) => t.prompt.scene === 'row' && t.prompt.cells.some((c) => c === null)

const fractionSlots = (t: Task) => t.optionView === 'fraction' && slotCount(t) === 2

export function FillSlotsView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const k = slotCount(task)
  const [slots, setSlots] = useState<(AnswerValue | null)[]>(() => Array.from({ length: k }, () => null))
  const input = mode === 'input'
  const shown: (AnswerValue | null)[] = mode !== 'input' && mode !== 'idle' && given !== null ? splitTokens(given) : slots
  const next = slots.indexOf(null)
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'

  const fill = (v: AnswerValue) => {
    if (!input || next < 0) return
    onActivity()
    playSfx('snap')
    setSlots((s) => s.map((x, i) => (i === next ? v : x)))
  }
  const empty = (i: number) => {
    if (!input || slots[i] === null) return
    onActivity()
    playSfx('fjern')
    setSlots((s) => s.map((x, j) => (j === i ? null : x)))
  }

  const slot = (i: number) => (
    <Slot key={`s${i}`} value={shown[i] ?? null} task={task} active={input && i === next} state={state} disabled={!input} onPress={() => empty(i)} index={i} />
  )

  let places
  if (fillSlotsOwnsPrompt(task) && task.prompt.scene === 'row') {
    let gap = 0
    places = (
      <div className="tv-fill__row">
        {task.prompt.cells.map((c, j) =>
          c === null ? (
            slot(gap++)
          ) : (
            <span key={`c${j}`} className="tv-fill__cell">
              <OptionFace task={task} value={c} size="sm" />
            </span>
          ),
        )}
      </div>
    )
  } else if (fractionSlots(task)) {
    places = (
      <div className="tv-fill__frac">
        {slot(0)}
        <span className="tv-fill__bar" aria-hidden />
        {slot(1)}
      </div>
    )
  } else {
    places = <div className="tv-fill__row">{shown.map((_, i) => slot(i))}</div>
  }

  return (
    <div className={cx('tv-fill', `is-${mode}`)} data-kind="fillSlots">
      <div className="tv-fill__places">
        {places}
        {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
      </div>
      <div className="tv-fill__palette" role="group" aria-label={speech.text('s.kind.fillSlots.short')}>
        {task.options.map((o) => (
          <Token key={String(o)} disabled={!input || next < 0} onPress={() => fill(o)} value={String(o)}>
            <OptionFace task={task} value={o} size="sm" />
          </Token>
        ))}
        <CheckButton valid={next < 0} stateKey={slots.map(String).join(',')} enabled={input} taskId={task.id} onCheck={() => {
          const v = slotsValue(slots)
          if (v !== null) onSubmit(v)
        }} />
      </div>
    </div>
  )
}

function Slot({ value, task, active, state, disabled, onPress, index }: {
  value: AnswerValue | null; task: Task; active: boolean; state: 'idle' | 'good' | 'oops'; disabled: boolean; onPress(): void; index: number
}) {
  const { pressProps } = usePress(disabled || value === null)
  return (
    <button
      type="button"
      className={cx('tv-slot tv-touch', value === null ? 'is-empty' : 'is-full', active && 'is-next', `is-${state}`)}
      disabled={disabled || value === null}
      onClick={onPress}
      data-slot={index}
      {...pressProps}
    >
      <span className="tv-slot__face">{value === null ? <span className="tv-slot__q">?</span> : <OptionFace task={task} value={value} size="sm" />}</span>
    </button>
  )
}

function Token({ children, disabled, onPress, value }: { children: ReactNode; disabled: boolean; onPress(): void; value: string }) {
  const { pressProps } = usePress(disabled)
  return (
    <button type="button" className="tv-token tv-touch" disabled={disabled} onClick={onPress} data-option={value} {...pressProps}>
      <span className="tv-token__face">{children}</span>
    </button>
  )
}

export function FillSlotsFace({ task, value, size }: FaceProps) {
  const items = splitTokens(value)
  if (fractionSlots(task) && items.length === 2) {
    return (
      <span className={cx('tv-face', `tv-face--${size}`)}>
        <span className="tv-frac">
          <span className="tv-frac__n">{String(items[0])}</span>
          <span className="tv-frac__bar" aria-hidden />
          <span className="tv-frac__d">{String(items[1])}</span>
        </span>
      </span>
    )
  }
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-face__row tv-face__row--cards')}>
      {items.map((v, i) => (
        <span key={i} className="tv-minicard">
          <OptionFace task={task} value={v} size="sm" />
        </span>
      ))}
    </span>
  )
}
