// numberline (SPEC §3.2): tap or drag on the line to set the pin, then the tick. 0–20 is exact,
// 0–100 allows ±5 and 0–1000 ±50 (Task.tolerance). The pin never shows its number: on 0–100 a
// number badge would turn "where is 37?" into reading, not estimating.
import { useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { NL, NumberLine, xOf } from '../../../art/materials'
import { blob } from '../../../art/materials/geom'
import { useSpeech } from '../../design/speech'
import { cx } from '../../design/cx'
import { formatNumber, lineRange, lineRatio, lineValue } from '../answers'
import { CheckButton } from '../CheckButton'
import { usePointerDrag } from '../usePointerDrag'
import type { FaceProps, TaskViewProps } from '../types'

const PIN_HEAD = blob([[0, -34], [-12, -43], [-19, -55], [-14, -69], [0, -75], [14, -69], [19, -55], [12, -43]], 0.85)

/** The map-pin marker standing on the line at x (NumberLine units). */
export function Pin({ x, state, lifted }: { x: number; state: 'idle' | 'good' | 'oops' | 'ghost'; lifted?: boolean }) {
  return (
    <g className={cx('tv-pin', `is-${state}`, lifted && 'is-lifted')} style={{ transform: `translate(${x}px, ${NL.Y}px)` }}>
      <g className="tv-pin__body">
        <path className="tv-pin__stem" d="M0 -6V-40" />
        <path className="tv-pin__head" d={PIN_HEAD} />
        <circle className="tv-pin__dot" cx={0} cy={-54} r={6.5} />
        <circle className="tv-pin__foot" cx={0} cy={0} r={6} />
      </g>
    </g>
  )
}

export function NumberlineView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const [min, max] = lineRange(task)
  const [value, setValue] = useState<number | null>(null)
  const [dragging, setDragging] = useState(false)
  const svg = useRef<SVGSVGElement>(null)
  const input = mode === 'input'

  const valueAt = (clientX: number): number | null => {
    const el = svg.current
    if (!el) return null
    const r = el.getBoundingClientRect()
    const x = ((clientX - r.left) / r.width) * NL.W
    return lineValue((x - NL.PAD) / (NL.W - 2 * NL.PAD), min, max)
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
  const x = shown === null ? null : xOf(min + lineRatio(shown, min, max) * (max - min), min, max)
  const state = mode === 'correct' ? 'good' : mode === 'wrong' ? 'oops' : 'idle'
  return (
    <div className={cx('tv-nline', `is-${mode}`)} data-kind="numberline">
      <div
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
        {...bind('line')}
      >
        <NumberLine min={min} max={max} className="tv-nline__line" />
        <svg ref={svg} className="tv-nline__overlay" viewBox={`0 0 ${NL.W} ${NL.H}`} preserveAspectRatio="xMidYMid meet" aria-hidden overflow="visible">
          {x === null ? (
            <g className="tv-nline__hint">
              <circle cx={NL.W / 2} cy={NL.Y} r={16} />
            </g>
          ) : (
            <Pin x={x} state={state} lifted={dragging} />
          )}
        </svg>
        {mode === 'wrong' && <span className="tv-strike tv-strike--pin" aria-hidden style={{ left: `${((x ?? 0) / NL.W) * 100}%` }} />}
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
  const x = xOf(v, min, max)
  const w = size === 'lg' ? 210 : size === 'md' ? 170 : 120
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-nlineface')}>
      <span className="tv-nlineface__num">{formatNumber(v)}</span>
      <svg viewBox={`0 0 ${NL.W} ${NL.H}`} width={w} height={(w * NL.H) / NL.W} aria-hidden overflow="visible">
        <path className="tv-nlineface__axis" d={`M${NL.PAD - 10} ${NL.Y}H${NL.W - NL.PAD + 10}`} />
        <path className="tv-nlineface__ends" d={`M${NL.PAD} ${NL.Y - 14}v28M${NL.W - NL.PAD} ${NL.Y - 14}v28`} />
        <Pin x={x} state="ghost" />
      </svg>
    </span>
  )
}
