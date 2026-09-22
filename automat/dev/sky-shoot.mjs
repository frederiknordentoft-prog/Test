// Sky harness screenshots with optional clip: node dev/sky-shoot.mjs <url> <out> <w> <h> <waitMs> [dpr] [x,y,w,h]
import { chromium } from 'playwright-core';
const [url, out, w = '390', h = '844', wait = '4000', dpr = '1', clip] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/ReadPixels|favicon|404/.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(+wait);
const opts = { path: out };
if (clip) { const [x, y, cw, ch] = clip.split(',').map(Number); opts.clip = { x, y, width: cw, height: ch }; }
await page.screenshot(opts);
console.log(out, errors.length ? JSON.stringify(errors) : 'ok');
await browser.close();
