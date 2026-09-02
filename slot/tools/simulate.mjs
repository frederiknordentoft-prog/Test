// Monte Carlo RTP / hit-rate check for the demo math. Run: node slot/tools/simulate.mjs [spins]
// Last result (3M spins): RTP 96.16% (base 74.2%, free 22.0%), hit rate 36.1%, bonus 1 in 131, max 475× bet.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const M = require('../js/math.js');

const N = parseInt(process.argv[2] || '2000000', 10);
const BET = 20;
const game = M.createGame({ seed: 12345 });
let wagered = 0, paidBase = 0, paidFree = 0, hits = 0, bonuses = 0, freeSpinsPlayed = 0, maxWin = 0;
const tiers = { win: 0, big: 0, mega: 0, epic: 0 };
for (let i = 0; i < N; i++) {
  wagered += BET;
  const s = game.spin(BET);
  const r = s.result;
  if (r.total > 0) { hits++; tiers[M.winTier(r.total, BET)]++; }
  paidBase += r.total;
  maxWin = Math.max(maxWin, r.total);
  if (r.freeSpins) {
    bonuses++;
    let left = r.freeSpins;
    while (left > 0) {
      left--; freeSpinsPlayed++;
      const f = game.spin(BET, { inFreeSpins: true });
      paidFree += f.result.total;
      maxWin = Math.max(maxWin, f.result.total);
      if (f.result.freeSpins) left += f.result.freeSpins;
    }
  }
}
const fmt = (x) => (100 * x).toFixed(2) + '%';
console.log(`spins ${N}`);
console.log(`RTP total  ${fmt((paidBase + paidFree) / wagered)}  (base ${fmt(paidBase / wagered)}, free ${fmt(paidFree / wagered)})`);
console.log(`hit rate   ${fmt(hits / N)}  | bonus 1 in ${(N / bonuses).toFixed(0)} spins, avg free spins/bonus ${(freeSpinsPlayed / bonuses).toFixed(1)}`);
console.log(`tiers      win ${fmt(tiers.win / N)} big ${fmt(tiers.big / N)} mega ${fmt(tiers.mega / N)} epic ${fmt(tiers.epic / N)}`);
console.log(`max win    ${(maxWin / BET).toFixed(0)}× bet`);
console.log(`strip lengths ${M.BASE_STRIPS.map(s => s.length).join(',')}`);
