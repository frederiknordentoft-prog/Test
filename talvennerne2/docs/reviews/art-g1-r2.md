# Kunst-review, runde 2 (G1 · r2): kanin, kat, hest og enhjørning

- **Reviewer:** frisk og uafhængig agent. Jeg har ikke tegnet noget af det, jeg bedømmer, og jeg har ikke læst kildekode (heller ikke `lint.json`).
- **Grundlag:** `docs/art-rubric.md`, runde 1-reviewet `docs/reviews/art-g0-r1.md` og alle 27 PNG-ark i `/home/user/wt/w4/talvennerne2/artifacts/sheets/` (genereret 1. okt. 2026 kl. 10:33). Arkene er set i fuld størrelse og derefter i udsnit med 2–6× zoom. Bevægelse i filmstrimlerne er også målt med pixel-diff og "løg-hud" (alle 8 frames lagt oven på hinanden).
- **Blindtest:** `docs/reviews/art-g1-r2-blind.md` blev skrevet og committet, før noget andet blev åbnet. Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1).
  - **Fit-arkene:** kolonnernes midte ligger ved x ≈ 374, 630 og 886 (stadie 1), 1141, 1398 og 1653 (stadie 2) og 1910, 2165 og 2422 (stadie 3). I hvert stadie er de tre kolonner farve 0/1/2, og racerne skifter på samme måde.
  - **Rækkerne i fit-arkene:**
    - "hverdag-head · through": y ≈ 290–575
    - "fest-head · under": y ≈ 590–870
    - "hverdag-body": y ≈ 890–1170
    - "tøj i alle humør": y ≈ 1865–2150, 2165–2450 og 2460–2745
  - **Filmstrimlerne:** række *n* starter ved y ≈ 261 + (*n* − 1) · 310. Frame *k* starter ved x ≈ 256 + (*k* − 1) · 244.
- **Iteration:** 2 af højst 4.

## Resultat

| Art | Middel | Laveste score | Krav | Afgørelse |
|---|---|---|---|---|
| Kanin | **4,3** | 4 (syv kriterier) | alle ≥ 4 og middel ≥ 4,3 | **Bestået**, men præcis på grænsen |
| Kat | **4,4** | 4 (seks kriterier) | alle ≥ 4 | **Bestået** |
| Hest | **4,2** | 4 (otte kriterier) | alle ≥ 4 | **Bestået** |
| Enhjørning | **4,1** | **3** (silhuet, pasform, butikskort) | alle ≥ 4 | **Ikke bestået** |

## 1. Scores

| # | Kriterium | Kanin | Kat | Hest | Enhjørning |
|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 4 | 5 |
| 2 | Silhuet | 4 | 5 | 5 | **3** |
| 3 | Proportioner | 5 | 5 | 5 | 5 |
| 4 | Kontur | 4 | 4 | 4 | 5 |
| 5 | Palet | 4 | 4 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 4 | 5 |
| 7 | Pasform | 4 | 4 | 4 | **3** |
| 8 | Animation | 4 | 4 | 4 | 4 |
| 9 | Butikskort ved 64 px | 4 | 4 | 4 | **3** |
| 10 | AAA-finish | 4 | 4 | 4 | 4 |
| | **Middel** | **4,3** | **4,4** | **4,2** | **4,1** |

Skalaen er brugt strengt: 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau". Et 5-tal er kun givet, når alle punkter i rubrikkens 5-beskrivelse er opfyldt på alle racer, farver og stadier.

### Begrundelser

**1. Genkendelighed ved 48 px** (`sizes-<art>.png`, række "48 px")
- **Kanin 5:** Alle 10 kort læses straks som kanin. LOD-konturen er mørk og tyk, knurhårene er væk, og beskæringen er tæt. Den hvide baby har nu kontur. Glad og sover kan skelnes.
- **Kat 5:** Samme niveau. Selv den sorte langhårede kat læses på ører og øjne.
- **Hest 4:** Syv af otte farver er tydelige. Regnbuehesten (fjord, kort 8, (1156–1284, 262–395)) har lilla-hvid krop og regnbuetop og læses som en enhjørning. Fjordtoppen læses som en lille krone.
- **Enhjørning 5:** Hornet ses på alle kort, også stjernehornet.

**2. Silhuet** (`silhouettes.png` og blindtesten)
- **Kanin 4:**
  - **Det, der virker:** Ører, pomponhale og store, flade fødder bærer silhuetten, og de tre racer kan skelnes i sort.
  - **Det, der svigter:** Fire af ni var usikre i blindtesten. Løvehovedets krøllede ring læses som lam (#22, #33, #36), og baby-lop (#16) som hvalp.
- **Kat 5:** 9/9 sikre. Spidse ører, knurhår og krølhale. Racerne skelnes i sort: maine coon har ørespidser, og den langhårede har krave.
- **Hest 5:** 9/9 sikre. Man og hale bærer silhuetten, og racerne kan skelnes: pandelok (shetland), top (fjord) og lang man (araber).
- **Enhjørning 3:**
  - Kroppen er identisk med hestens, så arten hænger alene på hornet. Det svigter i 4 af 9 silhuetter.
  - På stjernehornet (#1, #19, #24) erstatter stjernen hornet og bliver til "en stjerne på en stilk". I blindtesten noterede jeg "lige så godt en hest med stjernepynt".
  - På babyen (#4) er hornet lavere end ørerne og læses som en pandelok-tot.

**3. Proportioner** (`species-<art>.png`, `lineup.png`)
- **Kanin 5:**
  - Stadie 3 er nu tydeligt større og mere voksen, med længere ører og større fødder og hale.
  - Armene forsvinder ind under hovedet, og babyen har størst hoved og øjne.
- **Kat 5, Hest 5 og Enhjørning 5:** Tydelig chibi og en troværdig udvikling fra baby til ung til stor på samme jordlinje. Der er ingen dele med forkert størrelse.

**4. Kontur** (`closeup-<art>.png`, `species-<art>.png`)
- **Kanin 4:**
  - **Det, der virker:** Konturen er ensartet, og Hollænderen har nu én konturfarve. Der er ingen sømme på opret og løvehoved.
  - **Lop-ørets hul:** Mellem lop-ørets bund og hovedet er der et linseformet hul, hvor baggrunden ses igennem. Det findes på alle lop-farver og også ved 256 px (se K1).
  - **Regnbuesmækken:** Den muslingeformede kontur stikker ud som to spidser.
- **Kat 4:** Ren kontur generelt. Hos den sorte kat (`species-cat.png` c2, x ≈ 611) er konturen næsten lige så mørk som pelsen, så ben, krop og hale flyder sammen. Regnbuekravens kant krydser armenes kontur (`closeup-cat.png` (1000–1090, 1820–1860)).
- **Hest 4:** Samme problem med sort pels (`species-horse.png` c3). Den sorte arabers stjerne ligner et hul i fyldet (H2).
- **Enhjørning 5:** Ensartet pastelkontur, der er afledt af pelsen, og pandelokken lægger sig fint om hornets bund. At hatte og horn krydser hinanden, er scoret under pasform.

**5. Palet** (`species-<art>.png`)
- **Kanin 4:**
  - **Det, der virker:** Varm palet med otte tydelige farver. Regnbuen har nu eget særpræg (top, smæk og hale).
  - **Guld:** Ravkontur, ravskygge og gnister, men ikke det smalle glansbånd, som guldkatten har.
  - **Regnbuesmækken:** Den har en lodret gradient på kroppen. Rubrikken tillader kun gradient i manke og hale.
- **Kat 4:** Den bedste guld af de fire (glansbånd på krop og hoved). Men c3 grå-stribet og c6 blå-grå ligger for tæt på hinanden, regnbuekraven har gradient, og den sorte kat er flad.
- **Hest 4:** Isabel, palomino og guld er tre varme gule toner tæt på hinanden. Regnbuehesten bruger enhjørningens palet (lilla-hvid med regnbue) og læses som en enhjørning uden horn.
- **Enhjørning 4:** Smuk pastelpalet. Men hvid, regnbue og stjernehvid har næsten samme krop, og mint trøje på mint enhjørning forsvinder.

**6. Ansigtets appel** (`closeup-<art>.png`, `moods-<art>.png`)
- **Kanin 5:**
  - Store, blanke øjne med to højlys, godt placerede kinder og næse.
  - Alle 7 humør læses straks. "Ups" er nu legende med blink, tunge og sveddråbe, og fortænderne er rettet.
  - Bobler oven på lop-øret er et kompositionsproblem, som står under forbehold (K3).
- **Kat 5:** Hjertenæse og mulepude giver karakter, og alle humør læses.
- **Hest 4:**
  - Fjordtoppen er en rund ring med en lodret spalte lige over øjnene og læses som et tredje øje (`closeup-horse.png` (1340–1460, 520–655)).
  - Den sorte arabers stjerne ligner et hul.
  - Tankeboblen ligger på manken.
- **Enhjørning 5:** Øjenvipper og blanke øjne, og alle 7 humør læses. Boblen på manken i stjernehorn-rækken er en mindre sag (E7).

**7. Pasform** (`fit-<art>.png`, `fitmatrix.png`)
- **Kanin 4:**
  - Alle runde 1-fund om tøjet er rettet: ørerne går op gennem huller med kant ovenpå, ærmerne følger armene i alle 7 humør, og ribkanten sidder inden for konturen ved hoften.
  - Tilbage er to ting. Baby-løvehovedets manke skjuler næsten hele trøjen (K8). Løvehovedets "ups" giver en stor grøn ærmeflade ved siden af manken (`fit-rabbit.png` "tøj i alle humør" række 3, ups, x ≈ 1398).
- **Kat 4:** Hattene sidder godt. Men maine coon-kroppens skulderbuer stikker op over trøjens halsudskæring, og ærmerne er korte stumper oven på ribkanten, der læses som lommer (C1, C2).
- **Hest 4:** Hattene sidder godt; ørerne går gennem hullerne, og fjordtoppen ligger under huen. Ærmerne på forbenene er to rektangler, der ligner lommer eller en overall (H6).
- **Enhjørning 3:** Horn og hat er forkert i alle 18 hattecellerne (E1, E2), og mint trøje på mint pels forsvinder.

**8. Animation** (`filmstrip-<art>.png`)
- **Kanin 4:**
  - Hoppet har squash og stretch, og jublen har tydelig bounce. Blink og ørevip sker, og hvert humør har sin egen kropspose og rytme.
  - Signaturen virker ikke: næsen flytter sig kun 1–2 px (række 9) og ses ikke.
- **Kat 4:** Hop med squash. Halekrøllen kan ses, men er beskeden. Vinket er det tydeligste af de fire arter.
- **Hest 4:** Hop med squash, synligt mankekast i frame 5, blink og ørevip. Men vinket står næsten stille (række 7) og har det mindste udsving af de fire arter (H4).
- **Enhjørning 4:** Hoppet har squash, og manken følger med. Vinket er tydeligt. Hornglimtet er få pixels og ses ikke i normal størrelse (række 9, E5).

**9. Butikskort ved 64 px** (`sizes-<art>.png`)
- **Kanin 4, Kat 4 og Hest 4:**
  - Runde 1's blokerende fund er rettet. Genstanden alene fylder ca. 75–80 % af kortet, og de tre farvesæt er tydeligt forskellige.
  - Hatte på dyret er tydelige og søde.
  - Trøjekortene på dyret (kort 7–9, x ≈ 996–1444, y ≈ 1880–2010) er beskåret midt gennem øjnene, så halve øjne titter frem i kortets overkant.
- **Enhjørning 3:** Hue- og festhatkortene på enhjørningen (kort 1–6) er rodede, fordi horn, pompon og stjerne klumper sammen. Trøjekortene har samme beskæringsfejl som de andre arter.

**10. AAA-finish** (alle ark, især `closeup-<art>.png`)
- **Kanin 4:**
  - Kaninen har nu sit eget præg: øre med knæk, hårtot, fnug i brystet, lårbue, tålinjer og fnugget hale.
  - Det, der holder den nede: hullet ved lop-øret, den usynlige signatur og regnbuesmækken.
- **Kat 4:** Den mest gennemførte art (tabby-striber, mulepude, langhårskrave og guldglans). Holdes nede af maine coon-trøjen og regnbuekraven.
- **Hest 4:** Gode detaljer i mule, næsebor, man og hove. Holdes nede af fjordtoppens design og den sorte arabers stjerne.
- **Enhjørning 4:** Grundfigurerne er blandt de mest charmerende. Holdes nede af hatte over hornet og det usynlige glimt.

## 2. Gate-afgørelse

- **Kanin: bestået.** Alle kriterier er ≥ 4, og middel er 4,3, altså præcis kravet.
  - Der er ingen margin. Falder et af de tre 5-tal til 4, eller et kriterium til 3, dumper kaninen.
  - Ret derfor K1–K3 nedenfor før næste runde, så den ikke falder tilbage.
- **Kat: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Hest: bestået.** Alle kriterier er ≥ 4, og middel er 4,2. Hesten har flest 4-taller, og H1–H3 bør rettes.
- **Enhjørning: ikke bestået.** Silhuet, pasform og butikskort står alle til 3.
- **Blindtesten** (rubrikkens accept-punkt):
  - Alle 36 svar passer med de racer og stadier, jeg bagefter så på arts- og lineup-arkene. Jeg har ikke set nogen facitliste.
  - Kravet "alle racer og stadier rammes" er dermed opfyldt.
  - Otte svar var usikre: 4 kaniner (#16, #22, #33, #36) og 4 enhjørninger (#1, #4, #19, #24). Enhjørningernes usikkerhed var tæt på et møntkast. Kaninernes hældede klart mod kanin.

## 3. Enhjørning: fejl, der skal rettes (prioriteret)

**E1. Horn og hue (pasform 3, butikskort 3). Blokerende.**
- **Hvor:**
  - `fit-unicorn.png`, rækken "hverdag-head · through" (y ≈ 290–575), alle 9 celler. Værst er st. 1 · farve 2 · starhorn (x ≈ 886): sølvhornet på den grønne hue læses som en stribe i huen.
  - `closeup-unicorn.png`, stjernehorn med hue (2250–2345, 255–475).
  - `fitmatrix.png`, kolonnerne "hue · through" (x ≈ 368) og "hue + trøje" (x ≈ 1100) i de tre enhjørningsrækker (y ≈ 2855–3700).
  - `sizes-unicorn.png`, "på enhjørning", kort 1–3 (x ≈ 60–508, y ≈ 1880–2010).
- **Fejlen:** Hornet er tegnet oven på huen, og dets bund slutter på ribkanten. Der er intet hornhul, og pomponen gemmer sig bag hornet eller stjernen.
- **Ret sådan:**
  - Giv huen et hornhul med samme behandling som ørehullerne: hullets mørke kant (huens konturfarve, 3,2 enheder) ligger oven på hornets bund, og den nederste ca. 25 % af hornet skjules i hullet.
  - Hornet skal gå bag ribkanten, aldrig hen over den.
  - Flyt pomponen 14–18 enheder til venstre for hornet (set fra beskueren), eller udelad den på enhjørningen.
  - Stjernehornets stjerne skal stå frit med mindst 4 enheders luft til pomponen.

**E2. Horn og festhat (pasform 3, butikskort 3). Blokerende.**
- **Hvor:**
  - `fit-unicorn.png`, rækken "fest-head · under" (y ≈ 590–870), alle 9 celler. Værst er st. 1 · farve 2 · starhorn (x ≈ 886) og st. 3 · farve 2 · starhorn (x ≈ 2422).
  - `closeup-unicorn.png`, stjernehorn med festhat (1665–1730, 1410–1560).
  - `fitmatrix.png`, kolonnerne "festhat · under" (x ≈ 612) og "festhat + trøje" (x ≈ 1344).
  - `sizes-unicorn.png`, kort 4–6 (x ≈ 528–976).
- **Fejlen:** Hornet krydser foran keglen, stjernen ligger oven på pomponen, og konturerne krydser hinanden i en knude.
- **Ret sådan:** Vælg én løsning og brug den i alle stadier og racer:
  - **Løsning 1:** Vip hatten 15–20° og sæt den mellem venstre øre og hornet, så hornet står helt frit. Ingen kontur må krydse hornet.
  - **Løsning 2:** Lad hornet komme ud gennem keglens spids i stedet for pomponen. Pomponen fjernes, og spidsen får en åbning med kant.

**E3. Stjernehornets og babyhornets silhuet (silhuet 3). Blokerende.**
- **Hvor:**
  - `silhouettes.png`, stjernehorn: #1 (203, 388), #19 (203, 1143) og #24 (1700, 1143).
  - `silhouettes.png`, baby: #4 (1101, 388).
  - `species-unicorn.png`, stjernehorn-sektionen (y ≈ 2820–4100), alle farver.
- **Fejlen:**
  - I sort dominerer stjernen, og det tynde horn under den forsvinder.
  - Kroppen er identisk med hestens, så arten afhænger helt af hornet.
  - Babyhornet når kun ca. 60 % af ørehøjden.
- **Ret sådan:**
  - **(a) Stjernehorn:** Mindst 2/3 af hornets skaft skal kunne ses under stjernen, og hornet skal nå mindst op i højde med ørespidserne over pandelokken. Stjernen må højst være 1,2 gange hornets bundbredde (i dag ca. 2 gange). Alternativt kan stjernen flyttes til et mærke i panden eller på halekvasten, så stjernehornet får et almindeligt spiralhorn med stjerneformede gnister.
  - **(b) Baby:** Hornspidsen skal nå op til ørespidserne, med en smal bund og en skarp spids.
  - **(c) Et ekstra artstræk:** Giv enhjørningen et træk, som hesten ikke har, og som kan ses i sort. Fx en krøllet halekvast med 2–3 spirallokker, små pelsdusker over hovene og/eller en man med krøllede spidser.
- **Mål:** Ingen usikre enhjørninger i næste blindtest.

**E4. Trøjekort på enhjørning (butikskort 3, sammen med E1–E2).**
- **Hvor:** `sizes-unicorn.png`, "på enhjørning", kort 7–9 (x ≈ 996–1444, y ≈ 1880–2010).
- **Fejlen:** Beskæringen begynder midt i øjnene, så halve øjne titter frem i kortets overkant.
- **Ret sådan:** Beskær kropsslottet fra mund- og hagelinjen til hoften, uden rester af øjne. Alternativt kan hele hovedet tages med, hvor figuren skaleres ned til ca. 85 %. Samme regel skal gælde for alle arter.

**E5. Signaturen: hornglimtet (animation).**
- **Hvor:** `filmstrip-unicorn.png`, række 9 "signatur" (y ≈ 2741–3000). Hornet ligger lokalt ved ca. (95–135, 55–90) i hver frame, fx (371, 2813) i frame 1.
- **Fejlen:** Glimtet er få pixels og ses ikke ved 100 %.
- **Ret sådan:**
  - Tegn et firtakket glimt på 14–18 enheder ved hornspidsen. Det skal gå fra 0 til 1 til 0 i opacity over 3 frames.
  - Lad det blive fulgt af en hvid højlysstribe langs hornet, der går fra 0,4 til 1 til 0,4.
  - Kun opacity bruges, som SPEC §6.1 kræver.
  - Glimtet skal kunne ses i filmstrimlen ved 100 %.

**E6. Paletten: de næsten hvide farver og mint på mint (palet 4, ikke blokerende).**
- **Hvor:**
  - `species-unicorn.png`, kolonnerne c1 hvid (x ≈ 369), regnbue (x ≈ 2075) og stjernehvid (x ≈ 2319).
  - `fit-unicorn.png`, "tøj i alle humør" række 3, starhorn · 3 · stor (y ≈ 2460–2745), alle 7 celler.
- **Ret sådan:**
  - Giv de tre næsten hvide farver hver sin kropstone: hvid som varm elfenben, regnbue som lys fersken eller lilla, og stjernehvid som kold sølvhvid med blå skygge og guldhove.
  - Trøjens kontur og ribkant skal altid være tydeligt mørkere end pelsens kontur, så trøjen skiller sig ud på pels i samme farve.

**E7. Tankeboblen på manken (ansigt, mindre fejl).**
- **Hvor:** `moods-unicorn.png`, række 3 (starhorn), tænker (1635–1680, 1235–1275).
- **Ret sådan:** Forankr boblen uden for det samlede område for hoved, ører og man, med 8 enheders luft.

## 3b. Forbehold for de arter, der har bestået (rettes før næste runde)

### Kanin
1. **K1 – hul ved lop-ørets bund (kontur).**
   - **Hvor:**
     - `closeup-rabbit.png`, karamel-lop: (1245–1270, 662–690) og (1530–1555, 662–690).
     - `closeup-rabbit.png`, regnbue-lop: (897–912, 1568–1584).
     - `sizes-rabbit.png`, 256 px: (816–823, 1105–1110).
   - **Ret sådan:** Lad ørets fyld fortsætte 4–6 enheder ind under hovedets kontur, så der ikke er nogen sprække. Tjek ved at rendere alle figurer på magenta baggrund og lede efter magenta inden for yderkonturen.
2. **K2 – næsevippet ses ikke (animation).**
   - **Hvor:** `filmstrip-rabbit.png`, række 9. Næsen ligger lokalt ved ca. (95–145, 125–160), fx (376, 2883) i frame 1.
   - **Ret sådan:** Næsen skal løftes 3–4 enheder, og knurhårenes rødder skal følge med. Brug 3 hurtige frames, så en pause, og gentag to gange.
3. **K3 – tankeboble og Zzz på lop-øret (ansigt).**
   - **Hvor:**
     - `moods-rabbit.png`, lop-rækken: tænker (1633–1665, 897–928) og sover (2374–2412, 886–928).
     - `fit-rabbit.png`, "tøj i alle humør" række 1 (lop · 1 · baby), tænker (x ≈ 1141).
   - **Ret sådan:** Forankr boblen i det samlede område for hoved og ører plus 8 enheders luft.
4. **K4 – regnbuesmækken (palet og kontur).**
   - **Hvor:** `closeup-rabbit.png` (950–1120, 1760–1860).
   - **Ret sådan:** Erstat gradienten med 4 flade pastelstriber. Gem den muslingeformede kants ender under kropskonturen, så de to spidser ved (982–997, 1832–1846) og (1070–1086, 1830–1842) forsvinder.
5. **K5 – trøjekortene på kanin.**
   - **Hvor:** `sizes-rabbit.png`, kort 7–9.
   - **Ret sådan:** Brug samme beskæringsregel som i E4.
6. **K6 – silhuetten for løvehoved og baby-lop.**
   - **Hvor:** `silhouettes.png` #22 (1101, 1143), #33 (1700, 1518), #36 (2599, 1518) og #16 (2000, 760).
   - **Ret sådan:** Løvehovedets ører skal være mindst 1,3 gange længere, så de rejser sig klart over ringen. Ringen skal være kindtotter i stedet for en jævn uldsky. Baby-lop skal have længere og smallere ører, der når til skulderen.
7. **K7 – guld mangler glansbånd.**
   - **Hvor:** `closeup-rabbit.png`, guldkaninen (ca. (390, 1800)).
   - **Ret sådan:** Giv den samme smalle glansbånd som guldkatten.
8. **K8 – baby-løvehovedets trøje.**
   - **Hvor:** `fit-rabbit.png`, "hverdag-body", st. 1 · farve 2 (x ≈ 886).
   - **Ret sådan:** Læg trøjens krave oven på manken, eller gør manken 6–8 enheder kortere ved brystet.

### Kat
1. **C1 – maine coon-skuldre over halsudskæringen.**
   - **Hvor:** `closeup-cat.png` (2170–2205, 810–840) og (2410–2445, 808–835).
   - **Ret sådan:** Halsudskæringen skal dække skuldrene, og armenes overkant skal tegnes under trøjen.
2. **C2 – ærmer, der ligner lommer.**
   - **Hvor:** `closeup-cat.png` (2160–2430, 1005–1080) og `fit-cat.png`, "hverdag-body".
   - **Ret sådan:** Ærmet skal følge armen helt ned til poten med manchetten lige over poten, og ribkanten skal ligge bag poterne.
3. **C3 – regnbuekraven.**
   - **Hvor:** `closeup-cat.png` (1000–1090, 1820–1860).
   - **Ret sådan:** Brug flade striber, og læg kravens kant bag armene.
4. **C4 – c3 og c6 ligner hinanden.**
   - **Hvor:** `species-cat.png`, c3 (x ≈ 856) og c6 (x ≈ 1588).
   - **Ret sådan:** Gør c6 tydeligt blå-grå, eller giv c3 en varmere grå med kraftigere striber.
5. **C5 – den sorte kat.**
   - **Hvor:** `species-cat.png`, c2 (x ≈ 611).
   - **Ret sådan:** Brug en lysere lilla-grå kontur eller et kantlys, så ben, krop og hale skilles ad.
6. **C6 – trøjekortene på kat.**
   - **Hvor:** `sizes-cat.png`, kort 7–9.
   - **Ret sådan:** Brug samme beskæringsregel som i E4.

### Hest
1. **H1 – fjordtoppen.**
   - **Hvor:** `species-horse.png`, fjord-sektionen (y ≈ 1500–2770), alle farver. Også `closeup-horse.png` (1340–1460, 520–655) og `lineup.png`, øverste række "horse · fjord".
   - **Ret sådan:** Tegn toppen om til en kort, opretstående, børstet manestribe med 5–7 korte totter og en mørk midterstribe, sådan som en fjordhest er klippet. Fjern den runde ring med den lodrette spalte.
2. **H2 – den sorte arabers stjerne.**
   - **Hvor:**
     - `species-horse.png`, araber c3 (x ≈ 856, y ≈ 2790–4060).
     - `sizes-horse.png`, 256 px (ca. (1390, 1020)).
     - `moods-horse.png`, række 3: tænker (1564–1576, 1234–1250) og sover (2306–2318, 1238–1254).
   - **Ret sådan:** Tegn en hel lille stjerne eller rombe, der kan ses helt under pandelokken, eller fjern den.
3. **H3 – regnbuehesten ligner en enhjørning.**
   - **Hvor:** `species-horse.png`, regnbuekolonnen (x ≈ 2075), og `sizes-horse.png`, 48 px kort 8 (1156–1284, 262–395).
   - **Ret sådan:** Brug en varm cremefarvet grundfarve med brun kontur i stedet for lilla-hvid med lilla kontur. Læg kun regnbuen i man og hale som flade striber, og hold fjordtoppen lav.
4. **H4 – vinket er for stift.**
   - **Hvor:** `filmstrip-horse.png`, række 7 (y ≈ 2121–2380). Hoven ligger lokalt ved ca. (130–175, 90–150).
   - **Ret sådan:** Drej underbenet ±20° om albuen med 2 sving over 8 frames, og vip hovedet 4–6°.
5. **H5 – tankeboblen på manken.**
   - **Hvor:** `moods-horse.png`, række 3, tænker (1634–1644, 1258–1270).
   - **Ret sådan:** Brug samme anker som i K3.
6. **H6 – ærmer, der ligner lommer.**
   - **Hvor:** `fit-horse.png`, "hverdag-body".
   - **Ret sådan:** Gør ærmet smallere nedad, giv det en buet manchet, der følger benet, og lad striberne fortsætte fra kroppen.
7. **H7 – trøjekortene på hest.**
   - **Hvor:** `sizes-horse.png`, kort 7–9.
   - **Ret sådan:** Brug samme beskæringsregel som i E4.

## 4. Runde 1-fund (kaninen): status

| # | Fund fra runde 1 | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | Butikskort (blokerende) | **Rettet** | Genstanden alene fylder ca. 75–80 %, og kortene "på kanin" er beskåret efter slot. Ny fejl: trøjekortene skærer gennem øjnene (K5). |
| 2 | Trøjens pasform | **Rettet** | Der er stribede ærmer med manchet. Ribkanten ligger inden for konturen med runde ender og sidder ved hoften, også på babyen. Intet fyld uden for konturen. |
| 3 | Huens ørehuller | **Rettet** | Ørerne har en blød bund i hullet, og hullets kant ligger ovenpå. Højlyset sidder ved pomponen. |
| 4 | Sømme ved ører og pandelok | **Rettet** | Ingen sømme på opret og løvehoved. Ny og anden fejl: hul ved lop-ørets bund (K1). |
| 5 | Hollænderens konturfarve | **Rettet** | Én plommegrå kontur på ører, hoved og krop. |
| 6 | Festhattens kegle titter frem | **Rettet** | Ikke set i nogen celle. |
| 7 | Stadie 3 ligner stadie 2 | **Rettet** | Ca. 15 % højere, med længere ører, større fødder og hale og halsflæse på løvehovedet. |
| 8 | Armene ligner pølser | **Rettet** | Armene går ind under hovedet, og poterne er runde med tålinjer. |
| 9 | Silhuet | **Rettet** | Halen er adskilt med negativt rum, fødderne er større, og lop-ørerne er længere med synlig ørebase. Nyt fra blindtesten: løvehoved ligner lam, og baby-lop ligner hvalp (K6). |
| 10 | 48 px (LOD) | **Rettet** | Tyk, mørk kontur uden knurhår, og den hvide baby står tydeligt. |
| 11 | Palet | **Delvist rettet** | Regnbuens særpræg, rosas næse og kinder og de flade inderører er rettet. Guld mangler stadig glansbåndet (K7), og den nye regnbuesmæk har gradient (K4). |
| 12 | "Ups" skyldfremkaldende | **Rettet** | Nu legende, med blink, tunge, sveddråbe og pote bag nakken. |
| 13 | Tænderne | **Rettet** | Ét sæt fortænder, der hænger fra overlæben. |
| 14 | Vinker, jubel og bobler | **Delvist rettet** | Vinker og jubel er rettet. Boblerne sidder frit på opret og løvehoved, men oven på lop-øret (K3). |
| 15 | Animation | **Rettet** | Hvert humør har sin egen kropspose, og "animeret"-rækken er ikke længere forskudt. Nyt: signaturen ses ikke (K2). |
| 16 | AAA-finish | **Rettet** | Øre med knæk, lårbue, fnug i brystet og ingen plastikglans. Trøjens striber krummer let. |

## 5. De 3 vigtigste forbedringer på tværs af arterne

1. **Gør signaturerne synlige.**
   - Alle fire er for svage: kaninens næse flytter sig 1–2 px, enhjørningens glimt er få pixels, og både hestens mankekast og kattens halekrølle er beskedne.
   - Fælles regel: signaturen skal kunne ses i filmstrimlen ved 100 % og i spillet ved 48 px. Det betyder mindst 3 enheders bevægelse (eller et glimt på 14–18 enheder for enhjørningen), 3 frames ud, ét overshoot og så en pause.
   - Det er artens særpræg, og lige nu går det tabt.
2. **Fælles regler for ankre og beskæring.**
   - **Bobler og Zzz:** De skal forankres uden for det samlede område for hoved, ører og man eller hår, med 8 enheders luft. Fejlen findes i dag på lop-kaninen, den sorte araber og stjernehornet.
   - **Trøjekort på dyret:** Kort med kropstøj skal beskæres fra mund og hage til hoften og aldrig gennem øjnene. Det gælder alle fire arter (kort 7–9).
   - Begge dele er én regel i layoutet, som retter fejl i alle arter på én gang.
3. **Hold artsgrænserne og regnbuen rene.**
   - Hest og enhjørning deler skabelon, så hornet skal kunne bære arten i sort (E3), og hattene skal respektere hornet (E1, E2). Regnbuehesten må ikke låne enhjørningens palet (H3).
   - Regnbue på kroppen skal være flade striber, ikke gradient (kaninens smæk og kattens krave).
   - Guld skal behandles ens på alle arter, med kattens glansbånd som forbillede.
   - Tilføj samtidig et magenta-tjek for huller i fyldet (K1).

## Bilag: rubrikkens JSON-format

```json
{
  "species": "rabbit",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.3,
  "pass": true,
  "issues": [
    { "criterion": "outline", "sheet": "closeup-rabbit.png", "at": [1257, 676], "note": "Lop: hul mellem ørets bund og hovedet, baggrunden ses igennem. Også ved [1542, 676], [905, 1576] og sizes-rabbit.png [820, 1107]." },
    { "criterion": "animation", "sheet": "filmstrip-rabbit.png", "at": [376, 2883], "note": "Signaturen: næsen flytter sig kun 1-2 px og ses ikke." },
    { "criterion": "faceAppeal", "sheet": "moods-rabbit.png", "at": [1649, 912], "note": "Lop, tænker: tankeboblen ligger på det hængende øre. Zzz ved [2393, 907]." },
    { "criterion": "palette", "sheet": "closeup-rabbit.png", "at": [1035, 1810], "note": "Regnbuesmækken har gradient på kroppen, og konturen stikker ud som to spidser ved [990, 1839] og [1078, 1836]." },
    { "criterion": "shopCard64", "sheet": "sizes-rabbit.png", "at": [1064, 1945], "note": "Trøjekortene på kanin (kort 7-9) er beskåret midt gennem øjnene." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [1101, 1143], "note": "Løvehoved (#22, #33, #36) læses som lam, baby-lop #16 ved [2000, 760] som hvalp." },
    { "criterion": "fit", "sheet": "fit-rabbit.png", "at": [886, 1060], "note": "Baby-løvehoved: manken dækker næsten hele trøjen." }
  ]
}
```

```json
{
  "species": "cat",
  "scores": {
    "recognizability48": 5, "silhouette": 5, "proportions": 5, "outline": 4, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "fit", "sheet": "closeup-cat.png", "at": [2187, 825], "note": "Maine coon: skulderbuerne stikker op over trøjens halsudskæring, også ved [2427, 822]." },
    { "criterion": "fit", "sheet": "closeup-cat.png", "at": [2295, 1042], "note": "Ærmerne er korte stumper oven på ribkanten og læses som lommer." },
    { "criterion": "palette", "sheet": "closeup-cat.png", "at": [1045, 1840], "note": "Regnbuekraven har gradient, og kanten krydser armenes kontur." },
    { "criterion": "palette", "sheet": "species-cat.png", "at": [856, 742], "note": "c3 grå-stribet og c6 blå-grå [1588, 742] ligger for tæt på hinanden." },
    { "criterion": "outline", "sheet": "species-cat.png", "at": [611, 742], "note": "Sort kat: konturen er næsten lige så mørk som pelsen, så ben, krop og hale flyder sammen." },
    { "criterion": "shopCard64", "sheet": "sizes-cat.png", "at": [1064, 1945], "note": "Trøjekortene på kat (kort 7-9) er beskåret gennem øjnene." }
  ]
}
```

```json
{
  "species": "horse",
  "scores": {
    "recognizability48": 4, "silhouette": 5, "proportions": 5, "outline": 4, "palette": 4,
    "faceAppeal": 4, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.2,
  "pass": true,
  "issues": [
    { "criterion": "faceAppeal", "sheet": "closeup-horse.png", "at": [1400, 590], "note": "Fjordtoppen: den runde ring med lodret spalte over øjnene læses som et tredje øje. Gælder alle fjord-farver." },
    { "criterion": "palette", "sheet": "sizes-horse.png", "at": [1390, 1020], "note": "Sort araber: stjernen er en skarp hvid trekant halvt under pandelokken og ligner et hul i fyldet." },
    { "criterion": "recognizability48", "sheet": "sizes-horse.png", "at": [1220, 328], "note": "Regnbuehesten (lilla-hvid med regnbuetop) læses som en enhjørning ved 48 px." },
    { "criterion": "animation", "sheet": "filmstrip-horse.png", "at": [406, 2241], "note": "Vinker: hoven står næsten stille i alle 8 frames." },
    { "criterion": "faceAppeal", "sheet": "moods-horse.png", "at": [1639, 1264], "note": "Tankeboblen ligger på side-manken (sort araber, tænker)." },
    { "criterion": "fit", "sheet": "fit-horse.png", "at": [1141, 1100], "note": "Ærmerne på forbenene ligner to lommer." },
    { "criterion": "shopCard64", "sheet": "sizes-horse.png", "at": [1064, 1945], "note": "Trøjekortene på hest (kort 7-9) er beskåret gennem øjnene." }
  ]
}
```

```json
{
  "species": "unicorn",
  "scores": {
    "recognizability48": 5, "silhouette": 3, "proportions": 5, "outline": 5, "palette": 4,
    "faceAppeal": 5, "fit": 3, "animation": 4, "shopCard64": 3, "aaaFinish": 4
  },
  "mean": 4.1,
  "pass": false,
  "issues": [
    { "criterion": "fit", "sheet": "closeup-unicorn.png", "at": [2297, 365], "note": "Hue: hornet ligger oven på huen og slutter på ribkanten. Intet hornhul, og pomponen er skjult. Gælder alle 9 celler i fit-unicorn.png 'hverdag-head · through'." },
    { "criterion": "fit", "sheet": "closeup-unicorn.png", "at": [1697, 1485], "note": "Festhat: hornet krydser foran keglen, og stjernen ligger på pomponen. Gælder alle 9 celler i 'fest-head · under'." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [203, 388], "note": "#1, #19 [203, 1143] og #24 [1700, 1143]: stjernen erstatter hornet. #4 [1101, 388]: babyhornet er lavere end ørerne." },
    { "criterion": "shopCard64", "sheet": "sizes-unicorn.png", "at": [596, 1945], "note": "Hue- og festhatkort (1-6): horn, pompon og stjerne klumper sammen. Trøjekortene (7-9) er beskåret gennem øjnene." },
    { "criterion": "animation", "sheet": "filmstrip-unicorn.png", "at": [371, 2813], "note": "Hornglimtet er få pixels og ses ikke i normal størrelse." },
    { "criterion": "palette", "sheet": "fit-unicorn.png", "at": [374, 2600], "note": "Mint trøje på mint enhjørning forsvinder i kroppen." },
    { "criterion": "faceAppeal", "sheet": "moods-unicorn.png", "at": [1657, 1255], "note": "Tankeboblen ligger på regnbuemanken (stjernehorn, tænker)." }
  ]
}
```
