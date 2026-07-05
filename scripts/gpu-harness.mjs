// Runs the in-page GPU physics harness in headless Chromium (SwiftShader WebGL2).
// Usage: node scripts/gpu-harness.mjs [url]  (defaults to vite preview on :4173)
import { chromium } from 'playwright';

const url = process.argv[2] ?? 'http://localhost:4173/Test/?harness=1&auto=1&fast=1';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--disable-gpu-sandbox'],
});
const page = await browser.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.error('[page]', msg.text());
});
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

await page.goto(url, { waitUntil: 'load' });
console.log('side indlæst, venter på harness…');

const result = await page.waitForFunction(() => window.__harness?.done === true, null, { timeout: 1_800_000 })
  .then(() => page.evaluate(() => window.__harness));

console.log(`\nBackend: ${result.backend}`);
for (const r of result.results) {
  console.log(`${r.pass ? '✅ PASS' : '❌ FAIL'}  ${r.name}\n         ${r.detail}`);
}
const ok = result.pass && result.backend === 'gpu';
console.log(ok ? '\n✅ Alle GPU-harness-tests bestået' : '\n❌ Fejl i GPU-harness');
await browser.close();
process.exit(ok ? 0 : 1);
