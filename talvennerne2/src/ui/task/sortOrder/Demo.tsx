// sortOrder demo, like the child's own task (review r1 P2-8): counting on from 2 on the stepping
// stones (2 ? ? ?: the hand taps 3, 4, 5), the pencils longest first, or 2, 5, 8 smallest first.
// The film is 4,3 s (SPEC §3.4: 3–5 s; review r1 P3-15).
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../design/Icon'
import { cx } from '../../design/cx'
import { DemoStage } from '../demo/DemoStage'
import { DemoStick, demoTopic } from '../demo/topic'
import type { DemoProps } from '../types'

interface Film {
  /** A given stone before the places (counting on from it), or null. */
  from: number | null
  /** The cards as dealt, and the order the hand taps them in. */
  cards: { key: string; face: ReactNode }[]
  order: string[]
}

function filmFor(topic: ReturnType<typeof demoTopic>): Film {
  if (topic === 'order') {
    return { from: 2, cards: [{ key: '4', face: 4 }, { key: '3', face: 3 }, { key: '5', face: 5 }], order: ['3', '4', '5'] }
  }
  if (topic === 'length') {
    return {
      from: null,
      cards: [{ key: 'm', face: <DemoStick length={64} /> }, { key: 'l', face: <DemoStick length={92} /> }, { key: 's', face: <DemoStick length={44} /> }],
      order: ['l', 'm', 's'],
    }
  }
  return { from: null, cards: [{ key: '5', face: 5 }, { key: '2', face: 2 }, { key: '8', face: 8 }], order: ['2', '5', '8'] }
}

export function SortOrderDemo({ onDone, task }: DemoProps) {
  const film = filmFor(demoTopic(task))
  const [placed, setPlaced] = useState<string[]>([])
  const put = (key: string) => () => setPlaced((p) => [...p, key])
  const face = (key: string) => film.cards.find((c) => c.key === key)?.face
  return (
    <DemoStage
      duration={3800}
      onDone={onDone}
      steps={[
        { at: 400, to: `c${film.order[0]}`, tap: true, run: put(film.order[0]) },
        { at: 1100, to: `c${film.order[1]}`, tap: true, run: put(film.order[1]) },
        { at: 1800, to: `c${film.order[2]}`, tap: true, run: put(film.order[2]) },
        { at: 2600, to: 'ok', tap: true },
        { at: 3300, to: [0.9, 1.2] },
      ]}
    >
      <div className="tv-demo__mini">
        <div className={cx('tv-sort__shelf tv-sort__shelf--mini', film.from !== null && 'is-row')}>
          {film.from !== null && <span className="tv-demo__stone">{film.from}</span>}
          {[0, 1, 2].map((k) => (
            <div key={k} className={cx('tv-sort__place', placed[k] !== undefined && 'is-full')}>
              {placed[k] !== undefined && (
                <span className="tv-sortcard tv-sortcard--mini">
                  <span className="tv-sortcard__face">{face(placed[k])}</span>
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="tv-sort__arrow" aria-hidden>
          <Icon name="next" size={18} strokeWidth={2.6} />
        </div>
        <div className="tv-demo__row">
          {film.cards.map((c) => (
            <span key={c.key} className={cx('tv-sortcard tv-sortcard--mini', placed.includes(c.key) && 'is-gone')} data-demo={`c${c.key}`}>
              <span className="tv-sortcard__face">{c.face}</span>
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
