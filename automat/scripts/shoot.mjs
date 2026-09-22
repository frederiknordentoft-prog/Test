// Headless screenshot helper. Usage: node scripts/shoot.mjs <url> <out.png> [w] [h] [waitMs] [dpr]
import { chromium } from 'playwright-core';
const [url = 'http://127.0.0.1:4173/', out = 'shots/probe.png', w = '390', h = '844', wait = '1500', dpr = '1'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: +dpr });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(url);
await page.waitForTimeout(+wait);
const probe = await page.evaluate(() => window.__probe ?? null);
await page.screenshot({ path: out });
console.log(JSON.stringify({ out, probe, errors }, null, 1));
await browser.close();
