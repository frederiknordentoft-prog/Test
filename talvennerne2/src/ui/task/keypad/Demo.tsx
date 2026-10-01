// keypad demo: "4 + 3 = ?", the hand types 7, then taps the tick.
import { useState } from 'react'
import { Equation } from '../../design/Equation'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok']

export function KeypadDemo({ onDone }: DemoProps) {
  const [typed, setTyped] = useState('')
  const [done, setDone] = useState(false)
  return (
    <DemoStage
      duration={4200}
      onDone={onDone}
      steps={[
        { at: 600, to: 'k7' },
        { at: 1300, to: 'k7', tap: true, run: () => setTyped('7') },
        { at: 2300, to: 'kok' },
        { at: 3000, to: 'kok', tap: true, run: () => setDone(true) },
        { at: 3700, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <Equation terms={[{ n: 4 }, { op: '+' }, { n: 3 }, { op: '=' }, { blank: true }]} size="answer" slot={done ? 'good' : typed ? 'active' : 'empty'} entry={typed || undefined} />
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
