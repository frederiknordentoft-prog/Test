// Monte Carlo RTP check: plays N rounds with basic strategy against the real engine.
// Usage: node tools/rtp.mjs [rounds]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const BJ = require('../src/engine.js');
const N = parseInt(process.argv[2] || '400000', 10);
const g = new BJ.Game({ seed: parseInt(process.argv[3] || '20260901', 10), balance: 1e12 });
const BET = 100;
let wagered = 0, returned = 0, rounds = 0, bj = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const before = g.balance;
  g.addChip(BET);
  g.deal();
  if (g.phase === BJ.PHASE.INSURANCE) g.insurance(false); // basic strategy: never insure
  while (g.phase === BJ.PHASE.PLAYER) {
    const h = g.hands[g.activeHand];
    const a = g.availableActions();
    const s = BJ.basicStrategy(h.cards, g.dealer.cards[0], a);
    if (s === 'split' && a.split) g.split();
    else if (s === 'double' && a.double) g.double();
    else if (s === 'surrender' && a.surrender) g.surrender();
    else if (s === 'hit' && a.hit) g.hit();
    else g.stand();
  }
  const entry = g.history[0];
  wagered += entry.totalBet; returned += entry.payout; rounds++;
  if (entry.outcomes.includes('blackjack')) bj++;
  g.nextRound();
}
const rtp = returned / wagered * 100;
console.log(`rounds ${rounds}  wagered ${wagered}  returned ${returned}`);
console.log(`RTP ${rtp.toFixed(3)} %  house edge ${(100 - rtp).toFixed(3)} %  blackjacks ${(bj / rounds * 100).toFixed(2)} %  (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
