// share demo: four apples, two plates. The hand taps one plate, then the other, then the first and
// the second again — an apple hops over each time — and taps the tick when the pile is empty
// (4,1 s). When the child's own task is four on two plates, six apples go on three plates instead.
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { Thing } from '../../../art/materials'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoStep } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { shareSetup } from './logic'

export function ShareDemo({ onDone, task }: DemoProps) {
  const own = task ? shareSetup(task) : null
  const alt = !!own && own.total === 4 && own.plates === 2
  const total = alt ? 6 : 4
  const plates = alt ? 3 : 2
  const [given, setGiven] = useState(0)
  const [done, setDone] = useState(false)
  const gap = alt ? 460 : 620
  const steps: DemoStep[] = Array.from({ length: total }, (_, i) => ({ at: 450 + i * gap, to: `plate${i % plates}`, tap: true, run: () => setGiven(i + 1) }))
  const last = 450 + (total - 1) * gap
  steps.push({ at: last + 800, to: 'ok', tap: true, run: () => setDone(true) })
  steps.push({ at: last + 1600, to: [0.9, 1.2] })
  const on = (p: number) => Array.from({ length: given }, (_, i) => i).filter((i) => i % plates === p)
  return (
    <DemoStage duration={last + 1900} onDone={onDone} steps={steps}>
      <div className="tv-demo__mini tv-deal tv-deal--lg tv-deal-demo" style={{ '--cols': plates, '--thing': '40px' } as CSSProperties}>
        <div className={cx('tv-deal__pile', given === total && 'is-empty')}>
          {Array.from({ length: total - given }, (_, i) => (
            <span key={i} className="tv-deal__thing tv-deal__loose">
              <Thing id="apple" />
            </span>
          ))}
        </div>
        <div className="tv-demo__row">
          <div className={cx('tv-deal__plates', done && 'is-good')}>
            {Array.from({ length: plates }, (_, p) => (
              <span key={p} className="tv-deal__plate" data-demo={`plate${p}`}>
                <span className="tv-deal__dish" aria-hidden />
                <span className="tv-deal__on" style={{ '--pc': 2 } as CSSProperties}>
                  {on(p).map((i) => (
                    <span key={i} className="tv-deal__thing tv-deal-demo__in">
                      <Thing id="apple" />
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <span className={cx('tv-demo__key is-ok', given === total && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
