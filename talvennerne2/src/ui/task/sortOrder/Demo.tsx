// sortOrder demo: 5, 2, 8 — the hand taps 2, then 5, then 8, and they line up; then the tick.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

const CARDS = [5, 2, 8]

export function SortOrderDemo({ onDone }: DemoProps) {
  const [placed, setPlaced] = useState<number[]>([])
  const put = (v: number) => () => setPlaced((p) => [...p, v])
  return (
    <DemoStage
      duration={4800}
      onDone={onDone}
      steps={[
        { at: 500, to: 'c2', tap: true, run: put(2) },
        { at: 1300, to: 'c5', tap: true, run: put(5) },
        { at: 2100, to: 'c8', tap: true, run: put(8) },
        { at: 3000, to: 'ok', tap: true },
        { at: 4000, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className="tv-sort__shelf tv-sort__shelf--mini">
          {[0, 1, 2].map((k) => (
            <div key={k} className={cx('tv-sort__place', placed[k] !== undefined && 'is-full')}>
              {placed[k] !== undefined && (
                <span className="tv-sortcard tv-sortcard--mini">
                  <span className="tv-sortcard__face">{placed[k]}</span>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="tv-sort__arrow" aria-hidden>
          <Icon name="next" size={18} strokeWidth={2.6} />
        </div>
        <div className="tv-demo__row">
          {CARDS.map((v) => (
            <span key={v} className={cx('tv-sortcard tv-sortcard--mini', placed.includes(v) && 'is-gone')} data-demo={`c${v}`}>
              <span className="tv-sortcard__face">{v}</span>
            </span>
          ))}
          <span className={cx('tv-demo__key is-ok', placed.length === 3 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
