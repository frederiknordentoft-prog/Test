/* LYSBRUD — central konfiguration.
   Alt tal-, farve- og timing-tuning bor her. Ingen anden fil må hardcode
   spilmatematik eller paletteværdier. */

/* ---------------------------------------------------------------- palette */

export const PALETTE = {
  ink:        '#04060f',
  cavern0:    '#0a0a1c',
  cavern1:    '#141033',
  cavern2:    '#221646',
  cavern3:    '#3a1f6b',
  haze:       '#5b3fa8',
  gold0:      '#3c2a0d',
  gold1:      '#8a6520',
  gold2:      '#d5a63f',
  gold3:      '#f7dc8a',
  gold4:      '#fff6d4',
  teal:       '#5fe3d3',
  cellDark:   '#0d1030',
  cellLight:  '#161a4a',
  text:       '#eef1ff',
  textDim:    '#98a0c8',
};

/* ---------------------------------------------------------------- symboler
   tier      : 0 = lavest betalende … 8 = højest betalende gem
   shape     : hvilken procedural tegner der bruges (art/symbols.js)
   hue/base  : kernefarve; edge = kantlys; glow = additivt skær
   pays      : gevinst pr. klyngestørrelse-bånd, som multiplikator af TOTAL indsats
               bånd: [3-4, 5-6, 7-9, 10-14, 15+]                                */

/* Ni gems. Ni huer OG ni silhuetter, så en klynge kan aflæses både på
   farve og form — nødvendigt når 100 celler er i spil samtidig.
   Antallet er også matematik: færre symboltyper får brættet til aldrig at
   falde til ro, fordi mindstekravet er tre forbundne celler. Se README. */
export const SYMBOLS = [
  { id: 'cyan',   name: 'Isskår',      tier: 0, shape: 'shard',     base: '#3fd0ff', edge: '#d7f6ff', glow: '#59e0ff',
    pays: [0.016,   0.096,   0.719,   5.59,   39.9] },
  { id: 'teal',   name: 'Nordlys',     tier: 1, shape: 'rhomb',     base: '#19dcae', edge: '#c8fff0', glow: '#48ffd0',
    pays: [0.022,   0.130,   0.977,   7.60,   54.3] },
  { id: 'green',  name: 'Malakit',     tier: 2, shape: 'octagon',   base: '#2fbe4a', edge: '#c9ffcf', glow: '#57ff77',
    pays: [0.030,   0.177,   1.330,  10.30,   73.8] },
  { id: 'blue',   name: 'Kobolt',      tier: 3, shape: 'triangle',  base: '#2a6cff', edge: '#bcd8ff', glow: '#5c96ff',
    pays: [0.040,   0.241,   1.810,  14.10,  100.4] },
  { id: 'amber',  name: 'Rav',         tier: 4, shape: 'hexgem',    base: '#ff9a1f', edge: '#ffe2b0', glow: '#ffb84d',
    pays: [0.055,   0.328,   2.460,  19.10,  136.6] },
  { id: 'pink',   name: 'Rosenkvarts', tier: 5, shape: 'webstar',   base: '#ff3ea8', edge: '#ffd0ec', glow: '#ff6cc0',
    pays: [0.074,   0.446,   3.340,  26.00,  185.8] },
  { id: 'red',    name: 'Rubin',       tier: 6, shape: 'quadstar',  base: '#f0243c', edge: '#ffc9cf', glow: '#ff5a68',
    pays: [0.101,   0.606,   4.550,  35.40,  252.6] },
  { id: 'purple', name: 'Ametyst',     tier: 7, shape: 'pentstar',  base: '#9a45ff', edge: '#e7cdff', glow: '#b673ff',
    pays: [0.137,   0.825,   6.180,  48.10,  343.6] },
  { id: 'white',  name: 'Klar Kvarts', tier: 8, shape: 'brilliant', base: '#dbe6ff', edge: '#ffffff', glow: '#eaf1ff',
    pays: [0.187,   1.120,   8.410,  65.40,  467.3] },
];

export const WILD  = { id: 'wild',  name: 'Wild',   shape: 'medallion', base: '#e0ac33', edge: '#fff2c0', glow: '#ffcf5e' };
export const PRISM = { id: 'prism', name: 'Prisme', shape: 'prism',     base: '#8f7bff', edge: '#e9f2ff', glow: '#a9c4ff' };

/** Alle tegnbare symbol-id'er i én liste (til sprite-atlas). */
export const ALL_SYMBOL_IDS = [...SYMBOLS.map(s => s.id), WILD.id, PRISM.id];

/** Opslag: id → definition (gems, wild og prisme). */
export const SYMBOL_BY_ID = Object.fromEntries(
  [...SYMBOLS, WILD, PRISM].map(s => [s.id, s])
);

/** Wild-multiplikatorer der kan lande på et wild-symbol. Vægtet. */
export const WILD_MULTIPLIERS = [
  { value: 1, weight: 62 },
  { value: 2, weight: 20 },
  { value: 3, weight: 12 },
  { value: 5, weight: 6 },
];

/* ------------------------------------------------------------- geometri
   Ringene nummereres 0 (inderst) → 4 (yderst).
   Radier er brøkdele af hjulets ydre radius R.                            */

export const GEOM = {
  /** Antal celler pr. ring, inderst → yderst. 100 celler i alt. */
  cells: [12, 16, 20, 24, 28],
  /** Rail-radier (6 stk: indre kant af ring 0 … ydre kant af ring 4). */
  rails: [0.245, 0.395, 0.545, 0.695, 0.845, 1.0],
  /** Prismekammerets radius (indenfor rail 0). */
  coreRadius: 0.235,
  /** Ydre dekorationsring udenfor rail 5. */
  outerRim: 1.045,
  /** Rotationsretning pr. ring: +1 = med uret. */
  dir: [1, -1, 1, -1, 1],
  /** Minimum vinkeloverlap (som brøk af den smalleste celles bredde)
   *  før to celler i naboringe regnes som forbundne. Høj værdi = kun
   *  celler der reelt flugter forbindes; det er både visuelt ærligt og
   *  det der holder kaskaderne fra at løbe løbsk. */
  overlapEps: 0.80,
};

export const RING_COUNT = GEOM.cells.length;
export const TOTAL_CELLS = GEOM.cells.reduce((a, b) => a + b, 0);

/* ------------------------------------------------------------- matematik */

/** Reaktor-trin. Indeks = antal fuldførte kaskader i spinnet (capped). */
export const REACTOR_STEPS = [1, 2, 3, 5, 7];

/** Mindste klyngestørrelse der betaler. */
export const MIN_CLUSTER = 3;

/** Prisme-bonus: antal ladninger der kræves. */
export const PRISM_TARGET = 5;

/** Bonusrunde. */
export const BONUS = {
  freeSpins: 8,
  retriggerSpins: 4,
  /** Reaktortrin i bonus. Trinnet bæres videre fra ét gratisspin til det
   *  næste, så multiplikatoren bygges op gennem hele runden. */
  steps: [1, 2, 3, 5, 7, 10, 15],
  /** Kernen vælger kun blandt de sjældnere farver. Vælges en hyppig farve
   *  bliver hele brættet forbundet og kaskaderne løber løbsk. */
  wildColorMinTier: 4,
};

/** Indsatstrin i DKK. */
export const BET_LEVELS = [1, 2, 5, 10, 15, 20, 25, 50, 100, 200, 500];
export const DEFAULT_BET_INDEX = 6;      // 25,00 kr.
export const START_BALANCE = 1280;

/** Autospil-valgmuligheder. */
export const AUTOPLAY_LEVELS = [10, 23, 50, 100, 250];

/** Gevinsttærskler som multiplikator af total indsats → overlay-navn. */
export const WIN_TIERS = [
  { at:   15, label: 'STOR GEVINST',  key: 'big'  },
  { at:   60, label: 'MEGA GEVINST',  key: 'mega' },
  { at:  250, label: 'EPISK GEVINST', key: 'epic' },
  { at: 1000, label: 'LYSBRUD!',      key: 'lysbrud' },
];

/* ------------------------------------------------- symbolvægte pr. ring
   Yderringe har lidt flere lav-tier symboler, så høje klynger typisk
   vokser indefra. Wild og prisme har egne, lavere vægte.                 */

export const REEL_WEIGHTS = [
  /* ring 0 */ { cyan: 16.0, teal: 15.0, green: 14.0, blue: 12.5, amber: 11.0, pink: 9.5, red: 8.0, purple: 6.5, white: 5.2, wild: 2.4, prism: 0.75 },
  /* ring 1 */ { cyan: 16.6, teal: 15.4, green: 14.2, blue: 12.6, amber: 11.0, pink: 9.3, red: 7.7, purple: 6.1, white: 4.8, wild: 2.3, prism: 0.65 },
  /* ring 2 */ { cyan: 17.2, teal: 15.8, green: 14.4, blue: 12.7, amber: 10.9, pink: 9.1, red: 7.4, purple: 5.7, white: 4.4, wild: 2.2, prism: 0.55 },
  /* ring 3 */ { cyan: 17.8, teal: 16.2, green: 14.6, blue: 12.8, amber: 10.8, pink: 8.9, red: 7.1, purple: 5.3, white: 4.0, wild: 2.1, prism: 0.48 },
  /* ring 4 */ { cyan: 18.4, teal: 16.6, green: 14.8, blue: 12.9, amber: 10.7, pink: 8.7, red: 6.8, purple: 4.9, white: 3.6, wild: 2.0, prism: 0.42 },
];

/** Vægte brugt til genopfyldning efter en kaskade (ingen prisme i påfyld). */
export const REFILL_WEIGHTS = REEL_WEIGHTS.map(w => ({ ...w, prism: 0 }));

/* ---------------------------------------------------------------- timing
   Alle værdier i millisekunder.                                            */

export const TIMING = {
  spinUp:          420,   // acceleration til fuld fart
  ringStopFirst:  1150,   // hvornår yderste ring står stille
  ringStopStagger: 300,   // forskydning pr. efterfølgende ring
  ringSettle:      420,   // overshoot + tilbagefjedring
  anticipation:   1250,   // ekstra tid på sidste ring når prisme er tæt på
  evaluateDelay:   260,   // pause før klynger fremhæves
  chainDraw:       520,   // energikæden tegnes
  shatter:         420,   // symboler splintres
  refill:          460,   // nye symboler krystalliserer
  cascadeGap:      140,
  winCountMin:     900,   // gevinsttæller
  winCountMax:    2600,
  overlayHold:    1500,
  autoplayGap:     620,
};

/** Hjulets fart ved fuld rotation, radianer pr. sekund, pr. ring. */
export const SPIN_SPEED = [5.4, 4.6, 4.0, 3.5, 3.1];

/* ------------------------------------------------------------- formatting */

const nf2 = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nf0 = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });

/** 1280 → "1.280,00 KR." */
export function kr(v) { return nf2.format(v) + ' KR.'; }
/** 248750 → "248.750" (til store gevinst-overlays) */
export function krBig(v) {
  return (Number.isInteger(v) ? nf0.format(v) : nf2.format(v)) + ' KR.';
}

/** Klyngestørrelse → indeks i pays-arrayet. */
export function payBand(size) {
  if (size <= 4)  return 0;
  if (size <= 6)  return 1;
  if (size <= 9)  return 2;
  if (size <= 14) return 3;
  return 4;
}
