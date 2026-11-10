# Stella Nova — PAR-ark

Model 1.0.0. Alle tal er målt ved Monte Carlo-simulation med motorens egne regler (`src/math/kernel.ts`) og kan genskabes med `npm run sim -- --spins=100000000 --seed=20261110 --workers=2 --par`. Et "spin" er ét betalt spin inklusive de gratisspil, det udløser. Demo uden rigtige penge.

## 1. Regler i kort form

| Regel | Værdi |
|---|---|
| Bræt | 4 ringe × 8 eger; hver eger er en linje, alle 8 er altid aktive |
| Gevinst | 3 ens (ring 0–2) eller 4 ens læst fra centrum og ud |
| Stella Nova (wild) | Erstatter alle symboler undtagen komet; rene wild-linjer betaler som Sol |
| Komet | Bryder linjen; højst én pr. ring; splintres aldrig; ingen kometer i genopfyldning |
| Kædereaktion | Gevinstceller splintres og genopfyldes, ringene tikker ét hak (+1, −1, +1, −1), multiplikatoren stiger ét trin |
| Multiplikatorstige | ×1 · ×2 · ×3 · ×5 · ×8 · ×12 · ×20 (sidste trin gentages) |
| Dit træk | Ét pr. spin: drej én ring ét hak. Tilbydes kun, når mindst ét af de 8 træk giver gevinst; fortsætter på samme trin |
| Auto-juster | Vælger trækket med størst øjeblikkelig gevinst (lighed: laveste ring, derefter med uret) |
| Stella Nova | +1 ladning pr. splintret celle; ved 180 bliver ring 0 og 1 wild (kometer undtaget); højst én pr. spin |
| Kometnat | 3 kometer = 8 gratisspil, 4 = 12; ring 0 er en krans af wilds; 2 kometer = +2, 3 = +5 |
| Loft | 5.000× indsatsen pr. spin |
| Indsats | 1–200 kr.; udbetalinger er hele multipla af 0,1 × indsats |

## 2. Gevinsttabel

Multipla af den samlede indsats, før multiplikator.

| Symbol | 3 ens | 4 ens |
|---|---:|---:|
| Stella Nova (kun wilds) | 2,0× | 50,0× |
| Sol | 2,0× | 50,0× |
| Saturn | 1,2× | 15,0× |
| Jupiter | 0,8× | 6,0× |
| Måne | 0,5× | 4,0× |
| Rubin | 0,4× | 1,0× |
| Ametyst | 0,3× | 0,8× |
| Smaragd | 0,2× | 0,6× |
| Safir | 0,2× | 0,5× |

## 3. Vægte

Hver celle trækkes uafhængigt fra ringens vægte. Derefter kan ringen få sin ene komet på en tilfældig eger.

**Grundspil, første stop og genopfyldning**

| Ring | Safir | Smaragd | Ametyst | Rubin | Måne | Jupiter | Saturn | Sol | Stella Nova | Sum |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 0 | 130 | 130 | 130 | 130 | 115 | 105 | 95 | 85 | 10 | 930 |
| 1 | 65 | 65 | 65 | 65 | 170 | 160 | 150 | 140 | 10 | 890 |
| 2 | 180 | 180 | 180 | 180 | 42 | 38 | 33 | 28 | 10 | 871 |
| 3 | 170 | 170 | 170 | 170 | 60 | 50 | 34 | 19 | 12 | 855 |

**Kometnat, første stop og genopfyldning** (ring 0 er wild)

| Ring | Safir | Smaragd | Ametyst | Rubin | Måne | Jupiter | Saturn | Sol | Stella Nova | Sum |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 34 | 34 | 34 | 34 | 210 | 200 | 190 | 180 | 10 | 926 |
| 2 | 200 | 200 | 200 | 200 | 39 | 35 | 31 | 27 | 10 | 942 |
| 3 | 170 | 170 | 170 | 170 | 60 | 50 | 34 | 19 | 12 | 855 |

**Kometchance pr. ringstop**

| Ring | Grundspil | Kometnat |
|---|---:|---:|
| 0 | 12,00 % | – |
| 1 | 12,00 % | 8,00 % |
| 2 | 12,00 % | 8,00 % |
| 3 | 12,00 % | 8,00 % |

## 4. RTP

| Kilde | RTP-bidrag | Andel af RTP |
|---|---:|---:|
| Grundlinjer (første stop og dets kæde) | 10,904 % | 11,4 % |
| Dit træk (auto-juster) og kæden derefter | 46,864 % | 48,9 % |
| Stella Nova og kæden derefter | 13,589 % | 14,2 % |
| Kometnat (alle gratisspil) | 24,570 % | 25,6 % |
| **RTP med auto-juster** | **95,927 %** | 100,0 % |
| RTP uden træk (spilleren springer altid over) | 23,716 % |  |

## 5. Træfprocenter

| Mål | Værdi |
|---|---:|
| Spins med gevinst (alle gevinster) | 47,09 % |
| Spins med gevinst ≥ indsats | 16,27 % |
| Grundspin med gevinst på eget bræt | 46,71 % |
| Gevinst allerede på første stop (før træk) | 11,42 % |
| Spins, hvor et vindende træk tilbydes | 39,71 % |
| Gratisspin med gevinst | 76,68 % |
| Spins med gevinst uden træk | 11,99 % |

## 6. Features

| Feature | Værdi |
|---|---:|
| Kometnat udløses | 1 ud af 159 |
| – med 3 kometer / 4 kometer | 608.041 / 20.542 |
| Gratisspil pr. runde (inkl. ekstra spins) | 8,45 |
| Gennemsnitlig gevinst pr. Kometnat | 39,09× |
| Standardafvigelse pr. Kometnat | 47,3× |
| Største Kometnat | 2.053,8× |
| Ekstra spins: 2 kometer / 3 kometer | 1 ud af 56,4 / 1 ud af 1.971 gratisspin |
| Stella Nova i grundspillet | 1 ud af 83,3 |
| Stella Nova inkl. Kometnat | 1 ud af 74,9 |
| Gennemsnitlig gevinst efter en Nova (grundspil) | 11,32× |
| Splintrede celler pr. spin | 2,43 |
| Spins standset af loftet | 0 |

**Kædelængde** (antal evalueringer med gevinst i et grundspin)

| Evalueringer | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7+ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Andel af spins | 53,29 % | 37,77 % | 7,42 % | 1,27 % | 0,21 % | 0,0340 % | 0,0050 % | 0,0007 % |

## 7. Gevinstfordeling

| Gevinst pr. spin | Antal | Andel af spins | Hyppighed | RTP-bidrag |
|---|---:|---:|---:|---:|
| 0 | 52.905.103 | 52,905 % | 1 ud af 1,9 | 0,000 % |
| 0,1–0,5× | 17.813.733 | 17,814 % | 1 ud af 5,6 | 4,969 % |
| 0,5–1× | 13.015.398 | 13,015 % | 1 ud af 7,7 | 8,494 % |
| 1–2× | 7.897.499 | 7,897 % | 1 ud af 12,7 | 9,827 % |
| 2–5× | 5.376.579 | 5,377 % | 1 ud af 18,6 | 14,358 % |
| 5–10× | 1.400.580 | 1,401 % | 1 ud af 71,4 | 9,746 % |
| 10–25× | 1.018.246 | 1,018 % | 1 ud af 98,2 | 15,281 % |
| 25–60× | 429.796 | 0,430 % | 1 ud af 233 | 17,341 % |
| 60–100× | 70.308 | 0,07031 % | 1 ud af 1.422 | 5,246 % |
| 100–250× | 67.379 | 0,06738 % | 1 ud af 1.484 | 8,672 % |
| 250–1.000× | 5.225 | 0,00523 % | 1 ud af 19.139 | 1,819 % |
| 1.000–5.000× | 154 | 0,00015 % | 1 ud af 649.351 | 0,174 % |
| ≥ 5.000× | 0 | 0,00000 % | – | 0,000 % |

## 8. Linjegevinster pr. symbol

| Symbol | 3 ens | RTP 3 ens | 4 ens | RTP 4 ens |
|---|---:|---:|---:|---:|
| Stella Nova (kun wilds) | 1 ud af 101.937 | 0,004 % | 1 ud af 122.699 | 0,088 % |
| Sol | 1 ud af 22,7 | 12,670 % | 1 ud af 531 | 13,342 % |
| Saturn | 1 ud af 18,5 | 9,218 % | 1 ud af 280 | 7,557 % |
| Jupiter | 1 ud af 15,6 | 7,217 % | 1 ud af 167 | 5,026 % |
| Måne | 1 ud af 13,6 | 5,154 % | 1 ud af 120 | 4,621 % |
| Rubin | 1 ud af 9,5 | 6,311 % | 1 ud af 30,0 | 4,859 % |
| Ametyst | 1 ud af 9,7 | 4,670 % | 1 ud af 30,4 | 3,849 % |
| Smaragd | 1 ud af 10,0 | 3,056 % | 1 ud af 30,8 | 2,864 % |
| Safir | 1 ud af 10,0 | 3,061 % | 1 ud af 31,3 | 2,358 % |

Hyppighed pr. betalt spin, RTP inklusive multiplikator og gratisspil.

## 9. Spredning og stikprøve

| Størrelse | Værdi |
|---|---:|
| Standardafvigelse pr. spin | 5,92 indsatser |
| Varians | 35,1 |
| Største observerede gevinst | 2.053,8× |
| Stikprøve (auto-juster) | 100.000.000 spins, seeds 20261110, 20261111 |
| Standardfejl på RTP | 0,059 procentpoint |
| 95 % konfidensinterval | 95,81 % – 96,04 % |
| RTP uden træk | 23,716 % (± 0,027 procentpoint, 100.000.000 spins) |
| Standardafvigelse uden træk | 2,72 indsatser |
