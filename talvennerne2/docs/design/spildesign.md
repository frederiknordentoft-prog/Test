# Talvennerne 2: design af spil, progression og fastholdelse

*Lead game design. Designet bygger på V1-koden i `/home/user/Test` (læst: `src/state/useRound.ts`, `src/engine/mastery.ts`, `src/engine/roundBuilder.ts`, `src/state/storage.ts`, `src/state/useProfile.ts`, `src/ui/screens/RewardScreen.tsx`, `src/ui/screens/HomeScreen.tsx`, `src/art/creatureGen.ts`, `src/content/islands.ts`). Filstier nedenfor er relative til V2-appens rod.*

---

## 0. Den bærende idé og de tre spor

**Fortælling:** Talvennernes rige har mistet sine farver. Hver gang barnet bliver *sikker* i noget, vender farverne tilbage til den del af verden. Dyrene bor der, og de vokser, jo mere barnet regner sammen med dem.

Tre spor kører side om side, så et barn aldrig oplever at intet sker:

| Spor | Hvad fodrer det | Hvad barnet ser | Kan det gå i stå? |
|---|---|---|---|
| **Rejsen** (kortet) | Beståede mesterprøver | Stien, tåge der letter, nye verdener | Ja, ved en mesterprøve. Derfor findes de to andre spor |
| **Venner og ting** (meta) | Rigtige svar (indsats) og mestring | Æg, venskab, tøj, perler, niveau | Nej, hver tur giver noget |
| **Kan-bogen** (læring) | Leitner-bokse (fri indtastning, hurtigt, på tværs af dage) | Medaljer bronze/sølv/guld; regionen får farve | Nej, men den går langsomt og ærligt |

Det kobler belønning til læring: de mest eftertragtede præmier (enhjørning-føl, gyldne og regnbue-dyr, Ridder- og Talmagiker-sættene, titler, regionernes fulde farver) kan **kun** låses op af mestring. Hverdagens små belønninger kommer af indsats. Ingen belønning kan fås uden at regne.

**Ændringer i forhold til V1:**
- 🔥-streaken i `HomeScreen.tsx` fjernes. Den erstattes af "Dage spillet i alt", som aldrig nulstilles.
- "Et nyt væsen hver tur" (`RewardScreen.tsx`) erstattes af et rugeæg, der fyldes.
- "Min ø" bliver til Dyrehaven.

---

## 1. Verdensstruktur

### 1.1 Fire verdener, én pr. klassetrin

| `WorldId` | Navn | Klasse | Zone i Dyrehaven | Arter (dyr-ven-noder) | Verdenssæt (kister) |
|---|---|---|---|---|---|
| `eng` | Engdalen | 0. | Kaninhaven | kanin, kat, hvalp, pindsvin | Opdager |
| `bakke` | Hestebakkerne | 1. | Stalden | hest, lam, ræv, hamster | Rytter |
| `skov` | Regnbueskoven | 2. | Regnbuelysningen | enhjørning, panda, egern, ugle | Kongelig |
| `fjeld` | Stjernefjeldet | 3. | Stjernetoppen | pegasus, drage, pingvin, isbjørn | Astronaut |

### 1.2 Etaper (8 pr. verden, hver med ét fagdomæne)

Skill-id'erne er forslag og skal afstemmes med pensum-/motor-planen.

**Engdalen (0. kl.)**

| # | Etape | Domæne | Skills | Node 3 |
|---|---|---|---|---|
| 1 | Tællelunden I | Tal | `count10`, `subitize` | ven: kanin |
| 2 | Formhaven | Figurer | `shapes2dBasic` (cirkel, trekant, firkant, rektangel) | kiste |
| 3 | Tællelunden II | Tal | `neighbour`, `numberline10` | ven: kat |
| 4 | Plusengen | Plus/minus | `addTo5`, `addTo10` | kiste |
| 5 | Minusbækken | Plus/minus | `subTo10` | ven: hvalp |
| 6 | Mønstermarken | Figurer/tal | `patterns`, `compare20` | kiste |
| 7 | Tyvestien | Tal | `numbersTo20`, `tenFriends` | ven: pindsvin |
| 8 | Lighedsengen | Plus/minus | `mixedTo10`, `equalsSign` | kiste |

**Hestebakkerne (1. kl.)**

| # | Etape | Skills |
|---|---|---|
| 1 | Tiervennernes hule | `tenFriends`, `doubles`, `halves` |
| 2 | Tyvebroen I | `addTo20` |
| 3 | Tyvebroen II | `subTo20` |
| 4 | Urtårnet I | `clockWholeHalf` |
| 5 | Hundredemarken | `tensAndOnes`, `numbersTo100`, `hundredChart` |
| 6 | Formværkstedet | `shapes3d`, `polygonsSidesCorners`, `symmetry` |
| 7 | Målebakken | `lengthCmM`, `compareLength` |
| 8 | Tierhoppet | `addSubTens`, `add2d1dNoCarry` |

**Regnbueskoven (2. kl.)**

| # | Etape | Skills |
|---|---|---|
| 1 | Vekselvandet I | `add2dCarry` |
| 2 | Vekselvandet II | `sub2dBorrow` |
| 3 | Gangegrotten I | `mulRepeatedAdd`, `table2_5_10` |
| 4 | Købmandsgården | `moneyCoinsNotes`, `moneyChange100` |
| 5 | Urtårnet II | `clockQuarter` |
| 6 | Stortalsbjerget | `placeValue1000` |
| 7 | Linealstien | `lengthCmMm`, `rectSquareProps` |
| 8 | Gangegrotten II | `table3_4`, `commutative` |

**Stjernefjeldet (3. kl.)**

| # | Etape | Skills |
|---|---|---|
| 1 | Tabeltoppen I | `table6_7` |
| 2 | Tabeltoppen II | `table8_9`, `tableMixed` |
| 3 | Delekløften | `divShare`, `divInverse` |
| 4 | Brøkbageriet | `fracHalfQuarterThird` |
| 5 | Minuttårnet | `clockMinutes`, `elapsedTime` |
| 6 | Trecifret bro | `add3dCarry`, `sub3dBorrow` |
| 7 | Arealhaven | `areaSquares`, `weightGKg` |
| 8 | Markedet | `moneyKrOre`, `moneyChange` |

Ulige etaper har en dyr-ven-node, lige etaper en kiste. Det giver 4 venner og 4 kister pr. verden.

### 1.3 Knudetyper og fast node-rækkefølge pr. etape

Rækkefølgen i hver etape er `lesson → lesson → friend|chest → lesson → mix → trial`. Hver verden slutter med `finale`.

Node-id'er følger mønstret `${world}-${stage}-${slot}`, fx `eng-1-l1`, `eng-1-friend`, `eng-2-chest`, `eng-1-mix`, `eng-1-trial`, `eng-finale`.

| `NodeKind` | Dansk navn | Indhold | Belønning |
|---|---|---|---|
| `lesson` | Tur | 10 opgaver (8 i etaper med opgaver i flere trin: veksling, trecifret, byttepenge, minutter). 80 % fra etapen, 20 % fra tidligere etaper, så regnearterne blandes. | Stjerner 1-3 |
| `friend` | Ny ven | Voiced mini-historie på 2-3 linjer ("Kaninen har tabt sine gulerødder, vil du tælle med?"), derefter en tur med opgaver i dyrets tema | Arten låses op (første dyr og æg af arten), navngivning |
| `chest` | Kiste | Ingen opgaver. Åbnes efter forrige node. **Indholdet vises på kortet på forhånd.** | 1 bestemt tøjgenstand |
| `mix` | Blandet tur | 60 % denne etape, 40 % tidligere etaper, valgt efter hvad der er "due" | Stjerner |
| `trial` | Mesterprøve ("Byg broen") | 10 opgaver, mindst 60 % fri indtastning, ingen timer. Hvert rigtigt svar i første forsøg lægger en planke. **8 planker = broen holder.** | Bestået: 10 perler, 100 XP, tågen letter over næste etape |
| `finale` | Verdensfest | 12 opgaver blandet fra hele verdenen, bestået ved mindst 10 | 2 heltestykker (krop og ryg) fra verdenssættet, 25 perler, 250 XP, zonen i Dyrehaven får fuld farve, broen til næste verden |

Første gennemspilning giver cirka 45 ture pr. verden og cirka 180 i alt. Den reelle spilletid styres af mestringen, fordi mesterprøverne ikke kan bestås uden at barnet kan stoffet.

### 1.4 Porte uden at barnet sidder fast

- **Højst én åben, ikke-bestået mesterprøve ad gangen.** Efter 3 mislykkede forsøg åbner en "hjælpebro" (rebbro) til næste etape. Den gamle mesterprøve bliver stående som "Venter på dig" med sin belønning, men etapen efter den nye er lukket, indtil én af de to prøver er bestået. Barnet er altså højst én etape foran sin mestring.
- Et mislykket forsøg koster intet. Perler for rigtige svar udbetales stadig, og skærmen viser "Bedst: 7 planker". Planker gemmes ikke mellem forsøg; ellers betyder prøven ingenting.
- Efter hvert mislykket forsøg lyser en **Træningshytte** op ved porten. Det er en tur bygget af de fakta, barnet svarede forkert på i prøven.
- En forælder kan åbne etaper fra dashboardet, som `openThroughGrade` gør i V1.

### 1.5 Følelsen af at komme frem

- **Regionen får farve efter mestring**, med tre visuelle tilstande pr. etape:
  - Start: pastel og dæmpet, aldrig grå.
  - Bronze: stien lyser, og lanterner tændes.
  - Sølv: blomster, vand og lys kommer tilbage (Minusbækken fyldes med vand).
  - Guld: fuld mætning, og etapens dyr går rundt i landskabet.
- **Tågen letter** over næste etape, når en mesterprøve er bestået (1,2 s dissolve plus lyd).
- Den **næste verdens vartegn** kan altid ses i horisonten, fx enhjørningen på en sky over Engdalen med teksten "Din første guldmedalje".
- Stien tegner sig selv mellem noderne (stroke-dashoffset, 600 ms). Buddyens poteaftryk bliver liggende på stien, og næste node hopper.
- Tælleren "★ 87/135" pr. verden vises i toppen af kortet.

### 1.6 Indplacering og oversprungne dele

Stadier under indplaceringen markeres `skipped`. De kan spilles fuldt ud, og deres ven-noder og kister kan hentes. Det er hurtige sejre og god repetition. Deres prøver tæller som bestået i forhold til portene, men medaljer kommer kun fra bokse.

---

## 2. Kerneloop og turen

### 2.1 Loopet

**Kort → ▶ Spil** (en tap til næste node) **→ tur (2-3 min) → ceremoni (6-12 s) → ▶ Næste** (starter næste node direkte, som V1's "En tur mere") eller **Til kortet**.

Der er **ingen auto-start med nedtælling**.

Ved siden af stien står **Dagens øvelse**: en tur bygget af "due" fakta fra alle åbne skills, altså spaced repetition. Den giver perler og XP, men ikke stjerner.

### 2.2 Bevares uændret fra V1 (brugerens låste valg)

- Åbneren er altid en sikker opgave (`roundBuilder.buildRound`), og fordelingen er cirka 2 sikre, 5 vaklende og 3 nye.
- En fejl indsættes igen 2 pladser senere (`useRound.submit`). **Derfor slutter turen altid på et rigtigt svar.**
- Ved fejl vises strategien (ti-ramme, fra det største tal), og barnet trykker på det rigtige svar.
- Valgopgaver kan højst løfte et faktum til boks 3 (`GUESSABLE_CEILING`). Boks 4-5 kræver fri indtastning.
- Langsomt men rigtigt giver ingen boks-fremgang, men giver stadig perler og XP for indsatsen (se 4.3).
- ✕ pauser og gemmer turen (`pause()`/`resume()`, "a pause is not slowness").
- Guldægget: efter 3 rigtige i træk, én gang pr. tur, aldrig som sidste opgave, altid med mulighed for at springe over. At misse koster intet.

### 2.3 Løftes i V2

**Stjerner pr. tur** (gælder også 8-opgaveture):

| Stjerner | Krav |
|---|---|
| ★1 | Turen er gennemført |
| ★2 | Højst 2 fejl i første forsøg |
| ★3 | Højst 1 fejl og mindst 60 % "flydende" svar (under `fastMsFor`) |

For mesterprøver gælder: bestået = ★1, højst 1 fejl = ★2, 0 fejl = ★3. ★3 er dermed motivationen til at genspille for at blive flydende.

**Kombo er kun "juice"** og giver ingen valuta:

| Rigtige i træk | Hvad sker der |
|---|---|
| 1 | Poteaftryk lyser på stenstien, tonehøjden stiger et pentatonisk trin |
| 3 | Guldægget |
| 5 | Buddyen laver en superdans |
| 10 | Banneret "Perfekt tur!" og fyrværkeri |

Et fanget guldæg giver **+10 varme til rugeægget** (det er jo et æg), plus 2 perler og 10 XP.

**Spændingskurven** er et krav til `roundBuilder`s rækkefølge:

| Position | Indhold |
|---|---|
| 1 | Sikker, valgopgave |
| 2-4 | Opvarmning: sikre og vaklende, mest valgopgaver |
| 5-7 | Toppen: nye fakta og fri indtastning ved boks 3 eller mere |
| 8-10 | Slutspurt: stien gløder, musikken løftes. Position 10 er et faktum med boks ≥ 2 eller et faktum, der allerede er klaret i turen, vist på en anden måde |

Buddyen hopper sten for sten mod turens mål (etapens vartegn), og den sidste sten udløser en lille belønningsanimation.

**Lyspære-hjælp:** Efter 10 sekunder uden input pulserer en lyspære blidt. Den åbner aldrig af sig selv. Et svar efter hjælp tæller som rigtigt for perler, men ikke som første forsøg og uden boks-fremgang.

**Træthedsværn** (i stedet for at foreslå pause): Efter 2 ture i træk med mindst 4 fejl bygges næste tur som 5 sikre, 3 vaklende og 2 nye, kun med valgopgaver og uden at mesterprøven foreslås. Spillet bliver ved med at være rart, uden at det siger "hold pause".

**Informativ feedback efter turen**, altid som første ceremoni:
- "Du blev sikker på 7+5 og 8+4", vist som fakta-kort der vender fra bronze til sølv.
- "Det svære i dag: 13−5. Den øver vi igen."

---

## 3. Dyrene som spillets hjerte

### 3.1 Roster med 16 arter

| Id | Navn | Verden | Babyform | 6 standardfarver (eksempler) | Signaturting ved venskab 7 |
|---|---|---|---|---|---|
| `rabbit` | Kanin | eng | kaninunge | hvid, grå, brun, hollænder, karamel, rosa | gulerods-rygsæk (ryg) |
| `cat` | Kat | eng | killing | rød, sort, grå-stribet, calico, hvid, blå-grå | garnnøgle (hånd) |
| `puppy` | Hvalp | eng | hvalp | golden, sort-hvid, brun, plettet, creme, rødbrun | halsbånd med tegn (hals) |
| `hedgehog` | Pindsvin | eng | pindsvineunge | brun, lys, mørk, rustrød, mandel, frost | æble-hue (hoved) |
| `horse` | Hest | bakke | føl | fuks, skimmel, sort, isabel, broget, palomino | rosette-sløjfe (hals) |
| `lamb` | Lam | bakke | lam | hvid, creme, sort, grå, brun, lyserød-uld | uldhalstørklæde (hals) |
| `fox` | Ræv | bakke | rævehvalp | rød, polar, sølv, brun, guld-rød, mørk | bærkurv (hånd) |
| `hamster` | Hamster | bakke | unge | guld, hvid, grå, sort-hvid, karamel, panda | frøtaske (ryg) |
| `unicorn` | Enhjørning | skov | føl | hvid, rosa, lilla, mint, himmelblå, sølv | regnbuespænde (hoved) |
| `panda` | Panda | skov | unge | klassisk, brun, rød-panda-farve, grå, creme, lilla-pastel | bambusfløjte (hånd) |
| `squirrel` | Egern | skov | unge | rød, grå, sort, brun, lys, orange | agernhjelm (hoved) |
| `owl` | Ugle | skov | ugleunge | brun, sne, grå, perlehvid, kanel, nat | læsebriller (ansigt) |
| `pegasus` | Pegasus | fjeld | føl | hvid, sky, rosa, lavendel, sølv, perle | skysadel (ryg) |
| `dragon` | Drage | fjeld | drageunge | grøn, rød, blå, lilla, sort, turkis | flammekrone (hoved) |
| `penguin` | Pingvin | fjeld | kylling | klassisk, kejser, klippe, blå, grå, creme | is-sløjfe (hals) |
| `polarbear` | Isbjørn | fjeld | unge | hvid, creme, is-blå, sølv, sne, perle | sneboldkaster (hånd) |

Signaturtingen kan bæres af alle arter, når den først er låst op.

**Starter-valg ved onboarding:** kanin, kat, hvalp eller hest (føl). Hvis barnet senere møder en art, det allerede har, på en ven-node, giver noden en ny farve i stedet.

### 3.2 Sådan får barnet dyr

1. **Ven-noder**: 16 i alt, faste og kendte på forhånd. De låser arten op til æg.
2. **Rugeægget**: Der ligger ét æg ad gangen. Barnet vælger selv arten blandt de oplåste. Varme = rigtige svar (1 pr. svar, +10 pr. fanget guldæg). Æggenes pris i rigtige svar:

   | Æg nr. | 1 | 2 | 3 | 4-9 | 10+ |
   |---|---|---|---|---|---|
   | Rigtige svar | 15 | 40 | 60 | 90 | 120 |

   Farven er en af artens standardfarver, som barnet ikke har endnu, valgt med en seedet RNG. Det er den eneste overraskelse, og alle farver er lige meget værd; der er ingen rarity-stige. Har arten alle 6 farver, bliver den grå i vælgeren ("Alle farver fundet!"). Har alle oplåste arter alle farver, bliver varmen til +50 venskab til buddyen.
3. **Mestringsdyr** (deterministiske, med kravet skrevet i Samlebogen):
   - **Første guldmedalje nogensinde**: *Stjernefølet*, en enhjørning i farven "stjernehvid". Det er det store tidlige mål, som kortet teaser fra dag 1. Det låser ikke enhjørning-æg op; dem får man i Regnbueskoven.
   - **Hver guldmedalje derefter**: barnet vælger ét gyldent dyr blandt de 4 arter i medaljens verden. Når alle 4 er gyldne, giver en guldmedalje i stedet 10 perler.
   - **★★★ på alle noder i en etape**: barnet vælger ét **regnbue**-dyr fra verdenen (højst 4 pr. verden).

### 3.3 Opgradering: venskab og vækst

Venskabs-XP = rigtige svar, mens dyret er buddy (+3 pr. mestringsgnist). Barnet kan skifte buddy når som helst uden at miste noget.

| Niveau | Rigtige svar (kumuleret) | Belønning |
|---|---|---|
| 2 | 20 | Trick 1 (hop/dans ved tap) |
| 3 | 50 | Eget jubel i turen |
| 4 | 100 | Trick 2 |
| **5** | 170 | **Vokser: Baby → Ung** (ceremoni) |
| 6 | 260 | Artens eget kald |
| 7 | 370 | Artens signaturting |
| **8** | 500 | **Vokser: Ung → Stor** |
| 9 | 650 | Trick 3 (enhjørningen laver en regnbue, dragen blæser røgringe) |
| **10** | 820 | **Stjerneform**: aura, glitterpels og hjertet "Bedste ven" |

Med én fast buddy nås niveau 5 efter cirka 4 sessioner, niveau 8 efter 2,5 uger og niveau 10 efter cirka 4 uger.

**Barnet vælger selv hvilken form dyret vises i** (baby, ung, stor eller stjerne). Mindre børn vil ofte beholde babyen, ældre vil have den store.

### 3.4 Hvad dyrene gør

- **I turen:** Buddyen sidder ved opgaven.
  - Øjnene følger barnets finger (pointer-tracking). Det er den vigtigste AAA-detalje.
  - Ved rigtigt svar jubler den med 3 varianter på skift. Ved fejl tænker den ("hmm, lad os se") og peger på ti-rammen. Ved kombo 5 danser den.
  - Når den er i tomgang, trækker den vejret, blinker hvert 3.-6. sekund (seedet), vipper med ørerne og logrer med halen.
- **Dyrehaven** (`DyrehavenScreen`):
  - 4 zoner, der låses op ved ankomst til hver verden og bliver fuldt farvede efter verdensfesten.
  - Højst 12 dyr og 16 pynt-genstande pr. zone. Barnet trækker dyr og pynt rundt.
  - Dyrene har små scener indbyrdes, som barnet selv opdager (to dyr tæt på hinanden laver high-five, sover eller leger fangeleg).
- **Aldrig skyldfølelse:** Dyrene bliver aldrig sultne, syge, triste eller ensomme af fravær, og der er ingen pleje-mekanik.
- **Navngivning:** 6 forslag fra en forindspillet liste med 120 danske dyrenavne, sorteret pr. art og uden varemærker (fx ikke "Findus"), samt fri tekst på højst 14 tegn, som læses op med `speechSynthesis`. Barnet kan omdøbe når som helst.
- **Foto:** "Tag billede" gemmes som data (dyr, outfit, form, baggrund, positur) og tegnes igen ved visning. Højst 60 fotos pr. profil i et fotoalbum i appen.

---

## 4. Garderobe og belønninger

### 4.1 Slots og lagrækkefølge

De 6 slots er `head`, `face`, `neck`, `body`, `back` og `hand`. De svarer til de 6 ankre i den fælles siddende chibi-rig. Jeg bekræfter startantagelsen om én fælles positur.

Lag tegnes bagfra og frem:

`back` (kappe og vinger bag kroppen) → hale → krop → `body` → `neck` → hoved → `face` → `head` → ører/horn foran → `hand`

Hver art har en `earStyle`: `tall`, `pointy`, `round` eller `none`. Høje ører og horn tegnes *gennem* hatten via en maske pr. hat.

**Acceptkrav:** Et kontaktark med 16 arter × alle `head`-genstande har ingen fejlagtige overlap.

### 4.2 De 90 genstande og hvor de kommer fra

Hver genstand har præcis én kilde, og kilden vises altid som "Sådan får du den".

| Kilde | Antal | Indhold |
|---|---|---|
| Spillerniveau | 14 | Hverdag-sættet (6) på niveau 2, 3, 4, 6, 7 og 8. Milepæle (8): 5 hjertebriller (face), 10 regnbuehue (head), 15 superheltekappe (back), 20 medaljehalskæde (neck), 25 glimmerbluse (body), 30 kæmpeslikkepind (hand), 40 fe-vinger (back), 50 Legendekronen (head) |
| Kister på stien | 24 | 4 verdenssæt × 6: Opdager (eng), Rytter (bakke), Kongelig (skov), Astronaut (fjeld). Etape 2, 4, 6 og 8 giver `head`, `face`, `neck` og `hand`; finalen giver `body` og `back` |
| Mestringsmedaljer | 12 | **Ridder-sættet** (sølv): efter 2, 5, 9, 14, 20 og 27 sølvmedaljer. **Talmagiker-sættet** (guld): efter 1, 3, 6, 10, 15 og 21 guldmedaljer |
| Perlebutikken | 24 | Pirat, Fodbold, Vinter og Fest, hver med 6 genstande |
| Venskab | 16 | En signaturting pr. art ved venskab 7 |

**Samlesæt-bonus:** Et komplet sæt giver en trofæ-pokal og et sæt-emote, fx at piraten kigger i kikkert. Ingen perler.

### 4.3 Økonomi i `src/content/economy.ts`

**Perler.** Kun optjent, kan aldrig købes eller veksles, og ligner glasperler og aldrig mønter, så de ikke forveksles med kroner i Købmandsgården.

| Hændelse | Perler | XP |
|---|---|---|
| Rigtigt svar (alle, også gensvar) | 1 | 10 |
| Ny stjerne på en node (kun første gang pr. niveau) | ★1: 1, ★2: 1, ★3: 2 | 20 pr. stjerne |
| Mestringsgnist: faktum når boks 3 | 1 | 25 |
| Mestringsgnist: faktum når boks 5 | 2 | 50 |
| Guldæg fanget | 2 | 10 |
| Mesterprøve bestået (første gang) | 10 | 100 |
| Verdensfest bestået | 25 | 250 |
| Dagsmål (hvert) / alle tre | 3 / +3 | 30 / 0 |
| Level-up | 5 | – |
| Medalje bronze / sølv / guld | 3 / 5 / 10 | 50 / 100 / 200 |
| Præstation (trofæ) | 5, 10 eller 15 | – |

**Priser**, faste og altid tilgængelige, uden rotation eller udsalg:

| Hvad | Pris |
|---|---|
| `face` / `neck` | 80 |
| `head` / `hand` | 120 |
| `body` / `back` | 180 |
| Et helt butikssæt | 760 (4 sæt i alt = 3.040) |
| Omfarvning (hver genstand har 2 ekstra farver, låses op når genstanden ejes) | 25 pr. farve, i alt 4.500 |
| Dyrehave-pynt (32 genstande, 8 pr. zone) | 40, 80 eller 150, i alt cirka 2.800 |

Samlet kan der bruges cirka 10.300 perler. Det holder i cirka 6 måneder for et barn, der spiller 5 gange om ugen.

**Ønsket:** Barnet sætter en nål i én genstand. HUD'en viser "Pirathatten 87/120" med en bjælke, så små børn ikke behøver læse tallet.

**XP-kurve for niveau 1-50** (`XP_TO_NEXT`):

| Niveau | XP til næste niveau | XP i alt ved slutningen af båndet |
|---|---|---|
| 1-4 | 150, 250, 300, 450 | niveau 5 = 1.150 |
| 5-9 | 500 hver | niveau 10 = 3.650 |
| 10-19 | 1.000 hver | niveau 20 = 13.650 |
| 20-29 | 2.800 hver | niveau 30 = 41.650 |
| 30-49 | 6.400 hver | niveau 50 = 169.650 |

**Titler:**

| Niveau | 1 | 5 | 10 | 15 | 20 | 30 | 40 | 50 |
|---|---|---|---|---|---|---|---|---|
| Titel | Nybegynder | Opdager | Eventyrer | Talspejder | Regnemester | Talmagiker | Stjerneregner | Talvenne-legende |

### 4.4 Forventet belønningsrytme

Modellen forudsætter en session på 12 min med 5 ture (session 1: 5 min onboarding og 3 ture), 85 % rigtige i første forsøg og at barnet består cirka 70 % af mesterprøverne i første forsøg.

| Session | Ture (i alt) | XP (i alt) | Niveau | Perler optjent (i alt) | Dyr (i alt) | Tøj (i alt, inkl. køb) | Hændelser pr. min |
|---|---|---|---|---|---|---|---|
| 1 | 3 | 720 | 4 | 83 → første køb (80) er muligt | 3 (starter, æg 1, kanin-ven) | 4 | ~0,8 |
| 2 | 8 | 1.860 | 6 | 200 | 4 | 8 (kiste 1) | ~0,65 |
| 3 | 13 | 3.000 | 8 | 312 | 5 | 11 | ~0,6 |
| 4 | 18 | 4.100 | 10 | 427 | 6 (kat-ven), buddy vokser til Ung | 13 | ~0,45 |
| 5 | 23 | 5.200 | 11 | 530 | 7 | 15 (kiste 2) | ~0,4 |
| 6 | 28 | 6.250 | 12 | 630 | 7 | 16 | ~0,33 |
| 7 | 33 | 7.300 | 13 | 730 | 9 (hvalp-ven) | 18 (første Ridder-stykke) | ~0,35 |
| 8 | 38 | 8.300 | 14 | 830 | 9 | 20 (kiste 3) | ~0,33 |
| 9 | 43 | 9.300 | 15 | 930 | 10 | 23 (signaturting ved venskab 7) | ~0,33 |
| 10 | 48 | 10.300 | 16 | 1.030 | 11 | 24 | ~0,3 |
| Måned 1 (≈20 sessioner) | ~98 | ~19.800 | 22 | ~1.930 | ~17-18 (Stjernefølet ved første guld, cirka uge 2-4) | ~32 | ~0,25 |

- **Pr. minut i session 1-3:** cirka 8 perler og 90 XP, og noget nyt cirka hvert 1,5 minut.
- **Pr. minut efter en måned:** cirka 7 perler og 75 XP, noget nyt cirka hvert 4. minut og **mindst én stor ceremoni pr. session** (klækning, vækst, kiste, medalje, milepæl eller køb til 180).

### 4.5 Sådan undgår vi "klik for præmier"

- Alt optjenes kun ved at svare på regnestykker. Der er ingen login-bonus, ingen tomgangsbelønning og ingen tap-for-præmie.
- Stjernebonus gives kun første gang. At genspille en ★★★-node giver højst 1 perle pr. svar, og `roundBuilder` henter alligevel barnets svage og due fakta ind.
- ★3, sølv og guld kræver flydende svar og fri indtastning. Boks 5 kræver **et hurtigt, frit, rigtigt svar på en senere kalenderdag end den, hvor faktummet nåede boks 4.** Det er vagten mod at farme sig til mestring på én dag med ubegrænset spil.
- Et barn, der har det svært (50 % rigtige i første forsøg), får mindst 70 % af de perler pr. tur, som et barn med 85 % får. Indsats beskyttes.
- Ceremonierne viser altid læringen først ("Du blev sikker på …") og tingene bagefter.

---

## 5. Fastholdelse inden for "så længe barnet vil"

1. **Dagens tre små mål** (`src/content/dailyGoals.ts`, seedet af `profileId:date`):
   - Mål 1 er altid "Klar Dagens øvelse".
   - Mål 2 er "Klar 1 tur i {svageste domæne}".
   - Mål 3 roterer mellem "5 rigtige i træk", "Skriv 10 svar selv" og "Få ★★★ på en tur".
   - Kravene skaleres ned i 0. klasse. Der vises aldrig nedtælling, og uklarede mål forsvinder stille ved midnat. **Når alle tre er klaret, laver spillet ikke nye mål**, men almindelig spil belønnes som før.
2. **Stempelkortet** (kalender): Hver spillet dag får buddyens poteaftryk, og dage med alle tre mål får et gyldent poteaftryk. Tælleren "Dage spillet i alt" nulstilles aldrig. Trofæer ved 3, 7, 14, 30, 50, 100 og 200 dage (behøver ikke være i træk). **Ingen streak vises nogen steder.**
3. **Samlebogen:** Pr. art 6 farver, guld, regnbue, stjerneform og vækstformer. Ikke-fundne vises som silhuetter med kravet oplæst. Der er også en side pr. tøjsæt.
4. **Kan-bogen:** En side pr. skill med en "Jeg kan …"-sætning, der læses op, fx `addTo20`: "Jeg kan lægge sammen over tieren". Medaljen står ved siden af. Det er barnets egen fremgang, adskilt fra spillets.
5. **Trofærummet:** 40 præstationer i fem kategorier (Læring, Rejse, Venner, Stil, Flid), herunder 6 hemmelige, fx `dress_dragon_chef`. Eksempler: `first_gold`, `facts_mastered_100`, `world_eng_complete`, `animals_25`, `friend_star_form`, `set_complete_pirate`, `days_30`, `turer_500`.
6. **"Næste belønning"** er altid synlig: HUD'en viser tre chips med XP-ring, æggets varme (x/y) og ønsket (perler x/y).
7. **Overraskelser uden tidspres:**
   - Æggets farve.
   - Nye scener mellem dyrene i Dyrehaven.
   - Hemmelige trofæer.
   - Buddyen fortæller små fakta ("3 heste har 12 ben").
   - Sæsonkulisser (jul, fastelavn, påske, sommer): kun pynt i landskabet, **ingen sæsoneksklusive ting**.
8. **Forbudt** (tjekliste ved test):
   - Nedtælling til auto-start.
   - "Er du sikker? Din ven bliver ked af det."
   - Push-notifikationer.
   - Tidsbegrænsede tilbud.
   - Tilfældige præmier med rarity-niveauer.
   - Ranglister.
   - Sammenligning mellem søskende.
   - Rigtige penge.
   - Reklamer.

---

## 6. Profiler (op til 6 børn)

- **`ProfilePickerScreen`** vises, når der er mindst 2 profiler.
  - Kortene står i et gitter på 2 × 3. Hvert kort viser barnets buddy i dens outfit, så barnet kan genkende sit eget uden at læse. Et tap læser navnet op.
  - "+ Ny spiller" og "Slet" ligger bag forældre-gaten. Den første profil oprettes uden gate.
- **Første opstart:** `ParentIntroScreen` med 3 kort:
  - "Føj til hjemmeskærm", som er afgørende for at data bliver liggende.
  - "Alt bliver på enheden".
  - "Alle belønninger optjenes ved at regne, intet kan købes".
- **Onboarding pr. barn, cirka 5 minutter:**

  | Tid | Skridt |
  |---|---|
  | 0:00 | "Hvad hedder du?" (valgfrit, ellers "Spiller 2") |
  | 0:30 | Vælg den første ven: 4 unger kigger ud af æg (kanin, kat, hvalp, føl), et tap siger navnet, og valget udløser **klækning inden for 60 sekunder** |
  | 1:15 | Navngiv vennen |
  | 1:45 | "Hvilken klasse går du i?" med 4 store knapper (0.-3.) |
  | 2:00 | **Opdagelsesturen** (indplacering, se nedenfor) |
  | 3:45 | Kortet zoomer ind på startnoden, og tidligere noder bliver `skipped` |
  | 4:00 | Første rigtige tur |
  | ~6:30 | Tur-slut med stjerner og **niveau 2 med Hverdag-huen**, efterfulgt af guidet påklædning, hvor buddyen tager huen på |

  **Om opdagelsesturen:** Buddyen flyver hen over kortet. Stigen har 16 checkpoints, 4 pr. verden. Barnet starter én verden under sit klassetrin (0. klasse starter ved checkpoint 1) og får 2 opgaver med fri indtastning pr. checkpoint:
  - 2 rigtige: hop 2 checkpoints frem.
  - 1 rigtig: hop 1 frem.
  - 0 rigtige: stop.

  Turen har højst 14 opgaver, og barnet kan højst placeres én verden over sit klassetrin. Der vises ingen strategi ved fejl, kun "Den øver vi senere". Fakta under startstedet sættes til boks 2, aldrig højere, fordi mestring skal bevises.
- **Deling på tværs:**
  - **På enheden (delt):** lydpakke-cache, musik og effekter til/fra, forældre-gate, eksport/import af alt.
  - **Pr. profil:** navn, dyr, garderobe, pynt, perler, XP, kort og stjerner, fakta-bokse, svarlog, dagsmål, kalender, trofæer, klassetrin, auto-oplæsning, rolig animation og fravalg af domæner.
  - **Intet på tværs af profiler:** ingen besøg, gaver eller sammenligning.
- **Lagring:**
  - IndexedDB-databasen `talvennerne2` med stores `profiles`, `answers` og `dailyAgg`.
  - localStorage-nøglen `talvennerne2.index` med profil-id'er og den seneste aktive profil, så appen starter hurtigt.
  - `navigator.storage.persist()` kaldes ved oprettelse.
  - V1's `talvennerne.save` røres aldrig.

---

## 7. AAA-følelse

### 7.1 Overgange

Alle overgange bygger på fjeder-animationer. Der er ingen hårde klip.

- **Kort → tur:** Kameraet zoomer ind på noden, og en iris-wipe i buddyens silhuet kører på 300 ms. Baggrundens parallakse glider ind på 400 ms.
- **Tur → slut:** Opgavepladen glider ned, stjernerne flyver ind én ad gangen (350 ms hver, tonerne C-E-G), perlerne tælles op med tik-lyd, og XP-bjælken fyldes og kan flyde over i et level-up.
- **Tilbage til kortet:** Stien tegner sig til næste node, og tåge-dissolve kører, hvis en prøve er bestået.

### 7.2 Ceremonier

Alle kan springes over med et tap, og ingen blokerer input i mere end 1 sekund.

| Ceremoni | Varighed | Indhold |
|---|---|---|
| Level-up | 2,5 s | Skærmen dæmpes, et badge vender i 3D (rotateY), lysstråler roterer bag det, konfetti i verdens palette, 4-toners fanfare, belønningen springer ud af badget, buddyen hopper |
| Klækning | ~5 s, interaktiv | 3 tap som i V1 med revner der vokser, så et hvidt lysglimt på 120 ms, skalhalvdelene flyver ud, dyret squash-and-stretch'er ind (0,3 → 1,15 → 0,95 → 1 over 500 ms), en ring af gnister, artens kald og navnet |
| Ny ting | 1,5 s + "Prøv den" | Kisten ryster, låget åbner med en lysstråle, tingen svæver og drejer med et skinnende sweep; "Prøv den" sender den ad en bezier-bane (450 ms) ind på buddyen, som kigger sig i et spejl |
| Mesterprøve | – | Portvagten (en stor venlig ugle) venter. Hver planke falder på plads med et træ-dunk og 2 px kamerarystelse. Bestået: buddyen løber over broen, et bro-bånd vises, og tågen letter |
| Medalje | 2 s | En mønt vender med metallisk skær; guld har tungere lyd |
| Vækst | 3 s | Dyret lyser op, silhuetten morpher til den nye form, og dyret laver sit nye trick |

**Kø-regel** (`src/meta/ceremonyQueue.ts`):
- Rækkefølgen er: læringsgnister → stjerner → perler/XP → prøve/tåge → medalje → level-up → vækst → ting → **klækning altid til sidst** (den er interaktiv og er klimaks).
- Højst 3 ceremonier i fuld skærm pr. tur-slut. Resten lægges i en bunke gavekort med overskriften "Også i dag".
- Uden klækning varer tur-slut højst 6 s, med klækning højst 12 s.

### 7.3 Musik

Musikken er adaptiv. Hver verden har et tema med 3 stemmer (bund, rytme, melodi):

| Verden | Stil | Tempo og toneart |
|---|---|---|
| Engdalen | Plukket folk-pop med glockenspiel | 96 BPM, F-dur |
| Hestebakkerne | Shuffle-trav | 104 BPM, G-dur |
| Regnbueskoven | Celesta og harpe | 88 BPM, Es-dur |
| Stjernefjeldet | Pizzicato og kor-pad | 100 BPM, D-dur |

- På kortet spilles kun bund og melodi, roligt.
- I turen lægges stemmerne på med kombo: 0 = bund, 3 = + rytme, 5 = + melodi.
- Musikken dæmpes 10 dB, mens oplæsningen taler.
- 6 ceremoni-jingler transponeres til verdens toneart.

### 7.4 Lydeffekter

Cirka 40 lyde:
- Tap.
- Rigtigt svar (tonehøjde pr. kombo).
- Forkert svar: et blødt "hmm", aldrig en buzzer.
- Stjerne 1/2/3, perle-tik, æg-knæk 1/2/3, klækning, kiste, påklædning, level-up.
- Medalje ×3, planke, tåge, bladring.
- 16 dyrekald.

### 7.5 Haptik (kun Android; iOS Safari har intet Vibration API)

| Hændelse | Mønster |
|---|---|
| Tap | 8 ms |
| Rigtigt svar | 15 ms |
| Forkert svar | ingen |
| Stjerne | [20, 60, 20] |
| Level-up | [30, 50, 30, 50, 60] |
| Klækning | [40, 30, 80] |

`src/fx/haptics.ts` fra V1 genbruges.

### 7.6 Forskellen fra et skoleark med konfetti

1. Matematikken bor i verdenen: gulerødder tælles på engen, uret sidder i tårnet, mønterne ligger hos købmanden. Opgaverne står ikke på et hvidt kort.
2. Buddyen er en karakter med blik, reaktioner og vækst.
3. Meta-progressionen kan ses på hver skærm.
4. Varm forindspillet dansk stemme og en fortæller.
5. Én rig, én palette og farvede konturer giver én visuel identitet.
6. Navigation med ikoner og tale: dock'en har 5 ikoner (Kort, Dyr, Garderobe, Butik, Bøger), og hvert tap læser navnet op.
7. Verdenen bliver synligt smukkere, jo mere barnet lærer.

**Ydelse:**
- 60 fps på iPhone 11.
- Tur starter under 300 ms efter tap.
- Første visning under 1,5 s.
- `prefers-reduced-motion` og den rolige tilstand fjerner rystelser og 3D-vendinger.

---

## 8. Datamodel og filer i V2

```ts
// src/meta/types.ts
type WorldId = 'eng' | 'bakke' | 'skov' | 'fjeld'
type NodeKind = 'lesson' | 'friend' | 'chest' | 'mix' | 'trial' | 'finale'
type Slot = 'head' | 'face' | 'neck' | 'body' | 'back' | 'hand'
type ItemSource =
  | { kind: 'level'; level: number } | { kind: 'chest'; nodeId: string }
  | { kind: 'medal'; tier: 'silver' | 'gold'; count: number }
  | { kind: 'shop'; price: 80 | 120 | 180 } | { kind: 'friendship'; speciesId: SpeciesId }
interface NodeProgress { stars: 0|1|2|3; plays: number; state: 'locked'|'open'|'skipped'|'done'; trialAttempts?: number; bestPlanks?: number }
interface Animal { uid: string; speciesId: SpeciesId; colorway: `c${1|2|3|4|5|6}` | 'gold' | 'rainbow' | 'starwhite'
  name: string; friendship: number; form: 'baby'|'young'|'grown'|'star'; outfit: Partial<Record<Slot, { itemId: string; color: 0|1|2 }>>
  zone: WorldId; x: number; y: number; foundAt: number }
type MetaEvent = { kind: 'mastery'; factIds: string[]; box: 3|5 } | { kind: 'stars'; nodeId: string; stars: number }
  | { kind: 'currency'; perler: number; xp: number } | { kind: 'levelUp'; level: number; itemIds: string[] }
  | { kind: 'hatch'; animal: Animal } | { kind: 'item'; itemId: string } | { kind: 'medal'; skill: SkillId; tier: 'bronze'|'silver'|'gold' }
  | { kind: 'growth'; uid: string; level: number } | { kind: 'trialPassed'; nodeId: string } | { kind: 'achievement'; id: string }
// src/meta/progression.ts — ren og deterministisk, uden React og uden Math.random:
export function applyTurResult(p: Profile, r: TurResult, date: string): { profile: Profile; events: MetaEvent[] }
```

**Nye filer:**
- `src/content/worlds.ts`: 4 verdener, 32 etaper, cirka 196 noder.
- `src/content/species.ts`: 16 arter, farver og regler for sjældne dyr.
- `src/content/wardrobe.ts`: 90 genstande.
- `src/content/decor.ts`: 32 pynt-genstande.
- `src/content/economy.ts`: alle konstanter fra afsnit 4.3.
- `src/content/achievements.ts`: 40 præstationer.
- `src/content/dailyGoals.ts`.
- `src/meta/progression.ts`.
- `src/meta/ceremonyQueue.ts`.
- `src/meta/placement.ts`.
- **Skærme:** `ProfilePickerScreen`, `ParentIntroScreen`, `OnboardingScreen`, `MapScreen` + `NodeSheet`, `RoundScreen` (+ `TrialStage`), `TurEndScreen`, `HatchOverlay`, `LevelUpOverlay`, `MedalOverlay`, `GrowthOverlay`, `ChestScreen`, `DyrehavenScreen`, `AnimalScreen`, `WardrobeScreen`, `ShopScreen`, `BooksScreen` (faner: Samlebog, Kan-bog, Trofæer, Kalender), `ParentScreen`.

**Fra V1:** `engine/mastery.ts`, `roundBuilder.ts`, `useRound.ts` og æg-knæk-flowet i `RewardScreen.tsx` genbruges, men udvides.

**Det spildesignet kræver af forældre-dashboardet:**
- Pr. barn: minutter og ture pr. dag. Vises rent faktuelt; det er gennemsigtigheden, når der ingen grænse er.
- Medaljer pr. domæne.
- "Arbejder med nu".
- Mesterprøver, også de åbne.
- Belønningslog, så forældre kan se at alt er optjent ved at regne.

---

## 9. Acceptkriterier

**`economy.sim.test.ts`** simulerer et barn med 85 % rigtige og et med 50 % rigtige, 5 ture pr. session og 70 % beståede prøver:
1. Session 1 indeholder: starter-dyr, mindst 1 klækning, mindst 2 ting, niveau 3 eller højere, og perler ≥ 80.
2. Session 1-10 har hver mindst 3 belønningshændelser og mindst 1 stor ceremoni.
3. Session 11-40 har mindst 1 stor ceremoni hver, og der går aldrig mere end 4 ture uden en belønningshændelse.
4. Niveau 10 nås i session 4-6, niveau 20 i session 17-23, og niveau 50 ikke før session 200.
5. Butik, omfarvning og pynt kan ikke tømmes før session 100.
6. Barnet med 50 % får mindst 70 % af perlerne pr. tur, som barnet med 85 % får.
7. 20 genspil af en ★★★-node giver højst 12 perler pr. tur.

**`progression.test.ts`:**
- Boks 5 kræver en senere kalenderdag.
- Højst én åben mesterprøve ad gangen.
- Hjælpebroen åbner efter præcis 3 forsøg.
- Første guldmedalje giver `starwhite`-enhjørningen.
- Æg giver aldrig en farve, barnet allerede har.
- Resultatet er deterministisk med samme seed.

**`content.test.ts`:**
- Alle 90 genstande har præcis én kilde, og hvert sæt dækker alle 6 slots.
- Alle 16 arter har 6 farver og en signaturting.
- Hver etape følger node-skabelonen, og alle skill-id'er findes i motoren.

**Playwright-gennemspilning (`scripts/playthrough.mjs`, udvidet):**
- Onboarding → klækning inden for 60 s efter valg af første ven.
- Første tur → niveau 2 → huen tages på.
- ✕ midt i en tur → genoptag.
- To profiler holdes adskilt efter genindlæsning.

**Kontaktark til visuel kritik:**
- 16 arter × 4 former.
- 16 arter × hvert slot.
- Alle ceremonier som filmstrip.

**Tjekliste for mørke designmønstre** (manuel, fra afsnit 5.8): alle punkter er fraværende.

---

## 10. Risici (én sætning hver)

- **Ubegrænset spilletid** trækker mod ICO std. 5 og DSA art. 28. Designet holder sig inden for rammerne ved at have nul kunstige forlængelses-løkker (ingen ekstra mål efter dagens tre, ingen auto-start) og ved at vise den faktiske spilletid for forældre, men det bliver aldrig et fuldt compliant stop-design.
- **Perler er en virtuel valuta.** DSA-retningslinjerne sigter mod valuta, der kan købes eller veksles; vores er kun optjent, men det skal stå tydeligt i forældreintroen.
- **Krav om hastighed til ★3, sølv og guld** kan frustrere langsomme, grundige børn. Det dæmpes, men fjernes ikke, af at indsats altid giver perler, æg-varme og venskab.
- **iOS Safari sletter scriptdata efter 7 dages brug uden besøg**, når appen ikke er føjet til hjemmeskærmen. Det kan fjerne et barns samling, så hjemmeskærm-kortet i introen og eksport-backup er kritiske.
- **Produktionsvolumen er den største leverancerisiko:** 16 arter × 4 former, 90 genstande med maske-pasform og 32 pynt-genstande. Den fælles rig og det automatiske loop med kontaktark og kritik er nødvendige.
- **Indplaceringen kan ramme skævt.** Derfor sættes fakta højst til boks 2, prøverne fanger en for høj placering, og forældre kan flytte startpunktet.
- **Kawaii-stilen kan virke barnlig for 8-9-årige.** Det dæmpes med de store former, drage/pegasus/ræv, Ridder-, Astronaut- og Fodbold-sættene samt titlerne.

---

### Vigtigste filer for implementeringen
- `/home/user/Test/src/state/useRound.ts`: tur-tilstandsmaskinen (gensvar, guldæg, pause) forlænges med stjerner, kombo, planker og `TurResult`.
- `/home/user/Test/src/engine/roundBuilder.ts`: spændingskurven, 20 % blanding, mix og daglig øvelse, træthedsværn.
- `/home/user/Test/src/engine/mastery.ts`: Leitner-grænsen og det nye krav om en senere dag for boks 5.
- `/home/user/Test/src/ui/screens/RewardScreen.tsx`: æg-knæk-flowet, der bliver `HatchOverlay` og en del af `ceremonyQueue`.
- `/home/user/Test/src/state/storage.ts`: det versionerede skema og `migrate()`-mønsteret, der bliver til IndexedDB `talvennerne2` pr. profil.

Nye filer i V2: `src/meta/progression.ts` og `src/content/economy.ts` (ren, deterministisk meta-logik og alle tal fra afsnit 4.3).
