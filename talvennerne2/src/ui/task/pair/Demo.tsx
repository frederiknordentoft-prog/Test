// pair demo: 3 + ? = 10. The hand picks up the 7 bubble and drops it in the empty one.
import { useState } from 'react'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

export function PairDemo({ onDone }: DemoProps) {
  const [lifted, setLifted] = useState(false)
  const [landed, setLanded] = useState(false)
  const seven = <span className="tv-bubble tv-bubble--mini tv-bubble--held">7</span>
  return (
    <DemoStage
      duration={4300}
      onDone={onDone}
      steps={[
        { at: 500, to: 'b7' },
        { at: 1200, to: 'b7', hold: true, carry: seven, run: () => setLifted(true) },
        { at: 1700, to: 'socket', hold: true },
        { at: 2600, to: 'socket', release: true, carry: null, run: () => setLanded(true) },
        { at: 3500, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className="tv-pair__sum tv-pair__sum--mini">
          <span className="tv-bubble tv-bubble--anchor tv-bubble--mini">3</span>
          <span className="tv-pair__op">+</span>
          <span className={cx('tv-pair__socket tv-pair__socket--mini', landed && 'is-full is-correct')} data-demo="socket">
            {landed ? <span className="tv-bubble tv-bubble--mini tv-bubble--in is-good">7</span> : <span className="tv-pair__q">?</span>}
          </span>
          <span className="tv-pair__op">=</span>
          <span className="tv-bubble tv-bubble--total tv-bubble--mini">10</span>
        </div>
        <div className="tv-pair__pool tv-pair__pool--mini">
          <span className="tv-bubble tv-bubble--option tv-bubble--mini">6</span>
          <span className={cx('tv-bubble tv-bubble--option tv-bubble--mini', lifted && 'is-gone')} data-demo="b7">7</span>
          <span className="tv-bubble tv-bubble--option tv-bubble--mini">8</span>
        </div>
      </div>
    </DemoStage>
  )
}
