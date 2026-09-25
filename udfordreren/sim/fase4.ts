// Fase 4-gate: udløses bonuskrig (R1), kopiering (R3) og opkøbstilbud (R2) før 2020 i bot-kørsler? Og hvor ofte alle regler.
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import type { GameState, ReaktionsRegel, Vertical } from '../src/sim/types';
import { balanceretBot } from './bots/balanced';

const N = Number(process.argv[2] ?? 20);
const AAR = Number(process.argv[3] ?? 2020);
const foerste: Record<string, number[]> = {};
const total: Record<string, number> = {};
const platforme: Record<string, number> = {};
let b2b = 0;
for (let seed = 1; seed <= N; seed++) {
  const v: Vertical = seed % 2 ? 'betting' : 'kasino';
  const s: GameState = newGame({ seed, firmaNavn: 'Bot', stiftere: v === 'betting' ? ['oddssaetteren', 'udvikleren'] : ['kasinodesigneren', 'udvikleren'], startVertikal: v, tutorial: false });
  const set = new Set<string>();
  while (s.uge < (AAR - 2012) * 52 && !s.slut) {
    const foer = { ...s.reaktionsTaeller };
    stepMut(s, balanceretBot.beslut(s));
    for (const r of Object.keys(s.reaktionsTaeller) as ReaktionsRegel[]) {
      if (s.reaktionsTaeller[r] > (foer[r] ?? 0) && !set.has(r)) { set.add(r); (foerste[r] ??= []).push(2012 + s.uge / 52); }
    }
  }
  for (const [r, n] of Object.entries(s.reaktionsTaeller)) total[r] = (total[r] ?? 0) + n;
  for (const k of ['kontoplatform', 'sportsbook', 'kasinoplatform'] as const) platforme[`${k}:${s.platforme[k].model}`] = (platforme[`${k}:${s.platforme[k].model}`] ?? 0) + 1;
  b2b += s.platforme.sportsbook.b2bKunder + s.platforme.kasinoplatform.b2bKunder;
  if (s.slut) console.log('seed', seed, 'slut', s.slut.id, 2012 + s.uge / 52);
}
const med = (xs: number[]) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
console.log(`regel  seeds-med  første(median)  total  (til ${AAR}, ${N} seeds)`);
for (const r of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'R11', 'R12']) {
  const f = foerste[r] ?? [];
  console.log(r.padEnd(5), String(f.length).padStart(9), (f.length ? med(f).toFixed(2) : '-').padStart(15), String(total[r] ?? 0).padStart(7));
}
console.log('platforme ved slut:', platforme, 'B2B-kunder i alt:', b2b);
