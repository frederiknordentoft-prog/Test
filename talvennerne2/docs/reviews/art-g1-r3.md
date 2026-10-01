# Kunst-review, runde 3 (G1 · r3): kanin, kat, hest og enhjørning

- **Reviewer:** frisk og uafhængig agent. Jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i runde 1 eller 2. Jeg har ikke læst kildekode og heller ikke `lint.json`.
- **Grundlag:**
  - `docs/art-rubric.md` og de tidligere reviews `docs/reviews/art-g0-r1.md` og `docs/reviews/art-g1-r2.md`.
  - Alle 27 PNG-ark i `/home/user/wt/w4/talvennerne2/artifacts/sheets/`, genereret 1. okt. 2026 kl. 16:08–16:09.
  - Alle ark er set i helhed og derefter i udsnit med 1,5–12× zoom.
  - Huller i fyldet er fundet ved at lede efter pixels i baggrundens farve inden for figurens yderkontur.
  - Signaturerne er målt med pixel-diff mellem frames.
- **Blindtest:**
  - `docs/reviews/art-g1-r3-blind.md` blev skrevet og committet (717f5e0), før noget andet blev åbnet.
  - Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1).
  - **Arts-arkene:** Kolonne c*n* har midte ved x ≈ 369 + 244 · (*n* − 1):

    | Kolonne | c1 | c2 | c3 | c4 | c5 | c6 | c7 | c8 (regnbue) | c9 (stjernehvid, kun enhjørning) |
    |---|---|---|---|---|---|---|---|---|---|
    | x | 369 | 613 | 857 | 1101 | 1345 | 1589 | 1833 | 2077 | 2321 |

    Racerne ligger ved y ≈ 300–1460, 1590–2750 og 2880–4040. På enhjørningen er det y ≈ 340–1490, 1640–2790 og 2930–4075.
  - **Fit-arkene** følger runde 2:
    - Kolonnernes midte ligger ved x ≈ 374, 630 og 886 (stadie 1), 1141, 1398 og 1653 (stadie 2) og 1910, 2165 og 2422 (stadie 3).
    - Rækkerne er "hverdag-head · through" (y ≈ 290–575), "fest-head · under" (y ≈ 590–870), "hverdag-body" (y ≈ 890–1170) og "tøj i alle humør" (y ≈ 1865–2745).
  - **Filmstrimlerne:**
    - Række *n* starter ved y ≈ 261 + (*n* − 1) · 310, og frame *k* starter ved x ≈ 256 + (*k* − 1) · 244.
    - Nærbilledet af signaturen ligger ved y ≈ 3090–3460, med frame *k* ved x ≈ 65 + (*k* − 1) · 360.
  - **Silhuetterne:** #*n* har midte ved x ≈ 203 + 300 · ((*n* − 1) mod 9). y ≈ 390, 768, 1143 eller 1518 for række 1–4.
- **Iteration:** 3 af højst 4.

## Resultat

| Art | Middel | Laveste score | Krav | Afgørelse |
|---|---|---|---|---|
| Kanin | **4,6** | **3** (kontur) | alle ≥ 4 og middel ≥ 4,3 | **Ikke bestået** |
| Kat | **4,5** | 4 (fem kriterier) | alle ≥ 4 | **Bestået** |
| Hest | **4,4** | 4 (seks kriterier) | alle ≥ 4 | **Bestået** |
| Enhjørning | **4,4** | 4 (seks kriterier) | alle ≥ 4 | **Bestået** |

Kaninen dumper alene på kontur. Årsagen er hullet ved lop-ørets bund (K1), som blev fundet i runde 2 og ikke er rettet. Rettes K1, står kaninen til 4,7 og består.

## 1. Scores

| # | Kriterium | Kanin | Kat | Hest | Enhjørning |
|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 5 | 5 |
| 2 | Silhuet | 5 | 4 | 4 | 4 |
| 3 | Proportioner | 5 | 5 | 5 | 5 |
| 4 | Kontur | **3** | 4 | 4 | 5 |
| 5 | Palet | 5 | 5 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 |
| 7 | Pasform | 5 | 4 | 4 | 4 |
| 8 | Animation | 4 | 5 | 5 | 4 |
| 9 | Butikskort ved 64 px | 5 | 4 | 4 | 4 |
| 10 | AAA-finish | 4 | 4 | 4 | 4 |
| | **Middel** | **4,6** | **4,5** | **4,4** | **4,4** |

Skalaen er brugt strengt:
- 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
- Et 5-tal er kun givet, når hele rubrikkens 5-beskrivelse er opfyldt på alle racer, farver og stadier, jeg har set.
- Hvor jeg afviger fra runde 2's score, står grunden i begrundelsen.

### Begrundelser

**1. Genkendelighed ved 48 px** (`sizes-<art>.png`, række "48 px", y ≈ 262–395)
- **Alle fire 5:**
  - Alle 40 kort læses straks som den rigtige art.
  - LOD-konturen er tyk og mørk, og glad og sover kan skelnes.
- **Hest op fra 4:**
  - Regnbuehesten har nu creme krop med brun kontur og læses ikke længere som en enhjørning (kort 8).
  - Fjordtoppen kan ligne en lille krone, men arten er aldrig i tvivl.

**2. Silhuet** (`silhouettes.png` og blindtesten)
- **Blindtesten:** 32 svar var sikre og 4 usikre, mod 28 og 8 i runde 2.
- **Kanin 5 (op fra 4):**
  - 9/9 sikre.
  - Løvehovedet har nu kindtotter, og ørerne rejser sig klart over ringen. Lop-ørerne hænger ned til skuldrene.
  - Ører, pomponhale og store fødder bærer alle tre racer.
  - De lyse huller ved lop-ørernes bund i #8 og #18 er scoret under kontur (K1).
- **Kat 4 (ned fra 5):**
  - 7/9 sikre.
  - Den langhårede kat (#9, #11 og #30) har en takket kind- og brystkrave og en busket hale uden synlige knurhår, så den kan også læses som en ræv.
  - I #11 sidder kraven kun i venstre side og ligner en vinge.
- **Hest 4 (ned fra 5):**
  - 8/9 sikre.
  - Den arabiske baby (#35) har ingen synlig hale, og ørerne er de samme spidse trekanter som kattens. Silhuetten ligner derfor "en kat med hår".
- **Enhjørning 4 (op fra 3):**
  - 8/9 sikre.
  - Babyhornet når nu op til ørespidserne, og den krøllede halekvast skiller enhjørningen fra hesten, også i sort.
  - Stjernehornet på stadie 1 (#19) er stadig usikkert. I sort skjuler pandelokken skaftet, så stjernen sidder på en kort stilk i højde med ørespidserne og ligner pynt. Det samme ses svagere på #1.

**3. Proportioner** (`species-<art>.png`, `lineup.png`)
- **Alle fire 5:**
  - Tydelig chibi og en klar udvikling fra baby til ung til stor på samme jordlinje.
  - Babyen har størst hoved og øjne, og ingen dele har forkert størrelse.

**4. Kontur** (`closeup-<art>.png`, `species-<art>.png`)
- **Kanin 3 (ned fra 4):**
  - **Hullet ved lop-øret (K1):** Ved lop-ørets bund er der stadig en søm, hvor kortets baggrund ses mellem øret og hovedet. Det gælder alle 8 farver og alle stadier. Det ses i nærbillederne, ved 256 px og i arts-arket ved 1:1, og det giver lukkede huller i silhuetterne.
  - **Derfor 3:** Det er præcis rubrikkens 3-beskrivelse: "synlige sømme (fx hvor øret møder hovedet)". Fundet blev givet med koordinater og rettemetode i runde 2.
  - **Regnbuesmækken (K4):** Smækkens underkant stikker stadig ud som to kroge.
  - Opret og løvehoved har ren kontur.
- **Kat 4:**
  - Den sorte kat har fået en lys lilla-grå kontur, så ben, krop og hale skilles ad.
  - Tilbage er én fejl: Regnbuekravens kant krydser armenes kontur i jubel-posen.
- **Hest 4:**
  - Den sorte hest har fået lys kontur.
  - Fjordtoppen er sat på som en kasse. Den har en vandret søm ved bunden og små trin i konturen, hvor den møder hovedet, så den ikke vokser ud af hovedet.
- **Enhjørning 5:** Ensartet pastelkontur, der er afledt af pelsen, også omkring hornhullet i huen og festhatten.

**5. Palet** (`species-<art>.png`)
- **Kanin 5 (op fra 4):**
  - Guld har nu ravkontur, ravskygge og glansbånd på hoved og krop (K7), og smækken har flade striber.
  - Otte smukke og tydeligt forskellige farver.
- **Kat 5 (op fra 4):**
  - c6 er nu tydeligt blå, den sorte kat har kantlys, og kraven har flade striber.
  - Den bedste guld af de fire.
- **Hest 4:**
  - Regnbuehesten er nu creme med brun kontur (H3), og isabel, palomino og guld kan skelnes.
  - I fjord-sektionen er der dog tre lyse heste tæt på hinanden: c2 hvid-grå, c4 isabel og regnbue. Regnbuen bæres kun af en lille top og halen.
- **Enhjørning 4:**
  - Hvid er nu varm elfenben, og stjernehvid er kold med guldhove.
  - Til gengæld har regnbuen fået lavendel krop og ligner nu c3 lavendel i alle tre racer. Kun manken skiller dem ad.

**6. Ansigtets appel** (`closeup-<art>.png`, `moods-<art>.png`)
- **Kanin, kat og enhjørning 5:**
  - Store, blanke øjne med to højlys, og kinder og næse sidder godt.
  - Alle 7 humør læses straks, og bobler og Zzz sidder frit af ører, manke og horn.
- **Hest 5 (op fra 4):**
  - Fjordtoppens "tredje øje" er væk.
  - Den sorte arabers stjerne er nu en hel lille stjerne under pandelokken.
  - Tankeboblen sidder frit af manken.

**7. Pasform** (`fit-<art>.png`, `fitmatrix.png`)
- **Kanin 5 (op fra 4):**
  - Ørerne på opret og løvehoved går gennem huens huller, og lop-ørerne hænger naturligt ned under huen.
  - Festhatten sidder mellem ørerne.
  - Trøjen følger kroppen med poterne frem af ærmerne og ribkanten på hoften, også på baby-løvehovedet (K8).
  - Ærmerne følger armene i alle 7 humør.
- **Kat 4:**
  - Hattene sidder perfekt.
  - Trøjens ærmer er stadig korte kasser, der starter midt på maven og læses som lommer (C2).
  - Maine coon-skulderbuerne titter frem over halsudskæringen (C1).
- **Hest 4:**
  - Hattene sidder godt, og fjordtoppen er gemt under huen.
  - Ærmerne er stadig to høje rektangler (H6). Kun manchetten er blevet buet.
  - På stadie 3 titter et hjørne af fjordtoppen frem bag festhatten.
- **Enhjørning 4 (op fra 3):**
  - **Hue (E1, løst):** Hornet går gennem et hul med kant, og pomponen er flyttet til venstre.
  - **Festhat (E2, løst):** Hatten er vippet ned mellem venstre øre og hornet, så hornet står frit.
  - **Tilbage:** Festhatten er tydeligt mindre end på de andre arter og dækker den nederste del af venstre øres inderside. Ærmerne har samme kasseform som hestens.
  - **Mint på mint:** Den mint trøje kan nu ses på mint pels, fordi den har en mørkere kontur.
  - `fitmatrix.png` viser det samme.

**8. Animation** (`filmstrip-<art>.png`)
- **Kat 5 (op fra 4):**
  - Halekrøllen ses tydeligt, både i nærbilledet og i normal størrelse, med krøl, overshoot og pause.
  - Hoppet har squash, hvert humør har sit eget tempo, og blink og ørevip sker.
- **Hest 5 (op fra 4):**
  - Mankekastet er den tydeligste signatur af de fire.
  - Vinket (række 7) har nu det største udsving af alle arter (H4).
- **Kanin 4:**
  - Hop, jubel og humør er stadig gode.
  - Næsevippet er større end i runde 2: ca. 3–4 enheder, og knurhårene følger med.
  - I normal størrelse flytter næsen sig dog kun ca. 3 px i PNG'en (ca. 1,5 CSS-px) og ses næsten ikke (K2).
- **Enhjørning 4:**
  - Glimtet ses nu ved 100 % i 3 frames (E5).
  - Men det er en tynd stjerne i den dæmpede lilla konturfarve og forsvinder let mod det hvide kort. Ved 48 px kan det ikke ses.

**9. Butikskort ved 64 px** (`sizes-<art>.png`)
- **Kanin 5 (op fra 4):**
  - Genstanden alene fylder kortet godt, og de tre farvesæt er klart forskellige.
  - Trøjekortene er nu beskåret fra hagen og ned, uden øjne (K5).
- **Kat 4 og hest 4:** Beskæringen er rettet, men på trøjekortene (kort 7–9, x ≈ 996–1444, y ≈ 1880–2010) fylder de kasseformede ærmer midten, så trøjen ikke læses som en trøje.
- **Enhjørning 4 (op fra 3):**
  - Huekortene (1–3) er nu rene.
  - På festhatkortene (4–6) er hatten lille og sidder i hjørnet, mens hornet dominerer.
  - Trøjekortene har samme ærmeproblem som hestens.

**10. AAA-finish** (alle ark)
- **Alle fire 4:** Gennemført og charmerende. Det, der mangler til 5 ("uden en eneste fejl"):
  - **Kanin:** K1, K4 og K2.
  - **Kat:** ærmerne, skuldrene og kraven.
  - **Hest:** ærmerne og fjordtoppens kasseform.
  - **Enhjørning:** festhattens størrelse, c3 mod regnbue og det svage glimt.

## 2. Gate-afgørelse

- **Kanin: ikke bestået.**
  - Kontur står til 3, så kravet "alle kriterier ≥ 4" er ikke opfyldt, selv om middel er 4,6.
  - Den eneste blokerende fejl er K1. Når K1 er rettet, og konturen når 4, står kaninen til 4,7 og består.
- **Kat: bestået.** Alle kriterier er ≥ 4, og middel er 4,5.
- **Hest: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Enhjørning: bestået.** Alle kriterier er ≥ 4, og middel er 4,4 (4,1 i runde 2). De tre blokerende fund fra runde 2 (E1–E3) er rettet nok til 4.
- **Blindtesten** (rubrikkens accept-punkt):
  - Alle 36 svar stemmer med racerne og stadierne på arts-arkene. Nummereringen er den samme faste rækkefølge som i runde 2, og jeg har ikke set nogen facitliste.
  - Kravet "alle racer og stadier rammes" er dermed opfyldt.
  - Fire svar var usikre: #11 og #30 (kat/ræv), #19 (enhjørning/hest) og #35 (hest/kat).
- **Iteration:** Dette er runde 3 af højst 4. Næste runde er den sidste før eskalering, så K1 bør både rettes og tjekkes automatisk (se forbedring 1).

## 3. Kanin: fejl, der skal rettes (prioriteret)

**K1. Hul ved lop-ørets bund (kontur 3). Blokerende.**
- **Hvor:**
  - `closeup-rabbit.png`, karamel-lop (glad): (1225–1280, 651–715) og (1519–1575, 651–717). Kortets baggrund (ca. #DBEBEC) ses mellem ørets fyld og hovedets kontur.
  - `closeup-rabbit.png`, regnbue-lop (jubel): hvide kiler ved (872–891, 1580–1627) og (1135–1161, 1559–1603).
  - `sizes-rabbit.png`, 256 px (hvid lop):
    - Hovedets kontur er brudt i løse stumper ved (828–843, 1100–1110) og (972–988, 1100–1110).
    - Baggrunden ses ved (788–797, 1130–1153) og (1022–1030, 1130–1153).
  - `species-rabbit.png`, lop-sektionen (y ≈ 1590–2750): alle 8 farver og alle stadier. Tydeligst på c3 brun (x ≈ 857), c4 hollænder (1101) og c5 orange (1345).
  - `silhouettes.png`: lukkede lyse huller i #8 ved (2240–2249, 307–326) og (2358–2367, 307–326) og i #18 ved (2544–2552, 709–726) og (2655–2663, 709–726).
- **Fejlen:**
  - Øret og hovedet er to fyldflader, der ikke overlapper ved ørebasen.
  - Der er derfor en linseformet sprække med baggrund imellem dem, og hovedets kontur ender i løse stumper.
  - Fejlen er uændret siden runde 2.
- **Ret sådan:**
  - Tegn hoved og lop-ører som én samlet fyldflade under konturen, eller lad ørets fyld fortsætte 4–6 enheder ind under hovedets fyld.
  - Hovedets kontur skal løbe ubrudt hen over ørebasen med runde samlinger og uden løse stumper.
- **Tjek:**
  - Render alle lop-figurer på magenta baggrund: 3 stadier × 8 farver × 7 humør, ved 96 px og 256 px og i nærbilleder.
  - Der må ikke være en eneste magenta-pixel inden for yderkonturen.
  - I `silhouettes.png` må #8, #16 og #18 ikke have lukkede, lyse områder ved ørebaserne.
- **Mål:** Konturen når 4, eller 5, hvis K4 også rettes. Kaninen består så med middel 4,7.

**K4. Regnbuesmækkens kroge (kontur). Rettes samtidig, men er ikke blokerende alene.**
- **Hvor:** `closeup-rabbit.png`, regnbue-lop (jubel): (982–1000, 1832–1846) og (1070–1086, 1830–1842). Det er de samme koordinater som i runde 2.
- **Fejlen:**
  - Gradienten er erstattet af flade striber. Den del er rettet.
  - Smækkens muslingeformede underkant fortsætter dog ud over smækkens sider og stikker ud som to kroge forbi armenes kontur.
- **Ret sådan:**
  - Klip smækken (fyld og underkant) til brystfladen inden for armene, og tegn armene oven på smækken.
  - Afslut muslingekanten med runde ender mindst 2 enheder inden for smækkens sidekanter.
  - Tjek alle humør med løftede arme (jubel, tænker, ups og vinker) på alle tre racer og stadier.

**K2. Næsevippet ses næsten ikke i normal størrelse (animation 4). Ikke blokerende.**
- **Hvor:**
  - `filmstrip-rabbit.png`, række 9 (y ≈ 2741–3000): næsen ved ca. (368, 2887) i frame 1.
  - Nærbilledet (y ≈ 3090–3460): næsen ved ca. (230, 3315).
- **Målt:**
  - Næsen flytter sig ca. 3 px i normal størrelse (ca. 1,5 CSS-px) og 7–8 px i nærbilledet. Den går skiftevis op og ned i frame 2, 4 og 6, og knurhårene følger med.
  - Kravet om mindst 3 enheder er opfyldt, men vippet ses kun, hvis man leder efter det.
- **Ret sådan:**
  - Løft næse, overlæbe og knurhårsrødder 5–6 enheder i toppunktet, med et lille lodret squash af næsen (ca. 0,85).
  - Læg et nik med hovedet på 1–2 enheder på overshoot-framen.
  - Behold 3 frames ud, ét overshoot og en pause.

## 3b. Forbehold for de arter, der har bestået (rettes før næste runde)

### Kat
1. **C2: ærmer, der ligner lommer** (pasform og butikskort).
   - **Hvor:**
     - `fit-cat.png`, "hverdag-body" (y ≈ 890–1170), alle 9 celler.
     - `closeup-cat.png`, maine coon med hue og trøje: (2157–2287, 993–1113) og (2310–2443, 993–1113).
     - `sizes-cat.png`, kort 7–9.
   - **Fejlen:**
     - Manchetten sidder nu over poten, og ribkanten ligger bag ærmet.
     - Men ærmet er stadig en kort, lukket kasse, der starter midt på maven, og det læses som en lomme.
   - **Ret sådan:**
     - Lad ærmet starte ved skulderen under hovedets kant, ligesom på kaninen.
     - Ærmet skal følge armen og slutte med manchetten lige over poten.
     - Tegn ingen lukket top-kontur på ærmet midt på maven, og lad striberne fortsætte over ærmet i samme højde som på kroppen.
2. **C1: maine coon-skulderbuerne titter frem.**
   - **Hvor:** `closeup-cat.png` (2167–2200, 810–833) og (2400–2440, 810–843). Det er uændret siden runde 2.
   - **Ret sådan:**
     - Hæv trøjens skulderlinje 3–4 enheder, eller klip kroppens skulderbuer til trøjens fyld, så halsudskæringen dækker dem.
3. **C3: regnbuekravens kant krydser armene i jubel.**
   - **Hvor:** `closeup-cat.png`, regnbue (jubel): blå fyld uden for armene ved (994–1010, 1831–1857) og (1060–1071, 1826–1846).
   - **Ret sådan:** Brug samme løsning som K4. Klip kraven til brystfladen inden for armene, og tegn armene ovenpå.
4. **Silhuet: den langhårede kat ligner en ræv.**
   - **Hvor:**
     - `silhouettes.png` #11 (503, 768), #30 (803, 1518) og #9 (2603, 390).
     - `species-cat.png`, langhår-sektionen (y ≈ 1590–2750).
   - **Ret sådan:**
     - Gør kraven symmetrisk og blødere, med 3–4 runde totter i stedet for spidse takker, og hold den inden for hovedets bredde + 10 %.
     - Lad 2–3 knurhår stikke mindst 6 enheder ud over kraven, både i silhuetten og i LOD.

### Hest
1. **H6: ærmerne er høje rektangler** (pasform og butikskort).
   - **Hvor:**
     - `fit-horse.png`, "hverdag-body".
     - `closeup-horse.png`, araber med hue og trøje: (2199–2296, 842–1049) og (2302–2405, 842–1049).
     - `sizes-horse.png`, kort 7–9.
   - **Ret sådan:** Brug samme ærmeløsning som C2. Ærmet skal desuden være ca. 20 % smallere forneden og følge forbenet.
2. **Fjordtoppen er en påsat kasse** (kontur og finish).
   - **Hvor:**
     - `closeup-horse.png`: toppen ved (1300–1500, 470–640), med trin i konturen ved (1320–1360, 590–625) og (1450–1490, 590–625).
     - `species-horse.png`, fjord-sektionen (y ≈ 1590–2750).
     - `fit-horse.png`, "fest-head · under", stadie 3 (x ≈ 2165): toppens hjørne titter frem bag festhatten ved (2177–2186, 634–643).
   - **Ret sådan:**
     - Fjern den vandrette bundkontur, og lad toppens sider flyde ind i hovedets kontur med runde samlinger.
     - Gør toppen smallere foroven, med 5–7 totter i forskellig højde.
     - Lad den mørke midterstribe fortsætte 6–8 enheder ned i panden.
     - Klip toppen til festhattens bund.
3. **Silhuet: den arabiske baby mangler hale.**
   - **Hvor:** `silhouettes.png` #35 (2303, 1518).
   - **Ret sådan:**
     - Lad halen stikke mindst 10 enheder ud til højre ved hoften, som på #29 og #31.
     - Giv hestens ører en smallere, bladformet form, så de ikke er de samme som kattens trekanter.
4. **Palet: regnbue-fjorden.**
   - **Hvor:** `species-horse.png`, fjord-sektionen: c2 (x ≈ 613), c4 (1101) og regnbue (2077).
   - **Ret sådan:**
     - Lad toppen vise alle fire striber, hver mindst 3 enheder, og gør halen fuldt stribet.
     - Giv c4 isabel en lidt mørkere gulbrun tone, så de tre lyse fjordheste skilles ad.

### Enhjørning
1. **Festhatten er for lille og dækker venstre øre** (pasform og butikskort).
   - **Hvor:**
     - `closeup-unicorn.png`, stjernehorn · 2 · c4 · festhat: (1570–1672, 1478–1560).
     - `fit-unicorn.png`, "fest-head · under" (y ≈ 590–870), alle 9 celler.
     - `sizes-unicorn.png`, kort 4–6 (x ≈ 528–976, y ≈ 1880–2010).
   - **Ret sådan:**
     - Giv hatten samme størrelse som på hesten.
     - Placér keglens bund på hovedet mellem venstre øre og hornet, så mindst 2/3 af venstre øres inderside kan ses.
     - Hornet skal stadig stå frit med mindst 4 enheders luft.
2. **Palet: regnbue ligner c3 lavendel.**
   - **Hvor:** `species-unicorn.png`, c3 (x ≈ 857) og regnbue (x ≈ 2077) i alle tre racer.
   - **Ret sådan:** Giv regnbuen sin egen kropstone, fx lys fersken eller abrikos, så kun manke og hale bærer regnbuen.
3. **Silhuet: stjernehornet på stadie 1–2.**
   - **Hvor:**
     - `silhouettes.png` #19 (203, 1143) og #1 (203, 390).
     - `species-unicorn.png`, stjernehorn-sektionen (y ≈ 2930–4075), stadie 1–2.
   - **Ret sådan:**
     - Gør hornet 6–8 enheder længere, så stjernen sidder klart over ørespidserne.
     - Del pandelokken til siderne, så mindst 2/3 af skaftet står frit, også i sort.
4. **Glimtet er svagt** (animation).
   - **Hvor:** `filmstrip-unicorn.png`:
     - Række 9 (y ≈ 2741–3000), frame 2–4, fx ved (609, 2800).
     - Nærbilledet, fx (1305–1335, 3131–3170) i frame 4.
   - **Ret sådan:**
     - Tegn glimtet som en hvid, udfyldt firtakket stjerne med tynd guldkontur i stedet for den lilla konturfarve, og tilføj en lille ekstra stjerne.
     - Lad hornets højlysstribe gå fra 0,4 til 1 til 0,4 samtidig.
     - Brug kun opacity.

## 4. Runde 2-fund: status

### Kanin

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| K1 | Hul ved lop-ørets bund | **Ikke rettet** | Samme sted, i alle farver og størrelser. Blokerende. |
| K2 | Næsevippet ses ikke | **Delvist rettet** | Næsen bevæger sig ca. 3–4 enheder, og knurhårene følger med, men vippet ses næsten ikke i normal størrelse. |
| K3 | Boble og Zzz på lop-øret | **Rettet** | De sidder frit af øret i alle racer og stadier. |
| K4 | Regnbuesmækken | **Delvist rettet** | Flade striber, men de to kroge er der stadig, på samme koordinater. |
| K5 | Trøjekort gennem øjnene | **Rettet** | Beskåret fra hagen til hoften. |
| K6 | Løvehoved og baby-lop i silhuet | **Rettet** | 9/9 sikre kaniner i min blindtest. |
| K7 | Guld uden glansbånd | **Rettet** | Glansbånd på hoved og krop. |
| K8 | Baby-løvehovedets trøje | **Rettet** | Trøjen ses under en kortere mankekrave. |

### Kat

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| C1 | Maine coon-skuldre over halsudskæringen | **Ikke rettet** | Samme sted som i runde 2. |
| C2 | Ærmer, der ligner lommer | **Delvist rettet** | Manchetten sidder over poten og ribkanten bag ærmet, men ærmet er stadig en kort kasse midt på maven. |
| C3 | Regnbuekraven | **Delvist rettet** | Flade striber, men kanten krydser stadig armene i jubel. |
| C4 | c3 og c6 ligner hinanden | **Rettet** | c6 er tydeligt blå. |
| C5 | Den sorte kat flyder sammen | **Rettet** | Lys lilla-grå kontur. |
| C6 | Trøjekort gennem øjnene | **Rettet** | |

### Hest

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| H1 | Fjordtoppen ligner et tredje øje | **Rettet** | Nu en børstet top med midterstribe. Nyt forbehold: kasseform med bundsøm (se 3b). |
| H2 | Den sorte arabers stjerne | **Rettet** | En hel lille stjerne under pandelokken. |
| H3 | Regnbuehesten ligner en enhjørning | **Rettet** | Creme krop med brun kontur og regnbue i manke og hale. |
| H4 | Vinket er for stift | **Rettet** | Det største udsving af de fire arter. |
| H5 | Tankeboblen på manken | **Rettet** | |
| H6 | Ærmer, der ligner lommer | **Delvist rettet** | Buet manchet, men stadig to høje rektangler. |
| H7 | Trøjekort gennem øjnene | **Rettet** | |

### Enhjørning

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| E1 | Horn og hue | **Rettet** | Hornhul med kant, pomponen til venstre, og stjernen står frit. |
| E2 | Horn og festhat | **Rettet** | Hatten er vippet ned mellem venstre øre og hornet. Nyt forbehold: hatten er lille og dækker øret. |
| E3 | Silhuet for stjernehorn og baby | **Delvist rettet** | Babyhornet når ørespidserne, og halekvasten er krøllet. Stjernehornet på stadie 1–2 er stadig usikkert i sort (#19). |
| E4 | Trøjekort gennem øjnene | **Rettet** | |
| E5 | Glimtet ses ikke | **Rettet** | Det ses ved 100 %, men er svagt i lilla konturfarve. |
| E6 | Næsten hvide farver og mint på mint | **Delvist rettet** | Hvid og stjernehvid er skilt ad, og den mint trøje ses. Regnbuen ligner nu c3 lavendel. |
| E7 | Tankeboblen på manken | **Rettet** | |

**I alt:** 19 af runde 2's 28 fund er rettet, 7 er delvist rettet (K2, K4, C2, C3, H6, E3 og E6), og 2 er ikke rettet (K1 og C1). Kun K1 er blokerende.

## 5. De 3 vigtigste forbedringer på tværs af arterne

1. **Fang huller og sømme automatisk.**
   - K1 overlevede en runde, selv om koordinater og rettemetode stod i runde 2-reviewet.
   - Tilføj en lint, der renderer alle arter, racer, farver, stadier og humør på magenta baggrund og fejler ved én magenta-pixel inden for yderkonturen.
   - Tilføj også et tjek i silhuet-arket for lukkede, lyse områder, der ikke er bevidst negativt rum.
   - Det retter kaninens blokerende fejl og forhindrer, at fejlen kommer igen.
2. **Tegn trøjens ærmer om på kat, hest og enhjørning.**
   - Ærmerne er korte eller høje lukkede kasser midt på maven, og de læses som lommer eller en overall.
   - Ærmet skal starte ved skulderen under hovedets kant, ligesom på kaninen, følge armen og slutte med manchetten lige over poten. Der må ikke være nogen lukket top-kontur.
   - Det løfter pasform, butikskort og finish på tre arter på én gang.
3. **Gør regnbuen til en ren og særlig variant på alle arter.**
   - Regnbuens brystpynt (kaninens smæk og kattens krave) skal klippes til brystfladen inden for armene i alle poser (K4, C3).
   - Regnbuevarianten skal have sin egen kropstone, der ikke ligger tæt på en almindelig farve (enhjørningens c3 lavendel og fjordens isabel).
   - Regnbuen skal altid vise alle fire flade striber, hver mindst 3 enheder.

## Bilag: rubrikkens JSON-format

```json
{
  "species": "rabbit",
  "scores": {
    "recognizability48": 5, "silhouette": 5, "proportions": 5, "outline": 3, "palette": 5,
    "faceAppeal": 5, "fit": 5, "animation": 4, "shopCard64": 5, "aaaFinish": 4
  },
  "mean": 4.6,
  "pass": false,
  "issues": [
    { "criterion": "outline", "sheet": "closeup-rabbit.png", "at": [1252, 683], "note": "K1, blokerende: lop-ørets bund har en sprække, hvor kortets baggrund ses mellem øret og hovedet. Også [1547, 684], regnbue-lop [881, 1603] og [1148, 1581], sizes-rabbit.png 256 px [835, 1105] og [980, 1105], silhouettes.png #8 [2244, 316] og [2362, 316] samt #18 [2548, 717] og [2659, 717]. Alle lop-farver og stadier." },
    { "criterion": "outline", "sheet": "closeup-rabbit.png", "at": [991, 1839], "note": "K4: regnbuesmækkens underkant stikker ud som to kroge forbi armene, også ved [1078, 1836]. Striberne er nu flade." },
    { "criterion": "animation", "sheet": "filmstrip-rabbit.png", "at": [368, 2887], "note": "K2: næsevippet er ca. 3 px i normal størrelse (ca. 1,5 CSS-px) og ses næsten ikke." }
  ]
}
```

```json
{
  "species": "cat",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 5,
    "faceAppeal": 5, "fit": 4, "animation": 5, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.5,
  "pass": true,
  "issues": [
    { "criterion": "fit", "sheet": "closeup-cat.png", "at": [2222, 1053], "note": "C2: ærmerne er korte, lukkede kasser midt på maven og læses som lommer. Gælder alle 9 celler i fit-cat.png 'hverdag-body' og trøjekortene." },
    { "criterion": "fit", "sheet": "closeup-cat.png", "at": [2183, 821], "note": "C1: maine coon-skulderbuerne titter frem over halsudskæringen, også ved [2420, 826]." },
    { "criterion": "outline", "sheet": "closeup-cat.png", "at": [1002, 1844], "note": "C3: regnbuekravens kant krydser armenes kontur i jubel, også ved [1065, 1836]." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [503, 768], "note": "#11 langhår: takket, asymmetrisk krave uden knurhår læses som ræv eller vinge. Også #30 [803, 1518] og #9 [2603, 390]." },
    { "criterion": "shopCard64", "sheet": "sizes-cat.png", "at": [1220, 1945], "note": "Trøjekortene på kat domineres af de kasseformede ærmer." }
  ]
}
```

```json
{
  "species": "horse",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 5, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "fit", "sheet": "closeup-horse.png", "at": [2300, 945], "note": "H6: ærmerne er to høje rektangler uden skulder (overall-look). Gælder fit-horse.png 'hverdag-body' og trøjekortene." },
    { "criterion": "outline", "sheet": "closeup-horse.png", "at": [1340, 607], "note": "Fjordtoppen er sat på som en kasse med vandret bundsøm og trin i konturen, også ved [1470, 607]. Læses som en krone ved 48 px." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [2303, 1518], "note": "#35 arabisk baby: ingen synlig hale, og ørerne er de samme som kattens. Usikker i blindtesten." },
    { "criterion": "palette", "sheet": "species-horse.png", "at": [2077, 2020], "note": "Regnbue-fjorden ligner c4 isabel [1101, 2020] og c2 [613, 2020]. Regnbuen bæres kun af en lille top og halen." },
    { "criterion": "fit", "sheet": "fit-horse.png", "at": [2181, 638], "note": "Fjordtoppens hjørne titter frem bag festhatten på stadie 3." }
  ]
}
```

```json
{
  "species": "unicorn",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 5, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "fit", "sheet": "closeup-unicorn.png", "at": [1620, 1520], "note": "Festhatten er mindre end på de andre arter og dækker den nederste del af venstre øres inderside. Gælder alle 9 celler i 'fest-head · under' og sizes-unicorn.png kort 4-6." },
    { "criterion": "palette", "sheet": "species-unicorn.png", "at": [2077, 770], "note": "Regnbuens lavendel krop ligner c3 lavendel [857, 770] i alle racer." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [203, 1143], "note": "#19 stjernehorn, baby: pandelokken skjuler skaftet, og stjernen sidder i højde med ørespidserne og læses som pynt. Svagere på #1 [203, 390]." },
    { "criterion": "animation", "sheet": "filmstrip-unicorn.png", "at": [1320, 3150], "note": "Glimtet er en tynd stjerne i lilla konturfarve: svagt ved 100 % og usynligt ved 48 px." }
  ]
}
```
