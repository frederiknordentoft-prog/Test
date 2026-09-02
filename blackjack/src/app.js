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
      introSub: 'Klassikeren. Uden støj.', play: 'Spil nu', howToPlay: 'Sådan spiller du',
      introFine: '18+\u00a0· {decks}\u00a0kortspil\u00a0· Dealeren står på\u00a017\u00a0· Blackjack betaler\u00a03:2\u00a0· Demo uden rigtige penge',
      balance: 'Saldo', demoBalance: 'Demo-saldo', yourHand: 'Din hånd', yourHands: 'Dine hænder', welcome: 'Velkommen', close: 'Luk', hiddenCard: 'skjult kort', dealer: 'Dealer', betHere: 'Indsats', undo: 'Fortryd', clear: 'Ryd', doubleBet: '×2', rebet: 'Gentag', deal: 'Giv kort',
      surrender: 'Giv op', split: 'Split', double: 'Fordobl', hit: 'Kort', stand: 'Stå', noThanks: 'Nej tak', keepPlaying: 'Vent på 3:2',
      newBet: 'Ny indsats', rebetDeal: 'Gentag og giv kort', settings: 'Indstillinger', theme: 'Udseende', auto: 'Auto', light: 'Lys', dark: 'Mørk',
      language: 'Sprog', speed: 'Tempo', normal: 'Normal', fast: 'Hurtig', sound: 'Lyd', hints: 'Strategihint', haptics: 'Vibration',
      statistics: 'Statistik', rules: 'Regler', resetBalance: 'Nulstil saldo', demoNote: 'Demo. Der spilles ikke med rigtige penge.', cancel: 'Annuller',
      placeBet: 'Vælg din indsats.', ready: 'Tryk på Giv kort, når du er klar.', idle: 'Klar, når du er.', yourTurn: 'Din tur', youDraw: 'Du trækker {card}, i alt {total}', dealerReveals: 'Dealeren vender {card}, i alt {total}', dealerDraws2: 'Dealeren trækker {card}, i alt {total}', balanceIs: 'Saldo {amt}', chip: 'Jeton {amt}', shoeLeft: '{n} kort tilbage i skoen', rcTitle: 'Du har spillet i {n} minutter', rcText: 'Hold gerne en pause. Nettoresultat i denne session: {amt}', continue_: 'Fortsæt', rebetAmt: 'Gentag {amt} og giv kort', resetLocked: 'Kan nulstilles, når runden er slut.', betReturned: 'Indsatsen retur', handOf: 'Hånd {n} af {m}', dealerDraws: 'Dealeren trækker', dealerChecks: 'Dealeren kigger efter blackjack',
      dealerHas: 'Dealeren har {n}', dealerBust: 'Dealeren går bust', dealerBlackjack: 'Dealeren har blackjack', dealing: 'Giver kort …',
      youWon: 'Du vandt {amt}', youLost: 'Dealeren vandt', push: 'Uafgjort', blackjack: 'Blackjack', bust: 'Bust', surrendered: 'Gav op', won: 'Vundet', lost: 'Tabt',
      evenMoneyLabel: 'Lige penge', insuranceQ: 'Dealeren viser et es.', insuranceSub: 'Forsikring koster {amt} og betaler 2:1, hvis dealeren har blackjack.', insureFor: 'Forsikr for {amt}',
      evenMoneyQ: 'Du har blackjack. Dealeren viser et es.', evenMoneySub: 'Tag {amt} nu (1:1), eller vent og få 3:2, hvis dealeren ikke også har blackjack.', takeEvenMoney: 'Tag 1:1',
      insuranceLabel: 'Forsikring', insuranceLost: 'Forsikringen tabt', insuranceWon: 'Forsikringen betaler {amt}', insuranceBet: 'Forsikring {amt}', evenMoneyTaken: 'Lige penge taget',
      shuffling: 'Kortene blandes …', cutCard: 'Kortene blandes inden næste hånd', minBet: 'Mindste indsats er {amt}', maxBet: 'Højeste indsats er {amt}', noFunds: 'Ikke nok på saldoen', outOfChips: 'Tom saldo.',
      getChips: 'Start forfra', resetQ: 'Start forfra?', resetText: 'Saldoen sættes til {amt} i legepenge. Statistikken bevares.', reset: 'Nulstil', emptyTitle: 'Tom saldo.', emptyText: 'Sådan går det nogle gange. Du kan starte forfra med {amt} i legepenge.', startOver: 'Start forfra',
      reg: '18+ · Spil ansvarligt · StopSpillet 70 22 28 25 · ROFUS', noHistory: 'Ingen runder endnu', soundOn: 'Lyd til', soundOff: 'Lyd fra',
      hintLabel: 'Basisstrategi', stRounds: 'Runder', stWinRate: 'Vundet', stBlackjacks: 'Blackjacks', stNet: 'Netto', stBest: 'Største gevinst', stStreak: 'Bedste stime', stWagered: 'Omsat',
      rulesTitle: 'Sådan spiller du', rulesIntro: 'Kom tættest på 21 uden at gå over. Billedkort tæller 10, es tæller 1 eller 11. Dealeren trækker til 16 og står på 17. Blackjack betaler 3:2.',
      rDecks: 'Kortspil', rS17: 'Dealeren står på', rS17v: 'Alle 17', rH17v: 'Hårde 17 (trækker på blød 17)', rBJ: 'Blackjack betaler', rIns: 'Forsikring betaler', rPeek: 'Dealeren kigger efter blackjack', rPeekV: 'Ved es og 10',
      rDouble: 'Fordobling', rDoubleV: 'På alle to kort', rDoubleOn: 'Kun på {range}', rDAS: 'Fordobling efter split', rSplit: 'Split', rSplitV: 'Op til {n} hænder', rAces: 'Splittede esser', rAcesV: 'Ét kort pr. es, kan ikke splittes igen. Es + 10 tæller 21, ikke blackjack', rSurr: 'Giv op (surrender)', rSurrV: 'Sen, kun på de første to kort, ikke efter split', rEven: 'Lige penge', rEvenV: 'Ved egen blackjack mod es, betaler 1:1', rTens: 'Split af 10-kort', rTensV: 'Alle 10-værdier (10, J, Q, K)',
      rLimits: 'Indsats', rCut: 'Blanding', rCutV: 'Ved {pct}\u00a0% af skoen', rRtp: 'Teoretisk tilbagebetaling (RTP)', rRtpV: '99,66\u00a0% med basisstrategi', yes: 'Ja', no: 'Nej', keys: 'Tastatur', kDeal: 'Giv kort / gentag', kHit: 'Kort', kStand: 'Stå', kDouble: 'Fordobl', kSplit: 'Split', kSurr: 'Giv op', kIns: 'Forsikring ja / nej', kEsc: 'Luk',
      recent: 'Seneste runder', chips: 'Jetoner', dealerLabel: 'Dealer',
    },
    en: {
      introSub: 'The classic. Without the noise.', play: 'Play now', howToPlay: 'How to play',
      introFine: '18+\u00a0· {decks}\u00a0decks\u00a0· Dealer stands on\u00a017\u00a0· Blackjack pays\u00a03:2\u00a0· Demo, no real money',
      balance: 'Balance', demoBalance: 'Demo balance', yourHand: 'Your hand', yourHands: 'Your hands', welcome: 'Welcome', close: 'Close', hiddenCard: 'hidden card', dealer: 'Dealer', betHere: 'Bet', undo: 'Undo', clear: 'Clear', doubleBet: '×2', rebet: 'Rebet', deal: 'Deal',
      surrender: 'Surrender', split: 'Split', double: 'Double', hit: 'Hit', stand: 'Stand', noThanks: 'No thanks', keepPlaying: 'Wait for 3:2',
      newBet: 'New bet', rebetDeal: 'Rebet and deal', settings: 'Settings', theme: 'Appearance', auto: 'Auto', light: 'Light', dark: 'Dark',
      language: 'Language', speed: 'Pace', normal: 'Normal', fast: 'Fast', sound: 'Sound', hints: 'Strategy hint', haptics: 'Haptics',
      statistics: 'Statistics', rules: 'Rules', resetBalance: 'Reset balance', demoNote: 'Demo. No real money is played.', cancel: 'Cancel',
      placeBet: 'Place your bet.', ready: 'Tap Deal when you’re ready.', idle: 'Ready when you are.', yourTurn: 'Your turn', youDraw: 'You draw {card}, total {total}', dealerReveals: 'Dealer reveals {card}, total {total}', dealerDraws2: 'Dealer draws {card}, total {total}', balanceIs: 'Balance {amt}', chip: 'Chip {amt}', shoeLeft: '{n} cards left in the shoe', rcTitle: 'You have been playing for {n} minutes', rcText: 'Consider taking a break. Net result this session: {amt}', continue_: 'Continue', rebetAmt: 'Rebet {amt} and deal', resetLocked: 'Available between rounds.', betReturned: 'Bet returned', handOf: 'Hand {n} of {m}', dealerDraws: 'Dealer draws', dealerChecks: 'Dealer checks for blackjack',
      dealerHas: 'Dealer has {n}', dealerBust: 'Dealer busts', dealerBlackjack: 'Dealer has blackjack', dealing: 'Dealing …',
      youWon: 'You won {amt}', youLost: 'Dealer wins', push: 'Push', blackjack: 'Blackjack', bust: 'Bust', surrendered: 'Surrendered', won: 'Won', lost: 'Lost',
      evenMoneyLabel: 'Even money', insuranceQ: 'Dealer shows an ace.', insuranceSub: 'Insurance costs {amt} and pays 2:1 if the dealer has blackjack.', insureFor: 'Insure for {amt}',
      evenMoneyQ: 'You have blackjack. Dealer shows an ace.', evenMoneySub: 'Take {amt} now (1:1), or wait for 3:2 if the dealer does not also have blackjack.', takeEvenMoney: 'Take 1:1',
      insuranceLabel: 'Insurance', insuranceLost: 'Insurance lost', insuranceWon: 'Insurance pays {amt}', insuranceBet: 'Insurance {amt}', evenMoneyTaken: 'Even money taken',
      shuffling: 'Shuffling …', cutCard: 'The shoe is shuffled before the next hand', minBet: 'Minimum bet is {amt}', maxBet: 'Maximum bet is {amt}', noFunds: 'Not enough funds', outOfChips: 'Out of funds.',
      getChips: 'Start over', resetQ: 'Start over?', resetText: 'Your balance is set to {amt} of play money. Statistics are kept.', reset: 'Reset', emptyTitle: 'Out of funds.', emptyText: 'It happens. You can start over with {amt} of play money.', startOver: 'Start over',
      reg: '18+ · Play responsibly · StopSpillet 70 22 28 25 · ROFUS', noHistory: 'No rounds yet', soundOn: 'Sound on', soundOff: 'Sound off',
      hintLabel: 'Basic strategy', stRounds: 'Rounds', stWinRate: 'Won', stBlackjacks: 'Blackjacks', stNet: 'Net', stBest: 'Biggest win', stStreak: 'Best streak', stWagered: 'Wagered',
      rulesTitle: 'How to play', rulesIntro: 'Get closest to 21 without going over. Face cards count 10, aces 1 or 11. The dealer draws to 16 and stands on 17. Blackjack pays 3:2.',
      rDecks: 'Decks', rS17: 'Dealer stands on', rS17v: 'All 17s', rH17v: 'Hard 17 (hits soft 17)', rBJ: 'Blackjack pays', rIns: 'Insurance pays', rPeek: 'Dealer peeks for blackjack', rPeekV: 'On ace and ten',
      rDouble: 'Double', rDoubleV: 'On any two cards', rDoubleOn: 'Only on {range}', rDAS: 'Double after split', rSplit: 'Split', rSplitV: 'Up to {n} hands', rAces: 'Split aces', rAcesV: 'One card each, no further split. Ace + ten counts 21, not blackjack', rSurr: 'Surrender', rSurrV: 'Late, first two cards only, not after a split', rEven: 'Even money', rEvenV: 'On your blackjack vs an ace, pays 1:1', rTens: 'Splitting tens', rTensV: 'Any two ten-value cards',
      rLimits: 'Bet limits', rCut: 'Shuffle', rCutV: 'At {pct}\u00a0% of the shoe', rRtp: 'Theoretical return (RTP)', rRtpV: '99.66\u00a0% with basic strategy', yes: 'Yes', no: 'No', keys: 'Keyboard', kDeal: 'Deal / rebet', kHit: 'Hit', kStand: 'Stand', kDouble: 'Double', kSplit: 'Split', kSurr: 'Surrender', kIns: 'Insurance yes / no', kEsc: 'Close',
      recent: 'Recent rounds', chips: 'Chips', dealerLabel: 'Dealer',
    },
  };
  const settings = { theme: 'auto', lang: 'da', speed: 'normal', sound: true, hints: false, haptics: true };
  const t = (k, p = {}) => (I18N[settings.lang][k] || I18N.da[k] || k).replace(/\{(\w+)\}/g, (_, n) => p[n] != null ? p[n] : '');
  const fmt = n => new Intl.NumberFormat(settings.lang === 'da' ? 'da-DK' : 'en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n).replace('-', '\u2212') + '\u00a0kr.';

  /* ---------------- persistence ---------------- */
  const KEY = 'blackjack.apple.v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  let safeBalance = null, safeStats = null; // as of the last completed round — never a mid-round figure
  function snapshotSafe() { safeBalance = game.balance; safeStats = JSON.parse(JSON.stringify(game.stats)); }
  function save() {
    const inRound = !(game.phase === BJ.PHASE.BETTING || game.phase === BJ.PHASE.SETTLED);
    try { localStorage.setItem(KEY, JSON.stringify({ balance: inRound ? safeBalance : game.balance, settings, stats: inRound ? safeStats : game.stats, history: game.history.slice(0, 20) })); } catch (e) { /* ignore */ }
  }
  const saved = load();
  if (saved && saved.settings && typeof saved.settings === 'object') {
    const v = saved.settings;
    if (['auto', 'light', 'dark'].includes(v.theme)) settings.theme = v.theme;
    if (['da', 'en'].includes(v.lang)) settings.lang = v.lang;
    if (['normal', 'fast'].includes(v.speed)) settings.speed = v.speed;
    for (const k of ['sound', 'hints', 'haptics']) if (typeof v[k] === 'boolean') settings[k] = v[k];
  }
  if (saved && !(Number.isFinite(saved.balance) && saved.balance >= 0)) saved.balance = undefined;
  if (saved && saved.stats && typeof saved.stats !== 'object') saved.stats = undefined;

  /* ---------------- game + sound ---------------- */
  const game = new BJ.Game({ balance: saved && typeof saved.balance === 'number' ? saved.balance : undefined, stats: saved && saved.stats ? saved.stats : undefined });
  if (saved && Array.isArray(saved.history)) game.history = saved.history.filter(e => e && Array.isArray(e.outcomes) && Number.isFinite(e.net));
  const sound = new Sound();
  sound.setEnabled(settings.sound);
  snapshotSafe();
  let busy = false;
  let speedFactor = 1;

  const wait = ms => new Promise(r => setTimeout(r, Math.max(0, ms * speedFactor * (reduceMotion.matches ? 0.35 : 1))));
  const settled = (anim, ms = 1500) => Promise.race([anim.finished.catch(() => {}), new Promise(r => setTimeout(r, ms))]);
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
  function renderIntroFine() {
    const parts = t('introFine', { decks: game.rules.decks }).split(/\u00a0· /);
    el.introFine.innerHTML = parts.map((p, i) => `${i ? '<span class="sep"> · </span>' : ''}<span class="nw">${p}</span>`).join('');
    fitIntroFine();
  }
  function fitIntroFine() { // a separator that would end a line is hidden, so no line starts or ends with '·'
    const segs = $$('.nw', el.introFine), seps = $$('.sep', el.introFine);
    seps.forEach((sp, i) => sp.classList.toggle('hide', segs[i].offsetTop !== segs[i + 1].offsetTop));
  }
  window.addEventListener('resize', () => { if (!el.intro.hidden) fitIntroFine(); });
  function applyLang() {
    document.documentElement.lang = settings.lang;
    $$('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
    $$('[data-i18n-label]').forEach(n => n.setAttribute('aria-label', t(n.dataset.i18nLabel)));
    $$('.chip', el.chips).forEach(c => c.setAttribute('aria-label', t('chip', { amt: fmt(+c.dataset.value) })));
    renderIntroFine();
    el.btnSound.setAttribute('aria-label', settings.sound ? t('soundOn') : t('soundOff'));
    el.history.setAttribute('aria-label', t('recent')); el.history.dataset.empty = t('noHistory');
    $('#rulesTitle').textContent = t('rulesTitle'); $('#btnIntroRules').textContent = t('howToPlay');
    renderClock();
    el.chips.setAttribute('aria-label', t('chips'));
    renderRules(); renderStats(); syncSettingsUI();
    relabelTable();
    if (!busy && game.phase === BJ.PHASE.BETTING) renderPhaseMessage();
    renderBet();
  }
  function renderClock() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0'), mm = String(d.getMinutes()).padStart(2, '0');
    $('#reg').innerHTML = `${t('reg')} · <b>${hh}:${mm}</b>`;
  }
  setInterval(renderClock, 15000);
  function syncSettingsUI() {
    const seg = (id, v) => $$('#' + id + ' button').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.v === v)); b.tabIndex = b.dataset.v === v ? 0 : -1; });
    seg('segTheme', settings.theme); seg('segLang', settings.lang); seg('segSpeed', settings.speed);
    $('#swSound').checked = settings.sound; $('#swHints').checked = settings.hints; $('#swHaptics').checked = settings.haptics;
    el.btnSound.setAttribute('aria-pressed', String(settings.sound));
  }

  /* ---------------- cards ---------------- */
  /** Cards are decorative for assistive tech — the hand/dealer groups carry the names. A hidden hole card has no identity in the DOM. */
  function cardEl(card, faceDown, keepSecret) {
    const d = document.createElement('div');
    d.className = 'card' + (faceDown ? ' face-down' : '');
    d.setAttribute('aria-hidden', 'true');
    d.innerHTML = `<div class="card-inner"><div class="card-face card-front">${keepSecret ? '' : Cards.svg(card.rank, card.suit)}</div><div class="card-face card-back">${Cards.back()}</div></div>`;
    if (!keepSecret) d.dataset.id = card.id;
    return d;
  }
  function revealCardEl(c, card) { // fill in a secret front before flipping it
    if (!c.dataset.id) { c.querySelector('.card-front').innerHTML = Cards.svg(card.rank, card.suit); c.dataset.id = card.id; }
  }
  function setCount(container, n) { container.style.setProperty('--n', n); }
  /** Deal a card from the shoe into a container with a FLIP animation. */
  async function dealCard(container, card, { faceDown = false, sideways = false } = {}) {
    const n = container.children.length;
    const c = cardEl(card, true, faceDown);
    c.style.setProperty('--i', n);
    if (sideways) c.classList.add('sideways');
    const hand = container.closest('.hand') || container;
    const before = hand.getBoundingClientRect();
    container.appendChild(c);
    setCount(container, n + 1);
    const after = hand.getBoundingClientRect();
    if (!reduceMotion.matches && Math.abs(before.left - after.left) > 0.5) hand.animate([{ transform: `translateX(${before.left - after.left}px)` }, { transform: 'none' }], { duration: 300, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', composite: 'add' });
    const from = el.shoe.getBoundingClientRect();
    const to = c.getBoundingClientRect();
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const dur = 420 * speedFactor * (reduceMotion.matches ? 0.3 : 1);
    c.classList.add('flying');
    el.shoe.classList.remove('pull'); void el.shoe.offsetWidth; el.shoe.classList.add('pull');
    if (!faceDown) setTimeout(() => c.classList.remove('face-down'), reduceMotion.matches ? 0 : dur * 0.45);
    c.style.willChange = 'transform';
    const anim = reduceMotion.matches
      ? c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, fill: 'both' })
      : c.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(-10deg) scale(${from.width / to.width})`, opacity: 0.6 },
        { transform: 'translate(0, 0) rotate(0) scale(1)', opacity: 1 },
      ], { duration: dur, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'both' });
    sound.deal();
    await settled(anim);
    anim.commitStyles && anim.cancel();
    c.style.transform = ''; c.style.willChange = '';
    c.classList.remove('flying');
    if (!faceDown) setTimeout(() => c.classList.add('flat'), 650 * speedFactor);
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
      <div class="cards-wrap"><div class="cards" style="--n:0"></div><div class="hand-result" aria-hidden="true"></div></div>`;
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
  function shownCards(i) { const h = game.hands[i]; return h ? h.cards.slice(0, cardsOf(i).children.length) : []; }
  function updateHandBadge(i) {
    const h = game.hands[i]; if (!h || !handEls[i]) return;
    const cards = shownCards(i);
    if (!cards.length) return;
    const v = BJ.handValue(cards);
    updateBadge($('.badge-value', handEls[i]), v, { blackjack: BJ.isNatural(cards) && !h.fromSplit });
    const bb = $('.badge-bet', handEls[i]);
    bb.hidden = !(game.hands.length > 1 || h.doubled);
    bb.textContent = fmt(h.bet);
    handEls[i].setAttribute('role', 'group');
    handEls[i].setAttribute('aria-label', `${t('yourHand')}${game.hands.length > 1 ? ' ' + (i + 1) : ''}: ${cards.map(c => Cards.label(c.rank, c.suit, settings.lang)).join(', ')} — ${v.total}${v.soft && v.total < 21 ? ' (' + (v.total - 10) + '/' + v.total + ')' : ''}`);
  }
  function updateDealerBadge() {
    const d = game.dealer;
    const shown = el.dealerCards.children.length;
    if (!d.cards.length || !shown) { el.dealerValue.hidden = true; return; }
    const hole = el.dealerCards.children[1];
    const hidden = !!hole && hole.classList.contains('face-down');
    const cards = hidden ? d.cards.slice(0, 1) : d.cards.slice(0, shown);
    const v = BJ.handValue(cards);
    const finished = !hidden && shown >= 2 && (game.phase === BJ.PHASE.DEALER || game.phase === BJ.PHASE.SETTLED) && shown === d.cards.length;
    updateBadge(el.dealerValue, finished ? { ...v, soft: false } : v, { blackjack: !hidden && BJ.isNatural(cards) });
    el.dealerCards.setAttribute('role', 'group');
    el.dealerCards.setAttribute('aria-label', `${t('dealer')}: ${cards.map(c => Cards.label(c.rank, c.suit, settings.lang)).concat(hidden ? [t('hiddenCard')] : []).join(', ')} — ${v.total}`);
  }
  function setActiveHand(i) {
    if (i >= 0 && handEls[i] && el.hands.scrollWidth > el.hands.clientWidth) handEls[i].scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduceMotion.matches ? 'auto' : 'smooth' });
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
    cards.forEach((c, i) => c.animate(reduceMotion.matches ? [{ opacity: 1 }, { opacity: 0 }] : [{ transform: 'translate(0,0)', opacity: 1 }, { transform: 'translate(40px, -60px) rotate(6deg)', opacity: 0 }], { duration: reduceMotion.matches ? 160 : dur, delay: reduceMotion.matches ? 0 : i * 20, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }));
    $$('.hand-result').forEach(r => r.classList.remove('show'));
    await wait(dur + cards.length * 20);
    clearTable();
  }

  /* ---------------- bet spot ---------------- */
  function chipEl(value, k) {
    const b = document.createElement(k == null ? 'button' : 'div');
    b.className = 'chip'; b.dataset.value = value;
    if (k != null) { b.style.setProperty('--k', k); b.style.setProperty('--rot', (((k * 7919) % 9) - 4) * 0.6 + 'deg'); } else b.type = 'button';
    b.innerHTML = `<span class="chip-value">${value >= 1000 ? new Intl.NumberFormat(settings.lang === 'da' ? 'da-DK' : 'en-GB').format(value) : value}</span>`;
    b.setAttribute('aria-label', t('chip', { amt: fmt(value) }));
    return b;
  }
  function renderBet() {
    if (busy && game.phase === BJ.PHASE.SETTLED) { renderBetControls(); return; } // never interrupt the payout animation
    const inPlay = [BJ.PHASE.INSURANCE, BJ.PHASE.PLAYER, BJ.PHASE.DEALER].includes(game.phase);
    const chips = game.phase === BJ.PHASE.BETTING ? game.betChips : inPlay ? game.hands.reduce((a, h) => a.concat(BJ.decompose(h.bet, game.rules.chips)), []) : [];
    const total = game.phase === BJ.PHASE.BETTING ? game.bet : inPlay ? game.hands.reduce((s, h) => s + h.bet, 0) : 0;
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
    const narrow = window.matchMedia('(max-width: 600px)').matches;
    el.btnDeal.textContent = broke ? t('getChips', { amt: fmt(game.rules.startBalance) }) : (betting && !narrow && game.bet >= game.rules.minBet ? `${t('deal')} · ${fmt(game.bet)}` : t('deal'));
    el.btnDeal.dataset.mode = broke ? 'reset' : 'deal';
    el.btnDeal.disabled = !betting || (!broke && !game.canDeal().ok);
    if (betting) el.btnDeal.title = broke ? '' : (game.canDeal().ok ? '' : t('minBet', { amt: fmt(game.rules.minBet) }));
    el.btnRebetDeal.disabled = !(game.phase === BJ.PHASE.SETTLED && game.lastBet && game.lastBet <= game.balance);
    el.btnRebetDeal.textContent = game.lastBet ? t('rebetAmt', { amt: fmt(game.lastBet) }) : t('rebetDeal');
  }
  async function flyChip(fromEl, value) {
    if (reduceMotion.matches) return;
    const from = fromEl.getBoundingClientRect();
    const to = el.betStack.getBoundingClientRect();
    const ghost = chipEl(value, 0); ghost.classList.add('fly');
    ghost.style.left = from.left + 'px'; ghost.style.top = from.top + 'px'; ghost.style.width = from.width + 'px'; ghost.style.height = from.height + 'px';
    ghost.style.willChange = 'transform';
    document.body.appendChild(ghost);
    const dx = to.left - from.left - from.width / 2, dy = to.top - from.top - from.height / 2 - 2.5 * Math.min(game.betChips.length, 24);
    const a = ghost.animate([
      { transform: 'translate(0,0) scale(1)' },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.55 - 30}px) scale(0.9)`, offset: 0.5 },
      { transform: `translate(${dx}px, ${dy}px) scale(${44 / from.width})` },
    ], { duration: 380 * speedFactor, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });
    await settled(a);
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
      const stepSize = Number.isInteger(target) ? 1 : 0.5;
      shownBalance = Math.round((start + delta * e) / stepSize) * stepSize;
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
  let msgTimer = null, lastMsg = null;
  /** text may be a string or a function producing it (re-run on language change). */
  function message(text, cls = '') {
    lastMsg = { text, cls };
    clearTimeout(msgTimer);
    el.message.classList.add('hide');
    msgTimer = setTimeout(() => { el.message.innerHTML = typeof text === 'function' ? text() : text; el.message.className = 'message ' + cls; }, 120);
  }
  function announce(text) { el.announce.textContent = ''; setTimeout(() => { el.announce.textContent = String(text).replace(/\.\.\s/g, '. ').replace(/\.\.$/, '.'); }, 50); }
  function alertText(text) { const a = $('#alert'); a.textContent = ''; setTimeout(() => { a.textContent = text; }, 50); }
  let toastTimer = null;
  function toast(text) {
    el.toast.textContent = text; el.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 2200);
  }
  function renderPhaseMessage() {
    if (game.phase === BJ.PHASE.BETTING) {
      if (game.balance < game.rules.minBet && game.bet < game.rules.minBet) message(() => t('outOfChips'));
      else message(game.bet >= game.rules.minBet ? t('ready') : t('placeBet'), 'sub');
    }
  }
  function setPhase(p) { app.dataset.phase = p; renderBetControls(); armIdle(); syncResetButton(); }
  function syncResetButton() { const ok = game.phase === BJ.PHASE.BETTING && !busy; $('#btnReset').disabled = !ok; $('#resetHint').hidden = ok; $('#resetHint').textContent = t('resetLocked'); }
  let idleTimer = null;
  function armIdle() {
    clearTimeout(idleTimer);
    if (game.phase !== BJ.PHASE.BETTING || app.dataset.phase === 'intro') return;
    idleTimer = setTimeout(() => { if (game.phase === BJ.PHASE.BETTING && !busy && !openSheetEl && game.balance >= game.rules.minBet) message(() => t('idle'), 'sub'); }, 45000);
  }

  /* ---------------- hint ---------------- */
  function renderHint() {
    $$('.btn-act').forEach(b => b.classList.remove('suggested'));
    if (!settings.hints || game.phase !== BJ.PHASE.PLAYER || game.activeHand < 0) { el.hint.classList.remove('on'); return; }
    const h = game.hands[game.activeHand];
    const s = BJ.basicStrategy(h.cards, game.dealer.cards[0], game.availableActions());
    const map = { hit: el.btnHit, stand: el.btnStand, double: el.btnDouble, split: el.btnSplit, surrender: el.btnSurrender };
    const btn = map[s];
    if (btn && !btn.disabled) btn.classList.add('suggested');
    el.hint.innerHTML = `${t('hintLabel')}: <b>${t(s)}</b>`;
    el.hint.classList.add('on');
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
    const rate = s.rounds ? Math.round((s.won / s.rounds) * 100) + '\u00a0%' : '–';
    const rows = [[t('stRounds'), s.rounds], [t('stWinRate'), rate], [t('stBlackjacks'), s.blackjacks], [t('stNet'), (s.net > 0 ? '+' : '') + fmt(s.net)], [t('stBest'), fmt(s.biggestWin)], [t('stStreak'), s.bestStreak], [t('stWagered'), fmt(s.wagered)]];
    el.stats.innerHTML = rows.map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  }
  function renderRules() {
    const r = game.rules;
    const rows = [
      [t('rDecks'), r.decks], [t('rS17'), r.dealerHitsSoft17 ? t('rH17v') : t('rS17v')], [t('rBJ'), r.blackjackPays === 1.5 ? '3:2' : r.blackjackPays === 1.2 ? '6:5' : `${r.blackjackPays}:1`], [t('rIns'), `${r.insurancePays}:1`], [t('rPeek'), r.peek ? t('rPeekV') : t('no')],
      [t('rEven'), r.evenMoney ? t('rEvenV') : t('no')], [t('rDouble'), r.doubleOn === 'any' ? t('rDoubleV') : t('rDoubleOn', { range: r.doubleOn.replace('-', '–') })], [t('rDAS'), r.doubleAfterSplit ? t('yes') : t('no')], [t('rSplit'), t('rSplitV', { n: r.maxSplits + 1 })], [t('rTens'), r.splitTenValues ? t('rTensV') : t('no')], [t('rAces'), t('rAcesV')],
      [t('rSurr'), r.lateSurrender ? t('rSurrV') : t('no')], [t('rLimits'), `${fmt(r.minBet)} – ${fmt(r.maxBet)}`], [t('rCut'), t('rCutV', { pct: Math.round(r.penetration * 100) })], [t('rRtp'), t('rRtpV')],
    ];
    const keys = [['␣', t('kDeal')], ['H', t('kHit')], ['S', t('kStand')], ['D', t('kDouble')], ['P', t('kSplit')], ['R', t('kSurr')], ['Y / N', t('kIns')], ['Esc', t('kEsc')]];
    el.rulesBody.innerHTML = `<p class="rules-intro">${t('rulesIntro')}</p><ul class="rules-list">${rows.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join('')}</ul>
      <h3 class="rules-h">${t('keys')}</h3><div class="kbd-list">${keys.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>
      <p class="fine">${t('demoNote')}</p>`;
  }
  function renderShoe() {
    const s = game.shoe;
    el.shoeFill.style.transform = `scaleX(${Math.max(0.04, s.remaining / s.total)})`;
    el.shoe.setAttribute('aria-label', t('shoeLeft', { n: s.remaining }));
  }

  /* ---------------- event playback ---------------- */
  const OUTCOME_CLASS = { win: 'win', blackjack: 'bj', evenMoney: 'win', push: 'push', lose: 'lose', bust: 'lose', surrender: 'lose' };
  function outcomeText(r) {
    const amt = r.net !== 0 ? `<small>${r.net > 0 ? '+' : '−'}${fmt(Math.abs(r.net))}</small>` : '';
    if (r.outcome === 'blackjack' || r.outcome === 'bust') return amt; // the hand's badge already says it
    const label = { win: t('won'), evenMoney: t('evenMoneyLabel'), push: t('push'), lose: t('lost'), surrender: t('surrendered') }[r.outcome];
    return `<span>${label}</span>${amt}`;
  }
  async function play(events) {
    for (const e of events) {
      switch (e.type) {
        case 'shuffle': {
          setPhase('dealing'); el.busyText.textContent = t('shuffling');
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
          lastOffer = e; renderOffer();
          message(() => even ? t('evenMoneyQ') : t('insuranceQ'), 'sub');
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
          message(() => t('dealerChecks'), 'sub');
          const hole = el.dealerCards.children[1];
          if (hole) { hole.classList.add('peek'); }
          await wait(900);
          if (hole) hole.classList.remove('peek');
          await wait(250);
          if (e.blackjack) { message(() => t('dealerBlackjack')); announce(t('dealerBlackjack')); }
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
            revealCardEl(hole, e.card);
            hole.classList.remove('face-down');
            sound.flip();
            announce(t('dealerReveals', { card: Cards.label(e.card.rank, e.card.suit, settings.lang), total: BJ.handValue(game.dealer.cards.slice(0, 2)).total }));
            await wait(600);
            hole.classList.add('flat');
          }
          updateDealerBadge();
          await wait(250);
          break;
        }
        case 'activeHand': {
          if (!Object.values(e.actions).some(Boolean) && cardsOf(e.hand).children.length < 2) { // split hand about to receive its second card
            setPhase('dealing'); el.busyText.textContent = '';
            setActiveHand(e.hand);
            message(() => t('handOf', { n: e.hand + 1, m: game.hands.length }));
            await wait(200);
            break;
          }
          setPhase('player');
          setActiveHand(e.hand);
          updateHandBadge(e.hand);
          const many = game.hands.length > 1;
          message(() => game.hands.length > 1 ? t('handOf', { n: e.hand + 1, m: game.hands.length }) : t('yourTurn'), many ? '' : 'sub');
          renderActions(e.actions);
          renderHint();
          announce((many ? t('handOf', { n: e.hand + 1, m: game.hands.length }) + '. ' : '') + describeHand(e.hand));
          break;
        }
        case 'card': {
          await dealCard(cardsOf(e.hand), e.card); updateHandBadge(e.hand); renderShoe();
          announce(t('youDraw', { card: Cards.label(e.card.rank, e.card.suit, settings.lang), total: e.value.total }));
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
          message(() => t('bust')); announce(t('bust'));
          await wait(550);
          break;
        }
        case 'twentyOne': { updateHandBadge(e.hand); await wait(450); break; }
        case 'stand': { setPhase('dealing'); el.busyText.textContent = ''; el.hint.classList.remove('on'); await wait(300); break; }
        case 'surrender': {
          setPhase('dealing'); el.busyText.textContent = '';
          handEls[e.hand].classList.add('dim'); sound.push();
          message(() => t('surrendered')); announce(t('surrendered'));
          await wait(400);
          break;
        }
        case 'dealerCard': {
          setPhase('dealer'); el.busyText.textContent = t('dealerDraws'); message(() => t('dealerDraws'), 'sub');
          await dealCard(el.dealerCards, e.card); updateDealerBadge(); renderShoe();
          announce(t('dealerDraws2', { card: Cards.label(e.card.rank, e.card.suit, settings.lang), total: e.value.total }));
          await wait(520);
          break;
        }
        case 'dealerBust': { updateDealerBadge(); message(() => t('dealerBust')); announce(t('dealerBust')); sound.bust(); await wait(500); break; }
        case 'dealerStand': { updateDealerBadge(); message(() => t('dealerHas', { n: e.value.total }), 'sub'); announce(t('dealerHas', { n: e.value.total })); await wait(350); break; }
        case 'settle': { await settle(e); break; }
        case 'roundEnd': { renderBet(); renderShoe(); if (e.shuffleNext) toast(t('cutCard')); break; }
        default: break;
      }
    }
  }
  let lastOffer = null;
  function presizeOffer() { // longest strings, so the (invisible) panel already has its final height
    el.insuranceTitle.textContent = t('evenMoneyQ');
    el.insuranceSub.textContent = t('evenMoneySub', { amt: fmt(game.rules.maxBet) });
    el.btnInsYes.textContent = t('insureFor', { amt: fmt(game.rules.maxBet / 2) });
    el.btnInsNo.textContent = t('keepPlaying');
  }
  function renderOffer() {
    const e = lastOffer; if (!e) { presizeOffer(); return; }
    const even = e.type === 'evenMoneyOffer';
    el.insuranceTitle.textContent = even ? t('evenMoneyQ') : t('insuranceQ');
    el.insuranceSub.textContent = even ? t('evenMoneySub', { amt: fmt(e.stake) }) : t('insuranceSub', { amt: fmt(e.cost) });
    el.btnInsYes.textContent = even ? t('takeEvenMoney') : t('insureFor', { amt: fmt(e.cost) });
    el.btnInsNo.textContent = even ? t('keepPlaying') : t('noThanks');
  }
  /** Re-render every language-dependent piece of the live table (language switch mid-round). */
  function relabelTable() {
    renderBalance(false);
    if (lastMsg) message(lastMsg.text, lastMsg.cls);
    if (game.phase === BJ.PHASE.INSURANCE) renderOffer(); else presizeOffer();
    game.hands.forEach((h, i) => { updateHandBadge(i); if (h.result && handEls[i]) { const lab = $('.hand-result', handEls[i]); if (lab.classList.contains('show')) lab.innerHTML = outcomeText({ outcome: h.result, net: h.net }); } });
    if (game.dealer.cards.length) updateDealerBadge();
    renderHint();
    $('#resetHint').textContent = t('resetLocked');
  }
  function describeHand(i) {
    const cards = shownCards(i); const v = BJ.handValue(cards);
    return cards.map(c => Cards.label(c.rank, c.suit, settings.lang)).join(', ') + ' = ' + v.total + '. ' + t('dealerLabel') + ': ' + Cards.label(game.dealer.cards[0].rank, game.dealer.cards[0].suit, settings.lang);
  }
  function renderActions(a) {
    el.btnHit.disabled = !a.hit; el.btnStand.disabled = !a.stand; el.btnDouble.disabled = !a.double; el.btnSplit.disabled = !a.split; el.btnSurrender.disabled = !a.surrender;
    el.btnSurrender.hidden = !game.rules.lateSurrender;
  }
  async function settle(e) {
    setPhase('dealing'); el.busyText.textContent = '';
    el.hint.classList.remove('on');
    setActiveHand(-1); handEls.forEach(h => h.classList.remove('inactive', 'done'));
    const anyBJ = e.results.some(r => r.outcome === 'blackjack');
    // Per-hand labels, staggered.
    for (const r of e.results.slice().reverse()) {
      const lab = $('.hand-result', handEls[r.hand]);
      lab.className = 'hand-result ' + OUTCOME_CLASS[r.outcome];
      lab.innerHTML = outcomeText(r);
      lab.classList.add('show');
      if (r.outcome === 'blackjack') {
        const g = document.createElement('div'); g.className = 'glow'; $('.cards-wrap', handEls[r.hand]).prepend(g); setTimeout(() => g.remove(), 700);
        if (!reduceMotion.matches) $$('.card-front', handEls[r.hand]).forEach((f, k) => setTimeout(() => { const sw = document.createElement('div'); sw.className = 'sweep'; f.appendChild(sw); setTimeout(() => sw.remove(), 1000); }, 150 + k * 110));
      }
      if (r.net < 0 && r.outcome !== 'bust') handEls[r.hand].classList.add('dim');
      await wait(e.results.length > 1 ? 260 : 0);
    }
    if (e.insurance && e.insurance.outcome === 'win') toast(t('insuranceWon', { amt: fmt(e.insurance.net) }));
    // Sound + haptics + headline.
    if (anyBJ) { sound.blackjack(); haptic([15, 30, 15, 30, 40]); }
    else if (e.net > 0) { sound.win(); haptic([15, 40, 25]); }
    else if (e.net < 0) { sound.lose(); haptic(30); }
    else { sound.push(); }
    const insWin = e.insurance && e.insurance.outcome === 'win';
    if (anyBJ && e.net > 0) message(() => `${t('blackjack')}<span class="dot">.</span>`, 'big');
    else if (insWin && e.net <= 0) message(() => t('insuranceWon', { amt: fmt(e.insurance.net) }));
    else if (e.net > 0) message(() => t('youWon', { amt: `<span class="amount">${fmt(e.net)}</span>` }));
    else if (e.net < 0) message(() => t('youLost'));
    else message(() => t('push'));
    announce((insWin && e.net <= 0 ? t('dealerBlackjack') + '. ' + t('insuranceWon', { amt: fmt(e.insurance.net) }) : e.net > 0 ? t('youWon', { amt: fmt(e.net) }) : e.net < 0 ? t('youLost') : t('push')) + '. ' + t('balanceIs', { amt: fmt(e.balance) }));
    await wait(500);
    // Chips: payout to balance or loss to dealer.
    if (e.payout > 0) {
      if (e.net !== 0) floatAmount(e.net, el.betSpot);
      await stackTo(el.balanceBox);
    } else {
      await stackTo(el.dealerCards);
    }
    el.betStack.innerHTML = ''; el.betAmount.textContent = ''; el.betSpot.classList.remove('has-bet');
    renderBalance();
    if (e.net !== 0) sound.counter();
    snapshotSafe();
    renderHistory(); renderStats(); renderShoe(); save();
    await wait(450);
    setPhase('settled');
    renderBetControls();
  }

  /* ---------------- actions ---------------- */
  async function run(fn) {
    if (busy) return;
    busy = true;
    try {
      const ev = fn();
      if (ev.some(e => e.type === 'settle')) { snapshotSafe(); save(); } // persist the decided round before animating it
      await play(ev);
    }
    catch (err) { if (!(err instanceof BJ.GameError)) console.error(err); }
    finally { busy = false; renderBetControls(); }
  }
  function addChip(value, fromEl) {
    if (busy || game.phase !== BJ.PHASE.BETTING) return;
    const c = game.canAddChip(value);
    if (!c.ok) {
      const msg = c.reason === 'max' ? t('maxBet', { amt: fmt(game.rules.maxBet) }) : t('noFunds');
      toast(msg); alertText(msg);
      el.betSpot.classList.remove('shake'); void el.betSpot.offsetWidth; el.betSpot.classList.add('shake');
      return;
    }
    game.addChip(value);
    sound.chip(); haptic(6);
    if (fromEl) flyChip(fromEl, value).then(() => renderBet()); else renderBet();
    renderBetControls();
    renderPhaseMessage();
  }
  async function onDeal() {
    if (busy) return;
    if (el.btnDeal.dataset.mode === 'reset') { openConfirm(true); return; }
    const c = game.canDeal();
    if (!c.ok) { const msg = c.reason === 'min' ? t('minBet', { amt: fmt(game.rules.minBet) }) : c.reason === 'max' ? t('maxBet', { amt: fmt(game.rules.maxBet) }) : t('noFunds'); toast(msg); alertText(msg); return; }
    await run(() => game.deal());
  }
  async function onNextRound(rebetAndDeal) {
    if (busy || game.phase !== BJ.PHASE.SETTLED) return;
    busy = true;
    try {
      const endEv = game.nextRound();
      setPhase('dealing'); el.busyText.textContent = '';
      if (endEv[0] && endEv[0].shuffleNext) toast(t('cutCard'));
      await sweepTable();
      setPhase('betting');
      renderBet(); renderShoe(); save();
      if (game.balance < game.rules.minBet) { renderPhaseMessage(); setTimeout(() => openConfirm(true), 350); return; }
      if (realityCheck()) { renderPhaseMessage(); return; }
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
  let playSeconds = 0, rcShownAt = 0, sessionStartNet = null;
  setInterval(() => { if (!document.hidden && app.dataset.phase !== 'intro') playSeconds++; }, 1000);
  function realityCheck() {
    if (playSeconds - rcShownAt < 3600 || openSheetEl) return false;
    rcShownAt = playSeconds;
    const net = game.stats.net - (sessionStartNet == null ? 0 : sessionStartNet);
    $('#confirmTitle').textContent = t('rcTitle', { n: Math.round(playSeconds / 60) });
    $('#confirmText').textContent = t('rcText', { amt: (net > 0 ? '+' : '') + fmt(net) });
    $('#btnConfirm').textContent = t('continue_'); $('#btnConfirm').dataset.mode = 'rc';
    openSheet(el.sheetConfirm);
    return true;
  }
  function openConfirm(empty) {
    $('#btnConfirm').dataset.mode = 'reset';
    $('#confirmTitle').textContent = empty ? t('emptyTitle') : t('resetQ');
    $('#confirmText').textContent = empty ? t('emptyText', { amt: fmt(game.rules.startBalance) }) : t('resetText', { amt: fmt(game.rules.startBalance) });
    $('#btnConfirm').textContent = empty ? t('startOver') : t('reset');
    openSheet(el.sheetConfirm, empty ? null : $('#sheetConfirm [data-close]'));
  }
  function doReset() {
    if (game.phase !== BJ.PHASE.BETTING) return;
    game.resetBalance(); snapshotSafe(); renderBalance(); renderBet(); renderPhaseMessage(); save(); closeSheets(); sound.chips(3);
  }

  /* ---------------- sheets ---------------- */
  let openSheetEl = null, lastFocus = null, parentSheet = null;
  function openSheet(s, focusEl, restoreScroll) {
    if (openSheetEl && openSheetEl !== s) { // child sheet: remember where the parent was, so coming back feels like nothing moved
      const body = $('.sheet-body', openSheetEl), a = document.activeElement;
      parentSheet = { sheet: openSheetEl, outer: lastFocus, focus: openSheetEl.contains(a) ? a : null, scrollTop: body ? body.scrollTop : 0 };
      closeSheets(true, true);
    }
    else { parentSheet = null; lastFocus = document.activeElement; closeSheets(true, true); }
    clearTimeout(s._closeTimer); s._closeTimer = null;
    openSheetEl = s; s.hidden = false; el.backdrop.hidden = false;
    if (restoreScroll != null) { const body = $('.sheet-body', s); if (body) body.scrollTop = restoreScroll; }
    requestAnimationFrame(() => { s.classList.add('show'); el.backdrop.classList.add('show'); });
    const f = focusEl || (s === el.sheetConfirm ? $('#btnConfirm') : $('button, input', s)); if (f) setTimeout(() => f.focus({ preventScroll: restoreScroll != null }), 50);
    if (s === el.sheetSettings) { renderStats(); syncResetButton(); }
  }
  function closeSheets(immediate, keepParent) {
    if (!openSheetEl) return;
    const s = openSheetEl; openSheetEl = null;
    s.classList.remove('show'); el.backdrop.classList.remove('show');
    clearTimeout(s._closeTimer);
    const done = () => { s.hidden = true; s._closeTimer = null; if (!openSheetEl) el.backdrop.hidden = true; };
    if (immediate) done(); else s._closeTimer = setTimeout(done, 320);
    if (!keepParent && parentSheet) { const p = parentSheet; parentSheet = null; lastFocus = p.outer; openSheet(p.sheet, p.focus || undefined, p.scrollTop); return; }
    const target = lastFocus && lastFocus.focus && lastFocus.offsetParent !== null ? lastFocus : el.btnSettings;
    target.focus();
  }

  /* ---------------- intro ---------------- */
  function buildIntro() {
    const spec = [['A', 'S'], ['K', 'H'], ['Q', 'C'], ['10', 'D']];
    el.introCards.innerHTML = '';
    spec.forEach(([r, s], i) => {
      const c = document.createElement('div'); c.className = 'card ic ic' + (i + 1);
      c.style.animationDelay = (0.25 + i * 0.12) + 's';
      c.innerHTML = `<div class="card-inner"><div class="card-face card-front">${Cards.svg(r, s)}</div></div>`;
      el.introCards.appendChild(c);
    });
  }
  function leaveIntro() {
    if (app.dataset.phase !== 'intro') return;
    sound.unlock();
    el.intro.classList.add('leave');
    ['.topbar', '#table', '#dock'].forEach(sel => $(sel).removeAttribute('inert'));
    setTimeout(() => { el.intro.hidden = true; }, 650);
    setPhase('betting'); renderPhaseMessage(); renderBet();
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    // chip tray
    game.rules.chips.forEach(v => { const c = chipEl(v); el.chips.appendChild(c); c.addEventListener('click', () => addChip(v, c)); });
    el.btnUndo.addEventListener('click', () => { if (busy) return; game.removeLastChip(); sound.tap(); renderBet(); renderPhaseMessage(); });
    el.btnClear.addEventListener('click', () => { if (busy) return; game.clearBet(); sound.tap(); renderBet(); renderPhaseMessage(); });
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
    el.betStack.addEventListener('click', () => { if (busy || game.phase !== BJ.PHASE.BETTING) return; game.removeLastChip(); sound.tap(); renderBet(); renderPhaseMessage(); });
    $('#btnPlay').addEventListener('click', leaveIntro);
    $('#btnIntroRules').addEventListener('click', () => openSheet(el.sheetRules));
    $('#btnRules2').addEventListener('click', () => openSheet(el.sheetRules));
    $('#btnReset').addEventListener('click', () => { if (game.phase !== BJ.PHASE.BETTING || busy) return; openConfirm(); });
    $('#btnConfirm').addEventListener('click', () => { if ($('#btnConfirm').dataset.mode === 'rc') closeSheets(); else doReset(); });
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
    document.addEventListener('click', ev => { const b = ev.target.closest && ev.target.closest('button'); if (b && ev.detail > 0 && !openSheetEl) b.blur(); });
    // keyboard
    document.addEventListener('keydown', ev => {
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'escape') { if (openSheetEl) { closeSheets(); ev.preventDefault(); } return; }
      if (openSheetEl) {
        if (ev.key.startsWith('Arrow') && document.activeElement && document.activeElement.getAttribute('role') === 'radio') {
          const g = $$('button', document.activeElement.parentElement); const i = g.indexOf(document.activeElement);
          const fwd = ev.key === 'ArrowRight' || ev.key === 'ArrowDown';
          const n = g[(i + (fwd ? 1 : g.length - 1)) % g.length]; n.focus(); n.click(); ev.preventDefault(); return;
        }
        if (ev.key === 'Tab') {
          const f = $$('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])', openSheetEl).filter(x => x.offsetParent !== null);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === first) { last.focus(); ev.preventDefault(); }
          else if (!ev.shiftKey && document.activeElement === last) { first.focus(); ev.preventDefault(); }
        }
        return;
      }
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT') return;
      if (tag === 'BUTTON' && (k === ' ' || k === 'enter')) return; // native activation of the focused control
      if (app.dataset.phase === 'intro') { if (k === ' ' || k === 'enter') { leaveIntro(); ev.preventDefault(); } return; }
      const ph = game.phase;
      if (k === ' ' || k === 'enter') {
        if (busy) { ev.preventDefault(); return; }
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
        if (k === 'y' || k === 'j') run(() => game.insurance(true)); else if (k === 'n') run(() => game.insurance(false));
      } else if (ph === BJ.PHASE.BETTING) {
        if (busy) return;
        const idx = parseInt(k, 10);
        if (idx >= 1 && idx <= game.rules.chips.length) { const c = el.chips.children[idx - 1]; addChip(game.rules.chips[idx - 1], c); }
        else if (k === 'backspace') { game.removeLastChip(); renderBet(); renderPhaseMessage(); }
      }
    });
  }

  /* ---------------- boot ---------------- */
  if (!navigator.vibrate) { const row = $('#swHaptics').closest('.setting'); if (row) row.hidden = true; }
  $$('.shoe-card', el.shoe).forEach(c => { c.innerHTML = Cards.back(); });
  applyTheme(); applySpeed(); buildIntro(); wire(); applyLang();
  renderBalance(false); renderBet(); renderHistory(); renderStats(); renderShoe();
  sessionStartNet = game.stats.net;
  // Debug / test hooks (harmless in production; no effect on outcomes unless used).
  window.__bj = { game, rig: s => game.shoe.rig(s), play, settings, leaveIntro, get busy() { return busy; } };
})();
