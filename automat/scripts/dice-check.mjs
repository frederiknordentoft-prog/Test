// Terningen · Playwright check of the Game wiring and the visuals (SwiftShader WebGL2, deterministic advance() stepping).
// Usage: node scripts/dice-check.mjs [baseUrl=http://127.0.0.1:4173/] [only=award,demo,suns,storm,resume,unlock,reset,perk,expiry,clean,placard,visual]
// (each Solstorm costs many minutes under SwiftShader: 'demo' runs demo(), 'suns' adds demoSuns())
// Instruments localStorage.setItem per key. Exit code 1 on any failure. Screenshots ('visual'): $SHOTS (default shots/dice).
// Covers spec tests a (base award: birth, flight start, the flight lands ON the chip), b (skip ≤ 320 ms), c (next spin:
// nothing in flight), k (first-die card), l (hello), reload mid-award, g (demo isolation: demo(), demoSuns(), dDie, dFirst,
// the 5 previews, dGate skipped at T0+2,5 s and in full), n (ceremony: #reg/#foot stay, the demo ribbon on every frame,
// Space skips, #1948_clean keeps the ribbon), d (real storm: dice held on the frame, released at the outro), e (reload
// mid-storm), m (unlock), i (reset), j (opt-out), f (a Ladet spin's die is judged at its LOCKED stake), h (the 365-day
// expiry resets the meter, never the dice), the placard at 360×640, 375×667 and 844×390 (the claim whole with its guard,
// the buttons and the ribbon clear), and the visual pass at 390×844, 375×667 and 1920×1080 (shots + overlap/fit assertions).
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [base = 'http://127.0.0.1:4173/', only = ''] = process.argv.slice(2);
const want = new Set(only ? only.split(',') : ['award', 'demo', 'suns', 'storm', 'resume', 'unlock', 'reset', 'perk', 'expiry', 'clean', 'placard', 'visual']);
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
// a dev server's HMR client must not reload the page mid-run (the stub still injects the CSS modules; a dev
// server is worth it: import.meta.env.DEV arms the "dice changed by demo" guard)
await page.route('**/@vite/client', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});'
    + 'export const updateStyle=(id,css)=>{let s=document.querySelector(`style[data-vite-dev-id="${id}"]`);if(!s){s=document.createElement("style");s.setAttribute("data-vite-dev-id",id);document.head.appendChild(s);}s.textContent=css;};'
    + 'export const removeStyle=()=>{};export const injectQuery=(u)=>u;',
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
const FRAME = 1000 / 60; // advance() steps whole 60 Hz frames
// a little real time per step: storm/gate entry race their lazy audio against REAL-time 2 s timeouts
const until = async (pred, max = 30000, step = 100) => { for (let t = 0; t <= max; t += step) { if (await ev(pred)) return t; await adv(step); await new Promise((r) => setTimeout(r, 15)); } return -1; };
// the ceremony's pre-roll races audio.prepareGate() against a REAL-time 2 s timeout: poll in real time too
const untilStarted = async () => { const t0 = Date.now(); while (Date.now() - t0 < 8000) { if (await ev(() => window.__slot.gate()?.started)) return Date.now() - t0; await adv(50); await new Promise((r) => setTimeout(r, 50)); } return -1; };
const untilState = (s, max) => until(new Function(`return window.__slot.state() === ${JSON.stringify(s)}`), max);
const stored = () => ev((k) => localStorage.getItem(k), KEY);
const storedDice = async () => JSON.parse((await stored()) ?? 'null');
const chip = () => ev(() => document.querySelector('#diceN .cur:last-child')?.textContent ?? document.getElementById('diceN').textContent);
// hud.press() drops a second press within 60 ms (real time): space the clicks out
const click = async (sel) => { await new Promise((r) => setTimeout(r, 80)); await ev((s) => document.querySelector(s).click(), sel); };
const shown = (id) => ev((i) => document.getElementById(i).classList.contains('show'), id);
const phase = () => ev(() => window.__slot.award().phase);
/** Bounds (viewport px) of a Pixi object when it is really on screen (visible up the chain, alpha > 1 %). */
const PIX = `(o) => { if (!o || o.destroyed) return null; for (let v = o; v; v = v.parent) if (!v.visible) return null;
  if (o.getGlobalAlpha(false) <= 0.01) return null; const h = document.getElementById('app').getBoundingClientRect(), b = o.getBounds();
  return { x: b.minX + h.left, y: b.minY + h.top, w: b.width, h: b.height }; }`;
const dieRect = () => ev(`(() => { const pix = ${PIX}; const a = window.__slot.world.stage.layers.banners.children.find((c) => c.label === 'dieAward');
  const d = a && a.children.find((c) => c.sp); return d ? pix(d.sp) : null; })()`);

async function boot(hash = '', fresh = false) {
  if (fresh) { await page.goto(base + '?seed=7'); await page.waitForFunction(() => window.__slot); await ev(() => localStorage.clear()); }
  await page.goto(base + '?seed=7' + hash);
  await page.waitForFunction(() => window.__slot, null, { timeout: 60000 });
  // no screenshots here: stop Pixi's own rAF render loop (SwiftShader) so stepping runs ~25× faster
  await ev(() => window.__slot.world.stage.app.ticker.stop());
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
  // find the result beat R to one frame: the celebration starts on it
  await adv(2800);
  let R = 2800;
  while (R < 12000 && (await state()) !== 'celebrating') { await adv(FRAME, FRAME); R += FRAME; }
  check(R >= 3000, 'result beat ≥ 3,0 s after the press', `${R.toFixed(0)} ms`);
  await adv(1400);
  check((await phase()) === 'none', 'no die before its birth beat (R+1,4)');
  await adv(200);
  check((await phase()) === 'born' && (await dieRect()) !== null, 'the Pixi award die is on screen at R+1,6', await phase());
  check((await chip()) === '0' && (await state()) === 'celebrating', 'chip unchanged while the die is shown');
  let landAt = -1, idleAt = -1, flyAt = -1, lastFly = null, lastTarget = null;
  for (let t = 1600 + FRAME; t < 6000 && idleAt < 0; t += FRAME) {
    await adv(FRAME, FRAME);
    const f = await ev(() => { const e = document.querySelector('#overlays .die-fly'); if (!e) return null; const r = e.getBoundingClientRect(); const i = document.getElementById('diceIco').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, tx: i.left + i.width / 2, ty: i.top + i.height / 2, tw: i.width }; });
    if (f) { lastFly = f; if (flyAt < 0) flyAt = t; }
    if (landAt < 0 && (await chip()) === '1') { landAt = t; lastTarget = lastFly; }
    if (idleAt < 0 && (await state()) !== 'celebrating') idleAt = t;
  }
  check(flyAt >= 2740 && flyAt <= 2790, 'the DOM flight starts at ≈ R+2,75 (hand-off from the Pixi die)', `R+${flyAt.toFixed(0)} ms`);
  check(landAt > 2600 && landAt <= 3500, 'die lands on the chip at ≈ R+3,35', `R+${landAt.toFixed(0)} ms`);
  const miss = lastTarget ? Math.hypot(lastTarget.x - lastTarget.tx, lastTarget.y - lastTarget.ty) : 99;
  check(miss <= 4 && lastTarget && Math.abs(lastTarget.w - lastTarget.tw) <= 4, 'the flight lands ON the chip icon (last frame centre and size)', lastTarget ? `Δ ${miss.toFixed(1)} px, ${lastTarget.w.toFixed(0)} vs ${lastTarget.tw.toFixed(0)} px` : 'no flight seen');
  check(!(await ev(() => !!document.querySelector('#overlays .die-fly'))), 'the flight canvas is removed at the landing');
  check(idleAt >= landAt, 'state leaves celebrating only after the landing', `R+${idleAt.toFixed(0)} ms`);
  check((await ev(() => window.__slot.award())).inFlight === false, 'award.inFlight false at idle');
  // first-die card 250 ms after idle; inert to Space for 1,5 s
  await adv(400);
  check((await state()) === 'diceCard' && (await ev(() => document.getElementById('summaryCard').classList.contains('relic'))), 'first-die card appears after the first die');
  await page.keyboard.press('Space');
  await adv(100);
  check((await state()) === 'diceCard', 'Space is ignored before 1,5 s');
  await click('#summaryCard [data-act="ok"]');
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
  // b · skip: a tap at R+1,2 (before the birth beat) → the die appears at once and lands ≤ 320 ms later
  // (the celebration takes a skip ≥ 1 s of REAL time after it starts: wait that out too)
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('celebrating', 12000);
  const r0 = Date.now();
  await adv(1200);
  await new Promise((r) => setTimeout(r, Math.max(0, 1150 - (Date.now() - r0))));
  await page.keyboard.press('Escape');
  let skipLand = -1;
  for (let t = FRAME; t <= 600 && skipLand < 0; t += FRAME) { await adv(FRAME, FRAME); if ((await chip()) === '3') skipLand = t; }
  check(skipLand > 0 && skipLand <= 300 + FRAME + 0.5, 'b · skip at R+1,2 lands the die ≤ 300 ms + 1 frame later', `${skipLand.toFixed(0)} ms`);
  // c · SPIN at the first idle frame: nothing of the award is in flight, and no die sound starts after the press
  for (let t = 0; t < 3000 && (await state()) !== 'idle'; t += FRAME) await adv(FRAME, FRAME);
  const inFlight = (await ev(() => window.__slot.award())).inFlight;
  await ev(() => { window.__slot.world.audio.playLog = []; window.__slot.spin(); });
  await adv(3500);
  const log = await ev(() => { const l = window.__slot.world.audio.playLog; window.__slot.world.audio.playLog = null; return l; });
  check(inFlight === false && !log.some((id) => id.startsWith('dieLand')), 'c · the next spin starts with no die in flight and no dieLand after the press', `inFlight ${inFlight}, sounds after the press: ${log.length} (audio ${await ev(() => window.__slot.world.audio.stats().state)})`);
  await untilState('idle', 12000);
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
  await adv(1600); await click('#summaryCard [data-act="ok"]'); await idle('dFirst', 3000);
  // previews
  for (const n of [0, 25, 250, 1000, 1948]) {
    await click(`#dSeg button[data-n="${n}"]`); await adv(1000);
    const rb = await ev(() => { const r = document.getElementById('chRibbon'); return r.hidden ? '' : r.textContent; });
    check((await state()) === 'chamber' && rb.startsWith('FORHÅNDSVISNING'), `preview ${n}: chamber with the amber ribbon`, rb);
    await click('#chDone'); await idle(`preview ${n}`, 3000);
  }
  // dGate, skipped at 2,5 s after T0 and in full
  for (const full of [false, true]) {
    if (full) await ev(() => { window.__slot.world.audio.playLog = []; });
    await click('#dGate');
    const st = await untilStarted();
    check(st >= 0, `dGate${full ? ' (full)' : ' (skip)'}: ceremony starts`, `${st} ms real time`);
    check(await ev(() => !document.getElementById('chRibbon').hidden && document.getElementById('chRibbon').textContent.startsWith('DEMO')), 'dGate: amber DEMO ribbon pinned');
    if (!full) {
      await until(() => (window.__slot.gate()?.t ?? -9) >= 2.5, 8000, 50);
      check(await ev(() => window.__slot.gate()?.canSkip), 'dGate: skippable at T0+2,5 s');
      await page.keyboard.press('Escape'); await adv(100);
      check(await ev(() => window.__slot.gate()?.placard), 'n · a skip at T0+2,5 s shows the placard at once');
    } else {
      // n · every frame of the full demo ceremony: the amber ribbon, #reg and #foot (opacity 1, inside the viewport)
      let bad = 0, frames = 0;
      for (let t = 0; t < 25000 && !(await ev(() => window.__slot.gate()?.placard)); t += 250) {
        await adv(250); frames++;
        if (!(await ev(() => { const vis = (el) => { const r = el.getBoundingClientRect(), c = getComputedStyle(el); return !el.hidden && c.visibility !== 'hidden' && +c.opacity === 1 && r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.width > 0; }; return vis(document.getElementById('chRibbon')) && vis(document.getElementById('reg')) && vis(document.getElementById('foot')); }))) bad++;
      }
      check(bad === 0 && frames > 40, 'n · demo ceremony: the ribbon, #reg and #foot are visible on every sampled frame', `${frames} frames, ${bad} bad`);
    }
    const pl = await until(() => window.__slot.gate()?.placard, 25000, 250);
    check(pl >= 0, `dGate${full ? ' (full)' : ' (skip)'}: placard`, `${pl} ms`);
    check(await ev(() => !!document.querySelector('#summaryCard.placard .demo-note')), 'dGate: placard starts with the demo note');
    check(await ev(() => { const g = window.__slot.world.stage.layers.chamber.children[0]; return g.state === 'open' && g.openT === 1 && g.keySeated && g.title.visible; }), 'n · ceremony end state: leaves open, key seated, the name shown');
    if (full) {
      // the gate cinematic owns the ceremony's sounds, all scheduled on T0 (the Polar Night bar grid)
      const log = await ev(() => { const l = window.__slot.world.audio.playLog; window.__slot.world.audio.playLog = null; return l; });
      const live = (await ev(() => window.__slot.world.audio.stats().state)) === 'running';
      const need = ['gateDrone', 'tileShimmer', 'dieBirth', 'keystone', 'sealCrack', 'lightPad', 'gateBreath'];
      const bells = log.filter((id) => id.startsWith('bell1948')).length;
      if (live) check(need.every((id) => log.includes(id)) && bells === 8, 'n · the ceremony plays its whole score: drone, shimmer, key, 4 year bells, seal, pad, breath, 4 echoes', `${log.filter((id) => need.includes(id) || id.startsWith('bell')).join(' ')}`);
      else console.log('      (audio not running headless: the ceremony score is not checked)');
    }
    await click('#summaryCard [data-act="endDemo"]');
    await idle('dGate end demo', 5000);
    check(await ev(() => document.getElementById('bannerT').textContent === 'DIN SAMLING ER UÆNDRET'), 'dGate: "DIN SAMLING ER UÆNDRET" banner');
    check((await ev(() => window.__slot.dice())).unlock !== 'seen', 'dGate never writes unlock');
  }
  // demo() and demoSuns() storms
  const storms = [['demo()', () => window.__slot.demo()], ['demoSuns()', () => document.getElementById('dSuns').click()]].filter(([n]) => n === 'demo()' || want.has('suns'));
  for (const [name, go] of storms) {
    await new Promise((r) => setTimeout(r, 80));
    await ev(go);
    const r = await untilState('stormReady', 30000);
    check(r >= 0, `${name}: storm ready`);
    await ev(() => window.__slot.startStorm());
    const s = await untilState('stormSummary', 90000);
    check(s >= 0, `${name}: storm summary`);
    await until(() => document.getElementById('summary').classList.contains('show'), 15000, 250);
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
  await until(() => document.getElementById('summary').classList.contains('show'), 15000, 250);
  const h = await ev((n) => window.__slot.save().history.slice(n), hist0);
  const expected = h.filter((e) => e.mode === 'storm' && !e.spinId.endsWith('-G') && e.winOre >= 10 * e.stakeOre).length;
  const marked = h.filter((e) => e.mode === 'storm' && e.die).length;
  const delta = (await ev(() => window.__slot.dice())).count - before;
  check(delta === expected && marked === expected, 'storm: count delta = qualifying storm spins (none for "-G")', `delta ${delta}, expected ${expected}, marked ${marked}, held max ${maxHeld}`);
  check(maxHeld === expected, 'storm: every storm die is held on the molten frame until the outro', `held ${maxHeld} of ${expected}`);
  const sum = await ev(() => document.getElementById('summaryCard').textContent);
  if (expected > 0) check(new RegExp(`Terninger fra stormen\\s*${expected}`).test(sum), 'storm: summary row "Terninger fra stormen"');
  check((await chip()) === chipBefore, 'storm: the chip does not move while the dice are held', `${chipBefore} → ${await chip()}`);
  await ev(() => window.__slot.cont());
  check((await untilState('idle', 20000)) >= 0, 'storm: idle after the outro');
  const a = await ev(() => window.__slot.award());
  check(a.held === 0 && a.heldDice === 0, 'storm: the held row is empty after the outro');
  check((await chip()) === String((await ev(() => window.__slot.dice())).count), '#diceN equals the count at idle', await chip());
}

// ------------------------------------------------------------------ e · reload mid-storm (no double count, held row restored)
if (want.has('resume')) {
  if (!['award', 'demo', 'storm'].some((k) => want.has(k))) { await boot('', true); await ev(() => window.__slot.setSeed(20260922)); await adv(1400); }
  const before = (await ev(() => window.__slot.dice())).count;
  const hist0 = await ev(() => window.__slot.save().history.length);
  await ev(() => window.__slot.qaNext('sun4'));
  await ev(() => { window.__slot.spin(); });
  check((await untilState('stormReady', 40000)) >= 0, 'resume: storm ready');
  await ev(() => window.__slot.startStorm());
  // reload right after the first storm die is committed (on the last spin this exercises the straight-to-payout resume)
  check((await until(() => { const a = window.__slot.save().activeStorm; return !a || (a.diceAwarded ?? 0) >= 1 || window.__slot.state() === 'stormSummary'; }, 60000, 50)) >= 0, 'resume: a storm die is committed');
  const mid = await ev(() => ({ awarded: window.__slot.save().activeStorm?.diceAwarded ?? 0, count: window.__slot.dice().count, at: window.__slot.save().activeStorm?.spinIndex }));
  console.log(`      resume: reload at storm spin ${mid.at} with ${mid.awarded} held`);
  await page.goto(base + '?seed=7');
  await page.waitForFunction(() => window.__slot, null, { timeout: 60000 });
  await ev(() => window.__slot.world.stage.app.ticker.stop());
  await adv(300);
  await ev(() => window.__slot.unlock());
  check((await until(() => ['stormReady', 'stormSummary'].includes(window.__slot.state()), 20000)) >= 0, 'resume: the storm resumes after the reload');
  const after = await ev(() => ({ awarded: window.__slot.save().activeStorm?.diceAwarded ?? 0, count: window.__slot.dice().count, held: window.__slot.award().held, shown: window.__slot.award().shown }));
  check(after.count === mid.count && after.awarded === mid.awarded, 'resume: the reload keeps the committed dice (no loss, no re-award)', `awarded ${mid.awarded} → ${after.awarded}, count ${mid.count} → ${after.count}`);
  check(after.held === after.awarded && after.shown === after.count - after.awarded, 'resume: the held row is rebuilt and the chip shows count − held', `held ${after.held}, shown ${after.shown}`);
  if ((await state()) === 'stormReady') await ev(() => window.__slot.startStorm());
  check((await untilState('stormSummary', 60000)) >= 0, 'resume: storm summary');
  await until(() => document.getElementById('summary').classList.contains('show'), 15000, 250);
  const h = await ev((n) => window.__slot.save().history.slice(n), hist0);
  const expected = h.filter((e) => e.mode === 'storm' && !e.spinId.endsWith('-G') && e.winOre >= 10 * e.stakeOre).length;
  const baseDie = h.filter((e) => e.mode === 'base' && e.die).length;
  const delta = (await ev(() => window.__slot.dice())).count - before;
  check(delta === expected + baseDie, 'resume: count delta = qualifying storm spins (no double count)', `delta ${delta}, storm ${expected}, trigger spin ${baseDie}`);
  const sum = await ev(() => document.getElementById('summaryCard').textContent);
  if (expected > 0) check(new RegExp(`Terninger fra stormen\\s*${expected}`).test(sum), 'resume: summary row counts the whole storm (diceAwarded survived the reload)');
  await ev(() => window.__slot.cont());
  check((await untilState('idle', 20000)) >= 0, 'resume: idle after the outro');
  check((await chip()) === String((await ev(() => window.__slot.dice())).count), 'resume: #diceN equals the count at idle', await chip());
}

// ------------------------------------------------------------------ m · unlock (1948 card, "Ikke nu", real ceremony)
if (want.has('unlock')) {
  if (!['award', 'demo', 'storm'].some((k) => want.has(k))) { await boot('', true); await ev(() => window.__slot.setSeed(20260922)); await adv(1400); }
  await adv(600);
  if ((await state()) === 'diceCard') { await adv(1600); await click('#summaryCard [data-act="ok"]'); await adv(300); }
  await ev(() => window.__slot.qaDice(1947));
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('idle', 20000);
  await adv(400);
  check((await state()) === 'diceCard' && (await ev(() => !!document.querySelector('#summaryCard .big1948'))), '1948 card at idle');
  check((await storedDice())?.unlock === 'pending' && (await storedDice())?.offered === true, "unlock 'pending' and offered persisted");
  await page.keyboard.press('Space'); await adv(1700); await page.keyboard.press('Space'); await adv(200);
  check((await state()) === 'diceCard', 'the 1948 card is inert to Space');
  await click('#summaryCard [data-act="later"]');
  await adv(300);
  check((await state()) === 'idle', '"Ikke nu" closes the card');
  await click('#diceBtn'); await adv(1000);
  check((await state()) === 'chamber' && (await ev(() => !document.getElementById('chOpen').hidden)), 'the chamber offers [Åbn porten]');
  await click('#chOpen');
  check((await untilStarted()) >= 0, 'real ceremony starts');
  await adv(9000);
  check((await storedDice())?.unlock === 'pending', "unlock still 'pending' before the seal beat (bar 5)");
  const pl = await until(() => window.__slot.gate()?.placard, 20000, 250);
  check(pl >= 0, 'real ceremony: placard');
  const d = await storedDice();
  check(d?.unlock === 'seen' && typeof d?.unlockedAt === 'number', "real ceremony: unlock 'seen' + unlockedAt persisted");
  await click('#summaryCard [data-act="back"]');
  check((await untilState('idle', 5000)) >= 0, '"Tilbage til NORDLYS" closes the chamber');
  check(await ev(() => document.getElementById('diceBtn').classList.contains('open')), 'chip has the .open ring');
  await click('#diceBtn'); await adv(1000);
  check(await ev(() => document.getElementById('chamber').dataset.state === 'open' && !document.getElementById('chReplay').hidden), 'the chamber reopens in the open state with [Se åbningen igen]');
  // replay: the leaves reset to the closed, all-lit pose, the whole ceremony runs as GENSYN, "Luk" returns to the open chamber
  const before = await stored();
  await click('#chReplay');
  check((await untilStarted()) >= 0 && (await ev(() => { const g = window.__slot.world.stage.layers.chamber.children[0]; return g.eyebrow.text === 'GENSYN' && !document.getElementById('chRibbon').hidden; })), 'replay: GENSYN eyebrow and the neutral ribbon');
  await until(() => (window.__slot.gate()?.t ?? -9) >= 1, 8000, 50);
  check(await ev(() => window.__slot.world.stage.layers.chamber.children[0].openT < 0.01), 'replay: the gate starts from the closed pose');
  check((await until(() => window.__slot.gate()?.placard, 25000, 250)) >= 0 && (await ev(() => !!document.querySelector('#summaryCard [data-act="close"]'))), 'replay: placard with "Luk"');
  await click('#summaryCard [data-act="close"]');
  check((await untilState('chamber', 3000)) >= 0 && (await ev(() => document.getElementById('chamber').dataset.state === 'open' && window.__slot.world.stage.layers.chamber.children[0].openT === 1)), 'replay: "Luk" returns to the open chamber');
  check((await stored()) === before, 'replay: nothing is written');
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
  if (!(await ev(() => document.getElementById('hello').hidden))) await click('#hello [data-hello="close"]');
  // opt-out: the chip hides, no award die, the count still increments
  await ev(() => window.__slot.game.dispatch({ t: 'settings', s: { dice: false } }));
  check(await ev(() => getComputedStyle(document.getElementById('diceBtn')).display === 'none'), 'opt-out: #diceBtn hidden');
  await ev(() => window.__slot.qaNext('die'));
  await ev(() => { window.__slot.spin(); });
  await untilState('celebrating', 12000); await adv(1700);
  check((await phase()) === 'none' && !(await ev(() => !!document.querySelector('#overlays .die-fly'))), 'opt-out: no award die on screen');
  await untilState('idle', 10000); await adv(400);
  check((await ev(() => window.__slot.dice())).count === 1 && (await state()) === 'idle', 'opt-out: the count still increments, no card');
  await ev(() => window.__slot.game.dispatch({ t: 'settings', s: { dice: true } }));
}

// ------------------------------------------------------------------ f · a Ladet spin: the die is judged at its LOCKED stake
if (want.has('perk')) {
  if (!['award', 'demo', 'storm', 'unlock', 'reset'].some((k) => want.has(k))) { await boot('', true); await adv(1400); }
  // a Ladet spin pending at a locked 1 kr while the stake shown is 10 kr (written into the live save too: a save on
  // unload writes the same), then a reload: the perk comes back from 'nordlys.v1'
  await ev(() => { const s = window.__slot.save(); s.stakeOre = 1000; s.meter = { charge: 60, stakeSumOre: 60 * 100 }; s.perksPending = 1; localStorage.setItem('nordlys.v1', JSON.stringify(s)); });
  await boot();
  if (!(await ev(() => document.getElementById('hello').hidden))) await click('#hello [data-hello="close"]');
  const pre = await ev(() => { const s = window.__slot.save(); return { perks: s.perksPending, stake: s.stakeOre, charge: s.meter.charge }; });
  check(pre.perks === 1 && pre.stake === 1000 && pre.charge === 60, 'f · a Ladet spin is pending after the reload (locked 1 kr, stake 10 kr)', JSON.stringify(pre));
  await ev(() => window.__slot.setSeed(20260922));
  const q = await ev(() => window.__slot.qaNext('diePerk'));
  const c0 = (await ev(() => window.__slot.dice())).count;
  await ev(() => { window.__slot.spin(); });
  const d1 = await storedDice();
  const last = await ev(() => { const h = window.__slot.save().history; return h[h.length - 1]; });
  check(d1?.count === c0 + 1, 'f · the Ladet spin that wins ≥ 10× its locked stake commits exactly one die at the press', `${c0} → ${d1?.count}`);
  check(last?.mode === 'perk' && last?.die === true && last?.stakeOre === 100 && last?.winOre >= 10 * 100, 'f · history: mode perk, die === true, stake = the locked 1 kr, win ≥ 10× it', `x ${q?.x?.toFixed(2)}, win ${last?.winOre} øre at ${last?.stakeOre} øre`);
  check(last?.winOre < 10 * 1000, 'f · the same win is < 10× the 10 kr stake shown (judged at that stake, it would give no die)', `${last?.winOre} øre`);
  for (let t = 0; t < 20000 && (await state()) !== 'idle'; t += 100) await adv(100);
  await adv(400);
  if ((await state()) === 'diceCard') { await adv(1600); await click('#summaryCard [data-act="ok"]'); await adv(300); }
  const after = await ev(() => ({ count: window.__slot.dice().count, perks: window.__slot.save().perksPending, st: window.__slot.state() }));
  check(after.st === 'idle' && after.count === c0 + 1 && after.perks === 0, 'f · idle after the Ladet spin: exactly one die, no Ladet spin left', JSON.stringify(after));
  check((await chip()) === String(after.count), 'f · #diceN equals the count at idle', await chip());
  await ev(() => { window.__slot.save().stakeOre = 200; });
}

// ------------------------------------------------------------------ h · the 365-day expiry resets the meter, never the dice
if (want.has('expiry')) {
  if (!['award', 'demo', 'storm', 'unlock', 'reset', 'perk'].some((k) => want.has(k))) { await boot('', true); await adv(1400); }
  if ((await ev(() => window.__slot.dice())).count === 0) await ev(() => window.__slot.qaDice(3));
  // the last spin 400 days ago, charge on the meter and a Ladet spin pending (the live save too: see 'perk')
  await ev(() => { const s = window.__slot.save(); s.meter = { charge: 3000, stakeSumOre: 3000 * 200 }; s.perksPending = 1; s.lastSpinAt = s.lastPlayed = Date.now() - 400 * 864e5; localStorage.setItem('nordlys.v1', JSON.stringify(s)); });
  const dBefore = await stored(), n0 = (await ev(() => window.__slot.dice())).count;
  await boot();
  const s = await ev(() => ({ charge: window.__slot.save().meter.charge, perks: window.__slot.save().perksPending, kp: window.__slot.kp() }));
  check(s.charge === 0 && s.perks === 0 && s.kp === 0, 'h · 365-day expiry: the Kp meter and the pending Ladet spin are reset on load', JSON.stringify(s));
  check(n0 > 0 && (await ev(() => window.__slot.dice())).count === n0, 'h · the expiry never touches the dice (count unchanged)', `${n0} → ${(await ev(() => window.__slot.dice())).count}`);
  check((await stored()) === dBefore, 'h · terningen.v1 is byte-identical after the expiry reload');
}

// ------------------------------------------------------------------ n · #1948_clean: the ribbon on every frame, Space skips
if (want.has('clean')) {
  await page.goto('about:blank'); // (a hash alone on the same URL would not reload the page)
  await boot('#1948_clean');
  const s0 = await stored();
  await ev(() => { window.__writes = {}; });
  check(await ev(() => getComputedStyle(document.getElementById('demoPill')).display === 'none' && getComputedStyle(document.getElementById('drawerWrap')).display === 'none'), '#clean hides #demoPill and #drawerWrap');
  check((await untilStarted()) >= 0, '#1948_clean: the demo ceremony starts from the deep link');
  const ribbon = () => ev(() => { const el = document.getElementById('chRibbon'), r = el.getBoundingClientRect(), c = getComputedStyle(el);
    return !el.hidden && c.display !== 'none' && c.visibility !== 'hidden' && +c.opacity === 1 && r.width > 0 && r.top >= 0 && el.textContent.startsWith('DEMO'); });
  let bad = 0, frames = 0;
  for (let t = 0; t < 12000 && ((await ev(() => window.__slot.gate()?.t)) ?? -9) < 2.5; t += 100) { await adv(100); frames++; if (!(await ribbon())) bad++; }
  check(await ev(() => document.activeElement === document.getElementById('chamber')), 'n · in the ceremony the dialog itself holds focus (its controls are inert)', await ev(() => document.activeElement?.id || document.activeElement?.tagName));
  await page.keyboard.press('Space');
  await adv(100);
  check(await ev(() => window.__slot.gate()?.placard), 'n · Space at T0+2,5 s skips: the placard at once');
  frames++; if (!(await ribbon())) bad++;
  check(bad === 0 && frames > 10, 'n · #1948_clean: the amber DEMO ribbon is visible on every sampled frame, the placard included', `${frames} frames, ${bad} bad`);
  await adv(1200); await new Promise((r) => setTimeout(r, 500));
  await click('#summaryCard [data-act="endDemo"]');
  check((await untilState('idle', 6000)) >= 0, '#1948_clean: "Afslut demo" returns to idle');
  check((await ev((k) => window.__writes[k] ?? 0, KEY)) === 0 && (await stored()) === s0, '#1948_clean: ZERO writes to terningen.v1');
}

// ------------------------------------------------------------------ the placard on phones: the claim whole with its guard
if (want.has('placard')) {
  const inBox = (a, b) => !!a && !!b && a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
  const ovb = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);
  const PL = `(() => { const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    // whole: nothing of it is cut away by a clipping (scrolling) ancestor or the viewport
    const whole = (e) => { const r = e.getBoundingClientRect(); let l = Math.max(0, r.left), t = Math.max(0, r.top), rr = Math.min(innerWidth, r.right), b = Math.min(innerHeight, r.bottom);
      for (let a = e.parentElement; a; a = a.parentElement) { const c = getComputedStyle(a); if (c.overflowX !== 'visible' || c.overflowY !== 'visible') { const q = a.getBoundingClientRect(); l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom); } }
      return rr - l >= r.width - 0.5 && b - t >= r.height - 0.5; };
    const card = document.getElementById('summaryCard'), rb = document.getElementById('chRibbon');
    const g = window.__slot.world.stage.layers.chamber.children[0], h = document.getElementById('app').getBoundingClientRect();
    const pix = (o) => { if (!o.visible || o.alpha < 0.05) return null; const b = o.getBounds(); return { x: b.minX + h.left, y: b.minY + h.top, w: b.width, h: b.height }; };
    return { vw: innerWidth, vh: innerHeight, card: box(card), claim: [...card.querySelectorAll('.pl-claim p')].map((p) => ({ ...box(p), whole: whole(p) })),
      guard: /ikke et tilbud.*ikke lovet/.test(card.querySelector('.pl-claim')?.textContent ?? ''),
      btns: [...card.querySelectorAll('.btns button')].map((b) => ({ ...box(b), fits: b.scrollWidth <= b.clientWidth + 1 })),
      ribbon: rb.hidden ? null : box(rb), foot: box(document.getElementById('foot')), reg: box(document.getElementById('reg')), title: pix(g.title), concept: pix(g.concept) }; })()`;
  const dir = process.env.SHOTS || 'shots/dice';
  mkdirSync(dir, { recursive: true });
  for (const [vw, vh] of [[360, 640], [375, 667], [844, 390]]) {
    const tag = `${vw}×${vh}`;
    await page.setViewportSize({ width: vw, height: vh });
    await boot('', true);
    await ev(() => window.__slot.qaDice(1948));
    for (const kind of ['real', 'demo']) {
      if (kind === 'real') { await click('#diceBtn'); await adv(1200); await click('#chOpen'); } else await click('#dGate');
      check((await untilStarted()) >= 0, `${tag} · ${kind} ceremony starts`);
      await until(() => window.__slot.gate()?.canSkip, 8000, 50);
      await page.keyboard.press('Escape');
      await until(() => window.__slot.gate()?.placard, 3000, 50);
      await adv(1200); await new Promise((r) => setTimeout(r, 500)); await adv(50); // the card's 0,4 s CSS entry runs in real time
      const l = await ev(PL);
      const V = { x: 0, y: 0, w: l.vw, h: l.vh };
      await ev(() => window.__slot.advance(16, true)); await page.screenshot({ path: `${dir}/placard-${kind}-${vw}x${vh}.png` });
      check(l.claim.length === 2 && l.guard && l.claim.every((p) => p.whole && inBox(p, l.card) && inBox(p, V)), `${tag} · ${kind} placard: p1 and the claim with its guard whole on screen (never clipped, never scrolled)`);
      check(l.btns.length > 0 && l.btns.every((b) => b.fits && inBox(b, l.card) && inBox(b, V)), `${tag} · ${kind} placard: every button inside the card and the screen`, l.btns.map((b) => `${b.x.toFixed(0)}–${(b.x + b.w).toFixed(0)}`).join(' '));
      check(inBox(l.card, V) && !ovb(l.card, l.reg) && !ovb(l.card, l.foot) && !ovb(l.card, l.ribbon), `${tag} · ${kind} placard: clear of #reg, #foot${l.ribbon ? ' and the ribbon' : ''}`);
      check(!!l.title && !!l.concept && inBox(l.title, V) && inBox(l.concept, V) && !ovb(l.card, l.title) && !ovb(l.card, l.concept), `${tag} · ${kind} placard: "AUTOMAT 1948" and its label whole on screen, not under the card`);
      await click(`#summaryCard [data-act="${kind === 'real' ? 'back' : 'endDemo'}"]`);
      check((await untilState('idle', 6000)) >= 0, `${tag} · ${kind} placard closes to idle`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

// ------------------------------------------------------------------ visual pass: shots + layout assertions per viewport
if (want.has('visual')) {
  const dir = process.env.SHOTS || 'shots/dice';
  mkdirSync(dir, { recursive: true });
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);
  const inside = (a, L) => !!a && a.x >= -0.5 && a.y >= -0.5 && a.x + a.w <= L.vw + 0.5 && a.y + a.h <= L.vh + 0.5;
  const within = (a, b) => !!a && !!b && a.x >= b.x - 0.5 && a.y >= b.y - 0.5 && a.x + a.w <= b.x + b.w + 0.5 && a.y + a.h <= b.y + b.h + 0.5;
  const LAYOUT = `(() => { const pix = ${PIX};
    const dom = (el) => { if (!el) return null; const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      if (el.hidden || c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || r.width < 1 || r.height < 1) return null; return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const g = window.__slot.world.stage.layers.chamber.children[0];
    const a = window.__slot.world.stage.layers.banners.children.find((c) => c.label === 'dieAward');
    const die = a && a.children.find((c) => c.sp);
    const b = document.getElementById('bal');
    return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, balOk: b.scrollWidth <= b.clientWidth,
      reg: dom(document.getElementById('reg')), foot: dom(document.getElementById('foot')), deck: dom(document.getElementById('deck')), arc: dom(document.getElementById('slot-arc')),
      chip: dom(document.getElementById('diceBtn')), cellL: dom(document.querySelector('.cell-l')), hello: dom(document.getElementById('hello')),
      die: die ? pix(die.sp) : null, cap: die && die.cap ? pix(die.cap) : null, fly: dom(document.querySelector('#overlays .die-fly')),
      chN: dom(document.getElementById('chN')), facts: [...document.querySelectorAll('#chFacts li')].map(dom),
      mythChip: [...document.querySelectorAll('#chMyth .chip.concept')].map(dom).find(Boolean) ?? null, done: dom(document.getElementById('chDone')),
      slot: dom(document.getElementById('chGate')), myth: [...document.querySelectorAll('#chMyth .l')].map(dom).filter(Boolean),
      title: g && g.visible ? pix(g.title) : null, concept: g && g.visible ? pix(g.concept) : null, eyebrow: g && g.visible ? pix(g.eyebrow) : null,
      lintel: g && g.visible ? g.digits.map(pix).filter(Boolean) : [], card: dom(document.getElementById('summaryCard')) }; })()`;
  const L = () => ev(LAYOUT);
  for (const [vw, vh] of [[390, 844], [375, 667], [1920, 1080]]) {
    await page.setViewportSize({ width: vw, height: vh });
    const tag = `${vw}×${vh}`;
    const snap = async (name) => { await ev(() => window.__slot.advance(16, true)); await page.screenshot({ path: `${dir}/${name}-${vw}x${vh}.png` }); };
    await boot('', true);
    await ev(() => window.__slot.setSeed(20260922));
    // the chip at rest (0: the empty socket)
    let l = await L();
    await snap('dice-chip-0');
    check(within(l.chip, l.cellL) && within(l.chip, l.deck) && l.balOk && l.sw <= l.vw, `${tag} · chip at rest: inside .cell-l and #deck, no ellipsis on #bal, no horizontal scroll`);
    await adv(1400);
    await new Promise((r) => setTimeout(r, 450)); // its 0,4 s CSS entry runs in real time
    l = await L();
    await snap('dice-hello');
    check(inside(l.hello, l) && !ov(l.hello, l.reg) && !ov(l.hello, l.foot), `${tag} · hello card inside the viewport, clear of #reg and #foot`);
    // the award: birth (R+2,0), mid-flight (R+3,0), the first-die card
    await ev(() => window.__slot.qaNext('die'));
    await ev(() => { window.__slot.spin(); });
    await adv(2800);
    while ((await state()) !== 'celebrating') await adv(FRAME, FRAME);
    await adv(2000);
    l = await L();
    await snap('die-birth');
    const clear = (r) => r && inside(r, l) && !ov(r, l.deck) && !ov(r, l.arc) && !ov(r, l.reg) && !ov(r, l.foot);
    check(clear(l.die) && clear(l.cap), `${tag} · award die + caption inside the viewport, clear of the deck, the Kp arc, #reg and #foot`, JSON.stringify(l.die));
    await adv(1000);
    l = await L();
    await snap('die-flight');
    check(!!l.fly && inside(l.fly, l), `${tag} · mid-flight: the DOM die is on its way to the chip`);
    await untilState('idle', 10000);
    await adv(400);
    l = await L();
    await snap('dice-first-card');
    check((await state()) === 'diceCard' && inside(l.card, l) && !ov(l.card, l.reg) && !ov(l.card, l.foot), `${tag} · first-die card inside the viewport, clear of #reg and #foot`);
    await adv(1600); await click('#summaryCard [data-act="ok"]'); await untilState('idle', 3000);
    await snap('dice-chip-1');
    // the chamber: count 0 / 250 (previews), the real one (1), the open gate (1948 preview)
    for (const n of ['0', '250', 'real', '1948']) {
      if (n === 'real') await click('#diceBtn'); else await click(`#dSeg button[data-n="${n}"]`);
      await adv(1200); await new Promise((r) => setTimeout(r, 250)); await adv(100); // the gate rebuild is debounced in real time
      l = await L();
      await snap(`chamber-${n}`);
      const els = [l.chN, ...l.facts, l.mythChip, l.done];
      let pair = 0;
      for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) pair += ov(els[i], els[j]);
      const txt = [...l.lintel, l.title, l.concept].filter(Boolean);
      check(els.every((e) => inside(e, l) && !ov(e, l.reg) && !ov(e, l.foot)) && pair < 1, `${tag} · chamber ${n}: #chN, F1–F3, the concept chip and "Luk" inside the viewport, apart, clear of #reg/#foot`);
      check((vh <= vw || l.slot.h >= 200 - 0.5) && l.sw <= l.vw, `${tag} · chamber ${n}: gate slot ≥ 200 px in portrait, no horizontal scroll`, `${l.slot?.h.toFixed(0)} px`);
      check(l.lintel.length === 4 && txt.every((r) => r.x >= -1 && r.x + r.w <= l.vw + 1 && !ov(r, l.reg) && !ov(r, l.foot)) && !l.lintel.some((d) => l.myth.some((m) => ov(d, m) > 4)), `${tag} · chamber ${n}: the Pixi lintel${n === '1948' ? ', "AUTOMAT 1948" and its label' : ''} on screen, clear of #reg/#foot and the myth text`);
      if (n === '1948') check(!!l.title && !!l.concept && l.concept.y > l.title.y, `${tag} · open gate: the name with its concept label directly under it`);
      await click('#chDone'); await untilState('idle', 3000);
    }
    // the ceremony (demo): key frames on T0; #reg/#foot and the ribbon stay; the placard never covers the name
    await click('#dGate');
    check((await untilStarted()) >= 0, `${tag} · demo ceremony starts`);
    for (const [t, name] of [[1.0, 'gate-bar1'], [3.4, 'gate-bar2'], [6.9, 'gate-bar3'], [10.0, 'gate-bar4'], [11.55, 'gate-bar5'], [13.2, 'gate-swing'], [15.6, 'gate-bar6']]) {
      await until(new Function(`return (window.__slot.gate()?.t ?? -9) >= ${t}`), 25000, 50);
      l = await L();
      await snap(name);
      const ok = [l.eyebrow, l.title, l.concept, ...l.lintel].filter(Boolean).every((r) => !ov(r, l.reg) && !ov(r, l.foot));
      check(inside(l.reg, l) && inside(l.foot, l) && ok && (await ev(() => !document.getElementById('chRibbon').hidden)), `${tag} · ceremony T0+${t} s: #reg/#foot on screen, the Pixi texts clear of them, the ribbon pinned`);
    }
    await until(() => window.__slot.gate()?.placard, 20000, 100);
    await adv(1200);
    l = await L();
    await snap('gate-placard');
    check(!!l.title && !ov(l.card, l.title) && !ov(l.card, l.concept) && inside(l.card, l) && !ov(l.card, l.foot), `${tag} · the placard never covers "AUTOMAT 1948" and its label`);
    await click('#summaryCard [data-act="endDemo"]');
    await untilState('idle', 6000);
  }
  await page.setViewportSize({ width: 390, height: 844 });
}

await browser.close();
const bad = errors.filter((e) => !/GPU stall|GL Driver|WebGL/.test(e));
if (bad.length) { console.log('\nconsole/page errors:\n' + bad.join('\n')); }
check(!bad.some((e) => e.includes('dice changed by demo')), 'no "dice changed by demo" guard errors');
console.log(`\n${fails.length || bad.length ? `FAILED: ${fails.length} checks, ${bad.length} errors` : 'ALL DICE CHECKS PASSED'}`);
process.exit(fails.length || bad.length ? 1 : 0);
