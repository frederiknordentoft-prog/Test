import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['tools/serve.mjs','8193'], {stdio:'ignore', cwd:'/home/user/Test/lysbrud'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run']});
// referencemåling: tom side i samme browser
const ref = await b.newPage({viewport:{width:1400,height:820}});
await ref.setContent('<body style="background:#000"></body>');
await ref.evaluate(()=>{window.__f=0;const t=()=>{window.__f++;requestAnimationFrame(t)};requestAnimationFrame(t)});
await sleep(3000);
console.log('tom side, fps:', ((await ref.evaluate(()=>window.__f))/3).toFixed(0));
await ref.close();

const p = await b.newPage({viewport:{width:1400,height:820}});
await p.goto('http://localhost:8193/index.html',{waitUntil:'networkidle'});
await sleep(1500);
// mål hvor lang tid selve tegningen tager
await p.evaluate(()=>{
  window.__t=[]; window.__f=0;
  const raf = window.requestAnimationFrame.bind(window);
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  let t0=0;
  const tick = () => { window.__f++; raf(tick); };
  raf(tick);
});
await sleep(3000);
console.log('spil i hvile, fps:', ((await p.evaluate(()=>window.__f))/3).toFixed(0));
// mål under spin
await p.evaluate(()=>{ window.__f=0; window.LYSBRUD.spin(); });
await sleep(2500);
console.log('spil under spin, fps:', ((await p.evaluate(()=>window.__f))/2.5).toFixed(0));
// profilér én frame
const cost = await p.evaluate(() => new Promise(res => {
  const samples = [];
  let n = 0;
  const raf = window.requestAnimationFrame.bind(window);
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    samples.push(now - last); last = now;
    if (++n < 90) raf(tick);
    else { samples.sort((a,b)=>a-b); res({ median: samples[45], p90: samples[81], min: samples[0] }); }
  };
  raf(tick);
}));
console.log('frame-interval  median', cost.median.toFixed(1)+'ms  p90', cost.p90.toFixed(1)+'ms  min', cost.min.toFixed(1)+'ms');
await b.close(); srv.kill();
