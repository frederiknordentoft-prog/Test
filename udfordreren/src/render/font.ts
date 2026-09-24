// Indbygget bitmap-pixelfont (3×5 med få bredere tegn) + 5×7-cifre til store tal. Ingen webfonte.
// Små bogstaver tegnes som store. Glyffer er forudberegnet som vandrette "runs" for at spare fillRect-kald.

type Glyf = { w: number; top: number; runs: Int8Array }; // runs: [x, y, længde]*

const LILLE: Record<string, string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  N: ['#..#', '##.#', '#.##', '#..#', '#..#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  Æ: ['.####', '#.#..', '####.', '#.#..', '#.###'],
  Ø: ['.###', '#.##', '#.##', '##.#', '###.'],
  Å: ['.#.', '...', '.#.', '#.#', '###', '#.#', '#.#'], // top: -2
  É: ['..#', '.#.', '###', '#..', '##.', '#..', '###'], // top: -2
  Ü: ['#.#', '...', '#.#', '#.#', '#.#', '#.#', '###'], // top: -2
  Ö: ['#.#', '...', '.#.', '#.#', '#.#', '#.#', '.#.'], // top: -2
  Ä: ['#.#', '...', '.#.', '#.#', '###', '#.#', '#.#'], // top: -2
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '.': ['.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '#', '.'],
  '!': ['#', '#', '#', '.', '#'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '#': ['.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  '(': ['.#', '#.', '#.', '#.', '.#'],
  ')': ['#.', '.#', '.#', '.#', '#.'],
  "'": ['#', '#', '.', '.', '.'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '×': ['...', '#.#', '.#.', '#.#', '...'],
  '·': ['.', '.', '#', '.', '.'],
  '&': ['.#.', '#.#', '.#.', '#.#', '.##'],
  ' ': ['..', '..', '..', '..', '..'],
};
const HOEJE = new Set(['Å', 'É', 'Ü', 'Ö', 'Ä']);

const STOR: Record<string, string[]> = {
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...'],
};

function byg(kilde: Record<string, string[]>, hoeje: Set<string>): Map<string, Glyf> {
  const m = new Map<string, Glyf>();
  for (const [tegn, rows] of Object.entries(kilde)) {
    const runs: number[] = [];
    rows.forEach((r, y) => {
      let x = 0;
      while (x < r.length) {
        if (r[x] === '#') {
          let l = 1;
          while (x + l < r.length && r[x + l] === '#') l++;
          runs.push(x, y, l);
          x += l;
        } else x++;
      }
    });
    m.set(tegn, { w: rows[0].length, top: hoeje.has(tegn) ? -2 : 0, runs: Int8Array.from(runs) });
  }
  return m;
}

const G_LILLE = byg(LILLE, HOEJE);
const G_STOR = byg(STOR, new Set());
const UKENDT = G_LILLE.get('?')!;

function glyf(c: string, stor: boolean): Glyf {
  if (stor) return G_STOR.get(c) ?? G_STOR.get(' ')!;
  return G_LILLE.get(c) ?? G_LILLE.get(c.toUpperCase()) ?? UKENDT;
}

/** Linjehøjde for den lille font (uden accenter over) */
export const LINJE_H = 5;
export const STOR_H = 7;

export function tekstBredde(t: string, skala = 1, stor = false): number {
  let w = 0;
  for (let i = 0; i < t.length; i++) w += glyf(t[i], stor).w + 1;
  return Math.max(0, w - 1) * skala;
}

/** Tegn tekst direkte på en kontekst. (x, y) = øverste venstre hjørne af grundlinjeboksen. */
export function tegnTekst(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, farve: string, skala = 1, stor = false): number {
  ctx.fillStyle = farve;
  let cx = x;
  for (let i = 0; i < t.length; i++) {
    const g = glyf(t[i], stor);
    const r = g.runs;
    for (let k = 0; k < r.length; k += 3) ctx.fillRect(cx + r[k] * skala, y + (r[k + 1] + g.top) * skala, r[k + 2] * skala, skala);
    cx += (g.w + 1) * skala;
  }
  return cx - x - skala;
}

/** Afkort tekst, så den passer i en bredde (med "..") */
export function afkort(t: string, maxBredde: number, skala = 1): string {
  if (tekstBredde(t, skala) <= maxBredde) return t;
  let s = t;
  while (s.length > 1 && tekstBredde(s + '..', skala) > maxBredde) s = s.slice(0, -1);
  return s.trimEnd() + '..';
}

// ---------- Cache af tekst-sprites (bobler, etiketter) ----------
export type TekstSpriteOpts = { baggrund?: string; kant?: string; pad?: number; ikon?: (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => number; ikonNoegle?: string };

const cache = new Map<string, HTMLCanvasElement>();
const MAX_CACHE = 240;

/**
 * Tekst i en lille boks (baggrund + 1px kant) som genbrugeligt sprite. Nøglen er tekst+farver+skala,
 * så de samme tal (fx "+12" i pink) kun tegnes én gang.
 */
export function tekstSprite(t: string, farve: string, skala: number, o: TekstSpriteOpts = {}): HTMLCanvasElement {
  const noegle = `${t}|${farve}|${skala}|${o.baggrund ?? ''}|${o.kant ?? ''}|${o.pad ?? 1}|${o.ikonNoegle ?? ''}`;
  const hit = cache.get(noegle);
  if (hit) return hit;
  const pad = (o.pad ?? 1) * skala;
  const kant = o.kant ? skala : 0;
  const ikonB = o.ikon ? 6 * skala : 0;
  const tb = tekstBredde(t, skala);
  const harHoej = [...t].some((c) => HOEJE.has(c.toUpperCase()));
  const topEkstra = harHoej ? 2 * skala : 0;
  const w = tb + ikonB + pad * 2 + kant * 2;
  const h = LINJE_H * skala + pad * 2 + kant * 2 + topEkstra;
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  const ctx = c.getContext('2d')!;
  if (o.kant) {
    ctx.fillStyle = o.kant;
    // afrundede hjørner: udelad hjørnepixels
    ctx.fillRect(skala, 0, w - 2 * skala, h);
    ctx.fillRect(0, skala, w, h - 2 * skala);
  }
  if (o.baggrund) {
    ctx.fillStyle = o.baggrund;
    ctx.fillRect(kant, kant, w - kant * 2, h - kant * 2);
    if (!o.kant) {
      ctx.clearRect(0, 0, skala, skala);
      ctx.clearRect(w - skala, 0, skala, skala);
      ctx.clearRect(0, h - skala, skala, skala);
      ctx.clearRect(w - skala, h - skala, skala, skala);
    }
  }
  let x = kant + pad;
  const y = kant + pad + topEkstra;
  if (o.ikon) x += o.ikon(ctx, x, y, skala);
  tegnTekst(ctx, t, x, y, farve, skala);
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(noegle, c);
  return c;
}
