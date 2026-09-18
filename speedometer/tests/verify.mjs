#!/usr/bin/env node
/**
 * tests/verify.mjs — end-to-end verification of dist/speedometer.html.
 *
 *   node build.mjs && node tests/verify.mjs      (or: npm test)
 *
 * Opens the built single-file app from file:// in headless Chromium and
 *   1. screenshots it at 1400×900 and 400×900 (tests/out/app-*.png), asserts
 *      no horizontal overflow at 400 px and no console/page errors,
 *   2. rasterises six gauge states through Exporters.svgToPngBlob, decodes
 *      each PNG on a canvas inside the page and probes pixels (transparent
 *      corners, needle on the expected side, nothing on the mirrored side),
 *   3. encodes an animated GIF with Exporters.gifBlob (12 motion frames),
 *   4. builds a PPTX with PptxExport.build (SKIP when PptxGenJS could not be
 *      fetched from the CDN — the app is designed to work without it),
 *   5. hands the GIF/PPTX to tests/verify_assets.py (Pillow + python-pptx +
 *      LibreOffice) and prints a summary; exits 1 on any FAIL.
 *
 * Every check prints "PASS|FAIL|SKIP name — detail". Browser results (Blobs)
 * cross the bridge as base64 and land in tests/out/. No npm dependencies:
 * Playwright is loaded from the global install (or a local one if present).
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const distFile = path.join(root, 'dist', 'speedometer.html');
const outDir = path.join(here, 'out');
const assetsPy = path.join(here, 'verify_assets.py');
const PYTHON = process.env.PYTHON || 'python3';

/* ------------------------------------------------------------------ */
/* Result bookkeeping                                                  */
/* ------------------------------------------------------------------ */

const results = [];
function record(status, name, detail = '') {
  results.push({ status, name, detail });
  console.log(`${status.padEnd(4)} ${name}${detail ? ' — ' + detail : ''}`);
}
const pass = (name, detail) => record('PASS', name, detail);
const fail = (name, detail) => record('FAIL', name, detail);
const skip = (name, detail) => record('SKIP', name, detail);
/** Assert helper: PASS with okDetail, FAIL with badDetail (or okDetail). */
function check(cond, name, okDetail, badDetail) {
  if (cond) pass(name, okDetail); else fail(name, badDetail || okDetail);
  return !!cond;
}
function heading(text) { console.log(`\n== ${text}`); }

/** Run one numbered step; an exception becomes a FAIL instead of aborting the run. */
async function step(title, fn) {
  heading(title);
  try { await fn(); } catch (err) { fail(title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), `threw: ${err && err.message ? err.message : err}`); }
}

const outFile = (name) => path.join(outDir, name);
const writeBase64 = (name, b64) => { fs.writeFileSync(outFile(name), Buffer.from(b64, 'base64')); return fs.statSync(outFile(name)).size; };
const fmtKB = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Run verify_assets.py and merge its PASS/FAIL/SKIP lines into our results. */
function runAssets(args) {
  const proc = spawnSync(PYTHON, [assetsPy, ...args], { encoding: 'utf8', timeout: 300000, cwd: root });
  if (proc.error) { fail(`assets-${args[0]}`, `could not run ${PYTHON}: ${proc.error.message}`); return; }
  let seen = 0;
  for (const raw of (proc.stdout || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^(PASS|FAIL|SKIP)\s+(\S+)(?:\s+—\s+(.*))?$/.exec(line);
    if (m) { record(m[1], m[2], m[3] || ''); seen++; } else console.log('     | ' + line);
  }
  const err = (proc.stderr || '').trim();
  if (err) console.log(err.split('\n').map((l) => '     ! ' + l).join('\n'));
  if (seen === 0) fail(`assets-${args[0]}`, `verify_assets.py produced no results (exit ${proc.status})`);
}

/* ------------------------------------------------------------------ */
/* Environment                                                         */
/* ------------------------------------------------------------------ */

function loadPlaywright() {
  const candidates = ['/opt/node22/lib/node_modules/playwright', 'playwright'];
  for (const c of candidates) {
    try {
      const pw = require(c);
      let version = '?';
      try { version = require(path.posix.join(c, 'package.json')).version; } catch (_) { /* optional */ }
      return { pw, from: c, version };
    } catch (_) { /* try next */ }
  }
  console.error('FAIL playwright — not found. Install it inside speedometer/ with:\n' +
    '     PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright@1.56.1   (Chromium is expected at /opt/pw-browsers)');
  process.exit(1);
}

if (!process.env.PLAYWRIGHT_BROWSERS_PATH && fs.existsSync('/opt/pw-browsers')) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/opt/pw-browsers';
}
fs.mkdirSync(outDir, { recursive: true });

const watchdog = setTimeout(() => { console.error('\nFAIL watchdog — verification exceeded 8 minutes'); process.exit(1); }, 8 * 60 * 1000);
watchdog.unref();

const { pw, from: pwFrom, version: pwVersion } = loadPlaywright();
console.log(`Speedometer til PowerPoint — verification`);
console.log(`node ${process.version}, playwright ${pwVersion} (${pwFrom}), browsers ${process.env.PLAYWRIGHT_BROWSERS_PATH || 'default'}`);

if (!fs.existsSync(distFile)) {
  fail('dist-exists', `${distFile} missing — run "node build.mjs" first`);
  finish();
}
const distHtml = fs.readFileSync(distFile, 'utf8');
console.log(`dist: ${path.relative(root, distFile)} (${fmtKB(distHtml.length)}) ${(distHtml.match(/^<!--.*?-->/) || [''])[0].slice(0, 80)}`);

/* The states rasterised in step 2 and what the pixel probes expect. */
const PNG_STATES = [
  { value: 62, prev: 48 },
  { value: 20, prev: 80 },
  { value: 100, prev: 0 },
  { value: 0, prev: 0 },
  { value: 50, prev: 50 },
  { value: 33.3, prev: 66.7 },
];
const PNG_SCALE = 2;      // 2000×1280 px — quick to decode; the default 3× is checked once separately

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

const consoleErrors = [];
const pageErrors = [];
const networkWarnings = [];

function wirePage(page) {
  page.setDefaultTimeout(30000);
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const loc = msg.location() || {};
    const text = msg.text();
    // A CDN/font that cannot be fetched is not an app bug (the app works offline) — warn only.
    if (/^Failed to load resource/i.test(text) && /^https?:/.test(loc.url || '')) networkWarnings.push(`${loc.url}: ${text}`);
    else consoleErrors.push(text + (loc.url ? ` (${loc.url}:${loc.lineNumber})` : ''));
  });
  page.on('pageerror', (err) => pageErrors.push(err.message || String(err)));
  page.on('requestfailed', (req) => { if (/^https?:/.test(req.url())) networkWarnings.push(`${req.url()} → ${(req.failure() || {}).errorText}`); });
}

/** Navigate and wait until all globals exist. */
async function openApp(page, query = '') {
  await page.goto(pathToFileURL(distFile).href + query, { waitUntil: 'load' });
  await page.waitForFunction(() => window.Gauge && window.Exporters && window.App && window.PptxExport, null, { timeout: 15000 });
  // Give the deferred CDN script a moment (it is optional).
  await page.waitForFunction(() => typeof window.PptxGenJS !== 'undefined', null, { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => (document.fonts && document.fonts.ready) || null).catch(() => {});
}

const browser = await pw.chromium.launch({ headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,     // corporate/sandbox proxies with private CAs would otherwise block the CDN
    locale: 'da-DK',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
  });
  const page = await context.newPage();
  wirePage(page);
  await openApp(page);

  /* ------------------------------------------------------------ 0 */
  await step('0. Built file', async () => {
    const leftovers = distHtml.match(/(?:src|href)=["'](?:\.\/)?(?:src|vendor)\//g) || [];
    check(leftovers.length === 0, 'dist-self-contained', 'no local src/ or vendor/ references remain',
      `local references still present: ${leftovers.slice(0, 3).join(', ')}`);
    check(/<script[^>]+src=["']https:\/\/cdn\.jsdelivr\.net\/npm\/pptxgenjs/.test(distHtml), 'dist-keeps-cdn',
      'PptxGenJS CDN <script> kept', 'PptxGenJS CDN <script> is missing from the build');
    check(/<style[\s>]/.test(distHtml) && !/<link[^>]+href=["']src\//.test(distHtml), 'dist-inline-css',
      'stylesheet inlined as <style>', 'src/styles.css was not inlined');
    const globals = await page.evaluate(() => ({
      Gauge: typeof window.Gauge, Exporters: typeof window.Exporters, PptxExport: typeof window.PptxExport,
      App: typeof window.App, gifenc: typeof window.gifenc, PptxGenJS: typeof window.PptxGenJS,
    }));
    check(['Gauge', 'Exporters', 'PptxExport', 'App', 'gifenc'].every((k) => globals[k] === 'object' || globals[k] === 'function'),
      'globals-present', `Gauge/Exporters/PptxExport/App/gifenc loaded; PptxGenJS: ${globals.PptxGenJS}`,
      `missing globals: ${JSON.stringify(globals)}`);
  });

  /* ------------------------------------------------------------ 1 */
  await step('1. Screenshots and layout', async () => {
    await page.evaluate(() => { try { localStorage.clear(); } catch (_) { /* no storage */ } });
    await page.evaluate(() => window.App.setState({
      value: 62, prev: 48, showTrail: true, showPrevMarker: true, showDelta: true, showValue: false,
      background: 'transparent', style: 'classic', label: '',
    }));
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => {
      const svg = document.querySelector('#gauge-stage svg') || document.querySelector('main svg[viewBox]');
      const stateNow = window.App.getState();
      return {
        title: document.title,
        lang: document.documentElement.lang,
        hasSvg: !!svg,
        svgViewBox: svg ? svg.getAttribute('viewBox') : null,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        value: stateNow.value, prev: stateNow.prev,
        h1: (document.querySelector('h1') || {}).textContent,
      };
    });
    check(info.title === 'Speedometer til PowerPoint', 'app-title', `<title> "${info.title}", lang=${info.lang}`, `unexpected <title> "${info.title}"`);
    check(info.hasSvg && /^0 0 1000 640$/.test(info.svgViewBox || ''), 'app-preview-svg',
      `live gauge SVG in the preview (viewBox ${info.svgViewBox})`, `no live gauge SVG found (viewBox ${info.svgViewBox})`);
    check(info.value === 62 && info.prev === 48, 'app-set-state', `App.setState → value ${info.value}, prev ${info.prev}`);
    check(info.bodyBg && info.bodyBg !== 'rgba(0, 0, 0, 0)', 'app-body-background', `body background ${info.bodyBg}`, 'body has no explicit background');

    await page.screenshot({ path: outFile('app-desktop.png'), fullPage: true });
    pass('screenshot-desktop', `tests/out/app-desktop.png (1400×900 viewport, full page)`);

    await page.setViewportSize({ width: 400, height: 900 });
    await page.waitForTimeout(400);
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const vw = de.clientWidth;
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1 && getComputedStyle(el).position !== 'fixed') {
          const cls = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
          offenders.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls} (right ${Math.round(r.right)}px)`);
          if (offenders.length >= 4) break;
        }
      }
      return { vw, scrollWidth: de.scrollWidth, bodyScrollWidth: document.body.scrollWidth, offenders };
    });
    await page.screenshot({ path: outFile('app-mobile.png'), fullPage: true });
    pass('screenshot-mobile', `tests/out/app-mobile.png (400×900 viewport, full page)`);
    check(overflow.scrollWidth <= overflow.vw && overflow.bodyScrollWidth <= overflow.vw, 'no-horizontal-overflow-400px',
      `scrollWidth ${overflow.scrollWidth} ≤ viewport ${overflow.vw}`,
      `scrollWidth ${overflow.scrollWidth}/${overflow.bodyScrollWidth} > ${overflow.vw}; offenders: ${overflow.offenders.join('; ') || 'n/a'}`);
    await page.setViewportSize({ width: 1400, height: 900 });
  });

  /* ------------------------------------------------------------ 1b */
  await step('1b. State: URL prefill and persistence', async () => {
    // localStorage round trip: change a value, reload, expect it back.
    await page.evaluate(() => window.App.setState({ value: 77, prev: 31 }));
    await page.waitForTimeout(200);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => window.App, null, { timeout: 15000 });
    const persisted = await page.evaluate(() => window.App.getState());
    check(persisted.value === 77 && persisted.prev === 31, 'state-persists-reload',
      `value ${persisted.value}, prev ${persisted.prev} survived a reload (localStorage)`,
      `expected 77/31 after reload, got ${persisted.value}/${persisted.prev}`);

    // URL query beats storage.
    const p2 = await context.newPage();
    wirePage(p2);
    await openApp(p2, '?value=71&prev=23');
    const fromUrl = await p2.evaluate(() => window.App.getState());
    check(fromUrl.value === 71 && fromUrl.prev === 23, 'state-from-url',
      `?value=71&prev=23 → value ${fromUrl.value}, prev ${fromUrl.prev}`,
      `expected 71/23 from the query string, got ${fromUrl.value}/${fromUrl.prev}`);
    await p2.close();

    // Danish comma input: "62,5" must parse to 62.5.
    const comma = await page.evaluate(() => {
      const input = document.getElementById('value-input');
      if (!input) return { skipped: true };
      input.focus();
      input.value = '62,5';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return { value: window.App.getState().value };
    });
    if (comma.skipped) skip('input-danish-comma', '#value-input not found — cannot test comma parsing');
    else check(Math.abs(comma.value - 62.5) < 1e-9, 'input-danish-comma', `"62,5" → ${comma.value}`, `"62,5" parsed as ${comma.value}, expected 62.5`);

    await page.evaluate(() => window.App.setState({ value: 62, prev: 48 }));
    await page.waitForTimeout(200);
  });

  /* ------------------------------------------------------------ 2 */
  await step('2. SVG and PNG exports', async () => {
    const svgInfo = await page.evaluate(() => {
      const st = Object.assign({}, window.Gauge.defaults, { value: 62, prev: 48 });
      const a = window.Exporters.svgString(st);
      const b = window.Exporters.svgString(st);
      const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
      const ia = ids(a);
      const ib = new Set(ids(b));
      const doc = new DOMParser().parseFromString(a, 'image/svg+xml');
      const perr = doc.querySelector('parsererror');
      const rootEl = doc.documentElement;
      return {
        svg: a,
        startsWithSvg: /^\s*<svg\b/.test(a),
        xmlns: rootEl.getAttribute('xmlns') || rootEl.namespaceURI,
        width: rootEl.getAttribute('width'), height: rootEl.getAttribute('height'), viewBox: rootEl.getAttribute('viewBox'),
        parseError: perr ? perr.textContent.slice(0, 160) : null,
        idCount: ia.length, dupWithin: ia.length - new Set(ia).size, clash: ia.filter((id) => ib.has(id)).length,
        external: /(?:href|src)=["'](?:https?:)?\/\//.test(a),
        hasClass: /\sclass=/.test(a),
      };
    });
    fs.writeFileSync(outFile('gauge.svg'), svgInfo.svg);
    check(svgInfo.startsWithSvg && !svgInfo.parseError, 'svg-well-formed',
      `parses as XML (${fmtKB(svgInfo.svg.length)}, ${svgInfo.idCount} ids) → tests/out/gauge.svg`, `parse error: ${svgInfo.parseError}`);
    check(svgInfo.xmlns === 'http://www.w3.org/2000/svg' && svgInfo.viewBox && svgInfo.width && svgInfo.height, 'svg-standalone',
      `xmlns set, width=${svgInfo.width} height=${svgInfo.height} viewBox="${svgInfo.viewBox}"`,
      `xmlns=${svgInfo.xmlns} width=${svgInfo.width} height=${svgInfo.height} viewBox=${svgInfo.viewBox}`);
    check(svgInfo.dupWithin === 0 && svgInfo.clash === 0, 'svg-unique-ids',
      'ids unique within a render and between two renders', `${svgInfo.dupWithin} duplicate ids within one render, ${svgInfo.clash} ids shared between two renders`);
    check(!svgInfo.external, 'svg-no-external-refs', 'no http(s) references inside the SVG', 'SVG references external URLs');

    for (const st of PNG_STATES) {
      const name = `gauge-${String(st.value).replace('.', '-')}-fra-${String(st.prev).replace('.', '-')}.png`;
      const r = await page.evaluate(async ({ st, scale }) => {
        const G = window.Gauge;
        const state = Object.assign({}, G.defaults, st);
        const t0 = performance.now();
        const blob = await window.Exporters.svgToPngBlob(window.Exporters.svgString(state), { scale, background: null });
        const ms = performance.now() - t0;
        // Decode the PNG in the page and read pixels back from a canvas.
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        await img.decode();
        URL.revokeObjectURL(url);
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        const W = c.width;
        const px = (x, y) => { const i = (Math.round(y) * W + Math.round(x)) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
        const patch = (x, y, rad) => {
          let a = 0, l = 0, n = 0;
          for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) { const p = px(x + dx, y + dy); a += p[3]; l += (p[0] + p[1] + p[2]) / 3; n++; }
          return { alpha: a / n, lum: l / n };
        };
        const geo = G.geometry;
        const polar = (deg, rad) => [(geo.cx + rad * Math.cos(deg * Math.PI / 180)) * scale, (geo.cy - rad * Math.sin(deg * Math.PI / 180)) * scale];
        const rProbe = 250;              // hub (44) < 250 < inner arc edge (296): only the needle lives here
        const needleAngle = G.valueToAngle(state.value);
        // Scan the half ring: where is the darkest opaque thing?
        let best = { deg: -1, score: -1 };
        for (let deg = 0; deg <= 180; deg += 1) {
          const [x, y] = polar(deg, rProbe);
          const p = patch(x, y, 1);
          const score = (p.alpha / 255) * (1 - p.lum / 255);
          if (score > best.score) best = { deg, score };
        }
        const [nx, ny] = polar(needleAngle, rProbe);
        const needle = patch(nx, ny, 2);
        const emptyAngles = Math.abs(state.value - 50) < 2 ? [0, 180] : [180 - needleAngle];
        const empties = emptyAngles.map((deg) => { const [x, y] = polar(deg, rProbe); return Object.assign({ deg: Math.round(deg * 10) / 10 }, patch(x, y, 2)); });
        const corners = [[0, 0], [c.width - 1, 0], [0, c.height - 1], [c.width - 1, c.height - 1]].map(([x, y]) => px(x, y)[3]);
        const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
        return { width: c.width, height: c.height, bytes: blob.size, type: blob.type, ms, corners, needleAngle, best, needle, empties, b64 };
      }, { st, scale: PNG_SCALE });

      const tag = `png-${st.value}-fra-${st.prev}`;
      writeBase64(name, r.b64);
      const dimsOk = r.width === 1000 * PNG_SCALE && r.height === 640 * PNG_SCALE && r.type === 'image/png';
      check(dimsOk, `${tag}-blob`, `${r.width}×${r.height} ${r.type}, ${fmtKB(r.bytes)}, ${r.ms.toFixed(0)} ms → tests/out/${name}`,
        `expected ${1000 * PNG_SCALE}×${640 * PNG_SCALE} image/png, got ${r.width}×${r.height} ${r.type}`);
      check(r.corners.every((a) => a === 0), `${tag}-transparent`, 'all four corner pixels are fully transparent',
        `corner alphas ${r.corners.join(',')} — background is not transparent`);
      const needleOk = r.needle.alpha >= 200 && r.needle.lum <= 110;
      const sideOk = Math.abs(r.best.deg - r.needleAngle) <= 3;
      check(needleOk && sideOk, `${tag}-needle`,
        `needle at ${r.needleAngle.toFixed(1)}° (darkest ring sample at ${r.best.deg}°; alpha ${r.needle.alpha.toFixed(0)}, lum ${r.needle.lum.toFixed(0)})`,
        `expected a dark opaque needle at ${r.needleAngle.toFixed(1)}° — probe alpha ${r.needle.alpha.toFixed(0)} lum ${r.needle.lum.toFixed(0)}, darkest sample at ${r.best.deg}°`);
      const emptyOk = r.empties.every((e) => e.alpha <= 100);
      check(emptyOk, `${tag}-other-side`,
        `mirrored side clear (${r.empties.map((e) => `${e.deg}°: alpha ${e.alpha.toFixed(0)}`).join(', ')})`,
        `something opaque where only a faint prev marker/trail may be: ${r.empties.map((e) => `${e.deg}°: alpha ${e.alpha.toFixed(0)}`).join(', ')}`);
    }

    // Default scale (3×) with a solid background — used later as the reference next to the PPTX render.
    const ref = await page.evaluate(async () => {
      const state = Object.assign({}, window.Gauge.defaults, { value: 62, prev: 48 });
      const blob = await window.Exporters.svgToPngBlob(window.Exporters.svgString(state), { scale: 3, background: '#FFFFFF' });
      const url = URL.createObjectURL(blob);
      const img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url);
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
      const corner = Array.from(ctx.getImageData(0, 0, 1, 1).data);
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      return { width: c.width, height: c.height, corner, bytes: blob.size, b64 };
    });
    writeBase64('svg-reference.png', ref.b64);
    check(ref.width === 3000 && ref.height === 1920, 'png-default-scale', `3× export is ${ref.width}×${ref.height} px (${fmtKB(ref.bytes)}) → tests/out/svg-reference.png`,
      `expected 3000×1920 at scale 3, got ${ref.width}×${ref.height}`);
    check(ref.corner.join(',') === '255,255,255,255', 'png-solid-background', 'white background fills the corner', `corner pixel is ${ref.corner.join(',')}, expected opaque white`);

    const fname = await page.evaluate(() => [
      window.Exporters.filename({ value: 62, prev: 48 }, 'png'),
      window.Exporters.filename({ value: 62.5, prev: 48 }, 'gif'),
    ]);
    check(/^[A-Za-z0-9_.-]+\.png$/.test(fname[0]) && /62-5/.test(fname[1]) && /^[A-Za-z0-9_.-]+$/.test(fname[1]), 'export-filename',
      `${fname[0]}, ${fname[1]}`, `filenames not ASCII-safe / decimals not dashed: ${fname.join(', ')}`);
  });

  /* ------------------------------------------------------------ 3 */
  await step('3. Animated GIF', async () => {
    const gifOpts = { width: 600, fps: 30, frames: 12, hold: 3, background: '#FFFFFF', loop: 'forever' };
    const g = await page.evaluate(async (opts) => {
      const state = Object.assign({}, window.Gauge.defaults, { value: 62, prev: 48 });
      const expectedFrames = window.Gauge.animationFrames(state, { frames: opts.frames, fps: opts.fps, hold: opts.hold }).length;
      const progress = [];
      const t0 = performance.now();
      const blob = await window.Exporters.gifBlob(state, Object.assign({}, opts, { onProgress: (i, n) => progress.push([i, n]) }));
      const ms = performance.now() - t0;
      const sig = String.fromCharCode(...new Uint8Array(await blob.slice(0, 6).arrayBuffer()));
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      return { expectedFrames, size: blob.size, type: blob.type, sig, ms, progressCalls: progress.length, last: progress[progress.length - 1] || null, b64 };
    }, gifOpts);
    writeBase64('anim.gif', g.b64);
    check(g.sig === 'GIF89a' && g.type === 'image/gif', 'gif-blob', `${g.sig}, ${g.type}, ${fmtKB(g.size)}, ${g.expectedFrames} frames in ${g.ms.toFixed(0)} ms → tests/out/anim.gif`,
      `unexpected signature "${g.sig}" / type ${g.type}`);
    check(g.progressCalls > 0 && g.last && g.last[0] === g.last[1], 'gif-progress', `onProgress called ${g.progressCalls}× and finished at ${g.last ? g.last.join('/') : '–'}`,
      `onProgress calls ${g.progressCalls}, last ${g.last ? g.last.join('/') : '–'}`);
    runAssets(['gif', outFile('anim.gif'), '--frames', String(g.expectedFrames), '--width', '600', '--height', '384', '--loop', 'forever']);

    // Play-once variant (small): the NETSCAPE loop block must be absent.
    const once = await page.evaluate(async () => {
      const state = Object.assign({}, window.Gauge.defaults, { value: 20, prev: 80 });
      const blob = await window.Exporters.gifBlob(state, { width: 250, fps: 30, frames: 4, hold: 1, background: 'card', loop: 'once' });
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      return { size: blob.size, b64 };
    });
    writeBase64('anim-once.gif', once.b64);
    runAssets(['gif', outFile('anim-once.gif'), '--frames', '5', '--width', '250', '--height', '160', '--loop', 'once']);
  });

  /* ------------------------------------------------------------ 4 */
  await step('4. PPTX export', async () => {
    let available = await page.evaluate(() => window.PptxExport.available());
    if (!available) {
      // The deferred CDN script can fail on a flaky network — try once more before skipping.
      const cdn = (distHtml.match(/<script[^>]+src=["'](https:\/\/cdn\.jsdelivr\.net\/npm\/pptxgenjs[^"']+)["']/) || [])[1];
      if (cdn) {
        console.log('     | PptxGenJS not loaded yet — retrying the CDN script once');
        await page.addScriptTag({ url: cdn }).catch(() => {});
        await page.waitForFunction(() => window.PptxExport.available(), null, { timeout: 8000 }).catch(() => {});
        available = await page.evaluate(() => window.PptxExport.available());
      }
    }
    if (!available) {
      skip('pptx-export', 'PptxGenJS not loaded (CDN unreachable or offline) — the app degrades gracefully; PPTX not verified in this run');
      const disabled = await page.evaluate(() => { const b = document.getElementById('btn-pptx'); return b ? b.disabled : null; });
      if (disabled !== null) check(disabled === true, 'pptx-button-disabled', 'Download PPTX is disabled while PptxGenJS is missing', 'Download PPTX should be disabled when PptxGenJS is missing');
      return;
    }
    const p = await page.evaluate(async () => {
      const state = Object.assign({}, window.Gauge.defaults, { value: 62, prev: 48 });
      const t0 = performance.now();
      const blob = await window.PptxExport.build(state, { includeNativeSlide: true, includeImageSlide: true, title: 'Resultater' });
      const ms = performance.now() - t0;
      const sig = String.fromCharCode(...new Uint8Array(await blob.slice(0, 2).arrayBuffer()));
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });
      return { size: blob.size, type: blob.type, sig, ms, b64 };
    });
    writeBase64('native.pptx', p.b64);
    check(p.sig === 'PK' && p.size > 10000, 'pptx-blob', `${fmtKB(p.size)} ${p.type || '(no type)'} in ${p.ms.toFixed(0)} ms → tests/out/native.pptx`,
      `not a ZIP container (signature "${p.sig}", ${p.size} bytes)`);
    runAssets(['pptx', outFile('native.pptx'), '--png', outFile('pptx-slide1.png'), '--slides', '2', '--min-shapes', '8']);
  });

  /* ------------------------------------------------------------ 5 */
  await step('5. Console', async () => {
    const errs = [...pageErrors.map((e) => 'uncaught: ' + e), ...consoleErrors];
    check(errs.length === 0, 'console-errors', 'zero console errors and zero uncaught exceptions',
      `${errs.length} error(s): ${errs.slice(0, 5).join(' | ')}`);
    if (networkWarnings.length) console.log(`     ! ${networkWarnings.length} remote resource(s) could not be fetched (treated as warnings): ${[...new Set(networkWarnings)].slice(0, 3).join(' | ')}`);
  });
} finally {
  await browser.close();
}

finish();

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

function finish() {
  const count = (s) => results.filter((r) => r.status === s).length;
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log('\n== Summary');
  console.log(`${count('PASS')} passed, ${failed.length} failed, ${count('SKIP')} skipped — output in ${path.relative(root, outDir)}/`);
  for (const f of failed) console.log(`  FAIL ${f.name}${f.detail ? ' — ' + f.detail : ''}`);
  console.log(failed.length ? '\nRESULT: FAIL' : '\nRESULT: OK');
  process.exit(failed.length ? 1 : 0);
}
