// Luminance trace runner: node dev/sky-trace.mjs "<hash params>" [w] [h]
import { chromium } from 'playwright-core';
const [hash, w = '390', h = '844'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5182/dev/sky.html#trace=1&' + hash);
await page.waitForFunction(() => window.__trace, null, { timeout: 300000, polling: 500 });
const tr = await page.evaluate(() => window.__trace);
console.log(JSON.stringify({ hash, calm: tr.calm, full: tr.full, skyBand: tr.skyBand, worstTile16: tr.worstTile16, errors }));
await browser.close();
