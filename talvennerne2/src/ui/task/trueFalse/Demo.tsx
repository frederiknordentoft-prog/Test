// trueFalse demo: "2 + 2 = 4?" — the hand taps the green tick.
import { useState } from 'react'
import { AnswerCard } from '../../design/AnswerCard'
import { Equation } from '../../design/Equation'
import { DemoStage } from '../demo/DemoStage'
import { YesNoGlyph } from '../faces'
import type { DemoProps } from '../types'

export function TrueFalseDemo({ onDone }: DemoProps) {
  const [yes, setYes] = useState(false)
  return (
    <DemoStage
      duration={3300}
      onDone={onDone}
      steps={[
        { at: 600, to: 'yes' },
        { at: 1400, to: 'yes', tap: true, run: () => setYes(true) },
        { at: 2500, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <Equation terms={[{ n: 2 }, { op: '+' }, { n: 2 }, { op: '=' }, { n: 4 }]} size="answer" />
        <div className="tv-demo__cards tv-demo__cards--two">
          <AnswerCard size="lg" className="tv-tf__btn is-yes" state={yes ? 'correct' : 'idle'} tabIndex={-1} data-demo="yes">
            <YesNoGlyph yes size={54} />
          </AnswerCard>
          <AnswerCard size="lg" className="tv-tf__btn is-no" state={yes ? 'dim' : 'idle'} tabIndex={-1}>
            <YesNoGlyph yes={false} size={54} />
          </AnswerCard>
        </div>
      </div>
    </DemoStage>
  )
}
