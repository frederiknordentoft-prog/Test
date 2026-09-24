// Deterministic Playwright tour of the whole game (SwiftShader WebGL2), with layout assertions.
// Usage: node scripts/tour.mjs [baseUrl] [viewport=all | 390x844 | 360x640,844x390] [dpr=1] [only=comma,list] [mode=both | hud | classic]
//   all = 360×640, 375×667, 390×844, 844×390, 1280×720, 1920×1080.
// Drives window.__slot with fixed-step advance(), so shots land on exact timeline moments.
//   hud:     the HUD pass — the niche at 0 (frozen) and at n, the hello card, SPIN idle / Ladet spin / autospin, the
//            autospin sheet and a running autospin, the Kvit eller dobbelt card (offer, throw, result), the chamber with
//            the die, the menu's "Terningen" tab. At every resting frame it asserts that the niche, SPIN, the AUTO pill,
//            #winstrip, the grid frame (World.gridRect + its rim), #reg, #foot, the hello card and the stake controls do
//            not overlap and stay on screen (desktop: #sideR fits without scrolling).
//   classic: the original tour (cascade, return, big win and the first die, Kp 7, the demo storm).
// Exit code 1 on any page error or failed assertion. Shots: shots/tour-<vp>/.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const ALL = ['360x640', '375x667', '390x844', '844x390', '1280x720', '1920x1080'];
const [base = 'http://127.0.0.1:4173/', vpArg = 'all', dpr = '1', only = '', mode = 'both'] = process.argv.slice(2);
const vps = vpArg === 'all' ? ALL : vpArg.split(',');
const want = new Set(only ? only.split(',') : []);
const runHud = mode === 'both' || mode === 'hud', runClassic = mode === 'both' || mode === 'classic';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const fails = [];
const allErrors = [];

for (const vp of vps) {
  const [W, H] = vp.split('x').map(Number);
  const dir = `shots/tour-${vp}`;
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +dpr });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  const warnings = new Map();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
    if (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text())) warnings.set(m.text().slice(0, 160), (warnings.get(m.text().slice(0, 160)) ?? 0) + 1);
  });
  const check = (ok, name, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${vp} · ${name}${detail ? '  · ' + detail : ''}`); if (!ok) fails.push(`${vp} · ${name}`); };
  const ev = (f, a) => page.evaluate(f, a);
  // advance game time in small chunks so awaited continuations run between them
  const adv = (ms) => ev(async (ms) => {
    const step = 50;
    for (let t = 0; t < ms; t += step) { window.__slot.advance(Math.min(step, ms - t), false); await new Promise((r) => setTimeout(r, 0)); }
    window.__slot.advance(0, true);
  }, ms);
  const real = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => {
    if (want.size && !want.has(name)) return;
    await ev(() => window.__slot.advance(0, true));
    await page.screenshot({ path: `${dir}/${name}.png`, timeout: 120000 }); // SwiftShader under load: a frame can take long
    console.log('shot', vp, name);
  };
  const state = () => ev(() => window.__slot.state());
  const untilState = async (s, max = 20000) => { for (let t = 0; t < max; t += 250) { if ((await state()) === s) return true; await adv(250); } console.log('timeout waiting for', s, 'now', await state()); return false; };
  const until = async (src, max = 20000, dt = 100) => { const f = new Function(`return (${src});`); for (let t = 0; t <= max; t += dt) { if (await ev(f)) return true; await adv(dt); } return false; };
  const click = async (sel) => { await real(80); await ev((s) => document.querySelector(s)?.click(), sel); };

  /** Every box that must stay apart (viewport px; null = not on screen). The grid frame: World.gridRect + a 7 px rim. */
  const LAYOUT = () => ev(() => {
    const vis = (el) => { if (!el) return null; const r = el.getBoundingClientRect(), c = getComputedStyle(el);
      if (el.closest('[hidden]') || c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05 || r.width < 1 || r.height < 1) return null;
      for (let a = el; a; a = a.parentElement) if (+getComputedStyle(a).opacity < 0.05) return null;
      return { x: r.left, y: r.top, w: r.width, h: r.height }; };
    const host = document.getElementById('app').getBoundingClientRect(), g = window.__slot.world.gridRect, rim = 7;
    const spin = vis(document.getElementById('spinBtn'));
    const side = document.getElementById('sideR');
    return {
      vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth,
      niche: vis(document.querySelector('#vault .v-niche')), count: vis(document.querySelector('#vault .v-count')),
      spin: spin && { x: spin.x - 3.5, y: spin.y - 3.5, w: spin.w + 7, h: spin.h + 7 }, // + the 3 s ring (3,3 px past the button)
      pill: vis(document.querySelector('#autoBtn .ap-face')), win: vis(document.getElementById('winstrip')),
      frame: { x: g.x - rim + host.left, y: g.y - rim + host.top, w: g.size + 2 * rim, h: g.size + 2 * rim },
      reg: vis(document.getElementById('reg')), foot: vis(document.getElementById('foot')), hello: vis(document.getElementById('hello')),
      stake: vis(document.querySelector('#deck .stake .row')), stakeLbl: vis(document.querySelector('#deck .stake .lbl')), saldo: vis(document.getElementById('bal')),
      link: vis(document.getElementById('diceLink')), side: side && getComputedStyle(side).display !== 'none' ? { sh: side.scrollHeight, ch: side.clientHeight } : null,
      desk: document.getElementById('vault').classList.contains('desk'),
    };
  });
  /** SPIN's place under an offer card: bets reaching into it (+ 6 px), what a tap on a 5 × 5 grid over it hits. */
  const spinHit = () => ev(() => { const s = document.getElementById('spinBtn').getBoundingClientRect(), pad = 6;
    const over = [...document.querySelectorAll('#summaryCard [data-gamble="double"], #summaryCard [data-gamble="triple"]')].map((b) => b.getBoundingClientRect())
      .filter((r) => r.right > s.left - pad && r.left < s.right + pad && r.bottom > s.top - pad && r.top < s.bottom + pad).length;
    const hits = new Set();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const e = document.elementFromPoint(s.left + (s.width * (i + 0.5)) / 5, s.top + (s.height * (j + 0.5)) / 5); hits.add(e?.closest('[data-gamble]')?.dataset.gamble ?? (e?.closest('#spinBtn') ? 'spin' : 'none')); }
    return { over, hits: [...hits].sort().join(','), fit: document.getElementById('summaryCard').dataset.fit ?? '0' }; });
  const spinSafe = async (tag) => { const h = await spinHit(); check(h.over === 0 && !/double|triple/.test(h.hits), `${tag}: no bet covers SPIN's place (a tap there by habit keeps or does nothing)`, JSON.stringify(h)); };
  const ov = (a, b) => (a && b ? Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) : 0);
  const inside = (a, L) => !!a && a.x >= -0.5 && a.y >= -0.5 && a.x + a.w <= L.vw + 0.5 && a.y + a.h <= L.vh + 0.5;
  const PAIRS = [
    ['niche', ['spin', 'pill', 'win', 'frame', 'reg', 'foot', 'stake', 'stakeLbl', 'hello']],
    ['spin', ['pill', 'win', 'frame', 'reg', 'foot', 'stake', 'stakeLbl', 'saldo']],
    ['pill', ['win', 'frame', 'reg', 'foot', 'stake', 'saldo']],
    ['hello', ['reg', 'foot', 'spin', 'pill', 'stake', 'stakeLbl', 'win']],
    ['win', ['frame']],
  ];
  const layoutOk = async (tag, o = {}) => {
    const L = await LAYOUT();
    const bad = [];
    for (const [a, bs] of PAIRS) for (const b of bs) { const x = ov(L[a], L[b]); if (x > 0.5) bad.push(`${a}×${b} ${x.toFixed(0)} px²`); }
    for (const k of ['niche', 'spin', 'pill', 'hello', 'reg', 'foot']) if (L[k] && !inside(L[k], L)) bad.push(`${k} off screen`);
    if (!o.noNiche && !L.niche) bad.push('niche not on screen');
    if (!L.pill) bad.push('AUTO pill not on screen');
    if (L.sw > L.vw) bad.push(`horizontal scroll ${L.sw} > ${L.vw}`);
    if (L.side && L.side.sh > L.side.ch + 1) bad.push(`#sideR scrolls ${L.side.sh} > ${L.side.ch}`);
    if (L.desk && !L.link) bad.push('desktop: "Porten under klinten ›" not on screen');
    check(bad.length === 0, `${tag}: the niche, SPIN, AUTO, #winstrip, the grid frame, #reg, #foot, the hello card and the stake apart and on screen`, bad.join(' · '));
    return L;
  };

  await page.goto(base + '?seed=7');
  await page.waitForFunction(() => window.__slot, null, { timeout: 30000 });
  await ev(() => { localStorage.clear(); window.__slot.setSeed(20260922); });
  // stepped time only: Pixi's own rAF render loop is stopped (every shot renders its frame through advance(…, true)),
  // so SwiftShader does not draw 60 frames a second between the steps
  await ev(() => window.__slot.world.stage.app.ticker.stop());

  await adv(1600);
  // the splash welcome animates on the wall clock (CSS): land it on its final frame so the shot is deterministic
  await ev(() => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('#welcome')) a.finish(); });
  await shot('01-splash');
  check(await ev(() => getComputedStyle(document.getElementById('vault')).visibility === 'hidden'), 'splash: the niche is hidden');
  await ev(() => window.__slot.unlock());
  await adv(900); await shot('02-ignite');
  await untilState('idle'); await adv(300); await shot('03-idle');

  if (runHud) {
    // ---------------------------------------------------------------- the niche at 0 (frozen), SPIN idle, the hello card
    await real(500); // the deck's 0,6 s fade-in after the splash runs on the wall clock
    await layoutOk('idle, 0 dice');
    check(await ev(() => document.getElementById('vault').classList.contains('zero') && getComputedStyle(document.querySelector('#vault .v-frozen')).opacity === '1'), 'the niche at 0: the die frozen in the ice');
    await shot('h10-niche-0');
    await adv(1400); await real(450);
    if (await ev(() => !document.getElementById('hello').hidden)) {
      await layoutOk('hello card');
      // above the niche: the caret under the die (x); beside it (landscape phones): on the card's right edge, the die to its right
      const caret = await ev(() => { const h = document.getElementById('hello'), c = h.querySelector('.caret').getBoundingClientRect(), i = document.getElementById('diceIco').getBoundingClientRect();
        if (!h.classList.contains('side')) return Math.abs(c.left + c.width / 2 - (i.left + i.width / 2));
        const r = h.getBoundingClientRect(), cy = Math.max(r.top + 12, Math.min(r.bottom - 12, i.top + i.height / 2));
        return c.left + c.width / 2 >= r.right - 2 && i.left > r.right ? Math.abs(c.top + c.height / 2 - cy) : 99; });
      check(caret <= 14, 'hello card: the caret points at the niche die', `${caret.toFixed(1)} px`);
      await shot('h11-hello');
      await click('#hello [data-hello="close"]');
      await adv(200);
      check(await ev(() => { const h = document.getElementById('hello'); return h.hidden && getComputedStyle(h).display === 'none'; }), 'hello card: "Luk" closes it');
    } else check(false, 'hello card shown 1,2 s after the first idle');
    // SPIN: Ladet spin and low balance looks (HUD states only)
    await ev(() => window.__slot.game.hud.setSpin('perk'));
    await real(900); await shot('h12-spin-perk');
    await ev(() => window.__slot.game.hud.setSpin('idle'));

    // ---------------------------------------------------------------- the first die thaws the niche
    await ev(() => window.__slot.qaNext('die'));
    await ev(() => { window.__slot.spin(); });
    // the first-die card follows the landing 250 ms into idle
    await until("window.__slot.state() === 'diceCard'", 40000);
    if ((await state()) === 'diceCard') { await adv(1600); await click('#summaryCard [data-act="ok"]'); await untilState('idle', 5000); }
    else check(false, 'the first-die card after the first die');
    await real(300);
    check(await ev(() => !document.getElementById('vault').classList.contains('zero') && document.querySelector('#diceN .cur:last-child').textContent === '1'), 'the first die: the niche thawed, count 1');

    // ---------------------------------------------------------------- Kvit eller dobbelt: offer, throw, result
    await ev(() => window.__slot.qaNext('die'));
    await ev(() => { window.__slot.spin(); });
    if (await until("window.__slot.state() === 'gambleOffer'", 30000)) {
      await real(480); await adv(100);
      const g = await ev(() => { const c = document.getElementById('summaryCard'), r = c.getBoundingClientRect(), f = document.getElementById('foot').getBoundingClientRect(), rg = document.getElementById('reg').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, h: r.height, left: r.left, right: r.right, foot: f.top, reg: rg.bottom, cardTop: window.__slot.game.hud.gambleCardTop(), host: document.getElementById('app').getBoundingClientRect().top, spin: document.getElementById('spinBtn').getBoundingClientRect().left,
          focus: document.activeElement?.dataset?.gamble ?? null, roll: [...c.querySelectorAll('.g-roll, .g-faces')].every((e) => getComputedStyle(e).display === 'none'), medal: !!c.querySelector('canvas.medal')?.width }; });
      const phone = !(W >= 1000 && W / H >= 1.25), side = W <= 999 && H <= 500 && W > H;
      check(g.top >= g.reg && g.bottom <= g.foot + 0.5 && g.left >= 0 && g.right <= W + 0.5, 'gamble card inside the screen, clear of #reg and #foot', `${g.top.toFixed(0)}–${g.bottom.toFixed(0)}`);
      if (side) check(g.right <= g.spin - 9.5 && g.left >= W * 0.4, 'short landscape: the card stands in a right-hand column left of SPIN (the die beside it)', `${g.left.toFixed(0)}–${g.right.toFixed(0)}, SPIN at ${g.spin.toFixed(0)}`);
      else if (phone) check(g.h <= 0.43 * H + 0.5, 'phones: the card is a bottom sheet ≤ 43 % of the height (the staged die stays in view)', `${g.h.toFixed(0)} px of ${H}`);
      // the staged die keeps the brief's 120 px floor beside / above the card
      const dieS = await ev(() => window.__slot.world.stage.layers.banners.children.find((c) => c.label === 'dieAward')?.moment?.['tS'] ?? 0);
      check(dieS >= 120, 'the staged die is ≥ 120 px (its band clear of the card)', `${dieS.toFixed(0)} px`);
      await spinSafe('the offer card');
      check(Math.abs(g.cardTop - (g.top - g.host)) <= 1.5, 'hud.gambleCardTop() is the card\'s top edge', `${g.cardTop.toFixed(1)} vs ${(g.top - g.host).toFixed(1)}`);
      check(g.focus === 'keep' && g.medal, 'Behold is focused first; the die medal is painted');
      // the shot once the die has risen and grown to its stage (the 0,7 s lift; the money celebration has closed)
      await adv(1000);
      await shot('h20-gamble-offer');
      await adv(100);
      await ev(() => window.__slot.qaGamble(5));
      await real(300);
      await click('#summaryCard [data-gamble="double"]');
      await adv(1300); await real(100);
      const thr = await ev(() => { const c = document.getElementById('summaryCard'); return { g: c.dataset.g, roll: [...c.querySelectorAll('.g-roll')].every((e) => getComputedStyle(e).display === 'none'), h: c.getBoundingClientRect().height }; });
      check(thr.g === 'throw' && thr.roll && thr.h <= 0.3 * H, 'the throw: compact text only (no ⚀–⚅ stand-in on screen)', JSON.stringify(thr));
      await shot('h21-gamble-throw');
      await until("document.getElementById('summaryCard').textContent.includes('Terningen viser')", 8000, 50);
      await adv(200);
      // the compact result card never covers the niche (the payout dice land in view)
      const cov = await ev(() => { const a = document.getElementById('summaryCard').getBoundingClientRect(), b = document.querySelector('#vault .v-niche').getBoundingClientRect();
        return b.width < 1 ? 0 : Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); });
      check(cov < 1, 'the result card leaves the niche in view (the payout dice land where they can be seen)', `${cov.toFixed(0)} px²`);
      await shot('h22-gamble-result');
      await untilState('idle', 20000);
      await adv(300); await real(300);
    } else check(false, 'the Kvit eller dobbelt card after the 2nd die');

    // the other offer cards (the storm's for k = 3 and k = 20, and the demo's): no bet ever covers SPIN's place
    for (const o of [{ source: 'storm', k: 3 }, { source: 'storm', k: 20 }, { source: 'spin', k: 1, demo: true }]) {
      await ev((o) => window.__slot.qaCard(o), o);
      await real(450);
      await spinSafe(`the ${o.demo ? 'demo' : `storm (k ${o.k})`} offer card`);
      await ev(() => window.__slot.qaCard(null));
      await real(450);
    }
    await real(300);
    await ev(() => window.__slot.game.dispatch({ t: 'demoGamble' }));
    if (await until("window.__slot.state() === 'gambleOffer' && window.__slot.gambleRun()?.armed", 15000, 100)) {
      await real(450);
      await spinSafe('the demo choice');
      const dS = await ev(() => window.__slot.world.stage.layers.banners.children.find((c) => c.label === 'dieAward')?.moment?.['tS'] ?? 0);
      check(dS >= 120, 'the demo die is ≥ 120 px (its band clear of the card and the DEMO band)', `${dS.toFixed(0)} px`);
      await ev(() => window.__slot.choose('keep'));
      await untilState('idle', 20000);
      await adv(300); await real(300);
    } else check(false, 'the demo choice card');

    // ---------------------------------------------------------------- the niche at n, autospin sheet and a running autospin
    await ev(() => window.__slot.qaDice(12));
    await adv(100); await real(200);
    await layoutOk('idle, 12 dice');
    await shot('h13-niche-n');
    await ev(() => window.__slot.game.dispatch({ t: 'autoSheet', open: true }));
    await real(450);
    const sh = await ev(() => { const s = document.getElementById('autoSheet').getBoundingClientRect(), rg = document.getElementById('reg').getBoundingClientRect(), f = document.getElementById('foot').getBoundingClientRect();
      return { top: s.top, bottom: s.bottom, left: s.left, right: s.right, reg: rg.bottom, foot: f.top, n: document.querySelectorAll('#autoN button').length, l: document.querySelectorAll('#autoL button').length }; });
    check(sh.top >= sh.reg - 0.5 && sh.bottom <= sh.foot + 0.5 && sh.left >= -0.5 && sh.right <= W + 0.5 && sh.n === 4 && sh.l === 4, 'autospin sheet: above the deck, inside the screen, 4 counts and the 4 loss-limit steps', JSON.stringify(sh));
    await shot('h30-auto-sheet');
    await click('#autoGo');
    await adv(400); await real(200);
    const run = await ev(() => ({ cap: document.getElementById('spinCap').textContent, pill: document.getElementById('autoBtn').textContent, on: document.getElementById('autoBtn').classList.contains('on') }));
    check(run.cap === 'STOP' && /^STOP · \d+$/.test(run.pill) && run.on, 'running: SPIN reads STOP, the pill "STOP · n"', JSON.stringify(run));
    await layoutOk('autospin running');
    await shot('h31-auto-running');
    await adv(1600); await shot('h32-auto-running-spin');
    await click('#autoBtn');
    await untilState('idle', 20000); await adv(200);
    await shot('h33-auto-stopped');

    // ---------------------------------------------------------------- the chamber with the die, the menu's "Terningen" tab
    await click('#diceBtn');
    await adv(1200); await real(300); await adv(100);
    const ch = await ev(() => { const d = document.getElementById('chDie'), r = d.getBoundingClientRect(); return { w: r.width, painted: d.width > 0, n: document.getElementById('chN').textContent }; });
    check(ch.w > 0 && ch.painted, 'chamber: the user\'s die beside the count', JSON.stringify(ch));
    await shot('h40-chamber');
    await click('#chDone'); await untilState('idle', 3000); await adv(200);
    await ev(() => window.__slot.game.hud.openMenu(true, false, 'dice'));
    await real(400);
    const menu = await ev(() => ({ rows: document.querySelectorAll('#menuBody .glog .gl:not(.head)').length, tab: !!document.querySelector('#tabs .tab-die')?.width, status: document.querySelector('.dice-status')?.textContent }));
    check(menu.tab && menu.rows >= 1, 'menu "Terningen": the die on the tab, "Dine valg" lists the choice', JSON.stringify(menu));
    await shot('h41-menu-dice');
    await ev(() => window.__slot.game.hud.openMenu(false));
    await real(300);
  }

  if (runClassic) {
    // cascade spin
    await ev(() => window.__slot.qaNext('cascade'));
    await ev(() => { window.__slot.spin(); });
    await adv(1300); await shot('04-drop');
    await adv(1350); await shot('05-cascade-a');
    await adv(700); await shot('06-cascade-b');
    await untilState('idle'); await adv(200); await shot('07-cascade-result');

    // return (LDW) spin
    await ev(() => window.__slot.qaNext('return'));
    await ev(() => { window.__slot.spin(); });
    await untilState('idle'); await adv(100); await shot('08-return');

    // big win
    await ev(() => window.__slot.qaNext('bigwin'));
    await ev(() => { window.__slot.spin(); });
    await untilState('celebrating'); await adv(1200); await shot('09-bigwin');
    // a die from the big win: the first-die card (fresh) or the Kvit eller dobbelt card (after the HUD pass): keep it
    for (let t = 0; t < 30000 && (await state()) !== 'idle'; t += 250) {
      const st = await state();
      if (st === 'diceCard') { await adv(1600); await shot('09b-first-die'); await click('#summaryCard [data-act="ok"]'); }
      if (st === 'gambleOffer' && (await ev(() => window.__slot.gambleRun()?.armed))) await ev(() => window.__slot.choose('keep'));
      await adv(250);
    }
    await adv(600);

    // Kp 7 sky
    await ev(() => window.__slot.setKp(7.4));
    await adv(2500); await shot('10-kp7');

    // demo storm
    await ev(() => window.__slot.demo());
    await adv(1200); await shot('11-timelapse');
    await untilState('stormTransition', 5000);
    await real(500); // its 0,4 s fade runs on the wall clock
    check(await ev(() => getComputedStyle(document.getElementById('vault')).visibility === 'hidden'), 'the storm: the niche is hidden through the molten phases');
    for (const [t, n] of [[300, '12-cine-0.3'], [1300, '13-cine-1.6'], [600, '14-cine-2.2'], [600, '15-cine-2.8'], [1100, '16-cine-3.9'], [1100, '17-cine-5.0'], [1500, '18-cine-6.5']]) { await adv(t); await shot(n); }
    await untilState('stormReady'); await adv(300); await shot('19-storm-ready');
    await ev(() => window.__slot.startStorm());
    await adv(3300); await shot('20-storm-spin1');
    await untilState('stormSummary', 120000); await adv(2500);
    await ev(() => { window.__slot.cont(); });
    await adv(1500); await shot('21-summary');
    await ev(() => { window.__slot.cont(); });
    await adv(1500); await shot('22-outro');
    check(await ev(() => window.__slot.state() !== 'stormOutro' || getComputedStyle(document.getElementById('vault')).visibility !== 'hidden'), 'the storm outro: the niche is back');
    await untilState('idle'); await adv(500); await real(500); await shot('23-back-idle');
    await layoutOk('back to idle after the storm');
  }

  const errs = errors.filter((e) => !/GPU stall|GL Driver/.test(e));
  check(errs.length === 0, 'zero page errors', errs.slice(0, 3).join(' | '));
  allErrors.push(...errs.map((e) => `${vp} · ${e}`));
  console.log(JSON.stringify({ vp, errors: errs, warnings: [...warnings.entries()] }, null, 1));
  await ctx.close();
}
await browser.close();
console.log(fails.length ? `\n${fails.length} FAILED:\n  ${fails.join('\n  ')}` : `\nALL PASS (${vps.join(', ')})`);
process.exit(fails.length || allErrors.length ? 1 : 0);
