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

for (const p0 of [0.5, 0.3, 0.8]) {
  for (const K of ['CPMM', 'LMSR', 'Pari']) {
    test(`${K} p0=${p0}: startpris = p0`, () => near(new A[K]({ seed: 1000, p0, fee: 0 }).price(), p0, 1e-12, 'pris'));
  }
}

for (const K of ['CPMM', 'LMSR']) {
  test(`${K}: køb og straks sælg giver samme beløb tilbage uden gebyr (stiuafhængig)`, () => {
    const m = new A[K]({ seed: 1000, p0: 0.5, fee: 0 });
    const p0 = m.price();
    const r = m.quoteBuy(YES, 300); m.applyBuy(YES, r);
    const s = m.quoteSell(YES, r.shares); m.applySell(YES, r.shares, s);
    near(s.proceeds, 300, 1e-8, 'returbeløb');
    near(m.price(), p0, 1e-12, 'pris tilbage');
  });
  test(`${K}: køb af JA hæver prisen, køb af NEJ sænker den`, () => {
    const m = new A[K]({ seed: 1000, p0: 0.5, fee: 0.02 });
    assert.ok(m.quoteBuy(YES, 100).newPrice > 0.5);
    assert.ok(m.quoteBuy(NO, 100).newPrice < 0.5);
  });
  test(`${K}: operatørens tab er begrænset af startkapital selv ved enorm ensidet handel`, () => {
    for (const p0 of [0.5, 0.25, 0.9]) {
      const m = new A[K]({ seed: 1000, p0, fee: 0 });
      for (let i = 0; i < 200; i++) m.applyBuy(YES, m.quoteBuy(YES, 500));
      assert.ok(m.operatorPnL(YES) >= -1000 - 1e-6, `tab ${m.operatorPnL(YES)} > seed ved p0=${p0}`);
      assert.ok(m.price() <= 1 && m.price() >= 0 && Number.isFinite(m.operatorPnL(YES)));
    }
  });
}

test('LMSR: maks. tab nås asymptotisk (= startkapital)', () => {
  const m = new A.LMSR({ seed: 1000, p0: 0.5, fee: 0 });
  m.applyBuy(YES, m.quoteBuy(YES, 50000));
  near(m.operatorPnL(YES), -1000, 1e-6, 'tab');
});

test('CPMM: k bevares ved køb og salg', () => {
  const m = new A.CPMM({ seed: 1000, p0: 0.5, fee: 0.03 });
  const k0 = m.k();
  m.applyBuy(NO, m.quoteBuy(NO, 250)); near(m.k(), k0, 1e-6, 'k efter køb');
  m.applySell(NO, 50, m.quoteSell(NO, 50)); near(m.k(), k0, 1e-6, 'k efter salg');
});

test('CPMM: LP-værdi = netInflow + gebyr - spillerudbetaling (fuld dækning)', () => {
  const m = new A.CPMM({ seed: 1000, p0: 0.7, fee: 0.02 });
  m.applyBuy(YES, m.quoteBuy(YES, 400));
  m.applyBuy(NO, m.quoteBuy(NO, 150));
  m.applySell(YES, 100, m.quoteSell(YES, 100));
  for (const o of [YES, NO]) near(m.operatorPnL(o), m.netInflow + m.fees - m.out[o], 1e-8, 'identitet');
});

test('Pari: udbetaling til alle = hele puljen', () => {
  const m = new A.Pari({ seed: 1000, p0: 0.5, fee: 0 });
  m.applyBuy(YES, m.quoteBuy(YES, 700));
  m.applyBuy(NO, m.quoteBuy(NO, 300));
  const T = m.pool[0] + m.pool[1];
  near(m.out[YES] * m.payoutPerShare(YES, YES) + m.house[YES] * m.payoutPerShare(YES, YES), T, 1e-9, 'puljesum');
});

test('solveBuy/solveSell rammer målprisen', () => {
  for (const K of ['CPMM', 'LMSR', 'Pari']) {
    const m = new A[K]({ seed: 1000, p0: 0.5, fee: 0.02 });
    const g = A.solveBuy(m, YES, 0.6, 1e9);
    near(m.quoteBuy(YES, g).newPrice, 0.6, 1e-9, K + ' køb');
    if (m.canSell) {
      m.applyBuy(YES, m.quoteBuy(YES, g));
      const s = A.solveSell(m, YES, 0.55, m.out[YES]);
      near(m.quoteSell(YES, s).newPrice, 0.55, 1e-9, K + ' salg');
    }
  }
});

test('Simulation: nulsum (spillere + operatør = 0) i alle markeder, begge udfald', () => {
  for (const seed of [1, 2, 3]) {
    const sim = new A.Simulation({ rngSeed: seed, shockAt: 200 });
    sim.run(500);
    sim.manual('buy', YES, 2000);
    sim.manual('sell', YES, 0.5);
    for (const k in sim.markets) assert.ok(sim.markets[k].zeroSumError() < 1e-6, `${k} nulsum ${sim.markets[k].zeroSumError()}`);
  }
});

test('Simulation: ingen negative kontanter eller beholdninger', () => {
  const sim = new A.Simulation({ rngSeed: 11 });
  sim.run(800);
  for (const k in sim.markets) for (const a of sim.markets[k].agents) {
    assert.ok(a.cash >= -1e-9, `${k} cash ${a.cash}`);
    assert.ok(a.hold[0] >= -1e-9 && a.hold[1] >= -1e-9, `${k} hold`);
  }
});

test('Simulation: informerede driver prisen mod sandheden', () => {
  const sim = new A.Simulation({ rngSeed: 5, trueP: 0.75, mix: { informed: 0.6, noise: 0.4, momentum: 0 } });
  sim.run(600);
  for (const k of ['cpmm', 'lmsr']) near(sim.markets[k].mech.price(), 0.75, 0.08, k);
});

test('Simulation: deterministisk med samme seed', () => {
  const a = new A.Simulation({ rngSeed: 9 }); a.run(300);
  const b = new A.Simulation({ rngSeed: 9 }); b.run(300);
  for (const k in a.markets) assert.strictEqual(a.markets[k].mech.price(), b.markets[k].mech.price());
});

console.log(`\n${passed} tests bestået${process.exitCode ? ', men der er fejl' : ''}`);
