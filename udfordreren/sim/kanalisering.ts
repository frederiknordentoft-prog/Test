// Måler kanaliseringen (median) i årets sidste uge pr. marked over nogle seeds (hjælpescript til kalibrering af OFFSHORE_BASIS)
import { newGame } from '../src/sim/init';
import { applyActionMut } from '../src/sim/actions';
import { stepMut } from '../src/sim/step';
import { makeRng } from '../src/sim/rng';
import { aarFor, ugeIAar, SIDSTE_UGE } from '../src/sim/time';
import type { MarketId } from '../src/sim/types';
import { lavBotAf, type BotNavn } from './game';

const navn = (process.argv[2] ?? 'Passiv') as BotNavn;
const seeds = Number(process.argv[3] ?? 6);
// Brug: npx tsx sim/kanalisering.ts [bot] [seeds] [markeder, fx dk,se]
const M: MarketId[] = (process.argv[4] ?? 'dk,uk,se,nl').split(',') as MarketId[];
const sum: Record<string, Record<number, number[]>> = Object.fromEntries(M.map((m) => [m, {}]));
for (let seed = 1; seed <= seeds; seed++) {
  const s = newGame({ seed, firmaNavn: 'Bot', stiftere: ['oddssaetteren', 'udvikleren'], startVertikal: 'betting', tutorial: false });
  const bot = lavBotAf(navn, seed);
  while (!s.slut && s.uge < SIDSTE_UGE) {
    if (navn === 'Passiv') { s.kapital = Math.max(s.kapital, 5); s.negativUger = 0; }
    for (const a of bot.beslut(s)) applyActionMut(s, makeRng(s.rngState), a);
    stepMut(s, []);
    if (ugeIAar(s.uge) !== 51) continue; // årets sidste uge (som harnessets kalibrering)
    for (const m of M) if (s.markeder[m].aaben) (sum[m][aarFor(s.uge)] ??= []).push(s.markeder[m].kanalisering);
  }
}
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const m of M) {
  const aar = Object.keys(sum[m]).map(Number).sort();
  console.log(m, aar.map((a) => `${a}:${(median(sum[m][a]) * 100).toFixed(1)}`).join(' '));
}
