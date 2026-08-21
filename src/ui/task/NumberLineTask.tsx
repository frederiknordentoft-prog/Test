import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { TaskProps } from './types'
import { centreOf } from './types'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'

/**
 * Put the number where it belongs. This is the task that builds a sense of how
 * big a number *is*, rather than what it is called — only used on the small
 * ranges, because a tap on a 0–100 line is worth about three units on a phone.
 */
export function NumberLineTask({ task, onAnswer, locked, result, accent }: TaskProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<number | null>(null)
  const [min, max] = task.range

  useEffect(() => {
    setValue(null)
  }, [task.id])

  const place = (clientX: number) => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || locked) return
    const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width))
    const next = Math.round(min + ratio * (max - min))
    setValue((prev) => {
      if (prev !== next) {
        sfx.tap()
        haptics.tap()
      }
      return next
    })
  }

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    place(e.clientX)
  }
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return
    place(e.clientX)
  }

  const span = max - min
  const labelEvery = span <= 12 ? 2 : 5
  const shown = result ? result.answer : value
  const percent = shown === null ? null : ((shown - min) / span) * 100

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6">
      {/* The touch surface reaches past both ends of the line. Without that margin
          the first and last numbers sit on the very edge of the element and a
          child simply cannot hit them — the tap lands outside and nothing happens. */}
      <div
        onPointerDown={onDown}
        onPointerMove={onMove}
        className="relative h-28 w-full touch-none select-none px-7"
        role="slider"
        aria-label="Talrække"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={shown ?? min}
        tabIndex={0}
      >
        <div ref={trackRef} data-numberline-track className="relative h-full w-full">
        <div className="absolute left-0 right-0 top-16 h-1.5 rounded-full bg-white/50" />
        {Array.from({ length: span + 1 }, (_, i) => min + i).map((n) => {
          const labelled = n % labelEvery === 0 || n === min || n === max
          return (
            <div key={n} className="absolute top-16 -translate-x-1/2" style={{ left: `${((n - min) / span) * 100}%` }}>
              <div className="mx-auto rounded-full bg-white/70" style={{ width: 2, height: labelled ? 14 : 8 }} />
              {labelled && <div className="mt-1 text-xs font-bold tabular-nums opacity-90">{n}</div>}
            </div>
          )
        })}
        {percent !== null && (
          <div className="pop-in absolute top-0 -translate-x-1/2 transition-[left] duration-150" style={{ left: `${percent}%` }}>
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl text-2xl font-black tabular-nums shadow-[0_5px_0_rgba(0,0,0,0.3)]"
              style={{
                background: result ? (result.correct ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.9)') : accent,
                color: '#1b1233',
              }}
            >
              {shown}
            </div>
            <div className="mx-auto h-4 w-1 rounded-full" style={{ background: result?.correct ? 'rgb(52 211 153)' : accent }} />
          </div>
        )}
        </div>
      </div>

      <button type="button" disabled={locked || value === null}
        onClick={(e) => value !== null && onAnswer(value, centreOf(e.currentTarget))}
        className="tap-target h-16 w-full max-w-xs rounded-3xl bg-emerald-400 text-2xl font-black text-[#0b2b1d] shadow-[0_6px_0_rgba(0,60,35,0.45)] disabled:opacity-45">
        Sæt her
      </button>
    </div>
  )
}
