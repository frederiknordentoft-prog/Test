// multiSelect demo: "all the triangles" (or all the five-krone coins) — the hand rings the two, then
// taps the tick.
import { useState } from 'react'
import type { ShapeId } from '../../../engine/types'
import { Coin, Shape2D } from '../../../art/materials'
import type { CoinOre } from '../../../art/materials'
import { AnswerCard } from '../../design/AnswerCard'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import { demoTopic } from '../demo/topic'
import type { DemoProps } from '../types'

const ITEMS: { id: string; shape: ShapeId; variant: number }[] = [
  { id: 'a', shape: 'triangle', variant: 0 },
  { id: 'b', shape: 'circle', variant: 0 },
  { id: 'c', shape: 'square', variant: 0 },
  { id: 'd', shape: 'triangle', variant: 1 },
]

/** "Tryk på alle femkroner" (coinNames): the same film with coins (UI-fund 20). */
const COINS: { id: string; ore: CoinOre }[] = [
  { id: 'a', ore: 500 },
  { id: 'b', ore: 200 },
  { id: 'c', ore: 100 },
  { id: 'd', ore: 500 },
]

export function MultiSelectDemo({ onDone, task }: DemoProps) {
  const coins = demoTopic(task) === 'coin'
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
              {coins ? <Coin ore={COINS.find((c) => c.id === it.id)!.ore} size={46} /> : <Shape2D shape={it.shape} variant={it.variant} size={46} />}
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
