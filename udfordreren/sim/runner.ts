// Balanceringsharness (spec 8): `npm run sim` kører 6 bots × 200 seeds (+ Passiv til markedskalibrering) parallelt,
// tjekker de 10 assertions og skriver sim/report.md. Afslutter med kode 1, hvis en assertion fejler.
//   npm run sim -- --seeds 40 --workers 4 --no-fail
import { Worker } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { BOT_NAVNE, type BotNavn, type SpilResultat } from './game';
import { SLUT_IDS, SLUTNINGER } from '../src/data/endings';
import { PRODUCT_TYPE_IDS } from '../src/data/productTypes';
import { CHANNEL_IDS } from '../src/data/acquisition';
import { MARKET_IDS } from '../src/data/markets';
import { VERDENSSCENARIER } from '../src/data/ai';

const arg = (navn: string, std: number) => {
  const i = process.argv.indexOf(`--${navn}`);
  return i >= 0 ? Number(process.argv[i + 1]) : std;
};
const SEEDS = arg('seeds', 200);
const PASSIVE = Math.min(SEEDS, arg('passive', 60));
const WORKERS = arg('workers', Math.max(1, cpus().length));
const NO_FAIL = process.argv.includes('--no-fail');

type Opgave = { bot: BotNavn; seed: number };

async function koerAlle(opgaver: Opgave[]): Promise<SpilResultat[]> {
  const res: SpilResultat[] = [];
  let naeste = 0;
  let faerdige = 0;
  const start = Date.now();
  await Promise.all(
    Array.from({ length: Math.min(WORKERS, opgaver.length) }, () => new Promise<void>((ok, fejl) => {
      const w = new Worker(new URL('./worker.mjs', import.meta.url));
      const send = () => {
        if (naeste >= opgaver.length) {
          w.postMessage(null);
          return;
        }
        w.postMessage(opgaver[naeste++]);
      };
      w.on('message', (r: SpilResultat) => {
        res.push(r);
        faerdige += 1;
        if (faerdige % 25 === 0 || faerdige === opgaver.length) {
          process.stdout.write(`\r${faerdige}/${opgaver.length} spil (${Math.round((Date.now() - start) / 1000)} sek.)   `);
        }
        send();
      });
      w.on('error', fejl);
      w.on('exit', () => ok());
      send();
    })),
  );
  process.stdout.write('\n');
  return res;
}

// ---------- Statistik ----------
const median = (xs: number[]) => {
  const a = xs.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : NaN;
};
const andel = (xs: boolean[]) => (xs.length ? xs.filter(Boolean).length / xs.length : 0);
const pct = (x: number) => `${Math.round(x * 100)} %`;
const tal = (x: number, d = 0) => (Number.isFinite(x) ? x.toLocaleString('da-DK', { maximumFractionDigits: d, minimumFractionDigits: d }) : '–');
const sumAar = (r: SpilResultat, fra: number, til: number) => Object.entries(r.bsiPrAar).filter(([a]) => +a >= fra && +a <= til).reduce((x, [, v]) => x + v, 0);

type Tjek = { nr: number; navn: string; ok: boolean; detaljer: string };

function tjek(alle: SpilResultat[], passive: SpilResultat[]): Tjek[] {
  const af = (b: BotNavn) => alle.filter((r) => r.bot === b);
  const bots = BOT_NAVNE.filter((b) => af(b).length);
  const medEm = (b: BotNavn) => median(af(b).map((r) => r.eftermaele));
  const medVaerdi = (b: BotNavn) => median(af(b).map((r) => r.vaerdi));
  const resultater: Tjek[] = [];

  // 1. Grådig: højeste BSI 2012-2020, aldrig højeste eftermæle, bøde i ≥ 60 %
  {
    const bsi = Object.fromEntries(bots.map((b) => [b, median(af(b).map((r) => sumAar(r, 2012, 2020)))]));
    const hoejestBsi = bots.every((b) => b === 'Grådig' || bsi['Grådig'] >= bsi[b]);
    const hoejestEm = bots.some((b) => b !== 'Grådig' && medEm(b) < medEm('Grådig')) && bots.every((b) => b === 'Grådig' || medEm('Grådig') > medEm(b));
    const perSeedEm = af('Grådig').filter((g) => bots.every((b) => b === 'Grådig' || (af(b).find((x) => x.seed === g.seed)?.eftermaele ?? Infinity) < g.eftermaele)).length;
    const boede = andel(af('Grådig').map((r) => r.boeder > 0));
    resultater.push({
      nr: 1, navn: 'Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 %',
      ok: hoejestBsi && !hoejestEm && perSeedEm === 0 && boede >= 0.6,
      detaljer: `BSI 2012-20 (median, mio.): ${bots.map((b) => `${b} ${tal(bsi[b])}`).join(', ')}; højeste eftermæle i ${perSeedEm} seeds; bøde i ${pct(boede)}`,
    });
  }
  // 2. Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 %
  {
    const em = bots.every((b) => b === 'Balanceret' || medEm('Balanceret') >= medEm(b));
    const vaerdier = bots.map((b) => medVaerdi(b)).sort((x, y) => y - x);
    const top2 = medVaerdi('Balanceret') >= vaerdier[1];
    const licens = andel(af('Balanceret').map((r) => r.dkLicens2035));
    resultater.push({
      nr: 2, navn: 'Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 %',
      ok: em && top2 && licens >= 0.85,
      detaljer: `eftermæle ${bots.map((b) => `${b} ${tal(medEm(b), 1)}`).join(', ')}; værdi ${bots.map((b) => `${b} ${tal(medVaerdi(b))}`).join(', ')}; dk-licens ${pct(licens)}`,
    });
  }
  // 3. AI-afviser ≥ 30 % lavere værdi end Balanceret i 2035 i ≥ 70 %
  {
    const par = af('AI-afviser').map((r) => {
      const b = af('Balanceret').find((x) => x.seed === r.seed);
      return b ? r.vaerdi <= b.vaerdi * 0.7 : false;
    });
    resultater.push({ nr: 3, navn: 'AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 %', ok: andel(par) >= 0.7, detaljer: `opfyldt i ${pct(andel(par))}` });
  }
  // 4. AI-hensynsløs: højere BSI 2026-29, lavere eftermæle, påbud i ≥ 60 %
  {
    const bsiH = median(af('AI-hensynsløs').map((r) => sumAar(r, 2026, 2029)));
    const bsiB = median(af('Balanceret').map((r) => sumAar(r, 2026, 2029)));
    const paabud = andel(af('AI-hensynsløs').map((r) => r.paabud > 0));
    resultater.push({
      nr: 4, navn: 'AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 %',
      ok: bsiH > bsiB && medEm('AI-hensynsløs') < medEm('Balanceret') && paabud >= 0.6,
      detaljer: `BSI 2026-29 ${tal(bsiH)} vs. ${tal(bsiB)}; eftermæle ${tal(medEm('AI-hensynsløs'), 1)} vs. ${tal(medEm('Balanceret'), 1)}; påbud ${pct(paabud)}`,
    });
  }
  // 5. Forsigtig overlever i ≥ 70 %, men ligger under Balanceret
  {
    const ov = andel(af('Forsigtig').map((r) => r.overlevede));
    resultater.push({
      nr: 5, navn: 'Forsigtig: overlever i ≥ 70 % og ligger under Balanceret',
      ok: ov >= 0.7 && medVaerdi('Forsigtig') < medVaerdi('Balanceret'),
      detaljer: `overlever ${pct(ov)}; værdi ${tal(medVaerdi('Forsigtig'))} vs. ${tal(medVaerdi('Balanceret'))}`,
    });
  }
  // 6. Balanceret betting- vs. kasinostart inden for ±20 % i median-eftermæle
  {
    const b = median(af('Balanceret').filter((r) => r.vertikal === 'betting').map((r) => r.eftermaele));
    const k = median(af('Balanceret').filter((r) => r.vertikal === 'kasino').map((r) => r.eftermaele));
    resultater.push({ nr: 6, navn: 'Balanceret: betting- og kasinostart inden for ±20 % i eftermæle', ok: Math.abs(b - k) <= 0.2 * Math.max(b, k), detaljer: `betting ${tal(b, 1)}, kasino ${tal(k, 1)}` });
  }
  // 7. Intet dødt indhold, alle udfald dækket
  {
    const typer = new Set(alle.flatMap((r) => r.typerPositive));
    const kanaler = new Set(alle.flatMap((r) => r.kanalerPositive));
    const modeller = new Set(alle.flatMap((r) => r.platformePositive));
    const markeder = new Set(alle.flatMap((r) => r.markederPositive));
    const slut = new Set(alle.map((r) => r.slut));
    const regler: Record<string, number> = {};
    for (const r of alle) for (const [k, v] of Object.entries(r.reaktioner)) regler[k] = (regler[k] ?? 0) + v;
    const scen = new Set(alle.flatMap((r) => r.scenarier));
    const mangler = [
      ...PRODUCT_TYPE_IDS.filter((t) => !typer.has(t)).map((t) => `type ${t}`),
      ...CHANNEL_IDS.filter((k) => !kanaler.has(k)).map((k) => `kanal ${k}`),
      ...(['whiteLabel', 'turnkey', 'hybrid', 'egen'] as const).filter((m) => !modeller.has(m)).map((m) => `platform ${m}`),
      ...MARKET_IDS.filter((m) => !markeder.has(m)).map((m) => `marked ${m}`),
      ...SLUT_IDS.filter((x) => !slut.has(x)).map((x) => `slutning ${x}`),
      ...Object.entries(regler).filter(([, v]) => v < 50).map(([k, v]) => `${k} kun ${v}×`),
      ...VERDENSSCENARIER.filter((v) => !scen.has(v.id)).map((v) => `scenarie ${v.id}`),
    ];
    resultater.push({ nr: 7, navn: 'Intet dødt indhold og alle udfald dækket', ok: mangler.length === 0, detaljer: mangler.length ? `mangler: ${mangler.join(', ')}` : 'alt dækket' });
  }
  // 8. Markedskalibrering (Passiv) + Balanceret dk-andel 2020
  {
    const k = (f: (r: SpilResultat) => number) => median(passive.map(f));
    const dk = k((r) => r.kal.dk2024);
    const se = k((r) => r.kal.se2025);
    const seK = k((r) => r.kal.se2025kasino);
    const seB = k((r) => r.kal.se2025betting);
    const nl = k((r) => r.kal.nl2025);
    const on = k((r) => r.kal.on2025);
    const dkK = k((r) => r.kal.dkKasinoBsi2025);
    const dl = andel(passive.map((r) => r.kal.dlNr1Til2025));
    const andel2020 = median(af('Balanceret').map((r) => r.dkAndel2020));
    const fejl: string[] = [];
    if (dk < 0.88 || dk > 0.93) fejl.push('dk');
    if (se < 0.82 || se > 0.87 || !(seK < seB)) fejl.push('se');
    if (nl < 0.45 || nl > 0.58) fejl.push('nl');
    if (on < 0.82 || on > 0.92) fejl.push('on');
    if (dkK < 3800 || dkK > 4800) fejl.push('dk-kasino');
    if (dl < 0.9) fejl.push('Danske Lykke nr. 1');
    if (andel2020 < 0.03 || andel2020 > 0.15) fejl.push('Balanceret dk-andel 2020');
    resultater.push({
      nr: 8, navn: 'Markedskalibrering', ok: fejl.length === 0,
      detaljer: `dk 2024 ${pct(dk)}, se 2025 ${pct(se)} (kasino ${pct(seK)} < betting ${pct(seB)}), nl ${pct(nl)}, on ${pct(on)}, dk kasino-BSI ${tal(dkK / 1000, 2)} mia., DL nr. 1 ${pct(dl)}, Balanceret dk-andel 2020 ${pct(andel2020)}${fejl.length ? ` — uden for: ${fejl.join(', ')}` : ''}`,
    });
  }
  // 9. Game Dev Story-rytme (Balanceret)
  {
    const b = af('Balanceret');
    const foersteSek = median(b.map((r) => (r.foersteLanceringUge ?? 999) * 3));
    const interval = median(b.map((r) => r.realSek / Math.max(1, r.lanceringer)));
    const top10 = median(b.map((r) => r.foersteTop10 ?? 99));
    const guld = median(b.map((r) => r.foersteGuldkupon ?? 99));
    const nr1 = b.map((r) => r.foersteNr1Dk).filter((x): x is number => x !== null);
    const hof = b.map((r) => r.foersteHof).filter((x): x is number => x !== null);
    const galla = andel(b.map((r) => r.gallapriser > 0));
    const fejl: string[] = [];
    if (foersteSek > 90) fejl.push('første lancering');
    if (interval < 120 || interval > 240) fejl.push('lanceringsinterval');
    if (top10 >= 2014) fejl.push('Top 10');
    if (guld < 2015 || guld >= 2020) fejl.push('Guldkupon');
    if (nr1.some((x) => x < 2016)) fejl.push('nr. 1 før 2016');
    if (hof.some((x) => x < 2018)) fejl.push('Hall of Fame før 2018');
    if (galla < 0.7) fejl.push('gallapris');
    resultater.push({
      nr: 9, navn: 'Game Dev Story-rytme (Balanceret)', ok: fejl.length === 0,
      detaljer: `første lancering ${tal(foersteSek)} sek., interval ${tal(interval)} sek., Top 10 ${tal(top10, 2)}, Guldkupon ${tal(guld, 2)}, tidligste nr. 1 ${tal(Math.min(...nr1), 2)}, tidligste HoF ${tal(Math.min(...hof), 2)}, gallapris ${pct(galla)}${fejl.length ? ` — fejl: ${fejl.join(', ')}` : ''}`,
    });
  }
  // 10. Pacing (Balanceret): 200-450 pauser, ≥ 40 % i AI-akten
  {
    const b = af('Balanceret').filter((r) => r.slut !== 'konkurs' && r.slut !== 'tabtLicens' && r.slut !== 'exit' && r.slut !== 'danskeLykke' || r.slutAar >= 2035);
    const pauser = median(b.map((r) => r.pauser));
    const akt2 = median(b.map((r) => r.pauserAkt2 / Math.max(1, r.pauser)));
    const tid = median(b.map((r) => r.realSek / 60));
    resultater.push({
      nr: 10, navn: 'Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten', ok: pauser >= 200 && pauser <= 450 && akt2 >= 0.4,
      detaljer: `${tal(pauser)} pauser, ${pct(akt2)} i AI-akten, spilletid ${tal(tid)} min. ved 1x`,
    });
  }
  return resultater;
}

function rapport(alle: SpilResultat[], passive: SpilResultat[], tjeks: Tjek[], sek: number): string {
  const af = (b: BotNavn) => alle.filter((r) => r.bot === b);
  const bots = BOT_NAVNE.filter((b) => af(b).length);
  const linjer: string[] = [];
  linjer.push('# Balanceringsrapport', '');
  linjer.push(`${SEEDS} seeds pr. bot (${bots.length} bots) + ${passive.length} passive seeds til markedskalibrering. Kørt på ${tal(sek)} sek. med ${WORKERS} workers.`, '');
  linjer.push('## Assertions (spec 8)', '', '| # | Assertion | Resultat | Detaljer |', '|---|---|---|---|');
  for (const t of tjeks) linjer.push(`| ${t.nr} | ${t.navn} | ${t.ok ? 'OK' : 'FEJL'} | ${t.detaljer} |`);
  linjer.push('', '## Nøgletal pr. bot (medianer)', '', '| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |', '|---|---|---|---|---|---|---|---|---|');
  for (const b of bots) {
    const r = af(b);
    linjer.push(`| ${b} | ${tal(median(r.map((x) => x.vaerdi)))} | ${tal(median(r.map((x) => x.stifterVaerdi)))} | ${tal(median(r.map((x) => x.eftermaele)), 1)} | ${pct(andel(r.map((x) => x.overlevede)))} | ${pct(andel(r.map((x) => x.boeder > 0)))} | ${pct(andel(r.map((x) => x.paabud > 0)))} | ${pct(andel(r.map((x) => x.dkLicens2035)))} | ${tal(median(r.map((x) => x.pauser)))} |`);
  }
  const aarene = [2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026, 2028, 2030, 2032, 2034];
  linjer.push('', '## BSI pr. år (median, mio. kr.)', '', `| Bot | ${aarene.join(' | ')} |`, `|---|${aarene.map(() => '---').join('|')}|`);
  for (const b of bots) linjer.push(`| ${b} | ${aarene.map((a) => tal(median(af(b).map((r) => r.bsiPrAar[a] ?? 0)))).join(' | ')} |`);
  linjer.push('', '## Selskabsværdi ved årets udgang (median, mio. kr.)', '', `| Bot | ${aarene.join(' | ')} |`, `|---|${aarene.map(() => '---').join('|')}|`);
  for (const b of bots) linjer.push(`| ${b} | ${aarene.map((a) => tal(median(af(b).map((r) => r.vaerdiPrAar[a] ?? 0)))).join(' | ')} |`);
  linjer.push('', '## Slutninger', '', `| Bot | ${SLUT_IDS.map((s) => SLUTNINGER[s].titel).join(' | ')} |`, `|---|${SLUT_IDS.map(() => '---').join('|')}|`);
  for (const b of bots) linjer.push(`| ${b} | ${SLUT_IDS.map((s) => pct(andel(af(b).map((r) => r.slut === s)))).join(' | ')} |`);
  const regler: Record<string, number> = {};
  for (const r of alle) for (const [k, v] of Object.entries(r.reaktioner)) regler[k] = (regler[k] ?? 0) + v;
  linjer.push('', '## Reaktionsregler (antal udløsninger i alt)', '', `| ${Object.keys(regler).join(' | ')} |`, `|${Object.keys(regler).map(() => '---').join('|')}|`, `| ${Object.values(regler).join(' | ')} |`);
  const scen: Record<string, number> = {};
  for (const r of alle) for (const k of r.scenarier) scen[k] = (scen[k] ?? 0) + 1;
  linjer.push('', '## Verdensscenarier (andel af spil, der nåede 2026)', '');
  const naaede = alle.filter((r) => r.slutAar >= 2026).length || 1;
  for (const v of VERDENSSCENARIER) linjer.push(`- ${v.navn}: ${pct((scen[v.id] ?? 0) / naaede)} (forventet ${pct(v.sandsynlighed)})`);
  linjer.push('');
  return linjer.join('\n');
}

async function main(): Promise<void> {
  const start = Date.now();
  const opgaver: Opgave[] = [];
  for (let seed = 1; seed <= SEEDS; seed++) for (const bot of BOT_NAVNE) opgaver.push({ bot, seed });
  for (let seed = 1; seed <= PASSIVE; seed++) opgaver.push({ bot: 'Passiv', seed });
  console.log(`Kører ${opgaver.length} spil med ${WORKERS} workers …`);
  const res = await koerAlle(opgaver);
  const alle = res.filter((r) => r.bot !== 'Passiv');
  const passive = res.filter((r) => r.bot === 'Passiv');
  const tjeks = tjek(alle, passive);
  const sek = (Date.now() - start) / 1000;
  writeFileSync(new URL('./report.md', import.meta.url), rapport(alle, passive, tjeks, sek));
  for (const t of tjeks) console.log(`${t.ok ? 'OK  ' : 'FEJL'} ${t.nr}. ${t.navn}\n     ${t.detaljer}`);
  const fejl = tjeks.filter((t) => !t.ok).length;
  console.log(fejl ? `${fejl} assertion(s) fejlede. Se sim/report.md.` : 'Alle assertions består. Se sim/report.md.');
  if (fejl && !NO_FAIL) process.exit(1);
}

void main();
