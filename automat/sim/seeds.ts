// Seed bookkeeping for the simulator.
// The spec'd per-spin derivation walks ONE 2^32-long splitmix32 Weyl cycle (state = base + k·G), and each
// spin consumes 4 consecutive states starting at k = 4·idx. Two (seed, domain) pairs are therefore just two
// offsets on the same cycle; this helper checks that two idx ranges never share a splitmix state, so
// "fresh seeds" really are fresh.
import { DOMAIN_CONST, type Domain } from '../src/math/rng.ts';

const G = 0x9e3779b9n;
const M = 1n << 32n;
function modInv(a: bigint, m: bigint): bigint {
  let [r0, r1] = [a % m, m];
  let [s0, s1] = [1n, 0n];
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  return ((s0 % m) + m) % m;
}
const GINV = modInv(G, M);

/** Position (in splitmix steps) of the stream start of (seed, domain) on the global Weyl cycle. */
export function cyclePos(seed: number, domain: Domain): bigint {
  const base = BigInt((seed ^ DOMAIN_CONST[domain]) >>> 0);
  return (base * GINV) % M;
}

/** True if spin ranges [fromA, fromA+nA) of (seedA, domA) and [fromB, …) of (seedB, domB) share no state. */
export function disjoint(seedA: number, domA: Domain, fromA: number, nA: number, seedB: number, domB: Domain, fromB: number, nB: number): boolean {
  const a0 = (cyclePos(seedA, domA) + BigInt(4 * fromA)) % M;
  const b0 = (cyclePos(seedB, domB) + BigInt(4 * fromB)) % M;
  const la = BigInt(4 * nA + 4), lb = BigInt(4 * nB + 4);
  const d = (((b0 - a0) % M) + M) % M; // b starts d steps after a
  return d >= la && M - d >= lb;
}

/** Deterministically finds a seed ≥ start whose range is disjoint from all given ranges. */
export function findDisjointSeed(start: number, domain: Domain, from: number, n: number, taken: { seed: number; domain: Domain; from: number; n: number }[]): number {
  for (let s = start >>> 0; ; s = (s + 0x01000193) >>> 0) {
    if (taken.every((t) => disjoint(s, domain, from, n, t.seed, t.domain, t.from, t.n))) return s;
  }
}
