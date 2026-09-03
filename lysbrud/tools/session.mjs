/* Spiller en hel demo-session igennem i Node — præcis samme rækkefølge af kald
   som main.js laver — og skriver ud hvad spilleren ville se.
   Fanger tempo-problemer uden at skulle sidde og klikke.

   node tools/session.mjs [--spins 30] [--bet 25] [--seed 7] [--raw]         */

import {
  BONUS, PRISM_TARGET, REACTOR_STEPS, SYMBOLS, SYMBOL_BY_ID, WIN_TIERS, START_BALANCE, kr,
} from '../src/config.js';
import { makeRng, pickWeighted } from '../src/rng.js';
import { createDirector } from '../src/director.js';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i < 0 ? d : process.argv[i + 1]; };
const SPINS = Number(arg('spins', 30));
const BET = Number(arg('bet', 25));
const SEED = Number(arg('seed', 7));
const RAW = process.argv.includes('--raw');

const rng = makeRng(SEED);
const director = createDirector(rng, { scripted: !RAW });

function tierOf(mult) {
  let t = null;
  for (const w of WIN_TIERS) if (mult >= w.at) t = w;
  return t;
}

function pickBonusColour() {
  const w = {};
  for (const s of SYMBOLS) if (s.tier >= BONUS.wildColorMinTier) w[s.id] = 1 + (SYMBOLS.length - s.tier) * 0.35;
  return pickWeighted(rng, w);
}

let balance = START_BALANCE, charge = 0, spinIndex = 0;
let staked = 0, returned = 0, bonusCount = 0, biggest = 0;
const log = [];

function line(s) { log.push(s); }

for (let n = 1; n <= SPINS; n++) {
  balance -= BET; staked += BET;
  const r = director.nextSpin({
    bet: BET, spinIndex: spinIndex++, prismCharge: charge,
    inBonus: false, wildColor: null, balance,
  });

  const cascades = r.steps.length - 1;
  const mult = r.totalWin / BET;
  const before = charge;
  charge = Math.min(PRISM_TARGET, charge + r.prismHits);
  balance += r.totalWin; returned += r.totalWin;
  biggest = Math.max(biggest, r.totalWin);

  const tier = tierOf(mult);
  const anticip = before === PRISM_TARGET - 1 && r.prismHits > 0;
  line(
    `${String(n).padStart(3)}  ${cascades} kask  ` +
    `${(r.totalWin ? kr(r.totalWin) : '—').padStart(14)}  ` +
    `${(mult ? mult.toFixed(1) + '×' : '').padStart(8)}  ` +
    `prisme ${before}→${charge}${r.prismHits ? ` (+${r.prismHits})` : ''}` +
    `${anticip ? '  ⚡ANTICIPATION' : ''}` +
    `${tier ? '  ★ ' + tier.label : ''}`
  );

  if (charge >= PRISM_TARGET) {
    bonusCount++;
    const colour = pickBonusColour();
    line(`     ┌─ PRISME-BONUS — kernen vælger ${SYMBOL_BY_ID[colour].name.toUpperCase()}`);
    let step = 0, total = 0, left = BONUS.freeSpins, guard = 0;
    while (left > 0 && guard++ < 40) {
      left--;
      const b = director.nextSpin({
        bet: BET, spinIndex: spinIndex++, prismCharge: 0,
        inBonus: true, wildColor: colour, balance, startStep: step,
      });
      total += b.totalWin; step = b.endStep;
      const shown = BONUS.steps[Math.min(BONUS.steps.length - 1, step)];
      if (b.prismHits >= 3) { left += BONUS.retriggerSpins; }
      line(`     │  gratisspin, ${b.steps.length - 1} kask, ${kr(b.totalWin).padStart(14)}` +
           `  →  reaktor ${shown}×  (${left} tilbage)${b.prismHits >= 3 ? '  +' + BONUS.retriggerSpins : ''}`);
    }
    balance += total; returned += total;
    biggest = Math.max(biggest, total);
    const bt = tierOf(total / BET);
    line(`     └─ bonus i alt ${kr(total)}  (${(total / BET).toFixed(0)}× indsats)${bt ? '  ★ ' + bt.label : ''}`);
    charge = 0;
  }
}

console.log(`LYSBRUD demo-session — ${SPINS} spins à ${kr(BET)}, ${RAW ? 'RÅ RNG' : 'instrueret'}, frø ${SEED}\n`);
console.log(log.join('\n'));
console.log(`\nSaldo ${kr(START_BALANCE)} → ${kr(balance)}`);
console.log(`Indsat ${kr(staked)}, retur ${kr(returned)} (${(returned / staked * 100).toFixed(0)} %)`);
console.log(`Bonusrunder: ${bonusCount}. Største enkeltgevinst: ${kr(biggest)} (${(biggest / BET).toFixed(0)}× indsats)`);
