// What onboarding does to the stores (SPEC §8 "Onboarding pr. barn"), apart from the screens:
//
//   hatchFirstFriend   the egg's third tap: create the child (createProfile, which also selects it)
//                      and give the chosen starter (useMeta.chooseStarter). Both happen at the same
//                      moment because the starter's breed and colour are drawn from the profile id:
//                      the animal that hatches on screen is the one that is kept.
//   nameFriend         a suggested or typed name (useMeta.nameAnimal)
//   finishOnboarding   the grade, everything written, then the map with the first round on top
//
// The grade is asked after the friend (the SPEC order), so the child is created with grade 0 and the
// chosen grade is set at the end. Placement is skipped in this wave: every child starts in Engdalen.
import { useNav } from '../../../../app/nav'
import { NODES, REGIONS } from '../../../../content/curriculum'
import type { Animal, Grade, NodeId, SpeciesId } from '../../../../engine/types'
import { useMeta } from '../../../../state/useMeta'
import { useProfile } from '../../../../state/useProfile'
import { useSession } from '../../../../state/useSession'

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
 * Create the child and hatch the first friend. `name` may be empty ("Spiller N"). Throws the
 * repository's ProfileLimitError at six children, or StarterError if the friend could not be given
 * (the child then exists without an animal; trying again gives it).
 */
export async function hatchFirstFriend(input: { name: string; species: SpeciesId }): Promise<Animal> {
  const active = useProfile.getState().profile
  // a second try after a failed hatch continues with the child created the first time
  const reuse = !!active && active.id === hatchedFor && active.animals.length === 0
  if (!reuse) {
    const doc = await useSession.getState().createProfile({ name: input.name, grade: 0 })
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

/** The grade, then write everything and start the first round from the map. */
export async function finishOnboarding(grade: Grade): Promise<NodeId> {
  const profile = useProfile.getState()
  profile.update((p) => (p.grade === grade ? p : { ...p, grade }))
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
