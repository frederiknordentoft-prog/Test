import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['tools/serve.mjs','8271'], {stdio:'ignore', cwd:'/home/user/Test/lysbrud'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-background-networking','--no-first-run']});
const p = await b.newPage({viewport:{width:1400,height:820}});
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8271/index.html',{waitUntil:'networkidle'});
await sleep(1200);
await p.evaluate(()=>{ window.LYSBRUD.fx.setAnticipation(true); window.LYSBRUD.view.coreEnergy = 0.9; });
await sleep(600);
await p.screenshot({path:'/tmp/shots/antic-forced.png', clip:{x:200,y:60,width:1200,height:680}});
// og et ringstop-glimt tvunget
await p.evaluate(()=>{ window.LYSBRUD.fx.setAnticipation(false); const L=window.LYSBRUD.wheel.layout; window.LYSBRUD.fx.addRing(L.cx,L.cy,L.ringOut[4]-4,L.ringOut[4]+22,680,'#f7dc8a',3); window.LYSBRUD.fx.addRing(L.cx,L.cy,L.ringOut[2]-4,L.ringOut[2]+22,680,'#f7dc8a',3); });
await sleep(180);
await p.screenshot({path:'/tmp/shots/ringflash-forced.png', clip:{x:200,y:60,width:1200,height:680}});
console.log(errs.length?errs.join('\n'):'no errors');
await b.close(); srv.kill();
