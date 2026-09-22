# NORDLYS · SOLSTORM G5 — par sheet (matematikrapport)

Model `a346b7d2622ae0033b614fe38dfdaec1487b68fd918509268317737f1172b39d` · genereret 2026-09-22T21:00:08.282Z (sim/run.ts) · simuleringstid 631 s på 2 worker-tråde.

Alle tal i denne rapport og i spillets regelskærm kommer fra `sim/report.json` (samme kørsel). Spillepenge; demo.

## 1. Resumé

- **Samlet RTP 96,03 %** (95 %-konfidensinterval ± 0,055 %), heraf basisspil 80,51 %, Ladede spin 0,22 %, Solstorm 15,30 %.
- **Minimum-RTP uden gemt fremskridt 86,63 %** (basisspil + Solstorm via 4+ sole). Den målerafhængige andel er 9,40 pp.
- Gevinst over indsatsen i **28,7 %** af spillene; gevinst af enhver størrelse i 45,0 %. 33,9 % af gevinsterne er mindre end indsatsen (vises som "Retur", aldrig som gevinst).
- Solstorm ca. **1:1.319** betalte spil (Kp 9: 1:2.200, 4+ sole: 1:3.296); gennemsnit 202× indsats, median 112×.
- Volatilitet: **lav i basisspillet** (SD 1,97× pr. spil), **høj i Solstorm** (samlet SD 9,8× pr. spil). Max gevinst 10.000× indsats.
- Gates: 18 af 18 bestået.

## 2. Gates

| Gate | Krav | Resultat | Status |
|---|---|---|---|
| Samlet RTP | 96,00 ± 0,10 % | 96,035 % (95 %-CI ± 0,055 %) | bestået |
| Basis (klynger + sole) | 79–81 % | 80,51 % | bestået |
| Minimum-RTP uden gemt fremskridt (basis + rute B) | ≥ 86 % | 86,63 % ± 0,04 % | bestået |
| Målerafhængig andel | ≤ 10 pp | 9,40 pp | bestået |
| Net-win (T > indsats) | ≥ 25 % af betalte spil | 28,69 % | bestået |
| Hitrate (T > 0) | ≥ 43 % | 45,00 % | bestået |
| LDW-andel af hits (0 < T < indsats) | ≤ 45 % | 33,90 % | bestået |
| Solstorm samlet | 1:1.100–1:1.600 | 1:1.319 | bestået |
| · rute A (Kp 9) | ≈ 1:2.200 | 1:2.200 | bestået |
| · rute B (4+ sole) | ≈ 1:3.300 | 1:3.296 | bestået |
| Storm, gennemsnit E[S] | 180–230× | 201.9× ± 0.6 | bestået |
| Storm P10 (før garanti) | ≥ 15× | 24.6× | bestået |
| Garanti brugt | ≤ 20 % af storme | 13,23 % | bestået |
| Garantiens pris | ≤ 5 % af E[S] | 0,78 % | bestået |
| Max-win cap ramt | ≤ 1 pr. 10⁴ storme | 20 af 1.000.000 (0.20 pr. 10⁴) | bestået |
| Kp-tiers inden for 150 spil (median) | ≥ 3 | 4 (≥ 3 for 100,0 % af spillerne) | bestået |
| Stake-switch adversary | edge ≤ 0 | max RTP 96,44 % ± 0,11 % (perkSnipe) | bestået |
| E2E-krydstjek | |e2e − dek| ≤ 1,96·√(SE²+SE²) | 95,786 % vs 96,035 % | bestået |

## 3. Spillet kort

- Basisspil 6×6, Solstorm 8×8. Klynger på 5+ ortogonalt forbundne ens symboler betaler. Hver celle er et uafhængigt vægtet træk (ingen hjul-strips).
- Isskred: vindende celler knuses, resten falder, nye falder ind ovenfra, indtil der ikke er flere klynger.
- Nordlysbuen (WILD) indgår i alle klynger, den rører; rene wild-grupper betaler ikke.
- Frostmærker ("læsning A"): en klynge ganges med max(1, Σ mærker ≥ ×2 i klyngen) *før* dette trins opgradering; derefter går alle vindende felter ét trin op (0 → frost → ×2 → … → ×32), vindende wilds to trin. Mærker nulstilles hvert basisspil.
- Solen: kun i første fald, højst én pr. kolonne (p = 0.06897 pr. kolonne). 3 sole = 3× indsats + 150 ladning; 4+ sole = Solstorm (rute B).
- Ladning: lav 1, høj 2, wild 3 pr. knust celle. Kp 9 ved K = 12.290 ladning (rute A, ved låst indsats = floor(Σ ladning·indsats / Σ ladning)). Kp 3, 5 og 7 giver et Ladet spin (gratis, låst indsats, 4 felter på ×2).
- Solstorm: 10 spil på 8×8 med 6 startmærker på ×2, mærker bevares hele stormen (op til ×128), Stormbølge før hvert 4. spil fordobler alle mærker ≥ ×2, 3+ sole giver +3 spil (højst 20), gevinster × stormPayScale = 0.2781, garanti 30× indsats på egen linje.

## 4. Gevinsttabel (× indsats, før mærker)

payScale = 1; tabellen er præcis det, der udbetales. Alle værdier er multipla af 0,1× og dermed hele øre ved alle indsatser (0,50 kr, 1,00 kr, 2,00 kr, 4,00 kr, 6,00 kr, 10,00 kr, 20,00 kr, 50,00 kr, 100,00 kr).

| Symbol | 5 | 6 | 7 | 8 | 9-10 | 11-12 | 13-15 | 16+ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Rav | 2,5 | 4 | 6 | 9 | 15 | 25 | 60 | 250 |
| Polarstjernen | 1,6 | 2,5 | 3,6 | 5,5 | 9 | 15 | 40 | 120 |
| Månen | 1,2 | 1,8 | 2,6 | 3,8 | 6 | 10 | 25 | 80 |
| Dråbekrystal | 0,6 | 1,3 | 1,6 | 2,1 | 3 | 5 | 10 | 40 |
| Sekskantkrystal | 0,5 | 1,2 | 1,5 | 1,9 | 2,8 | 4,5 | 9 | 30 |
| Kvadratkrystal | 0,5 | 1,1 | 1,4 | 1,7 | 2,5 | 4 | 8 | 25 |
| Trekantkrystal | 0,4 | 1,1 | 1,3 | 1,6 | 2,2 | 3,5 | 7 | 20 |

Mindste gevinst: 0,4× (5 × Trekantkrystal). I Solstorm ganges tabellen med 0.2781 (27,81 %) før mærker; stormens gevinster afrundes til hele øre pr. klynge (halv op).

### Symbolvægte

| Symbol | Vægt basis | Sandsynlighed | Vægt storm | Sandsynlighed |
|---|---:|---:|---:|---:|
| Trekantkrystal | 26 | 21,26 % | 26 | 21,14 % |
| Kvadratkrystal | 25 | 20,44 % | 25 | 20,33 % |
| Sekskantkrystal | 23 | 18,81 % | 23 | 18,70 % |
| Dråbekrystal | 22 | 17,99 % | 22 | 17,89 % |
| Månen | 10 | 8,18 % | 10 | 8,13 % |
| Polarstjernen | 8 | 6,54 % | 8 | 6,50 % |
| Rav | 6 | 4,91 % | 6 | 4,88 % |
| Nordlysbue (WILD) | 2,30 | 1,88 % | 3,00 | 2,44 % |
| Solen | p = 0.06897 pr. kolonne | P(3) = 0,530 %, P(4+) = 1:3.300 | p = 0.06 pr. kolonne | |

## 5. RTP-opdeling

Dekomponering pr. betalt spil ved konstant indsats 2,00 kr (basisspillets gevinster er eksakte multipla af indsatsen, så basis-RTP er ens ved alle indsatser):

| Komponent | RTP | Kilde |
|---|---:|---|
| Klynger (basisspil) | 78,927 % | 120.000.000 spil |
| 3 sole (3×) | 1,589 % | lukket form, P(3 sole) = 0,5295 % |
| **Basisspil i alt** | **80,515 %** | |
| Ladede spin (Kp 3/5/7) | 0,216 % | 1,364 pr. 1.000 spil, snit 1,58× |
| Solstorm rute A (Kp 9) | 9,178 % | r_A = 1/E[N], E[N] = 2199,8 spil (54.522 cykler) |
| Solstorm rute B (4+ sole) | 6,126 % | P(4+) lukket form × (1 + Ladede spin) − r_AB |
| **Samlet** | **96,035 %** | ± 0,055 % (95 %, delta-metoden) |

- Minimum-RTP uden gemt fremskridt (basisspil + rute B fra betalte spil): **86,63 %**. Spilles der i sessioner på 300 spil, hvor måleren glemmes, er RTP 87,70 %.
- Målerafhængig andel (Ladede spin + rute A): 9,40 pp.
- Pr. Solstorm-spil i snit: 1961 % af indsatsen (10,30 spil pr. storm).

## 6. Frekvenser

| Hændelse | Frekvens |
|---|---:|
| Gevinst > indsats (net-win) | 28,69 % |
| Gevinst = indsats ("Indsats retur") | 1,06 % |
| 0 < gevinst < indsats ("Retur", LDW) | 15,26 % |
| Enhver gevinst (hitrate) | 45,00 % |
| 3 sole | 0,529 % |
| 4+ sole | 1:3.289 |
| Solstorm i alt | 1:1.319 |
| · rute A (Kp 9, inkl. A+B i samme spil) | 1:2.200 |
| · rute B (4+ sole uden Kp 9) | 1:3.296 |
| · A og B i samme spil | 1:24.000.000 |

Ladning: 5,587 pr. spil i snit (SD 12,8). K = 12.290.

### Kp-stigen (median og gennemsnit, betalte spil fra tom måler)

| Kp | Andel af K | Ladning | Median spil | Gennemsnit spil | Ændring |
|---|---:|---:|---:|---:|---|
| 1 | 0,4 % | 49 | 11 | 11 | Glas-arpeggio tændes |
| 2 | 1,2 % | 147 | 30 | 30 | Tykkere gardiner |
| 3 | 3,0 % | 369 | 71 | 69 | Ladet spin · 4 felter x2 |
| 4 | 6,0 % | 737 | 135 | 134 | Rimlys på isrammen · puls-bas |
| 5 · G1 | 11,0 % | 1.352 | 245 | 244 | Violet nordlys · Ladet spin |
| 6 · G2 | 19,0 % | 2.335 | 420 | 419 | Foldede gardiner · perkussion |
| 7 · G3 | 31,0 % | 3.810 | 684 | 683 | Røde toppe · Ladet spin |
| 8 · G4 | 55,0 % | 6.760 | 1.211 | 1.210 | Knitren i rammen · ostinato |
| 9 · G5 | 100,0 % | 12.290 | 2.201 | 2.200 | SOLSTORM |

Efter 150 spil har medianspilleren krydset **4 tiers**; 100,0 % har krydset mindst 3.

## 7. Fordeling og volatilitet

| Kvantil (basisspil, × indsats) | P50 | P75 | P90 | P95 | P99 | P99,9 |
|---|---:|---:|---:|---:|---:|---:|
| | 0 | 1,10× | 2,19× | 3,19× | 6,96× | 22,1× |

- SD pr. basisspil 1,966×; samlet (inkl. Ladede spin og Solstorm) 9,82× (e2e-stikprøve: 9,70×). P99: basis 6,96×, samlet 7,35×.
- Største basisgevinst i 120.000.000 spil: 735×. Basis-cap ramt 0 gange.
- Volatilitet: **lav i basisspillet, høj i Solstorm.**

## 8. Solstorm

1.000.000 friske storme ved 2,00 kr.

- E[S] = **202×** ± 0,56 (95 %), heraf garanti 1,572× (0,78 % af E[S]). SD 286×.
- Garantien (30×) bruges i 13,23 % af stormene. Max-win cap (10.000×) ramt 20 gange (0,20 pr. 10⁴). Største storm: 10.000×.
- Gennemsnitligt 10,299 spil pr. storm; retrigger i 9,26 % af stormene.

| Kvantil (W før garanti) | P1 | P5 | P10 | P20 | P25 | P50 | P75 | P90 | P95 | P99 | P99,9 | P99,99 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| | 6,55× | 15,7× | 24,6× | 41,6× | 50,8× | 112× | 241× | 458× | 663× | 1.304× | 2.945× | 6.119× |

Højeste mærke i stormen: ×8 0,0 %, ×16 1,3 %, ×32 8,2 %, ×64 19,2 %, ×128 71,3 %.

Øre-afrunding pr. klynge (samme storme, forskellig indsats): 0,50 kr → 200,280×, 2,00 kr → 200,275×, 100,00 kr → 200,276×.

## 9. Varianter (kun payScale og stormPayScale ændres)

| Mål-RTP | payScale | stormPayScale | Estimeret RTP (denne stikprøve) |
|---:|---:|---:|---:|
| 96 % | 1 | 0.2781 | 96,04 % |
| 94 % | 0.97874 | 0.2722 | 94,03 % |
| 92 % | 0.95748 | 0.2663 | 92,03 % |

For 94 %- og 92 %-varianterne er payScale ikke et multiplum af 0,1, så klyngegevinster afrundes til hele øre pr. klynge (halv op), og tabellen i reglerne vises med én decimal. Solen (3×) skaleres ikke.

## 10. Stake-switch adversary (låst indsats)

Samme spil (common random numbers) for alle strategier, 4.000.000 betalte spil pr. strategi. Estimator med forventningskreditering: hvert betalt spil krediteres (basis-RTP + P(4+ sole)·E[S])·indsats, hvert Ladet spin (E[Ladet spin] + P(4+ sole)·E[S])·låst indsats og hver rute-A-storm E[S]·låst indsats. Det er middelret (indsatsen i spil i afhænger kun af fortiden; spillets udfald er uafhængigt af fortiden) og fjerner næsten al støj fra de sjældne spil ved 100 kr; tilbage er kun målerens forløb. Kolonnen "rå" er den direkte stikprøve (faktiske gevinster), som er langt mere støjfyldt.

| Strategi | Beskrivelse | RTP (± 95 %) | Edge | Forskel til konstant | Rå stikprøve |
|---|---|---:|---:|---:|---:|
| const | konstant 2 kr | 96,02 % ± 0,02 % | -3,98 pp | +0,00 pp | 95,6 % |
| lowHigh | 0,50 kr indtil Kp 8, derefter 100 kr | 95,81 % ± 0,04 % | -4,19 pp | -0,21 pp | 95,0 % |
| highLow | 100 kr indtil Kp 8, derefter 0,50 kr | 96,19 % ± 0,03 % | -3,81 pp | +0,17 pp | 96,2 % |
| random | tilfældig indsats fra stigen hvert spil | 96,02 % ± 0,03 % | -3,98 pp | -0,00 pp | 96,0 % |
| perkHunt | 100 kr i de sidste 10 % før Kp 3/5/7, ellers 0,50 kr | 96,40 % ± 0,11 % | -3,60 pp | +0,38 pp | 97,8 % |
| perkSnipe | 100 kr når der mangler < 3 spils ladning til et Ladet spin, ellers 0,50 kr | 96,44 % ± 0,11 % | -3,56 pp | +0,42 pp | 97,1 % |
| quitEarly | sessioner på 300 spil, måleren glemmes (intet gemt fremskridt) | 87,70 % ± 0,00 % | -12,30 pp | -8,32 pp | 87,3 % |

Låst indsats = floor(Σ ladning·indsats / Σ ladning) gør værdien af hver ladningsenhed proportional med den indsats, den blev optjent ved; Ladede spin og rute-A-storme kan derfor ikke "købes billigt". Den største fordel ligger i at time høj indsats lige før et Ladet spin (Kp 3 kræver kun 3 % af K), men gevinsten er få promille og edge forbliver negativ.

## 11. Metode

- **Motor:** `src/math` (ren, isomorf TypeScript) — simulatoren kalder præcis de samme funktioner som spillet, blot uden optagelse af `SpinResult`.
- **RNG:** xoshiro128** seedet pr. spil fra splitmix32(sessionSeed ^ DOMAIN) fremskudt 4·idx. Basis- og Ladede spil har hver sin rng; en Solstorm bruger én rng for createStorm + alle stormspil (som spillet, så en storm kan genafspilles bit for bit).
- **Tuner** (`node sim/tune.ts`, common random numbers, frø 0x4e4c5455): pSun analytisk (4+ sole = 1:3.300) → wild-vægt bisection mod hitrate 45 % → form-knap φ mod net-win (φ = 0,000) → s i lukket form mod klynge-RTP 78,7 % (s før afrunding 0,9975) → afrunding til pæne trin (0,1 / 0,5 / 1 / 5 / 10) med payScale = 1 → K = c̄·(2.200 + 3) − Ō (renewal/Wald; 3 Ladede spin pr. cyklus har samme ladningsfordeling som basisspil) → stormPayScale i lukket form på en storm-stikprøve (cap og garanti eksakt) → varianter.
- **Verifikation** (`node sim/run.ts`) på friske frø, der ikke deler en eneste splitmix-tilstand med tunerens stikprøver (`sim/seeds.ts`): 120.000.000 basisspil med vedvarende måler og Ladede spin, 1.000.000 storme, 40.000.000 end-to-end-spil og 4.000.000 spil × 7 adversary-strategier.
- **Estimator:** RTP = E[basis + Ladede spin] + (r_A + r_B − r_AB)·E[S]; r_A = 1/E[N] (renewal-reward), r_B = P(4+ sole) eksakt. 95 %-CI via delta-metoden: ± 0,055 %.
- **End-to-end-krydstjek:** en spiller med alt inline (30.263 storme, 18.148 rute-A-cykler som i.i.d.-batches): 95,786 % ± 0,271 % mod dekomponeringens 96,035 % → bestået.
- Øre: hver klynge afrundes én gang (halv op) til hele øre: winOre = floor((round(tabel·skala·10⁴)·mult·indsats + 5.000)/10⁴). Spillets total er summen, cappet ved 10.000× indsats.

## 12. Afvigelser fra PLAN.md

- Gevinsttabellens form: PLAN §5 angiver L1 0,3/0,4/0,5/0,7/… ved s ≈ 2 (5-klynge 0,6×, 6-klynge 0,8×). På 6×6 med disse vægte er ~55 % af alle klynger lave 5-klynger og ~25 % lave 6-klynger, så net-win afhænger af, om en enlig lav 6-klynge betaler over indsatsen: PLAN-formen giver ca. 22 % net-win (< 25 %-gaten). Formen er derfor PLAN-formen med φ-knappen anvendt (lave 6–8-klynger løftet): mindste gevinst 0,4× i stedet for 0,6×, alle lave 6-klynger ≥ 1,1×.
- Afrunding: tabellen afrundes til pæne trin (0,1 under 5×) med payScale = 1 i stedet for at genløse payScale; den sidste finjustering af den samlede RTP sker i stormPayScale (4 decimaler). Så er gevinsttabellen i reglerne præcis det, der udbetales, og alle gevinster er hele øre ved alle indsatser.
- Stormbølgen rammer også før spil 12, 16 og 20 (indeks 11, 15, 19), når stormen er forlænget ved retrigger ("før hvert 4. spil").
- Storm-P10 måles på W *før* garantien (med garantien er P10 trivielt 30×).

## 13. Integration (RGS)

- `src/math` er isomorf TypeScript uden DOM, Pixi, gsap, `import.meta` eller `Math.random` (testet). Den samme kode kan køre server-autoritativt i operatørens RGS (Node ≥ 22 med type stripping, eller transpileret): serveren trækker udfaldet og sender `SpinResult`-JSON; klienten (`src/present`, `src/game`) præsenterer kun resultatet og har ingen adgang til outcome-RNG'en.
- API: `spinRng(seed, domain, idx)`, `spinBase(rng, stakeOre, { perk })`, `createStorm(rng, stakeOre)` / `stormSpin(state, rng, spinId)` / `finishStorm(state)`, `addCharge` / `lockedStakeOre` / `resetMeter` (se `docs/CONTRACTS.md` §1). Alle beløb er hele øre.
- Genafspilning: (sessionSeed, domæne, idx) + pre-state (måler, låst indsats, stormmærker) reproducerer hvert spil bit for bit; en Solstorm genafspilles ved at køre createStorm + stormSpin × k på en frisk `spinRng` med samme indeks (golden-test i `tests/math.storm.test.ts`).
- Modelhash: SHA-256 af den kanoniske JSON af CONFIG (uden hash) = `a346b7d2622ae0033b614fe38dfdaec1487b68fd918509268317737f1172b39d`. Enhver ændring af vægte, tabel eller skalaer ændrer hashen; regelskærmen viser de første 8 tegn.
- Genkørsel: `node sim/tune.ts` (≈ 4 min) og derefter `node sim/run.ts` (≈ 8–12 min) på 2 tråde; `--quick` til udvikling.
