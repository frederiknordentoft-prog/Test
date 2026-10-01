// Loads a species for the rig on demand (species are split into their own chunks, SPEC §12.5).
// Falls back to the rabbit while loading or when a species is not drawn yet.
import { useEffect, useState } from 'react'
import type { CreatureId, SpeciesDef } from '../../art/rig/types'
import { AVAILABLE_SPECIES, loadSpecies } from '../../art/species/registry'

const ready = new Map<CreatureId, SpeciesDef>()

export function useSpecies(id: CreatureId | null | undefined): SpeciesDef | null {
  const want: CreatureId = id && AVAILABLE_SPECIES.includes(id) ? id : 'rabbit'
  const [def, setDef] = useState<SpeciesDef | null>(() => ready.get(want) ?? null)
  useEffect(() => {
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
        if (want !== 'rabbit') {
          void loadSpecies('rabbit').then((d) => {
            ready.set('rabbit', d)
            if (alive) setDef(d)
          })
        }
      })
    return () => {
      alive = false
    }
  }, [want])
  return def
}
