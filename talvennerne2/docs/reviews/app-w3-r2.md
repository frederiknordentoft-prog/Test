# App-review, bølge 3 runde 2 (QA3b): Stjernefjeldet spillet igennem igen

Uafhængigt produkt- og QA-review af 3. klasses verden, runde 2, før den frigives (`RELEASED_WORLDS` i `src/meta/built.ts`). Reviewet genkontrollerer QA3a's fund (`docs/reviews/app-w3-r1.md`) efter FIX3a og FIX3b og spiller verdenen igennem igen i seks dimensioner: genkontrol af QA3a, regioner 1–4, regioner 5–7 og finalen, kunsten i sammenhæng, indplacering og forældredel samt regression i 0.–2. kl. Formatet og P1/P2/P3-skalaen følger QA3a.

**Om efterprøvningen:** P1- og P2-fundene herunder er ikke efterprøvet af skeptikere i workflowet. Rette-agenterne FIX3c og FIX3d genskaber hvert fund, før de retter det, og integratoren har vurderet fundene mod SPEC. Før efterprøvningen blev stoppet, nåede skeptikerne tre dommer:
- P2-8 ("4 : 2 = −1", regioner-1-4 #1) blev genskabt 2 af 2 gange og ikke tilbagevist.
- P2-14 ("Det lærte du" på 375×667, regioner-1-4 #2) blev genskabt 1 af 1 gang.

P3-fundene kommer direkte fra reviewerne og er ikke efterprøvet.

- **Build:** `c180167` på `tv2/qa3b`. `npm run build` var grønt: initial 142,2 KB og al JS 687,5 KB gzip (budget 750 KB, A16). `registry` er stadig 57,6 KB (grænsen pr. chunk er 60 KB).
- **Afvikling:** én dev-server pr. dimension (porte 4401–4406) med `?e2e=1&voice=fast&worlds=all`. I indplacering-foraeldre er `fjeld` lagt i `RELEASED_WORLDS` på siden efter hver indlæsning, så stigen og "Spring over" ses, som de bliver efter frigivelsen. Regression-0-2 har desuden kørt bølge 2's slutpunkt `a5b1ccb` på port 44061 til pixel- og tekstsammenligning.
- **Chromium:** rigtig touch (`hasTouch`, `isMobile` på telefon, `page.touchscreen.tap` og træk med CDP-touch), ingen syntetiske klik. Undtagelsen er 5 af 361 opgaver i regioner-5-7-finale (clockSet, numberline og buildBase i finalen og Trecifret bro), som er besvaret via `drive.ts`.
- **Adgang:** nye børn i 3. kl. med Stjernefjeldet åbnet som "Åbn hele Stjernefjeldet" (`withOpenings`/`worldOpenings('fjeld')`), og uret rykket en dag frem før hver sten (`page.clock`), så dagens loft over nye nøgler (A13/A15) ikke tømmer stenene.
- **Oplæsning:** **Stemmen til bølge 3 var ikke merget under reviewet.** Oplæsningen er derfor ikke holdt op mod manifestet, og QA3a's P1-1 er ikke genkontrolleret. Teksterne er læst på skærmen, i `__voiceLog` og i kataloget. Ingen af de nye klip lyder forkert ud over de P3'ere, der nævnes herunder.
- **Skærmbilleder og scripts:** ligger i `artifacts/qa3b/<dimension>/` (git-ignoreret), med skærmbillederne i `shots/`. Skeptikernes genskabelser ligger i `artifacts/qa3b/skeptiker-*/`. Alle stier herunder er relative til `talvennerne2/`.

## Resultat

**Ikke klar til frigivelse endnu: én P1 på telefon på tværs, og stemmen var ikke merget under reviewet. QA3a's fire P2'ere er rettet.**

1. **QA3a's rettelser holder.** Alle fire P2'ere er set rettet på skærmen, og det er de af flere dimensioner hver for sig. 8 af 11 P3'ere er rettet, én er delvist rettet, og to var ikke med i rettelserne (afsnittet "Status for QA3a's fund").
2. **Én ting blokerer (P1-1).** På telefon på tværs hopper koordinatnettet 3 felter mod venstre i det øjeblik, fingeren rører det. Et træk sætter derfor punktet forkert, og i Arealhavens mesterprøve kostede det en planke.
3. **Indplaceringens kanter er rettet (P2-1 til P2-3).** Stigens almindelige veje lander rigtigt. Tre kanter gav dog forkerte starter eller forkert status: ét svar og så "Det er nok", et dumpet trin, der alligevel seedes, og regioner med stof, stigen aldrig spurgte om. Integratoren har ændret SPEC A24, og FIX3e har rettet dem.
4. **Opgaven står stadig kun i lyden fire steder (P2-4 til P2-7).** Det gælder ¾ på to tallerkener (boblen siger "Del lige."), brøk af en mængde, koordinater på kort og "størst/mindst" ved brøk-kort. Det er samme mønster som QA2's P2-4 og QA3a's P2-3, og det betyder mere, så længe stemmen ikke er i appen.
5. **Layout på små skærme og på tværs (P2-9 til P2-14).** Billeder, mønter, figurer, ure og ligninger er større end kortet eller knappen, især på 375×667. Hjælpen i Markedet viser derfor 8,50 kr., hvor svaret er 9 kr.
6. **To enkeltfund:** en skæv deling vises som "4 : 2 = −1" (P2-8), og isbjørnens hovedudsnit skærer snuden af, netop der hvor barnet ser sin buddy hele tiden (P2-15).
7. **Ingen regression i 0.–2. kl.** Onboarding, dyr, tøj og dashboard er pixel-identiske med bølge 2 bortset fra tilsigtede ændringer.

**Fund:** 1 × P1, 15 × P2 og 24 × P3.
- P2: 16 indmeldt. qa3a-genkontrol og indplacering-foraeldre fandt hver for sig samme fejl i indplaceringen, og den står her som P2-1. 3 af de 15 er rettet i FIX3e.
- P3: 27 indmeldt. Tre er slået sammen med andre fund: isbjørnen i regnbuevalget hører under P2-15, og "kr" uden punktum og vægtopgaverne blev hver meldt af to dimensioner. 5 af de 24 er rettet i FIX3e.

## Sådan er der spillet

| Dimension | Port | Formater | Omfang |
|---|---|---|---|
| qa3a-genkontrol | 4401 | 393×852, 375×667, 852×393, 1180×820 | l1 i alle 7 regioner (90 opgaver). Påtvungne opgaver i den rigtige RoundScreen via en gemt tur: pay i Markedet og Købmandsgården, brøker i rækkefølge i tre formater, sub1000, clockElapsed og divAll med fejl. Stigen i seks varianter. Finalens stenkort, regnbuedyr-ceremonien, Færdigheder, Indstillinger, Overblik og build. |
| regioner-1-4 | 4402 | 393×852, 375×667, 852×393 | Tabeltoppen, Trecifret bro, Minuttårnet og Delekløften med alle seks sten på 393×852. 39 ture, 478 opgaver og 97 forkerte svar. Tabeltoppens prøve dumpet med vilje på 375×667. |
| regioner-5-7-finale | 4403 | 393×852, 375×667, 852×393 | Markedet, Arealhaven og Brøkbageriet med alle seks sten. 31 ture, 361 opgaver og 44 fejl. 5 mesterprøver, Markedets prøve dumpet med hytte og nyt forsøg, finalen bestået med 11 planker og to probes af koordinatnettet. |
| kunst-i-sammenhaeng | 4404 | alle fem | Ven-stenene for pegasus, drage, pingvin og isbjørn, Trecifret bros kiste, finalen og "Prøv dem på". Garderoben med Astronaut-sættet på 10 dyr, HUD-avataren for 12 arter, Dyrehaven, butikken, scenen i fem formater og 14 vægtopgaver. |
| indplacering-foraeldre | 4405 | 393×852, 375×667, 820×1180, 1180×820 | Stigen ad ni veje med frigivelsen efterlignet, også søskende og genindlæsning. Forældredelen for et barn ved L14: 7 faner, udskrift, eksport og import som ny spiller. De 16 hjemmetips (i kilden). |
| regression-0-2 | 4406 (+ 44061) | 393×852, 820×1180 | Onboarding for 0.–2. kl. (6 kørsler), ture i Tællelunden, Urtårnet og Vekselvandet og 7 ture i Købmandsgården. Ada's dashboard, dyr og tøj i HEAD og base med pixel-diff. vitest for kunst-snapshots, rækværk og orakler. |

Der var 0 konsolfejl i alle dimensioner og alle kørsler.

## Status for QA3a's fund

| QA3a | Status nu | Set af |
|---|---|---|
| P1-1 Stemmen | **Ikke genkontrolleret.** Stemmen til bølge 3 var ikke merget under reviewet. | alle |
| P2-1 "Det lærte du" tom | **Rettet i fjeldet.** Konkrete kort efter l1 i alle 7 regioner: ure, regnestykker, mønter, koordinatnet, arealfigurer og brøkstænger. Nyt fund: på 375×667 ligger stjerner, perler og point under knapperne, når kortene er ure (P2-14). 2. kl.'s procedure-regioner er stadig tomme (P3-24). Det er ikke en regression, for FIX3a tog bevidst kun fjeldet. | qa3a-genkontrol, regioner-1-4, regioner-5-7-finale, regression-0-2 |
| P2-2 Pay-boblen | **Rettet.** Boblen følger familien i Markedet og Købmandsgården, og "Betal for to af dem." viser to ens ting med to prisskilte. Søstre, der ikke er pay: ¾-delingen (P2-4) og "færrest" som choice (P3-13). | qa3a-genkontrol, regioner-5-7-finale, regression-0-2 |
| P2-3 Brøker i rækkefølge | **Rettet for sortOrder** i 375×667, 393×852 og 852×393 ("Mindst → Størst"/"Størst → Mindst"). Samme hul findes i choice-kortene "Hvilken brøk er størst/mindst?" (P2-7). | qa3a-genkontrol, regioner-5-7-finale |
| P2-4 Stigen ændrer ikke starten | **Rettet for de almindelige veje.** Alt rigtigt gav Tabeltoppen, to fejl Hundredemarken, ✓✗✓✓ Minusbækken, fejl ved L7 Tyvebroen og en dyb vej til L12 Gangegrotten. Hjemverden, næste sten og mål følger med. Kanterne gav P2-1 til P2-3, som er rettet i FIX3e. | qa3a-genkontrol, indplacering-foraeldre |
| P3-1 "til og med 4. klasse" | Rettet | qa3a-genkontrol, indplacering-foraeldre |
| P3-2 "Så giver 18 divideret med 3 6." | **Delvist.** Skærmen siger "Så giver 18 : 3 = 6.", men talen er bevidst uændret (`displayText.ts`: "The voice keeps its words"). Se P3-5. | qa3a-genkontrol, regioner-1-4 |
| P3-3 "er klokken kl." | Rettet ("En halv time efter kl. 5.30 er klokken 6.00.") | qa3a-genkontrol, regioner-1-4 |
| P3-4 Dobbelt veksling i Columns | Rettet: det nye tal står over det gamle overstregede. Set i en påtvungen opgave; i spil kom dobbelt veksling over nul kun som rigtigt svar. | qa3a-genkontrol |
| P3-5 Finalens stenkort | Rettet: Stjernemedaljon, Rumdragt og Jetpack vises. | qa3a-genkontrol, regioner-5-7-finale |
| P3-6 Mål 2 er Tællelunden | Rettet. Mål 2 peger på startregionen og i 0.–2. kl. på hjemverdenen. | qa3a-genkontrol, indplacering-foraeldre, regression-0-2 |
| P3-7 "Tryk på den" | Rettet på skærmen ("Tryk på det, du vil have."). Manifestets bølge 1-klip er lavet af den gamle tekst. Stemmens træ har den nye tekst og hash, så det bør være løst ved stemmens merge; lyt efter det dér. | qa3a-genkontrol, regression-0-2 |
| P3-8 "10 − 0" i stigen | Rettet: ingen opgaver med 0 eller 1 i 6 stiger. | qa3a-genkontrol |
| P3-9 "Godt, næste!" efter en fejl | Rettet: efter en fejl siger Pip "Tak! Her er den næste." | qa3a-genkontrol |
| P3-10 Misforståelsers faste eksempel | Uændret (kun tjekket i koden: "6 · 7 bliver 48"). Den var ikke med i rettelserne. | qa3a-genkontrol |
| P3-11 `registry` tæt på grænsen | Uændret: 57,6 KB af 60. | qa3a-genkontrol |

---

## P1 – blokerer frigivelse

### P1-1 Koordinatnettet hopper 3 felter mod venstre ved første berøring på telefon på tværs, så et træk sætter punktet forkert

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `grid` (gridCoords placePoint, "Sæt punktet …") i Arealhaven, også i mesterprøven. Telefon på tværs 852×393. På 375×667 og 393×852 var 4 af 4 træk rigtige.
- **Trin:**
  1. Dev-server med `?e2e=1&voice=fast&worlds=all`, context 852×393 med `hasTouch` og `isMobile`. Nyt barn i 3. kl. med Stjernefjeldet åbnet (`withOpenings`/`worldOpenings('fjeld')`).
  2. Spil Arealhavens mesterprøve eller `w3-areal-l1` til en opgave "Sæt punktet …".
  3. Sæt fingeren i nettet, træk punktet hen til det nævnte kryds (fx (1, 3)), slip og tryk på fluebenet.
  4. Probe: tryk først på (3, 2), og træk derefter punktet fra (3, 3) til (3, 2).
- **Set:**
  - Ved første berøring bliver det hvide svarpanel bredere: venstre kant 232 → 66 px og bredde 605 → 720 px. Det sker straks (målt ved 0 ms), og panelet dækker dyret og boblen.
  - Nettet flytter 108 px (3 felter) mod venstre. Fingeren, der stadig er nede, står nu 3 kolonner længere til højre.
  - I prøven endte et træk mod (1, 3) på (4, 3). Svaret blev bedømt forkert ("Tryk på (1, 3)"), og prøven kostede en planke (8 planker).
  - I proben gav tryk på (3, 2) punktet (3, 2), mens det efterfølgende træk fra (3, 3) til (3, 2) gav (6, 2). Et rent tryk uden bevægelse virker.
- **Burde:** Nettet står stille under fingeren. Punktet lander på det kryds, fingeren slipper på, og et rigtigt kryds bedømmes rigtigt.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/C-teach-w3-areal-trial-gridCoords-placePoint-grid-1.png`, `artifacts/qa3b/regioner-5-7-finale/shots/probe-land-1791484020101-probe2-before-crd_p_4_3_2.png` og `…-probe2-after-crd_p_4_3_2.png`
- **Fil:** `src/ui/screens/child/RoundScreen.tsx` (svarområdets bredde i landskab skifter ved første aktivitet, stage `is-owned`), `src/ui/task/grid/grid.css` (`@media (orientation: landscape) and (max-height: 500px)`), `src/ui/task/grid/View.tsx` (`onStart` → `onActivity`)

---

## P2 – bør rettes før frigivelse

### P2-1 Ét svar og så "Det er nok" sender et barn i 3. kl. til Tællelunden (0. kl.), mens intet svar giver egen verden

- **Fundet af:** qa3a-genkontrol og indplacering-foraeldre, hver for sig.
- **Rettet:** Integratoren har ændret SPEC A24 efter fundet (commit `1619c89` og `c493e9b` på session-branchen `claude/math-app-children-ios-4jihdr`). Indplaceringen tæller nu først, når barnet har bestået mindst ét trin, eller når stigen er sluttet af sig selv. "Det er nok" før et bestået trin er som "Spring over", og Pip siger en neutral slutlinje (`s.place.done.none`). Rettet i FIX3e (merget `bd5d214`).
- **Skærm og format:** stigen ("Vis Pip, hvad du kan"), outro, første tur og kortet. Telefon 393×852 og telefon SE 375×667 (kun rigtige svar), telefon på tværs 852×393 og iPad på tværs 1180×820 (efter en fejl).
- **Trin:**
  1. Ny spiller fra tom enhed (`?e2e=1&voice=fast&worlds=all`), navn, æg, ven, 3. klasse, "Næste" og "Vis Pip, hvad du kan".
  2. Svar rigtigt på det første spørgsmål (L5, plus til 20), og tryk "Det er nok", da næste spørgsmål står på skærmen.
     - Variant: L5 ✓, L5 ✗ (strategi, bekræft), L4 ✓ (10 − 5) og "Det er nok".
     - Variant: svar forkert på det første spørgsmål, og tryk "Det er nok", mens strategien vises.
  3. Tryk "Spil", og derefter ✕ → Til kortet.
- **Set:**
  - `placement = {done: true, highest: null}`, og `placedStart` giver Tællelunden. Første tur er `w0-tal10-l1` med opgaven `h20:1` (hør tallet 1).
  - Kortets hjemverden er Engdalen med Tællelunden som næste sten, og den låses dér (`homeLimit`), indtil Engdalen er gennemført. Målet er "Tag en tur forbi Tællelunden".
  - Pip siger "Tak, fordi du viste mig det! Nu finder vi dit sted på kortet."
  - Til sammenligning: "Spring over" eller "Det er nok" før første svar giver Tabeltoppen (med frigivelsen efterlignet), og det gør en genindlæsning efter 3 svar også. Ét rigtigt svar giver altså en langt lavere start end intet svar. Et barn i 3. kl., der har regnet 7 + 7 rigtigt, begynder forfra i 0. klasses stof.
  - Det fulgte ordlyden i den gamle A24 ("P = null Tællelunden"), men næppe hensigten. Forældreteksten lover, at barnet "starter så der, hvor det passer".
- **Burde:** Ét svar er intet tegn på, at barnet ikke kan sit klassetrin. Det behandles som "Spring over": egen verden og Tabeltoppen. Det må i hvert fald ikke give en lavere start end at stoppe uden at svare.
- **Skærmbilleder:** `artifacts/qa3b/qa3a-genkontrol/shots/onb-enough1-phone-3-outro.png`, `onb-enough1-phone-4-firstround.png`, `onb-enough1-phone-5-map.png`, `onb-enough-land-5-map.png` (logs `onb2-enough1-phone.out`, `onb2-enough-land.out`); `artifacts/qa3b/indplacering-foraeldre/shots/onb-oneRight-se-7-map.png` (sammenlign med `onb-before-phone-7-map.png` og `onb-reload-ipadLand-5-after-reload.png`; variant `onb-oneMiss-ipadLand-7-map.png`)
- **Fil:** `src/ui/screens/child/onboarding/placement/flow.ts` (`endPlacement`: `s.run.asked > 0` markerede indplaceringen som gennemført), `src/engine/ladder.ts` (`placedStart`), `src/engine/placement.ts` (`seedFromPlacement`, `placementResult`), SPEC A24

### P2-2 Et trin, barnet dumper i stigen, bliver alligevel seedet som "Sprunget over ved start", og regionen, der lærer det, springes over

- **Fundet af:** indplacering-foraeldre.
- **Rettet:** SPEC A24 (`1619c89`): et trin, barnet ikke bestod, seedes ikke, heller ikke når det ligger under `seedStage(P)`, og det gemmes i `placement.failed`. `c493e9b` præciserer, at "ikke bestået" er et trin med et forkert svar (`run.failed`). Rettet i FIX3e (merget `bd5d214`).
- **Skærm og format:** stigen, kortet (Hundredemarken) og forældrenes Færdigheder og Pensumkort. Telefon 393×852, set to gange (også i søskende-kørslen på telefon SE).
- **Trin:**
  1. 3. klasse og "Vis Pip, hvad du kan".
  2. L5 rigtigt to gange, L7 (hør og skriv tal til 100, fx "88") forkert og L6 rigtigt to gange. Stigen slutter selv med P = L6.
  3. Tryk "Spil", og åbn For voksne, Færdigheder.
- **Set:**
  - `seedStage(L6)` = 1,6 er større end hear100's stage 1,2. Derfor lægges alle 8 hear100-familier i boks 2 som seedede, også `d8x`, som barnet lige svarede forkert på.
  - Hundredemarkens l1, l2, l3 og blandet springes over, og første tur er Tyvebroen.
  - Færdigheder viser "Hør og skriv tal til 100: Sprunget over ved start · ikke prøvet endnu".
- **Burde:** Skills fra dumpede trin (`run.failed`) seedes ikke, og regionen, der lærer dem, springes ikke over. Dashboardet skriver ikke "ikke prøvet endnu" om en skill, barnet har svaret på i stigen.
- **Skærmbilleder:** `artifacts/qa3b/indplacering-foraeldre/shots/fail7-phone-dash-hear100.png`, `fail7-phone-miss-hear100.png` (log `fail7-phone.log`)
- **Fil:** `src/engine/ladder.ts` (`seedStage`, `passedOver`), `src/engine/placement.ts` (`seedFromPlacement` tog ikke højde for `run.failed`)

### P2-3 Stigen spørger kun om tal og regning, men springer også regioner med penge, mål, ur og figurer over, også 3. klasses Markedet

- **Fundet af:** indplacering-foraeldre.
- **Rettet:** SPEC A24 (`1619c89`): stigen måler kun tal og regning, så kun regioner i kæden `tal` kan springes over. Regioner i kæderne `figurer`, `klokken` og `pengeMaal` læres som normalt. `c493e9b` præciserer rækkefølgen på kortet og i målene (`placedRank`). Rettet i FIX3e (merget `bd5d214`).
- **Skærm og format:** kortet i Stjernefjeldet (Markedet), stenkortet og forældrenes Pensumkort. iPad 820×1180 og telefon 393×852.
- **Trin:**
  1. 3. klasse, "Vis Pip, hvad du kan" og alt rigtigt (P = L14).
  2. Spil første tur (Tabeltoppen), og gå til kortet.
  3. Rul til Markedet, og tryk på "Lær nyt".
- **Set:**
  - Markedets l1, l2 og blandet (og Trecifret bro) er markeret som sprunget over. Stenkortet siger "Den har du sprunget over. Du kan stadig spille den.", og kortet foreslår dem sidst.
  - På Pensumkortet står Penge og Måling samtidig som "Ikke startet".
  - Ved P = L13 springes også Købmandsgården, Linealstien, Figurhaven og Urtårnets top over, og ved P = L12 Urtårnets top. Det fulgte af §8's regel "alle skills har stage < stage(P)" for alle domæner (tabel i `table2.log`).
- **Burde:** Kun regioner, hvis stof stigen faktisk har vist, springes over. Markedet (kroner og øre 3,4, byttepenge 2,6, centimeter og meter 3,3) er 3. klasses stof, som stigen aldrig spurgte om, og det læres som normalt.
- **Skærmbilleder:** `artifacts/qa3b/indplacering-foraeldre/shots/par-ipad-sheet-markedet-l1.png`, `par-ipad-map-markedet.png`, `par-ipad-tab-1-Pensumkort-0.png`
- **Fil:** `src/engine/ladder.ts` (`passedOver` gennemgik alle `REGIONS` og alle domæner), `src/engine/placement.ts` (`seedFromPlacement`: nodes og skipped), SPEC §8 og A24

### P2-4 ¾ på to tallerkener: boblen siger "Del lige.", men opgaven er en ulige deling

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `share` (fractionOfSet threeQuartersOf) i Brøkbageriet: ven-stenen, l3, blandet og prøven. Set på 852×393. Boblen er den samme i alle formater.
- **Trin:** Spil `w3-broeker-friend` eller `w3-broeker-l3` til opgaven "Del seksten jordbær på de to tallerkener. Den ene skal have tre fjerdedele og den anden resten." (`fos:3/4:16:strawberry`) kommer som share.
- **Set:**
  - Boblen viser kindens korte form, "Del lige.", over bunken og to tomme tallerkner. Intet på skærmen siger ¾.
  - Et barn, der gør, som boblen siger (8 og 8), svarer forkert. I prøven koster det en planke.
- **Burde:** Boblen siger, hvad der skal ske (fx "Den ene skal have tre fjerdedele."), og skærmen viser ¾, ligesom pay-boblen nu følger familien (QA3a P2-2).
- **Skærmbillede:** `artifacts/qa3b/regioner-5-7-finale/shots/C-ask-fractionOfSet-threeQuartersOf-share.png`
- **Fil:** `src/speech/clips/ui/kinds.ts` (`FAMILY_SHORT` har ingen `share:fractionOfSet/threeQuartersOf`), `src/engine/skills/fractions/fractionOfSet.ts` (prompten til share har ingen brøk)

### P2-5 Brøk af en mængde: brøken står kun i lyden, og kortet viser kun bunken

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `choice` og `keypad` (fractionOfSet) i Brøkbageriet og finalen. 393×852 og 852×393.
- **Trin:** Spil `w3-broeker-l1` eller blandet til fx "Hvor mange er tre fjerdedele af fire gulerødder?" (choice) eller "Hvor mange er tre fjerdedele af tolv gulerødder?" (keypad).
- **Set:**
  - Kortet viser kun 4 eller 12 gulerødder og kortene 2, 3 og 1 eller tastaturet. Boblen siger "Tryk på svaret." eller "Skriv svaret.".
  - Om det er halvdelen, en tredjedel, en fjerdedel eller tre fjerdedele, står kun i lyden.
  - Samme slags fund som QA2's P2-4 og QA3a's P2-3.
- **Burde:** Skærmen viser, hvilken brøk der spørges om (fx "¾ af 12"), ligesom colorParts viser "2/3", og målene viser "4 meter = ? centimeter".
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/A-ask-fractionOfSet-threeQuartersOf-choice.png`, `C-ask-fractionOfSet-threeQuartersOf-keypad.png`
- **Fil:** `src/engine/skills/fractions/fractionOfSet.ts` (prompt `{ scene: 'objects' }` uden brøken)

### P2-6 Koordinater på kort: "hen" eller "op", og ved placePoint selve punktet, står kun i lyden

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `choice` (gridCoords readPoint og placePoint) i Arealhaven. 393×852 og 375×667.
- **Trin:** Spil `w3-areal-l1` til "Hvor langt op er punktet?" (`crd:r:4,1`) eller "Du skal sætte punktet seks en. Hvor langt op skal du gå?" (`crd:p:6,1`).
- **Set:**
  - readPoint: punktet står i (4, 1) med kortene 1, 0 og 4. Både 1 og 4 er rigtige aflæsninger, og boblen siger kun "Tryk på svaret.".
  - placePoint: et tomt net med kortene 0, 2 og 1. Punktet (6, 1) står ingen steder.
  - I `gridCoords.ts` tagges readPoint-kortets andet tal som `coordSwap`. Et barn, der ikke hørte "op", kan altså også give forældrene et forkert tegn.
- **Burde:** Skærmen viser, om der spørges hen eller op (fx "( 4 , ? )" med den orange pil), og ved placePoint det nævnte punkt, ligesom grid-typen viser "(1, 2)" under nettet.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/A-ask-gridCoords-readPoint-choice.png`, `A-ask-gridCoords-placePoint-choice.png`
- **Fil:** `src/engine/skills/shapes/gridCoords.ts` (choice-prompten), `src/speech/clips/ui/kinds.ts` (boblen)

### P2-7 Brøk-kort "Hvilken brøk er størst/mindst?": retningen står kun i lyden (QA3a's P2-3 er kun rettet for sortOrder)

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `choice` (fractionCompare pairBigger, pairSmaller og order4) i Brøkbageriet. 393×852 og 852×393.
- **Trin:** Spil `w3-broeker-l1`. I samme tur kom "Hvilken brøk er størst?" (`fcm:b:3,6`) og "Hvilken brøk er mindst?" (`fcm:s:4,8`).
- **Set:** Kortet er kun en højttaler med tre brøkkort (1/8, 1/5, 1/4), og boblen siger "Tryk på svaret.". Begge retninger forekommer i samme tur.
- **Burde:** Skærmen siger "størst" eller "mindst", fx i boblen, ligesom rækkefølgen nu viser "Mindst → Størst".
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/A-ask-fractionCompare-pairSmaller-choice.png`, `C-ask-fractionCompare-pairBigger-choice.png`
- **Fil:** `src/engine/skills/fractions/fractionCompare.ts` (choice over prompten `hear`), `src/speech/clips/ui/kinds.ts` (`FAMILY_SHORT`)

### P2-8 En skæv deling vises som "4 : 2 = −1" i regnestykket

- **Fundet af:** regioner-1-4.
- **Efterprøvning:** genskabt af skeptikerne 2 af 2 gange (telefon og telefon på tværs) og ikke tilbagevist.
- **Skærm og format:** opgave `share` (div2510, "Del lige.") på kiste-stenen i Delekløften, fejlforløbet. Telefon 393×852 (skeptikerne også 852×393).
- **Trin:**
  1. Opret et nyt barn i 3. kl. med Stjernefjeldet åbnet, som "Åbn hele Stjernefjeldet" gør.
  2. Spil Delekløften l1 og l2, og spil så kisten (`w3-division-chest`).
  3. Ved "Hvad er 4 divideret med 2?" (share, "Del lige.") lægger du alle fire gulerødder på den første tallerken.
  4. Tryk på fluebenet.
- **Set:** Regnestykket i opgavekortet viser "4 : 2 = −1" med −1 overstreget. Viewets interne værdi for en skæv deling (−1, `shareUnequal`) vises altså som et tal. Rækken med strategien viser derimod tallerknerne rigtigt (4 og 0).
- **Burde:** Barnets forkerte svar vises som den skæve deling (billedet) eller som et tomt eller overstreget felt. Et barn i 3. kl. må aldrig se et negativt tal som sit svar.
- **Skærmbilleder:** `artifacts/qa3b/regioner-1-4/shots/div-phone-w3-division-chest-teach-1-div2510-d2.png` (udsnit `shots/zoom-div-share-minus1.png`); skeptikerne: `artifacts/qa3b/skeptiker-div-minus1/shots/phone-4-card-zoom.png`, `artifacts/qa3b/skeptiker-share-minus1/shots/land-3-after-check-2-teaching.png`
- **Fil:** `src/ui/scenes/PromptScene.tsx` (ligningsscenens `answered` tager et vilkårligt tal fra `given`, ca. linje 180), `src/ui/task/share/View.tsx` (−1 = skæv deling), `src/engine/skills/muldiv/div2510.ts`

### P2-9 Mønter og butik flyder ud over kortet, når det krymper i fejlflow og hjælp. Hjælpen viser 8,50 kr. i stedet for 9 kr.

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `choice` (kronerOre fiftiesInKroner og addHalves) i Markedet: fejlflow og lyspære. 393×852 og 375×667.
- **Trin:**
  - a) 393×852: svar forkert på "Hvor mange penge er der?" med 20 halvtredsører (`kro:fiftiesInKroner:1000`, ven-stenen).
  - b) 375×667: tryk på lyspæren ved "Det koster fire kroner og halvtreds øre. Hvad koster to af dem?" (`kro:addHalves:450`), og svar derefter forkert.
- **Set:**
  - a) I fejlflowet ligger mønterne over stenrækken og under boblen.
  - b) Pærens hjælp har ifølge DOM'en "2 KR 2 KR 2 KR 2 KR 50 ØRE 50 ØRE 9 kr.", men kun fem mønter ses (= 8,50 kr.). Den sidste 50-øre og "9 kr." er skåret væk.
  - b) I fejlflowet hænger prisskiltene over stenrækken, gulerødderne er væk, og "9 kr." er gemt bag panelet.
- **Burde:** Billedet bliver inde i kortet og viser hele hjælpen.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/B-help-kronerOre-addHalves-choice.png`, `A-teach-w3-penge-maal-friend-kronerOre-fiftiesInKroner-choice-1.png`, `B-teach-w3-penge-maal-l1-kronerOre-addHalves-choice-2.png`
- **Fil:** `src/ui/scenes/PromptScene.tsx` (`CoinRow`, scene `shop`), `src/ui/scenes/scenes.css` (`.tv-coins` med fast `--mm`)

### P2-10 På tværs er "9 meter 63 centimeter = ? centimeter" bredere end kortet, så meter-tallet er skåret af

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `keypad` (convertCmM mCmToCm) i Markedets mesterprøve. 852×393. På 393×852 er det i orden, for der skaleres ligningen ned.
- **Trin:** Telefon på tværs: spil `w3-penge-maal-trial` til "Hvor mange centimeter er ni meter og treogtres centimeter?" (`cmm:mCmToCm:9:63`).
- **Set:**
  - Ligningen går fra x = −43 til 478 px, og kortet går fra ca. 16 til 419 px.
  - "9" og "m" i "meter" er skåret af ved skærmens venstre kant, og det sidste "centimeter" går ud over kortet og ind mod tastaturet.
  - Barnet ser "meter 63 centimeter = ?", så meterne står kun i lyden.
- **Burde:** Hele ligningen står inde i kortet.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/C-ask-convertCmM-mCmToCm-keypad.png`, `C-layout-cmm_mCmToCm_9_63_8.png`
- **Fil:** `src/ui/scenes/PromptScene.tsx` (`equationEm`/`--eq-em` tæller ikke enhedsordene med), `src/ui/design/design.css` (`.tv-eq--nowrap`)

### P2-11 Arealhaven på iPhone SE: figuren i tastatur-opgaver er større end kortet og dækker stenrækken, dyret og boblen

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `keypad` (area lShape, rowsCols og countSquares) i Arealhaven. 375×667. 393×852 og 852×393 er i orden.
- **Trin:** 375×667: spil `w3-areal-l1` eller `w3-areal-l3` til en area-opgave med tastatur (fx `ara:r:5x5` eller `ara:l:4x4-1x2`).
- **Set:**
  - Figuren er ca. 250 px høj i et kort på ca. 95 px.
  - Den ligger oven på stenrækken foroven og over kaninen og boblen "Skriv svaret." forneden.
  - Lyspæren er halvt dækket af svarfeltet.
- **Burde:** Figuren skaleres ind i kortet, så stenrækken, dyret, boblen og lyspæren er frie.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/B-ask-area-lShape-keypad.png`, `B-ask-area-rowsCols-keypad.png`
- **Fil:** `src/art/materials/Grids.tsx` (`SquareGrid` med fast `cellPx = 36`), `src/ui/scenes/PromptScene.tsx` (scene `area`)

### P2-12 Figurer med rette hjørner: figurerne er bredere end deres kort, så hjørnerne er skåret af på iPhone SE

- **Fundet af:** regioner-5-7-finale.
- **Skærm og format:** opgave `multiSelect` (sortShapes rightAngle) i Arealhaven: l2, prøve og blandet. Skåret af på 375×667. På 393×852 rører figurerne kortkanterne.
- **Trin:** 375×667: spil `w3-areal-l2` til "Tryk på alle figurer med fire rette hjørner.". Svar forkert én gang, og se knappen "Tryk på …".
- **Set:**
  - Rektanglet, ottekanten, femkanten og det stribede kvadrat er skåret af ved højre kant, så netop de højre hjørner mangler.
  - I fejlflowet stikker den tredje figur i "Tryk på …" ud over den grønne knap og panelet.
  - På 393×852 står figurerne forskudt mod højre og rører kortkanten.
- **Burde:** Hver figur står helt inde i sit kort, for opgaven handler netop om hjørnerne.
- **Skærmbilleder:** `artifacts/qa3b/regioner-5-7-finale/shots/B-ask-sortShapes-rightAngle-multiSelect.png`, `B-teach-w3-areal-l2-sortShapes-rightAngle-multiSelect-1.png`, `A-layout-srt_rightAngle_570_6.png`
- **Fil:** `src/ui/task/multiSelect/View.tsx` og figur-ansigterne i `src/ui/task/faces.tsx`, `ConfirmButton` i `src/ui/screens/child/round/Teaching.tsx`

### P2-13 Det digitale ur stikker ud af knappen "Tryk på …"

- **Fundet af:** regioner-1-4.
- **Skærm og format:** fejlforløbet i clockDigital (analogToDigital og digital24 som choice) i Minuttårnet. 393×852 og 375×667.
- **Trin:** Spil Minuttårnet l1, og svar forkert på "Find det digitale ur, der viser det samme.".
- **Set:**
  - Uret "8:10" er bredere end den hvide boks og stikker ud til højre over den grønne knaps kant.
  - På 375×667 når det helt ud til skærmkanten, uden for strategikortet ("6:40").
- **Burde:** Det digitale ur i svarfeltet ligger inden for den hvide boks og den grønne knap, som ure og tal gør andre steder.
- **Skærmbilleder:** `artifacts/qa3b/regioner-1-4/shots/ur-phone-w3-klokken-l1-teach-3-clockDigital-analogToDigital.png`, `ur-se-w3-klokken-l1-teach-3-clockDigital-analogToDigital.png` (udsnit `shots/zoom-ur-phone-confirm-digital.png`)
- **Fil:** `src/ui/screens/child/round/Teaching.tsx` (`ConfirmButton`, `Face` i størrelse `md`), choice-ansigtet for det digitale ur i `src/ui/task/faces.tsx`, `.tv-confirm__answer` i `src/ui/task/task.css`

### P2-14 "Det lærte du" på 375×667: stjerner, perler og point ligger under knapperne

- **Fundet af:** regioner-1-4.
- **Efterprøvning:** genskabt af skeptikerne 1 af 1 gang.
- **Skærm og format:** ceremonien "Det lærte du" efter en tur i Minuttårnet (kort med ure). 375×667 (telefon SE).
- **Trin:**
  1. Opret et nyt barn i 3. kl. med Stjernefjeldet åbnet, i viewport 375×667.
  2. Spil Minuttårnet l1 eller l2 til ende.
  3. Vent ca. 3 s på skærmen "Det lærte du".
- **Set:**
  - Selve turen er fin; fejlen er på skærmen bagefter.
  - I l2 er stjernerne skåret over af knapperne (top 526–588 px, og knapperne starter ved 573 px). Perler og point kan ikke ses (top 598 px og bund 712 px i en viewport på 667 px).
  - I l1 stikker kun toppen af perle- og point-pillerne frem over knapperne.
  - `tv-cer__stage` kan scrolles (scrollHeight 668–690 mod clientHeight 535), men det kan barnet ikke se.
  - Med regnestykker i stedet for ure (Tabeltoppens prøve) er der plads. Det er altså FIX3a's nye kort med urskive, der fylder.
- **Burde:** Stjernerne, "+N perler" og "+N point" kan ses over "Næste" og "Til kortet", som på 393×852 og 852×393, eller kortene bliver mindre.
- **Skærmbilleder:** `artifacts/qa3b/regioner-1-4/shots/ur-se2-w3-klokken-l2-cer-0-summary-late.png`, `ur-se-w3-klokken-l1-cer-0-tv-cer-summary.png`; skeptikerne: `artifacts/qa3b/skeptiker-cer-se/shots/se-w3-klokken-l2-summary-3s.png`, `se-w3-klokken-l2-summary-swiped.png`
- **Fil:** `src/ui/screens/child/ceremony/Steps.tsx` (`tv-cer-summary`/`has-earn`, FIX3a's kort med urskive) og ceremoniens CSS (`tv-cer__stage`)

### P2-15 Isbjørnens hovedudsnit skærer snuden og næsen af: HUD-avataren, ven-stenen, æggevalget og regnbuevalget

- **Fundet af:** kunst-i-sammenhaeng. qa3a-genkontrol så det samme i regnbuedyr-valget og meldte det som P3.
- **Skærm og format:** kortets HUD (buddy-avataren øverst til venstre), Brøkbageriets ven-sten på kortet og ceremoniens "Hvilket dyr skal ægget være?" og "Vælg et regnbuedyr.". 393×852 (HUD, ven-sten og regnbuevalg), 1180×820 (HUD) og 375×667 (æggevalg).
- **Trin:**
  1. Nyt barn i 3. kl. med Stjernefjeldet åbnet ("Åbn hele Stjernefjeldet").
  2. Spil Brøkbageriet l1 og l2, og se ven-stenen på kortet.
  3. Spil ven-stenen, og få isbjørnen.
  4. Tryk på isbjørnen i Dyrehaven, og vælg "Tag med på tur". Se avataren øverst til venstre på kortet.
  5. Når rugeægget er varmt, og der ikke er valgt art, viser ceremonien efter turen "Hvilket dyr skal ægget være?" med et isbjørnekort. (Genvej i kørslen: dyret lagt i profilen og `useMeta.setBuddy`, svarende til knappen.)
  6. Regnbuevalget: giv alle Brøkbageriets sten 3 stjerner undtagen l1, og spil l1 uden fejl.
- **Set:**
  - Udsnittet er en symmetrisk boks om hovedets ellipse. Isbjørnens snude peger mod venstre i trekvart profil og skæres af med en lodret, lige kant inde i den runde ramme.
  - Næsen mangler, og der er kun en flig af munden. Hovedet sidder skævt mod højre, så buddyen ligner en hvid klat med lukkede øjne.
  - Ven-stenen viser det samme. I æggevalget og regnbuevalget er snuden skåret af ved kortbilledets venstre kant, mens pegasus, drage og pingvin er pæne.
- **Burde:** Hovedet står centreret med den lange snude, den sorte næse og munden. Alle andre arter får det i samme udsnit (hest, enhjørning, panda, hamster, pingvin, drage), og isbjørnen ser sådan ud i finalen, i Dyrehaven og i garderoben. Kunst-gate G3 nævner snuden som isbjørnens kendetegn.
- **Skærmbilleder:** `artifacts/qa3b/kunst-i-sammenhaeng/shots/hud-all-species.png` (12 arter side om side), `hud-avatars-new-species.png`, `stones-friend-fjeld.png`, `crop-eggpick-se.png` (fra `bd-pegasus-se-cer1.png`); `artifacts/qa3b/qa3a-genkontrol/shots/misc-phone-broeker-cer2.png`, `crop-polarbear-pick.png`
- **Fil:** `src/art/rig/Rig.tsx` (crop `head`, l. 242–251: `box(headCenter ± headRx·1.12, …)` tager ikke snuden med), `src/art/species/polarbear.tsx` (hovedets ankre). Udsnittet bruges i `src/ui/screens/child/map/Hud.tsx`, `map/RegionSection.tsx` (l. 163), `ceremony/Steps.tsx` (`PickAnimal`, `PickOption`), `animals/EggCard.tsx` og `books/Collection.tsx`

---

## P3 – senere (ikke efterprøvet)

Fundene her kommer direkte fra reviewerne og er ikke efterprøvet af skeptikerne eller genskabt af rette-agenterne. Skærmbillederne ligger i `artifacts/qa3b/<dimension>/shots/`.

| # | Skærm / format | Fund | Skærmbillede | Fil | Status |
|---|---|---|---|---|---|
| 1 | opgave pay "Betal for to af dem" i strategien, telefon 393×852 | De to prisskilte "14,50 kr." stikker ca. 10 px op over opgavekortets øverste kant og dækker det meste af de to stjerner. Med én ting ligger alt inden for kortet. | `qa3a-genkontrol/…/inj-pay-phone-1-teach.png`, `crop-twice-teach.png` | `src/ui/screens/child/RoundScreen.tsx` (`shopsTwice`/`TWICE`), `src/ui/screens/child/round/round.css` | ikke efterprøvet |
| 2 | fejlflow kronerOre og change, alle formater | Beløb midt i en sætning mister forkortelsens punktum: "14 kr plus 14 kr giver 28 kr.", "Betal først 10 kr og læg så en halvtredsøre.". Tastaturets svarkort viser "40 kr", mens kortene ellers viser "9 kr.". Andre steder står "Fra 74 til 100 er 26 kr.". Gammel kode (UI1), ikke en regression. Meldt af qa3a-genkontrol og regioner-5-7-finale. | `qa3a-genkontrol/…/inj-pay-phone-1-teach.png`, `regioner-5-7-finale/…/B-teach-w3-penge-maal-l1-kronerOre-addHalves-choice-2.png` | `src/ui/hint/displayText.ts` (linje 95: `formatMoney(...).replace(/\.$/, '')`), `src/ui/task/keypad/View.tsx` (`UnitSuffix`), `src/speech/clips/skills/money3.ts` | ikke efterprøvet |
| 3 | onboarding, klassetrin, telefon 393×852 | Ved 3. klasse står "Alle starter i Engdalen." kortvarigt, mens stigens chunk hentes, og "Spil" er grå. Et tryk 0,8 s efter blev ignoreret, og bagefter skiftede skærmen til "Vis mig gerne, hvad du kan …" og "Næste". I en anden kørsel kom linjen efter 311 ms. Afhænger af hastigheden. | `qa3a-genkontrol/…/onb-skip-phone-error.png` (sluttilstand), log `onb3-skip-phone.out` | `src/ui/screens/child/OnboardingScreen.tsx` (`startLine`/`waiting`: `s.onb.grade.start` vises, mens `ladder === null`) | ikke efterprøvet |
| 4 | opgave med ur i opgavekortet (clockElapsed med startur, digital24), 375×667 | Starturet (ca. 120 px) stikker ud over et kort på ca. 95 px og rører stenene i fremdriftsstien. Det digitale ur "17:15" går også ud over kortets kant. | `regioner-1-4/…/ur-se-w3-klokken-l2-ask-clockElapsed-plusHalf-clockSet.png` (udsnit `zoom-ur-se-prompt-clock.png`), `ur-se-w3-klokken-l1-ask-clockDigital-digital24-clockSet.png` | `src/ui/screens/child/RoundScreen.tsx` (`is-compact`/`tv-round__card`), urscenen i `src/ui/scenes/PromptScene.tsx` | ikke efterprøvet |
| 5 | fejlflow i div2510, divAll og inverseOps, 393×852 og 852×393 | QA3a's P3-2 er kun rettet på skærmen ("Så giver 18 : 3 = 6."). Talen er stadig "Så giver atten divideret med tre seks" (`hint.div.soGives`), med to tal lige efter hinanden. Det samme gælder `hint.inverseOps.soGives`. Fx "18 divideret med 3 er 6." kan både høres og læses. | `regioner-1-4/…/div-land-w3-division-l1-teach-1-div2510-d2.png` (voice-log `div-phone.jsonl`, `teachVoice`) | `src/engine/skills/muldiv/tables.ts` (`soDivided`), `src/speech/clips/skills/muldiv3.ts` (`hint.div.soGives`), `hint.inverseOps.soGives` | ikke efterprøvet |
| 6 | fejlflow i mulTens, Tabeltoppen, 393×852 | Hintet til "5 gange 90" viser 45 stænger tæt side om side i én række. Man kan hverken tælle dem eller se de 5 grupper, som teksten "5 gange 9 tiere" taler om. | `regioner-1-4/…/tab-phone-w3-tabellen-l2-teach-1-mulTens-oneDigitTimesTens.png` (udsnit `zoom-mulTens-rods.png`) | `src/engine/skills/muldiv/mulTens.ts` (visual `{ scene: 'base', t: a * t }`, linje 63) | ikke efterprøvet |
| 7 | stenkort og tur på l3 ("Skriv selv"), alle fire regioner 1–4 | Arket siger "Her skriver du selv svarene.", men 16 af 36 første forsøg var choice (Trecifret bro 5/8, Tabeltoppen 4/10, Minuttårnet 4/8, Delekløften 3/10). Nøgler i boks 0 får kort (production `fromBox1`). | `regioner-1-4/…/bro-phone-w3-store-tal-l3-sheet.png` | `src/speech/clips/ui/map.ts` (`s.map.about.l3`), `src/content/curriculum.ts` (l3 production `fromBox1`) | ikke efterprøvet |
| 8 | fejlflow i placeValue1000 regroup, Trecifret bro | Strategien stopper halvvejs: "Ti enere er en tier. 17 enere er 1 tier og 7 enere." Sammenlægningen til 67 mangler i ord, selv om billedet og knappen viser 67. | `regioner-1-4/…/bro-phone-w3-store-tal-l2-teach-3-placeValue1000-regroup.png` | `src/engine/skills/place/placeValue1000.ts` (hintet til regroup) | ikke efterprøvet |
| 9 | fejlflow i mul34 (×1) og clockDigital handsSwapped, 393×852 | "Tæl i spring med 3. 3. 1 gange 3 giver 3." Det enlige "3." ligner en fejl (mul6to9 siger "Når vi ganger med en, får vi tallet selv."). "Den lange viser peger på 2 og det er 10 minutter." mangler et komma. | `regioner-1-4/…/tab-phone-w3-tabellen-l1-teach-1-mul34-t3.png`, `ur-phone-w3-klokken-l1-teach-3-clockDigital-analogToDigital.png` | `src/engine/skills/muldiv/mul34.ts` (skip-hintet for ×1), `src/speech/clips/skills/clock3.ts` | ikke efterprøvet |
| 10 | lyspære ved area (countSquares, compareArea), værst på 375×667 | Hjælpen deler kortet i to ens kopier af figuren uden ny information. På SE med tastatur bliver cellerne ca. 7 px. Svaret logges stadig som hjulpet. | `regioner-5-7-finale/…/B-help-area-countSquares-keypad.png`, `B-help-area-compareArea-choice.png` | `src/ui/hint/hintFor.ts` (`addsToPrompt`), `src/engine/skills/shapes/area.ts` (hint-billedet er `promptOf(f)`) | ikke efterprøvet |
| 11 | fejlflow area lShape | Strategien siger "Del figuren i to rektangler" og nævner 8 og 6, men billedet viser figuren uden deling. | `regioner-5-7-finale/…/B-teach-w3-areal-l1-area-lShape-choice-1.png` | `src/engine/skills/shapes/area.ts` (hint for lShape bruger `promptOf(f)`) | ikke efterprøvet |
| 12 | opgave unitChoice weight (choice og multiSelect), Markedet, alle formater | Tingen ("Hvad måler man vægten af en kuffert i?") og enheden ("… i kilogram" eller "… i gram") står kun i lyden. Kortet er en højttaler, og boblen siger "Tryk på svaret." eller "Find dem alle.", selv om vægt-piktogrammerne nu findes. Kommentaren i `unitChoice.ts` om ordkort, "until drawn", passer ikke længere. Meldt af regioner-5-7-finale og kunst-i-sammenhaeng, som mener, den kan løftes til P2 (samme mønster som QA3a's P2-3). | `regioner-5-7-finale/…/A-ask-unitChoice-weight-multiSelect.png`, `A-ask-unitChoice-weight-choice.png`; `kunst-i-sammenhaeng/…/wt-se-choice-enh_weight_suitcase#5-8.png` | `src/engine/skills/measure/unitChoice.ts` (prompt `{ scene: 'hear' }`, l. 11–12), `src/speech/clips/ui/kinds.ts` | ikke efterprøvet |
| 13 | opgave choice payExact fewestCoins, Markedet l2, 393×852 | "Færrest" står kun i lyden; boblen siger "Tryk på svaret.". To af de tre kort giver 76 kr. (50+20+5+1 og 20+20+20+10+5+1), det tredje 75 kr. Pay-versionen siger "Betal med så få mønter og sedler som muligt." | `regioner-5-7-finale/…/A-ask-payExact-fewestCoins-choice.png` | `src/speech/clips/ui/kinds.ts` (`FAMILY_SHORT` har kun pay-nøgler) | ikke efterprøvet |
| 14 | opgave choice kronerOre addHalves, 375×667 | "9,50 kr." er bredere end svarkortet og går ud til skærmkanten, og "4,50 kr." rører begge kanter. | `regioner-5-7-finale/…/B-ask-kronerOre-addHalves-choice.png` | `src/ui/design/AnswerCard.tsx`, `src/ui/task/choice` (skriftstørrelse for beløb) | ikke efterprøvet |
| 15 | ceremoni, finale (Verdensfest), 852×393 | Pegasus, drage, pingvin og isbjørn er skåret af ved brystet lige over knapperne "Næste" og "Til kortet". | `regioner-5-7-finale/…/C-cer-fjeld-finale-1-finale.png` | `src/ui/screens/child/ceremony/Steps.tsx` (`FinaleParty`), `ceremony.css` | ikke efterprøvet |
| 16 | kortet, fjeldets scene, 375×667, 393×852, 852×393 og 820×1180 | Scenens isbjørn er skjult bag docken eller panelerne i 4 af 5 formater. Den kan kun ses i 1180×820. Den ligger ved y = 0,885–0,99 af højden, og scenen er forankret i bunden (`xMidYMax slice`). | `kunst-i-sammenhaeng/…/bear-in-scene.png`, `crop-bottom-scene-se-0.png`, `crop-bottom-scene-ipad-0.png` | `src/art/scenes/fjeld.tsx` (bear l. 220, 286 og 348), `src/ui/screens/child/map/Backdrop.tsx` | ikke efterprøvet |
| 17 | finalens ceremoni → garderoben, 393×852 | "Prøv dem på" med en pegasus som buddy: pegasus får medaljon og dragt, men jetpacken kommer ikke på nogen, og garderoben åbner på fanen Hals. Forklaringen kommer først, når barnet selv trykker på Ryg. Intet tabes; jetpacken ligger i "Dit tøj". `pickAnimalFor` ville give den til kaninen. | `kunst-i-sammenhaeng/…/ft-finale-phone.png`, `ft-wardrobe-after-tryall.png`, `ft-wardrobe-back-tab.png` | `src/ui/screens/child/ceremony/Steps.tsx` (`tryOnAll`, l. 416–423), `src/ui/screens/child/wardrobe/model.ts` (`pickAnimalFor`, `slotLocked`) | ikke efterprøvet |
| 18 | kortet, ven-stenene i Tabeltoppen og Minuttårnet, 393×852 og 1180×820 | Medaljonen på stenen viser artens standardfarve (hvid pegasus med blå manke, grøn drage), mens stenkortet viser og barnet får en rosa pegasus og en lilla drage. Kortet og stenen modsiger hinanden, også efter mødet. | `kunst-i-sammenhaeng/…/main-tab-friend-sheet.png`, `main-map-after-friend.png`, `sp-dragon-ipadLand-sheet.png` | `src/ui/screens/child/map/RegionSection.tsx` (l. 162–163: `AnimalPicture` uden race og farve), `map/model.ts` (`view.friend`) | ikke efterprøvet |
| 19 | forældre: Overblik, Færdigheder og udskrift, iPad 820×1180 og telefon | Tendensen siger "Rykket op: … 6- til 9-tabellen", mens rækken siger "Sprunget over ved start · ikke prøvet endnu", og udskriften siger "Sprunget over ved start · øvet i dag". `trendOf` brugte `dash` i stedet for `dot`, og mul6to9 deler nøgler med mul34. | `indplacering-foraeldre/…/par-ipad-tab-0-Overblik-0.png`, `par-ipad-tab-2-Færdigheder-1.png`, `par-ipad-print.png` | `src/parent/metrics.ts` (`trendOf`), `SkillsTab.tsx`, `PrintReport.tsx` | ikke efterprøvet; rettet i FIX3e (`bd5d214`) |
| 20 | stigens outro, 393×852 | Pip takker "fordi du viste mig det", også når barnet trykker "Det er nok" før første svar. | `indplacering-foraeldre/…/onb-before-phone-5-outro.png` | `src/ui/screens/child/onboarding/placement/PlacementStep.tsx`, `src/speech/clips/ui/placement.ts` | ikke efterprøvet; rettet i FIX3e med den neutrale slutlinje `s.place.done.none` (A24, `c493e9b`) |
| 21 | forældre, Indstillinger, "Hent fra en fil", 1180×820 | "Filen indeholder Mira (3. klasse), gemt 8. okt.." med dobbelt punktum. | `indplacering-foraeldre/…/imp-ipadLand-1-incoming.png` | `src/ui/screens/parent/dashboard/SettingsTab.tsx` (ca. linje 155) | ikke efterprøvet; rettet i FIX3e |
| 22 | forældre, hjemmetip for add1000 | Tippet siger "først hundrederne, så tierne og til sidst enerne", mens appens strategi regner enerne først. Tippet er kun læst i kilden (R2 blev ikke udløst). | `indplacering-foraeldre/…/onb-deep-ipad-4-miss-8.png` (strategien) | `src/parent/tips.ts` (`SKILL_TIPS.add1000`, linje 41) | ikke efterprøvet; rettet i FIX3e |
| 23 | kortet, "Næste tre mål" | "Tag en tur forbi Tabeltoppen" mangler punktum, mens de to andre mål har det. | `indplacering-foraeldre/…/par-ipad-sheet-markedet-l1.png` | `src/ui/screens/child/map/SidePanel.tsx` (Goals) | ikke efterprøvet; rettet i FIX3e |
| 24 | ceremoni "Det lærte du" i 2. kl.'s procedure-regioner (Vekselvandet, Købmandsgården), 393×852 og 820×1180 | Kun stjerneikonet og "Du har øvet dig godt." efter alle 5 ture, selv om barnet svarede rigtigt på 9–10 opgaver. Det er ikke en regression; `a5b1ccb` viser det samme. FIX3a gælder kun familier med grade ≥ 3 (`isFjeldFamily`), så hullet fra QA3a's P2-1 skiller sig nu mere ud ved siden af fjeldet. | `regression-0-2/…/r-Bo-w2-veksling-l1-phone-cer-0-summary.png` (base `rbase-Bo-w2-veksling-l1-phone-cer-0-summary.png`), `r-Carl-w2-penge-l2-ipad-cer-0-summary.png` | `src/ui/screens/child/ceremony/describe.ts` (`isFjeldFamily`, `keyFace`), `src/speech/clips/ui/learned3.ts` | ikke efterprøvet |

## Hvad virker godt

1. **QA3a's rettelser holder, og flere dimensioner har set dem hver for sig.**
   - "Det lærte du" er konkret i alle 7 regioner: "6 · 7 = 42", "927 − 443 = 484", urskiver med "Fem minutter over halv otte", "56 : 8 = 7", mønter med "15,50 kr.", "4 m er 400 cm", et koordinatnet med "(1, 3)", "Figuren dækker 20 kvadrater" og "Fra den mindste er de 1/6, 1/5, 1/4 og 1/2".
   - Pay-boblen følger familien, og "to af dem" viser to ens ting.
   - Brøker i rækkefølge viser retningen i tre formater.
   - Stigen bestemmer starten.
2. **Fingeren og matematikken.**
   - 839 opgaver i regionerne (478 + 361) blev besvaret, alle undtagen 5 med fingeren. I regioner 1–4 blev alle rigtige svar bedømt rigtigt.
   - Alle 141 fejlforløb havde rigtig matematik: overstreget svar, strategi med billede og én stor "Tryk på …" med det rigtige ur, de rigtige tallerkner eller den rigtige vippe.
   - clockSet stod aldrig på svaret fra start, og clockElapsed starter på starttiden. 24-timersopgaver godtages på 12-timersskiven. Kolonnerne veksler rigtigt (393 − 4, 207 − 67), og ":" læses "divideret med" med broen fra "delt med".
3. **Hele kæden kan spilles igennem.**
   - Alle 7 regioner er spillet med alle seks sten, og prøverne endte med "Broen holder! Tågen letter.".
   - To prøver blev dumpet med vilje: "Klar, når du er. Bedst: 5 planker", hytten med 10 opgaver og så prøven igen med 9.
   - Finalens stenkort var låst efter 4 prøver og åbent efter 5. Finalen blev bestået med 11 planker, og verdensfesten gav "Dine nye ting: Stjernemedaljon, Rumdragt, Jetpack".
4. **Kunsten hænger sammen i appen.**
   - Pegasus, drage, pingvin og isbjørn virker ved ven-stenen, ved klækning og navngivning, i Dyrehaven, i garderoben og som buddy. Ved hjælpen har isbjørnen "tænke"-humøret.
   - Astronaut-sættet passer på 10 dyr af 9 arter, også guld og regnbue, og ingen øjne er dækket.
   - Jetpacken er låst for arter med vinger med en klar sætning.
   - Vægt-piktogrammerne kan læses på svarkortene, og sofaen er en sofa.
   - Scenen står bag kortet i alle fem formater. Mindste sten er 68 px, og ingen af de 43 sten er dækket, når den står midt i billedet.
5. **Indplaceringen og forældredelen.**
   - De almindelige veje lander der, hvor A24 siger, med første tur, hjemverden, næste sten og mål. Det gælder også søskende, genindlæsning og import på en ny enhed (508 seedede nøgler).
   - Stigens svar logges som `placement`, giver 0 perler og tæller ikke i nøjagtigheden ("1 tur · 10 opgaver · 90 %").
   - Forældrene ser 7 faner uden overløb, "Klar til: Minuttårnet" og en udskrift efter Fælles Mål uden perler og dyr. De 16 hjemmetips er regnet rigtigt.
6. **Ingen regression i 0.–2. kl.**
   - Onboarding, dyr, tøj, Dyrehave, butik, bøger og Ada's dashboard er pixel-identiske med `a5b1ccb`, bortset fra tilsigtede ændringer: målene, forældreintroen, Indstillingerne og tabelgitteret.
   - Købmandsgårdens pay-boble er rigtig, også efter en fejl.
   - Alle klip i 0.–2. kl. findes i manifestet. Testene for kunst-snapshots (671), rækværk-scan med kort-, butik- og dyretests (106) og orakler (641) består.
7. **Rækværket (§13) holder.**
   - 0 konsolfejl og 0 kald til andre domæner i alle kørsler.
   - 0 trykmål under 60 px i regioner 1–4 og i indplaceringen, og ingen vandret scroll.
   - Ingen streak, nedtælling eller sjældenhed. "Næste" og "Til kortet" står side om side, og perler og point tælles først efter "Det lærte du".

## Dækning: hvad der ikke blev tjekket

- **Stemmen:**
  - Stemmen til bølge 3 var ikke merget under reviewet, så oplæsningen er ikke vurderet mod manifestet, og QA3a's P1-1 er ikke genkontrolleret.
  - Lyt efter `s.ceremony.choose` ved stemmens merge (se QA3a's P3-7).
- **Formater:**
  - Regionerne er ikke spillet på iPad. iPad er kun brugt i kunst, indplacering og regression.
  - Tabeltoppen og Minuttårnet er ikke spillet på 852×393, og Delekløften og Trecifret bro ikke på 375×667.
  - Indplaceringen er ikke kørt på telefon på tværs, og dashboardets faner er ikke set på iPad på tværs.
  - Garderoben er ikke set på 375×667 eller på tværs.
  - 4× CPU-throttle er ikke kørt.
- **Opgaver:**
  - Om koordinatnettets hop (P1-1) også sker ved aflæsning og på iPad på tværs. Kun placering på telefon er målt.
  - Dobbelt veksling over nul i spil. Den kom kun som rigtigt svar, så QA3a's P3-4 er set i en påtvungen opgave.
  - sortOrder, multiSelect og pay i regioner 1–4. fillSlots (4 gange) og buildBase (3 gange) kom sjældent, og fillSlots og sortOrder er kun prøvet med tryk, ikke med træk.
  - Træningshyttens tur efter Tabeltoppens dumpede prøve. Guldæg er kun besvaret rigtigt.
  - Brøkbageriet l3 på 393×852 (stenkortet åbnede ikke, sandsynligvis scriptet) og Arealhavens kiste på 393×852 og 852×393.
  - fiftiesInKroner med 20 mønter i selve spørgsmålet på 393×852. Layout-tjekket meldte et kort på 278–400 px, men uden skærmbillede, så det er ikke meldt.
  - Byttepenge- og clockElapsed-kort i "Det lærte du".
- **Kunst og ceremonier:**
  - Samlebogens hovedudsnit af isbjørnen (scriptet fejlede på selektoren).
  - Pingvin og isbjørn klækket fra æg. Kun dragen er klækket.
  - Stjerneform, tricks og animationer (snus, vinger).
  - Butikkens Tøj-hylde efter køb.
- **Forældre:**
  - `coordSwap` og `biggerDenominator` som levende tegn under "Vi har set tegn på …". Kun teksterne er læst.
  - Klassetrinsestimatet A22 med mange svar og anbefalingerne R1–R5. Kun R6 er set.
  - Målene på en ny læringsdag, import før frigivelsen og "Erstat …s data".
  - Forældreintroens tekst på skærmen (kun i kilden).
  - QA3a's P3-10 er kun tjekket i koden og P3-11 kun i build.
- **0.–2. kl.:**
  - Mesterprøver, finaler, regnbue- og guldvalg.
  - Figurhavens `mirrorGrid` gennem grid-kind.
  - Liggende format, eksport og import, profilvælger og søskende.
  - Dashboardets faner 4–7 på telefon: fanebjælken scroller vandret, og trykkene ramte uden for skærmen. Det samme sker i base, og iPad dækker alle 7 faner.
  - Base-onboardingen på iPad.

## Tilbagevist under efterprøvningen

- **Ingen fund blev tilbagevist.** Skeptikerne nåede tre dommer, før efterprøvningen blev stoppet. P2-8 ("4 : 2 = −1") blev genskabt 2 af 2 gange og P2-14 ("Det lærte du" på 375×667) 1 af 1 gang.
- **Afvist af reviewerne selv og derfor ikke meldt:**
  - "Spring over" landede i Stortalsbjerget i qa3a-genkontrol. Den kørsel havde ikke `fjeld` i `RELEASED_WORLDS`, så det er forventet. Med frigivelsen efterlignet gav "Spring over" Tabeltoppen (indplacering-foraeldre).
  - En formodet fejl i garderobens faner. Selektoren `[data-slot]` ramte også riggens SVG-lag, og med `.tv-wr-tab` virker fanerne.
  - Pegasus' mule er beskåret i hovedudsnittet ligesom hest og enhjørning. Det er konsekvent og ikke et fund, i modsætning til isbjørnen (P2-15).
  - `ERR_CONNECTION_REFUSED` og "Failed to fetch dynamically imported module" i regioner-1-4. Dev-serveren blev stoppet af harnessens tidsgrænse. Kørslerne er kørt om, og de afbrudte data er holdt ude af tallene.
  - Fanerne 4–7 på telefon i regression-0-2. Fanebjælken scroller vandret, og det gør den også i base.

## De ændringer, der løfter mest før frigivelse

1. **Hold koordinatnettet stille under fingeren (P1-1).** Svarpanelets bredde må ikke skifte ved første berøring i landskab.
2. **Vis det, opgaven spørger om (P2-4 til P2-7, P3-12 og P3-13):** ¾ i boblen, brøken ved brøk af en mængde, hen/op og punktet ved koordinater, "størst/mindst" ved brøk-kort, enheden ved vægt og "færrest". Det er særligt vigtigt, så længe stemmen ikke er i appen.
3. **Skaler billederne ind i kortet på 375×667 og på tværs (P2-9 til P2-14):** mønter, ligninger med enheder, arealfigurer, figurer med hjørner, det digitale ur i "Tryk på …" og "Det lærte du" med ure.
4. **P2-8 og P2-15:** vis ikke −1 som barnets svar, og tag isbjørnens snude med i hovedudsnittet.
5. **Merg stemmen til bølge 3 (QA3a's P1-1),** og tjek `__voiceLog` mod manifestet i én tur pr. region.
