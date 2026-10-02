# Kunst-review, bølge 2 runde 1 (G2 · r1): lam, ræv, hamster, panda, egern og ugle samt Rytter og Kongelig

- **Reviewer:** REV5. Jeg er frisk og uafhængig: jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i tidligere runder. Jeg har ikke læst kunstens kildekode og heller ikke `lint.json`. Fra kørselsloggen ved jeg kun, at alle 52 sider gav "ok".
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §6, §7 og §11 og `docs/reviews/art-g1-r4.md`.
  - Ark genereret i `/home/user/wt/rev5/talvennerne2/artifacts/sheets/` 2. okt. 2026 kl. 20:21–20:29 UTC fra b4a343c (port 4342, Chromium bag `flock`).
  - **Genereret:**
    - `species`, `closeup`, `moods` og `filmstrip` for de seks nye arter,
    - `sizes` og `fit` for alle 12 arter,
    - `silhouettes`, `lineup`, `fitmatrix` og `holes`.
  - **Ikke genereret:** `scene` og de godkendte arters øvrige ark. De indgår ikke i denne gate.
  - **Metode:** Alle ark er set i helhed og derefter i udsnit med 1,5–4× zoom. Huller er fundet maskinelt i `holes.png` som lukkede magenta-områder inden for figurerne. Tykkelsen er omregnet med 0,64 px pr. enhed.
- **Blindtest:**
  - `art-g2-r1-blind.md` blev committet (335875a), før noget andet blev åbnet.
  - Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket (SHA-256 `c64c8b08…11fd` for begge).
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1). Koordinatsystemet står i bilag A.
- **Iteration:** 1 af højst 4 for de nye arter og sæt.
- **Skalaen** er brugt som i r4:
  - 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
  - Et 5-tal kræver, at rubrikkens 5-beskrivelse er opfyldt i alle farver og stadier, jeg har set.

## Resultat

| Art | Middel | Laveste score | Afgørelse |
|---|---|---|---|
| Lam | **4,5** | 4 (fem kriterier) | **Bestået** |
| Ræv | **4,4** | 4 (seks kriterier) | **Bestået** |
| Hamster | **4,4** | 4 (seks kriterier) | **Bestået** |
| Panda | **4,4** | 4 (seks kriterier) | **Bestået** |
| Egern | **4,4** | 4 (seks kriterier) | **Bestået** |
| Ugle | **4,3** | **3** (butikskort) | **Ikke bestået.** Rygkortene viser ingen genstand (B11). |

| Sæt | Pasform | Butikskort | Afgørelse |
|---|---|---|---|
| Rytter | 4 | 4 | **Bestået** med forbehold: sadeltasken læses som en planke (T12 og B9). |
| Kongelig | 4 | 4 | **Bestået** med forbehold: monoklens farvede glas (T13) og kortet med monoklen alene (B10). |

- **Blindtesten:**
  - Alle 60 svar er rigtige på artsniveau, og alle racer og stadier er ramt. Det er tjekket mod racerne i SPEC §6.1 og figurerne i `lineup.png` og arts-arkene: hver af de 20 former svarer til én art og race. Silhuetterne er ikke pixel-matchet enkeltvis.
  - De 18 nye silhuetter var alle "sikre".
  - Kravet i rubrikkens accept-afsnit er opfyldt.
- **Det gennemgående fund** er lommer mellem løftet pote eller vinge og kind eller krop i "vinker", "jubel", "tænker", "ups" og "sover". De viser baggrunden igennem, og det rammer alle seks nye arter (se kontur). Fejlen er af samme type som R1 hos kaninen i r4, og huller-lint'en fanger den ikke.

## 1. Scores

| # | Kriterium | Lam | Ræv | Hamster | Panda | Egern | Ugle |
|---|---|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 5 | 5 | 5 | 5 |
| 2 | Silhuet | 5 | 5 | 5 | 5 | 5 | 5 |
| 3 | Proportioner | 5 | 5 | 5 | 5 | 5 | 5 |
| 4 | Kontur | 4 | 4 | 4 | 4 | 4 | 4 |
| 5 | Palet | 5 | 4 | 4 | 4 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 | 5 | 5 |
| 7 | Pasform | 4 | 4 | 4 | 4 | 4 | 4 |
| 8 | Animation | 4 | 4 | 4 | 4 | 4 | 4 |
| 9 | Butikskort ved 64 px | 4 | 4 | 4 | 4 | 4 | **3** |
| 10 | AAA-finish | 4 | 4 | 4 | 4 | 4 | 4 |
| | **Middel** | **4,5** | **4,4** | **4,4** | **4,4** | **4,4** | **4,3** |

### Begrundelser

**1. Genkendelighed ved 48 px** (`sizes-<art>.png`, rækken "48 px", y ≈ 268–402)
- **Alle seks 5:**
  - Hvert kort læses straks som den rigtige art i alle otte farver.
  - "Glad" og "sover" (kort 9–10) kan skelnes.
  - LOD-konturen er tyk og ren.
  - Kendetegnene står ved 48 px: lammets vandrette ører og uld, rævens høje ører og kindtotter, hamsterens kindposer, pandaens øjenpletter og bambus, egernets ørtotter og S-hale og uglens fjerører og ansigtsskive.
- **Forbehold (palet, ikke genkendelighed):**
  - Hamster c6 "panda" (`sizes-hamster.png` kort 6 (844–972, 268–402)) ligner en lille panda.
  - Uglens c2 og c4 (kort 2 og 4) er næsten ens ved 48 px.

**2. Silhuet** (`silhouettes.png` og blindtesten)
- **Alle seks 5:** 18/18 sikre i blindtesten, og hver art har én entydig form i alle tre stadier:
  - lam #27, #1 og #38,
  - ræv #46, #45 og #55,
  - hamster #51, #53 og #56,
  - panda #58, #54 og #33,
  - egern #40, #36 og #35,
  - ugle #16, #59 og #22.
- **Forbehold om samspil med senere arter:**
  - Pandaens hoved alene (runde ører) er en generisk bjørn. Det er bambussen, der bærer arten. Den bliver i poten ved alle håndgenstande, men forsvinder i "jubel" i alle tre stadier (`moods-panda.png`, kolonnen jubel (998–1348, 264–1530)). Når isbjørnen kommer, skal hovederne skilles.
  - Uglens kløvede fjerører (#16, #22, #59) kan læses som horn. Når dragen kommer, bør dens horn være glatte og sidde bag ørerne.

**3. Proportioner** (`species-<art>.png` stadierækker y0 ≈ 320, 608 og 896, og `lineup.png`)
- **Alle seks 5:**
  - Tydelig chibi med lave, store øjne, og babyen har størst hoved og øjne.
  - Rævens høje krop følger hestenes "tall"-skabelon og står pænt på jordlinjen i `lineup.png`.
- **Målt overlap mellem ung og stor** (silhuetter normaliseret til samme højde): ræv 0,70, panda 0,89, ugle 0,89, egern 0,90, lam 0,91 og hamster 0,91.
  - Godkendte arter målt på samme måde: 0,77–0,88. Pindsvinet, der fik 4 i r4, ligger på 0,96.
  - **Forbehold:** Hamster, lam og egern ligger tættest på "opskaleret ung". Giv "stor" relativt mindre hoved og lidt længere krop og ben.

**4. Kontur** (`closeup-<art>.png`, `species-<art>.png` og `holes.png`)
- **Selve konturen:** én ensartet, farvet kontur i alle dele og stadier, ører og totter vokser sømløst ud af hovedet, og der er ingen dobbeltstreger. Det alene ville give 5.
- **Alle seks 4: lommer, der ikke er fyldt med pels.** Rubrikken kræver, at lommer mellem arm, hage og krop fyldes med pels bag delene. Disse viser baggrunden. Flisenumrene tælles rækkevis med 28 pr. række, og stadie/humør følger r4's rækkefølge.
  - **Lam:** stadie 1 · vinker, c1 og c4, mellem det løftede ben og kinden (ca. 9 enheder): #782 (3538–3548, 4680–4689) og #788 (546–556, 4840–4849).
  - **Ræv:**
    - **Den største fejl i runden.** I stadie 3 · tænker og sover er der en høj lomme mellem brystet og det løftede forben. Den er 14–20 enheder bred og ses som et hul i kroppen på farvet baggrund: #879 (1502–1513, 5302–5323), #881 (1776–1790, 5302–5331), #885 (2318–2329, 5302–5323) og #887 (2592–2606, 5302–5331).
    - Desuden vinke-lommer i stadie 2–3: #862 (2996–3006, 5142–5150), #868, #882 (1907–1923, 5291–5303) og #888.
  - **Hamster:** vinker i stadie 2–3 mellem pote og kindpose (6–9 enheder): #922 (3540–3549, 5478–5484), #928 (548–557, 5637–5644), #942 (2453–2466, 5628–5635) og #948 (3269–3282, 5628–5635).
  - **Panda:** ups og vinker i stadie 1–2 mellem bambusarmen og ansigtet (ca. 7 enheder):
    - #1143 (3093–3107, 6781–6792), #1145, #1149 (101–115, 6943–6954), #1151, #1163 (2005–2018, 6931–6940), #1165 (2277–2327, 6927–6940), #1169 og #1171,
    - samt mindre i glad: #1140, #1146, #1160 og #1166.
  - **Egern:**
    - Kun sprækker på 1–2 px, under 4 enheder, mellem arm og kind i stadie 2's humør: #1223, #1225, #1227, #1229 og #1231, fx (2563–2565, 7259–7260).
    - Desuden i stadie 3 · jubel: #1241 (1199–1204, 7409–7412) og #1247.
    - Det er små brud på reglen om sprækker, ligesom maine coon-babyen i r4.
  - **Ugle:** mellem løftet vinge og hoved:
    - vinker stadie 1: #1265 (682–695, 7587–7596) og #1271 (1497–1511, 7587–7596),
    - jubel stadie 2: #1281 og #1287 (3673–3681, 7578–7583),
    - jubel stadie 3: #1301 (1771–1783, 7727–7736) og #1307 (2587–2600, 7726–7736).
- **Derfor 4 og ikke 3** (samme vurdering som R1 i r4): Konturen er hel, og lommerne er rent afgrænsede negative rum i positurer, ikke sømme. De skal dog rettes før udgivelse, og huller-lint'en skal fange dem.

**5. Palet** (`species-<art>.png`, kolonne x0 = 256 + 244 · (n − 1), stadie 1–3 y0 ≈ 320, 608 og 896)
- **Lam 5:**
  - Hvid, creme, sort, grå, brun, lyserød, guld og regnbue er tydeligt forskellige.
  - Guld har ravkontur.
  - Regnbuen sidder i top, hale og smæk som flade striber.
- **Ræv 4:**
  - Regnbuen har samme blegt lavendel krop som c2 polar og skiller sig kun på halen og en lille smæk: x0 = 500 mod x0 = 1964.
  - c5 guldrød (x0 = 1232) ligger tæt på guld (x0 = 1720).
- **Hamster 4:**
  - c1 hedder "guld" (x0 = 256) og specialfarven "gold · guld" (x0 = 1720). Det giver to "guld"-hamstere i Samlebogen og oplæsningen.
  - c6 "panda" (x0 = 1476) er en lille panda, og pandaen er en art i samme spil.
  - c4 sort-hvid har en hvid blis, der læses som et stinkdyr.
- **Panda 4:**
  - c2 brun (x0 = 500) og c5 creme (x0 = 1232) ligger tæt.
  - c6 lilla (x0 = 1476) og regnbuen (x0 = 1964) er begge lavendel.
- **Egern 4:** c1 rød (x0 = 256) og c6 orange (x0 = 1476) ligger tæt, især ved 48 px.
- **Ugle 4:**
  - c2 sne (x0 = 500) og c4 perlehvid (x0 = 988) er næsten ens.
  - Regnbuens krop er samme lavendelhvide.
  - c1 brun og c5 kanel ligger tæt.

**6. Ansigtets appel** (`closeup-<art>.png` (65–935, 216–1275) og `moods-<art>.png`)
- **Alle seks 5:**
  - Store, blanke øjne med to højlys og velplacerede kinder og næse (eller næb).
  - Pandaens øjne sidder i pletterne med en lys øjenring og er stadig levende.
- **Humørene:**
  - Alle 7 læses straks, fx `moods-fox.png` række 1: glad med lukkede øjne, jubel med stjerneøjne, tænker med boble, ups med sveddråbe og blink, sover med Zzz og vinker.
  - Intet humør er trist eller vredt.
  - Bobler og Zzz sidder frit.
- **Øjnene følger punktet** i begge rækker.

**7. Pasform** (`fit-<art>.png`, `fitmatrix.png`). Se afsnit 3.
- **Alle seks 4.**
- **Det, der virker:**
  - Rytter og Kongelig sidder naturligt på alle tre stadier.
  - Ridehjelm og diadem går mellem ørerne på ræv og egern og mellem fjerørerne på uglen.
  - Kåben falder rundt om alle kroppe, også egernets hale.
  - Uglens rygslot er låst som i SPEC §7.1.
  - De ældre sæt er kun set i oversigt (`fitmatrix.png`, rækkerne lam til hamster og panda til ugle). Jeg fandt ingen grove fejl der.
- **Det, der mangler til 5:**
  - **T12:** Sadeltasken ses som en planke over skødet. Det gælder lam, hamster og panda samt de runde godkendte arter.
  - **T13:** Monoklens 3. farvesæt farver øjet lavendel. Det gælder alle arter, tydeligst på ræv c6 og hamster c6.

**8. Animation** (`filmstrip-<art>.png`, nærbilledet y0 ≈ 3088, frame k x0 = 64 + 360 · (k − 1))
- **Alle seks 4.** Signaturen ses tydeligt i nærbilledet inden for 0,3–1,7 s med pause bagefter:
  - lammets øreflop (0,45–0,95 s, ørerne falder og fjedrer op),
  - rævens halesvip,
  - hamsterens kindpust (kinderne vokser ved 0,70–0,95 s),
  - pandaens potevink (bambusarmen svinger),
  - egernets halesvirp,
  - uglens hoveddrej (hældning ved 0,45–0,95 s).
- **Humørene** har hver deres rytme (fx `filmstrip-owl.png` række 2–7).
- **Det, der mangler til 5:**
  - Halesvip, kindpust og hoveddrej er små bevægelser, der næppe ses ved 48 px.
  - Uglens "hoveddrej" er en hældning, ikke et drej.
  - Jeg har ikke målt alle krav (3 frames ud, overshoot) frame for frame.

**9. Butikskort ved 64 px** (`sizes-<art>.png`). Se afsnit 3.
- **Lam, ræv, hamster, panda og egern 4:**
  - Genstanden alene er tydelig, og de tre farvesæt er klart forskellige.
  - Svage kort:
    - sadeltasken på dyret (B9),
    - monoklen alene (B10),
    - det lille diadem (B12),
    - lammets kropskort, der kun fylder den øverste del (B13).
- **Ugle 3:**
  - Alle rygkort "på dyret" viser uglen uden genstand og uden låse-ikon (B11). Det er 21 kort: rygsæk, net, pirat-ryggen, sadeltaske, kåbe, fevinger og kappe.
  - Det er rubrikkens 1-beskrivelse ("genstanden forsvinder i kortet") for en hel slot.
  - Resten af uglens kort er 4, så samlet 3.

**10. AAA-finish** (alle ark)
- **Alle seks 4.** Gennemført, konsistent og meget charmerende:
  - lammets uldkrøller,
  - rævens hvide halespids og sokker,
  - hamsterens kindposer,
  - pandaens bambus og potepuder,
  - egernets fnuggede hale,
  - uglens brystfjer og kløer.
- **Til 5 mangler** ("uden en eneste fejl") lommerne under kontur, T12 og T13, og for uglen B11 og de tætte hvide farver.

## 2. Samspil med de godkendte arter (`lineup.png`, stadie 2 · c1)

- **Samme familie:**
  - Samme konturtykkelse, øjne med to højlys, lyserøde kinder og cel-skygge.
  - Ingen af de nye arter skiller sig ud i stil eller størrelse på jordlinjen.
- **For tæt på hinanden:**
  - **Ræv og langhårs- og maine coon-katten.**
    - I blindtesten var langhårskatten (#11, #47 og #14) usikker, fordi kindpels og busket hale er rævens kendetegn. Det er fundet fra G1 r2–r4, og nu er ræven i spillet.
    - Det er kattens problem, ikke rævens, men det bør løses nu: gør kattens krave rund og symmetrisk med 3–4 totter, og lad knurhårene stikke mindst 6 enheder ud (som r4 foreslog).
  - **Hamster c6 "panda" og pandaen** (se palet).
  - **Mange orange c1-farver:** tre katte, ræv, hamster og egern er alle orange i standardfarven. Det gør lineup'en og ven-noderne ensformige. Overvej en anden c1 for hamsteren, fx sandfarvet.

## 3. Tøjet: Rytter og Kongelig

| Sæt | Genstande (slot) | Pasform | Butikskort | Vigtigste fejl |
|---|---|---|---|---|
| Rytter | ridehjelm (hoved, ørehuller), støvbriller (ansigt), roset (hals), ridejakke (krop), sadeltaske (ryg), gulerod (hånd) | 4 | 4 | T12, T14, B9 |
| Kongelig | diadem (hoved, ørehuller), monokel (ansigt), perlekæde (hals), festdragt (krop), kongekåbe (ryg), scepter (hånd) | 4 | 4 | T13, B10, B12 |

**Sådan er sættene scoret:** Som i r4 giver en genstand, der sidder forkert på alle arter, pasform 3. Sadeltasken (T12) sidder på hoften og dækker intet, men læses forkert på runde kroppe. Den rammer ikke ræv, egern, hest og enhjørning, så sættet får 4.

**Det, der virker:**
- Ridehjelmen sidder mellem ørerne på alle 12 arter:
  - hornet går op gennem hjelmen på enhjørningen,
  - vædderens ører hænger under kanten,
  - ugle og egern har totterne fri.
- Diademet sidder om hornets fod.
- Støvbrillerne har klare glas, og øjnene ses på alle arter.
- Roset, perlekæde, ridejakke og festdragt følger round, pear og tall, med ærmerne fra skulderen.
- Kongekåben falder naturligt med hermelinskrave på alle kroppe.
- Gulerod og scepter sidder i poten på alle stadier, og pandaen beholder bambussen i den anden pote.
- De to hele sæt (`fitmatrix.png` kolonne 43–44, x0 = 10748 og 10992) er harmoniske på alle 36 rækker.

### Fejl i tøjet (ark og celle)

Nummereringen fortsætter fra r4 (T1–T11 og B1–B8). Fit-arkenes rækker: Rytter hoved/ansigt/hals/krop/ryg/hånd y0 ≈ 3868, 4166, 4464, 4762, 5060 og 5358 og Kongelig y0 ≈ 5656, 5954, 6252, 6550, 6848 og 7146. Kolonnerne er x0 = 256 + 256 · (k − 1) som i r4. `fitmatrix.png`: rytter-hoved til kongelig-hånd er kolonne 15–26 (x0 = 3916 + 244 · i), og rækkerne er y0 = 296 + 288 · r (se bilag A).

**T12. Sadeltasken ligner en planke eller bakke over skødet. Lam, hamster og panda samt kanin, kat, hvalp og pindsvin.**
- **Hvor:**
  - `fit-hamster.png`, rækken "rytter-back" (y0 ≈ 5060), stadie 3 (1792–2540, 5060–5336). Her er stangen bredere end kroppen.
  - `fit-lamb.png` samme række.
  - `fitmatrix.png` kolonne 19 (x0 = 4892) i rækkerne for lam (y0 4616–5192), hamster (6344–6920) og panda (8072–8648).
- **Fejlen:** Taskerne tegnes som en vandret stang med en lille pose i hver ende foran hoften. Forfra læses det som en planke, en bakke eller en bænk, som dyret sidder bag, ikke som sadeltasker.
- **Ret sådan:**
  - Lad to poser hænge på flankerne, uden for kroppens kontur ved hoften og bag armene.
  - Lad remmen over ryggen kun anes som en kort stump ved hoften. Der må ingen stang være foran skødet.
  - På stadie 3 må posen højst stikke ca. 6 enheder ud over hoften.
  - Ræv og egern viser omtrent den rigtige placering.

**T13. Monoklens 3. farvesæt farver øjet lavendel, så de to øjne får forskellig farve. Alle arter.**
- **Hvor:**
  - `fit-fox.png`, rækken "kongelig-face" (y0 ≈ 5954), farve 2-cellerne (768, 1536 og 2304). Den mørke ræv har gyldne øjne, men øjet i glasset er lilla.
  - `fit-hamster.png` og `fit-lamb.png` samme celler.
  - `fitmatrix.png` kolonne 22 (x0 = 5624).
- **Ret sådan:**
  - Brug klart glas med højst ca. 20 % tone og et hvidt højlys.
  - Tegn ikke øjet om i glassets farve. Vil I beholde forstørrelsen, skal irisfarven være artens egen.

**T14. Fjordtoppen titter frem over ridehjelmen (stadie 3, mindre fejl).**
- **Hvor:** `fit-horse.png`, rækken "rytter-head" (y0 ≈ 3868), stadie 3 · fjord (2048–2284, 3868–4144). Mørke spidser ses bag hjelmens knap.
- **Ret sådan:** Klip fjordtoppen til hjelmens kuppel, ligesom T9 foreslog for festhatten.

### Fejl i butikskortene (ark og celle)

Butikskortene er 128 × 128 med x0 = 64 + 156 · (k − 1).
- "Genstanden alene" har y0 = 1636, 1788, 1940, 2092, 2244, 2396 og 2548 (Hverdag, Opdager, Rytter, Kongelig, Pirat, Fest og Milepæle).
- "På dyret" har y0 = 2784, 2936, 3088, 3240, 3392, 3544 og 3696 i samme rækkefølge.

- **B9. Sadeltasken på dyret læses som en planke.**
  - **Hvor:** `sizes-<art>.png`, Rytter "på dyret", kort 13–15 (1936–2376, 3088–3216). Værst på hamster, lam, panda, kanin og kat.
  - **Ret sådan:** Følger af T12. Beskær gerne ryggen i tre kvart profil, sådan at én pose ses tydeligt ved siden af kroppen.
- **B10. Monoklen alene ligner Opdager-luppen.**
  - **Hvor:** Kongelig alene, kort 4–6 (532–972, 2092–2220), mod Opdager alene, kort 16–18 (2404–2844, 1788–1916).
  - **Ret sådan:**
    - Gør glasset ca. 40 % mindre, og lad en tynd snor gå i en bue ud af kortet i stedet for den korte kædestump, der læses som et håndtag.
    - Vis den gerne let skråt med et højlys.
- **B11. Uglens rygkort viser ingen genstand og intet låse-ikon (blokerende for uglen).**
  - **Hvor:** `sizes-owl.png`, "på dyret":
    - kort 13–15 i Hverdag, Opdager, Rytter, Kongelig og Pirat (1936–2376, y0 2784, 2936, 3088, 3240 og 3392),
    - Milepæle kort 16–21 (2404–3312, 3696–3824).
  - **Fejlen:** Rygslottet er optaget af vingerne (SPEC §7.1), så kortet viser bare uglen. Det er 21 kort, hvor genstanden forsvinder.
  - **Ret sådan:** Vis låse-ikonet fra §7.1 på kortet ("vingerne fylder ryggen"), eller vis genstanden alene ved siden af uglen. Kortet må aldrig ligne et tilbud på ingenting.
- **B12. Diademet er lille alene.**
  - **Hvor:** Kongelig alene, kort 1–3 (64–504, 2092–2220). Det fylder kun ca. 1/4 af kortets højde.
  - **Ret sådan:** Skalér det, så det fylder ca. 85 % af bredden som de andre hovedgenstande, og giv takkerne mere højde.
- **B13. Lammets kropskort og håndkort er skævt beskåret (mindre fejl).**
  - **Hvor:**
    - Ridejakke og festdragt "på dyret", kort 10–12 (1468–1908, 3088–3216 og 3240–3368), har en tom nederste tredjedel.
    - Gulerod og scepter, kort 16–18 (2404–2844, samme rækker), skærer gennem øjnene.
  - **Ret sådan:** Centrér beskæringen lodret om genstanden. Kropskort skal gå fra hage til hofte, og håndkort skal sidde om poten under øjnene.

## 4. Gate-afgørelse

- **Lam: bestået.** Alle kriterier er ≥ 4, og middel er 4,5.
- **Ræv: bestået.** Alle kriterier er ≥ 4, og middel er 4,4. Den store tænker/sover-lomme (#879, #881, #885 og #887) skal rettes før udgivelse.
- **Hamster: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Panda: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Egern: bestået.** Alle kriterier er ≥ 4, og middel er 4,4.
- **Ugle: ikke bestået.** Butikskort står til 3 (B11), og middel er 4,3. Resten er ≥ 4, så det er en hurtig rettelse til runde 2.
- **Rytter: bestået** (pasform 4 og butikskort 4) med forbehold for T12 og B9.
- **Kongelig: bestået** (pasform 4 og butikskort 4) med forbehold for T13, B10 og B12.
- **Blindtesten:** 60/60 på artsniveau, og alle racer og stadier er ramt. Kravet er opfyldt.

## 5. Rettelser

### Ugle (ikke bestået: butikskort 3), i prioriteret rækkefølge

1. **B11 – rygkortene (blokerende).**
   - Vis låse-ikonet fra §7.1, eller vis genstanden alene ved siden af uglen, på alle 21 rygkort i `sizes-owl.png` (kort 13–15 i fem sæt og Milepæle 16–21).
   - Tjek samme logik i spillets butik og garderobe.
2. **Lommerne mellem vinge og hoved.**
   - Fyld pels bag den løftede vinge i vinker (stadie 1) og jubel (stadie 2–3): `holes.png` #1265, #1271, #1281, #1287, #1301 og #1307.
   - Udvid huller-lint'en, så den fejler på disse lukkede lommer.
3. **Skil de hvide farver ad.**
   - Giv c4 perlehvid en tydeligt anden tone end c2 sne (`species-owl.png` x0 = 500 og 988), fx en varm perlerosa eller en blågrå.
   - Lad regnbuen bære striberne i flere dele end maven (fjerører og halefjer), så den ikke ligner c4.
4. **T13 – monoklen:** klart glas, og øjets egen irisfarve bag glasset.
5. **Håndgenstande på vingen:** Lad vingespidsen gribe om gulerod og scepter, så genstanden ses ved 64 px (`sizes-owl.png` kort 16–18 (2404–2844, 3088–3368)).

### Forbehold for de arter, der har bestået (rettes før udgivelse)

- **Alle fem:** Fyld lommerne under kontur med pels bag armen, og udvid huller-lint'en, så lukkede lommer under 25 enheder fejler.
- **Lam:**
  - Vinke-lommen i stadie 1 (#782 og #788).
  - T12 og B13.
  - Gør "stor" mere voksen.
- **Ræv:**
  - Lommen mellem bryst og forben i stadie 3 · tænker og sover. Den er 14–20 enheder og ses som et hul i kroppen.
  - Giv regnbuen en anden krop end c2 polar, og skil c5 guldrød fra guld.
- **Hamster:**
  - Omdøb c1 "guld", så den ikke deler navn med specialfarven.
  - Overvej at bytte c6 "panda" ud med fx "sandfarvet" eller "abrikos".
  - T12 er tydeligst her.
  - Gør "stor" mere voksen.
- **Panda:**
  - Lommerne i ups og vinker.
  - Skil c2 brun fra c5 creme og c6 lilla fra regnbuen.
  - Lad bambussen blive synlig i "jubel", fx i den ene løftede pote eller stukket ind under armen.
- **Egern:**
  - Sprækkerne i stadie 2's humør og stadie 3 · jubel.
  - Skil c1 rød fra c6 orange.

### Sæt

- **Rytter:**
  1. T12 sadeltasken som poser på flankerne.
  2. B9 følger af T12.
  3. T14 fjordtoppen under hjelmen.
- **Kongelig:**
  1. T13 monoklens glas.
  2. B10 monoklen alene.
  3. B12 diademet alene.

## Bilag A: koordinatsystem

- **Arts-ark** (`species-<art>.png`): kort x0 = 256 + 244 · (n − 1) for c1–c6, guld og regnbue. Stadie 1–3 har y0 ≈ 320, 608 og 896, og stjerneformen ligger under.
- **Fit-ark:**
  - Kort x0 = 256, 512 og 768 (stadie 1 · farve 0/1/2), 1024, 1280 og 1536 (stadie 2) og 1792, 2048 og 2304 (stadie 3). Kortene er 236 × 276.
  - Rytter-rækkerne har y0 ≈ 3868–5358, og Kongelig-rækkerne har y0 ≈ 5656–7146 (afstand ca. 298).
- **`fitmatrix.png`:**
  - Række y0 = 296 + 288 · r: kanin 0–2, kat 3–5, hvalp 6–8, pindsvin 9–11, hest 12–14, lam 15–17, ræv 18–20, hamster 21–23, enhjørning 24–26, panda 27–29, egern 30–32 og ugle 33–35.
  - Kolonne x0 = 256 + 244 · c:
    - rytter-hoved til -hånd er c = 15–20,
    - kongelig-hoved til -hånd er c = 21–26,
    - de hele sæt "rytter · sæt" og "kongelig · sæt" er c = 43 og 44.
- **`sizes-<art>.png`:**
  - 48 px-kortene har y0 = 268.
  - Butikskortene er 128 × 128 med x0 = 64 + 156 · (k − 1). Rækkerne står i afsnit 3.
- **`holes.png`:**
  - Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28). Række 1–47 har y0 = 212, 374, 536, … (afstand ca. 162), og den sidste række har y0 = 7646.
  - Fliserne fordeler sig sådan: kanin 1–288, kat 289–468, hvalp 469–528, pindsvin 529–588, hest 589–768, lam 769–828, ræv 829–888, hamster 889–948, enhjørning 949–1131, panda 1132–1191, egern 1192–1251 og ugle 1252–1311.
  - Pr. stadie kommer først 8 farver i hvile, derefter 6 humør i c1 og 6 humør i c4 (glad, jubel, tænker, ups, sover og vinker).
- **Filmstrimler:** Nærbilledet af signaturen har y0 ≈ 3088, og frame k har x0 = 64 + 360 · (k − 1).
- **Silhuetter:** #n har midte ved x ≈ 214 + 300 · ((n − 1) mod 9), og rækkerne har midte ved y ≈ 374, 752, 1128, 1506, 1893, 2262 og 2640.
