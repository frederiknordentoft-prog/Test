// Loads a species for the rig on demand (species are split into their own chunks, SPEC §12.5).
// A species that is not drawn yet gives null: a story about "ræven" must never show another animal,
// so the scene shows no figure until the fox exists.
import { useEffect, useState } from 'react'
import type { CreatureId, SpeciesDef } from '../../art/rig/types'
import { AVAILABLE_SPECIES, loadSpecies } from '../../art/species/registry'

const ready = new Map<CreatureId, SpeciesDef>()

export function useSpecies(id: CreatureId | null | undefined): SpeciesDef | null {
  const want: CreatureId | null = id && AVAILABLE_SPECIES.includes(id) ? id : null
  const [def, setDef] = useState<SpeciesDef | null>(() => (want ? ready.get(want) ?? null : null))
  useEffect(() => {
    if (!want) {
      setDef(null)
      return
    }
    let alive = true
    const known = ready.get(want)
    if (known) {
      setDef(known)
      return
    }
    loadSpecies(want)
      .then((d) => {
        ready.set(want, d)
        if (alive) setDef(d)
      })
      .catch(() => {
        if (alive) setDef(null)
      })
    return () => {
      alive = false
    }
  }, [want])
  return def
}
