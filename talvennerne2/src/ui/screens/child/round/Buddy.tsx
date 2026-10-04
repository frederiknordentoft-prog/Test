// The buddy beside the task (SPEC §6.3, spildesign §3.4): the child's own animal in its chosen form
// and outfit, as one animated <Rig>. Its eyes follow the child's finger, it hops on a right answer,
// thinks with the child, and dances at five in a row. The child never sees another animal than its
// own (review P1-2): without a buddy, or while its species is not drawn yet, the neutral egg-shaped
// stand-in (onboarding/Critter.tsx) sits there instead, and it turns into the real drawing by itself
// once the species file lands in src/art/species/.
import { memo, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Animal, Mood, Slot, SpeciesId } from '../../../../engine/types'
import { Rig } from '../../../../art/rig/Rig'
import type { CreatureId, ItemDef, Outfit, Pt, SpeciesDef, Stage } from '../../../../art/rig/types'
import { loadItem } from '../../../../art/items/registry'
import { AVAILABLE_SPECIES, loadSpecies } from '../../../../art/species/registry'
import { cx } from '../../../design/cx'
import { isCalm } from '../../../design/motion'
import { Critter } from '../onboarding/Critter'

/** True when the species has a drawing (otherwise the stand-in is shown). */
export const isDrawnSpecies = (id: SpeciesId): boolean => AVAILABLE_SPECIES.includes(id as CreatureId)

const loaded = new Map<SpeciesId, SpeciesDef>()

/** Load a drawn species ahead, so the buddy appears at once (a species without a drawing is skipped). */
export async function preloadBuddy(id: SpeciesId): Promise<void> {
  if (!isDrawnSpecies(id) || loaded.has(id)) return
  loaded.set(id, await loadSpecies(id as CreatureId))
}

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

/** Items loaded once, by any buddy: the next buddy wearing them is dressed from its first frame. */
const loadedItems = new Map<string, ItemDef>()

type WornList = [Slot, { item: string; color: 0 | 1 | 2 }][]
const wornOf = (animal: Animal | null | undefined): WornList => (animal ? (Object.entries(animal.outfit) as WornList) : [])

/** The outfit from loaded items: undefined when nothing is worn, null while an item is still missing. */
function cachedOutfit(worn: WornList): Outfit | undefined | null {
  if (worn.length === 0) return undefined
  const out: Outfit = {}
  for (const [slot, w] of worn) {
    const item = loadedItems.get(w.item)
    if (!item) return null
    out[slot] = { item, colorway: w.color }
  }
  return out
}

function useOutfit(animal: Animal | null | undefined): Outfit | undefined {
  const key = animal ? JSON.stringify(animal.outfit) : ''
  const [outfit, setOutfit] = useState<Outfit | undefined>(() => cachedOutfit(wornOf(animal)) ?? undefined)
  const [prev, setPrev] = useState(key)
  if (prev !== key) {
    setPrev(key)
    // a change to loaded items shows at once; otherwise the old outfit stays until the new one is in
    const cached = cachedOutfit(wornOf(animal))
    if (cached !== null) setOutfit(cached)
  }
  useEffect(() => {
    const worn = wornOf(animal)
    if (cachedOutfit(worn) !== null) return
    let alive = true
    Promise.all(
      worn.map(([slot, w]) =>
        loadItem(w.item as never)
          .then((item) => {
            loadedItems.set(w.item, item)
            return [slot, { item, colorway: w.color }] as const
          })
          .catch(() => null),
      ),
    ).then((list) => {
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

/**
 * Pupils follow the last touch on the screen for a moment, then drift back to the mood's gaze. Only
 * listened for while the mood looks around (think, idle): other moods have their own gaze.
 */
function useFingerGaze(ref: RefObject<HTMLDivElement | null>, active: boolean): Pt | null {
  const [at, setAt] = useState<Pt | null>(null)
  const rest = useRef(0)
  useEffect(() => () => window.clearTimeout(rest.current), [])
  useEffect(() => {
    if (!active) return
    let last = 0
    const onPointer = (e: PointerEvent) => {
      const now = performance.now()
      if (now - last < 90 || !ref.current) return
      last = now
      const r = ref.current.getBoundingClientRect()
      if (r.width === 0) return
      setAt({ x: ((e.clientX - r.left) / r.width) * 200, y: ((e.clientY - r.top) / r.height) * 240 })
      window.clearTimeout(rest.current)
      rest.current = window.setTimeout(() => setAt(null), 2200)
    }
    window.addEventListener('pointerdown', onPointer, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('pointermove', onPointer)
    }
  }, [ref, active])
  return at
}

export interface BuddyProps {
  animal: Animal | null | undefined
  mood: Mood
  /** Five in a row: the superdance. */
  dancing?: boolean
  className?: string
}

/** Memoised: the round re-renders on every beat, and the buddy only when its own props change. */
export const Buddy = memo(function Buddy({ animal, mood, dancing, className }: BuddyProps) {
  const species = animal?.species ?? null
  const drawn = !!species && isDrawnSpecies(species)
  const def = useDrawnSpecies(species)
  const outfit = useOutfit(animal)
  const box = useRef<HTMLDivElement>(null)
  const looks = mood === 'think' || mood === 'idle'
  const gaze = useFingerGaze(box, looks)
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
          lookAt={looks ? gaze : null}
          seed={11}
          size="100%"
          className={calm ? 'rig-calm' : undefined}
        />
      )}
      {!drawn && <Critter mood={mood} />}
    </div>
  )
})
