// The 120 suggested animal names (SPEC §6.3, §10.2): `name.animal.<species>.<n>` → the name. Built
// from src/content/names.ts. All in wave 1: the child names the starter in the first minutes, and the
// suggestions for one species also draw on the names of related species from later worlds.
import type { ClipId } from '../../../engine/types'
import { ANIMAL_NAMES } from '../../../content/names'

export const clips: Readonly<Record<ClipId, string>> = Object.fromEntries(ANIMAL_NAMES.map((a) => [a.clip, a.name]))

export const wave = 1
