// What onboarding does to the stores (SPEC §8 "Onboarding pr. barn"), apart from the screens:
//
//   offeredStarters    the starters with a drawing: an egg never hatches a stand-in (review P1-2)
//   starterLooks       the breed and colour each starter will hatch with. They are drawn from the
//                      profile id, so onboarding picks the id (newProfileId) before the eggs are
//                      shown: the baby peeking out of an egg is the one that hatches (review P2-9).
//   hatchFirstFriend   the egg's third tap: create the child with that id (createProfile, which also
//                      selects it) and give the chosen starter (useMeta.chooseStarter).
//   nameFriend         a suggested or typed name (useMeta.nameAnimal)
//   finishOnboarding   the grade (and what it opens, see dashboard/openings.ts), everything written,
//                      then the map with the first round on top
//
// The grade is asked after the friend (the SPEC order), so the child is created with grade 0 and the
// chosen grade is set at the end. Placement is not built yet: every child starts in Engdalen.
import { useNav } from '../../../../app/nav'
import type { CreatureId } from '../../../../art/rig/types'
import { AVAILABLE_SPECIES } from '../../../../art/species/registry'
import { STARTERS } from '../../../../content/catalog'
import { NODES, REGIONS } from '../../../../content/curriculum'
import { newId } from '../../../../data/ids'
import type { Animal, Grade, NodeId, ProfileId, SkillId, SpeciesId } from '../../../../engine/types'
import { starterAnimal } from '../../../../meta/animals'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { useSession } from '../../../../state/useSession'
import { applyGrade } from '../../parent/dashboard/openings'
import type { AnimalLook } from './art'

const isDrawnSpecies = (species: SpeciesId): boolean => AVAILABLE_SPECIES.includes(species as CreatureId)

/** The first node of Engdalen's first region (Tællelunden, l1). */
export function firstNode(): NodeId {
  const region = REGIONS.filter((r) => r.world === 'eng').sort((a, b) => a.index - b.index)[0]
  const node = NODES.find((n) => n.region === region?.id)
  if (!node) throw new Error('Engdalen har ingen noder')
  return node.id
}

/** The profile this onboarding created (a retry after a failed starter reuses it). */
let hatchedFor: string | null = null

export class StarterError extends Error {
  constructor(species: SpeciesId) {
    super(`Startdyret ${species} kunne ikke gives`)
    this.name = 'StarterError'
  }
}

/**
 * The starters a child can choose: those with a drawing, so an egg never hatches the stand-in. The
 * filter disappears by itself as the drawings land in src/art/species/ (the registry lists the files
 * that exist); with every starter drawn all four eggs are there, as SPEC §8 has it.
 */
export function offeredStarters(drawn: (species: SpeciesId) => boolean = isDrawnSpecies): SpeciesId[] {
  return STARTERS.filter(drawn)
}

/** A fresh id for the child about to be created (picked when the eggs are first shown). */
export const newProfileId = (): ProfileId => newId('p')

/**
 * How each starter will look when it hatches for the profile `id`: the same breed and colour that
 * useMeta.chooseStarter draws from the id once the child exists (stage 1, the baby).
 */
export function starterLooks(id: ProfileId, species: readonly SpeciesId[] = STARTERS): Partial<Record<SpeciesId, AnimalLook>> {
  const out: Partial<Record<SpeciesId, AnimalLook>> = {}
  for (const s of species) {
    const a = starterAnimal({ id, animals: [] }, s, 0)
    if (a) out[s] = { species: s, breed: a.breed, colorway: a.colorway, stage: 1 }
  }
  return out
}

/**
 * Create the child and hatch the first friend. `name` may be empty ("Spiller N"); `id` is the id the
 * eggs were drawn for (newProfileId), so the friend that hatches is the one the egg showed. Throws
 * the repository's ProfileLimitError at six children, or StarterError if the friend could not be
 * given (the child then exists without an animal; trying again gives it).
 */
export async function hatchFirstFriend(input: { name: string; species: SpeciesId; id?: ProfileId }): Promise<Animal> {
  const active = useProfile.getState().profile
  // a second try after a failed hatch continues with the child created the first time
  const reuse = !!active && active.id === hatchedFor && active.animals.length === 0
  if (!reuse) {
    const doc = await useSession.getState().createProfile({ id: input.id, name: input.name, grade: 0 })
    hatchedFor = doc.id
  }
  if (!useMeta.getState().chooseStarter(input.species)) throw new StarterError(input.species)
  const animal = useProfile.getState().profile?.animals.find((a) => a.source === 'starter')
  if (!animal) throw new StarterError(input.species)
  return animal
}

/** Name the new friend (unchanged names are fine). */
export function nameFriend(uid: string, name: string): void {
  useMeta.getState().nameAnimal(uid, name)
}

/** Skills with a module in the registry (loaded on demand: the first round needs it anyway). */
async function registeredSkillIds(): Promise<ReadonlySet<SkillId>> {
  const { registeredSkills } = await import('../../../../engine/registry')
  return new Set(registeredSkills().map((d) => d.id))
}

/**
 * The grade (and the places it opens: dashboard/openings.ts), then write everything and start the
 * first round from the map. Every child starts in Engdalen, and Pip says so on the grade step.
 */
export async function finishOnboarding(grade: Grade): Promise<NodeId> {
  const profile = useProfile.getState()
  const registered = grade > 0 ? await registeredSkillIds() : new Set<SkillId>()
  profile.update((p) => applyGrade(p, grade, registered))
  await profile.flush()
  await useSession.getState().refreshProfiles()
  hatchedFor = null
  const node = firstNode()
  const nav = useNav.getState()
  nav.root({ id: 'map' })
  nav.go({ id: 'round', node })
  return node
}

/** Tests only. */
export function resetOnboardingForTests(): void {
  hatchedFor = null
}
