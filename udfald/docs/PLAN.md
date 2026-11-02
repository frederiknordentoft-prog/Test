# Plan: UDFALD, en mobil sportsbook-prototype, hvor du handler kampens fremtider

## Context

Brugeren vil have en mobil-only prototype af en sportsbook. Den skal være et reelt alternativ til Oddset i AAA-kvalitet og må ikke ligne en standard-sportsbook. Den skal nytænke fire ting: hvad man spiller på, hvordan odds bygges, hvordan de visualiseres, og hvordan bets sammensættes. Den skal låne fra mindst tre andre brancher og føles lige så levende som Polymarket eller et aktiemarked.

Repoet har `sportsbook-x/` v0.2 (Haiku-forsøget). Den er konservativ og bliver liggende urørt.

**Låste beslutninger fra brugeren:**
- Ny app i en ny mappe. Kun oddsmotoren genbruges.
- Fuld vitalitet uden anti-kompulsions-regler.
- Levering som privat Claude-artifact-link.
- Én Superliga-hero-kamp poleret i bund plus én sport mere.

**Grundlaget er to workflows og ét arkitekt-review (19 agenter):**
1. **Research** over 7 spor. Briefet ligger i `udfald/docs/RESEARCH.md`.
2. **Koncept-turnering:** 5 koncepter, 3 dommere, syntese og red team. Resultatet ligger i `udfald/docs/KONCEPT.md` og `udfald/docs/KRITIK.md`.
3. **Arkitekt-review af denne plan.** Alle blockers og majors er indarbejdet.

**Turneringen:**
- "Kampen som marked" (arbejdstitel ØRE, nu UDFALD) fik 22,5 point og "Kampen som vejr" (FRONT) 22.
- Red team fandt en blocker: syntesen ville læses som "Polymarket oven på Oddset".
- Planen kombinerer derfor de to. FRONT's **fremtidsvifte** bliver helten, og markedskonceptets mekanik bliver transaktionslaget.

**Detaljereference:** `udfald/docs/KONCEPT.md` (fuld spec) og `udfald/docs/KRITIK.md` (red team). Hvor de afviger fra denne plan, gælder planen.

---

## 1. Konceptet

**UDFALD.** Ordmærket er navnet med en tynd, stigende kurslinje under. Navnet siger, hvad man køber: et udfald. (Arbejdstitlen var ØRE, mens prisen hed øre; se §17 og §18.)

**Pitch:** Hver kamp er en sky af mulige fremtider. UDFALD viser 100 af dem som et levende, forgrenet lystræ, og du køber andele i de fremtider, du tror på, til en kurs fra 0 til 100. Ved slutfløjt er hver andel 1 kr eller 0 værd.

**Hvorfor det ikke er en sportsbook:** Oddset sælger dig et tal på en kupon. I UDFALD ser du selve sandsynligheden:
- 54 af 100 fremtider ender med FCK-sejr. Derfor koster en andel 55 øre, svarende til odds 1,82.
- Du kan se, hvorfor prisen flytter sig.
- Du kan sælge hvert sekund.

**Prisenheden:** øre pr. 1 kr udbetaling. Op betyder altid mere sandsynligt. Odds står som sekundær tekst. De første 30 sekunder står der ankeret "55 øre → 1 kr hvis FCK vinder".

**Vitalitet med årsag, ikke falsk støj.** Jeg følger valget om fuld vitalitet, men udelader bevidst tilfældig jitter. Research (NYT-nålen, F1 Live Timing) viser, at bevægelse uden årsag læses som upålidelig data. Bevægelsen kommer i stedet fra:
- crowd-ordreflow på cirka 2 handler/s
- pres, der bygger op
- tid
- spring ved begivenheder

Hvert udsving på 1 øre eller mere får en synlig årsagschip.

## 2. Lånte brancher (6, kravet er mindst 3)

| Branche | Mekanik | Hvor |
|---|---|---|
| **Meteorologi** (ECMWF-ensembler, DMI, Dark Sky "næste time") | **Fremtidsviften:** 100 simulerede prisstier fra NU til slutfløjt, hvor tællingen ved højre kant er prisen. **Målvejret:** målchance pr. 5-min-vindue med en DMI-sætning | Helten og båndet under den |
| **Børs og prediction markets** (Polymarket, Nasdaq LULD-stop, auktioner) | Øre-andele, **handelsstop** med skraveret bånd og mærket gab, **købsgrænser** (limit) der fyldes i gabet, og åbnings- og lukkeauktion | Viften og bakken |
| **Musikproduktion** (mixerpult, sidechain) | **Salgsfader** med riflet knap, graveret skala "Alt · ½ · Indsats hjem" og VU-niveau. **Sidechain-pump** i stedet for skærmrystelse | Positionskortet og målmomentet |
| **Sports-tv-grafik** (Orads virtuelle rekordlinje) | **Spøgelseslinjen:** medianen af de vindende stier, frosset ved købet. Vises automatisk 3 s efter køb og ved statusskift | I viften |
| **Online-skak** (chess.com Game Review) | **Træk-karakterer** fra closing line value i logit (mid til mid). "Karakteren måler købet, ikke udfaldet." | Afregningen |
| **Elektronik** (oscilloskop-trigger) | Håndbold som signal. Du trækker et triggerniveau, der prissættes som first passage | Hallen |

Støttelån: hold-for-indsats som en talebesked, og hit-stop som håndværk.

## 3. Skærme og tilstande (kun rene `#navn`-hashes, ingen storage)

| Hash | Indhold |
|---|---|
| `#lobby` | To levende kort. Derbyet viser åbningsauktionen, hvor glimt konvergerer mod "Åbner 49". Hallen viser et live skopspor. Gaten "Tryk for at åbne handlen" har en forklaring på tre linjer og låser lyd og rAF op på `click`. Footer: "Prototype · fiktive kurser · ingen rigtige penge" |
| `#demo` / `#demo-hallen` | Gaten "Se demoen". Tappet er t = 0, og en markeret spøgelsestommel kører derefter `demo90`/`hallen20` |
| `#kamp` | FCK–Brøndby (§4) |
| `#byg` | Byg en fremtid (§5.4) |
| `#portefolje` | Bundark med fiktiv saldo (5.000 kr), positioner, købsgrænser (med reserverede midler), byggede fremtider og afregnede spil |
| `#afregning` | 1X2-flod, handler som prikker, præcist regnskab og træk-karakterer |
| `#hallen` | Aalborg–GOG (§6) |

**Tilstande, der skal designes:**
- Før kamp (auktion).
- Pause: aksen er kamptid med en markør, og der er intet tidshenfald.
- Slutfløjt før Afregningen.
- Ingen position: coach-teksten "Hold på et udfald for at købe".

**Degraderede tilstande i HUD'en:** worker-fallback, lyd blokeret og font-fallback.

**Navigation:**
- Synlig tilbage-chevron og intet swipe-ned (lukker ellers Claude-arket).
- `html, body { overflow:hidden; overscroll-behavior:none }`.
- **Ingen `viewport-fit=cover`.** Det har sportsbook-x, og artifact-guiden advarer om, at Claude iOS så tegner siden under sin topbjælke.

## 4. Hero-skærmen (`#kamp`)

Den er højde-adaptiv: en flex-stak med 7 bånd og en elastisk vifte (220–360 px). Goldens tages ved 390×664, 744 og 844.

**Budget:** højst 12 levende tal. Højst 3 DOM-regioner må animere samtidig uden for canvas, og højst 4 under en måls T3-sekvens.

| # | Bånd | Indhold |
|---|---|---|
| 1 | Kampbånd (44) | Chevron, FCK-monogram, "0–0", BIF-monogram, "27'", ÅBEN/STOPPET/LUKKET og lyd-pille |
| 2 | Instrumenthoved (84) | "FCK vinder ▾", "**55** øre" og "54 af 100 fremtider · odds 1,82". Årsagschippen er forankret inde i canvas ved linjehovedet |
| 3 | **Fremtidsviften** (canvas, elastisk) | Se nedenfor |
| 4 | Andelsbar (56) | Én segmenteret bar FCK \| X \| BIF, hvor bredden er prisen. Segmenterne er mindst 48 px, og ask står inde i segmentet. Tap vælger fokus og åbner bakken. Træk over to segmenter giver dobbeltchance |
| 5 | Målvejret (84, kompakt 48 under 700 px) | Overskrift fra samme tick med scope i sproget ("Et mål er sandsynligt inden 42' (52 %)"). Søjler pr. resterende 5-min-vindue. Hele rækken er hit-mål. Tap eller træk køber vinduet, og Tørvejr er Nej-siden |
| 6 | Positionskort (84) | "510 andele @ 49 · Værdi nu 270 kr ▲ · Ved sejr 510 kr · sælg til 53" og fader (`role=slider`) |
| 7 | Bundbjælke (44) | Lobby · Byg · Portefølje +20 kr |

Ved 844 px går overskuddet over viftens loft på 360 px til luft mellem båndene, så viften ikke vokser.

**Fremtidsviften (helten).** Kun Resultat (1X2) og dobbeltchance har vifte. Vinduer, Næste mål og byggede fremtider vises som en linje uden stier.

**X-aksen**
- NU står fast ved cirka 52 % af bredden.
- ±10 kampminutter omkring NU er lineære med samme px/min på begge sider. Længere ude komprimeres historik og fremtid.
- Ved slutfløjt står højre kant med en tally "54 · 25 · 21" (FCK · X · BIF).

**Y-aksen**
- Fokus-fisheye: kvote ±15 øre fylder 60 % af højden, resten komprimeres, så stierne kan nå 0 og 100.
- Re-centrering sker kun mellem begivenheder, aldrig under en T3.

**Linjen** tegner den kontinuerlige ask før afrunding, så den ånder i stedet for at trappe.

**Stierne (100)**
- Stratificeret og indeks-stabil udvælgelse: for hvert udfald o tages de første round(100·p_o) stier (største rest, sum 100) fra en fast permutation af de MC-stier, der ender i o. p_o er DP-fair-prisen.
- Tallet ved højre kant er dermed præcis prisen.
- Formel: strand_j(t') = T[t'][d_j(t')] + T_π[t'][d_j]·(π_j(t') − π̄(t')) + δ·(t_FT − t')/(t_FT − NU). δ er (kontinuerlig ask − fair), beregnet ved render, så der aldrig er et hak ved NU.
- **Udseendet er et forgrenet træ:** en fælles stamme, der deler sig ved mål og ender i 0 eller 100. Det bekræftes i F0's look-dev.
- Laget caches offscreen ved hver MC-opdatering (én `drawImage` pr. frame). Stierne lerper over 300 ms, og ind- og udgående stier krydsfades.
- **Ingen p10–p90-bånd og ingen median.** De ville hoppe ved hvert springniveau.

**Grenmærker**
- "Mål FCK → 69 · Mål BIF → 27 · Intet mål → 47" står i en fast højre-gutter med kollisionsløst y, ledelinjer og hit-rækker på 44 px.
- Horisonten er min(10', halvdelen af resterende tid).

**Lag**

| Status | Lag |
|---|---|
| Altid | Linje, hoved, handelsglimt (neutrale ▲/▼), NU-linje med pres-tone, stier, tally, grenmærker |
| Kun når relevant | Dit købspunkt, købsgrænser (tegnet ved den faktiske fill-tærskel), begivenhedsglyffer på baseline, spøgelseslinjen, stop-bånd |

**Spol:** under ×16 vises kun stammen og grenmærker. Stierne blomstrer igen ved ×1.

## 5. Signaturøjeblikke

**5.1 Mål.** Én T3, og viftens brand og blomstring hører til den.
- **0 ms:** hit-stop på 80 ms og STOPPET.
- **80 ms:** guldring i canvas. Stierne, hvis næste mål var et BIF-mål (cirka 30 %), lyser op, og resten brænder til aske over 400 ms.
- **160 ms:** stop-bånd.
- **1.200 ms:** genåbning med et mærket gab ("−29 øre"), og den nye vifte blomstrer fra NU.
- **Bagefter (T2-kø, forskudt 150 ms):** sidechain-pump, vindue ✓, fyldt købsgrænse (violet tik og pluk) og "Efter målet".
- "Ved sejr" står stille hele tiden.

**5.2 VAR.**
- Viften klapper sammen til to spøgelseskurser: "Godkendt ≈ 32 / Annulleret ≈ 17".
- Kun "Målet står?" er åbent. VAR-sandsynligheden er en martingale, og den scriptede dom vælges ved seed-søgning.
- Ved dommen størkner det ene spøgelse, og det andet fordamper.

**5.3 Hval.** T3 med en ring kun hvis Δmid ≥ 1 øre, ellers et T1-glimt. Chippen viser "−3 øre: storordre BIF". Tilbagefaldet ses som synlige modhandler (glimt ved hovedet).

**5.4 Byg en fremtid (bet-kompositionen).** Kombination er filtrering af fremtider.
- **Visual:** fuldskærm med 100 stier tegnet som **scoreforløb**: y er målforskel med trin ved hvert mål, og endepunkterne stables til et histogram over slutresultater.
- **Ben-chips:** Resultat, "Mindst N mål", Begge scorer og Målvindue (som skygger sit bånd på tidsaksen).
- **Filtrering:** hvert ben brænder de stier af, der ikke opfylder det. Tælleren viser "X af 100 tilbage", hvor X kommer fra stratificerede overlevere, så |X − 100p| < 1.
- **Pris:** alle ben, både hver for sig og samlet, prissættes fra de samme 5.000 MC-stier. 1X2-ben skaleres med p_DP/p_MC.
  - Marginen lægges på med power-metoden, kappet ved 99.
  - Minimum er 5 % fair ("For usandsynlig at bygge").
  - Linjen "Hver for sig 14 · samlet 17 · de hænger sammen" vises kun ved et løft på mindst 15 %.
- **Køb:** en byggefremtid får sit eget ticker-navn og sin egen linje i porteføljen og kan sælges.
- Demo-kombinationen (fx "FCK vinder" + "Mål 60–70'" ved 54' og 0–1) og alle tal i teksten genereres af `tune-demo`.

**5.5 Køb og salg.**
- **Bakken** (cirka 300 px):
  - Porteføljelinjen står øverst, "Udbetaling ved sejr 510 kr" står stort, og der er en almindelig **Køb 250 kr**-knap.
  - Fra et grenmærke er overskriften "Næste mål FCK · 42 øre – sker det, går FCK vinder til ≈ 69".
- **Hold-for-indsats** er en genvej: 10 → 1.000 kr og køb ved glid op. Gestus-tilstandsmaskinen:
  - Træk-over skal ske inden 250 ms, ellers starter ringen.
  - Vandret bevægelse annullerer.
  - Langt tryk på viften laver en købsgrænse-kladde. Et lodret træk sætter niveauet (hele øre), og når du slipper, åbner bakken.
  - Træk til højre for NU scrubber ind i fremtiden og viser tallyen på det minut.
- **Én låsering** (1,5 s): fill ved låst ask ±1 øre, ellers "Kursen flyttede sig – acceptér 58?".
- **Hele andele:** k = ⌊100·S/ask⌋.
- **Faderen** sælger til bid med magnet-hak, der flettes, hvis de ligger nærmere end 32 px. Udlæsning: "Sælg 365 → 350 kr nu · 529 kører gratis".

## 6. Hallen (håndbold, Aalborg–GOG)

- **Oscilloskop:** målforskellen som et firkantsignal i fosfor med efterglød (sweep-ryddet). Gitteret er banens linjer: 0, ±5 og ±8. Overtal vises som et skraveret bånd, og passivt spil som 4 pips.
- **Trigger:** træk niveauet og vælg en deadline-chip ("+4 før 45'"). Prisen er first passage med drift og kontinuitetskorrektion. Ved ramning: freeze-flash på 120 ms og afregning til 100. Farven adskiller sig fra GOG-blå.
- **Markeder:** Aalborg/X/GOG og trigger. "Næste angreb" er skåret.
- **Motor:** angrebs-Markovkæde kalibreret til cirka 61 mål. σ udledes af kæden og bruges i formlen. Uret er 1 kampminut = 8 s.

## 7. Markeder i v1

| Familie | Kontrakter | Prismotor | Margin |
|---|---|---|---|
| Resultat | FCK, X, BIF og dobbeltchance (pris = min(fair + margin, sum af ben − 1)) | DP | 3 % / 4 % |
| Næste mål | FCK, Ingen, BIF (via grenmærker) | DP | 5 % |
| Målvejret | "Mål i [a,b)" Ja/Tørvejr og "Efter målet" | DP (fremrulning af d til a, derefter overlevelse) | 9 % / 10 % |
| VAR | "Målet står?" Ja/Nej | Martingale | 8 % |
| Byg en fremtid | 2–3 ben (inkl. "Mindst N mål" og Begge scorer, kun her) | MC | 12 % |
| Værktøj | Købsgrænse (kun køb, højst 3, midler reserveres) | – | – |
| Hallen | Aalborg/X/GOG og trigger | Stern/first passage, MC-krydstjek | 4–8 % |

Vinduer er halvåbne, og mål i et vindue afventer VAR. Ny-opståede kontrakter har chippen "Afregnes på: …".

## 8. Oddsmotoren (én λ, én seedet simulation)

**Determinisme**
- Tilstand = f(seed, instruktør-tidslinje, tick). Separate mulberry32-strømme bruges til feed, pres, crowd, støj og VAR.
- Alle sim-konstanter angives i **kamptid**. Halts og VAR kører i kamptid, og en aktiv T3 tvinger ×1.
- Præsentationsuret er simTime − 100 ms. Canvas-effekter, DOM-effekter og Web Audio planlægges alle på det.
- Checkpoints hver 100. tick gør `setTick` og lobbyens indhentning billig.
- Hashes sammenlignes kun inden for samme JS-motor.

**Intensitet:** λ_i(t) = c_i·(λ_i^pre/90)·s(t)·m_score(d)·m_red·e^{π_i}·(1+α·xT(z))·(1+E_i)
- λ_FCK^pre = 1,60, λ_BIF^pre = 1,10 og ρ = −0,08.
- π er en OU-proces i kamptid med spark ved hjørner og chancer.
- Boldzonen er en dwell-kæde med 6–10 kampsekunders ophold.
- E stammer kun fra mål, der er sket, både i DP og MC.

**Én målproces:** feedet trækker mål ved thinning af λ. Skud er kosmetiske, og hvert mål tegnes som et skud. MC simulerer samme sparkproces som feedet.

**DP over (t, d)** i trin på 15 kampsekunder:
- Dynamisk m_score, henfaldende pres og en offline-genereret tabel E[e^{π(s)} | π₀], så sparkene er med.
- Prissætter 1X2, Næste mål, vinduer og grene (T[·][d±1]).
- Leverer T og T_π til stierne.
- Totaler som enkeltmarked ville kræve (t, F, B). Det er fase 2.

**Monte Carlo**
- 5.000 stier med tællerbaseret hash32 (CRN). Samme kode kører i worker og hovedtråd.
- Kører hver 3. tick, tick-låst, og på efterspørgsel (Byg).
- Worker fra egen fil eller blob, detekteret med round-trip. Fallback i hovedtråden er time-sliced (højst 4 ms pr. frame) og opdaterer cirka 1 Hz.
- Invariant: gennemsnitlig |MC − DP| ≤ 1 pp og p99 ≤ 3 pp.

**Markedslag**
- **Én kvote pr. kontrakt pr. tick:** heltals-ask (power-metoden, Σ ask 1X2 = 103 ± 1) og bid, med hysterese 0,6 øre i motoren. Alle UI-flader læser den samme kvote.
- **Crowd:** LMSR (b ≈ 400.000) med Hawkes i kamptid. Lognormale størrelser (median 150 kr), cirka 35 % salg og 1–3 hvaler pr. halvleg. Informeret modflow ∝ |mid − anker| gør tilbagefald synligt.
- **Støj:** logit-OU, kappet ved ±0,45 øre.
- **Spread:** mindst |overshoot| + 1 øre, indtil overshoot er under 0,5.

**Årsagsattribution:** 2 kampminutters vindue, rækkefølgen hændelse → tid → pres → flow → støj (genberegning med ét led ad gangen i logit), og én tærskel på 1 øre.

**Portefølje:** hele andele. En købsgrænse fyldes til første ask efter genåbning ved et gab. Salg sker til bid, og afregning til 100/0.

**Boot og instruktør**
- `window.__ORE_BOOT = {seed, dir, qa, mc, fx}` injiceres i QA via `page.addInitScript`. Brugere får `#demo`.
- Instruktørpanelet åbnes med langt tryk på logoet. Det har Mål, VAR, Rødt kort, Hval og Spol.
- `window.__sim` har `getState`, `setTick`, `fire` og `hash`.
- Spol pauser, mens en gestus, bakke, låsering, halt eller T3 er aktiv.

## 9. Bevægelse, lyd og identitet

**Tempo-tiers**

| Tier | Indhold |
|---|---|
| T0 | Ånde, ≤ 1 Hz |
| T1 | Data. Cifre ≤ 2 Hz med rul på 220 ms, imperativt |
| T2 | Dit (farveblink på 600 ms) |
| T3 | Kamp, én ad gangen |
| T4 | Dit udfald, kan springes over |

Rammens bounding boxes er uændrede under T3/T4.

**Reduceret bevægelse:** intet hit-stop, ingen ring, pumpe eller åndedræt. Data, stop og farveskift bevares.

**QA-tilstand:**
- Motion kører instant eller JS-drevet.
- ViewTransition er slået fra.
- MC kører synkront i hovedtråden.
- Alle golden-effekter drives af præsentationsuret.

**iOS-ydelsesregler**
- Ingen `shadowBlur` og ingen `backdrop-filter` over canvas.
- Glød laves som dobbeltstreg. Efterglød ryddes med sweep.
- Højst 2 synlige canvas, og viften er kappet ved DPR 2.
- dt-baseret renderer og kvalitets-governor (stier 100 → 50 → glød fra → DPR 1,5/1).

**Lyd:** rå Web Audio-syntese efter gate-tappet, med mute-pille. Paletten er klokker, handelstik (højst 8/s), målakkord (FCK glas, BIF messing) med duck, stop-toner, pluk ved fyldt købsgrænse og en afregningstone.

**Farver**

| Rolle | Farve |
|---|---|
| Baggrund | #07090C |
| FCK-data | #5CE1FF (ishvid kun i monogrammet) |
| BIF | #FFD200 |
| Op | #3DDC97, kun P&L og altid med pil |
| Ned | #FF6B5E, kun P&L og altid med pil |
| Købsgrænse | Violet, adskilt fra GOG-blå |

Højst 4 accentfarver på Kampen. Fremkaldelsen (mætning, der vokser med sikkerheden) gælder kun viftens glød.

**Typer:** Roboto Flex (tal), Inter Tight (UI) og Instrument Serif kursiv (karakterer). De hentes via @fontsource som artifactets egne filer, med fallback til `data:`-URI'er, hvis CSP'en afviser dem. Det afklares i F0. GRAD-animationen droppes, hvis fuld-akse-fonten er for tung.

**Format:** `da-DK` overalt.

**Tilgængelighed:** throttlet `aria-live`-pris-resumé, faderen som slider, og en hitzone på mindst 44 px.

## 10. Teknisk arkitektur

**Mappe:** `udfald/` i repo-roden. Branch: `claude/clever-tesla-nyluc5`.

**Stack** (versionerne er tjekket mod npm 1. nov. 2026; sportsbook-x's pins):
- Runtime: react og react-dom 19.3.1 (`<ViewTransition>`-eksporten verificeres i F0), motion 14.9.0, samt @fontsource-variable/roboto-flex, @fontsource-variable/inter-tight og @fontsource/instrument-serif.
- Dev: vite 8.3.5, @vitejs/plugin-react 6.1.2, typescript 7.0.2, vitest 5.0.5 og axe-core 4.14.0.
- QA: den forudinstallerede Playwright og Chromium.
- **Ingen WebGL, d3 eller GSAP.** Alt er Canvas2D. Budgettet er initial JS ≤ 250 KB gzip.

**Genbrug.** Disse kopieres ind i `udfald/src/engine/lib/` med en kildehenvisning, så v0.2 forbliver urørt:
- `mulberry32` og `hashSeed` fra `sportsbook-x/src/odds/rng.ts`.
- `poissonPmf` fra `sportsbook-x/src/odds/model.ts`.
- `bestFraction` og `formatOdds` fra `sportsbook-x/src/odds/format.ts`.
- Playwright-loaderen og long-task-mønstret fra `sportsbook-x/qa/qa.cjs`.

`priceFromProb` og `probsFromState` genbruges ikke (proportional margin og uafhængig Poisson). Ordforbuds-testen følger heller ikke med.

**Moduler:**
```
udfald/docs/         KONCEPT.md, KRITIK.md (fra workflow-output)
udfald/src/engine/   clock, rng(+hash32), football/{intensity,feed,dp,branches,strands,piTable},
                  market/{quote,crowd,noise,halts}, attribution, mc/{paths,select,worker,client},
                  book/{portfolio,saldo,clv}, handball/{chain,pricing}, director/{timeline,demo90.json,hallen20.json},
                  boot, sim.ts
udfald/src/render/   frameLoop (én rAF, præsentationsur, governor), FanCanvas, BuildCanvas, ScopeCanvas,
                  RiverCanvas, Roller (imperative cifre), sound, hud
udfald/src/ui/       App (hash-router), Gate, Lobby, Kampen, Byg, Portefolje, Afregning, Hallen, Director,
                  components/{Kampbaand,Instrumenthoved,Andelsbar,Maalvejret,PositionCard,Fader,Tray,
                  HoldToStake,CauseChip}, gestures/machine.ts, a11y/LiveSummary
udfald/src/store.ts  useSyncExternalStore med grove selektorer (≤ 2 commits/s)
udfald/tests/        vitest         udfald/qa/   qa.cjs + iframe-harness med artifact-CSP
udfald/scripts/      tune-demo.ts, gen-pi-table.ts
```

**Pipeline:**
1. Motoren kører med fast skridt på 10 Hz og dobbeltbuffer.
2. Én frame-loop interpolerer, tegner canvas og opdaterer cifre og CSS-variabler imperativt.
3. React får kun grove ændringer.

**Build og levering:** `vite base './'` og target es2022. `dist/` publiceres med `publish_files` som et privat artifact med titlen "UDFALD · prototype".

## 11. Byggefaser (hver fase slutter med en grøn gate)

| Fase | Indhold | Gate |
|---|---|---|
| **F0 Spike og look-dev** | Scaffold, tokens, gate og router. Testside med canvas-loop, worker (fil og blob, round-trip), Web Audio, fonts (egne filer → `data:`-fallback), CSP-violation-lytter i HUD'en, ViewTransition-check, benchmark af 100 additive stier ved DPR 2/3, og host-gestus-test (lodrette træk, long-press-callout, kant-swipe). **Look-dev-frames af viften** med mock-stier ved 664 og 844, sendt til brugeren. Publiceres tidligt som artifact | Brugeren ser look-dev og åbner linket på telefonen. HUD'en viser worker/fallback, fonts, fps og CSP-fejl. F1–F2 venter ikke på telefontjekket |
| **F1 Motor** | Ur, intensitet, feed, π-tabel, DP, grene, kvoter, crowd, støj, halts, attribution, portefølje og saldo, instruktør, boot og `__sim` | Vitest: determinisme, Σ ask 103 ± 1, målkalibrering (1.000 derbyer: 2,7 ± 0,15 og FCK ≈ 48 ± 3 %), **priskalibrering** (2.000 kampe, hver decil af DP-pris inden for ±3 pp af faktisk frekvens), købsgrænse-fill i gab, VAR-martingale og nul støjflip uden hændelser |
| **F2 MC** | Stier, stratificeret udvælgelse, worker/main og Byg-priser | MC og DP stemmer overens. Tallyen er lig prisen (\|X − 100p\| < 1) hver opdatering. Indeks-stabilitet (højst 5 stier skifter pr. opdatering uden hændelser). Main-fallback uden long tasks over 50 ms |
| **F3 Kampen** | Vifte, hoved, andelsbar, Målvejret, positionskort og fader, bakke, hold-for-indsats, købsgrænser, mål/VAR/hval-sekvenser, lyd og tilstande | Goldens ved 664/744/844, chrome-stillhed, regionstæller, gestus-konflikttests og axe uden kritiske fund |
| **F4** | Byg en fremtid, Porteføljen og Afregningen | Regnskab på øret, CLV-karakterer asserteret og Byg-tal fra `tune-demo` |
| **F5** | Hallen og levende lobbykort | 58–64 mål, triggerpris inden for ±3 pp af MC og `hallen20` |
| **F6** | `demo90` (inkl. cirka 8 s Byg i pausen), `tune-demo`, governor, QA-suite, README, publicering og push | Alle kriterier i §12 |

## 12. Verifikation

**Kommandoer** (fra `udfald/`):
```
npm test
npm run build
npm run preview
node qa/qa.cjs
```

**`npm test`:** motor-egenskaber, determinisme (samme seed og tidslinje giver samme hash 3 gange), mål- og priskalibrering, portefølje-aritmetik, tally lig pris, dansk formaterings-lint og farve-token-lint.

**`npm run build`:** typecheck plus dist. Initial JS ≤ 250 KB gzip.

**`qa/qa.cjs`** (Playwright i et cross-origin iframe-harness med artifact-CSP og `__ORE_BOOT`):
- 0 CSP-overtrædelser og 0 fremmede requests.
- Goldens (åbning, hval, mål-frame, VAR-split, Byg, Afregningen) ved 3 højder i QA-tilstand.
- p95 frame ≤ 16,7 ms ved 1× og ≤ 33 ms ved 4× throttle, ingen LoAF over 50 ms, heap-vækst under 5 MB pr. min og CLS 0.
- Udbetalingstal synlige hver 50. ms gennem mål og VAR.
- Vitalitetsgulv: hovedet bevæger sig, og der kommer mindst ét glimt pr. 2 s ved 1×.
- Reduceret bevægelse.
- Worker blokeret → prissætning inden for 1 s.

**`demo90`:**
- Slutfløjt 1:23 ± 2 s og Afregningen 1:27 ± 2 s.
- Præcise fills og faderens bid fra `tune-demo`.
- Ingen "Kursen flyttede sig" eller "Handlen er stoppet" under scriptet.

**På en rigtig enhed:** brugeren åbner artifact-linket i Claude iOS-appen. HUD'en (langt tryk på logoet) viser fps, p95, worker, fonts og kvalitetsniveau. Chromium-målinger dækker ikke WebKit, så telefonen er facit.

**Forståelse** (manuel efter levering): 5 Oddset-brugere ser skærmen i 10 s. Mindst 4 af 5 skal kunne sige prisen, udbetalingen og hvordan man sælger. Blind 5-sekunders test: højst 1 af 5 siger "betting-app som Oddset/Polymarket".

## 13. Bevidst skåret i v1 (fase 2)

- Score-terræn og "Køb denne udsigt"
- Midtercirklen
- Totaler som enkeltmarked
- Målscorere
- Parken-puljen
- Sæsonkontrakter
- Trader-lag
- Stop-loss og take-profit
- Næste angreb i håndbold
- Draft-noder, kill feed, Balatro-slip og feberfinale (dommerne kaldte det casino-grammatik)
- Sequencer
- Pres-indeks-markeder
- WebGL og partikler
- Treemap-lobby
- Synk med TV

## 14. Risici og modtræk

| Risiko | Modtræk |
|---|---|
| Iframe-forhold i Claude iOS (worker, fonts, gestus, viewport) | F0-spiken tester dem først. Main-thread-MC og `data:`-fonts er forsikring |
| Viften ligner et træ mere end spaghetti | Det omfavnes som "lystræ" og afklares med brugeren via look-dev i F0, før F3 |
| iOS-ydelse (Low Power Mode 30 fps, termisk throttling) | dt-renderer, governor og offscreen-cache af stier |
| Overload | Lagbudgettet, regionstælleren og §13 |
| Viften læses som en garanti | Synlige stier, "X af 100"-sproget og tally lig pris |
| Demo-skrøbelighed | Instruktør-JSON er eneste kilde, og `tune-demo` genererer og asserterer alle tal i teksten |

---

## 15. F0-fund og planændringer (1. nov. 2026)

Målt i headless Chromium i et cross-origin iframe-harness med artifact-lignende CSP. Telefonens diagnoserapport er facit.

| Fund | Ændring i planen |
|---|---|
| I en opaque-origin sandbox virker kun **klassiske blob-workere**. Module-workere, workere fra egen fil og `data:`-workere fejler | Alle workere bygges som iife (`worker.format: 'iife'`). Klienten prøver egen fil → inlinet blob → hovedtråd med ping-round-trip |
| Pris kun som funktion af (t, d) giver identiske stier pr. stilling, så viften bliver til få kurver | **Pres pr. sti** (OU i kamptid, opdateret pr. kampminut og interpoleret) indgår i MC-intensiteten og i stiens pris. Den indgår også i F1/F2-motoren |
| Stykvis lineære akser giver knæk i stierne | **Glatte akser**: log-warp om NU med samme hældning på begge sider og tanh-fisheye om prisen |
| Det viste pris-offset (pres og flow) skal med i udvælgelsen, ellers passer "X af 100" ikke med prisen | Udvælgelsen bruger de viste sandsynligheder. Tallyen er testet lig `largestRemainder(p)` |
| Et blit pr. frame og akse-bisektion pr. punkt dominerede CPU | Viften tegnes kun ved dataændring i to stablede canvas med CSS-krydsfade. Hovedet er et DOM-element med CSS-animation, og der er intet rAF-loop i hvile |
| Ved 4× CPU giver native canvas-raster stadig long tasks på 100–600 ms (software uden GPU) | Måles på telefonen. Rammer det også WebKit, flyttes stregtegningen til OffscreenCanvas i workeren i F2/F3 |
| Viften fortjener mere plads end 360 px | Elastisk 220–440 px |
| MC pr. kampminut: 230 ms med gauss pr. trin | Rate-tabeller og pres pr. minut giver 45–70 ms |

**Look-dev-varianter:**
- A · Lyn: ærlige målspring som svage tråde og glatte plateauer.
- B · Langtid: A som tone-mappet langtidseksponering. Den er tungere (`getImageData`).
- C · Spaghetti: glattede spring.

C er den smukkeste, men dens glatning får stierne til at stige *før* målet. Det er en lille usandhed om fremtiden.

---

## 16. Status ved levering (F0–F6)

**Bygget efter planen:**

| Del | Indhold |
|---|---|
| Motor | Deterministisk derby-simulation med markedslag, DP-prissætter og visningslag |
| Monte Carlo | Fremtidsviften (100 stratificerede stier, hvor tally = pris) |
| Kampskærm | Handelsstop, gab og VAR-spøgelser, købsgrænser, hold-for-indsats, låsering med genkvotering, fader, Målvejret med sammensatte vinduer, sidechain-pump, brand ved mål og lyd |
| Øvrige skærme | Byg en fremtid, Portefølje, Afregning med træk-karakterer, Hallen (oscilloskop og trigger), levende lobby, instruktør, demo med spøgelsestommel, diagnose |

**Afvigelser, ærligt:**
- **React-commits** er begrænset til højst 4 Hz (planen sagde 2 Hz). Canvas tegnes imperativt.
- **Goldens** er screenshots til gennemsyn (`qa/out/`), ikke pixel-diff-gates.
- **Ydelse:** måles i headless Chromium med software-canvas. WebKit er ikke installeret her, så iPhone i Claude-appen er facit (HUD: langt tryk på logoet → Debug-HUD).
- **Demoen** varer cirka 85 s og ikke præcis 90.
- **Håndbold-triggeren** "+4 før 45′" fra 38′ ved +1 koster 24 øre, ikke de 42 i KONCEPT.md, fordi σ er udledt af kæden: 0,65 og ikke 1,0.
- **Theta, stop-loss/take-profit og totaler som enkeltmarked** er ikke med (fase 2).
- **Forståelsestest** med 5 Oddset-brugere er ikke udført. Den er manuel og ligger efter levering.

---

## 17. Prisenhed: kurs (2. nov. 2026)

Brugeren valgte "kurs" i stedet for "øre" som prisenhed i brugerfladen: "FCK kurs 55 · 54 % chance".
- **Prisændringer og gab** hedder "point".
- **Sandsynligheder** står i procent ved prisen, og "X af 100 fremtider" bliver i viften og i Byg.
- **Uændret:** motor, kvoter og tal (kurs 55 = 55 øre pr. andel, der betaler 1 kr). Brandet hed dengang ØRE (se §18).

---

## 18. Navnet: ØRE → UDFALD (2. nov. 2026)

Navnet ØRE hang sammen med prisenheden øre. Da prisen blev til kurs, valgte brugeren **UDFALD**: navnet siger, hvad man køber.
- **Ordmærke:** UDFALD med en tynd, stigende cyan kurslinje under. I Kampbåndet bruges "U" med samme streg.
- **Familienavn:** markedsfamilien FCK / X / BIF hedder nu **Resultat**, så navnet ikke får dobbeltbetydning. Brugen som navneord ("et udfald") er uændret.
- **Interne navne:** mappen er `udfald/`, pakken er `udfald`, globalerne er `__UDFALD_BOOT` og `__udfald`, og fontfamilierne er "UDF …".
- **Historiske dokumenter:** KONCEPT.md, KRITIK.md og RESEARCH.md er bevaret som besluttet, med en note øverst.

## 19. Tre nye funktioner: mål i alt + slutresultat, sikring, Parken-puljen (2. nov. 2026)

Brugeren valgte tre funktioner fra fase 2-listen. Planen blev gennemgået af en arkitekt, der målte mod den bundtede motor; hans fund er rettet før bygning.

**Mål i alt og slutresultat**
- **Én model:** `scoreGrid` (fremad-DP over manglende mål pr. hold, masse over 10 samlet i 10) giver 1X2, Over/Under og alle celler. Gitterets 1X2 er lig `price1x2` til 1e-11, Over er lig `totalsBack`.
- **Over 2,5 er simulationens anden kurs:** fair pr. substep fra samme rate-gitter som 1X2, 6 % power-margin, hysterese 0,6 point, frosset under handelsstop og med eget gab ved genåbning (`gapO25`). Historikken ligger i egne arrays, så 1X2-historikken er uændret. Golden hashes for tre kampe er bit for bit de samme som før.
- **Pris:** Over/Under-linjer 0,5–4,5 har 6 % margin. Én celle har ⌈100·p·1,15⌉, en region min(⌈100·Σp·1,10⌉, Σ celle-kurser − (n − 1)). Celler under 3 % og umulige celler er lukkede.
- **Afregning:** Over afregnes ved det godkendte mål, der krydser linjen (annullerede VAR-mål tæller ikke). Et slutresultat afregnes til 0, så snart alle dets celler er umulige. Ved slutfløjt fejes resten.
- **Rettet samtidig:** næste mål afregnes nu efter antal godkendte mål, som visningen navngiver det (før blev annullerede mål talt med). Ukendte kontrakter er aldrig åbne.
- **Viften kan følge Over 2,5:** fokus er `0 | 1 | 2 | 'o25'`, og alt læser én `FocusSpec`. Stierne stratificeres efter Over/Under, så tally = pris ("35 Over · 65 Under").
- **Kalibrering:** in-play inden for 1,3 pp pr. decil; DP'en ligger 0,8 pp lavt ved kickoff (arkitekten målte 2,4 pp i et mindre udsnit).
- **Pris for præcisionen:** Over 2,5 koster cirka 0,1 ms pr. substep (tre lag i DP'en mod 1X2's to), cirka 1 % CPU ved ×8.

**Sikring**
- Højst ét stop-loss og én "Sikr gevinst" pr. position, kun på 1X2 og Over/Under 2,5. Den ene annullerer den anden.
- **Stop:** udløses, når ask − 2 ≤ niveau og markedet har været åbent mere end 7 substeps efter genåbning. Spread-udvidelse og overshoot kan altså ikke udløse det. Det sælger alt til aktuelt bid, "til første kurs efter stoppet".
- **Sikr gevinst:** udløses, når bid ≥ niveau, så fill aldrig ligger under niveauet.
- Aldrig under handelsstop. Ryddes, når andelene når 0. Et stop ved eller over en aktiv købsgrænse afvises (og omvendt).
- Viften viser koral "Stop 30" og mint "Sikr gevinst 80". Bakken viser den præcise udbetaling ved udløsning.

**Parken-puljen**
- Pulje på 1X2, lukker ved pausen. Udbetaling = indsats ÷ vindersidens sum × pulje × 0,90. Refusion, hvis vindersiden er tom.
- Publikum er simuleret og deterministisk: puljen vokser med crowd-købsvolumen (hvaler kappet), og siderne følger **modellens fair pris** med en lille hjemmebias (1,035 / 0,985 / 0,985).
- **Afvigelse fra planen:** planen sagde "den viste mid, glattet". Mid'en bærer hvalernes persistente flow, så man kunne handle mod en hval og få over 0,95 igen. Fair pris er en martingal, så forventet udbytte pr. krone er strukturelt ≤ 0,9 · 1,035 / 0,985 ≈ 0,946 på enhver side i ethvert minut. Visningen glattes over 1 kampminut, men siderne snappes til fair ved lukning og under handelsstop.
- **Afvigelse i testen:** planen sagde 300 kampe med realiseret udfald. Udbetalingen afgøres ved lukning, så minuttet for indsatsen betyder intet; testen måler den betingede forventning ved lukning over 20 kampe gennem den rigtige store (realiseret udfald over 300 kampe har en standardfejl på cirka 0,08 og kan ikke skelne 0,90 fra 0,95).

**Navigation:** bundbjælken er Byg · Mål · Pulje · Portefølje med to linjer pr. knap. Lobbyen nås via chevronen.

**Verifikation:** 64 tests (49 uændrede), heriblandt `tests/totals.test.ts` og `tests/features.test.ts`. QA kører de nye flows gennem UI'et, chrome-still med begge fokus og axe på `#maal`, `#pulje` og sikringsbakken.
