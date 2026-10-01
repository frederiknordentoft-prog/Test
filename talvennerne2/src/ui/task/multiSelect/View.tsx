// multiSelect (SPEC §3.2): 5–8 things; a tap rings one and marks it with a tick, a second tap lets
// go. The tick button hands the set in, and only the exact set is right. When the things are the
// prompt itself (a set of shapes, objects beside the teddy), they are drawn here instead of twice.
import { useState } from 'react'
import type { AnswerValue, Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { AnswerCard } from '../../design/AnswerCard'
import type { AnswerState } from '../../design/AnswerCard'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { ObjectIcon } from '../../scenes/objects'
import { setValue, splitTokens } from '../answers'
import { CheckButton } from '../CheckButton'
import { OptionFace } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

/** The prompt is the set of things to choose from. */
export const multiSelectOwnsPrompt = (t: Task) => t.prompt.scene === 'shapes' || t.prompt.scene === 'compareObjects'

/** Objects shown for comparison only (the teddy in "heavier than the teddy"). */
function references(task: Task): string[] {
  const p = task.prompt
  if (p.scene !== 'compareObjects') return []
  return p.objects.slice(0, Math.max(0, p.objects.length - task.options.length))
}

export function MultiSelectView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const [picked, setPicked] = useState<AnswerValue[]>([])
  const input = mode === 'input'
  const shown = mode === 'input' || mode === 'idle' || given === null ? picked : splitTokens(given)
  const has = (v: AnswerValue) => shown.some((x) => String(x) === String(v))
  const refs = references(task)

  const toggle = (v: AnswerValue) => {
    if (!input) return
    onActivity()
    playSfx(has(v) ? 'fjern' : 'pop')
    setPicked((p) => (p.some((x) => String(x) === String(v)) ? p.filter((x) => String(x) !== String(v)) : [...p, v]))
  }

  const stateOf = (v: AnswerValue): AnswerState => {
    if (mode === 'correct') return has(v) ? 'correct' : 'dim'
    if (mode === 'wrong') return has(v) ? 'selected' : 'dim'
    return has(v) ? 'selected' : 'idle'
  }

  const n = task.options.length
  return (
    <div className={cx('tv-multi', `tv-multi--n${n}`, refs.length > 0 && 'tv-multi--ref', `is-${mode}`)} data-kind="multiSelect">
      {refs.length > 0 && (
        <div className="tv-multi__ref">
          {refs.map((id) => (
            <ObjectIcon key={id} id={id} size={64} />
          ))}
        </div>
      )}
      <div className="tv-multi__grid">
        {task.options.map((o, i) => (
          <AnswerCard
            key={String(o)}
            size="md"
            className="tv-multi__item"
            state={stateOf(o)}
            disabled={!input}
            label={task.optionClips?.[i] ? speech.text(task.optionClips[i]) : String(o)}
            data-option={String(o)}
            onClick={() => toggle(o)}
          >
            <OptionFace task={task} value={o} size="md" />
          </AnswerCard>
        ))}
        {mode === 'wrong' && <span className="tv-strike tv-strike--wide" aria-hidden />}
      </div>
      <div className="tv-multi__foot">
        <CheckButton
          valid={picked.length > 0}
          stateKey={picked.map(String).sort().join(',')}
          enabled={input}
          taskId={task.id}
          onCheck={() => onSubmit(setValue(picked, task))}
        />
      </div>
    </div>
  )
}

export function MultiSelectFace({ task, value, size }: FaceProps) {
  const items = splitTokens(value)
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
