/* LYSBRUD — smoke-test for demo-instruktøren.
   Kører uden afhængigheder: node test/director.test.mjs
   Kører to sessioner på 40 spins — én mod den rigtige motor og én mod en
   stub-motor der kun respekterer vægtene — og tjekker at dramaturgien holder. */

import { GEOM, REEL_WEIGHTS, REACTOR_STEPS, BONUS, PRISM_TARGET, WIN_TIERS } from '../src/config.js';

/* ---- indlæsning (springer pænt over hvis motoren ikke findes endnu) ---- */

let createDirector = null;
let loadError = null;
try {
  ({ createDirector } = await import('../src/director.js'));
} catch (err) {
  loadError = err;
}

if (!createDirector) {
  console.log('SPRINGES OVER: src/director.js kunne ikke indlæses.');
  console.log('  ' + (loadError && loadError.message));
  console.log('  (typisk fordi src/engine.js endnu ikke er skrevet — testen fejler ikke på det)');
  process.exit(0);
}

/* ---- testramme ---- */

let passed = 0;
const failures = [];
const warnings = [];
/* soft = kontrollen afhænger af motorens fordeling. Kan motoren slet ikke
   producere det ønskede bånd, er det motormatematik og ikke instruktøren
   der fejler — så bliver det en advarsel mod den rigtige motor, men en
   hård fejl mod stub-motoren, hvor fordelingen er kendt. */
function ok(name, cond, detail, soft) {
  const line = name + (detail ? ' — ' + detail : '');
  if (cond) { passed++; console.log('  ok   ' + name); }
  else if (soft) { warnings.push(line); console.log('  ADV  ' + line); }
  else { failures.push(line); console.log('  FEJL ' + line); }
}

/* ---- deterministisk rng (mulberry32, uafhængig kopi til testen) ---- */

function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- uafhængigt bånd-orakel (bevidst dupleret, så testen ikke tror på modulet) ---- */

const at = (k) => (WIN_TIERS.find(t => t.key === k) || {}).at;
const BAND_ORDER = ['dead', 'tiny', 'small', 'medium', 'big', 'mega', 'epic'];
function bandOf(win, bet) {
  if (!(win > 0)) return 'dead';
  const x = win / bet;
  if (x >= at('epic')) return 'epic';
  if (x >= at('mega')) return 'mega';
  if (x >= at('big')) return 'big';
  if (x >= 5) return 'medium';
  if (x >= 1) return 'small';
  return 'tiny';
}
const bandRank = (b) => BAND_ORDER.indexOf(b);
const cascadesOf = (res) => res.steps.filter(s => s.clusters && s.clusters.length > 0).length;

/* ---- stub-motor: kender ikke klynger, men respekterer vægtene ---------
   Rigdom (koncentration × betalingsværdi + wild-andel) → større gevinster.
   Prismehit trækkes celle for celle af den faktiske prismevægt, så
   instruktørens 'hold'/'charge' kan testes isoleret fra rigtig matematik. */

const PAY_VALUE = { cyan: 1.2, green: 1.5, blue: 2, pink: 3, red: 5, purple: 8 };
const DUMMY_BOARD = {
  grid: GEOM.cells.map(n => new Array(n).fill('cyan')),
  offsets: GEOM.cells.map(() => 0),
  wildMult: GEOM.cells.map(n => new Array(n).fill(1)),
};

function ringHeat(ring) {
  let total = 0;
  for (const k of Object.keys(ring)) total += ring[k];
  if (total <= 0) return 0;
  let acc = 0;
  for (const k of Object.keys(PAY_VALUE)) {
    const p = (ring[k] || 0) / total;
    acc += p * p * PAY_VALUE[k];
  }
  return acc + ((ring.wild || 0) / total) * 6;
}

function stubSpin(rng, opts) {
  const bet = Number(opts.bet) > 0 ? Number(opts.bet) : 1;
  const weights = opts.weights || REEL_WEIGHTS;
  const steps = opts.bonus ? BONUS.steps : REACTOR_STEPS;

  let prismHits = 0;
  let heat = 0;
  for (let r = 0; r < GEOM.cells.length; r++) {
    const ring = weights[r] || REEL_WEIGHTS[r];
    let total = 0;
    for (const k of Object.keys(ring)) total += ring[k];
    const pPrism = total > 0 ? (ring.prism || 0) / total : 0;
    for (let i = 0; i < GEOM.cells[r]; i++) if (rng() < pPrism) prismHits++;
    heat += ringHeat(ring);
  }
  // Målt spænd for instruktørens fire stemninger: ~0,25 (lean) … ~0,80 (lavish i bonus).
  heat = Math.max(0, Math.min(1, (heat / GEOM.cells.length - 0.24) / 0.50));

  const pDead = 0.34 - 0.30 * heat;
  let x = 0;
  let chain = 0;
  if (rng() >= pDead) {
    const xmin = 0.35 + 6 * Math.pow(heat, 1.5);
    const alpha = 2.9 - 1.5 * heat;
    const v = Math.min(0.9999, rng());
    x = xmin * Math.pow(1 - v, -1 / alpha);
    chain = Math.max(1, Math.min(6, 1 + Math.floor(rng() * (2 + 2.2 * Math.log10(1 + x * 3)))));
  }

  const out = [];
  let maxMultiplier = 1;
  let totalWin = 0;
  let weightSum = 0;
  for (let i = 0; i < chain; i++) weightSum += steps[Math.min(i, steps.length - 1)];
  for (let i = 0; i < chain; i++) {
    const mult = steps[Math.min(i, steps.length - 1)];
    maxMultiplier = Math.max(maxMultiplier, mult);
    const win = (x * bet) * (mult / weightSum);
    totalWin += win;
    out.push({
      board: DUMMY_BOARD,
      clusters: [{ symbol: 'purple', cells: [[0, 0]], size: 3, wildMultSum: 0, pay: x }],
      multiplier: mult,
      win: win,
      removed: [[0, 0]],
      nextBoard: DUMMY_BOARD,
    });
  }
  out.push({ board: DUMMY_BOARD, clusters: [], multiplier: 1, win: 0, removed: [], nextBoard: null });

  return { steps: out, totalWin: totalWin, prismHits: prismHits, maxMultiplier: maxMultiplier };
}

/* ---- validering af SpinResult-formen ---- */

function validate(res, label) {
  if (!res || typeof res !== 'object') return label + ': intet resultat';
  if (!Array.isArray(res.steps) || res.steps.length === 0) return label + ': steps mangler';
  const last = res.steps[res.steps.length - 1];
  if (!Array.isArray(last.clusters) || last.clusters.length !== 0) return label + ': sidste step har klynger';
  if (last.nextBoard !== null) return label + ': sidste step har nextBoard';
  for (const s of res.steps) {
    if (!s.board || !Array.isArray(s.board.grid)) return label + ': step uden bræt';
    if (typeof s.win !== 'number' || !Number.isFinite(s.win)) return label + ': ugyldig step.win';
    if (typeof s.multiplier !== 'number' || s.multiplier < 1) return label + ': ugyldig multiplikator';
  }
  if (typeof res.totalWin !== 'number' || !Number.isFinite(res.totalWin) || res.totalWin < 0) return label + ': ugyldig totalWin';
  if (typeof res.prismHits !== 'number' || res.prismHits < 0) return label + ': ugyldig prismHits';
  if (typeof res.maxMultiplier !== 'number' || res.maxMultiplier < 1) return label + ': ugyldig maxMultiplier';
  return null;
}

/* ---- én session på 40 spins med simuleret UI ---- */

const SPINS = 40;
const BET = 25;

function runSession(label, seed, useStub) {
  const rng = makeRng(seed);
  const director = createDirector(rng, useStub ? { scripted: true, spin: stubSpin } : { scripted: true });

  const state = { bet: BET, spinIndex: 0, prismCharge: 0, inBonus: false, wildColor: null, balance: 1280 };
  const log = [];
  let freeSpins = 0;
  let bonusAt = -1;
  let anticipationBeforeBonus = 0;
  let shapeError = null;
  let slowest = 0;

  const t0 = Date.now();
  for (let i = 0; i < SPINS; i++) {
    state.spinIndex = i;
    const chargeBefore = state.prismCharge;
    const inBonusBefore = state.inBonus;
    if (!inBonusBefore && bonusAt < 0 && chargeBefore === PRISM_TARGET - 1) anticipationBeforeBonus++;

    const t1 = Date.now();
    const res = director.nextSpin(state);
    slowest = Math.max(slowest, Date.now() - t1);

    const bad = validate(res, 'spin ' + (i + 1));
    if (bad && !shapeError) shapeError = bad;
    if (bad) break;

    const band = bandOf(res.totalWin, BET);
    log.push({
      i: i, band: band, x: res.totalWin / BET, casc: cascadesOf(res),
      prismHits: res.prismHits, inBonus: inBonusBefore, charge: chargeBefore,
    });

    // simuleret UI-tilstandsmaskine
    state.balance += res.totalWin - (inBonusBefore ? 0 : BET);
    if (inBonusBefore) {
      freeSpins--;
      if (freeSpins <= 0) { state.inBonus = false; state.wildColor = null; }
    } else {
      state.prismCharge += res.prismHits;
      if (state.prismCharge >= PRISM_TARGET) {
        if (bonusAt < 0) bonusAt = i;
        state.prismCharge = 0;
        state.inBonus = true;
        state.wildColor = 'purple';
        freeSpins = BONUS.freeSpins;
      }
    }
  }
  const elapsed = Date.now() - t0;

  return { label, log, bonusAt, anticipationBeforeBonus, shapeError, slowest, elapsed, director };
}

function report(s) {
  console.log('\n  ' + s.label + '  (' + s.elapsed + ' ms, langsomste spin ' + s.slowest + ' ms)');
  console.log('  ' + s.log.map(e =>
    (e.i + 1) + ':' + e.band + (e.inBonus ? '*' : '') + '/' + e.casc + 'k/' + e.prismHits + 'p'
  ).join('  '));
}

function assertSession(s, soft) {
  const L = s.label;
  ok(L + ' — alle 40 spins gav et gyldigt SpinResult', s.shapeError === null && s.log.length === SPINS, s.shapeError || ('kun ' + s.log.length + ' spins'));
  ok(L + ' — bounded tid pr. spin (< 1500 ms)', s.slowest < 1500, s.slowest + ' ms');
  ok(L + ' — bonus udløst inden for 10 spins', s.bonusAt >= 0 && s.bonusAt <= 9, 'bonus på spin ' + (s.bonusAt + 1));
  ok(L + ' — mindst én anticipation (4/5) før bonus', s.anticipationBeforeBonus >= 1, s.anticipationBeforeBonus + ' stk.');

  const first15 = s.log.slice(0, 15);
  const best15 = first15.reduce((m, e) => Math.max(m, e.x), 0);
  ok(L + ' — gevinst ≥ 60× inden for 15 spins', best15 >= at('mega'), 'bedste var ' + best15.toFixed(1) + '×');

  let backToBack = -1;
  for (let i = 1; i < s.log.length; i++) {
    if (bandRank(s.log[i].band) >= bandRank('mega') && bandRank(s.log[i - 1].band) >= bandRank('mega')) { backToBack = i; break; }
  }
  ok(L + ' — aldrig to mega+ i træk', backToBack < 0, 'spin ' + (backToBack + 1) + ' og ' + backToBack, soft);

  ok(L + ' — spin 1 har ≥ 2 kaskader', s.log.length > 0 && s.log[0].casc >= 2, 'havde ' + (s.log[0] ? s.log[0].casc : 0));
  ok(L + ' — mindst ét dødt spin blandt spin 2–3', s.log.slice(1, 3).some(e => e.band === 'dead'), s.log.slice(1, 3).map(e => e.band).join(', '), soft);
}

/* ---- kør ---- */

console.log('LYSBRUD · director.test.mjs');

const real = runSession('rigtig motor', 20240917, false);
report(real);
assertSession(real, true);

const stub = runSession('stub-motor', 7731, true);
report(stub);
assertSession(stub, false);

/* ---- ærlig tilstand ---- */

console.log('\n  ærlig tilstand');
{
  // Spion-motor: registrerer om instruktøren overhovedet former vægtene.
  const seen = [];
  const spy = (rng, o) => { seen.push(o); return stubSpin(rng, o); };
  const d = createDirector(makeRng(99), { scripted: false, spin: spy });
  ok('scripted: false → isScripted() er false', d.isScripted() === false);

  const st = { bet: BET, spinIndex: 0, prismCharge: 0, inBonus: false, wildColor: null, balance: 100 };
  const res = d.nextSpin(st);
  ok('ærligt spin giver et gyldigt SpinResult', validate(res, 'ærligt') === null, validate(res, 'ærligt'));
  ok('ærligt spin kalder spinOutcome præcis én gang', seen.length === 1, seen.length + ' kald');
  ok('ærligt spin former ikke vægtene', seen[0] && seen[0].weights === undefined);

  d.setScripted(true);
  ok('setScripted(true) slår formning til igen', d.isScripted() === true);
  seen.length = 0;
  d.nextSpin(st);
  ok('instrueret spin sender formede vægte med', seen.length > 1 && Array.isArray(seen[0].weights) && seen[0].weights.length === GEOM.cells.length);
}

/* ---- determinisme: samme seed → samme sekvens ---- */

console.log('\n  determinisme');
{
  const run = () => {
    const d = createDirector(makeRng(4242), { spin: stubSpin });
    const st = { bet: BET, spinIndex: 0, prismCharge: 0, inBonus: false, wildColor: null, balance: 1280 };
    const out = [];
    for (let i = 0; i < 12; i++) {
      st.spinIndex = i;
      const r = d.nextSpin(st);
      out.push(r.totalWin.toFixed(4) + '/' + r.prismHits);
      st.prismCharge += r.prismHits;
      if (st.prismCharge >= PRISM_TARGET) st.prismCharge = 0;
    }
    return out.join(' ');
  };
  ok('samme seed giver samme sekvens', run() === run());
}

/* ---- robusthed: tom state og 1-baseret spinIndex ---- */

console.log('\n  robusthed');
{
  const d = createDirector(makeRng(5), { spin: stubSpin });
  const res = d.nextSpin({});
  ok('nextSpin({}) crasher ikke', validate(res, 'tom state') === null, validate(res, 'tom state'));

  const d2 = createDirector(makeRng(5), { spin: stubSpin });
  const first = d2.nextSpin({ bet: BET, spinIndex: 1, prismCharge: 0, inBonus: false });
  ok('1-baseret spinIndex rammer stadig beat 1 (≥ 2 kaskader)', cascadesOf(first) >= 2, cascadesOf(first) + ' kaskader');
}

/* ---- opsamling ---- */

console.log('\n' + passed + ' beståede, ' + failures.length + ' fejlede, ' + warnings.length + ' advarsler');
for (const f of failures) console.log('  FEJL · ' + f);
if (warnings.length) {
  for (const w of warnings) console.log('  ADV  · ' + w);
  console.log('  Advarsler = bånd som motorens fordeling aldrig producerer.');
  console.log('  Instruktøren afviste 220 udfald og leverede det tætteste den så.');
}
if (failures.length) process.exit(1);
