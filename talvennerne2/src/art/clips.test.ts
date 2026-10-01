// Navne og klip-id'er (opgave 7): arter, racer, farver og genstande bruger de låste mønstre
// `name.species.<id>`, `name.breed.<id>`, `name.color.<art>.<farve>` og `name.item.<id>`, og klippene
// findes i navnekataloget. Kunstens danske navne og kilder stemmer med indholdskataloget.
import { describe, expect, it } from 'vitest'
import { BREED_NAMES, ITEM_BY_ID, SPECIES_BY_ID } from '../content/catalog'
import { clips } from '../speech/clips/names/catalog'
import { festHead } from './items/fest/fest-head'
import { hverdagBody } from './items/hverdag/hverdag-body'
import { hverdagHead } from './items/hverdag/hverdag-head'
import { breedClip, colorClip, itemClip, speciesClip } from './rig/clips'
import { magicOf, resolveColorway } from './rig/Rig'
import { BREEDS, NATURAL_COLORWAYS } from './rig/types'
import { cat } from './species/cat'
import { horse } from './species/horse'
import { rabbit } from './species/rabbit'
import { unicorn } from './species/unicorn'

const SPECIES = [rabbit, cat, horse, unicorn]

describe('klip-id\'er for kunsten', () => {
  it('arterne bruger name.species.<id>, og klippet findes', () => {
    for (const def of SPECIES) {
      expect(def.nameClip).toBe(`name.species.${def.id}`)
      expect(def.nameClip).toBe(speciesClip(def.id))
      expect(clips[def.nameClip], def.nameClip).toBe(SPECIES_BY_ID[def.id as 'cat'].name)
    }
  })

  it('racerne er kontraktens racer i rækkefølge, og name.breed.<id> findes', () => {
    for (const def of SPECIES) {
      expect(def.breeds.map((b) => b.id)).toEqual([...BREEDS[def.id as keyof typeof BREEDS]])
      for (const b of def.breeds) expect(clips[breedClip(b.id)], breedClip(b.id)).toBe(BREED_NAMES[b.id])
    }
  })

  it('farverne hedder det samme som i kataloget, og name.color.<art>.<farve> findes', () => {
    for (const def of SPECIES) {
      const meta = SPECIES_BY_ID[def.id as 'cat']
      NATURAL_COLORWAYS.forEach((c, i) => {
        expect(def.colorways[c].name, `${def.id} ${c}`).toBe(meta.colors[i])
        expect(clips[colorClip(def.id, c)], colorClip(def.id, c)).toBe(meta.colors[i])
      })
      for (const b of def.breeds)
        for (const m of magicOf(def, b.id)) expect(clips[colorClip(def.id, m)], colorClip(def.id, m)).toBe(resolveColorway(def, m).name)
    }
  })

  it('Stjernefølet: stjernehvid findes kun som enhjørningeføl', () => {
    for (const def of SPECIES)
      for (const b of def.breeds) expect(magicOf(def, b.id).includes('starwhite'), `${def.id}/${b.id}`).toBe(def.id === 'unicorn' && b.id === 'foal')
  })

  it('genstandene bruger name.item.<id> og har katalogets kilde', () => {
    for (const it of [hverdagHead, festHead, hverdagBody]) {
      expect(it.nameClip).toBe(itemClip(it.id))
      expect(clips[it.nameClip], it.nameClip).toBeTruthy()
      expect(it.source).toEqual(ITEM_BY_ID[it.id].source)
    }
  })
})
