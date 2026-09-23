// Writes sim/REPORT.md — the Danish par sheet — from the verification JSON built by sim/run.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MathConfig, MathReport } from '../src/math/config.ts';
import { SYM_NAMES } from '../src/math/types.ts';
import { TIERS } from '../src/game/tiers.ts';
import { BUCKET_LABELS } from '../src/math/grid.ts';

// Loose shape of the JSON written by run.ts (kept structural on purpose — the md is a view of the json).
// `node sim/report.ts` re-renders REPORT.md (and the gates) from sim/report.json without re-simulating.
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface Gate { name: string; req: string; value: string; pass: boolean; note?: string }
type Json = {
  report: MathReport; config: MathConfig; gates: Gate[];
  seeds: Record<string, number>; samples: Record<string, number | boolean>; elapsedS: number;
  decomposition: any; storms: any; e2e: any; adversary: any[]; variants: any[]; tuning: any;
  e2eSupplement?: any[]; e2ePooled?: { rtp: number; se: number; samples: number; storms: number; z: number };
  dice?: any;
};

const dk = (x: number, d = 2): string => x.toFixed(d).replace('.', ',');
const pct = (x: number, d = 2): string => dk(x * 100, d) + ' %';
const int = (x: number): string => Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const odds = (r: number): string => '1:' + int(1 / r);
const xx = (x: number): string => (x >= 100 ? int(x) : x >= 10 ? dk(x, 1) : dk(x, 2)) + '×';
const kr = (ore: number): string => dk(ore / 100, 2) + ' kr';
const payX = (v: number): string => (Number.isInteger(v) ? String(v) : dk(v, 1));

const Z = 1.959964;

/** The PLAN §5 gates, computed from the verification JSON (single source for run.ts and re-rendering). */
export function buildGates(j: Json): Gate[] {
  const R = j.report, D = j.decomposition, S = j.storms, E = j.e2e;
  const best = j.adversary.reduce((a: any, c: any) => (c.rtp > a.rtp ? c : a));
  const seRtp = D.seRtp, rtp = R.rtp;
  return [
    { name: 'Samlet RTP', req: '96,00 ± 0,10 %', value: `${pct(rtp, 3)} (95 %-CI ± ${pct(Z * seRtp, 3)})`, pass: Math.abs(rtp - 0.96) <= 0.001 },
    { name: 'Basisspil (klynger + sole)', req: '79–81 %', value: pct(R.baseSpinRtp, 2), pass: R.baseSpinRtp >= 0.79 && R.baseSpinRtp <= 0.81 },
    { name: 'Minimum-RTP uden gemt fremskridt (basis + rute B)', req: '≥ 86 %', value: `${pct(R.rtpMin, 2)} ± ${pct(Z * D.seMin, 2)}`, pass: R.rtpMin >= 0.86 },
    { name: 'Målerafhængig andel', req: '≤ 10 pp', value: dk((rtp - R.rtpMin) * 100) + ' pp', pass: rtp - R.rtpMin <= 0.1 },
    { name: 'Net-win (T > indsats)', req: '≥ 25 % af betalte spil', value: pct(R.netWinRate, 2), pass: R.netWinRate >= 0.25 },
    { name: 'Hitrate (T > 0)', req: '≥ 43 %', value: pct(R.hitRate, 2), pass: R.hitRate >= 0.43 },
    { name: 'LDW-andel af hits (0 < T < indsats)', req: '≤ 45 %', value: pct(R.ldwShareOfHits, 2), pass: R.ldwShareOfHits <= 0.45 },
    { name: 'Solstorm samlet', req: '1:1.100–1:1.600', value: odds(R.stormRate), pass: 1 / R.stormRate >= 1100 && 1 / R.stormRate <= 1600 },
    { name: '· rute A (Kp 9)', req: '≈ 1:2.200', value: odds(R.routeARate), pass: Math.abs(1 / R.routeARate / 2200 - 1) < 0.05 },
    { name: '· rute B (4+ sole)', req: '≈ 1:3.300', value: odds(R.routeBRate), pass: Math.abs(1 / R.routeBRate / 3300 - 1) < 0.05 },
    { name: 'Storm, gennemsnit E[S]', req: '180–230×', value: `${dk(S.ES, 1)}× ± ${dk(Z * S.seES, 1)}`, pass: S.ES >= 180 && S.ES <= 230 },
    { name: 'Storm P10 (før garanti)', req: '≥ 15×', value: `${dk(R.stormP10X, 1)}×`, pass: R.stormP10X >= 15 },
    { name: 'Garanti brugt', req: '≤ 20 % af storme', value: pct(S.guarUse, 2), pass: S.guarUse <= 0.2 },
    { name: 'Garantiens pris', req: '≤ 5 % af E[S]', value: pct(S.guarCost, 2), pass: S.guarCost <= 0.05 },
    { name: 'Max-win cap ramt', req: '≤ 1 pr. 10⁴ storme', value: `${S.capped} af ${int(S.n)} (${dk(S.capRate * 1e4, 2)} pr. 10⁴)`, pass: S.capRate <= 1e-4 },
    { name: 'Kp-tiers inden for 150 spil (median)', req: '≥ 3', value: `${D.tiersBy150Median} (≥ 3 for ${pct(D.tiersBy150AtLeast3, 1)} af spillerne)`, pass: D.tiersBy150Median >= 3 },
    { name: 'Stake-switch adversary', req: 'edge ≤ 0', value: `max RTP ${pct(best.rtp, 2)} ± ${pct(Z * best.se, 2)} (${best.strategy})`, pass: j.adversary.every((a: any) => a.rtp + Z * a.se < 1) },
    j.e2ePooled
      ? { name: 'E2E-krydstjek', req: 'afvigelse ≤ 1,96·√(SE²+SE²)', value: `${pct(j.e2ePooled.rtp, 3)} ± ${pct(Z * j.e2ePooled.se, 3)} (${j.e2ePooled.samples} stikprøver, ${int(j.e2ePooled.storms)} storme) vs ${pct(rtp, 3)}; z = ${dk(j.e2ePooled.z, 2)}`, pass: Math.abs(j.e2ePooled.z) <= Z }
      : { name: 'E2E-krydstjek', req: 'afvigelse ≤ 1,96·√(SE²+SE²)', value: `${pct(E.rtpCycles, 3)} ± ${pct(Z * E.seCycles, 3)} vs ${pct(rtp, 3)}; z = ${dk((E.rtpCycles - rtp) / Math.sqrt(E.seCycles ** 2 + seRtp ** 2), 2)}`, pass: Math.abs(E.rtpCycles - rtp) <= Z * Math.sqrt(E.seCycles ** 2 + seRtp ** 2) },
  ];
}

/** §14 Terningen: the REPORT dice fields and the renewal-CLT cross-check (status only — no effect on any value above). */
function writeDiceMd(j: Json, p: (s?: string) => void): void {
  const R = j.report, D = j.dice, E = D.e2e;
  const r100 = (x: number) => int(Math.round(x / 100) * 100);
  p('## 14. Terningen (1948)');
  p();
  p(`Et spin giver én terning, når spinnets egen gevinst er mindst 10× den indsats, det er afgjort ved: almindelige spin ved indsatsen, Ladede spin ved den låste indsats, hvert stormspin ved stormens indsats. Stormgarantien er ikke et spin. Terningerne ændrer ingen gevinst, sandsynlighed eller RTP. Kørsel: ${D.mode ?? 'sim/run.ts'}${D.generatedAt ? ' · ' + D.generatedAt : ''}.`);
  p();
  p('| Felt | Værdi | Kilde |');
  p('|---|---:|---|');
  p(`| diceRate · terning pr. betalt spin (inkl. Ladede spin og stormspin) | ${pct(R.diceRate, 3)} · 1 pr. ${dk(1 / R.diceRate, 1)} | e2e, ${int(E.n)} betalte spin (± ${pct(1.96 * E.seRate, 4)}) |`);
  p(`| diceRateBase · kun almindelige og Ladede spin | 1 pr. ${dk(1 / R.diceRateBase, 1)} | e2e (${int(E.diceBase)} + ${int(E.dicePerk)} terninger) |`);
  p(`| diceStormShare · andel fra stormspin | ${pct(R.diceStormShare, 1)} | e2e (${int(E.diceStorm)} terninger) |`);
  p(`| diceP1 · P(betalt spin giver ≥ 1 terning) | ${pct(R.diceP1, 3)} | e2e |`);
  p(`| diceFirstMedian · første terning (median) | ${int(R.diceFirstMedian)} spin | ⌈ln 0,5 / ln(1 − diceP1)⌉ |`);
  p(`| dice1948Spins · betalte spin til 1948 terninger | ${int(R.dice1948Spins)} (P5 ${int(R.dice1948SpinsP5)} · P95 ${int(R.dice1948SpinsP95)}) | ${int(R.diceJourneys)} forløb, SD ${int(D.spinsSd)} |`);
  p(`| Spilletid ved mindst 3,0 s pr. spin | mindst ${int(Math.floor((R.dice1948Spins * 3) / 3600))} timer | |`);
  p(`| dice1948LossX · nettotab undervejs (× indsats) | ${int(R.dice1948LossX)}× (P5 ${int(R.dice1948LossP5X)}× · P95 ${int(R.dice1948LossP95X)}×) | SD ${int(D.lossSd)}× |`);
  p(`| · ved 0,50 kr / 2,00 kr pr. spin | ${r100(R.dice1948LossX * 0.5)} kr / ${r100(R.dice1948LossX * 2)} kr | |`);
  p(`| dice1948LossShare · forløb med nettotab | ${pct(R.dice1948LossShare, 1)} | |`);
  p();
  p(`Fornyelses-CLT (terninger pr. betalt spin som i.i.d. belønninger, μ = ${dk(R.diceRate, 5)}, σ² = ${dk(E.varD, 5)}): E[N] ≈ 1948/μ = ${int(D.clt.mean)}, SD ≈ √(1948·σ²/μ³) = ${int(D.clt.sd)}, 90 % ≈ ${int(D.clt.p5)}–${int(D.clt.p95)}; simuleret ${int(R.dice1948Spins)} (${int(R.dice1948SpinsP5)}–${int(R.dice1948SpinsP95)}), afvigelse ${pct(R.dice1948Spins / D.clt.mean - 1, 2)}. Wald: E[tab] ≈ E[N]·(1 − RTP) = ${int(D.clt.lossWald)}× mod simuleret ${int(R.dice1948LossX)}×.`);
  p();
  p(`Forløbene: friske spillere (tom måler) ved konstant indsats ${kr(D.stake)}, alt inline som e2e; frisk frø 0x${(D.seed >>> 0).toString(16)}, ${int(D.stride)} basisspil-indeks pr. forløb (${int(D.journeysTotals.paid)} betalte spin, ${int(D.journeysTotals.storms)} storme i alt; rate i forløbene 1 pr. ${dk(1 / D.journeyRate, 1)}).`);
  p();
}

/** Markdown table cell: escape pipes. */
const cell = (s: string): string => s.replace(/\|/g, '\\|');

export function writeReportMd(j: Json): void {
  const R = j.report, C = j.config, D = j.decomposition, S = j.storms, E = j.e2e;
  const L: string[] = [];
  const p = (s = '') => L.push(s);
  const failed = j.gates.filter((g) => !g.pass);

  p('# NORDLYS · SOLSTORM G5 — par sheet (matematikrapport)');
  p();
  p(`Model \`${C.modelHash}\` · genereret ${R.generatedAt} · simuleringstid ${int(j.elapsedS)} s på 2 worker-tråde.`);
  p();
  p('Alle tal i denne rapport og i spillets regelskærm kommer fra `sim/report.json` (samme kørsel). Spillepenge; demo.');
  p();
  p('## 1. Resumé');
  p();
  p(`- **Samlet RTP ${pct(R.rtp, 2)}** (95 %-konfidensinterval ± ${pct(R.rtpCi95, 3)}), heraf basisspil ${pct(R.baseSpinRtp)}, Ladede spin ${pct(R.perkRtp)}, Solstorm ${pct(R.stormARtp + R.stormBRtp)}.`);
  p(`- **Minimum-RTP uden gemt fremskridt ${pct(R.rtpMin)}** (basisspil + Solstorm via 4+ sole). Den målerafhængige andel er ${dk((R.rtp - R.rtpMin) * 100)} pp.`);
  p(`- Gevinst over indsatsen i **${pct(R.netWinRate, 1)}** af spillene; gevinst af enhver størrelse i ${pct(R.hitRate, 1)}. ${pct(R.ldwShareOfHits, 1)} af gevinsterne er mindre end indsatsen (vises som "Retur", aldrig som gevinst).`);
  p(`- Solstorm ca. **${odds(R.stormRate)}** betalte spil (Kp 9: ${odds(R.routeARate)}, 4+ sole: ${odds(R.routeBRate)}); gennemsnit ${xx(R.stormMeanX)} indsats, median ${xx(R.stormP50X)}.`);
  p(`- Volatilitet: **lav i basisspillet** (SD ${dk(R.baseSdX)}× pr. spil), **høj i Solstorm** (samlet SD ${dk(R.blendedSdX, 1)}× pr. spil). Max gevinst ${int(C.maxWinX)}× indsats.`);
  p(`- Gates: ${j.gates.length - failed.length} af ${j.gates.length} bestået${failed.length ? ' — se afsnit 12' : ''}.`);
  p();

  p('## 2. Gates');
  p();
  p('| Gate | Krav | Resultat | Status |');
  p('|---|---|---|---|');
  for (const g of j.gates) p(`| ${cell(g.name)} | ${cell(g.req)} | ${cell(g.value)} | ${g.pass ? 'bestået' : '**ikke bestået**'} |`);
  p();

  p('## 3. Spillet kort');
  p();
  p(`- Basisspil ${C.cols}×${C.rows}, Solstorm ${C.stormCols}×${C.stormRows}. Klynger på 5+ ortogonalt forbundne ens symboler betaler. Hver celle er et uafhængigt vægtet træk (ingen hjul-strips).`);
  p('- Isskred: vindende celler knuses, resten falder, nye falder ind ovenfra, indtil der ikke er flere klynger.');
  p('- Nordlysbuen (WILD) indgår i alle klynger, den rører; rene wild-grupper betaler ikke.');
  p(`- Frostmærker ("læsning A"): en klynge ganges med max(1, Σ mærker ≥ ×2 i klyngen) *før* dette trins opgradering; derefter går alle vindende felter ét trin op (0 → frost → ×2 → … → ×${C.baseMarkCap}), vindende wilds to trin. Mærker nulstilles hvert basisspil.`);
  p(`- Solen: kun i første fald, højst én pr. kolonne (p = ${dk(C.pSun, 5)} pr. kolonne). 3 sole = ${C.sunPayX}× indsats + ${C.sunCharge} ladning; 4+ sole = Solstorm (rute B).`);
  p(`- Ladning: lav 1, høj 2, wild 3 pr. knust celle. Kp 9 ved K = ${int(C.K)} ladning (rute A, ved låst indsats = floor(Σ ladning·indsats / Σ ladning)). Kp 3, 5 og 7 giver et Ladet spin (gratis, låst indsats, 4 felter på ×2).`);
  p(`- Solstorm: ${C.stormSpins} spil på ${C.stormCols}×${C.stormRows} med ${C.stormStartMarks} startmærker på ×2, mærker bevares hele stormen (op til ×${C.stormMarkCap}), Stormbølge før hvert 4. spil fordobler alle mærker ≥ ×2, 3+ sole giver +${C.retriggerSpins} spil (højst ${C.maxStormSpins}), gevinster × stormPayScale = ${dk(C.stormPayScale, 4)}, garanti ${C.guaranteeX}× indsats på egen linje.`);
  p();

  p('## 4. Gevinsttabel (× indsats, før mærker)');
  p();
  p(`payScale = ${C.payScale}; tabellen er præcis det, der udbetales. Alle værdier er multipla af 0,1× og dermed hele øre ved alle indsatser (${C.stakesOre.map((s) => kr(s)).join(', ')}).`);
  p();
  p(`| Symbol | ${BUCKET_LABELS.join(' | ')} |`);
  p(`|---|${BUCKET_LABELS.map(() => '---:').join('|')}|`);
  for (let s = 6; s >= 0; s--) p(`| ${SYM_NAMES[s]} | ${C.paytable[s].map((v) => payX(v * C.payScale)).join(' | ')} |`);
  p();
  p(`Mindste gevinst: ${dk(R.minWinX, 1)}× (5 × ${SYM_NAMES[0]}). I Solstorm ganges tabellen med ${dk(C.stormPayScale, 4)} (${dk(C.stormPayScale * 100, 2)} %) før mærker; stormens gevinster afrundes til hele øre pr. klynge (halv op).`);
  p();
  p('### Symbolvægte');
  p();
  const tw = C.weights.reduce((a, b) => a + b, 0), tsw = C.stormWeights.reduce((a, b) => a + b, 0);
  p('| Symbol | Vægt basis | Sandsynlighed | Vægt storm | Sandsynlighed |');
  p('|---|---:|---:|---:|---:|');
  for (let s = 0; s < 8; s++) p(`| ${SYM_NAMES[s]} | ${dk(C.weights[s], s === 7 ? 2 : 0)} | ${pct(C.weights[s] / tw)} | ${dk(C.stormWeights[s], s === 7 ? 2 : 0)} | ${pct(C.stormWeights[s] / tsw)} |`);
  p(`| ${SYM_NAMES[8]} | p = ${dk(C.pSun, 5)} pr. kolonne | P(3) = ${pct(D.p3, 3)}, P(4+) = ${odds(D.pB)} | p = ${dk(C.pSunStorm, 2)} pr. kolonne | |`);
  p();

  p('## 5. RTP-opdeling');
  p();
  p(`Dekomponering pr. betalt spil ved konstant indsats ${kr(D.stake)} (basisspillets gevinster er eksakte multipla af indsatsen, så basis-RTP er ens ved alle indsatser):`);
  p();
  p('| Komponent | RTP | Kilde |');
  p('|---|---:|---|');
  p(`| Klynger (basisspil) | ${pct(R.clusterRtp, 3)} | ${int(D.n)} spil |`);
  p(`| 3 sole (${C.sunPayX}×) | ${pct(R.sunRtp, 3)} | lukket form, P(3 sole) = ${pct(D.p3, 4)} |`);
  p(`| **Basisspil i alt** | **${pct(R.baseSpinRtp, 3)}** | |`);
  p(`| Ladede spin (Kp 3/5/7) | ${pct(R.perkRtp, 3)} | ${dk(D.perkRate * 1000, 3)} pr. 1.000 spil, snit ${xx(D.perkEV)} |`);
  p(`| Solstorm rute A (Kp 9) | ${pct(R.stormARtp, 3)} | r_A = 1/E[N], E[N] = ${dk(D.EN, 1)} spil (${int(D.cycles)} cykler) |`);
  p(`| Solstorm rute B (4+ sole) | ${pct(R.stormBRtp, 3)} | P(4+) lukket form × (1 + Ladede spin) − r_AB |`);
  p(`| **Samlet** | **${pct(R.rtp, 3)}** | ± ${pct(R.rtpCi95, 3)} (95 %, delta-metoden) |`);
  p();
  p(`- Minimum-RTP uden gemt fremskridt (basisspil + rute B fra betalte spil): **${pct(R.rtpMin, 2)}**. Spilles der i sessioner på 300 spil, hvor måleren glemmes, er RTP ${pct(j.adversary.find((a: any) => a.strategy === 'quitEarly')?.rtp ?? NaN, 2)}.`);
  p(`- Målerafhængig andel (Ladede spin + rute A): ${dk((R.rtp - R.rtpMin) * 100)} pp.`);
  p(`- Pr. Solstorm-spil i snit: ${pct(R.perStormSpinRtp, 0)} af indsatsen (${dk(S.avgSpins, 2)} spil pr. storm).`);
  p();

  p('## 6. Frekvenser');
  p();
  p('| Hændelse | Frekvens |');
  p('|---|---:|');
  p(`| Gevinst > indsats (net-win) | ${pct(D.net, 2)} |`);
  p(`| Gevinst = indsats ("Indsats retur") | ${pct(D.push, 2)} |`);
  p(`| 0 < gevinst < indsats ("Retur", LDW) | ${pct(D.ldw, 2)} |`);
  p(`| Enhver gevinst (hitrate) | ${pct(D.hits, 2)} |`);
  p(`| 3 sole | ${pct(D.sun3, 3)} |`);
  p(`| 4+ sole | ${odds(D.pB)} (eksakt; stikprøve ${odds(D.sun4)}) |`);
  p(`| Solstorm i alt | ${odds(R.stormRate)} |`);
  p(`| · rute A (Kp 9, inkl. A+B i samme spil) | ${odds(R.routeARate)} |`);
  p(`| · rute B (4+ sole uden Kp 9) | ${odds(R.routeBRate)} |`);
  p(`| · A og B i samme spil | ${D.rAB > 0 ? odds(D.rAB) : '0'} |`);
  p();
  p(`Ladning: ${dk(D.chargeMean, 3)} pr. spil i snit (SD ${dk(D.chargeSd, 1)}). K = ${int(C.K)}.`);
  p();
  p('### Kp-stigen (median og gennemsnit, betalte spil fra tom måler)');
  p();
  p('| Kp | Andel af K | Ladning | Median spil | Gennemsnit spil | Ændring |');
  p('|---|---:|---:|---:|---:|---|');
  for (let t = 1; t <= 9; t++) p(`| ${t}${TIERS[t].gName ? ' · ' + TIERS[t].gName : ''} | ${pct(TIERS[t].frac, 1)} | ${int(TIERS[t].frac * C.K)} | ${int(R.kpMedianSpins[t - 1])} | ${int(R.kpMeanSpins[t - 1])} | ${TIERS[t].change} |`);
  p();
  p(`Efter 150 spil har medianspilleren krydset **${D.tiersBy150Median} tiers**; ${pct(D.tiersBy150AtLeast3, 1)} har krydset mindst 3.`);
  p();

  p('## 7. Fordeling og volatilitet');
  p();
  p('| Kvantil (basisspil, × indsats) | ' + D.baseQuantiles.map((q: any) => 'P' + dk(q.q * 100, q.q >= 0.999 ? 1 : 0)).join(' | ') + ' |');
  p('|---|' + D.baseQuantiles.map(() => '---:').join('|') + '|');
  p('| | ' + D.baseQuantiles.map((q: any) => (q.x === 0 ? '0' : xx(q.x))).join(' | ') + ' |');
  p();
  p(`- SD pr. basisspil ${dk(R.baseSdX, 3)}×; samlet (inkl. Ladede spin og Solstorm) ${dk(R.blendedSdX, 2)}× (e2e-stikprøve: ${dk(E.sd, 2)}×). P99: basis ${xx(R.baseP99X)}, samlet ${xx(R.blendedP99X)}.`);
  p(`- Største basisgevinst i ${int(D.n)} spil: ${xx(D.maxBaseX)}. Basis-cap ramt ${D.cappedBase} gange.`);
  p('- Volatilitet: **lav i basisspillet, høj i Solstorm.**');
  p();

  p('## 8. Solstorm');
  p();
  p(`${int(S.n)} friske storme ved ${kr(S.stake)}.`);
  p();
  p(`- E[S] = **${xx(S.ES)}** ± ${dk(1.96 * S.seES, 2)} (95 %), heraf garanti ${dk(S.meanG, 3)}× (${pct(S.guarCost, 2)} af E[S]). SD ${xx(S.sdS)}.`);
  p(`- Garantien (${C.guaranteeX}×) bruges i ${pct(S.guarUse, 2)} af stormene. Max-win cap (${int(C.maxWinX)}×) ramt ${S.capped} gange (${dk(S.capRate * 1e4, 2)} pr. 10⁴). Største storm: ${xx(S.maxW)}.`);
  p(`- Gennemsnitligt ${dk(S.avgSpins, 3)} spil pr. storm; retrigger i ${pct(S.retriggerRate, 2)} af stormene.`);
  p();
  p('| Kvantil (W før garanti) | ' + S.quantilesW.map((q: any) => 'P' + (q.q * 100 < 1 ? dk(q.q * 100, 0) : String(+(q.q * 100).toFixed(2)).replace('.', ','))).join(' | ') + ' |');
  p('|---|' + S.quantilesW.map(() => '---:').join('|') + '|');
  p('| | ' + S.quantilesW.map((q: any) => xx(q.x)).join(' | ') + ' |');
  p();
  p('Højeste mærke i stormen: ' + S.maxMarkHist.map((f: number, i: number) => (f > 0 ? `×${2 ** i} ${pct(f, 1)}` : '')).filter(Boolean).join(', ') + '.');
  p();
  p(`Øre-afrunding pr. klynge (samme storme, forskellig indsats): ${S.stakeCheck.map((s: any) => `${kr(s.stakeOre)} → ${dk(s.meanW, 3)}×`).join(', ')}.`);
  p();

  p('## 9. Varianter (kun payScale og stormPayScale ændres)');
  p();
  p('| Mål-RTP | payScale | stormPayScale | Estimeret RTP (denne stikprøve) |');
  p('|---:|---:|---:|---:|');
  for (const v of j.variants) p(`| ${pct(v.rtp, 0)} | ${dk(v.payScale, 5)} | ${dk(v.stormPayScale, 4)} | ${pct(v.estRtp, 2)} |`);
  p();
  p('For 94 %- og 92 %-varianterne er payScale ikke et multiplum af 0,1, så klyngegevinster afrundes til hele øre pr. klynge (halv op), og tabellen i reglerne vises med én decimal. Solen (3×) skaleres ikke.');
  p();

  p('## 10. Stake-switch adversary (låst indsats)');
  p();
  p(`Samme spil (common random numbers) for alle strategier, ${int(j.samples.adv as number)} betalte spil pr. strategi. Estimator med forventningskreditering: hvert betalt spil krediteres (basis-RTP + P(4+ sole)·E[S])·indsats, hvert Ladet spin (E[Ladet spin] + P(4+ sole)·E[S])·låst indsats og hver rute-A-storm E[S]·låst indsats. Det er middelret (indsatsen i spil i afhænger kun af fortiden; spillets udfald er uafhængigt af fortiden) og fjerner næsten al støj fra de sjældne spil ved 100 kr; tilbage er kun målerens forløb. Kolonnen "rå" er den direkte stikprøve (faktiske gevinster), som er langt mere støjfyldt.`);
  p();
  p('| Strategi | Beskrivelse | RTP (± 95 %) | Edge | Forskel til konstant | Rå stikprøve |');
  p('|---|---|---:|---:|---:|---:|');
  const desc: Record<string, string> = {
    const: 'konstant 2 kr',
    lowHigh: '0,50 kr indtil Kp 8, derefter 100 kr',
    highLow: '100 kr indtil Kp 8, derefter 0,50 kr',
    random: 'tilfældig indsats fra stigen hvert spil',
    perkHunt: '100 kr i de sidste 10 % før Kp 3/5/7, ellers 0,50 kr',
    perkSnipe: '100 kr når der mangler < 3 spils ladning til et Ladet spin, ellers 0,50 kr',
    quitEarly: 'sessioner på 300 spil, måleren glemmes (intet gemt fremskridt)',
  };
  for (const a of j.adversary) p(`| ${a.strategy} | ${desc[a.strategy] ?? ''} | ${pct(a.rtp, 2)} ± ${pct(1.96 * a.se, 2)} | ${dk(a.edge * 100, 2)} pp | ${a.vsConst >= 0 ? '+' : ''}${dk(a.vsConst * 100, 2)} pp | ${pct(a.rawRtp, 1)} |`);
  p();
  p('Låst indsats = floor(Σ ladning·indsats / Σ ladning) gør værdien af hver ladningsenhed proportional med den indsats, den blev optjent ved; Ladede spin og rute-A-storme kan derfor ikke "købes billigt". Den største fordel ligger i at time høj indsats lige før et Ladet spin (Kp 3 kræver kun 3 % af K), men gevinsten er få promille og edge forbliver negativ.');
  p();

  p('## 11. Metode');
  p();
  p('- **Motor:** `src/math` (ren, isomorf TypeScript) — simulatoren kalder præcis de samme funktioner som spillet, blot uden optagelse af `SpinResult`.');
  p('- **RNG:** xoshiro128** seedet pr. spil fra splitmix32(sessionSeed ^ DOMAIN) fremskudt 4·idx. Basis- og Ladede spil har hver sin rng; en Solstorm bruger én rng for createStorm + alle stormspil (som spillet, så en storm kan genafspilles bit for bit).');
  p(`- **Tuner** (\`node sim/tune.ts\`, common random numbers, frø 0x${(j.tuning?.seed ?? 0).toString(16)}): pSun analytisk (4+ sole = 1:3.300) → wild-vægt bisection mod hitrate 45 % → form-knap φ mod net-win (φ = ${j.tuning ? dk(j.tuning.phi, 3) : '?'}) → s i lukket form mod klynge-RTP ${j.tuning ? pct(j.tuning.targets.cluster, 1) : ''} (s før afrunding ${j.tuning ? dk(j.tuning.sBeforeRounding, 4) : '?'}) → afrunding til pæne trin (0,1 / 0,5 / 1 / 5 / 10) med payScale = 1 → K = c̄·(2.200 + 3) − Ō (renewal/Wald; 3 Ladede spin pr. cyklus har samme ladningsfordeling som basisspil) → stormPayScale i lukket form på en storm-stikprøve (cap og garanti eksakt) → varianter.`);
  p(`- **Verifikation** (\`node sim/run.ts\`) på friske frø, der ikke deler en eneste splitmix-tilstand med tunerens stikprøver (\`sim/seeds.ts\`): ${int(D.n)} basisspil med vedvarende måler og Ladede spin, ${int(S.n)} storme, ${int(E.n)} end-to-end-spil og ${int(j.samples.adv as number)} spil × ${j.adversary.length} adversary-strategier.`);
  p(`- **Estimator:** RTP = E[basis + Ladede spin] + (r_A + r_B − r_AB)·E[S]; r_A = 1/E[N] (renewal-reward), r_B = P(4+ sole) eksakt. 95 %-CI via delta-metoden: ± ${pct(R.rtpCi95, 3)}.`);
  p(`- **End-to-end-krydstjek:** en spiller med alt inline (${int(E.n)} spil, ${int(E.storms)} storme, ${int(E.cycles)} rute-A-cykler som i.i.d.-batches): ${pct(E.rtpCycles, 3)} ± ${pct(1.96 * E.seCycles, 3)} mod dekomponeringens ${pct(R.rtp, 3)} (z = ${dk((E.rtpCycles - R.rtp) / Math.sqrt(E.seCycles ** 2 + D.seRtp ** 2), 2)}). Støjen er domineret af de ca. ${int(E.storms)} storme (SD ${int(S.sdS)}× pr. storm).`);
  for (const x of j.e2eSupplement ?? []) p(`  - Supplerende e2e (\`node sim/e2e.ts\`, frisk frø 0x${x.seed.toString(16)}): ${int(x.n)} spil, ${int(x.storms)} storme: ${pct(x.rtpCycles, 3)} ± ${pct(1.96 * x.seCycles, 3)}.`);
  if (j.e2ePooled) p(`  - Samlet (inverse-varians): ${pct(j.e2ePooled.rtp, 3)} ± ${pct(1.96 * j.e2ePooled.se, 3)} mod ${pct(R.rtp, 3)}, z = ${dk(j.e2ePooled.z, 2)} → ${Math.abs(j.e2ePooled.z) <= 1.96 ? 'bestået' : '**ikke bestået**'}.`);
  p(`- Øre: hver klynge afrundes én gang (halv op) til hele øre: winOre = floor((round(tabel·skala·10⁴)·mult·indsats + 5.000)/10⁴). Spillets total er summen, cappet ved ${int(C.maxWinX)}× indsats.`);
  p();

  p('## 12. Afvigelser fra PLAN.md');
  p();
  if (failed.length) for (const g of failed) p(`- **Gate ikke bestået: ${g.name}** — ${g.value} (krav ${g.req}).${g.note ? ' ' + g.note : ''}`);
  p('- Gevinsttabellens form: PLAN §5 angiver L1 0,3/0,4/0,5/0,7/… ved s ≈ 2 (5-klynge 0,6×, 6-klynge 0,8×). På 6×6 med disse vægte er ~55 % af alle klynger lave 5-klynger og ~25 % lave 6-klynger, så net-win afhænger af, om en enlig lav 6-klynge betaler over indsatsen: PLAN-formen giver ca. 22 % net-win (< 25 %-gaten). Formen er derfor PLAN-formen med φ-knappen anvendt (lave 6–8-klynger løftet): mindste gevinst 0,4× i stedet for 0,6×, alle lave 6-klynger ≥ 1,1×.');
  p('- Afrunding: tabellen afrundes til pæne trin (0,1 under 5×) med payScale = 1 i stedet for at genløse payScale; den sidste finjustering af den samlede RTP sker i stormPayScale (4 decimaler). Så er gevinsttabellen i reglerne præcis det, der udbetales, og alle gevinster er hele øre ved alle indsatser.');
  p('- Stormbølgen rammer også før spil 12, 16 og 20 (indeks 11, 15, 19), når stormen er forlænget ved retrigger ("før hvert 4. spil").');
  p('- Storm-P10 måles på W *før* garantien (med garantien er P10 trivielt 30×).');
  p();

  p('## 13. Integration (RGS)');
  p();
  p('- `src/math` er isomorf TypeScript uden DOM, Pixi, gsap, `import.meta` eller `Math.random` (testet). Den samme kode kan køre server-autoritativt i operatørens RGS (Node ≥ 22 med type stripping, eller transpileret): serveren trækker udfaldet og sender `SpinResult`-JSON; klienten (`src/present`, `src/game`) præsenterer kun resultatet og har ingen adgang til outcome-RNG\'en.');
  p('- API: `spinRng(seed, domain, idx)`, `spinBase(rng, stakeOre, { perk })`, `createStorm(rng, stakeOre)` / `stormSpin(state, rng, spinId)` / `finishStorm(state)`, `addCharge` / `lockedStakeOre` / `resetMeter` (se `docs/CONTRACTS.md` §1). Alle beløb er hele øre.');
  p('- Genafspilning: (sessionSeed, domæne, idx) + pre-state (måler, låst indsats, stormmærker) reproducerer hvert spil bit for bit; en Solstorm genafspilles ved at køre createStorm + stormSpin × k på en frisk `spinRng` med samme indeks (golden-test i `tests/math.storm.test.ts`).');
  p(`- Modelhash: SHA-256 af den kanoniske JSON af CONFIG (uden hash) = \`${C.modelHash}\`. Enhver ændring af vægte, tabel eller skalaer ændrer hashen; regelskærmen viser de første 8 tegn.`);
  p('- Genkørsel: `node sim/tune.ts` (≈ 4 min) → `node sim/run.ts` (≈ 10 min) → valgfrit `node sim/e2e.ts` (supplerende krydstjek, ≈ 4 min) på 2 tråde; `--quick` til udvikling; `node sim/report.ts` gengiver denne rapport fra `sim/report.json` uden ny simulering. Tests: `npx vitest run tests/math` (≈ 7 s).');
  p();
  if (j.dice) writeDiceMd(j, p);
  writeFileSync(fileURLToPath(new URL('./REPORT.md', import.meta.url)), L.join('\n'));
}

// `node sim/report.ts`: re-render sim/REPORT.md (gates included) from sim/report.json.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const j = JSON.parse(readFileSync(fileURLToPath(new URL('./report.json', import.meta.url)), 'utf8')) as Json;
  j.gates = buildGates(j);
  writeFileSync(fileURLToPath(new URL('./report.json', import.meta.url)), JSON.stringify(j, null, 1));
  writeReportMd(j);
  console.log('[report] re-rendered sim/REPORT.md from sim/report.json');
}
