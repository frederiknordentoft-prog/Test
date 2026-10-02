// choice demo: a small question like the child's own (three apples to count, a heard number, the
// stones 2 → ?, a figure, a pattern, the longest pencil, 1 + 2 in Plusengen); the hand taps the right
// card and it turns green.
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Shape2D } from '../../../art/materials'
import { AnswerCard } from '../../design/AnswerCard'
import { DemoStage } from '../demo/DemoStage'
import { DEMO_ANSWER, DemoQuestion, DemoStick, NUMBER_TOPICS, demoTopic, type DemoTopic } from '../demo/topic'
import { PatternToken } from '../faces'
import type { DemoProps } from '../types'

interface Cards {
  /** Three cards (two for a pattern); `b` is the right one. */
  faces: { key: string; face: ReactNode }[]
  /** What the question shows once the card is tapped. */
  filled: string | null
}

function cardsFor(topic: DemoTopic): Cards {
  if (topic === 'shape') {
    return {
      faces: [
        { key: 'a', face: <Shape2D shape="circle" size={52} /> },
        { key: 'b', face: <Shape2D shape="triangle" size={52} /> },
        { key: 'c', face: <Shape2D shape="square" size={52} /> },
      ],
      filled: null,
    }
  }
  if (topic === 'pattern') {
    return {
      faces: [
        { key: 'a', face: <PatternToken token="red" px={52} /> },
        { key: 'b', face: <PatternToken token="blue" px={52} /> },
      ],
      filled: 'blue',
    }
  }
  if (topic === 'length') {
    return {
      faces: [
        { key: 'a', face: <DemoStick length={46} /> },
        { key: 'b', face: <DemoStick length={92} /> },
        { key: 'c', face: <DemoStick length={64} /> },
      ],
      filled: null,
    }
  }
  const n = DEMO_ANSWER
  return {
    faces: [
      { key: 'a', face: n - 1 },
      { key: 'b', face: n },
      { key: 'c', face: n + 1 },
    ],
    filled: NUMBER_TOPICS.includes(topic) ? String(n) : null,
  }
}

export function ChoiceDemo({ onDone, task }: DemoProps) {
  const topic = demoTopic(task)
  const { faces, filled } = cardsFor(topic)
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
      <div className="tv-demo__mini tv-demo__mini--split" data-demo-topic={topic}>
        <DemoQuestion topic={topic} answer={picked ? filled : null} />
        <div className={faces.length === 2 ? 'tv-demo__cards tv-demo__cards--two' : 'tv-demo__cards'}>
          {faces.map(({ key, face }) => (
            <AnswerCard key={key} state={picked ? (key === 'b' ? 'correct' : 'dim') : 'idle'} tabIndex={-1} data-demo={key}>
              {face}
            </AnswerCard>
          ))}
        </div>
      </div>
    </DemoStage>
  )
}
