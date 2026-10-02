// keypad demo: a small question like the child's own (three apples, a heard number, the stones 2 → ?,
// 1 + 2 in Plusengen); the hand types 3, then taps the tick.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import { DEMO_ANSWER, DemoQuestion, NUMBER_TOPICS, demoTopic } from '../demo/topic'
import type { DemoProps } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']

export function KeypadDemo({ onDone, task }: DemoProps) {
  const own = demoTopic(task)
  const topic = NUMBER_TOPICS.includes(own) ? own : 'count'
  const digit = String(DEMO_ANSWER)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  // the sum and the stones show the typed number in their blank; the others in a display under them
  const inBlank = topic === 'add' || topic === 'sub' || topic === 'order'
  return (
    <DemoStage
      duration={4200}
      onDone={onDone}
      steps={[
        { at: 600, to: `k${digit}` },
        { at: 1300, to: `k${digit}`, tap: true, run: () => setTyped(digit) },
        { at: 2300, to: 'kok' },
        { at: 3000, to: 'kok', tap: true, run: () => setDone(true) },
        { at: 3700, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini" data-demo-topic={topic}>
        <DemoQuestion topic={topic} answer={inBlank && typed ? typed : null} />
        {!inBlank && <span className={cx('tv-demo__display', typed && 'is-on', done && 'is-good')}>{typed || ' '}</span>}
        <div className="tv-demo__keys">
          {KEYS.map((k) => (
            <span key={k} className={cx('tv-demo__key', k === 'ok' && 'is-ok', k === 'ok' && typed && 'is-on')} data-demo={`k${k}`}>
              {k === 'del' ? <Icon name="backspace" size={22} /> : k === 'ok' ? <Icon name="check" size={24} strokeWidth={3} /> : k}
            </span>
          ))}
        </div>
      </div>
    </DemoStage>
  )
}
