/* ============================================================================
   Procedural playing cards — pure SVG, no assets.
   Minimal, typographic, geometric: white stock, tight indices, standard pip
   layouts, monogram court cards, geometric card back.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Cards = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const W = 250, H = 350, R = 18;
  const FONT = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Segoe UI', Roboto, Inter, Arial, sans-serif";

  // Suit glyphs, normalised to a 100×100 box, centred at (50,50).
  const GLYPH = {
    H: 'M50 91 C31 76 7 58 7 36 C7 24 16 14 28 14 C38 14 46 20 50 29 C54 20 62 14 72 14 C84 14 93 24 93 36 C93 58 69 76 50 91 Z',
    D: 'M50 5 C60 23 75 38 93 50 C75 62 60 77 50 95 C40 77 25 62 7 50 C25 38 40 23 50 5 Z',
    S: 'M50 7 C38 22 8 41 8 60 C8 71 16 79 27 79 C35 79 41 76 46 70 C44 80 39 88 33 93 L67 93 C61 88 56 80 54 70 C59 76 65 79 73 79 C84 79 92 71 92 60 C92 41 62 22 50 7 Z',
    C: 'M50 8 C39 8 30 17 30 28 C30 33 32 38 35 41 C33 40 30 40 28 40 C17 40 8 49 8 60 C8 71 17 80 28 80 C36 80 42 76 46 70 C44 80 39 88 33 93 L67 93 C61 88 56 80 54 70 C58 76 64 80 72 80 C83 80 92 71 92 60 C92 49 83 40 72 40 C70 40 67 40 65 41 C68 38 70 33 70 28 C70 17 61 8 50 8 Z',
  };
  const COLOR = { H: '#D8322B', D: '#D8322B', S: '#1D1D1F', C: '#1D1D1F' };
  const NAME = { H: 'hjerter', D: 'ruder', S: 'spar', C: 'klør' };
  const NAME_EN = { H: 'hearts', D: 'diamonds', S: 'spades', C: 'clubs' };

  // Standard pip layouts on a 250×350 card. [x, y, flipped]
  const L = 76, C = 125, Rr = 174;
  const y1 = 70, y2 = 140, y3 = 210, y4 = 280, ym = 175, y7 = 122, y8 = 228, y10a = 105, y10b = 245;
  const PIPS = {
    A: [[C, ym, 0]],
    2: [[C, y1, 0], [C, y4, 1]],
    3: [[C, y1, 0], [C, ym, 0], [C, y4, 1]],
    4: [[L, y1, 0], [Rr, y1, 0], [L, y4, 1], [Rr, y4, 1]],
    5: [[L, y1, 0], [Rr, y1, 0], [C, ym, 0], [L, y4, 1], [Rr, y4, 1]],
    6: [[L, y1, 0], [Rr, y1, 0], [L, ym, 0], [Rr, ym, 0], [L, y4, 1], [Rr, y4, 1]],
    7: [[L, y1, 0], [Rr, y1, 0], [C, y7, 0], [L, ym, 0], [Rr, ym, 0], [L, y4, 1], [Rr, y4, 1]],
    8: [[L, y1, 0], [Rr, y1, 0], [C, y7, 0], [L, ym, 0], [Rr, ym, 0], [C, y8, 1], [L, y4, 1], [Rr, y4, 1]],
    9: [[L, y1, 0], [Rr, y1, 0], [L, y2, 0], [Rr, y2, 0], [C, ym, 0], [L, y3, 1], [Rr, y3, 1], [L, y4, 1], [Rr, y4, 1]],
    10: [[L, y1, 0], [Rr, y1, 0], [C, y10a, 0], [L, y2, 0], [Rr, y2, 0], [L, y3, 1], [Rr, y3, 1], [C, y10b, 1], [L, y4, 1], [Rr, y4, 1]],
  };

  function glyph(suit, cx, cy, size, flip, extra = '') {
    const s = size / 100;
    return `<path d="${GLYPH[suit]}" transform="translate(${cx} ${cy}) ${flip ? 'rotate(180) ' : ''}scale(${s}) translate(-50 -50)" ${extra}/>`;
  }

  function index(rank, suit, color) {
    const wide = rank === '10';
    const rankSize = wide ? 34 : 38;
    const x = wide ? 14 : 18;
    return `<g font-family="${FONT}" font-weight="600" fill="${color}">
      <text x="${x}" y="46" font-size="${rankSize}" letter-spacing="-1.5">${rank}</text>
      ${glyph(suit, wide ? 32 : 30, 68, 26, 0)}
    </g>`;
  }

  // Court-card emblems, drawn in a 100×100 box, suit-coloured. Geometric, no figures.
  const EMBLEM = {
    K: `<path d="M12 72 L12 30 L33 50 L50 16 L67 50 L88 30 L88 72 Z"/>
        <rect x="12" y="78" width="76" height="9" rx="3"/>`,
    Q: `<path d="M5 78 C22 40 78 40 95 78 C78 60 22 60 5 78 Z"/>
        <circle cx="50" cy="40" r="8"/><circle cx="27" cy="50" r="5"/><circle cx="73" cy="50" r="5"/>
        <rect x="14" y="82" width="72" height="8" rx="3"/>`,
    J: `<path d="M50 6 C60 20 72 28 86 30 C84 62 70 86 50 95 C30 86 16 62 14 30 C28 28 40 20 50 6 Z"/>
        <path d="M31 50 L50 34 L69 50" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M31 70 L50 54 L69 70" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  };

  function court(rank, suit, color) {
    return `<g fill="${color}">
      <rect x="36" y="46" width="178" height="258" rx="14" fill="none" stroke="${color}" stroke-opacity="0.16" stroke-width="2"/>
      <g transform="translate(125 116) scale(0.86) translate(-50 -50)">${EMBLEM[rank]}</g>
      <text x="125" y="268" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="144" letter-spacing="-6" fill="${color}">${rank}</text>
    </g>`;
  }

  function ace(suit, color) {
    const big = suit === 'S';
    return `<g fill="${color}">
      ${glyph(suit, 125, 175, big ? 150 : 128, 0)}
      ${big ? `<circle cx="125" cy="175" r="98" fill="none" stroke="${color}" stroke-opacity="0.14" stroke-width="2"/>` : ''}
    </g>`;
  }

  const cache = new Map();

  /** Returns the SVG markup for a card face (or back when rank is null). */
  function svg(rank, suit, opts = {}) {
    const key = rank + '|' + suit;
    if (cache.has(key)) return cache.get(key);
    const color = COLOR[suit];
    let body;
    if (rank === 'A') body = ace(suit, color);
    else if (rank === 'K' || rank === 'Q' || rank === 'J') body = court(rank, suit, color);
    else {
      const size = rank === '2' || rank === '3' ? 60 : rank === '10' ? 46 : 52;
      body = `<g fill="${color}">${PIPS[rank].map(([x, y, f]) => glyph(suit, x, y, size, f)).join('')}</g>`;
    }
    const label = `${rank} ${NAME[suit]}`;
    const out = `<svg class="card-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" shape-rendering="geometricPrecision">
      <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="#fff"/>
      ${index(rank, suit, color)}
      <g transform="rotate(180 ${W / 2} ${H / 2})">${index(rank, suit, color)}</g>
      ${body}
    </svg>`;
    cache.set(key, out);
    return out;
  }

  let backCache = null;
  /** Card back — graphite, fine crosshatch, inset frame, small centred mark. Same deck in both themes. */
  function back() {
    if (backCache) return backCache;
    const id = 'bjh' + Math.floor(Math.random() * 1e6);
    backCache = `<svg class="card-svg card-svg-back" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 L8 0 M-1 1 L1 -1 M7 9 L9 7" stroke="#fff" stroke-opacity="0.09" stroke-width="1"/>
          <path d="M0 0 L8 8 M-1 7 L1 9 M7 -1 L9 1" stroke="#fff" stroke-opacity="0.09" stroke-width="1"/>
        </pattern>
        <radialGradient id="${id}g" cx="40%" cy="0%" r="110%">
          <stop offset="0" stop-color="#34343a"/><stop offset="0.5" stop-color="#232327"/><stop offset="1" stop-color="#151518"/>
        </radialGradient>
      </defs>
      <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="${R}" fill="#fff"/>
      <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="${R - 7}" fill="url(#${id}g)"/>
      <rect x="9" y="9" width="${W - 18}" height="${H - 18}" rx="${R - 7}" fill="url(#${id})"/>
      <rect x="22" y="22" width="${W - 44}" height="${H - 44}" rx="${R - 14}" fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="1.5"/>
      <circle cx="${W / 2}" cy="${H / 2}" r="30" fill="#1b1b1f" stroke="#fff" stroke-opacity="0.2" stroke-width="1.5"/>
      <g fill="#fff" fill-opacity="0.9">${glyph('S', W / 2, H / 2 - 1, 30, 0)}</g>
    </svg>`;
    return backCache;
  }

  function label(rank, suit, lang = 'da') {
    const names = lang === 'da'
      ? { A: 'es', J: 'knægt', Q: 'dame', K: 'konge' }
      : { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
    const r = names[rank] || rank;
    return lang === 'da' ? `${r} i ${NAME[suit]}` : `${r} of ${NAME_EN[suit]}`;
  }

  return { svg, back, label, GLYPH, COLOR, W, H };
});
