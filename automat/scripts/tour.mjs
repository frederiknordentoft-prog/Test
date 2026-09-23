// Deterministic Playwright tour of the whole game (SwiftShader WebGL2).
// Usage: node scripts/tour.mjs [baseUrl] [viewport=390x844] [dpr=1] [only=comma,list]
// Drives window.__slot with fixed-step advance(), so shots land on exact timeline moments.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const [base = 'http://127.0.0.1:4173/', vp = '390x844', dpr = '1', only = ''] = process.argv.slice(2);
const [W, H] = vp.split('x').map(Number);
const want = new Set(only ? only.split(',') : []);
const dir = `shots/tour-${vp}`;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: +dpr });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const warnings = new Map();
page.on('console', (m) => {
  if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text());
  if (m.type() === 'warning' && !/GPU stall|GL Driver/.test(m.text())) warnings.set(m.text().slice(0, 160), (warnings.get(m.text().slice(0, 160)) ?? 0) + 1);
});

await page.goto(base + '?seed=7');
await page.waitForFunction(() => window.__slot, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); window.__slot.setSeed(20260922); });

// advance game time in small chunks so awaited continuations run between them
const adv = (ms) => page.evaluate(async (ms) => {
  const step = 50;
  for (let t = 0; t < ms; t += step) { window.__slot.advance(Math.min(step, ms - t), false); await new Promise((r) => setTimeout(r, 0)); }
  window.__slot.advance(0, true);
}, ms);
const shot = async (name) => {
  if (want.size && !want.has(name)) return;
  await page.screenshot({ path: `${dir}/${name}.png` });
  console.log('shot', name);
};
const state = () => page.evaluate(() => window.__slot.state());
const untilState = async (s, max = 20000) => { for (let t = 0; t < max; t += 250) { if ((await state()) === s) return true; await adv(250); } console.log('timeout waiting for', s, 'now', await state()); return false; };

await adv(1600);
// the splash welcome animates on the wall clock (CSS): land it on its final frame so the shot is deterministic
await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('#welcome')) a.finish(); });
await shot('01-splash');
await page.evaluate(() => window.__slot.unlock());
await adv(900); await shot('02-ignite');
await untilState('idle'); await adv(300); await shot('03-idle');

// cascade spin
await page.evaluate(() => window.__slot.qaNext('cascade'));
await page.evaluate(() => { window.__slot.spin(); });
await adv(1300); await shot('04-drop');
await adv(1350); await shot('05-cascade-a');
await adv(700); await shot('06-cascade-b');
await untilState('idle'); await adv(200); await shot('07-cascade-result');

// return (LDW) spin
await page.evaluate(() => window.__slot.qaNext('return'));
await page.evaluate(() => { window.__slot.spin(); });
await untilState('idle'); await adv(100); await shot('08-return');

// big win
await page.evaluate(() => window.__slot.qaNext('bigwin'));
await page.evaluate(() => { window.__slot.spin(); });
await untilState('celebrating'); await adv(1200); await shot('09-bigwin');
await untilState('idle', 30000);

// Kp 7 sky
await page.evaluate(() => window.__slot.setKp(7.4));
await adv(2500); await shot('10-kp7');

// demo storm
await page.evaluate(() => window.__slot.demo());
await adv(1200); await shot('11-timelapse');
await untilState('stormTransition', 5000);
for (const [t, n] of [[300, '12-cine-0.3'], [1300, '13-cine-1.6'], [600, '14-cine-2.2'], [600, '15-cine-2.8'], [1100, '16-cine-3.9'], [1100, '17-cine-5.0'], [1500, '18-cine-6.5']]) { await adv(t); await shot(n); }
await untilState('stormReady'); await adv(300); await shot('19-storm-ready');
await page.evaluate(() => window.__slot.startStorm());
await adv(3300); await shot('20-storm-spin1');
await untilState('stormSummary', 120000); await adv(2500);
await page.evaluate(() => { window.__slot.cont(); });
await adv(1500); await shot('21-summary');
await page.evaluate(() => { window.__slot.cont(); });
await adv(1500); await shot('22-outro');
await untilState('idle'); await adv(500); await shot('23-back-idle');

console.log(JSON.stringify({ errors, warnings: [...warnings.entries()] }, null, 1));
await browser.close();
