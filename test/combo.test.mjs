// Kombo-erobring: deterministiske assertions (a)-(e) fra spec'en.
// Scriptede captures uden simulate(): vi bygger board-state i hånden og kalder capture() direkte
// (capture tjekker hverken position eller runde-slut — kun trailCells + grids).
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './harness.mjs';

// Base-kolonne ved x=bx (y 5..7) + krog-formet streg der indelukker 3 celler.
// Streg: (bx+1..bx+4, 5) ned til (bx+4,7) tilbage til (bx+1,7) — indelukker (bx+1..bx+3, 6).
function makeCapturer(t, players = 1) {
  const {G} = t;
  t.setLocalPlayers(1, players - 1);
  G.demo = false; G.phase = 'play';
  t.clearBoard();
  const p = G.players[0];
  p.alive = true;
  return p;
}
function scriptedCapture(t, p, bx) {
  for (let y = 5; y <= 7; y++) t.owner[t.idx(bx, y)] = p.id;   // "hjem"-kolonne som krogen lukker mod
  const cells = [];
  for (let x = bx + 1; x <= bx + 4; x++) cells.push([x, 5]);
  cells.push([bx + 4, 6], [bx + 4, 7]);
  for (let x = bx + 3; x >= bx + 1; x--) cells.push([x, 7]);
  p.trailCells = cells.map(([x, y]) => t.idx(x, y));
  for (const c of p.trailCells) t.trail[c] = p.id;
  p.cx = bx + 1; p.cy = 7;               // lukkepunktet
  t.recount();
  const gained = cells.length + 3;       // 9 streg-celler + 3 indelukkede
  t.capture(p);
  return gained;
}

test('(a) to erobringer inden for vinduet ⇒ combo=2 og multiplier krediteret', () => {
  const {t} = loadGame({seed: 21});
  const p = makeCapturer(t);
  const g1 = scriptedCapture(t, p, 5);
  assert.strictEqual(p.combo, 1, 'første erobring: combo=1');
  assert.strictEqual(p.bonus, 0, 'combo=1 ⇒ mult x1 ⇒ ingen bonus');
  assert.strictEqual(t.comboMult(p), 1);
  t.G.simTick += 10;                      // inden for vinduet (23 ticks v. normal 6.5)
  const g2 = scriptedCapture(t, p, 12);
  assert.strictEqual(p.combo, 2);
  assert.strictEqual(t.comboMult(p), 1.25);
  assert.strictEqual(p.bonus, Math.round(g2 * 1.25) - g2, 'bonus = krediteret - raw');
  assert.strictEqual(t.credited(p.id), t.counts()[p.id] + p.bonus);
});

test('(b) erobring efter vinduet ⇒ combo=1 og bonus uændret', () => {
  const {t} = loadGame({seed: 22});
  const p = makeCapturer(t);
  scriptedCapture(t, p, 5);
  t.G.simTick += 10;
  scriptedCapture(t, p, 12);              // combo=2, bonus>0? (g2*0.25 afrundet)
  const bonusBefore = p.bonus;
  t.G.simTick = p.comboUntil + 1;         // vinduet er udløbet
  scriptedCapture(t, p, 19);
  assert.strictEqual(p.combo, 1, 'kæden er brudt');
  assert.strictEqual(p.bonus, bonusBefore, 'x1-erobring ændrer ikke bonus');
});

test('(c) død nulstiller combo — banket bonus består', () => {
  const {t} = loadGame({seed: 23});
  const p = makeCapturer(t);
  scriptedCapture(t, p, 5);
  t.G.simTick += 5;
  scriptedCapture(t, p, 12);
  assert.strictEqual(p.combo, 2);
  const bonus = p.bonus;
  assert.ok(bonus > 0);
  t.killPlayer(p);
  assert.strictEqual(p.combo, 0);
  assert.strictEqual(p.comboUntil, 0);
  assert.strictEqual(p.bonus, bonus, 'bonus består efter død (som frosset land)');
  p.alive = true;                          // genopliv til kæde-test
  scriptedCapture(t, p, 19);
  assert.strictEqual(p.combo, 1, 'ny kæde starter fra 1 efter død');
});

test('(d) multiplier respekterer comboMaxStack-loftet', () => {
  const {t} = loadGame({seed: 24});
  const p = makeCapturer(t);
  let lastGained = 0;
  for (let i = 0; i < 6; i++) {
    const bonusBefore = p.bonus;
    lastGained = scriptedCapture(t, p, 5 + i * 7);
    t.G.simTick += 2;
    if (i === 5) {
      assert.strictEqual(p.combo, t.G.comboMaxStack, 'kæden er pinned på loftet');
      assert.strictEqual(t.comboMult(p), 1 + (t.G.comboMaxStack - 1) * 0.25);
      assert.strictEqual(p.bonus - bonusBefore, Math.round(lastGained * 1.75) - lastGained,
        'sidste tilvækst bruger loft-multiplier (x1.75)');
    }
  }
  assert.ok(p.combo <= t.G.comboMaxStack);
});

test('(e) grid-ejerskab er identisk med/uden combo — multiplier rører aldrig cellerne', () => {
  // Samme scriptede sekvens i to friske realms: maxStack 4 (combo aktiv) vs 1 (mult altid x1).
  const run = (maxStack) => {
    const {t} = loadGame({seed: 25});
    t.G.comboMaxStack = maxStack;
    const p = makeCapturer(t);
    for (let i = 0; i < 4; i++) { scriptedCapture(t, p, 5 + i * 8); t.G.simTick += 3; }
    return {owner: Buffer.from(t.owner.buffer.slice(0)), counts: [...t.counts()], credited: t.credited(p.id), bonus: p.bonus};
  };
  const withCombo = run(4), without = run(1);
  assert.strictEqual(Buffer.compare(withCombo.owner, without.owner), 0, 'owner-grid byte-identisk');
  assert.deepStrictEqual(withCombo.counts, without.counts, 'raw counts identiske');
  assert.ok(withCombo.bonus > 0 && without.bonus === 0);
  assert.ok(withCombo.credited > without.credited, 'kun KREDITERET adskiller sig');
});

test('kombo-mekanik i fuld kamp: 4 og 8 spillere når matchend med invarianter', async () => {
  const {runFullMatch, assertInvariants} = await import('./harness.mjs');
  for (const players of [4, 8]) {
    const {t} = loadGame({seed: 26 + players});
    runFullMatch(t, {players, mapVariant: 'none', difficulty: 'hard'});
    assert.strictEqual(t.G.phase, 'matchend');
    assertInvariants(t, assert);
    for (const p of t.G.players) assert.ok(t.credited(p.id) >= t.counts()[p.id], 'credited >= raw');
  }
});
