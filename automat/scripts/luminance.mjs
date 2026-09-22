// Photosensitivity check (WCAG 2.3.1-style general flash heuristic, whole-screen):
// steps the real game at 30 fps through the demo time-lapse, the Solstorm cinematic and the first storm spins,
// reads the canvas back each frame and counts opposing ≥10 % relative-luminance swings per second.
// Usage: node scripts/luminance.mjs [baseUrl] [calm=0|1]
import { chromium } from 'playwright-core';

const [base = 'http://127.0.0.1:4173/', calm = '0'] = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 180, height: 390 }, deviceScaleFactor: 1, reducedMotion: calm === '1' ? 'reduce' : 'no-preference' });
await page.goto(base + '?seed=3');
await page.waitForFunction(() => window.__slot);
await page.evaluate(() => { localStorage.clear(); window.__slot.setSeed(99); });

const lum = () => page.evaluate(() => {
  const s = window.__slot;
  s.advance(1000 / 30, true);
  const r = s.world.stage.renderer;
  const gl = r.gl;
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  let sum = 0, red = 0;
  for (let i = 0; i < px.length; i += 16) { // every 4th pixel
    const R = lin(px[i]), G = lin(px[i + 1]), B = lin(px[i + 2]);
    sum += 0.2126 * R + 0.7152 * G + 0.0722 * B;
    if (px[i] > 200 && px[i + 1] < 90 && px[i + 2] < 90) red++;
  }
  const n = px.length / 16;
  return { L: sum / n, red: red / n, state: s.state() };
});

// intro → idle
await page.evaluate(() => window.__slot.advance(1500, false));
await page.evaluate(() => window.__slot.unlock());
for (let i = 0; i < 160; i++) { await page.evaluate(() => window.__slot.advance(50, false)); if ((await page.evaluate(() => window.__slot.state())) === 'idle') break; }
await page.evaluate(() => window.__slot.demo());
const trace = [];
for (let f = 0; f < 30 * 16; f++) {
  const st = await page.evaluate(() => window.__slot.state());
  if (st === 'stormReady') await page.evaluate(() => window.__slot.startStorm());
  trace.push(await lum());
}
// count opposing swings ≥ 10 % (relative to the darker frame, darker < 0.8) inside any 1 s window
const swings = [];
let lastExt = trace[0].L, dir = 0;
for (let i = 1; i < trace.length; i++) {
  const L = trace[i].L;
  const d = L - lastExt;
  const rel = Math.abs(d) / Math.max(0.02, Math.min(L, lastExt));
  if (rel >= 0.1 && Math.min(L, lastExt) < 0.8) {
    const nd = Math.sign(d);
    if (nd !== dir) { swings.push(i); dir = nd; }
    lastExt = L;
  } else if ((dir > 0 && L > lastExt) || (dir < 0 && L < lastExt)) lastExt = L;
}
let worst = 0;
for (let i = 0; i < swings.length; i++) {
  let n = 0;
  for (let j = i; j < swings.length && swings[j] - swings[i] < 30; j++) n++;
  worst = Math.max(worst, Math.floor(n / 2)); // a flash = a pair of opposing changes
}
// WCAG 2.3.1 general flash: opposing changes of ≥ 0.1 relative luminance where the darker state is < 0.8.
const wcagSwings = [];
{
  let ext = trace[0].L, d0 = 0;
  for (let i = 1; i < trace.length; i++) {
    const L = trace[i].L, d = L - ext;
    if (Math.abs(d) >= 0.1 && Math.min(L, ext) < 0.8) { const nd = Math.sign(d); if (nd !== d0) { wcagSwings.push(i); d0 = nd; } ext = L; }
    else if ((d0 > 0 && L > ext) || (d0 < 0 && L < ext)) ext = L;
  }
}
let wcagWorst = 0;
for (let i = 0; i < wcagSwings.length; i++) { let n = 0; for (let j = i; j < wcagSwings.length && wcagSwings[j] - wcagSwings[i] < 30; j++) n++; wcagWorst = Math.max(wcagWorst, Math.floor(n / 2)); }
const maxRed = Math.max(...trace.map((t) => t.red));
console.log(JSON.stringify({ calm: calm === '1', frames: trace.length, swings: swings.length, worstFlashesPerSecond: worst, wcagFlashesPerSecond: wcagWorst, maxSaturatedRedShare: +maxRed.toFixed(3), minL: +Math.min(...trace.map((t) => t.L)).toFixed(4), maxL: +Math.max(...trace.map((t) => t.L)).toFixed(4), pass: wcagWorst <= 3 && worst <= 3 && maxRed < 0.25 }));
await browser.close();
