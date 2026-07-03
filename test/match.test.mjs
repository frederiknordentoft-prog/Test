// Regressions-matrix: fuld kamp til matchend for 4 OG 8 spillere,
// alle bane-varianter × sværhedsgrader. Nul exceptions = grønt.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadGame, runFullMatch, assertInvariants} from './harness.mjs';

test('load-test: scriptet evaluerer uden at kaste', () => {
  const {t} = loadGame({seed: 42});
  assert.ok(t.G, '__t.G findes');
  assert.strictEqual(typeof t.simulate, 'function');
});

const MAPS = ['none', 'pillars', 'cross'];
const DIFFS = ['normal', 'hard'];

for (const players of [4, 8]) {
  for (const mapVariant of MAPS) {
    for (const difficulty of DIFFS) {
      test(`fuld kamp: ${players} spillere · ${mapVariant} · ${difficulty}`, () => {
        const {t} = loadGame({seed: players * 100 + MAPS.indexOf(mapVariant) * 10 + DIFFS.indexOf(difficulty)});
        runFullMatch(t, {players, mapVariant, difficulty});
        assert.strictEqual(t.G.phase, 'matchend');
        assertInvariants(t, assert);
        const wins = t.G.players.reduce((a, p) => a + p.roundWins, 0);
        assert.strictEqual(wins, t.G.totalRounds, 'præcis én vinder pr. runde');
      });
    }
  }
}

test('power-ups on: fuld kamp uden exceptions (8 spillere)', () => {
  const {t} = loadGame({seed: 7});
  runFullMatch(t, {players: 8, mapVariant: 'none', difficulty: 'normal', powerupsOn: true});
  assert.strictEqual(t.G.phase, 'matchend');
  assertInvariants(t, assert);
});
