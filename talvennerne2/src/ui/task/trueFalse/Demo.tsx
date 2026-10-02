// trueFalse demo: "2 + 2 = 4?" — or, for figures and fractions, a circle cut in two equal halves
// (UI-fund 20: a figure task never opens on a sum) — the hand taps the green tick.
import { useState } from 'react'
import { FractionShape } from '../../../art/materials'
import { AnswerCard } from '../../design/AnswerCard'
import { Equation } from '../../design/Equation'
import { DemoStage } from '../demo/DemoStage'
import { demoTopic } from '../demo/topic'
import { YesNoGlyph } from '../faces'
import type { DemoProps } from '../types'

const FIGURE_TOPICS = new Set(['shape', 'fraction', 'solid', 'corners'])

/** The film asks about a figure (halfShape, symmetry), not a sum. */
export const trueFalseShowsFigure = (task: DemoProps['task']): boolean => FIGURE_TOPICS.has(demoTopic(task))

export function TrueFalseDemo({ onDone, task }: DemoProps) {
  const [yes, setYes] = useState(false)
  const figure = trueFalseShowsFigure(task)
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
        {figure ? (
          <FractionShape shape="circle" parts={2} colored={1} size={76} />
        ) : (
          <Equation terms={[{ n: 2 }, { op: '+' }, { n: 2 }, { op: '=' }, { n: 4 }]} size="answer" />
        )}
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
