// Batch screenshots for the particles harness (one Chromium, many views).
// Usage: node dev/particles-shoot.mjs <port> <name>=<hash>[@WxH[xDPR]] ...
//   e.g. node dev/particles-shoot.mjs 5186 cells-012='view=cells&t=0.12' screen-02='view=screen&t=0.2@390x844'
import { chromium } from 'playwright-core';

const [port = '5186', ...specs] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const spec of specs) {
  const eq = spec.indexOf('=');
  const name = spec.slice(0, eq);
  let rest = spec.slice(eq + 1);
  let w = 390, h = 844, dpr = 1;
  const atI = rest.lastIndexOf('@');
  if (atI >= 0) {
    const dims = rest.slice(atI + 1).split('x').map(Number);
    rest = rest.slice(0, atI);
    [w, h] = dims; if (dims[2]) dpr = dims[2];
  }
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  const t0 = Date.now();
  await page.goto(`http://127.0.0.1:${port}/dev/particles.html#${rest}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 90000 }); } catch { errors.push('timeout waiting for __ready'); }
  const probe = await page.evaluate(() => window.__probe ?? null);
  const out = `shots/particles-${name}.png`;
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ out, ms: Date.now() - t0, probe, errors: errors.filter((e) => !e.includes('favicon')) }));
  await page.close();
}
await browser.close();
