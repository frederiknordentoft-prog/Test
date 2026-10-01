// The four books as pure functions of the profile (SPEC §6.1–6.2, §5.2, §13):
//   Samlebogen  every collectible (species, breed, colour): 24 breeds in 6 colours, a golden and a
//               rainbow animal per species and the Stjernefølet — 177 in all. Found ones in colour,
//               the others as a silhouette with "Sådan får du den" read aloud.
//   Kan-bogen   the skills with a medal, "Jeg kan …" in the child's own words, gold first.
//   Stempelbogen  one stamp per goal reached, numbered and without dates, and the days played in
//               total — a number that never goes back to zero.
//   Trofæerne   all 34, earned ones in colour, the others as an outline with what earns them.
// Nothing here ranks, compares or speaks of rarity: every card is worth the same.
import { BREED_NAMES, SPECIES, TROPHIES, type TrophyCategory } from '../../../../content/catalog'
import { ACHIEVEMENT_BY_ID } from '../../../../content/achievements'
import { REGIONS, REGION_BY_ID, WORLD_BY_ID } from '../../../../content/curriculum'
import { SKILLS } from '../../../../content/skills'
import { eggSpecies, pendingChoices, unlockedBreeds } from '../../../../meta/animals'
import {
  NATURAL_COLORWAYS,
  type Animal, type BreedId, type ClipId, type ColorwayId, type DomainId, type Goal, type Medal, type ProfileDoc,
  type SkillId, type SpeciesId, type SpeechPart, type TrophyId,
} from '../../../../engine/types'
import { hasClip } from '../../../../speech/catalog'
import type { BookId } from '../../../../app/routes'

// ─── Samlebogen ─────────────────────────────────────────────────────────────

export interface CollectionCard {
  /** `${species}:${breed}:${colorway}` */
  key: string
  species: SpeciesId
  breed: BreedId
  colorway: ColorwayId
  /** The animal that fills the card, or null while it is still to be found. */
  owned: Animal | null
  /** "Sådan får du den" for a card not found yet. */
  how: SpeechPart[] | null
  /** A breed that opens after two of the breed before it: how many of those the child has (0–2). */
  breedSteps: number | null
}

export interface CollectionSection {
  /** A breed of the species, or the magic animals (golden, rainbow and the Stjernefølet). */
  kind: 'breed' | 'magic'
  breed: BreedId | null
  /** Heading clip (the breed's name, or "Magiske dyr"); null for a species without breeds. */
  title: ClipId | null
  cards: CollectionCard[]
}

export interface CollectionPage {
  species: SpeciesId
  sections: CollectionSection[]
  found: number
  total: number
}

export interface CollectionModel {
  pages: CollectionPage[]
  found: number
  total: number
}

const comboKey = (species: SpeciesId, breed: BreedId, colorway: ColorwayId) => `${species}:${breed}:${colorway}`

/** The region whose friend stone brings a species. */
export function friendRegionOf(species: SpeciesId) {
  return REGIONS.find((r) => r.node3.kind === 'friend' && r.node3.species === species) ?? null
}

/**
 * Every collectible in book order. A collectible is owned when an animal has exactly its species,
 * breed and colour; the golden and rainbow animals come in the species' first breed, the
 * Stjernefølet is the unicorn foal in star white.
 */
export function collectionModel(p: Pick<ProfileDoc, 'animals' | 'skillMedals' | 'nodes'>): CollectionModel {
  const byKey = new Map<string, Animal>()
  for (const a of p.animals) {
    const k = comboKey(a.species, a.breed, a.colorway)
    if (!byKey.has(k)) byKey.set(k, a)
  }
  const met = new Set(eggSpecies(p))
  const pending = pendingChoices(p)

  const pages = SPECIES.map((s): CollectionPage => {
    const open = new Set(unlockedBreeds(p, s.id))
    const world = WORLD_BY_ID[s.world]
    const sections: CollectionSection[] = s.breeds.map((breed, i) => {
      const prev = i > 0 ? s.breeds[i - 1] : null
      const steps = prev ? Math.min(2, p.animals.filter((a) => a.species === s.id && a.breed === prev).length) : null
      const cards = NATURAL_COLORWAYS.map((colorway): CollectionCard => {
        const key = comboKey(s.id, breed, colorway)
        const owned = byKey.get(key) ?? null
        let how: SpeechPart[] | null = null
        if (!owned) {
          if (!met.has(s.id)) {
            const region = friendRegionOf(s.id)
            how = region ? [{ clip: 's.books.how.meet' }, { clip: region.nameClip }] : [{ clip: 's.books.how.egg' }]
          } else if (!open.has(breed)) how = [{ clip: `s.books.how.breed.${breed}` }]
          else how = [{ clip: 's.books.how.egg' }]
        }
        const waiting = !owned && !!prev && met.has(s.id) && !open.has(breed)
        return { key, species: s.id, breed, colorway, owned, how, breedSteps: waiting ? steps : null }
      })
      return { kind: 'breed', breed, title: breed === 'std' ? null : `name.breed.${breed}`, cards }
    })

    const first = s.breeds[0]
    const magic: CollectionCard[] = (['gold', 'rainbow'] as const).map((kind) => {
      const key = comboKey(s.id, first, kind)
      const owned = byKey.get(key) ?? null
      const ready = pending.some((c) => c.kind === kind && c.world === s.world && c.options.includes(s.id))
      const how: SpeechPart[] | null = owned
        ? null
        : ready
          ? [{ clip: 's.books.how.ready' }]
          : [{ clip: kind === 'gold' ? 's.books.how.gold' : 's.books.how.rainbow' }, { clip: world.nameClip }]
      return { key, species: s.id, breed: first, colorway: kind, owned, how, breedSteps: null }
    })
    if (s.id === 'unicorn') {
      const key = comboKey('unicorn', 'foal', 'starwhite')
      const owned = byKey.get(key) ?? null
      magic.push({ key, species: 'unicorn', breed: 'foal', colorway: 'starwhite', owned, how: owned ? null : [{ clip: 's.books.how.starfoal' }], breedSteps: null })
    }
    sections.push({ kind: 'magic', breed: null, title: 's.books.magic', cards: magic })

    const cards = sections.flatMap((x) => x.cards)
    return { species: s.id, sections, found: cards.filter((c) => c.owned).length, total: cards.length }
  })

  return { pages, found: pages.reduce((n, pg) => n + pg.found, 0), total: pages.reduce((n, pg) => n + pg.total, 0) }
}

/** Name of a breed for a card's line (empty for a species without breeds). */
export const breedName = (breed: BreedId): string => BREED_NAMES[breed]

// ─── Kan-bogen ──────────────────────────────────────────────────────────────

export interface CanEntry {
  skill: SkillId
  domain: DomainId
  medal: Medal
  /** "Jeg kan …" (s.cando.<skill>), or a general line for a skill without its own sentence yet. */
  clip: ClipId
}

export interface CanModel {
  gold: CanEntry[]
  silver: CanEntry[]
  bronze: CanEntry[]
  count: number
}

/** The skills with a medal (medals are kept for good), in curriculum order within each medal. */
export function canBookModel(p: Pick<ProfileDoc, 'skillMedals'>): CanModel {
  const out: CanModel = { gold: [], silver: [], bronze: [], count: 0 }
  const ordered = [...SKILLS].sort((a, b) => a.stage - b.stage)
  for (const s of ordered) {
    const medal = p.skillMedals[s.id]
    if (!medal) continue
    const own = `s.cando.${s.id}`
    out[medal].push({ skill: s.id, domain: s.domain, medal, clip: hasClip(own) ? own : 's.books.can.more' })
    out.count++
  }
  return out
}

// ─── Stempelbogen ───────────────────────────────────────────────────────────

export interface StampModel {
  /** Stamps in total, numbered from 1, without dates. */
  stamps: number
  /** Days played in total (never reset, never a streak). */
  days: number
  goals: { goal: Goal; parts: SpeechPart[] }[]
}

/** What a goal asks, as speech (the region of a visit goal by name). */
export function goalParts(goal: Goal): SpeechPart[] {
  if (goal.kind === 'revisit') {
    const region = goal.region ? REGION_BY_ID[goal.region] : undefined
    return region ? [{ clip: 's.reward.goal.revisit' }, { clip: region.nameClip }] : [{ clip: 's.reward.goal.mix' }]
  }
  return [{ clip: `s.reward.goal.${goal.kind}` }]
}

export function stampModel(p: Pick<ProfileDoc, 'stamps' | 'daysPlayed' | 'goals'>): StampModel {
  return {
    stamps: Math.max(0, p.stamps),
    days: Math.max(0, p.daysPlayed),
    goals: p.goals.list.map((goal) => ({ goal, parts: goalParts(goal) })),
  }
}

// ─── Trofæerne ──────────────────────────────────────────────────────────────

export const TROPHY_CATEGORIES: readonly TrophyCategory[] = ['flid', 'stil', 'rejse', 'laering', 'venner']

export interface TrophyEntry {
  id: TrophyId
  category: TrophyCategory
  /** name.trophy.<id> */
  name: ClipId
  earned: boolean
  /** What earns it (s.books.trophy.how.<id>), read under the outline. */
  how: ClipId
  /** 0–1 of the way for a locked trophy that counts something; shown as a bar, never as "N more". */
  progress: number | null
}

export interface TrophyModel {
  groups: { category: TrophyCategory; title: ClipId; entries: TrophyEntry[] }[]
  earned: number
  total: number
}

export function trophyModel(p: ProfileDoc): TrophyModel {
  const entries = TROPHIES.map((t): TrophyEntry => {
    const earned = p.achievements[t.id] !== undefined
    const step = !earned ? ACHIEVEMENT_BY_ID[t.id]?.progress?.(p) : undefined
    return {
      id: t.id,
      category: t.category,
      name: `name.trophy.${t.id}`,
      earned,
      how: `s.books.trophy.how.${t.id}`,
      progress: step && step.need > 0 ? Math.max(0, Math.min(1, step.have / step.need)) : null,
    }
  })
  return {
    groups: TROPHY_CATEGORIES.map((category) => ({
      category,
      title: `s.books.trophy.cat.${category}`,
      entries: entries.filter((e) => e.category === category),
    })),
    earned: entries.filter((e) => e.earned).length,
    total: entries.length,
  }
}

// ─── The shelf ──────────────────────────────────────────────────────────────

export interface ShelfBook {
  id: BookId
  title: ClipId
  about: ClipId
  /** The number on the cover: found animals, medals, stamps, trophies. */
  count: number
}

export function shelfModel(p: ProfileDoc): ShelfBook[] {
  return [
    { id: 'collection', title: 's.books.collection', about: 's.books.collection.about', count: collectionModel(p).found },
    { id: 'can', title: 's.books.can', about: 's.books.can.about', count: canBookModel(p).count },
    { id: 'stamps', title: 's.books.stamps', about: 's.books.stamps.about', count: stampModel(p).stamps },
    { id: 'trophies', title: 's.books.trophies', about: 's.books.trophies.about', count: trophyModel(p).earned },
  ]
}
