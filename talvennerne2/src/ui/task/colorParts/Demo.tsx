// colorParts demo: "3/4" above a circle in four parts. The hand taps three parts — each one takes
// the colour — and then the tick (3,9 s). When the child's own task asks for three quarters, the
// film colours two thirds of a rectangle instead: the film is never the task.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { FracText } from '../faces'
import { DemoStage } from '../demo/DemoStage'
import type { DemoStep } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { partCentres, partsGeometry } from './geometry'
import { fracOf } from './logic'
import type { PartsShape } from './logic'
import { PartsArt } from './View'

export function ColorPartsDemo({ onDone, task }: DemoProps) {
  const own = task ? fracOf(task.answer) : null
  const alt = !!own && own.n * 4 === own.d * 3
  const shape: PartsShape = alt ? 'rect' : 'circle'
  const parts = alt ? 3 : 4
  const colour = alt ? 2 : 3
  const geo = partsGeometry(shape, parts)
  const spots = partCentres(shape, parts)
  const [on, setOn] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const steps: DemoStep[] = Array.from({ length: colour }, (_, i) => ({
    at: 450 + i * 650,
    to: `part${i}`,
    tap: true,
    run: () => setOn((o) => [...o, i]),
  }))
  const last = 450 + (colour - 1) * 650
  steps.push({ at: last + 850, to: 'ok', tap: true, run: () => setDone(true) })
  steps.push({ at: last + 1650, to: [0.9, 1.2] })
  return (
    <DemoStage duration={last + 1950} onDone={onDone} steps={steps}>
      <div className="tv-demo__mini tv-parts tv-parts-demo">
        <span className="tv-parts__ask">
          <FracText n={colour} d={parts} />
        </span>
        <div className="tv-demo__row">
          <div className={cx('tv-parts__figure', done && 'is-good')}>
            <svg className="tv-parts__svg" viewBox={`-4 -4 ${geo.w + 8} ${geo.h + 8}`} aria-hidden>
              <PartsArt geo={geo} on={on} />
            </svg>
            {spots.map((p, i) => (
              <span key={i} className="tv-demo__spot" data-demo={`part${i}`} style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }} />
            ))}
          </div>
          <span className={cx('tv-demo__key is-ok', on.length > 0 && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
