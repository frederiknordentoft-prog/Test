/*
 * QA for Sportsbook X. Not part of the bundle.
 * Run:  npm run build && npm run preview   (in another shell, port 4173)
 *       node qa/qa.cjs
 * Gates: no serious or critical axe-core findings (WCAG 2.x A/AA/AAA),
 *        no Long Task over 50 ms while Live is on under 4x CPU throttling,
 *        no sheet movement under reduced motion.
 */
const { createRequire } = require('node:module');
const path = require('node:path');
const fs = require('node:fs');

const requireHere = createRequire(__filename);
function loadPlaywright() {
  const candidates = ['playwright', '/opt/node-tools/node_modules/playwright'];
  for (const c of candidates) {
    try { return requireHere(c); } catch (_) { /* try next */ }
  }
  throw new Error('Playwright not found. Install it or check /opt/node-tools.');
}
const { chromium } = loadPlaywright();
const AXE_PATH = requireHere.resolve('axe-core/axe.min.js');
const BASE = process.env.QA_URL || 'http://localhost:4173/';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag2aaa'];

const report = { axe: {}, longTasks: {}, reducedMotion: {}, flows: {}, failures: [] };

async function settle(page) {
  // Let Motion and CSS transitions finish, otherwise contrast is measured mid-fade.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'), null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function axeScan(page, name) {
  await settle(page);
  await page.addScriptTag({ path: AXE_PATH });
  const res = await page.evaluate((tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }), TAGS);
  const byImpact = {};
  for (const v of res.violations) {
    byImpact[v.impact] = (byImpact[v.impact] || 0) + v.nodes.length;
  }
  report.axe[name] = {
    passes: res.passes.length,
    byImpact,
    rules: res.violations.map((v) => `${v.id} (${v.impact}, ${v.nodes.length})`),
    targets: res.violations.flatMap((v) => v.nodes.map((n) => `${v.id}: ${n.target.join(' ')} :: ${(n.failureSummary || '').split('\n').slice(0, 2).join(' | ').slice(0, 160)}`)),
  };
  if (res.passes.length === 0) report.failures.push(`axe ${name}: no rules ran`);
  const blocking = (byImpact.serious || 0) + (byImpact.critical || 0);
  if (blocking > 0) report.failures.push(`axe ${name}: ${blocking} serious/critical`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await axeScan(page, 'board');

  // Market detail
  await page.locator('.tile').first().click();
  await axeScan(page, 'market');
  await page.locator('.choice').first().click();

  // Slip opens, Escape closes it and returns focus to the dock button
  await page.getByRole('button', { name: 'Slip', exact: true }).click();
  await axeScan(page, 'slip');
  const focusedInDialog = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'));
  report.flows.focusMovesIntoSlip = focusedInDialog;
  await page.keyboard.press('Escape');
  // The sheet animates out, so wait for it to leave the DOM rather than counting at once.
  const closed = await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: 2500 }).then(() => true, () => false);
  report.flows.escapeClosesSlip = closed;
  if (!closed) report.failures.push('Escape did not close the slip');

  // Place a demo bet, open Mine bets, accept the cash-out offer
  await page.getByRole('button', { name: 'Slip', exact: true }).click();
  await page.getByRole('button', { name: 'Læg bet (demo)' }).click();
  await page.getByRole('button', { name: 'Mine bets', exact: true }).click();
  await axeScan(page, 'mine-bets');
  const accept = page.getByRole('button', { name: 'Accepter tilbud (demo)' }).first();
  await accept.click();
  const cashed = await page.getByText(/Afregnet \(demo\)/).count();
  report.flows.cashOutSettles = cashed > 0;
  if (cashed === 0) report.failures.push('cash-out did not settle');

  // Board and match, then the match with the momentum strip
  await page.getByRole('button', { name: '‹ Tilbage' }).click();
  await page.getByRole('button', { name: '‹ Tilbage' }).click().catch(() => {});
  await page.locator('.row-list .market-row').first().click();
  await axeScan(page, 'match');

  // Long Tasks under 4x CPU throttling while Live runs
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  report.longTasks.supported = await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('longtask'));
  if (!report.longTasks.supported) report.failures.push('longtask entries not supported in this browser');
  await page.evaluate(() => {
    window.__long = [];
    window.__cls = 0;
    new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push(e.duration); })
      .observe({ type: 'longtask', buffered: false });
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: 'layout-shift', buffered: false });
  });
  await page.getByRole('switch').check();
  await page.waitForTimeout(3000);
  await page.locator('.row-list .market-row').first().click().catch(() => {});
  const lt = await page.evaluate(() => ({ count: window.__long.length, max: Math.max(0, ...window.__long), cls: window.__cls }));
  report.longTasks = { ...lt, over50: lt.count, supported: report.longTasks.supported, note: 'Live on, 3 s, 4x CPU throttling' };
  if (lt.max > 50) report.failures.push(`Long Task ${Math.round(lt.max)} ms with Live on`);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await page.getByRole('switch').uncheck();

  // Reduced motion: the slip must not slide into place. A control run without it must slide,
  // otherwise the measurement proves nothing.
  async function slipTravel(reducedMotion) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion });
    const pg = await ctx.newPage();
    await pg.goto(BASE, { waitUntil: 'networkidle' });
    await pg.locator('.tile').first().click();
    await pg.locator('.choice').first().click();
    await pg.getByRole('button', { name: 'Slip', exact: true }).click();
    const a = await pg.locator('[role="dialog"]').evaluate((el) => el.getBoundingClientRect().top);
    await pg.waitForTimeout(700);
    const b = await pg.locator('[role="dialog"]').evaluate((el) => el.getBoundingClientRect().top);
    await ctx.close();
    return { topAt0: Math.round(a), topAt700: Math.round(b), travel: Math.round(Math.abs(a - b)) };
  }
  const reduced = await slipTravel('reduce');
  const control = await slipTravel('no-preference');
  report.reducedMotion = { reduced, control, moved: reduced.travel > 1 };
  if (report.reducedMotion.moved) report.failures.push('sheet moved under reduced motion');
  if (control.travel <= 1) report.failures.push('control run did not slide; reduced-motion test is not meaningful');

  report.consoleErrors = consoleErrors;
  if (consoleErrors.length) report.failures.push(`${consoleErrors.length} console error(s)`);

  await browser.close();
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.failures.length ? 1 : 0);
})().catch((e) => { console.error('QA crashed:', e); process.exit(2); });
