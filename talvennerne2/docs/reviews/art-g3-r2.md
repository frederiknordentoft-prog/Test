# Kunst-review, bølge 3 runde 2 (G3 · r2): målrettet gen-tjek af sofaen og vægt-tingene, isbjørnen, pingvinen og Stjernefjeldets graner

- **Reviewer:** REV9b. Jeg er frisk og uafhængig. Jeg har ikke tegnet noget af kunsten og har ikke været med i tidligere review-runder eller blindtests.
- **Opgave:** Gen-tjekket G3-r2 af ARTFIX-G's rettelser efter `art-g3-r1.md`:
  - sofaen (P1) og designsidens række med vægt-tingene (P2),
  - isbjørnen (T2/B2, T1, A1 og A2),
  - pingvinens sand/creme og guld (A3),
  - fjeldets graner (S2).

  Derudover har jeg taget stilling til, om scenen stadig består med S1 urettet.
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §6, §7 og "Ændringer" (A17), `art-g3-r1.md`, `art-g3-r1-blind.md`, `pikto-r1.md` og `pikto-r2.md`.
  - **Kontaktarkene** i `/home/user/wt/rev9b-sheets/` (integratorens kopi, lavet fra HEAD adbfa49).
  - **Designsiden og svarkortene:** dev-serveren på port 4398 med Chromium bag `flock`. Serveren er stoppet via sin PID bagefter.
- **Blindtesten:**
  - `art-g3-r2-blind.md` blev committet (0faeacf), før rubrik, reviews, kode og kontaktark blev åbnet.
  - `silhouettes.png` er pixelidentisk med blindarket `sheet-r9b.png`: SHA-256 `50622baf…2d2390` for begge.
- **Uafhængighed:**
  - **Kode, jeg har åbnet:** Kunstens kildekode har jeg kun åbnet efter blindtesten og kun for at:
    - beregne facit: silhuetrutens blanding i `SheetApp.tsx`, `SPECIES_IDS` og `BREEDS` i `engine/types.ts` og racernes rækkefølge i de fire artsfiler (og fit-arkets rækkefølge i `SheetApp.tsx` for at finde rækkerne),
    - finde designsidens række og tingenes geometri: `MaterialsPage.tsx`, `UNIT_THINGS` i `kit2.ts` og `case 'sofa'` i `objects.tsx`,
    - sætte svarkortene op: `unitChoice.ts`, `faces.tsx`, `examples.ts` og `browser.mjs`,
    - måle og forklare fundene: `rig.css` (snusets keyframes), `earMode` i hattenes filer, isbjørnens ører og snude i `polarbear.tsx` og diff'en af `polarbear.tsx`, `objects.tsx`, `MaterialsPage.tsx` og farvefilerne mod 35502c5,
    - forstå snapshot-blokkene til regressionen: Astronauts `items.test.tsx` og diff'en af `stjernefjeldet.test.tsx`.
  - **Før blindtesten:** I worktree brugte jeg kun git (`status`, `log`, `config` og `ls-files --error-unmatch` på en kendt sti). `git log --oneline` viste emnelinjen for ARTFIX-G's commit. Den nævner de rettede punkter, som briefen også gør, og intet om silhuetternes rækkefølge.
  - **Udsnittene fra blindtesten** ligger i `/tmp/tv2-blind9b/crops/`, altså inden for den tilladte mappe.
- **Metode:** Arkene er set i oversigt og derefter i udsnit med 0,45–4× zoom. Hullerne er tjekket maskinelt i `holes.png`: lukkede magenta-områder på mindst 3 px i pingvinens og isbjørnens 120 fliser. Snusets bevægelse er målt som næsens tyngdepunkt pr. frame i filmstrimlens nærbillede.
- **Koordinater og skala:** som i G3-r1 (pixel i PNG'en, 2x, skrevet som (x0–x1, y0–y1); systemet står i `art-g3-r1.md` bilag A). 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".

## Resultat

**Gate G3-r2: bestået.** Sofaen læses nu som en sofa, og alle ARTFIX-G's rettelser holder. Isbjørnen og pingvinen ligger over kravet, og scenen og Astronaut-sættet består fortsat. Der er ét nyt, lille fund (T5: Legendekronen skjuler isbjørnens ører). Det blokerer ikke.

| Krav | Resultat |
|---|---|
| Silhuetterne giver 72/72 rigtige og ≥ 68 sikre, uden de forvekslinger, G3-r1 nævner for de fire nye arter | **Opfyldt.** 72/72 og 72 sikre. De fire nye arter er 12/12 sikre, og ingen af forvekslingerne forekom (§1). |
| Piktogrammerne giver 5/5 ved 78 px, og stilen er ≥ 4 | **Opfyldt.** 5/5 ved både 46 og 78 px, alle sikre. Stilen er 4,4 (§2). |
| Isbjørn og pingvin har alle 10 kriterier ≥ 4 og middel ≥ 4,3 | **Opfyldt.** Isbjørnen har middel 4,5 og pingvinen 4,6. Laveste score er 4 for begge (§3 og §4). |
| Scenen og Astronaut-sættet består fortsat | **Opfyldt.** Scenens middel er 4,6 med S1 som accepteret forbehold. Astronaut-sættet har pasform 4 og butikskort 4 (§5 og §6). |

| Del | G3-r1 | G3-r2 | Afgørelse |
|---|---|---|---|
| Piktogrammer (78 px / stil) | 4/5 / 4,4 | **5/5 / 4,4** | **Bestået.** P1 og P2 er rettet. |
| Isbjørn (middel) | 4,4 med fire forbehold | **4,5** | **Bestået.** T2/B2, T1, A1 og A2 er rettet. Ny lille fejl: T5. |
| Pingvin (middel) | 4,5 | **4,6** | **Bestået.** A3 er rettet. |
| Pegasus og drage | 4,6 og 4,7 | uændret | **Bestået.** Hverken deres filer eller deres snapshot-nøgler er ændret (§7). |
| Stjernefjeldet | 4,6 | **4,6** | **Bestået.** S2 er rettet. S1 er accepteret (§5). |
| Astronaut-sættet | 4 / 4 | **4 / 4** | **Bestået.** T3 er rettet på isbjørnen. |

## Status pr. punkt fra G3-r1

| # | Punkt | Status | Belæg |
|---|---|---|---|
| P1 | Sofaen læses som en lænestol | **Rettet** | Jeg læste den blindt som "sofa", sikkert ved både 46 og 78 px. Den er nu 44 × 25 enheder (ca. 1,8 : 1) med tre ryghynder og tre sædehynder. Armlænene er lave og smalle, og toppen ligger 7,5 enheder under ryggens top. §2. |
| P2 | Designsiden viser ikke vægt-tingene | **Rettet** | `MaterialsPage.tsx` har sektionen "Ting man vejer" med alle 8 vægt-ting i 46, 78 og 104 px. |
| P3 | Cyklens stel er tyndt ved 44–46 px | **Åben, lille** | `case 'bike'` er uændret. Cyklen blev alligevel læst sikkert blindt ved 46 px. |
| T1 | Isbjørnens ører forsvinder under alle hovedgenstande | **Rettet, med én undtagelse** | `earBaseL/R` er flyttet 5 enheder ud (76→71 og 126→131), og ørerne tegnes over hatten med den rundede "hattede" form. De titter frem ved kanten af hue, tropehjelm, ridehjelm, diadem, rumhjelm, ridderhjelm, troldmandshat, pirathat, regnbuehue og festhat i alle tre stadier (`fit-polarbear.png` hovedrækkerne r = 0, 6, …, 48 og 50). Undtagelsen er Legendekronen (r = 49), som stadig dækker ørerne. Den står som ny fejl T5. |
| T2 | Forbenet skjuler lup, gulerod, scepter og kikkert | **Rettet** | Genstandene tegnes foran benet, og poten (benet under knoerne, med tæer og kløer) ligger over den nederste del. I alle 9 celler i rækkerne opdager-, rytter-, kongelig- og pirat-hand ses ca. 80–90 % af genstanden. Det gælder også slikkepind, ballon og stjernestav og isbjørnens rækker i `fitmatrix-*`. Kravet var mindst 2/3. §3. |
| B2 | Isbjørnens håndkort viser kun en stump | **Rettet** | Kortene "på dyret" i `sizes-polarbear.png` (2404–2844 ved y0 = 3392, 3544, 3696 og 4304) viser hele genstanden med poten om grebet. Genstanden fylder ca. halvdelen af kortets højde. |
| A1 | Regnbue-isbjørnen læses som en mintgrøn isbjørn | **Rettet** | Kroppen er nu varm hvid med lilla kontur. Smækken bærer de fire flade striber over forbenene og flanken, og halestumpen og ørernes inderside har dem også. Striberne ses i hvile i alle tre stadier og ved 48 px (`species-polarbear.png` (1964–2204, 320–1470) og `sizes-polarbear.png` kort 8). |
| A2 | Snuse-næsen er svag | **Rettet** | I nærbilledet løfter næsen sig ca. 12 px (2x) ved 0,45 s. G3-r1 målte ca. 6 px. Næsen bevæger sig ca. 9 px i forhold til øjnene, svarende til 6,8–8 enheder i `rig.css`. Der er tre snus med squash og overshoot, og hovedet løfter sig. §3. |
| A3 | Pingvinens sand/creme og guld ligner en ælling | **Rettet** | c6 (nu "creme", café crème) har kaffebrun ryg og hætte over en cremehvid front. Guld har en dyb ravguld ryg over en lys guldfront. Smoking-kontrasten holder også ved 48 px og i en 1x-simulering. §4. |
| A4 | Pegasus' c1, c2 og c4 ligger tæt | **Åben, lille** | Uændret. Ingen snapshot-nøgle for pegasus er ændret. |
| T3 | Raketten på de lange forben har ingen hånddel | **Rettet på isbjørnen, åben på de andre** | Isbjørnens tåspidser ligger over rakettens nederste finne og over stjernestaven. Kat, hest, drage og de andre lange forben er uændrede. Ikke blokerende. |
| T4 / B3 | Dragens lup og gulerod sidder delvist bag forbenet | **Åben, lille** | Uændret. |
| B1 | Jetpackens kort "på dyret" | **Accepteret, uændret** | – |
| S1 | Himlen fylder ca. 65 % i 820×1180 | **Åben, accepteret** | Uændret. Scenen består stadig (§5). |
| S2 | Skovbåndet gentager samme gran | **Rettet** | Der er tre granformer (smal og høj, bred og en med mere sne), og højden varierer. Båndet ser ikke længere stemplet ud. §5. |
| – | Pingvinens lyserøde kind oven på næbbets venstre del (G3-r1 §2.2, kriterium 10) | **Åben, kosmetisk** | Uændret (`closeup-penguin.png` (350–410, 695–725)). |

## 1. Blindtesten

**Facit** er beregnet ud fra silhuetrutens blanding i `src/dev/SheetApp.tsx` (`SilhouettesSheet`, `BLIND_SALT` 22,1). Arterne følger `SPECIES_IDS`-rækkefølgen, racerne `BREEDS`-rækkefølgen (som er lig artsfilernes), og stadierne er 2, 1 og 3. Figurerne er sorteret efter `(sin(i · 12,9898 + 22,1) · 43758,5453) % 1` med JavaScripts fortegn. Facit er beregnet i Node og sammenlignet med mine svar ét for ét, maskinelt.

| | Resultat |
|---|---|
| Rigtige på art | **72/72** |
| Sikre / usikre | **72 / 0** |
| De fire nye arter | **12/12 sikre:** pegasus #15, #26 og #35, drage #10, #14 og #17, pingvin #6, #44 og #46, isbjørn #40, #41 og #66 |
| Stadierne | Alle 29 noter, der angiver stadiet ("lille", "mellem" eller "stor"), passer. |
| Racerne | Kanin, kat og hest er grupperet rigtigt i noterne: upright #9, #16 og #22, løvehoved #23, #24 og #53, vædder #21, #28 og #33, maine coon #19, #20 og #30, huskat #39, #45 og #48, langhår #38, #59 og #69, araber #1, #27 og #31, shetland #42, #49 og #70 og fjordhest #50, #64 og #71. Langhårskattens brystkrave beskrev jeg forkert som en "løftet pote", men arten er rigtig. Enhjørningens tre racer har jeg ikke skilt i noterne. Det kræver testen ikke. |

**Facit pr. art** (alle 72 er lig med mine svar):
- kanin #9, #16, #21, #22, #23, #24, #28, #33, #53
- kat #19, #20, #30, #38, #39, #45, #48, #59, #69
- hvalp #2, #7, #11
- pindsvin #34, #37, #61
- hest #1, #27, #31, #42, #49, #50, #64, #70, #71
- lam #3, #25, #36
- ræv #5, #51, #52
- hamster #47, #56, #62
- enhjørning #4, #8, #12, #18, #29, #32, #54, #58, #65
- panda #13, #43, #68
- egern #55, #57, #72
- ugle #60, #63, #67
- pegasus #15, #26, #35
- drage #10, #14, #17
- pingvin #6, #44, #46
- isbjørn #40, #41, #66

**Isbjørnens ører** (grunden til de nye silhuetter): Ørerne er klippet uden for hovedet, så de uden hat sidder bag hovedet som før, og silhuetten er den samme lave trekvartprofil med lang snude og fisk. Jeg læste alle tre som isbjørn uden tøven. Ingen af dem frister til panda (bambus og rundt hoved forfra), hamster (kindposer) eller hvalp (hængeører).

**De vigtigste forvekslingspar** (fra blindfilen). Ingen af dem gav en usikker figur.
1. **Vædderkanin og hvalp:** Ørerne alene kunne være hvalpens. Pomponhalen og hårtotten afgør det.
2. **Fjordhest og hest med krone eller enhjørning med skjult horn:** Den flade, takkede manke kan ligne en krone. Det er arkets mindst lærebogsagtige hestesilhuet. Hest og enhjørning skilles som i G3-r1 kun af hornets spids.
3. **Langhårskat og hamster:** Brystkraven giver runde former under hovedet. Spidse ører og knurhår afgør det.
4. **Isbjørn, panda og hamster** (runde ører): Isbjørnen har snude og fisk, pandaen bambus og hamsteren kindposer.
5. **Pegasus og ugle eller drage** (vinger): Fjerkant og hestehale mod øredusk eller hudvinger og spadehale.
6. **Ræv og kat:** Kindtakker mod knurhår.

**Forbehold om bias:** Som REV7–REV9 har jeg set alle 72 figurer på én gang, kendt de 16 arter fra briefen og efter førstegangsvurderingen tjekket, at fordelingen går op (12 arter × 3 og 4 arter × 9). Tjekket ændrede intet svar, men min sikkerhed er snarere for høj end for lav.

**Piktogrammerne** (blindt i 46 og 78 px, rettet mod designsidens række "Ting man vejer"):

| # | Ting (facit) | Mit svar 46 px | Mit svar 78 px | Rigtigt (46/78) |
|---|---|---|---|---|
| 1 | hund (`dog`) | hund (hvalp) | hund (hvalp) | ja / ja |
| 2 | sofa (`sofa`) | sofa | sofa | ja / ja |
| 3 | brev (`letter`) | brev (kuvert) | brev (kuvert) | ja / ja |
| 4 | cykel (`bike`) | cykel | cykel | ja / ja |
| 5 | kuffert (`suitcase`) | kuffert | kuffert | ja / ja |

46 px: 5/5. 78 px: 5/5. Alle ti svar er markeret sikre.

## 2. Sofaen og de fem vægt-ting

**Grundlag:**
- min blindtest,
- designsidens række "Ting man vejer" i 46, 78 og 104 px (1180 px bred og 2x) ved siden af "Ting man måler" og de tællelige ting,
- svarkortene i appens egen stil: harnessens `multi-unit` med vægt-tingene byttet ind i netværkslaget, så intet i worktree er ændret. Kortene er brev, hund, fjer, sofa, kuffert og cykel med `family: 'weight'` og `s.unitChoice.tapKg`, optaget i 6 formater (`demo=0`).

| Ting | Blind 46 / 78 px | Stil 1–5 | Note |
|---|---|---|---|
| Sofa | rigtigt / rigtigt | 4 | Bred, lav tre-personers sofa med tre plus tre hynder og lave, smalle armlæn. Den kan ikke længere læses som en stol, heller ikke ved 44 px på se-l. Hyndernes kontur (1,6) er tyndere end hovedkonturen, men holder. Til 5 mangler en smule dybde, fx skygge under sædets forkant. |
| Hund | rigtigt / rigtigt | 5 | Uændret. Charmerende og i husets stil. |
| Brev | rigtigt / rigtigt | 4 | Uændret. Klar kuvert med hjertesegl. |
| Cykel | rigtigt / rigtigt | 4 | Uændret (P3 er åben). Hjul og sadel bærer den. |
| Kuffert | rigtigt / rigtigt | 5 | Uændret. |

Middel for stil: 4,4.

**Stil:** Sofaen bruger samme system som nabotingene: flad fyld fra materialepaletten (`MAT.bar`), lyse hynder, hvidt højlys, mørkere sædefront og en farvet kontur afledt af fyldet. Den står naturligt ved siden af fjer, jordbær og nøgle.

**Billede og ord på kortet** (6 formater, målt i DOM'en):

| Format | Billede | Kort | Ordet inden for kortet / klippet |
|---|---|---|---|
| se-p | 48 px | 108 × 102 | ja / nej (alle 6) |
| se-l | 44 px | 82 × 85 | ja / nej (alle 6) |
| x-p | 60 px | 114 × 105 | ja / nej (alle 6) |
| x-l | 44 px | 82 × 85 | ja / nej (alle 6) |
| ipad-p | 84 px | 207 × 146 | ja / nej (alle 6) |
| ipad-l | 84 px | 170 × 146 | ja / nej (alle 6) |

- Billede og ord passer sammen på alle kort. Det svar, G3-r1 fandt problematisk ("en sofa" under en lænestol), er væk: Ordet bekræfter nu billedet.
- "en kuffert" står helt på se-l.

## 3. Isbjørnen

### 3.1 Scores

| # | Kriterium | G3-r1 | G3-r2 |
|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 |
| 2 | Silhuet | 5 | 5 |
| 3 | Proportioner | 4 | 4 |
| 4 | Kontur | 5 | 5 |
| 5 | Palet | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 |
| 7 | Pasform | 4 | 4 |
| 8 | Animation | 4 | **5** |
| 9 | Butikskort ved 64 px | 4 | 4 |
| 10 | AAA-finish | 4 | 4 |
| | **Middel** | **4,4** | **4,5** |

### 3.2 Begrundelser

1. **Genkendelighed ved 48 px, 5:**
   - Alle otte farver og glad og sover (`sizes-polarbear.png` kort 1–10, y0 = 268) læses straks som isbjørn: lav trekvartprofil, lang snude, små ører og fisk.
   - Regnbuen (kort 8) har nu tydelige striber og ligner ikke længere en farvevariant.
   - Ved siden af pandaens, hamsterens og hvalpens 48 px-rækker kan den ikke forveksles.
2. **Silhuet, 5:** 3/3 sikre i blindtesten (#40, #41 og #66). De flyttede ører ændrer ikke silhuetten, fordi de er klippet uden for hovedet uden hat.
3. **Proportioner, 4:** Uændret fra G3-r1. Kroppen er den dominerende masse i stadie 3 (`lineup.png` (16260–17310, 800–1220)). Det er ikke en fejl, og det blev ikke bedt rettet.
4. **Kontur, 5:**
   - Grebets klip har en blød, buet knofold.
   - De hattede ører har artens kontur, og regnbuesmækken ligger inden for kroppens kontur.
   - `holes.png` har ingen lukkede magenta-områder i isbjørnens 60 fliser (min skanning, grænse 3 px), og lint'en er grøn.
5. **Palet, 4:**
   - A1 er rettet. Den mintgrønne krop er afløst af en varm hvid med lilla kontur, og striberne er flade pastelstriber som rubrikken kræver. Guld har ravkontur, ravskygge og glansbånd.
   - Hvid, creme, lyseblå, lavendel og lyserød (c1, c2, c3, c5 og c6) ligger stadig tæt ved 48 px, som G3-r1 skrev. Derfor 4.
6. **Ansigtets appel, 5:** Uændret. Snuset skæmmer ikke ansigtet: Næsen vipper op og trykkes flad, og næsefuren følger med (`closeup` og filmstrimlen).
7. **Pasform, 4:**
   - **T2:** Lup, gulerod, scepter og kikkert holdes nu foran benet med poten om den nederste del. Det samme gælder slikkepind, ballon, raket og stjernestav.
     - I `fit-polarbear.png`'s hånd-rækker (r = 5, 11, 17, 23, 29, 35, 41, 47 og 56) og i isbjørnens rækker i `fitmatrix-*` (r = 45–47, kolonnen "hånd") ses 80–90 % af hver genstand i alle celler.
     - Grebet er troværdigt: Tæerne og kløerne ligger over håndtaget som en pote, der holder det ned mod jorden.
     - Løftede poter (glad, jubel og vink) holder genstanden ved spidsen som før.
   - **T1:** Ørerne titter frem ved kanten af 10 af 11 hovedgenstande: gennem `through`-huller i huerne, hjelmene og hattene og ved siden af festhatten (`under`).
   - Ørerne ved huen sidder lavt på hattens sider og ligner lidt knapper. Det er den aftalte `through`-konvention og troværdigt nok.
   - **Under 5:** Legendekronen skjuler stadig ørerne (T5). Desuden gælder G3-r1's begrundelse om de kendte begrænsninger fra G2.
8. **Animation, 5 (op fra 4):**
   - Nærbilledet af signaturen (`filmstrip-polarbear.png` (64–2914, 3088–3500)) viser et tydeligt snus: Næsen løfter sig 12,4 px ved 0,45 s og 10,0 px ved 0,70 s, er på vej op igen ved 0,95 s og falder til ro med overshoot ved 1,20–1,45 s.
   - Øjnene løfter sig samtidig 3–4,5 px (hovedet mod luften).
   - Snuset ses også i hvile-rækken ved 0,40 s uden at sammenligne frames.
   - Ved 48 px er det ca. 2 CSS-px, på størrelse med kaninens næsevip.
9. **Butikskort ved 64 px, 4:**
   - B2 er rettet. Alle fire håndkort "på dyret" viser hele genstanden med poten om grebet, og genstanden fylder ca. halvdelen af kortets højde.
   - Til 5 mangler tættere beskæring af hånd- og jetpack-kortene (B1), som for alle arter.
10. **AAA-finish, 4:** Gennemført og charmerende: regnbuesmækken, ørernes regnbueinderside, grebet med tæer og kløer og snuset med squash. Til 5 mangler T5.

## 4. Pingvinen

| # | Kriterium | G3-r1 | G3-r2 |
|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 4 | **5** |
| 2 | Silhuet | 5 | 5 |
| 3 | Proportioner | 5 | 5 |
| 4 | Kontur | 5 | 5 |
| 5 | Palet | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 |
| 7 | Pasform | 4 | 4 |
| 8 | Animation | 5 | 5 |
| 9 | Butikskort ved 64 px | 4 | 4 |
| 10 | AAA-finish | 4 | 4 |
| | **Middel** | **4,5** | **4,6** |

- **A3 er rettet:**
  - **c6 (creme):** Den har kaffebrun ryg og hætte (`#8E6B4C`, kontur `#4A3220`) over en cremehvid front (`species-penguin.png` x0 = 1476).
  - **Guld:** Den har en dyb ravguld ryg (`#D08A22`) med ravkontur over en lys guldfront (x0 = 1720) og brændt orange næb.
  - **Ved 48 px** (`sizes-penguin.png` kort 6–7) og i en 1x-simulering læses begge straks som pingvin. Den mørke ryg og de mørke luffer står mod den lyse front. Derfor er genkendelighed hævet til 5. Guld er stadig den farve, der ligger nærmest en kylling, men pærekroppen og smoking-kontrasten bærer den.
- **Palet, 4:** c1 og c2 (sort og skifergrå) ligger stadig tæt, som G3-r1 skrev.
- **Intet andet er blevet dårligere:** Kun nøglerne `penguin/std/{1,2,3}/c6` og `…/gold` er ændret (6 af pingvinens snapshot-nøgler). Alle andre farver, humør og genstande er byte-identiske. `holes.png` har ingen lukkede områder i pingvinens 60 fliser.
- Den lyserøde kind, der ligger oven på næbbets venstre del, er uændret. Den er kosmetisk og trækker ikke under 4.

## 5. Scenen: Stjernefjeldet

| # | Kriterium | G3-r1 | G3-r2 |
|---|---|---|---|
| 1 | Komposition og mellemgrund | 4 | 4 |
| 2 | Dybde og luftperspektiv | 5 | 5 |
| 3 | Lys fra én retning | 5 | 5 |
| 4 | Verdenslogik | 5 | 5 |
| 5 | Progression | 5 | 5 |
| 6 | Samspil med kortet | 4 | 4 |
| 7 | Palet | 5 | 5 |
| 8 | AAA-finish | 4 | 4 |
| | **Middel** | **4,6** | **4,6** |

- **S2 er rettet:**
  - Skovbåndet (`scene-fjeld/1180x820-silver.png` (330–1400, 900–1100) og (1680–2360, 880–1200)) har nu tre granformer: smal og høj med flere etager, bred og lav og en med mere sne.
  - Højden varierer, og de forreste graner står spredt. Båndet læses som skov og ikke som et stempel.
  - Lint'en melder stadig 362 elementer og `blankMax` 0,65 %.
- **S1 er urettet:**
  - I `820x1180-*.png` fylder himlen stadig ca. 60–65 %, og kendemærkerne ligger i den nederste tredjedel. I guld fylder nordlyset den øverste del af himlen.
  - Jeg har ikke optaget det levende kort igen. Panelet er uændret ud over granerne, og G3-r1's måling i appen gælder derfor stadig: Panelet og kortene i højre kolonne dækker det meste af himlen, og kendemærkerne står i god størrelse.
  - **Min afgørelse:** Scenen består fortsat med komposition 4. S1 forhindrer et 5-tal for komposition og AAA-finish, men ikke gaten.

## 6. Astronaut-sættet

Sættet er uændret på 15 arter. På isbjørnen ligger tåspidserne nu over rakettens nederste finne (T3), og raketten ses helt (`fit-polarbear.png` r = 29 og `fitmatrix-astronaut.png` r = 45–47). Hjelmen viser isbjørnens ører ved kanten. Pasform 4 og butikskort 4 som i G3-r1. **Bestået.**

## 7. Regression

- **Snapshots:** `git diff 35502c5 -- '*.snap' | grep '^-  "'` giver 165 nøgler. Samme 165 nøgler er tilføjet igen, og ingen nøgle er forsvundet.
  - **`astronaut/…/items.test.tsx.snap`:** 96 nøgler, alle i blokken `hash-regression · polarbear` (nøglerne er `astronaut-*/std/…` og `astronaut-*/<humør>` inden i isbjørnens blok).
  - **`stjernefjeldet.test.tsx.snap`:** 69 nøgler:
    - 27 i `Stjernefjeldet · polarbear > hash-regression pr. (art, race, stadie, farve)`,
    - 36 i isbjørnens genstands-fit (hverdag-head, -body, -back og fest-head),
    - 6 i pingvinens (c6 og guld i 3 stadier).
  - **Kun isbjørnens og pingvinens nøgler er altså ændret.** Pegasus', dragens og de 12 tidligere arters nøgler er urørte.
- **Lints:** `lint.json` dækker 113 ark og har 0 fejl. Hver PNG i mappen har en post. Isbjørnens fit-ark har `maxAnimal` 87 (≤ 90) og `maxItem` 17 (≤ 25), og `fitmatrix-astronaut` har 336 celler uden tomme felter.
- **`lineup.png`:** De 12 arter står uændret. Isbjørnen, pingvinen, pegasus og dragen står på samme jordlinje i samme stil.
- **`holes.png`:** Min skanning af pingvinens og isbjørnens 120 fliser (#1432–#1551) fandt ingen lukkede magenta-områder på 3 px eller mere, heller ikke ved regnbuesmækken og grebet. Lint'en har 1551 figurer og 0 fejl.

## 8. Nye fejl

Nummereringen fortsætter efter G3-r1.

**T5. Legendekronen skjuler isbjørnens ører. Lille, ikke blokerende.**
- **Hvor:**
  - `fit-polarbear.png`, rækken milepael-krone (r = 49, y0 ≈ 14846, alle 9 celler fra x0 = 256),
  - "milepael 1 · hele sættet" (r = 67, y0 ≈ 20203),
  - `fitmatrix-milepael.png`, isbjørn r = 45–47 (y0 = 13240, 13528 og 13816), kolonnen milepael-krone (x0 = 262),
  - `closeup-polarbear.png`, "std · 3 · c5 · milepael 1 · idle" (64–696, 5348–6121) og "std · 2 · c2 · milepael 1 · wave" (724–1355, 5348–6121).
- **Fejlen:** Kronen er en `through`-genstand ligesom diademet, men dens bånd er bredere og højere end diademets. Isbjørnens lave ører ligger derfor bag båndet. Kun en smal bue af venstre øre ses i stadie 2–3, og højre øre er helt skjult. Ved de 10 andre hovedgenstande titter ørerne frem (T1). Pandaens ører står ved siden af den samme krone.
- **Ret sådan:** Gør som ved diademet, hvor begge ører ses ved båndets ender. Vælg én af to løsninger:
  - giv `milepael-krone` en override for isbjørnen, der gør båndet smallere end ørernes afstand, fx `scale: 0.86`,
  - eller tegn isbjørnens ører over kronens bånd (de ligger allerede i ørernes lag 16), så de øverste 4–5 enheder af hvert øre ses ved båndets ender.

  Overridebudgettet tåler det: Kronen har i dag ingen override, og grænsen er 10 % af parrene.

## 9. Rettelser i prioriteret rækkefølge

Intet blokerer gaten. Følgende kan rettes før eller efter udgivelsen:

1. **T5, Legendekronen og isbjørnens ører:** Giv kronen en isbjørn-override (fx `scale: 0.86`), eller tegn ørerne over båndet, så begge ører titter frem ved båndets ender som ved diademet.
2. **T3 på de andre lange forben:** Brug isbjørnens løsning (`handGrip` med poten klippet over den nederste del) eller en lille rem om poten til raket og stjernestav på kat, hest, enhjørning, ræv, hvalp, pegasus og drage.
3. **T4 og B3, dragens lup og gulerod:** Brug samme greb som isbjørnens. Alternativt kan dragens `pawR` få dx +4.
4. **S1, himlen i 820×1180:** Skalér scenen 15–20 % op i portræt med ankeret i bunden, eller løft tinden og bjergene ca. 150–200 px (1x).
5. **A4, pegasus' c1, c2 og c4:** Gør c2 tydeligt himmelblå eller c4 mere lilla.
6. **P3, cyklens stel:** Gør stellet ca. 15 % tykkere, eller markér eger og kæde som `.tv-fine`.
7. **Kosmetisk:** Læg pingvinens venstre kind under næbbet. Beskær jetpack-kortet tættere (B1, valgfrit).

## Bilag: mine optagelser

Optagelserne er lokale og ikke committet. De ligger i REV9b's scratchpad (`rev9b-review/`):
- `shots/`: designsidens tre ting-rækker og svarkortene i 6 formater, lavet med `shots.mjs` (Playwright via `scripts/browser.mjs` bag `flock`),
- `crops/`: udsnittene fra arkene,
- `facit.json`: det beregnede facit.

Alt kan genskabes fra HEAD med dev-serveren som beskrevet i §2.
