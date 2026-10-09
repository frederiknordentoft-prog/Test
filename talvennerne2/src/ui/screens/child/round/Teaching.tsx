// The error flow (SPEC §3.5, låst valg): the child's answer stays, struck through and untappable; the
// strategy is shown and read; one big button with the right answer ("Tryk på 13") moves on. The
// button is the only way forward, so every mistake ends with the child giving the right answer.
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { AnswerValue, Task } from '../../../../engine/types'
import { usePress } from '../../../design/usePress'
import { useSpeech } from '../../../design/speech'
import { SpokenText } from '../../../design/SpokenText'
import { cx } from '../../../design/cx'
import { isCalm, springInY } from '../../../design/motion'
import { StrategyHint } from '../../../hint/StrategyHint'
import type { ResolvedHint } from '../../../hint/hintFor'
import type { KindModule } from '../../../task/types'

export interface TeachingProps {
  task: Task
  module: KindModule
  given: AnswerValue
  hint: ResolvedHint
  onConfirm(): void
}

export function Teaching({ task, module, given, hint, onConfirm }: TeachingProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && !isCalm()) springInY(ref.current, '28px')
  }, [])
  const Face = module.Face
  return (
    <div ref={ref} className="tv-teach" data-teaching="">
      <StrategyHint hint={hint} />
      <div className={cx('tv-teach__row', module.wideFace && 'is-wide')}>
        <div className="tv-teach__given" aria-disabled data-given={String(given)}>
          <Face task={task} value={given} size="sm" />
          <span className="tv-strike" aria-hidden />
        </div>
        <ConfirmButton task={task} module={module} onConfirm={onConfirm} />
      </div>
    </div>
  )
}

/**
 * A row of cards on the button (four figures, five numbers in order) keeps its size while the white box
 * has room for it, and gets smaller as a whole only when it would not fit (QA3c P2-6: the fourth card
 * stuck out of the box on an iPhone SE). The room is the button's own width, so the box never sizes it.
 */
function useFitAnswerRow() {
  const ref = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const box = ref.current
    const face = box?.parentElement
    const row = box?.querySelector<HTMLElement>('.tv-face__row')
    if (!box || !face || !row) return
    const fit = () => {
      row.style.removeProperty('zoom')
      const f = getComputedStyle(face)
      const b = getComputedStyle(box)
      const room = face.clientWidth - parseFloat(f.paddingLeft) - parseFloat(f.paddingRight) - parseFloat(b.paddingLeft) - parseFloat(b.paddingRight)
      const need = row.scrollWidth
      if (room > 0 && need > room) row.style.setProperty('zoom', (room / need).toFixed(3))
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fit)
    ro.observe(face)
    return () => ro.disconnect()
  }, [])
  return ref
}

export function ConfirmButton({ task, module, onConfirm }: { task: Task; module: KindModule; onConfirm(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress(false)
  const Face = module.Face
  const answerRef = useFitAnswerRow()
  return (
    <button
      type="button"
      className="tv-confirm tv-touch tv-pulse"
      onClick={onConfirm}
      aria-label={speech.text('frag.tryk_paa')}
      data-confirm={String(task.answer)}
      {...pressProps}
    >
      <span className="tv-confirm__face">
        <SpokenText clip="frag.tryk_paa" silent className={cx('tv-confirm__label')} />
        <span ref={answerRef} className="tv-confirm__answer">
          <Face task={task} value={task.answer} size="md" />
        </span>
      </span>
    </button>
  )
}
