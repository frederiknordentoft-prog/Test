import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import { balanceretBot } from './bots/balanced';
import { aarFor } from '../src/sim/time';
const seed = Number(process.argv[2] ?? 3);
const s = newGame({ seed, firmaNavn: 'B', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
while (s.uge < 52 * 9) {
  stepMut(s, balanceretBot.beslut(s));
  if (s.uge % 104 === 0) {
    console.log('==', aarFor(s.uge), 'kunder', Math.round(s.markeder.dk.spillerKunder.betting), Math.round(s.markeder.dk.spillerKunder.kasino), 'mkt', JSON.stringify(s.marketingMix), 'regnskab', JSON.stringify(Object.fromEntries(Object.entries(s.regnskab).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))));
    for (const e of s.markeder.dk.top10) { const p = s.produkter.find((x) => x.id === e.productId)!; console.log(String(e.placering).padStart(2), p.ejer.padEnd(12), p.navn.padEnd(28), p.typeId.padEnd(16), (p.bsiPrUge.dk ?? 0).toFixed(2), 'q', p.kvalitet.toFixed(2), 'alder', s.uge - p.lanceretUge); }
  }
}
console.log('--- spillerens aktive produkter');
for (const p of s.produkter.filter((x) => x.ejer === 'spiller' && x.aktiv)) console.log(p.navn.padEnd(26), p.typeId.padEnd(16), (p.bsiPrUge.dk ?? 0).toFixed(2), 'q', p.kvalitet.toFixed(2), 'total', p.total40, 'alder', s.uge - p.lanceretUge);
