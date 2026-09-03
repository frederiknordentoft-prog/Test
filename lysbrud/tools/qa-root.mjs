import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['/home/user/Test/lysbrud/tools/serve.mjs','8201','/home/user/Test'], {stdio:'ignore'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox','--disable-background-networking','--no-first-run']});
const p = await b.newPage({viewport:{width:1200,height:900}});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message)); p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
await p.goto('http://localhost:8201/index.html',{waitUntil:'networkidle'});
await sleep(2500);
console.log('el-dashboard titel:', await p.title());
await p.screenshot({path:'/tmp/shots/root-dashboard.png'});
console.log(errs.length ? errs.slice(0,5).join('\n') : 'rod-dashboard: NO ERRORS');
// og lysbrud via undermappe
await p.goto('http://localhost:8201/lysbrud/index.html',{waitUntil:'networkidle'});
await sleep(2000);
console.log('lysbrud titel:', await p.title(), '| board:', await p.evaluate(()=>!!window.LYSBRUD?.view.board));
await b.close(); srv.kill();
