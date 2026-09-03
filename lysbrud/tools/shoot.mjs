/* Skærmbillede-harness for LYSBRUD.
   node tools/shoot.mjs [--w 1672] [--h 941] [--out ../shots] [--spins 3] [--turbo]
   Fanger konsolfejl, JS-undtagelser og en serie skærmbilleder gennem et spin. */

import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i < 0) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const W = Number(arg('w', 1672));
const H = Number(arg('h', 941));
const OUT = String(arg('out', '/tmp/lysbrud-shots'));
const SPINS = Number(arg('spins', 2));
const PORT = Number(arg('port', 8123));
const TAG = String(arg('tag', 'run'));

await mkdir(OUT, { recursive: true });

const server = spawn('node', [new URL('serve.mjs', import.meta.url).pathname, String(PORT)], { stdio: 'ignore' });
await sleep(700);

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb', '--font-render-hinting=none'],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

const errors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`));
page.on('requestfailed', r => errors.push(`[requestfailed] ${r.url()} — ${r.failure()?.errorText}`));

const shot = async name => {
  await page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
  return `${OUT}/${TAG}-${name}.png`;
};

try {
  await page.goto(`http://localhost:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(1400);
  await shot('01-idle');

  // Modaler
  await page.click('#btn-info').catch(() => {});
  await sleep(700); await shot('02-info');
  await page.keyboard.press('Escape'); await sleep(400);
  await page.click('#btn-settings').catch(() => {});
  await sleep(500); await shot('03-settings');
  await page.keyboard.press('Escape'); await sleep(400);

  for (let s = 0; s < SPINS; s++) {
    await page.click('#spin-button').catch(() => {});
    await sleep(600);  await shot(`s${s}-a-spinning`);
    await sleep(1400); await shot(`s${s}-b-stopping`);
    await sleep(900);  await shot(`s${s}-c-evaluate`);
    await sleep(1200); await shot(`s${s}-d-cascade`);
    await sleep(2200); await shot(`s${s}-e-after`);
    // Vent til knappen er klar igen
    for (let k = 0; k < 60; k++) {
      const busy = await page.evaluate(() => !!(window.LYSBRUD && window.LYSBRUD.state.busy)).catch(() => false);
      if (!busy) break;
      await sleep(500);
      if (k === 20) await shot(`s${s}-f-long`);
    }
    await sleep(300);
  }

  // Responsive tjek
  for (const [w, h, name] of [[1280, 860, 'r-1280'], [1024, 800, 'r-1024'], [860, 780, 'r-860'], [520, 900, 'r-520'], [390, 844, 'r-390']]) {
    await page.setViewportSize({ width: w, height: h });
    await sleep(900);
    await shot(name);
  }

  const metrics = await page.evaluate(() => ({
    balance: document.getElementById('balance-value')?.textContent,
    win: document.getElementById('win-value')?.textContent,
    prism: document.getElementById('prism-count')?.textContent,
    reactor: document.getElementById('reactor-value')?.textContent,
    hasCanvas: !!document.getElementById('game-canvas')?.width,
    scrollX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  })).catch(e => ({ evalError: String(e) }));

  await writeFile(`${OUT}/${TAG}-report.json`, JSON.stringify({ errors, metrics }, null, 2));
  console.log(JSON.stringify({ errors: errors.slice(0, 40), metrics }, null, 2));
} catch (e) {
  console.log('FATAL: ' + e.message);
  await writeFile(`${OUT}/${TAG}-report.json`, JSON.stringify({ fatal: String(e), errors }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
