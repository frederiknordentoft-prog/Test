// Terningen · Playwright check of the Game wiring (SwiftShader WebGL2, deterministic advance() stepping).
// Usage: node scripts/dice-check.mjs [baseUrl=http://127.0.0.1:4173/] [only=award,demo,storm,unlock,reset]
// Instruments localStorage.setItem per key. Exit code 1 on any failure.
// Covers spec tests a (base award), k (first-die card), l (hello), reload mid-award, g (demo isolation: demo(),
// demoSuns(), dDie, dFirst, the 5 previews, dGate skipped + full), d (real storm), m (unlock), i (reset), j (opt-out).
import { chromium } from 'playwright-core';

const [base = 'http://127.0.0.1:4173/', only = ''] = process.argv.slice(2);
const want = new Set(only ? only.split(',') : ['award', 'demo', 'storm', 'unlock', 'reset']);
const KEY = 'terningen.v1';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
// a dev server's HMR client must not reload the page mid-run
await page.route('**/@vite/client', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;',
}));
await ctx.addInitScript(() => {
  const orig = Storage.prototype.setItem;
  window.__writes = {};
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage) window.__writes[k] = (window.__writes[k] ?? 0) + 1; return orig.call(this, k, v); };
});

const fails = [], T0 = Date.now();
const check = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  · ' + detail : ''}  (${((Date.now() - T0) / 1000).toFixed(0)} s)`); if (!ok) fails.push(name); };
const ev = (f, a) => page.evaluate(f, a);
// advance game time in small chunks so awaited continuations run between them
const adv = (ms, step = 50) => ev(async ([ms, step]) => {
  for (let t = 0; t < ms; t += step) { window.__slot.advance(Math.min(step, ms - t), false); await new Promise((r) => setTimeout(r, 0)); }
}, [ms, step]);
const state = () => ev(() => window.__slot.state());
const until = async (pred, max = 30000, step = 100) => { for (let t = 0; t <= max; t += step) { if (await ev(pred)) return t; await adv(step); } return -1; };
const untilState = (s, max) => until(new Function(`return window.__slot.state() === ${JSON.stringify(s)}`), max);
const stored = () => ev((k) => localStorage.getItem(k), KEY);
const storedDice = async () => JSON.parse((await stored()) ?? 'null');
const chip = () => ev(() => document.querySelector('#diceN .cur:last-child')?.textContent ?? document.getElementById('diceN').textContent);
const click = (sel) => ev((s) => document.querySelector(s).click(), sel);
const shown = (id) => ev((i) => document.getElementById(i).classList.contains('show'), id);

async function boot(hash = '', fresh = false) {
  if (fresh) { await page.goto(base + '?seed=7'); await page.waitForFunction(() => window.__slot); await ev(() => localStorage.clear()); }
  await page.goto(base + '?seed=7' + hash);
  await page.waitForFunction(() => window.__slot, null, { timeout: 60000 });
  await adv(300);
  await ev(() => window.__slot.unlock());
  const t = await untilState('idle', 20000);
  check(t >= 0, `boot${hash} reaches idle`);
}

// ------------------------------------------------------------------ a · base award, k · first-die card, l · hello
if (want.has('award')) {
  await boot('', true);
  await ev(() => window.__slot.setSeed(20260922));
  check(await ev(() => document.getElementById('hello').hidden), 'hello not shown before 1,2 s');
  await adv(1400);
  check(!(await ev(() => document.getElementById('hello').hidden)), 'hello card shown 1,2 s after the first idle');
  check((await storedDice())?.helloSeen === true, 'helloSeen persisted when shown');
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  check(await ev(() => document.getElementById('hello').hidden), 'SPIN dismisses the hello card and the spin proceeds', await state());
  const d0 = await storedDice();
  check(d0?.count === 1, "terningen.v1 count === 1 right after the press (committed before presentation)", JSON.stringify(d0));
  check((await chip()) === '0', '#diceN still shows 0 during the spin');
  const last = await ev(() => { const h = window.__slot.save().history; return h[h.length - 1]; });
  check(last?.die === true, 'last history entry has die === true', last?.spinId);
  const R = await untilState('celebrating', 12000);
  check(R >= 3000 - 100, 'result beat ≥ 3,0 s after the press', `${R} ms`);
  await adv(1600);
  check(await ev(() => !!document.querySelector('#overlays .die-fly')), 'the award die is on screen at R+1,6');
  check((await chip()) === '0' && (await state()) === 'celebrating', 'chip unchanged while the die is shown');
  let landAt = -1, idleAt = -1;
  for (let t = 1600; t < 6000 && idleAt < 0; t += 50) {
    await adv(50);
    if (landAt < 0 && (await chip()) === '1') landAt = t;
    if (idleAt < 0 && (await state()) !== 'celebrating') idleAt = t;
  }
  check(landAt > 2600 && landAt <= 3500, 'die lands on the chip at ≈ R+3,35', `R+${landAt} ms`);
  check(idleAt >= landAt, 'state leaves celebrating only after the landing', `R+${idleAt} ms`);
  check((await ev(() => window.__slot.award())).inFlight === false, 'award.inFlight false at idle');
  // first-die card 250 ms after idle; inert to Space for 1,5 s
  await adv(400);
  check((await state()) === 'diceCard' && (await ev(() => document.getElementById('summaryCard').classList.contains('relic'))), 'first-die card appears after the first die');
  await page.keyboard.press('Space');
  await adv(100);
  check((await state()) === 'diceCard', 'Space is ignored before 1,5 s');
  await ev(() => document.querySelector('#summaryCard [data-act="ok"]').click());
  await adv(100);
  check((await state()) === 'diceCard', '"Forstået" is ignored before 1,5 s');
  await adv(1500);
  await ev(() => document.activeElement?.blur());
  await page.keyboard.press('Space');
  await adv(300);
  check((await state()) === 'idle' && !(await shown('summary')), 'Space closes the card after 1,5 s');
  check((await storedDice())?.introSeen === true, 'introSeen persisted');
  // reload mid-award keeps the die
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('celebrating', 12000);
  await adv(1700);
  check((await storedDice())?.count === 2, 'second die committed before its flight', String((await storedDice())?.count));
  await boot();
  check((await ev(() => window.__slot.dice())).count === 2, 'reload mid-award keeps the die (count 2)');
  check((await chip()) === '2', '#diceN shows 2 after the reload', await chip());
  await adv(1600);
  check((await state()) === 'idle' && (await ev(() => document.getElementById('hello').hidden)), 'no hello and no first-die card after the reload (once only)');
}

// ------------------------------------------------------------------ g · demo isolation (ZERO writes to terningen.v1)
if (want.has('demo')) {
  if (!want.has('award')) { await boot('', true); await ev(() => window.__slot.setSeed(20260922)); await adv(1400); }
  else await boot();
  const s0 = await stored();
  await ev(() => { window.__writes = {}; });
  const idle = async (name, max = 30000) => { const t = await untilState('idle', max); check(t >= 0, `${name} returns to idle`, `${t} ms`); };
  // dDie
  await click('#dDie'); await adv(200);
  check((await state()) === 'demoDie', 'dDie: state demoDie');
  await adv(2300);
  check(await ev(() => !!document.querySelector('.dice-demo-tag')), 'dDie: "+1 demo" tag at the chip');
  await idle('dDie');
  // dFirst
  await click('#dFirst'); await adv(300);
  check((await state()) === 'diceCard' && (await ev(() => !!document.querySelector('#summaryCard .demo-note'))), 'dFirst: first-die card with the amber demo note');
  await adv(1600); await ev(() => document.querySelector('#summaryCard [data-act="ok"]').click()); await idle('dFirst', 3000);
  // previews
  for (const n of [0, 25, 250, 1000, 1948]) {
    await click(`#dSeg button[data-n="${n}"]`); await adv(1000);
    const rb = await ev(() => { const r = document.getElementById('chRibbon'); return r.hidden ? '' : r.textContent; });
    check((await state()) === 'chamber' && rb.startsWith('FORHÅNDSVISNING'), `preview ${n}: chamber with the amber ribbon`, rb);
    await click('#chDone'); await idle(`preview ${n}`, 3000);
  }
  // dGate, skipped at 2,5 s after T0 and in full
  for (const full of [false, true]) {
    await click('#dGate');
    const st = await until(() => window.__slot.gate()?.started, 8000);
    check(st >= 0, `dGate${full ? ' (full)' : ' (skip)'}: ceremony starts`, `${st} ms`);
    check(await ev(() => !document.getElementById('chRibbon').hidden && document.getElementById('chRibbon').textContent.startsWith('DEMO')), 'dGate: amber DEMO ribbon pinned');
    if (!full) { await adv(3000); await page.keyboard.press('Escape'); await adv(200); }
    const pl = await until(() => window.__slot.gate()?.placard, 25000, 250);
    check(pl >= 0, `dGate${full ? ' (full)' : ' (skip)'}: placard`, `${pl} ms`);
    check(await ev(() => !!document.querySelector('#summaryCard.placard .demo-note')), 'dGate: placard starts with the demo note');
    await ev(() => document.querySelector('#summaryCard [data-act="endDemo"]').click());
    await idle('dGate end demo', 5000);
    check(await ev(() => document.getElementById('bannerT').textContent === 'DIN SAMLING ER UÆNDRET'), 'dGate: "DIN SAMLING ER UÆNDRET" banner');
    check((await ev(() => window.__slot.dice())).unlock !== 'seen', 'dGate never writes unlock');
  }
  // demo() and demoSuns() storms
  for (const [name, go] of [['demo()', () => window.__slot.demo()], ['demoSuns()', () => document.getElementById('dSuns').click()]]) {
    await ev(go);
    const r = await untilState('stormReady', 30000);
    check(r >= 0, `${name}: storm ready`);
    await ev(() => window.__slot.startStorm());
    const s = await untilState('stormSummary', 90000);
    check(s >= 0, `${name}: storm summary`);
    await adv(4000);
    const sum = await ev(() => document.getElementById('summaryCard').textContent);
    check(sum.includes('giver ingen terninger'), `${name}: demo note says "giver ingen terninger"`);
    const ghosts = /Terninger · demo · tæller ikke\s*(\d+)/.exec(sum);
    console.log(`      ${name}: demo summary dice row ${ghosts ? ghosts[1] : '(none: no qualifying demo spin)'}`);
    await ev(() => window.__slot.cont());
    await idle(name, 20000);
  }
  const writes = await ev((k) => window.__writes[k] ?? 0, KEY);
  check(writes === 0, 'ZERO setItem calls for terningen.v1 across every demo tool', `${writes} writes`);
  check((await stored()) === s0, 'terningen.v1 is byte-identical after the demos');
}

// ------------------------------------------------------------------ d · real storm (dice per storm spin, held, released)
if (want.has('storm')) {
  if (!want.has('award') && !want.has('demo')) { await boot('', true); await ev(() => window.__slot.setSeed(20260922)); await adv(1400); }
  const before = (await ev(() => window.__slot.dice())).count;
  const hist0 = await ev(() => window.__slot.save().history.length);
  await ev(() => window.__slot.qaNext('sun4'));
  await ev(() => { window.__slot.spin(); });
  check((await untilState('stormReady', 40000)) >= 0, 'storm: ready');
  const chipBefore = await chip();
  await ev(() => window.__slot.startStorm());
  let maxHeld = 0;
  for (let t = 0; t < 120000 && (await state()) !== 'stormSummary'; t += 500) { await adv(500); maxHeld = Math.max(maxHeld, (await ev(() => window.__slot.award())).held); }
  check((await state()) === 'stormSummary', 'storm: summary');
  await adv(4000);
  const h = await ev((n) => window.__slot.save().history.slice(n), hist0);
  const expected = h.filter((e) => e.mode === 'storm' && !e.spinId.endsWith('-G') && e.winOre >= 10 * e.stakeOre).length;
  const marked = h.filter((e) => e.mode === 'storm' && e.die).length;
  const delta = (await ev(() => window.__slot.dice())).count - before;
  check(delta === expected && marked === expected, 'storm: count delta = qualifying storm spins (none for "-G")', `delta ${delta}, expected ${expected}, marked ${marked}, held max ${maxHeld}`);
  const sum = await ev(() => document.getElementById('summaryCard').textContent);
  if (expected > 0) check(new RegExp(`Terninger fra stormen\\s*${expected}`).test(sum), 'storm: summary row "Terninger fra stormen"');
  check((await chip()) === chipBefore, 'storm: the chip does not move while the dice are held', `${chipBefore} → ${await chip()}`);
  await ev(() => window.__slot.cont());
  check((await untilState('idle', 20000)) >= 0, 'storm: idle after the outro');
  const a = await ev(() => window.__slot.award());
  check(a.held === 0 && a.heldDice === 0, 'storm: the held row is empty after the outro');
  check((await chip()) === String((await ev(() => window.__slot.dice())).count), '#diceN equals the count at idle', await chip());
}

// ------------------------------------------------------------------ m · unlock (1948 card, "Ikke nu", real ceremony)
if (want.has('unlock')) {
  if (!['award', 'demo', 'storm'].some((k) => want.has(k))) { await boot('', true); await ev(() => window.__slot.setSeed(20260922)); await adv(1400); }
  await adv(600);
  if ((await state()) === 'diceCard') { await adv(1600); await ev(() => document.querySelector('#summaryCard [data-act="ok"]')?.click()); await adv(300); }
  await ev(() => window.__slot.qaDice(1947));
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('idle', 20000);
  await adv(400);
  check((await state()) === 'diceCard' && (await ev(() => !!document.querySelector('#summaryCard .big1948'))), '1948 card at idle');
  check((await storedDice())?.unlock === 'pending' && (await storedDice())?.offered === true, "unlock 'pending' and offered persisted");
  await page.keyboard.press('Space'); await adv(1700); await page.keyboard.press('Space'); await adv(200);
  check((await state()) === 'diceCard', 'the 1948 card is inert to Space');
  await ev(() => document.querySelector('#summaryCard [data-act="later"]').click());
  await adv(300);
  check((await state()) === 'idle', '"Ikke nu" closes the card');
  await click('#diceBtn'); await adv(1000);
  check((await state()) === 'chamber' && (await ev(() => !document.getElementById('chOpen').hidden)), 'the chamber offers [Åbn porten]');
  await click('#chOpen');
  await until(() => window.__slot.gate()?.started, 8000);
  await adv(9000);
  check((await storedDice())?.unlock === 'pending', "unlock still 'pending' before the seal beat (bar 5)");
  const pl = await until(() => window.__slot.gate()?.placard, 20000, 250);
  check(pl >= 0, 'real ceremony: placard');
  const d = await storedDice();
  check(d?.unlock === 'seen' && typeof d?.unlockedAt === 'number', "real ceremony: unlock 'seen' + unlockedAt persisted");
  await ev(() => document.querySelector('#summaryCard [data-act="back"]').click());
  check((await untilState('idle', 5000)) >= 0, '"Tilbage til NORDLYS" closes the chamber');
  check(await ev(() => document.getElementById('diceBtn').classList.contains('open')), 'chip has the .open ring');
  await click('#diceBtn'); await adv(1000);
  check(await ev(() => document.getElementById('chamber').dataset.state === 'open' && !document.getElementById('chReplay').hidden), 'the chamber reopens in the open state with [Se åbningen igen]');
  await click('#chDone'); await untilState('idle', 3000);
}

// ------------------------------------------------------------------ i · reset, j · opt-out
if (want.has('reset')) {
  if (!['award', 'demo', 'storm', 'unlock'].some((k) => want.has(k))) { await boot('', true); await adv(1400); }
  await click('#dReset'); await adv(200);
  const d = await storedDice();
  check(d?.count === 0 && d?.unlock === 'none' && d?.helloSeen === false, 'Nulstil demo: the dice are back at defaults');
  check((await chip()) === '0', 'Nulstil demo: chip shows 0');
  check(await ev(() => document.getElementById('bannerS').textContent.endsWith('0 terninger')), 'Nulstil demo banner');
  await ev(() => window.__slot.setSeed(20260922));
  await ev(() => document.getElementById('hello').hidden || document.querySelector('#hello [data-hello="close"]').click());
  // opt-out: the chip hides, no award die, the count still increments
  await ev(() => window.__slot.game.dispatch({ t: 'settings', s: { dice: false } }));
  check(await ev(() => getComputedStyle(document.getElementById('diceBtn')).display === 'none'), 'opt-out: #diceBtn hidden');
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('celebrating', 12000); await adv(1700);
  check(!(await ev(() => !!document.querySelector('#overlays .die-fly'))), 'opt-out: no award die on screen');
  await untilState('idle', 10000); await adv(400);
  check((await ev(() => window.__slot.dice())).count === 1 && (await state()) === 'idle', 'opt-out: the count still increments, no card');
  await ev(() => window.__slot.game.dispatch({ t: 'settings', s: { dice: true } }));
}

await browser.close();
const bad = errors.filter((e) => !/GPU stall|GL Driver|WebGL/.test(e));
if (bad.length) { console.log('\nconsole/page errors:\n' + bad.join('\n')); }
check(!bad.some((e) => e.includes('dice changed by demo')), 'no "dice changed by demo" guard errors');
console.log(`\n${fails.length || bad.length ? `FAILED: ${fails.length} checks, ${bad.length} errors` : 'ALL DICE CHECKS PASSED'}`);
process.exit(fails.length || bad.length ? 1 : 0);
