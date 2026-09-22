// Screenshot jobs for the post harness in one browser session.
// Usage: node dev/post-shoot.mjs "name|hash|w|h|dpr" ["name2|hash2|..."]   (port via PORT env, default 5185)
// Writes shots/post-<name>.png and prints { name, probe, errors, ms } per job.
import { chromium } from 'playwright-core';

const port = process.env.PORT ?? '5185';
const page0 = process.env.PAGE ?? 'dev/post.html';
const jobs = process.argv.slice(2).map((s) => {
  const [name, hash = '', w = '390', h = '844', dpr = '2'] = s.split('|');
  return { name, hash, w: +w, h: +h, dpr: +dpr };
});
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
for (const j of jobs) {
  const t0 = Date.now();
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: j.dpr });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/${page0}#${j.hash}`);
  try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 }); } catch (e) { errors.push('timeout waiting for __ready'); }
  const probe = await page.evaluate(() => window.__probe ?? null);
  const out = `shots/post-${j.name}.png`;
  await page.screenshot({ path: out });
  console.log(JSON.stringify({ name: j.name, out, ms: Date.now() - t0, probe, errors }, null, 1));
  await page.close();
}
await browser.close();
