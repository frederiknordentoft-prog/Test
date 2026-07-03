// Dusør på lederen (G.bountyOn, default FRA): unit + fuld-kamp begge stillinger.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadGame, runFullMatch, assertInvariants} from './harness.mjs';

// To spillere: 'leader' har >15% land og en åben streg; 'cutter' kører ind i den.
function setupBountyDuel(t, bountyOn) {
  const {G} = t;
  t.setLocalPlayers(2, 0);
  G.demo = false; G.stormOn = false; G.bountyOn = bountyOn; G.phase = 'play';
  t.clearBoard();
  const [leader, cutter] = G.players;
  leader.alive = true; cutter.alive = true;
  // leder: 20x18=360 celler (>15% af 2088=313.2)
  for (let y = 2; y < 20; y++) for (let x = 2; x < 22; x++) t.owner[t.idx(x, y)] = leader.id;
  // cutter: lille base langt væk
  for (let y = 28; y <= 32; y++) for (let x = 45; x <= 49; x++) t.owner[t.idx(x, y)] = cutter.id;
  t.recount();
  // leders åbne streg (5 celler) uden for eget land
  leader.cx = leader.prevX = 30; leader.cy = leader.prevY = 25;
  leader.dir = {x: 1, y: 0}; leader.pendingDir = {x: 1, y: 0};
  leader.trailCells = [];
  for (let x = 26; x <= 30; x++) { const c = t.idx(x, 25); t.trail[c] = leader.id; leader.trailCells.push(c); }
  // cutter lige over stregen, på vej ned i den
  cutter.cx = cutter.prevX = 28; cutter.cy = cutter.prevY = 24;
  cutter.dir = {x: 0, y: 1}; cutter.pendingDir = {x: 0, y: 1};
  return [leader, cutter];
}

test('dusør ON: at skære lederens streg krediterer skæreren stregens længde', () => {
  const {t} = loadGame({seed: 31});
  const [leader, cutter] = setupBountyDuel(t, true);
  assert.strictEqual(t.bountyLeaderId(), leader.id, 'lederen telegraferes');
  const trailLen = leader.trailCells.length;
  t.simulate();
  assert.strictEqual(leader.alive, false, 'lederen dør af snittet');
  assert.strictEqual(cutter.bonus, trailLen, 'dusør = den skårne stregs længde');
  assert.strictEqual(t.credited(cutter.id), t.counts()[cutter.id] + trailLen);
});

test('dusør OFF: samme snit giver ingen bonus', () => {
  const {t} = loadGame({seed: 31});          // samme seed/opstilling
  const [leader, cutter] = setupBountyDuel(t, false);
  assert.strictEqual(t.bountyLeaderId(), 0, 'ingen leder når flaget er slukket');
  t.simulate();
  assert.strictEqual(leader.alive, false);
  assert.strictEqual(cutter.bonus, 0);
});

test('ikke-leder: snit uden dusør selv med flaget tændt', () => {
  const {t} = loadGame({seed: 32});
  const [leader, cutter] = setupBountyDuel(t, true);
  // fjern lederens land-forspring: nu er ingen over 15%/strengt størst
  for (let y = 2; y < 20; y++) for (let x = 2; x < 22; x++) t.owner[t.idx(x, y)] = 0;
  t.recount();
  assert.strictEqual(t.bountyLeaderId(), 0);
  t.simulate();
  assert.strictEqual(leader.alive, false, 'snittet dræber stadig');
  assert.strictEqual(cutter.bonus, 0, 'men ingen dusør');
});

for (const bountyOn of [false, true]) {
  for (const players of [4, 8]) {
    test(`fuld kamp m. dusør=${bountyOn}: ${players} spillere når matchend`, () => {
      const {t} = loadGame({seed: 40 + players + (bountyOn ? 1 : 0)});
      runFullMatch(t, {players, mapVariant: 'pillars', difficulty: 'hard', bountyOn});
      assert.strictEqual(t.G.phase, 'matchend');
      assertInvariants(t, assert);
    });
  }
}
