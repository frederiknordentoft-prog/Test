// clockSet demo: the question is heard, then the hand takes the long minute hand at 12 and turns it
// round to 6 — the short hand follows half the way to 1 ("halv et") — and taps the tick (4,4 s).
// A task that itself asks for 12:30 sees the hand stop at 3 instead: the film is never the task.
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoStep } from '../demo/DemoStage'
import { DemoQuestion } from '../demo/topic'
import type { DemoProps } from '../types'
import { DIAL, knobSpot, mod } from './logic'
import { DialArt } from './View'

const STEP_MS = 220

export function ClockSetDemo({ onDone, task }: DemoProps) {
  const target = task && typeof task.answer === 'number' && mod(task.answer, DIAL) === 30 ? 15 : 30
  const [minutes, setMinutes] = useState(0)
  const [held, setHeld] = useState(false)
  const [done, setDone] = useState(false)
  const marks = [0, 5, 10, 15, 20, 25, 30].filter((v) => v <= target)
  const turnEnd = 1250 + (marks.length - 1) * STEP_MS
  const steps: DemoStep[] = [
    { at: 400, to: 'm0' },
    { at: 1000, to: 'm0', hold: true, run: () => setHeld(true) },
    ...marks.slice(1).map((v, i): DemoStep => ({ at: 1250 + i * STEP_MS, to: `m${v}`, hold: true, run: () => setMinutes(v) })),
    { at: turnEnd + 300, to: `m${target}`, release: true, run: () => setHeld(false) },
    { at: turnEnd + 730, to: 'ok', tap: true, run: () => setDone(true) },
    { at: turnEnd + 1530, to: [0.9, 1.2] },
  ]
  return (
    <DemoStage duration={turnEnd + 1830} onDone={onDone} steps={steps}>
      <div className="tv-demo__mini tv-clockset-demo">
        <DemoQuestion topic="hear" answer={null} />
        <div className="tv-clockset-demo__row">
          <div className={cx('tv-clockset__dial', done && 'is-good')} style={{ '--dial': '176px' } as CSSProperties}>
            <DialArt minutes={minutes} held={held ? 'minute' : null} />
            {marks.map((v) => {
              const p = knobSpot(v, 'minute')
              return <span key={v} className="tv-demo__spot" data-demo={`m${v}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
            })}
          </div>
          <span className={cx('tv-demo__key is-ok', minutes > 0 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
