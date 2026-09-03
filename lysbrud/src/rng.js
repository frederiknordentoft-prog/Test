/* LYSBRUD — deterministisk pseudotilfældighed.
   Hele spillet trækker udelukkende herfra; Math.random bruges ingen steder,
   så et givet frø altid giver præcis det samme spilforløb. */

/* ---------------------------------------------------------------- frø */

/** xmur3-agtig strengehash → uint32, så tekstfrø ('demo-3') kan bruges direkte. */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Normaliser et vilkårligt frø til uint32. */
function normaliseSeed(seed) {
  if (typeof seed === 'string') return hashSeed(seed);
  if (typeof seed === 'number' && Number.isFinite(seed)) {
    return (Math.abs(Math.trunc(seed)) % 4294967296) >>> 0;
  }
  return 0x9e3779b9; // fast standardfrø
}

/* ------------------------------------------------------------ generator */

/**
 * mulberry32 — hurtig 32-bit generator med god fordeling til spilbrug.
 * @param {number|string} [seed]
 * @returns {() => number} rng() ∈ [0, 1)
 */
export function makeRng(seed) {
  let a = normaliseSeed(seed);
  return function rng() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------- udvælgelse */

/** Tilfældigt element fra en liste. undefined for tom liste. */
export function pick(rng, arr) {
  if (!arr || arr.length === 0) return undefined;
  const i = Math.floor(rng() * arr.length);
  return arr[i < arr.length ? i : arr.length - 1];
}

/**
 * Vægtet nøgleudtræk: {a: 2, b: 1} → 'a' ca. dobbelt så ofte som 'b'.
 * Vægte ≤ 0 (og ikke-endelige) springes helt over. null hvis intet kan vælges.
 * Nøglerækkefølgen er objektets egen indsættelsesorden → determinisme.
 */
export function pickWeighted(rng, weights) {
  if (!weights) return null;
  let total = 0;
  for (const k in weights) {
    const w = weights[k];
    if (w > 0 && Number.isFinite(w)) total += w;
  }
  if (!(total > 0)) return null;
  let r = rng() * total;
  let last = null;
  for (const k in weights) {
    const w = weights[k];
    if (!(w > 0) || !Number.isFinite(w)) continue;
    last = k;
    r -= w;
    if (r < 0) return k;
  }
  return last; // kun ved afrundingsfejl i sidste led
}

/** Heltal i [lo, hi], begge inklusive. */
export function randInt(rng, lo, hi) {
  let a = Math.trunc(lo), b = Math.trunc(hi);
  if (b < a) { const t = a; a = b; b = t; }
  const v = a + Math.floor(rng() * (b - a + 1));
  return v > b ? b : v;
}

/** Ny, blandet kopi (Fisher-Yates). Originalen røres ikke. */
export function shuffle(rng, arr) {
  const out = Array.prototype.slice.call(arr || []);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}
