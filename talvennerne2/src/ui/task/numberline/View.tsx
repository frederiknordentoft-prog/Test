// numberline (SPEC §3.2): tap or drag on the line to set the pin, then the tick. 0–20 is exact,
// 0–100 allows ±5 and 0–1000 ±50 (Task.tolerance). The pin never shows its number: on 0–100 a
// number badge would turn "where is 37?" into reading, not estimating.
//
// The line is drawn at the screen's own pixel size (measured), so its numbers stay readable on a
// phone: labels thin out until they have room (0–20 every other number on an iPhone, all on iPad).
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { Task } from '../../../engine/types'
import { playSfx } from '../../../audio/sfx'
import { niceStep } from '../../../art/materials'
import { blob } from '../../../art/materials/geom'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { formatNumber, lineRange, lineRatio, lineValue } from '../answers'
import { CheckButton } from '../CheckButton'
import { usePointerDrag } from '../usePointerDrag'
import type { FaceProps, TaskViewProps } from '../types'

const PIN_HEAD = blob([[0, -34], [-12, -43], [-19, -55], [-14, -69], [0, -75], [14, -69], [19, -55], [12, -43]], 0.85)

export type PinState = 'idle' | 'good' | 'oops' | 'ghost'

/** The map-pin marker standing on the line at (x, y). */
export function Pin({ x, y, state, lifted }: { x: number; y: number; state: PinState; lifted?: boolean }) {
  return (
    <g className={cx('tv-pin', `is-${state}`, lifted && 'is-lifted')} style={{ transform: `translate(${x}px, ${y}px)` }}>
      <g className="tv-pin__body">
        <path className="tv-pin__stem" d="M0 -6V-40" />
        <path className="tv-pin__head" d={PIN_HEAD} />
        <circle className="tv-pin__dot" cx={0} cy={-54} r={6.5} />
        <circle className="tv-pin__foot" cx={0} cy={0} r={6} />
      </g>
    </g>
  )
}

export interface LineGeometry {
  w: number
  h: number
  /** y of the line. */
  y: number
  pad: number
  x(v: number): number
  /** Value at an x (px), rounded and clamped. */
  at(x: number): number
  minor: number[]
  major: number[]
  labels: number[]
  font: number
}

const digits = (v: number) => formatNumber(v).length

/** Ticks and labels for a line of `w` px: labels thin out until every one has room. */
export function lineGeometry(min: number, max: number, w: number, big = false): LineGeometry {
  const font = big ? 20 : 16
  const h = big ? 150 : 124
  const y = big ? 104 : 86
  const pad = Math.max(22, Math.ceil(digits(max) * font * 0.3) + 10)
  const span = Math.max(1, max - min)
  const step = niceStep(span)
  const inner = Math.max(40, w - 2 * pad)
  const room = (every: number) => (inner * every) / span
  const need = (every: number) => ((digits(max) + digits(Math.max(min, max - every))) / 2) * font * 0.58 + 6
  // label intervals that divide the line and land on ticks, smallest first
  const options: number[] = []
  for (let e = step; e <= span; e += step) if (span % e === 0) options.push(e)
  const every = options.find((e) => room(e) >= need(e)) ?? span
  const minor: number[] = []
  const major: number[] = []
  const ticks = Math.round(span / step)
  for (let i = 0; i <= ticks; i++) {
    const v = min + i * step
    if ((v - min) % every === 0) major.push(v)
    else minor.push(v)
  }
  const x = (v: number) => pad + ((v - min) / span) * inner
  return { w, h, y, pad, x, at: (px: number) => lineValue((px - pad) / inner, min, max), minor, major, labels: major, font }
}

/** The line itself (axis, ticks, numbers) in px. */
export function LineArt({ g }: { g: LineGeometry }) {
  const minor = g.minor.map((v) => `M${g.x(v).toFixed(1)} ${g.y - 7}v14`).join('')
  const major = g.major.map((v) => `M${g.x(v).toFixed(1)} ${g.y - 12}v24`).join('')
  return (
    <g className="tv-nline__art">
      <path className="tv-nline__axis" d={`M${g.pad - 16} ${g.y}H${g.w - g.pad + 14}`} />
      <path className="tv-nline__arrow" d={`M${g.w - g.pad + 22} ${g.y}l-11 -7v14z`} />
      <path className="tv-nline__minor" d={minor} />
      <path className="tv-nline__major" d={major} />
      {g.labels.map((v) => (
        <text key={v} className="tv-nline__label" x={g.x(v)} y={g.y + 22 + g.font * 0.75} fontSize={g.font} textAnchor="middle">
          {formatNumber(v)}
        </text>
      ))}
    </g>
  )
}

/** Width of an element, kept up to date. */
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number] {
  const [w, setW] = useState(0)
  const ro = useRef<ResizeObserver | null>(null)
  const ref = useCallback((el: T | null) => {
    ro.current?.disconnect()
    if (!el) return
    setW(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    ro.current = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.current.observe(el)
  }, [])
  useLayoutEffect(() => () => ro.current?.disconnect(), [])
  return [ref, w]
}

/**
 * A number-line prompt is the answer surface itself, so the view draws it and the card is left out.
 * Its arrow, target and hops are never drawn here: in a numberline task they could give the answer
 * away ("hvilket tal kommer efter 7?" is only spoken).
 */
export const numberlineOwnsPrompt = (t: Task) => t.prompt.scene === 'line'

const isBig = () => typeof matchMedia === 'function' && matchMedia('(min-width: 700px) and (min-height: 700px)').matches

export function NumberlineView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const [min, max] = lineRange(task)
  const [value, setValue] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const [boxRef, width] = useWidth<HTMLDivElement>()
  const surface = useRef<HTMLDivElement | null>(null)
  const input = mode === 'input'
  const g = lineGeometry(min, max, Math.max(200, width || 340), isBig())

  const valueAt = (clientX: number): number | null => {
    const el = surface.current
    if (!el) return null
    return g.at(clientX - el.getBoundingClientRect().left)
  }

  const set = (v: number | null) => {
    if (v === null) return
    setValue((prev) => {
      if (prev !== v) playSfx('tik')
      return v
    })
  }

  const { bind } = usePointerDrag<'line'>({
    slop: 2,
    onStart: (_id, s) => {
      if (!input) return false
      onActivity()
      setDragging(true)
      set(valueAt(s.x))
    },
    onMove: (_id, s) => set(valueAt(s.x)),
    onEnd: () => setDragging(false),
    onCancel: () => setDragging(false),
  })

  const onKey = (e: ReactKeyboardEvent) => {
    if (!input) return
    const step = max - min > 100 ? 10 : 1
    if (e.key === 'ArrowLeft') set(Math.max(min, (value ?? min) - step))
    else if (e.key === 'ArrowRight') set(Math.min(max, (value ?? min) + step))
    else if (e.key === 'Enter' && value !== null) onSubmit(value)
    else return
    e.preventDefault()
  }

  const shown = mode === 'input' || mode === 'idle' ? value : typeof given === 'number' ? given : value
  const x = shown === null ? null : g.x(min + lineRatio(shown, min, max) * (max - min))
  const state: PinState = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'
  return (
    <div className={cx('tv-nline', `is-${mode}`)} data-kind="numberline">
      <div
        ref={(el) => {
          surface.current = el
          boxRef(el)
        }}
        className="tv-nline__surface tv-drag"
        role="slider"
        tabIndex={input ? 0 : -1}
        aria-label={speech.text('s.kind.numberline.short')}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value ?? undefined}
        onKeyDown={onKey}
        data-line-min={min}
        data-line-max={max}
        data-line-pad={g.pad}
        style={{ height: g.h }}
        {...bind('line')}
      >
        <svg className="tv-nline__svg" viewBox={`0 0 ${g.w} ${g.h}`} width={g.w} height={g.h} aria-hidden overflow="visible">
          <LineArt g={g} />
          {x === null ? (
            <circle className="tv-nline__hint" cx={g.x((min + max) / 2)} cy={g.y} r={15} />
          ) : (
            <Pin x={x} y={g.y} state={state} lifted={dragging} />
          )}
        </svg>
        {mode === 'wrong' && x !== null && <span className="tv-strike tv-strike--pin" aria-hidden style={{ left: x, top: g.y - 54 }} />}
      </div>
      <div className="tv-nline__foot">
        <CheckButton valid={value !== null} stateKey={String(value)} enabled={input} taskId={task.id} onCheck={() => value !== null && onSubmit(value)} />
      </div>
    </div>
  )
}

/** A short line with the pin at the value and the value written above it. */
export function NumberlineFace({ task, value, size }: FaceProps) {
  const [min, max] = lineRange(task)
  const v = typeof value === 'number' ? value : min
  const w = size === 'lg' ? 200 : size === 'md' ? 160 : 110
  const pad = 14
  const x = pad + lineRatio(v, min, max) * (w - 2 * pad)
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-nlineface')}>
      <span className="tv-nlineface__num">{formatNumber(v)}</span>
      <svg viewBox={`0 -4 ${w} 40`} width={w} height={40} aria-hidden overflow="visible">
        <path className="tv-nlineface__axis" d={`M4 24H${w - 4}`} />
        <path className="tv-nlineface__ends" d={`M${pad} 16v16M${w - pad} 16v16`} />
        <circle className="tv-nlineface__dot" cx={x} cy={24} r={8} />
      </svg>
    </span>
  )
}
