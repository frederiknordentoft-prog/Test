// grid (SPEC §3.2, A21): a net with axes 0–6 for setting and reading points.
//   place — the asked point stands under the net, "(3, 2)" with an arrow along under the first number
//           and one up under the second ("først hen, så op"). A tap on the net puts the point on the
//           nearest crossing; a new tap or a drag moves it. On a new key (Task.scaffold) dashed arrows
//           walk from 0 along and up to the child's own point.
//   read  — the point is drawn; the numbers below and left of the net are two strips: a tap (or a
//           drag along a strip) picks that axis' number, and the pair under the net fills in.
// The axis numbers and the arrows share their colours: along is blue, up is orange. The tick hands in
// 'pt:3,2' or 'x:3|y:2' (logic.ts). Pointer events with capture work for touch and mouse alike; the
// net and the strips are one large target each (at least 60 px deep), and the arrows keys move the
// point or the number.
import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { CheckButton } from '../CheckButton'
import { usePointerDrag } from '../usePointerDrag'
import type { DragState } from '../usePointerDrag'
import type { FaceProps, TaskViewProps } from '../types'
import { gridSetup, placeValue, pointOf, readValue } from './logic'
import { CELL, axisAt, crossingAt, frameOf, layers, stepped, ux, uy } from './geometry'
import type { Axis, GridMode, Pt } from './logic'
import './grid.css'

export interface GridArtProps {
  w: number
  h: number
  mode: GridMode
  /** place: the child's point. read: the drawn point. */
  point: Pt | null
  /** read: the numbers picked on each axis. */
  picks?: { x: number | null; y: number | null }
  /** Dashed arrows from 0 along and up to the point (place, on a new key). */
  walk?: boolean
  held?: boolean
  good?: boolean
}

/** The net, its numbers and the point (the view and the demo film draw the same). */
export function GridArt({ w, h, mode, point, picks, walk, held, good }: GridArtProps) {
  const { W, H } = frameOf(w, h)
  const y0 = uy(h, 0)
  const top = uy(h, h)
  const lines = [
    ...Array.from({ length: w }, (_, i) => `M${ux(i + 1)} ${y0}V${top}`),
    ...Array.from({ length: h }, (_, j) => `M${ux(0)} ${uy(h, j + 1)}H${ux(w)}`),
  ].join('')
  const read = mode === 'read'
  return (
    <svg className={cx('tv-grid__svg', good && 'is-good')} viewBox={`0 0 ${W} ${H}`} aria-hidden overflow="visible">
      <rect className="tv-grid__paper" x={ux(0)} y={top} width={w * CELL} height={h * CELL} rx={4} />
      <path className="tv-grid__lines" d={lines} />
      {read && <rect className="tv-grid__band is-x" x={ux(0) - 20} y={y0 + 12} width={w * CELL + 40} height={40} rx={20} />}
      {read && <rect className="tv-grid__band is-y" x={ux(0) - 52} y={top - 20} width={40} height={h * CELL + 40} rx={20} />}
      <path className="tv-grid__axis" d={`M${ux(0)} ${y0}H${ux(w) + 16}M${ux(0)} ${y0}V${top - 16}`} />
      <path className="tv-grid__tip" d={`M${ux(w) + 24} ${y0}l-10 -7v14zM${ux(0)} ${top - 24}l-7 10h14z`} />
      {walk && point && (
        <g className="tv-grid__walk">
          {point.x > 0 && <path className="is-x" d={`M${ux(0)} ${y0}H${ux(point.x) - 8}`} />}
          {point.y > 0 && <path className="is-y" d={`M${ux(point.x)} ${y0}V${uy(h, point.y) + 8}`} />}
        </g>
      )}
      {Array.from({ length: w + 1 }, (_, i) => (
        <AxisNum key={`x${i}`} axis="x" n={i} x={ux(i)} y={y0 + 32} on={picks?.x === i} />
      ))}
      {Array.from({ length: h + 1 }, (_, j) => (
        <AxisNum key={`y${j}`} axis="y" n={j} x={ux(0) - 32} y={uy(h, j)} on={picks?.y === j} />
      ))}
      {point && (
        <g className={cx('tv-grid__point', held && 'is-held', read && 'is-given')} style={{ transform: `translate(${ux(point.x)}px, ${uy(h, point.y)}px)` }} data-point={`${point.x},${point.y}`}>
          <circle className="tv-grid__halo" r={22} />
          <circle className="tv-grid__dot" r={11} />
        </g>
      )}
    </svg>
  )
}

function AxisNum({ axis, n, x, y, on }: { axis: Axis; n: number; x: number; y: number; on: boolean }) {
  return (
    <g className={cx('tv-grid__num', `is-${axis}`, on && 'is-on')} data-num={`${axis}${n}`}>
      <circle cx={x} cy={y} r={17} />
      <text x={x} y={y + 7} textAnchor="middle">
        {n}
      </text>
    </g>
  )
}

/** "(3, 2)" with an arrow along under the first number and one up under the second. */
export function PairCard({ x, y, state = 'idle' }: { x: number | null; y: number | null; state?: 'idle' | 'good' | 'oops' }) {
  return (
    <span className={cx('tv-grid__pair', `is-${state}`)}>
      <span className="tv-grid__paren">(</span>
      <PairNum axis="x" n={x} />
      <span className="tv-grid__comma">,</span>
      <PairNum axis="y" n={y} />
      <span className="tv-grid__paren">)</span>
    </span>
  )
}

function PairNum({ axis, n }: { axis: Axis; n: number | null }) {
  return (
    <span className={cx('tv-grid__pnum', `is-${axis}`, n === null && 'is-blank')}>
      <span className="tv-grid__digit">{n ?? ''}</span>
      <svg className="tv-grid__arrow" viewBox="0 0 24 24" aria-hidden>
        <path d={axis === 'x' ? 'M3 12h14m-5-6 6 6-6 6' : 'M12 21V7m-6 5 6-6 6 6'} />
      </svg>
    </span>
  )
}

const sameAs = (a: Pt | null, b: Pt | null) => !!a && !!b && a.x === b.x && a.y === b.y

export function GridView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const setup = useMemo(() => gridSetup(task) ?? { w: 6, h: 6, mode: 'place' as const, point: { x: 0, y: 0 } }, [task])
  const { w, h } = setup
  const read = setup.mode === 'read'
  const [pt, setPt] = useState<Pt | null>(null)
  const [picks, setPicks] = useState<{ x: number | null; y: number | null }>({ x: null, y: null })
  const [held, setHeld] = useState(false)
  const now = useRef({ pt: null as Pt | null, picks: { x: null as number | null, y: null as number | null } })
  const svg = useRef<HTMLDivElement>(null)
  const input = mode === 'input'
  const box = layers(w, h)

  /** A client point in drawing units. */
  const units = (s: Pick<DragState, 'x' | 'y'>) => {
    const r = svg.current?.querySelector('svg')?.getBoundingClientRect()
    if (!r || r.width <= 0) return null
    const { W, H } = frameOf(w, h)
    return { u: ((s.x - r.left) * W) / r.width, v: ((s.y - r.top) * H) / r.height }
  }

  const put = (q: Pt) => {
    const first = now.current.pt === null
    if (sameAs(q, now.current.pt)) return
    now.current.pt = q
    setPt(q)
    playSfx(first ? 'pop' : 'tik')
  }
  const pick = (axis: Axis, n: number) => {
    if (now.current.picks[axis] === n) return
    now.current.picks = { ...now.current.picks, [axis]: n }
    setPicks(now.current.picks)
    playSfx('tik')
  }
  const at = (id: 'board' | Axis, s: DragState) => {
    const p = units(s)
    if (!p) return
    if (id === 'board') put(crossingAt(p.u, p.v, w, h))
    else pick(id, axisAt(id, id === 'x' ? p.u : p.v, w, h))
  }

  const { bind } = usePointerDrag<'board' | Axis>({
    slop: 4,
    onStart: (id, s) => {
      if (!input) return false
      onActivity()
      setHeld(true)
      at(id, s)
    },
    onMove: (id, s) => at(id, s),
    onEnd: () => setHeld(false),
    onCancel: () => setHeld(false),
  })

  const value = read ? (picks.x !== null && picks.y !== null ? readValue(picks.x, picks.y) : null) : pt && placeValue(pt)
  const submit = () => value && onSubmit(value)

  const onBoardKey = (e: ReactKeyboardEvent) => {
    if (!input) return
    if (e.key === 'Enter' && value) return submit()
    const q = stepped(now.current.pt ?? { x: 0, y: 0 }, e.key, w, h)
    if (!q) return
    e.preventDefault()
    onActivity()
    put(q)
  }
  const onAxisKey = (axis: Axis) => (e: ReactKeyboardEvent) => {
    if (!input) return
    if (e.key === 'Enter' && value) return submit()
    const cur = now.current.picks[axis] ?? 0
    const q = stepped(axis === 'x' ? { x: cur, y: 0 } : { x: 0, y: cur }, e.key, w, h)
    if (!q) return
    e.preventDefault()
    onActivity()
    pick(axis, axis === 'x' ? q.x : q.y)
  }

  // the answer in place after the tick (also after a reload into the struck state)
  const settled = (mode === 'correct' || mode === 'wrong') && given !== null ? pointOf(given) : null
  const shownPt = read ? setup.point : (settled ?? pt)
  const shownPicks = read && settled ? settled : picks
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'
  const axisLayer = (axis: Axis) => (
    <div
      className={cx('tv-grid__layer tv-grid__strip tv-drag', `is-${axis}`)}
      style={box[axis] as CSSProperties}
      role="slider"
      tabIndex={input ? 0 : -1}
      aria-label={speech.text(axis === 'x' ? 's.kind.grid.along' : 's.kind.grid.up')}
      aria-orientation={axis === 'x' ? 'horizontal' : 'vertical'}
      aria-valuemin={0}
      aria-valuemax={axis === 'x' ? w : h}
      aria-valuenow={shownPicks[axis] ?? undefined}
      data-axis={axis}
      onKeyDown={onAxisKey(axis)}
      {...bind(axis)}
    />
  )
  return (
    <div className={cx('tv-grid', `is-${mode}`, `tv-grid--${setup.mode}`)} data-kind="grid" data-grid-mode={setup.mode} data-w={w} data-h={h}>
      <div ref={svg} className={cx('tv-grid__figure', held && 'is-held')}>
        <GridArt w={w} h={h} mode={setup.mode} point={shownPt} picks={shownPicks} walk={!read && task.scaffold} held={held && !read} good={mode === 'correct'} />
        {read ? (
          <>
            {axisLayer('x')}
            {axisLayer('y')}
          </>
        ) : (
          <div
            className="tv-grid__layer tv-grid__board tv-drag"
            style={box.board as CSSProperties}
            role="group"
            tabIndex={input ? 0 : -1}
            aria-label={speech.text('s.kind.grid.board')}
            data-board=""
            onKeyDown={onBoardKey}
            {...bind('board')}
          />
        )}
        {mode === 'wrong' && <span className="tv-strike tv-strike--wide" aria-hidden />}
      </div>
      <div className="tv-grid__foot">
        {/* read: the child's own numbers; place: the question, green once the point is right */}
        {read ? <PairCard x={shownPicks.x} y={shownPicks.y} state={state} /> : <PairCard x={setup.point.x} y={setup.point.y} state={state === 'good' ? 'good' : 'idle'} />}
        <CheckButton valid={value !== null} stateKey={value ?? ''} enabled={input} taskId={task.id} onCheck={submit} />
      </div>
    </div>
  )
}

/** A point as its pair, "(3, 2)" (the struck answer and the big confirm button). */
export function GridFace({ value, size }: FaceProps) {
  const q = pointOf(value)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-gridface')}>
      <PairCard x={q?.x ?? null} y={q?.y ?? null} />
    </span>
  )
}
