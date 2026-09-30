# Talvennerne 2: kritik af de tre designforslag

Forslag 1 = pædagogik, forslag 2 = spildesign, forslag 3 = kunst, lyd og teknik.

## Kritik: lærer og etik

**Dom:** GODKEND MED ÆNDRINGER. Sådan kombineres de tre forslag: Forslag 1 (pædagogik) er rygraden for taksonomi, mestring, svarmodel, diagnostik og dashboard. Forslag 2 (spil) er belønningslaget, men monteres på forslag 1's regiongraf i stedet for sin egen lineære sti. Forslag 3 (teknik) er asset-, lyd- og lagringspipeline. Fagligt er forslag 1 det stærkeste jeg har set til dansk indskoling: hear*-færdighederne rammer det danske ener-før-tier-problem, dækningen af klokken/penge/brøker er korrekt, og kravet om at "kan selv" først tæller en anden dag er ærligt. Tre ting skal dog rettes, før der bygges. (1) Dyret må ikke se trist ud eller 'savne' barnet (forslag 3 §2.4). Det er en skyldfølelses-mekanik. (2) Forslag 2's lineære etaper låser uafhængige domæner mod hinanden: et barn der ikke kan klokken, kommer ikke videre i plus/minus. (3) Misforståelses-diagnostikken vil flagge tilfældigt gættende børn på opgaver med 2 svarmuligheder. Så får forældre en forkert konklusion med appens autoritet bag. Dertil kommer 13 væsentlige rettelser. De handler om begrebshierarki i figurer, hvad der tæller som 'produktion', at medaljer bliver for billige, dashboardets 0-100-score, indplacering der påstår viden barnet ikke har vist, børn der ikke kan læse, samt daglige mål og sjældenhedsniveauer, der er DSA/ICO-problematiske. Alle rettelser holder sig inden for brugerens låste valg.

### Fund

1. **[blocker] Etik/rig – Forslag 3 §2.4 Mood 'sad' ('når dyret savner barnet ved start') + Forslag 2 §1.4 'Venter på dig'**
   - *problem:* Et dyr der er trist, når barnet vender tilbage efter fravær, er præcis den skyldfølelses-mekanik, som forslag 2 selv forbyder ('Dyrene bliver aldrig ... triste eller ensomme af fravær'). Radesky 2022 og ICO std. 5 kalder det manipulerende design. 'Venter på dig' på en uafsluttet mesterprøve er den samme mekanik i mildere form. V1 bruger desuden mood 'sad' ved forkert svar (RoundScreen.tsx:132).
   - *fix:* Fjern 'sad' fra Mood-unionen i art/rig/types.ts. Ved åbning af appen hilser dyret altid med 'wave'→'happy', uanset hvor længe barnet har været væk. Ved fejl bruges kun 'oops' (fra forslag 3). Omdøb 'Venter på dig' til 'Klar, når du er'. Tilføj en Vitest-test der fejler hvis Mood indeholder 'sad', og en tekst-scan af src/content og src/ui efter /savner|ked af det|venter på dig|glem ikke/i.

2. **[blocker] Progression – Forslag 2 §1.2–1.4 (8 lineære etaper pr. verden, 'højst én åben mesterprøve', hjælpebro)**
   - *problem:* Etaperne skifter domæne (Tyvebroen → Urtårnet → Hundredemarken), og porten er én mesterprøve ad gangen. Et 7-årigt barn der ikke består 'clockWholeHalf', kan derfor højst komme én etape længere og når aldrig 'tensAndOnes'/'addSubTens'. Uafhængige domæner blokerer hinanden, og barnet sidder fast. Det strider mod V1's princip om ingen hård mur (useProfile.isIslandUnlocked) og mod 'så længe barnet vil'.
   - *fix:* Brug forslag 1 §4.3's regiongraf: 4 verdener × 7 regioner, 2 regioner åbne fra start, flere åbner ved ≥4 spillede noder, og hårde forudsætninger kun inden for samme domænekæde (w1-tal100→w1-tiere, w2-tal1000→w2-hundreder, w3-tabellen→w3-division). Læg forslag 2's nodetyper ind i hver region: lesson, lesson, friend|chest, lesson, mix, trial. Behold også tågen, farve efter mestring, planker og hjælpebro. En ikke-bestået prøve låser kun næste region i samme domæne; hjælpebroen åbner efter 3 forsøg. Slet reglen 'højst én åben mesterprøve'. Test i progression.test.ts: for hvert domæne D gælder, at ingen prøve uden for D's kæde kan låse en region i D.

3. **[blocker] Diagnostik – Forslag 1 §3.3 flagregler for 2-valgs- og ja/nej-opgaver (sizeIsWeight, lengthByEnd, unequalParts, prototypeOnly, firstDigitCompare)**
   - *problem:* weightCompare og compareLength har 2 muligheder, og halfShape er trueFalse. Et barn der gætter, har 50 % rigtige og undertrykkes derfor ikke (grænsen er <40 %). Barnet vælger misforståelsens svar i 50 % af mulighederne, altså over 30 %-grænsen. Med vægt 0,5 er 6 træffere på 3 facts over 2 dage nok, så forælderen får at vide 'Vi har set tegn på: Tror store ting altid er tungest' efter cirka 2 sessioner med ren gætning. Ved 3-korts choice ligger gætteraten på 33 %, også over 30 %.
   - *fix:* (a) Raten skal ligge over gætteniveau: flag kræver evidenceRate ≥ min(0,9; pGuess + 0,35), hvor pGuess = 1/antal muligheder. (b) Perceptuelle misforståelser (sizeIsWeight, lengthByEnd, unequalParts, prototypeOnly) testes med kontrast: der skal være ≥6 'konflikt-items' (stor=let, forskudt, skæv deling, drejet figur) og ≥6 'kongruente items'. Flag kun når nøjagtigheden på de kongruente er ≥80 % og misforståelsessvar udgør ≥60 % af konflikt-items. (c) I skills med en produktions-kind kan valg-evidens alene aldrig udløse et flag; der kræves ≥2 produktionstræffere med vægt 1,0. Fixture-tests: en 'uniform random guesser' over 500 svar i alle skills giver 0 flag, og et 'konsekvent sizeIsWeight-barn' flagges inden 20 konflikt-items.

4. **[major] Diagnostik – Forslag 1 §3.2 (30 MisconceptionId'er vist ens for forældre)**
   - *problem:* tableNeighbour (6·7→48), countFromFirst, hourHandMisread, skipStepOne og digitSwap i regneopgaver er huskefejl eller slip, ikke begrebsmæssige misforståelser. Research siger, at 43 % af tabelfejl i 3. kl. er nabosvar, altså normal ufuldstændig genkaldelse. Står de i samme 'Vi har set tegn på …'-boks som equalsAsAnswer og smallerFromLarger, overdiagnosticeres helt normal udvikling, og forældre bekymrer sig uden grund.
   - *fix:* Tilføj `nature: 'concept' | 'slip'` til MisconceptionDef. slip = tableNeighbour, countFromFirst, hourHandMisread, skipStepOne, digitSwap (uden for hear*/tensOnes/placeValue1000). Alle andre er concept. Kun concept-flag vises som 'Vi har set tegn på …' (højst 2 ad gangen). Slip vises samlet under 'Typiske fejl lige nu' med en neutral tekst ('7-tabellen: svarer tit med nabotallet – det er normalt, mens tabellen sætter sig') og bruges ellers kun til hints og den målrettede plads i turen.

5. **[major] Diagnostik – Forslag 1 §3.1 classifyError**
   - *problem:* Koden sletter 'operand' fra hits og kalder derefter globalChecks(digitSwap). Ved 38+45=83 med svaret 38 matcher operand-kandidaten, men den slettes, og svaret klassificeres som digitSwap, fordi 38 er 83 med byttede cifre. Operand-svar bliver dermed evidens for en misforståelse de ikke har noget med at gøre.
   - *fix:* Hvis given matcher en kandidat (inkl. 'near' og 'operand'), returneres dennes tag, og der fortsættes aldrig til globalChecks. Kun et svar der ikke matcher nogen kandidat, går videre til globalChecks. digitSwap-evidens tælles kun i hear20/100/1000, tensOnes og placeValue1000 samt på keypad-svar ≥13 med to forskellige cifre, der ikke også er en operand. Tilføj testen `classifyError(add100Carry, add:38+45, 38) === 'operand'`.

6. **[major] Faglighed – Forslag 1 §1.3 shapes2D 'basic' (0. kl.), sortShapes, shapes3D**
   - *problem:* Et kvadrat er også et rektangel og en firkant, og en terning er også en kasse. Hvis 0. kl. spørger 'Hvilken er et rektangel?' med et kvadrat som distraktor, eller 'Tryk på alle firkanter' uden kvadrater som mål, lærer appen noget forkert og markerer rigtige svar som fejl. 'basic' blander desuden 5 navne (cirkel, trekant, firkant, kvadrat, rektangel) med '4 ×'.
   - *fix:* Indfør en isA-tabel i src/engine/skills/shapes.ts: square⊂rectangle⊂quadrilateral, cube⊂cuboid. I 0. kl. bruges kun {cirkel, trekant, firkant}. 'kvadrat' og 'rektangel' kommer fra 1. kl. med sætningen 'Et kvadrat er også et rektangel' (klip). multiSelect 'alle rektangler' har kvadrater med som mål, og choice viser aldrig en instans af målbegrebet som distraktor. Tilføj en content-test: for alle shapes-opgaver gælder at ingen distraktor isA svaret, og alle isA-instanser er i facit-sættet.

7. **[major] Mestring – Forslag 1 §2.2 isProduction vs. Forslag 3 KindDef.guessP**
   - *problem:* Forslagene definerer 'produktion' forskelligt. sortOrder med 3 kort (1/6 gættesandsynlighed) regnes som produktion. share tæller som produktion for div2510, selvom barnet bare deler ud på skift og aldrig selv siger 4. buildBase tæller for add100NoCarry, hvor klodserne laver regningen. Alle tre fører til 'kan selv', uden at barnet kan genkalde svaret. Forslag 3's guessP ≤ 0,05 ville omvendt udelukke V1's 1-cifrede keypad (1/11).
   - *fix:* Brug én regel: `isProduction(t) = guessP(t) ≤ 0.12 && !MANIPULATIVE_COMPUTES[t.skill]?.includes(t.kind)`. Tærsklen 0,12 dækker keypad 0–10, numberline ±5/100, ±50/1000 og clockSet med timetrin (1/12). sortOrder skal have ≥4 kort. fillSlots kræver paletᵏ ≥ 9. share tæller kun som produktion i shareEqually og fractionOfSet. buildBase tæller kun i tensOnes og placeValue1000. countTap tæller kun i count10/count20. Tilføj en test der beregner guessP for 1.000 seedede opgaver pr. (skill, kind) og viser at ceilingFor giver 3 over grænsen.

8. **[major] Mestring/økonomi – procedure-familier og medaljer (Forslag 1 §4.1 + Forslag 2 §3.2/§4.2)**
   - *problem:* tens100 har 2 familienøgler og kan nå 'Kan selv' eller guld efter cirka 10 produktionssvar over 4 dage. addTo10 (66 nøgler) kræver omkring 330 svar. Guldmedaljer giver Stjernefølet, gyldne dyr og Talmagiker-sættet, så de billigste skills bliver den hurtige vej til de fineste præmier. 'Kan selv' på 10 svar er desuden for lidt dokumentation til forældrene.
   - *fix:* (a) Hver bokspromovering af en familienøgle kræver 2 hurtige, rigtige svar på to forskellige instanser, som ikke findes i recent. Gem dem i KeyState.pendingInstance. (b) Status 'independent' kræver ud over 80 % i boks 4–5 også mindst max(12, 2 × antal nøgler) rigtige produktionssvar fordelt på ≥3 læringsdage inden for de sidste 30 dage. Tilføj en test i economy.sim: ingen skill når guld med <12 produktionssvar eller på <3 dage.

9. **[major] Dashboard – Forslag 1 §5.1 pkt. 4 'domænescore 0–100' og tendenspil**
   - *problem:* Hvis scoren er gennemsnittet af startede skills, falder den når en ny skill åbnes (boks 0–1), og tendenspilen peger ned, selvom barnet er kommet videre. Tæller alle domænets skills til og med 3. kl. med, står en 0.-klasses score fast omkring 5. I begge tilfælde læser forældre et tal 0–100 som en karakter eller procent. Det er uærligt og kan ikke bruges.
   - *fix:* Fjern tallet 0–100 og sparklinen for middelboks. Vis i stedet et fast antal pr. status: 'Kan selv 3 · Med støtte 2 · Øver 1 · Ikke startet 4', hvor nævneren er domænets skills til og med barnets klassetrin + 1. Tendensen skrives som tekst ud fra statusændringer i de seneste 14 dage: '+2 færdigheder rykket op', '1 ser ud til at være glemt (genopfrisk)'. Den beregnes aldrig som et gennemsnit. Test med fixture: at åbne en ny skill giver aldrig negativ tendens.

10. **[major] Indplacering – Forslag 1 §4.2 (seed boks 3) / Forslag 2 §6 (seed boks 2)**
   - *problem:* Når indplaceringen seeder alle kerne-skills under P, står de som 'Kan med støtte' (boks ≥2) på pensumkortet dag 1, selvom barnet kun har løst 2 opgaver pr. checkpoint. Dashboardet påstår dermed viden, der ikke er vist. I 0. kl. kommer indplaceringen desuden før barnet kender keypad og ✓, så den måler mest brugerfladen.
   - *fix:* Seed til boks 2 med `seeded: true` (forslag 2's konservative niveau). Dashboardet viser seedede skills som 'Sprunget over ved start' (stiplet prik), indtil barnet har svaret rigtigt på ≥1 produktionsopgave i skillen, og gradeEstimate udelader dem. Vælger forælderen 0. klasse, springes indplaceringen over. Placér den efter klækningen i onboarding (forslag 2's rækkefølge), og tilbyd 'Kør igen' på dashboardet efter 1 uge.

11. **[major] Brugbarhed for ikke-læsere – Forslag 1 §2.2 'langt tryk (≥400 ms) læser kortet op'**
   - *problem:* V1's ChoiceTask svarer med onClick, og det fyrer også når fingeren slippes efter et langt tryk. Langt tryk indsender altså svaret. 6-årige opdager heller ikke lange tryk. Kort med kun tekst ('cm'/'m', 'ja'/'nej', '<'/'>') kan dermed ikke bruges af børn, der ikke læser.
   - *fix:* Drop langt tryk helt. Ingen svarkort må bestå af tekst alene: optionView unitWord/relation/token skal have et piktogram (lineal eller meterstok, skålvægt, ✓/✗). Når prompten læses op, læses mulighederne også op i rækkefølge, og hvert kort pulserer mens det nævnes ('… centimeter … eller meter?'). 'Hør igen' gentager det hele. Tilføj en test: for hver skill og kind med optionView ∉ {numeral, clock, coin, shape, solid, fraction, picture} findes der en icon- og clipId pr. option.

12. **[major] Brugbarhed for ikke-læsere – 16 TaskKinds med ✓-bekræftelse og tekst på kort/butik/mål (alle forslag)**
   - *problem:* Taleklip alene lærer ikke en 6-årig at trække i en urviser, lægge mønter i en bakke eller trykke ✓. Mange børn glemmer ✓ og sidder og venter. Der er heller ingen håndhævelse af, at kort, butik, trofæer og mål-tekster bliver læst op.
   - *fix:* (a) Hver TaskKind har en demo med en ghost-hånd på 3–5 s. Den afspilles automatisk de 2 første gange pr. profil og kan altid hentes via en 'Vis mig'-knap (ikon). (b) ✓ pulserer og siger 'Tryk på fluebenet, når du er færdig', hvis tilstanden har været gyldig i 3 s uden ændring. (c) Lav en komponent `SpokenText({clip})`. En Vitest-scan af src/ui/screens/child/** fejler ved rå JSX-tekstliteraler uden for SpokenText. Alle trykbare elementer med tekst læses op ved tryk.

13. **[major] Fastholdelse/etik – Forslag 2 §5.1–5.2 'Dagens tre mål' (forsvinder ved midnat, giver perler) + stempelkalender**
   - *problem:* Mål der udløber dagligt og giver bonus, er en daglig belønningsløkke og en aftale-mekanik. En kalender der viser tomme dage, er en skjult streak. Begge dele rammer DSA art. 28-retningslinjerne og ICO std. 5, selvom 🔥 er fjernet. 'Klar 1 tur i dit svageste domæne' hver dag konfronterer desuden barnet med det sværeste hver eneste dag.
   - *fix:* Skift til 'Næste tre mål': de udløber aldrig, giver ingen perler eller XP ud over almindeligt spil, og belønningen er et stempel i Stempelbogen. Stempelbogen fyldes fortløbende uden datoer, så der aldrig ses huller. Kalenderen med datoer vises kun i forældre-dashboardet. Mål 2 bliver 'Besøg et område du ikke har spillet i 5+ dage'. Tilføj en lint: ingen Date-afhængighed i src/content/goals.ts.

14. **[major] Etik – Forslag 3 §1.2 sjældenhedsniveauer common/rare/epic/legendary med glimmer + Forslag 2 perle-popups i turen**
   - *problem:* Selv når de tildeles deterministisk, er 'rare/epic/legendary'-farvekoder loot box-sprog og skaber status-hierarkier mellem ting. Ifølge researchen underminerer forventede, konkrete belønninger den indre motivation mest, når de er fremtrædende midt i opgaven (+1 perle, +10 XP ved hvert svar).
   - *fix:* Slet `tier` fra ItemDef og sjældenhedspaletten. Vis i stedet en kildebadge med ikon (Butik, Kiste, Mesterprøve, Venskab, Niveau) og teksten 'Sådan fik du den'. Gyldne dyr og regnbuedyr får læringsteksten 'Guld: for Kan selv i Plus over tieren'. Under turen viser HUD'en kun sten-stien, buddyen og kombo-effekter, aldrig tal for valuta. Perler og XP tælles op på tur-slut efter kortet 'Det lærte du'. Formuleringer om at være tæt på ('kun 3 perler til …') er forbudt. 'Næste' og 'Hjem' er lige store, og ingen af dem har fokus som standard.

15. **[minor] Mestring – V1 useRound.submit genindsætter fejlet opgave; recordAnswer kører også på gensvaret**
   - *problem:* Barnet ser det rigtige svar i strategitrinnet og får opgaven igen 2 pladser senere. Et hurtigt, rigtigt gensvar løfter boksen (0→1, 1→2), så 'Kan med støtte' (andel i boks ≥2) pustes op af korttidshukommelse.
   - *fix:* Gensvar får `retryOf` og `mode: 'retry'`. Et rigtigt gensvar holder boksen, og et forkert gensvar trækker ikke yderligere −2. Gensvar tæller ikke med i nøjagtighed, fast-andel eller som mulighed for misforståelser. Test i round.test.ts: fejl → gensvar rigtigt → boksen er uændret i forhold til efter fejlen.

16. **[minor] Diagnostik – Forslag 1 §3.3 'hint() vælger misforståelses-hint selv når aktuel fejl er other'**
   - *problem:* Barnet svarer 47 på 53−27 (fejltype other), men får digitSwap-forklaringen, fordi digitSwap er flagget. Forklaringen passer ikke til fejlen og forvirrer.
   - *fix:* Brug kun det misforståelses-specifikke hint, når errorTag for det aktuelle svar er lig det flaggede id. Ellers vises standardstrategien. Flaget påvirker kun den målrettede plads i roundBuilder.

17. **[minor] Fejlflow – Forslag 1 §2.2 bekræftelse med 2 kort (rigtigt + barnets svar)**
   - *problem:* Barnet kan trykke på sit eget forkerte svar igen og opleve en fejl nummer to lige efter strategien. Det giver ingen læring og mere frustration.
   - *fix:* Behold V1's StrategyHint: én stor knap 'Tryk på 13' (læses op), med barnets svar overstreget ved siden af og ikke trykbart. For clockSet og pay vises ét kort med det rigtige ur eller den rigtige møntbakke, som barnet trykker på. Det opfylder det låste valg.

18. **[minor] Låst valg – indplacering (Forslag 1 §4.2 'ingen hints', Forslag 2 'Den øver vi senere')**
   - *problem:* Brugeren har låst, at barnet ved fejl ser strategien og trykker på det rigtige svar. Begge forslag fjerner det i indplaceringen.
   - *fix:* Vis StrategyHint og bekræftelse ved fejl også i indplaceringen. Svaret logges stadig som mode 'placement', og bekræftelsen logges ikke. Stigen stopper som planlagt.

19. **[minor] Pensum – 2. kl. huller i Forslag 1 §1.3 addsub/algebra**
   - *problem:* Research og Format 2 har 36+67=103 (tocifret + tocifret over 100) og hundredvenner (37+?=100, 100−37) i 2. kl. add100Carry dækker kun ≤100, og add1000 hører til 3. kl.
   - *fix:* Tilføj familien `TOplusTOover100` (grade 2, svar 101–198) i add100Carry. Omdøb missingPart20 til `missingPart100` med familierne addendCross20, toHundred (a+?=100, 100−a) og subtrahend/minuend. Tilføj en ny misforståelse `digitComplement10` (100−37→73, hvor hvert ciffer suppleres til 10) med homeTip og hint ('37 op til 40 er 3, 40 op til 100 er 60').

20. **[minor] Tale – klokken (Forslag 1 §6.1 / Forslag 3 §5.2)**
   - *problem:* På dansk er begge former udbredte: 2:20 = 'tyve minutter over to' / 'ti minutter i halv tre', og 2:40 = 'tyve minutter i tre' / 'ti minutter over halv tre'. Børn hører begge derhjemme. Forslag 3's 1-minutsfraser ('treogtyve minutter over to') er uidiomatiske.
   - *fix:* Primær form som i forslag 1. Tilføj familien `halfForm` i clockFive (grade 3), der oplæser :20 som 'ti minutter i halv H+1' og :40 som 'ti minutter over halv H+1'. Analoge fraser kun i 5-minutstrin; enkelte minutter kun digitalt ('fjorten treogtyve'). Tilføj en test over alle 144 fraser + 24 alternative fraser.

21. **[minor] Tid – dagsgrænse for boks 4/5 (Forslag 1 §4.1, Forslag 2 §4.5)**
   - *problem:* Med lokal midnat som grænse tæller spil kl. 23:50 og igen kl. 00:10 som 'en anden kalenderdag'. Så kan barnet nå 'Kan selv' uden at have sovet på det.
   - *fix:* `learningDay(ts) = localDate(ts − 4 t)`. Promovering til boks 4 og 5 kræver desuden ≥8 timer siden boxAt. Test: 23:50 → 00:10 promoverer ikke.

22. **[minor] Lagring – navnerum (Forslag 1 'talvennerne2.*', Forslag 2 'talvennerne2.index', Forslag 3 'tv2:*')**
   - *problem:* Der er tre forskellige præfikser. 'tv2' er også navnet på en dansk tv-kanal, og en fremtidig app på den delte origin (frederiknordentoft-prog.github.io) kan meget vel bruge det.
   - *fix:* Brug ét præfiks overalt: localStorage og sessionStorage `talvennerne2.` og IndexedDB `talvennerne2`. Tilføj en grep-test der fejler ved `tv2:` og ved nøgler uden præfikset `talvennerne2.`.

23. **[minor] Dashboard – niveauestimat og skole-look (Forslag 1 §5.3)**
   - *problem:* 'Starten/midten/slutningen af 2. klasse' er skinpræcision. Stage-værdierne er forfatterens gæt, og bogsystemerne (Matematrix, Format) har forskellig rækkefølge. Skoler tænker desuden i Fælles Mål-kompetenceområder, ikke i appens 10 domæner.
   - *fix:* Vis kun hele klassetrin: 'Har styr på det meste af 1. klasses stof i tal og regning', plus en liste over de kerne-skills der er 'kan selv'. Gruppér de 10 domæner under Fælles Mål-overskrifterne Tal og algebra (number, place, addsub, muldiv, algebra, fractions), Geometri og måling (shapes, clock, money, measure) og Statistik (readChart). Tilføj 'Udskriv rapport' fra forslag 3 med samme gruppering.

24. **[minor] Dashboard – anbefaling R2 (Forslag 1 §5.2)**
   - *problem:* '{navn} … tæller sig frem' slutter sig til en metode ud fra langsomhed. Årsagen kan lige så godt være motorik, at barnet læser langsomt, eller forsigtighed.
   - *fix:* Ny tekst: '{navn} regner {label} rigtigt, men bruger stadig tid på det. Det er helt normalt – hurtighed kommer med små, hyppige gentagelser. Prøv {homeTip}.'

25. **[minor] Lyd – lydløs-kontakt for ikke-læsere (Forslag 3 §5.7)**
   - *problem:* Som standard respekteres lydløs-kontakten. På en iPhone med lydløs slået til hører et barn, der ikke kan læse, ingen opgaver, og appen kan ikke bruges. Den fejl er usynlig for forælderen.
   - *fix:* Ved første start siger Pip en testsætning, og skærmen spørger 'Kan du høre Pip?' med ✓/✗-ikoner. Ved ✗ sættes navigator.audioSession.type = 'playback', og der vises en tegning af lydløs-kontakten. Profiler med klassetrin 0–1 har 'Læs op også på lydløs' slået til som standard. Forælderen kan ændre det.

26. **[minor] Notation – regnetegn og talvisning (Forslag 3 ikonsæt 'times/divide', V1 voksen-gate '×')**
   - *problem:* Danske skoler bruger '·' for gange og ':' for division, ikke '×' og '÷'. Tusindtalsseparator ('1.000') forvirrer i indskolingen.
   - *fix:* Ikonerne `times` og `divide` tegnes som '·' og ':'. Voksen-gaten og alle opgaver bruger '·'. Tal ≤ 9999 vises uden separator. Tilføj en test der scanner src/ for '×' og '÷' og fejler ved fund.

27. **[minor] Profiler – genkendelse (Forslag 2 §6)**
   - *problem:* To søskende der begge vælger kanin som starter, får næsten ens profilkort. Et barn der ikke læser, vælger så forkert og forurener dashboardet.
   - *fix:* Hver profil får ved oprettelsen en fast rammefarve (6 farver, ingen dubletter) plus forbogstav på kortet. Profilvælgeren vises ved hver app-start, når der er ≥2 profiler, og navnet læses op ved tryk.

28. **[minor] Licens – CoRal roest-v3-chatterbox-500m (OpenRAIL)**
   - *problem:* OpenRAIL-licenser har typisk brugsbegrænsninger om at udnytte sårbarheder hos bestemte aldersgrupper. Fastholdelsesmekanikker i en børneapp skal kunne stå mål med den tekst.
   - *fix:* Ved G0 læses og gemmes modelrepoets LICENSE ordret i talvennerne2/voice/LICENSE-CoRal.txt. Integratoren bekræfter i docs/voice.md, at ingen mekanik rammer begrænsningerne. Krediteringen står under 'Om oplæsningen'.

29. **[minor] Omfang – 16 TaskKinds i AAA-kvalitet (Forslag 1 §2.2)**
   - *problem:* Hver kind kræver interaktion, demo, klip, bekræftelsesvisning og E2E-test. Laves alle 16 samtidig, bliver ingen af dem gode.
   - *fix:* Bølge 1 (0.–1. kl.): choice, keypad, countTap, numberline, trueFalse, multiSelect, sortOrder, fillSlots, buildBase, clockSet. Bølge 2 (2. kl.): pay, share, colorParts. Bølge 3 (3. kl.): grid, rulerDraw. pair beholdes kun til tenFriends. Svarmodel, datamodel, SkillDef-register og taleinventar skal være komplette i bølge 1.

30. **[minor] Stjerner – Forslag 2 §2.3 ★3 kræver ≥60 % 'flydende' svar**
   - *problem:* Spillet har ingen timer, men stjernerne indfører alligevel tidspres ud over det låste mestringskrav. Det er langsomme, grundige børn, der aldrig får ★3.
   - *fix:* ★3 = højst 1 fejl og mindst 3 produktionssvar i turen. Hastighed påvirker kun Leitner-boksene (låst valg) og vises aldrig for barnet.

### Skal bevares

- Forslag 1: domæne → skill → familie → fact-hierarkiet med SkillDef-register i stedet for V1's 8 switch(skill)-steder (facts.ts, tasks.ts ×4, distractors.ts, roundBuilder.validKinds, PromptDisplay, StrategyHint, engine.test)
- Forslag 1: recall- og procedure-mestring. Familienøgler promoveres kun på en instans der ikke findes i `recent`, så barnet ikke kan 'farme' 38+45
- Forslag 1: boks 4 kræver produktion på en senere læringsdag end boks 3, og boks 5 kræver ≥3 dage efter boks 4. Det er den ærlige modvægt til 'så længe barnet vil'
- Forslag 1: AnswerValue = number|string med klokken i minutter efter 12:00, penge i øre og tolerance/accept. Keypad kun til int/øre, og maxDigits tillader 1004 og 20013, så fejlene kan ses
- Forslag 1: hear20/hear100/hear1000 (hør tallet, skriv det) og digitSwap-hintet 'Vi siger tre-og-halvtreds, men vi skriver tierne først'. Det er specifikt dansk og uvurderligt
- Forslag 1: mærkede distraktorer med entydighedsreglen (dobbelttag → 'ambiguous') og rotation af den diagnostiske distraktor via offeredTags, plus testen classifyError(candidate.value) === candidate.tag
- Forslag 1: barnet ser aldrig et flag. Forældretekster siger 'Vi har set tegn på …' og har en konkret homeTip
- Forslag 1: tidsmålingen starter ved max(vist, oplæsning slut), og hvert 'Hør igen' lægger promptens varighed til, så tempokravet er fair for børn der ikke læser
- Forslag 1 §4.4: 1 review-plads fra en anden skill, højst 3 i træk med samme regneart, sidste opgave er den næstsikreste, loft på 8 nye pr. skill og 20 pr. dag, og træthedsjustering uden pauseforslag
- Forslag 1: mesterprøve med 10 opgaver, kun produktion, ≥8/10 og uden tempokrav. Kan tages som 'Spring over' fra regionens start
- Forslag 1: fravalg af chance/sandsynlighed og omkreds med begrundelse. Klokken, penge og 1000-sedlen er gjort fagligt korrekt
- Forslag 1 dashboard: læringstid adskilt fra legetid uden vurdering, andelen 'rigtigt men langsomt', pensumkort med domæner × klassetrin, 10×10-tabelgitter, højst 3 anbefalinger og et estimat der skjules under 150 svar eller 5 dage
- Forslag 1 §6: normalisering til ord før oplæsning, med klip i mid- og end-form for tal 0–100. Taleinventaret genereres af den samme normalize.ts som runtime, så dækningen er garanteret
- Forslag 2: de mest eftertragtede præmier (Stjernefølet, gyldne dyr, Ridder- og Talmagiker-sæt, fuld farve i regionen) låses kun op af mestring, og ingen belønning kan fås uden at regne
- Forslag 2: 🔥-streaken fjernes. 'Dage spillet i alt' nulstilles aldrig. Ingen notifikationer, ranglister, sammenligning mellem søskende, tidsbegrænsede tilbud, rigtige penge eller nedtælling til auto-start
- Forslag 2: dyrene bliver aldrig sultne, syge eller ensomme, og der er ingen pleje-mekanik. Kistens indhold vises på kortet på forhånd, og hver ting har præcis én kilde med 'Sådan får du den'
- Forslag 2: hjælpebro efter 3 mislykkede prøver plus en Træningshytte med de missede fakta. En mislykket prøve koster intet, og belønningen for indsats bevares (afgrænset til domænekæden)
- Forslag 2: ceremonikøen med læring først ('Du blev sikker på 7+5'), højst 3 fuldskærmsceremonier, alle kan springes over, og klækningen kommer sidst. Tur-slut varer højst 6 s, 12 s med klækning
- Forslag 2: onboarding hvor klækningen sker inden for 60 s efter valg af første ven, og første rigtige tur starter omkring 4 min. Navneforslag læses op, så børn der ikke kan skrive, kan navngive
- Forslag 2: buddyens øjne følger fingeren, og ånding, blink og øre-vip i tomgang. Stien farves efter mestring (dæmpet pastel, aldrig grå), og tågen letter efter en bestået prøve
- Forslag 3: stiliserede 'legepenge' med korrekte relative møntstørrelser og farver, uden Nationalbankens motiver
- Forslag 3: kun `transform`/`opacity`-animation, ingen filter/mask i art, elementbudgetter, ydelseskrav med p95 ≤ 20 ms ved 4× throttle, samt kontaktark, blind silhuettest og multimodalt review
- Forslag 3: ASR-gate med roest-v3-wav2vec2 for alle klip plus alle 899 sammensatte tal 101–999, og lyttesiden til brugeren før batch-kørslen
- Forslag 3: navnerums-vagt (ingen localStorage.clear, caches, serviceWorker.register eller fremmede nøgler), ingen service worker, og en live smoke-test der viser at talvennerne.save og fremmede nøgler er byte-identiske
- V1: sikker åbner, fejlet opgave genindsat 2 pladser senere (så turen slutter på et rigtigt svar), balanceAnswerPositions, ✕ = pause der gemmer turen og 'en pause er ikke langsomhed' (askedAt nulstilles ved resume)

## Kritik: realisme og kontrakter

**Dom:** De tre forslag er stærke hver for sig, men de kan ikke bygges som de står. Forslagene definerer uforenelige kontrakter: SkillDef, domæner, skill-id'er, TaskKind-navne, klip-id'er, lagerskema, mestringens dagsregler, verdensstruktur, roster og garderobe. Omfanget er desuden mindst 5-7 gange V1 (V1 er 5.225 linjer i src). De største risici er ikke kode. Det er lyden (sammensat tale, Chatterbox på CPU og iOS' lydløs-kontakt) og den visuelle kvalitet på rigtige iPads. Ingen af delene kan verificeres i containeren.

Jeg anbefaler at bygge i denne risikoførst-rækkefølge:

(1) **G-spec.** Integratoren skriver `talvennerne2/docs/SPEC.md`, `src/engine/types.ts` og `src/content/ids.lock.json` med ét kanonisk valg pr. modstrid (se fund). Ingen arbejder-agent starter før dette er frosset.

(2) **G0-spikes, hver med brugergodkendelse:**
- S1 lyd: stemmeprobe Mic/Nic, RTF-måling, de 20 sværeste enkelttal og 10 sammensatte opgaver mod 10 hele sætninger, sendt til brugeren som WAV.
- S2 kunst: kanin-rig i 3 stadier med 2 hatte og 1 trøje som kontaktark, godkendt af brugeren før flere arter.
- S3 iOS: `diag.html` til lyd-unlock, lydløs-kontakt, dekodning, IndexedDB og fps.

(3) **F1-fundament.** Motorkerne, data, lydmotor, rig, designsystem.

(4) **G-slice.** Engdalen (0. kl.) spilbar med 4 helte-arter, æg, ceremonier, økonomi, dashboard v1 og 2 profiler. Deployes til `/talvennerne2/` med det endelige kort og `diag.html`. Brugeren tester på sin iPad efter en tjekliste.

(5) **Bølge 2** (1.-2. kl. inkl. klokken, penge og figurer), derefter **bølge 3** (3. kl.). Taleklip genereres pr. bølge.

(6) **Polering og slut-deploy.**

Hold højst 6 samtidige arbejdere, kør Chromium bag en fil-lås, og lad TTS køre i bidder af højst 100 minutter der kan genoptages. Følgende skæres til senere: baggrundsmusik, fotoalbum, scener mellem dyrene i Dyrehaven, sæsonpynt, 24 af de 32 pyntegenstande, signaturting og `rulerDraw`. Alle låste valg og alle fire pensumtilvalg bevares.

Risici ved de låste valg, i én sætning hver: "så længe barnet vil" uden pauseforslag ligger i strid med ICO std. 5 og DSA art. 28 og kan kun afbødes (lofter over nyt stof og træthedsværn), ikke løses. "Langsomt men rigtigt giver ingen fremgang" kan fastlåse langsomme børn, og det gør den synlige dashboard-kategori "rigtigt men langsomt" obligatorisk.

### Fund

1. **[blocker] Kontrakter og konsistens mellem forslagene**
   - *problem:* Forslagene definerer uforenelige kontrakter. SkillDef: pædagogik bruger enumerate/families/candidates/hint/SpeechScript{clips}, kunst bruger classes/instance/distractors/SpeechPart[]/strategy/fastMs. Domæner: 10 mod 8 (kunst mangler place og algebra og kalder domænet 'numbers'). Skill-id'er: spildesign bruger subitize, addTo5, table6_7, clockWholeHalf, lengthCmM, som ikke findes blandt pædagogikkens 72. TaskKind: camelCase (clockSet, pay) mod kebab-case (clock-set, coins-pay). Tokens: 'triangle' mod 'shape:triangle'. Klip-id'er: n.mid.38/hog.3 mod n.38/nh.3og. Mestringsenhed: 'family' mod 'classId'. Lagring: 5 mod 10 mod 3 stores, præfiks talvennerne2. mod tv2:, opbevaring 90 d/20k mod 180 d/30k. Parallelle agenter vil bygge mod forskellige kontrakter, og integrationen vil fejle.
   - *fix:* Integratoren leverer G-spec før nogen arbejder-agent starter: talvennerne2/docs/SPEC.md, src/engine/types.ts og src/content/ids.lock.json.

Kanoniske valg:
- Pædagogikkens 10 DomainId og 72 SkillId.
- Pædagogikkens 16 TaskKind i camelCase med V1-navnene (numberline, keypad, choice, pair) og countTap i stedet for V1's count.
- SkillDef efter pædagogikken, men speech(fact, kind) returnerer kunstens semantiske SpeechPart[] (num med form 'mid' eller 'end' og genus, clock, money, measure, frac, clip, free). En compiler i src/speech/compile.ts laver klip-id'er og toDanishText.
- Mestringsenheden hedder 'family', masteryKey = recall ? fact.id : `${skill}/${family}`.
- Tokens har præfiks: 'shape:triangle', 'frac:3/4', 'cmp:<', 'unit:cm', 'yes'/'no'.
- Klip-id'er efter pædagogikken (n.mid.N, n.end.N, hog.H, h.end.H).

Tests: alle skill-id'er i curriculum.ts findes i registret, og alle SpeechPart for alle facts og 50 instanser pr. familie kompilerer til klip i inventaret.

2. **[blocker] iOS-lyd: lydløs-kontakt og unlock**
   - *problem:* På iOS følger Web Audio (ambient-kategori) og speechSynthesis lydløs-kontakten, og ingen API kan aflæse kontakten. Kunstens standard 'respektér kontakten' og pædagogikkens 'lyd slået fra → udelad hear*' bygger på en tilstand appen ikke kan se. På en iPad på lydløs får et barn der ikke kan læse et stumt spil. hear20/100/1000 logges som fejl og giver falske misforståelsesflag (fx digitSwap). Kunstens unlock på pointerdown er heller ikke en gyldig aktivering på alle iOS-versioner.
   - *fix:* Fire ændringer:
(1) Sæt navigator.audioSession.type='playback' som standard når API'et findes (feature-detect). Forældreindstillingen 'Følg lydløs-knappen' er slået fra som standard.
(2) Reserve på ældre iOS: et loopet lydløst <audio playsinline>-element (1 s stille MP3) startes i unlock-gestussen, så sessionen tvinges til playback.
(3) Lydtjek ved onboarding: dyret siger 'Tryk på katten' med 2 dyrekort. Ved 2 forkerte vises et illustreret 'tænd for lyden'-kort, og profile.audioVerified=false. Det udelader hear*-familier, og svarene mærkes audioUnverified og tæller ikke som misforståelsesbevis.
(4) Unlock sker på touchend/click, ikke pointerdown. Efter visibilitychange→visible vises overlayet 'Tryk for at fortsætte', som låser konteksten op igen (samme flow som pause).
speak().ended skal resolve på planlagt sluttid, også når lyden er stum, så ped's timerstart max(vist, oplæsning slut) virker.

3. **[major] Lyd: sammensat tale og korte klip**
   - *problem:* Hele inventardesignet (1.230 eller 920 klip) antager at sammensatte prompts som 'Hvad er | otteogtredive | plus | femogfyrre' lyder acceptabelt. ASR måler forståelighed, ikke prosodi. Autoregressiv LLM-TTS som Chatterbox er ustabil på input med 1-2 stavelser (en, ni, tres), og wav2vec2-CER på et ord med 2 bogstaver er meningsløs som gate. Uden en tidlig lyttetest bygges hele pipelinen på en uprøvet antagelse, og det er den største AAA-risiko.
   - *fix:* G0-spike S1 før inventaret:
- Generér 12 probesætninger × Mic/Nic og de 20 sværeste enkeltord (en, et, to, ni, tolv, tres, halvfjerds, halvfems, nioghalvfems, hundrede, tusind …) med 3 takes.
- Byg 10 sammensatte prompts med den rigtige sekvenskode, renderet offline til WAV. Send brugeren 10 sammensatte og 10 hele sætninger (SendUserFile) og få stemmevalg og en accept.

Beslutningsregel: hvis over 20 % af enkeltord-takes falder uden for varighedsvinduet [0,5; 2,0]× forventet, genereres talord i bæresætningen 'Tallet er X.' og klippes ud med CTC forced alignment (torchaudio.functional.forced_align med roest wav2vec2). Korte klip verificeres kun i sammensætninger ('Tallet er X.'), aldrig isoleret.

Uanset resultatet indspilles hele spørgesætninger for alle recall-facts til og med 1. kl.: addTo10 66, subTo10 66, tenFriends 11, doubles 10, halves 10, addTo20 36, subTo20 36, missingPart10 36. Det er 271 sætninger, cirka 10 min lyd. Sammensætning bruges kun til procedure-familier og 2.-3. kl.

4. **[major] TTS-pipeline: CPU-tid, drift og download**
   - *problem:* RTF 4,5 er ikke målt. Med cirka 40 min lyd (inklusive hele sætninger) × 1,5 takes ved RTF 5-8 er det 5-8 timers CPU på 4 vCPU. Baggrundskommandoer stoppes efter 2 timer, og containeren kan nulstilles. Kunstforslagets 'inventar-frys og 4,5 t batch' ved G2a lægger hele risikoen sent. snapshot_download med '*.safetensors' henter både t3_23lang og t3_mtl23ls_v2 (2 × 2,1 GB), og modelkortets token=True fejler uden HF-token. Modellen er ikke gated (tjekket via HF-API), licens openrail.
   - *fix:* Download kun t3_mtl23ls_v2.safetensors (bekræft filnavnet som from_local indlæser i den installerede chatterbox-version), s3gen.pt, ve.*, tokenizer/grapheme-json, conds.pt og de 2 valgte prompt-wav'er, i alt cirka 3,3 GB, med token=None. TTS og ASR ligger i separate venvs fra start (/opt/tv2-tts, /opt/tv2-asr).

Generering sker pr. indholdsbølge, ikke som ét frys: generate.py --pack <sprite> --max-minutes 100, idempotent på sha1(text|voice|settings|modelrev). Kør med nice -n 19 og torch.set_num_threads(2) mens agenter arbejder, og 4 tråde når containeren er ledig.

Take-politik: 1 take, og kun ASR- eller varighedsfejl genereres igen (højst 4). Valgte takes committes som FLAC efter hver bid, højst 10 MB pr. push, så proxyen ikke afbryder overførslen.

5. **[major] Eksekvering og parallelitet**
   - *problem:* 16 samtidige agenter plus en TTS-batch plus Chromium og Vite pr. agent på 4 vCPU og 15 GB er urealistisk: hver Chromium bruger 300-500 MB, og builds tager en hel kerne. Sub-branches tv2/<agent> kan sandsynligvis ikke pushes fra sessionen. Hvis alle agenter arbejder i ét working tree, giver det index.lock-konflikter, og én agents brækkede fil stopper de andres typecheck.
   - *fix:* Højst 6 samtidige arbejdere plus integratoren. Alle Chromium-kørsler (sheets, playthrough) går gennem `flock /tmp/tv2-chromium.lock`. Kun lokale worktrees under /home/user/wt/<agent>, med talvennerne2/node_modules symlinket fra hovedtræet (integratoren ejer package.json). Integratoren merger lokalt og pusher kun sessions-branchen claude/math-app-children-ios-4jihdr. scope-guard kører før hver commit.

6. **[major] Verifikation på rigtig iOS**
   - *problem:* Intet i planen verificerer på rigtig iOS. Chromium med 4× CPU-throttle og eventuelt WebKit på Linux gengiver ikke lydløs-kontakt, afbrydelse af audio session, jetsam, hjemmeskærmens separate lager eller SVG-rasteromkostningen på A10/A12. Målene 'p95 ≤ 20 ms' og '60 fps på iPhone 11' kan ikke bevises i containeren.
   - *fix:* Indfør G-slice-gaten. Engdalen deployes til /talvennerne2/ med det endelige kort og en diag.html i dist. Diag-siden tester unlock, afspilning med lydløs slået til, dekodetid for sprites, skrivning til IndexedDB og persist(), og fps med 12 dyr i Dyrehaven. Resultatet vises som JSON der kan kopieres.

Brugeren kører siden på sin iPad og iPhone og gennemgår en tjekliste med 10 punkter: oplæsning med lydløs slået til, genoptag efter hjemknap, genoptag efter at appen er lukket, profil bevaret efter genstart fra hjemmeskærmen, flydende Dyrehave, med flere.

Bølge 2-3 starter først derefter. WebKit i Playwright er en spike, ikke en gate.

7. **[major] Omfang**
   - *problem:* Samlet omfang: 72 skills, 16 kinds, cirka 155-196 noder, 16 arter × 3 stadier × 9 farver, 80-90 genstande med 3 kropsskabeloner, over 1.230 klip, et dashboard med 11 visninger, økonomi, indplacering, Dyrehave, fotos, adaptiv musik, 40 trofæer og 32 pyntegenstande. Det er mindst 5-7 gange V1 og bliver ikke færdigt i AAA-kvalitet i ét træk.
   - *fix:* Byg i 3 indholdsbølger efter vertical slice.

Skær til 'senere':
- baggrundsmusik,
- fotoalbum,
- scener mellem dyrene i Dyrehaven,
- sæsonpynt,
- 24 af de 32 pyntegenstande (behold 8),
- de 16 signaturting (venskab 7 giver i stedet en trick-animation),
- hemmelige trofæer,
- rulerDraw (rulerRead med keypad er produktion).

Misforståelses-hints med egen animation laves kun for de 8 vigtigste: digitSwap, forgotCarry, smallerFromLarger, borrowNoDecrement, equalsAsAnswer, halfPastNext, tableNeighbour, concatNumberWords. Detektion og forældretekst gælder stadig alle 30.

Alle fire pensumtilvalg og alle 72 skills bevares, fordelt over bølgerne.

8. **[major] AAA-løfter der vil se billige ud**
   - *problem:* (a) Procedural adaptiv musik lyder som en ringetone, og loops irriterer forældre. Det gælder både spildesignets 4 stiliserede temaer med 3 stemmer og kunstens pentatoniske ambient på højst 150 linjer. (b) 4 parallakselag × 4 verdener plus 4 farvetilstande pr. etape, skrevet som SVG af LLM'er, ender typisk som clip-art. (c) Frihånds-path-strenge skrevet af agenter bliver skæve, og ens idle på alle arter giver indtrykket 'samme dukke med andre ører'.
   - *fix:* (a) Ingen musik i v2.0. Brug tiden på cirka 30 SFX med FM-syntese og genereret rumklang, plus 16 dyrekald.
(b) Ét diorama-kort pr. verden med store farveflader og højst 3 lag. Statiske gradienter er tilladt i scener, men ikke på væsner. Farverne kommer tilbage via OKLCH-kromaskalering i palette.ts plus 3 lag rekvisitter der slås til. Aldrig CSS filter, fordi Safari rastrerer det hvert frame.
(c) Artsdele bygges af parametriske primitiver i art/rig/shapes.ts (superellipse, blob(points, tension), spejlede bezier-hjælpere). Hver art får en signatur-idle: kaninens næse, kattens halekrølle, hestens manke, enhjørningens horn der glimter.

9. **[major] Brugerens ønske: flere kaniner, heste, enhjørninger og katte**
   - *problem:* Rosterne spreder indsatsen over 16 arter, og variationen er kun farve. Brugeren bad specifikt om FLERE kaniner, heste, enhjørninger og katte, altså variation inden for favoritterne.
   - *fix:* Tilføj et breed-lag til SpeciesDef som delvarianter.

| Art | 3 racer |
|---|---|
| Kanin | stående ører, hængeøre (vædder), løvehoved |
| Hest | shetlandspony, fjordhest (blakket med stribet manke), araber |
| Kat | huskat, langhåret, maine coon med øredusker |
| Enhjørning | kort føl-lok, lang bølgemanke, stjernehorn |

Hver race har 6 farver. Rækkefølge: kanin (stilreference ved G1), så kat, hest og enhjørning med racer, så 8 arter mere, så de sidste 4. Samleobjektet er (art, race, farve).

10. **[major] Mestringsregler (modstrid)**
   - *problem:* Dagsreglen: pædagogik kræver en senere dag for boks 4 og mindst 3 dage for boks 5; spil kræver en senere dag kun for boks 5; kunst beholder V1. Indplacering seeder boks 3 (pædagogik) eller boks 2 (spil). Loftet over valgopgaver er isProduction (pædagogik) eller guessP ≤ 0,05 (kunst). Træthed: under 50 % af de sidste 10 (pædagogik) eller 2 ture med mindst 4 fejl (spil). Mesterprøve: 100 % produktion og mindst 8/10 (pædagogik) eller mindst 60 % fri indtastning og 8 planker (spil).
   - *fix:* Vælg pædagogikken på alle punkter:
- DUE_ROUNDS [0,1,2,4,8,16] og DUE_DAYS [0,0,0,1,3,7].
- Boks 4 kræver produktion og day > boxDay. Boks 5 kræver produktion mindst 3 dage efter boks 4.
- Indplacering seeder boks 3 med seeded:true, som tæller som 'støtte' indtil det er bekræftet.
- isProduction og ceilingFor som i pædagogikken.
- Træthed med glidende vindue.
- Mesterprøven er 10 produktionsopgaver med mindst 8 rigtige. Spillets planke-visualisering lægges ovenpå.

Dagsnøglen er lokal dato via Intl.DateTimeFormat('sv-SE'), aldrig toISOString(). Test med fake clock over sommertidsskiftet 2026-10-25 i Europe/Copenhagen og over midnat.

11. **[major] Verdensstruktur og gating (modstrid)**
   - *problem:* Pædagogik har 28 regioner (6/7/8/7) med blød oplåsning: 2 åbne, næste region efter 4 noder, næste verden når alle noder er spillet. Spildesign har 32 etaper (8 pr. verden) med fast node-skabelon og reglen 'højst én åben, ikke-bestået prøve' med rebbro efter 3 forsøg. Det giver forskellige kort, node-id'er og progression.
   - *fix:* Én src/content/curriculum.ts:
- Pædagogikkens 28 regioner ER spillets etaper. Symmetrien med 8 pr. verden droppes.
- Node-skabelonen er spillets: l1, l2, friend|chest, l3, mix, trial. Node-id er `${regionId}-${slot}`.
- Gating: barnet er højst én etape foran sin seneste beståede prøve, og rebbroen åbner efter 3 forsøg.
- 'Mindst 2 valg' opfyldes ved at alle tidligere etaper kan genspilles, og Dagens øvelse altid er åben.
- Forælder og indplacering kan åbne etaper.

12. **[major] Kunst og ydeevne på gamle iPads**
   - *problem:* Safari kompositerer ikke SVG-børneelementer, så CSS-transform på dele udløser CPU-repaint af hele svg'en. 12 animerede rigs i Dyrehaven × cirka 240 elementer (90 + 6×25) og et album med over 144 samleobjekter vil tabe frames på A10/A12, og Chromium-throttle måler ikke det. transform-box: view-box med transform-origin i px har historiske WebKit-fejl.
   - *fix:* Kun buddy'en og højst 2 andre dyr på skærmen animerer dele. Alle andre renderes én gang til <img src={blobUrl(serializedSvg)}> og animeres som helt element med translate/scale, som kompositeres.

Pivot-mønster: <g transform="translate(px py)"><g class="p-ear">…lokale koordinater…</g></g> med transform-origin:0 0.

Budget pr. skærm: højst 1.500 SVG-elementer i DOM og højst 3 rigs med animerede dele. Håndhæves af en Playwright-test der tæller document.querySelectorAll('svg *').

13. **[minor] Lagerskema og pause**
   - *problem:* Tre forskellige skemaer. V1 gemmer kun pausen ved ✕ (savePausedRound i pause()), men iOS dræber faner i baggrunden, og turen tabes. Kunstens flush på pagehide er upålidelig på iOS. tv2:-præfikset er et almindeligt dansk token (TV 2), som en anden app på origin sandsynligt kan bruge.
   - *fix:* IndexedDB-databasen talvennerne2 med 4 stores:
- profiles: ét dokument pr. profil med keys, nodes, trials, animals, inventory, economy, misconceptions og round (cirka 150 KB).
- answers: '++seq,[profileId+ts],[profileId+skill+ts]'.
- daily: '[profileId+day],profileId'.
- meta.

Profildokument og svarrække skrives i én transaktion pr. svar, inklusive et snapshot af turen, så en genindlæsning genoptager samme opgave. Flush sker på visibilitychange→hidden.

localStorage og sessionStorage bruger kun præfikset 'talvennerne2.'. Svarlog gemmes i 90 dage og højst 20.000 rækker pr. profil.

14. **[minor] Gaten 'V1 urørt' er forkert formuleret**
   - *problem:* Tailwind 4's Vite-plugin scanner Vite-roden (/home/user/Test) automatisk. Når talvennerne2/ findes, ændrer et nyt build af V1 derfor V1's CSS og hashes. Kunstens G0 'V1's dist bygger med samme fil-hashes' vil fejle falsk og friste en agent til at rette i V1's konfiguration. Node-opslag går også op til V1's node_modules, så React kan blive dobbelt.
   - *fix:* V1 bygges og deployes aldrig igen fra denne branch.

Gate G0/G4 er to tjek: `git diff --stat c956c45 -- . ':!talvennerne2'` er tom, og `git ls-tree origin/claude/wc2026-tournament-app-k42mv8 talvennerne` har uændret tree-SHA før og efter deploy.

I V2's vite.config sættes resolve.dedupe:['react','react-dom'], og alle afhængigheder erklæres i talvennerne2/package.json.

15. **[minor] PWA-manifest**
   - *problem:* Kunstens manifest med id:'./' resolves mod start_url's ORIGIN, altså https://frederiknordentoft-prog.github.io/. Det kan kollidere med andre apps på samme origin, som installationsidentitet i Chrome/Android.
   - *fix:* "id": "/Test/talvennerne2/", "start_url": "./", "scope": "./", apple-mobile-web-app-title 'Talvenner 2'. Tilføj en test der læser dist/manifest.webmanifest og asserter id-værdien.

16. **[minor] Huller i Safari-API'er og touch**
   - *problem:* requestIdleCallback, som kunsten bruger til oprydning, findes ikke i Safari. content-visibility virker først fra Safari 18. Tailwind 4 kræver Safari 16.4 eller nyere. Pædagogikkens langt tryk (400 ms) for oplæsning udløser iOS' tekstmarkering og lup. Trækflader uden touch-action scroller siden.
   - *fix:* Brug setTimeout(fn, 2000) som reserve for requestIdleCallback. content-visibility er kun en progressiv forbedring.

Minimum er iPadOS 16.4. index.html viser en ren HTML-besked hvis CSS.supports('color','color-mix(in srgb, red, red)') er falsk.

Svarkort får -webkit-touch-callout:none, user-select:none og touch-action:manipulation. Trækflader (clockSet, pay, sortOrder) får touch-action:none og pointer capture.

Et E2E-træk testes via CDP Input.dispatchTouchEvent.

17. **[minor] Lydhukommelse**
   - *problem:* decodeAudioData resampler til kontekstens rate, som er 48 kHz på iOS: 1 s fylder 192 KB f32, så 40 min fylder cirka 460 MB. 'num'-spriten med mid/end-former (202 klip plus 250 ms stilhed) fylder cirka 200 s, altså cirka 38 MB dekodet, og er pinned.
   - *fix:* Prøv new AudioContext({sampleRate: 24000}) med reserve til standardraten. Del num op i n0-20 (pinned) og n21-100 (lazy). Sprites er højst 60 s. Pinned dekodet lyd er højst 24 MB, og LRU-loftet er 64 MB i alt. Stilheden mellem klip sænkes fra 250 til 120 ms, hvilket er nok til offset-finjustering på ±60 ms.

18. **[minor] Garderobe, sjældenhed og vækst (modstrid)**
   - *problem:* Kunst har tier common/rare/epic/legendary, mens spillet forbyder en rarity-stige (DSA art. 28). Katalogerne er forskellige: 9 sæt × 8 + 8 mester mod spillets 90 med ItemSource. Vækst: 4 former mod 3 stadier. Farver: starwhite mod stardust. Sæl mod isbjørn i rosteren.
   - *fix:* Drop feltet tier. Rammefarven afledes af ItemSource.kind (mastery giver guldramme). Brug spillets katalog og ItemSource uden signaturting: v2.0 har 74 genstande.

3 geometriske stadier (kunst) plus 'stjerneform' som fx/aura-lag på stadie 3. Farver: 6 naturlige, gold og rainbow (begge låst af mestring), og starwhite kun til Stjernefølet.

Rosteren er spillets 16 med isbjørn frem for sæl, fordi sælen mangler pote- og fodankre.

19. **[minor] Visuel regression og repo-størrelse**
   - *problem:* pixelmatch-baselines som PNG i git (over 100 ark à 0,3-1 MB) gør repoet stort og er ustabile på tværs af skriftrendering. FLAC-mastere på 32 MB i ét push kan blive afbrudt af proxyen.
   - *fix:* Regression testes i vitest som hash af renderToStaticMarkup(<Rig …/>) pr. (art, race, stadie, farve) og pr. genstands-fit. PNG-ark lægges kun i artifacts/ (gitignored). Højst 20 reference-PNG'er i 1× committes til rubrikken. FLAC-mastere committes i bidder på højst 10 MB.

20. **[minor] Klokkens svarkodning**
   - *problem:* Pædagogikken bruger 'minutter efter kl. 12' for analoge ure og 0-1439 for 24-timers ur i samme answerType. Det giver tvetydig lighed (2:30 mod 14:30) i clockSet.
   - *fix:* answerType 'minutes' er altid 0-1439, og Task får et felt modulo: 720 | 1440. isCorrect sammenligner (given - answer) mod modulo. halfPastNext-distraktoren (+60) beregnes mod modulo.

21. **[minor] Barnets HUD og mange tællere**
   - *problem:* XP, niveau, perler, stjerner, æg-varme, venskab, medaljer, trofæer og dage er for mange tællere for en 5-6-årig, der ikke kan læse tal.
   - *fix:* Barnets HUD viser kun 3 visuelle målere uden tal: ægget, ønsket og buddy-hjertet. XP og niveau vises kun ved level-up og på profilkortet. Perler vises i butik og garderobe.

22. **[minor] Deploy-detaljer**
   - *problem:* deploy-app.sh i update-tilstand tillader kun $APP. Kortets tekst og lead kan derfor ikke rettes ved senere deploys. discover_live_apps kræver præcis href="./talvennerne2/".
   - *fix:* Første deploy (G-slice) laver det endelige kort: <a class="card t2" href="./talvennerne2/"> efter .ta-kortet, en .t2 .emoji-gradient, og 'Ni web-apps' rettes til 'Ti web-apps'. Intet andet ændres. Derefter kun update-tilstand. --verify skal vise 200 for alle 11 stier og titlen 'Mine projekter'.

23. **[minor] Afhængigheder og bundle**
   - *problem:* motion (LazyMotion) tilføjer cirka 15-25 KB gzip og en afhængighed kun til skærmskift og layoutId, som kan give hak med SVG i Safari. Et eager import.meta.glob af 72 skills kan presse budgettet på 160 KB for initial JS.
   - *fix:* Drop motion. Skærmskift og ceremonier laves med CSS og WAAPI (element.animate). Behold Dexie 4, som har workarounds for Safaris IndexedDB-fejl. Motor-chunken må højst være 60 KB gzip (håndhæves i budget.mjs). UI for kinds og domæner lazy-loades.

24. **[minor] Testhuller**
   - *problem:* Der mangler test for:
- genindlæsning midt i en tur (jetsam),
- sommertid og midnat for dagsreglen,
- touch-træk,
- stumt lydtjek, der ikke må give misforståelsesbevis,
- at hear*-familier udelades når audioVerified=false,
- at to profiler holdes adskilt efter genindlæsning fra hjemmeskærm (kan kun testes manuelt).
   - *fix:* Tilføj i playthrough.mjs: reload efter svar 4 giver samme opgave 5; profilskift under pause; `talvennerne.save` og 'x:y' er byte-identiske efter hele flowet; __voiceLog indeholder de forventede klip-id'er.

Tilføj i vitest: fake clock over 2026-10-25 og over midnat; en simuleret profil når boks 5 tidligst på dag 5; classifyError ignorerer audioUnverified.

Tilføj i G-slice-tjeklisten: manuel test af profiler fra hjemmeskærmen.

### Skal bevares

- SkillDef-register via import.meta.glob, der erstatter V1's 8 switch(skill)-steder, med et uafhængigt orakel pr. domæne skrevet af en anden agent end generatoren
- recall- og procedure-mestring: Leitner pr. fact for recall, Leitner pr. familie for procedure, og recent-reglen, så en familie ikke promoveres på en nylig instans
- Boks 4-5 kræver produktion OG en senere kalenderdag: den eneste ærlige mestring når spilletiden er ubegrænset
- Ur som minutter og penge som øre, så keypad, distraktorer og isCorrect genbruges uden særtilfælde
- Mærkede distraktorer (Candidate {value, tag}), entydighedsreglen ('ambiguous' tæller aldrig) og flag-tærsklerne (≥3,0 bevis, ≥3 facts, ≥2 dage, ≥30 % rate, undertrykkelse under 40 % nøjagtighed); barnet ser aldrig et flag
- 'Det lærte du' vises før tingene; ceremonikø med højst 3 fuldskærme og resten som 'Også i dag', med klækning altid sidst
- Tre spor (Rejsen, Venner og ting, Kan-bogen); eksklusive præmier kun via skillStatus independent og trialPassed; intet optjent kan tabes
- Rugeæg fyldt af rigtige svar med deterministisk farve uden rarity-stige; ingen streak, men 'Dage spillet i alt' der aldrig nulstilles
- Loft over nyt stof (8 pr. skill og 20 pr. dag) og træthedsværn i stedet for pauseforslag; turen slutter på den næstsikreste nøgle
- Forældre-dashboard: pensumkort (domæner × 0.-3. kl.), tabelgitter 10×10, kategorien 'rigtigt men langsomt', anbefalinger R1-R6 med homeTip, forsigtigt niveauestimat (skjult under 150 svar eller 5 dage) og print-CSS
- Fælles rig med ankre, kropstøj klippet til artens krop, ører og horn over hatten (earMode) og automatisk fit-matrix-tjek
- Pupiller der følger barnets finger
- Én dansk normaliseringskode for runtime og byggescripts; toDanishText uden cifre; klip-inventaret genereres fra koden og redigeres aldrig i hånden
- ASR-gate på takes, lytteside lyt.html og brugerens lyttetest af 20 sammensatte opgaver
- Navnerumsdisciplin (kun talvennerne2*), grep-test mod clear()/caches./serviceWorker.register og Playwright-tjek af at fremmede nøgler er byte-identiske
- ids.lock.json: id'er tilføjes og omdøbes aldrig; eksportfixtures pr. version
- Økonomisimulering som test: barnet med 50 % får mindst 70 % af perlerne, og ★★★-genspil giver højst 12 perler pr. tur
- Regionen får farve tilbage i takt med barnets mestring
- Forbudslisten over mørke designmønstre som manuel tjekliste før deploy
- Indplacering med højst 18 produktionsopgaver og neutral feedback
- deploy-app.sh-flow med guard (--new, kortet, --push, --verify); ingen service worker; rodens sw.js røres ikke
- Eksport og import pr. profil samt navigator.storage.persist() ved første profil
