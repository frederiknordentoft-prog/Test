// Fase 5-tjek: kør Balanceret til 2035 og vis AI-aktens nøgletal pr. år.
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import type { GameState, Vertical } from '../src/sim/types';
import { aarFor } from '../src/sim/time';
import { spillerKunderTotal } from '../src/sim/customers';
import { risikoAndel } from '../src/sim/town';
import { balanceretBot } from './bots/balanced';
import { pauserFor } from '../src/sim/signals';

const N = Number(process.argv[2] ?? 6);
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const rows: Record<number, { kap: number[]; bsi: number[]; kunder: number[]; risiko: number[]; agenter: number[]; staff: number[]; tillid: number[]; pauser: number[]; events: number[] }> = {};
const scen: Record<string, number> = {};
const slut: Record<string, number> = {};
for (let seed = 1; seed <= N; seed++) {
  const v: Vertical = seed % 2 ? 'betting' : 'kasino';
  const s: GameState = newGame({ seed, firmaNavn: 'Bot', stiftere: v === 'betting' ? ['oddssaetteren', 'udvikleren'] : ['kasinodesigneren', 'udvikleren'], startVertikal: v, tutorial: false });
  let pauser = 0; let events = 0;
  while (!s.slut) {
    stepMut(s, balanceretBot.beslut(s));
    for (const sig of s.signaler) { if (pauserFor(sig)) { pauser++; break; } }
    events += s.signaler.filter((x) => x.k === 'event').length;
    if (s.uge % 52 === 0) {
      const a = aarFor(s.uge - 1);
      const r = (rows[a] ??= { kap: [], bsi: [], kunder: [], risiko: [], agenter: [], staff: [], tillid: [], pauser: [], events: [] });
      r.kap.push(s.kapital); r.bsi.push(s.regnskab.bsi * 52); r.kunder.push(spillerKunderTotal(s)); r.risiko.push((risikoAndel(s) ?? 0) * 100);
      r.agenter.push(s.agenter.length); r.staff.push(s.staff.length); r.tillid.push(s.markeder.dk.tilsynstillid); r.pauser.push(pauser); r.events.push(events);
      pauser = 0; events = 0;
    }
  }
  for (const k of Object.keys(s.verdensscenarier)) scen[k] = (scen[k] ?? 0) + 1;
  slut[s.slut!.id] = (slut[s.slut!.id] ?? 0) + 1;
  if (Number.isNaN(s.kapital)) console.log('NaN kapital seed', seed);
}
console.log('år   kapital    BSI/år   kunder  risiko%  agenter staff dk-tillid pauser events');
for (const [a, r] of Object.entries(rows)) console.log(a, med(r.kap).toFixed(0).padStart(9), med(r.bsi).toFixed(0).padStart(9), String(Math.round(med(r.kunder))).padStart(8), med(r.risiko).toFixed(1).padStart(7), String(med(r.agenter)).padStart(7), String(med(r.staff)).padStart(5), med(r.tillid).toFixed(0).padStart(8), String(med(r.pauser)).padStart(6), String(med(r.events)).padStart(6));
console.log('scenarier:', scen, 'slut:', slut);
