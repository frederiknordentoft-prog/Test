import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { TaskProps } from './types'
import { centreOf } from './types'
import { TenFrame } from './Manipulatives'
import { sfx } from '../../audio/sfx'
import { haptics } from '../../fx/haptics'

interface Drag {
  option: number
  dx: number
  dy: number
  moved: boolean
}

/**
 * Drag the bubble that makes ten onto its partner.
 *
 * Dragging is the point: pairing to ten is a physical idea, and moving one number
 * into another says that better than picking from a list. A quick tap works too —
 * small fingers slip, and an input that only accepts a clean drag feels broken.
 */
export function PairTask({ task, onAnswer, locked, result, accent }: TaskProps) {
  const targetRef = useRef<HTMLDivElement>(null)
  const startRef = useRef({ x: 0, y: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [flying, setFlying] = useState<number | null>(null)

  useEffect(() => {
    setDrag(null)
    setFlying(null)
  }, [task.id])

  const land = (option: number, at: { x: number; y: number }) => {
    setDrag(null)
    setFlying(option)
    window.setTimeout(() => onAnswer(option, at), 200)
  }

  const onDown = (option: number) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (locked || flying !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    startRef.current = { x: e.clientX, y: e.clientY }
    setDrag({ option, dx: 0, dy: 0, moved: false })
    sfx.tap()
    haptics.tap()
  }

  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    setDrag((d) => {
      if (!d) return d
      const dx = e.clientX - startRef.current.x
      const dy = e.clientY - startRef.current.y
      return { ...d, dx, dy, moved: d.moved || Math.hypot(dx, dy) > 8 }
    })
  }

  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag
    if (!d) return
    const box = targetRef.current?.getBoundingClientRect()
    // generous drop zone — this is a six-year-old's aim, not a designer's
    const dropped =
      box !== undefined &&
      e.clientX > box.left - 44 && e.clientX < box.right + 44 &&
      e.clientY > box.top - 44 && e.clientY < box.bottom + 44

    if (!d.moved || dropped) land(d.option, centreOf(targetRef.current))
    else setDrag(null)
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5">
      {/* the empty squares are the answer — you can count them */}
      <TenFrame filled={task.a} added={result?.correct ? task.answer : 0} color={accent} showGap size={24} />

      <div className="flex items-center gap-4">
        <div className="grid h-24 w-24 place-items-center rounded-full text-5xl font-black tabular-nums shadow-[0_6px_0_rgba(0,0,0,0.3)]"
          style={{ background: accent, color: '#1b1233' }}>
          {task.a}
        </div>
        <span className="text-4xl font-black opacity-85">+</span>
        <div ref={targetRef}
          className="grid h-24 w-24 place-items-center rounded-full border-4 border-dashed text-4xl font-black transition-colors"
          style={{
            borderColor: result?.correct ? 'rgb(52 211 153)' : 'rgba(255,255,255,0.45)',
            background: result?.correct ? 'rgba(52,211,153,0.3)' : drag ? 'rgba(255,255,255,0.16)' : 'transparent',
          }}>
          {result ? <span className={result.correct ? 'punch' : 'nudge'}>{task.answer}</span> : <span className="opacity-70">?</span>}
        </div>
        <span className="text-4xl font-black opacity-85">=</span>
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white/12 text-4xl font-black ring-1 ring-white/25">10</div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        {task.options.map((option) => {
          const isDragging = drag?.option === option
          const isFlying = flying === option
          return (
            <button
              key={option}
              type="button"
              disabled={locked || (flying !== null && !isFlying)}
              onPointerDown={onDown(option)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={() => setDrag(null)}
              className="grid h-[4.25rem] w-[4.25rem] touch-none place-items-center rounded-full bg-white/95 text-4xl font-black tabular-nums text-[#1b1233] shadow-[0_6px_0_rgba(0,0,0,0.3)] sm:h-20 sm:w-20"
              style={{
                transform: isDragging ? `translate(${drag.dx}px, ${drag.dy}px) scale(1.12)` : isFlying ? 'scale(0.2)' : 'none',
                opacity: isFlying ? 0 : 1,
                transition: isDragging ? 'none' : 'transform .22s cubic-bezier(.34,1.56,.64,1), opacity .22s ease',
                zIndex: isDragging ? 40 : 1,
              }}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}
