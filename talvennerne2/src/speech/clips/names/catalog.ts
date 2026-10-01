// Spoken names for everything in the catalogue and on the map (SPEC §10.2 "Navne"): species, babies,
// breeds, colours, items, sets, worlds, regions, trophies and decor. Built from the content tables, so
// a new item or region gets its clip id (`name.*`, see ids.lock.json) without touching this file.
// The 120 suggested animal names per species live in their own file (names/animals.ts).
import type { ClipId, ColorwayId, SetId, WorldId } from '../../../engine/types'
import { DECOR, ITEMS, SPECIES, TROPHIES, BREED_NAMES, setName } from '../../../content/catalog'
import { REGIONS, WORLDS } from '../../../content/curriculum'
import type { Wave } from '../../catalog'

const MAGIC_NAMES: Readonly<Record<Extract<ColorwayId, 'gold' | 'rainbow' | 'starwhite'>, string>> = {
  gold: 'guld',
  rainbow: 'regnbue',
  starwhite: 'stjernehvid',
}

const WORLD_WAVE: Readonly<Record<WorldId, Wave>> = { eng: 1, bakke: 2, skov: 2, fjeld: 3 }
/** Sets the vertical slice (Engdalen) needs first. */
const WAVE1_SETS: readonly (SetId | 'milepael')[] = ['hverdag', 'opdager', 'milepael', 'pirat']

const table: Record<ClipId, string> = {}
const waves: Record<ClipId, Wave> = {}
const put = (id: ClipId, text: string, w: Wave) => {
  table[id] = text
  waves[id] = w
}

for (const s of SPECIES) {
  const w = WORLD_WAVE[s.world]
  put(`name.species.${s.id}`, s.name, w)
  put(`name.baby.${s.id}`, s.baby, w)
  s.colors.forEach((color, i) => put(`name.color.${s.id}.c${i + 1}`, color, w))
  for (const magic of ['gold', 'rainbow'] as const) put(`name.color.${s.id}.${magic}`, MAGIC_NAMES[magic], 1)
  for (const breed of s.breeds) if (breed !== 'std') put(`name.breed.${breed}`, BREED_NAMES[breed], w)
}
put('name.color.unicorn.starwhite', MAGIC_NAMES.starwhite, 1)

for (const item of ITEMS) {
  put(item.nameClip, item.name, WAVE1_SETS.includes(item.set) ? 1 : item.set === 'astronaut' ? 3 : 2)
}
for (const set of ['hverdag', 'opdager', 'rytter', 'kongelig', 'astronaut', 'ridder', 'talmagiker', 'pirat', 'fodbold', 'vinter', 'fest'] as const) {
  put(`name.set.${set}`, setName(set), WAVE1_SETS.includes(set) ? 1 : set === 'astronaut' ? 3 : 2)
}

for (const world of WORLDS) put(world.nameClip, world.name, 1)
for (const region of REGIONS) put(region.nameClip, region.name, WORLD_WAVE[region.world])
for (const trophy of TROPHIES) put(`name.trophy.${trophy.id}`, trophy.name, 2)
for (const decor of DECOR) put(`name.decor.${decor.id}`, decor.name, 2)

export const clips = table

export function wave(id: ClipId): Wave {
  return waves[id] ?? 2
}
