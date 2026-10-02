# Kunst-review, runde 4 (G1 · r4): kanin, kat, hvalp, pindsvin, hest og enhjørning

- **Reviewer:** frisk og uafhængig agent. Jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i runde 1–3. Jeg har ikke læst kildekode og heller ikke `lint.json`.
- **Grundlag:**
  - `docs/art-rubric.md` og de tidligere reviews `docs/reviews/art-g1-r2.md` og `docs/reviews/art-g1-r3.md`.
  - Alle 41 PNG-ark i `/home/user/wt/w4/talvennerne2/artifacts/sheets/`, genereret 2. okt. 2026 kl. 10:21–10:25 (UTC). Alle ark er set i helhed og derefter i udsnit med 1,5–10× zoom.
  - Huller og sømme er fundet maskinelt: lukkede magenta-områder i `holes.png` og lukkede områder i kortets baggrundsfarve inden for figurerne i arts-, nærbilleds- og størrelsesarkene. Tykkelsen er målt i viewBox-enheder. Det er 0,64 px pr. enhed i `holes.png` og 1 px pr. enhed i arts-arkene.
  - Signaturer og vinkebevægelser er målt med pixel-diff mellem frames.
  - **Bemærk:** Worktree'en `w4` med arkene blev fjernet ca. kl. 11:56, mens jeg skrev reviewet. Jeg havde set og målt alle ark inden da, og alle koordinater gælder genereringen kl. 10:21–10:25.
- **Blindtest:**
  - `docs/reviews/art-g1-r4-blind.md` blev skrevet og committet (13bccae), før noget andet blev åbnet.
  - Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket (samme SHA-256).
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1). Koordinatsystemet for hvert ark står i bilag A.
- **Iteration:** 4 af højst 4. Det, der ikke består nu, eskaleres til integratoren, som rubrikkens accept-afsnit foreskriver.

## Resultat

| Art | Middel | Laveste score | Krav | Afgørelse |
|---|---|---|---|---|
| Kanin | **4,5** | 4 (fem kriterier) | alle ≥ 4 og middel ≥ 4,3 | **Bestået.** K1 er rettet. |
| Kat | **4,5** | 4 (fem kriterier) | alle ≥ 4 | **Bestået** |
| Hvalp | **4,4** | 4 (seks kriterier) | alle ≥ 4 | **Bestået** |
| Pindsvin | **4,4** | 4 (seks kriterier) | alle ≥ 4 | **Bestået** |
| Hest | **4,3** | 4 (syv kriterier) | alle ≥ 4 | **Bestået**, uden margin |
| Enhjørning | **4,2** | **3** (pasform og butikskort) | alle ≥ 4 | **Ikke bestået** |

- **Tøjet:**
  - Hverdag og Milepæle har pasform **3**, fordi én genstand i hvert sæt sidder forkert på alle seks arter: solbrillerne og hjertebrillerne.
  - Opdager, Pirat og Fest-huen har pasform 4.
  - Alle fem sæt har butikskort 4.
- **Engdalen-scenen:** **3/5.**

## 1. Scores

| # | Kriterium | Kanin | Kat | Hvalp | Pindsvin | Hest | Enhjørning |
|---|---|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 5 | 5 | 4 | 5 |
| 2 | Silhuet | 5 | 4 | 4 | 5 | 4 | 4 |
| 3 | Proportioner | 5 | 5 | 5 | 4 | 5 | 5 |
| 4 | Kontur | 4 | 4 | 4 | 5 | 4 | 4 |
| 5 | Palet | 5 | 5 | 5 | 4 | 4 | 5 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 | 5 | 5 |
| 7 | Pasform | 4 | 4 | 4 | 4 | 4 | **3** |
| 8 | Animation | 4 | 5 | 4 | 4 | 5 | 4 |
| 9 | Butikskort ved 64 px | 4 | 4 | 4 | 4 | 4 | **3** |
| 10 | AAA-finish | 4 | 4 | 4 | 4 | 4 | 4 |
| | **Middel** | **4,5** | **4,5** | **4,4** | **4,4** | **4,3** | **4,2** |

Skalaen er brugt strengt:
- 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
- Et 5-tal er kun givet, når hele rubrikkens 5-beskrivelse er opfyldt på alle racer, farver og stadier, jeg har set.
- Siden runde 3 er der kommet to nye arter og fire nye tøjsæt (Opdager, Pirat, Milepæle og den fulde Hverdag). Kriterierne pasform og butikskort dækker derfor langt flere genstande end i runde 3. Hvor jeg afviger fra runde 3, står grunden i begrundelsen.

### Begrundelser

**1. Genkendelighed ved 48 px** (`sizes-<art>.png`, række "48 px", y ≈ 268–402)
- **Kanin, kat, hvalp, pindsvin og enhjørning 5:**
  - Alle kort læses straks som den rigtige art.
  - LOD-konturen er tyk og mørk, og glad og sover kan skelnes.
  - Vædderkaninen og hvalpen ligner hinanden i silhuet, men ved 48 px skilles de af hvalpens snude med den mørke næse og af kaninens runde ansigt med den lille lyserøde næse.
- **Hest 4 (ned fra 5):**
  - Regnbuehesten (kort 8, `sizes-horse.png` (1156–1284, 268–402)) er nu mintgrøn med blågrøn kontur. Det er samme kropsfarve som enhjørningens c4 mint.
  - Ved et hurtigt blik læses den som en enhjørning uden horn, og fjordtoppen kan ligne en hornstump eller en krone.
  - Det er en tilbagevenden af H3 fra runde 2. I runde 3 var regnbuehesten creme med brun kontur.

**2. Silhuet** (`silhouettes.png` og blindtesten)
- **Blindtesten:**
  - Alle 42 svar stemmer.
  - Bagefter matchede jeg hver silhuet mod figurerne i arts-arkene. Hver silhuet passer med netop én race og ét stadie (overlap 0,95–0,99), og alle 42 kombinationer forekommer én gang.
  - Otte svar var usikre: #9, #11 og #32 (langhår-kat, ligner ræv), #15 og #41 (de mindste heste, ligner kat) og #36, #38 og #40 (stjernehorn, ligner pynt).
- **Kanin 5:**
  - 9/9 sikre, og de tre racer kan skelnes i sort.
  - Forbehold: Vædderens hovedsilhuet (#8 (2304, 393), #16 (2004, 765), #18 (2604, 765)) ligner en spaniel. Det er pomponhalen og topdusken, der afgør det.
- **Kat 4:**
  - 6/9 sikre.
  - Langhårskatten (#9 (2604, 393), #32 (1404, 1523), #11 (504, 765)) har kindpels og busket hale, så den kan læses som en ræv. På #9 ses halen ikke.
  - Fundet er uændret fra runde 3.
- **Hvalp 4:**
  - 3/3 sikre (#14 (1404, 765), #6 (1704, 393), #21 (804, 1144)).
  - Den kuppelformede hovedsilhuet med hængeører ligger tæt på vædderkaninens. Kun den tynde, opadvendte hale og snudebuen skiller dem i sort, og halen forsvinder bag kappe og vinger.
- **Pindsvin 5:**
  - 3/3 sikre. Den piggede oval er entydig.
  - At stadie 2 og 3 næsten er ens i sort, er scoret under proportioner.
- **Hest 4:**
  - 7/9 sikre.
  - De to mindste (#15 araber (1704, 765) og #41 shetland (1404, 1895)) har svag mule og næsten ingen hale, så de læses som "en kat med hår".
  - Fundet om araber-babyens hale fra runde 3 (dengang #35) er ikke rettet.
- **Enhjørning 4:**
  - 6/9 sikre.
  - Stjernehornet er usikkert på alle tre stadier (#36 (2604, 1523), #38 (504, 1895), #40 (1104, 1895)). Stjernen på spidsen gør hornet til noget, der også kan være pynt, en fest-hue eller en tryllestav.
  - I runde 3 var det kun stadie 1, der var usikkert.

**3. Proportioner** (`species-<art>.png`, `lineup.png`)
- **Kanin, kat, hvalp, hest og enhjørning 5:**
  - Tydelig chibi og en klar udvikling fra baby til ung til stor på samme jordlinje.
  - Babyen har størst hoved og øjne.
- **Pindsvin 4:**
  - Stadie 3 er næsten et opskaleret stadie 2.
  - Efter normalisering overlapper silhuetterne for stadie 2 og 3 med 95–96 %. For de andre arter er overlappet mellem nabostadier 84–89 %.
  - Det ses også i `species-hedgehog.png`, stadie 2 (256–492, 608–884) mod stadie 3 (256–492, 896–1172). "Stor" læses ikke som voksen.

**4. Kontur** (`closeup-<art>.png`, `species-<art>.png`, `holes.png`)
- **Kanin 4 (op fra 3):**
  - **K1 er rettet.** Der er ingen baggrund i vædderørets rod nogen steder:
    - alle 32 vædderkort i `species-rabbit.png` (y ≈ 1612–2752),
    - nærbillederne på runde 3's koordinater (1225–1280, 651–715), (1519–1575, 651–717), (872–891, 1580–1627) og (1135–1161, 1559–1603),
    - 256 px (788–1030, 1100–1153),
    - silhuetterne #8, #16 og #18.
    - Det eneste fund i silhuetterne er en enkelt kantudglattet pixel, hvor ørespidsen møder armen på #18 (2556, 820) og (2651, 820).
  - **K4 er rettet.** Regnbuesmækken er klippet til brystet inden for armene, og der er ingen kroge (`closeup-rabbit.png` (840–1240, 1650–1900)).
  - **Nyt (R1):** Opret · stadie 2 · vinker har en lukket lomme på ca. 11 enheder mellem den løftede arm og kinden. Den findes i alle farver. Det bryder kaninreglen om nul lukkede pixels inden for yderkonturen. Den ses her:
    - `holes.png` #34 (822–836, 461–475) og #40 (1638–1652, 461–475),
    - `moods-rabbit.png`, opret-rækken, vinker (2699–2736, 492–533),
    - `filmstrip-rabbit.png`, række 7, i 7 af 8 frames, fx (391–410, 2272–2291).
  - **Derfor 4 og ikke 3:** Konturen er hel, og lommen er et rent afgrænset negativt rum i én positur på ét stadie. Det er ikke en søm som K1. Den skal dog rettes før udgivelse (afsnit 5).
  - Små trin i konturen ved topduskens fod (`closeup-rabbit.png` (1340–1460, 570–660)).
- **Kat 4:**
  - Maine coon-babyen har en lukket sprække på under 4 enheder mellem halespidsen og skulderen i 6 af 8 farver (`holes.png` #409–#415, fx (2316, 2585)). Det er et regelbrud.
  - Huskat-babyens hoftekile er præcis 4 enheder i alle farver (`species-cat.png` (397–401, 529–539)), altså på grænsen.
  - C1 er rettet, og C3 er stort set rettet.
- **Hvalp 4:**
  - Der er en lukket sprække på under 4 enheder mellem den løftede arm og øret i stadie 3 · vinker · c1 (`holes.png` #522 (2465–2467, 3220–3225)).
  - Lommerne mellem arm, øre og krop i "tænker" og "sover" (#519, #521, #525 og #527, 20–25 enheder) er ikke fyldt med pels, sådan som rubrikken kræver.
- **Pindsvin 5:**
  - Der er nul lukkede lommer i alle 60 fliser (`holes.png` #529–#588).
  - Én ensartet kontur, og ørerne sidder sømløst i piggene.
- **Hest 4:**
  - Fjordtoppen er stadig en påsat kasse med vandret bundkontur og trin, hvor den møder hovedet (`closeup-horse.png` (1300–1500, 470–640)). Det er uændret fra runde 3.
  - Lommerne mellem man og hals (`holes.png` #609–#617 og #729–#748, 4–7 enheder) og mellem løftet ben og hoved i "vinker" (#622, #628, #682 og #688) er over grænsen, men ikke fyldt.
- **Enhjørning 4 (ned fra 5):** Der er sprækker på under 4 enheder i race 2:
  - mellem manens spids og hoften (`holes.png` #835–#838 og #846, fx (3100–3102, 5020–5024)),
  - mellem det løftede forben og kinden i "vinker" og "tænker" (#871 (414–420, 5300–5321), #888 (2689–2691, 5290–5297), #889 og #891 (3145, 5281–5284)).

**5. Palet** (`species-<art>.png`)
- **Kanin og kat 5:** Uændret fra runde 3. Otte tydeligt forskellige farver, og guld og regnbue føles særlige.
- **Hvalp 5:**
  - Otte tydeligt forskellige farver: gylden, sort-hvid, chokolade, plettet, creme, rødbrun, guld og regnbue.
  - Guld har ravkontur og glans, og regnbuen er flade striber i ører, krave og hale.
- **Pindsvin 4:**
  - c1 brun, c4 rustrød og c5 rosabrun ligger tæt ved lille størrelse (`species-hedgehog.png`, stadie 1: (256–492), (988–1224) og (1232–1468), y ≈ 320–596).
  - Regnbuen med pastelpigge og sløjfe er fin.
- **Hest 4:**
  - Regnbuen er nu mint med blågrøn kontur (c8, `species-horse.png` x0 = 1964), som er samme kropsfarve som enhjørningens c4 (`species-unicorn.png` x0 = 988). Regnbuen bæres kun af toppen eller panden og halen.
  - Runde 3's problem med isabel er væk, men konflikten med enhjørningen er ny (H3).
- **Enhjørning 5 (op fra 4):**
  - Regnbuen har nu en ferskenfarvet krop og ligner ikke længere c3 lavendel (runde 3-fund rettet).
  - Alle ni farver er forskellige, og stjernehvid er særlig med guldhove og gnister.

**6. Ansigtets appel** (`closeup-<art>.png`, `moods-<art>.png`)
- **Alle seks 5:**
  - Store, blanke øjne med to højlys, og kinder og næse sidder godt.
  - Alle 7 humør læses straks, også hos hvalp og pindsvin, og bobler og Zzz sidder frit.
  - At hjertebrillerne dæmper øjnene, er scoret under pasform (T2).

**7. Pasform** (`fit-<art>.png`, `fitmatrix.png`) — se også afsnit 3
- **Fællesfejl, der rammer alle arter:**
  - T1: Hverdag-solbrillerne sidder på munden.
  - T2: Hjertebrillernes tonede glas ligger over øjnene.
  - T3: Slikkepinden vender på hovedet i "tænker".
  - T10: Hverdag-ærmerne krydser hinanden i "jubel". Det gælder ikke kaninen.
  - Derfor kan ingen art få 5.
- **Kanin 4 (ned fra 5):**
  - Grundpasformen er stadig den bedste: ørerne går op gennem huerne, vædderørerne hænger under hatten, og ærmerne følger armene.
  - Ud over fællesfejlene er den løftede pote tom i "vinker" (T4).
- **Kat 4:**
  - C2-kasseærmerne er ikke rettet og findes nu på fire trøjer: trøje, opdagervest, piratrøje og glimmerbluse.
  - Derudover T1–T4 og T10.
- **Hvalp 4:**
  - Samme kasseærmer på fire trøjer.
  - Derudover T1–T4 og T10. Den sort-hvide hvalps øjne forsvinder næsten bag hjertebrillerne.
- **Pindsvin 4:**
  - Ærmerne følger armene, og hattene sidder godt.
  - Kun fællesfejlene T1–T3 og T10.
- **Hest 4:**
  - H6-kasseærmerne er ikke rettet og findes på fire trøjer.
  - Fjordtoppen titter frem bag festhatten på stadie 3 (T9).
  - Derudover T1–T3 og T10.
- **Enhjørning 3 (ned fra 4):**
  - Hornet støder sammen med tre af syv hovedgenstande:
    - festhatten (T6, uændret siden runde 3),
    - pirathatten (T7),
    - regnbuehuen (T8).
  - Derudover kasseærmer på fire trøjer, T1–T3 og T10.
  - Rubrikkens 3-beskrivelse ("ørerne ser forkert ud i forhold til hatten") passer direkte på festhatten.

**8. Animation** (`filmstrip-<art>.png`)
- **Kanin 4:**
  - Hop, jubel og humør er gode.
  - K2 er uændret:
    - Næsen flytter sig ca. 3,5 px i normal størrelse (`filmstrip-rabbit.png` (368, 2884–2888)) og 8–9 px i nærbilledet (230, 3302–3315).
    - Der er ingen squash af næsen og intet nik.
    - Ved 48 px er det under 1 px, og signaturen ses ikke i spillet.
- **Kat 5:** Halekrøllen ses tydeligt med krøl, overshoot og pause, og vinket er kraftigt.
- **Hvalp 4:**
  - Haleloggen ses tydeligt.
  - Vinket er det mindste af alle arter. Poten forlader næsten ikke kinden (`filmstrip-puppy.png`, række 7, y ≈ 2124–2412).
  - Rækken med blink og ørevip har den mindste bevægelse af alle.
- **Pindsvin 4:**
  - Signaturen ses tydeligt: pindsvinet trækker sig sammen og puster piggene op.
  - Vinket er beskedent (række 7).
- **Hest 5:** Mankekastet og vinket er de tydeligste af alle arter.
- **Enhjørning 4:**
  - Glimtet er nu en hvid, firtakket stjerne ved hornspidsen i frame 2–4, og den ses ved 100 % (nærbilledet, fx (1305–1335, 3131–3170) i frame 4). Hornet har højlys i frame 5–6.
  - Men stjernen er hul med lys lilla kontur, der er kun én stjerne, og ved 48 px er den ca. 3 px.

**9. Butikskort ved 64 px** (`sizes-<art>.png`)
- **Genstanden alene:**
  - Den fylder ca. 87 % af kortets bredde på alle arter, og de tre farvesæt er tydeligt forskellige.
  - Kun bandanaen er svær at læse alene (B4).
- **Kanin 4 (ned fra 5):** Der er mange nye kort, og fem er svage på dyret:
  - rygsækken (kun stropper, B1),
  - luppen (næsten usynlig, B2),
  - kappen (kun kanterne, B3),
  - bandanaen på løvehovedet (skjult i manken, B4),
  - solbrillekortet, der viser brillerne på munden (B8).
- **Kat, hvalp og hest 4:**
  - Samme svage kort som kaninen.
  - Derudover fylder kasseærmerne midten af alle fire trøjekort (B7).
- **Pindsvin 4:** Samme svage kort som kaninen (B1–B3).
- **Enhjørning 3 (ned fra 4):**
  - Festhatten er lille og sidder ved øret (B6).
  - Pirathatten er flad (T7).
  - Skægget beskæres af kortets underkant (B5).
  - Regnbuehuen er blevet et pandebånd (T8).
  - Derudover de samme svage kort som de andre arter.

**10. AAA-finish** (alle ark)
- **Alle seks 4:** Gennemført, konsistent og charmerende. Tøjsættene er særligt gode: fevinger, krone, medalje, kappe og huer med ørehuller. Det, der mangler til 5 ("uden en eneste fejl"):
  - **Kanin:** R1 (vinke-lommen) og K2.
  - **Kat:** kasseærmerne og sprækken på maine coon-babyen.
  - **Hvalp:** sprækken og lommerne samt det stive vink.
  - **Pindsvin:** stadie 3 og de tre brune farver.
  - **Hest:** fjordtoppens kasse, kasseærmerne og den mintgrønne regnbue.
  - **Enhjørning:** hornet mod hovedgenstandene og stjernehornets silhuet.

## 2. Gate-afgørelse

- **Kanin: bestået.**
  - Alle kriterier er ≥ 4, og middel er 4,5 (krav: 4,3).
  - **K1 er rettet.** Der er ingen søm og intet hul ved vædderørets rod i nogen farve, størrelse eller stadie.
  - R1 (vinke-lommen) er et brud på kaninreglen, men det er ikke blokerende (se kontur). Den skal rettes før udgivelse.
- **Kat: bestået.** Alle kriterier er ≥ 4, og middel er 4,5.
- **Hvalp: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Pindsvin: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Hest: bestået.**
  - Alle kriterier er ≥ 4, og middel er 4,3.
  - Der er ingen margin. Den mintgrønne regnbue (H3) og kasseærmerne (H6) bør rettes før udgivelse.
- **Enhjørning: ikke bestået.**
  - Pasform og butikskort står til 3.
  - Den blokerende fejl er hornet mod hovedgenstandene (T6–T8). Festhatten var allerede et fund i runde 3.
  - Dette er runde 4 af 4, så enhjørningen eskaleres til integratoren med fejlene i afsnit 5.
- **Blindtesten** (rubrikkens accept-punkt): Alle 42 svar stemmer, og alle racer og stadier er ramt. Kravet er opfyldt.

## 3. Tøjet

| Sæt | Genstande (slot) | Pasform | Butikskort | Vigtigste fejl |
|---|---|---|---|---|
| Hverdag | hue, solbriller, tørklæde, trøje, rygsæk, ballon | **3** | 4 | T1, T5, T10, B1, B7, B8 |
| Opdager | safarihat, beskyttelsesbriller, kompas, vest, net (ryg), lup (hånd) | 4 | 4 | T5, B2, B7, T11 |
| Pirat | pirathat, skæg, bandana, stribet trøje, ryg- og håndgenstand | 4 | 4 | T7, T5, B4, B5, B7 |
| Milepæle | krone, regnbuehue, hjertebriller, medalje, glimmerbluse, fevinger, kappe, slikkepind | **3** | 4 | T2, T3, T4, T8, T5, B3 |
| Fest-huen | festhat (under) | 4 | 4 | T6, T9, B6 |

**Sådan er sættene scoret:**
- Et sæt får pasform 3, når mindst én genstand sidder forkert på alle arter. Det gælder Hverdag (solbrillerne) og Milepæle (hjertebrillerne og slikkepinden).
- Fejl, der kun rammer én art eller én positur, giver 4.
- **Det, der virker:** Huer og hatte med ørehuller sidder rigtigt på alle arter, og hornet går gennem huen og kronen med kant. Festhatten sidder mellem ørerne på fem arter. Tørklæde, kompas, medalje, net, kikkert, fevinger og kappe sidder naturligt i alle stadier.
- **Butikskort:** Genstanden alene er tydelig på alle kort med tre klart forskellige farvesæt. Det svage er kortene "på dyret" for ryg- og håndgenstande, trøjer med kasseærmer og enhjørningens hovedgenstande.

### Fejl i tøjet (ark og celle)

Cellerne i fit-arkene er angivet som række (y0) og kolonne (x0). For `fit-puppy.png` og `fit-hedgehog.png` ligger alle rækker 32 px højere. Se bilag A.

**T1. Hverdag-solbrillerne sidder på munden og ikke på øjnene. Alle arter.**
- **Hvor:**
  - `fit-<art>.png`, rækken "hverdag-face" (y ≈ 594–870), alle 9 celler, fx `fit-rabbit.png` st. 1 · farve 0 (374, 732).
  - `fitmatrix.png`, kolonne 5 (x ≈ 1476–1700), alle 18 rækker.
  - `sizes-<art>.png`, Hverdag "på dyret", kort 4–6 (532–972, 2480–2608).
- **Fejlen:** Brillerne ligger over næse og mund, og munden ses gennem glassene. Det læses som en maske.
- **Ret sådan:** Sæt brillerne på øjnene med klare glas (højst ca. 20 % tone og et hvidt højlys), så øjnene er lige så tydelige som uden briller. Alternativt kan brillerne skubbes op i panden som Opdager-brillerne. De må aldrig sidde over munden.

**T2. Hjertebrillerne dækker øjnene. Alle arter, værst på mørk pels.**
- **Hvor:**
  - `fit-<art>.png`, rækken "milepael-hjertebriller" (y ≈ 6546–6822), alle 9 celler.
  - `fitmatrix.png`, kolonne 23 (x ≈ 5868–6092). Værst er den sorte kat (5868–6092, 1736–2004) og sættet "milepæl 2" (8308–8532, 1736–2004).
  - Den sort-hvide hvalp i `fit-puppy.png` "vinker" (1792–2028, 13446–13722).
- **Fejlen:** De tonede glas dæmper pupiller og højlys, og på stadie 1 når hjerternes spidser ned til munden. Det bryder rubrikkens krav om, at øjnene altid er fri.
- **Ret sådan:** Brug klare glas med højst 20 % tone, og lad stellet gå uden om øjnene, så det ikke dækker vipper og pupiller. Gør hjerterne 10–15 % mindre på stadie 1, og test på den mørkeste pels: sort kat c2, sort-hvid hvalp og mørk hest c3.

**T3. Slikkepinden vender på hovedet i "tænker". Alle seks arter.**
- **Hvor:** `fit-<art>.png`, "tøj i alle humør", de fire milepæl-rækker (y ≈ 13180, 13478, 13776 og 14074), kolonnen "tænker" (x ≈ 1024–1260).
- **Fejlen:** Slikket hænger nede ved maven, og pinden peger op mod poten ved hagen.
- **Ret sådan:** Drej slikkepinden 180° om grebet i "tænker", så slikket er oppe ved kinden og pinden går ned gennem poten.

**T4. Den løftede pote er tom i "vinker" (stadie 3). Kanin, kat og hvalp.**
- **Hvor:**
  - `fit-rabbit.png` og `fit-cat.png`: (1792–2028, 13478–13754) og (1792–2028, 14074–14350).
  - `fit-puppy.png`: (1792–2028, 13446–13722) og (1792–2028, 14042–14318).
- **Fejlen:** Slikkepinden bliver nede ved hoften. Hos pindsvin, hest og enhjørning følger den den løftede pote, og det gør den også på kaninens baby-række (y ≈ 13180).
- **Ret sådan:** Knyt håndgenstanden til den løftede pote i "vinker", sådan som det allerede er gjort hos pindsvinet.

**T5. Kasseærmer på fire trøjer. Kat, hvalp, hest og enhjørning (C2 og H6 fra runde 2 og 3).**
- **Hvor:**
  - `closeup-cat.png` (2157–2443, 993–1113) og `closeup-horse.png` (2199–2405, 842–1049).
  - `closeup-puppy.png`, hue + trøje (2184–2407, 948–1084).
  - `fitmatrix.png`, kolonne 2 (trøje, x0 744), 12 (vest, x0 3184), 18 (piratrøje, x0 4648) og 25 (glimmerbluse, x0 6356) i rækkerne for kat, hvalp, hest og enhjørning (y0 1160–2600 og 3752–5192).
- **Fejlen:** Ærmet er en lukket kasse, der starter midt på maven og læses som lommer eller en overall.
- **Ret sådan:** Ærmet skal starte ved skulderen under hovedets kant og følge forbenet ned til en manchet lige over poten eller hoven. Der må ikke være en lukket overkant midt på maven, og striberne skal fortsætte hen over ærmet i samme højde. På hest og enhjørning skal ærmet være ca. 20 % smallere forneden. Kanin og pindsvin viser, hvordan det skal se ud.

**T6. Festhatten på enhjørningen er lille og ligger ved venstre øre (runde 3-fund, ikke rettet).**
- **Hvor:**
  - `fit-unicorn.png`, rækken "fest-head · under" (y ≈ 5652–5928), alle 9 celler.
  - `fitmatrix.png`, kolonne 1 (x ≈ 500–724) i enhjørningsrækkerne (y ≈ 4616–5460).
  - `closeup-unicorn.png` (1570–1672, 1478–1560).
- **Fejlen:** Hatten er ca. 40 % af hestens, ligger vandret som et hårspænde og dækker venstre øres inderside.
- **Ret sådan:** Giv hatten samme størrelse som på hesten, og sæt keglens bund mellem venstre øre og hornet, så mindst 2/3 af ørets inderside ses. Hornet skal stadig stå frit med mindst 4 enheders luft.

**T7. Pirathatten på enhjørningen mases flad.**
- **Hvor:**
  - `fit-unicorn.png`, rækken "pirat-head" (y ≈ 3868–4144).
  - `fitmatrix.png`, kolonne 15 (x ≈ 3916–4140), enhjørningsrækkerne.
  - `sizes-unicorn.png`, Pirat "på dyret", kort 1–3 (64–504, 2784–2912).
- **Fejlen:** Trekantshatten er blevet en sort skål, som hornet går igennem, og kraniet er skubbet ind bag venstre øre.
- **Ret sådan:** Behold trekantssilhuetten i samme størrelse som på de andre arter. Giv hatten et hornhul med kant ligesom huen, eller vip den, så hornet går ved siden af. Kraniet skal stå frit og centreret.

**T8. Regnbuehuen på enhjørningen bliver et pandebånd.**
- **Hvor:**
  - `fit-unicorn.png`, rækken "milepael-regnbuehue" (y ≈ 6248–6524).
  - `fitmatrix.png`, kolonne 22 (x ≈ 5624–5848), enhjørningsrækkerne.
  - `sizes-unicorn.png`, Milepæle "på dyret", kort 4–6 (532–972, 3088–3216).
- **Fejlen:** Huens kuppel er presset flad, og pomponen sidder på øret.
- **Ret sådan:** Brug samme løsning som den røde hue, der virker: kuppel, hornhul med kant og pompon ved siden af hornet.

**T9. Fjordtoppen titter frem bag festhatten (stadie 3, runde 3-fund, ikke rettet).**
- **Hvor:** `fit-horse.png` st. 3 · farve 1 (2048–2284, 5652–5928). Toppens mørke hjørner ses på begge sider af keglen ved (2146–2151, 5690–5701) og (2175–2186, 5690–5701).
- **Ret sådan:** Klip fjordtoppen til hattens bund, eller skjul den under alle hatte af typen "under".

**T10. Ærmerne krydser hinanden i "jubel" med hele Hverdag-sættet. Kat, hvalp, pindsvin, hest og enhjørning.**
- **Hvor:**
  - `fit-cat.png`, `fit-horse.png` og `fit-unicorn.png`: (768–1004, 11692–11968).
  - `fit-puppy.png` og `fit-hedgehog.png`: (768–1004, 11660–11936).
- **Fejlen:** De brede ærmer går fra den modsatte hofte op til kinderne og danner et stort X over brystet.
- **Ret sådan:** Lad ærmerne følge armene fra skulderen i et V, sådan som det sker på kaninen, og læg tørklædet ovenpå.

**T11. Opdager-brillerne gemmer sig bag pandelokken på shetland-babyen (mindre fejl).**
- **Hvor:** `fitmatrix.png`, kolonne 10, hesterække stadie 1 (2696–2920, 3752–4020).
- **Ret sådan:** Læg brillerne oven på pandelokken, eller skub dem op over den.

### Fejl i butikskortene (ark og celle)

- **B1. Rygsækken ses kun som stropper på dyret.**
  - **Hvor:** `sizes-<art>.png`, Hverdag "på dyret", kort 13–15 (1936–2376, 2480–2608).
  - **Ret sådan:** Vis rygslottet i tre kvart profil, eller forskyd genstanden, så mindst halvdelen af rygsækken ses ved siden af kroppen.
- **B2. Luppen er næsten usynlig på dyret.**
  - **Hvor:** Opdager "på dyret", kort 16–18 (2404–2844, 2632–2760). Det samme gælder pirat-håndgenstanden og slikkepinden, som er små i helfigurskortene.
  - **Ret sådan:** Beskær håndslottet omkring poten og genstanden. Genstanden skal fylde mindst 1/3 af kortet.
- **B3. Kappen ses kun i kortets kanter.**
  - **Hvor:** Milepæle "på dyret", kort 19–21 (2872–3312, 3088–3216).
  - **Ret sådan:** Brug tre kvart profil, eller lad kappen bølge synligt ud til siden.
- **B4. Bandanaen er svær at læse.**
  - **Hvor:**
    - Genstanden alene: Pirat, kort 7–9 (1000–1440, 1940–2068).
    - På løvehovedet: `sizes-rabbit.png`, Pirat "på dyret", kort 9 (1312–1440, 2784–2912).
  - **Fejlen:** Alene læses den som en rød trekant og ikke som et halstørklæde. På løvehovedet forsvinder den i manken.
  - **Ret sådan:** Tegn knude og flagrende snipper på kortet med genstanden alene. På løvehovedet skal den ligge oven på manken.
- **B5. Enhjørningens skæg beskæres af kortets underkant.**
  - **Hvor:** `sizes-unicorn.png`, Pirat "på dyret", kort 4–6 (532–972, 2784–2912).
  - **Ret sådan:** Ansigtsslottets beskæring skal gå til hagen, når genstanden når under munden.
- **B6. Enhjørningens festhatkort.**
  - **Hvor:** `sizes-unicorn.png`, Fest "på dyret", kort 1–3 (64–504, 2936–3064).
  - **Fejlen:** Hatten er lille og sidder i hjørnet.
  - **Ret sådan:** Følger af T6.
- **B7. Kasseærmerne dominerer trøjekortene på kat, hvalp, hest og enhjørning.**
  - **Hvor:**
    - Hverdag kort 10–12 (1468–1908, 2480–2608), Opdager kort 10–12 (y ≈ 2632) og Pirat kort 10–12 (y ≈ 2784).
    - Milepæle glimmerbluse, kort 13–15 (1936–2376, 3088–3216).
  - **Ret sådan:** Følger af T5.
- **B8. Solbrillekortet viser brillerne på munden.**
  - **Hvor:** Hverdag "på dyret", kort 4–6.
  - **Ret sådan:** Følger af T1.

## 4. Engdalen-scenen (`scene.png`)

**Karakter: 3/5.** Pæn og konsistent, men ikke på niveau med et betalt topprodukt endnu.

- **Det, der virker:**
  - Scenen har samme bløde stil og palet som figurerne: bakker i lag, en mølle i baggrunden, et hus med rødt tag og en sti ned til en hobbit-dør i en bakke.
  - Der er en å med bro og en geometrisk have med cirkel, trekant og firkant. Den er et fint nik til matematikken.
  - Guld-tieret med regnbue, fugle, frugttræer og glimt i vandet er en god belønning.
- **Det, der mangler:**
  - **Tom mellemgrund:** Mellemgrunden er store, flade, grønne flader med få prikker, især venstre halvdel på iPad. Se start (64–1300, 2900–3700) og guld (64–1300, 4630–5430).
  - **Ingen dybde eller lys:** Der er ingen forgrund, der rammer billedet ind, og ingen kastede skygger under hus, træer og mølle. Bakkerne er bånd med næsten samme mætning.
  - **Verdenslogik:**
    - Åen begynder som en spids midt på en bakke (telefon, start (467, 1087)). Det er det samme i alle paneler.
    - Hegnet fortsætter hen over vandet, og en lygtepæl står i åkanten (iPad guld (1930–2035, 4960–5065)).
    - Broen er en flad planke med ét gelænder.
  - **Svag progression:** Start og bronze er næsten ens. Kun lygterne og et par blomster er nye. Sammenlign telefon (64–882) med (910–1728), y ≈ 268–2032, og iPad (64–2456) med (2484–4876), y ≈ 2140–3840.
  - **Kortlaget:** I skitsen dækker kortpanelet ca. 75 % af telefonscenen (2602–3420, 268–2032), og hus, hobbit-dør og have forsvinder under det.

**De 3 vigtigste forbedringer:**
1. **Dybde og komposition:**
   - Giv bakkerne tydelige trin i lyshed og mætning: kølige og lyse langt væk, varme og mættede forrest.
   - Tilføj forgrundselementer i de nederste hjørner, fx store blade, blomsterklynger og græs, der er delvis beskåret.
   - Placér 3–4 små seværdigheder i den tomme mellemgrund, fx en dam, trædesten, et lille dyr og et skilt med tal. De skal ligge uden for kortets rute og ikke under kortpanelet.
2. **Ret verdenslogikken:**
   - Giv åen et udspring bag den fjerne bakke eller fra en dam med et lille vandfald. Den skal blive bredere nedstrøms og have mørkere brinker.
   - Lad hegnet stoppe ved åen med en stolpe på hver bred, og flyt lygten op på land.
   - Gør broen til en bue med to gelændere og skygge.
   - Giv hus, træer, mølle og hobbit-bakke en jordskygge.
3. **Lys, progression og samspil med kortet:**
   - Lad solen give blødt retningslys: varme højlys på bakketoppe og skygger på den modsatte side.
   - Gør hvert tier tydeligt forskelligt. Bronze kan fx få flere blomster, sommerfugle og røg fra skorstenen, og guld kan få regnbue, fugle og glimt.
   - Lad kortpanelet være lettere (frostet og højst ca. 60 % dækkende), og placér scenens kendemærker (hus, regnbue og hobbit-dør) i de dele, der stadig ses rundt om panelet.

## 5. Det, der ikke består: fejl i prioriteret rækkefølge

### Enhjørning (ikke bestået: pasform 3 og butikskort 3)

1. **Hornet mod hovedgenstandene (blokerende).**
   - T6: festhatten (`fit-unicorn.png` y ≈ 5652–5928 og `closeup-unicorn.png` (1570–1672, 1478–1560)).
   - T7: pirathatten (`fit-unicorn.png` y ≈ 3868–4144).
   - T8: regnbuehuen (`fit-unicorn.png` y ≈ 6248–6524).
   - Ret sådan: Brug hornhul med kant ligesom på den røde hue og kronen, som virker. Hatte af typen "under" vippes ned mellem venstre øre og hornet i fuld størrelse.
   - Tjek alle 9 celler i hver række og kortene i `sizes-unicorn.png`.
2. **Butikskort (blokerende sammen med 1).** B5 (skægget beskåret) og B6 (lille festhat). Ret beskæringen, så skægget kommer med til hagen.
3. **Kasseærmer (T5):** `closeup-unicorn.png`, hue + trøje (1864–2736, 212–1280), og `fitmatrix.png` kolonne 2, 12, 18 og 25 i enhjørningsrækkerne (y0 4616, 4904 og 5192).
4. **Fællesfejlene T1–T3** rettes i sættene (se nedenfor).
5. **Sprækker under 4 enheder (kontur):** race 2, mellem manens spids og hoften og mellem forben og kind i "vinker" og "tænker" (`holes.png` #835–#838, #846, #871, #888, #889 og #891). Fyld pels bag manen og forbenet.
6. **Stjernehornets silhuet:** `silhouettes.png` #36, #38 og #40. Gør hornets skaft mindst 2/3 synligt under stjernen, og lad stjernen højst være 1,2 gange hornets bundbredde. Alternativt kan stjernen flyttes til et mærke i panden.
7. **Glimtet:** Gør stjernen udfyldt hvid med guldkontur, tilføj en lille ekstra stjerne, og lad den være mindst 14 enheder, så den ses ved 48 px. Brug kun opacity.

### Hverdag (ikke bestået: pasform 3)

1. **T1 solbrillerne på munden.** Alle arter og alle 9 celler i rækken "hverdag-face", `fitmatrix.png` kolonne 5, og butikskort 4–6.
2. **T5 kasseærmer på trøjen** (kat, hvalp, hest og enhjørning).
3. **T10 ærmerne krydser hinanden i "jubel"** (rækken y ≈ 11692 / 11660, x ≈ 768).
4. **B1 rygsækken på dyret.**

### Milepæle (ikke bestået: pasform 3)

1. **T2 hjertebrillerne over øjnene.** Alle arter, rækken y ≈ 6546, og `fitmatrix.png` kolonne 23.
2. **T3 slikkepinden på hovedet i "tænker".** Alle arter, x ≈ 1024 i de fire milepæl-rækker.
3. **T4 den tomme pote i "vinker".** Kanin, kat og hvalp, stadie 3.
4. **T8 regnbuehuen på enhjørningen.**
5. **T5 ærmerne på glimmerblusen.**
6. **B3 kappekortet** og de små håndkort (B2).

### Forbehold for de arter, der har bestået (rettes før udgivelse)

- **Kanin:**
  - **R1:** Fyld lommen mellem løftet arm og kind i opret · stadie 2 · vinker med pels bag armen (`holes.png` #34 og #40, `moods-rabbit.png` (2699–2736, 492–533) og `filmstrip-rabbit.png` række 7).
  - Udvid magenta-lint'en, så den fejler på lukkede områder inden for yderkonturen og ikke kun på sprækker. Den har ikke fanget denne lomme.
  - **K2 (uændret):** Løft næse, overlæbe og knurhårsrødder 5–6 enheder i toppunktet med et lodret squash af næsen (ca. 0,85), og læg et nik på 1–2 enheder på overshoot-framen.
- **Kat:**
  - T5 (C2).
  - Den langhårede silhuet (#9, #11 og #32): Gør kraven symmetrisk med 3–4 runde totter, og lad knurhårene stikke mindst 6 enheder ud.
  - Sprækken på maine coon-babyen (`holes.png` #409–#415).
  - Huskat-babyens hoftekile (`species-cat.png` (397–401, 529–539)), så den kommer over 4 enheder eller fyldes.
- **Hvalp:**
  - Sprækken på #522.
  - Lommerne i "tænker" og "sover" (#519, #521, #525 og #527).
  - Et større vink: Drej poten ±20° om albuen med 2 sving.
  - Gør ørerne mere hundeagtige med en synlig fold, så hovedet ikke ligner vædderens.
- **Pindsvin:**
  - Stadie 3: Gør hovedet relativt 8–10 % mindre, og giv kroppen og fødderne lidt mere længde og piggene mere længde.
  - Gør c5 tydeligt lyserød, eller c4 tydeligt rødorange.
- **Hest:**
  - **H3-regression:** Giv regnbuehesten en varm cremefarvet krop igen, så den ikke deler mint med enhjørningen (`species-horse.png` c8 og `sizes-horse.png` kort 8).
  - T5 (H6).
  - Fjordtoppen: Fjern bundkonturen, gør toppen smallere foroven med totter i forskellig højde, og klip den til hattene (T9).
  - Giv de mindste heste (#15 og #41) en tydeligere mule og hale.

## 6. Runde 3-fund: status

| # | Fund fra runde 3 | Status | Det ser jeg nu |
|---|---|---|---|
| K1 | Hul ved vædderørets rod | **Rettet** | Ingen baggrund ved ørets rod i 32 artskort, nærbilleder, 256 px og silhuetter. |
| K4 | Kroge ved regnbuesmækken | **Rettet** | Smækken er klippet til brystet inden for armene. |
| K2 | Næsevippet ses næsten ikke | **Ikke rettet** | Uændret: ca. 3,5 px i normal størrelse, uden squash og nik. |
| C1 | Maine coon-skuldre over halsudskæringen | **Rettet** | Ren halsudskæring (`closeup-cat.png` (2140–2470, 780–880)). |
| C2 | Ærmer, der ligner lommer | **Ikke rettet** | Uændret og nu også på vest, piratrøje og glimmerbluse (T5). |
| C3 | Regnbuekraven krydser armene i jubel | **Stort set rettet** | Kraven er klippet til brystet. Der er en lille rest ved armenes underkant (`closeup-cat.png` (994–1071, 1826–1857)). |
| – | Langhårskatten ligner en ræv | **Ikke rettet** | #9, #11 og #32 var usikre i min blindtest. |
| H6 | Ærmer som høje rektangler | **Ikke rettet** | Uændret og nu på fire trøjer (T5). |
| – | Fjordtoppen er en påsat kasse | **Ikke rettet** | Samme bundkontur og trin, og den titter frem bag festhatten (T9). |
| – | Araber-babyen mangler hale | **Ikke rettet** | #15 (araber) og #41 (shetland) var usikre i min blindtest. |
| – | Palet: regnbue-fjorden ligner isabel | **Ændret, ny fejl** | Ligner ikke isabel længere, men er nu mint som enhjørningens c4 (H3-regression). |
| – | Festhatten på enhjørningen er lille og dækker øret | **Ikke rettet** | Uændret (T6). |
| – | Regnbue-enhjørningen ligner c3 lavendel | **Rettet** | Regnbuen har nu en ferskenfarvet krop. |
| – | Stjernehornets silhuet (stadie 1–2) | **Ikke rettet** | Stjernehornet var usikkert på alle tre stadier i min blindtest. |
| – | Glimtet er svagt | **Delvist rettet** | Hvid stjerne i frame 2–4, synlig ved 100 %, men hul med lilla kontur, én stjerne og ca. 3 px ved 48 px. |
| Fælles | Magenta-tjek for huller | **Delvist** | `holes.png` findes nu og afslørede K1-rettelsen. Men lukkede lommer og sprækker er stadig med i arket (R1 og sprækkerne på kat, hvalp og enhjørning), så lint'en fanger dem ikke. |

**I alt:** Af runde 3's 15 artsfund er 4 rettet (K1, K4, C1 og enhjørningens palet), 2 er delvist rettet (C3 og glimtet), og 9 er ikke rettet eller er ændret til en ny fejl. Den blokerende fejl fra runde 3 (K1) er rettet.

## Bilag A: koordinatsystem

- **Arts-ark:**
  - Kort x0 = 256 + 244 · (n − 1) for farve c*n* (bredde 236).
  - Stadie 1–3 har y0 = 320, 608 og 896 (race 1), 1612, 1900 og 2188 (race 2) og 2904, 3192 og 3480 (race 3).
  - Enhjørningen har y0 = 352, 640 og 928, 1644, 1932 og 2220, og 2936, 3224 og 3512. Race 1 har ni farver.
  - Hvalp og pindsvin har én race med y0 = 320, 608 og 896.
- **Fit-ark:**
  - Kort x0 = 256, 512 og 768 (stadie 1 · farve 0/1/2), 1024, 1280 og 1536 (stadie 2) og 1792, 2048 og 2304 (stadie 3). Kortene er 236 × 276.
  - Slot-rækker y0 (kanin, kat, hest og enhjørning):
    - Hverdag: 1 hue 296, 2 solbriller 594, 3 tørklæde 892, 4 trøje 1188, 5 rygsæk 1486, 6 ballon 1784.
    - Opdager: 7 hat 2082, 8 briller 2380, 9 kompas 2676, 10 vest 2974, 11 net 3272, 12 lup 3570.
    - Pirat: 13 hat 3868, 14 skæg 4164, 15 bandana 4462, 16 trøje 4760, 17 ryg 5058, 18 hånd 5356.
    - 19 festhat 5652.
    - Milepæle: 20 krone 5950, 21 regnbuehue 6248, 22 hjertebriller 6546, 23 medalje 6844, 24 glimmerbluse 7140, 25 fevinger 7438, 26 kappe 7736, 27 slikkepind 8034.
    - Kombinationer: 28 hue + trøje 8332, 29 festhat + trøje 8628, 30–34 hele sæt 8926, 9224, 9522, 9820 og 10116.
  - "Tøj i alle humør" har y0 = 10502, 10800, 11098, 11394, 11692, 11990, 12288, 12586, 12882, 13180, 13478, 13776 og 14074, med x0 = 256 + 256 · (k − 1) for hvile, glad, jubel, tænker, ups, sover og vinker.
  - Hvalp og pindsvin: alle y0 er 32 px mindre.
- **`fitmatrix.png`:**
  - Række y0 = 296 + 288 · r: kanin r = 0–2, kat 3–5, hvalp 6–8, pindsvin 9–11, hest 12–14 og enhjørning 15–17.
  - Kolonne x0 = 256 + 244 · c. Kortene er 224 × 268.
  - Kolonnerne c er:
    - 0 hue, 1 festhat, 2 trøje, 3 hue + trøje, 4 festhat + trøje,
    - 5–8 hverdag ansigt, hals, ryg og hånd,
    - 9–14 opdager hoved, ansigt, hals, krop, ryg og hånd,
    - 15–20 pirat hoved, ansigt, hals, krop, ryg og hånd,
    - 21–28 krone, regnbuehue, hjertebriller, medalje, glimmerbluse, fevinger, kappe og slikkepind,
    - 29–33 hele sæt: Hverdag, Opdager, Pirat, Milepæl 1 og Milepæl 2.
- **`sizes-<art>.png`:**
  - Kort x0 = 64 + 156 · (k − 1). 48 px-kortene har y0 = 268.
  - Butikskortene er 128 × 128. "Genstand alene" har y0 = 1636, 1788, 1940, 2092 og 2244, og "på dyret" har y0 = 2480, 2632, 2784, 2936 og 3088 (Hverdag, Opdager, Pirat, Fest og Milepæle).
  - Rækkefølgen i hver række er hoved 1–3, ansigt 4–6, hals 7–9, krop 10–12, ryg 13–15 og hånd 16–18. For Milepæle er den krone 1–3, regnbuehue 4–6, hjertebriller 7–9, medalje 10–12, glimmerbluse 13–15, fevinger 16–18, kappe 19–21 og slikkepind 22–24.
- **`holes.png`:**
  - Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28). y0 for række 1–34 er 212, 374, 536, 696, 858, 1020, 1182, 1344, 1504, 1666, 1828, 1990, 2152, 2312, 2474, 2636, 2798, 2960, 3120, 3282, 3444, 3606, 3768, 3928, 4090, 4252, 4414, 4576, 4736, 4898, 5060, 5222, 5384 og 5544.
  - Fliserne fordeler sig sådan:
    - Kanin 1–288: opret 1–60, vædder 61–228 og løvehoved 229–288.
    - Kat 289–468: huskat 289–348, langhår 349–408 og maine coon 409–468.
    - Hvalp 469–528, pindsvin 529–588 og hest 589–768.
    - Enhjørning 769–951: race 1 769–831, race 2 832–891 og stjernehorn 892–951.
  - Inden for hver race og hvert stadie kommer først farverne i hvile, derefter 6 humør i c1 og 6 humør i c4 (glad, jubel, tænker, ups, sover og vinker).
- **Filmstrimler:** Række *n* har y0 = 264 + 310 · (*n* − 1), og frame *k* har x0 = 256 + 244 · (*k* − 1). Nærbilledet har y0 = 3088, og frame *k* har x0 = 64 + 360 · (*k* − 1).
- **Silhuetter:** #*n* har midte ved x ≈ 204 + 300 · ((*n* − 1) mod 9) og y ≈ 393, 765, 1144, 1523 og 1895 for række 1–5.
- **Scene:**
  - Telefonpanelerne har x0 = 64, 910, 1756 og 2602 (start, bronze, guld og blandet med kortet) og y ≈ 268–2032.
  - iPad-panelerne er start (64–2456, 2140–3840), bronze (2484–4876, 2140–3840), guld (64–2456, 3868–5566) og blandet med kortet (2484–4876, 3868–5566).

## Bilag B: rubrikkens JSON-format

```json
{
  "species": "rabbit",
  "scores": {
    "recognizability48": 5, "silhouette": 5, "proportions": 5, "outline": 4, "palette": 5,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.5,
  "pass": true,
  "issues": [
    { "criterion": "outline", "sheet": "holes.png", "at": [829, 468], "note": "R1: opret · stadie 2 · vinker har en lukket lomme (ca. 11 enheder) mellem løftet arm og kind og bryder kaninreglen om nul lukkede pixels. Også [1645, 468], moods-rabbit.png [2717, 512] og filmstrip-rabbit.png række 7 i 7 af 8 frames, fx [400, 2281]. K1 ved vædderørets rod er rettet." },
    { "criterion": "animation", "sheet": "filmstrip-rabbit.png", "at": [368, 2886], "note": "K2 uændret: næsen flytter sig ca. 3,5 px i normal størrelse og 8-9 px i nærbilledet [230, 3308], uden squash og nik." },
    { "criterion": "fit", "sheet": "fit-rabbit.png", "at": [374, 732], "note": "T1: Hverdag-solbrillerne sidder på munden i alle 9 celler i rækken y 594-870." },
    { "criterion": "fit", "sheet": "fit-rabbit.png", "at": [1142, 13616], "note": "T3/T4: slikkepinden vender på hovedet i 'tænker' (alle milepæl-rækker), og den løftede pote er tom i 'vinker' [1910, 13616] og [1910, 14212]." },
    { "criterion": "shopCard64", "sheet": "sizes-rabbit.png", "at": [2000, 2544], "note": "Rygsækken ses kun som stropper; luppen [2468, 2696] er næsten usynlig; kappen [2936, 3152] ses kun i kanten; bandanaen forsvinder i løvehovedets manke [1376, 2848]." }
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
    { "criterion": "fit", "sheet": "closeup-cat.png", "at": [2300, 1053], "note": "C2/T5 ikke rettet: kasseærmer, nu på trøje, vest, piratrøje og glimmerbluse (fitmatrix.png kolonne 2, 12, 18 og 25, rækkerne y0 1160-1736)." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [2604, 393], "note": "Langhår #9, #32 [1404, 1523] og #11 [504, 765] læses som ræv (kindpels og busket hale, ingen synlige knurhår)." },
    { "criterion": "outline", "sheet": "holes.png", "at": [2317, 2586], "note": "Maine coon-babyen: lukket sprække under 4 enheder mellem halespids og skulder i #409-#415. Huskat-babyens hoftekile er præcis 4 enheder (species-cat.png [399, 534])." },
    { "criterion": "fit", "sheet": "fit-cat.png", "at": [886, 11830], "note": "T10: ærmerne danner et X over brystet i 'jubel' med hele Hverdag-sættet. T3/T4 også: slikkepind på hovedet i 'tænker' [1142, 13616] og tom pote i 'vinker' [1910, 13616]." }
  ]
}
```

```json
{
  "species": "puppy",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 5,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "outline", "sheet": "holes.png", "at": [2466, 3222], "note": "Stadie 3 · vinker · c1: lukket sprække under 4 enheder mellem løftet arm og øre (#522). Ufyldte lommer mellem arm, øre og krop i 'tænker' og 'sover' (#519, #521, #525, #527)." },
    { "criterion": "fit", "sheet": "closeup-puppy.png", "at": [2300, 1015], "note": "T5: kasseærmer på trøje, vest, piratrøje og glimmerbluse. Hjertebrillerne skjuler næsten den sort-hvide hvalps øjne (fit-puppy.png [1910, 13584]), og den løftede pote er tom i 'vinker'." },
    { "criterion": "animation", "sheet": "filmstrip-puppy.png", "at": [856, 2268], "note": "Vinket er det mindste af alle arter: poten forlader næsten ikke kinden. Rækken med blink og ørevip er svagest." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [1704, 393], "note": "#6, #14 [1404, 765] og #21 [804, 1144]: hovedsilhuetten ligger tæt på vædderkaninens. Kun den tynde hale og snudebuen skiller dem i sort." }
  ]
}
```

```json
{
  "species": "hedgehog",
  "scores": {
    "recognizability48": 5, "silhouette": 5, "proportions": 4, "outline": 5, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 4, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.4,
  "pass": true,
  "issues": [
    { "criterion": "proportions", "sheet": "species-hedgehog.png", "at": [374, 1034], "note": "Stadie 3 er næsten et opskaleret stadie 2 [374, 746]: silhuetterne overlapper 95-96 % efter normalisering." },
    { "criterion": "palette", "sheet": "species-hedgehog.png", "at": [1350, 458], "note": "c5 rosabrun ligger tæt på c1 brun [374, 458] og c4 rustrød [1106, 458] ved lille størrelse." },
    { "criterion": "fit", "sheet": "fit-hedgehog.png", "at": [1142, 13584], "note": "T3: slikkepinden vender på hovedet i 'tænker'. T1, T2 og T10 som for de andre arter." }
  ]
}
```

```json
{
  "species": "horse",
  "scores": {
    "recognizability48": 4, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 4,
    "faceAppeal": 5, "fit": 4, "animation": 5, "shopCard64": 4, "aaaFinish": 4
  },
  "mean": 4.3,
  "pass": true,
  "issues": [
    { "criterion": "recognizability48", "sheet": "sizes-horse.png", "at": [1220, 335], "note": "H3-regression: regnbuehesten er nu mint med blågrøn kontur som enhjørningens c4 og læses som en enhjørning uden horn. species-horse.png c8 [2082, 2038]." },
    { "criterion": "fit", "sheet": "closeup-horse.png", "at": [2300, 945], "note": "H6/T5 ikke rettet: høje rektangel-ærmer, nu på fire trøjer. Fjordtoppen titter frem bag festhatten på stadie 3 (fit-horse.png [2166, 5696])." },
    { "criterion": "outline", "sheet": "closeup-horse.png", "at": [1400, 610], "note": "Fjordtoppen er stadig en påsat kasse med vandret bundkontur og trin ved samlingen." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [1704, 765], "note": "#15 (araber, stadie 1) og #41 (shetland, stadie 1) [1404, 1895]: svag mule og næsten ingen hale, læses som kat." }
  ]
}
```

```json
{
  "species": "unicorn",
  "scores": {
    "recognizability48": 5, "silhouette": 4, "proportions": 5, "outline": 4, "palette": 5,
    "faceAppeal": 5, "fit": 3, "animation": 4, "shopCard64": 3, "aaaFinish": 4
  },
  "mean": 4.2,
  "pass": false,
  "issues": [
    { "criterion": "fit", "sheet": "fit-unicorn.png", "at": [1142, 5790], "note": "T6 (runde 3, ikke rettet): festhatten er ca. 40 % af hestens og ligger vandret ved venstre øre, hvor den dækker inderøret. Alle 9 celler. Også closeup-unicorn.png [1620, 1520]." },
    { "criterion": "fit", "sheet": "fit-unicorn.png", "at": [1142, 4006], "note": "T7: pirathatten er mast flad til en sort skål, og kraniet er skubbet bag venstre øre." },
    { "criterion": "fit", "sheet": "fit-unicorn.png", "at": [1142, 6386], "note": "T8: regnbuehuen er presset til et pandebånd, og pomponen sidder på øret." },
    { "criterion": "shopCard64", "sheet": "sizes-unicorn.png", "at": [596, 2848], "note": "B5: skægget beskæres af kortets underkant (kort 4-6). B6: festhatten er lille og sidder i hjørnet [128, 3000]." },
    { "criterion": "outline", "sheet": "holes.png", "at": [417, 5310], "note": "Sprækker under 4 enheder i race 2: forben/kind i 'vinker' (#871, #889, #891), manen/kind i 'tænker' (#888) og manens spids/hofte (#835-#838, #846, fx [3101, 5022])." },
    { "criterion": "silhouette", "sheet": "silhouettes.png", "at": [2604, 1523], "note": "Stjernehornet er usikkert på alle tre stadier: #36, #38 [504, 1895] og #40 [1104, 1895]." },
    { "criterion": "animation", "sheet": "filmstrip-unicorn.png", "at": [1320, 3150], "note": "Glimtet ses nu ved 100 % i frame 2-4, men er hult med lilla kontur, kun én stjerne og ca. 3 px ved 48 px." }
  ]
}
```
