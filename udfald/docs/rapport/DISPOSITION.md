# Disposition for UDFALD-rapporten

Hver skriver ejer bestemte filer i `kapitler/`. Filnavn, `id` og `data-nr` er låste. Kildestier er relative til `udfald/`.

**Omfang (cirka 36–40 sider i alt, mørkt A4):**
- **Del I:** cirka 18 sider. Tekst ved siden af telefoner (`duo`), ca. 300–450 ord pr. side.
- **Del II:** cirka 15 sider med tæt prosa og figurer.

**Kampen vi følger:** fri kamp, seed `{{seed}}`.
- **Hvaler** ved 5′, 10′ og 15′.
- **Mål:** FCK-mål {{maal1.ur}}. Genåbning {{genaabning1.ur}} med gab FCK {{genaabning1.gabFCK}} / X {{genaabning1.gabX}} / BIF {{genaabning1.gabBIF}} / Over {{genaabning1.gabOver}}. BIF-mål {{maal2.ur}}. Slut {{slutresultat}}.
- **Køb ved 20′:** FCK 250 kr, BIF 200 kr, Over 2,5 200 kr, slutresultat 1–1 50 kr og 200 kr i puljen på uafgjort.
- **Sikring:** BIF har stop 17 og Sikr 40, Over har stop 30 og Sikr 50.
- **Ved 35′:** slutresultat 2–1 for 50 kr.

---

## Front (skriver W1)

### `kapitler/00-laesevejledning.html`
- **Overskrift:** `<h1 class="kapitel" id="laes" data-nr="">Læsevejledning</h1>`. Siden er uden nummer.
- **De to dele:** hvem de er til, og hvordan man kan læse.
- **Ordforrådsboks:** kurs, point, %, andel, købskurs/salgskurs, udbetaling.
- **Farveboks:**
  - FCK cyan
  - BIF gul
  - Over 2,5 pink
  - op/ned grøn/rød, kun for P&L og altid med pil
  - købsgrænse violet
  - stop koral
  - Sikr gevinst mint
- **"Kampen vi følger":** beskriv historien ovenfor, med figuren `tidslinje`.

---

## DEL I · SPILLET (skriver W1, W2, W3) — "du"-stemme

**Del-skille:** W1 starter `k01` med en `<div class="del">`-blok: `<div class="del" id="del1"><span>Del I</span><h1 class="delh">Spillet</h1><p>…1–2 sætninger…</p></div>`, som står før kapitlets h1.

### W1 · `kapitler/k01-paa-en-side.html`: `id="k1"`, `data-nr="1"`, "UDFALD på én side"
- **Grundidéen:** en andel betaler 1 kr eller 0. Kurs = chance + husets andel, med et eksempel fra {{t20.kursFCK}}/{{t20.midFCK}}.
- **Hvorfor det ikke er en traditionel sportsbook:**
  - 100 fremtider i stedet for odds-tabeller;
  - du kan sælge når som helst;
  - prisen har en synlig årsag.
- **De tre nye funktioner** i én sætning hver.
- Figur `kurs-chance`.
- **Kilder:** README.md, docs/PLAN.md §1, §17 og §18, src/engine/book/portfolio.ts (`sharesFor`).

### W1 · `kapitler/k02-skaermene.html`: `id="k2"`, "Skærmene og vejen rundt"
- **Ruterne:** de 11 ruter (src/ui/router.ts).
- **Bundbjælken:** Byg · Mål · Pulje · Portefølje, med andenlinjerne (src/ui/kamp/Kampen.tsx `BottomBar`).
- **Navigation:** chevronen til lobbyen og instruktørpanelet ved langt tryk på logoet (Director.tsx).
- **Demoen:** "Se demoen".
- **Billeder:** figur `skaermkort` og shot 01-lobby.

### W1 · `kapitler/k03-kampskaermen.html`: `id="k3"`, "Kampskærmen, bånd for bånd"
- **Anatomien:** shot 03-kamp-anatomi med `<figure class="phone anat" data-shot="03-kamp-anatomi">` og `<ol class="anat">` med de 14 punkter fra STIL.md, hvert på 1–3 sætninger.
- **Kampbånd:** status-pillerne AUKTION / ÅBEN / STOPPET / VAR / PAUSE / LUKKET.
- **Instrumenthoved:**
  - etiketten ▾ skifter FCK → X → BIF → Over 2,5 og springer Over 2,5 over, når den er afgjort;
  - "kurs N" og "% chance" (= tally);
  - før 8′ står "udbetaler 100 hvis …", derefter odds og salgskurs;
  - spøgelsesstatus.
- **Fremtidsviften:**
  - 100 stier;
  - tally = den viste chance (mid), ikke kursen;
  - grenmærker for næste begivenhed inden for horisonten min(10′, halvdelen af resttiden);
  - årsagschippen;
  - NU og historikken.
- **Andelsbar:** bredde = kurs, tryk, hold og glid; træk over to felter giver dobbeltchance.
- **Målvejret:** 5-minuttersvinduer og overskriften "Et mål er sandsynligt inden …". Over 2,5-chippen og "Efter målet"-chippen.
- **Kilder:** src/ui/kamp/Kampen.tsx, Fan.tsx, src/render/fan/live.ts, src/engine/football/display.ts.

### W2 · `kapitler/k04-koeb-og-salg.html`: `id="k4"`, "Køb, salg og købsgrænser"
- **Ordresedlen:** shot 04.
- **Prislåsen på 1,5 s:**
  - fylder, hvis kursen er ≤ låst + 1, til min(kurs, låst);
  - ellers "Kursen flyttede sig – acceptér N?".
- **Hele andele:** ⌊100·S/kurs⌋. Eksempel: {{koeb.fck.indsats}} @ {{koeb.fck.kurs}} = {{koeb.fck.andele}} andele for {{koeb.fck.kr}}.
- **Grænser for indsatsen:** start-saldo {{k.START_SALDO}}, højst {{k.MAX_STAKE}} pr. køb.
- **Hold-for-indsats:** trinene 10 → 1.000 kr, glid op for at købe og til venstre for at annullere (shot 24).
- **Faderen:** hakkene Alt, ½ og Indsats hjem.
- **Købsgrænser:**
  - langt tryk i viften, højst {{k.MAX_LIMITS}};
  - pengene reserveres;
  - fyldes til første kurs efter et gab (shots 02 og 23).
- **Kilder:** src/ui/kamp/Tray.tsx, HoldToStake.tsx, src/state/match.ts (requestBuy, processPending, fill), src/engine/book/portfolio.ts.

### W2 · `kapitler/k05-naar-noget-sker.html`: `id="k5"`, "Når noget sker: mål, handelsstop, VAR og hvaler"
- **Målstop:** {{maalStop.substeps}} substeps. Det skraverede bånd "HANDEL STOPPET" og gab-mærket ved genåbning.
- **Rødt kort:** stop på {{k.RED_HALT}} substeps.
- **VAR:** uret står stille, der vises to spøgelseskurser, og kun "Målet står?" er åben.
- **Hval:** viser "storordre" i årsagschippen.
- **Billeder:** shots 11, 13 og 22 med historiens tal (gab +29 osv.).
- **Kilder:** src/engine/football/sim.ts (goal, closeHaltIfDue, runVar, whale), live.ts, display.ts (varQuote, cause).

### W3 · `kapitler/k06-maal-i-alt.html`: `id="k6"`, "Nyt: Mål i alt og slutresultat"
Dette er det vigtigste kapitel i Del I og skal være grundigt.
- **Over 2,5 som kampens anden kurs:**
  - viften, hovedet, baren Over | Under (sum ≈ {{t20.overUnderSum}}) og chippen;
  - tallyen "Over · Under";
  - begge holds mål løfter Over (grenmærkerne).
- **Årsagschippen for Over:** et mål, rødt kort eller VAR flytter den med et hop; ellers trækker tiden den ned, og pres og chancer løfter den.
- **Afregning:** sker i det øjeblik det 3. **godkendte** mål falder. Fokus hopper tilbage til FCK.
- **Mål-skærmen:**
  - 6×6 kort, hvor 5 = 5+, og lysstyrken følger chancen;
  - den aktuelle stilling har en ring, og umulige celler er brændte;
  - "For usandsynligt (under 3 %)";
  - region-knapperne. Uafgjort og BIF vinder er de *samme* 1X2-kontrakter, så de har aldrig to priser;
  - "≈ N af 100 fremtider";
  - Over/Under-linjerne 0,5–4,5, med "Over ✓ passeret";
  - P&L-tonen, kun for kontrakter der afgøres af slutresultatet alene.
- **Eksempler med tal:**
  - én celle: 1–1 ved 20′ ({{q20.cs11.p}}, kurs {{q20.cs11.kurs}});
  - regionen 0–0 + 1–1 (kurs {{q20.r0011.kurs}});
  - Over/Under-stigen ved 20′.
- **Billeder:** shots 07, 08, 09, 14 og 15, plus figur `over25-kamp`.
- **Kilder:** src/ui/maal/Maal.tsx, src/state/focus.ts, display.ts, match.ts (csQuote, closedReason, settleOn).

### W3 · `kapitler/k07-sikring.html`: `id="k7"`, "Nyt: Sikring – stop-loss og Sikr gevinst"
- **Hvor:** Sikring-chippen på positionskortet. Kun 1X2 og Over 2,5.
- **Forslag:** indgang −15 / +25, holdt på den rigtige side af salgskursen.
- **Bakken:** de præcise tekster "til første kurs efter stoppet" og "for mindst …", valideringsbeskeder ("Skal under N"), én af hver slags, og "Den ene annullerer den anden".
- **Linjerne i viften:** koral og mint. Toasts, Portefølje og Afregning. Aldrig under handelsstop.
- **Vagten i klart sprog:** et stop venter 8 substeps (12 kampsekunder) efter en genåbning, så det brede spread efter gabet når at falde til ro.
- **Historien:**
  - BIF-stoppet på {{stop.bif.niveau}} solgte {{stop.bif.andele}} andele til kurs {{stop.bif.kurs}} = {{stop.bif.kr}};
  - uden vagten var det blevet kurs {{udenVagt.kurs}} = {{udenVagt.kr}};
  - bakken havde skønnet ≈ {{stop.bif.bakkeSkoen}}, og forskellen er gabet;
  - Over-gevinsten på {{take.over.niveau}} solgte til {{take.over.kurs}} = {{take.over.kr}}, og Over-stoppet blev annulleret.
- **Billeder:** shots 05, 06 og 12, plus figur `sikring-spor`.
- **Kilder:** src/engine/book/portfolio.ts (placeExit, checkExits, exitSuggestion), src/state/match.ts (afterStep, placeExit), Tray.tsx (ExitTray), Kampen.tsx (SikringChip), live.ts.

### W3 · `kapitler/k08-puljen.html`: `id="k8"`, "Nyt: Parken-puljen"
- **Totalisator i klart sprog:** jo færre på din side, jo mere får du.
- **Publikum:** simuleret. Puljen starter på {{pulje.start}} og {{pulje.startN}} indsatser og vokser med markedets købsvolumen.
- **Hvornår:**
  - åben fra før kampstart;
  - pauset under handelsstop ("Puljen åbner efter stoppet");
  - låst ved pausen;
  - oddsene er skøn indtil da.
- **Regler:**
  - indsats 1–1.000 kr;
  - udbetaling ved slutfløjt;
  - refusionsreglen;
  - huset tager {{k.POOL_TAKE}};
  - den forventede værdi ligger under 0,95 pr. krone med vilje.
- **Historien:** {{pulje.indsats}} på uafgjort. Ved pausen var puljen {{pulje.lukning.total}}, og odds X var {{pulje.lukning.odds.x}}. Udbetalingen blev {{pulje.udbetaling}}.
- **Billeder:** shots 10, 16 og 19, plus figur `pulje-flow`.
- **Kilder:** src/ui/pulje/Pulje.tsx, src/state/match.ts (advancePool, poolView, stakePool, closePool), portfolio.ts (poolPayout, settlePool).

### W2 · `kapitler/k09-byg-hallen-demo.html`: `id="k9"`, "Byg en fremtid, Hallen og demoen"
- **Byg:**
  - benene filtrerer fremtiderne, højst 3, og højst ét resultatben og ét målben;
  - "X af 100";
  - grænse på 5 %, 12 % margin, salgskurs = kurs − 4;
  - løftelinjen ved ≥ 1,15 eller ≤ 0,87.
  - Shot 17.
- **Hallen:** oscilloskopet og triggeren (shot 21).
- **Demoen:** cirka 85 s med spøgelsestommel (shot 02).
- **Kilder:** src/ui/byg/Byg.tsx, match.ts (setLegs), src/ui/hallen/Hallen.tsx, src/engine/director/demo90.ts, src/ui/demo/DemoThumb.tsx.

### W2 · `kapitler/k10-portefolje-afregning.html`: `id="k10"`, "Portefølje og afregning"
- **Porteføljen:** afsnittene åbne, købsgrænser, Sikring, Parken-puljen og afsluttet (shot 18).
- **Afregningen:**
  - floden;
  - Udbetalt / Indsat / Resultat ({{slut.udbetalt}} / {{slut.indsat}} / {{slut.resultat}}), hvor puljen tæller til kostpris, indtil den er betalt ud;
  - træk-karaktererne Brillant !! … Fejlkøb ??, kun for 1X2-køb;
  - afsnittene Sikring og pulje;
  - "solgt før afregning".
  - Shot 20.
- **Kilder:** src/ui/portefolje/Portefolje.tsx, src/ui/afregning/Afregning.tsx.

### W2 · `kapitler/k11-laant.html`: `id="k11"`, "Lånt fra andre brancher"
- **Tabel S1–S6:**
  - finans/børs: handelsstop og gab;
  - meteorologi: Målvejret;
  - musikproduktion: fader og sidechain-pump;
  - sports-tv: spøgelseslinjen;
  - online-skak: træk-karakterer;
  - elektronik: triggeren i Hallen.
- **Nye lån:** stop-loss/take-profit fra børshandel og positionsstyring (Betfair), og totalisatorpuljen fra hestevæddeløb og Tips.
- **Kilder:** docs/KONCEPT.md §3, docs/PLAN.md §2, docs/RESEARCH.md.

---

## DEL II · MASKINRUMMET (skriver W4, W5, W6, W7) — neutral stemme, formler og kodehenvisninger

**Del-skille:** W4 starter `k12` med `<div class="del" id="del2"><span>Del II</span><h1 class="delh">Maskinrummet</h1><p>…</p></div>`.

### W4 · `kapitler/k12-arkitektur.html`: `id="k12"`, "Arkitektur: én deterministisk motor"
- **Determinisme:** hash01-tællerstrømme, så tilstand = f(seed, tidslinje, k).
- **Tid:** 1 substep = 1,5 kampsekunder = 100 ms ved ×1. Et kampminut tager 4 s, en kamp cirka 6 min.
- **Opdatering:** visningen opdateres højst 4 gange i sekundet, og canvas tegnes imperativt.
- **Workere:** fil, blob og hovedtråd.
- **Golden hashes:** Over 2,5 ændrede ikke 1X2-simulationen.
- **Figurer:** `system` og `tidsskala`.
- **Kilder:** sim.ts (header, step), params.ts (SUB, DP_STEP), match.ts (tick, flushView), src/engine/mc/client.ts, tests/totals.test.ts (golden).

### W4 · `kapitler/k13-maalmodellen.html`: `id="k13"`, "Målmodellen"
- **Intensiteten:** λᵢ = (λᵢ/90)·s(t)·m_score(d)·m_red·e^{±π/2}·(1+Eᵢ)·zone.
- **Tabel:** DERBY_PARAMS.
- **Tidsprofil:** s(t) = (0,85 + 0,4t/90)/1,05.
- **Pres:** OU-pres med spark fra hjørner og chancer.
- **Excitation:** κ 0,6 og τ_E 3.
- **Mål ved thinning.**
- **Kalibrering:** {{kal.maalPrKamp}} mål pr. kamp, FCK vinder {{kal.fckSejr}}.
- **Afvigelser fra PLAN §8:** λ 1,4/0,965 og e^{±π/2}.
- **Kilder:** params.ts, sim.ts (advanceMatch).

### W4 · `kapitler/k14-dp-og-mc.html`: `id="k14"`, "Prissætteren og Monte Carlo"
- **Rate-gitteret:**
  - trin på 15 s og d ∈ ±8;
  - `ouExpect`;
  - zonen gælder kun de første 30 s;
  - loft på 0,45 pr. trin.
- **Priser fra gitteret:** price1x2, nextGoal og windowGoal.
- **MC:**
  - 5.000 CRN-stier og en fast permutation;
  - stratificering til 100, så tally = `largestRemainder`;
  - stipriser med δ-fade;
  - Byg skaleres med p_DP/p_MC.
- **Figur:** `stier`.
- **Kilder:** dp.ts (rateGrid, price1x2, nextGoal, windowGoal, baseTable, strandWin), src/engine/mc/paths.ts.

### W4 · `kapitler/k15-markedslaget.html`: `id="k15"`, "Markedslaget: fra fair pris til kurs"
- **Ordreflow:** LMSR-agtig påvirkning med B_LIQ {{k.B_LIQ}} pr. logit, {{k.MU_TRADES}} handler pr. kampminut plus Hawkes.
- **Flow og informerede handlende:** halveringstider på 1 og 15 min, informeret modflow.
- **Ordrestørrelser.**
- **Støj og overshoot:** støj klippet ved ±0,02 logit, overshoot τ 0,125.
- **Kurser:**
  - power-metoden giver Σ ≈ 103;
  - hysterese {{k.HYST}};
  - spread 2/4/6.
- **Attribution:** fordelingen ind i årsagschippen.
- **Margintabel pr. familie:**
  - 1X2 3 %, dobbeltchance 4 %;
  - næste mål 5 %;
  - vinduer 9 %, efter målet 10 %, VAR 8 %;
  - Over/Under 6 %;
  - celle 15 % multiplikativt, region 10 %;
  - Byg 12 %;
  - puljen 10 %.
- **Kilder:** sim.ts (market, requote, attribute), src/engine/lib/quote.ts, display.ts, match.ts.

### W5 · `kapitler/k16-maal-matematik.html`: `id="k16"`, "Mål i alt og slutresultat: matematik og regler"
Dette er det dybeste kapitel, cirka 3–4 sider.
- **scoreGrid:** fremad-DP over ekstra mål (f, b), raten slås op ved d = (h₀+f) − (a₀+b), og masse over 10 samles i 10.
- **fromGrid:** x12, over(L) og celler med 5 = 5+.
- **Identiteterne:** gitterets 1X2 er lig price1x2 (afvigelse {{grid.maxAfvigelse1x2}}).
- **totalsBack:** baglæns-DP med et absorberende "behov"-lag. Den har 3 lag ved 2,5 og 0–0 mod 1X2's 2, og koster cirka 0,1 ms pr. substep.
- **marketO25:**
  - fair pr. substep fra samme gitter;
  - ingen crowd-flow, kun støj og overshoot (0,1·Δlogit);
  - frosset i handelsstop;
  - gapO25 = rund(kurs efter genåbning) − rund(kurs mens åben);
  - efter krydsning er mid = 1, og gabet er til 100.
- **requoteO25:** 6 % power-margin, hysterese 0,6, spread 2/4/6 + overshoot.
- **Øvrige linjer:** fra gitteret, 6 % margin, spread 3, p klippet til [0,005; 0,995].
- **csQuote:**
  - én celle ⌈100·p·1,15⌉;
  - en region ⌈100·Σp·1,10⌉ med Σ celle-kurser som loft;
  - salgskurs = max(1, min(kurs − 2, ⌊100·Σp·0,92⌋)).
- **Rettet under arbejdet:** det gamle loft "Σ − (n−1)" prissatte store regioner under fair, fx {{gammelFejl.region}}: kurs {{gammelFejl.kurs}} mod fair {{gammelFejl.fair}} point. Brug q20-tallene fra faktaarket i en tabel, gammel mod ny.
- **closedReason i rækkefølge:** kampen slut → VAR → handelsstop → linjen passeret → ikke længere muligt → under 3 %.
- **Afregning:**
  - linjen afregnes ved det godkendte mål, der krydser den;
  - cs går til 0, så snart alle celler er umulige;
  - resten fejes ved slutfløjt.
- **ng-rettelsen:** confirmedThrough.
- **FocusSpec:** tabel over felterne.
- **MC med kind 'o25':** totalsTable, strandOver, tilt via intensitetsmultiplikatoren, og stierne starter ved kursen og ender i 0 eller 100. Afvigelsen fra DP er højst {{mc.maxAfvigelse}} point.
- **Kalibrering:** figur `kal-o25`. Ved kickoff er prisen {{kal.o25.kickoffPris}} mod faktisk {{kal.o25.kickoffFaktisk}}; DP'en ignorerer excitation fra fremtidige mål.
- **Begrænsninger:**
  - regioner prissættes fra model-p, ikke et marked;
  - 5+ er samlet.
- **Kilder:** dp.ts (scoreGrid … strandOver), sim.ts (marketO25, requoteO25), display.ts, match.ts (csQuote, closedReason, settleOn, confirmedThrough), focus.ts, mc/paths.ts, tests/totals.test.ts.

### W6 · `kapitler/k17-sikring-regler.html`: `id="k17"`, "Sikring: regler, rækkefølge og kanttilfælde"
- **ExitOrder-modellen.**
- **placeExit-validering:**
  - positionen skal findes;
  - niveau 1–99;
  - stop < salgskurs, take > salgskurs;
  - stop/grænse-konflikten begge veje;
  - en ny placering flytter ordren.
- **exitSuggestion-eksempler fra testen:** 50/48 → 35/75, 10/4 → 1/35, 90/95 → 75/99.
- **Rækkefølgen i afterStep:** exits → pulje → købsgrænser → hændelser og afregning → vinduer, og hvorfor.
- **Udløsning:**
  - stop, når kurs − {{k.STOP_ASK_OFFSET}} ≤ niveau OG k − reopenK > {{k.STOP_REOPEN_GUARD}}; vagten svarer til vinduet med spread 6;
  - take, når salgskurs ≥ niveau;
  - one-cancels-other via sell → cancelExitsOf;
  - aldrig under handelsstop.
- **Sporet:** figur `sikring-spor` plus en tabel over få substeps omkring genåbningen (fra story.json trace).
- **Kanttilfælde:**
  - take kan fylde inden for genåbnings-spreadet;
  - gab-tilfældet med grænse og stop (se k21);
  - et stop kan fylde langt under sit niveau, og det står i bakkens tekst.
- **Kilder:** portfolio.ts, match.ts (afterStep, liveQuote, placeExit), tests/book.test.ts, tests/features.test.ts.

### W6 · `kapitler/k18-puljen-regnskab.html`: `id="k18"`, "Parken-puljen: regnskab og forventet udbytte"
- **Tilstand:** poolP, poolN og poolW.
- **Pr. substep:**
  - kun crowd-*køb* tæller: P += min(kr, hval ? 2.000 : kr)·4, N += 9;
  - EMA mod normaliseret(fair ⊙ hældning), α = 1 − e^{−0,025} ≈ 0,0247, og α = 1 under handelsstop;
  - snap og frys ved pausen.
- **Din indsats:** indgår i siderne, odds = 0,9·T / max(1, side), og skønnet i UI'et inkluderer din indsats.
- **Udbetaling og refusion.**
- **Grænsen:** E pr. krone på side i = 0,9·Σ(q·ℓ)/ℓᵢ ≤ 0,9·1,035/0,985 ≈ {{pulje.graense}} (FCK ≤ 0,90). Din egen udvanding kommer oveni.
- **Hvorfor fair og ikke mid:** hvaler kan ikke fades. Dette er en afvigelse fra planen.
- **Testen:** 20 kampe med betinget forventning i stedet for 300 realiserede, fordi en SE på 0,08 ikke kan skelne 0,90 fra 0,95. Værste værdier {{pulje.20.vaerst.x}} osv.
- **Figurer:** `pulje-halvleg` og `pulje-graense`.
- **Historiens lukning:** forventet udbytte pr. krone ved pausen var FCK {{pulje.lukning.ev.fck}}, X {{pulje.lukning.ev.x}}, BIF {{pulje.lukning.ev.bif}}.
- **Kilder:** match.ts (POOL_*, advancePool, poolTarget, closePool, poolView), portfolio.ts (poolPayout, settlePool), tests/features.test.ts.

### W6 · `kapitler/k19-afregning-karakterer.html`: `id="k19"`, "Afregning og træk-karakterer"
- **CLV:** Δlogit(mid) − Δlogit(baseline).
- **R:** min(indgang + 10, næste mål − 0,05, nu).
- **Tærskler:** ±0,1 og ±0,3.
- **Resultatformlen.**
- **Historiens karakterer:** {{karakter.fck}} (CLV {{karakter.fck.clv}}) osv.
- **Kilder:** portfolio.ts (grade), Afregning.tsx, match.ts (baseline).

### W7 · `kapitler/k20-test-kalibrering.html`: `id="k20"`, "Test, kalibrering og ydelse"
- **Tests:** {{test.antal}} i alt, pr. fil fra faktaarket.
- **Kalibreringer:**
  - 1X2 pr. decil (figur `kal-1x2`);
  - Over 2,5;
  - MC mod DP;
  - håndbold fra README.
- **QA:** {{qa.antal}} tjek. Hvad de dækker (qa/qa.cjs).
- **Ydelse:**
  - 1× p95 {{perf.1x.p95}};
  - 4× p95 {{perf.4x.p95.tidligere}}–{{perf.4x.p95}} over to kørsler, mod planens mål ≤ 33 ms. Skriv det ærligt: headless software-raster;
  - MC ≈ {{perf.mc}}.
- **Golden hashes.**
- **Kilder:** tests/*.test.ts, qa/qa.cjs, data/vitest.txt, data/qa.txt.

### W7 · `kapitler/k21-afvigelser.html`: `id="k21"`, "Afvigelser og kendte begrænsninger"
Én `callout advarsel` pr. punkt.
- **Rettet under rapportarbejdet:** regionsloftet (se k16).
- **Gab-kanttilfældet:** en købsgrænse på {{kant.graense.niveau}} og et stop på 17 på BIF springes begge over i samme gab.
  - Grænsen fylder {{kant.graense.andele}} @ {{kant.graense.kurs}} ("{{kant.graense.bedre}} point bedre").
  - 8 substeps senere sælger stoppet alle {{kant.stop.andele}} andele @ {{kant.stop.kurs}}, også de netop købte.
  - Stop/grænse-reglen fanger det ikke.
  - Det er ikke rettet; det foreslås som næste opgave.
- **Sikring på Under 2,5:** er bevidst ikke tilbudt; kun kontrakter med en linje i viften.
- **Refusion i puljen:** er i praksis uopnåelig.
- **Celler med 5+:** samlet.
- **Visninger:** NU ved 36 % af bredden (plan 52 %).
- **Basisrater og intensitet:** afviger fra planen.
- **Puljen:** følger fair, ikke mid.
- **Puljetesten:** betinget forventning.
- **Ydelse ved 4×.**
- **Kilder:** docs/PLAN.md §15, §16 og §19, data/edge.json.

---

## BILAG (skriver W7)

### `kapitler/b-a-ordliste.html`: `id="bA"`, `data-nr="A"`, "Ordliste"
- Cirka 45 termer i `<dl class="ord">`, alfabetisk.

### `kapitler/b-b-kontrakter.html`: `id="bB"`, `data-nr="B"`, "Kontraktnøgler"
- **Kolonner:** nøglemønster · eksempel · priskilde og margin · åben/lukket · afregning · Sikring.
- **Nøgler:** `1x2:F|X|B`, `dc:1X|X2`, `ng{n}:F|N|B` (godkendte mål), `w:{a}-{b}:J|N`, `ag{n}:J|N` (n = goalNo, inkl. annullerede), `var{n}:J|N`, `tot:{L}:O|U`, `cs:h-a[.h-a]` (sorteret, 5 = 5+), `byg:{u0|m3|btts|v60-70}+…`, håndbold (src/state/hallen.ts).

### `kapitler/b-c-konstanter.html`: `id="bC"`, `data-nr="C"`, "Konstanter og parametre"
- **Tabel** fra stats.json `constants` og `params`, med navn, værdi, fil:linje og betydning.
- **Udvalg:** kun det, rapporten bruger, cirka 40 rækker.

### `kapitler/b-d-metode.html`: `id="bD"`, `data-nr="D"`, "Sådan er rapporten lavet"
- **Kildegrundlag:** commit {{commit}}, seed og historiekørslen.
- **Determinisme:** browserbogen matcher node-kørslen handel for handel.
- **Kommandoer:**
  - `npx vitest run`;
  - `node docs/rapport/scripts/data.mjs`;
  - `python3 docs/rapport/scripts/fakta.py`;
  - `node docs/rapport/scripts/shoot.cjs`;
  - `node docs/rapport/build.mjs`.
- **Faktatjek:** hvert kapitel er faktatjekket mod koden.
