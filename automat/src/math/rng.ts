// ============================================================
// NORDLYS · outcome RNG (the ONLY source of outcome randomness).
//
// Generator : xoshiro128** (Blackman & Vigna), 32-bit state words s0..s3.
// Seeding   : splitmix32 stream (bryc variant, constants 0x21f0aaad / 0x735a2d97).
//
//   base      = (sessionSeed XOR DOMAIN[domain]) >>> 0
//   state     = base + 4·idx·0x9E3779B9  (mod 2^32)   ← the splitmix stream advanced by 4·idx steps
//   s0..s3    = the next four splitmix32 outputs       ← every spin owns 4 disjoint stream outputs
//   (all-zero state is impossible in practice; guarded by s0 = 1)
//
//   DOMAIN = { base: 0x42415345 'BASE', storm: 0x53544F52 'STOR', perk: 0x5045524B 'PERK', demo: 0x44454D4F 'DEMO' }
//
// Draw primitives (all integer-exact, platform independent):
//   u32()   raw xoshiro128** output
//   next()  u32() / 2^32                       ∈ [0,1)
//   int(n)  Lemire multiply-shift with rejection (unbiased) ∈ [0,n)
//
// Pure TS: no DOM, no Node APIs (newSessionSeed uses globalThis.crypto which exists in both).
// ============================================================

export interface Rng {
  u32(): number;
  next(): number; // [0,1)
  int(n: number): number; // [0,n)
}

export type Domain = 'base' | 'storm' | 'perk' | 'demo';

export const DOMAIN_CONST: Readonly<Record<Domain, number>> = {
  base: 0x42415345,
  storm: 0x53544f52,
  perk: 0x5045524b,
  demo: 0x44454d4f,
};

/** Letter used in spin ids. */
export const DOMAIN_LETTER: Readonly<Record<Domain, string>> = { base: 'B', storm: 'S', perk: 'P', demo: 'D' };

const GOLDEN = 0x9e3779b9;
const TWO32 = 4294967296;

/** One splitmix32 step: returns [nextState, output] packed via the out array (no allocation in hot path). */
function splitmixOut(state: number): number {
  let t = state ^ (state >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  t = t ^ (t >>> 15);
  return t >>> 0;
}

/** Reference splitmix32 stream (exported for tests / tooling). */
export function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + GOLDEN) >>> 0;
    return splitmixOut(a);
  };
}

/** xoshiro128** generator. Reseedable so the simulator can reuse one object. */
export class Xoshiro128ss implements Rng {
  s0 = 0;
  s1 = 0;
  s2 = 0;
  s3 = 0;
  /** Provenance of the last seedSpin (numbers only, so the simulator's hot path never builds strings). */
  seedSeed = 0;
  seedDomain: Domain | '' = '';
  seedIdx = -1;

  constructor(s0 = 1, s1 = 0, s2 = 0, s3 = 0) {
    this.setState(s0, s1, s2, s3);
  }

  setState(s0: number, s1: number, s2: number, s3: number): void {
    this.seedDomain = '';
    this.s0 = s0 >>> 0;
    this.s1 = s1 >>> 0;
    this.s2 = s2 >>> 0;
    this.s3 = s3 >>> 0;
    if ((this.s0 | this.s1 | this.s2 | this.s3) === 0) this.s0 = 1;
  }

  /** Re-seed in place exactly like spinRng(sessionSeed, domain, idx). */
  seedSpin(sessionSeed: number, domain: Domain, idx: number): this {
    const base = (sessionSeed ^ DOMAIN_CONST[domain]) >>> 0;
    // advance the splitmix stream by 4·idx steps (idx < 2^51 keeps 4·idx exact in a double)
    let st = (base + Math.imul((4 * idx) % TWO32 | 0, GOLDEN)) >>> 0;
    st = (st + GOLDEN) >>> 0;
    const a = splitmixOut(st);
    st = (st + GOLDEN) >>> 0;
    const b = splitmixOut(st);
    st = (st + GOLDEN) >>> 0;
    const c = splitmixOut(st);
    st = (st + GOLDEN) >>> 0;
    const d = splitmixOut(st);
    this.setState(a, b, c, d);
    this.seedSeed = sessionSeed >>> 0;
    this.seedDomain = domain;
    this.seedIdx = idx;
    return this;
  }

  /** spinId of the (seed, domain, idx) this generator was seeded with ('' if seeded by hand). */
  get spinId(): string {
    return this.seedDomain === '' ? '' : makeSpinId(this.seedSeed, this.seedDomain, this.seedIdx);
  }

  u32(): number {
    const s0 = this.s0, s1 = this.s1, s2 = this.s2, s3 = this.s3;
    const m = Math.imul(s1, 5);
    const result = Math.imul((m << 7) | (m >>> 25), 9) >>> 0;
    const t = s1 << 9;
    const n2 = s2 ^ s0;
    const n3 = s3 ^ s1;
    this.s1 = (s1 ^ n2) >>> 0;
    this.s0 = (s0 ^ n3) >>> 0;
    this.s2 = (n2 ^ t) >>> 0;
    this.s3 = ((n3 << 11) | (n3 >>> 21)) >>> 0;
    return result;
  }

  next(): number {
    return this.u32() / TWO32;
  }

  int(n: number): number {
    // Lemire: m = x·n (exact in a double for n < 2^21); low word l = m mod 2^32
    let x = this.u32();
    let m = x * n;
    let l = m % TWO32;
    if (l < n) {
      const t = (TWO32 - n) % n;
      while (l < t) {
        x = this.u32();
        m = x * n;
        l = m % TWO32;
      }
    }
    return Math.floor(m / TWO32);
  }
}

/** Per-spin outcome RNG: xoshiro128** seeded via splitmix32(sessionSeed ^ DOMAIN[domain]) advanced by idx. */
export function spinRng(sessionSeed: number, domain: Domain, idx: number): Rng {
  return new Xoshiro128ss().seedSpin(sessionSeed, domain, idx);
}

/** Fresh 32-bit session seed from the platform CSPRNG (browser & Node ≥ 19). */
export function newSessionSeed(): number {
  const a = new Uint32Array(1);
  globalThis.crypto.getRandomValues(a);
  return a[0] >>> 0;
}

/** NL-<seed hex8>-<domain letter><idx 6 digits>, e.g. NL-1a2b3c4d-B000042 */
export function makeSpinId(sessionSeed: number, domain: Domain, idx: number): string {
  return 'NL-' + (sessionSeed >>> 0).toString(16).padStart(8, '0') + '-' + DOMAIN_LETTER[domain] + String(idx).padStart(6, '0');
}

/** Inverse of makeSpinId (null if malformed). */
export function parseSpinId(id: string): { sessionSeed: number; domain: Domain; idx: number } | null {
  const m = /^NL-([0-9a-f]{8})-([BSPD])(\d{6,})$/.exec(id);
  if (!m) return null;
  const letter = m[2];
  const domain: Domain = letter === 'B' ? 'base' : letter === 'S' ? 'storm' : letter === 'P' ? 'perk' : 'demo';
  return { sessionSeed: parseInt(m[1], 16) >>> 0, domain, idx: parseInt(m[3], 10) };
}
