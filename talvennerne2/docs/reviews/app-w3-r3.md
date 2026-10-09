# App-review, bølge 3 runde 3 (QA3c): genkontrol af Stjernefjeldet før frigivelse

Uafhængig genkontrol af QA3b's fund (`docs/reviews/app-w3-r2.md`) efter FIX3c, FIX3d og FIX3e. Den er kørt på frigivelseskandidaten `581dec4`, hvor `fjeld` står i `RELEASED_WORLDS` (`src/meta/built.ts`, kun til denne genkontrol). Der er spillet i fire dimensioner: indplacering, layout, net-tekster-udsnit og prod-smoke. Formatet og P1/P2/P3-skalaen følger QA3a og QA3b.

**Om efterprøvningen:** Hvert indmeldt P2 er efterprøvet af en skeptiker i friske profiler på kandidaten, på egen dev-server og uden `?worlds=all`. Alle syv blev genskabt, og ingen blev tilbagevist. Én af dem (QA3b's P3-5, inverseOps) har skeptikeren sat ned til P3. P3-fundene kommer direkte fra reviewerne og er ikke efterprøvet.

- **Build:** `581dec4` på `tv2/qa3c`. `npm run build` var grønt (prod-smoke): initial 142,2 KB og al JS 689,5 KB gzip (budget 750 KB, A16). `registry` er 57,6 KB (grænsen pr. chunk er 60 KB).
- **Afvikling:** én dev-server pr. dimension (porte 4401–4403) med `?e2e=1&voice=fast` og **uden** `?worlds=all`, så fjeldet og stigen ses, som de bliver efter frigivelsen. Prod-smoke kørte på produktionsbuildet med `vite preview` (port 4404). Til sammenligning har QA3b's build `c180167` kørt på 4451–4453, og skeptikerne har kørt på 4420–4435.
- **Miljø:** dev-serverne delte `node_modules/.vite` gennem det symlinkede `node_modules`. Det gav "504 Outdated Optimize Dep" og en hvid skærm. De berørte dev-servere er derfor kørt med egen `cacheDir` via en wrapper-config (fx `artifacts/qa3c/indplacering/vite.qa.config.mjs`), og kildefilerne er ikke rørt. Det er et miljøproblem, ikke et fund.
- **Chromium:** rigtig touch (`hasTouch`, `isMobile` på telefon, `page.touchscreen.tap` og træk med CDP-touch), ingen syntetiske klik. Mange opgaver er lagt i en gemt tur (`profile.round`), som den rigtige RoundScreen genoptager. Resten er spillet fra kortet. I prod er de rigtige svar læst fra React-fiberens props, fordi `/src`-imports ikke virker dér. Dagen er rykket med `page.clock`, hvor det betød noget.
- **Adgang:** et nyt barn i 3. kl. får fjeldet åbnet af klassetrinnet. Hvor en sten ellers var låst (fx Minuttårnet for en profil oprettet direkte i scriptet, eller Arealhavens l2 og Brøkbageriet for en frisk profil), er fjeldet åbnet som "Åbn hele Stjernefjeldet" (`withOpenings`).
- **Oplæsning:** kun tjekket som klip-id'er i `__voiceLog`. Lyden er ikke lyttet igennem.
- **Skærmbilleder og scripts:** ligger i `artifacts/qa3c/<dimension>/` (git-ignoreret), med skærmbillederne i `shots/`. Skeptikernes genskabelser ligger i `artifacts/qa3c/skeptiker-*/`. Alle stier herunder er relative til `talvennerne2/`.

## Resultat

**Stjernefjeldet kan ikke frigives endnu. Der er ingen P1, men seks bekræftede P2'ere, og efter skalaen bør de rettes før frigivelse. QA3b's P1 og 13 af 15 P2'ere er rettet, og de to sidste er delvist rettet.**

1. **QA3b's rettelser holder.** Koordinatnettet (P1-1) står stille under fingeren i fire formater og i prod. P2-1 til P2-8, P2-10, P2-11 og P2-13 til P2-15 er set rettet på skærmen. P2-9 og P2-12 er kun delvist rettet (P2-5 og P2-6 herunder). Af de 11 genkontrollerede P3'ere er 10 rettet og én delvist rettet (P3-5).
2. **Det vigtigste nye fund (P2-1).** Et stærkt barn i 3. kl. får "Her er der nyt i morgen" hver dag på Tabeltoppens "Lær mere", og det er netop den sten, kortet foreslår som næste fra dag 1 til dag 17. Det samme sker for Arealhavens "Lær mere". Løftet om "i morgen" holder aldrig, og gange med hele tiere bliver aldrig introduceret i en lektion.
3. **En regression i de verdener, der allerede er frigivet (P2-2).** FIX3c's nye loft krymper lyspærens mønter i 1.–2. kl. fra 47–54 px til 32 px på en almindelig telefon, også når kortet har plads. 2 kr. og 1 kr. bliver lige store.
4. **Indplaceringen følger A24**, både i motoren (alle 14 trin og 9 kanter) og i 18 onboardinger med fingeren. Der er dog to nye huller, som ingen af dem er regressioner, men som først ses nu, hvor stigen kører på frigivelsen. Forældrene får "Klar til: Tabeltoppen" om et barn, stigen har sat i Hundredemarken eller Tællelunden (P2-3). Og stigens "Tryk på …" skæres over på telefon på tværs (P2-4).
5. **Det, der kun stod i lyden, står nu på skærmen:** ¾ på to tallerkener, "3/4 af 12", hen/op og punktet ved koordinater, størst/mindst og "færrest". 70 opgaver i 0.–2. kl. har samme boble og oplæsning som før.
6. **Prod-buildet er grønt og under budget.** En ny enhed kan gå hele vejen med fingeren, og der var 0 konsolfejl i alle kørsler i alle dimensioner.

**Fund:** 0 × P1, 6 × P2 og 6 nye P3'ere. Dertil kommer QA3b's P3-5, som stadig er delvist åben.
- P2: 7 indmeldt, og alle 7 er genskabt af skeptikerne. Den ene (QA3b's P3-5) blev sat til P3. Af de seks er fire nye, og to er rester af QA3b's P2-9 og P2-12.
- P3: 5 fra reviewerne og 1 sideobservation fra en skeptiker. Ingen af dem er efterprøvet.

## Sådan er der spillet

| Dimension | Port | Formater | Omfang |
|---|---|---|---|
| indplacering | 4401 (+ 4451 med `c180167`) | 393×852, 375×667, 852×393, 820×1180, 1180×820 (import) | SPEC A24 er læst helt. Motorens starttabel er beregnet for alle 14 trin og 9 kanter (`table.mjs`, `keys.mjs`, `cand.mjs`). 18 onboardinger for 3. kl. er spillet med fingeren, også søskende, stenkort og genindlæsning midt i stigen. Forældredelen (7 faner, udskrift og eksport) er set for L14 og L6/L7, og importen som ny spiller. 0.–2. kl. og stigens fejlforløb på tværs er kørt i både HEAD og `c180167`. |
| layout | 4402 (+ 4452) | 375×667, 393×852, 852×393 | QA3b's P2-8 til P2-14 og P3-2, P3-3, P3-4, P3-5 og P3-9, mest via gemt tur i den rigtige RoundScreen. Minuttårnet l1/l2, Tællelunden l1 og Urtårnet l1 er spillet fra kortet. Regression mod `c180167` for "Det lærte du", "Tryk på" og lyspærens mønter i 1.–2. kl. |
| net-tekster-udsnit | 4403 (+ 4453) | 393×852, 375×667, 852×393, 820×1180 | P1-1 i gemte ture og i den rigtige mesterprøve. P2-4 til P2-7 og "færrest" i 6 cases × 4 formater med `__voiceLog` og genforsøg. P2-15 numerisk for alle 16 arter (72 nøgler) og visuelt. Boble og oplæsning for 70 opgaver i 0.–2. kl. i begge træer, og numberline og sortOrder på tværs. |
| prod-smoke | 4404 (`vite preview`) | 393×852, 375×667, 852×393, 820×1180 (forældre) | `npm run build` og 31 kørsler. En ny enhed hele vejen med blandet stige og med alt rigtigt. Kortet og de 7 regioner. 13 ture (l1 i 6 af 7 regioner, 3 l2-ture og 2 mesterprøver) og 8 forsøg på "Lær mere". Første tur i 0.–2. kl. og forældredelen. |

| Skeptiker | Port | Fund | Resultat |
|---|---|---|---|
| skeptiker-nyt-i-morgen | 4435 | "Her er der nyt i morgen" på l2-stenene | Genskabt på 393×852 og 852×393, og årsagen er fundet i koden. P2. |
| skeptiker-layout-coins | 4428 (+ 4478 med `c180167`) | Lyspærens mønter i 1.–2. kl. | Genskabt med gemt tur og i en almindelig tur i fire formater. P2. |
| skeptiker-klar-til | 4420 | "Klar til: Tabeltoppen" | Genskabt for L6 og for P = null, med "Spring over" som kontrol. P2. |
| skeptiker-tryk-tvaers | 4421 | Stigens "Tryk på" på tværs | Genskabt 3 af 3 gange og udvidet til tre cifre (L11, L13). P2. |
| skeptiker-p2-9 | 4425 | Butikkens skilte i fejlflowet (QA3b's P2-9) | Genskabt og målt ved 0–6 s i fire formater. P2, delvist rettet. |
| skeptiker-p2-12 | 4426 | 4. minikort i "Tryk på" (QA3b's P2-12) | Genskabt i et naturligt forløb og med gemt tur, også i 1. kl. P2, delvist rettet. |
| skeptiker-p3-5 | 4427 | inverseOps "Så giver …" (QA3b's P3-5) | Genskabt, men sat til **P3**. |

## Status for QA3b's fund

**Optælling:** 27 QA3b-fund er genkontrolleret, og 24 er rettet, 3 delvist rettet og 0 ikke rettet. Det dækker P1-1, P2-1 til P2-15 og 11 P3'ere.

| QA3b | Status nu | Bevis | Set af |
|---|---|---|---|
| P1-1 Koordinatnettet hopper på tværs | **Rettet.** | Panel (232, 73, 605, 312) og net (304, 87, 284) står stille før, under og efter første berøring. 26/26 træk og tryk lander rigtigt på 852×393, og 25/25 på 393×852, 375×667 og 820×1180. Den rigtige mesterprøve er bestået med 10 planker i tre formater, og i prod gav trækket (4,6)→(2,6) `'2,6'`. Samme script i `c180167` genskaber fejlen (panel 232 → 66). `net-tekster-udsnit/shots/grid-A-land-1st-mid.png`, `before-grid-A-land-1st-mid.png`, `prod-smoke/shots/p3-E-land-w3-areal-trial-griddrag-after.png` | net-tekster-udsnit, prod-smoke |
| P2-1 "Det er nok" uden bestået trin → Tællelunden | **Rettet.** | Seks veje uden bestået trin er prøvet: ét rigtigt, én fejl med strategien fremme, én fejl og bekræft, før første svar, ✓✗✓ og "Spring over". De giver alle `{done:false, highest:null}`, 0 seedede nøgler, første tur `w3-tabellen-l1` og den neutrale slutlinje `s.place.done.none`. `indplacering/shots/onb-oneMiss-se-5-outro.png`, `onb-rwr-phone-7-map.png` | indplacering |
| P2-2 Et dumpet trin seedes | **Rettet.** | L5 ✓✓, L7 ✗ og L6 ✓✓ giver `{highest:'L6', failed:['L7']}`. 0 af 8 hear100-nøgler er seedet, første tur er `w1-tal100-l1`, og Færdigheder siger "Øver · 0 % sikre · øvet i dag". Det samme gælder efter L13 ✗ og L14 ✗, og importen bevarer `failed`. `indplacering/shots/onb-l6-land-7-map.png`, `par-l6-phone-tab-2-0.png` | indplacering |
| P2-3 Stigen springer Markedet over | **Rettet.** | Kun regioner i kæden `tal` står i `passedOver` for alle trin og kanter. Efter L14 siger Markedets stenkort "Her lærer du noget nyt.", og Pensumkortet viser Penge og Måling uden stiplede prikker. Prod viser det samme. `indplacering/shots/sheet-phone-w3-penge-maal-l1.png`, `onb-all-phone-9-markedet.png` | indplacering, prod-smoke |
| P2-4 ¾ på to tallerkener | **Rettet.** | Boblen siger «Den ene skal have 3/4 og den anden resten.» i fire formater og ved genforsøg, mens den almindelige deling stadig siger «Del lige.». Oplæsningen slutter med `otherRest` uden "Del lige.". `net-tekster-udsnit/shots/texts-phone-share34-1.png` | net-tekster-udsnit |
| P2-5 Brøk af en mængde | **Rettet.** | «3/4 af 12» står over eller ved bunken som choice og keypad i fire formater, og det gælder også 1/2, 1/3 og 1/4. På 375×667 med tastatur er der et kort blink (ny P3 nr. 4). `net-tekster-udsnit/shots/texts-phone-fosCards-1.png`, `heap-se-0-900.png` | net-tekster-udsnit |
| P2-6 Koordinater på kort | **Rettet.** | readPoint: boblen spørger «Hvor langt op/hen er punktet?», og under nettet står kun pil og «?», aldrig punktets tal. placePoint: «(6, 1)» med pil og «?». Gælder i fire formater og ved genforsøg. `net-tekster-udsnit/shots/texts-phone-coords-0.png`, `texts-land-coords-2.png` | net-tekster-udsnit |
| P2-7 Størst/mindst på brøk-kort | **Rettet.** | «Hvilken brøk er størst?» og «… mindst?» i fire formater, også order4. sortOrder er uændret. `net-tekster-udsnit/shots/texts-land-fcm-0.png` | net-tekster-udsnit |
| P2-8 "4 : 2 = −1" | **Rettet.** | «4 : 2 = ?» med overstreget «?» på 393×852 og 375×667. På 852×393 er kortet skjult i fejlflowet, og tallerknerne står i panelet. `layout/shots/phone-S1-0-teach-div2510-d2-share.png` | layout |
| P2-9 Mønter og butik ud over kortet | **Delvist.** | Rettet: de 20 halvtredsører står i 2 rækker inde i kortet, og hjælpen på 375×667 viser alle 6 mønter og «9 kr.». Ikke rettet: på 375×667 med pære og derefter forkert svar står prisskiltene 33 px over kortet, hen over stenrækken. Se P2-5 herunder. | layout, skeptiker-p2-9 |
| P2-10 "9 meter 63 centimeter" på tværs | **Rettet** (set i l1-turen, ikke i selve prøven). | Scenen går fra x 28 til 407 i et kort fra 16 til 419, og 0 elementer ligger udenfor. Det gælder også "944 centimeter = ? meter 44 centimeter". `layout/shots/land-S5-0-ask-convertCmM-mCmToCm-keypad.png` | layout |
| P2-11 Arealhaven på SE | **Rettet.** | Figuren er 90 px høj i et kort på 128 px i alle fire familier, kortet går i kompakt tilstand, og stenrækken er fri. `layout/shots/se-S6-0-ask-area-rowsCols-keypad.png` | layout |
| P2-12 Figurer med rette hjørner | **Delvist.** | Figurerne står nu inde i deres kort, og "Tryk på" står over rækken. Men med fire rigtige figurer stikker 4. minikort 19 px ud af svarboksen på 375×667. Se P2-6 herunder. | layout, skeptiker-p2-12 |
| P2-13 Det digitale ur i "Tryk på" | **Rettet.** | "Tryk på" står over uret, og uret ligger i den hvide boks i alle tre formater (SE: boks 170–312, knap 132–346). `layout/shots/se-S8-0-teach-clockDigital-analogToDigital-choice.png` | layout |
| P2-14 "Det lærte du" på 375×667 | **Rettet.** | Skærmen får `is-tight` og kan ikke scrolles. I l2 står stjernerne ved 430–474 og perler og point ved 482–526, mens knapperne starter ved 573. I prod står de ved 403–447 og 455–499, og knapperne ved 575. `layout/shots/se-ur-w3-klokken-l2-summary.png`, `prod-smoke/shots/p6-se-fresh-w3-klokken-l1-cer0.png` | layout, prod-smoke |
| P2-15 Isbjørnens hovedudsnit | **Rettet.** | Kun `polarbear/std/1–3` har fået nyt udsnit (stadie 2: `46.7 56.7 95.8 95.8` → `23.6 45.8 119.8 119.8`), og de 15 andre arter er identiske. Snude, næse og mund ses i HUD, på ven-stenen, i regnbuevalget, i æggevalget og i Samlebogen. `net-tekster-udsnit/shots/montage-bear-1.png`, `montage-hud-before-after.png` | net-tekster-udsnit |
| P3-2 kr. uden punktum | **Rettet.** | "14 kr. plus 14 kr. giver 28 kr." og "Fra 74 til 100 er 26 kr.". Tastaturets "40 kr" er ikke tjekket, fordi der ikke findes nogen kronerOre-tastaturopgave. `layout/shots/phone-S4-0-teach-kronerOre-addHalves-pay.png` | layout |
| P3-3 "Alle starter i Engdalen." blinker for 3. kl. | **Rettet.** | Linjen skifter inden for 25 ms efter tryk på "3.". Når stigens chunk er forsinket med 4 s (eller 1,5 s), vises ingen linje, og "Næste" er aktiv. Se dog den nye P3 nr. 3 om linjen, før der er valgt. `layout/shots/phone-onb-g3-1-120ms-slow.png` | layout, indplacering |
| P3-4 Uret i opgavekortet på SE | **Rettet.** | Starturet og "17:15" står i et kort på 97 px, og stenrækken er fri. `layout/shots/se-S9-0-ask-clockElapsed-plusHalf-clockSet.png` | layout |
| P3-5 "Så giver atten divideret med tre seks" | **Delvist.** | div2510 og divAll siger og viser nu "18 divideret med 3 giver 6.". inverseOps mulToDiv i Delekløften viser stadig "Så giver 18 : 3 = 6." og siger "Så giver atten divideret med tre seks". Skeptikeren har efterprøvet det og sat det til P3 (se afsnittet om P3-5 herunder). | layout, skeptiker-p3-5 |
| P3-9 "3." ved 1 · 3 | **Rettet** for ×1. | "Når vi ganger med en, får vi tallet selv. 1 gange 3 giver 3." både på skærmen og i stemmen. Kommaet i clockDigital handsSwapped (anden halvdel af fundet) er ikke tjekket. `layout/shots/phone-S10-0-teach-mul34-t3-choice.png` | layout |
| P3-13 "Færrest" kun i lyden | **Rettet.** | Choice-boblen siger «Med færrest mønter og sedler?» i fire formater og ved genforsøg, og pay-varianten er uændret. `net-tekster-udsnit/shots/texts-se-fewest-0.png` | net-tekster-udsnit |
| P3-19 Tendensen "Rykket op" for en seedet færdighed | **Rettet.** | Overblikket siger "Rykket op: 3- og 4-tabellen", og 6- til 9-tabellen er ikke med. Færdigheder og udskrift siger "Sprunget over ved start · øvet i dag". `indplacering/shots/par-all-ipad-tab-0-0.png` | indplacering |
| P3-20 Pip takker efter "Det er nok" før første svar | **Rettet.** | Pip siger "Det er helt i orden. Nu går vi ud på kortet.", og `__voiceLog` har kun `s.place.done.none`. `indplacering/shots/onb-before-se-5-outro.png` | indplacering |
| P3-21 "gemt 8. okt.." | **Rettet.** | "… gemt 9. okt." med ét punktum på 1180×820 og 393×852. `indplacering/shots/imp-par-all-ipad-ipadLand-1-incoming.png` | indplacering |
| P3-22 Hjemmetippet til add1000 | **Rettet i kilden.** | `src/parent/tips.ts` siger nu "først enerne, så tierne og til sidst hundrederne". Tippet er ikke set på skærmen, fordi R2 ikke blev udløst. | indplacering |
| P3-23 "Næste tre mål" uden punktum | **Rettet.** | Alle tre mål slutter med punktum i alle kørsler, hvor `c180167` viste "Tag en tur forbi Hundredemarken" uden. `indplacering/shots/onb-all-phone-8-goals.png` | indplacering |

QA3b's øvrige P3'ere (P3-1, P3-6 til P3-8, P3-10 til P3-12, P3-14 til P3-18 og P3-24) var ikke med i genkontrollen. Mønstret fra P3-1 (prisskilte, der stikker 10–12 px op over kortet) ses stadig i addHalves (se P2-5).

---

## P1 – blokerer frigivelse

Ingen.

---

## P2 – bør rettes før frigivelse

Alle seks er efterprøvet og genskabt af en skeptiker i friske profiler på `581dec4` uden `?worlds=all`.

### P2-1 "Her er der nyt i morgen" hver dag på Tabeltoppens "Lær mere", som er den sten, kortet foreslår som næste, og på Arealhavens "Lær mere"

- **Fundet af:** prod-smoke.
- **Efterprøvning:** skeptiker-nyt-i-morgen genskabte det i to friske profiler (393×852 og 852×393) og fandt årsagen i koden med de rigtige funktioner på den rigtige profil. Det blev ikke tilbagevist.
- **Skærm og format:** kortets sten-ark → "Spil" → PlayIntro i tilstanden `tomorrow` (Pip: "Her er der nyt i morgen. Nu kan du øve det, du har lært.", knapperne "Blandet øvelse" og "Til kortet"). 393×852 og 852×393.
- **Trin:**
  1. Ny enhed (`?e2e=1&voice=fast`). Gå onboardingen igennem, vælg 3. klasse og "Vis Pip, hvad du kan", og svar rigtigt på alle 12 spørgsmål (L5→L14). Tryk "Spil", derefter ✕ → Til kortet. Kortets næste sten er `w3-tabellen-l1`.
  2. Ryk uret en dag frem før hver tur (`page.clock`), og spil l1 i Tabeltoppen, Minuttårnet, Markedet, Arealhaven og Brøkbageriet (dag 1–5). Kortets næste sten (`[data-stone][data-next]`) er nu `w3-tabellen-l2`.
  3. På en ny læringsdag: tryk som det første på Tabeltoppens "Lær mere" (`w3-tabellen-l2`) eller Arealhavens (`w3-areal-l2`), og tryk "Spil".
- **Set:**
  - Begge l2-sten svarer "Her er der nyt i morgen" hver gang. I prod-smoke var det Arealhaven på dag 6, 7, 8 og 13 og Tabeltoppen på dag 10, 12, 14 og 18. Hos skeptikeren var det Tabeltoppen på dag 2, 3, 4 og 9 og Arealhaven på dag 3 og 9. På tværs gjaldt det også `w3-store-tal-l2`.
  - Hver gang er det en ny dag, hvor ingen nye nøgler er brugt. `newToday` står på en tidligere dag, fx `{day:'2026-10-12', total:6}` på læringsdagen 2026-10-19.
  - Kortets næste sten er `w3-tabellen-l2` fra dag 1 til dag 17. Først når barnet selv tager Tabeltoppens mesterprøve (bestået 10/10), åbner Delekløften, og næste sten skifter. Bagefter siger l2-arket "Den har du sprunget over. Du kan stadig spille den.", men stenen svarer stadig "nyt i morgen" (dag 18).
  - Brøkbageriets, Minuttårnets og Markedets "Lær mere" startede normalt.
  - **Årsag** (skeptikeren, med `chooseStart`/`planRound` i siden):
    - Tabeltoppens l2 er kun mulTens med 2 nøgler, og Arealhavens l2 er kun sortShapes/rightAngle og skipCount/step25. Begge dele kommer fra `half()` i `curriculum.ts`.
    - På en frisk dag tager `buildRound` de 2 egne friske nøgler. `isCapped()` er falsk, fordi der ikke er flere friske nøgler, og turen fyldes derefter op med review-nøgler (boks ≥ 3) fra andre skills, før gentagelsesløkken kommer til.
    - Planen bliver fx `[mulTens/a, mul:3x7, mul:3x8, mul:3x9, mulTens/b, mul:1x4, …]`, altså `ownShare` = 2/10 = 0,2.
    - `chooseStart` giver `tomorrow`, når `plays === 0` og `ownShare < OWN_SHARE_MIN` (0,5), uden at tjekke, om dagens loft faktisk er brugt.
    - Kontrol: på dag 0, før barnet havde review-nøgler i boks ≥ 3, var den samme l2-plan 10 × mulTens med `ownShare` 1.
  - **Omfang** (kun beregnet med en syntetisk erfaren profil, ikke set med fingeren): 10 af 140 sten giver `tomorrow` med samme mekanisme. I fjeldet er det `w3-tabellen-l2`, `w3-areal-l2`, `w3-store-tal-l2` og `w3-division-l2`, og i 0.–2. kl. `w0-tal10-l2`, `w0-tal20-l2`, `w1-tiere-l2`, `w2-penge-l2`, `w2-hundreder-l2` og `w2-maal-data-l2`. Det er ikke en regression fra FIX3c–e, men en følge af A15. Om et rigtigt barn i 0.–2. kl. rammer det, afhænger af, hvor mange sikre review-nøgler det har.
  - Barnet er ikke helt blokeret, for mesterprøven kan startes, og der er Blandet øvelse og andre regioner. Men kortets anbefaling peger hver dag på en sten, der aldrig starter. Tabeltoppens ven, l3 og blandet er låst bag l2, indtil prøven er bestået, og gange med hele tiere bliver kun øvet, hvis barnet selv finder prøven.
- **Burde:** Efter SPEC A15 viser en sten, der aldrig er spillet, kun "Her er der nyt i morgen", når turen bliver under halvt egen, *fordi dagens nye nøgler er brugt* (A13). På en ny læringsdag starter "Lær mere", og den sten, kortet foreslår, kan altid spilles. `tomorrow.test.ts` siger det samme: "A fresh day, and a stone already played, run as before".
- **Skærmbilleder:** `artifacts/qa3c/prod-smoke/shots/p3-F-w3-tabellen-l2-tomorrow.png`, `p3-G-w3-tabellen-l2-tomorrow.png`, `p3-E-land-w3-tabellen-l2-tomorrow.png`, `p3-D-land-w3-areal-l2-tomorrow.png` og `p3-F-w3-areal-l2-tomorrow.png` (logs `p3-*.out`). Skeptikeren: `artifacts/qa3c/skeptiker-nyt-i-morgen/shots/sk-phone-dag2-w3-tabellen-l2.png`, `sk-phone-dag9-w3-tabellen-l2.png`, `sk-phone-dag3-w3-areal-l2.png` og `sk2-land-dag2-w3-store-tal-l2.png` (logs `sk-phone.out`, `sk2-land.out` og `breadth.out`)
- **Fil:** `src/ui/screens/child/play/prepare.ts:63` (`chooseStart` tjekker ikke, at loftet er brugt), `src/engine/roundBuilder.ts` (`buildRound` fylder fra `others` før gentagelsesløkken, når `isCapped()` er falsk), `src/content/curriculum.ts` (`half()` og `regionNodes`), SPEC A13 og A15

### P2-2 Regression: lyspærens mønter i 1.–2. kl. er krympet til ca. 32 px på en almindelig telefon, og 2 kr. og 1 kr. er lige store

- **Fundet af:** layout.
- **Efterprøvning:** skeptiker-layout-coins genskabte det med gemt tur og i en almindelig tur uden genvej, i både kandidaten og `c180167`. Det blev ikke tilbagevist.
- **Skærm og format:** opgave countCoins (keypad) med lyspæren i Målebakken (1. kl.) og Købmandsgården (2. kl.). 393×852, og også 852×393 og 375×667.
- **Trin:**
  1. Opret et barn i 1. eller 2. kl.
  2. Spil Målebakken eller Købmandsgården til en countCoins-opgave med tastatur. Layout brugte en gemt tur med `tael:sameCoins:1+1+1` og `tael:mixedTo100:10+10+1`. Hos skeptikeren kom `tael:sameCoins:2+2` og `tael:mixedTo20:2+2+2+1` af sig selv i Målebakkens l2.
  3. Tryk på lyspæren, og sammenlign med det samme trin i `c180167`.
- **Set:**
  - Kortet er 226 px højt (`--ch` 190px). Hjælpens mønter får max-height 34,2 px (0,18 × 190) og bliver 32,1 px brede. I `c180167` var 1 kr. 46,6 px og 10 kr. 53,7 px i samme kort og med samme stillads.
  - Uden loftet (sat ind som style-override i kandidaten) bliver mønterne 46,6/53,7 px og står stadig inde i kortet, med 2 px luft ved 1+1+1 og 0 px ved 10+10+1. Der er altså plads, og det er loftet alene, der krymper dem.
  - "KR" kan ikke læses, og mønterne i hjælpen er meget mindre end mønterne i opgaven lige over dem.
  - I hjælpen bliver 2 kr. og 1 kr. lige store (32,1 px), mens 2 kr. er tydeligt større i opgaven. Ved biggestFirst (20, 10, 5 og 1 kr.) er alle seks mønter 32,1 px. Det strider mod SPEC §11 ("Legemønter i korrekte relative størrelser").
  - Andre formater:

    | Format | Kortet | Mønter nu | Mønter i `c180167` |
    |---|---|---|---|
    | 852×393, tastatur og flervalg | 230 px | 34,1 px | 46,6/53,7 px (0 px luft ved 10+10+1) |
    | 375×667, flervalg | 250 px | 36,8 px | 46,6 px (16 px luft) |
    | 375×667, tastatur | 134 px | 17,2 px | 44 px (flød 10 px ud) |
    | 393×852, flervalg | 360 px | 2 kr. 54,8 px | 56,35 px |
    | 820×1180 | – | uændret | uændret |

  - På 375×667 med tastatur var en form for krympning nødvendig (QA3b's P2-9). Men FIX3c's egen kommentar i `round.css` siger "a card with room (a taller phone, a tablet) keeps their own size", og det holder ikke.
  - Det sker i normal leg: tastatur er ca. 35 % af countCoins i Målebakkens l2.
- **Burde:** Når kortet har plads, beholder hjælpens mønter deres egen størrelse og deres rigtige indbyrdes størrelse. Kun det, der ikke passer, krymper (som `rowFit`), i stedet for et fast loft på hver mønt.
- **Skærmbilleder:** `artifacts/qa3c/layout/shots/cmp-R7-1-help-countCoins-sameCoins-keypad.png` (venstre `c180167`, højre nu) og `cmp-R8-0-help-countCoins-mixedTo100-keypad.png`. Skeptikeren: `artifacts/qa3c/skeptiker-layout-coins/shots/cmp-phone-A-help-before-vs-after.png`, `cmp-phone-E-help-before-vs-after.png` (biggestFirst), `phone-after-A-help-card-nocap.png` (uden loft), `phone-after-natural-r1-2-sameCoins-keypad-help.png` og `phone-after-natural-r2-6-mixedTo20-keypad-help.png` (logs `log-phone.jsonl`, `log-other.jsonl` og `log-natural2.jsonl`)
- **Fil:** `src/ui/screens/child/round/round.css:114` (`.tv-round__scaffold .tv-hv__coins svg { max-height: calc(var(--ch) * 0.18); }`, tilføjet i FIX3c)

### P2-3 Forældrene får "Klar til: Tabeltoppen" om et barn, stigen har placeret i 1. eller 0. klasses stof

- **Fundet af:** indplacering.
- **Efterprøvning:** skeptiker-klar-til genskabte det i friske profiler for L6 (393×852) og P = null (375×667) med "Spring over" som kontrol. Det blev ikke tilbagevist.
- **Skærm og format:** For voksne → Overblik → Anbefalinger og udskriften. 393×852 og 375×667, men det gælder alle formater.
- **Trin:**
  1. Ny spiller, 3. klasse, "Næste" og "Vis Pip, hvad du kan".
  2. Svar rigtigt på L5 to gange, forkert på L7 (hør og skriv tal til 100) og rigtigt på L6 to gange. Stigen slutter selv med P = L6 og `failed: [L7]`.
  3. Tryk "Spil" (første tur er Hundredemarken), spil turen, og gå til kortet.
  4. Tryk på "For voksne", løs regnestykket, og se Overblik og udskriften.
  - Variant: L5 ✗ og L4 ✗, så barnet starter i Tællelunden.
- **Set:**
  - Den eneste anbefaling er "Klar til: Tabeltoppen – Tabeltoppen i Stjernefjeldet er åben, og Mira har ikke været der endnu. Den ligger på kortet.". Lige under står "Mira er nu i Hundredemarken i Hestebakkerne.", og kortets mål er "Tag en tur forbi Hundredemarken.". Udskriften gentager anbefalingen i linje 14.
  - Asta (Tællelunden) og Bo (L6) i søskende-kørslen får det samme.
  - Kontrol: Sif trykker "Spring over", starter i Tabeltoppen og får "Klar til: Trecifret bro". Det er rimeligt. Fejlen opstår altså kun, når stigen har placeret barnet under klassetrinnet.
  - Tabeltoppen kræver w2-gange (`src/content/curriculum.ts:139`). I Færdigheder står 2-, 5- og 10-tabellen og "Grupper af lige mange" som "Ikke startet" for Mira. Regionen er kun åben, fordi valget af 3. kl. lægger alle regioner fra 0.–2. kl. i `unlocked.regions`.
  - Det er ikke en regression, for `recommend.ts` er uændret siden før `c180167`. Hullet ses først nu, hvor stigen kan placere under klassetrinnet.
- **Burde:** Anbefalingen følger indplaceringen. SPEC A24 lader kortet og "Næste tre mål" foreslå startregionen først, og pædagogik-forslagets §5.2 definerer R6 som "næste oplåste region uden forsøg, hvor forudsætningerne er 'kan selv'". Når stigen har sat barnet i Hundredemarken eller Tællelunden, gives der ingen "Klar til" for en region i Stjernefjeldet. Anbefalingen peger fx på startregionen eller udelades.
- **Skærmbilleder:** `artifacts/qa3c/indplacering/shots/par-l6-phone-tab-0-0.png`, `sib-se-asta-overblik.png` og `sib-se-bo-overblik.png` (tekst `par-l6-phone-tab-0-Overblik.txt`, `par-l6-phone-print.txt` linje 14 og `sib-se.log`). Skeptikeren: `artifacts/qa3c/skeptiker-klar-til/shots/klar-l6-phone-3-overblik.png`, `klar-none-se-3-overblik.png` og kontrollen `klar-skip-se-3-overblik.png`
- **Fil:** `src/parent/recommend.ts`, R6: `floor = Math.max(x.profile.grade, here ? WORLD_BY_ID[here.world].grade : 0)`, og hverken `placement` eller `placedStart` bliver brugt. Tærsklen "aldrig en verden under barnets klassetrin" stammer fra app-w2-r1 P2-8, fra før der fandtes en indplacering. Se også `docs/design/paedagogik.md` §5.2.

### P2-4 Stigens "Tryk på …" efter en fejl går ud over kortet og skærmkanten på telefon på tværs, så tallet skæres over

- **Fundet af:** indplacering.
- **Efterprøvning:** skeptiker-tryk-tvaers genskabte det 3 af 3 gange og målte også tre cifre (L11 og L13). Det blev ikke tilbagevist.
- **Skærm og format:** Onboarding 3. kl., stigen, fejlforløbet (strategien og den store grønne knap). Telefon på tværs 852×393 (`hasTouch`, `isMobile`).
- **Trin:**
  1. Ny spiller på 852×393, 3. klasse og "Vis Pip, hvad du kan".
  2. Svar rigtigt på L5 to gange, og svar forkert på det første L7-spørgsmål (hør og skriv tal til 100).
  3. Se strategien med "Tryk på …".
- **Set:**
  - Svarkortet fylder kun den højre halvdel (433–836 px). Stagen har stadig to kolonner (403px 403px), og opgavekortet står til venstre.
  - Knappen går fra ca. 690 til 900 px, altså 45–48 px ud over skærmen. Tallet "81" står ved 817–871 px, så skærmen viser "Tryk på 8". Det er set med 72, 76, 79 og 81.
  - Med tre cifre er det værre. Ved L11 (`h1000:381`) går knappen fra 706 til 943 px, og kun 19 af 82 px af "381" kan ses, så der står "Tryk på 3". Ved L13 (`a1000:697`) står der "Tryk på 6". Strategiens billede går også ud over kortets højre kant, og enerklodsen skæres over.
  - Knappen kan stadig trykkes (et tap ved (771, 287) rammer `[data-confirm]`), og stemmen siger det rigtige tal.
  - Til sammenligning har en normal tur på 852×393 (`w2-tal1000-l1`, svar 526) klassen `is-teaching` på roden og én kolonne (820px). Kortet går fra 46 til 806 px og knappen fra 562 til 799 px, så "526" står helt inde.
  - Det er ikke en regression, for `c180167` med `?worlds=all` viser det samme. QA3b kørte stigen på 852×393 efter en fejl (P2-1), men meldte ikke layoutet.
- **Burde:** Knappen og svaret ligger inden for svarkortet og skærmen, som i en almindelig tur. SPEC §3.5 (fejlforløbet) gælder også stigen, og SPEC kræver, at alle skærme reviewes på langs og på tværs.
- **Skærmbilleder:** `artifacts/qa3c/indplacering/shots/onb-l6-land-4-miss-2.png`, `onb-l5enough-land-4-miss-3.png` og `tryk-now-land-ladder.png` (normal tur `tryk-now-land-round-hear100.png`, før `before-out/shots/tryk-before-land-ladder.png`, mål `tryk-now-land.log`). Skeptikeren: `artifacts/qa3c/skeptiker-tryk-tvaers/shots/l7-852x393-miss-L7.png`, `l11-852x393-miss-L11.png`, `l13-852x393-miss-L13.png` og `round-w2-tal1000-l1-852x393-miss.png`
- **Fil:** `src/ui/screens/child/onboarding/placement/Ladder.tsx`: roden er `tv-round tv-place tv-place--ladder` og får aldrig `is-teaching`, selv om `TaskStage` har beat `teaching`. `src/ui/screens/child/round/round.css`: `@media (orientation: landscape) and (max-height: 500px)` giver kun strategien hele bredden under `.tv-round.is-teaching`. Se også `placement.css`. Den sandsynlige rettelse er at løfte beat op fra `TaskStage` og sætte `is-teaching` på roden, som `RoundScreen.tsx` gør (ca. linje 818).

### P2-5 Rest af QA3b's P2-9: i fejlflowet efter lyspæren på iPhone SE står butikkens prisskilte over stenrækken, og varen er væk

- **Fundet af:** layout (genkontrol af QA3b's P2-9).
- **Efterprøvning:** skeptiker-p2-9 genskabte det i en frisk profil og målte ved 0, 1,5, 3 og 6 s. Målene ændrede sig ikke, så det er ikke en animation. Det blev ikke tilbagevist.
- **Skærm og format:** opgave choice kronerOre addHalves i Markedet ("Det koster fire kroner og halvtreds øre. Hvad koster to af dem?"), fejlflowet efter lyspæren. 375×667.
- **Trin:**
  1. Nyt barn i 3. kl. (fjeldet er åbnet af klassetrinnet).
  2. I Markedet (`w3-penge-maal-l1`): kør til opgaven `kro:addHalves:450` som choice (i kørslerne lagt ind via en gemt tur).
  3. Tryk på lyspæren, og svar derefter forkert med fingeren.
- **Set:**
  - Kortet krymper til t137–b250 (`--ch` 93px). Begge "4,50 kr."-skilte står ved t104–b162, altså 33 px over kortets top, hen over stenrækken. I en tur med 1 sten dækker de den aktuelle sten og flaget, og i en tur med 8 sten dækker de de midterste sten.
  - Gulerødderne er 37 px høje og kun 28 % synlige, så kun spidserne ses under skiltene.
  - Pillen "9 kr." (t225–b268) går 18 px ud over kortets bund, og panelet dækker de nederste ca. 10 px. Teksten kan stadig læses, og panelet viser selv "9 kr.".
  - Uden pære på SE stikker skiltene 12 px op, og gulerødderne er 84 % synlige. På 393×852 med pære stikker de 11 px op. Begge dele er QA3b's P3-1-mønster. På 852×393 er kortet skjult i fejlflowet (det ser tilsigtet ud), og på iPad 820×1180 er alt inde.
  - Det, der er rettet: hjælpen på 375×667 viser alle 6 mønter og "9 kr." inde i kortet, og de 20 halvtredsører ved `kro:fiftiesInKroner:1000` står i 2 rækker inde i kortet.
  - Desuden, som sidefund fra skeptiker-layout-coins (ikke efterprøvet for sig): ved countCoins biggestFirst med tastatur og pære på 393×852 flyder opgavens møntbunke 28 px over kortets top og 36 px ned i hjælpen. I `c180167` var det 75 px over. QA3b's P2-9 er altså også kun delvist rettet for countCoins (`artifacts/qa3c/skeptiker-layout-coins/shots/cmp-phone-E-full.png`).
- **Burde:** Billedet bliver inde i kortet. Skiltene krymper med varen (`--scene-h`), og "9 kr." står over panelet.
- **Skærmbilleder:** `artifacts/qa3c/layout/shots/se-S3-0-teach-kronerOre-addHalves-choice.png` (den rettede hjælp: `se-S3-0-help-kronerOre-addHalves-choice.png`, 12 px uden pære: `se-detail-pay-0-teach-4000ms.png`). Skeptikeren: `artifacts/qa3c/skeptiker-p2-9/shots/se-se-help-teach-6000.png`, `se-se-help-8stones-teach-6000.png` og `se-se-help-help-1500.png` (målelog `log.jsonl`)
- **Fil:** `src/ui/scenes/scenes.css` (`.tv-shop__tag`, ca. linje 512: fast `font-size: 22px`, `position: absolute`, `top: -8px`, `right: -30px`, krymper ikke med `--scene-h`), `src/ui/scenes/PromptScene.tsx` (scenen `shop`), `src/ui/screens/child/RoundScreen.tsx` (`shopsTwice`/`TWICE`) og `src/ui/screens/child/round/round.css` (`.tv-round__card.has-scaffold .tv-round__scene`)

### P2-6 Rest af QA3b's P2-12: med fire rigtige figurer stikker det 4. minikort i "Tryk på …" 19 px ud af svarboksen på iPhone SE

- **Fundet af:** layout (genkontrol af QA3b's P2-12).
- **Efterprøvning:** skeptiker-p2-12 genskabte det i et naturligt forløb (`w3-areal-l1` og derefter `w3-areal-l2` to gange, dag 2–4, med fingeren) og med reviewerens gemte tur. Det blev ikke tilbagevist.
- **Skærm og format:** fejlflowet i multiSelect (sortShapes rightAngle) i Arealhaven, "Tryk på …" med fire rigtige figurer. 375×667. Det samme sker i 1. kl. (Hestebakkerne, threeCorners og fourCorners).
- **Trin:**
  1. Nyt barn i 3. kl. med Stjernefjeldet åbnet som "Åbn hele" (`w3-areal-l2` er låst for en frisk profil).
  2. Spil `w3-areal-l1` og `w3-areal-l2` til "Tryk på alle figurer med fire rette hjørner." med fire rigtige figurer (fx `srt:rightAngle:570`, `:688`, `:459` eller `:523`).
  3. Svar forkert, og se "Tryk på …".
- **Set:**
  - Selve opgaven er rettet: alle figurer står inde i deres kort, og "Tryk på" står over rækken.
  - Med fire figurer stikker det 4. minikort 19 px ud af den hvide svarboks (boks l66–r313, kort r = 332). Den grønne flade slutter ved r = 334, så kortet rører næsten kanten.
  - 8 af de 20 kanoniske rightAngle-fakta har fire figurer, og i l2's anden tur havde 3 af 5 rightAngle-opgaver fire. Med 2 eller 3 figurer er der 0 px udenfor.
  - På 393×852 er det 1 px, altså inden for tolerancen, men kortet ligger op ad boksens højre kant uden luft. På 852×393 og 820×1180 er det 0 px.
  - Samme fejl i 1. kl.: `srt:fourCorners:3` og `srt:threeCorners:3` giver 19 px på 375×667. Det er ikke en regression, for før rettelsen stak figuren endnu længere ud.
  - Barnet kan stadig trykke på knappen.
- **Burde:** Hvert kort i "Tryk på …" står inde i svarboksen, ligesom figurerne nu gør i selve opgaven.
- **Skærmbilleder:** `artifacts/qa3c/layout/shots/se-S7-0-teach-sortShapes-rightAngle-multiSelect.png` (opgaven: `se-S7-0-ask-sortShapes-rightAngle-multiSelect.png`). Skeptikeren: `artifacts/qa3c/skeptiker-p2-12/shots/se-natural-teach-6-srt_rightAngle_688_2.png`, `se-natural-teach-8-srt_rightAngle_459_6.png`, `se-inject-teach-0-srt_rightAngle_570_0_qa0.png` og `se-inject-teach-0-srt_fourCorners_3_0_qa0.png` (logs `log.jsonl` og `log-g1.jsonl`)
- **Fil:** `src/ui/screens/child/round/round.css`: linje 306 (`.tv-teach__row.is-wide .tv-face__row { flex-wrap: nowrap }`) holder fire md-minikort på én linje, hvilket kræver ca. 278 px med padding. Linje 375 (`.tv-confirm__answer`) krymper til 245 px, og linje 360–362 (`.tv-confirm__face:has(.tv-face__row)`) flytter kun "Tryk på" op. Se også `ConfirmButton` i `src/ui/screens/child/round/Teaching.tsx`, minikortene i `src/ui/task/task.css:185–200` og `wideFace` i `src/ui/task/registry.ts:88`.

---

## P3 – senere

### QA3b's P3-5 er kun delvist rettet (efterprøvet, P3)

- **Fundet af:** layout. Meldt som delvist rettet og efterprøvet af skeptiker-p3-5, som satte prioriteten til P3, ikke P2.
- **Skærm og format:** fejlflowet i inverseOps mulToDiv i Delekløften. 393×852.
- **Set:**
  - Ved `inv:6x3:18/3` (keypad) og `inv:7x4:28/7` (choice), lagt ind som gemt tur på `w3-division-l1`, viser skærmen "Gange og divideret med hører sammen. 6 gange 3 giver 18. Så giver 18 : 3 = 6.".
  - Stemmen siger "Så giver | atten | divideret med | tre | seks", så to tal står lige efter hinanden. Det gælder alle 20 mulToDiv-fakta, mens div2510 og divAll har 0 (`textcheck.out`).
  - Hvorfor det er P3: matematikken er rigtig, skærmen viser ligningen korrekt, og talen er korrekt dansk. Det er alene et spørgsmål om, hvor tydeligt "tre seks" lyder.
  - Det samme mønster findes i den frigivne 2. kl. (Vekselvandet, addToSub og subToAdd). Dér står tallene også side om side på skærmen: "Så giver 11 minus 9 2." og "Så giver 58 plus 4 62.", 20 af 20 i både tale og skrift. Det er ikke en regression.
  - FIX3c's egen kommentar i `tables.ts` (`soDivided`) kalder netop dette mønster en fejl. `displayText.test.ts` linje 63–67 fastholder den gamle tale for inverseOps, og testen ved linje 73 gennemgår kun div2510 og divAll.
  - inverseOps kom ikke med i den første tur på Delekløftens første sten ad den naturlige vej. Barnet møder hintet først senere i regionen.
- **Burde:** De tre familier i `hint()` siger `num(c,'mid'), op, num(s,'mid'), say('op.giver'), num(x)` ligesom `soDivided`. Så forsvinder "Så giver"-sammenstødet i både lyd og skrift, også i 2. kl., og testen tager inverseOps med.
- **Skærmbilleder:** `artifacts/qa3c/layout/shots/phone-detail-inv-0-teach-4000ms.png`. Skeptikeren: `artifacts/qa3c/skeptiker-p3-5/shots/phone-inject-teach-0-inv_6x3_18_3_0_qa0.png` og `phone-g2-teach-0-inv_9_2_11-9_0_qa0.png` (2. kl.) (logs `log-inject.jsonl` og `textcheck.out`)
- **Fil:** `src/engine/skills/algebra/inverseOps.ts` linje 168–182 (`hint.inverseOps.soGives`, uændret siden `c180167`), `src/ui/hint/displayText.test.ts`

### Nye P3'er (ikke efterprøvet)

Fundene her kommer direkte fra reviewerne (nr. 1–5) og fra en skeptikers sideobservation (nr. 6). De er ikke efterprøvet. Skærmbillederne ligger i `artifacts/qa3c/<dimension>/shots/`.

| # | Skærm / format | Fund | Skærmbillede | Fil | Status |
|---|---|---|---|---|---|
| 1 | onboarding 3. kl., stigen, trin L4, 393×852 (uafhængigt af format) | L4 kan bestås på to spørgsmål, der klares ved at tælle ét trin (10 − 9, 9 − 8, 8 − 7). `saysSomething` udelukker kun operander ≤ 1 og svaret 0, så "9 − 8 = 1" går igennem. Over 2000 seeds af `placementTask` er 574 af 4000 L4-spørgsmål af den slags, og i 28 seeds (1,4 %) er begge L4-spørgsmål det. Barnet kan så få Minusbækken i stedet for Tællelunden. Samme tanke som QA3a's P3-8. | ingen af selve spørgsmålet. Log `indplacering/onb-rwr-phone.log` (svar i=2: `sub:9-8`) og optælling fra `cand.mjs` | `src/engine/placement.ts` (`saysSomething`) | ikke efterprøvet |
| 2 | onboarding 3. kl., stigen → kortet, 393×852 | En genindlæsning efter et bestået trin taber indplaceringen. L5 ✓✓, L7 ✓ og genindlæs giver `{done:false}`, intet seedet og Tabeltoppen som næste sten. De samme svar og "Det er nok" giver `{done:true, highest:'L5'}`, 294 seedede nøgler og første tur i Hundredemarken. Kodens kommentar ("a reload … lands on the map as if it had been skipped") gør det med vilje, men A24 nævner ikke genindlæsning. Et barn, hvis app lukkes efter et bestået trin, starter to verdener højere end med "Det er nok". | `indplacering/…/onb-reload-phone-7-map.png`, `onb-l5x-phone-7-map.png` (logs `onb-reload-phone.log`, `onb-l5x-phone.log`) | `src/ui/screens/child/onboarding/placement/flow.ts` og `store.ts` (run holdes kun i hukommelsen), SPEC A24 | ikke efterprøvet |
| 3 | onboarding, "Hvilken klasse går du i?", 393×852 | "Alle starter i Engdalen." står under de fire knapper, så længe intet er valgt, og "Spil" er grå. På frigivelsen er det ikke sandt for 3. kl., som får stigen og verdenerne bakke, skov og fjeld. Linjen siges ikke (`__voiceLog` har ikke `s.onb.grade.start`). Efter tryk på "3." skifter den korrekt, så det er ikke QA3b's P3-3. | `layout/…/phone-onb-g3-0-before.png` | `src/ui/screens/child/OnboardingScreen.tsx` (`startLine(null, …)` giver `s.onb.grade.start`), `src/ui/screens/child/onboarding/steps.tsx` (`GradeStep`) | ikke efterprøvet |
| 4 | opgave keypad (fractionOfSet), Brøkbageriet, 375×667 | Kortet viser kun brøkstregen "—" i ca. 0,7 s. Ved +200 ms er kortet 96 px højt, linjen er 26×4 px, bunken er 0 px, og boblen «Skriv svaret.» er halvt dækket af svarfeltet. Ved +900 ms bliver runden kompakt med «3/4 af 12» ved siden af bunken. Det sker ved alle tre keypad-opgaver. I `c180167` flød bunken op over kortet i samme overgang, så det er et ændret blink, ikke et tab af indhold. Choice på 375×667 og de andre formater er rigtige fra start. | `net-tekster-udsnit/…/heap-se-0-200.png` (sammenlign `heap-se-0-900.png` og `before-heap-se-0-200.png`) | `src/ui/scenes/askLines.css`, `src/ui/scenes/AskLines.tsx`, `src/ui/screens/child/RoundScreen.tsx` (runden bliver kompakt først 650 ms efter sidste ændring) | ikke efterprøvet |
| 5 | ceremonierne efter Delekløften l1, 852×393 (prod) | Ét tryk på "Næste" på "Din ven er vokset!" (som selv skifter videre, `autoAdvanceMs`) endte i en ny tur ("1 · 3 = ?") 2,6 s efter, at slutskærmen "Også i dag" kom frem, uden tryk dér. Knapperne "Næste" og "Til kortet" sidder samme sted på begge skærme. Set én gang. Det er ikke afgjort, om trykket faldt sammen med det automatiske skift, eller om ét tryk rammer to skærme. I portræt og i de andre ture på tværs blev slutskærmen stående. | `prod-smoke/…/p6-land-w3-division-l1-cer1.png` (før trykket), `p6-land-w3-division-l1-cer2.png` (2,6 s efter), log `p6-land.out` | `src/ui/screens/child/CeremonyScreen.tsx` (`autoAdvanceMs` og knappernes tryk), `src/ui/screens/child/ceremony/flow.ts`, `ceremony/End.tsx` ("nothing starting by itself") | ikke efterprøvet |
| 6 | PlayIntro i tilstanden `tomorrow`, 852×393 | De to knapper når ned til y = 424 i et vindue på 393 px, og intet kan scrolles (doc 393/393). "Blandet øvelse" brydes og skæres nederst. Det er en sideobservation fra skeptiker-nyt-i-morgen, og det ses også i prod-smoke's skærmbillede. | `prod-smoke/…/p3-E-land-w3-tabellen-l2-tomorrow.png`, `skeptiker-nyt-i-morgen/…/sk2-land-dag2-w3-tabellen-l2.png` | sandsynligvis `src/ui/screens/child/play/PlayIntro.tsx` og `play.css` | ikke efterprøvet (sideobservation) |

## Hvad virker godt

1. **QA3b's rettelser holder, og de vigtigste er set af flere dimensioner hver for sig.**
   - Koordinatnettet står stille fra første berøring i fire formater, også i den rigtige mesterprøve og i prod. Med samme script i `c180167` kommer fejlen igen præcis som beskrevet, så testen rammer det rigtige.
   - "Det lærte du" med ure passer på 375×667 både i dev og i prod.
   - Isbjørnen har snude, næse og mund overalt, hvor hovedudsnittet bruges, og de 15 andre arters udsnit er uændrede.
2. **Indplaceringen følger A24.**
   - Motorens starttabel matcher FIX3e's tabel for alle 14 trin og 9 kanter (L1–L3 Tællelunden, L4 Minusbækken, L5 Hundredemarken, L6–L8 Tyvebroen, L9–L11 Stortalsbjerget, L12 Gangegrotten, L13–L14 Tabeltoppen).
   - 18 onboardinger med fingeren i fire formater lander dér, hvor A24 siger: første tur, hjemverden, kortets næste sten og `placement.failed`. Det gælder også søskende, genindlæsning midt i stigen, eksport og import.
   - Ingen region i kæderne `figurer`, `klokken` eller `pengeMaal` er sprunget over i nogen kørsel, og Markedet, Arealhaven, Brøkbageriet og Minuttårnet står som "Lær nyt".
   - Takken og den neutrale slutlinje følger `placementCounts`. Stigen giver 0 perler og 0 XP, og svarene logges som `placement` og tæller ikke i statistikken.
   - Stigen tilbydes 3. kl. uden `?worlds=all`, og 0.–2. kl. er uændret i forhold til `c180167`, bortset fra punktummet i målene.
3. **Det, der kun stod i lyden, står nu på skærmen.**
   - ¾ på to tallerkener, «3/4 af 12», hen/op, «(6, 1)», størst/mindst og «færrest» står i boblen og på kortet, både ved første spørgsmål og ved genforsøg.
   - Den korte instruktion udelades kun, når spørgsmålet selv slutter med boblens ord.
   - 70 opgaver i 0.–2. kl. har identisk boble og oplæsning før og efter.
4. **Billederne bliver i kortet på små skærme og på tværs.** Det gælder skæv deling som «?», de 20 halvtredsører, hjælpens seks mønter, ligninger med enheder på tværs, Arealhavens net på SE, figurerne i flervalg, det digitale ur i "Tryk på" og uret i opgavekortet. "Tryk på" med en række figurer eller mønter står nu over rækken, og det er bedre end før.
5. **Træk på tværs.** Tallinjen (0–100 og 0–1000) og sortOrder lander rigtigt 34/34 på 852×393.
6. **Prod-buildet holder.**
   - `npm run build` er grønt og under budget.
   - En ny enhed går hele vejen med fingeren: forældreintro, lydtjek, navn, æg, ven, klassetrin, stige, kort og ture.
   - 13 ture i 6 af 7 regioner og 2 beståede mesterprøver. Opgavetyperne clockSet, pay med byttepenge, share, grid, colorParts, sortOrder, multiSelect, fillSlots, buildBase, keypad og choice er mødt og besvaret.
   - Ceremonierne har konkrete kort, finalen er låst med en klar sætning, og forældredelen har 7 faner og anbefaler Delekløften.
7. **Rækværket (§13) holder.** Der var 0 konsolfejl i alle kørsler, og i prod også 0 advarsler og 0 fejlede requests i 31 kørsler. Der var ingen vandret scroll og ingen børneknapper under 60 px på 393×852, 375×667 og 852×393.

## Dækning: hvad der ikke blev tjekket

- **Stemmen:** oplæsningen er kun tjekket som klip-id'er i `__voiceLog`, og lyden er ikke lyttet igennem.
- **Indplacering:**
  - Hjemmetippet til add1000 er kun læst i kilden, fordi R2 ikke blev udløst.
  - Stigen uden verificeret lyd (hear-trinene udeladt) er ikke kørt i UI'et.
  - P = L9–L11 og L1–L3 er kun tjekket i motoren. L1–L3 kan ikke nås fra 3. kl.'s start i L5.
  - Stigen er ikke kørt på iPad på tværs (1180×820).
  - I prod er "Spring over", "Det er nok" efter ét svar og genindlæsning midt i stigen ikke kørt.
- **Layout:**
  - iPad 820×1180 er ikke kørt i layout-dimensionen. Skeptikerne har dog målt P2-9, P2-12 og mønterne dér.
  - P2-10 er ikke set i selve Markedets prøve, kun med samme opgave i l1-turen.
  - P2-9 a) er ikke set på SE.
  - Tastaturets "40 kr" (P3-2) er ikke tjekket, fordi der ikke findes nogen kronerOre-tastaturopgave.
  - Regression af rækker og hjælpemønter er kun kørt på 393×852 i layout. Skeptikeren målte mønterne i de andre formater.
  - Andre regioner i 0.–2. kl. end de nævnte er ikke kørt, og det er ikke tjekket, om ligninger med lange ord i 0.–2. kl. er blevet mindre (`equationEm` tæller nu ordlængde).
- **Net, tekster og udsnit:**
  - Hjælpen og lyspæren for koordinater og brøker er ikke kørt.
  - Æggets ceremonivalg ved et ægte klæk er ikke set (det bruger samme `PickAnimal` som regnbuevalget), og isbjørnen er ikke set på 1180×820.
  - Gyldne æg med de nye familier er ikke kørt, og hele Brøkbageriet og finalen er ikke spillet i rigtigt spil.
  - Et barn, der lader en ekstra finger hvile på skærmen (`useFingerDown`), er ikke afprøvet.
- **Prod-smoke:**
  - Finalen er ikke spillet, for kun 2 af 5 prøver blev bestået.
  - Delekløften er kun spillet på 852×393, og grid "Sæt punktet" er kun mødt på 852×393.
  - iPad er kun brugt til forældredelen.
  - Dyrehave, garderobe, butik og bøger er ikke åbnet.
  - 0.–2. kl. er kun kørt til første tur og kortet.
  - Forældredelens trykmål er ikke vurderet, og trykmålstjekket dækker ikke SVG-flader som nettet og uret.
- **QA3b's fund, der ikke var med:** P3-1, P3-6 til P3-8, P3-10 til P3-12, P3-14 til P3-18 og P3-24, samt kommaet i P3-9 (clockDigital handsSwapped). Mønstret fra P3-1 ses stadig i addHalves (P2-5).
- **Andet:**
  - 4× CPU-throttle og "Erstat …s data" er ikke kørt.
  - Et barn i 3. kl., der er oprettet direkte i scriptet uden onboarding, har Minuttårnet låst (kræver w2-klokken). Efter onboardingen er det åbent. Layout åbnede derfor fjeldet som ved "Åbn hele". Om forskellen betyder noget, er ikke vurderet.
- **Procesfejl:** to kørsler af `parent.mjs` i indplacering (ca. 4 min i alt) kørte ved en fejl uden `flock` om `/tmp/tv2-chromium.lock`. Alle andre Chromium-kørsler kørte bag låsen.

## Tilbagevist under efterprøvningen

- **Ingen fund blev tilbagevist.** Alle syv indmeldte P2'ere blev genskabt af skeptikerne. Ét af dem (QA3b's P3-5, inverseOps) blev sat ned til P3.
- **Afvist af reviewerne og skeptikerne selv og derfor ikke meldt:**
  - "504 Outdated Optimize Dep" og hvid skærm efter stigen skyldtes den delte vite-cache (miljøet), ikke appen.
  - "Tryk på" med en række figurer eller mønter i Formværkstedet og Købmandsgården ser anderledes ud end i `c180167`, men ændringen er en forbedring (før løb figurerne 29 px ud af boksen, og mønterne stod lodret).
  - På 852×393 er opgavekortet skjult i fejlflowet ved addHalves, og møntbakken står i panelet. Det ser tilsigtet ud ud fra layoutet på tværs.
  - `shots/grid-B-*-error.png` i net-tekster-udsnit og én kørsel af Minuttårnet på tværs i layout ("drive: ingen opgave") var fejl i scriptene. Kørslerne er kørt om uden problemer.

## De ændringer, der løfter mest før frigivelse

1. **Lad "Lær mere" starte på en ny læringsdag (P2-1).** Lad `chooseStart` kun give `tomorrow`, når dagens nye nøgler faktisk er brugt (A13/A15). Alternativt kan `buildRound` fylde op med stenens egne nøgler, før den tager review-nøgler fra andre skills. Tjek bagefter de 10 sten, som `breadth.out` peger på.
2. **Fjern det faste loft over hjælpens mønter (P2-2).** Det er en regression i verdener, der allerede er frigivet. Krymp kun det, der ikke passer (som `rowFit`), og bevar mønternes indbyrdes størrelse.
3. **Lad R6 følge indplaceringen (P2-3),** så forældrene ikke får "Klar til: Tabeltoppen" om et barn, der starter i Hundredemarken eller Tællelunden.
4. **Sæt `is-teaching` på stigens rod (P2-4),** så fejlforløbet på tværs får hele bredden som i en almindelig tur.
5. **Gør resten af layoutet færdigt på SE (P2-5 og P2-6).** Prisskiltene skal krympe med varen, og "Tryk på …" med fire figurer skal passe i svarboksen.
6. **P3-5:** lad inverseOps sige "18 divideret med 3 giver 6" ligesom `soDivided`. Det retter også "Så giver 11 minus 9 2." i 2. kl.
