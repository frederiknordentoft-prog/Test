// numberline demo: "where is 6?" The hand taps the line, slides the pin to 6 and taps the tick.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { LineArt, Pin, lineGeometry } from './View'

const W = 320
const G = lineGeometry(0, 10, W)

export function NumberlineDemo({ onDone }: DemoProps) {
  const [at, setAt] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const spot = (v: number) => ({ left: `${(G.x(v) / W) * 100}%`, top: `${(G.y / G.h) * 100}%` })
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
          <svg viewBox={`0 0 ${W} ${G.h}`} width="100%" aria-hidden overflow="visible">
            <LineArt g={G} />
            {at !== null && <Pin x={G.x(at)} y={G.y} state={done ? 'good' : 'idle'} />}
          </svg>
          <span className="tv-demo__spot" data-demo="p3" style={spot(3)} />
          <span className="tv-demo__spot" data-demo="p6" style={spot(6)} />
        </div>
        <span className={cx('tv-demo__key is-ok', at !== null && 'is-on')} data-demo="ok">
          <Icon name="check" size={24} strokeWidth={3} />
        </span>
      </div>
    </DemoStage>
  )
}
