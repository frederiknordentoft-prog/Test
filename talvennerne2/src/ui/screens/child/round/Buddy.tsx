// The buddy beside the task (SPEC §6.3, spildesign §3.4): the child's own animal in its chosen form
// and outfit, as one animated <Rig>. Its eyes follow the child's finger, it hops on a right answer,
// thinks with the child, and dances at five in a row. The child never sees another animal than its
// own (review P1-2): without a buddy, or while its species is not drawn yet, the neutral egg-shaped
// stand-in (onboarding/Critter.tsx) sits there instead, and it turns into the real drawing by itself
// once the species file lands in src/art/species/.
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Animal, Mood, Slot, SpeciesId } from '../../../../engine/types'
import { Rig } from '../../../../art/rig/Rig'
import type { CreatureId, Outfit, Pt, SpeciesDef, Stage } from '../../../../art/rig/types'
import { loadItem } from '../../../../art/items/registry'
import { AVAILABLE_SPECIES, loadSpecies } from '../../../../art/species/registry'
import { cx } from '../../../design/cx'
import { isCalm } from '../../../design/motion'
import { Critter } from '../onboarding/Critter'

/** True when the species has a drawing (otherwise the stand-in is shown). */
export const isDrawnSpecies = (id: SpeciesId): boolean => AVAILABLE_SPECIES.includes(id as CreatureId)

const loaded = new Map<SpeciesId, SpeciesDef>()

/** The species' drawing, loaded on demand: null while it loads and for a species without one. */
function useDrawnSpecies(id: SpeciesId | null): SpeciesDef | null {
  const want = id && isDrawnSpecies(id) ? id : null
  const [def, setDef] = useState<SpeciesDef | null>(() => (want ? (loaded.get(want) ?? null) : null))
  const [prev, setPrev] = useState(want)
  if (prev !== want) {
    setPrev(want)
    setDef(want ? (loaded.get(want) ?? null) : null)
  }
  useEffect(() => {
    if (!want || loaded.has(want)) return
    let alive = true
    loadSpecies(want as CreatureId).then(
      (d) => {
        loaded.set(want, d)
        if (alive) setDef(d)
      },
      () => undefined,
    )
    return () => {
      alive = false
    }
  }, [want])
  return def
}

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
  const species = animal?.species ?? null
  const drawn = !!species && isDrawnSpecies(species)
  const def = useDrawnSpecies(species)
  const outfit = useOutfit(animal)
  const box = useRef<HTMLDivElement>(null)
  const gaze = useFingerGaze(box)
  const calm = isCalm()
  const stage = (animal ? (animal.shown === 'star' ? 3 : animal.shown) : 2) as Stage
  return (
    <div
      ref={box}
      className={cx('tv-buddy', dancing && !calm && 'is-dancing', className)}
      data-mood={mood}
      data-buddy={species ?? ''}
      data-standin={drawn ? undefined : ''}
    >
      {animal && def && def.id === animal.species && (
        <Rig
          species={def}
          breed={animal.breed}
          stage={stage}
          colorway={animal.colorway}
          star={animal.shown === 'star'}
          mood={mood}
          outfit={outfit}
          lookAt={mood === 'think' || mood === 'idle' ? gaze : null}
          seed={11}
          size="100%"
          className={calm ? 'rig-calm' : undefined}
        />
      )}
      {!drawn && <Critter mood={mood} />}
    </div>
  )
}
