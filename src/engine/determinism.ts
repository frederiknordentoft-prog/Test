// Seeded PRNG + hash for reproducible particle jitter (no Math.random in the sim).

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap 2-int hash → [0,1). Matches hash used in shaders closely enough for seeding. */
export function hash2(a: number, b: number): number {
  let h = (Math.imul(a, 0x85ebca6b) ^ Math.imul(b, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x27d4eb2f) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const DEFAULT_SEED = 1234567;
