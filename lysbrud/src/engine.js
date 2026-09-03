/* LYSBRUD — spillets matematiske kerne.
   Ren logik: ingen DOM, intet canvas, ingen timere, ingen Math.random.
   Alt er en funktion af (rng, bræt) og kan køres i Node.

   Koordinatsystem: vinkel 0 = klokken 12, voksende med uret.
   Celle (r, i) i ring r med n celler dækker
   [i·2π/n + offsets[r], (i+1)·2π/n + offsets[r]).
   Offsets er kontinuerte, så nabomønsteret mellem ringene er nyt hvert spin. */

import {
  GEOM, RING_COUNT, TOTAL_CELLS,
  SYMBOLS, WILD, PRISM, SYMBOL_BY_ID, WILD_MULTIPLIERS,
  MIN_CLUSTER, REACTOR_STEPS, BONUS,
  REEL_WEIGHTS, REFILL_WEIGHTS, payBand,
} from './config.js';
import { pickWeighted } from './rng.js';

const TAU = Math.PI * 2;

/** Sikkerhedsloft på kaskadekæden — beskytter mod et teoretisk uendeligt løb. */
export const MAX_CASCADES = 40;

/* ------------------------------------------------------- flad indeksering
   Internt arbejdes der med ét fladt celleindeks f = RING_BASE[r] + i
   (0 … TOTAL_CELLS-1). Det gør flood fill og nabotabeller markant hurtigere
   end nøglestrenge, uden at ændre den udadvendte kontrakt.               */

const RING_BASE = new Int32Array(RING_COUNT);
{
  let acc = 0;
  for (let r = 0; r < RING_COUNT; r++) { RING_BASE[r] = acc; acc += GEOM.cells[r]; }
}

const CELL_RING = new Int32Array(TOTAL_CELLS);
const CELL_IDX  = new Int32Array(TOTAL_CELLS);
const CELL_KEY  = new Array(TOTAL_CELLS);
for (let r = 0; r < RING_COUNT; r++) {
  for (let i = 0; i < GEOM.cells[r]; i++) {
    const f = RING_BASE[r] + i;
    CELL_RING[f] = r;
    CELL_IDX[f]  = i;
    CELL_KEY[f]  = r + ':' + i;
  }
}

/** Cellebredde i radianer pr. ring. */
const CELL_WIDTH = GEOM.cells.map(n => TAU / n);

/** Gem-id'er i tier-rækkefølge (wild og prisme er ikke gems). */
const GEM_IDS = SYMBOLS.map(s => s.id);

/** WILD_MULTIPLIERS som vægtobjekt til pickWeighted. */
const WILD_MULT_WEIGHTS = {};
for (const m of WILD_MULTIPLIERS) WILD_MULT_WEIGHTS[m.value] = m.weight;

/* ------------------------------------------------------------- vinkler */

/** Bring en vinkel ind i [0, 2π). */
function norm(a) {
  let x = a % TAU;
  if (x < 0) x += TAU;
  if (x >= TAU) x -= TAU; // afrundingsværn: (-1e-18 % TAU) + TAU kan give TAU
  return x;
}

/**
 * Overlappende buelængde mellem [a0, a0+wA) og [b0, b0+wB) på cirklen.
 * Sømmen ved 0/2π håndteres ved at måle B relativt til A og også prøve
 * B's kopi én omgang tilbage — en bue der krydser sømmen mister derfor
 * ikke sine naboer.
 */
function arcOverlap(a0, wA, b0, wB) {
  const d = norm(b0 - a0);            // B's start set fra A's start
  let ov = 0;
  const e1 = Math.min(wA, d + wB) - d;      // [d, d+wB) ∩ [0, wA)
  if (e1 > 0) ov += e1;
  const e2 = Math.min(wA, d - TAU + wB);    // [d-2π, d-2π+wB) ∩ [0, wA)
  if (e2 > 0) ov += e2;
  return ov;
}

/* ------------------------------------------------------------- nabotabel */

/** offsets-array → { adj } . WeakMap, så et bræt uden referencer ryger af sig selv. */
const ADJ_CACHE = new WeakMap();

/** Byg fladt naboskab ud fra ringenes offsets. */
function buildAdjacency(offsets) {
  const adj = new Array(TOTAL_CELLS);
  for (let f = 0; f < TOTAL_CELLS; f++) adj[f] = [];

  // Startvinkler for hver celle, normaliseret én gang.
  const starts = new Array(RING_COUNT);
  for (let r = 0; r < RING_COUNT; r++) {
    const n = GEOM.cells[r], w = CELL_WIDTH[r], off = offsets[r] || 0;
    const s = new Float64Array(n);
    for (let i = 0; i < n; i++) s[i] = norm(i * w + off);
    starts[r] = s;
  }

  // 1) Naboer i samme ring — cyklisk, så 0 og n-1 hænger sammen.
  for (let r = 0; r < RING_COUNT; r++) {
    const n = GEOM.cells[r], base = RING_BASE[r];
    for (let i = 0; i < n; i++) {
      adj[base + i].push(base + (i + n - 1) % n, base + (i + 1) % n);
    }
  }

  // 2) Naboer på tværs af ring r og r+1 — kun ved reelt vinkeloverlap.
  for (let r = 0; r < RING_COUNT - 1; r++) {
    const nA = GEOM.cells[r], nB = GEOM.cells[r + 1];
    const wA = CELL_WIDTH[r], wB = CELL_WIDTH[r + 1];
    const eps = GEOM.overlapEps * Math.min(wA, wB);
    const sA = starts[r], sB = starts[r + 1];
    const baseA = RING_BASE[r], baseB = RING_BASE[r + 1];
    for (let i = 0; i < nA; i++) {
      const a0 = sA[i];
      for (let j = 0; j < nB; j++) {
        if (arcOverlap(a0, wA, sB[j], wB) > eps) {
          adj[baseA + i].push(baseB + j);
          adj[baseB + j].push(baseA + i);
        }
      }
    }
  }
  return adj;
}

/** Hent (og cache) det flade naboskab for et bræt. */
function adjacencyFor(board) {
  const key = board.offsets;
  let entry = ADJ_CACHE.get(key);
  if (!entry) {
    entry = { adj: buildAdjacency(key) };
    ADJ_CACHE.set(key, entry);
  }
  return entry.adj;
}

/**
 * Nabotabel i kontraktens form.
 * @returns {Map<string, string[]>} nøgle `${r}:${i}` → naboers nøgler.
 *   Rækkefølge: forrige i ringen, næste i ringen, indre ring, ydre ring.
 */
export function neighbours(board) {
  const adj = adjacencyFor(board);
  const map = new Map();
  for (let f = 0; f < TOTAL_CELLS; f++) {
    const a = adj[f];
    const list = new Array(a.length);
    for (let k = 0; k < a.length; k++) list[k] = CELL_KEY[a[k]];
    map.set(CELL_KEY[f], list);
  }
  return map;
}

/* --------------------------------------------------------------- brættet */

/** Træk et symbol fra en ringvægtning; falder tilbage til laveste gem. */
function rollSymbol(rng, w) {
  const id = pickWeighted(rng, w);
  return id === null ? GEM_IDS[0] : id;
}

/** Træk en wild-multiplikator (1|2|3|5). */
function rollWildMult(rng) {
  const v = pickWeighted(rng, WILD_MULT_WEIGHTS);
  return v === null ? 1 : Number(v);
}

/**
 * Nyt bræt.
 * @param {() => number} rng
 * @param {{weights?: object[], offsets?: number[]}} [opts]
 * @returns {{grid: string[][], offsets: number[], wildMult: number[][]}}
 */
export function createBoard(rng, opts) {
  const o = opts || {};
  const weights = o.weights || REEL_WEIGHTS;

  const offsets = new Array(RING_COUNT);
  if (o.offsets) {
    for (let r = 0; r < RING_COUNT; r++) offsets[r] = norm(Number(o.offsets[r]) || 0);
  } else {
    // Kontinuerte offsets: nabomønsteret mellem ringene er unikt hvert spin.
    for (let r = 0; r < RING_COUNT; r++) offsets[r] = rng() * TAU;
  }

  const grid = new Array(RING_COUNT);
  const wildMult = new Array(RING_COUNT);
  for (let r = 0; r < RING_COUNT; r++) {
    const n = GEOM.cells[r];
    const w = weights[r] || weights[weights.length - 1];
    const row = new Array(n);
    const mrow = new Array(n);
    for (let i = 0; i < n; i++) {
      const id = rollSymbol(rng, w);
      row[i] = id;
      mrow[i] = id === WILD.id ? rollWildMult(rng) : 1;
    }
    grid[r] = row;
    wildMult[r] = mrow;
  }
  return { grid, offsets, wildMult };
}

/* -------------------------------------------------------------- klynger */

/** Er symbolet med i delgrafen for farven `colour`? */
function inSubgraph(sym, colour, wildColor) {
  return sym === colour || sym === WILD.id || (wildColor !== null && sym === wildColor);
}

/** Afrund til 6 decimaler — fjerner flydendetalsstøj i pay-værdier. */
function round6(v) { return Math.round(v * 1e6) / 1e6; }
/** Afrund til øre. */
function round2(v) { return Math.round(v * 100) / 100; }

/**
 * Find alle betalende klynger.
 * @param {object} board
 * @param {{wildColor?: string|null}} [opts] wildColor: i bonus tæller alle gems
 *   af denne farve som wild (de forbinder, men bidrager ikke til wildMultSum).
 * @returns {Array<{symbol:string, cells:[number,number][], size:number,
 *                  wildMultSum:number, pay:number}>}
 */
export function findClusters(board, opts) {
  const wildColor = (opts && opts.wildColor) || null;
  const adj = adjacencyFor(board);
  const grid = board.grid;
  const wm = board.wildMult;

  // Fladt symbolopslag — ét gennemløb, derefter O(1).
  const sym = new Array(TOTAL_CELLS);
  for (let f = 0; f < TOTAL_CELLS; f++) sym[f] = grid[CELL_RING[f]][CELL_IDX[f]];

  const out = [];
  const seen = new Int32Array(TOTAL_CELLS); // 0 = ubesøgt; ellers farverundens tag
  const stack = [];

  for (let ci = 0; ci < GEM_IDS.length; ci++) {
    const colour = GEM_IDS[ci];
    const tag = ci + 1;
    for (let f0 = 0; f0 < TOTAL_CELLS; f0++) {
      if (seen[f0] === tag) continue;
      if (!inSubgraph(sym[f0], colour, wildColor)) continue;

      // Flood fill over delgrafen {farve} ∪ {wild} ∪ {wildColor}.
      seen[f0] = tag;
      stack.length = 0;
      stack.push(f0);
      const cells = [];
      let genuine = 0;   // ægte gems af netop denne farve
      let multSum = 0;   // sum af wildMult over ægte wild-celler

      while (stack.length) {
        const f = stack.pop();
        cells.push(f);
        const s = sym[f];
        if (s === colour) genuine++;
        else if (s === WILD.id) multSum += wm[CELL_RING[f]][CELL_IDX[f]];

        const a = adj[f];
        for (let k = 0; k < a.length; k++) {
          const g = a[k];
          if (seen[g] === tag) continue;
          if (!inSubgraph(sym[g], colour, wildColor)) continue;
          seen[g] = tag;
          stack.push(g);
        }
      }

      // En klynge kræver størrelse og mindst ét ægte gem: rene wild-klatter betaler intet.
      if (cells.length < MIN_CLUSTER || genuine === 0) continue;

      cells.sort((a, b) => a - b);
      const size = cells.length;
      const pays = SYMBOL_BY_ID[colour].pays;
      const list = new Array(size);
      for (let k = 0; k < size; k++) list[k] = [CELL_RING[cells[k]], CELL_IDX[cells[k]]];

      out.push({
        symbol: colour,
        cells: list,
        size,
        wildMultSum: multSum,
        pay: round6(pays[payBand(size)] * Math.max(1, multSum)),
      });
    }
  }
  return out;
}

/* -------------------------------------------------------------- kaskade */

/**
 * Fjern alle klyngeceller og fyld dem op igen. Offsets bevares uændret
 * (samme array-reference — brættet er et uforanderligt øjebliksbillede).
 * @returns {{board: object, removed: [number,number][]}}
 */
export function applyCascade(rng, board, clusters, opts) {
  const weights = (opts && opts.weights) || REFILL_WEIGHTS;

  // En wild kan indgå i flere klynger — markér, så den kun fjernes én gang.
  const hit = new Uint8Array(TOTAL_CELLS);
  if (clusters) {
    for (let c = 0; c < clusters.length; c++) {
      const cells = clusters[c].cells;
      for (let k = 0; k < cells.length; k++) hit[RING_BASE[cells[k][0]] + cells[k][1]] = 1;
    }
  }

  const grid = new Array(RING_COUNT);
  const wildMult = new Array(RING_COUNT);
  for (let r = 0; r < RING_COUNT; r++) {
    grid[r] = board.grid[r].slice();
    wildMult[r] = board.wildMult[r].slice();
  }

  const removed = [];
  for (let f = 0; f < TOTAL_CELLS; f++) {
    if (!hit[f]) continue;
    const r = CELL_RING[f], i = CELL_IDX[f];
    removed.push([r, i]);
    const w = weights[r] || weights[weights.length - 1];
    const id = rollSymbol(rng, w);
    grid[r][i] = id;
    wildMult[r][i] = id === WILD.id ? rollWildMult(rng) : 1;
  }

  return { board: { grid, offsets: board.offsets, wildMult }, removed };
}

/* ----------------------------------------------------------------- spin */

/**
 * Kør et helt spin inkl. hele kaskadekæden.
 * @param {() => number} rng
 * @param {{bet?:number, wildColor?:string|null, weights?:object[],
 *          refillWeights?:object[], board?:object|null, bonus?:boolean}} [opts]
 * @returns {{steps:object[], totalWin:number, prismHits:number, maxMultiplier:number}}
 */
export function spinOutcome(rng, opts) {
  const o = opts || {};
  const bet = Number.isFinite(o.bet) ? o.bet : 1;
  const wildColor = o.wildColor || null;
  const weights = o.weights || REEL_WEIGHTS;
  const refillWeights = o.refillWeights || REFILL_WEIGHTS;
  const ladder = o.bonus ? BONUS.steps : REACTOR_STEPS;

  let board = o.board || createBoard(rng, { weights });
  const opening = board;

  const steps = [];
  let totalWin = 0;
  let maxMultiplier = ladder[0];
  // Reaktortrinnets indeks. I bonus bæres det videre fra forrige gratisspin,
  // så multiplikatoren ikke nulstilles mellem spins.
  let cascades = Number.isInteger(o.startStep) ? Math.max(0, o.startStep) : 0;
  let iterations = 0;

  for (;;) {
    const multiplier = ladder[cascades < ladder.length ? cascades : ladder.length - 1];
    const clusters = iterations < MAX_CASCADES ? findClusters(board, { wildColor }) : [];

    if (clusters.length === 0) {
      // Sidste step: hvilebrættet, intet at betale, intet at fjerne.
      steps.push({ board, clusters: [], multiplier, win: 0, removed: [], nextBoard: null });
      break;
    }

    let base = 0;
    for (let k = 0; k < clusters.length; k++) base += clusters[k].pay;
    const win = round2(base * multiplier * bet);

    const cascade = applyCascade(rng, board, clusters, { weights: refillWeights });
    steps.push({
      board,
      clusters,
      multiplier,
      win,
      removed: cascade.removed,
      nextBoard: cascade.board,
    });

    totalWin += win;
    if (multiplier > maxMultiplier) maxMultiplier = multiplier;
    cascades++;
    iterations++;
    board = cascade.board;
  }

  // Prismer tælles kun i åbningsbrættet — påfyld indeholder aldrig prismer.
  let prismHits = 0;
  for (let r = 0; r < RING_COUNT; r++) {
    const row = opening.grid[r];
    for (let i = 0; i < row.length; i++) if (row[i] === PRISM.id) prismHits++;
  }

  return { steps, totalWin: round2(totalWin), prismHits, maxMultiplier, endStep: cascades };
}
