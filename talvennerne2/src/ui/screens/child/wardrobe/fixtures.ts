// Test support for the wardrobe and the shop: a child with a rabbit, some things and perler. Never
// imported by the app.
import { newProfileDoc } from '../../../../data/repo/profiles'
import type { Animal, InventoryEntry, ItemColor, ItemId, ProfileDoc, SpeciesId } from '../../../../engine/types'
import { chooseStarter } from '../../../../meta/actions'

export const T = Date.parse('2026-10-01T15:00:00Z')

const own = (colors: ItemColor[] = [0]): InventoryEntry => ({ at: T, colors })

/** Ada (0. kl.) with her rabbit as buddy, level 4, the first three Hverdag things and 300 perler. */
export function child(inventory: Partial<Record<ItemId, ItemColor[]>> = { 'hverdag-head': [0], 'hverdag-neck': [0], 'hverdag-body': [0, 2] }): ProfileDoc {
  const p = chooseStarter(newProfileDoc('Ada', 0, { id: 'kid', now: T }), 'rabbit', { now: T })!.profile
  const inv: ProfileDoc['inventory'] = {}
  for (const [item, colors] of Object.entries(inventory) as [ItemId, ItemColor[]][]) inv[item] = own(colors)
  return { ...p, economy: { ...p.economy, perler: 300, xp: 760, level: 4 }, inventory: inv }
}

/** Another animal for the child (not the buddy). */
export function withAnimal(p: ProfileDoc, species: SpeciesId, uid = `egg-${p.animals.length}`): ProfileDoc {
  const a: Animal = {
    uid, species, breed: 'std', colorway: 'c1', name: 'Sky', friendship: 0, stage: 1, star: false, shown: 1, outfit: {}, foundAt: T, source: 'egg',
  }
  return { ...p, animals: [...p.animals, a] }
}

export function wearing(p: ProfileDoc, uid: string, outfit: Animal['outfit']): ProfileDoc {
  return { ...p, animals: p.animals.map((a) => (a.uid === uid ? { ...a, outfit } : a)) }
}
