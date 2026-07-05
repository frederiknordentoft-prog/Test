/** Deterministisk seeded RNG (mulberry32) — bruges af challenges, tests og render-nister. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Tilfældigt heltal i [0, n). */
export function randInt(rng: () => number, n: number): number {
  return Math.floor(rng() * n)
}

/** Vælg et tilfældigt element fra en ikke-tom liste. */
export function pick<T>(rng: () => number, list: readonly T[]): T {
  const item = list[randInt(rng, list.length)]
  if (item === undefined) throw new Error('pick fra tom liste')
  return item
}
