// Farver til canvas-tegning. Spejler designtokens i src/index.css (canvas kan ikke læse CSS-variabler billigt pr. frame).
import type { ParamKey, Phase } from '../sim/types';

export const T = {
  bg: '#171a2b',
  bg2: '#1e2236',
  panel: '#252a42',
  panel2: '#30365a',
  line: '#0b0c16',
  hi: '#4a5282',
  ink: '#f3efe2',
  muted: '#a2a6c4',
  dim: '#6d7299',
  gold: '#ffd23f',
  cyan: '#4ee6d8',
  pink: '#ff6fae',
  good: '#6ee07a',
  bad: '#ff5c5c',
  warn: '#ffa94d',
  violet: '#a58bff',
  sky: '#5cb8ff',
} as const;

/** Faste parameterfarver (UI_BRIEF): Spænding=pink, Originalitet=violet, Teknik=sky, Tryghed=good */
export const PARAM_FARVE: Record<ParamKey, string> = {
  spaending: T.pink,
  originalitet: T.violet,
  teknik: T.sky,
  tryghed: T.good,
};

/** Fasefarver — samme farve som den parameter, fasen primært giver */
export const FASE_FARVE: Record<Phase, string> = {
  koncept: T.violet,
  design: T.pink,
  teknik: T.sky,
  test: T.good,
};

// ---------- Pixelfolk ----------
export const HUD = ['#f6d3b3', '#eec19a', '#d9a077', '#b97f55', '#8d5a3b', '#5f3b27'] as const;
export const HAAR = ['#2a1d17', '#4a2f1f', '#7a4a26', '#b7792f', '#e3c07a', '#c4462e', '#8b8f99', '#e9e4da', '#3b2a4f', '#1f3550'] as const;
export const TROEJE = ['#39406b', '#4f6a8f', '#6b4f7a', '#3f6b5a', '#7a5b3f', '#58606e', '#8a3f4f', '#2f5f6f', '#c9c2b0', '#40465c'] as const;
export const OEJNE = '#1a1420';

// ---------- Hjælpere (bruges kun ved opbygning af statiske lag, aldrig pr. frame) ----------
function hexTilRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function rgbTilHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Gør en farve mørkere (f < 0) eller lysere (f > 0), -1..1 */
export function skygge(hex: string, f: number): string {
  const [r, g, b] = hexTilRgb(hex);
  if (f < 0) return rgbTilHex(r * (1 + f), g * (1 + f), b * (1 + f));
  return rgbTilHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f);
}

/** Bland to farver, t = 0..1 */
export function bland(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexTilRgb(a);
  const [r2, g2, b2] = hexTilRgb(b);
  return rgbTilHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/** rgba()-streng til gennemsigtige lag */
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexTilRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Lille deterministisk hash (FNV-1a) til udseende og variation */
export function hashTekst(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Seedet PRNG (mulberry32) til teksturer i statiske lag */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
