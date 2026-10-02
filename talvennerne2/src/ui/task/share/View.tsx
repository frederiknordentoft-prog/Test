// share (SPEC §3.2): N things lie in a pile above k plates. A tap on a plate gives it one thing from
// the pile (it hops over); a thing can also be dragged from the pile onto a plate. A thing dragged
// off a plate goes back to the pile (or onto another plate), so a deal can be mended. When the pile
// is empty the tick hands in how many each plate got — or −1 when they did not all get the same,
// which the round recognises as an uneven deal (shareUnequal). No numbers are shown: counting is
// the child's job.
import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { Thing } from '../../../art/materials'
import { hashSeed, makeRng } from '../../../engine/rng'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { CheckButton } from '../CheckButton'
import { hop } from '../motion'
import { inside, usePointerDrag } from '../usePointerDrag'
import type { FaceProps, FaceSize, TaskViewProps } from '../types'
import { countsOf, nextFromPile, rememberDeal, rememberedDeal, shareOwnsPrompt, shareSetup, shareValue } from './logic'
import type { ShareSetup } from './logic'
import './share.css'

interface Deal {
  /** Things still in the pile (their indices, in pile order). */
  pile: number[]
  /** Things on each plate, in the order they arrived. */
  plates: number[][]
}

type DragId = `pile:${number}` | `plate:${number}`
const numOf = (id: DragId) => Number(id.slice(id.indexOf(':') + 1))

const fresh = (s: ShareSetup): Deal => ({ pile: Array.from({ length: s.total }, (_, i) => i), plates: Array.from({ length: s.plates }, () => [] as number[]) })

/** Columns of things on a plate: room for an equal share, more when a plate gets more. */
const plateCols = (count: number, fair: number) => Math.min(5, Math.max(2, Math.ceil(Math.sqrt(Math.max(count, fair)))))

/** The pile's things lie a little askew, the same way every time for a task. */
function tilts(taskId: string, n: number): { tilt: number; nudge: number }[] {
  const rng = makeRng(hashSeed(`share:${taskId}`))
  return Array.from({ length: n }, () => ({ tilt: rng.between(-16, 16), nudge: rng.between(-4, 4) }))
}

export function ShareView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const setup = useMemo(() => shareSetup(task) ?? { total: 6, plates: 2, thing: 'carrot' }, [task])
  const looks = useMemo(() => tilts(task.id, setup.total), [task.id, setup.total])
  const [deal, setDeal] = useState<Deal>(() => fresh(setup))
  const [drag, setDrag] = useState<{ item: number; dx: number; dy: number } | null>(null)
  const [target, setTarget] = useState<number | 'pile' | null>(null)
  const [nudge, setNudge] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const pileRef = useRef<HTMLDivElement>(null)
  const grabbed = useRef<{ plate: number | null; item: number | null }>({ plate: null, item: null })
  const flight = useRef<{ item: number; from: DOMRect } | null>(null)
  const input = mode === 'input'
  const fair = Math.ceil(setup.total / setup.plates)
  const counts = deal.plates.map((p) => p.length)

  useLayoutEffect(() => {
    const f = flight.current
    flight.current = null
    if (!f || !root.current) return
    const el = root.current.querySelector<HTMLElement>(`[data-thing="${f.item}"]`)
    if (el) hop(el, f.from, el.getBoundingClientRect())
  }, [deal])

  const rectOf = (item: number) => root.current?.querySelector(`[data-thing="${item}"]`)?.getBoundingClientRect() ?? null

  /** Moves one thing to a plate (or back to the pile with plate = null), flying from `from`. */
  const place = (item: number, plate: number | null, from: DOMRect | null) => {
    if (!input) return
    onActivity()
    playSfx(plate === null ? 'fjern' : 'pop')
    flight.current = from ? { item, from } : null
    setDeal((d) => {
      const pile = d.pile.filter((i) => i !== item)
      const plates = d.plates.map((list) => list.filter((i) => i !== item))
      if (plate === null) {
        pile.push(item)
        pile.sort((a, b) => a - b)
      } else plates[plate].push(item)
      return { pile, plates }
    })
  }

  const give = (plate: number) => {
    const item = nextFromPile(deal.pile)
    if (item === null) return
    place(item, plate, rectOf(item))
  }

  /** The plate under a point, 'pile', or null (anywhere else). */
  const dropAt = (x: number, y: number): number | 'pile' | null => {
    const plates = root.current ? [...root.current.querySelectorAll<HTMLElement>('[data-plate]')] : []
    const hit = plates.find((el) => inside(el, x, y, 6))
    if (hit) return Number(hit.dataset.plate)
    return inside(pileRef.current, x, y, 10) ? 'pile' : null
  }

  const { bind } = usePointerDrag<DragId>({
    onStart: (id, _s, e: ReactPointerEvent<Element>) => {
      if (!input) return false
      onActivity()
      if (id.startsWith('plate')) {
        const on = (e.target as Element).closest?.('[data-plate-item]')
        grabbed.current = { plate: numOf(id), item: on ? Number(on.getAttribute('data-plate-item')) : null }
      } else grabbed.current = { plate: null, item: numOf(id) }
    },
    onMove: (_id, s) => {
      const { item } = grabbed.current
      if (!s.moved || item === null) return
      setDrag({ item, dx: s.dx, dy: s.dy })
      setTarget(dropAt(s.x, s.y))
    },
    onEnd: (id, s, tap) => {
      const { plate, item } = grabbed.current
      grabbed.current = { plate: null, item: null }
      const from = item !== null ? rectOf(item) : null
      setDrag(null)
      setTarget(null)
      if (id.startsWith('plate')) {
        if (tap || item === null) give(numOf(id))
        else {
          const to = dropAt(s.x, s.y)
          if (to !== plate) place(item, typeof to === 'number' ? to : null, from)
        }
        return
      }
      // a thing in the pile: dragged onto a plate it lands there; a tap shows where to tap instead
      if (item === null) return
      const to = tap ? null : dropAt(s.x, s.y)
      if (typeof to === 'number') place(item, to, from)
      else if (tap) setNudge((n) => n + 1)
    },
    onCancel: () => {
      grabbed.current = { plate: null, item: null }
      setDrag(null)
      setTarget(null)
    },
  })

  const onPlateKey = (plate: number) => (e: ReactKeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    give(plate)
  }

  const submit = () => {
    const value = shareValue(task, counts)
    rememberDeal(task.id, value, counts)
    onSubmit(value)
  }

  const lift = (item: number): CSSProperties | undefined =>
    drag && drag.item === item ? { transform: `translate(${drag.dx}px, ${drag.dy}px) scale(1.15)`, zIndex: 6 } : undefined

  const size = setup.total <= 10 ? 'lg' : setup.total <= 20 ? 'md' : 'sm'
  const settled = mode === 'correct' || mode === 'wrong'
  // a reload into the struck state has no deal of its own: the remembered one, else the right one
  const shownPlates = settled && deal.pile.length === setup.total && given !== null ? platesFor(task, given, setup) : deal.plates
  return (
    <div
      ref={root}
      className={cx('tv-deal', `tv-deal--${size}`, shareOwnsPrompt(task) && 'tv-deal--owned', `is-${mode}`)}
      style={{ '--plates': setup.plates, '--cols': setup.plates <= 5 ? setup.plates : Math.ceil(setup.plates / 2) } as CSSProperties}
      data-kind="share"
    >
      <div
        ref={pileRef}
        className={cx('tv-deal__pile', deal.pile.length === 0 && 'is-empty', target === 'pile' && 'is-over')}
        role="group"
        aria-label={speech.text('s.kind.share.pile')}
        data-pile=""
      >
        {deal.pile.map((i) => (
          <span key={i} className="tv-deal__thing tv-deal__loose tv-drag" data-thing={i} style={lift(i)} {...bind(`pile:${i}`)}>
            <span className="tv-deal__art" style={{ transform: `translateY(${looks[i].nudge}px) rotate(${looks[i].tilt}deg)` }}>
              <Thing id={setup.thing} />
            </span>
          </span>
        ))}
      </div>
      <div className={cx('tv-deal__plates', nudge > 0 && 'is-nudged', mode === 'correct' && 'is-good')} key={`n${nudge}`}>
        {shownPlates.map((list, p) => (
          <button
            key={p}
            type="button"
            className={cx('tv-deal__plate tv-drag tv-touch', target === p && 'is-over')}
            disabled={!input}
            aria-label={speech.text('s.kind.share.plate')}
            data-plate={p}
            onKeyDown={onPlateKey(p)}
            {...bind(`plate:${p}`)}
          >
            <span className="tv-deal__dish" aria-hidden />
            <span className="tv-deal__on" style={{ '--pc': plateCols(list.length, fair) } as CSSProperties}>
              {list.map((i) => (
                <span key={i} className="tv-deal__thing" data-thing={i} data-plate-item={i} style={lift(i)}>
                  <Thing id={setup.thing} />
                </span>
              ))}
            </span>
          </button>
        ))}
        {mode === 'wrong' && <span className="tv-strike tv-strike--wide" aria-hidden />}
      </div>
      <div className="tv-deal__foot">
        <CheckButton valid={deal.pile.length === 0} stateKey={counts.join(',')} enabled={input} taskId={task.id} onCheck={submit} />
      </div>
    </div>
  )
}

/** Things on each plate for an answer value: the child's remembered deal, else equal plates. */
function platesFor(task: TaskViewProps['task'], value: NonNullable<TaskViewProps['given']>, setup: ShareSetup): number[][] {
  const counts = rememberedDeal(task.id, value) ?? countsOf(task, value) ?? Array.from({ length: setup.plates }, () => 0)
  let next = 0
  return counts.map((c) => Array.from({ length: c }, () => next++))
}

const FACE_PLATE: Record<FaceSize, number> = { sm: 34, md: 46, lg: 58 }

/** The plates of a deal, small (the struck deal is the child's own; the confirm shows equal plates). */
export function ShareFace({ task, value, size }: FaceProps) {
  const setup = shareSetup(task) ?? { total: 6, plates: 2, thing: 'carrot' }
  const counts = rememberedDeal(task.id, value) ?? countsOf(task, value) ?? Array.from({ length: setup.plates }, () => 0)
  const fair = Math.ceil(setup.total / setup.plates)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-dealface')} style={{ '--plate': `${FACE_PLATE[size]}px` } as CSSProperties}>
      {counts.map((c, p) => (
        <span key={p} className="tv-dealface__plate">
          <span className="tv-deal__dish" aria-hidden />
          <span className="tv-deal__on" style={{ '--pc': plateCols(c, fair) } as CSSProperties}>
            {Array.from({ length: c }, (_, i) => (
              <span key={i} className="tv-deal__thing">
                <Thing id={setup.thing} />
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}
