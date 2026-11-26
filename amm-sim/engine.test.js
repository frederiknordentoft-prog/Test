// Kør: node amm-sim/engine.test.js
'use strict';
const assert = require('assert');
const A = require('./engine.js');
const { YES, NO } = A;

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ok  ' + name); }
  catch (e) { console.error('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);

test('startpris = p0', () => {
  for (const p0 of [0.5, 0.3, 0.8]) near(new A.LMSR({ capital: 1000, p0, fee: 0 }).price(), p0, 1e-12, 'pris');
});

test('køb af JA hæver prisen, køb af NEJ sænker den', () => {
  const m = new A.LMSR({ capital: 1000, p0: 0.5, fee: 0.02 });
  assert.ok(m.quoteBuy(YES, 100).newPrice > 0.5);
  assert.ok(m.quoteBuy(NO, 100).newPrice < 0.5);
});

test('køb og straks salg giver samme beløb tilbage uden gebyr', () => {
  const m = new A.LMSR({ capital: 1000, p0: 0.5, fee: 0 });
  const r = m.quoteBuy(YES, 300); m.applyBuy(YES, r);
  const s = m.quoteSell(YES, r.shares); m.applySell(YES, r.shares, s);
  near(s.proceeds, 300, 1e-8, 'returbeløb');
  near(m.price(), 0.5, 1e-12, 'pris');
});

test('husets tab er begrænset af startkapitalen og nås asymptotisk', () => {
  for (const p0 of [0.5, 0.25, 0.9]) {
    const m = new A.LMSR({ capital: 1000, p0, fee: 0 });
    const side = p0 >= 0.5 ? NO : YES; // køb den side der startede billigst = værste udfald for huset
    m.applyBuy(side, m.quoteBuy(side, 1e5));
    assert.ok(m.houseResult(side) >= -1000 - 1e-6, `tab ${m.houseResult(side)} ved p0=${p0}`);
    near(m.houseResult(side), -1000, 1e-3, `asymptote p0=${p0}`);
  }
});

test('amountToReach og sharesToReach rammer målprisen', () => {
  const m = new A.LMSR({ capital: 1000, p0: 0.5, fee: 0.02 });
  const a = A.amountToReach(m, YES, 0.6, 1e9);
  near(m.quoteBuy(YES, a).newPrice, 0.6, 1e-9, 'køb');
  m.applyBuy(YES, m.quoteBuy(YES, a));
  const s = A.sharesToReach(m, YES, 0.55, m.out[YES]);
  near(m.quoteSell(YES, s).newPrice, 0.55, 1e-9, 'salg');
});

test('nulsum: spillere + hus = 0 for begge udfald', () => {
  for (const seed of [1, 2, 3]) {
    const sim = new A.Simulation({ rngSeed: seed, shockAt: 200 });
    sim.run(500);
    sim.manual('buy', YES, 2000);
    sim.manual('sell', YES, 0.5);
    assert.ok(sim.zeroSumError() < 1e-6, `afvigelse ${sim.zeroSumError()}`);
  }
});

test('ingen negative kontanter eller beholdninger', () => {
  const sim = new A.Simulation({ rngSeed: 11 });
  sim.run(800);
  for (const p of sim.players) assert.ok(p.cash >= -1e-9 && p.hold[0] >= -1e-9 && p.hold[1] >= -1e-9, `spiller ${p.id}`);
});

test('informerede driver prisen mod sandheden', () => {
  const sim = new A.Simulation({ rngSeed: 5, trueP: 0.75, informedShare: 0.6 });
  sim.run(600);
  near(sim.mm.price(), 0.75, 0.08, 'slutpris');
});

test('forventet subsidie uden gebyr ≈ b·KL(p‖p0) når prisen har fundet sandheden', () => {
  const m = new A.LMSR({ capital: 1000, p0: 0.5, fee: 0 });
  m.applyBuy(YES, m.quoteBuy(YES, A.amountToReach(m, YES, 0.7, 1e9)));
  near(-(0.7 * m.houseResult(YES) + 0.3 * m.houseResult(NO)), A.expectedSubsidy(m.b, 0.5, 0.7), 1e-6, 'subsidie');
});

test('omsætning = sum af handlernes beløb, fordelt på JA og NEJ', () => {
  const sim = new A.Simulation({ rngSeed: 4, players: 200, trades: 2000 });
  sim.run(2000);
  near(sim.volBySide[0] + sim.volBySide[1], sim.volume, 1e-6, 'sider');
  near(sim.hist.volYes.at(-1) + sim.hist.volNo.at(-1), sim.volume, 1e-6, 'historik');
  assert.ok(sim.trades > 1000, `kun ${sim.trades} handler`);
  // gebyr er en fast andel af omsætningen
  near(sim.mm.fees, sim.cfg.fee * sim.volume, 1e-6, 'gebyr');
});

test('købspris følger positionen ved delvist salg', () => {
  const sim = new A.Simulation({ rngSeed: 3 });
  sim.manual('buy', YES, 500);
  near(sim.you.cost[YES], 500, 1e-9, 'efter køb');
  sim.manual('sell', YES, 0.5);
  near(sim.you.cost[YES], 250, 1e-9, 'efter halvt salg');
  sim.manual('sell', YES, 1);
  near(sim.you.cost[YES], 0, 1e-9, 'efter fuldt salg');
  assert.strictEqual(sim.you.trades, 3);
});

test('deterministisk med samme seed', () => {
  const a = new A.Simulation({ rngSeed: 9 }); a.run(300);
  const b = new A.Simulation({ rngSeed: 9 }); b.run(300);
  assert.strictEqual(a.mm.price(), b.mm.price());
});

console.log(`\n${passed} tests bestået${process.exitCode ? ', men der er fejl' : ''}`);
