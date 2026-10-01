// keypad (SPEC §3.1–3.2): digits 0–9, delete and the tick, which is active once something is typed.
// What the child types appears in the prompt's answer blank when there is one (8 + 5 = 1▌), else in
// a display above the keys. Money in whole kroner shows "kr" and is sent as øre (entryScale 100).
import { useEffect, useState } from 'react'
import { playSfx } from '../../../audio/sfx'
import { Icon } from '../../design/Icon'
import { useSpeech } from '../../design/speech'
import { usePress } from '../../design/usePress'
import { cx } from '../../design/cx'
import { formatMoney, formatNumber, hasBlank, keypadPress, keypadValue } from '../answers'
import { CheckButton } from '../CheckButton'
import { NumText, UnitSuffix } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const

/** The unit shown after typed digits. */
export function keypadUnit(task: TaskViewProps['task']): string | null {
  if (task.entryScale === 100 || task.answerType === 'ore') return 'kr'
  return task.unit
}

export function KeypadView({ task, mode, given, onSubmit, onActivity, onDraft }: TaskViewProps) {
  const [digits, setDigits] = useState('')
  const [bump, setBump] = useState(0)
  const inBlank = hasBlank(task.prompt)
  const unit = keypadUnit(task)
  const input = mode === 'input'

  useEffect(() => {
    if (inBlank) onDraft(digits ? { text: digits, unit } : null)
  }, [digits, inBlank, unit, onDraft])

  const press = (key: string) => {
    if (!input) return
    onActivity()
    if (key === 'ok') {
      const v = keypadValue(digits, task)
      if (v !== null) onSubmit(v)
      return
    }
    const next = keypadPress(digits, key, task)
    if (next === digits && key !== 'del') setBump((b) => b + 1)
    else playSfx(key === 'del' ? 'fjern' : 'klik')
    setDigits(next)
  }

  // a hardware keyboard (iPad keyboards, desktop) types as well
  useEffect(() => {
    if (!input) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
      else if (e.key === 'Enter') press('ok')
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const shown = mode === 'input' || mode === 'idle' ? digits : given !== null ? String(typeof given === 'number' ? given / task.entryScale : given) : digits
  return (
    <div className={cx('tv-keypad', inBlank && 'tv-keypad--blank')} data-kind="keypad">
      {!inBlank && (
        <div className={cx('tv-keypad__display', `is-${mode}`)} key={bump} data-bump={bump > 0 ? '' : undefined}>
          <span className={cx('tv-keypad__digits', !shown && 'is-empty')}>{shown ? formatNumber(Number(shown)) : '?'}</span>
          {unit && <UnitSuffix unit={unit} />}
          {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
        </div>
      )}
      <div className="tv-keypad__keys">
        {KEYS.map((k) =>
          k === 'ok' ? (
            <CheckButton
              key={k}
              valid={digits.length > 0}
              stateKey={digits}
              enabled={input}
              taskId={task.id}
              onCheck={() => press('ok')}
              className="tv-key tv-key--ok"
            />
          ) : (
            <Key key={k} k={k} disabled={!input} onPress={press} />
          ),
        )}
      </div>
    </div>
  )
}

function Key({ k, disabled, onPress }: { k: string; disabled: boolean; onPress(k: string): void }) {
  const { pressProps } = usePress(disabled)
  const speech = useSpeech()
  return (
    <button
      type="button"
      className={cx('tv-key tv-touch', k === 'del' && 'tv-key--del', `tv-key--k${k}`)}
      disabled={disabled}
      onClick={() => onPress(k)}
      aria-label={k === 'del' ? speech.text('s.ui.delete') : k}
      data-key={k}
      {...pressProps}
    >
      <span className="tv-key__face">{k === 'del' ? <Icon name="backspace" size="46%" strokeWidth={2.4} /> : k}</span>
    </button>
  )
}

export function KeypadFace({ task, value, size }: FaceProps) {
  if (typeof value !== 'number') return <span className={cx('tv-face', `tv-face--${size}`)}>{String(value)}</span>
  const unit = keypadUnit(task)
  return (
    <span className={cx('tv-face', `tv-face--${size}`)}>
      <NumText small={task.answerType === 'ore' && value % 100 !== 0}>
        {task.answerType === 'ore' && value % 100 !== 0 ? formatMoney(value) : formatNumber(value / task.entryScale)}
        {unit && <UnitSuffix unit={unit} />}
      </NumText>
    </span>
  )
}

