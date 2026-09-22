// ============================================================
// NORDLYS · shared outcome types. PURE DATA — no DOM, no Pixi.
// Grid indexing is COLUMN-MAJOR: idx = col * rows + row, row 0 = top.
// Money is always integer øre (1 kr = 100 øre).
// ============================================================

/** Symbol ids. Order matters (index into atlases, paytables). */
export const SYM = {
  L1: 0, // Trekantkrystal (trillion)   #5CE1FF
  L2: 1, // Kvadratkrystal (princess)   #3DFFB0
  L3: 2, // Sekskantkrystal (hex)       #8A5CFF
  L4: 3, // Dråbekrystal (pear)         #FF5C9A
  H1: 4, // Månen
  H2: 5, // Polarstjernen
  H3: 6, // Rav
  WILD: 7, // Nordlysbue
  SUN: 8, // Solen (scatter)
} as const;
export type Sym = (typeof SYM)[keyof typeof SYM];
export const SYM_COUNT = 9;
export const SYM_NAMES = ['Trekantkrystal', 'Kvadratkrystal', 'Sekskantkrystal', 'Dråbekrystal', 'Månen', 'Polarstjernen', 'Rav', 'Nordlysbue (WILD)', 'Solen'] as const;
export const isLow = (s: Sym) => s <= 3;
export const isHigh = (s: Sym) => s >= 4 && s <= 6;

export type Mode = 'base' | 'storm';

/** Mark value per cell: 0 = none, 1 = frost (glow, no multiplier), then 2,4,8,… (multiplier). */
export type Mark = number;

export interface Cluster {
  sym: Sym;            // paying symbol (never WILD/SUN)
  cells: number[];     // all cells in the cluster incl. wilds
  size: number;
  payX: number;        // paytable value × stake multiple, before multiplier
  mult: number;        // max(1, Σ marks ≥ 2 in cluster) using marks BEFORE this step's upgrade
  winOre: number;      // integer øre for this cluster (already scaled by stake, payScale and mult)
}

export interface MarkChange { cell: number; from: Mark; to: Mark }

export interface Step {
  grid: Sym[];               // grid being evaluated at this step
  clusters: Cluster[];       // empty on the final step
  stepWinOre: number;
  removed: number[];         // union of winning cells (wilds included) — they shatter
  markChanges: MarkChange[]; // applied AFTER evaluating this step
  charge: number;            // charge produced by removed cells (0 in storm)
  /** Surviving cells that fall after removal: from idx → to idx (same column). */
  moves: { from: number; to: number }[];
  /** New symbols that drop in from above to fill the gaps, final positions. */
  refill: { cell: number; sym: Sym }[];
}

export interface SpinResult {
  mode: Mode;
  spinId: string;            // e.g. NL-1a2b3c4d-000042
  stakeOre: number;          // stake this spin is evaluated at (locked stake for perks/storm)
  cols: number;
  rows: number;
  initial: Sym[];            // first drop
  marksBefore: Mark[];       // marks at start of spin (storm persistence / perk)
  steps: Step[];             // ≥1; last step has clusters = []
  marksAfter: Mark[];
  sunCells: number[];        // positions of suns in the initial drop (suns never get removed)
  sunPayOre: number;         // 3 suns pay (base only, exactly 3); 0 otherwise
  clusterWinOre: number;     // Σ stepWinOre (after cap)
  totalOre: number;          // T = clusterWinOre + sunPayOre (capped at maxWinX × stake)
  capped: boolean;
  chargeGained: number;      // Σ step.charge + sun charge (base only)
  triggers: {
    stormB: boolean;         // base: 4+ suns
    retriggerSpins: number;  // storm: +3 when 3+ suns
  };
  /** Anticipation: fixed rule — when 3 suns are visible and ≥1 column remains, remaining columns slow down. */
  anticipation: { fromCol: number } | null;
  perk: boolean;             // true if this was a "Ladet spin"
}

export interface StormSpinMeta {
  index: number;             // 0-based storm spin index
  total: number;             // total spins in storm (after retriggers so far)
  wave: { before: Mark[]; after: Mark[] } | null; // Stormbølge applied BEFORE this spin
}

export interface StormSummary {
  stakeOre: number;
  spins: number;
  winOre: number;            // Σ spin totals (capped)
  guaranteeOre: number;      // top-up so that winOre + guaranteeOre ≥ guaranteeX × stake
  maxMark: number;
  capped: boolean;
}
