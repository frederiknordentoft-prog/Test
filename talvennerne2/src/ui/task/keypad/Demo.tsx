// keypad demo: a small question like the child's own (three apples, a heard number, the stones 2 → ?,
// 1 + 2 in Plusengen, coins worth 3 kr, a triangle's corners, 6 : 2); the hand types 3, then the tick.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { formatMoney } from '../answers'
import { DemoStage } from '../demo/DemoStage'
import { DEMO_ANSWER, DemoQuestion, NUMBER_TOPICS, demoTopic } from '../demo/topic'
import type { DemoProps } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']

export function KeypadDemo({ onDone, task }: DemoProps) {
  const own = demoTopic(task)
  // a figure's sides and corners are counted on the figure; anything else without a number counts apples
  const topic = NUMBER_TOPICS.includes(own) ? own : own === 'solid' || own === 'shape' ? 'corners' : 'count'
  const digit = String(DEMO_ANSWER)
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  // the sum and the stones show the typed number in their blank; the others in a display under them
  const inBlank = topic === 'add' || topic === 'sub' || topic === 'order' || topic === 'mul' || topic === 'div'
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
      <div className="tv-demo__mini tv-demo__mini--split" data-demo-topic={topic}>
        <DemoQuestion topic={topic} answer={inBlank && typed ? typed : null} />
        {!inBlank && <span className={cx('tv-demo__display', typed && 'is-on', done && 'is-good')}>{typed ? (topic === 'money' ? formatMoney(Number(typed) * 100) : typed) : ' '}</span>}
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
