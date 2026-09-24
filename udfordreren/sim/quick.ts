// Hurtig rytmetest under udvikling (fase 1-2). Kører N seeds med den balancerede bot.
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import type { GameState, Vertical } from '../src/sim/types';
import { aarFor } from '../src/sim/time';
import { spillerKunderTotal } from '../src/sim/customers';
import { balanceretBot } from './bots/balanced';
import { pauserFor } from '../src/sim/signals';

const N = Number(process.argv[2] ?? 20);
const AAR = Number(process.argv[3] ?? 2020);
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const pct = (xs: boolean[]) => Math.round((100 * xs.filter(Boolean).length) / xs.length);

const res: Record<string, number[]> = {};
const add = (k: string, v: number | undefined) => { (res[k] ??= []).push(v ?? NaN); };
const flags: Record<string, boolean[]> = {};
const addF = (k: string, v: boolean) => { (flags[k] ??= []).push(v); };
const perAar: Record<number, { kap: number[]; kunder: number[]; andel: number[]; staff: number[]; total: number[]; launches: number[]; dl1: boolean[]; pauser: number[] }> = {};

for (let seed = 1; seed <= N; seed++) {
  const v: Vertical = seed % 2 ? 'betting' : 'kasino';
  const s: GameState = newGame({ seed, firmaNavn: 'Bot', stiftere: v === 'betting' ? ['oddssaetteren', 'udvikleren'] : ['kasinodesigneren', 'udvikleren'], startVertikal: v, tutorial: false });
  const slutUge = (AAR - 2012) * 52;
  let launchesAar = 0;
  let pauserAar = 0;
  let totals: number[] = [];
  while (s.uge < slutUge && !s.slut) {
    stepMut(s, balanceretBot.beslut(s));
    { const dlg = new Set(['anmeldelse','galla','kvartal','event','messeVarsel','messe','nr1','top10']); let p = false; for (const sig of s.signaler) if (pauserFor(sig) || (dlg.has(sig.k) && !(sig.k === 'messe' && sig.stoerrelse === 0))) p = true; if (p) pauserAar++; }
    for (const sig of s.signaler) if (sig.k === 'anmeldelse') { launchesAar++; totals.push(s.produkter.find((p) => p.id === sig.productId)!.total40); }
    if (s.uge % 52 === 0) {
      const a = aarFor(s.uge - 1);
      const pa = (perAar[a] ??= { kap: [], kunder: [], andel: [], staff: [], total: [], launches: [], dl1: [], pauser: [] });
      pa.kap.push(s.kapital); pa.kunder.push(spillerKunderTotal(s)); pa.andel.push((s.markeder.dk.andele.spiller ?? 0) * 100); pa.staff.push(s.staff.length);
      pa.total.push(totals.length ? Math.max(...totals) : 0); pa.launches.push(launchesAar);
      const andele = Object.entries(s.markeder.dk.andele).filter(([k]) => k !== 'offshore' && k !== 'oevrige').sort((x, y) => y[1] - x[1]);
      pa.dl1.push(andele[0]?.[0] === 'danskeLykke');
      pa.pauser.push(pauserAar);
      launchesAar = 0; totals = []; pauserAar = 0;
    }
  }
  const m = s.milepaele;
  const y = (w: number | undefined) => (w === undefined ? NaN : 2012 + w / 52);
  add('førsteLancering(uge)', m.foersteLancering); add('førsteTop10(år)', y(m.foersteTop10)); add('guldkupon(år)', y(m.foersteGuldkupon));
  add('hallOfFame(år)', y(m.foersteHallOfFame)); add('nr1Dk(år)', y(m.foersteNr1Dk)); add('gallapris(år)', y(m.foersteGallapris));
  add('kælder(år)', y(m.kaelder)); add('kontor(år)', y(m.kontor)); add('andenVertikal(år)', y(m.andenVertikal)); add('førsteRunde(år)', y(m.foersteRunde));
  addF('konkurs', s.slut?.id === 'konkurs'); addF('gallapris', m.foersteGallapris !== undefined);
}
for (const [k, v] of Object.entries(res)) console.log(k.padEnd(22), 'median', med(v.filter((x) => !Number.isNaN(x))).toFixed(2), ' n=', v.filter((x) => !Number.isNaN(x)).length);
for (const [k, v] of Object.entries(flags)) console.log(k.padEnd(22), pct(v), '%');
console.log('år    kapital  kunder  dk-andel% staff bedste40 lanceringer DL#1% pauser');
for (const [a, p] of Object.entries(perAar)) console.log(a, med(p.kap).toFixed(1).padStart(8), String(Math.round(med(p.kunder))).padStart(7), med(p.andel).toFixed(1).padStart(8), String(med(p.staff)).padStart(5), String(med(p.total)).padStart(8), String(med(p.launches)).padStart(10), String(pct(p.dl1)).padStart(6), String(med(p.pauser)).padStart(6));
