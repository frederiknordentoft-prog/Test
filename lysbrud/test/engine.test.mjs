/* LYSBRUD — smoke- og korrekthedstest for rng.js og engine.js.
   Afhængighedsfri. Kør:  node test/engine.test.mjs
   Exit 0 = alt grønt, exit 1 = mindst én fejl. */

import {
  GEOM, RING_COUNT, TOTAL_CELLS, MIN_CLUSTER, REACTOR_STEPS, BONUS,
  SYMBOL_BY_ID, REEL_WEIGHTS, REFILL_WEIGHTS, payBand,
} from '../src/config.js';
import { makeRng, pick, pickWeighted, randInt, shuffle } from '../src/rng.js';
import {
  createBoard, neighbours, findClusters, applyCascade, spinOutcome, MAX_CASCADES,
} from '../src/engine.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------------- testramme */

let passed = 0;
const failures = [];
let group = '';

function section(name) { group = name; console.log('\n\x1b[1m— ' + name + '\x1b[0m'); }

function ok(cond, label, detail) {
  if (cond) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else {
    failures.push(group + ' → ' + label + (detail ? '\n      ' + detail : ''));
    console.log('  \x1b[31m✗ ' + label + '\x1b[0m' + (detail ? '\n      ' + detail : ''));
  }
}

function eq(actual, expected, label) {
  ok(Object.is(actual, expected), label, Object.is(actual, expected) ? '' : `fik ${fmt(actual)}, ventede ${fmt(expected)}`);
}

function near(actual, expected, label, tol = 1e-9) {
  const good = Number.isFinite(actual) && Math.abs(actual - expected) <= tol;
  ok(good, label, good ? '' : `fik ${fmt(actual)}, ventede ≈${fmt(expected)}`);
}

function deepEq(a, b, label) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  ok(sa === sb, label, sa === sb ? '' : `\n      a=${sa.slice(0, 240)}\n      b=${sb.slice(0, 240)}`);
}

function fmt(v) { return typeof v === 'number' ? String(v) : JSON.stringify(v); }

/* --------------------------------------------------------- hjælpere */

/** Byg et bræt fra en funktion (r,i) → symbol-id. */
function board(symFn, offsets, multFn) {
  const grid = [], wildMult = [];
  for (let r = 0; r < RING_COUNT; r++) {
    const row = [], m = [];
    for (let i = 0; i < GEOM.cells[r]; i++) { row.push(symFn(r, i)); m.push(multFn ? multFn(r, i) : 1); }
    grid.push(row); wildMult.push(m);
  }
  const off = offsets ? offsets.slice() : new Array(RING_COUNT).fill(0);
  return { grid, offsets: off, wildMult };
}

/** Bræt hvor alt er prisme (forbinder aldrig) undtagen et opslag i yderringen. */
function outerRingBoard(spec, mults) {
  return board(
    (r, i) => (r === 4 && spec[i] !== undefined ? spec[i] : 'prism'),
    null,
    (r, i) => (r === 4 && mults && mults[i] !== undefined ? mults[i] : 1)
  );
}

/** Uafhængigt orakel for buoverlap: rul begge buer ud i højst to
 *  ikke-ombrydende intervaller og skær dem parvis. Helt anden metode
 *  end engine'ens relative forskydning. */
function overlapOracle(a0, wA, b0, wB) {
  const ivs = (s0, w) => {
    const s = ((s0 % TAU) + TAU) % TAU, e = s + w;
    return e <= TAU ? [[s, e]] : [[s, TAU], [0, e - TAU]];
  };
  let t = 0;
  for (const [as, ae] of ivs(a0, wA)) {
    for (const [bs, be] of ivs(b0, wB)) t += Math.max(0, Math.min(ae, be) - Math.max(as, bs));
  }
  return t;
}

/** Forventet nabotabel beregnet med oraklet. */
function oracleNeighbours(offsets) {
  const exp = new Map();
  for (let r = 0; r < RING_COUNT; r++) for (let i = 0; i < GEOM.cells[r]; i++) exp.set(r + ':' + i, new Set());
  for (let r = 0; r < RING_COUNT; r++) {
    const n = GEOM.cells[r];
    for (let i = 0; i < n; i++) {
      exp.get(r + ':' + i).add(r + ':' + ((i + n - 1) % n));
      exp.get(r + ':' + i).add(r + ':' + ((i + 1) % n));
    }
  }
  for (let r = 0; r < RING_COUNT - 1; r++) {
    const nA = GEOM.cells[r], nB = GEOM.cells[r + 1];
    const wA = TAU / nA, wB = TAU / nB;
    const eps = GEOM.overlapEps * Math.min(wA, wB) + 1e-9;
    for (let i = 0; i < nA; i++) {
      for (let j = 0; j < nB; j++) {
        if (overlapOracle(i * wA + offsets[r], wA, j * wB + offsets[r + 1], wB) > eps) {
          exp.get(r + ':' + i).add((r + 1) + ':' + j);
          exp.get((r + 1) + ':' + j).add(r + ':' + i);
        }
      }
    }
  }
  return exp;
}

/* ================================================================= rng */

section('rng — determinisme og fordeling');
{
  const a = makeRng(1234), b = makeRng(1234), c = makeRng(1235);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 64; i++) { sa.push(a()); sb.push(b()); sc.push(c()); }
  deepEq(sa, sb, 'samme frø → samme talrække');
  ok(sa.join() !== sc.join(), 'forskelligt frø → anden talrække');
  ok(sa.every(v => v >= 0 && v < 1 && Number.isFinite(v)), 'alle værdier i [0,1)');

  const s1 = makeRng('nordlys'), s2 = makeRng('nordlys');
  eq(s1(), s2(), 'strengfrø er deterministisk');

  const r = makeRng(9);
  let mn = 1, mx = 0, sum = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) { const v = r(); sum += v; if (v < mn) mn = v; if (v > mx) mx = v; }
  ok(Math.abs(sum / N - 0.5) < 0.005, 'middelværdi ≈ 0.5', 'fik ' + (sum / N).toFixed(5));
  ok(mn < 0.001 && mx > 0.999, 'dækker hele intervallet');

  // pick / randInt / shuffle
  const rr = makeRng(3);
  const arr = [10, 20, 30, 40];
  const seenPick = new Set();
  for (let i = 0; i < 500; i++) seenPick.add(pick(rr, arr));
  eq(seenPick.size, 4, 'pick rammer alle elementer');
  eq(pick(rr, []), undefined, 'pick på tom liste → undefined');

  let lo = 99, hi = -99;
  for (let i = 0; i < 5000; i++) { const v = randInt(rr, -3, 4); if (v < lo) lo = v; if (v > hi) hi = v; ok_int(v); }
  function ok_int(v) { if (!Number.isInteger(v)) throw new Error('randInt gav ikke-heltal'); }
  ok(lo === -3 && hi === 4, 'randInt inklusiv i begge ender', `lo=${lo} hi=${hi}`);
  eq(randInt(rr, 5, 5), 5, 'randInt med lo===hi');

  const src = [1, 2, 3, 4, 5, 6, 7, 8];
  const sh = shuffle(rr, src);
  deepEq(src, [1, 2, 3, 4, 5, 6, 7, 8], 'shuffle muterer ikke originalen');
  deepEq(sh.slice().sort((x, y) => x - y), src, 'shuffle bevarer alle elementer');

  // pickWeighted: nulvægte må aldrig vælges (prisme i REFILL_WEIGHTS)
  const w = { a: 3, b: 1, c: 0 };
  const counts = { a: 0, b: 0, c: 0 };
  const rw = makeRng(77);
  for (let i = 0; i < 40000; i++) counts[pickWeighted(rw, w)]++;
  eq(counts.c, 0, 'pickWeighted vælger aldrig vægt 0');
  ok(Math.abs(counts.a / (counts.a + counts.b) - 0.75) < 0.02, 'pickWeighted rammer vægtforholdet',
    'a-andel ' + (counts.a / 40000).toFixed(3));
  eq(pickWeighted(rw, { x: 0, y: 0 }), null, 'kun nulvægte → null');
}

/* ============================================================ geometri */

section('naboskab — søm, symmetri og orakel');
{
  // Eksplicit sømtest: celle (0,0) starter 0.1 rad FØR 12 og krydser dermed 0/2π.
  const off = [TAU - 0.1, 0, 0, 0, 0];
  const b = board(() => 'cyan', off);
  const n = neighbours(b);
  const got = n.get('0:0').filter(k => k.startsWith('1:')).sort();
  // Forventningen udledes af oraklet, så testen holder ved enhver overlapEps.
  const want = [...oracleNeighbours(off).get('0:0')].filter(k => k.startsWith('1:')).sort();
  deepEq(got, want, 'sømkrydsende celle matcher oraklet hen over 0/2π');
  ok(want.length > 0, 'og den HAR naboer i naboringen trods sømmen');
  for (const w of want) ok(n.get(w).includes('0:0'), 'relationen gælder også den anden vej: ' + w);

  // Ring 1 lagt til at krydse sømmen
  const off2 = [0, TAU - 0.05, 0, 0, 0];
  const n2 = neighbours(board(() => 'cyan', off2));
  ok(n2.get('1:0').some(k => k.startsWith('0:')), 'sømkrydsende celle i ring 1 har indre naboer');

  // Cyklisk naboskab i egen ring
  for (let r = 0; r < RING_COUNT; r++) {
    const last = GEOM.cells[r] - 1;
    ok(n.get(r + ':0').includes(r + ':' + last) && n.get(r + ':' + last).includes(r + ':0'),
      `ring ${r}: celle 0 og ${last} er naboer (cyklisk)`);
  }

  eq(n.size, TOTAL_CELLS, 'nabotabellen dækker alle ' + TOTAL_CELLS + ' celler');

  // Symmetri + orakel over mange kontinuerte offsets
  const rng = makeRng(20260903);
  let asym = 0, dup = 0, mismatch = 0, degSum = 0, degN = 0, isolated = 0;
  const offsetSets = [
    [0, 0, 0, 0, 0],
    [TAU - 1e-12, TAU - 1e-12, TAU - 1e-12, TAU - 1e-12, TAU - 1e-12],
    [TAU / 24, TAU / 32, TAU / 40, TAU / 48, TAU / 56],   // præcis halv celle
    [TAU - 0.001, 0.001, TAU - 0.001, 0.001, TAU - 0.001],
  ];
  for (let t = 0; t < 250; t++) offsetSets.push([0, 1, 2, 3, 4].map(() => rng() * TAU));

  for (const o of offsetSets) {
    const m = neighbours(board(() => 'cyan', o));
    const exp = oracleNeighbours(o);
    for (const [k, list] of m) {
      if (new Set(list).size !== list.length) dup++;
      if (list.length === 0) isolated++;
      for (const other of list) if (!m.get(other).includes(k)) asym++;
      const a = [...list].sort().join(','), e = [...exp.get(k)].sort().join(',');
      if (a !== e) mismatch++;
      degSum += list.length; degN++;
    }
  }
  eq(asym, 0, 'naborelationen er symmetrisk (a∈N(b) ⇔ b∈N(a))');
  eq(dup, 0, 'ingen dubletter i nabolisterne');
  eq(isolated, 0, 'ingen isolerede celler');
  eq(mismatch, 0, 'stemmer med uafhængigt buoverlaps-orakel over ' + offsetSets.length + ' offsetsæt');
  console.log('    gennemsnitlig nabograd: ' + (degSum / degN).toFixed(3));
}

/* ============================================================= brættet */

section('createBoard');
{
  const b = createBoard(makeRng(5));
  eq(b.grid.length, RING_COUNT, 'grid har ' + RING_COUNT + ' ringe');
  let cells = 0, bad = 0;
  for (let r = 0; r < RING_COUNT; r++) {
    if (b.grid[r].length !== GEOM.cells[r]) bad++;
    if (b.wildMult[r].length !== GEOM.cells[r]) bad++;
    cells += b.grid[r].length;
    for (let i = 0; i < b.grid[r].length; i++) {
      if (!SYMBOL_BY_ID[b.grid[r][i]]) bad++;
      if (b.grid[r][i] === 'wild' && ![1, 2, 3, 5].includes(b.wildMult[r][i])) bad++;
    }
  }
  eq(cells, TOTAL_CELLS, 'i alt ' + TOTAL_CELLS + ' celler');
  eq(bad, 0, 'alle symboler er kendte og wilds har gyldig multiplikator');
  ok(b.offsets.every(o => Number.isFinite(o) && o >= 0 && o < TAU), 'offsets er kontinuerte i [0, 2π)');

  const fixed = createBoard(makeRng(5), { offsets: [0.1, 0.2, 0.3, 0.4, 0.5] });
  deepEq(fixed.offsets, [0.1, 0.2, 0.3, 0.4, 0.5], 'givne offsets bruges uændret');

  // Kontinuerte offsets ⇒ nyt nabomønster hvert spin
  const r2 = makeRng(11);
  const sigs = new Set();
  for (let t = 0; t < 30; t++) {
    const bb = createBoard(r2);
    sigs.add([...neighbours(bb).values()].map(v => v.length).join(','));
  }
  ok(sigs.size > 20, 'nabomønsteret varierer fra spin til spin', 'unikke mønstre: ' + sigs.size);
}

/* ============================================================= klynger */

section('findClusters — grundregler');
{
  // For lille klynge
  eq(findClusters(outerRingBoard({ 0: 'cyan', 1: 'cyan' })).length, 0,
    'klynge på ' + (MIN_CLUSTER - 1) + ' betaler ikke');
  const three = findClusters(outerRingBoard({ 0: 'cyan', 1: 'cyan', 2: 'cyan' }));
  eq(three.length, 1, 'klynge på ' + MIN_CLUSTER + ' betaler');
  eq(three[0].size, 3, 'størrelse 3');
  eq(three[0].symbol, 'cyan', 'symbol er cyan');
  eq(three[0].wildMultSum, 0, 'wildMultSum er 0 uden wilds');
  near(three[0].pay, SYMBOL_BY_ID.cyan.pays[0], 'pay = pays[0] uden wilds');

  // Kun wilds
  eq(findClusters(outerRingBoard({ 0: 'wild', 1: 'wild', 2: 'wild', 3: 'wild' })).length, 0,
    'ren wild-klat betaler intet');

  // Wild bro: uden broen to klynger, med broen én
  const split = findClusters(outerRingBoard({
    0: 'cyan', 1: 'cyan', 2: 'cyan', 3: 'prism', 4: 'cyan', 5: 'cyan', 6: 'cyan', 7: 'prism',
  }));
  eq(split.length, 2, 'uden bro: to adskilte cyan-klynger');
  ok(split.every(c => c.size === 3), 'begge har størrelse 3');

  const bridged = findClusters(outerRingBoard({
    0: 'cyan', 1: 'cyan', 2: 'cyan', 3: 'wild', 4: 'cyan', 5: 'cyan', 6: 'cyan', 7: 'prism',
  }, { 3: 2 }));
  eq(bridged.length, 1, 'wild binder to klatter sammen til ÉN klynge');
  eq(bridged[0].size, 7, 'samlet størrelse 7 (6 gems + wild)');
  eq(bridged[0].wildMultSum, 2, 'wildMultSum = 2');
  near(bridged[0].pay, SYMBOL_BY_ID.cyan.pays[payBand(7)] * 2, 'pay ganges med wildMultSum');

  // wildMultSum er en SUM
  const twoWilds = findClusters(outerRingBoard({
    0: 'cyan', 1: 'cyan', 2: 'cyan', 3: 'wild', 4: 'wild', 5: 'cyan', 6: 'prism',
  }, { 3: 2, 4: 3 }));
  eq(twoWilds.length, 1, 'to wilds i samme klynge');
  eq(twoWilds[0].size, 6, 'størrelse 6');
  eq(twoWilds[0].wildMultSum, 5, 'wildMultSum summerer 2 + 3 = 5');
  near(twoWilds[0].pay, SYMBOL_BY_ID.cyan.pays[payBand(6)] * 5, 'pay = pays[1] × 5');

  // Wild deles mellem to farver
  const shared = findClusters(outerRingBoard({
    0: 'cyan', 1: 'cyan', 2: 'cyan', 3: 'wild', 4: 'green', 5: 'green', 6: 'green', 7: 'prism',
  }));
  eq(shared.length, 2, 'wild indgår i både cyan- og grøn-klynge');
  const bySym = Object.fromEntries(shared.map(c => [c.symbol, c]));
  ok(bySym.cyan && bySym.green, 'begge farver findes');
  eq(bySym.cyan.size, 4, 'cyan-klynge har 4 celler (3 gems + wild)');
  eq(bySym.green.size, 4, 'grøn-klynge har 4 celler (3 gems + wild)');
  ok(bySym.cyan.cells.some(([r, i]) => r === 4 && i === 3) &&
     bySym.green.cells.some(([r, i]) => r === 4 && i === 3), 'wild-cellen ligger i begge');

  // Prisme forbinder aldrig
  eq(findClusters(outerRingBoard({ 0: 'cyan', 1: 'prism', 2: 'cyan', 3: 'cyan' })).length, 0,
    'prisme bryder forbindelsen');

  // wildColor (bonus): røde gems tæller som wild for andre farver
  const spec = { 0: 'cyan', 1: 'cyan', 2: 'red', 3: 'cyan', 4: 'prism' };
  eq(findClusters(outerRingBoard(spec)).length, 0, 'uden wildColor: ingen klynge');
  const bonusCl = findClusters(outerRingBoard(spec), { wildColor: 'red' });
  eq(bonusCl.length, 1, 'med wildColor=red: cyan-klyngen samles');
  eq(bonusCl[0].symbol, 'cyan', 'klyngen betaler for cyan');
  eq(bonusCl[0].size, 4, 'størrelse 4');
  eq(bonusCl[0].wildMultSum, 0, 'wildColor-gems bidrager ikke til wildMultSum');
}

section('findClusters — betalingsbånd');
{
  eq(payBand(3), 0, 'payBand(3) = 0');
  eq(payBand(4), 0, 'payBand(4) = 0  (øvre grænse for bånd 0)');
  eq(payBand(5), 1, 'payBand(5) = 1  (nedre grænse for bånd 1)');
  eq(payBand(6), 1, 'payBand(6) = 1');
  eq(payBand(7), 2, 'payBand(7) = 2');
  eq(payBand(9), 2, 'payBand(9) = 2');
  eq(payBand(10), 3, 'payBand(10) = 3');
  eq(payBand(14), 3, 'payBand(14) = 3');
  eq(payBand(15), 4, 'payBand(15) = 4');

  for (const size of [3, 4, 5, 6, 7, 9, 10, 14, 15, 16, 27]) {
    const spec = {};
    for (let i = 0; i < size; i++) spec[i] = 'purple';
    const cl = findClusters(outerRingBoard(spec));
    const good = cl.length === 1 && cl[0].size === size &&
      Math.abs(cl[0].pay - SYMBOL_BY_ID.purple.pays[payBand(size)]) < 1e-9;
    ok(good, `størrelse ${size} → pays[${payBand(size)}] = ${SYMBOL_BY_ID.purple.pays[payBand(size)]}`,
      good ? '' : JSON.stringify(cl.map(c => [c.size, c.pay])));
  }
}

/* ============================================================= kaskade */

section('applyCascade');
{
  const b = createBoard(makeRng(31));
  const cl = findClusters(b);
  ok(cl.length > 0, 'testbrættet har mindst én klynge');
  const { board: nb, removed } = applyCascade(makeRng(32), b, cl);

  deepEq(nb.offsets, b.offsets, 'offsets bevares uændret');

  const keys = removed.map(([r, i]) => r + ':' + i);
  eq(new Set(keys).size, keys.length, 'removed indeholder ingen dubletter (delte wilds)');

  const expected = new Set();
  for (const c of cl) for (const [r, i] of c.cells) expected.add(r + ':' + i);
  eq(keys.length, expected.size, 'alle klyngeceller fjernes præcis én gang');
  ok(keys.every(k => expected.has(k)), 'removed er en delmængde af klyngecellerne');

  let changedOutside = 0;
  for (let r = 0; r < RING_COUNT; r++) {
    for (let i = 0; i < GEOM.cells[r]; i++) {
      if (expected.has(r + ':' + i)) continue;
      if (nb.grid[r][i] !== b.grid[r][i] || nb.wildMult[r][i] !== b.wildMult[r][i]) changedOutside++;
    }
  }
  eq(changedOutside, 0, 'celler uden for klyngerne røres ikke');

  let origMutated = 0;
  for (const [r, i] of removed) if (b.grid[r][i] !== undefined && nb.grid[r][i] === undefined) origMutated++;
  eq(origMutated, 0, 'det oprindelige bræt er intakt');

  let prismInRefill = 0, badMult = 0;
  for (const [r, i] of removed) {
    if (nb.grid[r][i] === 'prism') prismInRefill++;
    if (nb.grid[r][i] === 'wild' && ![1, 2, 3, 5].includes(nb.wildMult[r][i])) badMult++;
  }
  eq(prismInRefill, 0, 'påfyld indeholder aldrig prismer (REFILL_WEIGHTS)');
  eq(badMult, 0, 'nye wilds får gyldig multiplikator');

  const empty = applyCascade(makeRng(33), b, []);
  eq(empty.removed.length, 0, 'ingen klynger → intet fjernes');
  deepEq(empty.board.grid, b.grid, 'ingen klynger → uændret grid');
}

/* ================================================================ spin */

section('spinOutcome — struktur og determinisme');
{
  const a = spinOutcome(makeRng(2468), { bet: 25 });
  const b = spinOutcome(makeRng(2468), { bet: 25 });
  deepEq(a, b, 'samme frø → identisk udfald (fuld dyb sammenligning)');
  const c = spinOutcome(makeRng(2469), { bet: 25 });
  ok(JSON.stringify(a) !== JSON.stringify(c), 'andet frø → andet udfald');

  ok(a.steps.length >= 1, 'mindst ét step');
  const last = a.steps[a.steps.length - 1];
  deepEq(last.clusters, [], 'sidste step: clusters = []');
  eq(last.win, 0, 'sidste step: win = 0');
  deepEq(last.removed, [], 'sidste step: removed = []');
  eq(last.nextBoard, null, 'sidste step: nextBoard = null');
  ok(last.board && last.board.grid, 'sidste step bærer hvilebrættet');

  // Kæden hænger sammen: nextBoard === næste steps board
  let chainBreaks = 0;
  for (let s = 0; s < a.steps.length - 1; s++) {
    if (a.steps[s].nextBoard !== a.steps[s + 1].board) chainBreaks++;
  }
  eq(chainBreaks, 0, 'nextBoard er præcis næste steps board');

  // Reaktoren eskalerer 1, 2, 3, 5, 7 og bliver stående
  let escalate = null;
  for (let seed = 0; seed < 500 && !escalate; seed++) {
    const r = spinOutcome(makeRng(seed), { bet: 1 });
    if (r.steps.length - 1 >= 5) escalate = r;
  }
  ok(!!escalate, 'fandt et spin med mindst 5 kaskader');
  if (escalate) {
    deepEq(escalate.steps.slice(0, 5).map(s => s.multiplier), REACTOR_STEPS,
      'reaktoren eskalerer ' + REACTOR_STEPS.join(', '));
    const tailOk = escalate.steps.slice(5).every(s => s.multiplier === REACTOR_STEPS[REACTOR_STEPS.length - 1]);
    ok(tailOk, 'reaktoren står fast på ' + REACTOR_STEPS[REACTOR_STEPS.length - 1] + ' efter sidste trin');
    eq(escalate.maxMultiplier, REACTOR_STEPS[REACTOR_STEPS.length - 1], 'maxMultiplier = højeste brugte trin');
  }

  // Bonusstigen bruges når opts.bonus
  let bonusRun = null;
  for (let seed = 0; seed < 500 && !bonusRun; seed++) {
    const r = spinOutcome(makeRng(seed), { bet: 1, bonus: true });
    if (r.steps.length - 1 >= 7) bonusRun = r;
  }
  ok(!!bonusRun, 'fandt et bonusspin med mindst 7 kaskader');
  if (bonusRun) {
    deepEq(bonusRun.steps.slice(0, 7).map(s => s.multiplier), BONUS.steps.slice(0, 7),
      'bonus bruger BONUS.steps (' + BONUS.steps.slice(0, 7).join(', ') + ')');
  }

  // Gevinst = Σ(pay) × trin × indsats
  const bet = 25;
  const r = spinOutcome(makeRng(864), { bet });
  let winMath = 0;
  for (const st of r.steps) {
    if (!st.clusters.length) continue;
    const base = st.clusters.reduce((x, cc) => x + cc.pay, 0);
    if (Math.abs(st.win - Math.round(base * st.multiplier * bet * 100) / 100) > 1e-9) winMath++;
  }
  eq(winMath, 0, 'win = Σ(cluster.pay) × multiplier × bet på hvert step');
  const sum = r.steps.reduce((x, s) => x + s.win, 0);
  near(r.totalWin, Math.round(sum * 100) / 100, 'totalWin = summen af alle steps');

  // prismHits tælles kun i åbningsbrættet
  let opening = 0;
  for (const row of r.steps[0].board.grid) for (const s of row) if (s === 'prism') opening++;
  eq(r.prismHits, opening, 'prismHits = antal prismer i åbningsbrættet');

  let prismLater = 0;
  for (const st of r.steps) {
    if (!st.nextBoard) continue;
    for (const [rr, ii] of st.removed) if (st.nextBoard.grid[rr][ii] === 'prism') prismLater++;
  }
  eq(prismLater, 0, 'påfyld producerer aldrig prismer');

  // Startbræt kan gives udefra
  const given = createBoard(makeRng(1), { weights: REEL_WEIGHTS });
  const withBoard = spinOutcome(makeRng(2), { bet: 1, board: given });
  eq(withBoard.steps[0].board, given, 'opts.board bruges som åbningsbræt');
}

/* ========================================================== statistik */

section('20 000 spins — stabilitet og RTP');
{
  const N = 20000, BET = 25;
  const rng = makeRng(20260903);
  const t0 = Date.now();

  let staked = 0, won = 0, dead = 0, capped = 0, maxSteps = 0, maxWin = 0;
  let nanHits = 0, structural = 0, negative = 0, prismTotal = 0;
  const casHist = new Map();

  for (let s = 0; s < N; s++) {
    const res = spinOutcome(rng, { bet: BET });
    staked += BET;

    if (!res || !Array.isArray(res.steps) || res.steps.length < 1) { structural++; continue; }
    if (!Number.isFinite(res.totalWin) || !Number.isFinite(res.maxMultiplier) ||
        !Number.isInteger(res.prismHits)) nanHits++;
    if (res.totalWin < 0) negative++;

    const paid = res.steps.length - 1;
    casHist.set(paid, (casHist.get(paid) || 0) + 1);
    if (paid > maxSteps) maxSteps = paid;
    if (paid >= MAX_CASCADES) capped++;
    if (res.steps.length > MAX_CASCADES + 1) structural++;

    const lastStep = res.steps[res.steps.length - 1];
    if (lastStep.clusters.length !== 0 || lastStep.win !== 0 ||
        lastStep.removed.length !== 0 || lastStep.nextBoard !== null) structural++;

    let stepSum = 0;
    for (let i = 0; i < res.steps.length; i++) {
      const st = res.steps[i];
      if (!Number.isFinite(st.win) || !Number.isFinite(st.multiplier)) { nanHits++; continue; }
      stepSum += st.win;
      for (const cl of st.clusters) {
        if (!Number.isFinite(cl.pay) || !Number.isFinite(cl.size) || !Number.isFinite(cl.wildMultSum)) nanHits++;
        if (cl.size < MIN_CLUSTER) structural++;
        if (!SYMBOL_BY_ID[cl.symbol]) structural++;
        if (cl.cells.length !== cl.size) structural++;
      }
      if (i < res.steps.length - 1 && st.removed.length === 0) structural++; // fremdrift garanteret
    }
    if (Math.abs(stepSum - res.totalWin) > 0.011) structural++;

    won += res.totalWin;
    prismTotal += res.prismHits;
    if (res.totalWin === 0) dead++;
    if (res.totalWin > maxWin) maxWin = res.totalWin;
  }

  const ms = Date.now() - t0;
  const rtp = won / staked * 100;

  eq(nanHits, 0, 'ingen NaN/undefined nåede nogensinde et gevinsttal');
  eq(structural, 0, 'ingen strukturbrud i noget udfald');
  eq(negative, 0, 'ingen negative gevinster');
  ok(maxSteps <= MAX_CASCADES, 'kaskadeloopet overskrider aldrig loftet på ' + MAX_CASCADES,
    'højeste antal betalte kaskader: ' + maxSteps);
  ok(ms < 120000, 'loopet hænger ikke (' + ms + ' ms for ' + N + ' spins)');

  const casKeys = [...casHist.keys()].sort((a, b) => a - b);
  console.log('\n    \x1b[1mMÅLT RTP: ' + rtp.toFixed(2) + '%\x1b[0m  (' + N + ' spins à ' + BET + ' kr.)');
  console.log('    indsat ' + staked.toLocaleString('da-DK') + ' kr., udbetalt ' +
    Math.round(won).toLocaleString('da-DK') + ' kr.');
  console.log('    døde spins ' + (dead / N * 100).toFixed(2) + '%, største gevinst ' +
    Math.round(maxWin).toLocaleString('da-DK') + ' kr. (' + (maxWin / BET).toFixed(0) + '× indsats)');
  console.log('    kaskader pr. spin: min ' + casKeys[0] + ', max ' + maxSteps +
    ', ved loft ' + capped + ' spins (' + (capped / N * 100).toFixed(2) + '%)');
  console.log('    prismer pr. spin i snit: ' + (prismTotal / N).toFixed(2));
  console.log('    tid: ' + ms + ' ms');
}

/* ================================================================= slut */

console.log('\n' + '─'.repeat(60));
if (failures.length === 0) {
  console.log('\x1b[32m\x1b[1mALLE ' + passed + ' TESTS BESTÅET\x1b[0m');
  process.exit(0);
} else {
  console.log('\x1b[31m\x1b[1m' + failures.length + ' FEJL (' + passed + ' bestået):\x1b[0m');
  for (const f of failures) console.log('  • ' + f);
  process.exit(1);
}
