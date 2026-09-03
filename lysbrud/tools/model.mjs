/* Uafhængig Monte-Carlo-model af LYSBRUD-matematikken.
   Bevidst skrevet fra bunden — den kontrollerer engine.js i stedet for at
   arve dens fejl, og den kan variere parametre som config.js låser fast.

   node tools/model.mjs                 → fejer hele parameterrummet
   node tools/model.mjs --one           → detaljeret rapport for én konfiguration */

const TAU = Math.PI * 2;

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const has = n => process.argv.includes('--' + n);

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------ konfiguration */

function makeConfig({ cells, gems, eps, minCluster, wildW, prismW, spanRings }) {
  const base = [], width = [];
  let acc = 0;
  for (const n of cells) { base.push(acc); acc += n; width.push(TAU / n); }
  const total = acc;
  const ringOf = new Int32Array(total), idxOf = new Int32Array(total);
  cells.forEach((n, r) => { for (let i = 0; i < n; i++) { ringOf[base[r] + i] = r; idxOf[base[r] + i] = i; } });

  // Symbolvægte: faldende med tier, som i det rigtige spil.
  const gemW = [];
  for (let g = 0; g < gems; g++) gemW.push(20 - g * (12 / Math.max(1, gems - 1)));
  const weights = [...gemW, wildW, prismW];
  const cum = [];
  let s = 0; for (const w of weights) { s += w; cum.push(s); }
  const totalW = s;
  const WILD = gems, PRISM = gems + 1;

  return { cells, base, width, total, ringOf, idxOf, gems, eps, minCluster, cum, totalW, WILD, PRISM, spanRings };
}

function drawSymbol(cfg, rng, allowPrism) {
  const lim = allowPrism ? cfg.totalW : cfg.cum[cfg.gems];
  const x = rng() * lim;
  for (let k = 0; k < cfg.cum.length; k++) if (x < cfg.cum[k]) return k;
  return cfg.gems - 1;
}

function makeBoard(cfg, rng, allowPrism = true) {
  const grid = new Int32Array(cfg.total);
  for (let f = 0; f < cfg.total; f++) grid[f] = drawSymbol(cfg, rng, allowPrism);
  const offsets = cfg.cells.map(() => rng() * TAU);
  return { grid, offsets };
}

/* ---------------------------------------------------------------- naboer */

function buildNeighbours(cfg, offsets) {
  const nb = Array.from({ length: cfg.total }, () => []);
  // Langs ringen.
  cfg.cells.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const f = cfg.base[r] + i;
      nb[f].push(cfg.base[r] + ((i + 1) % n));
      nb[cfg.base[r] + ((i + 1) % n)].push(f);
    }
  });
  // På tværs af ringe.
  for (let r = 0; r + 1 < cfg.cells.length; r++) {
    const wA = cfg.width[r], wB = cfg.width[r + 1];
    const need = cfg.eps * Math.min(wA, wB);
    for (let i = 0; i < cfg.cells[r]; i++) {
      const a0 = offsets[r] + i * wA;
      for (let j = 0; j < cfg.cells[r + 1]; j++) {
        const b0 = offsets[r + 1] + j * wB;
        // Overlap på cirklen: mål forskydningen mellem intervalstarterne.
        let d = ((b0 - a0) % TAU + TAU) % TAU;
        if (d > Math.PI) d -= TAU;
        const ov = Math.min(a0 + wA, b0 + wB + (d < 0 ? 0 : 0)) - Math.max(a0, b0);
        // Beregn direkte i den forskudte ramme for at undgå sømfejl.
        const lo = Math.max(0, d), hi = Math.min(wA, d + wB);
        const overlap = hi - lo;
        void ov;
        if (overlap > need) {
          nb[cfg.base[r] + i].push(cfg.base[r + 1] + j);
          nb[cfg.base[r + 1] + j].push(cfg.base[r] + i);
        }
      }
    }
  }
  return nb;
}

/* -------------------------------------------------------------- klynger */

function findClusters(cfg, grid, nb) {
  const out = [];
  const seen = new Int32Array(cfg.total).fill(-1);
  const stack = new Int32Array(cfg.total);

  for (let g = 0; g < cfg.gems; g++) {
    for (let start = 0; start < cfg.total; start++) {
      if (grid[start] !== g) continue;
      if (seen[start] === g) continue;
      let sp = 0; stack[sp++] = start; seen[start] = g;
      const cells = [];
      let gemCount = 0, wilds = 0;
      const rings = new Set();
      while (sp > 0) {
        const f = stack[--sp];
        cells.push(f);
        rings.add(cfg.ringOf[f]);
        if (grid[f] === g) gemCount++; else wilds++;
        for (const n of nb[f]) {
          if (seen[n] === g) continue;
          if (grid[n] === g || grid[n] === cfg.WILD) { seen[n] = g; stack[sp++] = n; }
        }
      }
      if (gemCount >= 1 && cells.length >= cfg.minCluster &&
          (!cfg.spanRings || rings.size >= 2)) {
        out.push({ gem: g, cells, size: cells.length, wilds });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ udbetaling
   Fælles formkurve: pay = tierFaktor × sizeKurve(size).                    */

function payOf(cfg, gem, size, payScale) {
  const tier = gem / Math.max(1, cfg.gems - 1);          // 0 … 1
  const tierF = 0.18 * Math.pow(9, tier);                 // 0.18 … 1.62
  const sizeF = Math.pow(size - cfg.minCluster + 1, 2.6);
  return tierF * sizeF * payScale;
}

/* ------------------------------------------------------------------ spin */

const REACTOR = [1, 2, 3, 5, 7];

function simulate(cfg, rng, spins, payScale) {
  let staked = 0, paid = 0, dead = 0, cascTotal = 0, clusterTotal = 0, cells = 0;
  let maxWin = 0, capHits = 0;
  const bands = [0, 0, 0, 0, 0, 0, 0];
  let cascHist = new Array(12).fill(0);

  for (let s = 0; s < spins; s++) {
    const board = makeBoard(cfg, rng, true);
    const nb = buildNeighbours(cfg, board.offsets);
    const grid = board.grid;
    let win = 0, step = 0;

    for (;;) {
      const cl = findClusters(cfg, grid, nb);
      if (!cl.length || step >= 40) { if (step >= 40) capHits++; break; }
      const mult = REACTOR[Math.min(REACTOR.length - 1, step)];
      const kill = new Set();
      for (const c of cl) {
        win += payOf(cfg, c.gem, c.size, payScale) * mult;
        clusterTotal++; cells += c.size;
        for (const f of c.cells) kill.add(f);
      }
      for (const f of kill) grid[f] = drawSymbol(cfg, rng, false);
      step++;
    }

    staked += 1; paid += win;
    cascTotal += step;
    cascHist[Math.min(11, step)]++;
    if (win === 0) dead++;
    maxWin = Math.max(maxWin, win);
    const m = win;
    bands[m === 0 ? 0 : m < 1 ? 1 : m < 5 ? 2 : m < 15 ? 3 : m < 60 ? 4 : m < 250 ? 5 : 6]++;
  }

  return {
    rtp: paid / staked, dead: dead / spins, casc: cascTotal / spins,
    clusters: clusterTotal / spins, avgSize: cells / Math.max(1, clusterTotal),
    maxWin, capPct: capHits / spins,
    bands: bands.map(b => b / spins), cascHist: cascHist.map(b => b / spins),
  };
}

/* --------------------------------------------------------------- sweep */

const pct = v => (v * 100).toFixed(1).padStart(5) + '%';
const CELL_SETS = {
  '100 (12·16·20·24·28)': [12, 16, 20, 24, 28],
  '90 (10·14·18·22·26)':  [10, 14, 18, 22, 26],
  '80 (10·13·16·19·22)':  [10, 13, 16, 19, 22],
  '70 (8·11·14·17·20)':   [8, 11, 14, 17, 20],
};

if (has('one')) {
  const cfg = makeConfig({
    cells: JSON.parse(arg('cells', '[12,16,20,24,28]')),
    gems: Number(arg('gems', 8)), eps: Number(arg('eps', 0.5)),
    minCluster: Number(arg('min', 3)), wildW: Number(arg('wild', 4)),
    prismW: Number(arg('prism', 2)), spanRings: has('span'),
  });
  const r = simulate(cfg, mulberry32(1), Number(arg('spins', 40000)), Number(arg('scale', 0.02)));
  console.log(JSON.stringify({
    rtp: pct(r.rtp), dead: pct(r.dead), casc: r.casc.toFixed(2),
    clusters: r.clusters.toFixed(2), avgSize: r.avgSize.toFixed(2),
    maxWin: Math.round(r.maxWin), cap: pct(r.capPct),
    bands: r.bands.map(pct), cascHist: r.cascHist.map(pct),
  }, null, 2));
  process.exit(0);
}

console.log('Mål: død 30–45 %, kaskader 0.8–1.8 pr. spin, klynger 1–3 pr. spin, loft ~0 %\n');
console.log('celler                  gems  eps   min  wildW  span  død     kask   klynger  str.  loft   payskala→96%');
console.log('─'.repeat(112));

const rows = [];
for (const [label, cells] of Object.entries(CELL_SETS)) {
  for (const gems of [6, 8, 10]) {
    for (const eps of [0.2, 0.45, 0.7]) {
      for (const minCluster of [3, 4, 5]) {
        for (const wildW of [2, 4]) {
          for (const spanRings of [false]) {
            const cfg = makeConfig({ cells, gems, eps, minCluster, wildW, prismW: 2, spanRings });
            const r = simulate(cfg, mulberry32(99), 3000, 0.02);
            const good = r.dead > 0.25 && r.dead < 0.52 && r.casc > 0.7 && r.casc < 2.2 && r.capPct < 0.001;
            rows.push({ label, gems, eps, minCluster, wildW, spanRings, ...r, good });
            if (!good && !has('all')) continue;
            console.log(
              `${label.padEnd(23)} ${String(gems).padEnd(5)} ${String(eps).padEnd(5)} ${String(minCluster).padEnd(4)} ` +
              `${String(wildW).padEnd(6)} ${(spanRings ? 'ja' : 'nej').padEnd(5)} ` +
              `${pct(r.dead)} ${r.casc.toFixed(2).padStart(6)} ${r.clusters.toFixed(2).padStart(8)} ` +
              `${r.avgSize.toFixed(1).padStart(5)} ${pct(r.capPct)} ` +
              `${(0.96 / (r.rtp / 0.02)).toExponential(2).padStart(10)}`
            );
          }
        }
      }
    }
  }
}

const good = rows.filter(r => r.good);
console.log(`\n${good.length} af ${rows.length} konfigurationer rammer målprofilen.`);
if (good.length) {
  const best = good.reduce((a, b) => Math.abs(b.dead - 0.38) < Math.abs(a.dead - 0.38) ? b : a);
  console.log(`Tættest på 38 % døde spins: ${best.label}, ${best.gems} gems, eps ${best.eps}, min ${best.minCluster}, wildvægt ${best.wildW}`);
  console.log(`  død ${pct(best.dead)}, kaskader ${best.casc.toFixed(2)}, klynger ${best.clusters.toFixed(2)}, str. ${best.avgSize.toFixed(1)}`);
  console.log(`  fordeling: ${best.bands.map(pct).join(' ')}`);
}
