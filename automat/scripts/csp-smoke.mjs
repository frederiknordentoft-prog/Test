// Strict-CSP smoke of the single-file Artifact build (brief §8 "Audio and artifact").
// Usage: npm run build:artifact && node scripts/csp-smoke.mjs [hashes=terning,solstorm,1948] [file=dist/nordlys.html]
// Wraps the Artifact body the way the claude.ai frame does (its own skeleton + a strict CSP: no 'unsafe-eval', no
// hosts, blob:/data: only) and runs each deep link in real time (no QA stepping) on a fresh profile at 390×844:
//   #terning   the demo die must reach its Kvit eller dobbelt card; after the arm time the smoke presses
//              __slot.choose('double') and the throw must run to its result and back to idle;
//   #solstorm  the demo storm must reach its spins (the smoke presses start/continue) and end back in idle;
//   #1948      the demo gate ceremony must run past 15 s of its score.
// Every page error, console error or CSP violation is reported, and so is every localStorage write to
// 'terningen.v1' (every one of these flows is a demo: zero writes). Exit code 1 on any error, write or missed milestone.
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [hashArg = 'terning,solstorm,1948', file = 'dist/nordlys.html'] = process.argv.slice(2);
const hashes = hashArg.split(',').filter(Boolean);
const KEY = 'terningen.v1';
const CSP = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src data: blob:; worker-src blob:";

const body = readFileSync(file, 'utf8');
const dir = mkdtempSync(join(tmpdir(), 'csp-smoke-'));
const page = join(dir, 'wrapped.html');
writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}">`
  + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  + '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui;background:#fafaf7}img{max-width:100%}[hidden]{display:none!important}</style>'
  + `</head><body>${body}</body></html>`);

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let failed = false;

for (const hash of hashes) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message ?? e).slice(0, 200)));
  p.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy|Refused to/.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
  await ctx.addInitScript((key) => {
    const set = Storage.prototype.setItem;
    window.__diceWrites = 0;
    Storage.prototype.setItem = function (k, v) { if (k === key) window.__diceWrites++; return set.call(this, k, v); };
  }, KEY);
  const T0 = Date.now();
  const secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
  const ev = (f, a) => p.evaluate(f, a);
  const seen = [];
  let milestone = false, note = '';
  try {
    await p.goto('file://' + page + '#' + hash);
    await p.waitForFunction(() => window.__slot, null, { timeout: 90000 });
    await sleep(3000);
    await p.click('#unlockBtn', { timeout: 30000 });
    let chose = false, sawThrow = false;
    const t0 = Date.now(), budget = hash === 'solstorm' ? 900000 : 240000; // real time under SwiftShader (a storm's spins keep their 3,0 s floor)
    while (Date.now() - t0 < budget) {
      const st = await ev(() => window.__slot.state());
      if (seen[seen.length - 1] !== st) { seen.push(st); console.log(`${hash} · ${secs()} · ${st}`); }
      if (hash === 'terning') {
        const run = await ev(() => window.__slot.gambleRun());
        if (st === 'gambleOffer' && run?.phase === 'offer' && run.armed && !chose) {
          if (!run.demo) { note = 'the card is not a demo'; break; }
          await ev(() => window.__slot.choose('double'));
          chose = true;
          console.log(`${hash} · ${secs()} · choose('double')`);
        }
        if (chose && run && (run.phase === 'throw' || run.phase === 'result' || run.phase === 'settle')) sawThrow = true;
        if (chose && run?.pip) note = `pip ${run.pip} → ${run.payout} (demo)`;
        if (chose && sawThrow && st === 'idle') { milestone = true; break; }
      } else if (hash === 'solstorm') {
        if (st === 'stormReady') await ev(() => window.__slot.startStorm());
        if (st === 'stormSummary') await ev(() => window.__slot.cont());
        if (st === 'idle' && seen.includes('stormSpinning')) { milestone = true; break; }
      } else if (hash === '1948') {
        const t = await ev(() => window.__slot.gate?.()?.t ?? 0);
        if (st === 'ceremony' && t > 15) { milestone = true; note = `ceremony at ${t.toFixed(1)} s`; break; }
      } else { milestone = true; await sleep(8000); break; }
      await sleep(500);
    }
    await sleep(1500);
  } catch (e) {
    errors.push('smoke: ' + String(e.message ?? e).slice(0, 200));
  }
  const writes = await ev(() => window.__diceWrites ?? 0).catch(() => -1);
  const ok = milestone && errors.length === 0 && writes === 0;
  if (!ok) failed = true;
  const r = { hash, ok, milestone, note, seconds: Math.round((Date.now() - T0) / 1000), states: seen, diceWrites: writes, errors: errors.slice(0, 8) };
  results.push(r);
  console.log(`${ok ? 'PASS' : 'FAIL'}  #${hash}  · ${milestone ? 'milestone reached' : 'MILESTONE MISSED'} · ${writes} writes to ${KEY} · ${errors.length} errors${note ? ' · ' + note : ''}`);
  for (const e of errors.slice(0, 8)) console.log('   ' + e);
  await ctx.close();
}
await browser.close();
rmSync(dir, { recursive: true, force: true });
console.log(JSON.stringify(results, null, 1));
console.log(failed ? 'CSP smoke: FAILED' : `CSP smoke: all ${hashes.length} passed`);
process.exit(failed ? 1 : 0);
