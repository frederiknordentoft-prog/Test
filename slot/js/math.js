/* =========================================================================
   SlotMath — deterministic game model (presentation-free)
   5 reels × 3 rows, 20 paylines, wild substitution, scatter → free spins.
   Works in browser (window.SlotMath) and Node (module.exports).
   ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SlotMath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const REELS = 5;
  const ROWS = 3;

  // Symbol ids. Paytable values are multipliers of the LINE bet
  // (line bet = total bet / LINES). Scatter pays multiples of TOTAL bet.
  const SYM = {
    WILD: 'WILD', SCAT: 'SCAT',
    H1: 'H1', H2: 'H2', H3: 'H3', H4: 'H4',
    L1: 'L1', L2: 'L2', L3: 'L3', L4: 'L4',
  };
  const ORDER = ['WILD', 'SCAT', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4'];

  const LINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2], [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 1, 1, 1, 0],
    [2, 1, 1, 1, 2], [1, 0, 1, 0, 1], [1, 2, 1, 2, 1], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
    [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
  ];
  const LINE_COUNT = LINES.length;

  // [3-of-a-kind, 4-of-a-kind, 5-of-a-kind] × line bet
  const PAYTABLE = {
    WILD: [50, 250, 1000],
    H1: [50, 250, 1000],
    H2: [40, 150, 600],
    H3: [30, 100, 400],
    H4: [25, 80, 300],
    L1: [11, 42, 140],
    L2: [9, 32, 110],
    L3: [7, 26, 85],
    L4: [5, 20, 65],
  };
  // Scatter: [3, 4, 5] × TOTAL bet, plus free spins
  const SCATTER_PAY = [2, 10, 50];
  const FREE_SPINS_AWARD = 10;
  const FREE_SPINS_RETRIGGER = 5;
  const FREE_SPINS_MULTIPLIER = 2;

  // Per-reel symbol weights. Wild absent on reel 1 (classic), scatter on all reels.
  // Tuned by tools/simulate.mjs — see comments there for the resulting RTP.
  const BASE_WEIGHTS = [
    { WILD: 0, SCAT: 2, H1: 4, H2: 5, H3: 6, H4: 7, L1: 8, L2: 9, L3: 9, L4: 10 },
    { WILD: 3, SCAT: 2, H1: 4, H2: 5, H3: 6, H4: 7, L1: 8, L2: 9, L3: 9, L4: 10 },
    { WILD: 4, SCAT: 2, H1: 4, H2: 5, H3: 6, H4: 7, L1: 8, L2: 9, L3: 9, L4: 10 },
    { WILD: 3, SCAT: 2, H1: 4, H2: 5, H3: 6, H4: 7, L1: 8, L2: 9, L3: 9, L4: 10 },
    { WILD: 3, SCAT: 2, H1: 4, H2: 5, H3: 6, H4: 7, L1: 8, L2: 9, L3: 9, L4: 10 },
  ];
  // Free spins: richer wilds, scatter kept for retrigger.
  const FREE_WEIGHTS = [
    { WILD: 0, SCAT: 2, H1: 5, H2: 5, H3: 6, H4: 7, L1: 8, L2: 8, L3: 9, L4: 9 },
    { WILD: 6, SCAT: 2, H1: 5, H2: 5, H3: 6, H4: 7, L1: 8, L2: 8, L3: 9, L4: 9 },
    { WILD: 7, SCAT: 2, H1: 5, H2: 5, H3: 6, H4: 7, L1: 8, L2: 8, L3: 9, L4: 9 },
    { WILD: 6, SCAT: 2, H1: 5, H2: 5, H3: 6, H4: 7, L1: 8, L2: 8, L3: 9, L4: 9 },
    { WILD: 6, SCAT: 2, H1: 5, H2: 5, H3: 6, H4: 7, L1: 8, L2: 8, L3: 9, L4: 9 },
  ];

  /* ---------- seeded PRNG (mulberry32) ---------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randomSeed() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const u = new Uint32Array(1); crypto.getRandomValues(u); return u[0];
    }
    return (Math.random() * 4294967296) >>> 0;
  }

  /* ---------- reel strips ----------
     Built deterministically from weights: symbols are spread evenly along the
     strip (no two scatters adjacent, no two wilds adjacent) so the visible
     window never shows more than one scatter per reel — a classic, honest rule
     that also keeps "3 scatters" a clean visual event. */
  function buildStrip(weights, seed) {
    const rnd = mulberry32(seed);
    const pool = [];
    for (const id of ORDER) for (let i = 0; i < (weights[id] || 0); i++) pool.push(id);
    // Fisher–Yates
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Repair adjacency for special symbols (circular), a few passes.
    const special = (s) => s === 'SCAT' || s === 'WILD';
    for (let pass = 0; pass < 50; pass++) {
      let fixed = true;
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i], b = pool[(i + 1) % pool.length], c = pool[(i + 2) % pool.length];
        // no special within 2 positions of another special (window is 3 tall)
        if (special(a) && (special(b) || special(c))) {
          const k = (i + 1 + Math.floor(rnd() * (pool.length - 3))) % pool.length;
          const idx = special(b) ? (i + 1) % pool.length : (i + 2) % pool.length;
          if (!special(pool[k])) { [pool[idx], pool[k]] = [pool[k], pool[idx]]; fixed = false; }
        }
      }
      if (fixed) break;
    }
    return pool;
  }
  function buildStrips(weightsPerReel, seedBase) {
    return weightsPerReel.map((w, i) => buildStrip(w, seedBase + i * 7919));
  }
  const BASE_STRIPS = buildStrips(BASE_WEIGHTS, 20240901);
  const FREE_STRIPS = buildStrips(FREE_WEIGHTS, 20240907);

  /* ---------- board from stops ---------- */
  function boardFromStops(strips, stops) {
    const board = [];
    for (let r = 0; r < REELS; r++) {
      const strip = strips[r]; const col = [];
      for (let y = 0; y < ROWS; y++) col.push(strip[(stops[r] + y) % strip.length]);
      board.push(col);
    }
    return board; // board[reel][row]
  }

  /* ---------- evaluation ---------- */
  function evaluate(board, totalBet, opts) {
    const mult = (opts && opts.multiplier) || 1;
    const lineBet = totalBet / LINE_COUNT;
    const lineWins = [];
    let total = 0;

    for (let li = 0; li < LINES.length; li++) {
      const line = LINES[li];
      const syms = line.map((row, reel) => board[reel][row]);
      // pure wild run
      let wildRun = 0;
      while (wildRun < REELS && syms[wildRun] === 'WILD') wildRun++;
      // first non-wild symbol defines the line symbol
      let sym = null;
      for (let i = 0; i < REELS; i++) if (syms[i] !== 'WILD') { sym = syms[i]; break; }
      let run = 0;
      if (sym && sym !== 'SCAT') {
        while (run < REELS && (syms[run] === sym || syms[run] === 'WILD')) run++;
      }
      let best = 0, bestSym = null, bestCount = 0;
      if (wildRun >= 3) { best = PAYTABLE.WILD[wildRun - 3]; bestSym = 'WILD'; bestCount = wildRun; }
      if (sym && sym !== 'SCAT' && run >= 3 && PAYTABLE[sym]) {
        const v = PAYTABLE[sym][run - 3];
        if (v > best) { best = v; bestSym = sym; bestCount = run; }
      }
      if (best > 0) {
        const amount = round2(best * lineBet * mult);
        lineWins.push({
          line: li, symbol: bestSym, count: bestCount, amount,
          positions: line.slice(0, bestCount).map((row, reel) => ({ reel, row })),
        });
        total += amount;
      }
    }

    // scatters anywhere
    const scatterPositions = [];
    for (let r = 0; r < REELS; r++) for (let y = 0; y < ROWS; y++) if (board[r][y] === 'SCAT') scatterPositions.push({ reel: r, row: y });
    const scatters = scatterPositions.length;
    let scatterWin = 0, freeSpins = 0;
    if (scatters >= 3) {
      scatterWin = round2(SCATTER_PAY[Math.min(scatters, 5) - 3] * totalBet * mult);
      total += scatterWin;
      freeSpins = (opts && opts.inFreeSpins) ? FREE_SPINS_RETRIGGER : FREE_SPINS_AWARD;
    }
    return { lineWins, scatterWin, scatterPositions, scatters, freeSpins, total: round2(total) };
  }
  function round2(x) { return Math.round(x * 100) / 100; }

  /* ---------- game session ---------- */
  function createGame(options) {
    const opt = Object.assign({ seed: randomSeed() }, options || {});
    const rnd = mulberry32(opt.seed);
    const state = { seed: opt.seed, spins: 0 };

    function spin(totalBet, ctx) {
      const inFree = !!(ctx && ctx.inFreeSpins);
      const strips = inFree ? FREE_STRIPS : BASE_STRIPS;
      const stops = strips.map((s) => Math.floor(rnd() * s.length));
      const board = boardFromStops(strips, stops);
      const result = evaluate(board, totalBet, { multiplier: inFree ? FREE_SPINS_MULTIPLIER : 1, inFreeSpins: inFree });
      state.spins++;
      return { stops, board, result, strips, inFree };
    }
    return { spin, state };
  }

  // Win tier thresholds as multiples of total bet (presentation hint only)
  function winTier(amount, totalBet) {
    if (amount <= 0) return 'none';
    const x = amount / totalBet;
    if (x >= 50) return 'epic';
    if (x >= 20) return 'mega';
    if (x >= 8) return 'big';
    return 'win';
  }

  return {
    REELS, ROWS, SYM, ORDER, LINES, LINE_COUNT, PAYTABLE, SCATTER_PAY,
    FREE_SPINS_AWARD, FREE_SPINS_RETRIGGER, FREE_SPINS_MULTIPLIER,
    BASE_STRIPS, FREE_STRIPS, BASE_WEIGHTS, FREE_WEIGHTS,
    mulberry32, randomSeed, boardFromStops, evaluate, createGame, winTier,
  };
});
