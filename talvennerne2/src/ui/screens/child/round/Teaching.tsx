// The error flow (SPEC §3.5, låst valg): the child's answer stays, struck through and untappable; the
// strategy is shown and read; one big button with the right answer ("Tryk på 13") moves on. The
// button is the only way forward, so every mistake ends with the child giving the right answer.
import { useEffect, useRef } from 'react'
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
      <div className="tv-teach__row">
        <div className="tv-teach__given" aria-disabled data-given={String(given)}>
          <Face task={task} value={given} size="sm" />
          <span className="tv-strike" aria-hidden />
        </div>
        <ConfirmButton task={task} module={module} onConfirm={onConfirm} />
      </div>
    </div>
  )
}

export function ConfirmButton({ task, module, onConfirm }: { task: Task; module: KindModule; onConfirm(): void }) {
  const speech = useSpeech()
  const { pressProps } = usePress(false)
  const Face = module.Face
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
        <span className="tv-confirm__answer">
          <Face task={task} value={task.answer} size="md" />
        </span>
      </span>
    </button>
  )
}
