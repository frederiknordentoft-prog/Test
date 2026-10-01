// Screen transitions (SPEC §11): the new screen slides 24 px in from its travel direction and fades
// in over 220 ms while the old one slides out the other way; calm mode and reduced motion crossfade.
// WAAPI only, transform and opacity only. The leaving screen is inert and removed when done.
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { screenIn, screenOut } from '../design/motion'
import type { ScreenDirection } from '../design/motion'

interface Layer {
  id: number
  key: string
  state: 'enter' | 'idle' | 'exit'
  dir: ScreenDirection
}

export interface ScreenStackProps {
  /** Changing the key starts a transition to `children`. */
  screenKey: string
  direction?: ScreenDirection
  children: ReactNode
}

let nextId = 1

export function ScreenStack({ screenKey, direction = 'forward', children }: ScreenStackProps) {
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: nextId++, key: screenKey, state: 'idle', dir: 'none' }])
  const [prevKey, setPrevKey] = useState(screenKey)
  if (screenKey !== prevKey) {
    setPrevKey(screenKey)
    setLayers((prev) => [
      ...prev.filter((l) => l.state !== 'exit').map((l) => ({ ...l, state: 'exit' as const, dir: direction })),
      { id: nextId++, key: screenKey, state: 'enter', dir: direction },
    ])
  }
  // The last children each layer showed, so a leaving screen keeps its final look.
  const shown = useRef(new Map<number, ReactNode>())
  const active = layers.find((l) => l.state !== 'exit' && l.key === screenKey)
  useLayoutEffect(() => {
    if (active) shown.current.set(active.id, children)
  })
  const remove = useCallback((id: number) => {
    shown.current.delete(id)
    setLayers((prev) => prev.filter((l) => l.id !== id))
  }, [])
  const settle = useCallback((id: number) => setLayers((prev) => prev.map((l) => (l.id === id && l.state === 'enter' ? { ...l, state: 'idle' } : l))), [])
  return (
    <div className="tv-stage">
      {layers.map((l) => (
        <ScreenLayer key={l.id} layer={l} onExited={remove} onEntered={settle}>
          {l === active ? children : shown.current.get(l.id)}
        </ScreenLayer>
      ))}
    </div>
  )
}

function ScreenLayer({
  layer,
  onExited,
  onEntered,
  children,
}: {
  layer: Layer
  onExited: (id: number) => void
  onEntered: (id: number) => void
  children: ReactNode
}) {
  const el = useRef<HTMLDivElement>(null)
  const { state, dir, id } = layer
  useLayoutEffect(() => {
    const node = el.current
    if (!node || state === 'idle') return
    const a = state === 'enter' ? screenIn(node, dir) : screenOut(node, dir)
    a.onfinish = () => {
      if (state === 'enter') {
        a.cancel()
        onEntered(id)
      } else onExited(id)
    }
    return () => a.cancel()
  }, [state, dir, id, onExited, onEntered])
  const leaving = state === 'exit'
  return (
    <div ref={el} className="tv-screen" data-leaving={leaving ? '' : undefined} aria-hidden={leaving || undefined} inert={leaving || undefined}>
      {children}
    </div>
  )
}
