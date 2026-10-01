// The buddy beside the task (SPEC §6.3, spildesign §3.4): the child's own animal in its chosen form
// and outfit, as one animated <Rig>. Its eyes follow the child's finger, it hops on a right answer,
// thinks with the child, and dances at five in a row. Without a buddy (or before its species is
// drawn) the rabbit sits in.
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Animal, Mood, Slot } from '../../../../engine/types'
import { Rig } from '../../../../art/rig/Rig'
import type { BreedId, ColorwayId, Outfit, Pt, Stage } from '../../../../art/rig/types'
import { loadItem } from '../../../../art/items/registry'
import { cx } from '../../../design/cx'
import { isCalm } from '../../../design/motion'
import { useSpecies } from '../../../scenes/useSpecies'

function useOutfit(animal: Animal | null | undefined): Outfit | undefined {
  const [outfit, setOutfit] = useState<Outfit | undefined>(undefined)
  const key = animal ? JSON.stringify(animal.outfit) : ''
  useEffect(() => {
    let alive = true
    const worn = animal ? (Object.entries(animal.outfit) as [Slot, { item: string; color: 0 | 1 | 2 }][]) : []
    if (worn.length === 0) {
      setOutfit(undefined)
      return
    }
    Promise.all(worn.map(([slot, w]) => loadItem(w.item as never).then((item) => [slot, { item, colorway: w.color }] as const).catch(() => null)))
      .then((list) => {
        if (!alive) return
        const out: Outfit = {}
        for (const e of list) if (e) out[e[0]] = e[1]
        setOutfit(out)
      })
    return () => {
      alive = false
    }
    // the outfit is keyed by its content
  }, [key])
  return outfit
}

/** Pupils follow the last touch on the screen for a moment, then drift back to the mood's gaze. */
function useFingerGaze(ref: RefObject<HTMLDivElement | null>): Pt | null {
  const [at, setAt] = useState<Pt | null>(null)
  useEffect(() => {
    let last = 0
    let rest = 0
    const onPointer = (e: PointerEvent) => {
      const now = performance.now()
      if (now - last < 90 || !ref.current) return
      last = now
      const r = ref.current.getBoundingClientRect()
      if (r.width === 0) return
      setAt({ x: ((e.clientX - r.left) / r.width) * 200, y: ((e.clientY - r.top) / r.height) * 240 })
      window.clearTimeout(rest)
      rest = window.setTimeout(() => setAt(null), 2200)
    }
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointermove', onPointer)
      window.clearTimeout(rest)
    }
  }, [ref])
  return at
}

export interface BuddyProps {
  animal: Animal | null | undefined
  mood: Mood
  /** Five in a row: the superdance. */
  dancing?: boolean
  className?: string
}

export function Buddy({ animal, mood, dancing, className }: BuddyProps) {
  const def = useSpecies(animal?.species ?? 'rabbit')
  const outfit = useOutfit(animal)
  const box = useRef<HTMLDivElement>(null)
  const gaze = useFingerGaze(box)
  const calm = isCalm()
  const stage = (animal ? (animal.shown === 'star' ? 3 : animal.shown) : 2) as Stage
  return (
    <div ref={box} className={cx('tv-buddy', dancing && !calm && 'is-dancing', className)} data-mood={mood}>
      {def && (
        <Rig
          species={def}
          breed={(animal && animal.species === def.id ? animal.breed : undefined) as BreedId | undefined}
          stage={stage}
          colorway={(animal && animal.species === def.id ? animal.colorway : 'c1') as ColorwayId}
          star={animal?.shown === 'star'}
          mood={mood}
          outfit={animal?.species === def.id ? outfit : undefined}
          lookAt={mood === 'think' || mood === 'idle' ? gaze : null}
          seed={11}
          size="100%"
          className={calm ? 'rig-calm' : undefined}
        />
      )}
    </div>
  )
}
