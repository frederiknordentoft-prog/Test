// pair (SPEC §3.2, tenFriends only): "træk to bobler sammen". The given number floats in a bubble
// next to an empty one; the child drags the partner bubble into the empty one (a quick tap works
// too — small fingers slip). The two bubbles then make the ten together.
import { useLayoutEffect, useRef, useState } from 'react'
import type { AnswerValue, Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { formatNumber, pairSum } from '../answers'
import { hop } from '../motion'
import { inside, usePointerDrag } from '../usePointerDrag'
import { OptionFace } from '../faces'
import type { FaceProps, TaskViewProps } from '../types'

interface Drag {
  i: number
  dx: number
  dy: number
}

/** Pair draws its own sum when the prompt is the equation, so the prompt card is left out. */
export const pairOwnsPrompt = (t: Task) => t.prompt.scene === 'equation'

export function PairView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const { anchor, total } = pairSum(task)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [hover, setHover] = useState(false)
  const [landed, setLanded] = useState<number | null>(null)
  const socket = useRef<HTMLDivElement>(null)
  const from = useRef<DOMRect | null>(null)
  const input = mode === 'input'
  const shownIndex = landed ?? (given !== null && mode !== 'input' ? task.options.findIndex((o) => o === given) : null)
  const shown: AnswerValue | null = shownIndex !== null && shownIndex >= 0 ? task.options[shownIndex] : null

  useLayoutEffect(() => {
    const box = from.current
    from.current = null
    const el = socket.current?.querySelector<HTMLElement>('.tv-bubble')
    if (box && el) hop(el, box, el.getBoundingClientRect())
  }, [landed])

  const land = (i: number, el: Element | null) => {
    from.current = el ? el.getBoundingClientRect() : null
    setDrag(null)
    setHover(false)
    setLanded(i)
    playSfx('boble')
    onSubmit(task.options[i])
  }

  const { bind } = usePointerDrag<number>({
    onStart: (i) => {
      if (!input || landed !== null) return false
      onActivity()
      playSfx('tryk')
      setDrag({ i, dx: 0, dy: 0 })
    },
    onMove: (i, s) => {
      setDrag({ i, dx: s.dx, dy: s.dy })
      setHover(inside(socket.current, s.x, s.y, 36))
    },
    onEnd: (i, s, tap) => {
      const el = document.querySelector(`[data-pair-option="${i}"]`)
      if (tap || inside(socket.current, s.x, s.y, 44)) land(i, el)
      else {
        setDrag(null)
        setHover(false)
      }
    },
    onCancel: () => {
      setDrag(null)
      setHover(false)
    },
  })

  return (
    <div className={cx('tv-pair', `is-${mode}`)} data-kind="pair">
      <div className="tv-pair__sum">
        <span className="tv-bubble tv-bubble--anchor">{anchor !== null ? formatNumber(anchor) : '?'}</span>
        <span className="tv-pair__op">+</span>
        <div ref={socket} className={cx('tv-pair__socket', hover && 'is-hover', shown !== null && 'is-full', `is-${mode}`)} data-socket="">
          {shown !== null ? (
            <span className={cx('tv-bubble tv-bubble--in', mode === 'correct' && 'is-good', mode === 'wrong' && 'is-oops')}>
              <OptionFace task={task} value={shown} size="md" />
              {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
            </span>
          ) : (
            <span className="tv-pair__q">?</span>
          )}
        </div>
        <span className="tv-pair__op">=</span>
        <span className="tv-bubble tv-bubble--total">{formatNumber(total)}</span>
      </div>
      <div className="tv-pair__pool">
        {task.options.map((o, i) => {
          const dragging = drag?.i === i
          const gone = shownIndex === i
          return (
            <button
              key={String(o)}
              type="button"
              className={cx('tv-bubble tv-bubble--option tv-drag tv-touch', dragging && 'is-dragging', gone && 'is-gone')}
              style={{ transform: dragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.12)` : undefined, animationDelay: `${-i * 0.7}s` }}
              disabled={!input || gone}
              aria-label={String(o)}
              data-option={String(o)}
              data-pair-option={i}
              {...bind(i)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') land(i, e.currentTarget)
              }}
            >
              <OptionFace task={task} value={o} size="md" />
            </button>
          )
        })}
      </div>
      <span className="tv-sr">{speech.text('s.kind.pair.short')}</span>
    </div>
  )
}

export function PairFace({ task, value, size }: FaceProps) {
  const { anchor } = pairSum(task)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-pairface')}>
      {anchor !== null && <span className="tv-bubble tv-bubble--anchor tv-bubble--mini">{formatNumber(anchor)}</span>}
      <span className="tv-bubble tv-bubble--mini">
        <OptionFace task={task} value={value} size="sm" />
      </span>
    </span>
  )
}
