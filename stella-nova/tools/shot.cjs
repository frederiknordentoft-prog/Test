#!/usr/bin/env node
/**
 * Headless screenshot tool (software WebGL, so it is slow but exact).
 *
 *   node tools/shot.cjs <url> <out.png> [options]
 *
 *   --size=1280x800     viewport in CSS px (default 1280x800)
 *   --mobile            shorthand for --size=390x844 --dpr=2 --touch
 *   --dpr=1             device pixel ratio (default 1; 2 is 4× slower)
 *   --touch             emulate a touch device
 *   --ready=__SN_READY  window flag to wait for (default __SN_READY)
 *   --advance=1500      pause the loop, then simulate this many ms before the shot
 *   --step=16.67        slice size for --advance
 *   --eval="code"       JS run in the page before --advance (may be async; `await` allowed)
 *   --after="code"      JS run in the page after --advance, before the shot
 *   --script=file.cjs   module.exports = async (page, { shot, advance }) => { ... } for multi-shot scenarios
 *   --timeout=60000     ms to wait for the ready flag
 *
 * Console errors and page errors are printed; exit code 2 if any occurred.
 */
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const pos = args.filter((a) => !a.startsWith('--'));
const opt = Object.fromEntries(
  args.filter((a) => a.startsWith('--')).map((a) => {
    const i = a.indexOf('=');
    return i < 0 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
  }),
);
if (pos.length < 1) {
  console.error('usage: node tools/shot.cjs <url> [out.png] [--size=WxH] [--mobile] [--advance=ms] [--eval=js] [--script=file.cjs]');
  process.exit(1);
}
const url = pos[0];
const out = pos[1];
if (opt.mobile) {
  opt.size = opt.size || '390x844';
  opt.dpr = opt.dpr || '2';
  opt.touch = true;
}
const [w, h] = String(opt.size || '1280x800').split('x').map(Number);

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: Number(opt.dpr || 1),
    hasTouch: !!opt.touch,
    isMobile: !!opt.touch,
  });
  const page = await context.newPage();
  let errors = 0;
  page.on('console', (m) => {
    if (m.type() === 'error') {
      errors++;
      console.error('[console.error]', m.text());
    } else if (opt.verbose) console.log(`[console.${m.type()}]`, m.text());
  });
  page.on('pageerror', (e) => {
    errors++;
    console.error('[pageerror]', e.message);
  });

  await page.goto(url, { waitUntil: 'load' });
  const ready = String(opt.ready || '__SN_READY');
  await page.waitForFunction((k) => window[k] === true, ready, { timeout: Number(opt.timeout || 60000) });

  const advance = async (ms, step) => {
    await page.evaluate(
      async ([ms, step]) => {
        window.__SN.pause();
        await window.__SN.advance(ms, step);
      },
      [ms, step || Number(opt.step || 1000 / 60)],
    );
  };
  const shot = async (file) => {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    await page.screenshot({ path: file });
    console.log('saved', file);
  };

  if (opt.script) {
    const fn = require(path.resolve(String(opt.script)));
    await fn(page, { shot, advance, opt });
  } else {
    if (opt.eval) await page.evaluate(`(async () => { ${opt.eval} })()`);
    if (opt.advance) await advance(Number(opt.advance));
    if (opt.after) await page.evaluate(`(async () => { ${opt.after} })()`);
    if (out) await shot(out);
  }
  await browser.close();
  process.exit(errors ? 2 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
