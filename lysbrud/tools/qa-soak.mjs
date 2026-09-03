/* Langtidstest: mange spins i træk, måler fejl, hukommelse og billedrate. */
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['tools/serve.mjs','8191'], {stdio:'ignore', cwd:'/home/user/Test/lysbrud'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--enable-precise-memory-info','--disable-background-networking','--disable-component-update','--disable-sync','--no-first-run','--disable-features=Translate,OptimizationHints,MediaRouter']});
const p = await b.newPage({viewport:{width:1400,height:820}});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
await p.addInitScript(()=>window.addEventListener('unhandledrejection',e=>console.error('UNHANDLED: '+(e.reason&&e.reason.stack||e.reason))));
await p.goto('http://localhost:8191/index.html',{waitUntil:'networkidle'});
await sleep(1500);
await p.evaluate(()=>{ document.getElementById('set-turbo').click(); });
// mål billedrate i hvile
await p.evaluate(()=>{ window.__f=0; const t=()=>{window.__f++;requestAnimationFrame(t)}; requestAnimationFrame(t); });
await sleep(2000);
const idleFps = await p.evaluate(()=>{const f=window.__f; window.__f=0; return f/2;});
const mem0 = await p.evaluate(()=>performance.memory ? performance.memory.usedJSHeapSize : 0);
await p.evaluate(()=>window.LYSBRUD.startAuto(30));
let spins=0, guard=0;
while (guard++ < 500) {
  await sleep(1000);
  const st = await p.evaluate(()=>({busy:window.LYSBRUD.state.busy, left:window.LYSBRUD.state.autoLeft, bal:document.getElementById('balance-value').textContent}));
  if (!st.busy && st.left === 0) { spins = 30; break; }
}
const fps = await p.evaluate(()=>{const f=window.__f; window.__f=0; return f;});
await sleep(2000);
const fpsIdle2 = await p.evaluate(()=>window.__f/2);
const mem1 = await p.evaluate(()=>performance.memory ? performance.memory.usedJSHeapSize : 0);
const final = await p.evaluate(()=>({
  bal: document.getElementById('balance-value').textContent,
  hint: document.getElementById('hint').textContent,
  spinLabel: document.getElementById('spin-label').textContent,
  disabled: document.getElementById('spin-button').disabled,
}));
console.log('idle fps         ', idleFps.toFixed(0));
console.log('fps efter serie  ', fpsIdle2.toFixed(0));
console.log('heap før/efter   ', (mem0/1048576).toFixed(1)+' MB → '+(mem1/1048576).toFixed(1)+' MB');
console.log('sluttilstand     ', JSON.stringify(final));
console.log(errs.length ? 'FEJL:\n'+errs.slice(0,10).join('\n') : 'NO ERRORS over hele serien');
await p.screenshot({path:'/tmp/shots/soak-final.png'});
await b.close(); srv.kill();
