# Kunst-review, bølge 3 runde 1 (G3 · r1): pegasus, drage, pingvin og isbjørn, Astronaut-sættet, Stjernefjeldets scene og vægt-piktogrammerne

- **Reviewer:** REV9. Jeg er frisk og uafhængig. Jeg har ikke tegnet noget af det, jeg bedømmer, og jeg har ikke været med i tidligere runder eller blindtests.
- **Opgave:** kunst-gate G3 for 3. klasse (Stjernefjeldet), før verdenen frigives:
  - de fire nye arter,
  - Astronaut-sættet på alle 16 arter,
  - scenen bag kortet (`scene-fjeld/`),
  - de fem nye piktogrammer til vægtopgaverne (brev, hund, cykel, sofa og kuffert).
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §6, §7 og §11 og "Ændringer" (især A17), `docs/design/kunst-lyd-teknik.md` (§1–4), `art-g2-r1.md` (panda og isbjørn), `art-g2-r2.md` §5.2 (scenekriterierne), `art-g2-r4.md`, `art-g2-r4b.md`, `pikto-r1.md` og `pikto-r2.md`.
  - **Kontaktarkene** i `/home/user/wt/rev9-sheets/` (integratorens kopi af `artifacts/sheets/`, lavet fra HEAD 3611155). `lint.json` dækker 113 ark og har 0 fejl.
  - **Det levende kort og svarkortene:** set på dev-serveren (port 4391, Chromium bag `flock`). Se §4 og §5.
- **Blindtesten:**
  - `art-g3-r1-blind.md` blev committet (19014ec), før rubrik, reviews, kode og kontaktark blev åbnet.
  - Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket `sheet-r9.png` (SHA-256 `93a05013…d270d6` for begge).
- **Uafhængighed:**
  - Kunstens kildekode har jeg ikke læst. Kode har jeg kun åbnet for at:
    - beregne facit (silhuetrutens blanding i `SheetApp.tsx`, `SPECIES_IDS` og racernes rækkefølge i artsfilerne),
    - finde designsidens række med ting og tingenes id'er (`MaterialsPage.tsx`, `UNIT_THINGS` i `kit2.ts` og en grep efter `case` i `objects.tsx`, der også viste kommentarlinjerne for hund og sofa, efter blindtesten),
    - betjene værktøjerne (`browser.mjs`, harnessens eksempel og kortenes ansigter i `examples.ts`, `main.tsx` og `faces.tsx`, og kortets profilopskrift i `loop.e2e.mjs`).
  - Derudover har jeg søgt (grep) efter "ear" i `polarbear.tsx` for at se, om de skjulte ører under hatte er et valg (T1).
  - Til regressionen har jeg brugt `git diff --stat` og `--numstat` mod 166e041 (G2-r4b), læst diff'en af `rig.css` (de nye regler for vinger og røg) og søgt efter klassenavnene i artsfilerne og `Rig.tsx`.
  - Under blindtesten har jeg set **filnavne** fra andre agenter i den fælles scratchpad. Det står i blindfilen. Ingen af dem er åbnet.
- **Metode:** Arkene er set i oversigt og derefter i udsnit med 0,5–3× zoom. Huller er fundet maskinelt i `holes.png` (lukkede magenta-områder, mild grænse). Kontrast er målt som WCAG-forhold. Scenens mætning er middel af HSV-mætningen pr. panel.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x0–x1, y0–y1). Systemet står i bilag A.
- **Skalaen:** som i G2. 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau". Et 5-tal kræver, at rubrikkens 5-beskrivelse er opfyldt i alle farver og stadier, jeg har set.

## Resultat

**Gate G3-r1: ikke bestået, alene på piktogrammerne.** Sofaen læses som en lænestol (P1). Arterne, Astronaut-sættet og scenen består.

| Krav | Resultat |
|---|---|
| Hver af de fire arter har alle 10 kriterier ≥ 4 og middel ≥ 4,3 | **Opfyldt.** Middel 4,4–4,7. Isbjørnen ligger lavest med fire forbehold (T1, T2/B2, A1 og A2). |
| Astronaut-sættet har pasform og butikskort ≥ 4, og fit-matrixen og arkene er lint-fri | **Opfyldt.** Pasform 4 og butikskort 4. `fitmatrix-astronaut.png` har 336 tegnede celler, og `lint.json` har 0 fejl. |
| Scenen har alle 8 scenekriterier ≥ 4 og middel ≥ 4,3 | **Opfyldt.** Alle 8 kriterier er mindst 4, og middel er 4,6. |
| Blindtesten giver 72/72 og ≥ 68 sikre, og ingen ny art er "usikker" med en af de nævnte forvekslinger | **Opfyldt.** 72/72, 72 sikre. |
| Piktogrammerne giver 5/5 ved 78 px, og stilen er ≥ 4 | **Ikke opfyldt.** 4/5 ved 78 px: sofaen læste jeg som en lænestol (P1). Stilen er 4,4. |

| Art | Middel | Laveste | Afgørelse |
|---|---|---|---|
| Pegasus | **4,6** | 4 | **Bestået.** |
| Drage | **4,7** | 4 | **Bestået.** |
| Pingvin | **4,5** | 4 | **Bestået.** Forbehold A3 (sand og guld trækker mod ælling). |
| Isbjørn | **4,4** | 4 | **Bestået med forbehold:** T2/B2 (fire håndgenstande gemt bag forbenet), T1 (ørerne forsvinder under alle hatte), A1 (regnbuen ses ikke i hvile) og A2 (svag signatur). |

| Sæt | Pasform | Butikskort | Afgørelse |
|---|---|---|---|
| **Astronaut** | **4** | **4** | **Bestået.** Øjnene er fri på alle 16 arter, horn og ører opfører sig troværdigt, og jetpacken er låst på de tre vingede arter. Forbehold: T3 (raketten uden hånddel på de lange forben) og B1 (jetpackens kort på dyret). |

| Scene | Middel | Laveste | Afgørelse |
|---|---|---|---|
| Stjernefjeldet | **4,6** | 4 (tre kriterier) | **Bestået.** Forbehold S1 (meget himmel i 820×1180) og S2 (skovbåndets gentagne gran). Sten og skilte har god kontrast på det levende kort. |

| Piktogrammer | 46 px | 78 px | Stil | Afgørelse |
|---|---|---|---|---|
| Brev, hund, cykel, sofa og kuffert | 4/5 | 4/5 | 4,4 | **Ikke bestået** på sofaen (P1). Resten er sikre i begge størrelser, og billede og ord passer sammen på kortene i alle 6 formater. |

## 1. Blindtesten

**Facit** er beregnet ud fra silhuetrutens blanding i `src/dev/SheetApp.tsx` (`BLIND_SALT` 20,9): arterne i `SPECIES_IDS`-rækkefølge, racerne i artsfilernes rækkefølge og stadierne 2, 1, 3, sorteret efter brøkdelen af `sin(i · 12,9898 + 20,9) · 43758,5453`. Mine svar er sammenlignet ét for ét.

| | Resultat |
|---|---|
| Rigtige på art | **72/72** |
| Sikre / usikre | **72 / 0** |
| De fire nye arter | 12/12 sikre: pegasus #34, #55 og #70, drage #14, #20 og #31, pingvin #3, #12 og #24, isbjørn #9, #43 og #59 |
| Stadierne | Alle 38 steder, hvor noten angiver stadiet ("lille" eller "stor"), passer med stadie 1 og 3. |
| Racerne | Kat og kanin er grupperet rigtigt i noterne: huskat (tynd krøllet hale) #2, #68 og #71, langhår (brystkrave) #38, #61 og #72, maine coon (los-ørespidser) #40, #51 og #58, upright #42, #64 og #65, vædder #6, #10 og #35 og løvehoved #8, #22 og #36. Fjordhesten (studset manke) er #49, #54 og #67. Shetland og araber og enhjørningens tre racer har jeg ikke skilt sikkert i noterne. Det kræver testen ikke. |

**Fordelingen** passer med arket: 12 arter × 3 og kanin, kat, hest og enhjørning × 9.

**Facit pr. art** (alle 72 er lig med mine svar): kanin #6, #8, #10, #22, #35, #36, #42, #64, #65; kat #2, #38, #40, #51, #58, #61, #68, #71, #72; hvalp #5, #15, #28; pindsvin #4, #13, #26; hest #18, #37, #41, #47, #49, #54, #57, #66, #67; lam #7, #30, #32; ræv #17, #25, #29; hamster #21, #50, #52; enhjørning #16, #27, #33, #39, #46, #56, #62, #63, #69; panda #11, #19, #23; egern #1, #48, #53; ugle #44, #45, #60; pegasus #34, #55, #70; drage #14, #20, #31; pingvin #3, #12, #24; isbjørn #9, #43, #59.

**De vigtigste forvekslingspar** (fra blindfilen, svageste først). Ingen af dem gav en usikker figur.
1. **Hest ↔ enhjørning (18 figurer).** Hornets tynde spids mod pandelokkens runde lapper eller fjordhestens børste. Ved stadie 1 (#27, #37, #46, #47 og #56) er spidsen kun få pixel bred. Det er arkets snævreste skel.
2. **Vædderkanin ↔ hvalp.** Pomponhale, top og lange fødder mod den tynde, opadvendte hale.
3. **Maine coon ↔ ræv.** Knurhår mod kindpels.
4. **Løvehovedkanin ↔ lam.** Ørernes retning.
5. **Ugle ↔ drage.** Øredusk i V mod glatte horn, hale og frynser.

**De nævnte forvekslinger for de nye arter forekom ikke.** Isbjørnen bæres af den lange snude og fisken, pingvinen af pærekrop, næb og luffer, pegasus af fjervingerne (ingen horn) og dragen af de glatte horn, halen med spade og hudvingerne.

**Forbehold om bias:** Jeg så alle 72 figurer på én gang og kunne sammenligne dem. Briefen nævnte de 16 arter og de fire nye arters forvekslinger. Min sikkerhed er derfor snarere for høj end for lav, ligesom REV7 og REV8 skrev.

**Piktogrammerne** (blindt i 46 og 78 px, rettet mod designsiden og tingene i `objects.tsx`):

| # | Ting | Mit svar 46 px | Mit svar 78 px | Rigtigt (46/78) |
|---|---|---|---|---|
| 1 | cykel (bike) | cykel | cykel | ja / ja |
| 2 | kuffert (suitcase) | kuffert | kuffert | ja / ja |
| 3 | hund (dog) | hund | hund (hvalp) | ja / ja |
| 4 | sofa (sofa) | lænestol | lænestol eller lille sofa (usikker) | **nej / nej** |
| 5 | brev (letter) | brev | brev (kuvert) | ja / ja |

- 46 px: 4/5. 78 px: 4/5. Tæller man mit alternativ "lille sofa" med, er 78 px 5/5, men usikker.

## 2. De fire arter

### 2.1 Scores

| # | Kriterium | Pegasus | Drage | Pingvin | Isbjørn |
|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 4 | 5 |
| 2 | Silhuet | 5 | 5 | 5 | 5 |
| 3 | Proportioner | 5 | 5 | 5 | 4 |
| 4 | Kontur | 5 | 5 | 5 | 5 |
| 5 | Palet | 4 | 5 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 |
| 7 | Pasform | 4 | 4 | 4 | 4 |
| 8 | Animation | 5 | 5 | 5 | 4 |
| 9 | Butikskort ved 64 px | 4 | 4 | 4 | 4 |
| 10 | AAA-finish | 4 | 4 | 4 | 4 |
| | **Middel** | **4,6** | **4,7** | **4,5** | **4,4** |

### 2.2 Begrundelser

**1. Genkendelighed ved 48 px** (`sizes-<art>.png`, kort 1–10 med y0 = 268)
- **Pegasus, drage og isbjørn 5:** Hvert kort læses straks som arten i alle otte farver, og "glad" og "sover" (kort 9–10) kan skelnes. Fjervingerne, dragens horn og spadehale og isbjørnens lange snude og fisk står skarpt.
- **Pingvin 4:** Sort-hvid, skifergrå, rockhopper (gule fjer), blå og grå læses straks. **c6 sand og guld** (kort 6 og 7, (844–1128, 268–412)) mister kontrasten mellem den mørke ryg og den hvide mave. Med orange næb og gul eller sandfarvet krop ligner de en ælling eller kylling (A3). Pærekroppen og lufferne holder arten, men kun ved andet blik.

**2. Silhuet** (`silhouettes.png` og blindtesten)
- **Alle fire 5:** 12/12 sikre i blindtesten. Hver art har én entydig form i alle stadier, og ingen af briefens forvekslinger forekom (§1).
- **Kravene fra G2-r1 er opfyldt:**
  - Pandaens og isbjørnens hoveder kan skelnes. Isbjørnens hoved er lavt og langt i trekvart profil med lang snude og små ører bag på hovedet. Pandaens er rundt og forfra med store ører og bambus.
  - Dragens horn er glatte og står bag ørefrynserne, så de ikke ligner uglens kløvede fjerører.

**3. Proportioner** (`species-<art>.png` stadierækkerne y0 = 320, 608 og 896, og `lineup.png`)
- **Pegasus, drage og pingvin 5:** Tydelig chibi med store, lave øjne. Babyen har størst hoved og øjne, og baby → ung → stor er en klar udvikling (vingerne vokser med i stadie 3). De står pænt på jordlinjen ved siden af hest, enhjørning og ugle i `lineup.png`.
- **Isbjørn 4:** Det lave, lange hoved er bevidst og bærer arten. Men kroppen er den dominerende masse, især i stadie 3 (`lineup.png` (16260–17310, 800–1220)), og isbjørnen er mindre "chibi" end de andre runde arter. Det er ikke en fejl, men til 5 mangler en lidt mindre krop i stadie 2–3.

**4. Kontur** (`closeup-<art>.png`, `species-<art>.png` og `holes.png`)
- **Alle fire 5:** Én ensartet, farvet kontur på alle dele og stadier. Ører, horn og ørefrynser vokser sømløst ud af hovedet, vingerne sidder bag kroppen, og konturfarven følger pelsen i alle farver (også ravkonturen på guld). Den hvide isbjørns kontur er kølig gråviolet og harmonerer med pelsen.
- **Huller:** Huller-lint'en er grøn for alle fire (`'thin'`), og `KNOWN_POCKETS` er tom. Min egen skanning af alle 1551 fliser (mild magenta-grænse, lukkede områder ≥ 3 px) fandt intet i de fire nye arters fliser #1312–#1551. Fundene i de gamle arter (18 fliser, fx #47, #219, #598 og #1158) er glimtene ✦, antialias og et smalt mellemrum ved en løftet hov. Den kunst er uændret siden G2-r4b (§6), og lint'en er grøn.

**5. Palet** (`species-<art>.png`, kort x0 = 256 + 244 · (n − 1))
- **Drage 5:** Grøn, rød, blå, lilla, sort, turkis, guld og regnbue er tydeligt forskellige. Guld har ravkontur, ravskygge og glansbånd. Regnbuen er en hvid drage med flade pastelstriber i vingehuden, på maven og i halespidsen.
- **Pegasus 4:** Smukke pasteller, og regnbuen har stribede vinger, manke og hale. Men c1 hvid, c2 isblå og c4 lavendel (x0 = 256, 500 og 988) ligger tæt, især ved 48 px (A4).
- **Pingvin 4:** c1 sort-hvid og c2 skifergrå med cremefarvet mave (x0 = 256 og 500) ligger tæt, og c6 sand og guld trækker mod ælling (A3).
- **Isbjørn 4:**
  - **A1, regnbuen:** Den har en mintgrøn krop, og regnbuestriberne sidder kun på en mavelap. I hvile dækker forbenene lappen, så kun en tynd stribe ses mellem benene (`species-polarbear.png` (1964–2204, 320–1470)). I album og butik læses den som "mintgrøn isbjørn". Striberne ses kun, når armene løftes (`closeup-polarbear.png`, kortet "std · 2 · rainbow · cheer").
  - Hvid, creme, lyseblå, lavendel og lyserød (c1, c2, c3, c5 og c6) ligger tæt ved 48 px.
- **Den hvide isbjørn på papiret** (briefens krav): Pelsen (#FBFAF6) er lige så lys som papiret (#FFF8EC), men kølig mod det varme papir. Konturen (#7A7B96) har kontrasten 3,9:1 mod papiret, og skyggen og konturen bærer formen. Jeg har lagt figuren på papirfarven: Den står tydeligt ved 256, 96 og 48 px.

**6. Ansigtets appel** (`closeup-<art>.png` og `moods-<art>.png`)
- **Alle fire 5:** Store, blanke øjne med to højlys, velplacerede kinder og næse eller næb.
  - Isbjørnens trekvart-ansigt er stadig sødt og ikke en profil.
  - Alle 7 humør læses straks på alle tre stadier: glad med ^-øjne, jubel med stjerneøjne, tænker med boble, ups med sveddråbe, sover med Zzz og vinker (fx `moods-dragon.png` og `moods-polarbear.png` rækkerne 1–3).
  - Tankebobler og Zzz går fri af horn, ører og vinger, og lint'en er grøn.

**7. Pasform** (`fit-<art>.png`, `fitmatrix-<sæt>.png`)
- **Alle fire 4:**
  - **Pegasus og drage:** Ryggen er låst, og hatte, briller og kropstøj sidder rigtigt. Dragens hjelm sidder mellem hornene (§3.1).
  - **Pingvin:** Alt sidder fint. Luffen ligger over håndtaget som greb, og genstandene ses.
  - Ingen art er hævet til 5. Det skyldes de kendte begrænsninger fra G2 (fx G2's T5, de lige ærmer på de høje kroppe), og at jeg ikke har gennemgået alle 74 genstande på de nye arter.
- **Isbjørnen ligger nederst i 4** med to fund, der er samme type som tidligere accepterede fejl:
  - **T2:** Lup, gulerod, scepter og kikkert sidder bag det brede forben i alle 9 celler, og kun ca. 1/3 ses. Det er samme type som uglens B14 i G2-r2 (gulerod og scepter bag vingen, pasform 4), men det rammer fire genstande.
  - **T1:** Ørerne forsvinder under alle hovedgenstande, også under `under`-hattene (fx krone og festhat). Ørerne er bevidst tegnet bag hovedet ("meget små, runde ører lavt bag på hovedet"). Små ører under en hat er troværdigt, men pandaens og hamsterens runde ører står ved siden af hatten, og isbjørnen mister et kendetegn.
- **Dragen** har en mildere udgave af T2: luppen og guleroden ses delvist bag forbenet, ligesom hos ræven (T4).

**8. Animation** (`filmstrip-<art>.png`, signaturen i nærbillede y0 ≈ 3088)
- **Pegasus 5:** I signaturens nærbillede slår vingerne op og ned med overshoot og falder til ro. De ånder i hvile og blafrer i jubel.
- **Drage 5:** Røgpusten vokser ud af næseboret, driver væk og forsvinder, og vingerne følger hop og jubel.
- **Pingvin 5:** Vinge-klappet er tydeligt i nærbilledet, og lufferne slår i glad og jubel.
- **Alle fire:** squash og stretch i hop, blink og ørevip og hver sin rytme pr. humør.
- **Isbjørn 4 (A2):** Snuse-næsen er et lille løft af hovedet. Snuden flytter sig ca. 6 px i nærbilledet, altså ca. 3–4 enheder. Det er lige over rubrikkens minimum på 3 enheder, men det er svært at se i filmstrimlen ved 100 % uden at sammenligne frames (`filmstrip-polarbear.png` (64–2914, 3088–3500)), og ved 48 px ses det ikke. Humørene er ellers levende.

**9. Butikskort ved 64 px** (`sizes-<art>.png`, kort x0 = 64 + 156 · (k − 1). "Alene" har y0 = 1636 + 152 · i, og "på dyret" har y0 = 3240 + 152 · i)
- **Alle fire 4:** Hatte, briller, halsting, kropstøj og rygting er tydelige. Pegasus' og dragens rygkort viser genstanden ved siden af dyret med en lås.
- **B2, isbjørn:** Håndkortene for Opdager, Rytter, Kongelig og Pirat viser kun en stump af genstanden ved siden af et hvidt forben: en blå "D"-linse, gulerodsblade, en kugle og enden af en kikkert (`sizes-polarbear.png` (2404–2844) ved y0 = 3392, 3544, 3696 og 4304).
- **B3, drage:** Lup og gulerod er små (`sizes-dragon.png` (2404–2844, 3392–3672)), som rævens.
- Ingen er under 4, fordi genstanden alene vises tydeligt, og præcedensen (uglens B14, rævens B17) holdt sig på 4. Isbjørnen er dog tæt på 3.

**10. AAA-finish**
- **Alle fire 4:** Gennemført, charmerende og konsistent med de 12 arter (fx dragens mavebånd, pegasus' fjerskalloper, pingvinens rockhopper-fjer og isbjørnens fisk).
- Til 5 mangler:
  - isbjørnens T1, T2 og A1,
  - pingvinens A3 og den lyserøde kind, der ligger oven på næbbets venstre del (`closeup-penguin.png` (350–410, 695–725)),
  - pegasus' A4,
  - T3 og T4 på de høje kroppe.

## 3. Astronaut-sættet

### 3.1 Pasform på alle 16 arter (4)

**Grundlag:** `fit-<art>.png` rækkerne astronaut-head til -hand (y0 = 7406 + 298 · k, eller 7438 + 298 · k hos kanin, kat, hest og enhjørning), "hele sættet" og humørrækkerne, og `fitmatrix-astronaut.png` (48 rækker · 7 kolonner).

- **Hjelmen:**
  - Den sidder på alle 16 arter og i alle tre stadier.
  - Ører, enhjørningens horn og uglens fjerører går op gennem hjelmen.
  - **Dragens hjelm** (forfatterens override) er en lille kuppel mellem de to horn. Den er troværdig, dækker ikke øjnene og står stabilt i alle stadier (`fit-dragon.png` (256–2540, 7406–7682)). Overriden er acceptabel (§3.3).
  - Isbjørnens ører skjules (T1, artens valg).
- **Rumbrillerne:** Glasset er let tonet, og øjnene ses tydeligt på alle arter, også hos pingvin, ugle, isbjørn og pindsvin. Lint'en er grøn.
- **Medaljonen og rumdragten:**
  - Medaljonen hænger på brystet.
  - Dragten følger kroppens kontur med lynlås og krave på alle tre kropsskabeloner.
  - Den hvide dragt på den hvide isbjørn ses på grund af den blå kant og den mørkere kontur.
- **Jetpacken:**
  - To tanke bag kroppen og seler over skuldrene på de 13 arter uden vinger. Ingen tank stikker forkert ud.
  - Pegasus, drage og ugle har ingen jetpack (låst ryg), som SPEC §7.1 kræver.
- **Raketten:**
  - På de runde kroppe holdes den skråt i poten. På pingvin og ugle ligger den i luffen eller vingespidsen.
  - På de lange forben står den foran benet med foden på hoven eller poten (A17).
  - **Forfatterens forbehold "ingen hånddel" (T3):** Det ser ikke forkert ud, og raketten læses som et stykke legetøj, dyret holder ned mod foden. Men A17 siger, at "en rem eller hånddel viser grebet", og det mangler. Samme vurdering som stjernestaven i G2-r4b (O1). Ikke blokerende.
- **Humør:** I glad, jubel og vinker følger raketten den løftede pote, og hjelm og briller bliver siddende (fx `fit-polarbear.png` (256–2050, 24455–24735)). Øjnene er fri i alle humør, også sover.
- **Farvesæt:** Alle seks genstande har tre tydeligt forskellige farvesæt (hvid og blå, orange og marine, lavendel og mint).

### 3.2 Butikskort (4)

- **Alene** (`sizes-<art>.png` y0 = 2244): Hjelm, briller, medaljon, dragt, jetpack og raket er tydelige og fylder kortet. Dragten alene læses mest som "jakke". På dyret ses den som rumdragt.
- **På dyret** (y0 = 3848):
  - Hjelm og briller er beskåret om hovedet, og intet kort skærer gennem øjnene.
  - Medaljonen og dragten er beskåret om brystet. Raketten ses tydeligt på alle 16 arter.
- **Jetpackens kort "på dyret" (forfatterens forbehold, B1):**
  - Kortet viser hele dyret med én tank og flamme bag skulderen og selerne over brystet (kort 13–15, (1936–2376, 3848–3976)). Tanken fylder ca. halvdelen af kortets højde.
  - Jetpacken kan genkendes på alle 13 arter, så det er acceptabelt. En genstand på ryggen kan ikke fylde mere forfra uden at skjule dyret.
  - De tre vingede arter viser jetpacken ved siden af dyret med en lås. Det er tydeligt.

### 3.3 Scores for sættet (de rubrik-kriterier, der gælder genstande)

| # | Kriterium | Astronaut |
|---|---|---|
| 4 | Kontur: tydeligt mørkere end pelsen | 5 |
| 5 | Palet: tre klart forskellige farvesæt | 5 |
| 7 | Pasform | **4** |
| 9 | Butikskort ved 64 px | **4** |
| 10 | AAA-finish | 4 |
| | **Middel** | **4,4** |

- **Kontur, 5:** Alle seks genstande har en tydeligt mørkere kontur end pelsen. Den hvide dragt ses også på den hvide isbjørn, fordi den har en blå kant og en mørkere kontur.
- **AAA-finish, 4:** Gennemført og charmerende: visiret, dragtens mærke og kontrolpanel, stjernemedaljonen og flammerne. Til 5 mangler T3 og B1.
- **Hjelmens override** (forfatterens forbehold): Én override i 93 par (6 genstande på 16 arter minus jetpacken på de tre vingede arter) er ca. 1 %, langt under grænsen på 10 % (§7.1 regel 7).

### 3.4 Fit-matrixen og lints

- `fitmatrix-astronaut.png` (2008 × 14140) har 336 tegnede celler (48 rækker · 7 kolonner), uden tomme felter. Den største papirflade er 3,6 %, og den mindste tegning er 14,9 % af feltet.
- `lint.json` har 0 fejl på alle 113 ark (fit, sizes, fitmatrix, holes, silhouettes, lineup og scener).

## 4. Scenen: Stjernefjeldet

**Grundlag:**
- `scene-fjeld/`: alle 14 paneler (fire tiers i 393×852, 820×1180 og 1180×820 og "blandet" i 393×852 og 1180×820) og oversigten `scene-fjeld.png`. Lint'en melder 362 elementer og ingen tomme flader (`blankMax` 0,65 %).
- Det levende kort på dev-serveren med en profil i 3. klasse (`?worlds=all`, ruten `{ id: 'map', world: 'fjeld' }`) i 393×852, 820×1180 og 1180×820, i top, midte og bund.
- De tre godkendte scener i 820×1180 (sølv) til sammenligning.

Koordinaterne er i `scene-fjeld/1180x820-<tier>.png` (2x), hvis intet andet står.

### 4.1 Scores

| # | Kriterium | Stjernefjeldet |
|---|---|---|
| 1 | Komposition og mellemgrund | 4 |
| 2 | Dybde og luftperspektiv | 5 |
| 3 | Lys fra én retning | 5 |
| 4 | Verdenslogik | 5 |
| 5 | Progression (start, bronze, sølv og guld) | 5 |
| 6 | Samspil med kortet (kendemærker uden for panelet, sten og skilte kan læses) | 4 |
| 7 | Palet | 5 |
| 8 | AAA-finish | 4 |
| | **Middel** | **4,6** |

### 4.2 Begrundelser

1. **Komposition, 4:**
   - De syv regioner har hver sit kendetegn, og de er spredt over hele billedet:
     - **Tabeltoppen:** tinden med stjernetavlen (3 × 4 stjerner), kikkert og flag, og pegasus flyver over (1400–1600, 130–345),
     - **Trecifret bro:** stenbroen med tre buer over vandfaldet (1430–1690, 830–960),
     - **Minuttårnet:** urtårnet, og dragen sidder på klippen ved siden af (20–230, 650–1040),
     - **Delekløften:** kløften med trapper og hængebro (35–320, 1220–1355),
     - **Markedet:** boderne, målepælen og møntskiltet (140–405, 1485–1610),
     - **Arealhaven:** bedene i et gitter (435–675, 1505–1590),
     - **Brøkbageriet:** huset med tærten i det runde vindue (2125–2285, 1320–1485).
   - Søen med pingvinerne (1745–2125, 1410–1500), isbjørnen og snemanden fylder engen.
   - På telefon står tinden, vandfaldet og tårnet i midten, og bunden er fyldt med sø, bageri, marked, have og kløft.
   - **Forbehold S1:** I 820×1180 fylder himlen ca. 65 % af panelet, og alle kendemærker ligger i den nederste tredjedel. I de godkendte scener er tallet 33–48 % i samme format. I appen dækker panelet og kortene i højre kolonne det meste af himlen, og kendemærkerne står i god størrelse under "Næste tre mål" (tårnet er ca. 180 CSS-px højt). Derfor 4 og ikke 3.
2. **Dybde, 5:** Fire tydelige planer:
   - fjerne, lyse toppe i lavendel og hvid,
   - mellembjerge med sne og skyggeside,
   - skovbåndet og engen,
   - nære snedækkede sten og graner i hjørnerne, delvist beskåret.

   Fjernt er lyst og køligt, og nært er varmt og mættet.
3. **Lys, 5:**
   - Solen står øverst til venstre.
   - Bjergene har en lys venstreside med en varm rosa kant langs kammen og en skyggeside mod højre.
   - Sten, graner, tårn og huse har jordskygger, der er forskudt mod højre og nedad (fx stenene ved (900–1450, 1280–1560) i `1180x820-silver.png`).
   - Engen har skyggefolder, der læses som formskygge og ikke som mørke marker.
   - Det er det, G2-r2 §6 bad de andre scener om.
4. **Verdenslogik, 5:**
   - Vandfaldet er frosset øverst og løber som bæk under broen ned i søen.
   - Søen er frosset i midten og har en åben kant, og pingvinerne står på isen.
   - Stien går fra kløften op til tårnet, langs skoven til broen og i sving op til tinden. En anden sti går fra markedet over engen til bageriet.
   - Dragen sidder ved Minuttårnet, og pegasus flyver over Tabeltoppen (deres ven-regioner). Isbjørnen går på engen mellem søen og bageriet.
   - Pingvinerne (Markedets ven) står på søen og ikke ved markedet. Det er logisk for en pingvin og ikke en fejl.
5. **Progression, 5:**
   - Mætningen stiger jævnt: 0,14, 0,18, 0,21 og 0,25 for start, bronze, sølv og guld (1180×820), 0,14, 0,17, 0,20 og 0,23 (393×852) og 0,13, 0,15, 0,18 og 0,20 (820×1180).
   - Start er pastel og aldrig grå.
   - Hvert tier får egne rekvisitter:
     - **bronze:** lanterner på tårn, bro, kløft, boder og have, røg fra bageriets skorsten og flere blomster ved stenene,
     - **sølv:** glimt i vandfald og sø, tre pingviner, isbjørnens unge og blomster i bedene,
     - **guld:** nordlys over himlen, flagranker på tinden, boderne, haven og bageriet, fire pingviner, fugle og fuld mætning.
   - **Regionerne skifter hver for sig** (`1180x820-blandet.png`): tinden i guld, broen og tårnet i sølv, kløften og markedet i bronze og haven og bageriet i start. Farven vender altså tilbage region for region.
6. **Samspil med kortet, 4:**
   - **1180×820:** Tinden, tårnet med dragen, broen, vandfaldet, søen, bageriet, kløften, markedet og haven står uden for stenpanelet, både øverst og nederst på kortet.
   - **820×1180:** I højre kolonne står tinden, pegasus, tårnet med dragen, vandfaldet, broen og bageriet under kortene, og kløften og markedet ses under panelet.
   - **393×852:** Øverst dækker panelet næsten hele bredden, og kun tårnet og tinden ses i kanterne. Nederst, under "Næste tre mål", ses broen, dragen, søen med pingviner, bageriet, markedet, haven og kløften. Det er samme begrænsning som Regnbueskoven på telefon.
   - **Sten og skilte:**
     - De låste sten har en mørk kontur (kontrast 6,8–10,7:1 mod panelet) og et mørkt ikon (6,4:1 mod stenen).
     - Regionsskiltene ("Tabeltoppen", "Markedet" og "Verdensfesten") har mørk tekst på hvidt (15:1).
     - G2-r2's fund om de blege låste sten ses ikke her.
7. **Palet, 5:**
   - Lavendel himmel, pastel sne, mint og grøn eng og varme accenter (det røde tag og boderne). Paletten er i familie med figurerne.
   - Nordlyset i guld er særligt uden at skrige.
8. **AAA-finish, 4:**
   - Rig og kærligt detaljeret: stjernetavlen med kikkert, nordlyset, pingvinerne på isen, isbjørnen med unge, snemanden, hængebroen, målepælen og tærtevinduet.
   - **Fjeldets dyr** er tegnet i scenens enklere stil med tynd farvet kontur, som hestene i Hestebakkerne og pandaen og uglen i Regnbueskoven. Pegasus i flugt, dragen på sin klippe, pingvinerne og isbjørnen kan alle genkendes.
   - Til 5 mangler S1 og S2.

## 5. Piktogrammerne

**Grundlag:**
- min blindtest,
- svarkortene i appens egen stil: harnessens multiSelect-eksempel `multi-unit` med vægt-tingene byttet ind i netværkslaget, så intet i worktree er ændret, og med `family: 'weight'`. Optaget i 6 formater (`demo=0`),
- tingene tegnet med appens egen `ObjectIcon` i 46 og 78 px ved siden af husets ting,
- forfatterens udsnit `arti4/vaegt-piktogrammer.png` som supplement.

**Designsiden** `src/dev/design/MaterialsPage.tsx` viser i "Ting man måler" kun de 16 længde-ting (`UNIT_THINGS.length`), ikke vægt-tingene (P2). Derfor har jeg brugt de to optagelser ovenfor i stedet.

| Ting | Blind 46 / 78 px | Stil 1–5 | Note |
|---|---|---|---|
| Brev | rigtigt / rigtigt | 4 | Kuvert med lilla kant, flappens linjer og rødt hjertesegl. Klar. |
| Hund | rigtigt / rigtigt | 5 | Charmerende og i husets stil: hængeøre, sort snude, rødt halsbånd og hale i vejret. |
| Cykel | rigtigt / rigtigt | 4 | De to hjul og sadlen bærer den. Stellet bliver tyndt ved 44–46 px (P3). |
| Sofa | **forkert / forkert (usikker)** | 4 | Stilen er fin, men formen er næsten kvadratisk med høj ryg og store runde armlæn. Det er en lænestol (P1). |
| Kuffert | rigtigt / rigtigt | 5 | Hank, to remme med messingspænder og et stjernemærkat. |

Middel for stil: 4,4.

**Stil mod husets piktogrammer:** Samme system som bus, bamse, hus, sko, fjer, jordbær og nøgle: flad fyld, mørkere skygge nederst til højre, hvidt højlys og farvet kontur afledt af fyldet. Konturtykkelsen passer med nabotingene, og farverne kommer fra materialepaletten.

**Billede og ord på kortet** (6 formater):
- Ordene "et brev", "en hund", "en cykel", "en sofa", "en kuffert" og "en fjer" ligger inden for kortet uden overløb i se-p, x-p, se-l, x-l, ipad-p og ipad-l.
- "en kuffert", som før blev klippet til "en kuffer" på se-l (pikto-r2 punkt 4), er nu hel.
- Billederne er 44 px (liggende telefon), 48 px (se-p), 60 px (x-p) og 84 px (iPad).
- Billede og ord passer sammen. På sofakortet retter ordet billedet: Barnet ser en lænestol og hører "en sofa". For opgaven (g eller kg) er svaret det samme, så det er ikke farligt, men det er netop det, blindtesten skal fange.

## 6. Regression

- **De 12 tidligere arter og de andre sæt er urørte:**
  - `git diff --stat 166e041..HEAD` (G2-r4b til nu) ændrer ingen af de 12 arters filer eller farvefiler, ingen andre sæts genstande, hverken `src/art/parts` eller `src/art/materials`, ingen af de tre andre scener og ingen eksisterende snapshots. Under `src/art/scenes` er der kun tilføjelser (`fjeld.*` og nye linjer i `palette.ts`). Kun `astronaut/…/items.test.tsx.snap` og `stjernefjeldet.test.tsx.snap` er nye.
  - `rig.css` har kun fået nye linjer (123 tilføjet, 0 slettet) med regler for `.a-wings`, `.a-flap` og `.a-smoke`. `Wings`-delen findes kun i `pegasus.tsx` og `dragon.tsx`, så reglerne rammer ingen gammel art. Uglens vinger er arme.
  - `objects.tsx` har kun fået de fem nye ting. Den eneste slettede linje er en udvidet import.
- **`lineup.png`:** De 12 arter står uændret, og de fire nye står på samme jordlinje i samme stil.
- **`holes.png`:** Alle lommer er fyldt. `KNOWN_POCKETS` er tom (`src/dev/lints.ts`), og lint'en har 1551 figurer og 0 fejl. Min egen skanning fandt ingen lukkede områder i de fire nye arter.

## 7. Fejl

Nummereringen starter forfra for G3.

### Tøj (T)

**T1. Isbjørnens ører forsvinder under alle hovedgenstande. Lille.**
- **Hvor:** `fit-polarbear.png`, alle hovedrækker, fx Hverdag (256–2540, 264–540), og `fitmatrix-<sæt>.png`, isbjørn r = 45–47 (y0 = 13240, 13528 og 13816), kolonnen "hoved" (x0 = 262).
- **Fejlen:** Ørerne er tegnet bag hovedet, så hue, tropehjelm, ridehjelm, diadem, rumhjelm, ridderhjelm, troldmandshat, pirathat, festhat og krone dækker dem helt. Det gælder også `under`-hattene, som efter rubrikken (kriterium 7) skal sidde mellem ørerne. Isbjørnen mister sit kendetegn "små ører", og pandaens og hamsterens ører står ved siden af hatten.
- **Ret sådan:** Tegn ørerne over hatten (lag 16) og flyt `earBaseL/R` ca. 4–6 enheder ud til siden, så de to små runde ører titter frem ved hattens kant. Behold dem bag hovedet uden hat.

**T2. Isbjørnens forben skjuler lup, gulerod, scepter og kikkert. Mindre fejl (bredere end uglens B14).**
- **Hvor:** `fit-polarbear.png`, rækkerne opdager-hand (y0 ≈ 3538), rytter-hand (≈ 5323), kongelig-hand (≈ 7109) og pirat-hand (≈ 14251), alle 9 celler (256–2540).
- **Fejlen:** Poten tegnes over håndtaget (§7.1 regel 5), og isbjørnens forben er en bred søjle. Derfor ses kun ca. 1/3 af genstanden. Raketten, skjoldet, stjernestaven og ballonen ses.
- **Ret sådan:** Giv isbjørnen et `pawR` og en `handRot`, der lægger genstanden ud til siden som hos hamsteren (fx dx +8 og handRot −35°), eller lad håndgenstande på isbjørnen bruge `art.over` med poten over den nederste del som greb. Krav: mindst 2/3 af genstanden ses i alle 9 celler og på kort 16–18.

**T3. Raketten på de lange forben har ingen hånddel (forfatterens forbehold). Lille, ikke blokerende.**
- **Hvor:** `fit-<art>.png`, astronaut-hand (y0 = 8894, eller 8926 hos kat, hest og enhjørning), på arterne med lange forben, fx kat, hest, drage og isbjørn.
- **Fejlen:** Raketten står foran benet med foden på poten eller hoven, men ingen del af poten ligger over den. A17 siger, at en rem eller hånddel viser grebet.
- **Ret sådan:** Lad tåspidserne eller hovens forkant ligge over rakettens nederste finne (2–3 enheder), eller giv raketten en lille rem om poten.

**T4. Dragens lup og gulerod sidder delvist bag forbenet. Lille (som rævens).**
- **Hvor:** `fit-dragon.png`, opdager-hand (≈ 3538) og rytter-hand (≈ 5323).
- **Ret sådan:** Samme greb som T2, fx dx +4 på dragens `pawR`.

### Butikskort (B)

**B1. Jetpackens kort "på dyret" fylder ca. halvdelen (forfatterens forbehold). Accepteret.**
- **Hvor:** `sizes-<art>.png`, kort 13–15 (1936–2376, 3848–3976).
- **Ret sådan (valgfrit):** Beskær tættere om skulder og tank, så tanken fylder ca. 60 % af højden.

**B2. Isbjørnens håndkort for Opdager, Rytter, Kongelig og Pirat viser kun en stump af genstanden.**
- **Hvor:** `sizes-polarbear.png` (2404–2844) ved y0 = 3392, 3544, 3696 og 4304.
- **Ret sådan:** Følger af T2. Beskær bagefter håndkortet om pote og genstand, så genstanden fylder mindst 50 %.

**B3. Dragens Opdager- og Rytter-håndkort viser luppen og guleroden små. Lille.**
- **Hvor:** `sizes-dragon.png` (2404–2844, 3392–3672).
- **Ret sådan:** Følger af T4.

### Arter (A)

**A1. Regnbue-isbjørnen læses som en mintgrøn isbjørn i hvile.**
- **Hvor:** `species-polarbear.png`, regnbue (1964–2204, 320–1470), og `sizes-polarbear.png`, kort 8 (1156–1284, 268–412).
- **Fejlen:** Striberne sidder kun på mavelappen, og forbenene dækker den i hvile.
- **Ret sådan:** Læg striberne også i ørernes inderside, halestumpen og en krave eller striber hen over ryggen, eller gør mavelappen bredere end forbenene, så mindst tre striber ses i hvile. Kroppen bør være varm creme og ikke mint, så den ikke ligner c-farverne.

**A2. Isbjørnens signatur (snuse-næse) er svag.**
- **Hvor:** `filmstrip-polarbear.png`, signaturen (64–2914, 3088–3500).
- **Fejlen:** Bevægelsen er ca. 3–4 enheder. Den ses knap ved 100 % og slet ikke ved 48 px.
- **Ret sådan:** Lad snuden løfte sig 6–8 enheder i to korte snus (op, ned, op og overshoot), og lad næsetippen squashe (ca. 0,85) på hvert snus, som kaninens næsevip.

**A3. Pingvinens c6 sand og guld ligner en ælling.**
- **Hvor:** `sizes-penguin.png`, kort 6–7 (844–1128, 268–412), og `species-penguin.png` x0 = 1476 og 1720.
- **Ret sådan:** Giv begge en mørkere ryg og et mørkere hoved (fx en dyb rav eller brun ryg på guld og en kaffebrun ryg på sand), så pingvinens smoking-kontrast bevares.

**A4. Pegasus' c1, c2 og c4 ligger tæt. Lille.**
- **Hvor:** `species-pegasus.png` x0 = 256, 500 og 988, og `sizes-pegasus.png`, kort 1, 2 og 4.
- **Ret sådan:** Gør c2 tydeligt himmelblå (mere kroma) eller c4 mere lilla, så de tre bleg-kølige farver skilles ved 48 px.

### Scenen (S)

**S1. I 820×1180 fylder himlen ca. 65 % af panelet. Lille.**
- **Hvor:** `scene-fjeld/820x1180-*.png`, himlen (0–1640, 0–1530). Bjergene starter ved y ≈ 1560 af 2362.
- **Fejlen:** Alle kendemærker ligger i den nederste tredjedel, så panelet er bundtungt. De godkendte scener har 33–48 % himmel i samme format. I appen dækker panelet og kortene det meste af himlen, så det er et mindre problem.
- **Ret sådan:** Skalér scenen ca. 15–20 % op i portræt med ankeret i bunden, eller løft tinden og bjergene ca. 150–200 px (1x), så horisonten ligger omkring midten. Behold nordlyset som guld-belønning.

**S2. Skovbåndet gentager samme gran. Lille.**
- **Hvor:** `1180x820-*.png` (330–1400, 900–1100) og tilsvarende i de andre formater.
- **Ret sådan:** Brug 2–3 varianter af granen (smal, bred og en med mere sne), og varier højden med ±15 %, så båndet ikke ser stemplet ud.

### Piktogrammer (P)

**P1. Sofaen læses som en lænestol (blindt både ved 46 og 78 px).**
- **Hvor:** `src/ui/scenes/objects.tsx`, `case 'sofa'`, og blindarkene nr. 4.
- **Fejlen:** Figuren er næsten kvadratisk, og de to høje, runde armlæn fylder tilsammen ca. 2/5 af bredden. De to sædehynder forsvinder ved 46 px.
- **Ret sådan:** Gør sofaen ca. dobbelt så bred som høj, sænk armlænene til under ryggens højde og gør dem smallere (ca. 1/8 af bredden hver), og vis tre sædehynder og tre ryghynder med tydelige mellemrum. Så kan den ikke læses som en stol.

**P2. Designsiden viser ikke vægt-tingene. Proces.**
- **Hvor:** `src/dev/design/MaterialsPage.tsx`, sektionen "Ting man måler", der kun gennemløber `UNIT_THINGS.length`.
- **Ret sådan:** Tilføj en række for `UNIT_THINGS.weight` i 46, 78 og 104 px, så piktogrammerne kan reviewes i appens egen stil.

**P3. Cyklens stel er tyndt ved 44–46 px. Lille.**
- **Ret sådan:** Gør stellets streger ca. 15 % tykkere eller markér `.tv-fine`-detaljer (eger og kæde), så de skjules i små størrelser.

## 8. Rettelser i prioriteret rækkefølge

### Piktogrammerne (ikke bestået)

1. **P1, sofaen (blokerer gaten):**
   - Tegn sofaen ca. dobbelt så bred som høj (fx 44 × 22 i stedet for næsten kvadratisk).
   - Giv den lave, smalle armlæn under ryggens højde (ca. 1/8 af bredden hver) og tre sædehynder og tre ryghynder med tydelige mellemrum.
   - Krav: En frisk agent skal læse den som "sofa" og ikke "stol" ved 46 og 78 px i en ny blindtest.
2. **P2, designsiden:** Tilføj `UNIT_THINGS.weight` i "Ting man måler" i `MaterialsPage.tsx`, så piktogrammerne kan reviewes i appens egen stil.
3. **P3, cyklen:** Gør stellet ca. 15 % tykkere, eller markér eger og kæde som `.tv-fine`.

### Forbehold for det, der har bestået (rettes før udgivelse)

1. **Isbjørnen, T2 og B2:** Læg håndgenstandene ud til siden (dx +8, handRot −35°) eller foran poten med `art.over`, så mindst 2/3 af lup, gulerod, scepter og kikkert ses i alle 9 celler. Beskær bagefter håndkortet om pote og genstand.
2. **Isbjørnen, A1:** Regnbuen skal kunne ses i hvile. Læg striber i ørerne, halen og en krave, eller gør mavelappen bredere end forbenene, og giv kroppen en varm creme i stedet for mint.
3. **Isbjørnen, T1:** Tegn ørerne over hatten, og flyt `earBaseL/R` 4–6 enheder ud til siden, så de titter frem ved hattens kant.
4. **Isbjørnen, A2:** Lad snuden løfte sig 6–8 enheder i to korte snus med squash af næsetippen.
5. **Pingvinen, A3:** Giv sand og guld en mørkere ryg og et mørkere hoved.
6. **Astronaut, T3:** Lad tåspidserne eller hovens forkant ligge over rakettens nederste finne på de lange forben.
7. **Scenen, S1 og S2:** mindre himmel i 820×1180 og flere granvarianter.
8. **Mindre:** pegasus' farver (A4), dragens lup og gulerod (T4 og B3) og jetpackens kort (B1, valgfrit).

## Bilag A: koordinatsystem

- **`silhouettes.png` (= blindarket `sheet-r9.png`, 2808 × 3280):** #n har midte ved x ≈ 203 + 300 · ((n − 1) mod 9). Nummerteksterne står ved y ≈ 541 + 377,3 · ⌊(n − 1) / 9⌋, og figurerne står lige over.
- **`species-<art>.png`:** Kort x0 = 256 + 244 · (n − 1) for c1–c6, guld og regnbue. Stadie 1–3 har y0 = 320, 608 og 896, og stjerneformen har y0 = 1184.
- **`fit-<art>.png`:**
  - Kolonnerne har x0 = 256 + 256 · (k − 1), og felterne er 236 × 276. I genstandsrækkerne er k = 1–3, 4–6 og 7–9 stadie 1, 2 og 3, i farvesæt 0, 1 og 2.
  - Genstandsrækkerne har y0 ≈ 264 + 297,6 · r, hvor r = 6 · sæt + slot. Sættene er Hverdag 0, Opdager 1, Rytter 2, Kongelig 3, Astronaut 4, Ridder 5, Talmagiker 6 og Pirat 7, og slottene er hoved 0 til hånd 5. Hos kanin, kat, hest og enhjørning er y0 32 px større.
  - Astronaut har y0 = 7406, 7704, 8002, 8300, 8596 og 8894 (hoved til hånd).
  - Isbjørnens humørrækker for Astronaut baby og stor ligger ved y0 ≈ 24160 og 24455.
- **`fitmatrix-<sæt>.png`:** Kolonnerne har x0 = 262 + 244 · (c − 1), hvor c = 1–6 er hoved til hånd og c = 7 er hele sættet. Rækkerne har y0 = 280 + 288 · r i `SPECIES_IDS`-rækkefølge. De nye arter er pegasus r = 36–38, drage 39–41, pingvin 42–44 og isbjørn 45–47.
- **`sizes-<art>.png`:**
  - Kort k har x0 = 64 + 156 · (k − 1). 48 px-kortene har y0 = 268 (kort 1–8 er c1–c6, guld og regnbue, kort 9–10 er glad og sover).
  - Butikskortene er 128 × 128. "Genstanden alene" har y0 = 1636 + 152 · i, og "på dyret" har y0 = 3240 + 152 · i, hvor i = 0–7 er Hverdag, Opdager, Rytter, Kongelig, Astronaut, Ridder, Talmagiker og Pirat. Astronaut er altså 2244 og 3848.
  - Kort 1–3 er hoved, 4–6 ansigt, 7–9 hals, 10–12 krop, 13–15 ryg og 16–18 hånd, i farvesæt 0, 1 og 2.
- **`filmstrip-<art>.png`:** Nærbilledet af signaturen har y0 ≈ 3088, og frame k har x0 = 64 + 360 · (k − 1).
- **`holes.png`:** Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28) og y0 ≈ 212 + 161,7 · ⌊(n − 1) / 28⌋. De nye arter har pegasus #1312–1371, drage #1372–1431, pingvin #1432–1491 og isbjørn #1492–1551.
- **`lineup.png` (17380 × 1866):** Stadierækken har de nye arter yderst til højre. Isbjørn 1–3 har (16260–17310, 800–1220).
- **Scenepaneler:** `scene-fjeld/<b>x<h>-<tier>.png` i 2x (1180 × 820 er 2360 × 1642).
- **Mine optagelser** (lokale, ikke committet): svarkortene i 6 formater, piktogramrækken og det levende kort, alle i REV9's scratchpad (`rev9-review/shots/`). De kan genskabes på dev-serveren som beskrevet i §4 og §5.
