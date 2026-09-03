import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
const srv = spawn('node', ['tools/serve.mjs','8181'], {stdio:'ignore', cwd:'/home/user/Test/lysbrud'});
await sleep(800);
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:1400,height:820}});
const errs=[]; p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message+'\n'+(e.stack||'').split('\n').slice(1,4).join('\n')));
p.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE: '+m.text())});
await p.addInitScript(()=>window.addEventListener('unhandledrejection',e=>console.error('UNHANDLED: '+(e.reason&&e.reason.stack||e.reason))));
await p.goto('http://localhost:8181/index.html',{waitUntil:'networkidle'});
await sleep(1200);
// turbo, så bonussen nås hurtigt
await p.evaluate(()=>{ document.getElementById('set-turbo').click(); });
let shot=0;
const snap = async n => p.screenshot({path:`/tmp/shots/bonus-${String(++shot).padStart(2,'0')}-${n}.png`});
for (let spin=0; spin<14; spin++) {
  await p.evaluate(()=>window.LYSBRUD.spin());
  // vent til travlheden er ovre, men fang bonus-overlayet hvis det dukker op
  for (let k=0;k<160;k++){
    await sleep(250);
    const st = await p.evaluate(()=>({
      busy: window.LYSBRUD.state.busy,
      inBonus: window.LYSBRUD.state.inBonus,
      intro: document.getElementById('bonusbox').classList.contains('is-on'),
      winOn: document.getElementById('winbox').classList.contains('is-on'),
      tier: document.getElementById('winbox-tier').textContent,
      amount: document.getElementById('winbox-amount').textContent,
    }));
    if (st.intro && shot<1) { await snap('intro'); await p.click('#bonusbox-start').catch(()=>{}); }
    if (st.inBonus && shot>=1 && shot<4) await snap('runde');
    if (st.winOn && st.tier) { await snap('win-'+st.tier.replace(/[^A-Za-zÆØÅæøå]/g,'')); console.log('GEVINST:', st.tier, st.amount); }
    if (!st.busy) break;
  }
  const ch = await p.evaluate(()=>document.getElementById('prism-count').textContent);
  console.log(`spin ${spin+1}: prisme ${ch}/5`);
  if (shot > 6) break;
}
console.log(errs.length ? '\nFEJL:\n'+errs.slice(0,8).join('\n---\n') : '\nNO ERRORS');
await b.close(); srv.kill();
