// Én seedet sfc32 til hele sim-kernen. Staten ligger i GameState.rngState,
// så save/load og replays er deterministiske. Aldrig Math.random() i src/sim/.

export type RngState = [number, number, number, number];

export type Rng = {
  /** 0 <= x < 1 */
  next(): number;
  /** heltal i [min, max] (begge inklusive) */
  int(min: number, max: number): number;
  /** flydende tal i [min, max) */
  range(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  /** vægtet valg; vægte <= 0 ignoreres */
  weighted<T>(items: readonly T[], weight: (t: T) => number): T;
  /** tilnærmet standardnormalfordeling (sum af 4 uniforme) */
  gauss(): number;
  shuffle<T>(arr: T[]): T[];
  state(): RngState;
};

function sfc32Step(s: RngState): number {
  let [a, b, c, d] = s;
  a |= 0;
  b |= 0;
  c |= 0;
  d |= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  s[0] = a;
  s[1] = b;
  s[2] = c;
  s[3] = d;
  return (t >>> 0) / 4294967296;
}

/** Laver starttilstand ud fra et heltalsseed (splitmix32 til at sprede bits). */
export function seedState(seed: number): RngState {
  let x = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    x = (x + 0x9e3779b9) | 0;
    let z = x;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    z ^= z >>> 16;
    out.push(z >>> 0);
  }
  const s = out as RngState;
  // varm generatoren op
  for (let i = 0; i < 12; i++) sfc32Step(s);
  return s;
}

/** Binder en Rng til et (muterbart) state-array. */
export function makeRng(s: RngState): Rng {
  const next = () => sfc32Step(s);
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    range: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (items, weight) => {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (const it of items) {
        const w = Math.max(0, weight(it));
        if (r < w) return it;
        r -= w;
      }
      return items[items.length - 1];
    },
    gauss: () => (next() + next() + next() + next() - 2) * 1.7320508,
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
    state: () => [s[0], s[1], s[2], s[3]],
  };
  return rng;
}

/** Kosmetisk RNG (UI, partikler). Må aldrig påvirke GameState. */
export function cosmeticRng(seed = 12345): Rng {
  return makeRng(seedState(seed));
}
