// Dragging for the task kinds (pair bubbles, the number-line pin). Pointer events with pointer
// capture, so a finger that leaves the element keeps dragging it; the element itself must have
// `touch-action: none` (class tv-drag) or iOS scrolls instead. A press that hardly moves is a tap:
// children's fingers wobble, and an input that only accepts a clean drag feels broken.
import { useCallback, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface DragState {
  /** Pointer position now (client px). */
  x: number
  y: number
  /** Movement since the press (px). */
  dx: number
  dy: number
  /** True once the pointer moved more than the tap slop. */
  moved: boolean
}

export interface PointerDragOptions<T> {
  /** Return false to refuse the drag (locked task). */
  onStart?(id: T, s: DragState, e: ReactPointerEvent<Element>): boolean | void
  onMove?(id: T, s: DragState): void
  /** `tap` is true when the press never moved past the slop. */
  onEnd?(id: T, s: DragState, tap: boolean): void
  onCancel?(id: T): void
  /** Movement that turns a press into a drag (px, default 8). */
  slop?: number
}

/**
 * Returns `bind(id)`: the pointer handlers for one draggable element. Only one pointer drags at a
 * time; a second finger is ignored until the first lets go.
 */
export function usePointerDrag<T>(opts: PointerDragOptions<T>) {
  const ref = useRef(opts)
  ref.current = opts
  const active = useRef<{ id: T; pointer: number; x0: number; y0: number; s: DragState } | null>(null)

  const bind = useCallback(
    (id: T) => ({
      onPointerDown(e: ReactPointerEvent<Element>) {
        if (active.current) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        const s: DragState = { x: e.clientX, y: e.clientY, dx: 0, dy: 0, moved: false }
        if (ref.current.onStart?.(id, s, e) === false) return
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // synthetic events in tests have no capture target
        }
        active.current = { id, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, s }
      },
      onPointerMove(e: ReactPointerEvent<Element>) {
        const a = active.current
        if (!a || a.pointer !== e.pointerId) return
        const dx = e.clientX - a.x0
        const dy = e.clientY - a.y0
        a.s = { x: e.clientX, y: e.clientY, dx, dy, moved: a.s.moved || Math.hypot(dx, dy) > (ref.current.slop ?? 8) }
        ref.current.onMove?.(a.id, a.s)
      },
      onPointerUp(e: ReactPointerEvent<Element>) {
        const a = active.current
        if (!a || a.pointer !== e.pointerId) return
        active.current = null
        const s = { ...a.s, x: e.clientX, y: e.clientY }
        ref.current.onEnd?.(a.id, s, !s.moved)
      },
      onPointerCancel(e: ReactPointerEvent<Element>) {
        const a = active.current
        if (!a || a.pointer !== e.pointerId) return
        active.current = null
        ref.current.onCancel?.(a.id)
      },
    }),
    [],
  )

  return { bind, dragging: () => active.current?.id ?? null }
}

/** Centre of an element in client px (fly-to animations, drop targets). */
export function centreOf(el: Element | null): { x: number; y: number } | null {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** Whether a client point is inside an element's box, grown by `slack` px on every side. */
export function inside(el: Element | null, x: number, y: number, slack = 0): boolean {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return x >= r.left - slack && x <= r.right + slack && y >= r.top - slack && y <= r.bottom + slack
}
