// Demo profiles for Dyrehaven and the books (tests, screenshots and manual checks on the dev
// server). Never imported by the app.
//   zooDemoProfile  Ida, 1. klasse, three weeks in: sixteen animals of eight species (four not drawn
//                   yet), the Stjernefølet, a golden cat and a rainbow rabbit, a golden pick waiting,
//                   a warm egg, four decor pieces, medals, stamps and trophies.
//   zooNewProfile   Bo on his first day: only the starter rabbit.
// seedZooDemo() writes Ida (and Bo) into IndexedDB:
//   const { seedZooDemo } = await import('/src/ui/screens/child/animals/testing/demo.ts')
import { chooseStarter } from '../../../../../meta/actions'
import { stageFor } from '../../../../../meta/animals'
import { friendshipLevel } from '../../../../../content/economy'
import { newProfileDoc, listProfiles, putProfile, deleteProfile, freeFrameColors } from '../../../../../data/repo/profiles'
import type { Animal, BreedId, ColorwayId, ProfileDoc, SpeciesId, TrophyId } from '../../../../../engine/types'
import { friendRegionOf } from '../../books/model'

export const ZOO_DEMO_ID = 'p-zoo-demo'
export const ZOO_NEW_ID = 'p-zoo-new'
/** 1 October 2026, 10:00 in Copenhagen. */
export const DEMO_NOW = Date.parse('2026-10-01T08:00:00Z')
const DAY = 86_400_000

function animal(
  uid: string, species: SpeciesId, breed: BreedId, colorway: ColorwayId, name: string, friendship: number,
  source: Animal['source'], foundAt: number, outfit: Animal['outfit'] = {},
): Animal {
  const level = friendshipLevel(friendship)
  const star = level >= 10
  const stage = stageFor(level)
  return { uid, species, breed, colorway, name, friendship, stage, star, shown: star ? 'star' : stage, outfit, foundAt, source }
}

const friendUid = (species: SpeciesId) => `friend-${friendRegionOf(species)!.id}-friend`

export function zooDemoProfile(now = DEMO_NOW): ProfileDoc {
  const t0 = now - 21 * DAY
  const at = (d: number) => t0 + d * DAY
  const animals: Animal[] = [
    animal('starter-rabbit', 'rabbit', 'upright', 'c1', 'Kløver', 540, 'starter', at(0), {
      head: { item: 'hverdag-head', color: 0 },
      body: { item: 'hverdag-body', color: 1 },
    }),
    animal(friendUid('rabbit'), 'rabbit', 'upright', 'c4', 'Mille', 30, 'friend', at(1)),
    animal(friendUid('cat'), 'cat', 'domestic', 'c2', 'Misse', 120, 'friend', at(2)),
    animal('egg-1', 'rabbit', 'upright', 'c3', 'Bomuld', 0, 'egg', at(2.5)),
    animal('egg-2', 'cat', 'domestic', 'c5', 'Kanel', 180, 'egg', at(4)),
    animal('egg-3', 'rabbit', 'lop', 'c2', 'Trille', 60, 'egg', at(5)),
    animal(friendUid('puppy'), 'puppy', 'std', 'c1', 'Logre', 45, 'friend', at(6)),
    animal(friendUid('hedgehog'), 'hedgehog', 'std', 'c3', 'Pigge', 10, 'friend', at(8)),
    animal('starfoal-count10', 'unicorn', 'foal', 'starwhite', 'Stjernelys', 270, 'starFoal', at(9)),
    animal(friendUid('horse'), 'horse', 'shetland', 'c2', 'Brise', 90, 'friend', at(10)),
    animal('egg-4', 'horse', 'shetland', 'c5', 'Saga', 20, 'egg', at(11)),
    animal('gold-cat', 'cat', 'domestic', 'gold', 'Ingefær', 0, 'gold', at(12)),
    animal('egg-5', 'cat', 'domestic', 'c1', 'Silke', 0, 'egg', at(13)),
    animal('rainbow-rabbit', 'rabbit', 'upright', 'rainbow', 'Nusse', 0, 'rainbow', at(14)),
    animal(friendUid('fox'), 'fox', 'std', 'c1', 'Mikkel', 0, 'friend', at(15)),
    animal('egg-6', 'horse', 'shetland', 'c1', 'Freja', 0, 'egg', now - 2 * 3600_000),
  ]
  const achievements: Partial<Record<TrophyId, number>> = Object.fromEntries(
    (['days-3', 'days-7', 'days-14', 'first-gold', 'perfect-round', 'animals-5', 'animals-15', 'first-rainbow'] as TrophyId[]).map((id, i) => [id, at(3 + i)]),
  )
  return {
    ...newProfileDoc('Ida', 1, { id: ZOO_DEMO_ID, frameColor: 'leaf', now: t0 }),
    placement: { done: true, at: t0, highest: 'L2' },
    skillMedals: {
      count10: 'gold', hear20: 'gold', addTo10: 'gold', count20: 'silver', order20: 'silver', compareLength: 'silver',
      subTo10: 'bronze', patterns: 'bronze', tenFriends: 'bronze',
    },
    economy: { perler: 140, xp: 3200, level: 9, eggWarmth: 80, eggsHatched: 6, eggSpecies: 'rabbit', wish: null },
    animals,
    buddyUid: 'starter-rabbit',
    inventory: {
      'hverdag-head': { at: at(1), colors: [0] },
      'hverdag-body': { at: at(3), colors: [0, 1] },
      'hverdag-neck': { at: at(2), colors: [0] },
    },
    decor: {
      'pynt-blomsterbed': { at: at(6), x: 0.5, y: 0.7 },
      'pynt-baenk': { at: at(9), x: 0.5, y: 0.7 },
      'pynt-dam': { at: at(12), x: 0.5, y: 0.7 },
      'pynt-traehus': { at: at(16), x: 0.5, y: 0.7 },
    },
    achievements,
    goals: {
      day: '2026-10-01',
      list: [
        { kind: 'mix', need: 1, progress: 1, done: true },
        { kind: 'revisit', region: 'w0-tal10', need: 1, progress: 0, done: false },
        { kind: 'write10', need: 10, progress: 4, done: false },
      ],
    },
    stamps: 11,
    daysPlayed: 16,
    lastLearningDay: '2026-10-01',
    roundIndex: 64,
  }
}

export function zooNewProfile(now = DEMO_NOW): ProfileDoc {
  const base = newProfileDoc('Bo', 0, { id: ZOO_NEW_ID, frameColor: 'sky', now })
  return chooseStarter(base, 'rabbit', { now })!.profile
}

/** Ida and Bo into IndexedDB (replacing earlier copies); returns their ids. */
export async function seedZooDemo(now = Date.now()): Promise<{ ida: string; bo: string }> {
  for (const id of [ZOO_DEMO_ID, ZOO_NEW_ID]) await deleteProfile(id)
  const used = (await listProfiles()).map((p) => p.frameColor)
  const free = freeFrameColors(used)
  const ida = { ...zooDemoProfile(now), frameColor: free[0] ?? 'leaf' }
  const bo = { ...zooNewProfile(now), frameColor: free[1] ?? 'sky' }
  await putProfile(ida)
  await putProfile(bo)
  return { ida: ida.id, bo: bo.id }
}
