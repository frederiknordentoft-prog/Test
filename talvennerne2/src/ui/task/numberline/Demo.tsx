// numberline demo: "where is 6?" The hand taps the line, slides the pin to 6 and taps the tick.
import { useState } from 'react'
import { NL, NumberLine, xOf } from '../../../art/materials'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { Pin } from './View'

const fx = (v: number) => xOf(v, 0, 10) / NL.W
const fy = NL.Y / NL.H

export function NumberlineDemo({ onDone }: DemoProps) {
  const [at, setAt] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  return (
    <DemoStage
      duration={4700}
      onDone={onDone}
      steps={[
        { at: 500, to: 'p3' },
        { at: 1100, to: 'p3', hold: true, run: () => setAt(3) },
        { at: 1600, to: 'p6', hold: true, run: () => setAt(6) },
        { at: 2300, to: 'p6', release: true },
        { at: 2900, to: 'ok', tap: true, run: () => setDone(true) },
        { at: 3900, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <span className="tv-chip tv-chip--demo">6</span>
        <div className="tv-demo__line">
          <NumberLine min={0} max={10} className="tv-nline__line" />
          <svg className="tv-nline__overlay" viewBox={`0 0 ${NL.W} ${NL.H}`} aria-hidden overflow="visible">
            {at !== null && <Pin x={xOf(at, 0, 10)} state={done ? 'good' : 'idle'} />}
          </svg>
          <span className="tv-demo__spot" data-demo="p3" style={{ left: `${fx(3) * 100}%`, top: `${fy * 100}%` }} />
          <span className="tv-demo__spot" data-demo="p6" style={{ left: `${fx(6) * 100}%`, top: `${fy * 100}%` }} />
        </div>
        <span className={cx('tv-demo__key is-ok', at !== null && 'is-on')} data-demo="ok">
          <Icon name="check" size={24} strokeWidth={3} />
        </span>
      </div>
    </DemoStage>
  )
}
