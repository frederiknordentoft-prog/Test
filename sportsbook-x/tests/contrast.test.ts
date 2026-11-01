import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type RGB = [number, number, number];
type RGBA = [number, number, number, number];

/** Read the custom properties from the :root block of tokens.css. */
function tokens(): Record<string, string> {
  const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const body = css.slice(css.indexOf(':root'));
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function parse(v: string): RGBA {
  if (v.startsWith('#')) {
    const h = v.slice(1);
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = v.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`Unsupported colour: ${v}`);
  const p = m[1].split(',').map((s) => parseFloat(s));
  return [p[0], p[1], p[2], p.length === 4 ? p[3] : 1];
}

/** Composite a (possibly translucent) colour over an opaque background. */
function over(fg: RGBA, bg: RGB): RGB {
  const a = fg[3];
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as RGB;
}

function luminance([r, g, b]: RGB): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const t = tokens();
const bg = over(parse(t['bg']), [0, 0, 0]);
/** A surface token composited over the page background, as the user sees it. */
const surface = (name: string): RGB => over(parse(t[name]), bg);

describe('colour tokens meet WCAG AAA for text (7:1)', () => {
  // Every text colour paired with the surface it is actually shown on.
  const pairs: [string, string, RGB][] = [
    ['text on page', 'text', bg],
    ['muted on page', 'text-muted', bg],
    ['muted on surface', 'text-muted', surface('surface')],
    ['text on surface', 'text', surface('surface')],
    ['muted on raised surface', 'text-muted', over(parse(t['surface-2']), surface('bg-raise'))],
    ['text on raised sheet', 'text', surface('bg-raise')],
    ['muted on toast', 'text-muted', over(parse(t['toast-bg']), [0, 0, 0])],
    ['text on toast', 'text', over(parse(t['toast-bg']), [0, 0, 0])],
    ['warning on page', 'warn', bg],
    ['accent ink on accent', 'accent-ink', over(parse(t['accent']), [0, 0, 0])],
  ];

  for (const [label, token, against] of pairs) {
    it(`${label}: at least 7:1`, () => {
      const fg = over(parse(t[token]), against);
      expect(ratio(fg, against)).toBeGreaterThanOrEqual(7);
    });
  }

  it('the accent used for large display text on the page: at least 4.5:1 (AA large)', () => {
    expect(ratio(parse(t['accent']).slice(0, 3) as RGB, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
