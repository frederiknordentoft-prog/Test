// Integration smoke: run the real game (#autostart[_solstorm]) and sample the audio engine state.
import { chromium } from 'playwright-core';
const hash = process.argv[2] ?? 'autostart';
const secs = +(process.argv[3] ?? 14);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--autoplay-policy=no-user-gesture-required', '--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(`http://127.0.0.1:5184/#${hash}`);
const samples = [];
for (let s = 0; s < secs; s++) {
  await page.waitForTimeout(1000);
  samples.push(await page.evaluate(() => {
    const a = window.__slot?.world?.audio;
    if (!a) return null;
    const st = a.stats();
    const p = a.position();
    return `${st.state} r${st.rendered}/${st.total} v${st.voices} base:${st.base}/L${st.layers} storm:${st.storm}×${st.stormX}${p ? ` ${p.kind}@${p.bar}.${p.beat}` : ''} now=${a.now().toFixed(2)}`;
  }));
}
console.log(samples.map((s, i) => `${i + 1}s ${s}`).join('\n'));
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await browser.close();
