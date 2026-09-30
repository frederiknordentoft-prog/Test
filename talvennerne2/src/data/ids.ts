// Random ids for profiles and sessions. These are not game logic (that stays on the seeded Rng):
// they only need to be unique on one device, so they come from the platform CSPRNG.
import { hashSeed } from '../engine/rng'

let counter = 0

function randomPart(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.getRandomValues) {
    const bytes = c.getRandomValues(new Uint32Array(2))
    return bytes[0].toString(36) + bytes[1].toString(36)
  }
  // no CSPRNG (very old engines): time, a counter and a hash are still unique per device
  counter += 1
  return hashSeed(`${Date.now()}:${counter}:${typeof performance !== 'undefined' ? performance.now() : 0}`).toString(36) + counter.toString(36)
}

/** `${prefix}_<time><random>`, e.g. 'p_m1x2k3abc…'. Sortable by creation time within a prefix. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${randomPart()}`
}
