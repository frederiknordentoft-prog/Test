// 120 short, friendly Danish animal names (SPEC §6.3, §10.2), sorted by species and free of brands
// and famous characters. Each name has a recorded clip `name.animal.<species>.<n>` (n from 1, in the
// order below). When the child names an animal, six suggestions are read aloud: drawn with a seed
// from the species' own names and the shared names of related species, never one the child already
// uses. The child may also type a name (at most 14 characters; read by the device voice).
import type { Animal, ClipId, SpeciesId } from '../engine/types'
import { hashSeed, makeRng } from '../engine/rng'

export const NAME_MAX_LENGTH = 14
export const NAME_SUGGESTIONS = 6

/** Names per species. The first `ownOnly` names fit only this species (Agern, Uldi, Bambus …). */
interface SpeciesNames {
  names: readonly string[]
  ownOnly: number
  /** Related species whose shared names also fit. */
  kin: readonly SpeciesId[]
}

const LIST: Readonly<Record<SpeciesId, SpeciesNames>> = {
  rabbit: { names: ['Kløver', 'Hoppe', 'Mille', 'Bomuld', 'Trille', 'Nusse', 'Dusk', 'Lotte'], ownOnly: 2, kin: ['hamster', 'lamb', 'hedgehog', 'squirrel'] },
  cat: { names: ['Misse', 'Spinne', 'Kanel', 'Silke', 'Mimi', 'Stribe', 'Smut', 'Ingefær'], ownOnly: 2, kin: ['fox', 'puppy', 'rabbit'] },
  puppy: { names: ['Logre', 'Bobo', 'Fiks', 'Basse', 'Tuller', 'Sjuske', 'Rappe', 'Vaks'], ownOnly: 1, kin: ['cat', 'fox', 'panda'] },
  hedgehog: { names: ['Pigge', 'Pjusk', 'Kastanje', 'Snude', 'Mos', 'Hassel', 'Tot', 'Trøffel'], ownOnly: 1, kin: ['squirrel', 'hamster', 'rabbit'] },
  horse: { names: ['Brise', 'Stella', 'Saga', 'Freja', 'Karamel', 'Valde', 'Trine', 'Hjalte'], ownOnly: 0, kin: ['unicorn', 'pegasus'] },
  lamb: { names: ['Uldi', 'Krølle', 'Fnug', 'Lise', 'Sky', 'Vatte', 'Dunne', 'Engel'], ownOnly: 2, kin: ['rabbit', 'hamster', 'polarbear'] },
  fox: { names: ['Mikkel', 'Glød', 'Kvik', 'Snip', 'Rosin', 'Høst', 'Kobber'], ownOnly: 1, kin: ['cat', 'puppy', 'dragon'] },
  hamster: { names: ['Kinne', 'Bolle', 'Nøddi', 'Pusle', 'Muffin', 'Frø', 'Tut', 'Grynet'], ownOnly: 1, kin: ['rabbit', 'hedgehog', 'squirrel'] },
  unicorn: { names: ['Glimmer', 'Sølvlok', 'Luna', 'Perle', 'Stjernelys', 'Snefnug', 'Feja', 'Rosa'], ownOnly: 2, kin: ['horse', 'pegasus'] },
  panda: { names: ['Bambus', 'Tumle', 'Kiki', 'Pompom', 'Mumle', 'Bolsje', 'Søde'], ownOnly: 1, kin: ['polarbear', 'puppy', 'hamster'] },
  squirrel: { names: ['Agern', 'Kogle', 'Kvist', 'Svirp', 'Spurt', 'Rasle', 'Birk'], ownOnly: 2, kin: ['hedgehog', 'hamster', 'fox'] },
  owl: { names: ['Bogorm', 'Skumring', 'Hugo', 'Orla', 'Agnes', 'Prik', 'Måne'], ownOnly: 2, kin: ['penguin', 'pegasus'] },
  pegasus: { names: ['Vinge', 'Svæve', 'Himla', 'Fjer', 'Solstråle', 'Zefyr', 'Blæst'], ownOnly: 2, kin: ['unicorn', 'horse', 'owl'] },
  dragon: { names: ['Ildfred', 'Smaragd', 'Gnist', 'Flamme', 'Glo', 'Torden', 'Rubin'], ownOnly: 2, kin: ['fox', 'pegasus'] },
  penguin: { names: ['Vralte', 'Smoking', 'Plask', 'Snebold', 'Tøffel', 'Glid', 'Fløde'], ownOnly: 2, kin: ['polarbear', 'owl'] },
  polarbear: { names: ['Nanok', 'Brummer', 'Frost', 'Snehild', 'Isa', 'Vinter', 'Hvide'], ownOnly: 1, kin: ['penguin', 'panda', 'lamb'] },
}

export interface AnimalName {
  name: string
  species: SpeciesId
  /** 1-based position in the species list. */
  n: number
  clip: ClipId
}

/** All 120 names in species order. */
export const ANIMAL_NAMES: readonly AnimalName[] = (Object.keys(LIST) as SpeciesId[]).flatMap((species) =>
  LIST[species].names.map((name, i) => ({ name, species, n: i + 1, clip: `name.animal.${species}.${i + 1}` })),
)

const BY_NAME = new Map(ANIMAL_NAMES.map((a) => [a.name.toLowerCase(), a]))

/** The recorded clip for a name from the list (case-insensitive), or null for a typed name. */
export function nameClip(name: string): ClipId | null {
  return BY_NAME.get(name.trim().toLowerCase())?.clip ?? null
}

/** Names that suit a species: its own list first, then the shared names of its kin. */
export function namePool(species: SpeciesId): { own: string[]; kin: string[] } {
  const def = LIST[species]
  const kin: string[] = []
  for (const k of def.kin) for (const n of LIST[k].names.slice(LIST[k].ownOnly)) if (!kin.includes(n)) kin.push(n)
  return { own: [...def.names], kin: kin.filter((n) => !def.names.includes(n)) }
}

/**
 * Six suggestions for an animal: four of the species' own names and two shared ones (when there are
 * enough), drawn with a seed from the animal's uid, without names the child already uses.
 */
export function nameSuggestions(animal: Pick<Animal, 'uid' | 'species'>, taken: readonly string[] = []): string[] {
  const used = new Set(taken.map((t) => t.trim().toLowerCase()))
  const free = (ns: readonly string[]) => ns.filter((n) => !used.has(n.toLowerCase()))
  const rng = makeRng(hashSeed(`${animal.uid}:names`))
  const pool = namePool(animal.species)
  const own = rng.shuffle(free(pool.own))
  const kin = rng.shuffle(free(pool.kin))
  const pick = [...own.slice(0, 4), ...kin.slice(0, 2)]
  for (const n of [...own.slice(4), ...kin.slice(2)]) if (pick.length < NAME_SUGGESTIONS) pick.push(n)
  return rng.shuffle(pick.slice(0, NAME_SUGGESTIONS))
}

/** Trimmed, single-spaced, without control characters, at most 14 characters; '' when empty. */
export function cleanAnimalName(name: string): string {
  const flat = name.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(flat).slice(0, NAME_MAX_LENGTH).join('').trim()
}
