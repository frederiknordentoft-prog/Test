// End-to-end UI smoke tests against the built index.html (Playwright + Chromium).
// Run: node tests/ui.test.mjs
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const url = 'file://' + join(here, '..', 'index.html');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--disable-background-networking'] });
let failures = 0, passes = 0;

async function scenario(name, viewport, fn) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 900, isMobile: viewport.width < 900, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.click('#btnPlay');
  await page.waitForTimeout(150);
  const api = {
    page,
    rig: s => page.evaluate(s => window.__bj.rig(s), s),
    state: () => page.evaluate(() => { const g = window.__bj.game; return { phase: g.phase, balance: g.balance, bet: g.bet, hands: g.hands.map(h => ({ cards: h.cards.map(c => c.id), bet: h.bet, result: h.result })), dealer: g.dealer.cards.map(c => c.id), app: document.getElementById('app').dataset.phase, busy: window.__bj.busy }; }),
    settle: async () => { for (let i = 0; i < 100; i++) { const s = await api.state(); if (!s.busy && ['player', 'insurance', 'settled', 'betting'].includes(s.app)) return s; await page.waitForTimeout(100); } throw new Error('timeout waiting for idle'); },
    click: async sel => { await page.click(sel, { timeout: 3000 }); await page.waitForTimeout(80); },
    text: sel => page.textContent(sel),
  };
  try {
    await fn(api);
    assert.deepEqual(errors, [], 'no console/page errors');
    passes++; console.log('ok -', name);
  } catch (e) {
    failures++; console.log('FAIL -', name, '\n   ', e.message.replace(/\n/g, ' '), errors.length ? '\n    errors: ' + errors.join(' | ') : '');
  }
  await ctx.close();
}
const desktop = { width: 1440, height: 900 }, phone = { width: 390, height: 844 };

await scenario('bet, deal, hit, stand, settle; balance shown matches engine', desktop, async a => {
  await a.rig('10♠ 6♦ 5♣ 9♥ 4♠ 8♦');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal');
  let s = await a.settle();
  assert.equal(s.app, 'player');
  await a.click('#btnHit'); s = await a.settle();
  assert.deepEqual(s.hands[0].cards, ['10S', '5C', '4S']);
  await a.click('#btnStand'); s = await a.settle();
  assert.equal(s.app, 'settled');
  assert.equal(s.balance, 10100); // dealer 6+9 = 15 → draws 8 → 23 bust → player 19 wins
});

await scenario('dealer bust pays; balance text updates', desktop, async a => {
  await a.rig('10♠ 6♦ 9♣ 9♥ 8♦');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); await a.settle();
  await a.click('#btnStand');
  const s = await a.settle();
  assert.equal(s.balance, 10100);
  await a.page.waitForTimeout(900);
  assert.equal((await a.text('#balance')).replace(/\s/g, ''), '10.100kr.');
});

await scenario('split to four hands on phone renders all hands', phone, async a => {
  await a.rig('8♠ 10♦ 8♣ 7♥ 8♦ 8♥ 3♣ 4♦ 9♣ 9♦ 9♥ 2♣');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); await a.settle();
  await a.click('#btnSplit'); await a.settle();
  await a.click('#btnSplit'); await a.settle();
  await a.click('#btnSplit'); let s = await a.settle();
  assert.equal(s.hands.length, 4);
  const count = await a.page.evaluate(() => document.querySelectorAll('#hands .hand').length);
  assert.equal(count, 4);
  assert.equal(await a.page.evaluate(() => document.getElementById('hands').dataset.count), '4');
  const disabled = await a.page.$eval('#btnSplit', b => b.disabled);
  assert.equal(disabled, true);
  for (let i = 0; i < 4; i++) { await a.click('#btnStand'); s = await a.settle(); if (s.app === 'settled') break; }
  assert.equal(s.app, 'settled');
});

await scenario('insurance flow: offer, take, dealer blackjack pays 2:1', phone, async a => {
  await a.rig('9♠ A♦ 8♣ K♥');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); let s = await a.settle();
  assert.equal(s.app, 'insurance');
  await a.click('#btnInsYes'); s = await a.settle();
  assert.equal(s.app, 'settled');
  assert.equal(s.balance, 10000);
});

await scenario('even money offer and decline → blackjack 3:2', desktop, async a => {
  await a.rig('A♠ A♦ K♣ 9♥');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); let s = await a.settle();
  assert.equal(s.app, 'insurance');
  assert.match(await a.text('#insuranceTitle'), /blackjack/i);
  await a.click('#btnInsNo'); s = await a.settle();
  assert.equal(s.balance, 10150);
});

await scenario('surrender returns half; double deals sideways card', desktop, async a => {
  await a.rig('10♠ 10♦ 6♣ 7♥');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); await a.settle();
  await a.click('#btnSurrender'); let s = await a.settle();
  assert.equal(s.balance, 9950);
  await a.click('#btnNewBet'); s = await a.settle();
  assert.equal(s.app, 'betting');
  await a.rig('6♠ 10♦ 5♣ 7♥ 10♠ 9♦');
  await a.click('#btnRebet'); await a.click('#btnDeal'); await a.settle();
  await a.click('#btnDouble'); s = await a.settle();
  assert.equal(s.hands[0].bet, 200);
  const sideways = await a.page.evaluate(() => !!document.querySelector('#hands .card.sideways'));
  assert.equal(sideways, true);
  assert.equal(s.balance, 9950 + 200);
});

await scenario('keyboard: digits bet, space deals, h/s play, space rebets', desktop, async a => {
  await a.rig('10♠ 6♦ 9♣ 9♥ 8♦ 5♠ 5♦ 6♣ 6♥ 10♣');
  await a.page.keyboard.press('4'); // 100 kr chip
  let s = await a.settle(); assert.equal(s.bet, 100);
  await a.page.keyboard.press('Space'); await a.settle();
  await a.page.keyboard.press('s'); s = await a.settle();
  assert.equal(s.app, 'settled');
  await a.page.keyboard.press('Space'); s = await a.settle();
  assert.equal(s.bet, 0); assert.equal(s.app, 'player');
});

await scenario('rebet & deal one-tap; new bet path; undo/clear', phone, async a => {
  await a.rig('10♠ 10♦ 8♣ 8♥');
  await a.click('#chips .chip[data-value="50"]'); await a.click('#chips .chip[data-value="20"]');
  await a.click('#btnUndo'); let s = await a.settle(); assert.equal(s.bet, 50);
  await a.click('#btnClear'); s = await a.settle(); assert.equal(s.bet, 0);
  await a.click('#chips .chip[data-value="50"]');
  await a.click('#btnDeal'); await a.settle(); await a.click('#btnStand'); s = await a.settle();
  assert.equal(s.balance, 10000);
  await a.rig('10♠ 10♦ 8♣ 8♥');
  await a.click('#btnRebetDeal'); s = await a.settle();
  assert.equal(s.app, 'player'); assert.equal(s.hands[0].bet, 50);
});

await scenario('max bet and insufficient balance toasts; deal disabled without bet', desktop, async a => {
  const dealDisabled = await a.page.$eval('#btnDeal', b => b.disabled);
  assert.equal(dealDisabled, true);
  for (let i = 0; i < 5; i++) await a.click('#chips .chip[data-value="1000"]');
  let s = await a.settle(); assert.equal(s.bet, 5000);
  const disabled1000 = await a.page.$eval('#chips .chip[data-value="1000"]', b => b.disabled);
  assert.equal(disabled1000, true);
  const disabled10 = await a.page.$eval('#chips .chip[data-value="10"]', b => b.disabled);
  assert.equal(disabled10, true);
});

await scenario('empty balance offers start over; reset restores 10.000', desktop, async a => {
  await a.page.evaluate(() => { window.__bj.game.balance = 100; });
  await a.rig('10♠ 10♦ 6♣ 8♥');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); await a.settle(); await a.click('#btnStand'); let s = await a.settle();
  assert.equal(s.balance, 0);
  await a.click('#btnNewBet'); await a.page.waitForTimeout(700);
  const sheetOpen = await a.page.evaluate(() => !document.getElementById('sheetConfirm').hidden);
  assert.equal(sheetOpen, true);
  await a.click('#btnConfirm'); s = await a.settle();
  assert.equal(s.balance, 10000);
});

await scenario('language toggle to English relabels buttons; theme toggle applies', desktop, async a => {
  await a.click('#btnSettings'); await a.page.waitForTimeout(400);
  await a.click('#segLang button[data-v="en"]');
  assert.equal(await a.text('#btnDeal'), 'Deal');
  await a.click('#segTheme button[data-v="light"]');
  assert.equal(await a.page.evaluate(() => document.documentElement.dataset.theme), 'light');
  await a.page.keyboard.press('Escape'); await a.page.waitForTimeout(400);
  assert.equal(await a.page.evaluate(() => document.getElementById('sheetSettings').hidden), true);
});

await scenario('reshuffle happens at cut card without errors (fast pace)', desktop, async a => {
  await a.page.evaluate(() => { window.__bj.settings.speed = 'fast'; window.__bj.game.shoe.index = window.__bj.game.shoe.cutIndex; });
  await a.click('#chips .chip[data-value="10"]');
  await a.click('#btnDeal'); let s = await a.settle();
  const shuffles = await a.page.evaluate(() => window.__bj.game.shoe.shuffles);
  assert.equal(shuffles, 2);
  while (s.app === 'player') { await a.click('#btnStand'); s = await a.settle(); }
  if (s.app === 'insurance') { await a.click('#btnInsNo'); s = await a.settle(); while (s.app === 'player') { await a.click('#btnStand'); s = await a.settle(); } }
  assert.equal(s.app, 'settled');
});

await scenario('settings change mid-round never persists the deducted balance; reload restores it', desktop, async a => {
  await a.rig('10♠ 6♦ 7♣ 9♥');
  await a.click('#chips .chip[data-value="500"]');
  await a.click('#btnDeal'); await a.settle();
  await a.click('#btnSound'); // triggers save() mid-round
  const stored = await a.page.evaluate(() => JSON.parse(localStorage.getItem('blackjack.apple.v1')).balance);
  assert.equal(stored, 10000, 'stored balance must be the pre-round balance');
  await a.page.reload({ waitUntil: 'load' });
  await a.page.click('#btnPlay');
  const s = await a.settle();
  assert.equal(s.balance, 10000);
  assert.equal(s.app, 'betting');
});

await scenario('keyboard: Enter on a focused action button activates it natively', desktop, async a => {
  await a.rig('10♠ 6♦ 7♣ 9♥ 2♠');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); await a.settle();
  await a.page.focus('#btnHit');
  await a.page.keyboard.press('Enter');
  const s = await a.settle();
  assert.equal(s.hands[0].cards.length, 3, 'Enter on the focused Hit button draws a card');
});

await scenario('Tab is trapped inside an open sheet; Escape closes it and returns focus', desktop, async a => {
  await a.click('#btnSettings');
  await a.page.waitForTimeout(150);
  for (let i = 0; i < 40; i++) await a.page.keyboard.press('Tab');
  assert.equal(await a.page.evaluate(() => !!document.activeElement.closest('#sheetSettings')), true, 'focus stays inside the sheet');
  await a.page.keyboard.press('Escape');
  await a.page.waitForTimeout(400);
  assert.equal(await a.page.evaluate(() => document.getElementById('sheetSettings').hidden), true);
});

await scenario('nested sheets: returning from Rules to Settings leaves no ghost sheet over the controls', desktop, async a => {
  await a.click('#btnSettings'); await a.page.waitForTimeout(200);
  await a.click('#btnRules2'); await a.page.waitForTimeout(400);
  await a.click('#sheetRules [data-close]'); await a.page.waitForTimeout(500);
  const r = await a.page.evaluate(() => {
    const probe = sel => { const b = document.querySelector(sel).getBoundingClientRect(); const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return !!(hit && hit.closest('#sheetSettings')); };
    const backAtRules = probe('#btnRules2') && document.activeElement.id === 'btnRules2'; // the sheet comes back where the user left it
    document.querySelector('#sheetSettings .sheet-body').scrollTop = 0;
    return { rulesHidden: document.getElementById('sheetRules').hidden, settingsVisible: !document.getElementById('sheetSettings').hidden, hitInSettings: backAtRules && probe('#segLang button[data-v="en"]') };
  });
  assert.deepEqual(r, { rulesHidden: true, settingsVisible: true, hitInSettings: true });
  await a.click('#segLang button[data-v="en"]');
  assert.equal(await a.page.evaluate(() => window.__bj.settings.lang), 'en');
});

await scenario('phone: settled-panel buttons keep a 44pt hit height and the SE layout does not overlap', { width: 375, height: 667 }, async a => {
  await a.rig('8♠ A♦ 8♣ 9♥ 2♦ 10♠');
  await a.click('#chips .chip[data-value="100"]');
  await a.click('#btnDeal'); let s = await a.settle();
  assert.equal(s.app, 'insurance');
  const ov = await a.page.evaluate(() => {
    const r = sel => document.querySelector(sel).getBoundingClientRect();
    const m = r('#message'), d = r('#dealerCards'), amt = r('#betAmount'), badge = r('#hands .badge-value');
    return { msgOverDealer: Math.max(0, Math.min(m.bottom, d.bottom) - Math.max(m.top, d.top)), amountOverBadge: Math.max(0, Math.min(amt.bottom, badge.bottom) - Math.max(amt.top, badge.top)) };
  });
  assert.ok(ov.msgOverDealer <= 0, 'message must not cover the dealer cards: ' + JSON.stringify(ov));
  assert.ok(ov.amountOverBadge <= 8, 'bet amount must not cover the hand badge: ' + JSON.stringify(ov));
  await a.click('#btnInsNo'); await a.settle();
  await a.click('#btnStand'); s = await a.settle();
  assert.equal(s.app, 'settled');
  const h = await a.page.evaluate(() => [document.getElementById('btnRebetDeal').getBoundingClientRect().height, document.getElementById('btnNewBet').getBoundingClientRect().height]);
  assert.ok(h.every(x => x >= 44), 'settled buttons ≥44px: ' + h.join(','));
});

await browser.close();
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
