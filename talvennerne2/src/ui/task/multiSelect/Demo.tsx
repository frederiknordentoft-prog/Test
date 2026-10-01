// multiSelect demo: "all the triangles" — the hand rings the two triangles, then taps the tick.
import { useState } from 'react'
import type { ShapeId } from '../../../engine/types'
import { Shape2D } from '../../../art/materials'
import { AnswerCard } from '../../design/AnswerCard'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import type { DemoProps } from '../types'

const ITEMS: { id: string; shape: ShapeId; variant: number }[] = [
  { id: 'a', shape: 'triangle', variant: 0 },
  { id: 'b', shape: 'circle', variant: 0 },
  { id: 'c', shape: 'square', variant: 0 },
  { id: 'd', shape: 'triangle', variant: 1 },
]

export function MultiSelectDemo({ onDone }: DemoProps) {
  const [on, setOn] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const pick = (id: string) => () => setOn((o) => [...o, id])
  return (
    <DemoStage
      duration={4600}
      onDone={onDone}
      steps={[
        { at: 500, to: 'a', tap: true, run: pick('a') },
        { at: 1400, to: 'd', tap: true, run: pick('d') },
        { at: 2400, to: 'ok', tap: true, run: () => setDone(true) },
        { at: 3500, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className="tv-demo__cards tv-demo__cards--four">
          {ITEMS.map((it) => (
            <AnswerCard key={it.id} state={on.includes(it.id) ? (done ? 'correct' : 'selected') : done ? 'dim' : 'idle'} tabIndex={-1} data-demo={it.id}>
              <Shape2D shape={it.shape} variant={it.variant} size={46} />
            </AnswerCard>
          ))}
        </div>
        <span className={cx('tv-demo__key is-ok', on.length > 0 && 'is-on')} data-demo="ok">
          <Icon name="check" size={24} strokeWidth={3} />
        </span>
      </div>
    </DemoStage>
  )
}
