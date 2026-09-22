// Diagnostic: which work produces main-thread long tasks during the post-unlock render pipeline?
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5184/dev/audio.html');
await page.waitForFunction(() => window.__audioDev);
const r = await page.evaluate(async () => {
  const { GameAudio, RENDER_STATS } = window.__audioDev;
  const tasks = [];
  const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) tasks.push([Math.round(e.startTime), Math.round(e.duration)]); });
  po.observe({ type: 'longtask' });
  const g = new GameAudio();
  const t0 = performance.now();
  const done = [];
  const seen = new Set();
  await g.unlock();
  done.push(['unlock', Math.round(performance.now())]);
  while (g.stats().rendered < g.stats().total) {
    for (const [id] of RENDER_STATS) if (!seen.has(id) && g.asset(id)) { seen.add(id); done.push([id, Math.round(performance.now()), Math.round(RENDER_STATS.get(id).build), Math.round(RENDER_STATS.get(id).post)]); }
    await new Promise((r) => setTimeout(r, 2));
  }
  await new Promise((r) => setTimeout(r, 200));
  po.disconnect();
  return { t0: Math.round(t0), tasks, done };
});
console.log('long tasks [start, dur]:', JSON.stringify(r.tasks));
for (const [s, d] of r.tasks) {
  const near = r.done.filter((x) => x[1] >= s && x[1] <= s + d + 30).map((x) => x.join(':'));
  console.log(`task @${s - r.t0} ms (${d} ms) → assets completing: ${near.join(', ')}`);
}
await browser.close();
