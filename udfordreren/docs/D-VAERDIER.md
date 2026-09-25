# Designestimater og afledte tal

Genereret af `npm run dliste` (scripts/d-liste.mjs). Alle tal, der styrer balancen, står i `src/data/` og er markeret
**[F]** fakta, **[A]** afledt (fx valutaomregnet) eller **[D]** designestimat. Her er de 148 linjer med [D] og 10 med [A].
Ændr værdierne i `src/data/` og kør `npm run sim` bagefter: de ti assertions i `sim/report.md` skal stadig være OK.

## src/data/acquisition.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Kundeanskaffelse (spec 7.10). CAC pr. ny indbetalende kunde i dk 2012, i kr. [D]` |
| 11 | D | `/** Mætning: ugentligt forbrug (mio.), hvor effekten er halveret [D] */` |
| 13 | D | `/** Hype pr. mio. kr. pr. uge (brandkendskab) [D] */` |
| 32 | D | `/** CRM: maksimal churn-reduktion og mætning [D] */` |

## src/data/ai.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// AI-akten 2026-2035 (spec 6.16, 7.13, 7.14). Alle tal er [D — spekulation] medmindre andet er angivet.` |
| 64 | D | `uheldFaktor: 0.2, // [D] ca. 0,4-0,6 uheld om året pr. agent med lav overvågning, 0,1 med fuld` |
| 126 | D | `/** Størrelser for AI-scenariernes mekanik [D] */` |
| 145 | D | `/** AI-transformation (spec 6.16): erstat stillinger med agenter [D] */` |

## src/data/balance.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Centrale balanceringskonstanter for kerneloopet. Alt er [D] og tunes af harnesset.` |

## src/data/compatibility.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Kombinationsbogen: type × tema → vurdering 1-5 [D].` |
| 8 | D | `/** Multiplikator på Spillerforums vurdering og kundetiltræk [D] */` |

## src/data/contracts.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Kontraktopgaver (spec 6.6). Beløb i mio. kr. [D]. Efter 2016 færre og dårligere betalt.` |
| 33 | D | `/** Efter 2016 færre og dårligere betalte opgaver (spec 6.6) [D] */` |
| 35 | D | `/** Antal tilbud ad gangen og levetid [D] */` |
| 37 | D | `/** Kvalitetsbonus: betaling ganges med 0,7 + stat/60 (maks 1,6) og ×1,15 ved foretrukken rolle [D] */` |

## src/data/costs.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Omkostninger (spec 7.11) og kontortrin (6.5). [D] medmindre andet er angivet.` |
| 4 | D | `export const START_KAPITAL = 2; // [D] mio. kr.` |
| 5 | D | `/** Betalinger: 2 % af indbetalinger [D]; indbetalinger ≈ 2 × BSI [D] */` |
| 8 | D | `/** Bonus i % af BSI pr. niveau (0-3) [D] */` |
| 10 | D | `/** Bonus' effekt på tilgang og churn [D] */` |
| 13 | D | `/** VIP-program: ARPU-løft og omkostning i % af BSI [D] */` |
| 16 | D | `/** Kasino-content via aggregator: 12 % af kasino-BSI [D] */` |
| 18 | D | `/** Årligt licensgebyr pr. marked efter første år [D] */` |
| 20 | D | `/** Fratrædelse i uger løn [D] */` |
| 22 | D | `/** Ugentlig drift pr. kontortrin (husleje m.m.) [D] */` |
| 33 | D | `/** Jobannoncer i tre niveauer [D] */` |
| 40 | D | `/** Træning: pris = 0,03 × niveau mio. + indsigt; +4..7 i stat; −15 energi [D] */` |
| 43 | D | `/** Boost [D] */` |
| 46 | D | `/** Licens pr. vertikal i et marked, hvor man allerede har licens [D] */` |
| 49 | D | `/** Konkurs: antal uger i træk med negativ kapital [D] */` |

## src/data/endings.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Slutninger og eftermæle (spec 6.17). Tal er [D].` |

## src/data/events.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Events med valg. Effekter er [D]. Tekster må aldrig moralisere; prisen skal være synlig.` |

## src/data/expos.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Branchemesser (spec 6.15). Stande 0,2 / 0,6 / 1,5 mio. (7.11) [D]` |

## src/data/founders.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// De fire stiftere (spec 6.1). Stats er [D].` |
| 29 | D | `export const FOUNDER_LOEN = 0.008; // [D] mio. kr./uge ≈ 35.000 kr./md.` |

## src/data/funding.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 9 | D | `/** Krav: annualiseret BSI (mio.) eller antal lanceringer [D] */` |
| 12 | D | `/** Mindste antal uger siden forrige runde [D] */` |
| 14 | D | `/** Vækstkrav i kvartalsmål efter denne runde [D] */` |
| 30 | D | `/** Værdiansættelse ≈ multipel × annualiseret BSI + kapital [D] */` |
| 32 | D | `/** Stjerner: hver opfyldt mål giver en stjerne; +2 % værdi pr. stjerne (maks 30 %) [D] */` |
| 34 | D | `/** Investorpres: +1 pr. manglende mål, −0,5 pr. opfyldt kvartal. Pres ≥ 3 udløser pres-event [D] */` |
| 36 | D | `/** Bestyrelsesmødet om investorpres kommer højst én gang pr. så mange uger [D] */` |
| 38 | D | `/** Værdiansættelsen: multiplen på BSI justeres med årets resultatmargin (et underskud trækker ned) [D] */` |

## src/data/galaCategories.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Branchegallaen i december (spec 6.15). Belønninger er [D].` |
| 12 | D | `export const GALA_UGE_I_AAR = 50; // [D] midt i december` |

## src/data/marketCurves.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 2 | D | `// Interpoleres lineært mellem ankerpunkterne. [F] dk 2025 kasino 4,31; [A]/[D] resten.` |
| 7 | A | `kasino: [[2012, 1.8], [2020, 3.2], [2025, 4.3], [2030, 5.0], [2035, 5.5]], // [F] 2025; [A] resten` |
| 8 | A | `betting: [[2012, 0.9], [2020, 1.5], [2025, 1.7], [2030, 1.7], [2035, 1.6]], // [A]` |
| 11 | D | `// [D] total 30 → 45 → 55; fordelt 60/40 kasino/betting [D]` |
| 16 | D | `// [A] ~18 mia. SEK kommerciel online; fordelt 65/35 [D]` |
| 21 | D | `// [D] 15 → 17 → 18; fordelt 45/55 [D]` |
| 26 | D | `// [A] €600 mio./halvår legalt; fordelt 75/25 [D]` |
| 31 | D | `// [A] C$4,0 mia. 2025; fordelt 75/25 [D]` |
| 36 | D | `// [A] $16,8 mia. sport 2025; [D] iCasino` |
| 41 | D | `// [A] samlet ~€1,5 mia.; online-andel [D]` |

## src/data/markets.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 2 | D | `// [F] = fakta, [A] = afledt, [D] = designestimat.` |
| 22 | D | `/** ARPU pr. aktiv kunde pr. år i kr. [D] */` |
| 24 | D | `/** Basis-offshoreandel før formlen i 7.8 (fase 3) [D] */` |
| 40 | D | `kanaliseringMaal: 0.9, cacFaktor: 1.0, licensGebyr: 0.5, licensUger: 12, // [D] gebyr/tid` |
| 41 | D | `arpu: { betting: 2500, kasino: 7000 }, // [D]` |
| 42 | D | `basisOffshore: { betting: 0.04, kasino: 0.13 }, // [D] kalibreret til ~9 % samlet [F: 91,5 % kanalisering 2024]` |
| 49 | A | `kasino: [[0, 0.15], [ugeFor(2019, 3), 0.21], [ugeFor(2026, 3), 0.4]], // [F/A] RGD 15 % (2014) → 21 % (2019) → 40 % (2026-04)` |
| 50 | A | `betting: [[0, 0.15], [ugeFor(2027, 3), 0.25]], // [F/A] fjern-betting 15 % → 25 % (2027-04)` |
| 101 | D | `strenghed: [[0, 2.5]], // [D]` |
| 111 | A | `betting: [[0, 0.15], [ugeFor(2025, 6), 0.2], [ugeFor(2026, 0), 0.25]], // [F/A] gennemsnit 15 % → 25 %; NY 51 %` |
| 114 | D | `strenghed: [[0, 2], [ugeFor(2025, 0), 3]], // [D]` |
| 125 | A | `kanaliseringMaal: 0.9, cacFaktor: 1.1, licensGebyr: 0.2, licensUger: 26, // [F/A] €29.000` |
| 133 | D | `// Tallene gælder først, hvis monopolet afskaffes (verdensvurderingen "Norge åbner", 25 %) [D: nordisk licensregime som i se/dk]` |
| 135 | D | `strenghed: [[0, 4]], // [F] betalingsblokering 2010, DNS 2025; [D] strengt nyt regime efter en åbning` |

## src/data/names.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Navne til medarbejdere og produkter [D]. Ingen rigtige firmanavne her.` |

## src/data/offshore.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Offshore-model (spec 7.8). Formlen er [D]; basis er kalibreret mod målene i 7.8 og assertion 8 [F-kalibreret].` |
| 20 | D | `/** Strukturel basis (pp) pr. marked over tid [D-kalibreret] */` |
| 24 | A | `// på én dag [A: målt kanalisering holdt sig omkring 90 % efter tidligere stramninger]; resten kommer fra scenarier og trends` |
| 38 | A | `/** Effektiv afgift til formlen for indsatsmodellen i Tyskland (5,3 % af indsats ≈ 50 % af BSI) [A] */` |
| 58 | D | `/** Grå markeder, som kun kan nås via offshore-brand (mia. kr./år) [D] */` |
| 63 | D | `/** Offshore-brand (spec 6.10) [D] */` |
| 66 | D | `andel: 0.012, // [D] andel af offshore-puljen ved middel kvalitet (ét brand blandt mange hundrede)` |
| 67 | D | `andelGraa: 0.03, // [D] andel af grå markeder (no)` |
| 70 | D | `tabRisikoPrAar: 0.1, // [D] grundrisiko pr. år for licenstab i alle regulerede markeder` |
| 71 | D | `tabRisikoPr10Mio: 0.05, // [D] ekstra risiko pr. år for hver 10 mio. kr. grå BSI pr. uge (store pengestrømme bliver fulgt)` |

## src/data/platforms.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 16 | D | `whiteLabel: { id: 'whiteLabel', navn: 'White-label', uger: [0, 0], revenueShare: 0.3, capex: 0, kvalitetsloft: 55, dataejerskab: 0.1, kilde: '[D] "Lavt" loft' },` |
| 17 | D | `turnkey: { id: 'turnkey', navn: 'Turnkey', uger: [26, 52], revenueShare: 0.12, capex: 15, kvalitetsloft: 75, dataejerskab: 0.3, kilde: '[D] 6-12 mdr.' },` |
| 18 | D | `hybrid: { id: 'hybrid', navn: 'Hybrid', uger: [52, 104], revenueShare: 0.05, capex: 60, kvalitetsloft: 85, dataejerskab: 0.6, kilde: '[D] 1-2 år' },` |
| 28 | D | `/** Migrering og drift [D] */` |
| 38 | D | `/** Krav til modeller [D] */` |
| 45 | D | `/** B2B-salg af egen platform (Kombi-vejen) [D] */` |

## src/data/productTypes.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 14 | D | `/** Planlagt længde af design- og teknikfasen i uger (3-6) [D] */` |
| 17 | D | `/** Minimumsbudget i mio. kr. (2012-niveau) [D] */` |
| 19 | D | `/** Oplåsningskrav [D] */` |
| 35 | A | `marginStd: 0.09, marginMin: 0.07, marginMax: 0.12, // [A]` |
| 38 | D | `krav: { rolle: [{ rolle: 'oddssaetter', niveau: 2 }] }, // [D]` |
| 47 | D | `krav: { rolle: [{ rolle: 'oddssaetter', niveau: 4 }, { rolle: 'analytiker', niveau: 2 }] }, // [D]` |
| 53 | D | `marginStd: 0.08, marginMin: 0.06, marginMax: 0.12, // [D]` |
| 60 | D | `marginStd: 0.04, marginMin: 0.02, marginMax: 0.05, // [D] kun hvor lovligt` |
| 68 | A | `marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [F/A] RTP 94-97 %` |
| 75 | D | `marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [D]` |
| 78 | D | `krav: { rolle: [{ rolle: 'kasinodesigner', niveau: 3 }], platform: 'kasinoHybridEllerEgen' }, // [D]` |
| 92 | D | `marginStd: 0.06, marginMin: 0.04, marginMax: 0.08, // [D]` |
| 100 | D | `marginStd: 0.04, marginMin: 0.03, marginMax: 0.06, // [D] spekulation` |
| 103 | D | `krav: { rolle: [{ rolle: 'aiIngenioer', niveau: 2 }], dataejerskab: 0.3 }, // [D]` |

## src/data/reactionRules.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Konkurrenternes reaktionsregler (spec 7.6). Tærskler og effektstørrelser; [D] medmindre andet er angivet.` |
| 5 | D | `R1: { navn: 'Bonuskrig', hvis: 'Jeres andel > 5 % i et marked og vækst > 30 %/år', saa: 'Største globale gigant: marketing ×1,5 i 4 kvartaler → jeres CAC +25 %', kilde: '[D]' },` |
| 12 | D | `R8: { navn: 'Aggressivitetspåbud', hvis: 'Jeres aggressivitet (bonus + reklame + VIP) er høj i 2 kvartaler', saa: 'Påbud; tredje gang → ny regel for alle i markedet og branchens omdømme −1', kilde: '[D]' },` |
| 13 | D | `R9: { navn: 'Medieskandale', hvis: 'En skandale rammer branchen (tilfældig eller jeres)', saa: 'Politisk pres +1', kilde: '[D]' },` |
| 15 | D | `R11: { navn: 'Kanalisering', hvis: 'Kanalisering under målet i 2 år', saa: '40 %: blokering; 20 %: lempelse', kilde: '[D]' },` |
| 16 | D | `R12: { navn: 'Ansvarlig AI', hvis: 'I har AI-risikodetektion med overvågning ≥ 0,6', saa: 'Påbudsrisiko −50 %, lavere bøder, −3 % BSI fra high-rollers', kilde: '[D]' },` |

## src/data/regulationTimeline.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 2 | D | `// [F] = fakta, [D] = designestimat for effektstørrelser.` |
| 97 | D | `id: 'reklamevindue', navn: 'Reklamevindue', kilde: '[D] spec 7.7',` |
| 102 | D | `id: 'bonusloft', navn: 'Bonusloft', kilde: '[D] spec 7.7',` |
| 107 | D | `id: 'indsatsgraenseKasino', navn: 'Indsatsgrænse på kasino', kilde: '[D] spec 7.7',` |
| 112 | D | `id: 'affordability', navn: 'Affordability', kilde: '[D] spec 7.7',` |
| 117 | D | `id: 'afgiftsstigning', navn: 'Afgiftsstigning', kilde: '[D] spec 7.7: +3-8 pp',` |
| 122 | D | `id: 'streamerForbud', navn: 'Streamer-forbud', kilde: '[D] spec 7.7',` |
| 127 | D | `id: 'aiRisikokrav', navn: 'AI-risikokrav', kilde: '[D] spec 7.7',` |
| 133 | D | `id: 'reklameforbud', navn: 'Totalt reklameforbud', kilde: '[D] spec 7.14: Den hårde hånd',` |
| 138 | D | `id: 'afgiftsdifferentiering', navn: 'Differentieret afgift', kilde: '[D] spec 7.14: Kanaliseringens tilbagetog',` |
| 143 | D | `id: 'afgiftssaenkning', navn: 'Afgiftssænkning', kilde: '[D] spec 7.14: Sverige efter valget',` |
| 148 | D | `id: 'euHarmonisering', navn: 'EU-harmonisering', kilde: '[D] spec 7.14',` |
| 154 | D | `id: 'dnsBlokering', navn: 'DNS-blokering', kilde: '[D] R11',` |
| 159 | D | `id: 'betalingsblokering', navn: 'Betalingsblokering', kilde: '[D] R11',` |
| 164 | D | `id: 'lempelse', navn: 'Lempelse', kilde: '[D] R11',` |
| 188 | D | `/** Pulje til dynamisk regulering (spec 7.7). AI-risikokrav kun fra 2028 [D]. */` |

## src/data/research.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Forskningstræ. Koster indsigt og tid; giver features og bonusser [D].` |

## src/data/reviewers.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// De fire anmeldere (spec 6.3). Citater er [D] og må aldrig moralisere.` |
| 61 | D | `/** Hall of Fame kræver også mesterskab i genren: typeniveau mindst dette [D] (spec 8: tidligst i 2018) */` |

## src/data/roles.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Roller, deres faseeffektivitet og rolleskift (spec 6.5). Alle tal er [D].` |
| 66 | D | `/** Rolleskift ("job change") [D]. CRM-specialist er marketing med specialisering. */` |
| 77 | D | `/** xp til næste niveau: 80 + 60·(niveau−1) [D] */` |
| 80 | D | `/** Lønstigning pr. niveau [D] */` |

## src/data/themes.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Temaer. Årstal for tilgængelighed og sæsonbonus er [D].` |
| 9 | D | `/** Sæsonbonus (0-baseret kvartal), fx jul i Q4 [D] */` |

## src/data/town.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Spillerbyen (spec 6.14): 200 pixelpersoner, der repræsenterer spillerens kunder. Tal er [D]; kalibreret, så andelen` |

## src/data/trends.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Trend-events og sportskalender (spec 7.9). [F-mønster], [D]-størrelser.` |
| 36 | D | `effekt: { bettingBsi: -0.15, kasinoBsi: 0.08 }, kilde: '[D]',` |
| 60 | D | `effekt: { offshorePp: 3, afgiftRisiko: 0.2 }, kilde: '[D] spec 7.14: kanalisering −3 til −8 pp',` |
| 64 | D | `effekt: { marketingRoi: -0.05 }, kilde: '[D] spec 6.16',` |
| 68 | D | `effekt: { bettingBsi: -0.08 }, kilde: '[F] $44-50 mia. i volumen i 2025; [D] −5 til −15 %',` |
| 72 | D | `effekt: { marketingRoi: -0.1 }, pres: 1, kilde: '[D] pres +1, marketing-ROI −10 % i 6 mdr.',` |
| 112 | D | `/** Tilfældige trends pr. år [D] */` |

## src/data/trust.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Tilsynstillid pr. kvartal (spec 7.12) [D]` |
| 4 | D | `// Tunet [D]: spec 7.12's −1,5/−2/−2/−1,5 gjorde det umuligt for en grådig udbyder at overleve til 2020 (assertion 1)` |
| 9 | D | `/** [D] Tilsynet ser mest på de store: adfærdsposterne vejer 30 % for en lille udbyder, fuldt fra 5 % markedsandel */` |
| 20 | D | `/** [D] Efter en sanktion strammer firmaet op under tilsynets øjne: tilliden løftes lidt (pr. trin 1-3) */` |
| 22 | D | `/** [D] Mindst så mange uger mellem to trin på trappen */` |
| 25 | D | `/** [D] andel af afstanden til 70, som tilliden trækkes tilbage pr. kvartal */` |
| 27 | D | `/** [D] hyperpersonalisering uden risikoagent med overvågning ≥ 0,6 (pr. kvartal) */` |
| 29 | D | `/** [D] Antal fejl ved lancering, der tæller som "lancering med fejl" */` |

## src/data/verticals.ts

| Linje | Type | Kode og kommentar |
|---:|:-:|---|
| 1 | D | `// Vertikaler. [D] = designestimat, [F] = fakta, [A] = afledt.` |
| 9 | D | `/** Basis-churn pr. uge for aktive kunder [D] */` |
| 11 | D | `/** Ugentlig hold-varians (std.afv. som andel) — betting svinger, kasino er stabil [D] */` |
| 13 | D | `/** Sandsynlighed pr. uge for en "favoritsejr"-uge [D] */` |
| 15 | D | `/** Relativ pris pr. ny kunde — kasinokunder er dyrere [D] */` |
| 26 | D | `churnPrUge: 0.03, // [D]` |
| 27 | D | `holdVarians: 0.22, // [D]` |
| 28 | D | `favoritsejrChance: 0.06, // [D] ca. 3 uger om året` |
| 37 | D | `churnPrUge: 0.025, // [D]` |
| 38 | D | `holdVarians: 0.04, // [D]` |
| 40 | D | `cacFaktor: 1.35, // [D]` |
