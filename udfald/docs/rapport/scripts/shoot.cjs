/*
 * Screenshots for the report. Serves dist/ and drives the real app in Playwright Chromium.
 *
 * Context A replays the story (scripts/story.js) on a frozen store: the rAF loop keeps rendering
 * and flushing views, but the match only advances when this script calls tick(). Every shot waits
 * for a Monte Carlo result of its own focus and for the fan to redraw. Toasts are captured and
 * suppressed, and replayed only for the shots that show them. At the end the book is compared
 * with data/story.json (the node run): the trades must be identical.
 *
 * Context B: lobby and Hallen. Context C: the scripted demo in real time.
 * Output: out/shots/NN-name.png (masters) and data/shots/NN-name.json (sidecars).
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAP = path.join(__dirname, '..');
const DIST = path.join(RAP, '..', '..', 'dist');
const OUT = path.join(RAP, 'out', 'shots');
const SIDE = path.join(RAP, 'data', 'shots');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SIDE, { recursive: true });
const STORY_JS = fs.readFileSync(path.join(__dirname, 'story.js'), 'utf8');
const STORY = JSON.parse(fs.readFileSync(path.join(RAP, 'data', 'story.json'), 'utf8'));
const ONLY = process.argv[2] ? process.argv[2].split(',') : null; // contexts to run: A,B,C

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = http.createServer((q, r) => {
  const u = q.url.split('?')[0];
  const f = path.join(DIST, u === '/' ? 'index.html' : u);
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
}).listen(4321);

const INIT = `
${STORY_JS}
window.__UDFALD_BOOT = { skipGate: true };
(() => {
  const ft = CanvasRenderingContext2D.prototype.fillText;
  const cr = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.fillText = function (text, x, y, ...rest) {
    if (this.canvas.classList && this.canvas.classList.contains('layer-live')) (window.__liveTexts = window.__liveTexts || []).push({ text: String(text), x, y, align: this.textAlign });
    return ft.call(this, text, x, y, ...rest);
  };
  CanvasRenderingContext2D.prototype.clearRect = function (...a) {
    if (this.canvas.classList && this.canvas.classList.contains('layer-live')) window.__liveTexts = [];
    return cr.apply(this, a);
  };
})();
window.__shot = {
  st: () => (window.__shot.useDemo ? window.__udfald.demo : window.__udfald.derby),
  clock: () => performance.now(),
  freeze() {
    const st = this.st();
    st.stop(); st.paused = true; st.start(); st.speed = 1;
    st.__shown = [];
    st.__toasts = [];
    st.__toast = st.toast.bind(st);
    st.toast = (text, tone) => { st.__toasts.push({ k: st.sim.k, text, tone }); };
  },
  ffK(k) { UDFALD_STORY.ffK(this.st(), k, this.clock); },
  until(pred) { UDFALD_STORY.ffT(this.st(), 0, this.clock, pred); },
  step() { UDFALD_STORY.step(this.st(), this.clock()); },
  async mc() {
    const st = this.st();
    const before = st.mcResult;
    st.lastMcTick = -999; st.mcPending = false; st.maybeMc(1);
    for (let i = 0; i < 300; i++) {
      await new Promise((r) => setTimeout(r, 20));
      if (st.mcResult !== before && st.mcFor()) break;
    }
    if (st.mcResult === before) throw new Error('no MC result');
  },
  redraw() { const st = this.st(); st.flushNow(); st.frameL.forEach((l) => l()); },
  replay(match) {
    const st = this.st();
    const t = st.__toasts.filter((x) => match.some((m) => x.text.startsWith(m)));
    t.forEach((x) => st.__toast(x.text, x.tone));
    st.__shown = t;
    return t.map((x) => x.text);
  },
  sidecar() {
    const st = this.st();
    const sim = st.sim;
    const rect = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
    const cv = document.querySelector('.fan.layer-live');
    const off = cv ? cv.getBoundingClientRect() : { x: 0, y: 0 };
    const sels = ['.kb', '.ih', '.ih-label', '.ih-price', '.ih-futures', '.fan-wrap', '.ab', '.mv', '.mv-h', '.mv-bars', '.mv-ag', '.pc', '.pc-sikring', '.fader', '.bb', '.tray', '.toasts', '.fan-head'];
    return {
      k: sim.k, t: sim.t, phase: sim.phase, score: sim.h + '-' + sim.a, focus: st.focus, halted: sim.halted,
      ask: [...sim.ask], bid: [...sim.bid], o25: { ask: [...sim.o25Ask], bid: [...sim.o25Bid], mid: sim.o25Mid },
      counts: st.mcFor() ? st.mcFor().counts : null,
      rects: Object.fromEntries(sels.map((s) => [s, rect(s)])),
      liveTexts: (window.__liveTexts || []).map((t) => ({ ...t, px: Math.round((t.x + off.x) * 10) / 10, py: Math.round((t.y + off.y) * 10) / 10 })),
      text: (document.querySelector('.screen') || document.body).innerText.slice(0, 4000),
      toasts: (st.__shown || []).map((x) => x.text),
      log: st.book.log.length,
    };
  },
};
`;

const wait = (p, ms) => p.waitForTimeout(ms);

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: opts.reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:4321/#${opts.route || 'kamp'}`);
  await page.waitForFunction(() => window.__udfald && window.__udfald.derby);
  await wait(page, 800);
  return { ctx, page, errors };
}

/** Screenshot of the viewport; tall screens grow the viewport to their content (capped). */
async function shot(page, name, opts = {}) {
  let h = 844;
  if (opts.tall) {
    h = await page.evaluate(() => {
      const bar = document.querySelector('.bar');
      const sc = document.querySelector('.scroll');
      return Math.ceil((bar ? bar.getBoundingClientRect().height : 0) + (sc ? sc.scrollHeight : 0)) + 2;
    });
    h = Math.max(844, Math.min(opts.max || 1600, h));
    await page.setViewportSize({ width: 390, height: h });
    await wait(page, 500);
  }
  const side = await page.evaluate(() => window.__shot.sidecar()).catch(() => ({}));
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  fs.writeFileSync(path.join(SIDE, `${name}.json`), JSON.stringify({ name, height: h, ...side }, null, 1));
  if (opts.tall) await page.setViewportSize({ width: 390, height: 844 });
  console.log('shot', name, `k=${side.k} t=${side.t && side.t.toFixed(2)} ${side.score || ''} h=${h}`);
}

async function focusShot(page, focus, name, opts = {}) {
  await page.evaluate(async (f) => {
    const s = window.__shot;
    s.st().setFocus(f);
    s.st().flushNow();
    await s.mc();
    s.redraw();
  }, focus);
  await wait(page, opts.wait || 700);
  if (opts.replay) await page.evaluate((m) => window.__shot.replay(m), opts.replay);
  if (opts.replay) await wait(page, 450);
  await shot(page, name, opts);
}

async function go(page, route) {
  await page.evaluate((r) => { location.hash = r; }, route);
  await wait(page, 700);
}

async function contextA(browser) {
  const { ctx, page, errors } = await newPage(browser, { reduced: true });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => window.__shot.freeze());
  await ev((k) => window.__shot.ffK(k), STORY.atStart.k);
  await page.evaluate(async () => { const s = window.__shot; await s.mc(); s.redraw(); });

  // 24: hold to stake on BIF (released to the left, so nothing is bought).
  const seg = await page.locator('.ab-seg.s2').boundingBox();
  const cx = seg.x + seg.width / 2;
  const cy = seg.y + seg.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await wait(page, 1420);
  await shot(page, '24-hold-for-indsats');
  await page.mouse.move(cx - 90, cy, { steps: 4 });
  await page.mouse.up();
  await wait(page, 400);

  // 04: buy FCK through the tray; the store is frozen, so the 1.5 s lock is still running.
  await ev(() => window.__shot.step());
  await page.locator('.ab-seg.s0').click();
  await page.waitForSelector('.tray');
  await page.locator('.tray .chips button', { hasText: '250' }).click();
  await page.locator('.tray .tray-buy').click();
  await wait(page, 600);
  await shot(page, '04-koeb-laasering');
  await ev(() => { const S = UDFALD_STORY; const s = window.__shot; S.settleLock(s.st(), s.clock); });
  await wait(page, 400);
  await ev(() => { const S = UDFALD_STORY; const s = window.__shot; S.afterFck(s.st(), s.clock); });

  // 03: the hero screen at 21′ with positions.
  await ev(() => window.__shot.ffK(870));
  await focusShot(page, 0, '03-kamp-anatomi');
  // 05 / 06: Sikring on BIF.
  await focusShot(page, 2, '05-sikring-linjer');
  await page.locator('.pc-sikring').click();
  await page.waitForSelector('.ex-row.stop');
  await wait(page, 400);
  await shot(page, '06-sikring-bakke');
  await page.locator('.scrim').click({ position: { x: 20, y: 20 } });
  await wait(page, 300);
  // 07 / 08: Over 2,5 at 24′.
  await ev(() => window.__shot.ffK(990));
  await focusShot(page, 'o25', '07-over25-vifte');
  await page.locator('.mv-o25').click();
  await page.waitForSelector('.tray');
  await wait(page, 400);
  await shot(page, '08-over25-bakke');
  await page.locator('.scrim').click({ position: { x: 20, y: 20 } });
  await wait(page, 300);
  // 09: the score map at 0–0 with a region; 10: the pool open.
  await go(page, 'maal');
  await page.locator('.sm-regions button', { hasText: '0–0 eller 1–1' }).click();
  await wait(page, 400);
  await shot(page, '09-maal-0-0', { tall: true });
  await go(page, 'pulje');
  await page.locator('.pj-bar.x').click();
  await wait(page, 400);
  await shot(page, '10-pulje-aaben', { tall: true });
  await go(page, 'kamp');

  // 11: the goal halt; 12: exits fired; 13 / 14: the reopen gap.
  await ev(() => window.__shot.ffK(1185));
  await wait(page, 3300);
  await focusShot(page, 0, '11-handelsstop');
  await ev(() => window.__shot.ffK(1200));
  await focusShot(page, 2, '12-stop-udloest', { replay: ['Gevinst sikret', 'Stop-loss udløst'] });
  await wait(page, 3000);
  await ev(() => window.__shot.ffK(1214));
  await focusShot(page, 0, '13-genaabning-gab');
  await focusShot(page, 'o25', '14-over25-efter-maal');

  // 15: the score map at 1–0 with a thin cell selected, after the late buy.
  await ev((k) => window.__shot.ffK(k), STORY.kLate);
  await ev(() => { const s = window.__shot; UDFALD_STORY.buy(s.st(), UDFALD_STORY.LATE[0], UDFALD_STORY.LATE[1], s.clock); s.st().setFocus(0); });
  await go(page, 'maal');
  await page.locator('.sm-cell[aria-label^="4–3"]').click();
  await wait(page, 400);
  await shot(page, '15-maal-1-0', { tall: true });

  // 16: pool locked at halftime; 17: Byg; 18: portfolio at 50′.
  await ev(() => window.__shot.until((st) => st.sim.phase === 'HT'));
  await go(page, 'pulje');
  await shot(page, '16-pulje-pause', { tall: true });
  await page.evaluate(async () => {
    const st = window.__shot.st();
    st.setLegs([{ kind: 'udfald', o: 0 }, { kind: 'maal', n: 3 }]);
    for (let i = 0; i < 300 && !st.build.quote; i++) await new Promise((r) => setTimeout(r, 20));
    st.flushNow();
  });
  await go(page, 'byg');
  await wait(page, 600);
  await shot(page, '17-byg', { tall: true });
  await ev(() => window.__shot.until((st) => st.sim.t >= 50));
  await go(page, 'portefolje');
  await shot(page, '18-portefolje', { tall: true });
  await ev(() => window.__shot.until((st) => st.sim.phase === 'closed'));
  await go(page, 'pulje');
  await shot(page, '19-pulje-afgjort', { tall: true });
  await go(page, 'afregning');
  await wait(page, 600);
  await shot(page, '20-afregning', { tall: true, max: 2400 });

  // The browser book must equal the node story, trade for trade.
  const book = await page.evaluate(() => window.__shot.st().book.log.map((e) => [e.kind, e.k, e.contract ?? e.side, e.shares ?? '', e.price ?? '', Math.round((e.kr ?? e.payout ?? 0) * 100) / 100]));
  const want = STORY.final.log.map((e) => [e.kind, e.k, e.contract ?? e.side, e.shares ?? '', e.price ?? '', Math.round((e.kr ?? e.payout ?? 0) * 100) / 100]);
  if (JSON.stringify(book) !== JSON.stringify(want)) {
    fs.writeFileSync(path.join(SIDE, 'MISMATCH.json'), JSON.stringify({ book, want }, null, 1));
    throw new Error('browser book differs from data/story.json (see data/shots/MISMATCH.json)');
  }
  console.log('book matches the node story:', book.length, 'entries');
  if (errors.length) throw new Error('page errors: ' + errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function contextB(browser) {
  const { ctx, page, errors } = await newPage(browser, { route: 'lobby' });
  await page.evaluate(() => {
    const st = window.__udfald.derby;
    st.stop(); st.speed = 16;
    while (st.sim.t < 27) st.tick();
    st.speed = 1; st.flushNow(); st.start();
    const h = window.__udfald.hallen;
    h.stop(); h.speed = 80;
    while (h.sim.k < 20 * 80) h.tick();
    h.speed = 1; h.start();
  });
  await wait(page, 2200);
  await shot(page, '01-lobby');
  await go(page, 'hallen');
  await wait(page, 1800);
  await shot(page, '21-hallen');
  if (errors.length) throw new Error('page errors: ' + errors.slice(0, 3).join(' | '));
  await ctx.close();
}

async function contextC(browser) {
  const { ctx, page, errors } = await newPage(browser, { route: 'demo' });
  await page.evaluate(() => { window.__shot.useDemo = true; window.__shot.st = () => window.__udfald.demo; });
  const done = new Set();
  const t0 = Date.now();
  let varStart = null;
  while (Date.now() - t0 < 140000 && done.size < 3) {
    await wait(page, 150);
    const s = await page.evaluate(() => {
      const d = window.__udfald.demo;
      if (!d) return null;
      const vs = d.sim.events.filter((e) => e.kind === 'var-start').at(-1);
      return { k: d.sim.k, t: d.sim.t, var: d.sim.halt && d.sim.halt.kind === 'var', varK: vs ? vs.k : null, note: (document.querySelector('.ghost-thumb .gt-note') || {}).textContent || '', filled: d.book.limits.some((l) => l.status === 'fyldt'), phase: d.sim.phase };
    });
    if (!s) continue;
    if (!done.has('02') && /Langt tryk/.test(s.note)) {
      await wait(page, 1200);
      await shot(page, '02-demo-tommel');
      done.add('02');
    }
    if (!done.has('23') && s.filled) {
      await wait(page, 250);
      await shot(page, '23-demo-graense-fyldt');
      done.add('23');
    }
    if (!done.has('22') && s.var && s.varK !== null && s.k - s.varK >= 30) {
      await shot(page, '22-demo-var');
      done.add('22');
    }
  }
  if (done.size < 3) throw new Error('demo shots missing: ' + ['02', '22', '23'].filter((x) => !done.has(x)).join(','));
  if (errors.length) throw new Error('page errors: ' + errors.slice(0, 3).join(' | '));
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (!ONLY || ONLY.includes('A')) await contextA(browser);
    if (!ONLY || ONLY.includes('B')) await contextB(browser);
    if (!ONLY || ONLY.includes('C')) await contextC(browser);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
