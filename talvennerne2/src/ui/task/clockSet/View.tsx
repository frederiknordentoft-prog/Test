// clockSet (SPEC §3.2): the child sets an analog clock. The long minute hand is dragged and lands on
// the skill's step (whole, half and quarter hours, 5 minutes, 1 minute); the short hour hand follows
// it like a gear, and dragged by itself it jumps whole hours. A press away from the hands sends the
// nearer one there. The clock starts where the task says (Task.dialStart: on the step, never the
// answer; 12:00 without one) and never shows the time as digits — reading the hands is the task. The
// tick hands the time in as minutes (0–719, see logic.ts for 24-hour tasks).
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { playSfx } from '../../../audio/sfx'
import { AnalogClock } from '../../../art/materials'
import { useSpeech } from '../../design/speech'
import { isCalm } from '../../design/motion'
import { cx } from '../../design/cx'
import { CheckButton } from '../CheckButton'
import { usePointerDrag } from '../usePointerDrag'
import type { FaceProps, TaskViewProps } from '../types'
import {
  CENTRE, DIAL, KNOB, VIEW_H, VIEW_W, angleOf, clockSetOwnsPrompt, clockStep, dialValue, dragHour, dragMinute,
  hourAngle, jumpMinute, minuteAngle, mod, pickHand, settle, snap, startOf,
} from './logic'
import type { Hand } from './logic'
import './clockSet.css'

interface Held {
  hand: Hand
  /** Minutes the hands show while the finger moves (not yet on the step, may pass 12 either way). */
  raw: number
  /** The finger's last angle (minute hand: the turn since then moves the time). */
  angle: number
}

/** How long a released hand takes to settle on its step (ms). */
const SETTLE_MS = 160

export function ClockSetView({ task, mode, given, onSubmit, onActivity }: TaskViewProps) {
  const speech = useSpeech()
  const step = clockStep(task)
  /** The settled time on the dial, 0–719: what the tick hands in. Starts away from the answer. */
  const [value, setValue] = useState(() => startOf(task))
  /** What the hands show: the finger's position while dragging, then a short glide onto the step. */
  const [shown, setShown] = useState(() => startOf(task))
  const [held, setHeld] = useState<Hand | null>(null)
  const [touched, setTouched] = useState(false)
  const dial = useRef<HTMLDivElement>(null)
  const drag = useRef<Held | null>(null)
  const glideId = useRef(0)
  const lastTick = useRef({ v: startOf(task), at: 0 })
  const input = mode === 'input'

  useEffect(() => () => cancelAnimationFrame(glideId.current), [])

  /** A client point in clock units from the centre of the face. */
  const local = (x: number, y: number) => {
    const svg = dial.current?.querySelector('.tv-clockset__clock')
    if (!svg) return null
    const r = svg.getBoundingClientRect()
    const k = r.width / VIEW_W
    if (k <= 0) return null
    return { x: (x - r.left) / k - CENTRE, y: (y - r.top) / k - CENTRE }
  }

  /** A soft click each time the hands pass a step (not faster than the ear can follow). */
  const tick = (raw: number) => {
    const v = settle(raw, step)
    const now = performance.now()
    if (v !== lastTick.current.v && now - lastTick.current.at > 45) {
      playSfx('tik')
      lastTick.current = { v, at: now }
    }
  }

  /** Hands from `from` to `to` minutes (transform only: the hands rotate), then rest at `rest`. */
  const glide = (from: number, to: number, rest: number) => {
    cancelAnimationFrame(glideId.current)
    if (isCalm() || Math.abs(to - from) < 0.01) {
      setShown(rest)
      return
    }
    const t0 = performance.now()
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / SETTLE_MS)
      const ease = 1 - (1 - p) ** 3
      setShown(p < 1 ? from + (to - from) * ease : rest)
      if (p < 1) glideId.current = requestAnimationFrame(frame)
    }
    glideId.current = requestAnimationFrame(frame)
  }

  const release = () => {
    const d = drag.current
    drag.current = null
    setHeld(null)
    if (!d) return
    const to = snap(d.raw, step)
    const v = mod(to, DIAL)
    setValue(v)
    glide(d.raw, to, v)
  }

  const { bind } = usePointerDrag<'dial'>({
    slop: 2,
    onStart: (_id, s) => {
      if (!input) return false
      const p = local(s.x, s.y)
      const grab = p ? pickHand(value, p.x, p.y) : null
      if (!p || !grab) return false
      cancelAnimationFrame(glideId.current)
      onActivity()
      setTouched(true)
      const angle = angleOf(p.x, p.y)
      const raw = !grab.jump ? value : grab.hand === 'minute' ? jumpMinute(value, angle) : dragHour(value, angle)
      drag.current = { hand: grab.hand, raw, angle }
      setHeld(grab.hand)
      setShown(raw)
      if (grab.jump) tick(raw)
    },
    onMove: (_id, s) => {
      const d = drag.current
      const p = local(s.x, s.y)
      // right over the centre the angle swings wildly: the hands wait for the finger to move out
      if (!d || !p || Math.hypot(p.x, p.y) < 6) return
      const angle = angleOf(p.x, p.y)
      const raw = d.hand === 'minute' ? dragMinute(d.raw, d.angle, angle) : dragHour(d.raw, angle)
      drag.current = { ...d, raw, angle }
      setShown(raw)
      tick(raw)
    },
    onEnd: release,
    onCancel: release,
  })

  const onKey = (e: ReactKeyboardEvent) => {
    if (!input) return
    const by: Record<string, number> = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step, PageUp: 60, PageDown: -60 }
    if (e.key === 'Enter' && touched) {
      e.preventDefault()
      onSubmit(dialValue(task, value))
      return
    }
    if (!(e.key in by)) return
    e.preventDefault()
    onActivity()
    setTouched(true)
    const to = snap(value + by[e.key], step)
    const v = mod(to, DIAL)
    tick(to)
    setValue(v)
    glide(value, to, v)
  }

  const display = (mode === 'correct' || mode === 'wrong') && typeof given === 'number' ? mod(given, DIAL) : shown
  const owned = clockSetOwnsPrompt(task)
  return (
    <div className={cx('tv-clockset', owned && 'tv-clockset--owned', `is-${mode}`, held && 'is-held')} data-kind="clockSet" data-step={step}>
      <div
        ref={dial}
        className={cx('tv-clockset__dial tv-drag', mode === 'correct' && 'is-good', mode === 'wrong' && 'is-oops', !touched && input && 'is-fresh')}
        role="slider"
        tabIndex={input ? 0 : -1}
        aria-label={speech.text('s.kind.clockSet.dial')}
        aria-valuemin={0}
        aria-valuemax={DIAL - 1}
        aria-valuenow={value}
        onKeyDown={onKey}
        data-minutes={value}
        {...bind('dial')}
      >
        <DialArt minutes={display} held={held} />
        {mode === 'wrong' && <span className="tv-strike" aria-hidden />}
      </div>
      <div className="tv-clockset__foot">
        <CheckButton valid={touched} stateKey={String(value)} enabled={input} taskId={task.id} onCheck={() => onSubmit(dialValue(task, value))} />
      </div>
    </div>
  )
}

/** The clock with its grab knobs and the green rim (the view and the demo film draw the same dial). */
export function DialArt({ minutes, held = null }: { minutes: number; held?: Hand | null }) {
  return (
    <>
      <span className="tv-clockset__ring" aria-hidden />
      <AnalogClock minutes={minutes} className="tv-clockset__clock" />
      <svg className="tv-clockset__knobs" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-hidden overflow="visible">
        <g transform={`rotate(${hourAngle(minutes).toFixed(2)} ${CENTRE} ${CENTRE})`}>
          <circle className={cx('tv-clockset__knob is-hour', held === 'hour' && 'is-held')} cx={CENTRE} cy={CENTRE - KNOB.hour} r={8} data-knob="hour" />
        </g>
        <g transform={`rotate(${minuteAngle(minutes).toFixed(2)} ${CENTRE} ${CENTRE})`}>
          <circle className={cx('tv-clockset__knob is-minute', held === 'minute' && 'is-held')} cx={CENTRE} cy={CENTRE - KNOB.minute} r={6.5} data-knob="minute" />
        </g>
      </svg>
    </>
  )
}

const FACE_CLOCK = { sm: 84, md: 100, lg: 132 } as const

/** The clock showing a time (the struck answer, the big confirm button): one clock, no digits. */
export function ClockSetFace({ value, size }: FaceProps) {
  const v = typeof value === 'number' ? value : 0
  return (
    <span className={cx('tv-face', `tv-face--${size}`, 'tv-clockface')}>
      <AnalogClock minutes={mod(v, DIAL)} size={FACE_CLOCK[size]} />
    </span>
  )
}
