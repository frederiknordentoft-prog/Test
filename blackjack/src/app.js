/* ============================================================================
   Blackjack — UI controller. Plays engine events back as animation.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const app = $('#app');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- i18n ---------------- */
  const I18N = {
    da: {
      introEyebrow: 'Kortspil', introSub: 'Klassikeren. Uden støj.', play: 'Spil nu', howToPlay: 'Sådan spiller du',
      introFine: '18+ · {decks} kortspil · Dealeren står på 17 · Blackjack betaler 3:2 · Demo uden rigtige penge',
      balance: 'Saldo', dealer: 'Dealer', betHere: 'Indsats', undo: 'Fortryd', clear: 'Ryd', doubleBet: '×2', rebet: 'Gentag', deal: 'Giv kort',
      surrender: 'Overgiv', split: 'Split', double: 'Fordobl', hit: 'Kort', stand: 'Stå', noThanks: 'Nej tak', keepPlaying: 'Spil videre',
      newBet: 'Ny indsats', rebetDeal: 'Gentag og giv kort', settings: 'Indstillinger', theme: 'Udseende', auto: 'Auto', light: 'Lys', dark: 'Mørk',
      language: 'Sprog', speed: 'Tempo', normal: 'Normal', fast: 'Hurtig', sound: 'Lyd', hints: 'Strategi-hint', haptics: 'Vibration',
      statistics: 'Statistik', rules: 'Regler', resetBalance: 'Nulstil saldo', demoNote: 'Demo. Der spilles ikke med rigtige penge.', cancel: 'Annuller',
      placeBet: 'Vælg din indsats.', idle: 'Klar, når du er.', yourTurn: 'Din tur', handOf: 'Hånd {n} af {m}', dealerDraws: 'Dealeren trækker', dealerChecks: 'Dealeren kigger efter blackjack',
      dealerHas: 'Dealeren har {n}', dealerBust: 'Dealeren går bust', dealerBlackjack: 'Dealeren har blackjack', dealing: 'Giver kort …',
      youWon: 'Du vandt {amt}', youLost: 'Dealeren vandt', push: 'Uafgjort', blackjack: 'Blackjack', bust: 'Bust', surrendered: 'Overgivet', won: 'Vandt', lost: 'Tabt',
      evenMoneyLabel: 'Even money', insuranceQ: 'Dealeren viser et es.', insuranceSub: 'Forsikring koster {amt} og betaler 2:1, hvis dealeren har blackjack.', insureFor: 'Forsikr for {amt}',
      evenMoneyQ: 'Du har blackjack. Dealeren viser et es.', evenMoneySub: 'Tag {amt} nu (1:1), eller vent og få 3:2, hvis dealeren ikke også har blackjack.', takeEvenMoney: 'Tag 1:1',
      insuranceLabel: 'Forsikring', insuranceLost: 'Forsikringen tabt', insuranceWon: 'Forsikringen vandt {amt}', insuranceBet: 'Forsikring {amt}', evenMoneyTaken: 'Even money taget',
      shuffling: 'Kortene blandes …', cutCard: 'Kortene blandes inden næste hånd', minBet: 'Mindste indsats er {amt}', maxBet: 'Bordet tager højst {amt}', noFunds: 'Ikke nok på saldoen', outOfChips: 'Tom saldo.',
      getChips: 'Start forfra med {amt}', resetQ: 'Start forfra?', resetText: 'Din saldo sættes til {amt}. Det er legepenge. Statistikken bevares.', reset: 'Nulstil', emptyTitle: 'Tom saldo.', emptyText: 'Sådan går det nogle gange. Du kan starte forfra med {amt}.', startOver: 'Start forfra',
      reg: '18+ · Spil ansvarligt · StopSpillet 70 22 28 25 · ROFUS', noHistory: 'Ingen runder endnu', soundOn: 'Lyd til', soundOff: 'Lyd fra',
      hintLabel: 'Basisstrategi', stRounds: 'Runder', stWinRate: 'Vundet', stBlackjacks: 'Blackjacks', stNet: 'Netto', stBest: 'Største gevinst', stStreak: 'Bedste stime', stWagered: 'Omsat',
      rulesTitle: 'Sådan spiller du', rulesIntro: 'Kom tættest på 21 uden at gå over. Billedkort tæller 10, es tæller 1 eller 11. Dealeren trækker til 16 og står på 17. Blackjack betaler 3:2.',
      rDecks: 'Kortspil', rS17: 'Dealeren står på', rS17v: 'Alle 17', rH17v: 'Hårde 17 (trækker på blød 17)', rBJ: 'Blackjack betaler', rIns: 'Forsikring betaler', rPeek: 'Dealeren kigger efter blackjack', rPeekV: 'Ved es og 10',
      rDouble: 'Fordobling', rDoubleV: 'På alle to kort', rDAS: 'Fordobling efter split', rSplit: 'Split', rSplitV: 'Op til {n} hænder', rAces: 'Splittede esser', rAcesV: 'Ét kort pr. es, ingen re-split', rSurr: 'Overgivelse', rSurrV: 'Sen, kun på de første to kort',
      rLimits: 'Indsats', rCut: 'Blanding', rCutV: 'Ved {pct} % af skoen', yes: 'Ja', no: 'Nej', keys: 'Tastatur', kDeal: 'Giv kort / gentag', kHit: 'Kort', kStand: 'Stå', kDouble: 'Fordobl', kSplit: 'Split', kSurr: 'Overgiv', kIns: 'Forsikring ja / nej', kEsc: 'Luk',
      recent: 'Seneste runder', chips: 'Jetoner', dealerLabel: 'Dealer',
    },
    en: {
      introEyebrow: 'Card game', introSub: 'The classic. Without the noise.', play: 'Play now', howToPlay: 'How to play',
      introFine: '18+ · {decks} decks · Dealer stands on 17 · Blackjack pays 3:2 · Demo, no real money',
      balance: 'Balance', dealer: 'Dealer', betHere: 'Bet', undo: 'Undo', clear: 'Clear', doubleBet: '×2', rebet: 'Rebet', deal: 'Deal',
      surrender: 'Surrender', split: 'Split', double: 'Double', hit: 'Hit', stand: 'Stand', noThanks: 'No thanks', keepPlaying: 'Keep playing',
      newBet: 'New bet', rebetDeal: 'Rebet and deal', settings: 'Settings', theme: 'Appearance', auto: 'Auto', light: 'Light', dark: 'Dark',
      language: 'Language', speed: 'Pace', normal: 'Normal', fast: 'Fast', sound: 'Sound', hints: 'Strategy hint', haptics: 'Haptics',
      statistics: 'Statistics', rules: 'Rules', resetBalance: 'Reset balance', demoNote: 'Demo. No real money is played.', cancel: 'Cancel',
      placeBet: 'Place your bet.', idle: 'Ready when you are.', yourTurn: 'Your turn', handOf: 'Hand {n} of {m}', dealerDraws: 'Dealer draws', dealerChecks: 'Dealer checks for blackjack',
      dealerHas: 'Dealer has {n}', dealerBust: 'Dealer busts', dealerBlackjack: 'Dealer has blackjack', dealing: 'Dealing …',
      youWon: 'You won {amt}', youLost: 'Dealer wins', push: 'Push', blackjack: 'Blackjack', bust: 'Bust', surrendered: 'Surrendered', won: 'Won', lost: 'Lost',
      evenMoneyLabel: 'Even money', insuranceQ: 'Dealer shows an ace.', insuranceSub: 'Insurance costs {amt} and pays 2:1 if the dealer has blackjack.', insureFor: 'Insure for {amt}',
      evenMoneyQ: 'You have blackjack. Dealer shows an ace.', evenMoneySub: 'Take {amt} now (1:1), or wait for 3:2 if the dealer does not also have blackjack.', takeEvenMoney: 'Take 1:1',
      insuranceLabel: 'Insurance', insuranceLost: 'Insurance lost', insuranceWon: 'Insurance won {amt}', insuranceBet: 'Insurance {amt}', evenMoneyTaken: 'Even money taken',
      shuffling: 'Shuffling …', cutCard: 'The shoe is shuffled before the next hand', minBet: 'Minimum bet is {amt}', maxBet: 'Table max is {amt}', noFunds: 'Not enough balance', outOfChips: 'Empty balance.',
      getChips: 'Start over with {amt}', resetQ: 'Start over?', resetText: 'Your balance is set to {amt}. It is play money. Statistics are kept.', reset: 'Reset', emptyTitle: 'Empty balance.', emptyText: 'It happens. You can start over with {amt}.', startOver: 'Start over',
      reg: '18+ · Play responsibly · StopSpillet 70 22 28 25 · ROFUS', noHistory: 'No rounds yet', soundOn: 'Sound on', soundOff: 'Sound off',
      hintLabel: 'Basic strategy', stRounds: 'Rounds', stWinRate: 'Won', stBlackjacks: 'Blackjacks', stNet: 'Net', stBest: 'Biggest win', stStreak: 'Best streak', stWagered: 'Wagered',
      rulesTitle: 'How to play', rulesIntro: 'Get closest to 21 without going over. Face cards count 10, aces 1 or 11. The dealer draws to 16 and stands on 17. Blackjack pays 3:2.',
      rDecks: 'Decks', rS17: 'Dealer stands on', rS17v: 'All 17s', rH17v: 'Hard 17 (hits soft 17)', rBJ: 'Blackjack pays', rIns: 'Insurance pays', rPeek: 'Dealer peeks for blackjack', rPeekV: 'On ace and ten',
      rDouble: 'Double', rDoubleV: 'On any two cards', rDAS: 'Double after split', rSplit: 'Split', rSplitV: 'Up to {n} hands', rAces: 'Split aces', rAcesV: 'One card each, no re-split', rSurr: 'Surrender', rSurrV: 'Late, first two cards only',
      rLimits: 'Bet limits', rCut: 'Shuffle', rCutV: 'At {pct} % of the shoe', yes: 'Yes', no: 'No', keys: 'Keyboard', kDeal: 'Deal / rebet', kHit: 'Hit', kStand: 'Stand', kDouble: 'Double', kSplit: 'Split', kSurr: 'Surrender', kIns: 'Insurance yes / no', kEsc: 'Close',
      recent: 'Recent rounds', chips: 'Chips', dealerLabel: 'Dealer',
    },
  };
  const settings = { theme: 'auto', lang: 'da', speed: 'normal', sound: true, hints: false, haptics: true };
  const t = (k, p = {}) => (I18N[settings.lang][k] || I18N.da[k] || k).replace(/\{(\w+)\}/g, (_, n) => p[n] != null ? p[n] : '');
  const fmt = n => new Intl.NumberFormat(settings.lang === 'da' ? 'da-DK' : 'en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n) + ' kr.';

  /* ---------------- persistence ---------------- */
  const KEY = 'blackjack.apple.v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ balance: game.balance, settings, stats: game.stats, history: game.history.slice(0, 20) })); } catch (e) { /* ignore */ }
  }
  const saved = load();
  if (saved && saved.settings) Object.assign(settings, saved.settings);

  /* ---------------- game + sound ---------------- */
  const game = new BJ.Game({ balance: saved && typeof saved.balance === 'number' ? saved.balance : undefined, stats: saved && saved.stats ? saved.stats : undefined });
  if (saved && Array.isArray(saved.history)) game.history = saved.history;
  const sound = new Sound();
  sound.setEnabled(settings.sound);
  let busy = false;
  let speedFactor = 1;

  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms * speedFactor * (reduceMotion.matches ? 0.35 : 1))));
  const haptic = p => { if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* ignore */ } } };

  /* ---------------- DOM refs ---------------- */
  const el = {
    intro: $('#intro'), balance: $('#balance'), balanceBox: $('#balanceBox'), history: $('#history'),
    dealerCards: $('#dealerCards'), dealerValue: $('#dealerValue'), hands: $('#hands'), message: $('#message'),
    betSpot: $('#betSpot'), betStack: $('#betStack'), betAmount: $('#betAmount'), sideBets: $('#sideBets'), shoe: $('#shoe'), shoeFill: $('#shoeFill'),
    chips: $('#chips'), hint: $('#hint'), toast: $('#toast'), announce: $('#announce'), busyText: $('#busyText'),
    btnDeal: $('#btnDeal'), btnUndo: $('#btnUndo'), btnClear: $('#btnClear'), btnDoubleBet: $('#btnDoubleBet'), btnRebet: $('#btnRebet'),
    btnHit: $('#btnHit'), btnStand: $('#btnStand'), btnDouble: $('#btnDouble'), btnSplit: $('#btnSplit'), btnSurrender: $('#btnSurrender'),
    btnInsYes: $('#btnInsYes'), btnInsNo: $('#btnInsNo'), insuranceTitle: $('#insuranceTitle'), insuranceSub: $('#insuranceSub'),
    btnNewBet: $('#btnNewBet'), btnRebetDeal: $('#btnRebetDeal'), btnSound: $('#btnSound'), btnSettings: $('#btnSettings'),
    backdrop: $('#backdrop'), sheetSettings: $('#sheetSettings'), sheetRules: $('#sheetRules'), sheetConfirm: $('#sheetConfirm'),
    stats: $('#stats'), rulesBody: $('#rulesBody'), introFine: $('#introFine'), introCards: $('#introCards'),
  };

  /* ---------------- theme / language / speed ---------------- */
  const mqLight = window.matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const eff = settings.theme === 'auto' ? (mqLight.matches ? 'light' : 'dark') : settings.theme;
    document.documentElement.dataset.theme = eff;
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = eff === 'light' ? '#f5f5f7' : '#000000';
  }
  mqLight.addEventListener('change', applyTheme);
  function applySpeed() { speedFactor = settings.speed === 'fast' ? 0.55 : 1; document.documentElement.style.setProperty('--speed', String(speedFactor)); }
  function applyLang() {
    document.documentElement.lang = settings.lang;
    $$('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
    el.introFine.textContent = t('introFine', { decks: game.rules.decks });
    el.btnSound.setAttribute('aria-label', settings.sound ? t('soundOn') : t('soundOff'));
    el.history.setAttribute('aria-label', t('recent')); el.history.dataset.empty = t('noHistory');
    $('#rulesTitle').textContent = t('rulesTitle'); $('#btnIntroRules').textContent = t('howToPlay');
    renderClock();
    el.chips.setAttribute('aria-label', t('chips'));
    renderRules(); renderStats(); syncSettingsUI();
    if (!busy) renderPhaseMessage();
    renderBet();
  }
  function renderClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    $('#reg').innerHTML = `${t('reg')} · <b>${hh}:${mm}</b>`;
  }
  setInterval(renderClock, 15000);
  function syncSettingsUI() {
    const seg = (id, v) => $$('#' + id + ' button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)));
    seg('segTheme', settings.theme); seg('segLang', settings.lang); seg('segSpeed', settings.speed);
    $('#swSound').checked = settings.sound; $('#swHints').checked = settings.hints; $('#swHaptics').checked = settings.haptics;
    el.btnSound.setAttribute('aria-pressed', String(settings.sound));
  }

  /* ---------------- cards ---------------- */
  function cardEl(card, faceDown) {
    const d = document.createElement('div');
    d.className = 'card' + (faceDown ? ' face-down' : '');
    d.innerHTML = `<div class="card-inner"><div class="card-face card-front">${Cards.svg(card.rank, card.suit)}</div><div class="card-face card-back">${Cards.back()}</div></div>`;
    d.setAttribute('aria-label', faceDown ? '' : Cards.label(card.rank, card.suit, settings.lang));
    d.dataset.id = card.id;
    return d;
  }
  function setCount(container, n) { container.style.setProperty('--n', n); }
  /** Deal a card from the shoe into a container with a FLIP animation. */
  async function dealCard(container, card, { faceDown = false, sideways = false } = {}) {
    const n = container.children.length;
    const c = cardEl(card, true);
    c.style.setProperty('--i', n);
    if (sideways) c.classList.add('sideways');
    container.appendChild(c);
    if (!faceDown) c.setAttribute('aria-label', Cards.label(card.rank, card.suit, settings.lang));
    setCount(container, n + 1);
    const from = el.shoe.getBoundingClientRect();
    const to = c.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const dur = 420 * speedFactor * (reduceMotion.matches ? 0.3 : 1);
    c.classList.add('flying');
    el.shoe.classList.remove('pull'); void el.shoe.offsetWidth; el.shoe.classList.add('pull');
    if (!faceDown) setTimeout(() => c.classList.remove('face-down'), reduceMotion.matches ? 0 : dur * 0.45);
    const anim = c.animate([
      { transform: `translate(${dx}px, ${dy}px) rotate(-10deg) scale(${from.width / to.width})`, opacity: 0.6 },
      { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
    ], { duration: dur, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
    sound.deal();
    await anim.finished.catch(() => {});
    anim.commitStyles && anim.cancel();
    c.style.transform = '';
    c.classList.remove('flying');
    if (sideways) c.querySelector('.card-inner').style.transform = 'rotate(90deg)';
    return c;
  }
  function relayout(container) { Array.from(container.children).forEach((c, i) => c.style.setProperty('--i', i)); setCount(container, container.children.length); }

  /* ---------------- hands ---------------- */
  const handEls = [];
  function handEl(i) {
    const h = document.createElement('div');
    h.className = 'hand'; h.dataset.index = i;
    h.innerHTML = `<div class="hand-top"><span class="badge badge-value" hidden></span><span class="badge badge-bet" hidden></span></div>
      <div class="cards-wrap"><div class="cards" style="--n:0"></div><div class="hand-result" role="status"></div></div>`;
    return h;
  }
  function cardsOf(i) { return $('.cards', handEls[i]); }
  function updateBadge(badge, v, opts = {}) {
    badge.hidden = false;
    badge.textContent = v.soft && !v.bust && v.total !== 21 ? `${v.total - 10} / ${v.total}` : String(v.total);
    badge.classList.toggle('badge-bust', !!v.bust);
    badge.classList.toggle('badge-21', v.total === 21 && !opts.blackjack);
    badge.classList.toggle('badge-bj', !!opts.blackjack);
    if (opts.blackjack) badge.textContent = t('blackjack');
    badge.classList.remove('pop'); void badge.offsetWidth; badge.classList.add('pop');
  }
  function updateHandBadge(i) {
    const h = game.hands[i]; if (!h || !handEls[i]) return;
    const v = BJ.handValue(h.cards);
    updateBadge($('.badge-value', handEls[i]), v, { blackjack: BJ.isNatural(h.cards) && !h.fromSplit });
    const bb = $('.badge-bet', handEls[i]);
    bb.hidden = !(game.hands.length > 1 || h.doubled);
    bb.textContent = fmt(h.bet);
  }
  function updateDealerBadge() {
    const d = game.dealer;
    if (!d.cards.length) { el.dealerValue.hidden = true; return; }
    const v = d.holeHidden ? BJ.handValue(d.cards.slice(0, 1)) : BJ.handValue(d.cards);
    updateBadge(el.dealerValue, v, { blackjack: !d.holeHidden && BJ.isNatural(d.cards) });
  }
  function setActiveHand(i) {
    handEls.forEach((h, k) => {
      h.classList.toggle('active', k === i);
      h.classList.toggle('inactive', i >= 0 && k !== i && !game.hands[k].done);
      h.classList.toggle('done', game.hands[k].done && k !== i);
    });
  }
  function clearTable() {
    el.dealerCards.innerHTML = ''; setCount(el.dealerCards, 0);
    el.hands.innerHTML = ''; handEls.length = 0; el.hands.dataset.count = 0;
    el.dealerValue.hidden = true;
    el.sideBets.innerHTML = '';
  }
  async function sweepTable() {
    const cards = $$('.card', el.dealerCards).concat($$('.hand .card'));
    if (!cards.length) return;
    const dur = 350 * speedFactor;
    cards.forEach((c, i) => c.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(40px, -60px) rotate(6deg)', opacity: 0 }], { duration: dur, delay: i * 20, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }));
    $$('.hand-result').forEach(r => r.classList.remove('show'));
    await wait(dur + cards.length * 20);
    clearTable();
  }

  /* ---------------- bet spot ---------------- */
  function chipEl(value, k) {
    const b = document.createElement(k == null ? 'button' : 'div');
    b.className = 'chip'; b.dataset.value = value;
    if (k != null) { b.style.setProperty('--k', k); b.style.setProperty('--rot', (((k * 7919) % 9) - 4) * 0.6 + 'deg'); } else b.type = 'button';
    b.innerHTML = `<span class="chip-value">${value >= 1000 ? (value / 1000) + 'K' : value}</span>`;
    b.setAttribute('aria-label', fmt(value));
    return b;
  }
  function renderBet() {
    const chips = game.phase === BJ.PHASE.BETTING ? game.betChips : game.hands.reduce((a, h) => a.concat(BJ.decompose(h.bet, game.rules.chips)), []);
    const total = game.phase === BJ.PHASE.BETTING ? game.bet : game.hands.reduce((s, h) => s + h.bet, 0);
    el.betStack.innerHTML = '';
    const shown = chips.slice(-24);
    shown.forEach((v, k) => el.betStack.appendChild(chipEl(v, k)));
    el.betSpot.classList.toggle('has-bet', total > 0);
    el.betAmount.textContent = total > 0 ? fmt(total) : '';
    el.betAmount.classList.remove('pop'); void el.betAmount.offsetWidth; el.betAmount.classList.add('pop');
    renderBetControls();
  }
  function renderBetControls() {
    const betting = game.phase === BJ.PHASE.BETTING;
    $$('.chip', el.chips).forEach(c => { c.disabled = !betting || !game.canAddChip(+c.dataset.value).ok; });
    el.btnUndo.disabled = !betting || !game.betChips.length;
    el.btnClear.disabled = !betting || !game.bet;
    el.btnDoubleBet.disabled = !betting || !game.bet || game.bet * 2 > game.rules.maxBet || game.bet * 2 > game.balance;
    el.btnRebet.disabled = !betting || !game.lastBet || game.lastBet > game.balance || game.lastBet === game.bet;
    const broke = betting && game.balance < game.rules.minBet && game.bet < game.rules.minBet;
    el.btnDeal.textContent = broke ? t('getChips', { amt: fmt(game.rules.startBalance) }) : t('deal');
    el.btnDeal.dataset.mode = broke ? 'reset' : 'deal';
    el.btnDeal.disabled = !betting || (!broke && !game.canDeal().ok);
    if (betting) el.btnDeal.title = broke ? '' : (game.canDeal().ok ? '' : t('minBet', { amt: fmt(game.rules.minBet) }));
    el.btnRebetDeal.disabled = !(game.phase === BJ.PHASE.SETTLED && game.lastBet && game.lastBet <= game.balance);
  }
  async function flyChip(fromEl, value) {
    if (reduceMotion.matches) return;
    const from = fromEl.getBoundingClientRect();
    const to = el.betStack.getBoundingClientRect();
    const ghost = chipEl(value, 0); ghost.classList.add('fly');
    ghost.style.left = from.left + 'px'; ghost.style.top = from.top + 'px'; ghost.style.width = from.width + 'px'; ghost.style.height = from.height + 'px';
    document.body.appendChild(ghost);
    const dx = to.left - from.left - from.width / 2, dy = to.top - from.top - from.height / 2 - 2.5 * Math.min(game.betChips.length, 24);
    const a = ghost.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.55 - 30}px) scale(0.9)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${44 / from.width})` },
    ], { duration: 380 * speedFactor, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
    await a.finished.catch(() => {});
    ghost.remove();
  }
  async function stackTo(target, { fade = true } = {}) {
    // Send the bet stack towards a target (balance = payout, dealer = loss).
    const chips = $$('.chip', el.betStack);
    if (!chips.length || reduceMotion.matches) { return; }
    const to = target.getBoundingClientRect();
    const from = el.betStack.getBoundingClientRect();
    const dx = to.left + to.width / 2 - from.left, dy = to.top + to.height / 2 - from.top;
    const dur = 520 * speedFactor;
    chips.forEach((c, i) => c.animate([
      { transform: getComputedStyle(c).transform, opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.4)`, opacity: fade ? 0 : 1 },
    ], { duration: dur, delay: i * 12, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' }));
    await wait(dur + chips.length * 12);
  }

  /* ---------------- balance ---------------- */
  let shownBalance = game.balance;
  function renderBalance(animate = true) {
    const target = game.balance;
    if (!animate || reduceMotion.matches || shownBalance === target) { shownBalance = target; el.balance.textContent = fmt(target); return; }
    const start = shownBalance, delta = target - start, dur = 700 * speedFactor, t0 = performance.now();
    el.balance.classList.toggle('up', delta > 0); el.balance.classList.toggle('down', delta < 0);
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      shownBalance = Math.round((start + delta * e) * 2) / 2;
      el.balance.textContent = fmt(shownBalance);
      if (p < 1) requestAnimationFrame(step); else { shownBalance = target; el.balance.textContent = fmt(target); setTimeout(() => el.balance.classList.remove('up', 'down'), 600); }
    };
    requestAnimationFrame(step);
  }
  function floatAmount(amount, fromEl) {
    const r = fromEl.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'float-up' + (amount < 0 ? ' neg' : '');
    f.textContent = (amount > 0 ? '+' : amount < 0 ? '−' : '') + fmt(Math.abs(amount));
    f.style.left = (r.left + r.width / 2) + 'px'; f.style.top = (r.top - 8) + 'px';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  /* ---------------- messages ---------------- */
  let msgTimer = null;
  function message(text, cls = '') {
    clearTimeout(msgTimer);
    el.message.classList.add('hide');
    msgTimer = setTimeout(() => { el.message.innerHTML = text; el.message.className = 'message ' + cls; }, 120);
  }
  function announce(text) { el.announce.textContent = ''; setTimeout(() => { el.announce.textContent = text; }, 50); }
  let toastTimer = null;
  function toast(text) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }
  function renderPhaseMessage() {
    if (game.phase === BJ.PHASE.BETTING) {
      if (game.balance < game.rules.minBet && game.bet < game.rules.minBet) message(t('outOfChips'));
      else message(t('placeBet'), 'sub');
    }
  }
  function setPhase(p) { app.dataset.phase = p; renderBetControls(); armIdle(); }
  let idleTimer = null;
  function armIdle() {
    clearTimeout(idleTimer);
    if (game.phase !== BJ.PHASE.BETTING || app.dataset.phase === 'intro') return;
    idleTimer = setTimeout(() => { if (game.phase === BJ.PHASE.BETTING && !busy && !openSheetEl && game.balance >= game.rules.minBet) message(t('idle'), 'sub'); }, 45000);
  }

  /* ---------------- hint ---------------- */
  function renderHint() {
    $$('.btn-act').forEach(b => b.classList.remove('suggested'));
    if (!settings.hints || game.phase !== BJ.PHASE.PLAYER || game.activeHand < 0) { el.hint.hidden = true; return; }
    const h = game.hands[game.activeHand];
    const s = BJ.basicStrategy(h.cards, game.dealer.cards[0], game.availableActions());
    const map = { hit: el.btnHit, stand: el.btnStand, double: el.btnDouble, split: el.btnSplit, surrender: el.btnSurrender };
    const btn = map[s];
    if (btn && !btn.disabled) btn.classList.add('suggested');
    el.hint.innerHTML = `${t('hintLabel')}: <b>${t(s)}</b>`;
    el.hint.hidden = false;
  }

  /* ---------------- history / stats / rules ---------------- */
  function renderHistory() {
    el.history.innerHTML = '';
    game.history.slice(0, 10).reverse().forEach(r => {
      const i = document.createElement('i');
      i.className = r.outcomes.includes('blackjack') ? 'b' : r.net > 0 ? 'w' : r.net < 0 ? 'l' : 'p';
      i.title = (r.net > 0 ? '+' : '') + fmt(r.net);
      el.history.appendChild(i);
    });
  }
  function renderStats() {
    const s = game.stats;
    const rate = s.rounds ? Math.round((s.won / s.rounds) * 100) + ' %' : '–';
    const rows = [[t('stRounds'), s.rounds], [t('stWinRate'), rate], [t('stBlackjacks'), s.blackjacks], [t('stNet'), (s.net > 0 ? '+' : '') + fmt(s.net)], [t('stBest'), fmt(s.biggestWin)], [t('stStreak'), s.bestStreak], [t('stWagered'), fmt(s.wagered)]];
    el.stats.innerHTML = rows.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  }
  function renderRules() {
    const r = game.rules;
    const rows = [
      [t('rDecks'), r.decks], [t('rS17'), r.dealerHitsSoft17 ? t('rH17v') : t('rS17v')], [t('rBJ'), '3:2'], [t('rIns'), '2:1'], [t('rPeek'), t('rPeekV')],
      [t('rDouble'), t('rDoubleV')], [t('rDAS'), r.doubleAfterSplit ? t('yes') : t('no')], [t('rSplit'), t('rSplitV', { n: r.maxSplits + 1 })], [t('rAces'), t('rAcesV')],
      [t('rSurr'), r.lateSurrender ? t('rSurrV') : t('no')], [t('rLimits'), `${fmt(r.minBet)} – ${fmt(r.maxBet)}`], [t('rCut'), t('rCutV', { pct: Math.round(r.penetration * 100) })],
    ];
    const keys = [['␣', t('kDeal')], ['H', t('kHit')], ['S', t('kStand')], ['D', t('kDouble')], ['P', t('kSplit')], ['R', t('kSurr')], ['Y / N', t('kIns')], ['Esc', t('kEsc')]];
    el.rulesBody.innerHTML = `<p class="rules-intro">${t('rulesIntro')}</p><ul class="rules-list">${rows.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
      <h3 class="rules-h">${t('keys')}</h3><div class="kbd-list">${keys.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>`;
  }
  function renderShoe() {
    const s = game.shoe;
    el.shoeFill.style.transform = `scaleX(${Math.max(0.04, s.remaining / s.total)})`;
  }

  /* ---------------- event playback ---------------- */
  const OUTCOME_CLASS = { win: 'win', blackjack: 'bj', evenMoney: 'win', push: 'push', lose: 'lose', bust: 'lose', surrender: 'lose' };
  function outcomeText(r) {
    const amt = r.net !== 0 ? `<small>${r.net > 0 ? '+' : '−'}${fmt(Math.abs(r.net))}</small>` : '';
    const label = { win: t('won'), blackjack: '3 : 2', evenMoney: t('evenMoneyLabel'), push: t('push'), lose: t('lost'), bust: t('bust'), surrender: t('surrendered') }[r.outcome];
    return `<span>${label}</span>${amt}`;
  }
  async function play(events) {
    for (const e of events) {
      switch (e.type) {
        case 'shuffle': {
          el.shoe.classList.add('shuffling'); toast(t('shuffling')); sound.shuffle();
          await wait(1500); el.shoe.classList.remove('shuffling'); renderShoe();
          break;
        }
        case 'roundStart': {
          setPhase('dealing'); el.busyText.textContent = t('dealing');
          clearTable();
          const h = handEl(0); el.hands.appendChild(h); handEls.push(h); el.hands.dataset.count = 1;
          renderBalance(); renderBet(); message('');
          haptic(8);
          await wait(120);
          break;
        }
        case 'deal': {
          if (e.to === 'player') { await dealCard(cardsOf(e.hand), e.card); updateHandBadge(e.hand); }
          else { await dealCard(el.dealerCards, e.card, { faceDown: !!e.faceDown }); if (!e.faceDown) updateDealerBadge(); }
          renderShoe();
          await wait(180);
          break;
        }
        case 'insuranceOffer': case 'evenMoneyOffer': {
          const even = e.type === 'evenMoneyOffer';
          el.insuranceTitle.textContent = even ? t('evenMoneyQ') : t('insuranceQ');
          el.insuranceSub.textContent = even ? t('evenMoneySub', { amt: fmt(game.bet) }) : t('insuranceSub', { amt: fmt(e.cost) });
          el.btnInsYes.textContent = even ? t('takeEvenMoney') : t('insureFor', { amt: fmt(e.cost) });
          el.btnInsNo.textContent = even ? t('keepPlaying') : t('noThanks');
          message(even ? t('evenMoneyLabel') + '?' : t('insuranceLabel') + '?');
          announce(el.insuranceSub.textContent);
          sound.notify();
          setPhase('insurance');
          break;
        }
        case 'insuranceTaken': {
          renderBalance();
          const sb = document.createElement('span'); sb.className = 'side-bet'; sb.id = 'insuranceChip'; sb.textContent = t('insuranceBet', { amt: fmt(e.amount) });
          el.sideBets.appendChild(sb); sound.chip();
          await wait(350);
          break;
        }
        case 'insuranceDeclined': break;
        case 'evenMoneyTaken': { toast(t('evenMoneyTaken')); sound.chip(); await wait(300); break; }
        case 'peek': {
          setPhase('dealing'); el.busyText.textContent = t('dealerChecks');
          message(t('dealerChecks'), 'sub');
          const hole = el.dealerCards.children[1];
          if (hole) { hole.classList.add('peek'); }
          await wait(900);
          if (hole) hole.classList.remove('peek');
          await wait(250);
          if (e.blackjack) { message(t('dealerBlackjack')); announce(t('dealerBlackjack')); }
          break;
        }
        case 'insuranceLost': {
          const sb = $('#insuranceChip'); if (sb) { sb.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: 'forwards' }); setTimeout(() => sb.remove(), 420); }
          toast(t('insuranceLost'));
          await wait(400);
          break;
        }
        case 'reveal': {
          const hole = el.dealerCards.children[1];
          if (hole && hole.classList.contains('face-down')) {
            hole.classList.remove('face-down'); hole.setAttribute('aria-label', Cards.label(e.card.rank, e.card.suit, settings.lang));
            sound.flip();
            await wait(600);
          }
          updateDealerBadge();
          await wait(250);
          break;
        }
        case 'activeHand': {
          setPhase('player');
          setActiveHand(e.hand);
          updateHandBadge(e.hand);
          const many = game.hands.length > 1;
          message(many ? t('handOf', { n: e.hand + 1, m: game.hands.length }) : t('yourTurn'), many ? '' : 'sub');
          renderActions(e.actions);
          renderHint();
          announce((many ? t('handOf', { n: e.hand + 1, m: game.hands.length }) + '. ' : '') + describeHand(e.hand));
          break;
        }
        case 'card': {
          await dealCard(cardsOf(e.hand), e.card); updateHandBadge(e.hand); renderShoe();
          await wait(160);
          break;
        }
        case 'double': {
          renderBalance(); renderBet();
          sound.chips(2); haptic(10);
          await wait(250);
          await dealCard(cardsOf(e.hand), e.card, { sideways: true }); updateHandBadge(e.hand); renderShoe();
          await wait(350);
          break;
        }
        case 'split': {
          setPhase('dealing'); el.busyText.textContent = '';
          renderBalance(); renderBet(); sound.chips(2);
          const src = cardsOf(e.hand);
          const moving = src.children[1];
          const nh = handEl(e.newHand);
          handEls.splice(e.newHand, 0, nh);
          handEls[e.hand].after(nh);
          handEls.forEach((h, k) => { h.dataset.index = k; });
          el.hands.dataset.count = game.hands.length;
          const dst = cardsOf(e.newHand);
          const before = moving.getBoundingClientRect();
          dst.appendChild(moving); moving.style.setProperty('--i', 0); setCount(dst, 1); relayout(src);
          const after = moving.getBoundingClientRect();
          moving.animate([{ transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` }, { transform: 'translate(0,0)' }], { duration: 380 * speedFactor, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
          updateHandBadge(e.hand); updateHandBadge(e.newHand);
          await wait(420);
          break;
        }
        case 'bust': {
          updateHandBadge(e.hand);
          handEls[e.hand].classList.add('dim');
          sound.bust(); haptic([20, 40, 20]);
          message(t('bust'));
          await wait(550);
          break;
        }
        case 'twentyOne': { updateHandBadge(e.hand); await wait(450); break; }
        case 'stand': { setPhase('dealing'); el.busyText.textContent = ''; el.hint.hidden = true; await wait(300); break; }
        case 'surrender': {
          setPhase('dealing'); el.busyText.textContent = '';
          handEls[e.hand].classList.add('dim'); sound.push();
          message(t('surrendered'));
          await wait(400);
          break;
        }
        case 'dealerCard': {
          setPhase('dealer'); el.busyText.textContent = t('dealerDraws'); message(t('dealerDraws'), 'sub');
          await dealCard(el.dealerCards, e.card); updateDealerBadge(); renderShoe();
          await wait(520);
          break;
        }
        case 'dealerBust': { updateDealerBadge(); message(t('dealerBust')); sound.bust(); await wait(500); break; }
        case 'dealerStand': { message(t('dealerHas', { n: e.value.total }), 'sub'); await wait(350); break; }
        case 'settle': { await settle(e); break; }
        case 'roundEnd': { renderBet(); renderShoe(); if (e.shuffleNext) toast(t('cutCard')); break; }
        default: break;
      }
    }
  }
  function describeHand(i) {
    const h = game.hands[i]; const v = BJ.handValue(h.cards);
    return h.cards.map(c => Cards.label(c.rank, c.suit, settings.lang)).join(', ') + ' = ' + v.total + '. ' + t('dealerLabel') + ': ' + Cards.label(game.dealer.cards[0].rank, game.dealer.cards[0].suit, settings.lang);
  }
  function renderActions(a) {
    el.btnHit.disabled = !a.hit; el.btnStand.disabled = !a.stand; el.btnDouble.disabled = !a.double; el.btnSplit.disabled = !a.split; el.btnSurrender.disabled = !a.surrender;
    el.btnSurrender.hidden = !game.rules.lateSurrender;
  }
  async function settle(e) {
    setPhase('dealing'); el.busyText.textContent = '';
    el.hint.hidden = true;
    setActiveHand(-1); handEls.forEach(h => h.classList.remove('inactive', 'done'));
    const anyBJ = e.results.some(r => r.outcome === 'blackjack');
    // Per-hand labels, staggered.
    for (const r of e.results) {
      const lab = $('.hand-result', handEls[r.hand]);
      lab.className = 'hand-result ' + OUTCOME_CLASS[r.outcome];
      lab.innerHTML = outcomeText(r);
      lab.classList.add('show');
      if (r.outcome === 'blackjack') {
        const g = document.createElement('div'); g.className = 'glow'; $('.cards-wrap', handEls[r.hand]).prepend(g); setTimeout(() => g.remove(), 1700);
        if (!reduceMotion.matches) $$('.card-front', handEls[r.hand]).forEach((f, k) => setTimeout(() => { const sw = document.createElement('div'); sw.className = 'sweep'; f.appendChild(sw); setTimeout(() => sw.remove(), 1000); }, 150 + k * 110));
      }
      else if (r.net > 0) { const g = document.createElement('div'); g.className = 'glow green'; $('.cards-wrap', handEls[r.hand]).prepend(g); setTimeout(() => g.remove(), 1700); }
      if (r.net < 0 && r.outcome !== 'bust') handEls[r.hand].classList.add('dim');
      await wait(e.results.length > 1 ? 260 : 0);
    }
    if (e.insurance && e.insurance.outcome === 'win') toast(t('insuranceWon', { amt: fmt(e.insurance.net) }));
    // Sound + haptics + headline.
    if (anyBJ) { sound.blackjack(); haptic([15, 30, 15, 30, 40]); }
    else if (e.net > 0) { sound.win(); haptic([15, 40, 25]); }
    else if (e.net < 0) { sound.lose(); haptic(30); }
    else { sound.push(); }
    if (anyBJ && e.net > 0) message(`${t('blackjack')}<span class="dot">.</span>`, 'big');
    else if (e.net > 0) message(t('youWon', { amt: `<span class="amount">${fmt(e.net)}</span>` }));
    else if (e.net < 0) message(t('youLost'));
    else message(t('push'));
    announce(e.net > 0 ? t('youWon', { amt: fmt(e.net) }) : e.net < 0 ? t('youLost') : t('push'));
    await wait(500);
    // Chips: payout to balance or loss to dealer.
    if (e.payout > 0) {
      floatAmount(e.net, el.betSpot);
      await stackTo(el.balanceBox);
    } else {
      await stackTo(el.dealerCards);
    }
    el.betStack.innerHTML = ''; el.betAmount.textContent = ''; el.betSpot.classList.remove('has-bet');
    renderBalance();
    if (e.net !== 0) sound.counter();
    renderHistory(); renderStats(); renderShoe(); save();
    await wait(450);
    setPhase('settled');
    renderBetControls();
  }

  /* ---------------- actions ---------------- */
  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await play(fn()); }
    catch (err) { if (!(err instanceof BJ.GameError)) console.error(err); }
    finally { busy = false; renderBetControls(); }
  }
  function addChip(value, fromEl) {
    if (busy || game.phase !== BJ.PHASE.BETTING) return;
    const c = game.canAddChip(value);
    if (!c.ok) {
      toast(c.reason === 'max' ? t('maxBet', { amt: fmt(game.rules.maxBet) }) : t('noFunds'));
      el.betSpot.classList.remove('shake'); void el.betSpot.offsetWidth; el.betSpot.classList.add('shake');
      return;
    }
    game.addChip(value);
    sound.chip(); haptic(6);
    if (fromEl) flyChip(fromEl, value).then(() => renderBet()); else renderBet();
    renderBetControls();
    message('');
  }
  async function onDeal() {
    if (busy) return;
    if (el.btnDeal.dataset.mode === 'reset') { openConfirm(true); return; }
    const c = game.canDeal();
    if (!c.ok) { toast(c.reason === 'min' ? t('minBet', { amt: fmt(game.rules.minBet) }) : c.reason === 'max' ? t('maxBet', { amt: fmt(game.rules.maxBet) }) : t('noFunds')); return; }
    await run(() => game.deal());
  }
  async function onNextRound(rebetAndDeal) {
    if (busy || game.phase !== BJ.PHASE.SETTLED) return;
    busy = true;
    try {
      game.nextRound();
      setPhase('dealing'); el.busyText.textContent = '';
      await sweepTable();
      setPhase('betting');
      renderBet(); renderShoe(); save();
      if (game.balance < game.rules.minBet) { renderPhaseMessage(); setTimeout(() => openConfirm(true), 350); return; }
      if (rebetAndDeal && game.lastBet && game.lastBet <= game.balance) {
        game.rebet(); renderBet(); sound.chips(3);
        await wait(320);
        busy = false;
        await run(() => game.deal());
        return;
      }
      renderPhaseMessage();
      if (game.lastBet && game.lastBet <= game.balance) { /* keep it quick: chips ready */ }
    } finally { busy = false; renderBetControls(); }
  }
  function openConfirm(empty) {
    $('#confirmTitle').textContent = empty ? t('emptyTitle') : t('resetQ');
    $('#confirmText').textContent = empty ? t('emptyText', { amt: fmt(game.rules.startBalance) }) : t('resetText', { amt: fmt(game.rules.startBalance) });
    $('#btnConfirm').textContent = empty ? t('startOver') : t('reset');
    openSheet(el.sheetConfirm);
  }
  function doReset() {
    if (game.phase !== BJ.PHASE.BETTING) return;
    game.resetBalance(); renderBalance(); renderBet(); renderPhaseMessage(); save(); closeSheets(); sound.chips(3);
  }

  /* ---------------- sheets ---------------- */
  let openSheetEl = null, lastFocus = null;
  function openSheet(s) {
    lastFocus = document.activeElement;
    closeSheets(true);
    openSheetEl = s; s.hidden = false; el.backdrop.hidden = false;
    requestAnimationFrame(() => { s.classList.add('show'); el.backdrop.classList.add('show'); });
    const f = $('button, input', s); if (f) setTimeout(() => f.focus(), 50);
    if (s === el.sheetSettings) renderStats();
  }
  function closeSheets(immediate) {
    if (!openSheetEl) return;
    const s = openSheetEl; openSheetEl = null;
    s.classList.remove('show'); el.backdrop.classList.remove('show');
    const done = () => { s.hidden = true; el.backdrop.hidden = true; };
    if (immediate) done(); else setTimeout(done, 320);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  /* ---------------- intro ---------------- */
  function buildIntro() {
    const spec = [['A', 'S', -14, 'left: 6%; bottom: 14%', 1], ['K', 'H', 8, 'right: 8%; top: 12%', 2], ['Q', 'C', -6, 'right: 16%; bottom: 10%', 3], ['10', 'D', 12, 'left: 12%; top: 16%', 4]];
    el.introCards.innerHTML = '';
    spec.forEach(([r, s, rot, pos, i]) => {
      const c = document.createElement('div'); c.className = 'card'; c.style.cssText = pos + `; --r:${rot}deg; --r0:${rot * 2}deg; animation-delay:${0.25 + i * 0.12}s`;
      c.innerHTML = `<div class="card-inner"><div class="card-face card-front">${Cards.svg(r, s)}</div></div>`;
      el.introCards.appendChild(c);
    });
  }
  function leaveIntro() {
    if (app.dataset.phase !== 'intro') return;
    sound.unlock();
    el.intro.classList.add('leave');
    setTimeout(() => { el.intro.hidden = true; }, 650);
    setPhase('betting'); renderPhaseMessage(); renderBet();
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    // chip tray
    game.rules.chips.forEach(v => { const c = chipEl(v); el.chips.appendChild(c); c.addEventListener('click', () => addChip(v, c)); });
    el.btnUndo.addEventListener('click', () => { if (busy) return; game.removeLastChip(); sound.tap(); renderBet(); });
    el.btnClear.addEventListener('click', () => { if (busy) return; game.clearBet(); sound.tap(); renderBet(); });
    el.btnDoubleBet.addEventListener('click', () => { if (busy) return; try { game.doubleBet(); sound.chips(2); } catch (e) { toast(t(e.code === 'max' ? 'maxBet' : 'noFunds', { amt: fmt(game.rules.maxBet) })); } renderBet(); });
    el.btnRebet.addEventListener('click', () => { if (busy) return; try { game.rebet(); sound.chips(3); } catch (e) { toast(t('noFunds')); } renderBet(); });
    el.btnDeal.addEventListener('click', onDeal);
    el.btnHit.addEventListener('click', () => run(() => game.hit()));
    el.btnStand.addEventListener('click', () => run(() => game.stand()));
    el.btnDouble.addEventListener('click', () => run(() => game.double()));
    el.btnSplit.addEventListener('click', () => run(() => game.split()));
    el.btnSurrender.addEventListener('click', () => run(() => game.surrender()));
    el.btnInsYes.addEventListener('click', () => run(() => game.insurance(true)));
    el.btnInsNo.addEventListener('click', () => run(() => game.insurance(false)));
    el.btnNewBet.addEventListener('click', () => onNextRound(false));
    el.btnRebetDeal.addEventListener('click', () => onNextRound(true));
    el.betStack.addEventListener('click', () => { if (busy || game.phase !== BJ.PHASE.BETTING) return; game.removeLastChip(); sound.tap(); renderBet(); });
    $('#btnPlay').addEventListener('click', leaveIntro);
    $('#btnIntroRules').addEventListener('click', () => openSheet(el.sheetRules));
    $('#btnRules2').addEventListener('click', () => openSheet(el.sheetRules));
    $('#btnReset').addEventListener('click', () => { if (game.phase !== BJ.PHASE.BETTING) { toast(t('placeBet')); return; } openConfirm(); });
    $('#btnConfirm').addEventListener('click', doReset);
    el.btnSettings.addEventListener('click', () => openSheet(el.sheetSettings));
    el.btnSound.addEventListener('click', () => { settings.sound = !settings.sound; sound.setEnabled(settings.sound); syncSettingsUI(); applyLang(); save(); if (settings.sound) sound.tap(); });
    $$('[data-close]').forEach(b => b.addEventListener('click', () => closeSheets()));
    el.backdrop.addEventListener('click', () => closeSheets());
    // settings
    $$('#segTheme button').forEach(b => b.addEventListener('click', () => { settings.theme = b.dataset.v; applyTheme(); syncSettingsUI(); save(); }));
    $$('#segLang button').forEach(b => b.addEventListener('click', () => { settings.lang = b.dataset.v; applyLang(); save(); }));
    $$('#segSpeed button').forEach(b => b.addEventListener('click', () => { settings.speed = b.dataset.v; applySpeed(); syncSettingsUI(); save(); }));
    $('#swSound').addEventListener('change', ev => { settings.sound = ev.target.checked; sound.setEnabled(settings.sound); syncSettingsUI(); save(); });
    $('#swHints').addEventListener('change', ev => { settings.hints = ev.target.checked; renderHint(); save(); });
    $('#swHaptics').addEventListener('change', ev => { settings.haptics = ev.target.checked; save(); });
    // audio unlock
    const unlock = () => { sound.unlock(); sound.resume(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(evn => document.addEventListener(evn, unlock, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sound.resume(); });
    ['pointerdown', 'keydown'].forEach(evn => document.addEventListener(evn, armIdle, { passive: true }));
    // keyboard
    document.addEventListener('keydown', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'escape') { if (openSheetEl) { closeSheets(); ev.preventDefault(); } return; }
      if (openSheetEl) return;
      if (app.dataset.phase === 'intro') { if (k === ' ' || k === 'enter') { leaveIntro(); ev.preventDefault(); } return; }
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT') return;
      const ph = game.phase;
      if (k === ' ' || k === 'enter') {
        if (ph === BJ.PHASE.BETTING) { if (!game.bet && game.lastBet && game.lastBet <= game.balance) { game.rebet(); sound.chips(3); renderBet(); } else onDeal(); }
        else if (ph === BJ.PHASE.SETTLED) onNextRound(true);
        ev.preventDefault(); return;
      }
      if (ph === BJ.PHASE.PLAYER) {
        if (k === 'h' && !el.btnHit.disabled) run(() => game.hit());
        else if (k === 's' && !el.btnStand.disabled) run(() => game.stand());
        else if (k === 'd' && !el.btnDouble.disabled) run(() => game.double());
        else if (k === 'p' && !el.btnSplit.disabled) run(() => game.split());
        else if (k === 'r' && !el.btnSurrender.disabled) run(() => game.surrender());
      } else if (ph === BJ.PHASE.INSURANCE) {
        if (k === 'y') run(() => game.insurance(true)); else if (k === 'n') run(() => game.insurance(false));
      } else if (ph === BJ.PHASE.BETTING) {
        const idx = parseInt(k, 10);
        if (idx >= 1 && idx <= game.rules.chips.length) { const c = el.chips.children[idx - 1]; addChip(game.rules.chips[idx - 1], c); }
        else if (k === 'backspace') { game.removeLastChip(); renderBet(); }
      }
    });
  }

  /* ---------------- boot ---------------- */
  if (!navigator.vibrate) { const row = $('#swHaptics').closest('.setting'); if (row) row.hidden = true; }
  applyTheme(); applySpeed(); buildIntro(); wire(); applyLang();
  renderBalance(false); renderBet(); renderHistory(); renderStats(); renderShoe();
  // Debug / test hooks (harmless in production; no effect on outcomes unless used).
  window.__bj = { game, rig: s => game.shoe.rig(s), play, settings, leaveIntro, get busy() { return busy; } };
})();
