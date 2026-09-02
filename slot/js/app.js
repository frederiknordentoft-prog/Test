/* =========================================================================
   Objekt — app orchestration: state, UI, spin flow, win presentation,
   free spins, autospin, sheets, compliance widgets.
   Outcome comes from SlotMath at the moment Spin is pressed; everything
   after that is presentation.
   ========================================================================= */
(function () {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const M = root().SlotMath;
  function root() { return window; }
  const fmtNum = new Intl.NumberFormat('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr = (v) => fmtNum.format(Math.round(v * 100) / 100) + ' kr.';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('objekt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('objekt.' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const BETS = [2, 5, 10, 20, 50, 100];
  const START_BALANCE = 1000;
  const AUTO_MIN_GAP = 3000;          // Spillemyndigheden: ≥ 3 s between results in autospin
  const REALITY_CHECK_MS = 30 * 60 * 1000;

  const state = {
    balance: store.get('balance', START_BALANCE),
    betIndex: clamp(store.get('betIndex', 2), 0, BETS.length - 1),
    turbo: !!store.get('turbo', false),
    sound: store.get('sound', true) !== false,
    busy: false, spinning: false, auto: null, free: null,
    sessionStart: Date.now(), spins: 0, wagered: 0, won: 0, lastResultAt: 0, lastWin: 0,
    realityShown: 0,
  };

  /* ---------- DOM ---------- */
  const el = {
    html: document.documentElement, machine: $('#machine'), tray: $('#tray'), trayInner: $('#trayInner'),
    reels: $('#reels'), fx: $('#fx'), overlay: $('#overlay'), overlayContent: $('#overlayContent'),
    balance: $('#balance'), balanceLabel: $('#balanceLabel'), bet: $('#bet'), betTop: $('#betTop'), ptBet: $('#ptBet'), infoBet: $('#infoBet'),
    island: $('#island'), islandInner: $('#islandInner'),
    spin: $('#spin'), spinLabel: $('#spinLabel'), ringRect: $('#ringRect'),
    betMinus: $('#betMinus'), betPlus: $('#betPlus'), autoBtn: $('#autoBtn'), turboBtn: $('#turboBtn'), infoBtn: $('#infoBtn'),
    soundBtn: $('#soundBtn'), themeBtn: $('#themeBtn'), clock: $('#clock'), session: $('#session'),
    scrim: $('#scrim'), veil: $('#veil'), toast: $('#toast'), toastText: $('#toastText'), toastAction: $('#toastAction'),
  };

  /* ---------- theme ---------- */
  function currentTheme() { return el.html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
  function setTheme(t) { el.html.setAttribute('data-theme', t); store.set('theme', t); if (engine) { engine.symbolCache.clear(); engine._needsDraw = true; } renderStaticArt(); }
  el.themeBtn.addEventListener('click', () => { audio.unlock(); audio.toggle(true); setTheme(currentTheme() === 'dark' ? 'light' : 'dark'); });
  const machineTheme = () => (el.machine.dataset.mode === 'free' || currentTheme() === 'dark') ? 'dark' : 'light';

  /* ---------- audio ---------- */
  const audio = new SlotAudio();
  audio.setEnabled(state.sound);
  el.soundBtn.setAttribute('aria-pressed', String(state.sound));
  el.soundBtn.addEventListener('click', () => {
    audio.unlock();
    state.sound = !state.sound; audio.setEnabled(state.sound); store.set('sound', state.sound);
    el.soundBtn.setAttribute('aria-pressed', String(state.sound));
    audio.toggle(state.sound);
  });
  const unlockOnce = () => { audio.unlock(); if (state.sound && audio.master) audio.master.gain.value = 0.55; };
  ['pointerdown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, unlockOnce, { passive: true }));

  /* ---------- rolling numbers (Clock-app style digit columns) ---------- */
  class Rolling {
    constructor(node) {
      this.node = node; node.classList.add('rolling'); this.text = ''; this.value = null;
      injectRollingCss();
      this.setText(node.textContent.trim(), false);
    }
    set(value) { const v = Math.round(value * 100) / 100; const dir = this.value == null ? 0 : (v > this.value ? 1 : v < this.value ? -1 : 0); this.value = v; this.setText(kr(v), dir); }
    setText(text, dir) {
      if (text === this.text) return;
      const old = this.text; this.text = text;
      const n = text.length; const padOld = old.padStart(n, ' ').slice(-n);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const ch = text[i], och = padOld[i];
        const col = document.createElement('span'); col.className = 'col';
        if (dir && och !== ch && !reducedMotion) {
          const stack = document.createElement('span'); stack.className = 'stack';
          const a = document.createElement('span'); a.className = 'ch'; a.textContent = dir > 0 ? och : ch;
          const b = document.createElement('span'); b.className = 'ch'; b.textContent = dir > 0 ? ch : och;
          stack.appendChild(a); stack.appendChild(b);
          if (dir < 0) stack.style.transform = 'translateY(-50%)';
          col.appendChild(stack);
          requestAnimationFrame(() => requestAnimationFrame(() => { stack.style.transform = dir > 0 ? 'translateY(-50%)' : 'translateY(0)'; }));
          setTimeout(() => { if (col.isConnected) col.innerHTML = '<span class="ch">' + ch + '</span>'; }, 520);
        } else {
          col.innerHTML = '<span class="ch">' + (ch === ' ' ? '&nbsp;' : ch) + '</span>';
        }
        frag.appendChild(col);
      }
      this.node.innerHTML = ''; this.node.appendChild(frag);
    }
  }
  let rollingCssDone = false;
  function injectRollingCss() {
    if (rollingCssDone) return; rollingCssDone = true;
    const st = document.createElement('style');
    st.textContent = '.rolling{display:inline-flex;white-space:pre}.rolling .col{display:inline-block;height:1.25em;line-height:1.25em;overflow:hidden;position:relative}.rolling .stack{display:flex;flex-direction:column;transition:transform .5s cubic-bezier(.28,.11,.32,1)}.rolling .ch{display:block;height:1.25em;line-height:1.25em}';
    document.head.appendChild(st);
  }
  const balanceNum = new Rolling(el.balance);
  const betNum = new Rolling(el.bet);
  const betTopNum = new Rolling(el.betTop);

  /* ---------- island ---------- */
  const island = {
    set(html, opts) {
      opts = opts || {};
      el.islandInner.innerHTML = html;
      el.island.className = 'island show' + (opts.two ? ' two' : '') + (opts.tier ? ' tier-' + opts.tier : '');
      el.islandInner.style.position = 'absolute'; el.islandInner.style.whiteSpace = 'nowrap';
      const w = el.islandInner.offsetWidth;
      el.islandInner.style.position = ''; el.islandInner.style.whiteSpace = '';
      const maxW = el.machine.clientWidth - 24;
      el.island.style.width = Math.min(w, maxW) + 'px'; el.island.style.minWidth = Math.min(w, maxW) + 'px';
    },
    clear() {
      if (!el.island.classList.contains('show')) return;
      el.island.className = 'island'; el.island.style.width = ''; el.island.style.minWidth = '';
      setTimeout(() => { if (!el.island.classList.contains('show')) el.islandInner.innerHTML = ''; }, 450);
    },
  };

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(text, opts) {
    opts = opts || {};
    el.toastText.textContent = text;
    if (opts.action) { el.toastAction.hidden = false; el.toastAction.textContent = opts.action; el.toastAction.onclick = () => { hideToast(); opts.onAction && opts.onAction(); }; }
    else { el.toastAction.hidden = true; el.toastAction.onclick = null; }
    el.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, opts.duration || 3200);
  }
  function hideToast() { el.toast.classList.remove('show'); }

  /* ---------- sheets ---------- */
  let openSheetEl = null;
  function openSheet(id) {
    closeSheet();
    const sh = $('#' + id); if (!sh) return;
    sh.hidden = false; el.scrim.classList.add('show');
    requestAnimationFrame(() => { sh.classList.add('show'); });
    openSheetEl = sh;
    const first = sh.querySelector('button.btn-pill, button:not([data-close])'); if (first) setTimeout(() => first.focus(), 250);
  }
  function closeSheet() {
    if (!openSheetEl) return;
    const sh = openSheetEl; openSheetEl = null;
    sh.classList.remove('show'); el.scrim.classList.remove('show');
    setTimeout(() => { if (!sh.classList.contains('show')) sh.hidden = true; }, 450);
  }
  el.scrim.addEventListener('click', () => { if (openSheetEl && openSheetEl.id !== 'sheetWelcome') closeSheet(); });
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => { audio.click(); closeSheet(); }));
  $$('.tabs [role=tab]').forEach((t) => t.addEventListener('click', () => {
    audio.click();
    const sheet = t.closest('.sheet');
    $$('[role=tab]', sheet).forEach((x) => x.setAttribute('aria-selected', String(x === t)));
    $$('.tabpanel', sheet).forEach((p) => { p.hidden = p.dataset.panel !== t.dataset.tab; });
  }));

  /* ---------- clock / session / reality check ---------- */
  function tickClock() {
    const d = new Date();
    el.clock.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    const s = Math.floor((Date.now() - state.sessionStart) / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    el.session.textContent = h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
    const elapsed = Date.now() - state.sessionStart;
    const period = Math.floor(elapsed / REALITY_CHECK_MS);
    if (period > state.realityShown && !state.busy && !openSheetEl) {
      state.realityShown = period;
      $('#sheetRealityTitle').textContent = `Du har spillet i ${period * 30} minutter`;
      $('#realityNet').textContent = (state.won - state.wagered >= 0 ? '+' : '−') + kr(Math.abs(state.won - state.wagered));
      $('#realitySpins').textContent = String(state.spins);
      stopAuto();
      openSheet('sheetReality');
    }
  }
  setInterval(tickClock, 1000); tickClock();
  $('#realityPause').addEventListener('click', () => { closeSheet(); stopAuto(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- engine / fx ---------- */
  const game = M.createGame({ seed: (function () { const q = new URLSearchParams(location.search).get('seed'); return q ? (parseInt(q, 10) >>> 0) : undefined; })() });
  const engine = new ReelEngine(el.reels, {
    art: SlotArt, audio, strips: M.BASE_STRIPS.map((s) => s.slice()), reducedMotion: reducedMotion,
    getTheme: machineTheme,
    onReelStop: onReelStop,
  });
  engine.setStops([3, 11, 7, 19, 2]);
  const fx = new FX(el.fx, { reducedMotion: reducedMotion });
  const FX_COLORS = ['rgba(0,113,227,0.9)', 'rgba(255,255,255,1)', 'rgba(163,191,217,0.9)', 'rgba(230,224,213,0.9)'];

  /* ---------- bet ---------- */
  const bet = () => BETS[state.betIndex];
  function renderBet() {
    const b = bet();
    betNum.set(b); betTopNum.set(b);
    el.ptBet.textContent = kr(b); el.infoBet.textContent = kr(b);
    const lock = state.busy || !!state.free || !!state.auto;
    el.betMinus.disabled = state.betIndex === 0 || lock; el.betPlus.disabled = state.betIndex === BETS.length - 1 || lock;
    renderPaytable();
    store.set('betIndex', state.betIndex);
  }
  function changeBet(delta) {
    if (state.busy || state.free) return;
    const i = clamp(state.betIndex + delta, 0, BETS.length - 1);
    if (i === state.betIndex) return;
    state.betIndex = i; audio.click(); renderBet();
  }
  el.betMinus.addEventListener('click', () => changeBet(-1));
  el.betPlus.addEventListener('click', () => changeBet(1));

  function setBalance(v) { state.balance = Math.round(v * 100) / 100; balanceNum.set(state.balance); store.set('balance', state.balance); }
  function resetBalance() { setBalance(START_BALANCE); toast('Demosaldoen er nulstillet.'); audio.toggle(true); }
  $('#resetBalance').addEventListener('click', () => { closeSheet(); resetBalance(); });

  /* ---------- spin button ---------- */
  const ICON_STOP = '<span class="k"><svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg></span>';
  function setSpinButton(mode) {
    el.spin.disabled = false;
    if (mode === 'idle') { el.spinLabel.innerHTML = 'Spin'; el.spin.setAttribute('aria-label', 'Spin (mellemrum)'); }
    else if (mode === 'stop') { el.spinLabel.innerHTML = ICON_STOP + 'Stop'; el.spin.setAttribute('aria-label', 'Stop valserne'); }
    else if (mode === 'auto') { el.spinLabel.innerHTML = ICON_STOP + 'Stop <span class="count">' + state.auto.left + '</span>'; el.spin.setAttribute('aria-label', 'Stop autospin'); }
    else if (mode === 'free') { el.spinLabel.innerHTML = 'Gratis spin'; el.spin.disabled = true; }
    else if (mode === 'disabled') { el.spin.disabled = true; }
  }
  let ringLen = 0;
  function layoutRing() {
    const w = el.spin.offsetWidth + 6, h = el.spin.offsetHeight + 6;
    el.ringRect.setAttribute('width', w - 2); el.ringRect.setAttribute('height', h - 2);
    el.ringRect.setAttribute('rx', (h - 2) / 2); el.ringRect.setAttribute('ry', (h - 2) / 2);
    ringLen = 2 * (w - h) + Math.PI * (h - 2);
    el.ringRect.style.strokeDasharray = ringLen; el.ringRect.style.strokeDashoffset = ringLen; el.ringRect.style.opacity = 0;
  }
  function startRing(ms) {
    layoutRing();
    el.ringRect.style.transition = 'none'; el.ringRect.style.strokeDashoffset = ringLen; el.ringRect.style.opacity = 1;
    requestAnimationFrame(() => { el.ringRect.style.transition = `stroke-dashoffset ${ms}ms linear, opacity .2s`; el.ringRect.style.strokeDashoffset = 0; });
  }
  function endRing() { el.ringRect.style.transition = 'stroke-dashoffset .25s ease-out, opacity .3s'; el.ringRect.style.strokeDashoffset = 0; el.ringRect.style.opacity = 0; }
  new ResizeObserver(layoutRing).observe(el.spin);

  /* ---------- overlays inside the tray ---------- */
  let overlayResolve = null;
  function showOverlay(o) {
    let html = '';
    if (o.eyebrow) html += `<div class="ov-eyebrow">${o.eyebrow}</div>`;
    if (o.title) html += `<h2 class="${o.grad ? 'grad' : ''}">${o.title}</h2>`;
    if (o.amount != null) html += `<div class="ov-amount num" id="ovAmount">${o.amount}</div>`;
    if (o.sub) html += `<div class="ov-sub">${o.sub}</div>`;
    if (o.button) html += `<div class="ov-actions"><button class="btn-pill" id="ovBtn">${o.button}</button></div>`;
    el.overlayContent.innerHTML = html;
    el.overlay.classList.add('show');
    return new Promise((resolve) => {
      overlayResolve = resolve;
      const b = $('#ovBtn');
      if (b) { b.addEventListener('click', () => { audio.click(); resolve('button'); }); setTimeout(() => b.focus(), 300); }
      if (o.tapToSkip) el.overlay.addEventListener('click', () => resolve('tap'), { once: true });
    });
  }
  function hideOverlay() {
    el.overlay.classList.remove('show'); overlayResolve = null;
    setTimeout(() => { if (!el.overlay.classList.contains('show')) el.overlayContent.innerHTML = ''; }, 500);
  }

  /* ---------- count-up ---------- */
  function countUp(node, to, dur, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      if (reducedMotion || dur <= 0) { node.textContent = kr(to); resolve(); return; }
      const t0 = performance.now(); let done = false;
      const finish = () => { if (done) return; done = true; node.textContent = kr(to); opts.onEnd && opts.onEnd(); resolve(); };
      countUpSkip = finish;
      const step = (now) => {
        if (done) return;
        const t = Math.min(1, (now - t0) / dur);
        node.textContent = kr(to * easeOutCubic(t));
        if (opts.tick) audio.rollTick(t);
        if (t < 1) requestAnimationFrame(step); else finish();
      };
      requestAnimationFrame(step);
    });
  }
  let countUpSkip = null;

  /* ---------- win line cycling ---------- */
  let cycleTimer = null;
  function startWinCycle(r) {
    const cells = new Set();
    r.lineWins.forEach((lw) => lw.positions.forEach((p) => cells.add(p.reel + ',' + p.row)));
    r.scatterPositions.forEach((p) => { if (r.scatters >= 3) cells.add(p.reel + ',' + p.row); });
    const lines = r.lineWins.map((lw) => ({ positions: lw.positions, amount: lw.amount, symbol: lw.symbol, count: lw.count }));
    const hl = { cells, lines, activeLine: null, activeCells: null, dim: true, scatter: r.scatters >= 3 ? r.scatterPositions : null };
    engine.setHighlight(hl);
    if (!lines.length) return;
    let i = -1;
    const next = () => {
      i = (i + 1) % lines.length;
      hl.activeLine = i; hl.activeCells = new Set(lines[i].positions.map((p) => p.reel + ',' + p.row));
      engine.setHighlight(hl);
      if (lines.length > 1 && !state.free) island.set(`<span class="i-label">${symName(lines[i].symbol)} × ${lines[i].count}</span><span class="i-amount">${kr(lines[i].amount)}</span>`);
    };
    cycleTimer = setTimeout(function loop() { next(); cycleTimer = setTimeout(loop, 1500); }, 1300);
  }
  function stopWinCycle() { clearTimeout(cycleTimer); cycleTimer = null; }
  function symName(id) { return (SlotArt.SYMBOLS[id] && SlotArt.SYMBOLS[id].name) || id; }

  /* ---------- reel stop handler (anticipation, sounds, nod) ---------- */
  let currentOutcome = null;
  function onReelStop(i) {
    audio.reelStop(i);
    el.machine.classList.add('nod'); setTimeout(() => el.machine.classList.remove('nod'), 110);
    if (!currentOutcome) return;
    const board = currentOutcome.board;
    let scattersSoFar = 0;
    for (let r = 0; r <= i; r++) if (board[r].includes('SCAT')) scattersSoFar++;
    if (board[i].includes('SCAT')) { audio.scatterLand(scattersSoFar); }
    if (engine.anticipateFrom != null && i === engine.anticipateFrom - 1) audio.anticipation();
  }
  /* Reel index from which the scatter tease applies (two scatters on earlier reels), or null. */
  function anticipateFrom(board) {
    let n = 0;
    for (let r = 0; r < board.length - 1; r++) { if (board[r].includes('SCAT')) n++; if (n >= 2) return r + 1; }
    return null;
  }

  /* ---------- the spin ---------- */
  let debugNext = null;
  async function spin() {
    if (state.busy || openSheetEl) return;
    const b = bet();
    if (!state.free && state.balance < b) {
      audio.error();
      toast('Utilstrækkelig saldo.', { action: 'Nulstil demosaldo', onAction: resetBalance, duration: 5000 });
      stopAuto();
      return;
    }
    state.busy = true; state.spinning = true;
    if (countUpSkip) { const f = countUpSkip; countUpSkip = null; f(); }
    stopWinCycle(); engine.clearHighlight(); fx.clear();
    if (!state.free) island.clear();
    hideOverlay();
    renderBet();
    if (!state.free) { setBalance(state.balance - b); state.wagered += b; }
    audio.spinStart();
    el.machine.classList.add('lift'); setTimeout(() => el.machine.classList.remove('lift'), 170);

    const ctx = state.free ? { inFreeSpins: true } : undefined;
    let outcome = game.spin(b, ctx);
    if (debugNext) { outcome = forceOutcome(debugNext, b, ctx); debugNext = null; }
    currentOutcome = outcome;
    state.spins++;
    if (state.free) { setSpinButton('free'); updateFreeIsland(); }
    else if (state.auto) setSpinButton('auto');
    else setSpinButton('stop');
    const tease = anticipateFrom(outcome.board);
    startRing(engine.expectedDuration(state.turbo, tease));

    await engine.spin(outcome.stops, { turbo: state.turbo, strips: outcome.strips, anticipateFrom: tease });
    endRing();
    state.spinning = false;
    currentOutcome = null;
    if (!state.free) setSpinButton(state.auto ? 'auto' : 'idle');

    const r = outcome.result;
    state.lastResultAt = performance.now();
    state.lastWin = r.total;
    if (r.total > 0) await presentWin(r, b);
    if (r.freeSpins) await handleFreeSpins(r, b);
    state.busy = false;
    renderBet();

    if (state.free) scheduleNextFreeSpin();
    else if (state.auto) scheduleNextAuto();
  }

  function forceOutcome(spec, b, ctx) {
    const inFree = !!(ctx && ctx.inFreeSpins);
    let strips = inFree ? M.FREE_STRIPS : M.BASE_STRIPS;
    let stops = spec.stops;
    if (!stops && spec.board) {
      // testing aid: clone the strips and write the requested window in at a fixed stop
      strips = strips.map((st, r) => { const c = st.slice(); spec.board[r].forEach((sym, y) => { c[(5 + y) % c.length] = sym; }); return c; });
      stops = spec.board.map(() => 5);
    }
    const board = M.boardFromStops(strips, stops);
    const result = M.evaluate(board, b, { multiplier: inFree ? M.FREE_SPINS_MULTIPLIER : 1, inFreeSpins: inFree });
    return { stops, board, result, strips, inFree };
  }

  /* ---------- win presentation ---------- */
  async function presentWin(r, b) {
    const tier = M.winTier(r.total, b);
    const turbo = state.turbo;
    const mult = state.free ? ` <span class="i-label">× 2</span>` : '';
    startWinCycle(r);
    state.won += r.total;
    if (state.free) state.free.won += r.total;

    if (tier === 'win' || tier === 'big') {
      audio.win(tier);
      const label = tier === 'big' ? 'Stor gevinst' : 'Gevinst';
      if (state.free) {
        updateFreeIsland(r.total, label);
        const node = $('#fsWin');
        if (node) await countUp(node, r.total, turbo ? 350 : 650, { tick: true });
      } else {
        island.set(`<span class="i-label">${label}</span><span class="i-amount" id="islandAmount">0,00 kr.</span>`, { tier });
        const node = $('#islandAmount');
        if (tier === 'big') burst(1.0);
        await countUp(node, r.total, tier === 'big' ? (turbo ? 700 : 1200) : (turbo ? 350 : 650), { tick: true });
      }
      if (tier === 'big') audio.rollEnd();
      setBalance(state.balance + r.total);
      await sleep(tier === 'big' ? (turbo ? 500 : 900) : (turbo ? 250 : 450));
    } else {
      // mega / epic — keynote, not fireworks
      audio.win(tier);
      const epic = tier === 'epic';
      if (epic) { el.veil.classList.add('show'); el.machine.classList.add('raised'); }
      const p = showOverlay({ title: epic ? 'Episk gevinst.' : 'Mega gevinst.', grad: true, amount: '0,00 kr.', sub: `${Math.round(r.total / b)} × indsatsen`, tapToSkip: true });
      burst(epic ? 2 : 1.4); rain(epic ? 90 : 50);
      const node = $('#ovAmount');
      let skipped = false;
      p.then(() => { skipped = true; if (countUpSkip) { const f = countUpSkip; countUpSkip = null; f(); } });
      await countUp(node, r.total, epic ? (turbo ? 1800 : 3000) : (turbo ? 1300 : 2200), { tick: true, onEnd: () => audio.rollEnd() });
      setBalance(state.balance + r.total);
      if (!skipped) await Promise.race([p, sleep(epic ? 1800 : 1400)]);
      hideOverlay();
      el.veil.classList.remove('show'); el.machine.classList.remove('raised');
      if (state.free) updateFreeIsland();
      else island.set(`<span class="i-label">${epic ? 'Episk gevinst' : 'Mega gevinst'}</span><span class="i-amount">${kr(r.total)}</span>`, { tier });
      await sleep(300);
    }
  }
  function trayCenter() { return { x: el.trayInner.clientWidth / 2, y: el.trayInner.clientHeight / 2 }; }
  function burst(power) {
    const c = trayCenter();
    const w = el.trayInner.clientWidth, h = el.trayInner.clientHeight;
    fx.rise(0, w, 0, h, { count: Math.round(22 * power), colors: FX_COLORS, duration: 1.2 * power });
    fx.burst(c.x, c.y, { count: Math.round(8 * power), colors: ['#ffffff', '#0071e3'], power: power * 0.7, kind: 'glint' });
  }
  function rain(n) { fx.rain(0, el.trayInner.clientWidth, { count: Math.round(n / 3), colors: ['#ffffff', '#0071e3'], kind: 'glint', duration: 1.8 }); }

  /* ---------- free spins ---------- */
  function updateFreeIsland(winAmount, label) {
    const f = state.free; if (!f) return;
    const top = winAmount != null
      ? `<span class="i-label">${label || 'Gevinst'}</span> <span class="i-amount" id="fsWin">0,00 kr.</span>`
      : `<span class="i-label">Gratis spins</span> <span class="i-amount">${Math.min(f.played, f.total)} af ${f.total}</span>${f.badge ? ` <span class="i-badge">+${f.badge}</span>` : ''}`;
    const bottom = winAmount != null
      ? `<span class="i-sub">Gratis spins ${Math.min(f.played, f.total)} af ${f.total} · Samlet ${kr(f.won)}</span>`
      : `<span class="i-sub">Samlet gevinst ${kr(f.won)} · Alle gevinster × 2</span>`;
    island.set(`<span class="i-col"><span>${top}</span>${bottom}</span>`, { two: true });
  }
  async function handleFreeSpins(r, b) {
    if (!state.free) {
      if (state.auto) stopAuto('Autospin sat på pause – gratis spins starter.');
      audio.scatterLand(4);
      await sleep(700);
      setSpinButton('disabled');
      await showOverlay({ eyebrow: 'Bonus', title: `${r.freeSpins} gratis spins.`, sub: `Alle gevinster ganges med ${M.FREE_SPINS_MULTIPLIER} · Indsats ${kr(b)}`, button: 'Start' });
      hideOverlay();
      state.free = { total: r.freeSpins, left: r.freeSpins, played: 0, won: 0, bet: b, badge: 0 };
      el.machine.dataset.mode = 'free';
      engine.symbolCache.clear(); engine._needsDraw = true;
      audio.bonusEnter();
      stopWinCycle(); engine.clearHighlight();
      updateFreeIsland();
      setSpinButton('free');
      await sleep(900);
    } else {
      state.free.left += r.freeSpins; state.free.total += r.freeSpins; state.free.badge = r.freeSpins;
      audio.scatterLand(5);
      updateFreeIsland();
      await sleep(1200);
      state.free.badge = 0;
    }
  }
  function scheduleNextFreeSpin() {
    const f = state.free; if (!f) return;
    if (f.left <= 0) { endFreeSpins(); return; }
    setTimeout(() => { if (!state.free) return; f.left--; f.played++; spin(); }, state.turbo ? 500 : 900);
  }
  async function endFreeSpins() {
    const f = state.free;
    state.busy = true;
    stopWinCycle(); engine.clearHighlight();
    audio.bonusExit();
    await showOverlay({ eyebrow: 'Gratis spins er slut', title: 'Gratis spins gav', amount: kr(f.won), sub: `${f.total} spins · Indsats ${kr(f.bet)}`, button: 'Fortsæt' });
    hideOverlay();
    state.free = null;
    el.machine.dataset.mode = 'base';
    engine.symbolCache.clear(); engine._needsDraw = true;
    island.set(`<span class="i-label">Gratis spins</span><span class="i-amount">${kr(f.won)}</span>`);
    setSpinButton('idle');
    state.busy = false;
    renderBet();
  }

  /* ---------- autospin ---------- */
  function startAuto(opts) {
    state.auto = { left: opts.count, startBalance: state.balance, lossLimit: opts.lossLimit, winLimit: opts.winLimit, stopOnBonus: opts.stopOnBonus };
    el.autoBtn.setAttribute('aria-pressed', 'true');
    setSpinButton('auto');
    spin();
  }
  function stopAuto(msg) {
    if (!state.auto) return;
    state.auto = null;
    el.autoBtn.setAttribute('aria-pressed', 'false');
    if (!state.free && !state.spinning) setSpinButton('idle');
    if (msg) toast(msg);
  }
  function scheduleNextAuto() {
    const a = state.auto; if (!a) return;
    a.left--;
    if (a.left <= 0) { stopAuto('Autospin er færdig.'); return; }
    if (state.balance < bet()) { stopAuto('Autospin stoppet: utilstrækkelig saldo.'); return; }
    if (a.lossLimit && a.startBalance - state.balance >= a.lossLimit) { stopAuto('Autospin stoppet: tabsgrænsen er nået.'); return; }
    if (a.winLimit && state.lastWin >= a.winLimit) { stopAuto('Autospin stoppet: gevinstgrænsen er nået.'); return; }
    setSpinButton('auto');
    const wait = Math.max(500, AUTO_MIN_GAP - (performance.now() - state.lastResultAt));
    setTimeout(() => { if (state.auto && !state.busy) spin(); }, wait);
  }
  el.autoBtn.addEventListener('click', () => {
    audio.click();
    if (state.auto) { stopAuto('Autospin stoppet.'); return; }
    if (state.busy) return;
    openSheet('sheetAuto');
  });
  let autoCount = 10;
  $$('#autoCount button').forEach((b) => b.addEventListener('click', () => { audio.click(); autoCount = +b.dataset.v; $$('#autoCount button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  $('#autoStopBonus').addEventListener('click', (e) => { const s = e.currentTarget; const on = s.getAttribute('aria-checked') !== 'true'; s.setAttribute('aria-checked', String(on)); audio.toggle(on); });
  $('#autoStart').addEventListener('click', () => {
    audio.click(); closeSheet();
    startAuto({ count: autoCount, lossLimit: +$('#autoLoss').value, winLimit: +$('#autoWin').value, stopOnBonus: $('#autoStopBonus').getAttribute('aria-checked') === 'true' });
  });

  /* ---------- turbo / info ---------- */
  function renderTurbo() { el.turboBtn.setAttribute('aria-pressed', String(state.turbo)); }
  el.turboBtn.addEventListener('click', () => { state.turbo = !state.turbo; store.set('turbo', state.turbo); renderTurbo(); audio.toggle(state.turbo); toast(state.turbo ? 'Hurtigt spil er slået til.' : 'Hurtigt spil er slået fra.', { duration: 1600 }); });
  renderTurbo();
  el.infoBtn.addEventListener('click', () => { audio.click(); openSheet('sheetInfo'); });

  /* ---------- spin button ---------- */
  el.spin.addEventListener('click', () => {
    if (el.spin.disabled) return;
    audio.click();
    if (state.spinning) { engine.quickStop(); el.ringRect.style.transition = 'stroke-dashoffset .3s ease-out'; el.ringRect.style.strokeDashoffset = 0; return; }
    if (state.auto) { stopAuto('Autospin stoppet.'); return; }
    spin();
  });

  /* ---------- keyboard ---------- */
  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
    if (e.key === 'Escape' && openSheetEl) { if (openSheetEl.id !== 'sheetWelcome') closeSheet(); return; }
    if (openSheetEl) return;
    if (el.overlay.classList.contains('show') && (e.code === 'Space' || e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      const ob = $('#ovBtn'); if (ob) ob.click(); else el.overlay.click();
      return;
    }
    if (e.code === 'Space' || e.key === 'Enter') { if (e.target === el.spin || e.code === 'Space') { e.preventDefault(); el.spin.click(); } }
    else if (e.key === 'ArrowUp' || e.key === '+') { e.preventDefault(); changeBet(1); }
    else if (e.key === 'ArrowDown' || e.key === '-') { e.preventDefault(); changeBet(-1); }
    else if (e.key === 'a' || e.key === 'A') el.autoBtn.click();
    else if (e.key === 't' || e.key === 'T') el.turboBtn.click();
    else if (e.key === 'i' || e.key === 'I') el.infoBtn.click();
    else if (e.key === 'm' || e.key === 'M') el.soundBtn.click();
  });

  /* ---------- paytable / lines / feature art ---------- */
  const PT_ORDER = ['WILD', 'H1', 'H2', 'H3', 'H4', 'L1', 'L2', 'L3', 'L4', 'SCAT'];
  function drawInto(canvas, id, cssPx) {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const src = SlotArt.symbol(id, Math.round(cssPx * dpr), dpr, currentTheme());
    canvas.width = src.width; canvas.height = src.height;
    canvas.getContext('2d').drawImage(src, 0, 0);
  }
  function renderStaticArt() {
    $$('.feature canvas[data-sym]').forEach((c) => drawInto(c, c.dataset.sym, 120));
    $$('#paytable canvas[data-sym]').forEach((c) => drawInto(c, c.dataset.sym, 84));
    $$('#miniPt canvas[data-sym]').forEach((c) => drawInto(c, c.dataset.sym, 44));
  }
  function renderPaytable() {
    const b = bet(); const lineBet = b / M.LINE_COUNT;
    const pt = $('#paytable'), mini = $('#miniPt');
    if (!pt.childElementCount) {
      pt.innerHTML = PT_ORDER.map((id) => {
        const s = SlotArt.SYMBOLS[id];
        const note = id === 'WILD' ? 'Erstatter alle undtagen Ring' : id === 'SCAT' ? '× samlet indsats · 3+ giver 10 gratis spins' : '';
        return `<div class="pt reveal"><div class="fig"><canvas data-sym="${id}"></canvas></div><div class="name">${s.name}${s.caption ? ' · ' + s.caption : ''}${s.sub ? ' <span style="color:var(--sub-2);font-weight:500">' + s.sub + '</span>' : ''}</div>
          <div class="row"><span>5 ens</span><b data-v="${id}:2"></b></div><div class="row"><span>4 ens</span><b data-v="${id}:1"></b></div><div class="row"><span>3 ens</span><b data-v="${id}:0"></b></div>${note ? `<div class="note">${note}</div>` : ''}</div>`;
      }).join('');
      mini.innerHTML = PT_ORDER.map((id) => `<div class="m"><canvas data-sym="${id}"></canvas><div><div class="mn">${SlotArt.SYMBOLS[id].name}</div><div class="mv" data-mv="${id}"></div></div></div>`).join('');
      renderStaticArt();
      observeReveals();
    }
    const val = (id, k) => id === 'SCAT' ? M.SCATTER_PAY[k] * b : M.PAYTABLE[id][k] * lineBet;
    $$('[data-v]', pt).forEach((n) => { const [id, k] = n.dataset.v.split(':'); n.textContent = kr(val(id, +k)); });
    $$('[data-mv]', mini).forEach((n) => { const id = n.dataset.mv; n.textContent = [2, 1, 0].map((k) => kr(val(id, k))).join(' · '); });
  }
  function renderLines() {
    $('#lines').innerHTML = M.LINES.map((line, i) => {
      let cells = '';
      for (let row = 0; row < 3; row++) for (let reel = 0; reel < 5; reel++) cells += `<div class="c${line[reel] === row ? ' on' : ''}"></div>`;
      return `<div class="line"><div class="g">${cells}</div><div class="n">${i + 1}</div></div>`;
    }).join('');
  }
  let revealIO = null;
  function observeReveals() {
    if (reducedMotion || !('IntersectionObserver' in window)) { $$('.reveal').forEach((n) => n.classList.add('in')); return; }
    if (!revealIO) revealIO = new IntersectionObserver((entries) => entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); } }), { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal:not(.in)').forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) n.classList.add('in'); else revealIO.observe(n);
    });
  }

  /* ---------- welcome gate ---------- */
  $('#welcomeOk').addEventListener('click', () => { audio.unlock(); audio.click(); store.set('welcome', true); closeSheet(); });
  if (!store.get('welcome', false)) setTimeout(() => openSheet('sheetWelcome'), 500);

  /* ---------- visibility: stop autospin when the tab is hidden ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopAuto(); if (audio.ctx) audio.ctx.suspend(); }
    else if (audio.ctx && state.sound) audio.ctx.resume();
  });

  /* ---------- init ---------- */
  renderLines();
  renderBet();
  balanceNum.set(state.balance);
  setSpinButton('idle');
  layoutRing();
  observeReveals();

  // Debug/testing hooks (harmless): Objekt.next({board:[...]}) forces the next outcome's presentation.
  window.Objekt = {
    state, engine, game, audio, fx,
    next(spec) { debugNext = spec; },
    spin, stopAuto, startAuto, setBalance, openSheet, closeSheet,
    setTurbo(v) { state.turbo = !!v; renderTurbo(); },
  };
})();
