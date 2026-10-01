// Klip-id'er for kunstens navne (SPEC §10.2, låst i ids.lock.json: clipPatterns). Teksterne ligger
// i navnekataloget (src/speech/clips/names/catalog.ts), som bygges af indholdskataloget.
import type { BreedId, ClipId, ColorwayId, CreatureId, ItemId } from './types'

export const speciesClip = (id: CreatureId): ClipId => `name.species.${id}`
export const breedClip = (id: BreedId): ClipId => `name.breed.${id}`
export const colorClip = (species: CreatureId, colorway: ColorwayId): ClipId => `name.color.${species}.${colorway}`
export const itemClip = (id: ItemId): ClipId => `name.item.${id}`
