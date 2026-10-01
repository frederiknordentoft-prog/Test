// buildBase demo: 13 — one rod, then three unit cubes, then the tick.
import { useState } from 'react'
import { Base10Block, Base10Group } from '../../../art/materials'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

export function BuildBaseDemo({ onDone }: DemoProps) {
  const [t, setT] = useState(0)
  const [o, setO] = useState(0)
  return (
    <DemoStage
      duration={5000}
      onDone={onDone}
      steps={[
        { at: 500, to: 'rod', tap: true, run: () => setT(1) },
        { at: 1300, to: 'unit', tap: true, run: () => setO(1) },
        { at: 1850, to: 'unit', tap: true, run: () => setO(2) },
        { at: 2400, to: 'unit', tap: true, run: () => setO(3) },
        { at: 3200, to: 'ok', tap: true },
        { at: 4200, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <span className="tv-chip tv-chip--demo">13</span>
        <div className="tv-base__mat tv-base__mat--mini">{t + o > 0 && <Base10Group t={t} o={o} unit={7} />}</div>
        <div className="tv-demo__row">
          <span className="tv-base__src tv-base__src--mini" data-demo="rod">
            <span className="tv-base__srcface">
              <Base10Block kind="rod" unit={3.4} />
            </span>
          </span>
          <span className="tv-base__src tv-base__src--mini" data-demo="unit">
            <span className="tv-base__srcface">
              <Base10Block kind="unit" unit={14} />
            </span>
          </span>
          <span className={cx('tv-demo__key is-ok', t + o > 0 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
