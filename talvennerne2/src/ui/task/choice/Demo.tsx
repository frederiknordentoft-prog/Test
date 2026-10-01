// choice demo: "1 + 2 = ?", the hand taps the 3 and the card turns green.
import { useState } from 'react'
import { AnswerCard } from '../../design/AnswerCard'
import { Equation } from '../../design/Equation'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

export function ChoiceDemo({ onDone }: DemoProps) {
  const [picked, setPicked] = useState(false)
  return (
    <DemoStage
      duration={3300}
      onDone={onDone}
      steps={[
        { at: 700, to: 'b' },
        { at: 1500, to: 'b', tap: true, run: () => setPicked(true) },
        { at: 2500, to: [0.82, 1.15] },
      ]}
    >
      <div className="tv-demo__mini">
        <Equation terms={[{ n: 1 }, { op: '+' }, { n: 2 }, { op: '=' }, { blank: true }]} size="answer" slot={picked ? 'good' : 'empty'} entry={picked ? '3' : undefined} />
        <div className="tv-demo__cards">
          <AnswerCard state={picked ? 'dim' : 'idle'} tabIndex={-1}>2</AnswerCard>
          <AnswerCard state={picked ? 'correct' : 'idle'} tabIndex={-1} data-demo="b">3</AnswerCard>
          <AnswerCard state={picked ? 'dim' : 'idle'} tabIndex={-1}>4</AnswerCard>
        </div>
      </div>
    </DemoStage>
  )
}
