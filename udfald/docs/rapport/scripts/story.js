/*
 * The story the report follows: the free-play derby (seed FCK-BIF·Parken·2026·retur), with the
 * same purchases, exits and pool stake at the same substeps. Loaded by scripts/data.mjs (node,
 * virtual clock) and by scripts/shoot.cjs (browser, via addInitScript), so every number in the
 * text and every screenshot come from one deterministic run.
 *
 * The simulation never reads the book, the pool or the Monte Carlo, so the match is identical in
 * both places. Every step that reads a quote first forces a fresh display (eventDirty), so the
 * cadence of display updates cannot change a price.
 */
globalThis.UDFALD_STORY = {
  /** 20:00 is k = 30 (opening auction) + 20 / 0.025 = 830. The buys start one substep before. */
  K_START: 829,
  /** FCK is bought through the tray in the browser (screenshot 04); the rest through the API. */
  BUYS: [
    ['1x2:F', 250],
    ['1x2:B', 200],
    ['tot:2.5:O', 200],
    ['cs:1-1', 50],
  ],
  POOL: [1, 200],
  EXITS: [
    ['1x2:B', 'stop', 17],
    ['1x2:B', 'take', 40],
    ['tot:2.5:O', 'stop', 30],
    ['tot:2.5:O', 'take', 50],
  ],
  /** A late final-score buy at 35′ (after the 28′ goal). */
  LATE: ['cs:2-1', 50, 35],

  /** One substep with a fresh display before anything reads a quote. */
  step(st, now) {
    st.eventDirty = true;
    st.speed = 1;
    st.tick(now);
  },

  /** Advances to exactly substep k. */
  ffK(st, k, clock) {
    while (st.sim.k < k && st.sim.phase !== 'closed') {
      st.speed = Math.max(1, Math.min(16, k - st.sim.k));
      st.tick(clock());
    }
    st.speed = 1;
  },

  /** Advances until the match minute is at least t (or a phase is reached). */
  ffT(st, t, clock, until) {
    while (st.sim.phase !== 'closed' && (until ? !until(st) : st.sim.t < t)) {
      st.speed = 16;
      st.tick(clock());
    }
    st.speed = 1;
  },

  /** Buys through the 1.5 s price lock: request, then one substep at least 1.6 s later. */
  buy(st, contract, kr, clock) {
    this.step(st, clock());
    st.requestBuy(contract, kr);
    this.settleLock(st, clock);
  },

  settleLock(st, clock) {
    this.step(st, clock() + 1600);
    if (st.pending && st.pending.state === 'requote') st.acceptRequote();
  },

  /** Everything after the FCK buy: the other buys, the pool stake and the exits. */
  afterFck(st, clock) {
    for (const [c, kr] of this.BUYS.slice(1)) this.buy(st, c, kr, clock);
    st.stakePool(this.POOL[0], this.POOL[1]);
    for (const [c, kind, level] of this.EXITS) {
      if (!st.placeExit(c, kind, level)) throw new Error(`exit refused: ${c} ${kind} ${level}`);
    }
  },
};
