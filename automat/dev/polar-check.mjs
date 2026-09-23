// Headless Polar Night bed QA: node dev/polar-check.mjs [baseUrl]
// Opens dev/audio.html#polar (the same suite also runs inside dev/audio-check.mjs): ≥ 3 loop cycles through
// the engine on an OfflineAudioContext — no click at the loop point (sample delta + short-window spectral
// flux), bar grid locked to the scheduler (drift < 10 ms), loudness vs the procedural bed, live source
// switching, decode-failure fallback. Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:5184';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.route('**/@vite/client', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;',
}));
const t0 = Date.now();
await page.goto(`${base}/dev/audio.html#polar`);
const broken = new Promise((_, rej) => page.on('pageerror', (e) => rej(new Error('page error: ' + e.message))));
await Promise.race([page.waitForFunction(() => window.__audioCheck?.done === true, null, { timeout: 600000, polling: 500 }), broken]);
const r = await page.evaluate(() => window.__audioCheck);
await browser.close();
const w = [4, Math.max(...r.checks.map((c) => c.name.length))];
for (const c of r.checks) console.log(`${(c.ok ? 'PASS' : 'FAIL').padEnd(w[0])}  ${c.name.padEnd(w[1])}  ${c.detail}`);
for (const s of r.scen) console.log('scenario', JSON.stringify(s));
if (errors.length) console.log('\nconsole/page errors:\n' + errors.join('\n'));
console.log(`\n${r.fail.length ? 'FAILURES:\n' + r.fail.join('\n') : 'ALL POLAR CHECKS PASSED'}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(r.fail.length || errors.length ? 1 : 0);
