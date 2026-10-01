// "The first time" of the guided dressing (SPEC §8): once the Hverdag hat has been pointed out to a
// child on this device, the wardrobe does not point again by itself. A device convenience, not a
// game fact: without storage (private mode, blocked) the wardrobe simply points while nobody wears
// anything yet. Only the app's own `talvennerne2.` keys are touched.
import type { ProfileId } from '../../../../engine/types'

export const GUIDED_KEY = 'talvennerne2.wardrobe.guided'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(): ProfileId[] {
  try {
    const raw = storage()?.getItem(GUIDED_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(list) ? list.filter((x): x is ProfileId => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function wasGuided(profile: ProfileId): boolean {
  return read().includes(profile)
}

export function markGuided(profile: ProfileId): void {
  const list = read()
  if (list.includes(profile)) return
  try {
    storage()?.setItem(GUIDED_KEY, JSON.stringify([...list, profile].slice(-12)))
  } catch {
    // full or blocked: the wardrobe falls back to "nobody wears anything yet"
  }
}
