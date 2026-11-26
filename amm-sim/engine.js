/*
 * LMSR-motor til et binært marked, hvor spillerne handler mod huset.
 *
 *   C(q)    = b·ln(e^(qJA/b) + e^(qNEJ/b))       husets omkostningsfunktion
 *   pris JA = e^(qJA/b) / (e^(qJA/b) + e^(qNEJ/b))
 *   køb af Δ aktier koster C(q+Δ) − C(q); salg giver C(q) − C(q−Δ)
 *
 * b vælges ud fra startkapitalen (husets maks. tab): b = kapital / ln(1/min(p0, 1−p0)).
 * Husets resultat ved udfald o = indbetalt (ekskl. gebyr) + gebyrer − aktier udestående på o.
 * Index 0 = JA, 1 = NEJ.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AMM = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const YES = 0, NO = 1;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // Deterministisk tilfældighed, så en kørsel kan genskabes med samme seed
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function gauss(rng) {
    let u = 0;
    while (u === 0) u = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  }

  class LMSR {
    constructor({ capital, p0, fee }) {
      this.capital = capital;
      this.fee = fee;
      this.b = capital / Math.log(1 / Math.min(p0, 1 - p0));
      this.q = [this.b * Math.log(p0), this.b * Math.log(1 - p0)]; // giver pris p0 og C(q0) = 0
      this.out = [0, 0];   // aktier ejet af spillere
      this.paidIn = 0;     // indbetalt i kurven ekskl. gebyr, minus udbetalt ved salg
      this.fees = 0;
    }
    C(q) {
      const m = Math.max(q[0], q[1]), b = this.b;
      return m + b * Math.log(Math.exp((q[0] - m) / b) + Math.exp((q[1] - m) / b));
    }
    priceOf(q) { return 1 / (1 + Math.exp((q[1] - q[0]) / this.b)); }
    price() { return this.priceOf(this.q); }

    // Køb for et beløb (inkl. gebyr): løs C(q') = C(q) + nettobeløb
    quoteBuy(side, amount) {
      const fee = amount * this.fee, net = amount - fee;
      const c = this.C(this.q) + net, other = this.q[1 - side];
      const qNew = c + this.b * Math.log1p(-Math.exp((other - c) / this.b));
      const q = this.q.slice();
      q[side] = qNew;
      return { shares: qNew - this.q[side], fee, net, newPrice: this.priceOf(q), q };
    }
    quoteSell(side, shares) {
      const q = this.q.slice();
      q[side] -= shares;
      const gross = this.C(this.q) - this.C(q), fee = gross * this.fee;
      return { gross, fee, proceeds: gross - fee, newPrice: this.priceOf(q), q };
    }
    applyBuy(side, r) { this.q = r.q; this.out[side] += r.shares; this.paidIn += r.net; this.fees += r.fee; }
    applySell(side, shares, r) { this.q = r.q; this.out[side] -= shares; this.paidIn -= r.gross; this.fees += r.fee; }
    houseResult(o) { return this.paidIn + this.fees - this.out[o]; }
  }

  // Hvor meget skal købes/sælges for at flytte prisen til target (halvering, prisen er monoton)
  function bisect(f, max) {
    if (!f(max)) return max;
    let lo = 0, hi = max;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (f(m)) hi = m; else lo = m; }
    return hi;
  }
  function amountToReach(m, side, target, maxAmount) {
    const dir = side === YES ? 1 : -1;
    if ((target - m.price()) * dir <= 0 || maxAmount <= 0) return 0;
    return bisect((a) => (m.quoteBuy(side, a).newPrice - target) * dir >= 0, maxAmount);
  }
  function sharesToReach(m, side, target, maxShares) {
    const dir = side === YES ? -1 : 1; // salg af JA sænker prisen
    if ((target - m.price()) * dir <= 0 || maxShares <= 0) return 0;
    return bisect((s) => (m.quoteSell(side, s).newPrice - target) * dir >= 0, maxShares);
  }

  const DEFAULTS = {
    capital: 1000,   // startkapital = husets maks. tab (kr)
    fee: 0.02,
    p0: 0.5,         // åbningspris
    trueP: 0.68,     // sand sandsynlighed for JA
    shockAt: 0,      // handel nr. hvor nyhed ændrer sandheden (0 = fra)
    shockP: 0.3,
    players: 40,
    informedShare: 0.35,
    trades: 600,
    rngSeed: 7,
  };
  const BANKROLL = 1000, YOU_BANKROLL = 10000;

  class Simulation {
    constructor(cfg) {
      const c = (this.cfg = { ...DEFAULTS, ...cfg });
      this.rng = mulberry32(c.rngSeed);
      this.mm = new LMSR(c);
      const nInf = Math.round(c.players * c.informedShare);
      this.players = [];
      for (let i = 0; i < c.players; i++) {
        this.players.push({
          id: i + 1, type: i < nInf ? 'informed' : 'random',
          bias: gauss(this.rng) * 0.06,           // informerede er uenige med hinanden
          aggr: 0.3 + 0.5 * this.rng(),           // hvor langt mod eget skøn de flytter prisen
          cash: BANKROLL, hold: [0, 0],
        });
      }
      this.you = { id: 0, type: 'you', cash: YOU_BANKROLL, hold: [0, 0] };
      this.t = 0;
      this.volume = 0;
      this.log = [];
      this.hist = { truth: [], price: [], ifYes: [], ifNo: [], expected: [] };
      this._record();
    }
    trueP() { return this.cfg.shockAt > 0 && this.t >= this.cfg.shockAt ? this.cfg.shockP : this.cfg.trueP; }

    buy(p, side, amount) {
      amount = Math.min(amount, p.cash);
      if (amount < 0.01) return null;
      const before = this.mm.price(), r = this.mm.quoteBuy(side, amount);
      this.mm.applyBuy(side, r);
      p.cash -= amount;
      p.hold[side] += r.shares;
      this.volume += amount;
      return this._log(p, 'Køb', side, amount, r.shares, before);
    }
    sell(p, side, shares) {
      shares = Math.min(shares, p.hold[side]);
      if (shares < 1e-6) return null;
      const before = this.mm.price(), r = this.mm.quoteSell(side, shares);
      this.mm.applySell(side, shares, r);
      p.cash += r.proceeds;
      p.hold[side] -= shares;
      this.volume += r.gross;
      return this._log(p, 'Sælg', side, r.proceeds, shares, before);
    }
    _log(p, action, side, kr, shares, before) {
      const e = { t: this.t, who: p.type === 'you' ? 'Dig' : `${p.type === 'informed' ? 'Informeret' : 'Tilfældig'} #${p.id}`,
        action, side, kr, shares, before, after: this.mm.price() };
      this.log.push(e);
      if (this.log.length > 200) this.log.shift();
      return e;
    }
    _record() {
      const tp = this.trueP(), y = this.mm.houseResult(YES), n = this.mm.houseResult(NO);
      this.hist.truth.push(tp);
      this.hist.price.push(this.mm.price());
      this.hist.ifYes.push(y);
      this.hist.ifNo.push(n);
      this.hist.expected.push(tp * y + (1 - tp) * n);
    }

    step() {
      this.t++;
      const r = this.rng, p = this.players[Math.floor(r() * this.players.length)];
      const u1 = r(), u2 = r(), u3 = r(), g = gauss(r);
      const price = this.mm.price(), maxStake = Math.min(p.cash, BANKROLL * 0.25);

      if (p.type === 'random') {
        // Tilfældig: køber en tilfældig side for ~40 kr, eller sælger en del af det, den ejer
        if (p.hold[0] + p.hold[1] > 1e-6 && u2 < 0.35) {
          let side = u1 < 0.5 ? YES : NO;
          if (p.hold[side] < 1e-6) side = 1 - side;
          this.sell(p, side, p.hold[side] * (0.25 + 0.75 * u3));
        } else {
          this.buy(p, u1 < 0.5 ? YES : NO, Math.min(maxStake, 40 * -Math.log(1 - u3 * 0.999)));
        }
      } else {
        // Informeret: skøn = sandhed + egen bias + lidt støj. Handler kun hvis kanten slår gebyret.
        const belief = clamp(this.trueP() + p.bias + 0.015 * g, 0.01, 0.99), edge = belief - price;
        if (Math.abs(edge) >= 0.02 + this.mm.fee) {
          const target = price + p.aggr * edge, want = edge > 0 ? YES : NO, opp = 1 - want;
          const s = sharesToReach(this.mm, opp, target, p.hold[opp]); // luk modsat position først
          if (s > 1e-6) this.sell(p, opp, s);
          else {
            const a = amountToReach(this.mm, want, target, maxStake);
            if (a >= 1) this.buy(p, want, a);
          }
        }
      }
      this._record();
    }
    run(n) { for (let i = 0; i < n; i++) this.step(); }

    // Din handel. Køb: beløb i kr. Salg: andel (0–1) af din beholdning på den side.
    manual(action, side, amount) {
      this.t++;
      const r = action === 'buy' ? this.buy(this.you, side, amount) : this.sell(this.you, side, this.you.hold[side] * amount);
      this._record();
      return r;
    }
    quote(action, side, amount) {
      if (action === 'buy') {
        const a = Math.min(amount, this.you.cash);
        return a > 0 ? { ...this.mm.quoteBuy(side, a), amount: a } : null;
      }
      const s = this.you.hold[side] * amount;
      return s > 1e-9 ? { ...this.mm.quoteSell(side, s), shares: s } : null;
    }

    playerResult(p, o) { return p.cash - (p.type === 'you' ? YOU_BANKROLL : BANKROLL) + p.hold[o]; }
    // Forventet resultat pr. gruppe ved den sande sandsynlighed, som hvis markedet lukkede nu
    results() {
      const tp = this.trueP(), ev = (p) => tp * this.playerResult(p, YES) + (1 - tp) * this.playerResult(p, NO);
      const res = { informed: 0, random: 0, you: ev(this.you), house: tp * this.mm.houseResult(YES) + (1 - tp) * this.mm.houseResult(NO) };
      for (const p of this.players) res[p.type] += ev(p);
      return res;
    }
    // Kontrol: spillere + hus = 0 for begge udfald
    zeroSumError() {
      let worst = 0;
      for (const o of [YES, NO]) {
        let s = this.mm.houseResult(o) + this.playerResult(this.you, o);
        for (const p of this.players) s += this.playerResult(p, o);
        worst = Math.max(worst, Math.abs(s));
      }
      return worst;
    }
  }

  // Forventet subsidie når prisen flyttes fra p0 til sandheden p: b·KL(p‖p0)
  function expectedSubsidy(b, p0, p) {
    const kl = (a, q) => (a > 0 ? a * Math.log(a / q) : 0) + (a < 1 ? (1 - a) * Math.log((1 - a) / (1 - q)) : 0);
    return b * kl(p, p0);
  }

  return { YES, NO, LMSR, Simulation, DEFAULTS, amountToReach, sharesToReach, expectedSubsidy };
});
