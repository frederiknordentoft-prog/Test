/* ============================================================================
   Blackjack engine — pure rules, no DOM.
   Deterministic, testable, event-driven: every action returns an ordered list
   of events that the UI plays back as animation. Works in Node and browsers.
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BJ = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const SUITS = ['S', 'H', 'D', 'C'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  const DEFAULT_RULES = Object.freeze({
    decks: 6,
    penetration: 0.75,        // cut card at 75 % of the shoe
    dealerHitsSoft17: false,  // S17 — dealer stands on all 17s
    blackjackPays: 1.5,       // 3:2
    insurancePays: 2,         // 2:1
    insurance: true,
    evenMoney: true,
    peek: true,               // hole card, dealer peeks for blackjack on A and 10-value
    doubleOn: 'any',          // 'any' | '9-11' | '10-11'
    doubleAfterSplit: true,
    maxSplits: 3,             // up to 4 hands
    resplitAces: false,
    hitSplitAces: false,
    splitTenValues: true,     // K + 10 may be split
    lateSurrender: true,
    minBet: 10,
    maxBet: 5000,
    chips: [10, 20, 50, 100, 500, 1000],
    burnCard: true,           // one card burned after every shuffle, as at the table
    startBalance: 10000,
  });

  /* ---------- RNG (seedable for tests; crypto-seeded in production) -------- */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function cryptoRandom() {
    const g = typeof globalThis !== 'undefined' ? globalThis : {};
    if (g.crypto && g.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      return function () { g.crypto.getRandomValues(buf); return buf[0] / 4294967296; };
    }
    return Math.random;
  }

  /* ---------- Cards -------------------------------------------------------- */
  function makeCard(rank, suit) { return { rank, suit, id: rank + suit }; }
  function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return parseInt(rank, 10);
  }
  function isTenValue(rank) { return cardValue(rank) === 10; }

  /** Best total; soft = an ace is currently counted as 11. */
  function handValue(cards) {
    let total = 0, aces = 0;
    for (const c of cards) { total += cardValue(c.rank); if (c.rank === 'A') aces++; }
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return { total, soft: aces > 0, bust: total > 21 };
  }
  function isNatural(cards) { return cards.length === 2 && handValue(cards).total === 21; }

  /** Parse "A♠ K♦ 10♥" or "AS KD 10H" into cards (for tests / rigging). */
  function parseCards(str) {
    const map = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C', s: 'S', h: 'H', d: 'D', c: 'C' };
    return str.trim().split(/\s+/).filter(Boolean).map(tok => {
      const suitCh = tok.slice(-1);
      const suit = map[suitCh] || suitCh.toUpperCase();
      const rank = tok.slice(0, -1).toUpperCase();
      if (!RANKS.includes(rank) || !SUITS.includes(suit)) throw new Error('Bad card: ' + tok);
      return makeCard(rank, suit);
    });
  }

  /* ---------- Shoe --------------------------------------------------------- */
  class Shoe {
    constructor(decks, opts = {}) {
      this.decks = decks;
      this.rng = opts.rng || (opts.seed != null ? mulberry32(opts.seed) : cryptoRandom());
      this.penetration = opts.penetration != null ? opts.penetration : 0.75;
      this.burn = !!opts.burn;
      this.cards = [];
      this.index = 0;
      this.cutIndex = 0;
      this.rigged = [];
      this.shuffles = 0;
      this.shuffle();
    }
    shuffle() {
      const cards = [];
      for (let d = 0; d < this.decks; d++)
        for (const s of SUITS) for (const r of RANKS) cards.push(makeCard(r, s));
      for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
      }
      this.cards = cards;
      this.index = this.burn ? 1 : 0;
      this.cutIndex = Math.floor(cards.length * this.penetration);
      this.shuffles++;
    }
    /** Place predetermined cards on top of the shoe (tests). */
    rig(cards) { this.rigged.push(...(typeof cards === 'string' ? parseCards(cards) : cards)); }
    draw() {
      if (this.rigged.length) return this.rigged.shift();
      if (this.index >= this.cards.length) this.shuffle();
      return this.cards[this.index++];
    }
    get pastCutCard() { return this.index >= this.cutIndex; }
    get remaining() { return this.cards.length - this.index; }
    get total() { return this.cards.length; }
  }

  /* ---------- Game --------------------------------------------------------- */
  const PHASE = Object.freeze({
    BETTING: 'betting', INSURANCE: 'insurance', PLAYER: 'player', DEALER: 'dealer', SETTLED: 'settled',
  });

  class GameError extends Error {
    constructor(code, message) { super(message || code); this.code = code; }
  }

  const NO_ACTIONS = Object.freeze({ hit: false, stand: false, double: false, split: false, surrender: false });
  function newHand(bet, extra = {}) {
    return Object.assign({
      cards: [], bet, done: false, doubled: false, surrendered: false,
      fromSplit: false, splitAces: false, result: null, payout: 0, net: 0,
    }, extra);
  }

  class Game {
    constructor(options = {}) {
      this.rules = Object.assign({}, DEFAULT_RULES, options.rules || {});
      this.shoe = options.shoe || new Shoe(this.rules.decks, { seed: options.seed, penetration: this.rules.penetration, burn: this.rules.burnCard });
      this.balance = options.balance != null ? options.balance : this.rules.startBalance;
      this.phase = PHASE.BETTING;
      this.bet = 0;              // staged bet (chips placed, not yet deducted)
      this.betChips = [];        // chip denominations placed, in order (for undo)
      this.lastBet = 0;
      this.lastBetChips = [];
      this.hands = [];
      this.activeHand = -1;
      this.dealer = { cards: [], holeHidden: false };
      this.insuranceBet = 0;
      this.insuranceResult = null;
      this.evenMoney = false;
      this.roundId = 0;
      this.history = [];
      this.stats = options.stats || { rounds: 0, won: 0, lost: 0, pushed: 0, blackjacks: 0, net: 0, biggestWin: 0, streak: 0, bestStreak: 0, wagered: 0 };
      this.pendingShuffle = false;
    }

    /* ----- betting ----- */
    canAddChip(value) {
      if (this.phase !== PHASE.BETTING) return { ok: false, reason: 'phase' };
      if (this.bet + value > this.rules.maxBet) return { ok: false, reason: 'max' };
      if (this.bet + value > this.balance) return { ok: false, reason: 'balance' };
      return { ok: true };
    }
    addChip(value) {
      const c = this.canAddChip(value);
      if (!c.ok) throw new GameError(c.reason);
      this.bet += value; this.betChips.push(value);
      return [{ type: 'bet', bet: this.bet, chip: value }];
    }
    removeLastChip() {
      this._requirePhase(PHASE.BETTING);
      if (!this.betChips.length) return [];
      const chip = this.betChips.pop(); this.bet -= chip;
      return [{ type: 'unbet', bet: this.bet, chip }];
    }
    clearBet() {
      this._requirePhase(PHASE.BETTING);
      this.bet = 0; this.betChips = [];
      return [{ type: 'clearBet', bet: 0 }];
    }
    setBet(amount, chips) {
      this._requirePhase(PHASE.BETTING);
      if (amount > this.rules.maxBet) throw new GameError('max');
      if (amount > this.balance) throw new GameError('balance');
      this.bet = amount; this.betChips = chips ? chips.slice() : decompose(amount, this.rules.chips);
      return [{ type: 'setBet', bet: this.bet, chips: this.betChips.slice() }];
    }
    rebet() {
      this._requirePhase(PHASE.BETTING);
      if (!this.lastBet) throw new GameError('noLastBet');
      return this.setBet(this.lastBet, this.lastBetChips);
    }
    doubleBet() {
      this._requirePhase(PHASE.BETTING);
      if (!this.bet) throw new GameError('noBet');
      const target = this.bet * 2;
      if (target > this.rules.maxBet) throw new GameError('max');
      if (target > this.balance) throw new GameError('balance');
      return this.setBet(target, this.betChips.concat(this.betChips));
    }
    maxBet() {
      this._requirePhase(PHASE.BETTING);
      const amount = Math.min(this.rules.maxBet, this.balance);
      if (amount < this.rules.minBet) throw new GameError('balance');
      return this.setBet(amount);
    }

    /* ----- deal ----- */
    canDeal() {
      if (this.phase !== PHASE.BETTING) return { ok: false, reason: 'phase' };
      if (this.bet < this.rules.minBet) return { ok: false, reason: 'min' };
      if (this.bet > this.rules.maxBet) return { ok: false, reason: 'max' };
      if (this.bet > this.balance) return { ok: false, reason: 'balance' };
      return { ok: true };
    }
    deal() {
      const c = this.canDeal();
      if (!c.ok) throw new GameError(c.reason);
      const ev = [];
      if (this.shoe.pastCutCard) { this.shoe.shuffle(); ev.push({ type: 'shuffle' }); }
      this.roundId++;
      this.lastBet = this.bet; this.lastBetChips = this.betChips.slice();
      this.balance -= this.bet;
      this.stats.wagered += this.bet;
      this.hands = [newHand(this.bet)];
      this.bet = 0; this.betChips = [];   // the stake now lives in the hand
      this.activeHand = 0;
      this.dealer = { cards: [], holeHidden: true };
      this.insuranceBet = 0; this.insuranceResult = null; this.evenMoney = false;
      ev.push({ type: 'roundStart', roundId: this.roundId, bet: this.lastBet, balance: this.balance });

      // Casino order: player, dealer (up), player, dealer (hole)
      const p1 = this._drawTo(this.hands[0]); ev.push({ type: 'deal', to: 'player', hand: 0, card: p1 });
      const d1 = this._drawDealer();          ev.push({ type: 'deal', to: 'dealer', card: d1 });
      const p2 = this._drawTo(this.hands[0]); ev.push({ type: 'deal', to: 'player', hand: 0, card: p2 });
      const d2 = this._drawDealer();          ev.push({ type: 'deal', to: 'dealer', card: d2, faceDown: true });

      const up = this.dealer.cards[0];
      const playerBJ = isNatural(this.hands[0].cards);
      const stake = this.hands[0].bet;
      const canInsure = this.rules.insurance && up.rank === 'A' && this.balance >= stake / 2;

      if (canInsure && this.rules.peek) {
        this.phase = PHASE.INSURANCE;
        ev.push({ type: playerBJ && this.rules.evenMoney ? 'evenMoneyOffer' : 'insuranceOffer', cost: stake / 2, stake });
        return ev;
      }
      return ev.concat(this._afterInsurance(playerBJ));
    }

    /** Insurance / even-money decision. */
    insurance(take) {
      this._requirePhase(PHASE.INSURANCE);
      const ev = [];
      const playerBJ = isNatural(this.hands[0].cards);
      if (take) {
        if (playerBJ && this.rules.evenMoney) {
          // Even money: paid 1:1 immediately regardless of the dealer's hand.
          this.evenMoney = true;
          ev.push({ type: 'evenMoneyTaken' });
          ev.push({ type: 'reveal', card: this.dealer.cards[1] });
          this.dealer.holeHidden = false;
          return ev.concat(this._settle());
        }
        this.insuranceBet = this.hands[0].bet / 2;
        this.balance -= this.insuranceBet;
        ev.push({ type: 'insuranceTaken', amount: this.insuranceBet, balance: this.balance });
      } else {
        ev.push({ type: 'insuranceDeclined' });
      }
      return ev.concat(this._afterInsurance(playerBJ));
    }

    _afterInsurance(playerBJ) {
      const ev = [];
      const up = this.dealer.cards[0];
      const dealerBJ = isNatural(this.dealer.cards);
      const peeks = this.rules.peek && (up.rank === 'A' || isTenValue(up.rank));
      if (peeks) {
        ev.push({ type: 'peek', blackjack: dealerBJ });
        if (dealerBJ) {
          this.dealer.holeHidden = false;
          ev.push({ type: 'reveal', card: this.dealer.cards[1] });
          return ev.concat(this._settle());
        }
        if (this.insuranceBet) {
          this.insuranceResult = 'lose';
          ev.push({ type: 'insuranceLost', amount: this.insuranceBet });
        }
      }
      if (playerBJ) {
        // Natural vs. no dealer natural: paid immediately, dealer reveals.
        this.dealer.holeHidden = false;
        ev.push({ type: 'reveal', card: this.dealer.cards[1] });
        return ev.concat(this._settle());
      }
      this.phase = PHASE.PLAYER;
      this.activeHand = 0;
      ev.push({ type: 'activeHand', hand: 0, actions: this.availableActions() });
      return ev;
    }

    /* ----- player actions ----- */
    availableActions(i = this.activeHand) {
      const none = { hit: false, stand: false, double: false, split: false, surrender: false };
      if (this.phase !== PHASE.PLAYER || i < 0 || i >= this.hands.length) return none;
      const h = this.hands[i];
      if (h.done) return none;
      const v = handValue(h.cards);
      const two = h.cards.length === 2;
      const r = this.rules;
      const canDouble = two && this.balance >= h.bet
        && (!h.fromSplit || r.doubleAfterSplit)
        && (!h.splitAces || r.hitSplitAces)
        && (r.doubleOn === 'any'
          || (r.doubleOn === '9-11' && !v.soft && v.total >= 9 && v.total <= 11)
          || (r.doubleOn === '10-11' && !v.soft && v.total >= 10 && v.total <= 11));
      const sameRank = two && (h.cards[0].rank === h.cards[1].rank
        || (r.splitTenValues && isTenValue(h.cards[0].rank) && isTenValue(h.cards[1].rank)));
      const canSplit = sameRank && this.hands.length < r.maxSplits + 1 && this.balance >= h.bet
        && (!h.splitAces || r.resplitAces);
      const canSurrender = r.lateSurrender && two && this.hands.length === 1 && !h.fromSplit;
      return { hit: !h.splitAces || r.hitSplitAces, stand: true, double: canDouble, split: canSplit, surrender: canSurrender };
    }
    _requireAction(name) {
      if (this.phase !== PHASE.PLAYER) throw new GameError('phase');
      if (!this.availableActions()[name]) throw new GameError('notAllowed', name + ' not allowed');
    }
    hit() {
      this._requireAction('hit');
      const i = this.activeHand, h = this.hands[i];
      const card = this._drawTo(h);
      const ev = [{ type: 'card', hand: i, card, value: handValue(h.cards) }];
      return ev.concat(this._afterCard(i));
    }
    stand() {
      this._requireAction('stand');
      const i = this.activeHand;
      this.hands[i].done = true;
      return [{ type: 'stand', hand: i }].concat(this._advance());
    }
    double() {
      this._requireAction('double');
      const i = this.activeHand, h = this.hands[i];
      this.balance -= h.bet; this.stats.wagered += h.bet;
      h.bet *= 2; h.doubled = true;
      const card = this._drawTo(h);
      h.done = true;
      const v = handValue(h.cards);
      const ev = [{ type: 'double', hand: i, bet: h.bet, balance: this.balance, card, value: v }];
      if (v.bust) ev.push({ type: 'bust', hand: i, value: v });
      return ev.concat(this._advance());
    }
    split() {
      this._requireAction('split');
      const i = this.activeHand, h = this.hands[i];
      this.balance -= h.bet; this.stats.wagered += h.bet;
      const aces = h.cards[0].rank === 'A';
      const moved = h.cards.pop();
      const h2 = newHand(h.bet, { cards: [moved], fromSplit: true, splitAces: aces });
      h.fromSplit = true; h.splitAces = aces;
      this.hands.splice(i + 1, 0, h2);
      const ev = [{ type: 'split', hand: i, newHand: i + 1, balance: this.balance, hands: this.hands.length }];
      // Casino procedure: the first hand gets its second card now and is played out;
      // the new hand receives its card only when it becomes active.
      const c1 = this._drawTo(h); ev.push({ type: 'card', hand: i, card: c1, value: handValue(h.cards) });
      if (aces && !this.rules.hitSplitAces) {
        const c2 = this._drawTo(h2); ev.push({ type: 'card', hand: i + 1, card: c2, value: handValue(h2.cards) });
        h.done = true; h2.done = true;
        return ev.concat(this._advance());
      }
      return ev.concat(this._afterCard(i));
    }
    surrender() {
      this._requireAction('surrender');
      const i = this.activeHand, h = this.hands[i];
      h.surrendered = true; h.done = true;
      const ev = [{ type: 'surrender', hand: i }];
      return ev.concat(this._advance());
    }

    /* ----- internals ----- */
    _afterCard(i) {
      const h = this.hands[i];
      const v = handValue(h.cards);
      if (v.bust) { h.done = true; return [{ type: 'bust', hand: i, value: v }].concat(this._advance()); }
      if (v.total === 21) { h.done = true; return [{ type: 'twentyOne', hand: i }].concat(this._advance()); }
      return [{ type: 'activeHand', hand: i, actions: this.availableActions(i) }];
    }
    _advance() {
      const next = this.hands.findIndex(h => !h.done);
      if (next !== -1) {
        this.activeHand = next;
        const h = this.hands[next];
        const ev = [];
        if (h.cards.length === 1) { // split hand waiting for its second card
          ev.push({ type: 'activeHand', hand: next, actions: NO_ACTIONS });
          const c = this._drawTo(h);
          ev.push({ type: 'card', hand: next, card: c, value: handValue(h.cards) });
        }
        const v = handValue(h.cards);
        if (v.total === 21 && h.cards.length === 2) { // split hand dealt to 21 → stands automatically
          h.done = true;
          return ev.concat([{ type: 'activeHand', hand: next, actions: this.availableActions(next) }, { type: 'twentyOne', hand: next }], this._advance());
        }
        return ev.concat([{ type: 'activeHand', hand: next, actions: this.availableActions(next) }]);
      }
      this.activeHand = -1;
      return this._dealerTurn();
    }
    _dealerTurn() {
      this.phase = PHASE.DEALER;
      const ev = [];
      this.dealer.holeHidden = false;
      ev.push({ type: 'reveal', card: this.dealer.cards[1], value: handValue(this.dealer.cards) });
      const live = this.hands.some(h => !h.surrendered && !handValue(h.cards).bust);
      if (live) {
        for (;;) {
          const v = handValue(this.dealer.cards);
          const mustHit = v.total < 17 || (v.total === 17 && v.soft && this.rules.dealerHitsSoft17);
          if (!mustHit) break;
          const card = this._drawDealer();
          ev.push({ type: 'dealerCard', card, value: handValue(this.dealer.cards) });
        }
        const dv = handValue(this.dealer.cards);
        if (dv.bust) ev.push({ type: 'dealerBust', value: dv });
        else ev.push({ type: 'dealerStand', value: dv });
      }
      return ev.concat(this._settle());
    }
    _settle() {
      this.phase = PHASE.SETTLED;
      const dealerCards = this.dealer.cards;
      const dv = handValue(dealerCards);
      const dealerBJ = isNatural(dealerCards);
      const results = [];
      let payoutTotal = 0;
      this.hands.forEach((h, i) => {
        const v = handValue(h.cards);
        const natural = isNatural(h.cards) && !h.fromSplit;
        let outcome, payout;
        if (this.evenMoney && natural) { outcome = 'evenMoney'; payout = h.bet * 2; }
        else if (h.surrendered) { outcome = 'surrender'; payout = h.bet / 2; }
        else if (v.bust) { outcome = 'bust'; payout = 0; }
        else if (natural && dealerBJ) { outcome = 'push'; payout = h.bet; }
        else if (natural) { outcome = 'blackjack'; payout = h.bet + h.bet * this.rules.blackjackPays; }
        else if (dealerBJ) { outcome = 'lose'; payout = 0; }
        else if (dv.bust) { outcome = 'win'; payout = h.bet * 2; }
        else if (v.total > dv.total) { outcome = 'win'; payout = h.bet * 2; }
        else if (v.total < dv.total) { outcome = 'lose'; payout = 0; }
        else { outcome = 'push'; payout = h.bet; }
        h.result = outcome; h.payout = payout; h.net = payout - h.bet;
        payoutTotal += payout;
        results.push({ hand: i, outcome, bet: h.bet, payout, net: h.net, value: v.total });
      });
      let insurance = null;
      if (this.insuranceBet) {
        if (dealerBJ) {
          const pay = this.insuranceBet * (1 + this.rules.insurancePays);
          this.insuranceResult = 'win';
          insurance = { outcome: 'win', bet: this.insuranceBet, payout: pay, net: pay - this.insuranceBet };
          payoutTotal += pay;
        } else {
          insurance = { outcome: 'lose', bet: this.insuranceBet, payout: 0, net: -this.insuranceBet };
        }
      }
      this.balance += payoutTotal;
      const totalBet = this.hands.reduce((s, h) => s + h.bet, 0) + this.insuranceBet;
      const net = payoutTotal - totalBet;
      // stats
      const s = this.stats;
      s.rounds++;
      s.net += net;
      if (net > 0) { s.won++; s.streak = Math.max(1, s.streak + 1); s.bestStreak = Math.max(s.bestStreak, s.streak); }
      else if (net < 0) { s.lost++; s.streak = Math.min(-1, s.streak - 1); }
      else { s.pushed++; }
      if (net > s.biggestWin) s.biggestWin = net;
      s.blackjacks += results.filter(r => r.outcome === 'blackjack').length;
      const entry = {
        roundId: this.roundId, net, totalBet, payout: payoutTotal,
        outcomes: results.map(r => r.outcome), dealer: dv.total, dealerBJ,
        player: results.map(r => r.value), insurance,
      };
      this.history.unshift(entry);
      if (this.history.length > 50) this.history.length = 50;
      return [{ type: 'settle', results, insurance, payout: payoutTotal, net, totalBet, balance: this.balance, dealer: { value: dv, blackjack: dealerBJ, bust: dv.bust } }];
    }
    nextRound() {
      if (this.phase !== PHASE.SETTLED) throw new GameError('phase');
      this.phase = PHASE.BETTING;
      this.hands = []; this.activeHand = -1;
      this.dealer = { cards: [], holeHidden: false };
      this.bet = 0; this.betChips = [];
      this.insuranceBet = 0; this.insuranceResult = null; this.evenMoney = false;
      return [{ type: 'roundEnd', balance: this.balance, shuffleNext: this.shoe.pastCutCard }];
    }
    resetBalance(amount) {
      if (this.phase !== PHASE.BETTING) throw new GameError('phase');
      this.balance = amount != null ? amount : this.rules.startBalance;
      this.bet = 0; this.betChips = [];
      return [{ type: 'balance', balance: this.balance }];
    }

    _drawTo(hand) { const c = this.shoe.draw(); hand.cards.push(c); return c; }
    _drawDealer() { const c = this.shoe.draw(); this.dealer.cards.push(c); return c; }
    _requirePhase(p) { if (this.phase !== p) throw new GameError('phase', 'phase: expected ' + p + ', got ' + this.phase); }

    /** Snapshot for UI rendering. */
    snapshot() {
      return {
        phase: this.phase, balance: this.balance, bet: this.bet, betChips: this.betChips.slice(), lastBet: this.lastBet,
        hands: this.hands.map(h => ({ ...h, cards: h.cards.slice(), value: handValue(h.cards), natural: isNatural(h.cards) && !h.fromSplit })),
        activeHand: this.activeHand,
        dealer: { cards: this.dealer.cards.slice(), holeHidden: this.dealer.holeHidden, value: this.dealer.holeHidden ? handValue(this.dealer.cards.slice(0, 1)) : handValue(this.dealer.cards) },
        insuranceBet: this.insuranceBet, evenMoney: this.evenMoney,
        shoe: { remaining: this.shoe.remaining, total: this.shoe.total, pastCutCard: this.shoe.pastCutCard, shuffles: this.shoe.shuffles },
        actions: this.availableActions(), rules: this.rules, stats: { ...this.stats }, history: this.history.slice(),
      };
    }
  }

  /** Greedy decomposition of an amount into chip denominations (largest first). */
  function decompose(amount, chips) {
    const out = [];
    let rest = amount;
    const sorted = chips.slice().sort((a, b) => b - a);
    for (const c of sorted) while (rest >= c) { out.push(c); rest -= c; }
    return out;
  }

  /* Basic strategy hint (S17, DAS, 6 decks) — advisory only, never affects outcome. */
  function basicStrategy(playerCards, dealerUp, actions) {
    const v = handValue(playerCards);
    const up = cardValue(dealerUp.rank);
    const two = playerCards.length === 2;
    const pair = two && cardValue(playerCards[0].rank) === cardValue(playerCards[1].rank);
    const D = (alt) => actions.double ? 'double' : alt;
    if (pair && actions.split) {
      const r = playerCards[0].rank;
      if (r === 'A' || r === '8') return 'split';
      if (isTenValue(r)) return 'stand';
      if (r === '9') return (up >= 2 && up <= 9 && up !== 7) ? 'split' : 'stand';
      if (r === '7') return up <= 7 ? 'split' : 'hit';
      if (r === '6') return up <= 6 ? 'split' : 'hit';
      if (r === '5') return up <= 9 ? D('hit') : 'hit';
      if (r === '4') return (up === 5 || up === 6) ? 'split' : 'hit';
      if (r === '3' || r === '2') return up <= 7 ? 'split' : 'hit';
    }
    if (v.soft && v.total <= 21 && playerCards.some(c => c.rank === 'A')) {
      const t = v.total;
      if (t >= 20) return 'stand';
      if (t === 19) return (up === 6 && two) ? D('stand') : 'stand';
      if (t === 18) { if (up <= 6) return two ? D('stand') : 'stand'; if (up <= 8) return 'stand'; return 'hit'; }
      if (t === 17) return (up >= 3 && up <= 6) ? D('hit') : 'hit';
      if (t === 16 || t === 15) return (up >= 4 && up <= 6) ? D('hit') : 'hit';
      return (up === 5 || up === 6) ? D('hit') : 'hit';
    }
    const t = v.total;
    if (t >= 17) return 'stand';
    if (t >= 13) return up <= 6 ? 'stand' : (t === 16 && up >= 9 && actions.surrender ? 'surrender' : (t === 15 && up === 10 && actions.surrender ? 'surrender' : 'hit'));
    if (t === 12) return (up >= 4 && up <= 6) ? 'stand' : 'hit';
    if (t === 11) return D('hit');
    if (t === 10) return up <= 9 ? D('hit') : 'hit';
    if (t === 9) return (up >= 3 && up <= 6) ? D('hit') : 'hit';
    return 'hit';
  }

  return {
    SUITS, RANKS, DEFAULT_RULES, PHASE, Shoe, Game, GameError,
    handValue, isNatural, cardValue, isTenValue, parseCards, makeCard, decompose, basicStrategy, mulberry32,
  };
});
