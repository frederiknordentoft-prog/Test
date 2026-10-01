// fillSlots demo: a bead pattern red, blue, red, blue, ?, ? — the hand fills red, then blue.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import { PatternToken } from '../faces'
import type { DemoProps } from '../types'

const ROW = ['red', 'blue', 'red', 'blue']

export function FillSlotsDemo({ onDone }: DemoProps) {
  const [filled, setFilled] = useState<string[]>([])
  const put = (c: string) => () => setFilled((f) => [...f, c])
  return (
    <DemoStage
      duration={4500}
      onDone={onDone}
      steps={[
        { at: 500, to: 'red', tap: true, run: put('red') },
        { at: 1400, to: 'blue', tap: true, run: put('blue') },
        { at: 2400, to: 'ok', tap: true },
        { at: 3500, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className="tv-fill__row tv-fill__row--mini">
          {ROW.map((c, i) => (
            <span key={i} className="tv-fill__cell">
              <PatternToken token={c} px={44} />
            </span>
          ))}
          {[0, 1].map((i) => (
            <span key={`s${i}`} className={cx('tv-slot', filled[i] ? 'is-full' : 'is-empty', filled.length === i && 'is-next')}>
              <span className="tv-slot__face">{filled[i] ? <PatternToken token={filled[i]} px={44} /> : <span className="tv-slot__q">?</span>}</span>
            </span>
          ))}
        </div>
        <div className="tv-demo__row">
          <span className="tv-token" data-demo="red">
            <span className="tv-token__face">
              <PatternToken token="red" px={44} />
            </span>
          </span>
          <span className="tv-token" data-demo="blue">
            <span className="tv-token__face">
              <PatternToken token="blue" px={44} />
            </span>
          </span>
          <span className={cx('tv-demo__key is-ok', filled.length === 2 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
