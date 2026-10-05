// grid demo on a small 4-by-4 net. Setting a point: "(2, 1)" under the net, the hand taps the crossing
// two along and one up — the point pops in there — and taps the tick (3,1 s). Reading a point (when
// the child's task reads one): a point at (1, 3), the hand taps 1 below the net and 3 to the left, the
// pair fills in, and it taps the tick (3,9 s). The film's point is never the task's own.
import { useState } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoStep } from '../demo/DemoStage'
import type { DemoProps } from '../types'
import { gridSetup } from './logic'
import { frameOf, ux, uy } from './geometry'
import type { Pt } from './logic'
import { GridArt, PairCard } from './View'

const N = 4

export function GridDemo({ onDone, task }: DemoProps) {
  const own = task ? gridSetup(task) : null
  const read = own?.mode === 'read'
  const base: Pt = read ? { x: 1, y: 3 } : { x: 2, y: 1 }
  const at: Pt = own && own.point.x === base.x && own.point.y === base.y ? { x: base.y, y: base.x } : base
  const [pt, setPt] = useState<Pt | null>(null)
  const [picks, setPicks] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [done, setDone] = useState(false)
  const { W, H } = frameOf(N, N)
  const spot = (key: string, x: number, y: number) => (
    <span key={key} className="tv-demo__spot" data-demo={key} style={{ left: `${(100 * x) / W}%`, top: `${(100 * y) / H}%` }} />
  )
  const steps: DemoStep[] = read
    ? [
        { at: 450, to: 'x', tap: true, run: () => setPicks((p) => ({ ...p, x: at.x })) },
        { at: 1300, to: 'y', tap: true, run: () => setPicks((p) => ({ ...p, y: at.y })) },
        { at: 2300, to: 'ok', tap: true, run: () => setDone(true) },
        { at: 3100, to: [0.9, 1.2] },
      ]
    : [
        { at: 450, to: 'pt', tap: true, run: () => setPt(at) },
        { at: 1500, to: 'ok', tap: true, run: () => setDone(true) },
        { at: 2300, to: [0.9, 1.2] },
      ]
  const end = read ? 3400 : 2600
  return (
    <DemoStage duration={end} onDone={onDone} steps={steps}>
      <div className="tv-demo__mini tv-grid tv-grid-demo">
        <div className="tv-grid__figure">
          <GridArt w={N} h={N} mode={read ? 'read' : 'place'} point={read ? at : pt} picks={picks} good={done} />
          {read ? [spot('x', ux(at.x), uy(N, 0) + 32), spot('y', ux(0) - 32, uy(N, at.y))] : spot('pt', ux(at.x), uy(N, at.y))}
        </div>
        <div className="tv-grid__foot">
          {read ? <PairCard x={picks.x} y={picks.y} state={done ? 'good' : 'idle'} /> : <PairCard x={at.x} y={at.y} />}
          <span className={cx('tv-demo__key is-ok', (read ? picks.y !== null : pt !== null) && 'is-on')} data-demo="ok">
            <Icon name="check" size={24} strokeWidth={3} />
          </span>
        </div>
      </div>
    </DemoStage>
  )
}
