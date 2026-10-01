// countTap (SPEC §3.2): "Læg 7 i kurven". Each thing in the pile hops into the basket when tapped;
// a tap on the basket sends the last one back. The basket keeps them in rows of five, so 7 reads as
// five and two — but it never shows a number: counting is the task. Then the tick.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Task } from '../../../engine/types'
import { hashSeed, makeRng } from '../../../engine/rng'
import { playSfx } from '../../../audio/sfx'
import { Thing } from '../../../art/materials'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { supplyCount, thingOf } from '../answers'
import { CheckButton } from '../CheckButton'
import { hop } from '../motion'
import { Basket } from './Basket'
import type { FaceProps, TaskViewProps } from '../types'

interface Pile {
  thing: string
  items: { tilt: number; nudge: number }[]
}

function pileOf(taskId: string, thing: string, count: number): Pile {
  const rng = makeRng(hashSeed(`count:${taskId}`))
  return { thing, items: Array.from({ length: count }, () => ({ tilt: rng.between(-14, 14), nudge: rng.between(-5, 5) })) }
}

/** The pile is the prompt (`objects`, SK1 convention): the view draws it, the card is left out. */
export const countTapOwnsPrompt = (t: Task) => t.prompt.scene === 'objects'

export function CountTapView({ task, mode, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const thing = thingOf(task)
  const count = supplyCount(task)
  const pile = useMemo(() => pileOf(task.id, thing, count), [task.id, thing, count])
  const [basket, setBasket] = useState<number[]>([])
  const flight = useRef<{ item: number; from: DOMRect; to: 'basket' | 'pile' } | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const input = mode === 'input'

  useLayoutEffect(() => {
    const f = flight.current
    flight.current = null
    if (!f || !root.current) return
    const sel = f.to === 'basket' ? `[data-basket-item="${f.item}"]` : `[data-pile-item="${f.item}"]`
    const el = root.current.querySelector<HTMLElement>(sel)
    if (el) hop(el, f.from, el.getBoundingClientRect())
  }, [basket])

  const take = (i: number, from: Element) => {
    if (!input || basket.includes(i)) return
    onActivity()
    playSfx('pop')
    flight.current = { item: i, from: from.getBoundingClientRect(), to: 'basket' }
    setBasket((b) => [...b, i])
  }

  const giveBack = () => {
    if (!input || basket.length === 0 || !root.current) return
    onActivity()
    const last = basket[basket.length - 1]
    const el = root.current.querySelector(`[data-basket-item="${last}"]`)
    playSfx('fjern')
    if (el) flight.current = { item: last, from: el.getBoundingClientRect(), to: 'pile' }
    setBasket((b) => b.slice(0, -1))
  }

  return (
    <div ref={root} className={cx('tv-count', `is-${mode}`, count > 12 && 'tv-count--many')} data-kind="countTap">
      <div className="tv-count__pile" role="group" aria-label={speech.text('s.kind.countTap.short')}>
        {pile.items.map((it, i) =>
          basket.includes(i) ? (
            <span key={i} className="tv-count__slot" aria-hidden />
          ) : (
            <button
              key={i}
              type="button"
              className="tv-count__item tv-touch"
              disabled={!input}
              onClick={(e) => take(i, e.currentTarget.firstElementChild ?? e.currentTarget)}
              data-pile-item={i}
              aria-label={speech.text('s.round.count.take')}
            >
              <span className="tv-count__art" style={{ transform: `translateY(${it.nudge}px) rotate(${it.tilt}deg)` }}>
                <Thing id={pile.thing} size={46} />
              </span>
            </button>
          ),
        )}
      </div>
      <div className="tv-count__foot">
        <button
          type="button"
          className={cx('tv-count__basket tv-touch', basket.length > 0 && 'has-items')}
          onClick={giveBack}
          disabled={!input}
          aria-label={speech.text('s.round.count.back')}
          data-basket=""
        >
          <Basket rows={Math.max(2, Math.ceil(Math.max(basket.length, count > 10 ? 11 : 1) / 5))}>
            {basket.map((i) => (
              <span key={i} className="tv-count__in" data-basket-item={i}>
                <Thing id={pile.thing} size={34} />
              </span>
            ))}
          </Basket>
          {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
        </button>
        <CheckButton
          valid={basket.length > 0}
          stateKey={String(basket.length)}
          enabled={input}
          taskId={task.id}
          onCheck={() => onSubmit(basket.length)}
        />
      </div>
    </div>
  )
}

/** "7" and the thing (the struck answer, the confirm button): the count was heard as a number. */
export function CountTapFace({ task, value, size }: FaceProps) {
  const n = typeof value === 'number' ? value : 0
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-countface')}>
      <span className="tv-face__num">{n}</span>
      <Thing id={thingOf(task)} size={size === 'lg' ? 44 : size === 'md' ? 38 : 26} />
    </span>
  )
}
