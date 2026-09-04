/* LYSBRUD — DOM-laget. Alt uden for lærredet styres herfra.
   ui.js kender ikke spillets regler; den får besked og viser det.          */

import {
  SYMBOLS, WILD, PRISM, SYMBOL_BY_ID, BET_LEVELS, AUTOPLAY_LEVELS,
  REACTOR_STEPS, PRISM_TARGET, BONUS, WIN_TIERS, kr, krBig, payBand,
} from './config.js';
import { drawSymbol } from './art/symbols.js';

const $ = id => document.getElementById(id);

export function createUi(handlers) {
  const el = {
    balance:    $('balance-value'),
    bet:        $('bet-value'),
    win:        $('win-value'),
    auto:       $('auto-value'),
    autoToggle: $('auto-toggle'),
    betUp:      $('bet-up'),      betDown:  $('bet-down'),
    autoUp:     $('auto-up'),     autoDown: $('auto-down'),
    spin:       $('spin-button'), spinLabel: $('spin-label'), spinSub: $('spin-sub'),
    hint:       $('hint'),
    prismCount: $('prism-count'),
    prismSlots: Array.from(document.querySelectorAll('#prism-slots .prism-slot')),
    reactorVal: $('reactor-value'),
    reactorFill:$('reactor-fill'),
    reactorDial:$('reactor-dial'),
    winbox:     $('winbox'),
    winTier:    $('winbox-tier'),
    winAmount:  $('winbox-amount'),
    bonusbox:   $('bonusbox'),
    bonusSwatch:$('bonusbox-swatch'),
    bonusColorName: $('bonusbox-color-name'),
    bonusNoteColor: $('bonusbox-note-color'),
    bonusSpins: $('bonusbox-spins'),
    bonusStart: $('bonusbox-start'),
    bonusHud:   $('bonus-hud'),
    bonusLeft:  $('bonus-spins-left'),
    bonusTotal: $('bonus-total'),
    bonusColor: $('bonus-color'),
    btnInfo:    $('btn-info'),
    btnSettings:$('btn-settings'),
    btnSound:   $('btn-sound'),
    modalInfo:  $('modal-info'),
    modalSettings: $('modal-settings'),
    infoBody:   $('modal-info-body'),
    setTurbo:   $('set-turbo'),
    setSound:   $('set-sound'),
    setCalm:    $('set-calm'),
    setScripted:$('set-scripted'),
    setReset:   $('set-reset'),
  };

  let winCounter = null;

  /* ------------------------------------------------------------ readouts */

  function setBalance(v) { el.balance.textContent = kr(v); }
  function setBet(v)     { el.bet.textContent = kr(v); }
  function setAuto(v, running) {
    el.auto.textContent = String(v);
    if (el.autoToggle) {
      el.autoToggle.classList.toggle('is-running', !!running);
      el.autoToggle.setAttribute('aria-pressed', running ? 'true' : 'false');
      el.autoToggle.title = running ? 'Stop autospil' : 'Start autospil';
    }
  }
  function setWin(v)     { el.win.textContent = kr(v); }

  function flashWin() {
    el.win.classList.remove('is-pop');
    void el.win.offsetWidth;
    el.win.classList.add('is-pop');
  }

  function setHint(text, urgent = false) {
    el.hint.textContent = text;
    el.hint.classList.toggle('is-urgent', urgent);
  }

  function setSpinState(state, sub = '') {
    // state: 'idle' | 'spinning' | 'stop' | 'auto' | 'bonus'
    el.spin.classList.toggle('is-spinning', state === 'spinning' || state === 'bonus');
    el.spin.disabled = state === 'spinning' || state === 'bonus';
    el.spinLabel.textContent =
      state === 'stop' ? 'STOP' :
      state === 'auto' ? 'STOP' : 'SPIL';
    el.spinSub.textContent = sub;
    el.spinSub.classList.toggle('is-on', !!sub);
  }

  /* -------------------------------------------------------- prisme-måler */

  function setPrism(count, freshIndex = -1) {
    el.prismCount.textContent = String(count);
    el.prismSlots.forEach((slot, i) => {
      slot.classList.toggle('is-filled', i < count);
      slot.classList.toggle('is-fresh', i === freshIndex);
    });
  }

  function pulsePrism(index) {
    const slot = el.prismSlots[index];
    if (!slot) return;
    slot.classList.remove('is-charging');
    void slot.offsetWidth;
    slot.classList.add('is-charging');
  }

  /* ------------------------------------------------------- reaktor-måler */

  function setReactor(value, fraction) {
    el.reactorVal.innerHTML = `${value}<i>x</i>`;
    el.reactorFill.style.setProperty('--fill', String(Math.max(0, Math.min(1, fraction))));
    el.reactorDial.classList.toggle('is-hot', value >= 5);
  }

  function pulseReactor() {
    el.reactorDial.classList.remove('is-step');
    void el.reactorDial.offsetWidth;
    el.reactorDial.classList.add('is-step');
  }

  /* ------------------------------------------------------ gevinst-overlay */

  function tierFor(mult) {
    let found = null;
    for (const t of WIN_TIERS) if (mult >= t.at) found = t;
    return found;
  }

  /** Viser overlayet og tæller beløbet op. Returnerer et promise. */
  function showWin(amount, tier, duration) {
    el.winTier.textContent = tier.label;
    el.winbox.dataset.tier = tier.key;
    el.winbox.classList.add('is-on');
    if (winCounter) cancelAnimationFrame(winCounter);
    return new Promise(resolve => {
      const t0 = performance.now();
      let lastText = '';
      let frameNo = 0;
      const step = now => {
        const k = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - k, 2.6);
        // Teksten re-rasteriseres med skygger hver gang den ændres — hver anden frame rækker.
        if (k >= 1 || (frameNo++ & 1) === 0) {
          const text = krBig(Math.round(amount * eased));
          if (text !== lastText) { el.winAmount.textContent = text; lastText = text; }
        }
        if (k < 1) winCounter = requestAnimationFrame(step);
        else { winCounter = null; resolve(); }
      };
      winCounter = requestAnimationFrame(step);
    });
  }

  function hideWin() {
    el.winbox.classList.remove('is-on');
    if (winCounter) { cancelAnimationFrame(winCounter); winCounter = null; }
  }

  /* --------------------------------------------------------------- bonus */

  function showBonusIntro(symbolId, spins) {
    const def = SYMBOL_BY_ID[symbolId];
    el.bonusColorName.textContent = def.name.toUpperCase();
    el.bonusNoteColor.textContent = def.name.toLowerCase();
    el.bonusSpins.textContent = String(spins);
    const c = el.bonusSwatch;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    drawSymbol(g, symbolId, c.width / 2, c.height / 2, c.width * 0.78, { glow: 1.4 });
    el.bonusbox.classList.add('is-on');
    return new Promise(resolve => {
      const go = () => { el.bonusStart.removeEventListener('click', go); el.bonusbox.classList.remove('is-on'); resolve(); };
      el.bonusStart.addEventListener('click', go);
      setTimeout(() => { if (el.bonusbox.classList.contains('is-on')) go(); }, 6500);
    });
  }

  function setBonusHud(on, { left, total, colorId } = {}) {
    el.bonusHud.classList.toggle('is-on', on);
    document.body.classList.toggle('in-bonus', on);
    if (!on) return;
    el.bonusLeft.textContent = String(left);
    el.bonusTotal.textContent = kr(total);
    el.bonusColor.textContent = SYMBOL_BY_ID[colorId].name.toUpperCase();
  }

  /* -------------------------------------------------------------- modaler */

  function openModal(m) {
    m.hidden = false;
    requestAnimationFrame(() => m.classList.add('is-on'));
    const focusable = m.querySelector('button, input, a[href]');
    if (focusable) focusable.focus();
  }
  function closeModal(m) {
    m.classList.remove('is-on');
    setTimeout(() => { m.hidden = true; }, 220);
  }
  document.querySelectorAll('.modal [data-close]').forEach(b => {
    b.addEventListener('click', () => closeModal(b.closest('.modal')));
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal.is-on').forEach(m => closeModal(m));
  });

  /* ------------------------------------------------------- gevinsttabel */

  function symbolChip(id, size = 54) {
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = size * dpr; c.height = size * dpr;
    c.style.width = size + 'px'; c.style.height = size + 'px';
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    drawSymbol(g, id, size / 2, size / 2, size * 0.86, { glow: 1 });
    return c;
  }

  function buildPaytable(bet) {
    const wrap = document.createElement('div');
    wrap.className = 'pay-grid';
    const bands = ['3–4', '5–6', '7–9', '10–14', '15+'];

    const head = document.createElement('div');
    head.className = 'pay-row pay-head';
    head.innerHTML = '<span class="pay-sym">Symbol</span>' + bands.map(b => `<span>${b}</span>`).join('');
    wrap.appendChild(head);

    for (const s of [...SYMBOLS].reverse()) {
      const row = document.createElement('div');
      row.className = 'pay-row';
      const cell = document.createElement('span');
      cell.className = 'pay-sym';
      cell.appendChild(symbolChip(s.id, 46));
      const name = document.createElement('b');
      name.textContent = s.name;
      cell.appendChild(name);
      row.appendChild(cell);
      for (const p of s.pays) {
        const v = document.createElement('span');
        v.textContent = kr(p * bet).replace(' KR.', '');
        row.appendChild(v);
      }
      wrap.appendChild(row);
    }
    return wrap;
  }

  function buildInfo(bet) {
    const body = el.infoBody;
    body.innerHTML = '';

    const intro = document.createElement('section');
    intro.className = 'info-block';
    intro.innerHTML = `
      <p class="info-lead">Klassiske hjul er erstattet af fem koncentriske ringe omkring en central prisme.
      Gevinster opstår, når mindst tre ens symboler forbindes i en ubrudt kæde — både på tværs af
      ringene og langs ringene.</p>
      <ol class="info-steps">
        <li><b>Vælg indsats</b> og tryk SPIL.</li>
        <li>De fem ringe roterer i <b>forskellige retninger</b> og standser én efter én.</li>
        <li>Mindst <b>tre forbundne ens symboler</b> udløser en gevinst.</li>
        <li>Vindende symboler <b>splintres</b>, og de tomme felter fyldes igen — det kan udløse
            flere kaskader i samme spin.</li>
        <li>Hver kaskade oplader <b>reaktoren</b> og hæver multiplikatoren:
            ${REACTOR_STEPS.map(s => `<i>${s}×</i>`).join(' → ')}.</li>
        <li><b>Wilds</b> forbinder ellers adskilte klynger og bærer enkelte gange deres egen
            multiplikator. Flere wilds i samme klynge <b>lægges sammen</b>.</li>
      </ol>`;
    body.appendChild(intro);

    const special = document.createElement('section');
    special.className = 'info-block info-special';
    const wildChip = symbolChip(WILD.id, 62);
    const prismChip = symbolChip(PRISM.id, 62);
    const wc = document.createElement('div'); wc.className = 'info-card';
    wc.appendChild(wildChip);
    wc.insertAdjacentHTML('beforeend', `<div><b>Wild</b><p>Erstatter alle gem-symboler og binder klynger sammen. Kan bære ×2, ×3 eller ×5.</p></div>`);
    const pc = document.createElement('div'); pc.className = 'info-card';
    pc.appendChild(prismChip);
    pc.insertAdjacentHTML('beforeend', `<div><b>Prisme</b><p>Hver prisme der lander på en ring oplader ét af de fem bonusniveauer.</p></div>`);
    special.append(wc, pc);
    body.appendChild(special);

    const bonus = document.createElement('section');
    bonus.className = 'info-block';
    bonus.innerHTML = `
      <h3>Prisme-bonus</h3>
      <p>Ved <b>${PRISM_TARGET}/${PRISM_TARGET}</b> aktiveres bonusspillet:</p>
      <ul class="info-list">
        <li>Prismekernen vælger en <b>symbolfarve</b>.</li>
        <li>Alle symboler i denne farve bliver <b>aktive wilds</b>.</li>
        <li>Ringene roterer videre gennem <b>${BONUS.freeSpins} gratisspin</b>.</li>
        <li>Multiplikatoren <b>nulstilles ikke</b> mellem kaskaderne — den fortsætter helt op til
            ${BONUS.steps[BONUS.steps.length - 1]}×.</li>
      </ul>`;
    body.appendChild(bonus);

    const pay = document.createElement('section');
    pay.className = 'info-block';
    pay.innerHTML = `<h3>Gevinsttabel</h3><p class="info-note">Beløb ved en indsats på ${kr(bet)} — klyngestørrelse vandret.</p>`;
    pay.appendChild(buildPaytable(bet));
    body.appendChild(pay);

    const foot = document.createElement('section');
    foot.className = 'info-block info-foot';
    foot.innerHTML = `<p>Demoversion uden rigtige penge. 18+ · Spil ansvarligt.</p>`;
    body.appendChild(foot);
  }

  /* ---------------------------------------------------------------- events */

  el.spin.addEventListener('click', () => handlers.onSpin());
  el.betUp.addEventListener('click', () => handlers.onBet(+1));
  el.betDown.addEventListener('click', () => handlers.onBet(-1));
  el.autoUp.addEventListener('click', () => handlers.onAuto(+1));
  if (el.autoToggle) {
    el.autoToggle.addEventListener('click', () => handlers.onAutoToggle());
    el.autoToggle.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlers.onAutoToggle(); }
    });
  }
  el.autoDown.addEventListener('click', () => handlers.onAuto(-1));

  el.btnSound.addEventListener('click', () => handlers.onSound());
  el.btnInfo.addEventListener('click', () => { buildInfo(handlers.currentBet()); openModal(el.modalInfo); });
  el.btnSettings.addEventListener('click', () => openModal(el.modalSettings));

  el.setTurbo.addEventListener('change', e => handlers.onSetting('turbo', e.target.checked));
  el.setSound.addEventListener('change', e => handlers.onSetting('sound', e.target.checked));
  el.setCalm.addEventListener('change', e => handlers.onSetting('calm', e.target.checked));
  el.setScripted.addEventListener('change', e => handlers.onSetting('scripted', e.target.checked));
  el.setReset.addEventListener('click', () => handlers.onSetting('reset', true));

  document.addEventListener('keydown', e => {
    if (e.code !== 'Space' || e.repeat) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (document.querySelector('.modal.is-on')) return;
    e.preventDefault();
    handlers.onSpin();
  });

  function setSoundIcon(on) {
    el.btnSound.classList.toggle('is-muted', !on);
    el.btnSound.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.setSound.checked = on;
  }

  return {
    el,
    setBalance, setBet, setAuto, setWin, flashWin, setHint, setSpinState,
    setPrism, pulsePrism, setReactor, pulseReactor,
    tierFor, showWin, hideWin,
    showBonusIntro, setBonusHud,
    setSoundIcon,
    openModal, closeModal,
  };
}
