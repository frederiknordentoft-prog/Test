// R14 RNG: xoshiro128** reference vectors, splitmix32 against an independent BigInt implementation,
// the exact spinRng derivation, unbiased int(n), spin ids.
import { describe, it, expect } from 'vitest';
import { Xoshiro128ss, splitmix32, spinRng, newSessionSeed, makeSpinId, parseSpinId, DOMAIN_CONST } from '../src/math/rng.ts';

const M32 = (1n << 32n) - 1n;
/** Independent BigInt splitmix32 (bryc): a += 0x9E3779B9; t = a ^ a>>>16; t *= 0x21F0AAAD; t ^= t>>>15; t *= 0x735A2D97; t ^= t>>>15. */
function refSplitmix(seed: number): () => number {
  let a = BigInt(seed >>> 0);
  return () => {
    a = (a + 0x9e3779b9n) & M32;
    let t = a ^ (a >> 16n);
    t = (t * 0x21f0aaadn) & M32;
    t ^= t >> 15n;
    t = (t * 0x735a2d97n) & M32;
    t ^= t >> 15n;
    return Number(t);
  };
}
/** Independent BigInt xoshiro128** (Blackman & Vigna reference C code). */
function refXoshiro(s0: number, s1: number, s2: number, s3: number): () => number {
  const s = [BigInt(s0 >>> 0), BigInt(s1 >>> 0), BigInt(s2 >>> 0), BigInt(s3 >>> 0)];
  const rotl = (x: bigint, k: bigint) => ((x << k) | (x >> (32n - k))) & M32;
  return () => {
    const result = (rotl((s[1] * 5n) & M32, 7n) * 9n) & M32;
    const t = (s[1] << 9n) & M32;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11n);
    return Number(result);
  };
}

describe('xoshiro128**', () => {
  it('matches the published reference vector for state {1, 2, 3, 4}', () => {
    const g = new Xoshiro128ss(1, 2, 3, 4);
    const out = Array.from({ length: 10 }, () => g.u32());
    expect(out).toEqual([11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804]);
  });
  it('matches an independent BigInt implementation for 5 000 outputs on random states', () => {
    for (const st of [[0x9e3779b9, 0x7f4a7c15, 0xf39cc060, 0x5ced1c1f], [1, 0, 0, 0], [0xffffffff, 0xffffffff, 0xffffffff, 0xffffffff]]) {
      const a = new Xoshiro128ss(st[0], st[1], st[2], st[3]);
      const b = refXoshiro(st[0], st[1], st[2], st[3]);
      for (let i = 0; i < 5000; i++) expect(a.u32()).toBe(b());
    }
  });
  it('all-zero state is guarded', () => {
    const g = new Xoshiro128ss(0, 0, 0, 0);
    expect(g.s0).toBe(1);
    expect(g.u32() | g.u32() | g.u32()).not.toBe(0);
  });
});

describe('splitmix32 and the spinRng derivation', () => {
  it('splitmix32 matches the independent BigInt implementation', () => {
    for (const seed of [0, 1, 0xdeadbeef, 0xffffffff]) {
      const a = splitmix32(seed), b = refSplitmix(seed);
      for (let i = 0; i < 2000; i++) expect(a()).toBe(b());
    }
  });
  it('splitmix32(0) golden vector', () => {
    const g = splitmix32(0);
    expect(Array.from({ length: 4 }, () => g())).toEqual(SPLITMIX0);
  });
  it('spinRng(seed, domain, idx) = xoshiro128** seeded with outputs 4·idx+1 … 4·idx+4 of splitmix32(seed ^ DOMAIN)', () => {
    for (const [seed, domain] of [[0x1a2b3c4d, 'base'], [7, 'storm'], [0xffffffff, 'perk'], [0, 'demo']] as const) {
      const stream = refSplitmix((seed ^ DOMAIN_CONST[domain]) >>> 0);
      for (let idx = 0; idx < 60; idx++) {
        const st = [stream(), stream(), stream(), stream()];
        const ref = refXoshiro(st[0], st[1], st[2], st[3]);
        const r = spinRng(seed, domain, idx);
        for (let k = 0; k < 20; k++) expect(r.u32()).toBe(ref());
      }
    }
  });
  it('large indices jump the stream correctly (idx up to 2^31)', () => {
    const g = new Xoshiro128ss().seedSpin(5, 'base', 1_000_000);
    // advance the reference by 4·10^6 outputs cheaply: state = base + 4·idx·G (mod 2^32)
    const base = (5 ^ DOMAIN_CONST.base) >>> 0;
    const st0 = Number((BigInt(base) + 4n * 1_000_000n * 0x9e3779b9n) & M32);
    const ref = refSplitmix(st0);
    const st = [ref(), ref(), ref(), ref()];
    expect([g.s0, g.s1, g.s2, g.s3]).toEqual(st);
    expect(() => spinRng(5, 'base', 2 ** 31)).not.toThrow();
  });
  it('domains give independent streams', () => {
    const a = spinRng(1, 'base', 0).u32(), b = spinRng(1, 'storm', 0).u32(), c = spinRng(1, 'perk', 0).u32(), d = spinRng(1, 'demo', 0).u32();
    expect(new Set([a, b, c, d]).size).toBe(4);
  });
  it('golden spinRng outputs', () => {
    const r = spinRng(0x1a2b3c4d, 'base', 42);
    expect(Array.from({ length: 4 }, () => r.u32())).toEqual(SPIN_GOLDEN);
  });
});

describe('draw primitives', () => {
  it('next() ∈ [0,1) and int(n) ∈ [0,n)', () => {
    const r = spinRng(3, 'base', 3);
    for (let i = 0; i < 20000; i++) {
      const x = r.next();
      expect(x >= 0 && x < 1).toBe(true);
      const n = 1 + (i % 97);
      const k = r.int(n);
      expect(Number.isInteger(k) && k >= 0 && k < n).toBe(true);
    }
  });
  it('int(n) is Lemire multiply-shift with rejection: unbiased even for n that does not divide 2^32', () => {
    // exact: with a scripted generator, values in the rejection zone are skipped
    const g = new Xoshiro128ss(1, 2, 3, 4);
    const n = 3; // (2^32 − 3) % 3 = 1 → exactly one low word value is rejected
    const vals = Array.from({ length: 30000 }, () => g.int(n));
    const cnt = [0, 0, 0];
    for (const v of vals) cnt[v]++;
    for (const c of cnt) expect(Math.abs(c / 30000 - 1 / 3)).toBeLessThan(0.012);
    // chi-square on int(6)
    const h = new Array(6).fill(0);
    const r = spinRng(11, 'demo', 1);
    for (let i = 0; i < 60000; i++) h[r.int(6)]++;
    const chi = h.reduce((a, o) => a + (o - 10000) ** 2 / 10000, 0);
    expect(chi).toBeLessThan(20.5); // p ≈ 0.001 for 5 dof
  });
});

describe('ids and session seeds', () => {
  it('spinId format NL-<seed hex8>-<letter><idx 6 digits> and round trip', () => {
    expect(makeSpinId(0x1a2b3c4d, 'base', 42)).toBe('NL-1a2b3c4d-B000042');
    expect(makeSpinId(1, 'storm', 100007)).toBe('NL-00000001-S100007');
    expect(makeSpinId(0xffffffff, 'perk', 3)).toBe('NL-ffffffff-P000003');
    expect(makeSpinId(0, 'demo', 0)).toBe('NL-00000000-D000000');
    expect(parseSpinId('NL-1a2b3c4d-B000042')).toEqual({ sessionSeed: 0x1a2b3c4d, domain: 'base', idx: 42 });
    expect(parseSpinId('nope')).toBeNull();
  });
  it('newSessionSeed returns a uint32 from the platform CSPRNG', () => {
    const s = new Set<number>();
    for (let i = 0; i < 50; i++) {
      const x = newSessionSeed();
      expect(Number.isInteger(x) && x >= 0 && x <= 0xffffffff).toBe(true);
      s.add(x);
    }
    expect(s.size).toBeGreaterThan(45);
  });
});

const SPLITMIX0: number[] = [1684164658, 3653269916, 2939563536, 2141751570];
const SPIN_GOLDEN: number[] = [1009890748, 3725814613, 4086335717, 1534929865];
