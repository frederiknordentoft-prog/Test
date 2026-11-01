/*
 * F0 QA: serves dist/ with an artifact-like CSP, frames it cross-origin in a sandboxed iframe,
 * reads the in-app diagnostics, measures the look-dev under 4x CPU throttling, and takes
 * look-dev screenshots at 390x664 and 390x844.
 * Run: npm run build && node qa/f0.cjs
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireHere = createRequire(__filename);
function loadPlaywright() {
  for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright', '/opt/node-tools/node_modules/playwright']) {
    try { return requireHere(c); } catch (_) { /* next */ }
  }
  throw new Error('Playwright not found');
}
const { chromium } = loadPlaywright();

const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
].join('; ');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };

function serveDist(port) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const file = path.join(DIST, url === '/' ? 'index.html' : url);
      if (!file.startsWith(DIST) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
        'Content-Security-Policy': CSP,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(file).pipe(res);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}
function serveHarness(port, appPort) {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const u = new URL(req.url, 'http://x');
      const h = Number(u.searchParams.get('h') || 844);
      const route = u.searchParams.get('r') || 'lookdev';
      const sandbox = u.searchParams.get('sb') === '0' ? '' : 'sandbox="allow-scripts allow-popups allow-forms"';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!doctype html><html><body style="margin:0;background:#000">
<iframe id="app" ${sandbox} src="http://127.0.0.1:${appPort}/#${route}" style="border:0;width:390px;height:${h}px;display:block"></iframe></body></html>`);
    });
    s.listen(port, '127.0.0.1', () => resolve(s));
  });
}

async function appFrame(page) {
  const el = await page.waitForSelector('#app');
  for (let i = 0; i < 50; i++) {
    const f = await el.contentFrame();
    if (f) {
      const ok = await f.evaluate(() => Boolean(window.__lookdev || document.querySelector('.spike'))).catch(() => false);
      if (ok) return f;
    }
    await page.waitForTimeout(100);
  }
  throw new Error('app frame not ready');
}

(async () => {
  const app = await serveDist(4180);
  const harness = await serveHarness(4181, 4180);
  const browser = await chromium.launch();
  const report = { sandboxed: {}, plain: {}, perf: {}, shots: [], failures: [] };
  const ctxOpts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };

  // 1) Diagnostics in a sandboxed (opaque-origin) and a plain cross-origin iframe.
  for (const [key, sb] of [['sandboxed', '1'], ['plain', '0']]) {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(() => { window.__ORE_BOOT = { skipGate: true }; });
    const page = await ctx.newPage();
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
    await page.goto(`http://127.0.0.1:4181/?r=spike&sb=${sb}`);
    const f = await appFrame(page);
    await f.waitForFunction(() => {
      const t = document.body.innerText;
      return /Konklusion/.test(t) && !/Tester …/.test(t) && /Worker fra egen fil:|Worker som blob:/.test(t);
    }, null, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const checks = await f.evaluate(() => {
      const rows = [...document.querySelectorAll('.checks li')].map((li) => [li.querySelector('.lbl').textContent, li.querySelector('.det').textContent]);
      return Object.fromEntries(rows);
    });
    report[key] = { checks, consoleErrors };
    await ctx.close();
  }

  // 2) Look-dev performance under 4x CPU throttling while playing.
  {
    const ctx = await browser.newContext(ctxOpts);
    await ctx.addInitScript(() => { window.__ORE_BOOT = { skipGate: true }; });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:4181/?r=lookdev&h=844');
    const f = await appFrame(page);
    const cdp = await ctx.newCDPSession(page);
    for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await f.evaluate(() => {
        window.__lt = [];
        try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (_) {}
        window.__dts = []; let last = 0;
        const loop = (t) => { if (last) window.__dts.push(t - last); last = t; if (window.__dts.length < 100000) requestAnimationFrame(loop); };
        requestAnimationFrame(loop);
      });
      await f.click('button[aria-label="Afspil"]');
      await page.waitForTimeout(8000);
      const r = await f.evaluate(() => {
        const a = window.__dts.slice(10).sort((x, y) => x - y);
        const q = (p) => a[Math.floor(a.length * p)];
        return { frames: a.length, p50: q(0.5), p95: q(0.95), p99: q(0.99), longTasks: window.__lt, state: window.__lookdev.state() };
      });
      report.perf[`cpu${rate}x`] = r;
      await f.click('button[aria-label="Pause"]');
    }
    await ctx.close();
  }

  // 3) Look-dev screenshots.
  for (const h of [844, 664]) {
    const ctx = await browser.newContext({ ...ctxOpts, viewport: { width: 390, height: h } });
    await ctx.addInitScript(() => { window.__ORE_BOOT = { skipGate: true }; });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:4181/?r=lookdev&h=${h}`);
    const f = await appFrame(page);
    await f.evaluate(() => document.fonts.ready);
    for (const sc of ['27', '70']) {
      for (const v of ['lyn', 'langtid', 'spaghetti']) {
        await f.evaluate(({ v, sc }) => window.__lookdev.set({ variant: v, scenario: sc, chrome: false }), { v, sc });
        await page.waitForTimeout(700);
        const file = path.join(OUT, `lookdev-${h}-${sc}-${v}.png`);
        await (await page.$('#app')).screenshot({ path: file });
        report.shots.push(path.basename(file));
      }
    }
    await ctx.close();
  }

  await browser.close();
  app.close();
  harness.close();
  fs.writeFileSync(path.join(OUT, 'f0-report.json'), JSON.stringify(report, null, 1));
  console.log(JSON.stringify({ sandboxed: report.sandboxed, plain: report.plain, perf: report.perf }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
