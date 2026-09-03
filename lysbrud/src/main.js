/* LYSBRUD — sammenkobling: tilstandsmaskine, animationsløkke og spilflow. */

import {
  GEOM, RING_COUNT, SYMBOLS, SYMBOL_BY_ID, REACTOR_STEPS, BONUS, PRISM_TARGET,
  BET_LEVELS, DEFAULT_BET_INDEX, START_BALANCE, AUTOPLAY_LEVELS, TIMING, PALETTE,
} from './config.js';
import { makeRng, pickWeighted } from './rng.js';
import { neighbours, createBoard } from './engine.js';
import { createDirector } from './director.js';
import { createWheelRenderer, withAlpha } from './wheel.js';
import { createFx } from './fx.js';
import { createBackdrop, drawAmbient } from './art/backdrop.js';
import { createAudio } from './audio.js';
import { createUi } from './ui.js';

const TAU = Math.PI * 2;

/* ---------------------------------------------------- rotationsprofil
   Hastighedskurve integreret én gang til en opslagstabel. Kurven har
   blød opstart, langt konstant midterparti og en udsving-og-tilbage
   afslutning, så ringen "klikker" på plads.                             */

const PROFILE = (() => {
  const N = 512, v = new Float64Array(N + 1), p = new Float64Array(N + 1);
  const velAt = u => {
    if (u < 0.10) { const k = u / 0.10; return k * k * (3 - 2 * k); }
    if (u < 0.62) return 1;
    const k = (u - 0.62) / 0.38;
    return Math.pow(1 - k, 1.7) - 0.13 * Math.sin(Math.PI * Math.pow(k, 1.3));
  };
  for (let i = 0; i <= N; i++) v[i] = velAt(i / N);
  let acc = 0;
  for (let i = 1; i <= N; i++) { acc += (v[i - 1] + v[i]) / 2 / N; p[i] = acc; }
  for (let i = 0; i <= N; i++) p[i] /= acc;
  return u => {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    const x = u * N, i = x | 0, f = x - i;
    return p[i] * (1 - f) + p[i + 1] * f;
  };
})();

const TURNS = [3.7, 3.1, 2.6, 2.1, 1.7];   // omdrejninger pr. ring, inderst → yderst

/* ------------------------------------------------------------- opsætning */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d', { alpha: false });
const stage = document.getElementById('stage');

const rng = makeRng(0x10c5b2 ^ (Date.now() & 0xffff));
const wheel = createWheelRenderer();
const fx = createFx();
const audio = createAudio();
const director = createDirector(rng, { scripted: true });

let backdrop = null;
let dpr = 1, viewW = 0, viewH = 0;

const state = {
  balance: START_BALANCE,
  betIdx: DEFAULT_BET_INDEX,
  autoIdx: 1,
  autoLeft: 0,
  spinIndex: 0,
  prismCharge: 0,
  reactorIdx: 0,
  busy: false,
  forceStop: false,
  inBonus: false,
  bonusSpinsLeft: 0,
  bonusColor: null,
  bonusTotal: 0,
  turbo: false,
  calm: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  scripted: true,
  soundOn: true,
  lastWin: 0,
};

const bet = () => BET_LEVELS[state.betIdx];

/* Render-tilstand: hvad der faktisk tegnes lige nu. */
const view = {
  board: null,
  offsets: new Array(RING_COUNT).fill(0),
  blur: new Array(RING_COUNT).fill(0),
  coreEnergy: 0,
  coreTint: null,
};

/* -------------------------------------------------------------------- ui */

const ui = createUi({
  currentBet: bet,
  onSpin: () => {
    audio.unlock();
    if (state.autoLeft > 0) { stopAuto('AUTOSPIL STOPPET'); return; }
    if (state.busy) { state.forceStop = true; return; }
    runSpinLoop();
  },
  onAutoToggle: () => {
    audio.unlock();
    if (state.autoLeft > 0) { stopAuto('AUTOSPIL STOPPET'); return; }
    state.autoLeft = AUTOPLAY_LEVELS[state.autoIdx];
    refreshAuto();
    if (!state.busy) runSpinLoop();
  },
  onBet: dir => {
    if (state.busy) return;
    audio.click();
    state.betIdx = Math.max(0, Math.min(BET_LEVELS.length - 1, state.betIdx + dir));
    ui.setBet(bet());
  },
  onAuto: dir => {
    audio.click();
    if (state.autoLeft > 0) return;                       // ændr ikke serien mens den kører
    state.autoIdx = Math.max(0, Math.min(AUTOPLAY_LEVELS.length - 1, state.autoIdx + dir));
    refreshAuto();
  },
  onSound: () => {
    audio.unlock();
    state.soundOn = !state.soundOn;
    audio.setMuted(!state.soundOn);
    ui.setSoundIcon(state.soundOn);
  },
  onSetting: (key, value) => {
    if (key === 'turbo') state.turbo = value;
    if (key === 'sound') { state.soundOn = value; audio.setMuted(!value); ui.setSoundIcon(value); }
    if (key === 'calm') { state.calm = value; fx.setCalm(value); document.body.classList.toggle('is-calm', value); }
    if (key === 'scripted') { state.scripted = value; director.setScripted(value); }
    if (key === 'reset') { state.balance = START_BALANCE; ui.setBalance(state.balance); }
  },
});

function refreshAuto() {
  ui.setAuto(state.autoLeft > 0 ? state.autoLeft : AUTOPLAY_LEVELS[state.autoIdx], state.autoLeft > 0);
}

/* ---------------------------------------------------------------- layout */

function resize() {
  const rect = stage.getBoundingClientRect();
  viewW = Math.max(320, Math.round(rect.width));
  viewH = Math.max(280, Math.round(rect.height));
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + 'px';
  canvas.style.height = viewH + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  wheel.resize(viewW, viewH, dpr);
  fx.resize(viewW, viewH, dpr);
  backdrop = createBackdrop(viewW, viewH, 20260903);
  positionRails();
}

/** Sidepanelerne skal klæbe til hjulets kant, ikke til scenens kant. */
function positionRails() {
  const L = wheel.layout;
  if (!L) return;
  const left = document.getElementById('prism-rail');
  const right = document.getElementById('reactor-rail');
  const edge = L.cx - L.rim;
  const rightEdge = viewW - (L.cx + L.rim);
  left.style.setProperty('--gap', Math.max(8, edge * 0.16) + 'px');
  right.style.setProperty('--gap', Math.max(8, rightEdge * 0.16) + 'px');
}

let resizeTimer = 0;
let lastSize = '';
function scheduleResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const rect = stage.getBoundingClientRect();
    const key = Math.round(rect.width) + 'x' + Math.round(rect.height) + '@' + (window.devicePixelRatio || 1);
    if (key === lastSize) return;
    lastSize = key;
    resize();
  }, 120);
}
window.addEventListener('resize', scheduleResize);
if (window.ResizeObserver) new ResizeObserver(scheduleResize).observe(stage);

/* --------------------------------------------------------------- løkken */

let last = performance.now();
let clock = 0;

function frame(now) {
  const dt = Math.min(64, now - last);
  last = now; clock += dt;

  fx.update(dt);
  render(clock, dt);
  requestAnimationFrame(frame);
}

function render(t, dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sh = fx.shakeVec;
  ctx.clearRect(0, 0, viewW, viewH);

  if (backdrop) ctx.drawImage(backdrop.canvas, 0, 0, viewW, viewH);
  else { ctx.fillStyle = PALETTE.cavern0; ctx.fillRect(0, 0, viewW, viewH); }
  drawAmbient(ctx, viewW, viewH, t, dpr);

  ctx.save();
  ctx.translate(sh.x, sh.y);

  if (view.board) {
    wheel.drawPlates(ctx, view.offsets);
    wheel.drawFrame(ctx);
    wheel.drawSymbols(ctx, view.board, view.offsets, view.blur);
    wheel.drawCore(ctx, t, view.coreEnergy, view.coreTint);
  }
  fx.draw(ctx);
  ctx.restore();

  // Blødt bloom-pas over de lysende elementer.
  const g = fx.beginGlow();
  if (g) {
    g.save();
    g.translate(sh.x, sh.y);
    if (view.board) wheel.drawCore(g, t, view.coreEnergy, view.coreTint);
    fx.draw(g);
    g.restore();
    fx.endGlow(ctx, 0.55);
  }
}

/* ------------------------------------------------------------ hjælpere */

const wait = ms => new Promise(r => setTimeout(r, Math.max(0, state.turbo ? ms * 0.42 : ms)));

function easeOutCubic(k) { return 1 - Math.pow(1 - k, 3); }

/** Korteste vej fra a til b i retningen dir (+1 = med uret). */
function forwardDelta(a, b, dir) {
  let d = (b - a) * dir;
  d = ((d % TAU) + TAU) % TAU;
  return d * dir;
}

/* --------------------------------------------------------- rotationen */

function animateSpin(targetOffsets, anticipate) {
  const from = view.offsets.slice();
  const rings = [];
  for (let r = 0; r < RING_COUNT; r++) {
    const dir = GEOM.dir[r];
    const base = TIMING.ringStopFirst + (RING_COUNT - 1 - r) * TIMING.ringStopStagger;
    let dur = base;
    let turns = TURNS[r];
    if (anticipate && r === 0) { dur += TIMING.anticipation; turns += 1.6; }
    rings.push({
      from: from[r],
      total: dir * (turns * TAU) + forwardDelta(from[r], targetOffsets[r], dir),
      dur: state.turbo ? dur * 0.55 : dur,
      done: false,
    });
  }

  const maxDur = Math.max(...rings.map(r => r.dur));
  audio.spinStart();
  audio.spinLoop(true);

  return new Promise(resolve => {
    let elapsed = 0, scale = 1, prev = performance.now();
    const tick = now => {
      const dt = Math.min(64, now - prev); prev = now;
      if (state.forceStop) scale = Math.min(4.2, scale + dt / 90);
      elapsed += dt * scale;

      let allDone = true;
      for (let r = 0; r < RING_COUNT; r++) {
        const ring = rings[r];
        const u = Math.min(1, elapsed / ring.dur);
        view.offsets[r] = ring.from + ring.total * PROFILE(u);
        // Sløring følger den øjeblikkelige vinkelfart.
        const du = Math.min(1, (elapsed + 16) / ring.dur);
        view.blur[r] = Math.min(1, Math.abs(ring.total) * (PROFILE(du) - PROFILE(u)) / 0.34);
        if (u < 1) allDone = false;
        else if (!ring.done) {
          ring.done = true;
          view.offsets[r] = targetOffsets[r];
          view.blur[r] = 0;
          audio.ringStop(r);
          fx.shake(r === 0 ? 5 : 2.4);
          if (anticipate && r === 1) view.coreEnergy = 0.8;
        }
      }
      // Prismen lader op mens ringene standser.
      view.coreEnergy = Math.max(view.coreEnergy * 0.96,
        0.22 * (1 - Math.min(1, elapsed / maxDur)) + (anticipate ? 0.3 : 0));

      if (allDone) {
        audio.spinLoop(false);
        view.coreEnergy = 0;
        resolve();
      } else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* --------------------------------------------------------- energikæder */

/** Bygger et net af forbindelser inde i klyngen, ordnet efter bredde-først
 *  søgning, så kæden vokser udad fra ét punkt. */
function chainSegments(cluster, board) {
  const L = wheel.layout;
  const off = board.offsets;
  const inCluster = new Set(cluster.cells.map(([r, i]) => `${r}:${i}`));
  const nb = neighbours(board);
  const start = `${cluster.cells[0][0]}:${cluster.cells[0][1]}`;
  const seen = new Set([start]);
  const queue = [start];
  const segs = [];
  const drawn = new Set();

  while (queue.length) {
    const key = queue.shift();
    const [r, i] = key.split(':').map(Number);
    const list = nb.get(key) || [];
    for (const other of list) {
      if (!inCluster.has(other)) continue;
      const pair = key < other ? `${key}|${other}` : `${other}|${key}`;
      if (drawn.has(pair)) continue;
      drawn.add(pair);
      const [r2, i2] = other.split(':').map(Number);
      if (r2 === r) {
        const a0 = off[r] + (i + 0.5) * L.step[r];
        let a1 = off[r] + (i2 + 0.5) * L.step[r];
        // Vælg den korte vej rundt.
        while (a1 - a0 > Math.PI) a1 -= TAU;
        while (a0 - a1 > Math.PI) a1 += TAU;
        segs.push({ kind: 'arc', cx: L.cx, cy: L.cy, rad: L.ringMid[r], a0, a1 });
      } else {
        const p0 = wheel.point(off, r, i);
        const p1 = wheel.point(off, r2, i2);
        segs.push({ kind: 'line', x0: p0.x, y0: p0.y, x1: p1.x, y1: p1.y });
      }
      if (!seen.has(other)) { seen.add(other); queue.push(other); }
    }
  }
  return segs;
}

/* ------------------------------------------------------------ kaskader */

async function playSteps(result) {
  let running = 0;

  for (let s = 0; s < result.steps.length; s++) {
    const step = result.steps[s];
    view.board = step.board;
    wheel.resetStyles();

    if (!step.clusters.length) break;

    // Motoren har allerede afgjort trinnet — vis dét, gæt ikke om.
    setReactorUi(step.multiplier);
    if (s > 0 || state.inBonus) { audio.reactor(s); ui.pulseReactor(); }

    // Fremhæv vinderne, dæmp resten.
    const winners = new Set();
    for (const c of step.clusters) for (const [r, i] of c.cells) winners.add(`${r}:${i}`);
    for (let r = 0; r < RING_COUNT; r++) {
      for (let i = 0; i < GEOM.cells[r]; i++) {
        const st = wheel.styleAt(r, i);
        if (winners.has(`${r}:${i}`)) { st.glow = 1; st.dim = 0; }
        else st.dim = 1;
      }
    }

    // Kæderne tegnes.
    for (const c of step.clusters) {
      const def = SYMBOL_BY_ID[c.symbol];
      fx.addChain(chainSegments(c, step.board), def.glow, TIMING.chainDraw, 2.6, 700);
    }
    audio.cascade(s);
    await wait(TIMING.chainDraw + 120);

    // Gevinsttal ved hver klynge.
    for (const c of step.clusters) {
      const cash = c.pay * bet() * step.multiplier;
      const mid = c.cells[Math.floor(c.cells.length / 2)];
      const p = wheel.point(view.offsets, mid[0], mid[1]);
      const def = SYMBOL_BY_ID[c.symbol];
      fx.addLabel(p.x, p.y - 14, formatShort(cash), def.edge, Math.min(30, 17 + c.size), 1300);
    }
    running += step.win;
    ui.setWin(running); ui.flashWin();
    state.lastWin = running;

    // Splintring.
    for (const [r, i] of step.removed) {
      const p = wheel.point(view.offsets, r, i);
      fx.emitShatter(p.x, p.y, step.board.grid[r][i], wheel.symbolSize[r], 1);
      audio.shatter(SYMBOL_BY_ID[step.board.grid[r][i]].tier || 0);
    }
    fx.shake(Math.min(14, 3 + step.removed.length * 0.5));
    await animateCells(step.removed, 'out');

    if (!step.nextBoard) break;

    // Genopfyldning.
    view.board = step.nextBoard;
    await animateCells(step.removed, 'in');
    await wait(TIMING.cascadeGap);
  }

  wheel.resetStyles();
  state.reactorIdx = Number.isInteger(result.endStep) ? result.endStep : 0;
  return running;
}

function formatShort(v) {
  if (v >= 10000) return Math.round(v / 1000) + 'k';
  return v >= 100 ? String(Math.round(v)) : v.toFixed(v < 10 ? 2 : 1).replace('.', ',');
}

/** Animerer et sæt celler ud (splintres) eller ind (krystalliserer). */
function animateCells(cells, mode) {
  const dur = (mode === 'out' ? TIMING.shatter : TIMING.refill) * (state.turbo ? 0.42 : 1);
  const styles = cells.map(([r, i]) => wheel.styleAt(r, i));
  if (mode === 'in') for (const st of styles) { st.alpha = 0; st.scale = 0.2; st.glow = 1; st.dim = 0; }
  return new Promise(resolve => {
    const t0 = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = easeOutCubic(k);
      for (const st of styles) {
        if (mode === 'out') { st.alpha = 1 - e; st.scale = 1 + e * 0.55; st.glow = 1 - e; }
        else { st.alpha = e; st.scale = 0.2 + 0.8 * e; st.glow = 1 - e; }
      }
      if (k < 1) requestAnimationFrame(tick);
      else { for (const st of styles) { st.alpha = 1; st.scale = 1; st.glow = 0; } resolve(); }
    };
    requestAnimationFrame(tick);
  });
}

function setReactorUi(value) {
  const steps = state.inBonus ? BONUS.steps : REACTOR_STEPS;
  const idx = Math.max(0, steps.indexOf(value));
  ui.setReactor(value, steps.length > 1 ? idx / (steps.length - 1) : 0);
}

/* --------------------------------------------------------- prisme-ladning */

async function chargePrism(hits) {
  for (let k = 0; k < hits; k++) {
    if (state.prismCharge >= PRISM_TARGET) break;
    state.prismCharge++;
    ui.setPrism(state.prismCharge, state.prismCharge - 1);
    ui.pulsePrism(state.prismCharge - 1);
    audio.prismCharge(state.prismCharge);
    const L = wheel.layout;
    fx.emitBurst(L.cx, L.cy, PALETTE.haze, 26, 1.5);
    view.coreEnergy = 0.9;
    await wait(330);
    view.coreEnergy = 0;
  }
}

/* ---------------------------------------------------------------- bonus */

async function runBonus() {
  // Kernen vælger en farve — vægtet mod midterste niveauer.
  const weights = {};
  for (const s of SYMBOLS) {
    if (s.tier >= BONUS.wildColorMinTier) weights[s.id] = 1 + (SYMBOLS.length - s.tier) * 0.35;
  }
  const colorId = pickWeighted(rng, weights);
  state.bonusColor = colorId;
  state.inBonus = true;
  state.bonusSpinsLeft = BONUS.freeSpins;
  state.bonusTotal = 0;
  state.reactorIdx = 0;

  const def = SYMBOL_BY_ID[colorId];
  view.coreTint = def.glow;
  audio.bonusStart();
  fx.emitBurst(wheel.layout.cx, wheel.layout.cy, def.glow, 90, 3.4);
  fx.shake(18);
  await ui.showBonusIntro(colorId, BONUS.freeSpins);

  state.prismCharge = 0;
  ui.setPrism(0);
  ui.setBonusHud(true, { left: state.bonusSpinsLeft, total: 0, colorId });
  ui.setHint('PRISME-BONUS — ALLE ' + def.name.toUpperCase() + ' ER WILDS');

  while (state.bonusSpinsLeft > 0) {
    state.bonusSpinsLeft--;
    ui.setBonusHud(true, { left: state.bonusSpinsLeft, total: state.bonusTotal, colorId });
    const result = director.nextSpin({
      bet: bet(), spinIndex: state.spinIndex++, prismCharge: 0,
      inBonus: true, wildColor: colorId, balance: state.balance,
      startStep: state.reactorIdx,          // multiplikatoren bæres videre
    });
    await animateSpin(result.steps[0].board.offsets, false);
    view.board = result.steps[0].board;

    if (result.prismHits >= 3) {
      state.bonusSpinsLeft += BONUS.retriggerSpins;
      ui.setHint('+' + BONUS.retriggerSpins + ' GRATISSPIN');
      audio.prismCharge(5);
      fx.emitBurst(wheel.layout.cx, wheel.layout.cy, PALETTE.gold3, 60, 2.4);
    }

    const won = await playSteps(result);
    state.bonusTotal += won;
    state.balance += won;
    ui.setBalance(state.balance);
    ui.setBonusHud(true, { left: state.bonusSpinsLeft, total: state.bonusTotal, colorId });
    await presentWin(won);
    await wait(TIMING.autoplayGap);
  }

  state.inBonus = false;
  view.coreTint = null;
  audio.bonusEnd();
  ui.setBonusHud(false);
  ui.setHint('BONUS SLUT — ' + Math.round(state.bonusTotal) + ' KR. SAMLET');
  if (state.bonusTotal > 0) {
    const tier = ui.tierFor(state.bonusTotal / bet());
    if (tier) { await ui.showWin(state.bonusTotal, tier, 2200); await wait(1600); ui.hideWin(); }
  }
  state.reactorIdx = 0;
  setReactorUi(REACTOR_STEPS[0]);
}

/* ---------------------------------------------------- gevinstpræsentation */

async function presentWin(amount) {
  if (amount <= 0) return;
  const mult = amount / bet();
  const tier = ui.tierFor(mult);
  if (!tier) { audio.win('small'); return; }

  audio.win(tier.key === 'big' ? 'big' : tier.key);
  const dur = Math.min(TIMING.winCountMax, TIMING.winCountMin + mult * 12);
  fx.shake(tier.key === 'big' ? 8 : 16);
  fx.emitRain(viewW, viewH, tier.key === 'big' ? PALETTE.gold3 : '#a9c4ff', tier.key === 'big' ? 34 : 90);
  const L = wheel.layout;
  fx.emitBurst(L.cx, L.cy, PALETTE.gold3, tier.key === 'big' ? 40 : 110, 3);
  await ui.showWin(amount, tier, state.turbo ? dur * 0.5 : dur);
  await wait(TIMING.overlayHold);
  ui.hideWin();
}

/* ------------------------------------------------------------ spin-flow */

async function startSpin() {
  state.forceStop = false;
  state.reactorIdx = 0;
  ui.hideWin();
  fx.clear();
  wheel.resetStyles();
  ui.setSpinState('stop', state.autoLeft > 0 ? String(state.autoLeft) : '');
  ui.setHint(state.autoLeft > 0 ? `AUTOSPIL — ${state.autoLeft} TILBAGE` : 'RINGENE ROTERER…');
  setReactorUi(REACTOR_STEPS[0]);

  state.balance -= bet();
  ui.setBalance(state.balance);
  ui.setWin(0);

  const result = director.nextSpin({
    bet: bet(), spinIndex: state.spinIndex++, prismCharge: state.prismCharge,
    inBonus: false, wildColor: null, balance: state.balance,
  });

  const willReach = state.prismCharge + result.prismHits >= PRISM_TARGET;
  const anticipate = !state.calm && (willReach || (state.prismCharge >= PRISM_TARGET - 1 && result.prismHits > 0));
  if (anticipate) ui.setHint('PRISMEN REAGERER…', true);

  await animateSpin(result.steps[0].board.offsets, anticipate);
  view.board = result.steps[0].board;
  ui.setSpinState('spinning');
  ui.setHint('');

  if (result.prismHits > 0) await chargePrism(result.prismHits);

  const won = await playSteps(result);
  state.balance += won;
  ui.setBalance(state.balance);
  ui.setWin(won);
  await presentWin(won);

  if (state.prismCharge >= PRISM_TARGET) await runBonus();
  return won;
}

/** Kører ét spin, eller hele autospil-serien hvis der er spins tilbage. */
async function runSpinLoop() {
  if (state.busy) return;
  state.busy = true;
  try {
    do {
      if (state.balance < bet()) {
        ui.setHint('UTILSTRÆKKELIG SALDO — NULSTIL I INDSTILLINGER', true);
        state.autoLeft = 0;
        break;
      }
      await startSpin();
      if (state.autoLeft > 0) {
        state.autoLeft--;
        refreshAuto();
        if (state.autoLeft > 0) await wait(TIMING.autoplayGap);
      }
    } while (state.autoLeft > 0);
  } finally {
    state.busy = false;
    state.autoLeft = 0;
    refreshAuto();
    ui.setSpinState('idle');
    if (!state.inBonus) ui.setHint(idleHint());
  }
}

function stopAuto(message) {
  state.autoLeft = 0;
  state.forceStop = true;
  refreshAuto();
  if (message) ui.setHint(message);
}

function idleHint() {
  if (state.prismCharge >= PRISM_TARGET - 1) return 'ÉN PRISME MERE OPLADER KERNEN';
  if (state.prismCharge > 0) return `PRISME-BONUS ${state.prismCharge}/${PRISM_TARGET} — BLIV VED`;
  return 'TRYK SPIL FOR AT AKTIVERE PRISMEN';
}

/* ------------------------------------------------------------------ start */

function boot() {
  resize();
  view.board = createBoard(rng, {});
  view.offsets = view.board.offsets.slice();
  ui.setBalance(state.balance);
  ui.setBet(bet());
  ui.setWin(0);
  refreshAuto();
  ui.setPrism(0);
  ui.setReactor(1, 0);
  ui.setSpinState('idle');
  ui.setHint(idleHint());
  ui.setSoundIcon(state.soundOn);
  fx.setCalm(state.calm);
  document.body.classList.toggle('is-calm', state.calm);
  document.getElementById('set-calm').checked = state.calm;
  requestAnimationFrame(frame);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* Krog til automatiseret QA og til at starte autospil udefra. */
window.LYSBRUD = {
  startAuto(n) {
    if (state.busy) return;
    state.autoLeft = n || AUTOPLAY_LEVELS[state.autoIdx];
    refreshAuto();
    runSpinLoop();
  },
  spin() { if (!state.busy) runSpinLoop(); },
  state,
  view,
};
