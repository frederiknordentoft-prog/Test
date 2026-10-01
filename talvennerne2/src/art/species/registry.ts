// Arterne indlæses efter behov (SPEC §12.5: ikke-eager glob, buddyen preloades af UI'et).
// En art er en fil `src/art/species/<id>.tsx` med `export default` af en SpeciesDef.
import type { CreatureId, SpeciesDef } from '../rig/types'

const loaders = import.meta.glob<{ default: SpeciesDef }>(['./*.tsx', '!./*.test.tsx'])

/** Arter, der findes som filer lige nu (bølge 1: kanin). */
export const AVAILABLE_SPECIES = Object.keys(loaders).map((k) => k.slice(2, -4)) as CreatureId[]

const cache = new Map<CreatureId, Promise<SpeciesDef>>()

export function loadSpecies(id: CreatureId): Promise<SpeciesDef> {
  let p = cache.get(id)
  if (!p) {
    const load = loaders[`./${id}.tsx`]
    if (!load) return Promise.reject(new Error(`Ukendt art: ${id}`))
    p = load().then((m) => m.default)
    cache.set(id, p)
  }
  return p
}
