/**
 * Seeded randomness.
 * mulberry32 and hashSeed are copied from sportsbook-x/src/odds/rng.ts (v0.2).
 * hash32/hash01 are counter-based, so Monte Carlo paths use common random numbers:
 * the same (seed, path, step, channel) always gives the same number.
 */

/** Deterministic PRNG (mulberry32). Same seed, same stream, every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash, used to turn a text label into a seed. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mix(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Counter-based 32-bit hash of (seed, a, b, c). */
export function hash32(seed: number, a: number, b: number, c: number): number {
  let h = mix(seed ^ 0x9e3779b9);
  h = mix(h ^ a);
  h = mix(h ^ Math.imul(b, 0x85ebca6b));
  h = mix(h ^ Math.imul(c, 0xc2b2ae35));
  return h;
}

/** Uniform in [0, 1) from hash32. */
export function hash01(seed: number, a: number, b: number, c: number): number {
  return hash32(seed, a, b, c) / 4294967296;
}
