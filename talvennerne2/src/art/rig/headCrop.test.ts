// The head crop (crop 'head': the HUD avatar, the friend stone, the egg's choices, the rainbow friend's
// choice, Samlebogen) for every species × breed × stage, bare-headed and in three hats. QA3b P2-6: the
// polar bear's snout points left in three-quarter profile and was cut off at the nose by a box round
// the head's ellipse; `snoutBox` brings the snout into the crop. The snapshot holds every viewBox, so a
// change to any other species' crop shows in its diff.
import { describe, expect, it } from 'vitest'
import { astronautHead } from '../items/astronaut/astronaut-head'
import { festHead } from '../items/fest/fest-head'
import { hverdagHead } from '../items/hverdag/hverdag-head'
import { polarbear } from '../species/polarbear'
import { cropViewBox, worldBounds } from './Rig'
import { STAGES } from './types'
import type { ItemDef, Outfit, SpeciesDef } from './types'

const SPECIES_FILES = import.meta.glob<{ default: SpeciesDef }>(['../species/*.tsx', '!../species/*.test.tsx'], { eager: true })
const ALL_SPECIES: readonly SpeciesDef[] = Object.values(SPECIES_FILES)
  .map((m) => m.default)
  .sort((a, b) => a.id.localeCompare(b.id))
const HATS: readonly ItemDef[] = [hverdagHead, festHead, astronautHead]

const box = (vb: string) => {
  const [x, y, w, h] = vb.split(' ').map(Number)
  return { x0: x, y0: y, x1: x + w, y1: y + h }
}

describe('the head crop', () => {
  it('covers all sixteen species', () => {
    expect(ALL_SPECIES).toHaveLength(16)
  })

  it('is the same viewBox as before for every species but the polar bear', () => {
    const table: Record<string, string> = {}
    for (const def of ALL_SPECIES) {
      for (const breed of def.breeds) {
        for (const stage of STAGES) {
          table[`${def.id}/${breed.id}/${stage}`] = cropViewBox(def, breed.id, stage, 'head')
          for (const hat of HATS) {
            const outfit = { head: { item: hat, colorway: 'a' } } as unknown as Outfit
            table[`${def.id}/${breed.id}/${stage}/${hat.id}`] = cropViewBox(def, breed.id, stage, 'head', outfit)
          }
        }
      }
    }
    expect(table).toMatchSnapshot()
  })

  it("takes the polar bear's snout and nose with it, the head in the middle", () => {
    for (const stage of STAGES) {
      const b = box(cropViewBox(polarbear, 'std', stage, 'head'))
      const head = worldBounds(polarbear, 'std', stage).head
      // the snout's tip (the head's drawn bounds reach it on the left) is inside, with air
      expect(b.x0, `stage ${stage}`).toBeLessThan(head.x0)
      // and the back of the head on the right too: the head is whole, not pushed to one side
      const cx = (b.x0 + b.x1) / 2
      expect(Math.abs(cx - (head.x0 + head.x1) / 2), `stage ${stage}`).toBeLessThan(6)
    }
  })
})
