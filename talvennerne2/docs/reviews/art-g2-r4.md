# Kunst-review, bølge 2 runde 4 (G2 · r4): ARTFIX-E og ARTFIX-F

- **Reviewer:** REV8. Jeg er frisk og uafhængig. Jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i tidligere runder.
- **Opgave:** den målrettede gate for to rettelsesrunder.
  - **ARTFIX-E** er merget efter G2-r3 og er ikke reviewet uafhængigt. Den omfatter T15 og B15 (skjoldet), B16 (stavens kort og øje-lint'et på alle håndkort), de fem fyldte lommer med en tom `KNOWN_POCKETS` og fit-matrixen delt pr. sæt.
  - **ARTFIX-F** omfatter lammets hjørne ved hoven, fjordføllets børstemanke, egernets c5 og c6, Hestebakkernes skyggeside og SPEC A17 (`art.over`: skjoldet foran benet med rem, og uglens håndgenstand over vinge og ærme).
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §6, §7 (med A17) og §11, `docs/reviews/art-g2-r3.md` og `art-g2-r3-blind.md`.
  - Alle ark er genereret i `/home/user/wt/rev8/talvennerne2/artifacts/sheets/` 5. okt. 2026 kl. 08:15–08:27 UTC fra f0f0cc4. Kunsten er den samme som i 21ff49e, og f0f0cc4 lægger kun blindsvarene til. Arkene er lavet med `npx vite build --mode sheets` og `SHEETS_PORT=4363 node scripts/sheets.mjs`, med Chromium bag `flock`.
  - Alle 87 sider gav "ok", og `lint.json` har 0 fejl.
  - Det levende kort er set på dev-serveren (port 4363, `?worlds=all`) i 393 × 852 og 1180 × 820 (2x) med Hestebakkerne åbnet i profilen.
- **Uafhængighed:**
  - Jeg har ikke læst kunstens kildekode. Kode har jeg kun åbnet for at betjene værktøjerne og tjekke lint'en:
    - `sheets.mjs` (lås og port),
    - silhuetrutens blanding (facit),
    - holes-rutens rækkefølge og `magicOf` (flisenumre),
    - kortenes øje-lint og `KNOWN_POCKETS` i `src/dev/lints.ts`,
    - kortets URL-parameter, rute og profilopskrift (`src/meta/built.ts`, `MapScreen.tsx`, `RegionSection.tsx` og `loop.e2e.mjs`).
  - Jeg har brugt `git log` og `git diff --stat` til at se, hvad der er ændret. Ud over det har jeg kun set diff'en for 5d2aa42 (bakkernes skyggestyrke) for at vide, hvilke lag der er ændret.
- **Metode:**
  - Arkene er set i oversigt og derefter i udsnit med 1,5–14× zoom.
  - Hvor meget af skjoldet, der ses, og hvor meget af butikskortet det fylder, er målt maskinelt. Skjoldets egne farver tages fra kortet "genstanden alene", og den største sammenhængende klat måles. Tallene er efterprøvet visuelt, fordi farvesegmenteringen er usikker, når skjoldet har samme farve som pelsen.
  - Huller er fundet maskinelt i `holes.png` som lukkede magenta-områder, både med en streng og en mild magenta-grænse. Som i G2-r3 er et område, der kun er lukket ved den strenge grænse, antialias og ikke en lomme.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1). Koordinatsystemerne står i bilag A.
- **Skalaen:**
  - 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
  - Scores fra tidligere runder er kun ændret ved en ny fejl, en regression eller en rettelse, der flytter et kriterium.

## Resultat

**Gate G2-r4: bestået.** Alle fire krav er opfyldt.

| Krav | Resultat |
|---|---|
| Alle berørte arter og sæt har alle 10 kriterier ≥ 4 og middel ≥ 4,3 | Opfyldt. Laveste middel er 4,4. |
| Ridder og Talmagiker har pasform og butikskort ≥ 4 | Opfyldt (4 og 4 for begge). |
| Blindtesten giver 60/60 og ≥ 57 sikre, og fjordføllet i stadie 1 er "sikker" uden en enhjørning som alternativ | Opfyldt: 60/60, 60 sikre. Fjordføllet (#13) er "sikker", og alternativet er en lille krone, ikke en enhjørning. |
| Bakkernes skygge læses som formskygge | Opfyldt. |

| Sæt | Pasform | Butikskort | Afgørelse |
|---|---|---|---|
| **Ridder** | **4** | **4** | **Bestået.** Skjoldet sidder nu rigtigt på 10 af 12 arter. Forbehold: **T16** (pandaens arm dækker halvdelen af skjoldet i stadie 2–3), **T17** (vædderens øre over skjoldet i stadie 2) og **B17** (rævens skjoldkort fylder 45 %). |
| **Talmagiker** | **4** | **4** | **Bestået.** B16 er rettet: intet håndkort skærer gennem øjnene. Til 5 mangler T5-detaljen (de lige ærmer, kendt begrænsning) og stavens skaft på kortene for de høje kroppe (§2.3). |

De andre sæts håndgenstande (Hverdag, Opdager, Rytter, Kongelig, Pirat og Milepæle) er kun berørt gennem uglen (A17). De sidder rigtigt på uglen med og uden kropstøj (§2.2), og deres scores fra tidligere runder er uændrede.

| Art | Middel | Laveste | Afgørelse |
|---|---|---|---|
| Kanin | 4,5 | 4 | Bestået. Vædderlommen er fyldt. Forbehold T17. |
| Kat | 4,5 | 4 | Bestået. |
| Hvalp | 4,4 | 4 | Bestået. |
| Pindsvin | 4,4 | 4 | Bestået. |
| Hest | **4,4** (r3: 4,3) | 4 | Bestået. Silhuetten går fra 4 til 5 med fjordbørsten (§4). |
| Lam | 4,5 | 4 | Bestået. Hjørnet ved hoven er fyldt. |
| Ræv | 4,4 | 4 | Bestået. Forbehold B17. |
| Hamster | 4,4 | 4 | Bestået. Lommen i hvile er fyldt. |
| Enhjørning | 4,5 | 4 | Bestået. |
| Panda | 4,4 | 4 | Bestået. Lommen i sover er fyldt. Forbehold T16, som er en mindre fejl og samme type som T15 i G2-r3. |
| Egern | 4,4 | 4 | Bestået. c5 og c6 er skilt fra guld og fra hinanden. |
| Ugle | 4,4 | 4 | Bestået. Håndgenstandene ses over vinge og ærme. |

**Status pr. punkt:**

| # | Punkt | Status |
|---|---|---|
| 1 | T15/B15 og A17: skjoldet | **Delvist rettet.** Skjoldet står foran benet med rem på alle høje kroppe og dækker aldrig øjnene. Mindst 3/4 ses i alle celler på 10 af 12 arter. Undtagelserne er pandaen i stadie 2–3 (T16) og vædderkaninen i stadie 2 (T17). Kortet fylder mindst 50 % på 11 af 12 arter, men ikke på ræven (B17). |
| 2 | Uglen | **Rettet.** Alle 8 håndgenstande ses over vinge og ærme, både med og uden kropstøj og i alle humør. Intet ser forkert lagt ud. |
| 3 | B16: stavens kort og øje-lint'et | **Rettet.** |
| 4 | Lommerne | **Rettet.** De fem lommer og lammets hjørne er fyldt, `KNOWN_POCKETS` er tom, og huller-lint'en har 0 fejl. |
| 5 | Fjordføllet | **Rettet.** Manken læses som manke i alle stadier, farver og humør, og føllet er stadig en fjordhest. |
| 6 | Egernets farver | **Rettet.** |
| 7 | Hestebakkernes skygge | **Rettet.** Skyggesiden læses som formskygge, og sten og skilte er læsbare. |
| – | Fit-matrixen pr. sæt | **Rettet.** Den består af 9 ark, et pr. sæt, uden tomme felter. |

## 1. Blindtesten

- `art-g2-r4-blind.md` blev committet (f0f0cc4), før rubrik, reviews, kode og kontaktark blev åbnet.
- Bagefter tjekkede jeg, at mit `silhouettes.png` er pixelidentisk med blindarket (SHA-256 `5e6d035e…781779e7` for begge).
- Facit er beregnet ud fra silhuetrutens blanding i `src/dev/SheetApp.tsx` (`BLIND_SALT` 10,4: arterne i `SPECIES_IDS`-rækkefølge, racerne i artsfilernes rækkefølge og stadierne 2, 1, 3, sorteret efter brøkdelen af `sin(i · 12,9898 + 10,4) · 43758,5453`). Jeg har sammenlignet facit med mine svar ét for ét.

| | r3 (REV7) | r4 (REV8) |
|---|---|---|
| Rigtige på art | 60/60 | **60/60** |
| Sikre / usikre | 56 / 4 | **60 / 0** |
| Usikre | 3 vædderkaniner og fjordføllet (#55) | ingen |
| Fjordføllet i stadie 1 | "usikker", alternativ enhjørning | **#13 "sikker"**, alternativ en lille krone på en hest |

- **Stadierne:** Alle mine angivelser af "lille", "mellem" og "stor" passer med stadie 1, 2 og 3.
- **Racerne:** Mine grupper i noterne passer alle med racerne:
  - kat: buttet = langhår (#16, #32, #1), klassisk = huskat (#54, #53, #44) og duskøre = maine coon (#8, #18, #11),
  - kanin: opretstående = upright (#3, #12, #21), vædder (#29, #15, #28) og løvehoved (#39, #37, #48),
  - hest: børstemanke = fjord (#13, #35, #6), "pjusket pandelok" = araber (#4, #27, #22) og "vifte-pandelok" = shetland (#30, #43, #42),
  - enhjørning: Opsummeringen grupperede efter størrelse, men noterne skiller racerne ad: manke i højre side = stjernehorn (#7, #19, #57), bølget manke = bølgemanke (#20, #24, #17) og manke i venstre side = føl (#26, #31, #2).

  Shetland og araber, som REV7 ikke kunne skille sikkert ad i sort, skilte jeg rigtigt ad.
- **De vigtigste forvekslingspar** (fra blindfilen, svageste først). Ingen af dem gav en usikker figur.
  1. **Hornløs hest ↔ enhjørning.** Shetlandsponyens vifte-pandelok (#30, #43, #42) er det element på arket, der kommer nærmest en horn-læsning, især hos #42, hvor midterfligen er højest. Hesten med lang manke afgøres ved udelukkelse: der er hverken horn eller vinger.
  2. **Hamster ↔ panda eller isbjørn.** Det afgøres af kindposerne. #33 (stadie 1) er svagest.
  3. **Vædderkanin ↔ hvalp.** Det afgøres af pomponhalen, toppen og fødderne.
  4. **Løvehovedkanin ↔ lam.** Det afgøres af de lodrette ører.
  5. **Maine coon ↔ ræv eller egern.** Det afgøres af knurhårene.
  6. **Langhårskat ↔ hamster.** Det afgøres af de spidse ører.
  7. **Fjordhestens børstemanke ↔ enhjørning er ikke længere et forvekslingspar.** Børsten er bredere end høj og har en flad top.
- **Forbehold om bias:**
  - Briefen fortalte før testen, at fjordføllets manke nu er en lav, bred børste. Jeg vidste altså, hvor jeg skulle kigge.
  - Jeg så også alle 60 figurer på én gang og kunne sammenligne dem.
  - Min sikkerhed er derfor nok snarere for høj end for lav, ligesom REV7 skrev i r3.

## 2. Punkterne

### 2.1 T15/B15 og A17: skjoldet

**Grundlag:**
- `fit-<art>.png`, rækken "ridder-hand" (y0 = 8926 for kanin, kat, hest og enhjørning, ellers 8894), alle 9 celler for alle 12 arter.
- `fitmatrix-ridder.png`, kolonnen "ridder-hand" (x0 = 1482), alle 36 rækker.
- `sizes-<art>.png`, Ridder alene og "på dyret", kort 16–18 ((2404–2844, 2244–2372) og (2404–2844, 3696–3824)).
- Ugle og Ridder i "tøj i alle humør" (`fit-owl.png`, y0 = 22076 og 22374).

**Står skjoldet foran benet med en rem, så mindst 3/4 ses?**

| Kroppe | Det ser jeg | Synligt |
|---|---|---|
| Hest, enhjørning, ræv, hvalp og kat | Skjoldet står foran højre forben i bryst- og maveshøjde. En rem i skjoldets farve ses til venstre for skjoldet. T15 er rettet i alle 9 celler, også i stadie 3 (fx `fit-horse.png` (1792–2028, 8926–9202) og `fit-fox.png` (1792–2028, 8894–9170)). | Hele skjoldet |
| Kanin, pindsvin, hamster, egern og lam | Poten eller hoven ligger over skjoldets øverste venstre hjørne som greb ("hånddel" i A17), og resten af skjoldet står frit foran maven. | ca. 80–90 % |
| Ugle | Skjoldet står foran vingen og, med kropstøj, foran ærmet. Vingespidsen griber om skjoldets nederste venstre del. | ca. 90 % |
| Kanin, vædder, stadie 2 | Det lange øre og poten ligger over skjoldets øverste tredjedel (T17). | ca. 2/3 |
| **Panda** | Armen ligger over skjoldets venstre del (T16). | stadie 1 ca. 80 %, stadie 2 ca. 2/3, stadie 3 ca. 1/2 |

**Dækker skjoldet øjnene?** Nej, på ingen art, intet stadie og intet humør. Det sidder altid under hagen, og fit-arkets øjenlint er grøn.

**Fylder skjoldets butikskort mindst 50 %?**

| | Kanin | Kat | Hvalp | Pindsvin | Hest | Lam | Ræv | Hamster | Enhjørning | Panda | Egern | Ugle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kort 16–18 "på dyret" | 58–59 % | 60–61 % | 60 % | 59 % | 59 % | 59 % | **45 %** | 59 % | 59 % | 59 % | 60 % | 59–62 % |

- Tallet er skjoldets største udstrækning i forhold til kortets 128 px.
- Skjoldet alene fylder mindst 78 % på alle kort (lint'en).
- På hest, enhjørning og ræv er B15 dermed rettet. Skjoldet kan straks genkendes i alle tre farvesæt, og forbenet krydser det ikke længere.
- **Ræven er undtagelsen (B17).** Kortet er beskåret fra næsen til poterne, så skjoldet kun fylder ca. 57 af 128 px.
- På pandaens kort ses kun ca. 2/3 af skjoldet bag armen (T16). Det fylder 59 % i højden og kan genkendes.

### 2.2 Uglen

**Grundlag:** `fit-owl.png`:
- alle 8 håndrækker (y0 = 1752, 3538, 5324, 7108, 8894, 10680, 12466 og 15144),
- de 9 rækker "hele sættet" (y0 = 16036–18418),
- de 21 rækker "tøj i alle humør" (y0 = 18802–24754),
- `sizes-owl.png`, håndkortene for alle sæt (kort 16–18, y0 = 3088 + 152 · i).

**Det ser jeg:**
- **Uden kropstøj:** Ballon, lup, gulerod, scepter, skjold, stjernestav, kikkert og slikkepind sidder ved vingespidsen foran vingen i alle 9 celler.
- **Med kropstøj:** Genstanden tegnes over ærmet og manchetten, og vingespidsen griber om håndtaget.
  - Eksempler: staven foran Talmagiker-ærmets guldbånd, kikkerten over piratskjortens striber og skjoldet foran Ridder-kjortlens ærme.
  - Se `fit-owl.png` (1792–2028, 17226–17502), (2048–2284, 17524–17800) og (2304–2540, 17822–18098).
- **Alle humør:** Genstanden følger den løftede vinge i jubel og vinker. I tænker holdes den foran brystet, uden at medaljen eller medaljonen dækker den (`fit-owl.png`, y0 = 22076–22970, kolonne 3, 4 og 7).
- **Svar:** Ja, tingen ses over vinge og ærme, og intet ser forkert lagt ud.
  - Eneste bemærkning: Ved 1x kan den brune vingespids over skjoldets spids ligne en frynse (`fit-owl.png` (1792–2028, 17226–17502)). I 64 px-kortet læses den som greb.
  - Det er en iagttagelse, ikke en fejl.
- **Håndkortene** er beskåret om vinge og genstand uden øjne. Hverdag-ballonen viser hele uglen med øjnene helt inde i kortet.

### 2.3 B16: stavens kort og øje-lint'et

- **Lint'en:** Kort-lint'en tjekker nu alle kort med dyret, også håndkortene. Øjnene og pandaens øjenpletter skal ligge helt inden for eller helt uden for kortets beskæring. Den er grøn på alle 12 sizes-ark.
- **Visuelt:** Jeg har tjekket Talmagiker- og Ridder-håndkortene på alle 12 arter (`sizes-<art>.png` (2404–2844, 3848–3976) og (2404–2844, 3696–3824)) og uglens håndkort for alle sæt.
  - Overkanten går gennem mund, kind eller snude, aldrig gennem øjnene.
  - På kanin, lam, hamster og panda, hvor B16 ramte, ses nu kun mund og kinder øverst i kortet (fx `sizes-panda.png` (2404–2532, 3848–3976)).
- **B16 er rettet.**
- **Rest-iagttagelse (ikke en fejl):** På de runde kroppe står staven skråt ud af poten, så både skaft og stjerne ses.
  - På de høje kroppe (kat, hvalp, hest, enhjørning og ræv) er skaftet næsten skjult bag forbenet, så kortet viser mest stjernen (fx `sizes-horse.png` (2404–2844, 3848–3976)).
  - Stjernen alene er tydelig, og kortet "genstanden alene" viser hele staven. Det er det, der skiller Talmagikerens butikskort fra 5.

### 2.4 Lommerne

- **`KNOWN_POCKETS` er tom** (`src/dev/lints.ts`). Huller-lint'en kører med 1311 figurer og 0 fejl. De fyldte figurer lintes med den strengeste grænse (`FILLED_POCKETS`).
- **De fem lommer og lammets hjørne:**

| Lomme (G2-r3 §3.1) | Fliser | Nu |
|---|---|---|
| Kanin · vædder · 2 · tænker, alle 8 farver | #127, #133, #139, #145, #151, #157, #163 og #169 | Intet lukket område. #163 (guld) har kun glimtets midte (3 px ved (3076–3083, 1093–1097)). Glimtene fjernes bevidst af lint'en. |
| Lam · 3 · jubel c1/c4 (hjørnet ved hoven) | #818 og #824 | Fyldt med uld. Kun én magenta-pixel ved den strenge grænse, i kanten mod jordskyggen ved (825, 5039) og (1641, 5039). Det er antialias. |
| Hamster · 3 · hvile, alle 8 farver (to lommer) | #929–#936 | Intet lukket område. #935 (guld) har kun glimt. |
| Panda · 3 · sover c1/c4 | #1184 og #1190 | Intet lukket område. |

- **Min egen skanning af hele arket** (streng og mild grænse) fandt ingen ny lomme.
  - Kun 1–2 px antialias i samlingerne (fx kanin · vædder · 1 · sover (2320–2322, 652–656), hvor en smal kanal mellem pote og hage lukkes af antialias ved den strenge grænse).
  - Bevidst negativt rum: maine coon-halens løkke (#449–#456), mellemrummet mellem løftet hov og kind i vinker (#702, #708, #762 og #768) og bambusrummet hos pandaen (#1183–#1191). Alle er åbne ved den milde grænse eller bredere end 4 enheder.
  - Enhjørningens c2-fliser (#1033 og #1053) giver kun udslag, fordi den lyserøde pels ligner magenta. Det er ikke huller.

### 2.5 Fjordføllet

- **Grundlag:**
  - `species-horse.png`, afsnittet "fjord · fjordhest": alle 8 farver i stadie 1–3 og stjerneformen (y0 = 1628–2492).
  - `moods-horse.png`, rækken "fjord · 1 · baby · c6" med alle 7 humør og tankebobler og Zzz.
  - `sizes-horse.png` (48 og 96 px).
  - Blindtestens #13, #35 og #6.
- **Manke og ikke horn:** Manken er nu en lav, flad børste mellem ørerne. Den er bredere end høj og har lodrette hårstrå og den mørke midterstribe. Ingen af stadierne, farverne eller humørene ligner en spids. Det gælder også gylden, regnbue (stribet pastelbørste) og sort, hvor børsten er lys mod mørk pels.
- **Stadig en fjordhest:** Ja. Den opretstående, klippede manke med mørk midterstribe er fjordhestens tydeligste kendetegn, sammen med den blakkede (isabel) farve og den kompakte krop.
- **Ved 48 px** kan børsten ligne en lille krone eller hårspænde. Det var også mit eneste alternativ i blindtesten. Det ændrer ikke arten og trækker ikke mod enhjørning.

### 2.6 Egernets farver

**Grundlag:** `species-squirrel.png` (kortene x0 = 256 + 244 · (n − 1)) og `sizes-squirrel.png`, rækken 48 px (y0 = 268).

| Farve | Pels (sRGB) | OKLCH (L / C / h) |
|---|---|---|
| c1 | 216, 112, 58 | 0,66 / 0,147 / 46° |
| c5 | 229, 192, 150 | 0,83 / 0,070 / 70° |
| c6 | 255, 162, 44 | 0,79 / 0,163 / 66° |
| Guld | 247, 201, 72 | 0,85 / 0,150 / 89° |

- **Målte afstande (OKLab, pelsen i arket):**
  - c5–guld er 0,090,
  - c6–guld er 0,090,
  - c5–c6 er 0,102,
  - c1–c6 er 0,144.

  Alle er over ARTFIX-F's mål på 0,08.
- **c5 mod guld:** c5 er en bleg sandfarve med lav mætning og brun kontur. Guld er mættet gul med glimt og lys mave. De skilles straks, også ved 48 px.
- **c6 mod guld:** c6 er mandarinorange og guld er gul. Forskellen er tydelig i alle tre stadier og ved 48 px (`sizes-squirrel.png`, kort 6 og 7).
- **c5 mod c6:** Bleg sand mod mættet orange, så de skilles let.
- **c6 mod c1:** Lys mandarin mod mørkere rustrød. De skilles på lyshed, også ved 48 px.
- **Rettet.** Paletten forbliver 4, fordi c1 og c6 stadig begge er "orange egern".

### 2.7 Hestebakkernes skygge

- **Grundlag:**
  - `scene-bakke/` i alle tre formater og alle tiers, især `1180x820-start.png` og `1180x820-silver.png` (2360 × 1642).
  - Det levende kort i 393 × 852 og 1180 × 820 med Hestebakkerne åbnet (Hundredemarken, Dobbeltdalen og Tyvebroen).
  - Skyggesiden står nu med 0,22–0,26 i paletens skyggetone, mod 0,11–0,17 i r3 (5d2aa42).
- **Formskygge:** Ja. Alle fire lag har en lys side mod solen øverst til venstre med det varme højlys langs kammen og en tydelig skyggeside mod højre og nedad:
  - **Mellembakken:** Skyggen starter ved kammens top og breder sig ned mod huset og åen (`1180x820-start.png` (1170–1800, 830–1290)).
  - **Forgrunden:** Skyggekilen starter ved kammen og bliver bredere nedad (`1180x820-start.png` (615–1245, 1280–1500)).
  - **De fjerne bakker:** Smalle skyggefolder hænger ned fra kammen (y ≈ 470–700).

  Den flade cel-skygge passer til dyrenes stil. Den ligger samme vej som jordskyggerne, så scenen har ét lys. Skyggerne læses som bakkernes runde form og ikke som mørke marker eller huller.
- **Luftperspektiv:** De fjerne bakker er svagere end forgrunden, så dybden holdes.
- **Sten og skilte:** Stadig læsbare.
  - På det levende kort ligger stenene og regionsskiltene ("Hundredemarken", "Dobbeltdalen" og "Tyvebroen") på regionens lyse slør, så scenens skygger ikke rører kontrasten.
  - Aktive sten (orange og blå kant) og låste sten (dæmpet lilla med lås) skilles tydeligt.
  - Huset, broen, boden, fårene og hestene står alle på eller ved den lyse side og er klare.
  - I `*-blandet.png` ligger pladsholderne for sten og skilte også på sløret.
- **Rettet.**

### 2.8 Fit-matrixen pr. sæt

- Matrixen er 9 ark, et pr. sæt (`fitmatrix-<sæt>.png`), og hvert felt lint'es for tomme flader. Den største papirflade er 3,6 %, og den mindste tegning er 19–20 % af feltet.
- `fitmatrix-ridder.png` (2008 × 10684) er helt tegnet: 36 rækker (art · stadie) · 7 kolonner.
- **Rettet.**

## 3. Nye fejl

Nummereringen fortsætter efter T15 og B16.

**T16. Pandaens arm dækker skjoldets venstre del: ca. halvdelen i stadie 3 og ca. 1/3 i stadie 2. Mindre fejl, men kravet om mindst 3/4 er ikke opfyldt.**
- **Hvor:**
  - `fit-panda.png`, rækken "ridder-hand" (y0 = 8894), stadie 2 (1024–1772, 8894–9170) og stadie 3 (1792–2540, 8894–9170). Tydeligst i stadie 3 · farvesæt 1 (2048–2284, 8894–9170).
  - `fitmatrix-ridder.png`, panda · 2 og panda · 3 (1482–1694, 8344–8580) og (1482–1694, 8632–8868).
  - Pandaens skjoldkort (`sizes-panda.png` (2404–2844, 3696–3824)), hvor ca. 2/3 af skjoldet ses.
- **Fejlen:**
  - Skjoldet er løftet til brysthøjde (T15). Dér ligger pandaens mørke arm hen over skjoldets venstre side, og poten sidder under skjoldet.
  - Det ser ud, som om pandaen krammer skjoldet bagfra, ikke som et skjold, der holdes foran kroppen.
  - Der ses hverken rem eller hånddel.
  - I G2-r3 sad skjoldet ved maven på de runde kroppe og "så rigtigt ud", så fejlen er ny i denne runde.
- **Ret sådan:**
  - Lad `art.over` også gælde pandaens arm (armmønstret), så skjoldet tegnes over armen, og vis grebet med poten over skjoldets nederste venstre hjørne som hos hamsteren.
  - Kan det ikke lade sig gøre, så flyt skjoldet ca. 8–10 enheder udad på pandaen, så mindst 3/4 ses.
  - Tjek bagefter kort 16–18 og `fitmatrix-ridder.png`.

**T17. Vædderkaninens øre ligger over skjoldets øverste tredjedel i stadie 2. Lille.**
- **Hvor:** `fit-rabbit.png`, rækken "ridder-hand" (y0 = 8926), stadie 2 · farvesæt 1 · vædder (1280–1516, 8926–9202).
- **Fejlen:** Det hængende øre og poten dækker skjoldets top, så kun ca. 2/3 ses. Stadie 1 og 3 er fri.
- **Ret sådan:** Sæt en override på skjoldet for vædder · stadie 2 (fx dy +6 eller dx +4), så øret ender over skjoldets kant.

**B17. Rævens skjoldkort fylder kun ca. 45 % af kortet.**
- **Hvor:** `sizes-fox.png`, Ridder "på dyret", kort 16–18 (2404–2844, 3696–3824).
- **Fejlen:**
  - Kortet er beskåret fra snuden til poterne, så skjoldet kun er ca. 57 af 128 px højt. På de andre 11 arter er det 74–80 px (58–62 %).
  - Skjoldet er tydeligt og i alle tre farvesæt, men kortet læses mest som "rævens bryst".
- **Ret sådan:** Beskær håndkortet om skjold og pote som på hesten, så skjoldet fylder mindst 55 %. Snuden må gerne skæres væk, og øjnene er alligevel uden for kortet.

## 4. Scores

Hver art er bedømt for sig. **Fed** er ændret i forhold til G2-r3. Scores, som denne runde ikke rører, er overtaget fra G1-r4, G2-r1 og G2-r2 (uændret i G2-r3).

| # | Kriterium | Kanin | Kat | Hvalp | Pindsvin | Hest | Lam | Ræv | Hamster | Enhjørning | Panda | Egern | Ugle |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 2 | Silhuet | 5 | 4 | 4 | 5 | **5** | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 3 | Proportioner | 5 | 5 | 5 | 4 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 4 | Kontur | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 5 | Palet | 5 | 5 | 5 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 | 5 |
| 7 | Pasform | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 8 | Animation | 4 | 5 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 9 | Butikskort ved 64 px | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| 10 | AAA-finish | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 |
| | **Middel** | **4,5** | **4,5** | **4,4** | **4,4** | **4,4** | **4,5** | **4,4** | **4,4** | **4,5** | **4,4** | **4,4** | **4,4** |

**Begrundelser for det, denne runde rører:**
- **Hest, silhuet 4 → 5:**
  - Fjordbørsten fjerner r3's eneste usikre hest (fjordføllet mod enhjørning).
  - Alle 9 heste var "sikre" i blindtesten, og racerne kan skilles i sort: børste, pjusket pandelok med sideman og vifte-pandelok med sideman.
  - Dermed er rubrikkens 5-beskrivelse opfyldt.
  - Genkendelighed ved 48 px forbliver 4, fordi børsten ved 48 px kan ligne en lille krone.
- **Pasform (7), alle arter 4:**
  - Skjoldet sidder nu rigtigt på de høje kroppe (T15 rettet), og A17 virker på uglen.
  - Pandaens T16 og vædderens T17 er mindre fejl af samme type og omfang som T15, som G2-r3 bedømte til 4. De holder pandaen og kaninen på 4.
  - Ingen art er hævet til 5. T16 og T17 står tilbage, det samme gør de kendte begrænsninger (T5, de lige ærmer på hest og enhjørning, og T6, festhatten på enhjørningen), og jeg har ikke gennemgået alle 74 genstande igen.
- **Butikskort (9), alle arter 4:**
  - B15 og B16 er rettet, og øje-lint'et dækker alle håndkort.
  - Rævens B17 er en mindre fejl i ét af ca. 50 kort. Skjoldet kan genkendes, så ræven forbliver 4.
- **Kontur (4):**
  - Lommerne hos kanin, lam, hamster og panda er fyldt, og jeg har ikke fundet nye lommer.
  - Konturen forbliver 4 på grund af de kendte små sømme og antialias i samlingerne, som før.
- **Palet (5):**
  - Egernets c5 og c6 er rettet, men egernet forbliver 4 (§2.6).
  - Bakkernes skygge er en scene og ikke en art.

## 5. Rettelser i prioriteret rækkefølge

Intet blokerer gaten. Punkterne her er de dele af briefens tjek, der ikke er opfyldt (skjoldet mindst 3/4 synligt og kortet mindst 50 %), plus én valgfri forbedring.

1. **T16, pandaens skjold:**
   - Tegn skjoldet over pandaens arm (lad `art.over` også gælde armmønstret).
   - Vis grebet med poten over skjoldets nederste venstre hjørne.
   - Alternativt: flyt skjoldet 8–10 enheder udad på pandaen.
   - Krav: mindst 3/4 af skjoldet ses i alle 9 celler (`fit-panda.png` y0 = 8894) og på kort 16–18.
2. **B17, rævens skjoldkort:**
   - Beskær kort 16–18 (`sizes-fox.png` (2404–2844, 3696–3824)) om skjold og pote, så skjoldet fylder mindst 55 %, som på hesten.
   - Overvej et lint-tal for håndkort "på dyret": genstandens største udstrækning på mindst 50 % af kortet, som lint'en for "genstanden alene".
3. **T17, vædderens øre:**
   - Sæt en override for vædder · stadie 2 (dy +6 eller dx +4), så øret ikke dækker skjoldets top (`fit-rabbit.png` (1280–1516, 8926–9202)).
4. **Valgfrit, Talmagikerens kort på de høje kroppe:**
   - Lad stjernestaven bruge `art.over` på kat, hvalp, hest, enhjørning og ræv, eller drej den mere skråt ud, så skaftet ses foran forbenet (`sizes-<art>.png` (2404–2844, 3848–3976)).
   - Det er det, der mangler for 5 på Talmagikerens butikskort.

## Bilag A: koordinatsystem

- **`silhouettes.png` (= blindarket `sheet-r8.png`, 2808 × 2904):**
  - #n har midte ved x ≈ 199 + 293,6 · ((n − 1) mod 9).
  - Silhuetrækkerne ligger ved y ≈ 237–513, 614–891, 992–1267, 1402–1645, 1767–2024, 2126–2398 og 2502–2775.
- **`fit-<art>.png`:**
  - Som i G2-r3 bilag A: kolonnerne har x0 = 256 + 256 · (k − 1), og k = 1–3, 4–6 og 7–9 er stadie 1, 2 og 3 i farvesæt 0, 1 og 2. Felterne er 236 × 276. Racerne skifter med farvesættet: farvesæt 0, 1 og 2 er race 1, 2 og 3 (hos kaninen upright, vædder og løvehoved).
  - Ridder-hand har y0 = 8926 (kanin, kat, hest og enhjørning) eller 8894 (de andre).
  - **Uglen:**
    - håndrækkerne har y0 = 1752 (hverdag), 3538 (opdager), 5324 (rytter), 7108 (kongelig), 8894 (ridder), 10680 (talmagiker), 12466 (pirat) og 15144 (slikkepind),
    - "hele sættet" har y0 = 16036, 16334, 16632, 16930, 17226, 17524, 17822, 18120 og 18418 (hverdag, opdager, rytter, kongelig, ridder, talmagiker, pirat, milepæle 1 og milepæle 2),
    - "tøj i alle humør" har y0 = 18802 + 298 · j, hvor Ridder er 22076 og 22374, og Talmagiker er 22672 og 22970.
- **`fitmatrix-<sæt>.png`:**
  - Kolonnerne (sættets 6 slots og hele sættet) har x0 = 262 + 244 · (c − 1). Felterne er ca. 212 × 236.
  - Rækkerne (art · stadie) har y0 = 280 + 288 · r, i artsrækkefølgen fra `SPECIES_IDS`. Pandaen er r = 27–29.
- **`sizes-<art>.png`:**
  - Kort k har x0 = 64 + 156 · (k − 1) og er 128 × 128. Kort 16–18 er håndkortene i farvesæt 0, 1 og 2.
  - "Genstanden alene" har y0 = 1636 + 152 · i, og "på dyret" har y0 = 3088 + 152 · i, hvor Ridder er i = 4 og Talmagiker i = 5.
  - 48 px-kortene har y0 = 268.
- **`species-<art>.png`:**
  - Kort x0 = 256 + 244 · (n − 1) for c1–c6, guld og regnbue.
  - Hestens fjord-afsnit har y0 = 1628, 1916, 2204 og 2492 (stadie 1, 2, 3 og stjerneformen).
- **`holes.png`:**
  - Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28).
  - Rækkerne starter ved y0 ≈ 212 + 161,7 · ⌊(n − 1) : 28⌋ (målt: 214, 376, 538 …).
  - Rækkefølgen er arter → racer → stadier → (8 farver i hvile, derefter c1 og c4 i de andre 6 humør). Vædderen har alle 8 farver i alle humør, og enhjørningeføllet har også stjernehvid.
- **Scenepaneler:** `scene-<verden>/<b>x<h>-<tier>.png` i 2x (fx 2360 × 1642 for 1180 × 820).
- **Det levende kort:**
  - Mine optagelser ligger lokalt i REV8's scratchpad (`rev8live/`) og er ikke committet.
  - De kan genskabes på dev-serveren med `?worlds=all` og profilopskriften fra `loop.e2e.mjs`, hvor `unlocked.worlds` får `bakke` og `skov`, og ruten er `{ id: 'map', world: 'bakke' }`.
