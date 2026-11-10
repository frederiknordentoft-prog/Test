/**
 * Maths CLI: Monte Carlo report and PAR sheet.
 *
 *   node --experimental-strip-types src/math/cli.ts --spins=N --seed=S --policy=greedy|none [--par]
 *
 *   --spins=N      paid spins (default 1 000 000)
 *   --seed=S       first seed (default 1); worker i runs seed S + i
 *   --policy=P     greedy (best nudge every time, default) or none (always pass)
 *   --par          run both policies and write docs/PAR.md
 *   --workers=K    split the run over K processes (default 1)
 *   --model=FILE   JSON with ModelParams fields to override (calibration probes)
 *   --brief        key figures only
 *   --json         raw totals as JSON (what the workers print)
 *
 * Executed by Node directly: explicit .ts extensions, erasable syntax only.
 */
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BET_LEVELS, RINGS, SYMBOLS } from '../core/config.ts';
import { COMET_DEN, PARAMS } from './model.ts';
import type { ModelParams } from './model.ts';
import { finalize, mergeTotals, simulateTotals } from './sim.ts';
import type { SimPolicy, SimResult, SimTotals } from './sim.ts';

interface Args {
  spins: number;
  seed: number;
  policy: SimPolicy;
  par: boolean;
  workers: number;
  model: string | null;
  brief: boolean;
  json: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { spins: 1_000_000, seed: 1, policy: 'greedy', par: false, workers: 1, model: null, brief: false, json: false };
  for (const arg of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(arg);
    if (!m) throw new Error(`unknown argument ${arg}`);
    const v = m[2] ?? '';
    switch (m[1]) {
      case 'spins':
        a.spins = Math.max(1, Math.floor(Number(v.replace(/_/g, ''))));
        break;
      case 'seed':
        a.seed = Number(v) >>> 0;
        break;
      case 'policy':
        if (v !== 'greedy' && v !== 'none') throw new Error('--policy=greedy|none');
        a.policy = v;
        break;
      case 'par':
        a.par = true;
        break;
      case 'workers':
        a.workers = Math.max(1, Math.floor(Number(v)));
        break;
      case 'model':
        a.model = v;
        break;
      case 'brief':
        a.brief = true;
        break;
      case 'json':
        a.json = true;
        break;
      default:
        throw new Error(`unknown argument ${arg}`);
    }
  }
  if (!Number.isFinite(a.spins)) throw new Error('--spins must be a number');
  return a;
}

function loadModel(path: string | null): ModelParams {
  if (!path) return PARAMS;
  return { ...PARAMS, ...(JSON.parse(readFileSync(path, 'utf8')) as Partial<ModelParams>) };
}

const SELF = fileURLToPath(import.meta.url);

function runChild(spins: number, seed: number, policy: SimPolicy, model: string | null): Promise<SimTotals> {
  return new Promise((resolve, reject) => {
    const args = [...process.execArgv, SELF, `--spins=${spins}`, `--seed=${seed}`, `--policy=${policy}`, '--json'];
    if (model) args.push(`--model=${model}`);
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    let text = '';
    child.stdout.on('data', (chunk: Buffer) => {
      text += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`worker exited with ${code}`));
      else resolve(JSON.parse(text) as SimTotals);
    });
  });
}

async function runTotals(a: Args, policy: SimPolicy, model: ModelParams): Promise<SimTotals> {
  if (a.workers <= 1) return simulateTotals({ spins: a.spins, seed: a.seed, policy, model });
  const jobs: Promise<SimTotals>[] = [];
  const share = Math.floor(a.spins / a.workers);
  for (let i = 0; i < a.workers; i++) {
    const part = i === 0 ? a.spins - share * (a.workers - 1) : share;
    jobs.push(runChild(part, (a.seed + i) >>> 0, policy, a.model));
  }
  return mergeTotals(await Promise.all(jobs));
}

// ───────────────────────────── Danish number formats ─────────────────────────────

function num(x: number, digits = 2): string {
  const [whole, frac] = Math.abs(x).toFixed(digits).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (x < 0 ? '−' : '') + grouped + (frac ? ',' + frac : '');
}
const int = (x: number): string => num(Math.round(x), 0);
const pct = (x: number, digits = 2): string => `${num(x * 100, digits)} %`;
const mult = (x: number, digits = 1): string => `${num(x, digits)}×`;
const oneIn = (x: number): string => (x > 0 && Number.isFinite(x) ? `1 ud af ${num(x, x < 100 ? 1 : 0)}` : '–');

/** Figures are right-aligned; `text` tables (prose in the cells) stay left-aligned. */
function table(head: string[], rows: string[][], text = false): string {
  const lines = [`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i === 0 || text ? '---' : '---:')).join('|')}|`];
  for (const r of rows) lines.push(`| ${r.join(' | ')} |`);
  return lines.join('\n');
}

const sameRows = (a: number[][], b: number[][]): boolean => JSON.stringify(a) === JSON.stringify(b);

function weightTable(rows: number[][], skipRing0: boolean): string {
  const head = ['Ring', ...SYMBOLS.slice(0, 9).map((s) => s.name), 'Sum'];
  const body: string[][] = [];
  for (let r = skipRing0 ? 1 : 0; r < RINGS; r++) {
    const total = rows[r].reduce((x, y) => x + y, 0);
    body.push([String(r), ...rows[r].map(String), String(total)]);
  }
  return table(head, body);
}

// ───────────────────────────── Report ─────────────────────────────

function parSheet(p: ModelParams, g: SimResult, none: SimResult | null): string {
  const out: string[] = [];
  const share = (x: number): string => pct(g.rtp > 0 ? x / g.rtp : 0, 1);
  const ladder = p.ladder.map((m) => `×${m}`).join(' · ');
  const bets = `${num(BET_LEVELS[0] / 100, 0)}–${num(BET_LEVELS[BET_LEVELS.length - 1] / 100, 0)} kr.`;

  out.push(`# ${p.name} — PAR-ark`);
  out.push(
    `Model ${p.version}. Alle tal er målt ved Monte Carlo-simulation med motorens egne regler (\`src/math/kernel.ts\`) ` +
      `og kan genskabes med \`npm run sim -- --spins=${g.spins} --seed=${g.seeds[0]} --workers=${g.seeds.length} --par\`. ` +
      'Et "spin" er ét betalt spin inklusive de gratisspil, det udløser. Demo uden rigtige penge.',
  );

  out.push('## 1. Regler i kort form');
  out.push(
    table(
      ['Regel', 'Værdi'],
      [
        ['Bræt', '4 ringe × 8 eger; hver eger er en linje, alle 8 er altid aktive'],
        ['Gevinst', '3 ens (ring 0–2) eller 4 ens læst fra centrum og ud'],
        ['Stella Nova (wild)', 'Erstatter alle symboler undtagen komet; rene wild-linjer betaler som Sol'],
        ['Komet', 'Bryder linjen; højst én pr. ring; splintres aldrig; ingen kometer i genopfyldning'],
        ['Kædereaktion', 'Gevinstceller splintres og genopfyldes, ringene tikker ét hak (+1, −1, +1, −1), multiplikatoren stiger ét trin'],
        ['Multiplikatorstige', `${ladder} (sidste trin gentages)`],
        ['Dit træk', 'Ét pr. spin: drej én ring ét hak. Tilbydes kun, når mindst ét af de 8 træk giver gevinst; fortsætter på samme trin'],
        ['Auto-juster', 'Vælger trækket med størst øjeblikkelig gevinst (lighed: laveste ring, derefter med uret)'],
        ['Stella Nova', `+1 ladning pr. splintret celle; ved ${p.novaThreshold} bliver ring 0 og 1 wild (kometer undtaget); højst én pr. spin`],
        ['Kometnat', `3 kometer = ${p.freeSpinsAward[3]} gratisspil, 4 = ${p.freeSpinsAward[4]}; ring 0 er en krans af wilds; 2 kometer = +${p.retriggerAward[2]}, 3 = +${p.retriggerAward[3]}`],
        ['Loft', `${int(p.maxWinMultiple)}× indsatsen pr. spin`],
        ['Indsats', `${bets}; udbetalinger er hele multipla af 0,1 × indsats`],
      ],
      true,
    ),
  );

  out.push('## 2. Gevinsttabel');
  out.push('Multipla af den samlede indsats, før multiplikator.');
  const payRows: string[][] = [];
  for (let i = 7; i >= 0; i--) payRows.push([SYMBOLS[i].name, mult(p.pay3[i] / 10), mult(p.pay4[i] / 10)]);
  payRows.unshift([`${SYMBOLS[8].name} (kun wilds)`, mult(p.pay3[7] / 10), mult(p.pay4[7] / 10)]);
  out.push(table(['Symbol', '3 ens', '4 ens'], payRows));

  out.push('## 3. Vægte');
  out.push('Hver celle trækkes uafhængigt fra ringens vægte. Derefter kan ringen få sin ene komet på en tilfældig eger.');
  out.push('**Grundspil, første stop' + (sameRows(p.initWeights, p.refillWeights) ? ' og genopfyldning**' : '**'));
  out.push(weightTable(p.initWeights, false));
  if (!sameRows(p.initWeights, p.refillWeights)) {
    out.push('**Grundspil, genopfyldning**');
    out.push(weightTable(p.refillWeights, false));
  }
  const freeSame = sameRows(p.freeInitWeights, p.freeRefillWeights);
  out.push('**Kometnat, første stop' + (freeSame ? ' og genopfyldning** (ring 0 er wild)' : '** (ring 0 er wild)'));
  out.push(weightTable(p.freeInitWeights, true));
  if (!freeSame) {
    out.push('**Kometnat, genopfyldning**');
    out.push(weightTable(p.freeRefillWeights, true));
  }
  out.push('**Kometchance pr. ringstop**');
  const cometRows: string[][] = [];
  for (let r = 0; r < RINGS; r++) {
    cometRows.push([String(r), pct(p.cometChance[r] / COMET_DEN), r === 0 ? '–' : pct(p.freeCometChance[r] / COMET_DEN)]);
  }
  out.push(table(['Ring', 'Grundspil', 'Kometnat'], cometRows));

  out.push('## 4. RTP');
  out.push(
    table(
      ['Kilde', 'RTP-bidrag', 'Andel af RTP'],
      [
        ['Grundlinjer (første stop og dets kæde)', pct(g.breakdown.base, 3), share(g.breakdown.base)],
        ['Dit træk (auto-juster) og kæden derefter', pct(g.breakdown.nudge, 3), share(g.breakdown.nudge)],
        ['Stella Nova og kæden derefter', pct(g.breakdown.nova, 3), share(g.breakdown.nova)],
        ['Kometnat (alle gratisspil)', pct(g.breakdown.freeSpins, 3), share(g.breakdown.freeSpins)],
        ['**RTP med auto-juster**', `**${pct(g.rtp, 3)}**`, '100,0 %'],
        ['RTP uden træk (spilleren springer altid over)', none ? pct(none.rtp, 3) : '–', ''],
      ],
    ),
  );

  out.push('## 5. Træfprocenter');
  out.push(
    table(
      ['Mål', 'Værdi'],
      [
        ['Spins med gevinst (alle gevinster)', pct(g.hitFrequency)],
        ['Spins med gevinst ≥ indsats', pct(g.hitFrequencyAtLeastBet)],
        ['Grundspin med gevinst på eget bræt', pct(g.baseHitFrequency)],
        ['Gevinst allerede på første stop (før træk)', pct(g.initialHitFrequency)],
        ['Spins, hvor et vindende træk tilbydes', pct(g.nudge.offeredShare)],
        ['Gratisspin med gevinst', pct(g.freeSpins.hitFrequency)],
        ['Spins med gevinst uden træk', none ? pct(none.hitFrequency) : '–'],
      ],
    ),
  );

  out.push('## 6. Features');
  const fs = g.freeSpins;
  out.push(
    table(
      ['Feature', 'Værdi'],
      [
        ['Kometnat udløses', oneIn(fs.every)],
        ['– med 3 kometer / 4 kometer', `${int(fs.triggers3)} / ${int(fs.triggers4)}`],
        ['Gratisspil pr. runde (inkl. ekstra spins)', num(fs.avgSpinsPerRound, 2)],
        ['Gennemsnitlig gevinst pr. Kometnat', mult(fs.avgRoundMultiple, 2)],
        ['Standardafvigelse pr. Kometnat', mult(fs.roundStdDev, 1)],
        ['Største Kometnat', mult(fs.maxRoundMultiple)],
        ['Ekstra spins: 2 kometer / 3 kometer', `${oneIn(fs.spinsPlayed / Math.max(1, fs.retriggers2))} / ${oneIn(fs.spinsPlayed / Math.max(1, fs.retriggers3))} gratisspin`],
        ['Stella Nova i grundspillet', oneIn(g.nova.every)],
        ['Stella Nova inkl. Kometnat', oneIn(g.nova.everyAll)],
        ['Gennemsnitlig gevinst efter en Nova (grundspil)', mult(g.nova.avgMultiple, 2)],
        ['Splintrede celler pr. spin', num(g.avgBurstPerSpin, 2)],
        ['Spins standset af loftet', int(g.cappedSpins)],
      ],
    ),
  );
  out.push('**Kædelængde** (antal evalueringer med gevinst i et grundspin)');
  out.push(
    table(
      ['Evalueringer', ...g.chainBase.map((_, i) => (i === 7 ? '7+' : String(i)))],
      [['Andel af spins', ...g.chainBase.map((c) => pct(c / Math.max(1, g.spins), c / Math.max(1, g.spins) < 0.001 ? 4 : 2))]],
    ),
  );

  out.push('## 7. Gevinstfordeling');
  out.push(
    table(
      ['Gevinst pr. spin', 'Antal', 'Andel af spins', 'Hyppighed', 'RTP-bidrag'],
      g.buckets.map((b) => [b.label, int(b.count), pct(b.share, b.share < 0.001 ? 5 : 3), b.count > 0 ? oneIn(1 / b.share) : '–', pct(b.rtp, 3)]),
    ),
  );

  out.push('## 8. Linjegevinster pr. symbol');
  const lineRows: string[][] = [];
  for (let sym = 8; sym >= 0; sym--) {
    const l3 = g.lines[sym];
    const l4 = g.lines[9 + sym];
    lineRows.push([sym === 8 ? `${SYMBOLS[8].name} (kun wilds)` : SYMBOLS[sym].name, oneIn(l3.every), pct(l3.rtp, 3), oneIn(l4.every), pct(l4.rtp, 3)]);
  }
  out.push(table(['Symbol', '3 ens', 'RTP 3 ens', '4 ens', 'RTP 4 ens'], lineRows));
  out.push('Hyppighed pr. betalt spin, RTP inklusive multiplikator og gratisspil.');

  out.push('## 9. Spredning og stikprøve');
  out.push(
    table(
      ['Størrelse', 'Værdi'],
      [
        ['Standardafvigelse pr. spin', `${num(g.stdDev, 2)} indsatser`],
        ['Varians', num(g.variance, 1)],
        ['Største observerede gevinst', mult(g.maxMultiple)],
        ['Stikprøve (auto-juster)', `${int(g.spins)} spins, seeds ${g.seeds.join(', ')}`],
        ['Standardfejl på RTP', `${num(g.standardError * 100, 3)} procentpoint`],
        ['95 % konfidensinterval', `${pct(g.ci95[0], 2)} – ${pct(g.ci95[1], 2)}`],
        ['RTP uden træk', none ? `${pct(none.rtp, 3)} (± ${num(none.standardError * 100, 3)} procentpoint, ${int(none.spins)} spins)` : '–'],
        ['Standardafvigelse uden træk', none ? `${num(none.stdDev, 2)} indsatser` : '–'],
      ],
    ),
  );
  return out.join('\n\n') + '\n';
}

function brief(r: SimResult): string {
  const b = r.breakdown;
  const f = (x: number, d = 2): string => (x * 100).toFixed(d);
  return [
    `[${r.policy}] spins ${r.spins}  RTP ${f(r.rtp, 3)}% ±${f(r.standardError, 3)}  (base ${f(b.base)} nudge ${f(b.nudge)} nova ${f(b.nova)} free ${f(b.freeSpins)} = ${f(b.freeSpins / r.rtp, 1)}% of RTP)`,
    `  hit ${f(r.hitFrequency)}%  >=bet ${f(r.hitFrequencyAtLeastBet)}%  first-stop ${f(r.initialHitFrequency)}%  offered ${f(r.nudge.offeredShare)}%  sd ${r.stdDev.toFixed(2)}  max ${r.maxMultiple}x  capped ${r.cappedSpins}`,
    `  free 1/${r.freeSpins.every.toFixed(1)} avg ${r.freeSpins.avgRoundMultiple.toFixed(2)}x sd ${r.freeSpins.roundStdDev.toFixed(1)} spins/round ${r.freeSpins.avgSpinsPerRound.toFixed(2)} hit ${f(r.freeSpins.hitFrequency)}%` +
      `  nova 1/${r.nova.every.toFixed(1)} (all 1/${r.nova.everyAll.toFixed(1)}) avg ${r.nova.avgMultiple.toFixed(2)}x  burst/spin ${r.avgBurstPerSpin.toFixed(3)}  ${(r.spinsPerSecond / 1e6).toFixed(2)} M/s`,
    `  chain ${r.chainBase.map((c) => f(c / r.spins, 2)).join(' ')}  lines3/4 rtp ${r.lines.map((l) => f(l.rtp, 1)).join(' ')}`,
  ].join('\n');
}

function statsBlock(g: SimResult, none: SimResult | null): string {
  const r = (x: number, d: number): number => Number(x.toFixed(d));
  return [
    'export const STATS: ModelStats = {',
    `  rtp: ${r(g.rtp, 5)},`,
    `  rtpNoNudge: ${none ? r(none.rtp, 5) : 0},`,
    `  hitFrequency: ${r(g.hitFrequency, 4)},`,
    `  hitFrequencyAtLeastBet: ${r(g.hitFrequencyAtLeastBet, 4)},`,
    `  stdDev: ${r(g.stdDev, 2)},`,
    `  freeSpinsEvery: ${r(g.freeSpins.every, 1)},`,
    `  novaEvery: ${r(g.nova.everyAll, 1)},`,
    `  breakdown: { base: ${r(g.breakdown.base, 5)}, nudge: ${r(g.breakdown.nudge, 5)}, nova: ${r(g.breakdown.nova, 5)}, freeSpins: ${r(g.breakdown.freeSpins, 5)} },`,
    `  sampleSize: ${g.spins},`,
    `  maxObservedMultiple: ${g.maxMultiple},`,
    '};',
  ].join('\n');
}

async function main(): Promise<void> {
  const a = parseArgs(process.argv.slice(2));
  const model = loadModel(a.model);
  if (a.json) {
    process.stdout.write(JSON.stringify(simulateTotals({ spins: a.spins, seed: a.seed, policy: a.policy, model })));
    return;
  }
  if (a.par) {
    const g = finalize(await runTotals(a, 'greedy', model));
    const none = finalize(await runTotals(a, 'none', model));
    const sheet = parSheet(model, g, none);
    writeFileSync(new URL('../../docs/PAR.md', import.meta.url), sheet);
    console.log(a.brief ? `${brief(g)}\n${brief(none)}` : sheet);
    console.log(statsBlock(g, none));
    console.log('\nSkrev docs/PAR.md');
    return;
  }
  const result = finalize(await runTotals(a, a.policy, model));
  console.log(a.brief ? brief(result) : parSheet(model, result, null));
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
