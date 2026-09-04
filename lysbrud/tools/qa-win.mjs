/* Fotograferer lysbruddet: forhåndsviser en gevinst på et givet multiplum
   og tager billeder gennem hele sekvensen.  node tools/qa-win.mjs [--mult 120] */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const MULT = Number(arg('mult', 120));
const OUT = String(arg('out', '/tmp/shots'));
const srv = spawn('node', ['tools/serve.mjs', '8211'], { stdio: 'ignore', cwd: '/home/user/Test/lysbrud' });
await sleep(800);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-background-networking', '--no-first-run'] });
const p = await b.newPage({ viewport: { width: 1400, height: 820 } });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message + '\n' + (e.stack || '').split('\n').slice(1, 4).join('\n')));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
await p.addInitScript(() => window.addEventListener('unhandledrejection', e => console.error('UNHANDLED: ' + (e.reason && e.reason.stack || e.reason))));
await p.goto('http://localhost:8211/index.html', { waitUntil: 'networkidle' });
await sleep(1400);
await p.screenshot({ path: `${OUT}/win-00-idle.png` });
await p.evaluate(m => { window.LYSBRUD.previewWin(m); }, MULT);
for (const t of [120, 320, 650, 1100, 1800, 2800]) {
  await sleep(t === 120 ? 120 : t - prevT(t));
  await p.screenshot({ path: `${OUT}/win-${String(t).padStart(4, '0')}.png` });
}
function prevT(t) { const L = [120, 320, 650, 1100, 1800, 2800]; return L[L.indexOf(t) - 1]; }
// vent til den er færdig
for (let k = 0; k < 40; k++) { if (!(await p.evaluate(() => window.LYSBRUD.state.busy))) break; await sleep(300); }
await p.screenshot({ path: `${OUT}/win-99-after.png` });
console.log(errs.length ? errs.slice(0, 8).join('\n---\n') : 'NO ERRORS');
await b.close(); srv.kill();
