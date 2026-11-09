/**
 * Seeded PRNG (sfc32). Two independent streams exist at runtime:
 *   - the OUTCOME stream, owned by the engine, decides every result;
 *   - the COSMETIC stream, used by render/audio for sparkle and variation.
 * Presentation code must never draw from the outcome stream, and game logic
 * must never call Math.random().
 */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | [number, number, number, number]) {
    if (typeof seed === 'number') {
      // splitmix32 to expand one 32-bit seed into four words
      let s = seed >>> 0;
      const next = () => {
        s = (s + 0x9e3779b9) >>> 0;
        let z = s;
        z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
        z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
        return (z ^ (z >>> 16)) >>> 0;
      };
      this.a = next();
      this.b = next();
      this.c = next();
      this.d = next();
    } else {
      [this.a, this.b, this.c, this.d] = seed.map((x) => x >>> 0) as [number, number, number, number];
    }
    for (let i = 0; i < 15; i++) this.u32();
  }

  /** Uniform 32-bit unsigned integer. */
  u32(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.u32() / 4294967296;
  }

  /** Uniform integer in [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  state(): [number, number, number, number] {
    return [this.a, this.b, this.c, this.d];
  }
}

/** A seed from the platform's CSPRNG, falling back to the clock. */
export function entropySeed(): number {
  try {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0];
  } catch {
    return (Date.now() ^ 0x5bd1e995) >>> 0;
  }
}

/** Shared cosmetic stream for presentation code. */
export const cosmetic = new Rng(0x57e11a);
