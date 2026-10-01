// countTap demo: three apples hop into the basket, one at a time, then the tick.
import { useState } from 'react'
import { Thing } from '../../../art/materials'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { Basket } from './Basket'

export function CountTapDemo({ onDone }: DemoProps) {
  const [taken, setTaken] = useState(0)
  const [checked, setChecked] = useState(false)
  const take = () => setTaken((t) => t + 1)
  return (
    <DemoStage
      duration={4600}
      onDone={onDone}
      steps={[
        { at: 500, to: 'a0', tap: true, run: take },
        { at: 1250, to: 'a1', tap: true, run: take },
        { at: 2000, to: 'a2', tap: true, run: take },
        { at: 2900, to: 'ok', tap: true, run: () => setChecked(true) },
        { at: 3900, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className="tv-demo__pile">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={cx('tv-demo__thing', i < taken && 'is-gone')} data-demo={`a${i}`}>
              <Thing id="apple" size={40} />
            </span>
          ))}
        </div>
        <div className="tv-demo__row">
          <span className={cx('tv-demo__basket', checked && 'is-good')}>
            <Basket rows={1}>
              {Array.from({ length: taken }, (_, i) => (
                <span key={i} className="tv-count__in tv-demo__in">
                  <Thing id="apple" size={28} />
                </span>
              ))}
            </Basket>
          </span>
          <span className={cx('tv-demo__key is-ok', taken > 0 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
