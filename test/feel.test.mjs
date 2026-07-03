// Unit-tests for kill-attribution (Phase 1a) — scriptede simulate()-scenarier.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './harness.mjs';

// Sæt et minimalt play-scenarie op: 2 lokale spillere, håndplacerede baser,
// styring via p.pendingDir (decideDir bruger den når pointer er inaktiv).
function setupDuel(t) {
  const {G} = t;
  t.setLocalPlayers(2, 0);
  G.demo = false; G.stormOn = false; G.powerupsOn = false;
  t.clearBoard();
  const [a, b] = G.players;
  // baser langt fra hinanden
  a.base = {x: 10, y: 10}; b.base = {x: 40, y: 20};
  for (const p of G.players) {
    for (let y = p.base.y - 2; y <= p.base.y + 2; y++)
      for (let x = p.base.x - 2; x <= p.base.x + 2; x++) t.owner[t.idx(x, y)] = p.id;
  }
  t.recount();
  t.startPlay();
  t.clearBoard(); // startPlay recounter — genopbyg baserne bagefter
  for (const p of G.players) {
    for (let y = p.base.y - 2; y <= p.base.y + 2; y++)
      for (let x = p.base.x - 2; x <= p.base.x + 2; x++) t.owner[t.idx(x, y)] = p.id;
  }
  t.recount();
  G.stormM = 0;
  return [a, b];
}

test('trail-cross: offeret dør med killedBy=krydseren, killKind=c', () => {
  const {t} = loadGame({seed: 11});
  const [a, b] = setupDuel(t);
  // a har en åben streg lige foran b; b kører ind i den
  a.cx = a.prevX = 20; a.cy = a.prevY = 20; a.dir = {x: 0, y: -1}; a.pendingDir = {x: 0, y: -1};
  const trailCell = t.idx(21, 22);
  t.trail[trailCell] = a.id; a.trailCells = [trailCell];
  b.cx = b.prevX = 20; b.cy = b.prevY = 22; b.dir = {x: 1, y: 0}; b.pendingDir = {x: 1, y: 0};
  t.simulate();
  assert.strictEqual(a.alive, false, 'streg-ejeren dør');
  assert.strictEqual(a.killKind, 'c');
  assert.strictEqual(a.killedBy, b.id);
  assert.strictEqual(b.alive, true, 'krydseren overlever');
});

test('skjold undertrykker attribution og redder', () => {
  const {t} = loadGame({seed: 12});
  const [a, b] = setupDuel(t);
  a.cx = a.prevX = 20; a.cy = a.prevY = 20; a.dir = {x: 0, y: -1}; a.pendingDir = {x: 0, y: -1};
  const trailCell = t.idx(21, 22);
  t.trail[trailCell] = a.id; a.trailCells = [trailCell];
  a.shield = true;
  b.cx = b.prevX = 20; b.cy = b.prevY = 22; b.dir = {x: 1, y: 0}; b.pendingDir = {x: 1, y: 0};
  t.simulate();
  assert.strictEqual(a.alive, true, 'skjoldet redder');
  assert.strictEqual(a.shield, false, 'skjold forbrugt');
  assert.strictEqual(a.killKind, '', 'ingen attribution ved skjold-redning');
  assert.strictEqual(a.killedBy, 0);
});

test('vægdød: killKind=w uden killedBy', () => {
  const {t} = loadGame({seed: 13});
  const [a] = setupDuel(t);
  // a er UDE af eget land og kører direkte mod væggen
  a.cx = a.prevX = 1; a.cy = a.prevY = 0; a.dir = {x: 0, y: -1}; a.pendingDir = {x: 0, y: -1};
  const tc = t.idx(1, 0); t.trail[tc] = a.id; a.trailCells = [tc];
  t.simulate();
  assert.strictEqual(a.alive, false);
  assert.strictEqual(a.killKind, 'w');
  assert.strictEqual(a.killedBy, 0);
});

test('modstander-land: killKind=l med ejeren som killedBy', () => {
  const {t} = loadGame({seed: 14});
  const [a, b] = setupDuel(t);
  // a kører ind i b's territorie
  a.cx = a.prevX = 37; a.cy = a.prevY = 20; a.dir = {x: 1, y: 0}; a.pendingDir = {x: 1, y: 0};
  const tc = t.idx(37, 20); t.trail[tc] = a.id; a.trailCells = [tc];
  t.simulate();
  assert.strictEqual(a.alive, false);
  assert.strictEqual(a.killKind, 'l');
  assert.strictEqual(a.killedBy, b.id);
});
