// Cosmetic (presentation-only) RNG. NEVER used for outcomes. Seedable for deterministic screenshots.
let s = 0x9e3779b9 >>> 0;
export function seedCosmetic(seed: number): void { s = seed >>> 0 || 1; }
/** mulberry32 → [0,1) */
export function crand(): number {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const crange = (a: number, b: number) => a + (b - a) * crand();
export const cpick = <T>(arr: readonly T[]): T => arr[Math.floor(crand() * arr.length)];
