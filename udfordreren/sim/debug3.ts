import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import { balanceretBot } from './bots/balanced';
import { aarFor } from '../src/sim/time';
const seed = Number(process.argv[2] ?? 3);
const s = newGame({ seed, firmaNavn: 'B', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
const vis = (label: string) => {
  console.log('==', label, aarFor(s.uge), 'uge', s.uge, 'kunder', Math.round(s.markeder.dk.spillerKunder.betting), Math.round(s.markeder.dk.spillerKunder.kasino), 'andele', JSON.stringify(Object.fromEntries(Object.entries(s.markeder.dk.andele).map(([k, v]) => [k, Math.round(v * 1000) / 10]))));
  for (const e of s.markeder.dk.top10) { const p = s.produkter.find((x) => x.id === e.productId)!; console.log(String(e.placering).padStart(2), p.ejer.padEnd(12), p.navn.padEnd(26), p.typeId.padEnd(16), 'nye', Math.round(p.nyeSpillerePrUge?.dk ?? 0), 'bsi', (p.bsiPrUge.dk ?? 0).toFixed(2), 'tot', p.total40, 'alder', s.uge - p.lanceretUge); }
};
while (s.uge < 52 * 8) {
  stepMut(s, balanceretBot.beslut(s));
  for (const sig of s.signaler) if (sig.k === 'lanceret' && aarFor(s.uge) <= 2014) {
    const p = s.produkter.find((x) => x.id === sig.productId)!;
    console.log('LANCERING', aarFor(s.uge), s.uge, p.navn, p.total40, 'pulje', Math.round(p.ventendeSpillere?.dk ?? 0), 'hype', Math.round(s.hype));
  }
  if (s.uge === 60 || s.uge === 300 || s.uge === 400) vis('uge');
}
