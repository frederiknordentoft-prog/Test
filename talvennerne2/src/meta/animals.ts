// Animals (SPEC §6.1–6.3): who the child can get, how an egg picks its breed and colour, friendship
// and growth, and the mastery animals (Stjernefølet, golden and rainbow). Pure functions.
//
// A collectible is (species, breed, colour). An egg or a friend node draws, with a seed, one of the
// combinations the child does not own yet among the unlocked breeds — all equally valuable, no
// rarity. The next breed of a species unlocks when the child owns two animals of the breed before it.
//
// Animal uids are made from where the animal came from (`starter-rabbit`, `friend-w0-plus10-friend`,
// `egg-3`, `gold-horse`, `rainbow-owl`, `starfoal-addTo10`), so the same reward can never be handed
// out twice, and the Stjernefølet remembers which gold medal brought it.
import { REGIONS, WORLD_BY_ID, nodesOfRegion } from '../content/curriculum'
import { SPECIES, SPECIES_BY_ID, STARTERS } from '../content/catalog'
import { FRIENDSHIP_UNLOCKS, GROWTH, friendshipLevel, eggWarmthFor } from '../content/economy'
import { nameSuggestions } from '../content/names'
import { hashSeed, makeRng } from '../engine/rng'
import {
  NATURAL_COLORWAYS,
  type Animal, type BreedId, type ColorwayId, type ProfileDoc, type SkillId, type SpeciesId, type Stage, type WorldId,
} from '../engine/types'
import type { Reward } from './rewards'

type Natural = (typeof NATURAL_COLORWAYS)[number]
const isNatural = (c: ColorwayId): c is Natural => (NATURAL_COLORWAYS as readonly string[]).includes(c)

/** Golden and rainbow animals per world, at most. */
export const MAGIC_PER_WORLD = 4

export const speciesOfWorld = (world: WorldId): SpeciesId[] => SPECIES.filter((s) => s.world === world).map((s) => s.id)

/** The world a skill belongs to: the world of the first region that teaches it. */
export function worldOfSkill(skill: SkillId): WorldId | null {
  return REGIONS.find((r) => r.skills.some((s) => s.skill === skill && !s.reviewOnly))?.world ?? null
}

// ─── Breeds and combinations ────────────────────────────────────────────────

/** Breeds the child can find now: the first always, each next one after two of the one before. */
export function unlockedBreeds(p: Pick<ProfileDoc, 'animals'>, species: SpeciesId): BreedId[] {
  const breeds = SPECIES_BY_ID[species].breeds
  const out: BreedId[] = [breeds[0]]
  for (let i = 1; i < breeds.length; i++) {
    const prev = breeds[i - 1]
    if (p.animals.filter((a) => a.species === species && a.breed === prev).length < 2) break
    out.push(breeds[i])
  }
  return out
}

/** Unowned natural (breed, colour) combinations among the unlocked breeds, in a stable order. */
export function unownedCombos(p: Pick<ProfileDoc, 'animals'>, species: SpeciesId): { breed: BreedId; colorway: Natural }[] {
  const owned = new Set(p.animals.filter((a) => a.species === species && isNatural(a.colorway)).map((a) => `${a.breed}:${a.colorway}`))
  const out: { breed: BreedId; colorway: Natural }[] = []
  for (const breed of unlockedBreeds(p, species)) {
    for (const colorway of NATURAL_COLORWAYS) if (!owned.has(`${breed}:${colorway}`)) out.push({ breed, colorway })
  }
  return out
}

/** Every breed in every natural colour found: the species is grey in the egg picker. */
export const speciesComplete = (p: Pick<ProfileDoc, 'animals'>, species: SpeciesId): boolean => unownedCombos(p, species).length === 0

/** Species unlocked for eggs: met as a starter or on a friend node (or hatched since). */
export function eggSpecies(p: Pick<ProfileDoc, 'animals'>): SpeciesId[] {
  const met = new Set(p.animals.filter((a) => a.source === 'starter' || a.source === 'friend' || a.source === 'egg').map((a) => a.species))
  return SPECIES.filter((s) => met.has(s.id)).map((s) => s.id)
}

/** What the egg can be now: unlocked species with something left to find. */
export function eggOptions(p: Pick<ProfileDoc, 'animals'>): SpeciesId[] {
  return eggSpecies(p).filter((s) => !speciesComplete(p, s))
}

/** Warmth the current egg needs. */
export const eggNeed = (p: Pick<ProfileDoc, 'economy'>): number => eggWarmthFor(p.economy.eggsHatched + 1)
export const eggIsReady = (p: Pick<ProfileDoc, 'economy'>): boolean => p.economy.eggWarmth >= eggNeed(p)

/** Draw one unowned combination with a seed, or null when the species is complete. */
export function rollCombo(p: Pick<ProfileDoc, 'animals'>, species: SpeciesId, seedText: string): { breed: BreedId; colorway: Natural } | null {
  const combos = unownedCombos(p, species)
  if (combos.length === 0) return null
  return makeRng(hashSeed(seedText)).pick(combos)
}

// ─── Making animals ─────────────────────────────────────────────────────────

export function makeAnimal(
  p: Pick<ProfileDoc, 'animals'>,
  a: { uid: string; species: SpeciesId; breed: BreedId; colorway: ColorwayId; source: Animal['source'] },
  now: number,
): Animal {
  const taken = p.animals.map((x) => x.name)
  const name = nameSuggestions({ uid: a.uid, species: a.species }, taken)[0] ?? SPECIES_BY_ID[a.species].name
  return { ...a, name, friendship: 0, stage: 1, star: false, shown: 1, outfit: {}, foundAt: now }
}

const firstBreed = (species: SpeciesId): BreedId => SPECIES_BY_ID[species].breeds[0]

/** The first friend chosen in onboarding (the horse comes as the Shetland foal). */
export function starterAnimal(p: Pick<ProfileDoc, 'id' | 'animals'>, species: SpeciesId, now: number): Animal | null {
  if (!STARTERS.includes(species) || p.animals.length > 0) return null
  const combo = rollCombo(p, species, `${p.id}:starter`)
  if (!combo) return null
  return makeAnimal(p, { uid: `starter-${species}`, species, ...combo, source: 'starter' }, now)
}

/** The animal a friend node gives: a new species, or a colour or breed the child does not have. */
export function friendAnimal(p: Pick<ProfileDoc, 'id' | 'animals'>, species: SpeciesId, nodeId: string, now: number): Animal | null {
  const uid = `friend-${nodeId}`
  if (p.animals.some((a) => a.uid === uid)) return null
  const combo = rollCombo(p, species, `${p.id}:friend:${nodeId}`)
  if (!combo) return null
  return makeAnimal(p, { uid, species, ...combo, source: 'friend' }, now)
}

/** The animal egg number `egg` hatches into. */
export function eggAnimal(p: Pick<ProfileDoc, 'id' | 'animals'>, species: SpeciesId, egg: number, now: number): Animal | null {
  const combo = rollCombo(p, species, `${p.id}:egg:${egg}`)
  if (!combo) return null
  return makeAnimal(p, { uid: `egg-${egg}`, species, ...combo, source: 'egg' }, now)
}

/** Stjernefølet: the unicorn foal in star white, for the first gold medal ever. */
export function starFoal(p: Pick<ProfileDoc, 'animals'>, skill: SkillId, now: number): Animal {
  return makeAnimal(p, { uid: `starfoal-${skill}`, species: 'unicorn', breed: 'foal', colorway: 'starwhite', source: 'starFoal' }, now)
}

export function magicAnimal(p: Pick<ProfileDoc, 'animals'>, kind: 'gold' | 'rainbow', species: SpeciesId, now: number): Animal {
  return makeAnimal(p, { uid: `${kind}-${species}`, species, breed: firstBreed(species), colorway: kind, source: kind }, now)
}

// ─── Mastery animals ────────────────────────────────────────────────────────

/** The skill whose gold medal brought the Stjernefølet, or null before the first gold. */
export function starFoalSkill(p: Pick<ProfileDoc, 'animals'>): SkillId | null {
  const foal = p.animals.find((a) => a.source === 'starFoal')
  return foal ? (foal.uid.slice('starfoal-'.length) as SkillId) : null
}

/** Gold medals of a world that bring a golden animal (the one that brought the Stjernefølet does not). */
export function goldMedalsOfWorld(p: Pick<ProfileDoc, 'skillMedals' | 'animals'>, world: WorldId): number {
  const foal = starFoalSkill(p)
  return (Object.entries(p.skillMedals) as [SkillId, string][])
    .filter(([skill, m]) => m === 'gold' && skill !== foal && worldOfSkill(skill) === world).length
}

const ownedMagic = (p: Pick<ProfileDoc, 'animals'>, kind: 'gold' | 'rainbow', world: WorldId) =>
  p.animals.filter((a) => a.source === kind && SPECIES_BY_ID[a.species].world === world)

/** Regions of the world with three stars on every node. */
export function rainbowRegions(p: Pick<ProfileDoc, 'nodes'>, world: WorldId): number {
  return WORLD_BY_ID[world].regions.filter((r) => nodesOfRegion(r).every((n) => p.nodes[n.id]?.stars === 3)).length
}

export interface PendingChoice { kind: 'gold' | 'rainbow'; world: WorldId; count: number; options: SpeciesId[] }

/**
 * Golden and rainbow animals the child has earned but not picked yet. Each gold medal after the
 * first gives one golden animal from its world, and each region with three stars everywhere one
 * rainbow animal from its world, at most four of each per world.
 */
export function pendingChoices(p: Pick<ProfileDoc, 'skillMedals' | 'animals' | 'nodes'>): PendingChoice[] {
  const out: PendingChoice[] = []
  for (const world of Object.keys(WORLD_BY_ID) as WorldId[]) {
    for (const kind of ['gold', 'rainbow'] as const) {
      const earned = Math.min(MAGIC_PER_WORLD, kind === 'gold' ? goldMedalsOfWorld(p, world) : rainbowRegions(p, world))
      const owned = ownedMagic(p, kind, world)
      const count = earned - owned.length
      if (count <= 0) continue
      const have = new Set(owned.map((a) => a.species))
      out.push({ kind, world, count, options: speciesOfWorld(world).filter((s) => !have.has(s)) })
    }
  }
  return out
}

// ─── Friendship and growth ──────────────────────────────────────────────────

export function stageFor(level: number): Stage {
  return level >= GROWTH.grown ? 3 : level >= GROWTH.young ? 2 : 1
}

/** One animal after `amount` more friendship, and what it brought (growth, tricks, star form). */
export function befriend(a: Animal, amount: number): { animal: Animal; rewards: Reward[] } {
  if (amount <= 0) return { animal: a, rewards: [] }
  const from = friendshipLevel(a.friendship)
  const friendship = a.friendship + amount
  const to = friendshipLevel(friendship)
  const rewards: Reward[] = []
  let animal: Animal = { ...a, friendship }
  for (let level = from + 1; level <= to; level++) {
    const unlock = FRIENDSHIP_UNLOCKS[level]
    if (unlock === 'young' || unlock === 'grown') {
      const stage = stageFor(level)
      if (stage > animal.stage) {
        animal = { ...animal, stage, shown: animal.star ? animal.shown : stage }
        rewards.push({ t: 'growth', uid: a.uid, stage, star: false })
      }
    } else if (unlock === 'star') {
      if (!animal.star) {
        animal = { ...animal, star: true, stage: 3, shown: 'star' }
        rewards.push({ t: 'growth', uid: a.uid, stage: 3, star: true })
      }
    } else if (unlock) {
      rewards.push({ t: 'friendship', uid: a.uid, level, unlock })
    }
  }
  return { animal, rewards }
}

/** profile.animals with friendship added to one animal (the buddy). */
export function befriendIn(animals: readonly Animal[], uid: string | null, amount: number): { animals: Animal[]; rewards: Reward[] } {
  const i = uid ? animals.findIndex((a) => a.uid === uid) : -1
  if (i < 0 || amount <= 0) return { animals: animals as Animal[], rewards: [] }
  const { animal, rewards } = befriend(animals[i], amount)
  const out = animals.slice()
  out[i] = animal
  return { animals: out, rewards }
}
