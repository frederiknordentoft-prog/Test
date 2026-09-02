// Rules-adversary suite: the 52 panel scenarios (scenarios.json) as node:test cases against
// src/engine.js, a 20 000-round property test with an independent money/dealer oracle, and
// targeted probes for engine corner cases.
//
// Status at hand-over: 63 pass, 5 fail. The 5 failing tests are prefixed 'DEFECT' and pin down
// real engine deviations (even-money gating, dead resplitAces flag, stats.wagered/blackjacks,
// H17 cells in the S17 strategy hint); they should turn green when the engine is fixed.
// T38–T41, T48 and T50 are 3-box scenarios; the engine plays one box, so they are reduced to the
// single-box rule they exercise. T46/T47 plant cards in shoe.cards because rig() bypasses the
// cut-card counter. Set BJ_SEED to re-run the property test with another seed.
//
// Run:  node --test scenarios.test.mjs            (from this directory)
//       BJ_ENGINE=/path/to/engine.js node --test scenarios.test.mjs
// If adopted into blackjack/tests/, the relative '../src/engine.js' path is picked up automatically.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ENGINE = process.env.BJ_ENGINE
  || (existsSync(join(here, '../src/engine.js')) ? join(here, '../src/engine.js') : '../src/engine.js');
const require = createRequire(import.meta.url);
const BJ = require(ENGINE);
const { Game, handValue, parseCards, PHASE } = BJ;

/* ----------------------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------------------- */
const types = ev => ev.map(e => e.type);
const has = (ev, t) => types(ev).includes(t);
const settleOf = ev => ev.find(e => e.type === 'settle');
const ids = cards => cards.map(c => c.id).join(' ');
const tot = cards => handValue(cards).total;

/** New game (seed only matters for non-rigged cards). */
function game(opts = {}) { return new Game({ seed: 1, ...opts }); }
/** Rig the shoe, stage the bet (number or array of chips), deal. Returns the deal events. */
function start(g, shoe, bet = 100) {
  if (shoe) g.shoe.rig(shoe);
  for (const c of Array.isArray(bet) ? bet : [bet]) g.addChip(c);
  return g.deal();
}
/** Assert the dealer revealed and did NOT draw. */
function dealerRevealedNoDraw(g, ev) {
  assert.equal(g.dealer.holeHidden, false, 'hole card revealed');
  assert.equal(g.dealer.cards.length, 2, 'dealer did not draw');
  assert.ok(has(ev, 'reveal'), 'reveal event emitted');
  assert.ok(!has(ev, 'dealerCard'), 'no dealerCard event');
}
/** Dealer cards drawn during play (after the two dealt cards). */
const dealerDraws = g => g.dealer.cards.slice(2).map(c => c.id);
/** Assert that the round settled with no player action ever offered. */
function noPlayerActionOffered(ev) {
  assert.ok(!has(ev, 'activeHand'), 'no activeHand (player never acted)');
  const s = settleOf(ev); assert.ok(s, 'settled');
}

/* ----------------------------------------------------------------------------
   T01–T52 (single box, bet 100 kr., balance 10 000 unless stated)
   ---------------------------------------------------------------------------- */
test('T01 natural vs dealer 7 up: 3:2 paid at once, dealer reveals 16 and does not draw', () => {
  const g = game(); const ev = start(g, 'A♠ 7♦ K♥ 9♣');
  noPlayerActionOffered(ev);
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'blackjack');
  assert.equal(s.results[0].payout, 250);
  assert.equal(s.net, 150);
  assert.ok(!has(ev, 'peek'), 'no peek on a 7');
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 16);
  assert.equal(g.balance, 10150);
  assert.equal(g.phase, PHASE.SETTLED);
});

test('T02 natural vs dealer natural (10 up): immediate peek, push, no player action', () => {
  const g = game(); const ev = start(g, 'A♠ K♦ Q♥ A♣');
  assert.ok(!has(ev, 'insuranceOffer') && !has(ev, 'evenMoneyOffer'), 'no insurance prompt on 10 up');
  const peek = ev.find(e => e.type === 'peek'); assert.ok(peek && peek.blackjack === true);
  noPlayerActionOffered(ev);
  assert.equal(settleOf(ev).results[0].outcome, 'push');
  assert.equal(g.balance, 10000);
});

test('T03 dealer natural (10 up) beats player 20 without any action', () => {
  const g = game(); const ev = start(g, 'K♠ Q♦ 10♥ A♣');
  noPlayerActionOffered(ev);
  assert.equal(settleOf(ev).results[0].outcome, 'lose');
  assert.equal(g.balance, 9900);
  assert.equal(g.dealer.holeHidden, false);
});

test('T04 10 up, peek negative → stand; dealer 16 draws 9 → bust', () => {
  const g = game(); let ev = start(g, 'K♠ Q♦ 10♥ 6♣ 9♠');
  assert.ok(!has(ev, 'insuranceOffer'));
  assert.equal(ev.find(e => e.type === 'peek').blackjack, false);
  assert.equal(g.phase, PHASE.PLAYER);
  ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['9S']);
  assert.ok(has(ev, 'dealerBust'));
  assert.equal(settleOf(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('T05 decline insurance, dealer natural: −100', () => {
  const g = game(); let ev = start(g, '9♠ A♦ 10♥ K♣');
  assert.equal(ev.at(-1).type, 'insuranceOffer'); assert.equal(ev.at(-1).cost, 50);
  assert.equal(g.phase, PHASE.INSURANCE);
  ev = g.insurance(false);
  assert.ok(has(ev, 'insuranceDeclined'));
  assert.equal(ev.find(e => e.type === 'peek').blackjack, true);
  assert.equal(settleOf(ev).results[0].outcome, 'lose');
  assert.equal(settleOf(ev).insurance, null);
  assert.equal(g.balance, 9900);
});

test('T06 take insurance, dealer natural: main −100, insurance returns 150, net 0', () => {
  const g = game(); start(g, '9♠ A♦ 10♥ K♣');
  const ev = g.insurance(true);
  const taken = ev.find(e => e.type === 'insuranceTaken');
  assert.equal(taken.amount, 50); assert.equal(taken.balance, 9850);
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'lose'); assert.equal(s.results[0].payout, 0);
  assert.deepEqual(s.insurance, { outcome: 'win', bet: 50, payout: 150, net: 100 });
  assert.equal(s.payout, 150); assert.equal(s.totalBet, 150); assert.equal(s.net, 0);
  assert.equal(g.balance, 10000);
});

test('T07 take insurance, peek negative: insurance swept, dealer soft 18 stands, +100 → net +50', () => {
  const g = game(); start(g, '9♠ A♦ 10♥ 7♣');
  let ev = g.insurance(true);
  assert.equal(g.balance, 9850);
  assert.ok(has(ev, 'insuranceLost'));
  assert.equal(g.insuranceResult, 'lose');
  assert.equal(g.phase, PHASE.PLAYER);
  ev = g.stand();
  assert.equal(g.dealer.cards.length, 2, 'A+7 = soft 18 stands');
  const s = settleOf(ev);
  assert.equal(s.dealer.value.total, 18);
  assert.equal(s.results[0].outcome, 'win');
  assert.equal(s.insurance.outcome, 'lose');
  assert.equal(s.net, 50);
  assert.equal(g.balance, 10050);
});

test('T08 accept even money vs dealer natural: +100, box already settled', () => {
  const g = game(); let ev = start(g, 'A♠ A♦ K♥ 10♣');
  assert.equal(ev.at(-1).type, 'evenMoneyOffer');
  ev = g.insurance(true);
  assert.ok(has(ev, 'evenMoneyTaken'));
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'evenMoney'); assert.equal(s.results[0].payout, 200);
  assert.equal(g.insuranceBet, 0, 'even money costs nothing');
  assert.equal(g.balance, 10100);
  assert.equal(g.dealer.holeHidden, false);
});

test('T09 decline even money vs dealer natural: push', () => {
  const g = game(); start(g, 'A♠ A♦ K♥ 10♣');
  const ev = g.insurance(false);
  assert.equal(ev.find(e => e.type === 'peek').blackjack, true);
  assert.equal(settleOf(ev).results[0].outcome, 'push');
  assert.equal(g.balance, 10000);
});

test('T10 decline even money, peek negative: 3:2, dealer reveals soft 16 and does not draw', () => {
  const g = game(); start(g, 'A♠ A♦ K♥ 5♣');
  const ev = g.insurance(false);
  assert.equal(ev.find(e => e.type === 'peek').blackjack, false);
  assert.equal(settleOf(ev).results[0].outcome, 'blackjack');
  dealerRevealedNoDraw(g, ev);
  assert.deepEqual(handValue(g.dealer.cards), { total: 16, soft: true, bust: false });
  assert.equal(g.balance, 10150);
});

test('T11 bet 10: insurance costs exactly 5 and returns 15 on dealer natural', () => {
  const g = game(); let ev = start(g, '9♠ A♦ 9♥ Q♣', 10);
  assert.equal(ev.at(-1).cost, 5);
  ev = g.insurance(true);
  assert.equal(g.insuranceBet, 5);
  const s = settleOf(ev);
  assert.equal(s.insurance.payout, 15);
  assert.equal(s.results[0].payout, 0);
  assert.equal(g.balance, 10000);
});

test('T12 balance 40 after bet 100: insurance not offered, peek negative, dealer soft 19 stands, player 18 loses', () => {
  const g = game({ balance: 140 }); let ev = start(g, '9♠ A♦ 9♥ 8♣');
  assert.equal(g.balance, 40);
  assert.ok(!has(ev, 'insuranceOffer'), 'insurance offer suppressed (needs 50)');
  assert.equal(ev.find(e => e.type === 'peek').blackjack, false);
  assert.equal(g.phase, PHASE.PLAYER);
  ev = g.stand();
  assert.equal(g.dealer.cards.length, 2);
  assert.equal(settleOf(ev).dealer.value.total, 19);
  assert.equal(settleOf(ev).results[0].outcome, 'lose');
  assert.equal(g.balance, 40);
});

test('T13 stand 19; dealer 16 draws 8 → 24 bust', () => {
  const g = game(); start(g, '10♠ 6♦ 9♥ 10♣ 8♠');
  const ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['8S']);
  assert.ok(has(ev, 'dealerBust'));
  assert.equal(g.balance, 10100);
});

test('T14 hit to 20, stand; dealer 17 stands', () => {
  const g = game(); start(g, '5♠ 9♦ 6♥ 8♣ 9♠');
  let ev = g.hit();
  assert.equal(tot(g.hands[0].cards), 20);
  assert.equal(g.phase, PHASE.PLAYER);
  ev = g.stand();
  assert.equal(g.dealer.cards.length, 2);
  assert.equal(settleOf(ev).dealer.value.total, 17);
  assert.equal(settleOf(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('T15 hit to 24: bust settled at once, dealer reveals 17 and does not draw', () => {
  const g = game(); start(g, '10♠ 7♦ 6♥ 10♣ 8♠');
  const ev = g.hit();
  assert.ok(has(ev, 'bust'));
  assert.equal(settleOf(ev).results[0].outcome, 'bust');
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 17);
  assert.equal(g.balance, 9900);
});

test('T16 18 vs 18 push returns the stake', () => {
  const g = game(); start(g, '10♠ 8♦ 8♥ 10♣');
  const ev = g.stand();
  assert.equal(settleOf(ev).results[0].outcome, 'push');
  assert.equal(settleOf(ev).results[0].payout, 100);
  assert.equal(g.balance, 10000);
});

test('T17 double 11: one card, auto-stand, dealer 15 draws 2 → 17, win 2×100', () => {
  const g = game(); start(g, '6♠ 5♦ 5♥ 10♣ 9♠ 2♦');
  const ev = g.double();
  const d = ev.find(e => e.type === 'double');
  assert.equal(d.bet, 200); assert.equal(d.balance, 9800); assert.equal(d.card.id, '9S');
  assert.equal(g.hands[0].cards.length, 3);
  assert.equal(g.hands[0].doubled, true);
  assert.equal(g.phase, PHASE.SETTLED, 'auto-stand after the double card');
  assert.deepEqual(dealerDraws(g), ['2D']);
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'win'); assert.equal(s.results[0].payout, 400);
  assert.equal(g.balance, 10200);
});

test('T18 double on hard 14 and bust: −200 at once, dealer reveals 16 and does not draw', () => {
  const g = game(); start(g, '9♠ 6♦ 5♥ 10♣ J♠');
  const ev = g.double();
  assert.ok(has(ev, 'bust'));
  assert.equal(settleOf(ev).results[0].outcome, 'bust');
  assert.equal(settleOf(ev).results[0].bet, 200);
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 16);
  assert.equal(g.balance, 9800);
});

test('T19 10 up peek negative → double to 20 vs dealer 20: push returns 200', () => {
  const g = game(); let ev = start(g, '6♠ 10♦ 5♥ K♣ 9♠');
  assert.equal(ev.find(e => e.type === 'peek').blackjack, false);
  ev = g.double();
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'push'); assert.equal(s.results[0].payout, 200);
  assert.equal(g.balance, 10000);
});

test('T20 double soft 18 with a 10: value 18 (not 28); dealer 16 draws 9 → 25; +200', () => {
  const g = game(); start(g, 'A♠ 6♦ 7♥ 10♣ 10♠ 9♦');
  const ev = g.double();
  const d = ev.find(e => e.type === 'double');
  assert.deepEqual(d.value, { total: 18, soft: false, bust: false });
  assert.deepEqual(handValue(g.hands[0].cards), { total: 18, soft: false, bust: false });
  assert.ok(has(ev, 'dealerBust'));
  assert.equal(settleOf(ev).results[0].payout, 400);
  assert.equal(g.balance, 10200);
});

test('T21 after a hit, double and surrender are gone; hit to 16, stand; dealer 16 draws 5 → 21', () => {
  const g = game(); start(g, '2♠ 6♦ 3♥ 10♣ 4♠ 7♦ 5♣');
  assert.equal(g.availableActions().double, true);
  assert.equal(g.availableActions().surrender, true);
  let ev = g.hit();
  assert.equal(tot(g.hands[0].cards), 9);
  const a = g.availableActions();
  assert.equal(a.double, false); assert.equal(a.surrender, false); assert.equal(a.hit, true);
  assert.throws(() => g.double(), e => e.code === 'notAllowed');
  assert.throws(() => g.surrender(), e => e.code === 'notAllowed');
  ev = g.hit(); assert.equal(tot(g.hands[0].cards), 16);
  ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['5C']);
  assert.equal(settleOf(ev).dealer.value.total, 21);
  assert.equal(settleOf(ev).results[0].outcome, 'lose');
  assert.equal(g.balance, 9900);
});

test('T22 split 8s; H1 18 stand; H2 11 double → 19; dealer 16 draws 9 → bust; net +300', () => {
  const g = game(); start(g, '8♠ 6♦ 8♥ 10♣ 10♠ 3♦ 8♦ 9♣');
  let ev = g.split();
  assert.equal(g.balance, 9800);
  assert.equal(g.hands.length, 2);
  assert.equal(ids(g.hands[0].cards), '8S 10S');
  assert.equal(ids(g.hands[1].cards), '8H', 'second hand waits for its card');
  assert.equal(g.activeHand, 0);
  let a = g.availableActions();
  assert.equal(a.surrender, false, 'no surrender on split hands');
  assert.equal(a.double, true, 'DAS');
  ev = g.stand();
  assert.equal(g.activeHand, 1);
  assert.equal(ids(g.hands[1].cards), '8H 3D');
  a = g.availableActions();
  assert.equal(a.surrender, false); assert.equal(a.double, true);
  ev = g.double();
  assert.equal(ids(g.hands[1].cards), '8H 3D 8D');
  assert.equal(ev.find(e => e.type === 'double').balance, 9700, 'second stake deducted before the card');
  assert.deepEqual(dealerDraws(g), ['9C']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => [r.outcome, r.payout]), [['win', 200], ['win', 400]]);
  assert.equal(s.net, 300);
  assert.equal(g.balance, 10300);
});

test('T23 split 9s; H1 19 stand; H2 hits to 25 (bust); dealer 17; H1 +100 → net 0', () => {
  const g = game(); start(g, '9♠ 7♦ 9♥ 10♣ 10♠ 2♦ 4♣ K♦');
  g.split();
  assert.equal(tot(g.hands[0].cards), 19);
  g.stand();
  assert.equal(ids(g.hands[1].cards), '9H 2D');
  g.hit(); assert.equal(tot(g.hands[1].cards), 15);
  const ev = g.hit();
  assert.ok(has(ev, 'bust'));
  assert.equal(g.hands[1].done, true);
  assert.equal(g.dealer.cards.length, 2, 'dealer 17 stands');
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => [r.outcome, r.payout]), [['win', 200], ['bust', 0]]);
  assert.equal(s.net, 0);
  assert.equal(g.balance, 10000);
});

test('T24 resplit 8s to four hands, split absent on the 4th; stand/stand/double/stand; dealer busts; +500', () => {
  const g = game(); start(g, '8♠ 5♦ 8♥ 10♣ 8♦ 8♣ 8♠ 10♦ 3♠ 9♦ 10♥ 10♠');
  g.split();
  assert.equal(ids(g.hands[0].cards), '8S 8D');
  assert.equal(g.availableActions().split, true);
  g.split();
  assert.equal(g.hands.length, 3);
  assert.equal(ids(g.hands[0].cards), '8S 8C');
  g.split();
  assert.equal(g.hands.length, 4);
  assert.equal(g.balance, 9600);
  assert.deepEqual(g.hands.map(h => ids(h.cards)), ['8S 8S', '8C', '8D', '8H']);
  assert.equal(g.availableActions().split, false, 'split absent at 4 hands');
  assert.throws(() => g.split(), e => e.code === 'notAllowed');
  g.stand();                                   // H1 16
  assert.equal(ids(g.hands[1].cards), '8C 10D'); g.stand(); // H2 18
  assert.equal(ids(g.hands[2].cards), '8D 3S');
  assert.equal(g.availableActions().double, true);
  g.double();                                  // H3 11 → 20
  assert.equal(ids(g.hands[2].cards), '8D 3S 9D');
  assert.equal(g.balance, 9500);
  assert.equal(ids(g.hands[3].cards), '8H 10H');
  const ev = g.stand();                        // H4 18
  assert.deepEqual(dealerDraws(g), ['10S']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => r.payout), [200, 200, 400, 200]);
  assert.equal(s.totalBet, 500); assert.equal(s.payout, 1000); assert.equal(s.net, 500);
  assert.equal(g.balance, 10500);
});

test('T25 split aces: one card each, A+K is 21 not blackjack (pays 1:1), no hit/double', () => {
  const g = game(); start(g, 'A♠ 9♦ A♥ 7♣ K♠ 5♦ 4♣');
  const ev = g.split();
  assert.equal(ids(g.hands[0].cards), 'AS KS');
  assert.equal(ids(g.hands[1].cards), 'AH 5D');
  assert.deepEqual(handValue(g.hands[1].cards), { total: 16, soft: true, bust: false });
  assert.equal(g.hands[0].done, true); assert.equal(g.hands[1].done, true);
  assert.equal(g.snapshot().hands[0].natural, false, 'A+K after split is not a natural');
  assert.ok(!has(ev, 'activeHand') || ev.filter(e => e.type === 'activeHand').every(e => !e.actions.hit && !e.actions.double), 'no hit/double on split aces');
  assert.deepEqual(dealerDraws(g), ['4C']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => [r.outcome, r.payout]), [['win', 200], ['lose', 0]]);
  assert.equal(s.net, 0);
  assert.equal(g.balance, 10000);
});

test('T26 split aces, first hand draws another ace: no resplit; both lose to dealer 21', () => {
  const g = game(); start(g, 'A♠ 6♦ A♥ 10♣ A♦ 9♠ 5♣');
  const ev = g.split();
  assert.equal(ids(g.hands[0].cards), 'AS AD');
  assert.equal(tot(g.hands[0].cards), 12);
  assert.equal(g.availableActions(0).split, false);
  assert.equal(ids(g.hands[1].cards), 'AH 9S');
  assert.deepEqual(dealerDraws(g), ['5C']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => r.outcome), ['lose', 'lose']);
  assert.equal(g.balance, 9800);
});

test('T27 split aces both 21 vs dealer 3-card 21: both push', () => {
  const g = game(); start(g, 'A♠ 7♦ A♥ 4♣ 10♠ 10♦ 10♥');
  const ev = g.split();
  assert.equal(tot(g.hands[0].cards), 21); assert.equal(tot(g.hands[1].cards), 21);
  assert.deepEqual(dealerDraws(g), ['10H']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => r.outcome), ['push', 'push']);
  assert.equal(g.balance, 10000);
});

test('T28 split K/Q; both receive an ace → 21 auto-stand, paid 1:1 each (+200 not +300)', () => {
  const g = game(); start(g, 'K♠ 6♦ Q♥ 10♣ A♠ A♦ 2♣');
  assert.equal(g.availableActions().split, true, 'K and Q are equal value');
  const ev = g.split();
  assert.equal(ev.filter(e => e.type === 'twentyOne').length, 2);
  assert.equal(g.phase, PHASE.SETTLED);
  assert.deepEqual(dealerDraws(g), ['2C']);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => [r.outcome, r.payout]), [['win', 200], ['win', 200]]);
  assert.equal(g.balance, 10200);
});

test('T29 10 up, peek negative → surrender: 50 returned, dealer reveals 19, no draw', () => {
  const g = game(); start(g, '10♠ K♦ 6♥ 9♣');
  assert.equal(g.availableActions().surrender, true);
  const ev = g.surrender();
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'surrender'); assert.equal(s.results[0].payout, 50);
  dealerRevealedNoDraw(g, ev);
  assert.equal(g.balance, 9950);
});

test('T30 A up: decline insurance → peek negative (soft 17) → surrender offered and taken', () => {
  const g = game(); start(g, '10♠ A♦ 6♥ 6♣');
  assert.equal(g.availableActions().surrender, false, 'nothing offered during the insurance phase');
  g.insurance(false);
  assert.equal(g.phase, PHASE.PLAYER);
  assert.equal(g.availableActions().surrender, true);
  g.surrender();
  assert.equal(g.balance, 9950);
});

test('T31 A up: decline insurance → dealer natural: round ends, surrender never available', () => {
  const g = game(); start(g, '10♠ A♦ 6♥ K♣');
  const ev = g.insurance(false);
  noPlayerActionOffered(ev);
  assert.equal(g.phase, PHASE.SETTLED);
  assert.equal(g.availableActions().surrender, false);
  assert.throws(() => g.surrender(), e => e.code === 'phase');
  assert.equal(g.balance, 9900);
});

test('T32 dealer A+6 = soft 17 stands (S17); player 18 wins', () => {
  const g = game(); start(g, '10♠ A♦ 8♥ 6♣');
  g.insurance(false);
  const ev = g.stand();
  assert.equal(g.dealer.cards.length, 2, 'no draw on soft 17');
  assert.deepEqual(settleOf(ev).dealer.value, { total: 17, soft: true, bust: false });
  assert.equal(settleOf(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('T33 dealer soft 13 draws 4 → soft 17 and stands', () => {
  const g = game(); start(g, '10♠ A♦ 8♥ 2♣ 4♠');
  g.insurance(false);
  const ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['4S']);
  assert.deepEqual(settleOf(ev).dealer.value, { total: 17, soft: true, bust: false });
  assert.equal(g.balance, 10100);
});

test('T34 dealer soft 16 hits a 10 → hard 16 → must hit again → 21', () => {
  const g = game(); start(g, '10♠ A♦ K♥ 5♣ 10♦ 5♠');
  g.insurance(false);
  const ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['10D', '5S']);
  assert.equal(settleOf(ev).dealer.value.total, 21);
  assert.equal(settleOf(ev).results[0].outcome, 'lose');
  assert.equal(g.balance, 9900);
});

test('T35 soft 17 (7/17) hits a 10 → hard 17; stand; dealer 20 wins', () => {
  const g = game(); start(g, 'A♠ 10♦ 6♥ Q♣ 10♥');
  assert.deepEqual(handValue(g.hands[0].cards), { total: 17, soft: true, bust: false });
  const ev1 = g.hit();
  assert.deepEqual(ev1[0].value, { total: 17, soft: false, bust: false });
  assert.equal(g.phase, PHASE.PLAYER, '17 is not an auto-stand');
  const ev = g.stand();
  assert.equal(settleOf(ev).dealer.value.total, 20);
  assert.equal(g.balance, 9900);
});

test('T36 hit soft 16 to soft 21 → auto-stand; dealer 17; +100', () => {
  const g = game(); start(g, 'A♠ 7♦ 5♥ 10♣ 5♦');
  const ev = g.hit();
  assert.ok(has(ev, 'twentyOne'));
  assert.equal(g.phase, PHASE.SETTLED, 'no further action after 21');
  assert.equal(settleOf(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('T37 seven-card 21 auto-stands and pays 1:1 (no five-card bonus)', () => {
  const g = game(); start(g, '2♠ 6♦ 2♥ 10♣ 2♦ 2♣ 3♠ A♦ 9♥ 7♠');
  let ev;
  for (let i = 0; i < 5; i++) { assert.equal(g.phase, PHASE.PLAYER); ev = g.hit(); }
  assert.equal(g.hands[0].cards.length, 7);
  assert.equal(tot(g.hands[0].cards), 21);
  assert.ok(has(ev, 'twentyOne'));
  assert.deepEqual(dealerDraws(g), ['7S']);
  assert.equal(settleOf(ev).results[0].payout, 200);
  assert.equal(g.balance, 10100);
});

// T38–T41, T48, T50 are written for 3 boxes; the engine plays exactly one box, so each is
// reduced to the single-box rule it exercises.
test('T38 (single-box form) a standing 12 wins when the dealer busts', () => {
  const g = game(); start(g, '10♠ 6♦ 2♠ 10♣ J♠');
  const ev = g.stand();
  assert.ok(has(ev, 'dealerBust'));
  assert.equal(settleOf(ev).results[0].value, 12);
  assert.equal(settleOf(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('T39 (single-box form) balance timeline: bust settles at once, then a natural pays 3:2 at its turn', () => {
  const g = game();
  start(g, '10♠ A♦ 6♥ 9♣ 9♠');       // dealer A up: insurance offered
  assert.equal(g.balance, 9900);
  g.insurance(false);
  const ev = g.hit();                 // 16 + 9 → bust
  assert.equal(settleOf(ev).balance, 9900, 'bust: nothing returned');
  assert.equal(g.balance, 9900);
  g.nextRound();
  start(g, 'A♠ 9♦ K♥ 8♣');            // natural vs 9 up: no peek, paid immediately
  assert.equal(g.balance, 9900 - 100 + 250);
});

test('T40 (single-box form) insurance taken vs dealer natural nets zero; declined loses the bet', () => {
  const g = game(); start(g, '10♠ A♣ 9♦ K♥');
  g.insurance(true);
  assert.equal(g.balance, 10000);
  g.nextRound();
  start(g, '10♠ A♣ 9♦ K♥');
  g.insurance(false);
  assert.equal(g.balance, 9900);
});

test('T41 (single-box form) even money paid immediately; a later hand vs soft 18 wins', () => {
  const g = game(); start(g, 'A♠ A♦ K♣ 7♠');
  g.insurance(true);
  assert.equal(g.balance, 10100);
  g.nextRound();
  start(g, '10♠ A♦ 9♣ 7♠');
  g.insurance(false);
  g.stand();
  assert.equal(g.dealer.cards.length, 2);
  assert.equal(g.balance, 10200);
});

test('T42 empty box: deal refused (min), allowed after a 10 kr. chip, refused again after undo', () => {
  const g = game();
  assert.deepEqual(g.canDeal(), { ok: false, reason: 'min' });
  assert.throws(() => g.deal(), e => e.code === 'min');
  g.addChip(10);
  assert.equal(g.canDeal().ok, true);
  g.removeLastChip();
  assert.equal(g.bet, 0);
  assert.deepEqual(g.canDeal(), { ok: false, reason: 'min' });
  assert.deepEqual(g.removeLastChip(), [], 'undo on an empty box is a no-op');
});

test('T43 five 1 000-chips = table max; sixth chip refused; natural pays +7 500; dealer 14 does not draw', () => {
  const g = game({ balance: 20000 });
  for (let i = 0; i < 5; i++) g.addChip(1000);
  assert.equal(g.bet, 5000);
  assert.deepEqual(g.canAddChip(1000), { ok: false, reason: 'max' });
  assert.deepEqual(g.canAddChip(10), { ok: false, reason: 'max' });
  assert.throws(() => g.addChip(10), e => e.code === 'max');
  assert.equal(g.bet, 5000, 'refused chip did not change the bet');
  g.shoe.rig('A♠ 5♦ K♥ 9♣');
  const ev = g.deal();
  assert.equal(settleOf(ev).results[0].payout, 12500);
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 14);
  assert.equal(g.balance, 20000 + 7500);
});

test('T43b same with the documented 10 000 balance: balance 17 500', () => {
  const g = game();
  for (let i = 0; i < 5; i++) g.addChip(1000);
  g.shoe.rig('A♠ 5♦ K♥ 9♣'); g.deal();
  assert.equal(g.balance, 17500);
});

test('T44 balance 150: +100 chip refused (balance), 150 accepted, balance 0 during play, 20 v 19 → 300', () => {
  const g = game({ balance: 150 });
  g.addChip(100);
  assert.deepEqual(g.canAddChip(100), { ok: false, reason: 'balance' });
  assert.throws(() => g.addChip(100), e => e.code === 'balance');
  g.addChip(50);
  assert.equal(g.bet, 150);
  g.shoe.rig('10♠ 9♦ K♥ 10♣'); g.deal();
  assert.equal(g.balance, 0);
  const a = g.availableActions();
  assert.equal(a.hit, true); assert.equal(a.stand, true); assert.equal(a.double, false);
  const ev = g.stand();
  assert.equal(settleOf(ev).dealer.value.total, 19);
  assert.equal(g.balance, 300);
});

test('T45 balance 50 with bet 100: split and double disabled; hit to 21 auto-stands; dealer busts', () => {
  const g = game({ balance: 150 }); start(g, '8♠ 6♦ 8♥ 10♣ 5♠ 9♦');
  const a = g.availableActions();
  assert.equal(a.split, false); assert.equal(a.double, false); assert.equal(a.hit, true);
  assert.throws(() => g.split(), e => e.code === 'notAllowed');
  assert.throws(() => g.double(), e => e.code === 'notAllowed');
  assert.equal(g.balance, 50, 'refused actions did not touch the balance');
  const ev = g.hit();
  assert.ok(has(ev, 'twentyOne'));
  assert.deepEqual(dealerDraws(g), ['9D']);
  assert.equal(g.balance, 250);
});

/** Put cards into the real shoe array at the current index (rig() bypasses the cut-card counter). */
function plantAt(g, index, str) {
  const cards = parseCards(str);
  g.shoe.index = index;
  g.shoe.cards.splice(index, cards.length, ...cards);
}

test('T46 cut card passed during the deal: round completes on the old shoe, reshuffle before the next deal', () => {
  const g = game({ rules: { burnCard: false } });
  assert.equal(g.shoe.cutIndex, 234);
  plantAt(g, 232, '10♠ 7♦ 9♥ 10♣');
  const shuffles = g.shoe.shuffles;
  g.addChip(100);
  let ev = g.deal();
  assert.ok(!has(ev, 'shuffle'), 'no shuffle at 232');
  assert.deepEqual(g.hands[0].cards.map(c => c.id), ['10S', '9H']);
  assert.equal(g.shoe.index, 236);
  assert.equal(g.shoe.pastCutCard, true);
  ev = g.stand();
  assert.equal(g.shoe.shuffles, shuffles, 'no reshuffle mid-round');
  assert.equal(settleOf(ev).dealer.value.total, 17);
  assert.equal(g.balance, 10100);
  ev = g.nextRound();
  assert.equal(ev[0].shuffleNext, true, 'engine signals the reshuffle after settlement');
  g.addChip(100);
  ev = g.deal();
  assert.equal(ev[0].type, 'shuffle', 'reshuffle happens before the next deal');
  assert.equal(g.shoe.shuffles, shuffles + 1);
  assert.equal(g.shoe.total, 312);
  assert.equal(g.shoe.index, 4, 'new shoe: 4 cards dealt, no burn in test mode');
  assert.equal(g.shoe.remaining, 308);
});

test('T46b production shoe burns one card after the reshuffle', () => {
  const g = game();
  assert.equal(g.shoe.remaining, 311);
  plantAt(g, 233, '10♠ 7♦ 9♥ 10♣');
  g.addChip(100); g.deal(); g.stand(); g.nextRound();
  g.addChip(100); const ev = g.deal();
  assert.equal(ev[0].type, 'shuffle');
  assert.equal(g.shoe.index, 5, '1 burn + 4 dealt');
});

test('T47 cut card passed on the 2nd card of a split/double round: all 8 cards from the old shoe, reshuffle only after', () => {
  const g = game({ rules: { burnCard: false } });
  plantAt(g, 233, '8♠ 6♦ 8♥ 10♣ 10♠ 3♦ 8♦ 9♣');
  const shuffles = g.shoe.shuffles;
  g.addChip(100); g.deal();
  assert.equal(g.shoe.pastCutCard, true);
  g.split(); g.stand(); const ev = g.double();
  assert.equal(g.shoe.shuffles, shuffles, 'no reshuffle during the round');
  assert.deepEqual(g.hands.map(h => ids(h.cards)), ['8S 10S', '8H 3D 8D']);
  assert.deepEqual(g.dealer.cards.map(c => c.id), ['6D', '10C', '9C']);
  assert.equal(settleOf(ev).net, 300);
  assert.equal(g.shoe.index, 241);
  assert.equal(g.nextRound()[0].shuffleNext, true);
  g.addChip(100);
  assert.equal(g.deal()[0].type, 'shuffle');
});

test('T48 (single-box form) natural vs 10 up is paid before any dealer draw', () => {
  const g = game(); const ev = start(g, 'A♠ 10♦ K♥ 4♦ 10♥');
  assert.equal(settleOf(ev).results[0].outcome, 'blackjack');
  dealerRevealedNoDraw(g, ev);
  assert.equal(g.balance, 10150);
});

test('T49 natural vs 10 up: peek negative → 3:2 at once, dealer reveals 16 and does not draw', () => {
  const g = game(); const ev = start(g, 'A♠ 10♦ K♥ 6♣');
  assert.equal(ev.find(e => e.type === 'peek').blackjack, false);
  noPlayerActionOffered(ev);
  assert.equal(settleOf(ev).results[0].payout, 250);
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 16);
  assert.equal(g.balance, 10150);
});

test('T50 (single-box form) surrender vs 2 up: dealer reveals 12 and does NOT draw', () => {
  const g = game(); start(g, '10♠ 2♣ 6♠ K♥ 9♣');
  const ev = g.surrender();
  dealerRevealedNoDraw(g, ev);
  assert.equal(tot(g.dealer.cards), 12);
  assert.equal(g.balance, 9950);
});

test('T50b (single-box form) bust vs 2 up: dealer reveals 12 and does NOT draw', () => {
  const g = game(); start(g, '10♠ 2♣ 6♠ K♥ 9♣');
  const ev = g.hit();
  assert.ok(has(ev, 'bust'));
  dealerRevealedNoDraw(g, ev);
  assert.equal(g.balance, 9900);
});

test('T51 insurance taken, peek negative (insurance lost), hit → bust: net −150, dealer does not draw', () => {
  const g = game(); start(g, '10♠ A♦ 6♥ 5♣ 9♠');
  let ev = g.insurance(true);
  assert.equal(g.balance, 9850);
  assert.ok(has(ev, 'insuranceLost'));
  ev = g.hit();
  assert.ok(has(ev, 'bust'));
  dealerRevealedNoDraw(g, ev);
  const s = settleOf(ev);
  assert.equal(s.results[0].outcome, 'bust');
  assert.equal(s.insurance.outcome, 'lose');
  assert.equal(s.net, -150);
  assert.equal(g.balance, 9850);
});

test('T52 split 9s; H1 double → 21; H2 hit → bust; dealer 17; net +100', () => {
  const g = game(); start(g, '9♠ 8♦ 9♥ 9♣ 2♦ 10♣ 5♠ 10♦');
  g.split();
  assert.equal(ids(g.hands[0].cards), '9S 2D');
  g.double();
  assert.equal(ids(g.hands[0].cards), '9S 2D 10C');
  assert.equal(g.balance, 9700);
  assert.equal(g.activeHand, 1);
  assert.equal(ids(g.hands[1].cards), '9H 5S');
  const ev = g.hit();
  assert.ok(has(ev, 'bust'));
  assert.equal(g.dealer.cards.length, 2);
  const s = settleOf(ev);
  assert.deepEqual(s.results.map(r => [r.outcome, r.payout]), [['win', 400], ['bust', 0]]);
  assert.equal(s.net, 100);
  assert.equal(g.balance, 10100);
});

/* ----------------------------------------------------------------------------
   Extra engine probes (things the 52 scenarios do not reach)
   ---------------------------------------------------------------------------- */
test('split: first hand busts, second hand still plays and is settled on its own', () => {
  const g = game(); start(g, '8♠ 6♦ 8♥ 10♣ 10♠ 9♦ 5♦ 7♣ 2♠');
  g.split();
  let ev = g.hit();                                   // 8+10+9 bust
  assert.ok(has(ev, 'bust'));
  assert.equal(g.phase, PHASE.PLAYER); assert.equal(g.activeHand, 1);
  assert.equal(ids(g.hands[1].cards), '8H 5D');
  g.hit();                                            // 20
  ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['2S']);           // 16 → 18
  assert.deepEqual(settleOf(ev).results.map(r => r.outcome), ['bust', 'win']);
  assert.equal(g.balance, 10000);
});

test('split: both hands bust → dealer reveals and does not draw', () => {
  const g = game(); start(g, '8♠ 6♦ 8♥ 10♣ 10♠ 9♦ 10♦ 5♦');
  g.split(); g.hit();
  const ev = g.hit();
  dealerRevealedNoDraw(g, ev);
  assert.equal(g.balance, 9800);
});

test('money gating: split allowed with balance == bet, then nothing else affordable', () => {
  const g = game({ balance: 200 }); start(g, '8♠ 6♦ 8♥ 10♣ 3♠ 10♦ 9♦');
  assert.equal(g.availableActions().split, true);
  g.split();
  assert.equal(g.balance, 0);
  const a = g.availableActions();
  assert.equal(a.double, false); assert.equal(a.split, false); assert.equal(a.hit, true);
});

test('money gating: double allowed with balance == bet', () => {
  const g = game({ balance: 200 }); start(g, '6♠ 6♦ 5♥ 10♣ 9♠ 10♦');
  assert.equal(g.availableActions().double, true);
  const ev = g.double();
  assert.equal(ev.find(e => e.type === 'double').balance, 0);
  assert.equal(settleOf(ev).results[0].outcome, 'win');   // 20 v 19
  assert.equal(g.balance, 400);
});

test('phase guards: double deal, insurance outside the insurance phase, nextRound before settlement, reset mid-round', () => {
  const g = game(); start(g, '10♠ 6♦ 5♥ 10♣ 9♠');
  assert.throws(() => g.deal(), e => e.code === 'phase');
  assert.throws(() => g.insurance(true), e => e.code === 'phase');
  assert.throws(() => g.nextRound(), e => e.code === 'phase');
  assert.throws(() => g.resetBalance(), e => e.code === 'phase');
  assert.throws(() => g.addChip(10), e => e.code === 'phase');
  assert.throws(() => g.removeLastChip(), e => e.code === 'phase');
  g.stand();
  assert.throws(() => g.hit(), e => e.code === 'phase');
  assert.throws(() => g.deal(), e => e.code === 'phase');
});

test('insurance cannot be taken twice or after the peek', () => {
  const g = game(); start(g, '9♠ A♦ 10♥ 7♣');
  g.insurance(true);
  assert.throws(() => g.insurance(true), e => e.code === 'phase');
  assert.equal(g.insuranceBet, 50);
  assert.equal(g.balance, 9850);
});

test('rule variants: H17, doubleOn 9-11 / 10-11, no DAS, no surrender, maxSplits 1, hit split aces', () => {
  let g = game({ rules: { dealerHitsSoft17: true } }); start(g, '10♠ A♦ 8♥ 6♣ 4♠'); g.insurance(false);
  let ev = g.stand();
  assert.deepEqual(dealerDraws(g), ['4S']); assert.equal(settleOf(ev).dealer.value.total, 21);

  g = game({ rules: { doubleOn: '9-11' } }); start(g, 'A♠ 6♦ 8♥ 10♣');
  assert.equal(g.availableActions().double, false, 'soft 19 is not 9-11');
  g = game({ rules: { doubleOn: '9-11' } }); start(g, '5♠ 6♦ 4♥ 10♣');
  assert.equal(g.availableActions().double, true);
  g = game({ rules: { doubleOn: '10-11' } }); start(g, '5♠ 6♦ 4♥ 10♣');
  assert.equal(g.availableActions().double, false);
  g = game({ rules: { doubleOn: '10-11' } }); start(g, '5♠ 6♦ 6♥ 10♣');
  assert.equal(g.availableActions().double, true);

  g = game({ rules: { doubleAfterSplit: false } }); start(g, '8♠ 6♦ 8♥ 10♣ 3♠ 10♦');
  g.split();
  assert.equal(g.availableActions().double, false);

  g = game({ rules: { lateSurrender: false } }); start(g, '10♠ K♦ 6♥ 9♣');
  assert.equal(g.availableActions().surrender, false);

  g = game({ rules: { maxSplits: 1 } }); start(g, '8♠ 6♦ 8♥ 10♣ 8♦ 10♦');
  g.split();
  assert.equal(g.availableActions().split, false);

  g = game({ rules: { hitSplitAces: true } }); start(g, 'A♠ 6♦ A♥ 10♣ 5♦ 3♠');
  g.split();
  assert.equal(g.phase, PHASE.PLAYER);
  assert.equal(g.availableActions().hit, true);
});

/* ----------------------------------------------------------------------------
   Suspected defects — each of these documents a deviation from the rule sheet.
   ---------------------------------------------------------------------------- */
test('DEFECT even money must be offered to a natural vs ace even when balance < bet/2 (it costs nothing)', () => {
  const g = game({ balance: 140 });            // bet 100 → balance 40 < 50
  const ev = start(g, 'A♠ A♦ K♥ 5♣');
  assert.equal(ev.at(-1).type, 'evenMoneyOffer', 'even money is a free 1:1 settlement, not gated by insurance funds');
  assert.equal(g.phase, PHASE.INSURANCE);
  assert.equal(g.balance, 40);
});

test('DEFECT rules.resplitAces=true is dead: split aces are auto-stood before a resplit can be offered', () => {
  const g = game({ rules: { resplitAces: true } }); start(g, 'A♠ 6♦ A♥ 10♣ A♦ 9♠ 5♣');
  g.split();
  assert.equal(ids(g.hands[0].cards), 'AS AD');
  assert.equal(g.phase, PHASE.PLAYER, 'hand A-A should be active so the player can resplit');
  assert.equal(g.availableActions(0).split, true);
});

test('DEFECT stats.wagered omits the insurance stake although totalBet/net include it', () => {
  const g = game(); start(g, '9♠ A♦ 10♥ K♣');
  g.insurance(true);
  assert.equal(g.history[0].totalBet, 150);
  assert.equal(g.stats.wagered, 150);
});

test('DEFECT stats.blackjacks does not count a natural that pushes or takes even money', () => {
  let g = game(); start(g, 'A♠ K♦ Q♥ A♣');     // natural vs natural → push
  assert.equal(g.stats.blackjacks, 1);
  g = game(); start(g, 'A♠ A♦ K♥ 10♣'); g.insurance(true);
  assert.equal(g.stats.blackjacks, 1);
});

test('DEFECT basicStrategy is labelled S17 but plays three H17 cells (11 v A, A7 v 2, A8 v 6)', () => {
  const A = { hit: true, stand: true, double: true, split: true, surrender: true };
  const up = r => parseCards(r + '♣')[0];
  assert.equal(BJ.basicStrategy(parseCards('6♠ 5♦'), up('A'), A), 'hit', 'hard 11 v A: hit under S17');
  assert.equal(BJ.basicStrategy(parseCards('A♠ 7♦'), up('2'), A), 'stand', 'soft 18 v 2: stand under S17');
  assert.equal(BJ.basicStrategy(parseCards('A♠ 8♦'), up('6'), A), 'stand', 'soft 19 v 6: stand under S17');
});

/* ----------------------------------------------------------------------------
   Property test: 20 000 random rounds, random legal actions, independent oracle.
   ---------------------------------------------------------------------------- */
test('property: 20 000 random rounds keep every money/dealer/hand invariant', () => {
  const rnd = BJ.mulberry32(parseInt(process.env.BJ_SEED || '20260902', 10));
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const g = new Game({ seed: 99, balance: 10000 });
  const CHIPS = g.rules.chips;

  // Shoe watchdog: count copies of each card between shuffles and record every drawn card.
  const counts = new Map(); let shufflesSeen = g.shoe.shuffles; let drawn = [];
  const rawDraw = g.shoe.draw.bind(g.shoe);
  g.shoe.draw = function () {
    const c = rawDraw();
    if (g.shoe.shuffles !== shufflesSeen) { shufflesSeen = g.shoe.shuffles; counts.clear(); }
    counts.set(c.id, (counts.get(c.id) || 0) + 1);
    assert.ok(counts.get(c.id) <= 6, `7th copy of ${c.id} dealt between shuffles`);
    drawn.push(c);
    return c;
  };

  let rounds = 0, insuranceTaken = 0, evenMoneys = 0, splits = 0, doubles = 0, surrenders = 0, fourHands = 0, illegalTried = 0;
  const seen = new Set();
  while (rounds < 20000) {
    if (g.balance < g.rules.minBet) g.resetBalance();
    // random staged bet
    const nChips = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < nChips; i++) { const c = pick(CHIPS); if (g.canAddChip(c).ok) g.addChip(c); }
    if (g.bet < g.rules.minBet) { g.clearBet(); g.addChip(10); }
    const staged = g.bet;
    const balBefore = g.balance;
    let spent = staged, insurance = 0;
    drawn = [];
    let ev = g.deal();
    {
      const s0 = settleOf(ev);   // a natural (or dealer natural with 10 up) settles inside deal()
      assert.equal(g.balance, balBefore - staged + (s0 ? s0.payout : 0), 'deal deducts exactly the stake');
    }
    const up = g.dealer.cards[0];
    const p0 = g.hands[0].cards.slice();
    const playerNatural = p0.length === 2 && tot(p0) === 21;
    const dealerNatural = tot(g.dealer.cards) === 21;

    // insurance phase invariants
    if (g.phase === PHASE.INSURANCE) {
      assert.equal(up.rank, 'A', 'insurance only on an ace');
      assert.ok(playerNatural || g.balance >= staged / 2, 'insurance only when affordable (even money is free)');
      const offer = ev.at(-1);
      assert.equal(offer.type, playerNatural ? 'evenMoneyOffer' : 'insuranceOffer');
      assert.equal(offer.cost, staged / 2);
      const take = rnd() < 0.4;
      ev = g.insurance(take);
      if (take && playerNatural) { evenMoneys++; assert.equal(g.evenMoney, true); assert.equal(g.insuranceBet, 0); }
      else if (take) {
        insuranceTaken++; insurance = staged / 2; spent += insurance;
        assert.equal(g.insuranceBet, insurance);
        assert.equal(ev.find(e => e.type === 'insuranceTaken').balance, balBefore - spent, 'insurance deducted at once');
        const s1 = settleOf(ev);   // dealer natural settles inside insurance()
        assert.equal(g.balance, balBefore - spent + (s1 ? s1.payout : 0));
      }
    } else if (up.rank === 'A' && g.rules.insurance) {
      assert.ok(balBefore - staged < staged / 2, 'ace up without an insurance offer only when unaffordable');
    }
    if (up.rank === 'A' || BJ.isTenValue(up.rank)) {
      if (!g.evenMoney) assert.ok(has(ev, 'peek'), 'peek on A/10 up');
    } else {
      assert.ok(!has(ev, 'peek'), 'no peek on 2-9');
      assert.equal(dealerNatural, false);
    }
    if (dealerNatural && !g.evenMoney) {
      assert.equal(g.phase, PHASE.SETTLED, 'dealer natural ends the round at the peek');
      assert.equal(g.hands.length, 1); assert.equal(g.hands[0].cards.length, 2); assert.equal(g.hands[0].bet, staged);
    }
    if (playerNatural) assert.equal(g.phase, PHASE.SETTLED, 'player natural settles before any action');

    // player phase: random legal actions, plus a random illegal attempt that must be a no-op
    let guard = 0;
    const reachedPlayer = g.phase === PHASE.PLAYER;
    while (g.phase === PHASE.PLAYER) {
      assert.ok(++guard < 100);
      const h = g.hands[g.activeHand];
      const a = g.availableActions();
      const v = handValue(h.cards);
      // structural checks on what is offered
      assert.equal(a.stand, true);
      assert.equal(a.hit, !h.splitAces);
      if (a.double) { assert.equal(h.cards.length, 2); assert.ok(g.balance >= h.bet); assert.equal(h.splitAces, false); }
      if (a.split) {
        assert.equal(h.cards.length, 2); assert.ok(g.balance >= h.bet); assert.ok(g.hands.length < 4);
        assert.equal(BJ.cardValue(h.cards[0].rank), BJ.cardValue(h.cards[1].rank)); assert.equal(h.splitAces, false);
      }
      if (a.surrender) { assert.equal(g.hands.length, 1); assert.equal(h.cards.length, 2); assert.equal(h.fromSplit, false); }
      assert.ok(v.total < 21, 'an active hand is never 21 or bust');
      // illegal attempt
      const notAllowed = ['hit', 'stand', 'double', 'split', 'surrender'].filter(k => !a[k]);
      if (notAllowed.length && rnd() < 0.3) {
        const snap = JSON.stringify(g.snapshot());
        const bal = g.balance;
        assert.throws(() => g[pick(notAllowed)](), e => e instanceof BJ.GameError);
        assert.equal(g.balance, bal);
        assert.equal(JSON.stringify(g.snapshot()), snap, 'illegal action left state untouched');
        illegalTried++;
      }
      const options = [];
      if (a.hit) options.push('hit', 'hit');
      options.push('stand', 'stand');
      if (a.double) options.push('double', 'double');
      if (a.split) options.push('split', 'split', 'split');
      if (a.surrender) options.push('surrender');
      const act = pick(options);
      const balB = g.balance, bet = h.bet, nHands = g.hands.length, active = g.activeHand;
      ev = g[act]();
      const endedWith = ev.find(e => e.type === 'settle');
      const paid = endedWith ? endedWith.payout : 0;
      let cost = 0;
      if (act === 'double') { doubles++; cost = bet; assert.equal(ev[0].balance, balB - bet, 'double stake deducted before the card'); assert.equal(g.hands[active].bet, bet * 2); assert.equal(g.hands[active].cards.length, 3); assert.equal(g.hands[active].done, true); }
      if (act === 'split') { splits++; cost = bet; assert.equal(ev[0].balance, balB - bet, 'split stake deducted at once'); assert.equal(g.hands.length, nHands + 1); assert.ok(g.hands.length <= 4); if (g.hands.length === 4) fourHands++; }
      if (act === 'surrender') surrenders++;
      spent += cost;
      assert.equal(g.balance, balB - cost + paid, `${act}: balance moved only by its stake (and the payout if the round ended)`);
      assert.ok(g.balance >= 0, 'balance never negative');
      if (!endedWith) assert.equal(g.balance, balB - cost);
    }
    assert.equal(g.phase, PHASE.SETTLED);

    // ---- settlement oracle ----
    const settle = ev.find(e => e.type === 'settle');
    assert.ok(settle, 'last event list carries the settle event');
    assert.equal(settle.balance, g.balance, 'settle event balance equals game.balance');
    const dealerCards = g.dealer.cards; const dv = handValue(dealerCards);
    const dBJ = dealerCards.length === 2 && dv.total === 21;
    assert.equal(g.dealer.holeHidden, false, 'hole card always revealed');
    assert.ok(g.hands.length <= 4);
    let sumPayout = 0, sumBet = 0;
    const live = g.hands.some(h => !h.surrendered && !handValue(h.cards).bust);
    g.hands.forEach((h, i) => {
      const r = settle.results[i];
      const hv = handValue(h.cards);
      const nat = h.cards.length === 2 && hv.total === 21 && !h.fromSplit;
      assert.equal(r.bet, h.bet); assert.equal(r.hand, i); assert.equal(r.value, hv.total);
      if (h.splitAces) { assert.equal(h.cards.length, 2, 'split aces get exactly one card'); assert.equal(h.doubled, false); }
      if (h.doubled) assert.equal(h.cards.length, 3);
      if (h.surrendered) { assert.equal(g.hands.length, 1); assert.equal(h.cards.length, 2); }
      if (reachedPlayer) assert.equal(h.done, true);
      if (hv.total > 21) assert.equal(r.outcome, 'bust');
      // expected payout, derived from the rule sheet
      let exp;
      if (g.evenMoney && nat) exp = 2 * h.bet;
      else if (h.surrendered) exp = h.bet / 2;
      else if (hv.total > 21) exp = 0;
      else if (nat && dBJ) exp = h.bet;
      else if (nat) exp = h.bet + h.bet * 1.5;
      else if (dBJ) exp = 0;
      else if (dv.total > 21 || hv.total > dv.total) exp = 2 * h.bet;
      else if (hv.total === dv.total) exp = h.bet;
      else exp = 0;
      assert.equal(r.payout, exp, `hand ${i} ${ids(h.cards)} v dealer ${ids(dealerCards)}: payout ${r.payout} expected ${exp}`);
      assert.equal(r.net, exp - h.bet);
      if (nat && !h.fromSplit) assert.equal(r.outcome === 'blackjack' || r.outcome === 'push' || r.outcome === 'evenMoney', true);
      if (h.fromSplit && hv.total === 21 && h.cards.length === 2) assert.notEqual(r.outcome, 'blackjack', '21 after split is not a natural');
      sumPayout += r.payout; sumBet += h.bet;
    });
    const insExp = insurance ? (dBJ ? insurance * 3 : 0) : 0;
    if (insurance) { assert.equal(settle.insurance.bet, insurance); assert.equal(settle.insurance.payout, insExp); } else assert.equal(settle.insurance, null);
    assert.equal(settle.payout, sumPayout + insExp, 'payout == sum of hand payouts + insurance');
    assert.equal(settle.totalBet, sumBet + insurance, 'totalBet == sum of hand bets + insurance');
    assert.equal(settle.totalBet, spent, 'everything deducted from the balance is accounted for in totalBet');
    assert.equal(settle.net, settle.payout - settle.totalBet);
    assert.equal(g.balance, balBefore - spent + settle.payout, 'balance conservation');
    assert.equal(g.history[0].net, settle.net);
    // dealer play oracle
    const naturalSettled = g.hands.some(h => h.cards.length === 2 && tot(h.cards) === 21 && !h.fromSplit);
    if (!live || naturalSettled || dBJ) assert.equal(dealerCards.length, 2, 'dealer never draws without a live hand');
    else {
      for (let k = 2; k <= dealerCards.length; k++) {
        const partial = handValue(dealerCards.slice(0, k));
        if (k < dealerCards.length) assert.ok(partial.total < 17, `dealer drew on ${partial.total} (${ids(dealerCards)})`);
        else assert.ok(partial.total >= 17, 'dealer stopped below 17');
      }
    }
    // every card that left the shoe is on the table exactly once
    const onTable = [...g.hands.flatMap(h => h.cards), ...dealerCards];
    assert.equal(onTable.length, drawn.length, 'cards drawn == cards on the table');
    assert.deepEqual(onTable.map(c => c.id).sort(), drawn.map(c => c.id).sort());
    seen.add(g.hands.length + (g.evenMoney ? 'e' : '') + (insurance ? 'i' : ''));
    rounds++;
    ev = g.nextRound();
    assert.equal(ev[0].type, 'roundEnd'); assert.equal(g.phase, PHASE.BETTING); assert.equal(g.hands.length, 0);
  }
  assert.ok(g.balance >= 0);
  assert.ok(insuranceTaken > 100 && evenMoneys > 5 && splits > 300 && doubles > 500 && surrenders > 100 && fourHands > 0 && illegalTried > 1000,
    `coverage: ins ${insuranceTaken} em ${evenMoneys} splits ${splits} doubles ${doubles} surr ${surrenders} fourHands ${fourHands} illegal ${illegalTried}`);
});
