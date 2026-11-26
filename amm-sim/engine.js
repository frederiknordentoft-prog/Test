/*
 * AMM-motor til binære prediction markets.
 *
 * Tre mekanismer med samme interface:
 *   CPMM  – spiller mod spiller via en fuldt collateraliseret LP-pulje (konstant produkt, FPMM-stil)
 *   LMSR  – mod huset; Hansons logaritmiske market scoring rule (huset er modpart på alt)
 *   Pari  – parimutuel pulje; ren P2P, odds = puljefordeling, intet salg før afgørelse
 *
 * Fælles regnskab (gælder alle tre):
 *   netInflow       penge ind i kurven/puljen ekskl. gebyr, minus penge betalt ud ved salg
 *   fees            gebyrindtægt til operatøren (huset eller LP)
 *   operatorPnL(o)  operatørens resultat hvis udfald o vinder  ==  -(sum af spillernes resultat)
 *
 * Index 0 = JA, 1 = NEJ. Pris = sandsynlighed for JA.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AMM = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const YES = 0, NO = 1;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  // ---------- RNG (deterministisk, så simuleringer kan genskabes) ----------
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

  // =====================================================================
  // LMSR – huset er modpart. C(q) = b·ln(e^(qJA/b) + e^(qNEJ/b)).
  // b vælges så maks. tab = startkapital: b = seed / ln(1/min(p0, 1-p0)).
  // =====================================================================
  class LMSR {
    constructor({ seed, p0, fee }) {
      this.kind = 'lmsr';
      this.fee = fee;
      this.seed = seed;
      this.canSell = true;
      this.b = seed / Math.log(1 / Math.min(p0, 1 - p0));
      // Start-q så prisen er p0 og C(q0) = 0. q0 er fiktiv: ingen spiller ejer den.
      this.q = [this.b * Math.log(p0), this.b * Math.log(1 - p0)];
      this.out = [0, 0]; // aktier ejet af spillere
      this.netInflow = 0;
      this.fees = 0;
    }
    C(q) {
      const m = Math.max(q[0], q[1]), b = this.b;
      return m + b * Math.log(Math.exp((q[0] - m) / b) + Math.exp((q[1] - m) / b));
    }
    priceOf(q) { return 1 / (1 + Math.exp((q[1] - q[0]) / this.b)); }
    price() { return this.priceOf(this.q); }
    quoteBuy(side, gross) {
      const fee = gross * this.fee, net = gross - fee;
      const c = this.C(this.q) + net, other = this.q[1 - side];
      // Løs C(q') = C(q) + net for q'[side]  (numerisk stabil form)
      const qNew = c + this.b * Math.log1p(-Math.exp((other - c) / this.b));
      const q = this.q.slice();
      q[side] = qNew;
      return { shares: qNew - this.q[side], fee, net, newPrice: this.priceOf(q), _s: q };
    }
    quoteSell(side, shares) {
      const q = this.q.slice();
      q[side] -= shares;
      const gross = this.C(this.q) - this.C(q), fee = gross * this.fee;
      return { gross, fee, proceeds: gross - fee, newPrice: this.priceOf(q), _s: q };
    }
    applyBuy(side, r) { this.q = r._s; this.out[side] += r.shares; this.netInflow += r.net; this.fees += r.fee; }
    applySell(side, shares, r) { this.q = r._s; this.out[side] -= shares; this.netInflow -= r.gross; this.fees += r.fee; }
    payoutPerShare(o, side) { return side === o ? 1 : 0; }
    operatorPnL(o) { return this.netInflow + this.fees - this.out[o]; }
    maxLoss() { return this.seed; }
    state() { return { b: this.b, qYes: this.q[0], qNo: this.q[1] }; }
  }

  // =====================================================================
  // CPMM – spiller mod spiller. LP indskyder L kr = L JA + L NEJ (komplette sæt).
  // Pris(JA) = NEJ_pulje / (JA_pulje + NEJ_pulje). Invariant: JA_pulje · NEJ_pulje = k.
  // Ved køb: indskud præges til sæt, modsat side bliver i puljen, puljen udleverer
  // købt side så k holdes. Alt er fuldt dækket af indskudte penge.
  // =====================================================================
  class CPMM {
    constructor({ seed, p0, fee }) {
      this.kind = 'cpmm';
      this.fee = fee;
      this.L = seed;
      this.canSell = true;
      const L = seed;
      let y, n;
      if (p0 >= 0.5) { n = L; y = (L * (1 - p0)) / p0; } else { y = L; n = (L * p0) / (1 - p0); }
      this.pool = [y, n];
      this.lpKept = [L - y, L - n]; // overskydende tokens bliver hos LP
      this.out = [0, 0];
      this.netInflow = 0;
      this.fees = 0;
    }
    priceOf(p) { return p[1] / (p[0] + p[1]); }
    price() { return this.priceOf(this.pool); }
    k() { return this.pool[0] * this.pool[1]; }
    quoteBuy(side, gross) {
      const fee = gross * this.fee, a = gross - fee;
      const k = this.k(), p = this.pool.slice(), other = 1 - side;
      p[other] += a;                  // præget modsat side bliver i puljen
      const afterMint = p[side] + a;  // præget købt side
      p[side] = k / p[other];         // puljen beholder kun det k kræver
      return { shares: afterMint - p[side], fee, net: a, newPrice: this.priceOf(p), _s: p };
    }
    quoteSell(side, s) {
      // Sælg s tokens: læg dem i puljen og brænd r komplette sæt så k holdes.
      // (y + s - r)(n - r) = y·n  =>  r = 2sn / (B + sqrt(B² - 4sn)),  B = y + n + s
      const y = this.pool[side], n = this.pool[1 - side];
      const B = y + n + s;
      const r = (2 * s * n) / (B + Math.sqrt(Math.max(0, B * B - 4 * s * n)));
      const p = this.pool.slice();
      p[side] = y + s - r;
      p[1 - side] = n - r;
      const fee = r * this.fee;
      return { gross: r, fee, proceeds: r - fee, newPrice: this.priceOf(p), _s: p };
    }
    applyBuy(side, r) { this.pool = r._s; this.out[side] += r.shares; this.netInflow += r.net; this.fees += r.fee; }
    applySell(side, s, r) { this.pool = r._s; this.out[side] -= s; this.netInflow -= r.gross; this.fees += r.fee; }
    payoutPerShare(o, side) { return side === o ? 1 : 0; }
    // LP får puljens + egne tokens af vindersiden. Svarer til netInflow + fees - out[o].
    operatorPnL(o) { return this.pool[o] + this.lpKept[o] + this.fees - this.L; }
    maxLoss() { return this.L; }
    state() { return { poolYes: this.pool[0], poolNo: this.pool[1], k: this.k() }; }
  }

  // =====================================================================
  // Parimutuel – ren P2P. Indsatser samles i to puljer; vinderne deler hele puljen
  // pro rata. Huset sætter startkapitalen ind fordelt efter p0 for at give startodds.
  // Den "pris" man ser er den aktuelle fordeling, ikke en låst pris.
  // =====================================================================
  class Pari {
    constructor({ seed, p0, fee }) {
      this.kind = 'pari';
      this.fee = fee;
      this.S = seed;
      this.canSell = false;
      this.house = [seed * p0, seed * (1 - p0)];
      this.pool = this.house.slice();
      this.out = [0, 0]; // spillernes indsatser
      this.netInflow = 0;
      this.fees = 0;
    }
    priceOf(p) { return p[0] / (p[0] + p[1]); }
    price() { return this.priceOf(this.pool); }
    quoteBuy(side, gross) {
      const fee = gross * this.fee, a = gross - fee;
      const p = this.pool.slice();
      p[side] += a;
      return { shares: a, fee, net: a, newPrice: this.priceOf(p), _s: p };
    }
    quoteSell() { return null; }
    applyBuy(side, r) { this.pool = r._s; this.out[side] += r.shares; this.netInflow += r.net; this.fees += r.fee; }
    payoutPerShare(o, side) { return side === o ? (this.pool[0] + this.pool[1]) / this.pool[o] : 0; }
    operatorPnL(o) {
      const T = this.pool[0] + this.pool[1];
      return this.fees + (this.house[o] * T) / this.pool[o] - this.S;
    }
    maxLoss() { return Math.max(this.house[0], this.house[1]); }
    state() { return { poolYes: this.pool[0], poolNo: this.pool[1] }; }
  }

  const MECHS = { cpmm: CPMM, lmsr: LMSR, pari: Pari };

  // ---------- Løsere: hvor meget skal købes/sælges for at flytte prisen til target ----------
  function solveBuy(mech, side, target, maxGross) {
    const dir = side === YES ? 1 : -1;
    if ((target - mech.price()) * dir <= 0 || maxGross <= 0) return 0;
    const reached = (g) => (mech.quoteBuy(side, g).newPrice - target) * dir >= 0;
    if (!reached(maxGross)) return maxGross;
    let lo = 0, hi = maxGross;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (reached(m)) hi = m; else lo = m; }
    return hi;
  }
  function solveSell(mech, side, target, maxShares) {
    const dir = side === YES ? -1 : 1; // salg af JA sænker prisen
    if ((target - mech.price()) * dir <= 0 || maxShares <= 0) return 0;
    const reached = (s) => (mech.quoteSell(side, s).newPrice - target) * dir >= 0;
    if (!reached(maxShares)) return maxShares;
    let lo = 0, hi = maxShares;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (reached(m)) hi = m; else lo = m; }
    return hi;
  }

  // =====================================================================
  // Marked = én mekanisme + egne kopier af spillernes beholdning og kontanter
  // =====================================================================
  const TYPE_LABEL = { informed: 'Informeret', noise: 'Støj', momentum: 'Momentum', you: 'Dig' };

  class Market {
    constructor(key, cfg, agents) {
      this.key = key;
      this.mech = new MECHS[key](cfg);
      this.agents = agents.map((a) => ({ ...a, cash: a.bankroll, hold: [0, 0] }));
      this.hist = { price: [], pnlYes: [], pnlNo: [], pnlExp: [] };
      this.log = [];
      this.volume = 0;
      this.trades = 0;
      this.absErrSum = 0;
      this.errSteps = 0;
    }
    buy(agent, side, gross, t) {
      gross = Math.min(gross, agent.cash);
      if (gross < 0.01) return null;
      const before = this.mech.price();
      const r = this.mech.quoteBuy(side, gross);
      this.mech.applyBuy(side, r);
      agent.cash -= gross;
      agent.hold[side] += r.shares;
      this.volume += gross;
      this.trades++;
      return this._log(t, agent, 'Køb', side, gross, r.shares, before);
    }
    sell(agent, side, shares, t) {
      if (!this.mech.canSell) return null;
      shares = Math.min(shares, agent.hold[side]);
      if (shares < 1e-6) return null;
      const before = this.mech.price();
      const r = this.mech.quoteSell(side, shares);
      this.mech.applySell(side, shares, r);
      agent.cash += r.proceeds;
      agent.hold[side] -= shares;
      this.volume += r.gross;
      this.trades++;
      return this._log(t, agent, 'Sælg', side, r.proceeds, shares, before);
    }
    _log(t, agent, action, side, kr, shares, before) {
      const e = { t, who: agent.type === 'you' ? 'Dig' : `${TYPE_LABEL[agent.type]} #${agent.id + 1}`, type: agent.type,
        action, side, kr, shares, before, after: this.mech.price() };
      this.log.push(e);
      if (this.log.length > 400) this.log.shift();
      return e;
    }
    // Agentens beslutning. rnd er fælles tilfældige tal, så alle tre markeder får samme ordrestrøm-impuls.
    act(agent, rnd, trueP, t) {
      const m = this.mech, p = m.price();
      const maxStake = Math.min(agent.cash, agent.bankroll * agent.maxFrac);

      if (agent.type === 'noise') {
        const held = agent.hold[0] + agent.hold[1] > 1e-6;
        if (m.canSell && held && rnd.u2 < 0.35) {
          let side = rnd.u1 < 0.5 ? YES : NO;
          if (agent.hold[side] < 1e-6) side = 1 - side;
          return this.sell(agent, side, agent.hold[side] * (0.25 + 0.75 * rnd.u3), t);
        }
        const side = rnd.u1 < 0.5 ? YES : NO;
        const gross = Math.min(maxStake, agent.noiseSize * -Math.log(1 - rnd.u3 * 0.999));
        return this.buy(agent, side, gross, t);
      }

      let belief;
      if (agent.type === 'informed') {
        belief = trueP + agent.bias + 0.015 * rnd.g;
      } else {
        // momentum: forlænger seneste prisbevægelse i DETTE marked
        const h = this.hist.price, back = h.length > 8 ? h[h.length - 9] : h[0] ?? p;
        belief = p + clamp(agent.k * (p - back), -0.12, 0.12); // loft: ingen spiller tror på mere end 12 pp fortsættelse
      }
      belief = clamp(belief, 0.01, 0.99);
      const edge = belief - p;
      if (Math.abs(edge) < agent.minEdge + m.fee) return null;
      const target = p + agent.aggr * edge;
      const want = edge > 0 ? YES : NO, opp = 1 - want;

      // Har man den modsatte side, sælges den først (lukker position) – ellers købes.
      if (m.canSell && agent.hold[opp] > 1e-6) {
        const s = solveSell(m, opp, target, agent.hold[opp]);
        if (s > 1e-6) return this.sell(agent, opp, s, t);
      }
      const g = solveBuy(m, want, target, maxStake);
      return g >= 1 ? this.buy(agent, want, g, t) : null;
    }
    record(trueP) {
      const m = this.mech, p = m.price();
      const y = m.operatorPnL(YES), n = m.operatorPnL(NO);
      this.hist.price.push(p);
      this.hist.pnlYes.push(y);
      this.hist.pnlNo.push(n);
      this.hist.pnlExp.push(trueP * y + (1 - trueP) * n);
      this.absErrSum += Math.abs(p - trueP);
      this.errSteps++;
    }
    agentPnL(agent, o) {
      const m = this.mech;
      return agent.cash - agent.bankroll + agent.hold[0] * m.payoutPerShare(o, 0) + agent.hold[1] * m.payoutPerShare(o, 1);
    }
    // Forventet resultat pr. agenttype ved sand sandsynlighed trueP (som hvis markedet lukkede nu)
    pnlByType(trueP) {
      const res = { informed: 0, noise: 0, momentum: 0, you: 0 };
      for (const a of this.agents) {
        res[a.type] += trueP * this.agentPnL(a, YES) + (1 - trueP) * this.agentPnL(a, NO);
      }
      return res;
    }
    // Nulsum-kontrol: spillere + operatør = 0 for begge udfald
    zeroSumError() {
      let worst = 0;
      for (const o of [YES, NO]) {
        let s = this.mech.operatorPnL(o);
        for (const a of this.agents) s += this.agentPnL(a, o);
        worst = Math.max(worst, Math.abs(s));
      }
      return worst;
    }
  }

  // =====================================================================
  // Simulation: samme spillerpopulation og samme tilfældige tal i alle tre markeder
  // =====================================================================
  const DEFAULTS = {
    seed: 1000,        // startkapital i risiko (kr)
    fee: 0.02,         // gebyr pr. handel
    p0: 0.5,           // startpris
    trueP: 0.68,       // sand sandsynlighed for JA
    shockAt: 0,        // handel hvor nyhedschok rammer (0 = fra)
    shockP: 0.35,      // sand sandsynlighed efter chok
    nAgents: 40,
    bankroll: 1000,
    mix: { informed: 0.3, noise: 0.55, momentum: 0.15 },
    sigma: 0.06,       // spredning i informeredes vurdering
    noiseSize: 40,     // gns. støjhandel (kr)
    rngSeed: 7,
  };

  class Simulation {
    constructor(cfg) {
      this.cfg = { ...DEFAULTS, ...cfg, mix: { ...DEFAULTS.mix, ...(cfg && cfg.mix) } };
      const c = this.cfg;
      this.rng = mulberry32(c.rngSeed);
      const mixSum = c.mix.informed + c.mix.noise + c.mix.momentum || 1;
      const nInf = Math.round((c.nAgents * c.mix.informed) / mixSum);
      const nMom = Math.round((c.nAgents * c.mix.momentum) / mixSum);
      const agents = [];
      for (let i = 0; i < c.nAgents; i++) {
        const type = i < nInf ? 'informed' : i < nInf + nMom ? 'momentum' : 'noise';
        agents.push({
          id: i, type, bankroll: c.bankroll,
          bias: gauss(this.rng) * c.sigma,
          aggr: 0.3 + 0.5 * this.rng(),
          k: 1 + 1.5 * this.rng(),
          minEdge: 0.01 + 0.02 * this.rng(),
          maxFrac: 0.15 + 0.2 * this.rng(),
          noiseSize: c.noiseSize,
        });
      }
      agents.push({ id: -1, type: 'you', bankroll: 10000, bias: 0, aggr: 1, k: 0, minEdge: 0, maxFrac: 1, noiseSize: 0 });
      this.nAuto = c.nAgents;
      const mcfg = { seed: c.seed, p0: c.p0, fee: c.fee };
      this.markets = { cpmm: new Market('cpmm', mcfg, agents), lmsr: new Market('lmsr', mcfg, agents), pari: new Market('pari', mcfg, agents) };
      this.t = 0;
      this.trueHist = [];
      this._record();
    }
    trueP() { return this.cfg.shockAt > 0 && this.t >= this.cfg.shockAt ? this.cfg.shockP : this.cfg.trueP; }
    _record() {
      const tp = this.trueP();
      this.trueHist.push(tp);
      for (const k in this.markets) this.markets[k].record(tp);
    }
    step() {
      this.t++;
      const r = this.rng;
      const rnd = { i: Math.floor(r() * this.nAuto), u1: r(), u2: r(), u3: r(), g: gauss(r) };
      const tp = this.trueP();
      for (const k in this.markets) {
        const mk = this.markets[k];
        mk.act(mk.agents[rnd.i], rnd, tp, this.t);
      }
      this._record();
    }
    run(n) { for (let i = 0; i < n; i++) this.step(); }
    // Din handel sendes til alle tre markeder. Køb: beløb i kr. Salg: andel (0-1) af din beholdning.
    manual(action, side, amount) {
      this.t++;
      const res = {};
      for (const k in this.markets) {
        const mk = this.markets[k], you = mk.agents[mk.agents.length - 1];
        res[k] = action === 'buy' ? mk.buy(you, side, amount, this.t) : mk.sell(you, side, you.hold[side] * amount, this.t);
      }
      this._record();
      return res;
    }
    quoteManual(action, side, amount) {
      const res = {};
      for (const k in this.markets) {
        const mk = this.markets[k], m = mk.mech, you = mk.agents[mk.agents.length - 1];
        if (action === 'buy') {
          const g = Math.min(amount, you.cash);
          res[k] = g > 0 ? { ...m.quoteBuy(side, g), kr: g } : null;
        } else if (m.canSell && you.hold[side] > 1e-9) {
          const s = you.hold[side] * amount;
          res[k] = { ...m.quoteSell(side, s), sharesSold: s };
        } else res[k] = null;
      }
      return res;
    }
    you(key) { const a = this.markets[key].agents; return a[a.length - 1]; }
  }

  // Teoretisk forventet tab for LMSR, når prisen flyttes fra p0 til p og sandheden er p:
  // b · KL(p || p0). Viser at subsidiet er prisen for information.
  function lmsrExpectedLoss(b, p0, p) {
    const kl = (a, q) => (a > 0 ? a * Math.log(a / q) : 0) + (a < 1 ? (1 - a) * Math.log((1 - a) / (1 - q)) : 0);
    return b * kl(p, p0);
  }

  return { YES, NO, LMSR, CPMM, Pari, Market, Simulation, DEFAULTS, solveBuy, solveSell, lmsrExpectedLoss, mulberry32, TYPE_LABEL };
});
