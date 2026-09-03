import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['tools/serve.mjs', '8155'], {stdio:'ignore', cwd:'/home/user/Test/lysbrud'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1400,height:820}, deviceScaleFactor:1});
const errs=[];
p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
await p.goto('http://localhost:8155/index.html',{waitUntil:'networkidle'});
await sleep(1500);
await p.screenshot({path:'/tmp/shots/01-idle.png'});
console.log('boot state:', JSON.stringify(await p.evaluate(()=>window.LYSBRUD? {ok:true, busy:window.LYSBRUD.state.busy, hasBoard:!!window.LYSBRUD.view.board} : {ok:false})));
await p.click('#spin-button').catch(e=>errs.push('click fail: '+e.message));
await sleep(1200); await p.screenshot({path:'/tmp/shots/02-spin.png'});
await sleep(1800); await p.screenshot({path:'/tmp/shots/03-stop.png'});
await sleep(1500); await p.screenshot({path:'/tmp/shots/04-cascade.png'});
await sleep(3000); await p.screenshot({path:'/tmp/shots/05-after.png'});
for (let i=0;i<40;i++){ const busy = await p.evaluate(()=>window.LYSBRUD?.state.busy); if(!busy) break; await sleep(500); }
console.log('after spin:', JSON.stringify(await p.evaluate(()=>({
  bal: document.getElementById('balance-value').textContent,
  win: document.getElementById('win-value').textContent,
  prism: document.getElementById('prism-count').textContent,
  reactor: document.getElementById('reactor-value').textContent,
  hint: document.getElementById('hint').textContent,
}))));
await p.screenshot({path:'/tmp/shots/06-final.png'});
console.log(errs.length ? '\n=== FEJL ===\n'+errs.slice(0,12).join('\n---\n') : '\nNO ERRORS');
await b.close(); srv.kill();
