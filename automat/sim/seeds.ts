// Seed bookkeeping for the simulator.
// The spec'd per-spin derivation walks ONE 2^32-long splitmix32 Weyl cycle (state = base + k·G), and each
// spin idx consumes the 4 consecutive states k = 4·idx+1 … 4·idx+4. Every (seed, domain) pair is therefore
// just an offset on the same cycle, and a big sample (10^8 spins = 4·10^8 states ≈ 9 % of the cycle) can
// collide with another sample's range. SeedPlan hands out seeds whose idx ranges share no splitmix state
// with anything allocated before — so "fresh seeds" really are fresh and CRN samples really are shared.
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

export interface Range { seed: number; domain: Domain; from: number; n: number; name?: string }

/** True if the two idx ranges share no splitmix state. */
export function disjointRanges(a: Range, b: Range): boolean {
  const a0 = (cyclePos(a.seed, a.domain) + BigInt(4 * a.from)) % M;
  const b0 = (cyclePos(b.seed, b.domain) + BigInt(4 * b.from)) % M;
  const la = BigInt(4 * a.n + 4), lb = BigInt(4 * b.n + 4);
  const d = (((b0 - a0) % M) + M) % M; // b starts d steps after a
  return d >= la && M - d >= lb;
}

export class SeedPlan {
  readonly taken: Range[] = [];
  constructor(taken: Range[] = []) {
    this.taken.push(...taken);
  }
  /**
   * Deterministically finds the first seed ≥ start (stepping by an odd constant) for which every part
   * [from, from+n) in its domain is disjoint from all ranges taken so far and from the other parts.
   */
  alloc(name: string, start: number, parts: { domain: Domain; from?: number; n: number }[]): number {
    for (let s = start >>> 0, tries = 0; tries < 100000; s = (s + 0x01000193) >>> 0, tries++) {
      const rs: Range[] = parts.map((p) => ({ seed: s, domain: p.domain, from: p.from ?? 0, n: p.n, name }));
      let ok = true;
      for (let i = 0; ok && i < rs.length; i++) {
        for (const t of this.taken) if (!disjointRanges(rs[i], t)) { ok = false; break; }
        for (let k = i + 1; ok && k < rs.length; k++) if (!disjointRanges(rs[i], rs[k])) ok = false;
      }
      if (ok) {
        this.taken.push(...rs);
        return s;
      }
    }
    throw new Error('SeedPlan: no disjoint seed found for ' + name);
  }
}
