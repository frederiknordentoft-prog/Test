// Markedskalibrering (spec 8, assertion 8) med en passiv bot.
import { newGame } from '../src/sim/init';
import { stepMut } from '../src/sim/step';
import type { GameState, MarketId } from '../src/sim/types';
import { passivBot } from './bots/passive';
import { aarFor } from '../src/sim/time';

const N = Number(process.argv[2] ?? 10);
const maal: Record<string, number[]> = {};
const add = (k: string, v: number) => (maal[k] ??= []).push(v);
for (let seed = 1; seed <= N; seed++) {
  const s: GameState = newGame({ seed, firmaNavn: 'P', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
  s.kapital = 1e6; // undgå konkurs
  while (s.uge < 52 * 14 + 30) {
    stepMut(s, passivBot.beslut(s));
    const aar = aarFor(s.uge);
    if (s.uge % 52 === 26) {
      for (const m of ['dk', 'se', 'nl', 'on', 'uk', 'de', 'us'] as MarketId[]) {
        const ms = s.markeder[m];
        if (!ms.aaben) continue;
        add(`${m} kanal ${aar}`, ms.kanalisering * 100);
        add(`${m} kasino-off ${aar}`, ms.offshore.kasino * 100);
        add(`${m} betting-off ${aar}`, ms.offshore.betting * 100);
      }
      const dk = s.markeder.dk;
      add(`dk kasino-BSI licenseret ${aar}`, (dk.markedsBsiPrUge.kasino * (1 - dk.offshore.kasino) * 52) / 1000);
      const andele = Object.entries(dk.andele).filter(([k]) => k !== 'offshore' && k !== 'oevrige').sort((a, b) => b[1] - a[1]);
      add(`dk nr1=DL ${aar}`, andele[0]?.[0] === 'danskeLykke' ? 100 : 0);
    }
  }
}
const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const k of Object.keys(maal).sort()) if (/2012|2016|2020|2024|2025/.test(k)) console.log(k.padEnd(34), med(maal[k]).toFixed(1));
