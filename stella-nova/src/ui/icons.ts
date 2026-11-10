/**
 * Every glyph the HUD draws, as inline SVG markup built in code.
 *
 * Line icons share one style: 24 px box, 1.5 px stroke, round caps and joins,
 * currentColor. Symbol stand-ins follow the silhouettes in GDD section 2 and
 * are replaced by real 3D renders once setSymbolIcons() is called.
 */
import { SYMBOLS, type SymbolId } from '../core/config';

const n = (v: number) => Math.round(v * 100) / 100;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** 0° is up, positive is clockwise: the same reading as the orrery's spokes. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

function arc(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  const sweep = to > from ? 1 : 0;
  return `M${n(x0)} ${n(y0)}A${r} ${r} 0 ${large} ${sweep} ${n(x1)} ${n(y1)}`;
}

/** Open arrowhead on the end of an arc, swept back along the tangent. */
function arrowHead(cx: number, cy: number, r: number, at: number, clockwise: boolean, size: number): string {
  const a = ((at - 90) * Math.PI) / 180;
  const [x, y] = polar(cx, cy, r, at);
  const dir = clockwise ? 1 : -1;
  const tx = -Math.sin(a) * dir;
  const ty = Math.cos(a) * dir;
  const nx = Math.cos(a);
  const ny = Math.sin(a);
  const bx = x - tx * size;
  const by = y - ty * size;
  const w = size * 0.78;
  return `M${n(bx + nx * w)} ${n(by + ny * w)}L${n(x)} ${n(y)}L${n(bx - nx * w)} ${n(by - ny * w)}`;
}

/** Closed star path. `radii` repeats around the circle, one entry per vertex. */
function star(cx: number, cy: number, points: number, radii: number[], rotate = 0): string {
  let d = '';
  for (let i = 0; i < points; i++) {
    const [x, y] = polar(cx, cy, radii[i % radii.length], rotate + (i * 360) / points);
    d += `${i ? 'L' : 'M'}${n(x)} ${n(y)}`;
  }
  return `${d}Z`;
}

const line = (body: string, box = 24, width = 1.5) =>
  `<svg viewBox="0 0 ${box} ${box}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;

const speaker = '<path d="M4 9.6h3.2L11.5 6v12l-4.3-3.6H4z"/>';

export const ICON = {
  soundOn: line(`${speaker}<path d="M15 9.2a4 4 0 0 1 0 5.6"/><path d="M17.7 6.6a7.6 7.6 0 0 1 0 10.8"/>`),
  soundOff: line(`${speaker}<path d="M15.6 9.6l4.8 4.8M20.4 9.6l-4.8 4.8"/>`),
  menu: line('<path d="M4 7h16M4 12h16M4 17h9"/>'),
  close: line('<path d="M6 6l12 12M18 6L6 18"/>'),
  minus: line('<path d="M6.5 12h11"/>'),
  plus: line('<path d="M6.5 12h11M12 6.5v11"/>'),
  auto: line(
    '<path d="M16.5 3.5l3 3-3 3"/><path d="M4.5 11V9.5a3 3 0 0 1 3-3h12"/><path d="M7.5 20.5l-3-3 3-3"/><path d="M19.5 13v1.5a3 3 0 0 1-3 3h-12"/>',
  ),
  turbo: line('<path d="M13.2 3L5.8 13.4h5.2l-1 7.6 7.4-10.4h-5.2z"/>'),
  autoNudge: line(
    `<path d="${arc(12, 12, 8.2, 48, 318)}"/><path d="${arrowHead(12, 12, 8.2, 318, true, 3.4)}"/>` +
      `<path d="${star(12, 12, 8, [3.7, 1.25])}" fill="currentColor" stroke="none"/>`,
  ),
  skip: line('<path d="M4.5 6.5l6.5 5.5-6.5 5.5z"/><path d="M11.5 6.5L18 12l-6.5 5.5z"/><path d="M20 6.5v11"/>'),
  stop: line('<rect x="7.5" y="7.5" width="9" height="9" rx="0.8"/>'),
  chevLeft: line('<path d="M14.5 6l-6 6 6 6"/>'),
  chevRight: line('<path d="M9.5 6l6 6-6 6"/>'),
  check: line('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  comet: line('<circle cx="16.6" cy="7.4" r="3"/><path d="M14.2 9.6L4 20M17.2 11.1L11 20M12.7 6.4L6 12.4"/>'),
  /** The rings turn in alternating directions, and so do the arrows on the spin button. */
  spin: line(
    `<path d="${arc(16, 16, 11.6, 34, 316)}"/><path d="${arrowHead(16, 16, 11.6, 316, true, 4.4)}"/>` +
      `<path d="${arc(16, 16, 5.9, 214, -52)}"/><path d="${arrowHead(16, 16, 5.9, -52, false, 3.4)}"/>`,
    32,
    2.3,
  ),
  star: `<svg viewBox="0 0 24 24" focusable="false"><path d="${star(12, 12, 16, [11.2, 2.3, 6.2, 2.3])}" fill="currentColor"/></svg>`,
  diamond: '<svg viewBox="0 0 8 8" focusable="false"><path d="M4 0l4 4-4 4-4-4z" fill="currentColor"/></svg>',
} as const;

export type IconName = keyof typeof ICON;

// ───────────────────────────── Symbol stand-ins ─────────────────────────────

const col = (id: number) => hex(SYMBOLS[id].color);
const acc = (id: number) => hex(SYMBOLS[id].accent);

function radial(id: string, stops: [number, string][]): string {
  const s = stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('');
  return `<radialGradient id="${id}" cx="0.36" cy="0.28" r="0.85">${s}</radialGradient>`;
}

/** Deep shade of a symbol colour for the far edge of a gem or globe. */
function shade(c: number, k: number): string {
  const r = Math.round(((c >> 16) & 255) * k);
  const g = Math.round(((c >> 8) & 255) * k);
  const b = Math.round((c & 255) * k);
  return `rgb(${r},${g},${b})`;
}

/**
 * Shared gradients and clips, mounted once in a zero-size SVG at the HUD root
 * so every stand-in can reference them without repeating its own <defs>.
 */
export const SYMBOL_DEFS =
  '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' +
  [0, 1, 2, 3].map((i) => radial(`sn-g${i}`, [[0, acc(i)], [0.42, col(i)], [1, shade(SYMBOLS[i].color, 0.32)]])).join('') +
  radial('sn-g4', [[0, '#ffffff'], [0.4, col(4)], [0.82, acc(4)], [1, shade(SYMBOLS[4].accent, 0.55)]]) +
  radial('sn-g6', [[0, '#fff6dc'], [0.5, col(6)], [1, shade(SYMBOLS[6].color, 0.5)]]) +
  radial('sn-g7', [[0, '#fff8e6'], [0.45, col(7)], [1, acc(7)]]) +
  radial('sn-g8', [[0, '#ffffff'], [0.5, col(8)], [1, '#ffcf5a']]) +
  radial('sn-g9', [[0, '#ffffff'], [0.5, acc(9)], [1, col(9)]]) +
  '<radialGradient id="sn-gshade" cx="0.34" cy="0.3" r="0.8"><stop offset="0.45" stop-color="#03050d" stop-opacity="0"/><stop offset="1" stop-color="#03050d" stop-opacity="0.62"/></radialGradient>' +
  `<linearGradient id="sn-gtail" gradientUnits="userSpaceOnUse" x1="29" y1="11" x2="5" y2="35"><stop offset="0" stop-color="${acc(9)}" stop-opacity="0.95"/><stop offset="0.45" stop-color="${col(9)}" stop-opacity="0.55"/><stop offset="1" stop-color="${col(9)}" stop-opacity="0"/></linearGradient>` +
  '<clipPath id="sn-cdisc"><circle cx="20" cy="20" r="14.5"/></clipPath>' +
  '</defs></svg>';

const facet = (id: number, d: string, opacity = 0.7) =>
  `<path d="${d}" fill="none" stroke="${acc(id)}" stroke-opacity="${opacity}" stroke-width="0.8" stroke-linejoin="round" stroke-linecap="round"/>`;

const glint = (x: number, y: number, rot: number) =>
  `<ellipse cx="${x}" cy="${y}" rx="3.1" ry="1.5" fill="#ffffff" fill-opacity="0.6" transform="rotate(${rot} ${x} ${y})"/>`;

function sapphire(): string {
  const table = star(20, 20, 8, [7.6], 22.5);
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = polar(20, 20, 7.6, 22.5 + i * 45);
    const [x1, y1] = polar(20, 20, 15.4, 22.5 + i * 45);
    const [x2, y2] = polar(20, 20, 15.4, i * 45);
    rays += `M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}M${n(x0)} ${n(y0)}L${n(x2)} ${n(y2)}`;
  }
  return (
    `<circle cx="20" cy="20" r="15.4" fill="url(#sn-g0)"/><path d="${table}" fill="${acc(0)}" fill-opacity="0.22"/>` +
    facet(0, table + rays, 0.6) +
    `<circle cx="20" cy="20" r="15.4" fill="none" stroke="${acc(0)}" stroke-opacity="0.9" stroke-width="0.9"/>` +
    glint(14.6, 12.8, -35)
  );
}

function emerald(): string {
  const outer = 'M14.5 4h11l6 6v20l-6 6h-11l-6-6V10z';
  const inner = 'M16.5 10.5h7l3 3v13l-3 3h-7l-3-3v-13z';
  const corners = 'M14.5 4l2 6.5M25.5 4l-2 6.5M31.5 10l-5 3.5M31.5 30l-5-3.5M25.5 36l-2-6.5M14.5 36l2-6.5M8.5 30l5-3.5M8.5 10l5 3.5';
  return (
    `<path d="${outer}" fill="url(#sn-g1)"/><path d="${inner}" fill="${acc(1)}" fill-opacity="0.2"/>` +
    facet(1, inner + corners, 0.65) +
    `<path d="${outer}" fill="none" stroke="${acc(1)}" stroke-opacity="0.9" stroke-width="0.9" stroke-linejoin="round"/>` +
    glint(15.6, 9.2, -40)
  );
}

function amethyst(): string {
  const outer = 'M20 4.5C26.5 12 32 21 35 31.5C25.5 35.2 14.5 35.2 5 31.5C8 21 13.5 12 20 4.5Z';
  const inner = 'M20 14.5L27.5 27.5H12.5Z';
  const facets = 'M20 4.5V14.5M35 31.5L27.5 27.5M5 31.5L12.5 27.5M16.25 21L10.8 17M23.75 21L29.2 17M20 27.5V34.2';
  return (
    `<path d="${outer}" fill="url(#sn-g2)"/><path d="${inner}" fill="${acc(2)}" fill-opacity="0.24"/>` +
    facet(2, inner + facets, 0.65) +
    `<path d="${outer}" fill="none" stroke="${acc(2)}" stroke-opacity="0.9" stroke-width="0.9" stroke-linejoin="round"/>` +
    glint(16.8, 13.4, -52)
  );
}

function ruby(): string {
  const outer = 'M20 3L33 20L20 37L7 20Z';
  const inner = 'M20 11.5L26.5 20L20 28.5L13.5 20Z';
  const facets = 'M20 3V11.5M33 20H26.5M20 37V28.5M7 20H13.5M26.5 11.5L23.25 15.75M26.5 28.5L23.25 24.25M13.5 28.5L16.75 24.25M13.5 11.5L16.75 15.75';
  return (
    `<path d="${outer}" fill="url(#sn-g3)"/><path d="${inner}" fill="${acc(3)}" fill-opacity="0.22"/>` +
    facet(3, inner + facets, 0.6) +
    `<path d="${outer}" fill="none" stroke="${acc(3)}" stroke-opacity="0.9" stroke-width="0.9" stroke-linejoin="round"/>` +
    glint(16.4, 11.6, -52)
  );
}

function moon(): string {
  const crater = (x: number, y: number, r: number) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${acc(4)}" fill-opacity="0.5"/><path d="${arc(x, y, r, 200, 20)}" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="0.6"/>`;
  return (
    '<circle cx="20" cy="20" r="14.5" fill="url(#sn-g4)"/>' +
    crater(14.2, 14.6, 3.1) +
    crater(24.6, 12.4, 1.8) +
    crater(25.2, 24.2, 3.7) +
    crater(15.4, 26.4, 2.1) +
    crater(19.8, 19.6, 1.2) +
    '<circle cx="28.5" cy="25" r="15.5" fill="#03050d" fill-opacity="0.4" clip-path="url(#sn-cdisc)"/>' +
    `<circle cx="20" cy="20" r="14.5" fill="none" stroke="${col(4)}" stroke-opacity="0.7" stroke-width="0.8"/>`
  );
}

function jupiter(): string {
  const cream = acc(5);
  const dark = shade(SYMBOLS[5].color, 0.72);
  const band = (y: number, h: number, c: string, o: number) => `<rect x="5" y="${y}" width="30" height="${h}" fill="${c}" fill-opacity="${o}"/>`;
  return (
    '<g clip-path="url(#sn-cdisc)">' +
    `<rect x="5" y="5" width="30" height="30" fill="${col(5)}"/>` +
    band(8.6, 3.2, cream, 0.85) +
    band(14.4, 2.3, dark, 0.9) +
    band(18.4, 4.2, cream, 0.8) +
    band(25, 2.8, dark, 0.9) +
    band(30, 2, cream, 0.6) +
    '<ellipse cx="25.6" cy="24" rx="3.5" ry="2.1" fill="#d8532f"/>' +
    '<circle cx="20" cy="20" r="14.5" fill="url(#sn-gshade)"/></g>' +
    `<circle cx="20" cy="20" r="14.5" fill="none" stroke="${cream}" stroke-opacity="0.55" stroke-width="0.8"/>`
  );
}

function saturn(): string {
  const ring = acc(6);
  return (
    '<g transform="rotate(-20 20 20)">' +
    `<ellipse cx="20" cy="20" rx="17.6" ry="5.4" fill="none" stroke="${ring}" stroke-width="2.7"/>` +
    '</g>' +
    '<circle cx="20" cy="20" r="9.4" fill="url(#sn-g6)"/>' +
    `<path d="M11.2 17.6h17.6M10.8 21.4h18.4" stroke="${shade(SYMBOLS[6].color, 0.72)}" stroke-opacity="0.55" stroke-width="1.1" fill="none" transform="rotate(-20 20 20)"/>` +
    '<g transform="rotate(-20 20 20)" fill="none">' +
    `<path d="M2.4 20a17.6 5.4 0 0 0 35.2 0" stroke="${ring}" stroke-width="2.7"/>` +
    `<path d="M2.4 20a17.6 5.4 0 0 0 35.2 0" stroke="${col(6)}" stroke-opacity="0.8" stroke-width="0.7"/>` +
    '</g>'
  );
}

function sun(): string {
  return (
    `<path d="${star(20, 20, 24, [18, 10.4, 14.2, 10.4])}" fill="${acc(7)}"/>` +
    `<path d="${star(20, 20, 24, [15, 10, 12.4, 10], 7.5)}" fill="${col(7)}" fill-opacity="0.85"/>` +
    '<circle cx="20" cy="20" r="9.6" fill="url(#sn-g7)"/>' +
    '<circle cx="20" cy="20" r="9.6" fill="none" stroke="#fff8e6" stroke-opacity="0.7" stroke-width="0.8"/>'
  );
}

function wild(): string {
  return (
    '<circle cx="20" cy="20" r="16" fill="#ffcf5a" fill-opacity="0.12"/>' +
    `<path d="${star(20, 20, 16, [18, 4.2, 10.6, 4.2])}" fill="url(#sn-g8)" stroke="#ffcf5a" stroke-opacity="0.75" stroke-width="0.7" stroke-linejoin="round"/>` +
    '<circle cx="20" cy="20" r="3.1" fill="#ffffff"/>'
  );
}

function comet(): string {
  return (
    '<path d="M25 7.4C15 10 7.5 20 4 36C11.5 26.6 21 20.6 32.4 16.4Z" fill="url(#sn-gtail)"/>' +
    `<path d="M22.6 10.6C15.4 14.2 10 21 6.6 30.6M27.4 15.6C19.6 18.6 13.2 23.6 7.8 31.2" fill="none" stroke="${acc(9)}" stroke-opacity="0.55" stroke-width="0.7" stroke-linecap="round"/>` +
    '<circle cx="27.6" cy="12.2" r="5.8" fill="url(#sn-g9)"/>' +
    `<circle cx="27.6" cy="12.2" r="5.8" fill="none" stroke="${acc(9)}" stroke-opacity="0.9" stroke-width="0.8"/>` +
    `<path d="${star(33.6, 5.6, 8, [2.6, 0.8])}" fill="#ffffff"/>`
  );
}

const SYMBOL_ART: readonly (() => string)[] = [sapphire, emerald, amethyst, ruby, moon, jupiter, saturn, sun, wild, comet];

export function symbolSvg(id: SymbolId): string {
  return `<svg viewBox="0 0 40 40" focusable="false">${SYMBOL_ART[id]()}</svg>`;
}

// ───────────────────────────── Rule diagrams ─────────────────────────────

const RING_R = [12, 21, 30, 39];
const C = 48;

const dia = (body: string) =>
  `<svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;

function ringsBase(highlightRing = -1): string {
  let s = '';
  for (let i = 0; i < RING_R.length; i++) {
    s += `<circle cx="${C}" cy="${C}" r="${RING_R[i]}"${i === highlightRing ? ' class="hi" stroke-width="2"' : ' opacity="0.42"'}/>`;
  }
  return s;
}

function spokes(highlight = -1): string {
  let s = '';
  for (let i = 0; i < 8; i++) {
    const [x0, y0] = polar(C, C, 7, i * 45);
    const [x1, y1] = polar(C, C, 44, i * 45);
    s += `<path d="M${n(x0)} ${n(y0)}L${n(x1)} ${n(y1)}"${i === highlight ? ' class="hi" stroke-width="1.6"' : ' opacity="0.22"'}/>`;
  }
  return s;
}

const hub = (r = 5) => `<path d="${star(C, C, 16, [r, r * 0.24, r * 0.56, r * 0.24])}" class="hif" stroke="none"/>`;

function dot(ring: number, deg: number, cls: string, r = 3): string {
  const [x, y] = polar(C, C, RING_R[ring], deg);
  return `<circle cx="${n(x)}" cy="${n(y)}" r="${r}" class="${cls}"/>`;
}

export const DIAGRAM = {
  /** Four rings, eight spokes, one spoke read from the star outward. */
  board: dia(ringsBase() + spokes(1) + hub() + [0, 1, 2, 3].map((r) => dot(r, 45, 'hif', 2.7)).join('')),
  /** A line pays with the inner three or all four cells alike. */
  line: dia(
    [30, 66]
      .map((y, row) => {
        const filled = row === 0 ? 3 : 4;
        const xs = [34, 51, 68, 85];
        let s = `<path d="${star(13, y, 16, [6.5, 1.5, 3.6, 1.5])}" class="hif" stroke="none"/>`;
        s += `<path d="M21 ${y}H${xs[filled - 1]}" class="hi" stroke-width="2.4" opacity="0.55"/>`;
        s += xs.map((x, i) => `<circle cx="${x}" cy="${y}" r="6.4" ${i < filled ? 'class="hif hi"' : 'opacity="0.42"'}/>`).join('');
        return s;
      })
      .join(''),
  ),
  /** One ring, one notch. */
  nudge: dia(
    ringsBase(2) +
      spokes() +
      hub(4.4) +
      dot(2, 0, 'ghost', 3.6) +
      dot(2, 45, 'hif', 3.6) +
      `<path d="${arc(C, C, 36.5, 7, 37)}" class="hi" stroke-width="1.6"/><path d="${arrowHead(C, C, 36.5, 37, true, 3.6)}" class="hi" stroke-width="1.6"/>`,
  ),
  /** Winning cells burst, and every ring ticks one notch in its own direction. */
  cascade: dia(
    ringsBase() +
      spokes() +
      hub(4.4) +
      [0, 1, 2]
        .map((r) => {
          const [x, y] = polar(C, C, RING_R[r], 270);
          return `<path d="${star(x, y, 8, [4.4, 1.3])}" class="hif" stroke="none"/>`;
        })
        .join('') +
      RING_R.map((r, i) => {
        const cw = i % 2 === 0;
        const from = cw ? 62 : 118;
        const to = cw ? 112 : 68;
        return `<path d="${arc(C, C, r, from, to)}" class="hi" stroke-width="1.7"/><path d="${arrowHead(C, C, r, to, cw, 3)}" class="hi" stroke-width="1.7"/>`;
      }).join(''),
  ),
} as const;

/** Ring picker for the keyboard nudge: four concentric circles, one lit. */
export function ringPickerSvg(): string {
  const rs = [3, 6, 9, 12];
  return `<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="1.4" focusable="false">${rs
    .map((r, i) => `<circle cx="14" cy="14" r="${r}" data-ring="${i}"/>`)
    .join('')}</svg>`;
}
