/* Ad-hoc screenshots of the built app at given routes and match minutes. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(__filename);
let pw; for (const c of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { pw = req(c); break; } catch (_) {} }
const DIST = path.join(__dirname, '..', 'dist');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => { const f = path.join(DIST, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]); if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(4199);
const shots = JSON.parse(process.argv[2] || '[]');
(async () => {
  const b = await pw.chromium.launch();
  for (const s of shots) {
    const ctx = await b.newContext({ viewport: { width: 390, height: s.h || 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { window.__UDFALD_BOOT = { skipGate: true }; });
    const p = await ctx.newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(`http://127.0.0.1:4199/#${s.route || 'kamp'}`);
    await p.waitForFunction(() => window.__udfald && window.__udfald.derby);
    await p.waitForTimeout(800);
    if (s.minute) {
      await p.evaluate(async (m) => { const st = window.__udfald.derby; st.stop(); st.speed = 16; while (st.sim.t < m && st.sim.phase !== 'closed') st.tick(); st.speed = 1; st.flushNow(); st.start(); }, s.minute);
    }
    if (s.eval) await p.evaluate(s.eval);
    await p.waitForTimeout(s.wait || 1500);
    const file = path.join(OUT, `${s.name}.png`);
    await p.screenshot({ path: file });
    console.log(file, errs.length ? 'ERRORS: ' + errs.slice(0, 3).join(' | ') : '');
    await ctx.close();
  }
  await b.close(); server.close();
})();
