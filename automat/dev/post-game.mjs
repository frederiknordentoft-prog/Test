// Drive the real game into the Solstorm cinematic and screenshot it through the post stack.
// Usage: node dev/post-game.mjs [dpr=1]   (dev server on PORT, default 5185). Writes shots/post-game-*.png
import { chromium } from 'playwright-core';

const port = process.env.PORT ?? '5185';
const dpr = +(process.argv[2] ?? 1);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('error: ' + m.text()); });
await page.goto(`http://127.0.0.1:${port}/?seed=7#clean_autostart`);
await page.waitForFunction(() => !!window.__slot, null, { timeout: 120000 });
const state = () => page.evaluate(() => window.__slot.state());
const adv = (ms) => page.evaluate((m) => window.__slot.advance(m), ms);
const post = () => page.evaluate(() => { const u = window.__slot.world.uber; return { cine: u.cinematic, storm: +u.storm.toFixed(2), ca: +u.ca.toFixed(2), zoom: +u.zoom.toFixed(3), glitch: u.glitch, heat: +u.heat.toFixed(2), exp: u.exposure, ring: Array.from(u.rings.slice(0, 4)).map((x) => +x.toFixed(2)), bloom: +window.__slot.world.bloom.strength.toFixed(2) }; });
// let the intro run until idle
for (let i = 0; i < 60 && (await state()) !== 'idle'; i++) await adv(250);
console.log('state', await state());
await page.screenshot({ path: 'shots/post-game-idle.png' });
await page.evaluate(() => window.__slot.demo());
// advance until the cinematic starts (uber.cinematic flips on)
let n = 0;
while (n++ < 400 && !(await post()).cine) await adv(100);
console.log('cinematic at step', n, await state());
const marks = [[0.35, 'glitch'], [1.9, 'cme'], [2.25, 'impact'], [2.6, 'ring'], [3.6, 'heat'], [6.5, 'storm']];
let t = 0;
for (const [at, name] of marks) {
  await adv(Math.round((at - t) * 1000)); t = at;
  console.log(name, JSON.stringify(await post()));
  await page.screenshot({ path: `shots/post-game-${name}.png` });
}
// variants of the final storm frame: my contribution vs the raw scene
const stats = () => page.evaluate(() => {
  window.__slot.advance(16); // render + read in the same task (preserveDrawingBuffer is false)
  const c = document.querySelector('canvas#stage') ?? document.querySelector('canvas');
  const g = document.createElement('canvas'); g.width = c.width; g.height = c.height;
  const x = g.getContext('2d'); x.drawImage(c, 0, 0);
  const d = x.getImageData(0, 0, g.width, g.height).data;
  let sr = 0, redSat = 0, n = 0;
  for (let i = 0; i < d.length; i += 16) {
    const r = d[i] / 255, gg = d[i + 1] / 255, b = d[i + 2] / 255;
    sr += 0.2126 * r + 0.7152 * gg + 0.0722 * b; n++;
    if (r > 0.55 && r > 2.2 * gg && r > 2.2 * b) redSat++;   // bright saturated red pixel
  }
  return { meanLum: +(sr / n).toFixed(3), satRedFrac: +(redSat / n).toFixed(3) };
});
if (process.env.VARIANTS) {
  await page.evaluate(() => { window.__keepFilters = window.__slot.world.stage.world.filters; });
  for (const [name, code] of [['post', 'k'], ['uberonly', 'u'], ['nopost', 'n']]) {
    await page.evaluate((c) => { const w = window.__slot.world.stage.world; const k = window.__keepFilters; w.filters = c === 'k' ? k : c === 'u' ? [k[1]] : []; }, code);
    console.log('variant', name, JSON.stringify(await stats()));
    await page.screenshot({ path: `shots/post-game-storm-${name}.png` });
  }
}
console.log(JSON.stringify({ errors }, null, 1));
await browser.close();
