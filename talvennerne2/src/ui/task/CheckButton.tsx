// The tick that hands in an answer built over several taps (keypad, countTap, numberline,
// sortOrder, multiSelect, fillSlots, buildBase). SPEC §3.4: when the answer has been complete and
// unchanged for 3 s, the tick pulses and the voice says "Tryk på fluebenet, når du er færdig" —
// once per task, so a child who is still thinking is not nagged.
import { useEffect, useRef, useState } from 'react'
import { IconButton } from '../design/Button'
import { useSpeech } from '../design/speech'
import { cx } from '../design/cx'

export const NUDGE_AFTER_MS = 3000

export interface CheckButtonProps {
  /** The answer is complete enough to hand in. */
  valid: boolean
  /** Changes whenever the child changes the answer (restarts the 3 s). */
  stateKey: string
  /** False while the task is locked (feedback, demo). */
  enabled: boolean
  onCheck(): void
  /** The task id: the spoken nudge is given once per task. */
  taskId: string
  size?: 'md' | 'lg'
  className?: string
}

export function useNudge(valid: boolean, stateKey: string, enabled: boolean, taskId: string): boolean {
  const speech = useSpeech()
  const [nudge, setNudge] = useState(false)
  const spokenFor = useRef<string | null>(null)
  useEffect(() => {
    setNudge(false)
    if (!valid || !enabled) return
    const t = window.setTimeout(() => {
      setNudge(true)
      if (spokenFor.current !== taskId) {
        spokenFor.current = taskId
        speech.speak([{ clip: 's.round.checkNudge' }], { interrupt: false })
      }
    }, NUDGE_AFTER_MS)
    return () => window.clearTimeout(t)
  }, [valid, stateKey, enabled, taskId, speech])
  return nudge && valid && enabled
}

export function CheckButton({ valid, stateKey, enabled, onCheck, taskId, size = 'lg', className }: CheckButtonProps) {
  const nudge = useNudge(valid, stateKey, enabled, taskId)
  return (
    <IconButton
      icon="check"
      clip="s.ui.check"
      variant="good"
      size={size}
      solid
      pulse={nudge}
      disabled={!valid || !enabled}
      onClick={onCheck}
      className={cx('tv-check', className)}
      data-check=""
    />
  )
}
