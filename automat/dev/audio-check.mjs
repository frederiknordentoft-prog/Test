// Headless audio QA: node dev/audio-check.mjs [baseUrl]
// Opens dev/audio.html#check in headless Chromium (autoplay allowed), which renders every SFX and every
// music stem (tiled to 8 bars) through OfflineAudioContext plus full-mix scenarios, then prints tables.
// Exit code 1 on any failure.
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://127.0.0.1:5184';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
// Other agents edit files concurrently: stub Vite's HMR client so a broadcast full-reload can't restart
// the QA page mid-run.
await page.route('**/@vite/client', (r) => r.fulfill({
  contentType: 'application/javascript',
  body: 'export const createHotContext=()=>({accept(){},dispose(){},prune(){},invalidate(){},on(){},off(){},send(){},data:{}});export const updateStyle=()=>{};export const removeStyle=()=>{};export const injectQuery=(u)=>u;',
}));
const t0 = Date.now();
await page.goto(`${base}/dev/audio.html#check`);
await page.waitForFunction(() => window.__audioCheck?.done === true, null, { timeout: 300000, polling: 500 });
const r = await page.evaluate(() => window.__audioCheck);
await browser.close();

function table(rows, cols) {
  if (!rows.length) return '';
  cols ??= Object.keys(rows[0]);
  const w = cols.map((c) => Math.max(c.length, ...rows.map((x) => String(x[c] ?? '').length)));
  const line = (vals) => vals.map((v, i) => String(v ?? '').padEnd(w[i])).join('  ');
  return [line(cols), line(w.map((n) => '-'.repeat(n))), ...rows.map((x) => line(cols.map((c) => x[c])))].join('\n');
}

console.log('\n=== SFX one-shots (48 kHz, normalised to −1 dBFS peak; mix gain applied at play time) ===');
console.log(table(r.assets));
console.log('\n=== Music stems (tiled to 8 bars) ===');
console.log(table(r.stems));
console.log('\n=== Reduced-rate audit (vs full-rate render; must be < 0.5 % lost and < 1.5 dB ⅓-oct error) ===');
console.log(table(r.audit));
console.log('\n=== Offline full-mix scenarios (through HP 35 Hz → limiter −1 dBFS → ceiling) ===');
console.log(table(r.scen));
console.log('\n=== Checks ===');
console.log(table(r.checks.map((c) => ({ ok: c.ok ? 'PASS' : 'FAIL', name: c.name, detail: c.detail }))));
if (errors.length) console.log('\nconsole/page errors:\n' + errors.join('\n'));
console.log(`\n${r.fail.length ? 'FAILURES:\n' + r.fail.join('\n') : 'ALL CHECKS PASSED'}  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(r.fail.length || errors.length ? 1 : 0);
