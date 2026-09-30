/**
 * Seeded PRNG. Game logic never calls Math.random() — every random choice comes
 * from an injected Rng, so a round is reproducible from its seed and a bad round
 * can be replayed in a test.
 */
export interface Rng {
  /** float in [0, 1) */
  next(): number
  /** integer in [0, maxExclusive) */
  int(maxExclusive: number): number
  /** integer in [min, max] */
  between(min: number, max: number): number
  pick<T>(items: readonly T[]): T
  /** returns a new shuffled array; does not mutate the input */
  shuffle<T>(items: readonly T[]): T[]
}

export function makeRng(seed: number): Rng {
  // mulberry32 — small, fast, good enough distribution for game content
  let s = seed >>> 0
  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (maxExclusive: number) => Math.floor(next() * maxExclusive)
  return {
    next,
    int,
    between: (min, max) => min + int(max - min + 1),
    pick: (items) => items[int(items.length)],
    shuffle(items) {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(i + 1)
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

/** Stable 32-bit hash of a string — turns ids like "add:3+4" into a seed. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
