/*
 * Data for the report. Runs the engine bundle (tests/.cache/engine.mjs, built by `npx vitest run`)
 * on a virtual clock and writes docs/rapport/data/*.json:
 *   story.json   the free-play derby with the story's purchases (scripts/story.js), step by step
 *   edge.json    the gap edge case: a buy limit and a stop-loss both jumped by one reopen
 *   stats.json   calibration, Monte Carlo vs DP, pool bound and 20-match table, quotes, constants
 * Fails loudly if a number drifts from what the tests and README state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..', '..');
const DATA = path.resolve(here, '..', 'data');
const E = await import(path.join(ROOT, 'tests/.cache/engine.mjs'));
await import('./story.js');
const S = globalThis.UDFALD_STORY;
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r2 = (x) => Math.round(x * 100) / 100;
function assert(ok, msg) {
  if (!ok) throw new Error(`data.mjs: ${msg}`);
}

function harness(tl) {
  const mc = { mode: 'hovedtråd', lastMs: 0, run: async () => null, dispose() {} };
  const st = new E.MatchStore(tl, mc);
  let vt = 0;
  st.clock = () => vt;
  const toasts = [];
  const orig = st.toast.bind(st);
  st.toast = (text, tone) => {
    toasts.push({ k: st.sim.k, t: r4(st.sim.t), text, tone });
    orig(text, tone);
  };
  const clock = () => (vt += 100);
  return { st, clock, toasts };
}

const cellPossible = (h, a, H, A) => (h === 5 || H <= h) && (a === 5 || A <= a);
const csId = (cells) => `cs:${cells.map(([h, a]) => `${h}-${a}`).join('.')}`;
const REGIONS = {
  'FCK med 2+': (h, a) => h - a >= 2,
  'Begge scorer': (h, a) => h >= 1 && a >= 1,
  '0–0 eller 1–1': (h, a) => (h === 0 && a === 0) || (h === 1 && a === 1),
  'Mindst 4 mål': (h, a) => h + a >= 4,
};

/** Quotes for final-score cells and regions with both caps, plus the Over/Under ladder. */
function quoteBook(st) {
  const cells = st.disp.cells;
  const cellAsk = (p) => Math.max(1, Math.min(99, Math.ceil(100 * p * 1.15 - 1e-9)));
  const out = { k: st.sim.k, t: r4(st.sim.t), score: `${st.sim.h}-${st.sim.a}`, cells: cells.map(r4), single: [], regions: [], totals: [] };
  for (const [h, a] of [[1, 1], [0, 0], [2, 1], [1, 0], [4, 3]]) {
    if (!cellPossible(h, a, st.sim.h, st.sim.a)) continue;
    const id = csId([[h, a]]);
    const q = st.quote(id);
    out.single.push({ id, p: r4(q.p), ask: q.ask, bid: q.bid, raw: r2(100 * q.p * 1.15), open: st.isOpen(id), why: st.closedReason(id) });
  }
  for (const [name, f] of Object.entries(REGIONS)) {
    const cs = [];
    for (let h = 0; h < 6; h++) for (let a = 0; a < 6; a++) if (f(h, a) && cellPossible(h, a, st.sim.h, st.sim.a)) cs.push([h, a]);
    if (!cs.length) continue;
    const id = csId(cs);
    const q = st.quote(id);
    const ten = Math.ceil(100 * q.p * 1.1 - 1e-9);
    const cap = cs.reduce((s, [h, a]) => s + cellAsk(cells[h * 6 + a]), 0);
    const oldCap = cap - (cs.length - 1);
    out.regions.push({ name, id, n: cs.length, p: r4(q.p), ask: q.ask, bid: q.bid, ten, cap, oldCap, oldAsk: cs.length === 1 ? q.ask : Math.max(1, Math.min(99, ten, oldCap)) });
    assert(cs.length === 1 || q.ask >= Math.min(99, ten), `region ${name} below the 10 % rule`);
  }
  for (const q of st.disp.totals) out.totals.push({ id: q.id, label: q.label, p: r4(q.p), ask: q.ask, bid: q.bid, open: st.isOpen(q.id) });
  return out;
}

function snap(st) {
  const sim = st.sim;
  return {
    k: sim.k, t: r4(sim.t), phase: sim.phase, h: sim.h, a: sim.a, halted: sim.halted, haltKind: sim.halt?.kind ?? null, sinceReopen: sim.k - sim.reopenK,
    ask: [...sim.ask], bid: [...sim.bid], mid: sim.mid.map(r4), fair: sim.fair.map(r4),
    o25: { ask: [...sim.o25Ask], bid: [...sim.o25Bid], mid: r4(sim.o25Mid), fair: r4(sim.o25Fair) },
  };
}

// ------------------------------------------------------------------------------------------------
// 1) The story run.
// ------------------------------------------------------------------------------------------------
const story = (() => {
  const { st, clock, toasts } = harness(E.FREE_PLAY);
  const series = [];
  const sample = () => {
    const sn = snap(st);
    const pool = st.poolView();
    series.push({ ...sn, pool: { open: pool.open, closed: pool.closed, total: Math.round(pool.total), sides: pool.sides.map(Math.round), odds: pool.odds.map(r4), n: pool.n } });
  };
  // Up to the buys one substep at a time, so the series starts at kickoff (the book is still empty).
  while (st.sim.k < S.K_START) {
    st.speed = 1;
    st.tick(clock());
    if (st.sim.k % 10 === 0) sample();
  }
  const atStart = snap(st);
  S.step(st, clock()); // k = 830, 20:00, fresh display
  const quotes20 = quoteBook(st);
  const before = snap(st);
  st.requestBuy('1x2:F', 250);
  const lockedAsk = st.pending.lockedAsk;
  S.settleLock(st, clock);
  S.afterFck(st, clock);
  const afterBuys = snap(st);
  const exitsPlaced = st.book.exits.map((x) => ({ ...x }));
  const trace = [];
  const traceLate = [];
  let kLate = null;
  let quotes35 = null;
  let poolClose = null;
  let poolAtHalfK = null;
  while (st.sim.phase !== 'closed') {
    if (kLate === null && st.sim.t >= S.LATE[2] && !st.sim.halted) {
      kLate = st.sim.k;
      S.step(st, clock());
      quotes35 = quoteBook(st);
      st.requestBuy(S.LATE[0], S.LATE[1]);
      S.settleLock(st, clock);
      continue;
    }
    st.speed = 1;
    st.tick(clock());
    const k = st.sim.k;
    const s = snap(st);
    const pool = st.poolView();
    s.exits = st.book.exits.map((x) => `${x.contract}:${x.kind}:${x.status}`);
    s.shares = Object.fromEntries([...st.book.positions.values()].map((p) => [p.id, p.shares]));
    if (k >= 1170 && k <= 1215) trace.push(s);
    if (k >= 3360 && k <= 3400) traceLate.push(s);
    if (k % 10 === 0 || st.sim.events.at(-1)?.k === k) series.push({ ...s, pool: { open: pool.open, closed: pool.closed, total: Math.round(pool.total), sides: pool.sides.map(Math.round), odds: pool.odds.map(r4), n: pool.n } });
    if (!poolClose && pool.closed) {
      poolClose = { k, t: r4(st.sim.t), ...pool, fair: st.sim.fair.map(r4), user: pool.user };
      poolAtHalfK = k;
    }
  }
  const book = st.book;
  const log = book.log.map((e) => ({ ...e, t: r4(e.t) }));
  const pos = [...book.positions.values()].map((p) => ({ id: p.id, label: p.label, shares: p.shares, cost: r2(p.cost), proceeds: r2(p.proceeds), lots: p.lots.map((l) => ({ k: l.k, t: r4(l.t), shares: l.shares, price: l.price, midAtEntry: r4(l.midAtEntry), baseline: l.baseline?.map(r4) })), settled: p.settled }));
  // Move grades, exactly as Afregning computes them.
  const goals = E.goalsOf(st.sim.events);
  const H = st.sim.hist;
  const grades = [];
  for (const p of book.positions.values()) {
    const o = ['1x2:F', '1x2:X', '1x2:B'].indexOf(p.id);
    for (const l of p.lots) {
      if (o < 0 || !l.baseline) {
        grades.push({ label: p.label, t: r4(l.t), price: l.price, grade: '—' });
        continue;
      }
      const ng = goals.find((g) => g.t > l.t);
      const tR = Math.min(l.t + 10, ng ? ng.t - 0.05 : Infinity, st.sim.t);
      let i = 0;
      while (i < H.n - 1 && H.t[i + 1] <= tR) i++;
      const midR = H.mid[i * 3 + o];
      const frac = Math.min(1, Math.max(0, (tR - l.t) / 10));
      const baseR = l.baseline[0] + (l.baseline[1] - l.baseline[0]) * frac;
      const g = E.grade(l.midAtEntry, midR, l.baseline[0], baseR);
      grades.push({ label: p.label, t: r4(l.t), price: l.price, grade: g.grade, clv: r4(g.clv), tR: r4(tR), midR: r4(midR), baseR: r4(baseR) });
    }
  }
  const events = st.sim.events.filter((e) => ['kickoff', 'goal', 'var-start', 'var-verdict', 'red', 'whale', 'reopen', 'half', 'second-half', 'fulltime'].includes(e.kind)).map((e) => ({ id: e.id, k: e.k, t: r4(e.t), kind: e.kind, team: e.team, text: e.text, gap: e.gap, gapO25: e.gapO25 }));
  const tot = book.totals();
  return {
    seed: E.FREE_PLAY.seed, atStart, before, lockedAsk, afterBuys, exitsPlaced, quotes20, quotes35, kLate,
    events, trace, traceLate, series, poolClose, poolAtHalfK,
    final: { k: st.sim.k, score: `${st.sim.h}-${st.sim.a}`, saldo: r2(book.saldo), staked: r2(tot.staked), paidOut: r2(tot.paidOut), positions: pos, exits: book.exits, limits: book.limits, poolStakes: book.poolStakes, poolResult: book.poolResult, pool: st.poolView(), log, grades },
    toasts,
  };
})();

// Story facts the text relies on; the screenshot script checks the same.
const goalsStory = story.events.filter((e) => e.kind === 'goal');
assert(story.final.score === '1-1', `story score ${story.final.score}`);
assert(goalsStory.length === 2, 'story should have two goals');
const reopen1 = story.events.find((e) => e.kind === 'reopen' && e.k > goalsStory[0].k);
const bifStop = story.final.exits.find((x) => x.contract === '1x2:B' && x.kind === 'stop');
const overTake = story.final.exits.find((x) => x.contract === 'tot:2.5:O' && x.kind === 'take');
assert(bifStop.status === 'udløst' && bifStop.fill.k - reopen1.k > 7, 'BIF stop should fire after the reopen guard');
assert(overTake.status === 'udløst', 'Over take should fire');
const atReopen = story.trace.find((s) => s.k === reopen1.k);
story.counterfactual = { reopenK: reopen1.k, bidAtReopen: atReopen.bid[2], noGuardKr: r2((bifStop.fill.shares * atReopen.bid[2]) / 100), guardKr: bifStop.fill.kr };
fs.writeFileSync(path.join(DATA, 'story.json'), JSON.stringify(story));
console.log('story', story.final.score, 'goals', goalsStory.map((g) => `${g.t}:${g.team}`).join(' '), 'stop', bifStop.fill, 'take', overTake.fill, 'pool', story.final.poolResult);

// ------------------------------------------------------------------------------------------------
// 2) The gap edge case: a buy limit and a stop on the same contract, both jumped by one reopen.
// ------------------------------------------------------------------------------------------------
const edge = (() => {
  const { st, clock, toasts } = harness(E.FREE_PLAY);
  S.ffK(st, S.K_START, clock);
  S.buy(st, '1x2:B', 200, clock);
  assert(st.placeExit('1x2:B', 'stop', 17), 'edge stop');
  st.placeLimit(2, 20, 100);
  assert(st.book.limits.some((l) => l.status === 'aktiv'), 'edge limit');
  S.ffK(st, 1215, clock);
  return { log: st.book.log.map((e) => ({ ...e, t: r4(e.t) })), limits: st.book.limits, exits: st.book.exits, toasts: toasts.filter((t) => t.k > 840) };
})();
fs.writeFileSync(path.join(DATA, 'edge.json'), JSON.stringify(edge, null, 1));
console.log('edge', edge.log.map((e) => `${e.kind}@${e.k}:${e.shares ?? ''}x${e.price ?? ''}`).join(' '));

// ------------------------------------------------------------------------------------------------
// 3) Statistics.
// ------------------------------------------------------------------------------------------------
const stats = {};
const p = E.DERBY_PARAMS;
{
  // Same loops and seeds as tests/football.test.ts and tests/totals.test.ts.
  let goals = 0;
  let fck = 0;
  for (let m = 0; m < 1500; m++) {
    const s = new E.FootballSim({ ...E.FREE_PLAY, seed: `cal-${m}`, naturalWhales: false }, undefined, { pricing: false });
    while (s.phase !== 'closed') s.step();
    goals += s.h + s.a;
    if (s.h > s.a) fck++;
  }
  stats.goals = { perMatch: r4(goals / 1500), fckWin: r4(fck / 1500), n: 1500 };
  const bins = Array.from({ length: 10 }, () => ({ p: 0, y: 0, n: 0 }));
  for (let m = 0; m < 1200; m++) {
    const s = new E.FootballSim({ ...E.FREE_PLAY, seed: `pc-${m}`, naturalWhales: false }, undefined, { pricing: false });
    const samples = [];
    while (s.phase !== 'closed') {
      s.step();
      if ((s.phase === '1H' || s.phase === '2H') && !s.halt && s.k % 600 === 0) samples.push(E.price1x2(s.p, s.priceState())[0]);
    }
    const y = s.h > s.a ? 1 : 0;
    for (const q of samples) {
      const b = bins[Math.min(9, Math.floor(q * 10))];
      b.p += q;
      b.y += y;
      b.n++;
    }
  }
  stats.cal1x2 = bins.filter((b) => b.n).map((b) => ({ p: r4(b.p / b.n), y: r4(b.y / b.n), n: b.n }));
  const preds = [];
  const kick = [];
  for (let m = 0; m < 1500; m++) {
    const sim = new E.FootballSim({ ...E.FREE_PLAY, seed: `o25-${m}`, naturalWhales: false }, p, { pricing: false });
    const marks = [0, 15, 30, 45.5, 60, 75];
    const at = [];
    while (sim.phase !== 'closed') {
      sim.step();
      if (marks.length && sim.t >= marks[0] && (sim.phase === '1H' || sim.phase === '2H') && !sim.halt) {
        marks.shift();
        at.push(sim.h + sim.a > 2.5 ? 1 : E.totalsBack(p, sim.priceState(), sim.h + sim.a, 2.5));
      }
    }
    const y = sim.h + sim.a > 2.5 ? 1 : 0;
    at.forEach((q, i) => {
      if (q < 1) preds.push({ p: q, y });
      if (i === 0) kick.push({ p: q, y });
    });
  }
  preds.sort((x, y) => x.p - y.p);
  stats.calO25 = [];
  for (let d = 0; d < 10; d++) {
    const bin = preds.slice(Math.floor((d * preds.length) / 10), Math.floor(((d + 1) * preds.length) / 10));
    const mp = bin.reduce((s, x) => s + x.p, 0) / bin.length;
    const my = bin.reduce((s, x) => s + x.y, 0) / bin.length;
    stats.calO25.push({ p: r4(mp), y: r4(my), n: bin.length, se: r4(Math.sqrt((mp * (1 - mp)) / bin.length)) });
  }
  stats.o25Kickoff = { p: r4(kick.reduce((s, x) => s + x.p, 0) / kick.length), y: r4(kick.reduce((s, x) => s + x.y, 0) / kick.length), n: kick.length, samples: preds.length };
  // Cross-check against the test log.
  const log = fs.readFileSync(path.join(DATA, 'vitest.txt'), 'utf8');
  const m = /goals\/match ([\d.]+) fck win ([\d.]+)/.exec(log);
  assert(m && Math.abs(Number(m[1]) - stats.goals.perMatch) < 1e-4, 'goals per match differ from the test log');
  const o = /o25 deciles \(price→realised %\): (.*) · kickoff ([\d.]+)→([\d.]+)/.exec(log);
  assert(o && Number(o[2]) === Math.round(stats.o25Kickoff.p * 1000) / 10, 'o25 kickoff differs from the test log');
}
{
  // Monte Carlo "3+ goals" vs the DP, the four states of tests/totals.test.ts.
  const STATES = [
    { t: 0, end: 93, d: 0, pi: 0, excite: [0, 0], red: [0, 0], zone: 4, h: 0, a: 0 },
    { t: 30, end: 93, d: 1, pi: 0.3, excite: [0.4, 0.4], red: [0, 0], zone: 5, h: 1, a: 0 },
    { t: 55, end: 93, d: -1, pi: -0.4, excite: [0, 0], red: [0, 1], zone: 2, h: 0, a: 1 },
    { t: 80, end: 93, d: 0, pi: 0.1, excite: [0, 0], red: [0, 0], zone: 4, h: 1, a: 1 },
  ];
  stats.mcVsDp = [];
  for (const s of STATES) {
    const pOver = E.totalsBack(p, s, s.h + s.a, 2.5);
    const r = await E.runMc({ id: 1, seed: 77, params: p, state: { t: s.t, end: s.end, h: s.h, a: s.a, pi: s.pi, excite: s.excite, red: s.red, zone: s.zone, goals: [] }, n: 6000, probs: [pOver, 1 - pOver], focus: 0, askNow: 61, kind: 'o25' });
    const grid = E.rateGrid(p, s, true);
    const fg = E.fromGrid(E.scoreGrid(p, s, s.h, s.a, grid), s.h, s.a);
    const x12 = E.price1x2(p, s, grid);
    stats.mcVsDp.push({ t: s.t, score: `${s.h}-${s.a}`, dp: r4(pOver), grid: r4(fg.over(2.5)), mc: r4(r.mcShares[0]), counts: r.counts, x12diff: Math.max(...x12.map((v, i) => Math.abs(v - fg.x12[i]))) });
  }
}
{
  // Pool: the structural bound 0.9·Σ(q·ℓ)/ℓ_i, and the 20-match table through the real store.
  const lean = [1.035, 0.985, 0.985];
  stats.poolBound = [];
  for (let qf = 0.05; qf <= 0.951; qf += 0.05) {
    const q = [qf, (1 - qf) * 0.55, (1 - qf) * 0.45];
    const sum = q.reduce((s, x, i) => s + x * lean[i], 0);
    stats.poolBound.push({ qf: r4(qf), perKr: lean.map((l) => r4((0.9 * sum) / l)) });
  }
  stats.poolBoundMax = r4((0.9 * 1.035) / 0.985);
  const worst = [0, 0, 0];
  const mean = [0, 0, 0];
  const N = 20;
  for (let m = 0; m < N; m++) {
    const { st, clock } = harness({ ...E.FREE_PLAY, seed: `pool-${m}` });
    while (st.sim.phase !== 'HT' && st.sim.phase !== '2H' && st.sim.phase !== 'closed') {
      st.speed = 8;
      st.tick(clock());
    }
    const pv = st.poolView();
    for (let i = 0; i < 3; i++) {
      const perKr = (st.sim.fair[i] * (pv.total + 100) * 0.9) / (pv.sides[i] + 100);
      worst[i] = Math.max(worst[i], perKr);
      mean[i] += perKr / N;
    }
  }
  stats.pool20 = { n: N, worst: worst.map(r4), mean: mean.map(r4) };
  assert(Math.max(...worst) <= 0.95, 'pool bound broken');
}
{
  // Constants with file:line.
  const files = ['src/engine/football/sim.ts', 'src/engine/football/params.ts', 'src/engine/football/dp.ts', 'src/engine/football/display.ts', 'src/engine/book/portfolio.ts', 'src/state/match.ts', 'src/engine/mc/paths.ts', 'src/state/focus.ts'];
  stats.constants = [];
  for (const f of files) {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
    lines.forEach((l, i) => {
      const m = /^(?:export )?const ([A-Z][A-Z0-9_]+)(?:: [^=]+)? = ([^;]+);(?:\s*\/\/\s*(.*))?/.exec(l);
      if (m) stats.constants.push({ name: m[1], value: m[2].trim(), file: f, line: i + 1, note: m[3] ?? '' });
    });
  }
  stats.params = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v]));
}
{
  // Tests per file from the verbose log, and the commit.
  const log = fs.readFileSync(path.join(DATA, 'vitest.txt'), 'utf8');
  const per = {};
  for (const m of log.matchAll(/✓ tests\/([\w.]+)\.test\.ts/g)) per[m[1]] = (per[m[1]] ?? 0) + 1;
  const total = /Tests\s+(\d+) passed/.exec(log);
  stats.tests = { perFile: per, total: Number(total?.[1] ?? 0) };
  assert(Object.values(per).reduce((a, b) => a + b, 0) === stats.tests.total, 'per-file test count does not add up');
  stats.commit = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
}
fs.writeFileSync(path.join(DATA, 'stats.json'), JSON.stringify(stats, null, 1));
console.log('stats', JSON.stringify({ goals: stats.goals, o25Kickoff: stats.o25Kickoff, pool20: stats.pool20, mc: stats.mcVsDp.map((m) => [m.dp, m.mc]), tests: stats.tests }));
