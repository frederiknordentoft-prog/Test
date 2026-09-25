// Grep-tjek (spec 12): rigtige firmanavne må kun stå i src/data/archive.ts.
// Søger i hele src/ uden forskel på store og små bogstaver og fejler ved første træffer.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const rod = fileURLToPath(new URL('..', import.meta.url));
const NAVNE = [
  'Danske Spil', 'bet365', 'Unibet', 'Kindred', 'Betsson', 'NordicBet', 'LeoVegas', 'Betano', 'Mr Green', 'ComeOn', 'Bet25',
  'Tivoli Casino', 'Svenska Spel', 'ATG', 'Flutter', 'Paddy Power', 'Betfair', 'Sky Bet', 'Entain', 'Ladbrokes', 'Coral', 'bwin',
  'BetCity', 'William Hill', 'evoke', '888', 'Betfred', 'Holland Casino', 'Jacks', 'Tipico', 'Interwetten', 'Veikkaus',
  'Norsk Tipping', 'FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Fanatics', 'theScore', 'ESPN', 'Kalshi', 'Polymarket', 'Stake',
  'Kambi', 'Evolution', 'NetEnt', 'FDJ', 'MGM', 'PokerStars',
];
const UNDTAGET = join('src', 'data', 'archive.ts');

function filer(dir) {
  return readdirSync(dir).flatMap((navn) => {
    const sti = join(dir, navn);
    return statSync(sti).isDirectory() ? filer(sti) : [sti];
  });
}

const fund = [];
for (const fil of filer(join(rod, 'src'))) {
  const rel = relative(rod, fil);
  if (rel === UNDTAGET) continue;
  const linjer = readFileSync(fil, 'utf8').split('\n');
  linjer.forEach((linje, i) => {
    const lav = linje.toLowerCase();
    for (const n of NAVNE) if (lav.includes(n.toLowerCase())) fund.push(`${rel}:${i + 1}: "${n}" i: ${linje.trim().slice(0, 120)}`);
  });
}

if (fund.length) {
  console.error(`Grep-tjek fejlede: ${fund.length} træffer på rigtige firmanavne uden for src/data/archive.ts\n${fund.join('\n')}`);
  process.exit(1);
}
console.log('Grep-tjek OK: ingen rigtige firmanavne uden for src/data/archive.ts.');
