// The "Vis mig" film (SPEC §3.4): a ghost hand shows how a task kind is answered in 3–5 s, on a
// small example of its own (never the child's task). It plays by itself the first two times a
// profile meets a kind, and the hand button in the top bar plays it again. A tap anywhere ends it.
//
// A demo is a mini scene plus a script. Steps point the hand at elements marked `data-demo="key"`
// inside the scene (measured at run time, so the film works at every size), press, drag, and change
// the scene's state through `run`.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { IconButton } from '../../design/Button'
import { Icon } from '../../design/Icon'
import { SpokenText } from '../../design/SpokenText'
import { DUR, fade, isCalm, springInY } from '../../design/motion'
import { GhostHand } from './GhostHand'

export interface DemoStep {
  /** Milliseconds from the start of the film. */
  at: number
  /** Element key (`data-demo`) or a point as fractions of the scene ([0.5, 0.5] is the middle). */
  to?: string | [number, number]
  /** Press at the target (finger down and up). */
  tap?: boolean
  /** Keep the finger down while moving (a drag). */
  hold?: boolean
  /** Release a held finger. */
  release?: boolean
  /** Change the scene (a card turns green, a counter jumps into the basket …). */
  run?(): void
  /** Something the hand picks up and carries (a dragged bubble); null drops it. */
  carry?: ReactNode | null
}

export interface DemoStageProps {
  steps: DemoStep[]
  /** Length of the film; it closes 500 ms later. */
  duration: number
  onDone(): void
  children: ReactNode
}

interface Hand {
  x: number
  y: number
  down: boolean
  shown: boolean
  /** Bumps on every tap so the ripple restarts. */
  taps: number
  carry: ReactNode | null
}

const MOVE_MS = 420

export function DemoStage({ steps, duration, onDone, children }: DemoStageProps) {
  const sceneRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const scrimRef = useRef<HTMLDivElement>(null)
  const [hand, setHand] = useState<Hand>({ x: 0, y: 0, down: false, shown: false, taps: 0, carry: null })
  const done = useRef(false)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const finish = () => {
    if (done.current) return
    done.current = true
    doneRef.current()
  }

  useLayoutEffect(() => {
    if (cardRef.current) {
      if (isCalm()) fade(cardRef.current, 0, 1, DUR.fast)
      else springInY(cardRef.current, '24px')
    }
    if (scrimRef.current) fade(scrimRef.current, 0, 1, DUR.base)
  }, [])

  useEffect(() => {
    const timers: number[] = []
    const pointAt = (to: DemoStep['to']): { x: number; y: number } | null => {
      const scene = sceneRef.current
      if (!scene || to === undefined) return null
      const box = scene.getBoundingClientRect()
      if (Array.isArray(to)) return { x: to[0] * box.width, y: to[1] * box.height }
      const el = scene.querySelector(`[data-demo="${to}"]`)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 }
    }
    // the hand starts below the scene and glides in
    const start = sceneRef.current ? { x: sceneRef.current.clientWidth * 0.62, y: sceneRef.current.clientHeight + 40 } : { x: 0, y: 0 }
    setHand({ ...start, down: false, shown: true, taps: 0, carry: null })
    for (const step of steps) {
      timers.push(
        window.setTimeout(() => {
          const p = pointAt(step.to)
          setHand((h) => ({
            ...h,
            ...(p ?? {}),
            down: step.hold ? true : step.release ? false : h.down,
            carry: step.carry !== undefined ? step.carry : h.carry,
          }))
          if (step.tap) {
            timers.push(window.setTimeout(() => setHand((h) => ({ ...h, down: true, taps: h.taps + 1 })), p ? MOVE_MS : 0))
            timers.push(window.setTimeout(() => setHand((h) => ({ ...h, down: false })), (p ? MOVE_MS : 0) + 190))
          }
          if (step.run) {
            const run = step.run
            timers.push(window.setTimeout(run, step.tap ? (p ? MOVE_MS : 0) + 120 : p ? MOVE_MS : 0))
          }
        }, step.at),
      )
    }
    timers.push(window.setTimeout(finish, duration + 500))
    return () => timers.forEach((t) => window.clearTimeout(t))
    // the script is fixed for the life of the film
  }, [])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="tv-demo-root tv-touch" role="dialog" aria-modal="true" onClick={finish} data-demo-film="">
      <div ref={scrimRef} className="tv-demo-scrim" />
      <div ref={cardRef} className="tv-demo">
        <div className="tv-demo__head">
          <span className="tv-demo__badge" aria-hidden>
            <Icon name="hand" size={26} strokeWidth={2.4} />
          </span>
          <SpokenText clip="s.ui.showMe" silent className="tv-demo__title" />
          <IconButton icon="close" clip="s.ui.close" variant="card" onClick={finish} className="tv-demo__close" />
        </div>
        <div ref={sceneRef} className="tv-demo__scene">
          {children}
          <div
            className="tv-demo__hand"
            data-down={hand.down ? '' : undefined}
            style={{ transform: `translate(${hand.x}px, ${hand.y}px)`, opacity: hand.shown ? 1 : 0 }}
            aria-hidden
          >
            {hand.taps > 0 && <span key={hand.taps} className="tv-demo__ripple" />}
            {hand.carry && <span className="tv-demo__carry">{hand.carry}</span>}
            <GhostHand />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
