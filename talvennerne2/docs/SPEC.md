# SPEC — Talvennerne 2

Dette er den endelige, samlede spec for Talvennerne 2. Den består af syntesen af tre designforslag og to kritikker (`docs/design/`) med ændringerne A1–A8 herunder, som vinder over resten af dokumentet. Henvisninger til "pædagogik-forslaget", "spil-forslaget" og "kunst-forslaget" peger på `docs/design/paedagogik.md`, `docs/design/spildesign.md` og `docs/design/kunst-lyd-teknik.md`.

## Ændringer (vinder over resten af dokumentet)

- **A1 – Ingen brugergates.**
  - Hvor SPEC siger "sendt til brugeren", "brugergodkendelse" eller "bekræftet af brugeren", er det en orientering via `SendUserFile` (status `proactive`), og arbejdet fortsætter straks.
  - iOS-tjeklisten står som åben i slutrapporten.
- **A2 – Stemme-reserve.** Piper `da_DK-talesyntese-medium` overtager som generator, hvis:
  - Chatterbox ikke kan installeres eller indlæses på CPU,
  - den målte RTF er over 12 (over ca. 10 t CPU for én take), eller
  - begge stemmer har probe-CER over 5 % efter 4 takes.

  Inventar, ASR-gate og pakning er de samme. Beslutningen og målingerne skrives i `docs/voice.md`.
- **A3 – V1-kanttilfælde rettes i porten af `useRound`.** Begge får tests.
  - Pause i 780 ms-vinduet efter 3., 6. eller 9. rigtige svar må hverken starte guldægget eller gemme den allerede besvarede opgave.
  - Pause efter sidste svar afslutter turen med fuld belønning og viser belønningsskærmen. Den afslutter ikke længere uden belønning.
- **A4 – Spike S4 (WebKit) udgår**, fordi miljøet forbyder `playwright install`. iOS-risikoen dækkes af:
  - `diag.html`,
  - iOS-tjeklisten,
  - Chromium med 4× CPU-throttle,
  - en gennemgang af den iOS-specifikke kode.
- **A5 – Parallelt arbejde via Agent-værktøjet** (baggrunds-subagenter, højst 6 samtidigt), ikke Workflow-værktøjet.
  - Integratoren (hovedsessionen) opretter worktrees med `git worktree add /home/user/wt/<agent> -b tv2/<agent>` og symlinker `talvennerne2/node_modules`.
  - Integratoren merger lokalt og pusher kun `claude/math-app-children-ios-4jihdr`.
  - Orakler skrives af en anden agent end generatoren. Review-agenter er aldrig forfatteren.
- **A6 – Robust mod genstart.**
  - Session-branchen pushes efter hver integration, ikke kun ved gates.
  - `scripts/tts/setup.sh` genopbygger venvs og modeller.
  - FLAC-mastere committes i bidder på højst 10 MB, og `generate.py` er idempotent.
- **A7 – Live-smoke uden github.io i Chromium.** Chromium kan ikke nå github.io herfra. I stedet:
  1. Den deployede version hentes med curl og sammenlignes byte for byte med `dist/`.
  2. Den serveres lokalt under `/Test/talvennerne2/` med `python3 -m http.server`.
  3. Den spilles med Playwright.
- **A8 – Deploy-fakta pr. 30/9.**
  - Forsiden har 9 kort. V1-kortet `.ta` står sidst, og teksten er "Ni web-apps".
  - Verify-stierne er "", vm/, elpriser/, kuglebanen/, vaegtskaalen/, vindtunnel/, surdej/, element-sandbox/, traeningslog/, talvennerne/ og talvennerne2/.
  - Andre sessioner kan have deployet siden, så alle tree-SHA'er på oversigts-branchen registreres lige før hver deploy.
- **A9 – Misforståelse mod operand (1/10, integrator).** Er en misforståelses-værdi også et tal fra spørgsmålet (5 + 1 skrevet som 5, 4 + 2 skrevet som 2), klassificeres den som `ambiguous` og tæller aldrig som tegn. At skrive et tal fra spørgsmålet er en mere sandsynlig forklaring, og forældre skal ikke se falske tegn. Det afviger fra koden i §4.1, hvor misforståelsen vinder over `operand`.
- **A10 – countFromFirst og tilfældige fejl på én (2/10, integrator).** 70 %-reglen i §4.3 regnes kun på skrevne svar. På kort er "én for lidt" altid det diagnostiske kort, mens "én for meget" kun nogle gange er med, så kortene hælder af sig selv. Reglen tjekkes efter hvert svar, så hældningen skal desuden være usandsynlig for fejl, der går begge veje: højst 0,1 % ensidig binomial-chance (fx 10 af 10 eller 18 af 20). Ellers markerede fixturen "50 % tilfældige ±1-fejl" barnet i 12–20 af 60 kørsler. Et barn, der tæller fra det første tal, markeres stadig inden for 160 svar.
- **A11 – Misforståelse mod byttede cifre (2/10, integrator).** Er en misforståelses-værdi også svaret med tiere og enere byttet (27 skrevet som 72, 45 som 54), klassificeres den som `ambiguous` og tæller aldrig som tegn. Den ombyttede skrivemåde følger af den danske talrækkefølge ("femogfyrre") og er den mest sandsynlige forklaring. Reglen gælder kun, hvor digitSwap overhovedet kan ske (`digitSwapPossible`). `buildTask` lægger den på alle taggede kandidater, så opgavens tags og klassifikationen altid er enige. Fundet af ORK2a i add100NoCarry, add100Carry, sub100Borrow, placeValue1000 og mul2510.
- **A12 – ":" læses "delt med" i 2. klasse (3/10, integrator).** I 2. klasse møder barnet division som deling: shareEqually og inverseOps læser ":" som "delt med" (`frag.muldiv.delt_med`), og ingen opgave eller hint i 0.–2. klasse siger "divideret med". Fra 3. klasse (bølge 3) læses tegnet "divideret med" som i §10.1 (`speech/equation.ts`), og det første divisions-hint bygger bro: "Divideret med betyder det samme som delt med." Så hører barnet aldrig tegnet læst på to måder på samme klassetrin. Fundet af ORK2c; muldiv-oraklet holder linjen for alle skills i 0.–2. klasse.
- **A13 – Turen, når dagens nye nøgler er brugt (2/10, UIFIX2; noteret 3/10).** Med loftet på 20 nye nøgler pr. læringsdag nået (§5.4) spørges ingen nøgle mere end 2 gange i én tur (`CAPPED_REPEAT_MAX`). Turen fyldes med regionens egne sete nøgler, så kædens, så review fra de startede skills. Løber de tør, bliver turen kortere i stedet for at gentage "1 + ? = 2" fem gange. En node, barnet aldrig har spillet, får en smagsprøve på sine første 2 nøgler (`TASTE_KEYS`), dog højst 4 sådanne nøgler pr. læringsdag (`TASTE_PER_DAY`). Så bliver en lang session ved med at være konsoliderende og aldrig nyt stof node efter node (§13). Fundet som UI-fund 10 og 16.
- **A14 – Gætterate for udfyldning og kroner (2/10, UIFIX2; noteret 3/10).** I §3.1 tæller `guessP` for `fillSlots` alle udfyldninger, opgaven accepterer: (1 + antal i `accept`) / muligheder^felter, fx 10|3 og 3|10 for 13 = □ + □ og de ækvivalente brøker. For `keypad` i kroner (`entryScale` 100) regnes intervallet i tastede kroner, ikke i øre: 0–2000 øre er 21 mulige svar, ikke 2001. Fundet som UI-fund 8 og 22.
- **A15 – En sten tæller kun med sit eget stof (3/10, integrator; QA2 P2-1).** En tur tæller for stenen (stjerner, ven, kiste, spillet), når mindst halvdelen af turens opgaver er stenens egne nøgler: nodens skills inden for regionens grænser og ikke review-only (`OWN_SHARE_MIN`, `PlannedRound.ownShare`). Det afgøres, når turen planlægges. En sten, der aldrig er spillet, og hvis tur ville være under halvt egen, fordi dagens nye nøgler er brugt (A13), starter ingen tur (`chooseStart` → `'tomorrow'`). Intro-skærmen viser Pip: "Her er der nyt i morgen. Nu kan du øve det, du har lært." med to lige store knapper, Blandet øvelse og Til kortet. Der er ingen nedtælling, intet ur og intet "kom tilbage om …" (§13). En sten, der allerede er spillet, kører som i A13. Prøver, finaler, Blandet øvelse og hytten tæller altid. A13's smagsprøve (`TASTE_KEYS`, `TASTE_PER_DAY`) kan ikke nå halvdelen af en tur og bruges derfor ikke længere for nye sten; den ryddes op senere.
- **A16 – Budgettet for al JS er 750 KB gzip (3/10, integrator).** Tallet er summen af alle dovne chunks: 16 arter, 74 genstande, 4 scener og 72 skills, som hver først hentes, når barnet når dem. Ventetiden bestemmes af startbundtet (≤ 160 KB) og den enkelte chunk (≤ 60 KB), og de er uændrede. Med Ridder og Talmagiker nåede bølge 2 604 KB, og bølge 3 lægger ca. 90–100 KB til (4 arter, en scene, 16 skills og Astronaut). Stemmens sprites (7–16 MB) dominerer det samlede download, så 150 KB JS er under 2 % af det. Data hører ikke til i JS: stemmens manifest hentes som JSON (3/10), og nye tabeller (fx lommernes hylstre) skal være kompakte. `scripts/budget.mjs` fejler buildet over 750 KB.
- **A17 – En håndgenstand må tegnes foran poten (4/10, integrator).**
  - Som standard gælder §7.1 regel 5: poten tegnes over håndtaget.
  - En håndgenstand, der bæres foran kroppen, kan erklære `art.over`. Så tegnes den efter poten og benet, og en rem eller hånddel viser grebet. Det gælder fx Ridderens skjold med rem, som ellers skjules halvt af forbenet på heste, enhjørninger og ræve.
  - Holder en ugle med kropstøj noget, tegnes håndgenstanden på samme måde over vingen og ærmet, så den kan ses.
  - Øjenreglen (regel 6) og elementbudgettet gælder uændret.
  - Ændringen gennemgås i den uafhængige kunst-gate G2-r4.
- **A18 – reserveret** til bogføring efter paint (`docs/perf.md`). Den skrives kun, hvis den bogføring bliver merget.
- **A19 – ":" læses "divideret med" i 3. klasse (5/10, integrator; bølge 3).**
  - Alle 3. kl.-skills og 3. kl.-familier læser ":" som "divideret med" (`speech/equation.ts`). Det omgør A12 for `inverseOps/mulToDiv` (grade 3), som hidtil sagde "delt med". Familien bruges kun i Stjernefjeldet.
  - Det første divisions-hint i `div2510` bygger bro: "Divideret med betyder det samme som delt med." `hint.inverseOps.timesDivide` følger med.
  - A12 gælder uændret for 0.–2. kl.: muldiv-oraklet holder linjen for alle familier med grade ≤ 2.
- **A20 – Stemmens samlede budget er 20 MiB (5/10, integrator; bølge 3).**
  - Sprites hentes dovent pr. pakke, så totalen påvirker kun det, et barn henter, når det når nyt stof.
  - Bølge 1–2 fylder 13,89 MiB, og bølge 3 lægger ca. 4 MiB til (de 234 katalogiserede klip og 16 skills).
  - Det fast indlæste (n0-20, core og ui) er uændret ≤ 1,2 MB, og hver sprite er ≤ 300 KB.
  - `scripts/voice/pack.mjs` (`BUDGET.total`) håndhæver det. Punkt 3 nedenfor og §10.4 ("≤ 16 MB") er erstattet af dette.
- **A21 – Opgavetypen `grid` er punkter og felter (5/10, integrator; bølge 3).**
  - `grid`-visningen (`src/ui/task/grid/`) bruges kun til opgaver, hvis svar er felter eller punkter (sæt-tokens; `PLAYABLE.grid`). Det er `gridCoords`' `readPoint` og `placePoint`.
  - `symmetry` svarer med et tal ("hvor mange felter mangler?") og vises fortsat på tastaturet. Dens gætterate regnes som tastaturets (1/13), så loftet er uændret. Multi-tilstanden i §3.2 (spejl felterne) udgår.
  - Instruktionen `s.kind.grid.*` beskriver at sætte og aflæse et punkt.
- **A22 – Et klassetrin kræver sit eget stof (5/10, integrator; bølge 3).**
  - `gradeEstimate` godkender kun et klassetrin, når mindst 50 % af trinnets egne kerneskills (dem, der ikke er sprunget over) er mindst "Med støtte". Har trinnet ingen sådanne skills, godkendes det ikke.
  - Før kunne 3. kl. godkendes alene på 0.–2. kl.'s skills (29 af 36 kerneskills = 80,6 %).
  - For 1.–2. kl. følger reglen allerede af 80 %-reglen, så deres estimat er uændret. Det testes.
- **A23 – Misforståelsen `coordSwap` (5/10, integrator; bølge 3, fundet af ORK3b).**
  - Den 32. misforståelse: barnet bytter hen og op i et koordinatsæt og læser eller sætter (3, 2) som (2, 3). Den er en concept, ikke et slip.
  - `gridCoords` tagger det byttede par `coordSwap` på nettet (`grid`, begge familier) og på readPoints kort. På placePoints kort er værdien et tal fra spørgsmålet, så den bliver `ambiguous` efter A9. Punkter med x = y kan ikke vise den.
  - Hintet starter med "Det første tal er hen, og det andet tal er op."
  - Forældreteksten og hjemmetippet står i `src/content/misconceptionTexts.ts`. `MISCONCEPTION_IDS` og `ids.lock.json` får id'et, og §4's tal 31 er nu 32.
  - Før blev et barn, der byttede i alle svar, aldrig opdaget, fordi byttet var `other`.
- **A24 – Indplacering i 3. klasse og bølge 3's øvrige kontraktbeslutninger (7/10, integrator; bølge 3).**
  - **Indplaceringen** (§8 trin 4) findes kun for 3. klasse i onboardingen. Den vises først, når Stjernefjeldet er bygget og frigivet (`worldBuilt('fjeld')`). Før det, og altid for 0.–2. kl., er onboardingen uændret: barnet starter i Tællelunden. "Indplacering igen" findes ikke.
  - **Seeding:** Stigens trin stiger ikke strengt i stage. Derfor seeder indplaceringen op til `seedStage(P)`, den højeste stage til og med det placerede trin P (`src/engine/ladder.ts`, genbrugt af `placement.ts`).
  - **Start (QA3a P2-4, QA3b):**
    - Stigen måler kun tal og regning. Derfor kan kun regioner i kæden `tal` springes over (`passedOver`): dem, hvor alle skills har stage < `seedStage(P)`, og ingen af dem er skill for et trin, barnet ikke bestod. Deres lektioner er `skipped`, mens ven, kiste og prøve venter. Regioner i kæderne `figurer`, `klokken` og `pengeMaal` springes aldrig over og læres som normalt; deres verdener åbnes som i dag af klassetrinnet.
    - Et trin, barnet ikke bestod, seedes ikke, heller ikke når det ligger under `seedStage(P)`. De ikke beståede trin gemmes i `placement.failed`.
    - Første tur starter på første sten i den laveste region i kæden `tal`, der ikke er sprunget over (`placedStart`). Fx giver L14 Tabeltoppen, L5 Hundredemarken, L4 Minusbækken og P = null Tællelunden.
    - Regionens verden er barnets hjemverden. Kortet viser den, når ingen verden er valgt, og foreslår først regioner, der ikke er sprunget over.
    - Hjemverdenen rykker op efter de eksisterende regler (`worldComplete`). Verdener, som klassetrinnet har åbnet, kan altid vælges i verdensvælgeren.
    - Målene laves, når klassetrinnet er valgt, og igen efter stigen.
    - Indplaceringen tæller, når barnet har bestået mindst ét trin, eller når stigen er sluttet af sig selv. "Spring over" og "Det er nok", før et trin er bestået, er ingen indplacering (`placement.done` er falsk), så barnet starter i egen verden; svarene er stadig logget med mode `placement`. En stige, der slutter af sig selv uden et bestået trin (L5 og L4 ikke bestået), giver P = null og Tællelunden. (Review app-w3-r2: ét svar og så "Det er nok" gav før Tællelunden, mens intet svar gav egen verden.)
    - Reglerne gælder kun ved `placement.done`, så 0.–2. kl. er uændret.
  - **Statistik:** Indplaceringens svar (`mode: 'placement'`) tæller ikke i forældrenes nøjagtigheds- og tidstal (`countsInStats`, pædagogik §4.2). Indplaceringen vises stadig som en tur for sig.
  - **Timeskiftet på urskiven:** I `clockElapsed` starter urskiven på starttiden (`SkillExtras.dialStart`). En halv time hen over timeskiftet, drejet den forkerte vej (fx 3:15 for 3:45 + ½ time), er `wrongOperation` på urskiven og `near` på kortene. ORK3c's orakel følger det.
  - **Antal misforståelser:** Med A23 er der 32. Tallet 31 i §4.2, §10.2 og §14 læses som 32.

---

# Talvennerne 2: endelig samlet plan

Planen samler de tre designforslag og de to kritikker. Hvor et forslag er ændret, står begrundelsen ved beslutningen. Alle stier er relative til `/home/user/Test/talvennerne2/`, medmindre andet står. V1-koden er læst (HEAD `c956c45`, branch `claude/math-app-children-ios-4jihdr`).

---

## 0. Beslutninger på én side

| # | Beslutning |
|---|---|
| D1 | V2 er en selvstændig Vite-app i `talvennerne2/` på den nuværende branch, med egen `package.json` og egne `node_modules`. V1-filerne ændres aldrig, og V1 bygges og deployes aldrig igen fra denne branch. |
| D2 | Rygraden er pædagogik-forslaget: 10 domæner og 72 skills (lister i afsnit 2), et `SkillDef`-register, recall- og procedure-mestring, `AnswerValue = number \| string` og mærkede distraktorer. |
| D3 | Spillaget (tre spor, rugeæg, venskab, garderobe, ceremonikø) bygges oven på pædagogikkens regiongraf. Spildesignets lineære etaper bruges ikke. |
| D4 | Teknikken (rig, lydpipeline, Dexie, sheets, review-løkke) følger kunst/teknik-forslaget med alle rettelser fra realisme-kritikken. |
| D5 | Kontrakterne fryses i G-spec (`docs/SPEC.md`, `src/engine/types.ts`, `src/content/ids.lock.json`), før nogen arbejder-agent starter. |
| D6 | Risikoen tages først: lyd-spike, kanin-spike og iOS-diagnose. Derefter bygges en lodret skive (Engdalen, 0. kl.), som deployes, og så bølge 2 (1.–2. kl.) og bølge 3 (3. kl.). |
| D7 | Ét navnerum: IndexedDB `talvennerne2` samt localStorage- og sessionStorage-nøgler med præfikset `talvennerne2.`. Ingen service worker. |
| D8 | Stemmen er CoRal `roest-v3-chatterbox-500m` (Mic eller Nic, valgt ved probe). Hele spørgesætninger indspilles for alle recall-facts til og med 1. kl. Resten sættes sammen af klip. `speechSynthesis` er kun reserve. |
| D9 | Følgende kommer ikke med i v2.0 (skåret): baggrundsmusik, fotoalbum, dyrescener i Dyrehaven, sæsonpynt, signaturting, hemmelige trofæer, `rulerDraw`, sæt-emotes og 24 af de 32 pyntegenstande. |

Tre steder afviger planen bevidst fra realisme-kritikken:

1. **Indplacering seeder boks 2, ikke boks 3.** To opgaver pr. checkpoint svarer til "genkender", ikke "sikker". Det følger lærer-kritikken.
2. **Portene er domænekæder, ikke "højst én etape foran".** Lærer-kritikkens blocker kræver, at uafhængige domæner ikke blokerer hinanden.
3. **Det samlede lydbudget er ≤16 MB (hentes efter behov), ikke 7 MB.** Hele sætninger og navne fylder mere. Opstartspakken holdes stadig ≤1,2 MB.

---

## 1. Kerneidé og designprincipper

**Fortælling:** Talvennernes rige har mistet sine farver. Når barnet bliver sikker i noget, kommer farverne tilbage til den del af verdenen. Dyrene bor der og vokser, jo mere barnet regner med dem. Fortælleren er **Pip**, en lille spurv. Pip er ikke et samleobjekt, men bruger samme rig (krop `pear`).

**Tre spor**, så barnet altid oplever fremgang:

| Spor | Fodres af | Barnet ser |
|---|---|---|
| Rejsen | Beståede mesterprøver | Kort, tåge der letter, nye regioner og verdener |
| Venner og ting | Rigtige svar (indsats) og mestring | Rugeæg, venskab, vækst, tøj, perler, niveau |
| Kan-bogen | Leitner-bokse (produktion, på tværs af dage) | Medaljer i bronze, sølv og guld. Regionen får farve. |

**Principper (bindende):**
1. Ingen belønning kan fås uden at regne. De mest eftertragtede ting kan kun låses op af mestring: Stjernefølet, gyldne dyr og regnbuedyr, Ridder- og Talmagiker-sættet samt fuld farve i regionen.
2. Læring vises før ting. Tur-slut viser altid først "Det lærte du" og derefter belønningerne.
3. Intet optjent kan tabes. Ingen skyld, ingen tidspres for barnet, ingen tilfældige præmier med sjældenhed.
4. Matematikken bor i verdenen: gulerødder tælles på engen, uret sidder i tårnet, mønterne ligger hos købmanden.
5. Alt kan bruges uden at kunne læse. Al tekst til barnet læses op, alle ikoner har tale, og hver opgavetype har en demo.
6. De låste valg gælder:
   - Valgopgaver topper ved boks 3. Boks 4–5 kræver produktion.
   - Ved fejl vises strategien, og barnet trykker på det rigtige svar.
   - Langsomt men rigtigt giver ingen boks-fremgang.
   - ✕ pauser og gemmer turen.
   - Spillet foreslår aldrig pause, og der er ingen tidsgrænse.

---

## 2. Pensum-taksonomi

### 2.1 Domæner

Domænerne er dashboardets kategorier, grupperet under Fælles Mål-overskrifter.

| DomainId | Label | Fælles Mål-gruppe | Kerne i estimat | Farve |
|---|---|---|---|---|
| `number` | Tal og tælling | Tal og algebra | ja | #2F7DF6 |
| `place` | Titalssystemet | Tal og algebra | ja | #8D6E63 |
| `addsub` | Plus og minus | Tal og algebra | ja | #F2994A |
| `muldiv` | Gange og division | Tal og algebra | ja | #9B51E0 |
| `algebra` | Lighedstegn og mønstre | Tal og algebra | nej | #5C6BC0 |
| `fractions` | Brøker | Tal og algebra | nej | #E056A0 |
| `shapes` | Figurer og rum | Geometri og måling | nej | #27AE60 |
| `clock` | Klokken | Geometri og måling | nej | #EB5757 |
| `money` | Penge | Geometri og måling | nej | #E0B020 (tekst i ink) |
| `measure` | Måling og data | Geometri og måling (`readChart` vises under Statistik) | nej | #2DB7B0 |

### 2.2 De 72 skills

Forkortelser i tabellen:
- **R** betyder recall: Leitner pr. fact.
- **Pr** betyder procedure: Leitner pr. familie, med seedede instanser.
- **\*** betyder en produktions-kind efter reglen i 3.3.
- **Kl.** er skillens klassetrin. En afvigende familie står i parentes.

| Domæne | Skill-id | Kl. | Mode | Repræsentation | Opgavetyper | Facts / familier |
|---|---|---|---|---|---|---|
| number | `count10` | 0 | R | dyr og prikker spredt, terning, fingre, ti-ramme (flash 1,5 s for 1–6) | choice, countTap\*, keypad\* | 28 |
| number | `count20` | 0 | R | 2 ti-rammer, perlesnor | choice, keypad\*, countTap\* | 20 |
| number | `hear20` | 0 | R | højttaler, talkort (11–19 rangeres sidst) | choice, keypad\* | 21 |
| number | `order20` | 0 | Pr | tallinje 0–20, trædesten | choice, numberline\*, keypad\*, sortOrder\* | 4 fam: after, before, between, bigger |
| number | `hear100` | 1 | Pr | højttaler, 100-tavle | choice, keypad\* | 8 fam: d2x…d9x (80 inst.) |
| number | `order100` | 1 | Pr | 100-tavle | choice, keypad\*, sortOrder\* | 7 fam: plus1, minus1, plus10, minus10, crossTen, biggerDiffTens, biggerSwapped |
| number | `numberLine100` | 1 | Pr | tom tallinje | numberline\* (±5), choice, keypad\* | 3 fam: placeTens, placeAny, readArrow |
| number | `hear1000` | 2 | Pr | højttaler, multibase | choice, keypad\* (5 cifre tilladt) | 5 fam: hundreds, h0o, hTeen, hT0, hTO |
| number | `order1000` | 2 | Pr | tallinje, positionsplade | choice, keypad\*, sortOrder\* | 9 fam, inkl. crossHundred, biggerMixed |
| number | `numberLine1000` | 2 (round10 og round100: 3) | Pr | tallinje ±50 | numberline\*, choice, keypad\* | 4 fam |
| place | `tensOnes` | 1 | Pr | multibase, positionsplade | choice, keypad\*, buildBase\*, fillSlots | 4 fam: build, decompose, swapped, expand |
| place | `placeValue1000` | 2 (regroup: 3) | Pr | plader, stænger, terninger | choice, keypad\*, buildBase\*, fillSlots\* | 5 fam: buildHTO, zeroPlace, digitValue, expand, regroup |
| addsub | `addTo10` | 0 | R | prikker, ti-ramme | choice, keypad\* | 66 |
| addsub | `subTo10` | 0 | R | overstregede prikker | choice, keypad\* | 66 |
| addsub | `tenFriends` | 0 | R | ti-ramme | pair, choice, keypad\* | 11 |
| addsub | `doubles` | 1 | R | domino, to hænder | choice, keypad\*, numberline\* | 10 |
| addsub | `halves` | 1 | R | deling i to | choice, keypad\*, share | 10 |
| addsub | `addSub20Simple` | 1 | Pr | 2 ti-rammer | choice, keypad\* | 3 fam: addTeen, subTeen, tenPlus |
| addsub | `addTo20` | 1 | R | ti-ramme "fyld op til 10" | choice, keypad\*, numberline\* | 36 |
| addsub | `subTo20` | 1 | R | ti-ramme "tilbage til 10" | choice, keypad\* | 36 |
| addsub | `tens100` | 1 | Pr | tierstænger | choice, keypad\* | 2 fam |
| addsub | `add100NoCarry` | 1 | Pr | multibase, 100-tavle | choice, keypad\*, buildBase | 3 fam |
| addsub | `sub100NoBorrow` | 1 | Pr | multibase | choice, keypad\* | 3 fam |
| addsub | `add100Carry` | 2 | Pr | tom tallinje med hop | choice, keypad\*, numberline\* | 5 fam: toNextTen, TOplusOcarry, TOplusTOcarry, nearTen, **TOplusTOover100** |
| addsub | `sub100Borrow` | 2 | Pr | tom tallinje | choice, keypad\* | 4 fam: fromTen, TOminusOborrow, TOminusTOborrow, nearTen |
| addsub | `addSub1000Round` | 2 | Pr | plader, stænger | choice, keypad\* | 6 fam |
| addsub | `add1000` | 3 | Pr | positionsplade | choice, keypad\* | 6 fam |
| addsub | `sub1000` | 3 | Pr | positionsplade | choice, keypad\* | 6 fam, inkl. acrossZero |
| muldiv | `groupsOf` | 2 | R | grupper af dyr, array | choice, keypad\* | 16 |
| muldiv | `mul2510` | 2 | R | array, spring på tallinje | choice, keypad\* | 27 |
| muldiv | `shareEqually` | 2 | R | dyr får gulerødder | share\*, choice, keypad\* | 20 |
| muldiv | `mul34` | 3 | R | array | choice, keypad\* | 13 |
| muldiv | `mul6to9` | 3 | R | array delt (7·8 = 5·8 + 2·8) | choice, keypad\* | 14 |
| muldiv | `div2510` | 3 | R | array, deling | choice, keypad\*, share | 30 |
| muldiv | `divAll` | 3 | R | array | choice, keypad\* | 60 |
| muldiv | `mulTens` | 3 | Pr | stænger | choice, keypad\* | 2 fam |
| algebra | `patterns` | 0 | Pr | perler på snor | choice, fillSlots\* | 5 fam: AB, AAB, ABB, ABC, growing |
| algebra | `missingPart10` | 1 | R | prikker under et blad | choice, keypad\* | 36 |
| algebra | `skipCount` | 1 (step100: 2, step25: 3) | Pr | trædesten, 100-tavle | choice, keypad\*, fillSlots\* | 7 fam |
| algebra | `missingPart100` | 2 | Pr | tom tallinje | choice, keypad\* | 4 fam: addendCross20, **toHundred** (37+?=100, 100−37), subtrahend, minuend |
| algebra | `inverseOps` | 2 (mulToDiv: 3) | Pr | regnetrekant | choice, keypad\* | 3 fam |
| algebra | `equalSides` | 2 (balanceSub og balanceMixed: 3) | Pr | vippebræt med dyr | trueFalse, choice, keypad\* | 4 fam |
| shapes | `shapes2D` | 0 (squareRect og polygons: 1) | R | 6 varianter pr. figur (standard, drejet, strakt, lille, mønstret, kun omrids) | choice, multiSelect\* | basic {cirkel, trekant, firkant} ×6 = 18, squareRect {kvadrat, rektangel} ×6 = 12, polygons {5-, 6-, 8-kant} ×4 = 12 → 42 |
| shapes | `sidesCorners` | 1 | R | figur, hjørner markeres i hint | choice, keypad\* (interval 0–12) | 30 |
| shapes | `shapes3D` | 1 (props: 2) | R | isometrisk tegning og hverdagsting | choice, multiSelect\*, keypad\* | 33 |
| shapes | `sortShapes` | 1 (fourEqualSides: 2, rightAngle: 3) | Pr | 6–8 figurer | multiSelect\* | 5 fam |
| shapes | `symmetry` | 1 (mirrorGrid: 2) | Pr | net, spejl | trueFalse, multiSelect\*, grid\* | 2 fam |
| shapes | `composeShapes` | 2 | R | tangram-brikker | choice, keypad\* | 16 |
| shapes | `area` | 3 | Pr | kvadratnet | choice, keypad\* | 4 fam |
| shapes | `gridCoords` | 3 | Pr | net med akser 0–6 | choice, grid\* | 2 fam |
| clock | `clockHour` | 1 | R | analogt ur | choice, clockSet\* | 12 |
| clock | `clockHalf` | 1 | R | analogt ur | choice, clockSet\* | 12 |
| clock | `clockQuarter` | 2 | R | analogt ur | choice, clockSet\* | 24 |
| clock | `clockFive` | 3 | Pr | analogt ur | choice, clockSet\* | 5 fam: over, iHalv, overHalv, i, **halfForm** |
| clock | `clockDigital` | 3 | Pr | analogt og digitalt ur | choice, clockSet\* | 2 fam |
| clock | `clockElapsed` | 3 | Pr | ur og tidslinje | choice, clockSet\* | 4 fam |
| money | `coinNames` | 1 | R | legemønter og -sedler | choice, multiSelect\* | 10 |
| money | `countCoins` | 1 (≤100 og biggestFirst: 2) | Pr | mønter | choice, keypad\* | 4 fam |
| money | `payExact` | 2 (fewestCoins: 3) | Pr | butik og pung | pay\*, choice | 4 fam |
| money | `change` | 2 (from100: 3) | Pr | butik | choice, keypad\*, pay\* | 4 fam |
| money | `kronerOre` | 3 | Pr | pris med øre | choice, pay\* | 3 fam |
| measure | `compareLength` | 0 | R | ting linet op eller forskudt | choice, sortOrder\* (4 ting) | 16 |
| measure | `weightCompare` | 1 | R | skålvægte | choice, multiSelect\* ("alle der er tungere end bamsen", 6 vægte) | 12 |
| measure | `measureUnits` | 1 | Pr | klodser, clips | choice, keypad\* | 2 fam |
| measure | `rulerRead` | 1 (offset: 2) | Pr | lineal | choice, keypad\* | 2 fam: from0, offset |
| measure | `unitChoice` | 2 (weight: 3) | R | enhedspiktogrammer | choice, multiSelect\* | 24 |
| measure | `readChart` | 2 | Pr | piktogram, søjlediagram | choice, keypad\* | 4 fam |
| measure | `convertCmM` | 3 | Pr | meterstok | choice, keypad\* | 4 fam |
| fractions | `halfShape` | 1 | R | lige og skæve delinger | trueFalse, multiSelect\* | 16 |
| fractions | `fractionShape` | 2 (3/4 og 2/3: 3) | R | cirkel, rektangel, stang | choice, colorParts, fillSlots\* (tæller og nævner fra paletten 1–8) | 18 |
| fractions | `fractionOfSet` | 3 | Pr | dyr og ting deles | share\*, choice, keypad\* | 4 fam |
| fractions | `fractionCompare` | 3 | Pr | brøkstænger | choice, sortOrder\* (4 brøker) | 3 fam: pairBigger, pairSmaller, order4 |

**Fravalg (begrundet):**
- Chance og sandsynlighed kræver fysiske eksperimenter.
- Omkreds og division med rest hører til 4. kl.

### 2.3 Figurernes begrebshierarki

`isA`-tabellen ligger i `src/engine/skills/shapes/isA.ts`:
- square ⊂ rectangle ⊂ quadrilateral
- cube ⊂ cuboid

Regler:
- 0. kl. bruger kun `{circle, triangle, quadrilateral}` ("firkant").
- `squareRect` (1. kl.) introduceres med klippet "Et kvadrat er også et rektangel."
- En distraktor må aldrig være en instans af svaret (`isA`).
- `multiSelect` "alle rektangler" har kvadrater med i facit.

Content-test: for alle shapes-opgaver gælder, at ingen distraktor er `isA` svaret, og at alle `isA`-instanser er i facit.

### 2.4 Kontrakten `SkillDef` (`src/engine/skills/types.ts`)

```ts
export interface SkillDef {
  id: SkillId; domain: DomainId; grade: 0|1|2|3; stage: number   // 0.0–3.9
  mode: 'recall' | 'procedure'
  label: string            // forældretekst
  canDo: ClipId            // Kan-bogen: "Jeg kan …"
  families: FamilyDef[]    // recall: 1+ familier til gruppering; procedure: mestringsenheden
  kinds: TaskKind[]        // mindst én skal kunne være produktion (test)
  enumerate(): Fact[]      // recall: alle facts; procedure: 20 kanoniske pr. familie (til test og rank)
  instance(fam: FamilyDef, rng: Rng, avoid: ReadonlySet<string>): Fact   // kun procedure
  answerType(fact: Fact): AnswerType
  prompt(fact: Fact, kind: TaskKind, rng: Rng): Prompt
  optionView(fact: Fact, kind: TaskKind): OptionView
  range(fact: Fact, kind: TaskKind): [number, number]
  speech(fact: Fact, kind: TaskKind): SpeechPart[]
  candidates(fact: Fact): Candidate[]           // {value, tag}
  hint(fact: Fact, tag: ErrorTag | null): HintSpec
  fastMs?(fact: Fact, kind: TaskKind): number | undefined
}
export interface FamilyDef { id: string; label: string; rank: number; grade?: 0|1|2|3; fastMs?: Partial<Record<TaskKind, number>> }
export interface Fact { id: string; skill: SkillId; family: string; operands: readonly number[]; answer: AnswerValue; rank: number; data?: FactData }
// masteryKey = mode==='recall' ? fact.id : `${skill}/${family}`
```

Registrering:
- Hver skill ligger i `src/engine/skills/<domain>/<skillId>.ts`.
- `src/engine/skills/registry.ts` samler dem med `import.meta.glob('./*/*.ts', { eager: true })`, filtreret til filer uden `.test` og `.oracle`.
- Der er ingen fælles indeksfiler.

Fact-id'er:
- V1-konventionerne bevares: `add:a+b`, `sub:a-b`, `ten:a`, `dbl:a`, `hlf:n`.
- Gange er kanonisk som `mul:3x7` med mindste faktor først. Retningen trækkes i `buildTask`.

---

## 3. Svarmodel og opgavetyper

### 3.1 Typer (`src/engine/types.ts`)

```ts
export type AnswerValue = number | string
export type AnswerType = 'int' | 'minutes' | 'ore' | 'token' | 'set'
// minutes: altid 0–1439; Task.modulo = 720 (analogt) | 1440 (24-timer)
// ore: penge i øre; token: 'shape:triangle' | 'solid:cube' | 'frac:3/4' | 'cmp:<' | 'unit:cm' | 'yes' | 'no' | 'pat:red'
// set: sorterede tokens '|'-joined: 's0|s3|s5', celler '3|7|12', mønter 'c2000|c500|c200'
export interface Task {
  id: string; factId: string; masteryKey: string; skill: SkillId; family: string; kind: TaskKind
  prompt: Prompt; answer: AnswerValue; answerType: AnswerType; accept: AnswerValue[]
  tolerance: number; modulo: 0 | 720 | 1440
  options: AnswerValue[]; optionView: OptionView; distractorTags: Record<string, ErrorTag>
  optionClips: ClipId[] | null      // obligatorisk for unitWord/relation/token-views
  unit: 'kr' | 'cm' | 'm' | null; entryScale: 1 | 100
  range: [number, number]; maxDigits: number
  scaffold: boolean; speech: SpeechPart[]
  retryOf: string | null            // gensvar efter fejl
}
```

`Prompt` er pædagogikkens diskriminerede union: equation, objects, hear, base, row, line, groups, array, share, balance, shape, shapes, solid, symmetry, grid, clock, coins, shop, ruler, unitsRow, compareObjects, chart, fraction, area og story.

```ts
// src/engine/answer.ts
export function isCorrect(t: Task, g: AnswerValue): boolean {
  if (typeof t.answer === 'number' && typeof g === 'number') {
    const d = t.modulo ? ((g - t.answer) % t.modulo + t.modulo) % t.modulo : Math.abs(g - t.answer)
    const dist = t.modulo ? Math.min(d, t.modulo - d) : d
    return dist <= t.tolerance
  }
  return g === t.answer || t.accept.includes(g)
}
```

**Keypad** bruges kun ved `answerType ∈ {int, ore}`, og ved `ore` kun når svaret er hele kroner (`entryScale = 100` med suffikset "kr").
- `maxDigits` er `digits(range[1])`, bortset fra i `hear1000` og `placeValue1000`, hvor den er `max(digits(range[1]), digits(answer)+2)`. Så kan 1004-fejlen ses.
- Et engine-assert fejler, hvis keypad kombineres med `minutes`, `token` eller `set`.

**Notation:**
- Gange skrives `·`, division `:`, minus `−`.
- `×` og `÷` findes ikke nogen steder (scan-test).
- Tal ≤ 9999 vises uden tusindtalsseparator.
- Penge vises som "12,50 kr.". Tid vises som "14:30" på urdisplay og "kl. 14.30" i tekst.

### 3.2 TaskKinds (15)

`rulerDraw` er reserveret i `ids.lock.json`, men bygges ikke.

| Kind | Interaktion | guessP (til produktionsreglen) | fastMs | Bølge |
|---|---|---|---|---|
| `choice` | 2–4 store kort, ét tryk | 1/antal kort | 5.000 + 1.500 pr. ciffer over 1 | 1 |
| `keypad` | Tastatur 0–9, slet, flueben (aktivt når der er indtastet noget), enhedssuffiks | 1/(range-størrelse) | 6.000 + 2.000 pr. ciffer over 1 | 1 |
| `countTap` | "Læg 7 i kurven". Tryk i kurven fortryder. Flueben. | 1/(range-størrelse) | 2.000 + 700·n | 1 |
| `pair` | Træk to bobler sammen (kun `tenFriends`) | 1/antal bobler | 7.000 | 1 |
| `numberline` | Tryk eller træk på linjen, med tolerance | (2·tol+1)/(max−min+1) | 8.000 (0–20), 10.000 (0–100), 12.000 (0–1000) | 1 |
| `trueFalse` | Påstand. Grønt flueben-ikon ("ja") og koralrødt kryds-ikon ("nej"), ingen tekst | 0,5 | 5.000 | 1 |
| `sortOrder` | 3–5 kort. Tryk i rækkefølge, og kortet flyver på plads. Tryk på et placeret kort sender det tilbage. | 1/n! | 2.500 pr. kort | 1 |
| `multiSelect` | 5–8 ting. Tryk giver ring og flueben. Derefter flueben-knap. Kun det præcise sæt er rigtigt. | 1/(2ⁿ−1) | 2.000 pr. ting | 1 |
| `fillSlots` | k felter og en palet. Tryk fylder næste felt, tryk på et felt tømmer det. Flueben. | 1/paletᵏ | 3.500 pr. felt | 1 |
| `buildBase` | Knapper for plade, stang og terning plus arbejdsområde. Ingen automatisk veksling. Flueben. | 0,01 (kun produktion i tensOnes og placeValue1000) | 4.000 + 1.200 pr. brik | 1 |
| `clockSet` | Minutviseren trækkes og snapper til skillens trin (60/30/15/5). Timeviseren følger med som et tandhjul. Start 12:00. Flueben. | step/modulo | 12.000 (hel og halv), 18.000 (kvart og 5 min) | 2 |
| `pay` | Pungen har mønter og sedler med ubegrænset forråd. Tryk lægger i bakken, tryk i bakken tager tilbage. Ingen løbende sum. Flueben. | 0,01 | 5.000 + 2.500 pr. mønt i den optimale løsning | 2 |
| `share` | Tryk på et dyr, så hopper én ting over. Flueben når bunken er tom. Ulige deling giver svaret −1 med tagget `shareUnequal`. | 0,01 (kun produktion i shareEqually og fractionOfSet) | 3.000 + 800·N | 2 |
| `colorParts` | Tryk farver eller affarver en del. Flueben. Svaret er `frac:k/n`. | 1/(n+1) | 3.000 + 1.000 pr. del | 2 |
| `grid` | `multi`: spejl mønsteret. `single`: tryk på punktet (x,y). Flueben. | multi 1/2^celler, single 1/(w·h) | 5.000 + 1.500 pr. celle (single: 8.000) | 3 |

Familier kan overstyre fastMs for keypad:
- `add100Carry` og `sub100Borrow`: 15.000.
- `add1000` og `sub1000`: 25.000.
- `mulTens`: 10.000.

Tidsmålingen starter ved `max(vist, oplæsning slut)`, og hver "Hør igen" lægger promptens varighed til.

### 3.3 Produktion og loft (`src/engine/kinds.ts`, `mastery.ts`)

```ts
const MANIPULATIVE_ONLY_FOR: Partial<Record<TaskKind, SkillId[]>> = {
  share: ['shareEqually', 'fractionOfSet'], buildBase: ['tensOnes', 'placeValue1000'], countTap: ['count10', 'count20'],
}
export const isProduction = (t: Task) =>
  KINDS[t.kind].guessP(t) <= 0.12 && (MANIPULATIVE_ONLY_FOR[t.kind]?.includes(t.skill) ?? true)
export const ceilingFor = (t: Task) => isProduction(t) ? 5 : KINDS[t.kind].guessP(t) >= 0.5 ? 2 : 3
```

Konsekvenser:
- `sortOrder` skal have ≥4 kort for at tælle som produktion.
- `fillSlots` kræver `paletᵏ ≥ 9`.
- `colorParts` er aldrig produktion ved n ≤ 7. Derfor har `fractionShape` produktions-kinden `fillSlots` (tæller og nævner).

Test: for 1.000 seedede opgaver pr. (skill, kind) beregnes guessP, og `ceilingFor` skal være ≤ 3 over grænsen. Hver skill skal have mindst én kind, der er produktion for mindst 90 % af sine instanser.

### 3.4 Brugbarhed for børn der ikke kan læse

- Opgaven læses automatisk op. Knappen "Hør igen" (øre-ikon) er altid synlig.
- **Intet langt tryk.** Svarkort med `optionView ∈ {unitWord, relation, token}` har piktogram og `optionClips`. Mulighederne læses op i rækkefølge, og hvert kort pulserer, mens det nævnes.
- Tal-, ur-, mønt-, figur- og brøkkort læses aldrig op, fordi det er dem, opgaven tester.
- Hver kind har en demo med en ghost-hånd på 3–5 s. Den kører automatisk de 2 første gange pr. profil, og knappen "Vis mig" (hånd-ikon) er altid der.
- Kind-instruktionen læses i lang form de første 3 gange pr. profil og derefter i kort form.
- Når tilstanden har været gyldig og uændret i 3 s, pulserer flueben-knappen og siger "Tryk på fluebenet, når du er færdig."
- `SpokenText({clip})`-komponenten er obligatorisk. En Vitest-scan af `src/ui/screens/child/**` og `src/ui/task/**` fejler ved rå JSX-tekstliteraler.
- Svarkort har `-webkit-touch-callout:none`, `user-select:none` og `touch-action:manipulation`. Trækflader har `touch-action:none` og pointer capture.

### 3.5 Fejlflow (låst valg)

1. Barnets svar bliver stående, overstreget og ikke trykbart.
2. `StrategyHint` vises og læses op. Hvis `errorTag` for det aktuelle svar er et `MisconceptionId` med et specifikt hint, bruges det. Ellers vises skillens standardstrategi. Et flag påvirker aldrig hintet.
3. Barnet trykker på én stor knap "Tryk på 13" (oplæst). For `clockSet` og `pay` vises ét kort med det rigtige ur eller den rigtige møntbakke. Bekræftelsen logges ikke som svar.
4. Opgaven genindsættes 2 pladser senere med `retryOf` (V1-mekanikken). Et gensvar ændrer aldrig boksen, tæller ikke i nøjagtighed eller hurtig-andel og er aldrig mulighed eller bevis for en misforståelse.

**Lyspære:** Efter 10 s uden input pulserer lyspæren. Den åbner aldrig af sig selv. Tryk viser stilladset.
- Et svar efter hjælp logges med `assisted: true`.
- Det giver perler og æg-varme.
- Det ændrer ikke boksen, tæller ikke som første forsøg og er ikke bevis for en misforståelse.

---

## 4. Diagnostik af misforståelser (`src/engine/misconceptions.ts`)

### 4.1 Klassifikation

```ts
export function classifyError(def: SkillDef, fact: Fact, given: AnswerValue): ErrorTag {
  const hits = def.candidates(fact).filter(c => c.value === given).map(c => c.tag)
  const mis = [...new Set(hits.filter(isMisconceptionId))]
  if (mis.length === 1) return mis[0]
  if (mis.length > 1) return 'ambiguous'
  if (hits.length) return hits[0]                 // 'near' | 'operand' — stop her
  return globalChecks(def, fact, given) ?? 'other'
}
```

`globalChecks` finder kun `digitSwap` i to tilfælde:
- i `hear20`, `hear100`, `hear1000`, `tensOnes` og `placeValue1000`,
- på keypad-svar ≥ 13 med to forskellige cifre, som ikke også er en operand.

Test: `classifyError(add100Carry, a100c:38+45, 38) === 'operand'`.

**Valgopgaver:** 3 kort, nemlig det rigtige, 1 diagnostisk distraktor og 1 `near`. Den diagnostiske distraktor roterer til den misforståelse, profilen sjældnest har fået tilbudt (`offeredTags`).

**Entydighed:** Hvis en værdi har to misforståelses-tags, bliver den `ambiguous` og tæller aldrig. Der testes over alle facts og 200 instanser pr. familie.

### 4.2 Katalog (31)

Hver misforståelse har felterne `nature`, forældretekst og `homeTip`.

| Nature | Id'er |
|---|---|
| concept | `concatNumberWords`, `zeroPlaceholder`, `faceValue`, `addsPlaceParts`, `forgotCarry`, `smallerFromLarger`, `borrowNoDecrement`, `placeMisalign`, `mulAsAdd`, `equalsAsAnswer`, `halfPastNext`, `quarterDirection`, `handsSwapped`, `firstDigitCompare`, `coinsAsCount`, `rulerEnd`, `lengthByEnd`\*, `sizeIsWeight`\*, `unequalParts`\*, `prototypeOnly`\*, `biggerDenominator`, `denominatorAsAnswer`, `areaAsPerimeter`, `tensZero`, `digitComplement10` (ny: 100−37→73), `digitSwap` (kun i hear\*, tensOnes og placeValue1000) |
| slip | `tableNeighbour`, `countFromFirst`, `hourHandMisread`, `skipStepOne`, `wrongOperation`, `digitSwap` (alle andre skills) |

\* betyder perceptuel (kontrastregel, se 4.3). `natureFor(id, skill)` afgør `digitSwap`. Kandidatformler og skills følger pædagogik-forslaget §3.2, og `digitComplement10` er tilføjet i `missingPart100/toHundred` og `sub100Borrow/fromTen`.

### 4.3 Hvornår appen tør konkludere

Vinduet er 30 læringsdage. Følgende svar udelades: `retry`, `assisted`, `placement`, `audioUnverified` og guldæg.

- **Mulighed** i: en opgave, hvor M ∈ `detectable`. Det vil sige, at M's kandidat var tilbudt, eller at det var en produktionsopgave i en skill, der kan afsløre M.
- **Vægt:** produktionstræf 1,0, valgtræf 0,5, trueFalse 0,25.
- **pGuess:** 0 for produktion, 1/antal kort for choice, 0,5 for trueFalse.

**Standardflag** kræver alle seks betingelser:
1. Σvægt ≥ 3,0.
2. Træf på ≥ 3 forskellige facts.
3. Træf på ≥ 2 læringsdage.
4. Rate ≥ min(0,9; gennemsnitlig pGuess + 0,35).
5. Hvis skillen har en produktions-kind: ≥ 2 produktionstræf.
6. Valgtræf tæller ikke, hvis nøjagtigheden på første forsøg i skillen er under 40 % over de sidste 20 svar.

**Særregler:**
- `countFromFirst`: Σvægt ≥ 4,0, og ≥ 70 % af plus/minus-fejlene i vinduet har den forventede retning.
- **Perceptuelle** misforståelser kræver ≥ 6 konflikt-opgaver og ≥ 6 kongruente opgaver. Nøjagtigheden på de kongruente skal være ≥ 80 %, og misforståelses-svaret skal udgøre ≥ 60 % af konflikt-opgaverne.

**Løst:** efter flaget ≥ 6 nye muligheder, hvoraf ≥ 5 er rigtige, og intet bevis i de sidste 6.

**Visning:**
- Barnet ser aldrig et flag.
- Forældre ser concept-flag som "Vi har set tegn på …" (højst 2).
- Slips vises samlet under "Typiske fejl lige nu" med neutral tekst, fx "7-tabellen: svarer tit med nabotallet – det er normalt, mens tabellen sætter sig."
- Flaget (concept eller slip) styrer den målrettede plads i roundBuilder.

**Animerede hints** laves for 8 misforståelser: digitSwap, forgotCarry, smallerFromLarger, borrowNoDecrement, equalsAsAnswer, halfPastNext, tableNeighbour og concatNumberWords. De øvrige får et oplæst specifikt hint plus standardvisualet.

**Fixture-tests:**
- En tilfældig gætter giver 0 flag over 500 svar pr. skill.
- Et konsekvent sizeIsWeight-barn flagges inden 20 konflikt-opgaver.
- 1 session flagger aldrig.
- 50 % tilfældige ±1-fejl giver aldrig `countFromFirst`.

---

## 5. Verden, progression og økonomi

### 5.1 Mestring (`src/engine/mastery.ts`)

```ts
interface KeyState { box: 0|1|2|3|4|5; seen: number; correct: number; lastRound: number; lastDay: string
  boxDay: string; boxAt: number; avgMs: number; recent: string[]; pendingInstance: string | null; seeded: boolean }
const DUE_ROUNDS = [0, 1, 2, 4, 8, 16]; const DUE_DAYS = [0, 0, 0, 1, 3, 7]   // due når begge er opfyldt
export const learningDay = (ts: number) => localDate(ts - 4 * 3600_000)   // Intl.DateTimeFormat('sv-SE')
```

**Promovering** kræver et rigtigt svar, der er hurtigt (`ms ≤ fastMs`), og at `box < ceilingFor(task)`. Desuden:
- **Boks 4:** produktion, `learningDay > boxDay` og ≥ 8 t siden `boxAt`.
- **Boks 5:** produktion, ≥ 3 læringsdage efter boks 4 og ≥ 8 t.
- **Procedure-familier:** hver promovering kræver 2 hurtige, rigtige svar på to forskellige instanser, som ikke findes i `recent` (de sidste 5). Den første gemmes i `pendingInstance`. Instanser trækkes seedet og undgår familiens sidste 10.

**Øvrige regler:**
- En fejl giver −2 (gulv 0).
- Gensvar, assisterede svar og bekræftelser ændrer intet.
- Guldægget påvirker kun boksen ved rigtigt svar.
- Der er intet forfald ved fravær.

Test med fake clock:
- 23:50 → 00:10 promoverer ikke.
- Sommertidsskiftet 2026-10-25 (Europe/Copenhagen) håndteres.
- En simuleret profil når boks 5 tidligst på dag 5.

### 5.2 Skill-status og medaljer

Medaljer er permanente (`profile.skillMedals`). Dashboardets status kan falde, medaljen kan ikke.

| Status | Medalje | Krav |
|---|---|---|
| Ikke startet | – | 0 forsøg |
| Øver | – | set mindst én gang |
| Kan med støtte | bronze | ≥ 70 % af nøglerne i boks ≥ 2 (seedede nøgler tæller først, når de er bekræftet) |
| Sølv | sølv | ≥ 50 % af nøglerne i boks 4–5, samt ≥ max(8, nøgler) rigtige produktionssvar på ≥ 2 læringsdage |
| Kan selv | guld | ≥ 80 % af nøglerne i boks 4–5, samt ≥ max(12, 2 × nøgler) rigtige produktionssvar på ≥ 3 læringsdage |

### 5.3 Verdener og regioner

Alle verdener, regioner og noder ligger i `src/content/curriculum.ts`.

**Node-skabelon pr. region:** `l1 → l2 → friend|chest → l3 → mix → trial`. Node-id er `${regionId}-${slot}`. Hver verden slutter med `${world}-finale`. Det giver 28 × 6 + 4 = **172 noder**.
- `l1` og `l2` introducerer skills (første og anden halvdel af regionens skills, valgtunge).
- `l3` "Skriv selv" giver produktion fra boks ≥ 1.
- `mix` er 7 opgaver fra regionen og 3 review-opgaver.

**Kæder** afgør de hårde forudsætninger:
- `tal`: number, place, addsub, muldiv, algebra.
- `figurer`: shapes, fractions.
- `klokken`.
- `pengeMaal`: money, measure.

Et `requires` peger altid på en region i samme kæde (test).

| Verden (kl.) | # | RegionId | Navn | Skills | Kæde | requires | Node 3 |
|---|---|---|---|---|---|---|---|
| `eng` Engdalen (0) | 1 | w0-tal10 | Tællelunden | count10, hear20 (≤10), order20 (≤10) | tal | – | ven: kanin |
| | 2 | w0-former | Formhaven | shapes2D basic, patterns, compareLength | figurer | – | kiste |
| | 3 | w0-plus10 | Plusengen | addTo10 | tal | – | ven: kat |
| | 4 | w0-tal20 | Tyvestien | count20, hear20, order20 | tal | – | kiste |
| | 5 | w0-minus10 | Minusbækken | subTo10 (+ addTo10 som review) | tal | w0-plus10 | ven: hvalp |
| | 6 | w0-tiervenner | Tiervennernes hule | tenFriends | tal | – | ven: pindsvin |
| `bakke` Hestebakkerne (1) | 1 | w1-tal100 | Hundredemarken | hear100, tensOnes, order100, numberLine100 | tal | – | ven: hest |
| | 2 | w1-dobbelt | Dobbeltdalen | doubles, halves, skipCount (step2, step5, step10, step10offset, back10) | tal | – | kiste |
| | 3 | w1-tieren | Tyvebroen | addSub20Simple, addTo20, subTo20, missingPart10 | tal | – | ven: lam |
| | 4 | w1-figurer | Formværkstedet | shapes2D squareRect og polygons, sidesCorners, shapes3D names, sortShapes (3/4/0 hjørner), symmetry isSymLine, halfShape | figurer | – | kiste |
| | 5 | w1-klokken | Urtårnet | clockHour, clockHalf | klokken | – | ven: ræv |
| | 6 | w1-tiere | Tierhoppet | tens100, add100NoCarry, sub100NoBorrow | tal | w1-tal100 | kiste |
| | 7 | w1-maal-penge | Målebakken | measureUnits, rulerRead from0, weightCompare, coinNames, countCoins (≤20) | pengeMaal | – | ven: hamster |
| `skov` Regnbueskoven (2) | 1 | w2-tal1000 | Stortalsbjerget | hear1000, placeValue1000 (uden regroup), order1000, numberLine1000 (placering) | tal | – | ven: enhjørning |
| | 2 | w2-veksling | Vekselvandet | add100Carry, sub100Borrow, missingPart100, inverseOps (+/−) | tal | w1-tiere | kiste |
| | 3 | w2-gange | Gangegrotten | groupsOf, mul2510, shareEqually | tal | – | ven: panda |
| | 4 | w2-klokken | Urtårnets top | clockQuarter | klokken | w1-klokken | kiste |
| | 5 | w2-penge | Købmandsgården | countCoins (≤100, biggestFirst), payExact (to20/50/100), change (10/20/50) | pengeMaal | w1-maal-penge | ven: egern |
| | 6 | w2-hundreder | Hundredebroen | addSub1000Round, skipCount step100, equalSides (trueFalse, balanceAdd) | tal | w2-tal1000 | kiste |
| | 7 | w2-maal-data | Linealstien | rulerRead offset, unitChoice (længde), readChart | pengeMaal | – | ven: ugle |
| | 8 | w2-figurer | Figurhaven | composeShapes, symmetry mirrorGrid, shapes3D props, sortShapes fourEqualSides, fractionShape (1/2, 1/3, 1/4, 2/4) | figurer | w1-figurer | kiste |
| `fjeld` Stjernefjeldet (3) | 1 | w3-tabellen | Tabeltoppen | mul34, mul6to9, mulTens | tal | w2-gange | ven: pegasus |
| | 2 | w3-store-tal | Trecifret bro | add1000, sub1000, numberLine1000 (afrunding), placeValue1000 regroup | tal | w2-hundreder | kiste |
| | 3 | w3-klokken | Minuttårnet | clockFive, clockDigital, clockElapsed | klokken | w2-klokken | ven: drage |
| | 4 | w3-division | Delekløften | div2510, divAll, inverseOps mulToDiv, equalSides balanceSub og balanceMixed | tal | w3-tabellen | kiste |
| | 5 | w3-penge-maal | Markedet | change from100, kronerOre, convertCmM, unitChoice (vægt), payExact fewestCoins | pengeMaal | w2-penge | ven: pingvin |
| | 6 | w3-areal | Arealhaven | area, gridCoords, sortShapes rightAngle, skipCount step25 | figurer | – | kiste |
| | 7 | w3-broeker | Brøkbageriet | fractionOfSet, fractionCompare, fractionShape (3/4, 2/3) | figurer | w2-figurer | ven: isbjørn |

Test: alle 72 skills er placeret mindst én gang.

**Oplåsning** (ren funktion i `src/meta/unlock.ts`):
- **Node:** forrige node er spillet én gang.
- **Region:** verdenen er åben, og alle `requires` er opfyldt. Et krav er opfyldt, når prøven er bestået, hjælpebroen er åben (3 mislykkede forsøg), eller forælder/indplacering har åbnet regionen. Derudover gælder én af to betingelser:
  - regionen er blandt verdenens 2 første (i tabellens rækkefølge),
  - en region i samme verden har ≥ 4 spillede noder.
- **Verden:** den næste verden åbner, når ≥ 60 % af den nuværende verdens prøver er bestået, eller alle dens noder er spillet én gang. Forælder og indplacering kan også åbne.
- **Blandet øvelse** er altid åben. Det er en tur bygget af "due" nøgler fra alle oplåste skills. Den giver perler og XP, men ingen stjerner.
- **Træningshytte:** efter en mislykket prøve lyser en hytte op ved porten. Den giver en tur med de missede familier.
- Reglen "højst én åben prøve" bruges ikke.

Test: for hver kæde K gælder, at ingen prøve uden for K kan låse en region i K.

### 5.4 Turen (`src/engine/roundBuilder.ts`, `src/state/useRound.ts`)

- **Størrelse:** 10 opgaver. Regionerne w2-veksling, w2-penge, w3-store-tal, w3-klokken og w3-penge-maal har 8.
- **Slots:**

  | Slot | Antal | Kilde |
  |---|---|---|
  | Åbner | 1 | boks ≥ 3, ellers laveste rank |
  | Vaklende | 5 | boks 0–2 (seen), "due" først |
  | Nye | 2 | usete nøgler i rank-rækkefølge, loft 8 pr. skill og 20 pr. læringsdag |
  | Review | 1 | "due" nøgle med boks ≥ 3 fra en anden oplåst skill |
  | Målrettet | 1 | flagget misforståelse, ellers vaklende |

- **Træthed:** hvis nøjagtigheden på første forsøg over de sidste 10 er under 50 %, bliver næste tur 4 sikre, 5 vaklende og 1 ny, uden review og med valgtunge kinds. Der kommer aldrig et pauseforslag.
- **Varm tur:** efter 10/10 hurtige svar bliver næste tur 1 sikker, 4 vaklende, 4 nye og 1 review.
- **Rækkefølge:**

  | Position | Indhold |
  |---|---|
  | 1 | Åbneren (choice) |
  | 2–4 | Opvarmning |
  | 5–7 | Top: nye opgaver og produktion |
  | 8–9 | Opbygning |
  | 10 | Den næstsikreste nøgle, aldrig ny |

  Samme nøgle kommer aldrig to gange i træk. Der er højst 3 opgaver i træk med samme regneart i blandede noder. `balanceAnswerPositions` beholdes fra V1.
- **Kind-valg:**
  - boks ≥ 3 (i `l3` boks ≥ 1) giver en produktions-kind,
  - ellers nodens hovedkind, og 35 % af gangene en af de andre,
  - prøve og indplacering bruger kun produktion,
  - uden bekræftet lyd udelades `hear*`-familier.
- **Guldæg:** som i V1. Det kommer efter 3 rigtige i træk, én gang pr. tur, aldrig som sidste opgave og altid med mulighed for at springe over.
- **Mesterprøve:**
  - 10 opgaver, kun produktion, stratificeret over regionens skills og familier.
  - Intet stillads, ingen genindsættelse og ingen tempokrav.
  - Strategi og bekræftelse vises stadig efter fejl.
  - Bestået ved ≥ 8/10 rigtige i første forsøg.
  - Hvert rigtigt svar lægger en planke, og 8 planker betyder at broen holder. Planker gemmes ikke mellem forsøg. Skærmen viser "Bedst: 7 planker".
  - Genforsøg kræver én almindelig tur siden sidste forsøg.
  - Kan tages som "Spring over" fra regionens start. Bestås den, markeres noderne `skipped`, og ven- og kistenoder kan stadig hentes.
  - En ikke-bestået prøve vises som "Klar, når du er".
- **Finale:** 12 blandede produktionsopgaver fra verdenen. Bestået ved ≥ 10.
- **Pause og genindlæsning:** ✕ pauser (V1's `pause`/`resume`, og `askedAt` nulstilles ved resume). Et snapshot af turen skrives ved hvert svar. En genindlæsning genoptager samme opgave og samme kø.

### 5.5 Stjerner (første gang pr. niveau pr. node)

| Stjerner | Krav |
|---|---|
| 1 | Turen er gennemført |
| 2 | Højst 2 fejl i første forsøg |
| 3 | Højst 1 fejl og mindst 3 produktionssvar i turen (ingen hastighed) |

For mesterprøver gælder: bestået giver 1 stjerne, højst 1 fejl giver 2, og 0 fejl giver 3.

### 5.6 Regionens farve

`regionTier` er det højeste T, hvor mindst 50 % af regionens skills har status ≥ T.

| Tier | Udseende |
|---|---|
| Start | pastel, aldrig grå |
| Bronze | stien lyser, lanterner tændes |
| Sølv | blomster, vand og lys kommer tilbage |
| Guld | fuld mætning, og regionens dyr går rundt |

Farveskiftet sker med OKLCH-kromaskalering i `palette.ts` plus op til 3 rekvisitlag, der slås til.

### 5.7 Økonomi (`src/content/economy.ts`)

Filen er ren og deterministisk. `Date` må ikke forekomme (lint).

**Perler** kan kun optjenes, aldrig købes eller veksles. De tegnes som glasperler, aldrig mønter.

| Hændelse | Perler | XP |
|---|---|---|
| Rigtigt svar (også gensvar og assisteret) | 1 | 10 |
| Ny stjerne på en node (første gang pr. niveau) | 1 / 1 / 2 | 20 pr. stjerne |
| Mestringsgnist: nøgle når boks 3 | 1 | 25 |
| Mestringsgnist: nøgle når boks 5 | 2 | 50 |
| Guldæg fanget | 2 (+10 æg-varme) | 10 |
| Mesterprøve bestået første gang | 10 | 100 |
| Finale bestået | 25 | 250 |
| Level-up | 5 | – |
| Medalje bronze / sølv / guld | 3 / 5 / 10 | 50 / 100 / 200 |
| Trofæ | 5 / 10 / 15 | – |

**XP til næste niveau:**

| Niveau | XP pr. niveau | Kumuleret ved båndets slutning |
|---|---|---|
| 1–4 | 150, 250, 300, 450 | niveau 5 = 1.150 |
| 5–9 | 500 | niveau 10 = 3.650 |
| 10–19 | 1.000 | niveau 20 = 13.650 |
| 20–29 | 2.800 | niveau 30 = 41.650 |
| 30–49 | 6.400 | niveau 50 = 169.650 |

**Titler:**

| Niveau | 1 | 5 | 10 | 15 | 20 | 30 | 40 | 50 |
|---|---|---|---|---|---|---|---|---|
| Titel | Nybegynder | Opdager | Eventyrer | Talspejder | Regnemester | Talmagiker | Stjerneregner | Talvenne-legende |

**Priser** er faste, uden rotation og uden udsalg:

| Hvad | Pris |
|---|---|
| face, neck | 80 |
| head, hand | 120 |
| body, back | 180 |
| Butikssæt i alt | 760 (4 sæt = 3.040) |
| Omfarvning | 25 pr. farve, 2 ekstra farver pr. ejet genstand (74 × 2 × 25 = 3.700) |
| Pynt (8 genstande) | 40, 40, 80, 80, 80, 150, 150, 150 (= 770) |

Det samlede forbrug er cirka 7.500 perler.

**Rugeæg:** ét æg ad gangen, og barnet vælger arten blandt de oplåste.

| Æg nr. | 1 | 2 | 3 | 4–9 | 10+ |
|---|---|---|---|---|---|
| Varme (rigtige svar) | 15 | 40 | 60 | 90 | 120 |

- Racen og farven vælges seedet blandt dem, barnet ikke ejer. Alle er lige meget værd, og der er ingen sjældenhedsstige.
- Når alt er fundet for en art, bliver arten grå i vælgeren.
- Når alt er fundet for alle arter, giver varmen +50 venskab til buddyen.

**Ønske:** barnet sætter en nål i én genstand. HUD'en viser fremgang mod den som en bjælke uden tal.

**HUD i turen:** kun sten-sti, buddy og kombo-effekter. Ingen valutatal. Perler og XP tælles op efter kortet "Det lærte du". Formuleringer som "kun N til …" er forbudt (scan).

**HUD på kortet:** tre visuelle målere uden tal (æg, ønske, buddy-hjerte). Niveau og titel vises på profilkortet og ved level-up.

**Kombo (kun juice):**

| Rigtige i træk | Effekt |
|---|---|
| 1 | Poteaftryk lyser |
| 3 | Guldægget |
| 5 | Buddyen superdanser |
| 10 | Banneret "Perfekt tur!" |

**Belønningskadence** (acceptkrav i `economy.sim.test.ts`). Barnet svarer 85 % rigtigt, spiller 5 ture pr. session og består 70 % af prøverne:

| # | Krav |
|---|---|
| 1 | Session 1 (onboarding og 3 ture): starter-dyr, ≥ 1 klækning, ≥ 2 ting, niveau ≥ 3, perler ≥ 50 |
| 2 | Session 1–10: ≥ 3 belønningshændelser og ≥ 1 stor ceremoni pr. session |
| 3 | Session 11–40: ≥ 1 stor ceremoni pr. session. Aldrig mere end 4 ture uden en belønningshændelse |
| 4 | Niveau 10 i session 3–7, niveau 20 i session 12–24, niveau 50 ikke før session 150 |
| 5 | Butik, omfarvning og pynt kan ikke tømmes før session 100 |
| 6 | Et barn med 50 % rigtige får ≥ 70 % af perlerne pr. tur, som barnet med 85 % får |
| 7 | 20 genspil af en node med 3 stjerner giver ≤ 12 perler pr. tur |
| 8 | Ingen skill når guld med < 12 produktionssvar eller på < 3 dage |
| 9 | En gætter med 33 % rigtige kan aldrig nå mestringsgenstande |

Konstanterne må justeres ±20 % for at opfylde kravene.

### 5.8 Ceremonier (`src/meta/ceremonyQueue.ts`)

**Rækkefølge:** "Det lærte du" (nøgler der rykkede sig, fx "8+5 sidder fast nu!", plus ét næste mål) → stjerner → perler/XP → prøve/tåge → medalje → level-up → vækst → ting → klækning altid sidst.

**Regler:**
- Højst 3 i fuld skærm pr. tur-slut. Resten lægges som "Også i dag"-kort.
- Tur-slut varer højst 6 s, højst 12 s med klækning.
- Alt kan springes over med et tryk, og intet blokerer input i mere end 1 s.
- Knapperne "Næste" og "Til kortet" er lige store, ingen har fokus som standard, og der er ingen auto-start.

**Varigheder:**

| Ceremoni | Varighed |
|---|---|
| Level-up | 2,5 s |
| Klækning | 3 tryk, cirka 5 s |
| Ny ting | 1,5 s + "Prøv den" (buddyen kigger sig i et spejl) |
| Medalje | 2 s |
| Vækst | 3 s |
| Prøve | Planker og tåge der letter |

---

## 6. Dyr

### 6.1 Roster (16 arter)

Racer giver brugerens ønskede ekstra kaniner, heste, katte og enhjørninger.

| Art | Verden | Krop | Racer (3 for favoritterne) | Signatur-idle |
|---|---|---|---|---|
| rabbit | eng | round | `upright` (stående ører), `lop` (vædder), `lionhead` | næse-vip |
| cat | eng | round | `domestic`, `longhair`, `mainecoon` (øredusker) | halekrølle |
| puppy | eng | tall | `std` | hovedet på skrå |
| hedgehog | eng | pear | `std` | pigge der pjusker |
| horse | bakke | tall | `shetland`, `fjord` (blakket, stribet manke), `arabian` | manke-kast |
| lamb | bakke | round | `std` | øre-flop |
| fox | bakke | tall | `std` | hale-svip |
| hamster | bakke | round | `std` | kind-pust |
| unicorn | skov | tall | `foal` (kort lok), `wavy` (bølgemanke), `starhorn` | hornet glimter (opacity) |
| panda | skov | round | `std` | pote-vink |
| squirrel | skov | pear | `std` | hale-svirp |
| owl | skov | pear (ægform) | `std` | hoved-drej |
| pegasus | fjeld | tall | `std` | vinge-blafren |
| dragon | fjeld | tall | `std` | lille røgpust (cirkler) |
| penguin | fjeld | pear | `std` | vinge-klap |
| polarbear | fjeld | round | `std` | snuse-næse |

**Samleobjekt** = (art, race, farve). Der er 24 racer × 6 naturlige farver = 144, plus `gold` og `rainbow` pr. art (32) og `starwhite` (kun Stjernefølet). I alt 177.

**Racer** låses op, når barnet ejer 2 dyr af den forrige race. Samlebogen viser og læser op: "Klæk 2 kaniner mere for at møde vædderkaninen."

### 6.2 Sådan får barnet dyr

1. **Starter** ved onboarding: kanin, kat, hvalp eller føl (hest `shetland`).
2. **Ven-noder** (16) låser arten op til æg og giver første dyr. Ejer barnet allerede arten, giver noden en ny farve eller race.
3. **Rugeæg** (5.7).
4. **Mestring:**
   - Første guldmedalje giver **Stjernefølet** (enhjørning `foal`, `starwhite`). Kortet teaser det fra dag 1.
   - Hver guldmedalje derefter lader barnet vælge ét gyldent dyr blandt de 4 arter i medaljens verden. Når alle 4 er gyldne, giver en guldmedalje 10 perler.
   - 3 stjerner på alle noder i en region lader barnet vælge ét regnbuedyr fra verdenen (højst 4 pr. verden).

### 6.3 Venskab og vækst

Venskab = rigtige svar, mens dyret er buddy, +3 pr. mestringsgnist. Barnet kan skifte buddy frit.

| Niveau | Kumuleret | Belønning |
|---|---|---|
| 2 | 20 | Trick: hop |
| 3 | 50 | Eget jubel |
| 4 | 100 | Trick: snurre |
| 5 | 170 | Vokser: baby → ung |
| 6 | 260 | Artens kald (syntetiseret signaturlyd 0,4–0,8 s) |
| 7 | 370 | Signaturtrick (fx hesten stejler, enhjørningen laver en regnbuebue) |
| 8 | 500 | Vokser: ung → stor |
| 9 | 650 | Trick: dans |
| 10 | 820 | Stjerneform: aura-lag og hjertet "Bedste ven" |

Barnet vælger selv, hvilken form der vises, blandt de nåede.

**Navngivning:**
- 6 oplæste forslag fra `names.ts` (120 danske dyrenavne pr. art, uden varemærker).
- Fri tekst på højst 14 tegn, læst op med `speechSynthesis`.
- Barnet kan omdøbe når som helst.

**Aldrig skyld:** ingen sult, sygdom, tristhed eller savn og ingen pleje-mekanik. Ved app-start hilser dyret altid med `wave` → `happy`.

### 6.4 Rig (`src/art/rig/`)

- **Kanvas** `viewBox 0 0 200 240`, jordlinje y = 226, sikker zone x 6–194 og y 4–234.
- **Ankre:** tabellen fra kunst-forslaget §2.1 er standard for stadie 2/`round`. `computeAnchors(species, breed, stage)` returnerer det endelige sæt.
- **Kropsskabeloner** (`bodies.ts`):
  - `round`: rabbit, cat, hamster, panda, lamb, polarbear.
  - `pear`: penguin, squirrel, hedgehog, owl, Pip.
  - `tall`: horse, unicorn, pegasus, puppy, fox, dragon.
- **Stadier** skaleres om fodpunktet, og ankrene følger med:

  | Stadie | Transformation |
  |---|---|
  | 1 (baby) | hoved ×1,08, krop ×0,85, øjne ×1,15, figur ×0,86 |
  | 2 (ung) | standard |
  | 3 (stor) | hoved ×0,96, krop ×1,08, manke og hale ×1,3, horn ×1,25, vinger ×1,2 |
  | Stjerneform | aura- og fx-lag på stadie 3 |

- **Stil:**
  - Flad cel-skygge: grundfarve, halvmåne i `shade`, 1–2 højlys i hvid med 40 % alfa.
  - Farvet kontur på 3,2 enheder.
  - Kun jordskyggen har en radialGradient. Regnbuemanken er den eneste statiske gradient på et væsen.
- **Farver** (`palette.ts`, OKLCH → sRGB) afledes fra `fur`:
  - `outline` = L×0,55, C×1,1.
  - `shade` = L−0,08, h−5.
  - `belly` = L+0,12 (maks 0,97), C×0,4.
  - Rå hex-værdier findes kun i palettefilerne (lint).
- **Primitiver** (`shapes.ts`): `superellipse`, `blob(points, tension)` og spejlede bezier-hjælpere. Frihånds-path-strenge er forbudt i artsfiler (lint: ingen `d="`-literal over 40 tegn uden for `shapes.ts`).
- **Lagorden (17):** shadow → back-item → wings/tail → feet → body + pattern + shade → body-item (klippet) → hand-item → paws → neck-item → mane-back → head + pattern + shade → face → face-item → mane-front → head-item → ears/horn → fx.
- **Delebibliotek:**
  - Husets dele (`src/art/parts/house.tsx`): øjne `open/happy/closed/half/sparkle`, munde `smile/cat-w/open-D/o/wobble`, kinder. Delene fryses ved G1.
  - Artsspecifikke dele ligger i `src/art/species/<id>.tsx`.
- **Moods:** `idle`, `happy`, `cheer`, `think`, `oops`, `sleep` og `wave`, plus blink og earTwitch, der altid kører. `sad` findes ikke; det sikres af en typetest og en tekst-scan.
- **Pivot-mønster:** `<g transform="translate(px py)"><g class="p-ear">…lokale koordinater…</g></g>` med `transform-origin: 0 0`. Kun `transform` og `opacity` animeres. Filtre, masker, `<image>`, `<text>` og `foreignObject` er forbudt i art.
- **Øjne følger fingeren:** pupillen flyttes højst 3 enheder, lerp 0,2 pr. rAF. Gælder kun buddyen.
- **Budgetter:**
  - ≤ 90 elementer pr. (art, race, stadie) og ≤ 25 pr. genstand.
  - Kun buddyen og højst 2 andre dyr pr. skærm animerer dele. Alle andre renderes én gang til `<img src={blobUrl(serializedSvg)}>` og animeres som helt element.
  - ≤ 1.500 SVG-elementer i DOM pr. skærm (Playwright-test).

---

## 7. Garderobe

### 7.1 Slots og pasform

**Slots:** `head`, `face`, `neck`, `body`, `back` og `hand`. Pegasus, drage og ugle har `occupies: ['back']`, så slottet er låst, og UI'et viser et ikon.

**Genstandsdefinition** (`src/art/items/<set>/<id>.tsx`):

```ts
interface ItemDef { id: ItemId; set: SetId; slot: Slot; nameClip: ClipId
  source: { kind: 'level'; level: number } | { kind: 'chest'; nodeId: NodeId } | { kind: 'finale'; world: WorldId }
        | { kind: 'medal'; tier: 'silver' | 'gold'; count: number } | { kind: 'shop'; price: 80 | 120 | 180 }
  colorways: [Colorway, Colorway, Colorway]       // 0 = standard, 1–2 = omfarvning
  art: { front: ItemArt; back?: ItemArt; bodyShapes?: Record<'round'|'pear'|'tall', ItemArt> }
  fit: { anchor: AnchorName; scaleBy: 'headWidth'|'bodyWidth'|'neckWidth'|'fixed'; baseScale: number; baseWidth: number
         earMode?: 'through' | 'under'; overrides?: Record<string, { dx?: number; dy?: number; scale?: number; rot?: number }> }
  hides?: ('mane-front' | 'ears')[] }
```

Feltet `tier` findes ikke (test). Kortets rammefarve afledes af `source.kind`: mestring giver guldramme, de øvrige kilder har hver deres ikonbadge.

**Fit-algoritme** (`src/art/rig/fit.ts`, ren funktion):
1. Skalér: `s = baseScale × anchors[scaleBy] / reference`.
2. Ved `earMode: 'under'`: `s = min(s, earGap × 1,15 / baseWidth)`. Ører og horn ligger over hatten.
3. Kropstøj klippes til artens body-path, udvidet 2 enheder, og konturen streges igen.
4. Hver kropsgenstand har 3 grundformer, én pr. kropsskabelon.
5. Håndgenstande sidder ved `pawR` med `handRot`. Poten tegnes over håndtaget, undtagen for en genstand med `art.over` (A17), der tegnes foran poten.
6. Øjenregel: intet dækker øjnene. Briller har glas med ≤ 25 % opacitet (bbox-tjek).
7. Højst 10 % af (genstand, art)-par må have en override.

### 7.2 Katalog: 74 genstande (11 sæt à 6 + 8 milepæle)

| Kilde | Sæt og genstande |
|---|---|
| Spillerniveau | **Hverdag** (6) på niveau 2, 3, 4, 6, 7 og 8 |
| Spillerniveau | **Milepæle** (8): 5 hjertebriller (face), 10 regnbuehue (head), 15 superheltekappe (back), 20 medaljehalskæde (neck), 25 glimmerbluse (body), 30 kæmpeslikkepind (hand), 40 fe-vinger (back), 50 Legendekronen (head) |
| Kister og finale | **Opdager** (eng): kister head og hand, finalen face, neck, body og back |
| Kister og finale | **Rytter** (bakke): kister head, face og hand, finalen neck, body og back |
| Kister og finale | **Kongelig** (skov): kister head, face, neck og hand, finalen body og back |
| Kister og finale | **Astronaut** (fjeld): kister head, face og hand, finalen neck, body og back |
| Mestring, sølv | **Ridder**: efter 2, 5, 9, 14, 20 og 27 sølvmedaljer |
| Mestring, guld | **Talmagiker**: efter 1, 3, 6, 10, 15 og 21 guldmedaljer |
| Butik | **Pirat**, **Fodbold**, **Vinter** og **Fest**, 6 hver |

- Kistens indhold vises på kortet på forhånd.
- Hver genstand har præcis én kilde og en oplæst "Sådan får du den".
- Et komplet sæt giver et trofæ og en guldramme på Samlebogens side.

---

## 8. Profiler, onboarding og indplacering

- **Profiler:** højst 6 (håndhæves i `src/data/repo/profiles.ts`). Hver profil har en fast rammefarve (6 farver, ingen dubletter), forbogstav og buddy med outfit på kortet.
  - `ProfilePickerScreen` vises ved hver app-start, når der er ≥ 2 profiler. Kortene står i et gitter på 2 × 3, og et tryk læser navnet op.
  - "+ Ny spiller" og "Slet" ligger bag voksen-gaten. Den første profil oprettes uden gate.
- **Voksen-gate:** 2-cifret gange 1-cifret (12–19 · 6–9), skrevet med `·`.
- **Første opstart på enheden:**
  1. `ParentIntroScreen` med 3 kort: "Læg appen på hjemmeskærmen først", "Alt bliver på enheden" og "Alle belønninger optjenes ved at regne – intet kan købes".
  2. **Lydtjek:** Pip siger "Tryk på katten" med 2 dyrekort. Ved 2 forkerte vises et illustreret kort "Tænd for lyden" og en tegning af lydløs-kontakten, og `talvennerne2.boot.audioVerified = false`.
  3. `navigator.audioSession.type = 'playback'` sættes som standard, hvor API'et findes. Forældreindstillingen "Følg lydløs-knappen" er slået fra.
- **Onboarding pr. barn (cirka 5 min):**

  | Tid | Skridt |
  |---|---|
  | 0:00 | Navn (valgfrit, ellers "Spiller N") |
  | 0:30 | Vælg den første ven (4 unger kigger ud af æg) og klæk inden for 60 s |
  | 1:15 | Navngiv vennen |
  | 1:45 | Klassetrin 0.–3. (4 store knapper) |
  | 2:00 | "Vis Pip hvad du kan" (indplacering). Springes over ved 0. kl. |
  | ca. 3:45 | Kortet zoomer ind |
  | 4:00 | Første tur |
  | ca. 6:30 | Niveau 2 med Hverdag-huen og guidet påklædning |
- **Indplacering** (`src/engine/placement.ts`):
  - Stigen L1–L14 fra pædagogik-forslaget §4.2, 2 opgaver pr. checkpoint, kun produktion, højst 18 opgaver.
  - Start ét klassetrin under barnets: 1. kl. starter ved L1, 2. kl. ved L3, 3. kl. ved L5.
  - Springfase: bestået giver i+2, ikke bestået giver i−1 og skift til trinfase. Trinfase: bestået giver i+1, ikke bestået stopper.
  - Rigtigt svar giver et neutralt "Tak!". Fejl viser `StrategyHint` og bekræftelse (låst valg), og bekræftelsen logges ikke.
  - **Seeding:** kerne-skills med `stage ≤ stage(P)` får alle nøgler sat til **boks 2** med `seeded: true`. Regioner, hvis skills alle har stage < stage(P), markeres `skipped` (åbne). Verdener åbnes tilsvarende.
  - Dashboardet viser seedede skills som "Sprunget over ved start" (stiplet prik), indtil barnet har ≥ 1 rigtigt produktionssvar i skillen. `gradeEstimate` udelader dem.
  - "Kør igen" bliver tilgængelig på dashboardet 7 dage efter.
  - Stigen vises i UI, når alle ladder-skills er registreret (bølge 3). Før det starter alle børn i Engdalen, og forælderen kan åbne verdener.
- **Adskillelse:** Intet går på tværs af profiler. Der er ingen gaver, besøg eller sammenligning. Dashboardet viser én profil ad gangen.

---

## 9. Forældre-dashboard

### 9.1 Skærme (`src/ui/screens/parent/*`, beregninger i `src/parent/*.ts` som rene funktioner)

1. **Profilvælger.**
2. **Overblik (14 dage):**
   - læringstid pr. dag og legetid (dyr/garderobe) som adskilte søjler, uden vurdering,
   - aktive dage (kalender med datoer, kun her),
   - ture, opgaver, nøjagtighed på første forsøg,
   - nuværende verden og region.
3. **Pensumkort:** rækker efter Fælles Mål-grupper og domæner, kolonner for 0.–3. kl., én prik pr. skill. Prikken har både farve og form:

   | Status | Prik |
   |---|---|
   | Ikke startet | grå ○ |
   | Øver | gul ◔ |
   | Med støtte | blå ◑ |
   | Kan selv | grøn ● |
   | Sprunget over ved start | stiplet |

4. **Domænekort (10):**
   - Antal pr. status, fx "Kan selv 3 · Med støtte 2 · Øver 1 · Ikke startet 4". Nævneren er domænets skills til og med barnets klassetrin + 1. Ingen score 0–100 og ingen sparkline for middelboks.
   - Tendens som tekst ud fra statusændringer i 14 dage: "+2 færdigheder rykket op", "1 ser ud til at være glemt".
   - Nøjagtighed i 14 dage.
   - Median svartid på produktion nu mod for 14 dage siden.
   - Tid brugt.
5. **Skill-rækker (foldes ud):** statusbadge, bjælke for andel i boks 4–5 med mærke ved 80 %, "sidst øvet", nøjagtighed, median svartid, andelen "rigtigt men langsomt" og opdeling pr. familie.
6. **Tabelgitter 10×10:** hvert produkt farvet efter boks.
7. **Misforståelser:** "Vi har set tegn på …" (concept, højst 2, med `homeTip`), "Typiske fejl lige nu" (slips) og "Ser ud til at være på plads".
8. **Anbefalinger** (højst 3, i prioriteret rækkefølge):

   | Regel | Tekst |
   |---|---|
   | R1 | concept-flag + `homeTip` |
   | R2 | "{navn} regner {label} rigtigt, men bruger stadig tid på det. Det er helt normalt – hurtighed kommer med små, hyppige gentagelser. Prøv {homeTip}." (nøjagtighed ≥ 85 %, < 40 % hurtige, ≥ 20 svar) |
   | R3 | plateau (for gange: tabellen med lavest middelboks) |
   | R4 | glemt ("Genopfrisk {label}") |
   | R5 | "kan med støtte" uden produktion i 7 dage |
   | R6 | "Klar til: {region}" |

9. **Niveau:** kun hele klassetrin, fx "Har styr på det meste af {g}. klasses stof i tal og regning" (kerne-skills med grade ≤ g: ≥ 80 % mindst "støtte" og ≥ 50 % "kan selv", seedede udeladt), plus en liste over kerne-skills, der er "kan selv". Vises kun ved ≥ 150 svar og ≥ 5 aktive dage, ellers "Vi ved endnu for lidt". Uden rød/grøn vurdering.
10. **Seneste ture og belønningslog:** hvad der er optjent og hvordan.
11. **Mesterprøver:** åbne og beståede.
12. **Indstillinger:**
    - åbn verdener/regioner, indplacering igen,
    - "Følg lydløs-knappen", effekter, rolig animation, fravalg af domæner,
    - eksport/import pr. profil, slet profil,
    - "Om oplæsningen" (CoRal-kreditering, OpenRAIL-licens og link til `lyt.html`).
13. **Udskriv rapport** (`print.css`): grupperet efter Fælles Mål, uden valuta og dyr.

**Grafer** er håndbyggede SVG-komponenter (≤ 8 KB) uden chart-bibliotek. Status-farver har altid form og label. Ét forklaringsnotat: "Kan selv kræver, at barnet skriver svaret selv på to forskellige dage."

### 9.2 Datamodel (IndexedDB `talvennerne2`, Dexie 4, `src/data/db.ts`)

```ts
db.version(1).stores({
  profiles: 'id',                                            // ProfileDoc (~150 KB)
  answers:  '++seq, [profileId+ts], [profileId+skill+ts]',   // AnswerLogEntry
  daily:    '[profileId+day], profileId',                    // DailyAggregate
  meta:     'key',                                           // lastPrune, schema
})
```

**`ProfileDoc`** indeholder:
- id, version, name, grade, frameColor, createdAt,
- settings, placement,
- `keys: Record<MasteryKey, KeyState>`, `skillStats: Record<SkillId, {prodCorrect, prodDays[]}>`, `skillMedals`,
- nodes, trials, unlocked, roundIndex, newToday, offeredTags,
- `misconceptions: Record<MisconceptionId, MisconceptionState>`,
- `economy {perler, xp, level, eggWarmth, eggsHatched, eggSpecies, wish}`,
- animals, buddyUid, inventory, decor, achievements,
- `goals {day, list}`, stamps, daysPlayed, lastLearningDay,
- demosSeen, instructionsHeard,
- `round: RoundSnapshot | null`,
- `rewardLog` (de sidste 200).

**`AnswerLogEntry`:**
- ts, day (læringsdag), sessionId, roundId, nodeId,
- `mode: 'round'|'trial'|'placement'|'golden'|'practice'|'hut'|'retry'`,
- skill, family, factId, masteryKey, kind, optionsCount, production,
- given, answer, correct, ms (loft 120.000), fast,
- errorTag, detectable[],
- boxBefore, boxAfter, scaffold, replays,
- retryOf, assisted, audioUnverified.

**`DailyAggregate`** følger pædagogik-forslaget §5.4: learnMs (gab > 90 s fratrækkes), playMs, sessions, rounds, answers, firstTryCorrect, `bySkill {n, correct, fast, nProd, msHist[7], errors}`, snapshot og trialsPassed.

**Skrivesti:**
- Zustand opdateres synkront.
- Pr. svar skrives én rw-transaktion over `profiles`, `answers` og `daily`, inklusive snapshot af turen.
- Skrivningen tømmes også ved `visibilitychange → hidden`.

**Opbevaring:**
- `answers` gemmes i 90 dage og højst 20.000 rækker pr. profil. Beskæring sker ved start højst én gang pr. døgn via `setTimeout(fn, 2000)`, fordi Safari ikke har `requestIdleCallback`.
- `daily` gemmes i 3 år.
- `navigator.storage.persist()` kaldes ved første profil.
- "Slet profil" sletter alle rækker med `profileId`.

**Eksport/import** (`src/data/export.ts`):
- Formatet er `{format:'talvennerne2-export', version, exportedAt, profiles:[{doc, daily, answers(30 d)}]}`.
- Deling via `navigator.share({files})`, ellers `a[download]`.
- Håndskrevet validator.
- Ved import vælges "Erstat denne profil" eller "Tilføj som ny".
- Fixtures pr. version ligger i `test/fixtures/export-v1.json`.

**Navnerum:**

| Lager | Tilladt |
|---|---|
| localStorage | `talvennerne2.boot` (`{v, profileIds, lastProfileId, device:{followSilentSwitch, audioVerified, calm}}`) og `talvennerne2.lyt-flags` |
| sessionStorage | `talvennerne2.*` |
| IndexedDB | `talvennerne2` |

Grep-test forbyder:
- `localStorage.clear`, `sessionStorage.clear`, `caches.`, `serviceWorker.register`, `Notification`,
- `indexedDB.deleteDatabase(` med andet navn end `talvennerne2`,
- nøgler uden præfikset `talvennerne2.` samt strengen `tv2:`.

---

## 10. Oplæsning

### 10.1 Normalisering (`src/speech/*`, fælles for runtime og byggescripts)

```ts
type SpeechPart =
  | { clip: ClipId }
  | { num: number; form: 'mid' | 'end'; gender?: 'c' | 'n' }
  | { clock: { minutes: number; style: 'analog' | 'analogHalfForm' | 'digital'; form: 'mid' | 'end' } }
  | { money: { ore: number; form: 'mid' | 'end' } }
  | { measure: { value: number; unit: 'cm' | 'm' | 'g' | 'kg'; form: 'mid' | 'end' } }
  | { frac: { n: number; d: 2 | 3 | 4 | 5 | 6 | 8; form: 'mid' | 'end' } }
  | { free: string }
// src/speech/compile.ts: compile(parts) → { clips: ClipId[]; gapsMs: number[]; text: string }  (text uden cifre)
```

**Talord:**
- 0–20: nul, en, to … tyve.
- Tiere: tredive, fyrre, halvtreds, tres, halvfjerds, firs, halvfems.
- 21–99 er ét ord (enogtyve, nioghalvfems).
- 100–999: "[et|to|…] hundrede", med "og" kun før sidste gruppe: "et hundrede og fem", "to hundrede og tyve".
- 1000 hedder "tusind".

**Køn:** 1 hedder "en" alene, i regnestykker og foran fælleskønsord (krone, meter, tier). Det hedder "et" foran intetkønsord (hundrede, gram, kilogram) og i "klokken et".

**Regnetegn:** plus, minus, gange, divideret med, mindre end, større end.
- "Hvad er a plus b?" (lighedstegnet læses ikke).
- Manglende led: "a plus hvad giver c?".
- Balance og sandt/falsk: "er lig med".

**Klokken:**

| Minutter | Frase |
|---|---|
| :00 | [H] |
| :05 | fem minutter over [H] |
| :10 | ti minutter over [H] |
| :15 | kvart over [H] |
| :20 | tyve minutter over [H] (halfForm: ti minutter i halv [H+1]) |
| :25 | fem minutter i halv [H+1] |
| :30 | halv [H+1] |
| :35 | fem minutter over halv [H+1] |
| :40 | tyve minutter i [H+1] (halfForm: ti minutter over halv [H+1]) |
| :45 | kvart i [H+1] |
| :50 | ti minutter i [H+1] |
| :55 | fem minutter i [H+1] |

- Analoge fraser findes kun i 5-minutstrin. Enkelte minutter bruges kun digitalt ("fjorten treogtyve", "fjorten nul fem").
- Dagtid: 5–11 "om morgenen", 12–17 "om eftermiddagen", 18–23 "om aftenen".

**Penge:** 1250 → "tolv kroner og halvtreds øre". 100 → "en krone". 50 → "halvtreds øre". 10000 → "et hundrede kroner". Mønt- og seddelnavne i ubestemt og bestemt form.

**Brøker:** en halv, en tredjedel, en fjerdedel, to tredjedele, tre fjerdedele, en femtedel, en sjettedel, en ottendedel.

**Cifferord:** nullet, ettallet … nitallet.

### 10.2 Klip-inventar

Inventaret genereres fra koden og redigeres aldrig i hånden. `scripts/voice/inventory.ts` køres via Vite `ssrLoadModule` og skriver `voice/inventory.json` (`{id, text, pack, wave, hash}`).

| Gruppe | Id-mønster | Antal | Bølge |
|---|---|---|---|
| Tal 0–100 | `n.mid.N`, `n.end.N` | 202 | 1 |
| "et" | `n.mid.1.et`, `n.end.1.et` | 2 | 1 |
| Hundreder, "og"-hoveder, tusind | `h.mid.H`, `h.end.H`, `hog.H`, `n.*.1000` | 29 | 2 |
| Tidsfraser + halfForm | `t.end.M`, `t.half.M` | 168 | 2 (hel, halv, kvart) og 3 |
| Dagtid og digitale led | `t.part.*` | 6 | 3 |
| Operatorer og forbindere | `op.*`, `frag.*` | ca. 180 | 1–3 |
| Katalognavneord (figurer, mønter, varer, måleting, enheder, brøker, cifferord, datasæt) | `noun.*` | ca. 150 | 1–3 |
| **Hele spørgesætninger** for recall 0.–1. kl. | `q.<factId>` | 271 (addTo10 66, subTo10 66, tenFriends 11, doubles 10, halves 10, addTo20 36, subTo20 36, missingPart10 36) | 1 (143) og 2 (128) |
| Faste sætninger (kind-instruktioner 15 × lang/kort, skill-intros 72, Kan-bog 72, ros 40, støtte 18, misforståelses-hints 31, indplacering 20, prøve 15, verden/region 32, UI 60, onboarding 30, replikker 60) | `s.*` | ca. 480 | 1–3 |
| Hint-skabelonled | `hint.*` | ca. 100 | 1–3 |
| Navne (arter ×2, racer 12, farveord 40, genstande 74, sæt 11, regioner 28, verdener 4, dyrenavne 120, trofæer 34) | `name.*` | ca. 370 | 1–3 |
| **I alt** | | **ca. 2.000 klip, ca. 48 min** | |

**Sammensætning:**
- Tal 101–999 bygges som `n % 100 === 0 ? h.{form}.H : [hog.H, n.{form}.(n%100)]`.
- Mellemrum: 20 ms ved hundrede-sømmen, 0–60 ms inden for en frase, 120 ms efter `mid`-form, 250 ms mellem sætninger.
- Et mixed-voice-udsagn findes aldrig. Navne (`free`) siges som en separat ytring.

### 10.3 Generering

**Venvs:**
- `/opt/tv2-tts`: torch 2.6.0 CPU fra PyTorch' CPU-index, `chatterbox-tts==0.1.7`, soundfile, pyloudnorm.
- `/opt/tv2-asr`: transformers, torchaudio, faster-whisper.

**Download:** `huggingface_hub.snapshot_download(token=None)` af `CoRal-project/roest-v3-chatterbox-500m`, kun disse filer:
- den t3-checkpoint, som `ChatterboxMultilingualTTS.from_local` i 0.1.7 faktisk indlæser (bekræftes ved at læse kilden),
- `s3gen.pt`, `ve.*`, tokenizer-json, `conds.pt`,
- `audio_samples/00_*` for Mic og Nic.

Det er cirka 3,3 GB. Derudover hentes `CoRal-project/roest-v3-wav2vec2-315m` og `roest-v3-whisper-1.5b`. Licensen gemmes ordret i `voice/LICENSE-CoRal.txt`.

**Indstillinger:** `language_id="da"`, `temperature=0.6`, `top_p=0.95`, `min_p=0.05`, `repetition_penalty=2.0`, `cfg_weight=0.3`. Klip i `mid`-form får "," efter teksten, `end`-form "." og spørgsmål "?".

**Stemmevalg (S1):** 12 probesætninger × Mic og Nic. Den stemme vinder, der har lavest samlet CER. Står det lige, vælges Nic.

**Kørsel:**
- `generate.py --pack <id> --max-minutes 100` er idempotent på `sha1(text|voice|settings|modelrev)` og kører med `nice -n 19`.
- Den bruger 2 tråde, mens agenter arbejder, og 4 tråde når containeren er ledig.
- 1 take pr. klip. Kun ASR- eller varighedsfejl genereres igen (højst 4 nye takes).

**Beslutningsregel fra S1:** Hvis mere end 20 % af enkeltord-takes falder uden for varighedsvinduet [0,5; 2,0] × forventet (stavelser ÷ 3,2/s), gøres to ting:
- alle talord genereres i bæresætningen "Tallet er X." og klippes ud med `torchaudio.functional.forced_align` (roest-wav2vec2),
- korte klip verificeres kun i sammensætning.

**Efterbehandling:**
1. Highpass 70 Hz.
2. Trim ved −45 dBFS (20 ms før, 40 ms efter).
3. Fade 5 ms ind og 10 ms ud.
4. Loudness måles efter BS.1770 (klip under 0,4 s polstres kun til målingen).
5. Gain til −18 LUFS.
6. Limiter ved −1,5 dBTP.

Accept: −18 ± 1 LU, true peak ≤ −1,0 dBTP, ingen clipping.

**Mastere** er FLAC 24 kHz mono i `voice/masters/`. De committes efter hver bid, med højst 10 MB pr. push.

**Pakning** (`scripts/voice/pack.mjs`, `ffmpeg-static` 5.3.0, reserve: apt `ffmpeg`):
- Sprites er højst 60 s med 120 ms stilhed mellem klip.
- Kodning: `-c:a libmp3lame -b:a 40k -ar 24000 -ac 1`.
- Sprites: `n0-20`, `core` og `ui` (fast indlæst), `n21-100` og `hundreds`, samt én pr. domæne og indholdsbølge og `names-*`.
- Filerne ligger i `src/assets/voice/` med hash i filnavnet.
- `voice-manifest.json` ligger i den lazy audio-chunk.

**Budgetter:** fast indlæst (n0-20, core, ui) ≤ 1,2 MB. Hver sprite ≤ 300 KB. I alt ≤ 16 MB.

### 10.4 Udtaletjek (`scripts/tts/asr_check.py`)

- **Pr. take:** roest-wav2vec2 transskriberer, og begge sider normaliseres. Take'en består ved CER ≤ 0,05 og eksakt match på alle talord. Klip under 3 stavelser tjekkes kun i bæresætning eller sammensætning. Grænsetilfælde går til whisper-1.5b som second opinion.
- **Sammensætninger:** `scripts/voice/render.ts` bruger runtime-sekvenskoden (`src/audio/sequence.ts`, ren TS) til at skrive WAV for alle 899 tal fra 101 til 999. ASR og den uafhængige parser `scripts/tts/da_numbers.py` (skrevet af en anden agent end `numberWords.ts`) skal give n igen i 100 % af tilfældene.
- **Skabeloner:** 30 tilfældige facts pr. skill skal give ≥ 97 % ordret match med `toDanishText`.
- **Output:** `voice/qa.json`.
- **Lytteside:** `lyt.html` er en ekstra Vite-entry, som linkes fra "Om oplæsningen". Den har:
  - alle klip pr. sprite med id, tekst, ASR-tekst, CER og LUFS,
  - "Byg en sætning" (skill og fact),
  - skydere for tal 0–1000 og for klokkeslæt,
  - flag i `talvennerne2.lyt-flags` og eksport af listen.

### 10.5 Afspilning (`src/audio/*`)

**Lydgraf:** Én AudioContext, forsøgt oprettet med `new AudioContext({sampleRate: 24000})`, ellers standardraten. Grafen er master → `voiceBus` 1,0 og `sfxBus` 0,7. SFX dukkes til 0,4, mens der tales.

**iOS:**
1. `navigator.audioSession.type = 'playback'` sættes, hvor API'et findes.
2. Reserve på ældre iOS: et loopet lydløst `<audio playsinline>` på 1 s startes i unlock-gestussen.
3. Unlock sker på `touchend`/`click`, ikke `pointerdown`.
4. Efter `visibilitychange → visible` vises overlayet "Tryk for at fortsætte" (samme flow som pause).

**API:** `speak(parts)` returnerer `{ended, cancel}`.
- `ended` resolver på den planlagte sluttid, også når lyden er stum, så timerstarten virker.
- `cancel` fader voiceBus ned på 30 ms. En ny opgave eller et nyt svar afbryder altid.

**Indlæsning og hukommelse:**
- Efter dekodning finjusteres start og slut ±60 ms til −45 dBFS.
- Fast indlæst dekodet lyd er ≤ 24 MB, og LRU-loftet er 64 MB i alt.
- Domæne-sprites hentes ved turstart under introen på 1,2 s. Er de ikke klar 800 ms efter kaldet, læses hele udsagnet med `deviceTts`.

**Reservestemme** (`src/audio/deviceTts.ts`): da-DK `localService` ("Sara"), rate 0,9, altid med ord. Der holdes reference til utterance, så `onend` ikke tabes, og der er en timeout-reserve for `onend`.

**Test-hook:** `window.__voiceLog` findes kun med `?e2e=1`.

**Lyd uden stemme:**
- Ingen musik i v2.0.
- Cirka 30 SFX med FM-syntese og genereret rumklang. Forkert svar giver et blødt "hmm", aldrig en buzzer.
- 16 syntetiserede dyrekald.
- Haptik fra V1 (kun Android).

---

## 11. Art direction, designsystem og asset-pipeline

**Tokens** (`src/ui/design/tokens.css`, Tailwind 4 `@theme`):

| Token | Værdi |
|---|---|
| ink | #2B2144 |
| ink-2 | #5E5478 |
| paper | #FFF8EC |
| card | #FFF |
| line | rgba(43,33,68,.10) |
| primary / primary-deep | #6C4CF5 / #4A2FC9 |
| himmel | #BFE6FF → #FFF3D6 |
| good | #22B573 |
| oops | #FFB020 (rød bruges aldrig som fejlfarve) |
| star | #FFC83D |

Kun lyst tema.

**Skrift:** `@fontsource-variable/nunito`, kun `latin-wght-normal.woff2`, preload i `index.html`, budget ≤ 80 KB. Er filen større, subsettes den med fonttools til Latin-1 plus `· − –`.

| Brug | Phone / iPad |
|---|---|
| Opgavetal | 56/72 px, vægt 900, tabular-nums |
| Overskrift | 28/34 px, vægt 900 |
| Knap | 22/26 px, vægt 800 |
| Brødtekst | 17/19 px, vægt 600 |
| Dashboard | 15 px, vægt 600 |

**Ikoner:** cirka 50 egne ikoner i 24-grid med stroke 2 i `src/ui/design/icons.ts`. `times` tegnes som `·` og `divide` som `:`. Emoji er forbudt i `src/**` (test mod `\p{Extended_Pictographic}`).

**Komponenter:**
- **Primærknap:** 72/88 px høj, radius 24, "læbe" `0 6px 0 primary-deep`. Tryk: `translateY(4px)` på 80 ms.
- **Svarknap:** ≥ 80 × 80 px. Alle trykmål ≥ 60 px.
- **Kort:** radius 28.
- **Sheets:** fjeder-animation.

**Bevægelse:**
- CSS og WAAPI (`element.animate`), ingen `motion`-afhængighed.
- 120, 220 og 400 ms med `cubic-bezier(.2,.8,.2,1)`.
- Skærmskift: skub 24 px og fade på 220 ms.
- `prefers-reduced-motion` og rolig tilstand giver kun crossfade og stopper dyrenes loops. Blink beholdes.

**Scener:** ét diorama-kort pr. verden med højst 3 lag og store farveflader. Statiske gradienter er tilladt i scener, men ikke på væsner. CSS `filter` bruges aldrig. Dock med 5 ikoner (Kort, Dyr, Garderobe, Butik, Bøger), og hvert tryk læser navnet op.

**Materialer** (`src/art/materials/*`):
- Legemønter i korrekte relative størrelser og farver: 50 øre kobber, 1/2/5 kr sølv med hul, 10/20 kr guld. Værdien står som tal, og Nationalbankens motiver kopieres ikke.
- Sedler 50, 100, 200 og 500 med teksten "legepenge". 1000-sedlen findes ikke.
- Ur med kort, tyk timeviser i ink og lang minutviser i #EB5757.
- Øvrige: lineal, multibase (gitter som én path), ti-ramme, figurer og isometriske rumlige figurer, vippebræt, søjlediagram.

**Pipeline:**
1. **Kilde:** TSX. Ingen binære billeder, bortset fra app-ikoner, der renderes fra riggen.
2. **Sheets:** `vite build --mode sheets` bygger `src/dev/SheetApp.tsx` (tree-shakes væk i produktion). Ruter: `species`, `sizes` (48/96/256), `silhouettes`, `lineup`, `fit`, `fitmatrix`, `filmstrip` (8 frames via negative `animation-delay`), `icons`, `materials` og `screens`.
3. `scripts/sheets.mjs` kører V1's `browser.mjs` bag `flock /tmp/tv2-chromium.lock` og skriver PNG i 2× til `artifacts/sheets/` (gitignored).
4. **Lints (vitest):** forbudte elementer, rå hex uden for paletten, emoji, `×`/`÷`, `sad`, skyld-tekster, lange path-literaler.
5. **Lints (Playwright via getBBox):** sikker zone, elementbudget, endelige ankre, fit-matrix (bbox inden for artens hull + 6, øjenregel) og DOM-budget pr. skærm.
6. **Regression:** vitest-snapshot af en hash af `renderToStaticMarkup(<Rig/>)` pr. (art, race, stadie, farve) og pr. genstands-fit. Højst 20 reference-PNG'er i 1× committes.
7. **Multimodalt review:**
   - Reviewer-agenten er aldrig forfatteren. Den får PNG plus `docs/art-rubric.md` og returnerer JSON med en score 1–5 pr. kriterium og fejl med koordinater.
   - 10 kriterier: genkendelighed ved 48 px, silhuet, proportioner mod kaninen, kontur, palet, ansigtets appel, pasform, animation, læsbarhed i butikskort ved 64 px og AAA-finish.
   - Accept: alle ≥ 4 og middel ≥ 4,3, højst 4 iterationer, derefter eskaleres til integratoren.
   - **Blind silhuettest:** en frisk agent skal identificere ≥ 15/16 arter.
   - Skærme reviewes i 375×667, 393×852 og 820×1180 på langs og tværs, med ekstra fokus på overflow, kontrast ≥ 4,5:1 og trykmål.
8. **Færdigkriterier:** som i kunst-forslaget §4.4, tilpasset racer og hash-regression. Brugeren får kanin-arket (S2) og det første fulde artsark.

---

## 12. Arkitektur

### 12.1 Afhængigheder (låste versioner, ingen `^`)

| Type | Pakker |
|---|---|
| dependencies | react 19.2.8, react-dom 19.2.8, zustand 5.0.15, dexie 4 (seneste 4.x ved scaffold), @fontsource-variable/nunito 5.3.x |
| devDependencies | vite 8.2.2, @vitejs/plugin-react 6.1.0, tailwindcss 4.3.3, @tailwindcss/vite 4.3.3, typescript 7.0.2, vitest 4.1.11, playwright 1.62.1, fake-indexeddb, ffmpeg-static 5.3.0 |

Ingen motion-, gesture-, chart- eller audio-biblioteker. Træk laves med en egen `usePointerDrag` på cirka 80 linjer.

### 12.2 Vite-opsætning

- `base: './'` og `resolve.dedupe: ['react','react-dom']`.
- `build.rollupOptions.input: {index, lyt, diag}`.
- CSS starter med `@import "tailwindcss" source(none); @source "./src";`, så Tailwind ikke scanner V1.
- **Manifest:** `id "/Test/talvennerne2/"`, `start_url "./"`, `scope "./"`, navn "Talvennerne 2", kort navn og `apple-mobile-web-app-title` "Talvenner 2". Test asserter `id`.
- Ingen service worker.
- **Minimum iPadOS 16.4:** `index.html` viser en ren HTML-besked, hvis `CSS.supports('color','color-mix(in srgb, red, red)')` er falsk.

### 12.3 Mappestruktur

```
talvennerne2/
  index.html lyt.html diag.html vite.config.ts package.json tsconfig.json
  docs/ SPEC.md art-rubric.md voice.md ios-checklist.md
  public/ manifest.webmanifest, ikoner (renderet fra riggen)
  voice/ inventory.json qa.json LICENSE-CoRal.txt masters/*.flac
  scripts/ browser.mjs playthrough.mjs sheets.mjs budget.mjs scope-guard.mjs make-icons.mjs
           voice/{inventory.ts,render.ts,pack.mjs,run-vite.mjs}
           tts/{generate.py,asr_check.py,align.py,da_numbers.py,requirements-tts.txt,requirements-asr.txt}
  test/ fixtures/ reference/ (≤20 PNG)
  src/
    engine/ types.ts rng.ts answer.ts kinds.ts mastery.ts learningDay.ts misconceptions.ts tasks.ts
            roundBuilder.ts placement.ts trial.ts
            skills/{types.ts,registry.ts}  skills/<domain>/<skillId>.ts  <domain>.oracle.ts  <domain>.test.ts
    speech/ types.ts numberWords.ts clock.ts money.ts measure.ts fractions.ts compile.ts clips/*.ts
    content/ curriculum.ts species.ts wardrobe.ts decor.ts economy.ts achievements.ts goals.ts names.ts
             misconceptionTexts.ts ids.lock.json
    meta/ progression.ts unlock.ts ceremonyQueue.ts rewards.ts
    data/ db.ts namespace.ts repo/{profiles.ts,answers.ts,daily.ts} aggregate.ts export.ts prune.ts
    state/ useSession.ts useProfile.ts useRound.ts useWardrobe.ts
    parent/ metrics.ts recommend.ts gradeEstimate.ts tips.ts
    audio/ engine.ts unlock.ts voice.ts sequence.ts deviceTts.ts sfx.ts
    fx/ particles.ts ParticleCanvas.tsx haptics.ts
    art/ rig/{Rig.tsx,anchors.ts,bodies.ts,shapes.ts,fit.ts,palette.ts,oklch.ts,rig.css,types.ts,staticSvg.ts}
         parts/house.tsx species/<id>.tsx items/<set>/<id>.tsx scenes/<world>.tsx materials/*.tsx
    ui/ design/{tokens.css,Button.tsx,Card.tsx,Sheet.tsx,Icon.tsx,icons.ts,SpokenText.tsx}
        task/<kind>/{View.tsx,Demo.tsx}  skills/<domain>/{Prompt.tsx,Hint.tsx}
        screens/child/*  screens/parent/*  overlays/*
    diag/ main.ts   lyt/ main.tsx   dev/ SheetApp.tsx sheets/*
```

### 12.4 Genbrug fra V1

| V1-fil | I V2 |
|---|---|
| `engine/rng.ts` | kopieres uændret |
| `engine/mastery.ts` | kopieres og udvides: `isProduction` via guessP, dagsregler, familier, `retryOf` |
| `engine/roundBuilder.ts` | kopieres. Sikker åbner, 2/5/3 og `balanceAnswerPositions` bevares, og slots, ordning og lofter udvides |
| `facts.ts`, `tasks.ts`, `distractors.ts` | splittes i SkillDef-moduler. `tasks.ts` bliver en generisk `buildTask(def, fact, kind, rng)` |
| `state/useRound.ts` | kopieres. `submit(AnswerValue)`, retry, guldæg og pause/resume bevares, og snapshot pr. svar tilføjes |
| `fx/*` | kopieres |
| `audio/sfx.ts` | flyttes ind i `audio/engine.ts` |
| `audio/speech.ts` | bliver til `deviceTts.ts` |
| `ui/task/*` (Choice, Keypad, Count→CountTap, Pair, NumberLine, Manipulatives, StrategyHint) | kopieres og restyles |
| `scripts/browser.mjs`, `playthrough.mjs`, `make-icons.mjs` | kopieres og udvides |
| `art/*`, `storage.ts`, `useProfile.ts`, `islands.ts`, alle skærme | skrives om |

De 32 motortests fra V1 porteres til `src/engine/*.test.ts`.

### 12.5 Bundlebudget (`scripts/budget.mjs` fejler buildet)

| Chunk | Budget (gzip) |
|---|---|
| Initial JS | ≤ 160 KB |
| Motor-chunk (registry og skills, lazy efter første render) | ≤ 60 KB |
| Hver lazy chunk | ≤ 60 KB |
| Al JS | ≤ 750 KB (A16; var 600 KB) |
| Skrift | ≤ 80 KB |

Lazy-indlæses: dashboard, butik, garderobe, Dyrehave, bøger, domæne-UI, kind-UI, arter (ikke-eager glob, buddyen preloades), audio-manifest, lyt og diag.

---

## 13. Etiske rækværk

Hvert punkt håndhæves af en test eller en scan. Den manuelle tjekliste ligger i `docs/SPEC.md`.

1. Ingen streak. Kun "Dage spillet i alt", der aldrig nulstilles. Trofæer ved 3, 7, 14, 30 og 100 dage.
2. Ingen notifikationer (grep: `Notification`, `PushManager`).
3. Ingen tidsbegrænsede tilbud. `Date` er forbudt i `economy.ts`, `goals.ts` og `wardrobe.ts`, og priserne er faste heltal.
4. Ingen sjældenheds-tiers (typetest: `tier` findes ikke). Den eneste tilfældighed er æggets race og farve blandt uejede, alle lige meget værd.
5. Valuta kan kun optjenes. Ingen rigtige penge, ingen reklamer, ingen eksterne links for barnet. Netværkskald går kun til samme origin (Playwright-netværkslog).
6. Ingen skyld: `Mood` har ikke `sad`, og en tekst-scan fejler på `/savner|ked af det|venter på dig|glem ikke|kom tilbage|din ven bliver/i`.
7. Ingen auto-start eller nedtælling. "Næste" og "Til kortet" er lige store, og ingen har fokus som standard.
8. Ingen valutatal under turen. Ingen "kun N til …" (scan).
9. **"Næste tre mål"** (`goals.ts`, ren funktion):
   - Mål 1: spil Blandet øvelse.
   - Mål 2: besøg en region, der ikke er spillet i ≥ 5 læringsdage.
   - Mål 3 roterer mellem "5 rigtige i træk", "Skriv 10 svar selv" og "Få 3 stjerner".
   - Målene udløber aldrig og giver kun et stempel i Stempelbogen (fortløbende, uden datoer).
   - Nye mål kommer først næste læringsdag, uden nedtælling.
10. Ingen ranglister og ingen sammenligning mellem søskende.
11. Intet optjent kan tabes. Test: inventar og dyr formindskes aldrig, og perler falder kun ved køb.
12. ✕ er altid tilgængelig og gemmer turen.
13. Gennemsigtighed for forældre: minutter pr. dag, belønningslog og "Alt optjenes ved at regne".
14. Lange sessioner bliver mere konsoliderende, ikke mere belønnende: lofter over nyt stof, træthedsværn, stjernebonus kun første gang.
15. OpenRAIL-licensen er læst, og `docs/voice.md` bekræfter, at ingen mekanik rammer brugsbegrænsningerne.
16. Data bliver på enheden. Ingen analytics.

---

## 14. Eksekvering: faser, gates og parallelitet

**Regler for alle faser:**
- Integratoren er hovedsessionen. Den ejer `package.json`, lockfilen, `App.tsx`, `curriculum.ts`, `ids.lock.json`, `types.ts` og, efter G1, `tokens.css` og `art/rig/**`.
- Højst 6 samtidige arbejdere.
- Hver arbejder har sit eget worktree: `git worktree add /home/user/wt/<agent> -b tv2/<agent>` med `talvennerne2/node_modules` symlinket fra hovedtræet.
- `npm run scope -- '<glob>'` kører før hver commit.
- Integratoren merger lokalt og pusher kun `claude/math-app-children-ios-4jihdr`.
- Hver agent kører preview på port 4300+n. Chromium kører bag flock.
- Orakel-filer skrives af en anden agent end generatoren.

### F0: G-spec, scaffold og spikes (integrator + 2 arbejdere)

**Integratoren:**
- scaffold af `talvennerne2/`,
- `docs/SPEC.md`,
- den fulde `src/engine/types.ts` (inkl. `SpeechPart`),
- `ids.lock.json` med 10 domæner, 72 skills, alle familie-id'er, 15 kinds + reserveret `rulerDraw`, 4 verdener, 28 regioner, 172 noder, 16 arter, 24 racer, alle colorway-id'er, 74 genstande, 11 sæt, 8 pynt, 31 misforståelser, 34 trofæer og klip-id-mønstre,
- skelettet til `curriculum.ts`,
- port af V1-motoren og dens 32 tests.

**Spikes:**

| Spike | Ansvar | Indhold |
|---|---|---|
| S1 | tts-agent | Venvs, download, RTF på 20 probeklip × Mic/Nic, 20 svære enkeltord × 3 takes, 10 sammensatte prompts mod 10 hele sætninger (WAV). Stemmevalg efter reglen. Beslutning om bæresætning. Licens gemt. |
| S2 | art-agent | `rig/**`, kaninen (`upright`) i 3 stadier × 6 farver + 2 hatte + 1 trøje som kontaktark |
| S3 | integrator | `ffmpeg-static -encoders` viser libmp3lame, ellers apt-reserve |
| S4 | integrator | `npx playwright install webkit`. Resultatet dokumenteres; ikke en gate |

**Gate G0:**
- `git diff --stat c956c45 -- . ':!talvennerne2'` er tom.
- Den porterede suite er grøn.
- S1: RTF er målt, stemmen er valgt, og probe-CER er ≤ 5 %.
- S2: rubrikken er ≥ 4.
- WAV-probes og kanin-ark er sendt til brugeren.

Brugergodkendelse indhentes, men blokerer ikke. Brugerens svar kan skifte stemme før bølge 2, hvilket koster en regenerering af bølge 1 (cirka 2 t CPU).

### F1: Fundament (6 arbejdere)

| Agent | Ejer | Leverance |
|---|---|---|
| W1 engine | `src/engine/**` (ikke `skills/<domain>`) | answer, kinds, mastery, learningDay, misconceptions, tasks, roundBuilder, placement, trial og registry, med tests |
| W2 data | `src/data/**`, `src/state/useSession.ts`, `useProfile.ts` | Dexie, repo, snapshot pr. svar, beskæring, eksport/import, navnerum, fake-indexeddb-tests |
| W3 tale og lyd | `src/speech/**`, `src/audio/**`, `src/diag/**` | normalize og compile, afspilning, unlock, deviceTts, diag.html |
| W4 art | `src/art/rig/**`, `src/art/parts/**`, `species/{rabbit,cat,horse,unicorn}.tsx`, `src/dev/**`, `scripts/sheets.mjs` | Rig-API frosset, 4 helte-arter med 3 racer hver |
| W5 design | `src/ui/design/**`, app-skal, dock, `src/art/materials/**` | Tokens, knapper, ikoner, SpokenText, materialer |
| W6 lydpipeline | `scripts/voice/**`, `scripts/tts/**`, `voice/**` | inventory, pack, generate, asr_check, align, da_numbers, og kørsel af bølge 1 (ca. 900 klip, ca. 2 t CPU i baggrundsbidder à ≤ 100 min) |

**Gate G1:**
- Alle engine-, data- og speech-tests er grønne. Talord 0–1000 matcher tabellen, og `parse(numberWords(n)) = n`. Klokken er rigtig for 144 + 24 fraser, og penge for 40 beløb.
- Sekvensen med en syntetisk tone-sprite har timing ±5 ms i Chromium.
- Kaninen opfylder færdigkriterierne. Kat, hest og enhjørning har rubrik ≥ 4, og silhuettesten er bestået.
- Designsheets har rubrik ≥ 4.
- Bølge 1-lyden har bestået ASR og er pakket.

### F2: Lodret skive, Engdalen (6 arbejdere)

| Agent | Ejer |
|---|---|
| W1 | `skills/number` og `skills/addsub`, 0. kl. (count10, count20, hear20, order20, addTo10, subTo10, tenFriends) |
| W2 | `skills/shapes`, `skills/algebra` og `skills/measure`, 0. kl. (shapes2D basic, patterns, compareLength). W1 og W2 skriver hinandens orakler. |
| W3 | `ui/task/{choice,keypad,countTap,pair,numberline,trueFalse,multiSelect,sortOrder,fillSlots,buildBase}` og demoer |
| W4 | `species/{puppy,hedgehog}` og racefinish, samt `scenes/eng.tsx` |
| W5 | `items/{hverdag,opdager,milepael,pirat}` og fit-matrix |
| W6 | `meta/**`, `content/economy.ts`, `achievements.ts`, `goals.ts`, ceremonier og `parent/**` med dashboard v1 (overblik, pensumkort, domænekort, skill-rækker, misforståelser, anbefalinger, indstillinger, eksport) |

Integratoren står for kort, onboarding, profiler, Dyrehave-zone 1, bøger, butik, garderobe, wiring og deploy.

**Gate G-slice:**
- Hele Engdalen kan spilles. Playwright-gennemspilningen er grøn i 3 viewports. Budgetterne holder. Tjeklisten i afsnit 13 er gennemgået. `economy.sim` punkt 1–3 holder.
- **Første deploy:** kortet og "Ti web-apps", `diag.html` er med.
- `docs/ios-checklist.md` er sendt til brugeren. Den har 10 punkter:
  1. oplæsning med lydløs slået til,
  2. lydtjek,
  3. genoptag efter hjemknap,
  4. genoptag efter at appen er lukket,
  5. profil bevaret efter genstart fra hjemmeskærmen,
  6. to profiler adskilt,
  7. flydende tur,
  8. flydende Dyrehave med 12 dyr,
  9. træk på uret (bølge 2) og mønter,
  10. ingen andre apps påvirket.

Bølge 2 starter med det samme. Alt der afhænger af iOS-resultatet (audio-unlock, rig-ydelse) rettes, når brugerens svar kommer.

### F3: Bølge 2, 1.–2. kl. (6 arbejdere)

- **W1:** number, place, addsub og algebra for 1.–2. kl.
- **W2:** clock og money for 1.–2. kl.
- **W3:** shapes, measure og fractions for 1.–2. kl.
- **W4:** kinds `clockSet`, `pay`, `share` og `colorParts` samt deres materialer.
- **W5:** 8 arter (lamb, fox, hamster, panda, squirrel, owl, pegasus, dragon), scenerne `bakke` og `skov`, og sættene Rytter, Kongelig, Ridder, Talmagiker, Fodbold, Vinter og Fest.
- **W6:** lyd til bølge 2 (hundreder, tider, penge, figurer, 128 hele sætninger, navne).

**Gate G2:**
- Generator mod orakel giver 0 fejl.
- Misforståelses-fixtures er grønne.
- Fit-matrixen er reviewet.
- ASR er bestået.
- E2E er grøn for alle kinds i bølge 1 og 2.
- Deploy i update-tilstand.

### F4: Bølge 3, 3. kl. (5 arbejdere)

- Domænerne for 3. kl. (add1000, sub1000, tabeller, division, mulTens, area, gridCoords, clockFive, clockDigital, clockElapsed, kronerOre, convertCmM, fractionOfSet, fractionCompare, regroup, afrunding).
- Kinden `grid`.
- Arterne penguin og polarbear, scenen `fjeld`, sættet Astronaut.
- Indplaceringsstigen i UI, `gradeEstimate`, tabelgitter og udskrift.
- Lyd til bølge 3.

**Gate G3:** Alle 72 skills er registreret og placeret. Gennemspilningen (en simuleret profil) når boks 5 i alle skills over 10 simulerede dage. Deploy i update-tilstand.

### F5: Polering og slut-deploy (integrator + 2)

- Ydeevne.
- VoiceOver-labels på dansk.
- App-ikoner renderet fra riggen.
- Review af alle skærme.
- Den manuelle etik-tjekliste.

**Gate G4:** afsnit 15.5 er grønt. iOS-tjeklisten er bekræftet af brugeren; ellers står den som åben i slutrapporten.

---

## 15. Verifikation

`npm run verify` kører typecheck, vitest, build, budget, playthrough og sheets-lints.

### 15.1 Unit (vitest)

- **Generatorer:** alle recall-facts plus 200 seedede instanser pr. familie sammenlignes med et uafhængigt orakel.
  - Id'er er unikke.
  - Distraktorer er unikke, ≠ svaret, ≥ 0, inden for `range` og taggede.
  - `classifyError(c.value) === c.tag`, og dobbelttags bliver `ambiguous`.
  - Shapes overholder `isA`.
- **Produktion:** guessP-testen (3.3). Hver skill har produktion.
- **Mestring:** valg løfter aldrig over boks 3. Fejl giver −2 med gulv 0. Langsomt-rigtigt ændrer intet. Gensvar ændrer intet. Dagsreglerne holder med fake clock over midnat, 04:00 og 2026-10-25. Familier promoveres ikke på `recent`, og et andet instans-svar kræves.
- **Misforståelser:** fixtures fra afsnit 4.3 samt at `audioUnverified` ignoreres.
- **roundBuilder** (1.000 seeds):
  - åbneren er sikker, når det er muligt,
  - ingen samme nøgle i træk,
  - ≤ 3 i træk med samme regneart,
  - sidste opgave er ikke ny,
  - review kommer fra en anden skill,
  - lofterne for nyt stof holder,
  - `hear*` udelades ved stum lyd.
- **Indplacering:** ≤ 18 opgaver for alle svarmønstre, kun produktion, seeding til boks 2.
- **Oplåsning:** kædeuafhængighed, hjælpebro efter 3 forsøg, 60 %-reglen for verdener.
- **Økonomi:** `economy.sim.test.ts` (9 krav) og determinisme.
- **Tale:** talord, klokken, penge, dækning af alle `speech()` for alle facts plus 50 instanser pr. familie × kinds. `toDanishText` indeholder ingen cifre.
- **Data:** CRUD, loft på 6 profiler, beskæring, sletning efterlader 0 rækker, eksport → import giver en identisk view model, fixture v1, navnerum.
- **Dashboard:** fixtures for metrics, recommend og gradeEstimate. At åbne en ny skill giver aldrig negativ tendens.
- **Scans:** emoji, `×`/`÷`, `sad`, skyld-tekster, rå JSX-tekst, forbudte API'er, `tv2:`, `Date` i økonomi og mål, samt manifest-id.

### 15.2 Gennemspilning (`scripts/playthrough.mjs`, `?e2e=1`, Chromium via proxy)

- Onboarding: klækning inden for 60 s efter valg af ven.
- Alle kinds besvares rigtigt, med touch-træk via CDP `Input.dispatchTouchEvent`.
- En fejl viser strategien og venter på tryk.
- ✕ midt i en tur og genoptag giver samme opgave og samme kø.
- Genindlæsning efter svar 4 giver samme opgave 5.
- Profilskift under pause.
- Niveau 2 giver huen, og huen tages på.
- Køb og omfarvning. Outfit bevares efter genindlæsning.
- To profiler holdes adskilt efter genindlæsning.
- Voksen-gate og dashboard pr. profil. Eksport, import og sletning af én profil.
- `talvennerne.save` og `x:y` er byte-identiske før og efter hele flowet.
- `__voiceLog` indeholder de forventede klip-id'er.
- 0 konsolfejl i 3 viewports.
- DOM ≤ 1.500 SVG-elementer.
- Ved 4× CPU-throttle: opgaveskærmen har p95 ≤ 20 ms, og albummet ≥ 50 fps.

### 15.3 Visuelt

Lints, hash-regression, rubrik-review ≥ 4 og middel ≥ 4,3, silhuettest ≥ 15/16, skærm-review i 3 viewports.

### 15.4 Udtale

- CER ≤ 0,05 og eksakte talord pr. klip.
- 899/899 sammensatte tal.
- ≥ 97 % skabelonsætninger.
- Loudness −18 ± 1 LU.
- Brugeren får 20 sammensatte regnestykker på lyttesiden.

### 15.5 Deploy

1. `git fetch origin main claude/wc2026-tournament-app-k42mv8`.
2. `git show origin/main:.claude/skills/deploy-to-pages/scripts/deploy-app.sh > $SCRATCH/deploy-app.sh`. Læs scriptets flag.
3. Registrér `git ls-tree origin/claude/wc2026-tournament-app-k42mv8` for alle topniveau-poster, herunder `talvennerne`, `sw.js` og `index.html`.
4. `cd talvennerne2 && npm run verify && npm run build`.
5. **Første gang:** `bash $SCRATCH/deploy-app.sh talvennerne2 talvennerne2/dist --new`. I worktreens `index.html`:
   - indsæt `<a class="card t2" href="./talvennerne2/">` efter V1-kortet, med unicorn-emoji (U+1F984) i `.emoji` som forsidens konvention, titlen "Talvennerne 2" og undertitlen "Matematik fra 0. til 3. klasse · dyr at samle, tøj at vinde, overblik til forældre",
   - tilføj `.t2 .emoji { background: linear-gradient(135deg,#6C4CF5,#7FD3FF); }`,
   - ret "Ni web-apps" til "Ti web-apps",
   - intet andet ændres.

   Derefter `bash $SCRATCH/deploy-app.sh --push <worktree> talvennerne2`. Senere deploys bruger kun update-tilstand.
6. **Accept:**
   - `--verify` giver 200 på alle 11 stier, og roden har titlen "Mine projekter".
   - Tree-SHA for `talvennerne` og alle andre app-mapper samt `sw.js` er uændret.
   - Live Playwright-smoke på `https://frederiknordentoft-prog.github.io/Test/talvennerne2/`: sæt `talvennerne.save` og `x:y`, opret en profil, spil én tur. Nøglerne er byte-identiske, og `/Test/talvennerne/` svarer stadig 200.

---

## 16. Risici og hvad der skæres først

**Låste valg (én sætning hver):**
- "Så længe barnet vil" uden pauseforslag strider mod ICO std. 5 og DSA art. 28-retningslinjerne. Designet afbøder det kun (lofter over nyt stof, træthedsværn, ingen forlængende belønninger) og løser det ikke.
- "Langsomt men rigtigt giver ingen fremgang" kan fastlåse langsomme børn. Derfor er dashboardets "rigtigt men langsomt" og R2 obligatoriske.

**Øvrige risici:**
- Sammensat tale kan lyde hakket. S1-spiken, hele sætninger for 0.–1. kl., ASR og lyttesiden afbøder det.
- CPU-tiden til TTS er cirka 5 t i alt. Idempotente bidder og FLAC-mastere i git gør, at den kun betales én gang.
- Kunstkvaliteten afhænger af LLM-skrevet SVG. Parametriske primitiver, kanin-referencen, review-løkken og brugerens godkendelse af kaninen afbøder det.
- Chromium er ikke iOS. `diag.html` og brugerens tjekliste er eneste rigtige verifikation, og minimum er iPadOS 16.4.
- Safari-faner og hjemmeskærmen har hver sin lagring, og Safari-faner kan miste data efter 7 dage. Introen og synlig eksport afbøder det.
- Omfanget er 5–7 gange V1. Derfor bygges i bølger med gates, og kontrakterne fryses først.
- Søskende kan spille på forkert profil. Rammefarve, bogstav og oplæst navn ved hver start afbøder det.

**Skæres i denne rækkefølge, hvis tiden presser:**
1. De 8 pyntegenstande og træk af dyr i Dyrehaven. Dyrehaven bliver et statisk galleri.
2. Omfarvning af tøj.
3. Vækst-morph. Stadieskift bliver en crossfade.
4. Animerede misforståelses-hints ud over digitSwap, forgotCarry, smallerFromLarger og halfPastNext.
5. Trofæer reduceres fra 34 til 20.
6. Arter i bølge 4 (penguin, polarbear, dragon, pegasus). Deres ven-noder giver i stedet en ny race eller farve af en eksisterende art.
7. "Byg en sætning" og skyderne på lyttesiden.
8. Butikssættene reduceres fra 4 til 2.

Aldrig skåret:
- de 72 skills og 4 pensumtilvalg,
- mestrings- og fejlreglerne (låste valg),
- forældre-dashboardet (pensumkort, domænekort, skill-rækker, misforståelser, anbefalinger),
- de forindspillede stemmer,
- 6 profiler,
- racerne for kanin, kat, hest og enhjørning,
- navnerums- og deploy-vagterne.

---

### Kritiske filer for implementeringen
- `/home/user/Test/src/engine/mastery.ts`: Leitner-kernen, der skal generaliseres til `isProduction` via guessP, dagsregler og familier.
- `/home/user/Test/src/engine/roundBuilder.ts`: slot-logikken, sikker åbner og `balanceAnswerPositions`, som udvides med review, målrettet opgave, lofter og træthed.
- `/home/user/Test/src/state/useRound.ts`: tur-tilstandsmaskinen (retry, guldæg, pause/resume), som får `AnswerValue`, `retryOf` og snapshot pr. svar.
- `/home/user/Test/src/engine/types.ts`: V1's numeriske `Fact`/`Task`, der erstattes af `talvennerne2/src/engine/types.ts` (G-spec).
- `/home/user/Test/scripts/playthrough.mjs` og `/home/user/Test/scripts/browser.mjs`: Chromium via proxy og barnelignende gennemspilning, som kopieres og udvides til V2. Deploy-scriptet hentes med `git show origin/main:.claude/skills/deploy-to-pages/scripts/deploy-app.sh`.
