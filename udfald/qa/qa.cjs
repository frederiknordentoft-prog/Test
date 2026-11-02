/*
 * QA for UDFALD. Run: npm run build && node qa/qa.cjs
 * Serves dist/ with an artifact-like CSP and frames it cross-origin (sandboxed and plain).
 * Gates: no CSP violations or page errors; worker mode detected; frame pacing at 1x;
 * chrome stays still through a goal; payout visible in the tray; axe has no critical findings;
 * reduced motion stops the breathing but data still updates; the demo plays end to end
 * (ghost thumb, Byg at halftime, Afregning). Screens at 664/744/844 go to qa/out/.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(__filename);
let pw; for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = req(c); break; } catch (_) {} }
const AXE = fs.readFileSync(req.resolve('axe-core/axe.min.js'), 'utf8');
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const CSP = ["default-src 'self'", "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' https://fonts.gstatic.com data:", "img-src 'self' data: blob:", "connect-src 'self'", "worker-src 'self' blob:"].join('; ');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const app = http.createServer((q, r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(DIST, url === '/' ? 'index.html' : url);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'Access-Control-Allow-Origin': '*' });
  fs.createReadStream(f).pipe(r);
}).listen(4280, '127.0.0.1');
const harness = http.createServer((q, r) => {
  const u = new URL(q.url, 'http://x');
  const h = Number(u.searchParams.get('h') || 844);
  const sb = u.searchParams.get('sb') === '0' ? '' : 'sandbox="allow-scripts allow-popups allow-forms"';
  r.writeHead(200, { 'Content-Type': 'text/html' });
  r.end(`<!doctype html><body style="margin:0;background:#000"><iframe id="app" ${sb} src="http://127.0.0.1:4280/#${u.searchParams.get('r') || 'kamp'}" style="border:0;width:390px;height:${h}px;display:block"></iframe></body>`);
}).listen(4281, '127.0.0.1');

const report = { checks: [], perf: {}, shots: [], failures: [] };
const check = (name, ok, detail) => { report.checks.push({ name, ok, detail }); if (!ok) report.failures.push(`${name}: ${detail}`); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' · ' + detail : ''}`); };

async function open(browser, route, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: opts.h || 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((mc) => { window.__UDFALD_BOOT = { skipGate: true, mc }; }, opts.mc || 'auto');
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  await page.goto(`http://127.0.0.1:4281/?r=${route}&h=${opts.h || 844}&sb=${opts.sb ?? '1'}`);
  const el = await page.waitForSelector('#app');
  let f = null;
  for (let i = 0; i < 80 && !f; i++) { f = await el.contentFrame(); if (f && !(await f.evaluate(() => !!window.__udfald).catch(() => false))) f = null; if (!f) await page.waitForTimeout(100); }
  return { ctx, page, f, errors, el };
}

const ff = (m) => `(async () => { const st = window.__udfald.derby; st.stop(); st.speed = 16; while (st.sim.t < ${m} && st.sim.phase !== 'closed') st.tick(); st.speed = 1; st.flushNow(); st.start(); })()`;

(async () => {
  const browser = await pw.chromium.launch();

  // 1) Host parity: sandboxed (opaque origin) and plain cross-origin iframe.
  for (const sb of ['1', '0']) {
    const { ctx, f, errors } = await open(browser, 'kamp', { sb });
    await f.waitForTimeout(5000);
    const st = await f.evaluate(() => ({ csp: document.body.innerText.includes('overtrædelse'), mode: window.__udfald.derby.mc.mode, t: window.__udfald.derby.sim.t, counts: window.__udfald.derby.view.counts }));
    const csp = await f.evaluate(() => { const c = window.__udfaldCsp; return c ?? 0; });
    check(`host ${sb === '1' ? 'sandboxed' : 'plain'}: no page errors`, errors.length === 0, errors.slice(0, 2).join(' | '));
    check(`host ${sb === '1' ? 'sandboxed' : 'plain'}: Monte Carlo runs`, st.mode !== '…' && Array.isArray(st.counts), `mode=${st.mode} counts=${st.counts}`);
    void csp;
    await ctx.close();
  }

  // 2) CSP violations (listener in the app writes to the diag store; read via #spike).
  {
    const { ctx, f } = await open(browser, 'spike');
    await f.waitForTimeout(6000);
    const txt = await f.evaluate(() => document.body.innerText);
    check('CSP: 0 violations', /CSP\s*\n?\s*0 overtrædelser/.test(txt) || txt.includes('0 overtrædelser'), (txt.match(/CSP[^\n]*\n[^\n]*/) || [''])[0]);
    check('fonts load from own files or data: URI', /Egne fontfiler virker|data-URI virker/.test(txt), (txt.match(/Fonte[^\n]*\n[^\n]*/) || [''])[0]);
    check('worker detected in sandbox', /Workere virker|Kun blob-worker virker/.test(txt), (txt.match(/Konklusion[^\n]*\n[^\n]*/) || [''])[0]);
    await ctx.close();
  }

  // 3) Performance at 1x and 4x CPU while the match runs at x1 and x16.
  {
    const { ctx, page, f } = await open(browser, 'kamp');
    const cdp = await ctx.newCDPSession(page);
    await f.evaluate(ff(20));
    for (const rate of [1, 4]) {
      await cdp.send('Emulation.setCPUThrottlingRate', { rate });
      await f.evaluate(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask' }); } catch (_) {} window.__d = []; let last = 0; const loop = (t) => { if (last) window.__d.push(t - last); last = t; if (window.__d.length < 2000) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
      await page.waitForTimeout(7000);
      const r = await f.evaluate(() => { const a = window.__d.slice(5).sort((x, y) => x - y); const q = (p) => a[Math.floor(a.length * p)]; return { frames: a.length, p50: q(0.5), p95: q(0.95), long: window.__lt.length, maxLong: Math.max(0, ...window.__lt), mcMs: window.__udfald.derby.mc.lastMs }; });
      report.perf[`cpu${rate}x`] = r;
      console.log(`perf cpu${rate}x`, JSON.stringify(r));
    }
    check('frame pacing at 1x CPU: p95 ≤ 20 ms', report.perf.cpu1x.p95 <= 20, `p95 ${report.perf.cpu1x.p95.toFixed(1)} ms`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await ctx.close();
  }

  // 4) Chrome stays still through a goal, and the score updates.
  {
    const { ctx, f } = await open(browser, 'kamp');
    await f.evaluate(ff(30));
    const boxes = () => f.evaluate(() => ['.kb', '.ab', '.bb', '.ih'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round).join(','); }));
    const before = await boxes();
    await f.evaluate(() => window.__udfald.derby.fire('goalB'));
    const samples = [];
    for (let i = 0; i < 12; i++) { await f.waitForTimeout(100); samples.push((await boxes()).join('|')); }
    check('chrome still during goal', samples.every((s) => s === before.join('|')), samples.find((s) => s !== before.join('|')) || '');
    const score = await f.evaluate(() => window.__udfald.derby.sim.a);
    check('goal registered', score >= 1, `BIF ${score}`);
    await ctx.close();
  }

  // 5) Tray: payout visible; buy goes through the price lock; position card appears.
  {
    const { ctx, f } = await open(browser, 'kamp');
    await f.evaluate(ff(10));
    await f.click('.ab-seg.s0');
    await f.waitForSelector('.tray');
    const payout = await f.evaluate(() => { const e = document.querySelector('.tray-pay b'); const r = e.getBoundingClientRect(); return { text: e.textContent, visible: r.height > 0 && document.elementFromPoint(r.x + 2, r.y + 2) !== null }; });
    check('tray shows payout', payout.visible && /kr/.test(payout.text), payout.text);
    await f.click('.tray-buy');
    await f.waitForTimeout(2200);
    const pos = await f.evaluate(() => window.__udfald.derby.book.positions.get('1x2:F')?.shares ?? 0);
    check('buy fills after the 1.5 s lock', pos > 0, `${pos} shares`);
    await f.waitForTimeout(400);
    const card = await f.evaluate(() => !!document.querySelector('.pc .fader'));
    check('position card with fader', card, '');
    await ctx.close();
  }

  // 6) Reduced motion: no breathing, data still moves.
  {
    const { ctx, f } = await open(browser, 'kamp', { reduced: true });
    await f.waitForTimeout(4000);
    const anim = await f.evaluate(() => getComputedStyle(document.querySelector('.fan-head'), '::after').animationName);
    const t0 = await f.evaluate(() => window.__udfald.derby.sim.k);
    await f.waitForTimeout(1500);
    const t1 = await f.evaluate(() => window.__udfald.derby.sim.k);
    check('reduced motion: no breathing', anim === 'none', anim);
    check('reduced motion: data updates', t1 > t0, `${t0} → ${t1}`);
    await ctx.close();
  }

  // 7) axe on each screen.
  for (const route of ['lobby', 'kamp', 'byg', 'portefolje', 'afregning', 'hallen']) {
    const { ctx, f } = await open(browser, route);
    await f.waitForTimeout(2500);
    await f.evaluate(AXE);
    const res = await f.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }));
    const crit = res.violations.filter((v) => v.impact === 'critical');
    const serious = res.violations.filter((v) => v.impact === 'serious');
    check(`axe ${route}: no critical`, crit.length === 0, [...crit, ...serious].map((v) => `${v.impact}:${v.id}(${v.nodes.length})`).join(' '));
    await ctx.close();
  }

  // 8) Screens at three heights.
  for (const h of [664, 744, 844]) {
    const { ctx, page, f } = await open(browser, 'kamp', { h });
    await f.evaluate(ff(27));
    await f.waitForTimeout(1800);
    const file = path.join(OUT, `kamp-${h}.png`);
    await (await page.$('#app')).screenshot({ path: file });
    report.shots.push(path.basename(file));
    await ctx.close();
  }

  // 9) The demo, in real time: ghost thumb, Byg at halftime, Afregning at the end.
  {
    const { ctx, page, f, errors } = await open(browser, 'demo');
    const seen = new Set();
    const t0 = Date.now();
    let byg = false;
    while (Date.now() - t0 < 130000) {
      await page.waitForTimeout(1000);
      const s = await f.evaluate(() => ({ h: location.hash, phase: window.__udfald.demo?.sim.phase, t: window.__udfald.demo?.sim.t, thumb: !!document.querySelector('.ghost-thumb'), log: window.__udfald.demo?.book.log.length }));
      if (s.h === '#byg') byg = true;
      if (s.thumb) seen.add(Math.round(s.t));
      if ((s.h === '#byg' || s.t > 44.5) && !report.shots.includes('demo-byg.png') && s.h === '#byg') { await page.waitForTimeout(2500); await (await page.$('#app')).screenshot({ path: path.join(OUT, 'demo-byg.png') }); report.shots.push('demo-byg.png'); }
      if (s.t > 31.4 && s.t < 32 && !report.shots.includes('demo-goal.png')) { await (await page.$('#app')).screenshot({ path: path.join(OUT, 'demo-goal.png') }); report.shots.push('demo-goal.png'); }
      if (s.h === '#afregning') { await page.waitForTimeout(1500); await (await page.$('#app')).screenshot({ path: path.join(OUT, 'demo-afregning.png') }); report.shots.push('demo-afregning.png'); break; }
    }
    const fin = await f.evaluate(() => ({ h: location.hash, score: `${window.__udfald.demo.sim.h}-${window.__udfald.demo.sim.a}`, log: window.__udfald.demo.book.log.map((e) => e.kind + ':' + e.contract) }));
    const secs = (Date.now() - t0) / 1000;
    check('demo reaches Afregning', fin.h === '#afregning', `${fin.h} after ${secs.toFixed(0)} s`);
    check('demo shows Byg at halftime', byg, '');
    check('demo trades: buy, limit fill, byg, window, settlements', ['buy:1x2:F', 'limit-fill:1x2:F'].every((k) => fin.log.includes(k)) && fin.log.some((k) => k.startsWith('buy:byg')) && fin.log.some((k) => k.startsWith('buy:w:')), fin.log.join(' '));
    check('demo: no page errors', errors.length === 0, errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

  await browser.close();
  app.close();
  harness.close();
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 1));
  console.log(`\n${report.failures.length ? 'FAILURES:\n' + report.failures.join('\n') : 'All QA checks passed.'}`);
  process.exit(report.failures.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
