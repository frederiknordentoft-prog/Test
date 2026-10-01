// Dyrehaven as pure functions (SPEC §6.1–6.4, §5.7): what stands where on the meadow, which animals
// may move their parts (the buddy and at most two others per screen), what an animal's card shows
// (friendship 1–10, tricks, reachable forms) and the egg. The screen only renders what these return,
// so the budget and the rules are tested without a browser.
//
// Order on the meadow: the buddy first (it is the friend who comes along on the rounds), then the
// newest friend first. Decor stands on fixed places in that flow, so a bench stays a bench's length
// from the start however many animals arrive; decor beyond the last animal follows in its fixed order.
import { DECOR } from '../../../../content/catalog'
import { FRIENDSHIP_LEVELS, FRIENDSHIP_UNLOCKS, friendshipLevel, type FriendshipUnlock } from '../../../../content/economy'
import { nameClip } from '../../../../content/names'
import type { Animal, ClipId, DecorId, ProfileDoc, SpeciesId, SpeechPart, Stage } from '../../../../engine/types'
import { eggNeed, eggOptions, eggSpecies } from '../../../../meta/animals'

// ─── Speech helpers ─────────────────────────────────────────────────────────

/** A name: its recorded clip when it is one of the suggested names, else the device voice. */
export function nameParts(name: string): SpeechPart[] {
  const clip = nameClip(name)
  return [clip ? { clip } : { free: name }]
}

/** "Kanin, vædderkanin, karamel": species, breed (when the species has breeds) and colour. */
export function kindClips(a: Pick<Animal, 'species' | 'breed' | 'colorway'>): ClipId[] {
  const out: ClipId[] = [`name.species.${a.species}`]
  if (a.breed !== 'std') out.push(`name.breed.${a.breed}`)
  out.push(`name.color.${a.species}.${a.colorway}`)
  return out
}

/** Text of a spoken line from its clips (and names), joined like a sentence. */
export function lineText(parts: readonly SpeechPart[], textOf: (clip: ClipId) => string, sep = ' '): string {
  const words = parts.map((p) => ('clip' in p ? textOf(p.clip) : 'free' in p ? p.free : 'num' in p ? String(p.num) : '')).filter(Boolean)
  return words.join(sep)
}

/** A sentence from fragments: ends with a full stop unless it already ends a sentence. */
export function sentenceText(parts: readonly SpeechPart[], textOf: (clip: ClipId) => string): string {
  const text = lineText(parts, textOf)
  return /[.!?]$/.test(text) ? text : `${text}.`
}

// ─── The meadow ─────────────────────────────────────────────────────────────

/** Fixed places of the decor in the meadow's flow (cell index, the buddy is cell 0). */
export const DECOR_SLOTS: Readonly<Record<DecorId, number>> = {
  'pynt-blomsterbed': 2,
  'pynt-lygte': 5,
  'pynt-baenk': 7,
  'pynt-gynge': 10,
  'pynt-dam': 13,
  'pynt-traehus': 16,
  'pynt-springvand': 19,
  'pynt-regnbuebue': 22,
}

export type MeadowCell =
  | { kind: 'animal'; animal: Animal; buddy: boolean }
  | { kind: 'decor'; id: DecorId }

/** The buddy first, then the newest friend first (ties: the later one in the list first). */
export function meadowAnimals(p: Pick<ProfileDoc, 'animals' | 'buddyUid'>): Animal[] {
  const index = new Map(p.animals.map((a, i) => [a.uid, i]))
  const others = p.animals
    .filter((a) => a.uid !== p.buddyUid)
    .sort((a, b) => b.foundAt - a.foundAt || index.get(b.uid)! - index.get(a.uid)!)
  const buddy = p.animals.find((a) => a.uid === p.buddyUid)
  return buddy ? [buddy, ...others] : others
}

export function meadowCells(p: Pick<ProfileDoc, 'animals' | 'buddyUid' | 'decor'>): MeadowCell[] {
  const animals = meadowAnimals(p)
  const decor = DECOR.map((d) => d.id)
    .filter((id) => !!p.decor[id])
    .sort((a, b) => DECOR_SLOTS[a] - DECOR_SLOTS[b])
  const out: MeadowCell[] = []
  let ai = 0
  let di = 0
  while (ai < animals.length) {
    if (di < decor.length && DECOR_SLOTS[decor[di]] <= out.length) {
      out.push({ kind: 'decor', id: decor[di++] })
      continue
    }
    const animal = animals[ai++]
    out.push({ kind: 'animal', animal, buddy: animal.uid === p.buddyUid })
  }
  while (di < decor.length) out.push({ kind: 'decor', id: decor[di++] })
  return out
}

// ─── Which animals move their parts ─────────────────────────────────────────

/** SPEC §6.4: the buddy and at most two other animals per screen animate their parts. */
export const MAX_ANIMATED = 3

export interface AnimationPlan {
  /** Animals drawn as an animated rig on the meadow. */
  meadow: ReadonlySet<string>
  /** The animal shown animated in the open card (its meadow picture is still meanwhile). */
  sheet: string | null
}

/**
 * Who animates: the animal of an open card first (it is in front of everything), then the buddy,
 * then the animals the child tapped last, then the first ones on the meadow — never more than
 * MAX_ANIMATED rigs on the screen in all. Everything else is a still picture.
 */
export function planAnimation(
  order: readonly string[],
  buddyUid: string | null,
  opts: { focus?: readonly string[]; sheet?: string | null } = {},
): AnimationPlan {
  const known = new Set(order)
  const sheet = opts.sheet ?? null
  let room = MAX_ANIMATED - (sheet ? 1 : 0)
  const meadow = new Set<string>()
  const add = (uid: string | null | undefined) => {
    if (room <= 0 || !uid || uid === sheet || meadow.has(uid) || !known.has(uid)) return
    meadow.add(uid)
    room--
  }
  add(buddyUid)
  for (const uid of opts.focus ?? []) add(uid)
  for (const uid of order) add(uid)
  return { meadow, sheet }
}

// ─── An animal's card ───────────────────────────────────────────────────────

export const TRICKS = ['hop', 'cheer', 'spin', 'call', 'signature', 'dance'] as const
export type TrickId = (typeof TRICKS)[number]

/** Friendship level where each unlock arrives (from the economy table). */
export const UNLOCK_LEVEL: Readonly<Record<FriendshipUnlock, number>> = Object.fromEntries(
  Object.entries(FRIENDSHIP_UNLOCKS).map(([level, unlock]) => [unlock, Number(level)]),
) as Record<FriendshipUnlock, number>

export type Form = Stage | 'star'
export const FORMS: readonly Form[] = [1, 2, 3, 'star']

export interface AnimalFacts {
  /** Friendship level 1–10. */
  level: number
  /** 0–1 of the way to the next level (1 at level 10); shown without numbers. */
  progress: number
  tricks: { id: TrickId; unlocked: boolean }[]
  forms: { form: Form; reached: boolean; shown: boolean }[]
}

export function animalFacts(a: Animal): AnimalFacts {
  const level = friendshipLevel(a.friendship)
  const from = FRIENDSHIP_LEVELS[level - 1]
  const to = FRIENDSHIP_LEVELS[level]
  const progress = to === undefined ? 1 : Math.max(0, Math.min(1, (a.friendship - from) / (to - from)))
  return {
    level,
    progress,
    tricks: TRICKS.map((id) => ({ id, unlocked: level >= UNLOCK_LEVEL[id] })),
    forms: FORMS.map((form) => ({
      form,
      reached: form === 'star' ? a.star : form <= a.stage,
      shown: a.shown === form,
    })),
  }
}

/** The stage a form is drawn at, and whether the star aura shows. */
export const formLook = (form: Form): { stage: Stage; star: boolean } => (form === 'star' ? { stage: 3, star: true } : { stage: form, star: false })

// ─── The egg ────────────────────────────────────────────────────────────────

export interface EggModel {
  /** 0–1 warmth (the meter; never a number). */
  warmth: number
  ready: boolean
  /** Species the egg can be now. */
  options: SpeciesId[]
  /** The species it will be: the child's choice, or the only option; null while to be chosen. */
  species: SpeciesId | null
  /** Every unlocked species is found in every breed and colour: the warmth becomes friendship. */
  allFound: boolean
}

export function eggModel(p: Pick<ProfileDoc, 'animals' | 'economy'>): EggModel {
  const need = eggNeed(p)
  const options = eggOptions(p)
  const chosen = p.economy.eggSpecies
  const species = chosen && options.includes(chosen) ? chosen : options.length === 1 ? options[0] : null
  return {
    warmth: Math.max(0, Math.min(1, p.economy.eggWarmth / need)),
    ready: p.economy.eggWarmth >= need,
    options,
    species,
    allFound: options.length === 0 && eggSpecies(p).length > 0,
  }
}
