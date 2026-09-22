// Batch screenshots for the type harness (one browser, optional clip + zoom).
// Usage: node dev/type-shoot.mjs <w> <h> <dpr> <hash>=<out.png>[@x,y,w,h] ...
import { chromium } from 'playwright-core';
const [w, h, dpr, ...jobs] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const errors = [];
for (const job of jobs) {
  const [hash, rest] = job.split('=>');
  const [out, clip] = rest.split('@');
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await page.goto('http://127.0.0.1:5183/dev/type.html#' + hash);
  await page.waitForFunction(() => window.__probe && window.__probe.atlas, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  const opt = { path: out };
  if (clip) { const [x, y, cw, ch] = clip.split(',').map(Number); opt.clip = { x, y, width: cw, height: ch }; }
  await page.screenshot(opt);
  const probe = await page.evaluate(() => window.__probe);
  console.log(out, JSON.stringify(probe).slice(0, 300));
  await page.close();
}
if (errors.length) console.log('ERRORS', errors);
await browser.close();
