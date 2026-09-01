import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BJ = require('../src/engine.js');
const { Game, Shoe, handValue, parseCards } = BJ;

/** Game with a rigged shoe: `top` is dealt in order P, D, P, D, then hits. */
function rigged(top, opts = {}) {
  const g = new Game({ seed: 42, ...opts });
  g.shoe.rig(top);
  return g;
}
function play(g, bet, top, actions = []) {
  g.shoe.rig(top);
  g.addChip(bet);
  let ev = g.deal();
  for (const a of actions) ev = ev.concat(typeof a === 'string' ? g[a]() : g.insurance(a.insurance));
  return ev;
}
const types = ev => ev.map(e => e.type);
const settle = ev => ev.find(e => e.type === 'settle');

test('hand values: soft/hard/bust', () => {
  assert.deepEqual(handValue(parseCards('A♠ 6♦')), { total: 17, soft: true, bust: false });
  assert.deepEqual(handValue(parseCards('A♠ 6♦ 10♣')), { total: 17, soft: false, bust: false });
  assert.deepEqual(handValue(parseCards('A♠ A♦')), { total: 12, soft: true, bust: false });
  assert.deepEqual(handValue(parseCards('A♠ A♦ A♣ 8♥')), { total: 21, soft: true, bust: false });
  assert.deepEqual(handValue(parseCards('K♠ 6♦ 9♣')), { total: 25, soft: false, bust: true });
  assert.equal(handValue(parseCards('5♠ 5♦ 5♣ 5♥ A♠')).total, 21);
});

test('shoe has 6×52 cards, shuffles and reports cut card', () => {
  const s = new Shoe(6, { seed: 1 });
  assert.equal(s.total, 312);
  const seen = new Set();
  for (let i = 0; i < 312; i++) seen.add(s.draw().id + i % 6);
  assert.equal(s.cutIndex, 234);
  assert.equal(s.pastCutCard, true);
});

test('natural blackjack pays 3:2 and settles immediately', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, 'A♠ 9♦ K♣ 7♥');
  assert.ok(types(ev).includes('settle'));
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'blackjack');
  assert.equal(s.results[0].payout, 250);
  assert.equal(g.balance, 10150);
  assert.equal(g.phase, 'settled');
});

test('blackjack with 25 kr bet pays 37,50', () => {
  const g = new Game({ seed: 1 });
  play(g, 25, 'A♠ 9♦ K♣ 7♥');
  assert.equal(g.balance, 10037.5);
});

test('player natural vs dealer natural is a push (dealer 10 up peeks)', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, 'A♠ K♦ J♣ A♥');
  assert.ok(types(ev).includes('peek'));
  assert.equal(settle(ev).results[0].outcome, 'push');
  assert.equal(g.balance, 10000);
});

test('dealer natural with 10 up beats player 20 immediately', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, 'Q♠ K♦ J♣ A♥');
  assert.equal(settle(ev).results[0].outcome, 'lose');
  assert.equal(g.balance, 9900);
  assert.equal(g.dealer.holeHidden, false);
});

test('dealer ace up offers insurance; taking it and dealer has BJ pays 2:1', () => {
  const g = new Game({ seed: 1 });
  let ev = play(g, 100, '9♠ A♦ 8♣ K♥');
  assert.equal(ev.at(-1).type, 'insuranceOffer');
  assert.equal(ev.at(-1).cost, 50);
  assert.equal(g.phase, 'insurance');
  ev = g.insurance(true);
  assert.equal(g.insuranceBet, 50);
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'lose');
  assert.equal(s.insurance.outcome, 'win');
  assert.equal(s.insurance.payout, 150);
  assert.equal(g.balance, 10000); // lost 100, won 100 net on insurance
});

test('insurance lost when dealer has no BJ, play continues', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, '9♠ A♦ 8♣ 7♥ 4♠');
  const ev = g.insurance(true);
  assert.ok(types(ev).includes('insuranceLost'));
  assert.equal(g.phase, 'player');
  assert.equal(g.balance, 9850);
  const ev2 = g.hit(); // 17 + 4 = 21
  assert.ok(types(ev2).includes('twentyOne'));
  const s = settle(ev2);
  assert.equal(s.results[0].outcome, 'win');
  assert.equal(g.balance, 10050);
});

test('declining insurance with player BJ vs dealer ace: no dealer BJ pays 3:2', () => {
  const g = new Game({ seed: 1 });
  let ev = play(g, 100, 'A♠ A♦ K♣ 9♥');
  assert.equal(ev.at(-1).type, 'evenMoneyOffer');
  ev = g.insurance(false);
  assert.equal(settle(ev).results[0].outcome, 'blackjack');
  assert.equal(g.balance, 10150);
});

test('even money pays 1:1 regardless of dealer BJ', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, 'A♠ A♦ K♣ K♥');
  const ev = g.insurance(true);
  assert.equal(settle(ev).results[0].outcome, 'evenMoney');
  assert.equal(g.balance, 10100);
});

test('insurance not offered when balance cannot cover it', () => {
  const g = new Game({ seed: 1, balance: 100 });
  const ev = play(g, 100, '9♠ A♦ 8♣ 7♥');
  assert.equal(g.phase, 'player');
  assert.ok(!types(ev).includes('insuranceOffer'));
});

test('hit, bust loses bet', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '10♠ 7♦ 6♣ 9♥ 8♠', ['hit']);
  assert.ok(types(ev).includes('bust'));
  assert.equal(settle(ev).results[0].outcome, 'bust');
  assert.equal(g.balance, 9900);
  // dealer does not draw when every hand is bust, but reveals the hole card
  assert.ok(types(ev).includes('reveal'));
  assert.ok(!types(ev).includes('dealerCard'));
});

test('stand: dealer draws to 17 and stands on soft 17 (S17)', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '10♠ 6♦ 8♣ A♥ 9♠', ['stand']);
  // dealer 6+A = soft 17 → stands
  assert.equal(settle(ev).dealer.value.total, 17);
  assert.equal(settle(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10100);
});

test('H17 variant: dealer hits soft 17', () => {
  const g = new Game({ seed: 1, rules: { dealerHitsSoft17: true } });
  const ev = play(g, 100, '10♠ 6♦ 8♣ A♥ 4♠', ['stand']);
  assert.equal(settle(ev).dealer.value.total, 21);
  assert.equal(settle(ev).results[0].outcome, 'lose');
});

test('dealer busts → win', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '10♠ 6♦ 8♣ 10♥ 9♠', ['stand']);
  assert.ok(types(ev).includes('dealerBust'));
  assert.equal(g.balance, 10100);
});

test('push on equal totals', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '10♠ 10♦ 8♣ 8♥', ['stand']);
  assert.equal(settle(ev).results[0].outcome, 'push');
  assert.equal(g.balance, 10000);
});

test('double: one card, bet doubled, win pays 2x doubled bet', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '6♠ 10♦ 5♣ 7♥ 10♠', ['double']);
  assert.equal(g.hands[0].bet, 200);
  assert.equal(settle(ev).results[0].outcome, 'win');
  assert.equal(g.balance, 10200);
});

test('double then bust loses doubled bet', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '6♠ 10♦ 6♣ 7♥ 10♠', ['double']);
  assert.ok(types(ev).includes('bust'));
  assert.equal(g.balance, 9800);
});

test('double not available with insufficient balance, or after third card', () => {
  const g = new Game({ seed: 1, balance: 150 });
  play(g, 100, '6♠ 10♦ 5♣ 7♥ 2♠');
  assert.equal(g.availableActions().double, false);
  g.hit();
  assert.equal(g.availableActions().double, false);
});

test('split: two hands, each gets a card, both play, settle separately', () => {
  const g = new Game({ seed: 1 });
  let ev = play(g, 100, '8♠ 10♦ 8♣ 7♥ 10♠ 3♣ 8♦');
  assert.equal(g.availableActions().split, true);
  ev = g.split();
  assert.equal(g.hands.length, 2);
  assert.equal(g.balance, 9800);
  assert.equal(g.hands[0].cards.length, 2); // 8 + 10 = 18
  assert.equal(g.hands[1].cards.length, 2); // 8 + 3 = 11
  assert.equal(g.activeHand, 0);
  ev = g.stand();
  assert.equal(g.activeHand, 1);
  assert.equal(g.availableActions().double, true); // DAS
  ev = g.double(); // 11 + 8 = 19
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'win');  // 18 vs 17
  assert.equal(s.results[1].outcome, 'win');  // 19 vs 17
  assert.equal(s.payout, 200 + 400);
  assert.equal(g.balance, 10300);
});

test('split aces: one card each, 21 is not blackjack', () => {
  const g = new Game({ seed: 1 });
  let ev = play(g, 100, 'A♠ 10♦ A♣ 7♥ K♠ 9♣');
  ev = g.split();
  assert.equal(g.hands[0].done, true);
  assert.equal(g.hands[1].done, true);
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'win');   // A+K = 21 (not natural)
  assert.equal(s.results[0].payout, 200);
  assert.equal(s.results[1].outcome, 'win');   // A+9 = 20 vs 17
  assert.equal(g.balance, 10200);
});

test('split 21 vs dealer blackjack-looking 21 after draw loses (not a natural)', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, 'A♠ 6♦ A♣ 5♥ K♠ K♣ 10♠');
  const ev = g.split(); // hands: A+K, A+K ; dealer 6+5 = 11 → draws 10 = 21
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'push');
  assert.equal(s.results[1].outcome, 'push');
});

test('resplit up to 4 hands, no more', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, '8♠ 10♦ 8♣ 7♥ 8♦ 2♣ 8♥ 3♣ 8♠ 4♦');
  g.split();            // H0: 8♠ 8♦ ; H1: 8♣ 2♣
  assert.equal(g.availableActions().split, true);
  g.split();            // H0: 8♠ 8♥ ; H1: 8♦ 3♣ ; H2: 8♣ 2♣
  assert.equal(g.hands.length, 3);
  g.split();            // H0: 8♠ 8♠ ; H1: 8♥ 4♦ ; ...
  assert.equal(g.hands.length, 4);
  assert.equal(g.availableActions().split, false);
  assert.equal(g.balance, 9600);
});

test('no resplit of aces', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, 'A♠ 10♦ A♣ 7♥ A♦ A♥');
  const ev = g.split();
  assert.equal(g.availableActions(0).split, false);
  assert.equal(g.phase, 'settled');
});

test('ten-value cards of mixed rank can be split', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, 'K♠ 5♦ 10♣ 7♥');
  assert.equal(g.availableActions().split, true);
  const g2 = new Game({ seed: 1, rules: { splitTenValues: false } });
  play(g2, 100, 'K♠ 5♦ 10♣ 7♥');
  assert.equal(g2.availableActions().split, false);
});

test('split hand dealt to 21 auto-stands and moves on', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, '10♠ 6♦ K♣ 7♥ A♠ 5♣ 9♦');
  const ev = g.split(); // H0: 10 A = 21 auto ; H1: K 5 = 15 active
  assert.ok(types(ev).includes('twentyOne'));
  assert.equal(g.activeHand, 1);
  assert.equal(g.hands[0].done, true);
});

test('late surrender returns half the bet, ends round without dealer play', () => {
  const g = new Game({ seed: 1 });
  const ev = play(g, 100, '10♠ 10♦ 6♣ 7♥', ['surrender']);
  const s = settle(ev);
  assert.equal(s.results[0].outcome, 'surrender');
  assert.equal(s.results[0].payout, 50);
  assert.equal(g.balance, 9950);
  assert.ok(!types(ev).includes('dealerCard'));
});

test('surrender not available after hit, after split, or when disabled', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, '10♠ 10♦ 2♣ 7♥ 3♠');
  assert.equal(g.availableActions().surrender, true);
  g.hit();
  assert.equal(g.availableActions().surrender, false);
  const g2 = new Game({ seed: 1 });
  play(g2, 100, '8♠ 10♦ 8♣ 7♥ 2♠ 3♠');
  g2.split();
  assert.equal(g2.availableActions().surrender, false);
  const g3 = new Game({ seed: 1, rules: { lateSurrender: false } });
  play(g3, 100, '10♠ 10♦ 6♣ 7♥');
  assert.equal(g3.availableActions().surrender, false);
});

test('surrender vs dealer ace only after peek shows no blackjack', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, '10♠ A♦ 6♣ K♥');
  const ev = g.insurance(false);
  assert.equal(g.phase, 'settled');
  assert.equal(settle(ev).results[0].outcome, 'lose');
});

test('betting limits: min, max, balance', () => {
  const g = new Game({ seed: 1, balance: 60 });
  assert.equal(g.canDeal().reason, 'min');
  assert.throws(() => g.addChip(100), /balance/);
  g.addChip(50);
  assert.equal(g.canAddChip(25).reason, 'balance');
  assert.equal(g.canDeal().ok, true);
  const g2 = new Game({ seed: 1, balance: 100000 });
  for (let i = 0; i < 5; i++) g2.addChip(1000);
  assert.equal(g2.canAddChip(10).reason, 'max');
});

test('undo, clear, rebet, double bet, max bet', () => {
  const g = new Game({ seed: 1 });
  g.addChip(100); g.addChip(25);
  assert.equal(g.bet, 125);
  g.removeLastChip();
  assert.equal(g.bet, 100);
  g.doubleBet();
  assert.equal(g.bet, 200);
  assert.deepEqual(g.betChips, [100, 100]);
  g.clearBet();
  assert.equal(g.bet, 0);
  assert.throws(() => g.rebet(), /noLastBet/);
  g.maxBet();
  assert.equal(g.bet, 5000);
  g.clearBet(); g.addChip(50);
  g.shoe.rig('10♠ 10♦ 8♣ 8♥'); g.deal(); g.stand();
  g.nextRound();
  g.rebet();
  assert.equal(g.bet, 50);
  assert.deepEqual(g.betChips, [50]);
});

test('actions rejected in wrong phase', () => {
  const g = new Game({ seed: 1 });
  assert.throws(() => g.hit(), /phase/);
  assert.throws(() => g.deal(), /min/);
  g.addChip(100);
  assert.throws(() => g.insurance(true), /phase/);
});

test('shoe reshuffles at cut card before the next deal', () => {
  const g = new Game({ seed: 3 });
  let shuffles = g.shoe.shuffles;
  let rounds = 0;
  while (g.shoe.shuffles === shuffles) {
    g.addChip(10);
    let ev = g.deal();
    while (g.phase === 'insurance') ev = g.insurance(false);
    while (g.phase === 'player') g.stand();
    g.nextRound();
    rounds++;
    if (rounds > 200) break;
  }
  assert.ok(rounds > 10 && rounds < 120, 'reshuffle happened after a realistic number of rounds: ' + rounds);
});

test('balance never negative across a long random session', () => {
  const g = new Game({ seed: 7, balance: 500 });
  for (let r = 0; r < 300 && g.balance >= 10; r++) {
    g.addChip(10);
    let ev = g.deal();
    while (g.phase === 'insurance') g.insurance(r % 2 === 0 && g.balance >= 5);
    while (g.phase === 'player') {
      const a = g.availableActions();
      if (a.split && r % 3 === 0) g.split();
      else if (a.double && r % 2 === 0) g.double();
      else if (handValue(g.hands[g.activeHand].cards).total < 16) g.hit();
      else g.stand();
      assert.ok(g.balance >= 0);
    }
    assert.equal(g.phase, 'settled');
    g.nextRound();
  }
  assert.ok(g.balance >= 0);
});

test('stats and history are recorded', () => {
  const g = new Game({ seed: 1 });
  play(g, 100, 'A♠ 9♦ K♣ 7♥');
  assert.equal(g.stats.rounds, 1);
  assert.equal(g.stats.blackjacks, 1);
  assert.equal(g.stats.net, 150);
  assert.equal(g.history[0].net, 150);
});

test('basic strategy advice is sane', () => {
  const A = { hit: true, stand: true, double: true, split: true, surrender: true };
  assert.equal(BJ.basicStrategy(parseCards('A♠ A♦'), parseCards('6♣')[0], A), 'split');
  assert.equal(BJ.basicStrategy(parseCards('10♠ 6♦'), parseCards('10♣')[0], A), 'surrender');
  assert.equal(BJ.basicStrategy(parseCards('10♠ 6♦'), parseCards('6♣')[0], A), 'stand');
  assert.equal(BJ.basicStrategy(parseCards('5♠ 6♦'), parseCards('K♣')[0], A), 'double');
  assert.equal(BJ.basicStrategy(parseCards('A♠ 7♦'), parseCards('9♣')[0], A), 'hit');
});
