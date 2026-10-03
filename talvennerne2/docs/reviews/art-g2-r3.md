# Kunst-review, bølge 2 runde 3 (G2 · r3): Ridder, Talmagiker og status efter ARTFIX-D1, ARTFIX-D2 og SCENEFIX

- **Reviewer:** REV7. Jeg er frisk og uafhængig: jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i tidligere runder.
- **Opgave:**
  - første review af mestringssættene Ridder og Talmagiker (12 genstande),
  - status på forbeholdene i G2-r2 §6 efter ARTFIX-D1, ARTFIX-D2 og SCENEFIX,
  - regressionstjek af de ændrede arter,
  - et kort tjek af scenernes nye skygger og de dæmpede låste sten,
  - ny blind silhuettest.
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §7 og §11, `docs/reviews/art-g2-r2.md` (alt) og `art-g2-r1.md` §3.
  - Alle ark genereret i `/home/user/wt/rev7/talvennerne2/artifacts/sheets/` 3. okt. 2026 kl. 14:43–14:57 UTC fra 1cab26a (`npx vite build --mode sheets` + `node scripts/sheets.mjs`, `SHEETS_PORT=4357`, Chromium bag `flock`). Alle sider gav "ok", og ingen lint fejlede.
  - **Det levende kort** på dev-serveren (port 4357, `?worlds=all`) i 393 × 852 og 1180 × 820 (2x). Profilen er lavet som i `loop.e2e.mjs`, og Hestebakkerne og Regnbueskoven er åbnet i profilen.
- **Uafhængighed:**
  - Jeg har ikke læst kunstens kildekode. Kode har jeg kun åbnet for at betjene værktøjerne:
    - `sheets.mjs` (lås og port),
    - silhuetrutens blanding (facit),
    - holes-rutens rækkefølge (flisenumre),
    - kortets URL-parameter og opskriften i `loop.e2e.mjs` (fotos af kortet).
  - `git diff --stat` har jeg kun brugt til at se, hvilke arter der er ændret.
  - Fra `lint.json` har jeg kun brugt huller-rapportens liste over kendte lommer, fordi forbeholdet handler om lint'en selv.
- **Metode:**
  - Alle relevante ark er set i oversigt og derefter i udsnit med 1,5–3× zoom.
  - Pasformen er bedømt på `fit-<art>.png` for alle 12 arter: Ridder- og Talmagiker-rækkerne (9 celler hver) og de fire nye rækker i "tøj i alle humør".
  - Butikskortenes fyld er målt maskinelt.
  - Huller er fundet maskinelt i `holes.png` som lukkede magenta-områder, både med en streng og en mild magenta-grænse. Et område, der kun er lukket ved den strenge grænse, er antialias og ikke en lomme.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1). Koordinatsystemerne står i bilag A.
- **Skalaen:**
  - 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
  - For de arter, der allerede har bestået, har jeg kun ændret en score ved en ny fejl eller en regression. Det har ikke været nødvendigt.

## Resultat

| Sæt | Pasform | Butikskort | Afgørelse |
|---|---|---|---|
| **Ridder** | **4** | **4** | **Bestået.** Forbehold: T15 (skjoldet på de høje kroppe) og B15 (skjoldkortet). |
| **Talmagiker** | **4** | **4** | **Bestået.** Forbehold: B16 (stjernestavens kort skærer gennem øjnene på fire arter). Pasformen er tæt på 5. Kun den kendte T5-detalje (lige ærmer på hest og enhjørning) trækker ned. |

**Forbeholdene fra G2-r2 §6 (22 punkter):**

| Status | Antal | Punkter |
|---|---|---|
| Rettet | 18 | |
| Delvist rettet | 2 | Huller-lint'en (kendt-listen) og festhatten (T6/B6, kendt begrænsning). |
| Ikke rettet | 1 | T5-detaljen (kendt begrænsning). |
| Delt status | 1 | Lyset: jordskyggerne er rettet, og bakkernes skyggeside er svag. |

Detaljerne står i §3.

**Arterne:** Alle tolv har bestået som før, med uændrede scores (§4). Jeg har ikke fundet regressioner. Enkelte arter er forbedret: hestens silhuet og uglens håndkort og regnbue.

**Scenerne:** De låste sten er tydeligt låst og stadig læsbare. Ikonet har ca. 5–6:1 kontrast mod det dæmpede felt. Jordskyggerne ligger nu væk fra solen (§5).

**Blindtesten:**
- 60/60 rigtige på art. Dermed er alle 20 racer og alle stadier ramt, og kravet i rubrikkens accept-afsnit er opfyldt.
- 56 svar var "sikre" og 4 "usikre" (r2: 51 og 9). Alle 4 usikre var rigtige.
- Shetland- og araberhestene med det nye pandehår var alle "sikre" (r2: alle seks usikre).

**Det vigtigste nye fund:** Stjernestavens butikskort skærer gennem øjnene på kanin, lam, hamster og panda (B16). Det er samme fejl som B13, som netop er rettet for gulerod og scepter.

## 1. Blindtesten

- `art-g2-r3-blind.md` blev committet (30d0bff), før rubrik, reviews, kode og kontaktark blev åbnet.
- Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket (SHA-256 `1b0a2a31…8e4bd7f3` for begge).
- Facit er beregnet ud fra silhuetrutens blanding (`BLIND_SALT` 8,3) og sammenlignet med mine svar ét for ét.

| | r2 (REV6) | r3 (REV7) |
|---|---|---|
| Rigtige på art | 60/60 | 60/60 |
| Sikre / usikre | 51 / 9 | 56 / 4 |
| Usikre | 3 vædderkaniner og 6 shetland- og araberheste | 3 vædderkaniner (#4, #11, #27) og fjordføllet (#55) |

- **Stadierne:** Mine angivelser af "lille", "mellem" og "stor" passer alle med stadie 1, 2 og 3.
- **Racerne:**
  - Kaninens, kattens, fjordhestens og bølgemankens tre figurer grupperede jeg rigtigt i noterne.
  - Shetland og araber beskrev jeg begge som "lav tot med sideman". Mine noter skiller dem ikke sikkert ad: #30 (araber) står blandt shetlænderne. Det samme gælder føllet og stjernehornet.
  - Kravet gælder arten, men skellet mellem shetland og araber i sort er svagt.
- **Pandehåret på shetland og araber virker.** Hestene med lav buklet tot og lang sideman (#20, #30, #35, #37, #49 og #58) var alle "sikre". Det var r2's svageste skel.
- **Det nye svageste skel er fjordføllet mod enhjørningen** (#55, fjord · stadie 1).
  - Fjordhestens opretstående kam er en vifte af små takker. I lille størrelse smelter den sammen til én stump spids, der ligner et horn.
  - Som stor (#59) og mellem (#60) kan den skilles fra enhjørningen.
  - Fjordtoppen er ikke ændret i denne runde, så det er en observation og ikke en regression. REV6 noterede også, at fjordføllet og enhjørningsføllet var de mest ens figurer.
- **Uændrede forvekslingspar:**
  - Vædderkanin ↔ hvalp: pomponhalen, de lange fødder og krøllen i panden afgør det.
  - Panda ↔ isbjørn: bambussen afgør det.
  - Hamster ↔ panda eller isbjørn: kindposerne afgør det.
  - Kat med dusk-ører ↔ ræv: knurhårene afgør det.
  - Kanin med uldkinder ↔ lam.
- **Kattens nye krave** (#32, #44, #50 og #52) ses som en buklet bule ved halsen og trækker ikke mod ræv.

## 2. Ridder og Talmagiker

**Genstandene:**

| Sæt | Hoved | Ansigt | Hals | Krop | Ryg | Hånd |
|---|---|---|---|---|---|---|
| Ridder | Hjelm med fjerbusk | Heltemaske | Medalje i kæde | Våbenkjortel | Kappe | Skjold |
| Talmagiker | Troldmandshat med stjerner | Stjernebriller | Medaljon med "7" | Kjortel med bælte | Stjernekappe | Stjernestav |

**Grundlaget:**
- `fit-<art>.png`:
  - Ridder har rækkerne y0 = 7438–8926, og Talmagiker har y0 = 9224–10712. Hos otte af arterne er det 32 px mindre (se bilag A).
  - Hver række har 9 celler: stadie 1–3 · farvesæt 0–2.
  - "Tøj i alle humør" har y0 = 22108, 22406, 22704 og 23002: baby og stor i hvert sæt og alle 7 humør.
- `sizes-<art>.png`: Ridder og Talmagiker alene har y0 = 2244 og 2396, og "på dyret" har y0 = 3696 og 3848. Kortene er 1–18.

### 2.1 Det, der virker

- **Hornhul:**
  - Ridderhjelmen har hornet op gennem kuplen, og fjerbusken sidder ved siden af hornet (`fit-unicorn.png` (256–2540, 7438–7714)).
  - Troldmandshatten sidder mellem ørerne med hornet foran keglen. Keglen og stjernerne ses på begge sider af hornet (`fit-unicorn.png` (256–2540, 9224–9500)).
  - Begge læses rigtigt i alle 9 celler.
- **Intet dækker øjnene:**
  - Heltemasken har øjenhuller, og øjnene med højlys ses på alle 12 arter, også på mørk pels: sort lam, sort egern, mørk hest og natugle.
  - Stjernebrillerne har klart glas, og iris og højlys ses, også på mørk pels (fx `fit-lamb.png` (552–708, 9530–9650) og `fit-panda.png` (1832–1988, 9530–9650)). Det gælder også i "tænker", hvor øjnene sidder tæt (rækkerne y0 = 22704 og 23002, kolonne 4).
- **Uglens ryg:**
  - Kapperne tegnes ikke på uglen. Rygslottet er låst som i SPEC §7.1.
  - Rygkortene viser uglen beskåret, kappen alene og en lås i alle 3 farvesæt i begge sæt (`sizes-owl.png` kort 13–15 (1936–2376, 3696–3824) og (1936–2376, 3848–3976)).
- **Ærmerne:**
  - Kjortlerne følger kroppene (round, pear og tall), og ærmerne følger de løftede arme i jubel og vinker på alle arter (fit-arkene, rækkerne y0 = 22406 og 23002, kolonnerne jubel og vinker).
  - På ugle og pindsvin ligger ærmerne som puffede ærmer over vinger og pigge uden at gå uden for kroppen.
  - Ærmerne er lige rør på hest og enhjørning (T5, kendt begrænsning, se §3).
- **Hals og ryg:** Medalje, medaljon og kapper sidder rigtigt på alle stadier.
- **Farvesættene:** De tre sæt er klart forskellige i begge sæt.
  - Ridder: sølv/rød, guld/blå og sort/grøn.
  - Talmagiker: natblå/guld, violet/pink og petrol/grøn.
- **Genstandene alene:**
  - Alle 36 kort fylder 78–83 % af kortet i den største retning (målt maskinelt uden kortets skygge; kravet er ≥ 50 %).
  - Genstandene er tydelige og har mørk kontur (`sizes-rabbit.png` (64–2844, 2244–2372) og (64–2844, 2396–2524)).
- **Kortene "på dyret":**
  - Hjelm, maske, briller, medalje og kjortler er tydelige og godt beskåret på alle 12 arter.
  - Kappekortene følger det format, der blev godkendt som B3 for Milepæle-kappen.

### 2.2 Scores og gate

| Sæt | Pasform | Butikskort | Begrundelse |
|---|---|---|---|
| Ridder | 4 | 4 | Alt sidder rigtigt på alle 12 arter, alle stadier og farvesæt. Til 5 mangler T15 (skjoldet står ved hovene på de høje kroppe) og B15 (skjoldkortet viser kun en stribe skjold på hest, ræv og enhjørning). |
| Talmagiker | 4 | 4 | Pasformen er ren på alle arter. Kun T5-detaljen (lige ærmer på hest og enhjørning) skiller den fra 5. Til 5 på kortene mangler B16. |

**Gate:** Begge sæt består (pasform og butikskort ≥ 4). Ingen genstand sidder forkert på alle arter, og ingen dækker øjnene.

### 2.3 Nye fejl (ark og celle)

Nummereringen fortsætter efter T14 og B14.

**T15. Ridderskjoldet står ved hovene og halvt bag forbenet på de høje kroppe (hest, enhjørning og ræv). Mindre fejl.**
- **Hvor:**
  - `fit-horse.png` og `fit-unicorn.png`, rækken "ridder-hand" (y0 = 8926), alle 9 celler. Tydeligst i stadie 3 (1792–2540, 8926–9202).
  - `fit-fox.png`, rækken y0 = 8894, stadie 3 (1792–2540, 8894–9170).
- **Fejlen:**
  - Skjoldet sidder ved den højre forhov nede ved jorden, og benet tegnes over skjoldets venstre del.
  - Det læses som et skjold, der læner sig op ad benet, ikke som et skjold, dyret holder.
  - På de runde kroppe holdes skjoldet i poten ved maven og ser rigtigt ud (fx `fit-rabbit.png` (1792–2028, 8926–9202)).
- **Ret sådan:**
  - Løft skjoldet til brysthøjde på kropsskabelonen tall, fx med en rem over forbenet, eller tegn det foran benet, så mindst 3/4 af skjoldet ses.
  - Tjek bagefter hånd-rækkerne i alle tre fit-ark og kortene i B15.

**B15. Skjoldkortet viser kun en stribe skjold på hest, ræv og enhjørning.**
- **Hvor:**
  - `sizes-horse.png`, `sizes-fox.png` og `sizes-unicorn.png`, Ridder "på dyret", kort 16–18 (2404–2844, 3696–3824).
  - Lidt også på kat og hvalp, hvor forbenet krydser skjoldets venstre side.
- **Fejlen:** Følger af T15. På hesten ses kun en smal gul-rød stribe mellem benene, og genstanden kan næsten ikke genkendes ved 64 px.
- **Ret sådan:** Følger af T15. Kan T15 ikke rettes, så beskær håndkortet om skjoldet med benet ude i kanten, så skjoldet fylder mindst 50 % af kortet.

**B16. Stjernestavens kort skærer gennem øjnene på kanin, lam, hamster og panda.**
- **Hvor:** `sizes-rabbit.png`, `sizes-lamb.png`, `sizes-hamster.png` og `sizes-panda.png`, Talmagiker "på dyret", kort 16–18 (2404–2844, 3848–3976).
- **Fejlen:**
  - Beskæringen centrerer om stjernen, som sidder højt ved kinden. Derfor skærer kortets overkant gennem øjet, og på pandaen gennem øjenpletten.
  - Det er samme fejl, som B13 rettede for gulerod og scepter.
  - Staven selv er skjult bag poten, så kortet viser "en stjerne" mere end "en stav".
  - På de otte andre arter går beskæringen under øjnene, og kortet er i orden.
- **Ret sådan:**
  - Beskær håndkortet om poten og hele staven under øjnene, som for B13.
  - Lad gerne staven gå skråt ud af poten, så både skaft og stjerne ses.
  - Kør samme tjek, som lint'en for kropskort har ("aldrig gennem øjnene"), også på håndkortene.

## 3. Status på forbeholdene i G2-r2 §6

### 3.1 Proces

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | `scene.png` | **Rettet** | Scenerne er én side pr. verden, og hvert panel fotograferes for sig (`scene-<verden>/<b>x<h>-<tier>.png`). Lint'en for tomme flader kører: den største papirlyse flade er 0,32 % (eng og bakke) og 0,19 % (skov). Oversigterne `scene-bakke.png` og `scene-skov.png` (2484 × 6197) er hele. |
| 2 | Huller-lint'en | **Delvist rettet** | Se nedenfor. |

**Huller-lint'en:**
- Lint'en ser nu på figurens alfakanal i arkets opløsning, og de lommer, G2-r2 nævnte, er væk i `holes.png`:
  - #302, #460, #466 og #709–#723 har ingen lukkede områder,
  - #1301 og #1307 har kun en enkelt antialias-pixel tilbage, fx (1787–1788, 7721–7722).
- Men lint'en har fået en liste over "kendte" lommer, som står i rapporten uden at fejle. Det er 5 lommer i 28 fliser:
  - kanin · vædder · 2 · tænker i alle 8 farver (#127, #133, #139, #145, #151, #157, #163 og #169, fx (2010, 963)),
  - lam · 3 · jubel c1/c4 (#818 (833, 4972) og #824 (1649, 4972)),
  - hamster · 3 · hvile i alle 8 farver (#929–#936, to lommer pr. flise. De er under én pixel og ses ikke i PNG'en),
  - panda · 3 · sover c1/c4 (#1184 (1041–1042, 7092) og #1190 (1857–1858, 7092)).
- Lommerne er 1–3 px i arkets opløsning (højst 1,5 enheder) og kan ikke ses i spilstørrelse. Kaninens lomme bryder dog rubrikkens regel om, at kaninen ikke må have én eneste lukket pixel. En lint, der kan "kende" en fejl væk, fejler ikke længere på den.

### 3.2 Enhjørning

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | T6 og B6, festhatten | **Delvist rettet (kendt begrænsning)** | Se nedenfor. |
| 2 | B5, skægget | **Rettet** | Hele skægget er med, og beskæringen går under spidsen (`sizes-unicorn.png`, Pirat "på dyret", kort 4–6 (532–972, 4000–4128)). |
| 3 | Sprækkerne #1028, #1048 og #1068 | **Rettet** | Der er ingen lukkede områder. Kun enkeltpixel-antialias i #1047 (1521, 6327) og #1050 (1872, 6304). |

**Festhatten (T6 og B6):**
- Keglen står nu til venstre for hornet med pomponen øverst, og hornet står frit (`fit-unicorn.png`, rækken "fest-head · under", y0 = 12794, alle 9 celler, fx (1792–2028, 12794–13070)).
- Flæsen ved hornets fod læses stadig som en krøllet tot.
- Kortet (`sizes-unicorn.png`, Fest "på dyret", kort 1–3 (64–504, 4152–4280)) viser kegle, pompon og horn side om side og kan læses som en festhat.

### 3.3 Ugle

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | Jubel-lommen (#1301, #1307) | **Rettet** | Kun 1 px antialias, og lint'en melder intet. Heller ikke i filmstrimlen ses et hul mellem den løftede vinge og kroppen (`filmstrip-owl.png`, jubel-rækken y0 ≈ 887). |
| 2 | B14, håndgenstandene | **Rettet** | Vingespidsen griber gulerod og scepter foran vingen, og guleroden kan genkendes ved 64 px (`sizes-owl.png`, Rytter og Kongelig "på dyret", kort 16–18 (2404–2844, 3392–3520) og (2404–2844, 3544–3672)). |
| 3 | Regnbuen | **Rettet** | Fjerørerne og halefjerene er stribede, så regnbueuglen ikke ligner c2 sne (`species-owl.png`, x0 = 1964). |

### 3.4 De øvrige arter

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | Hest: araber-lommen (#709–#723) | **Rettet** | Ingen lukkede områder. |
| 1 | Hest: en hestetypisk detalje på shetland og araber | **Rettet** | Pandetotten er naturlig (`closeup-horse.png`, shetland (62–933, 210–1276)). Alle seks heste var "sikre" i blindtesten (r2: alle seks "usikre"). |
| 2 | Kat: #302, #460 og #466 | **Rettet** | Ingen lukkede områder. |
| 3 | Kanin K2: squash og nik | **Rettet** | Se nedenfor. |
| 4 | Egernets c1 mod c6 | **Rettet** | c6 er nu gylden orange og klart skilt fra c1 rød (`species-squirrel.png`, x0 = 1476 mod x0 = 256). |
| 4 | Rævens regnbue mod c2 polar | **Rettet** | Varm creme krop og stribet hale (`species-fox.png`, x0 = 1964 mod x0 = 500). |
| 5 | Lammets håndkort (B13) | **Rettet** | Gulerod- og scepterkortet er beskåret fra munden og ned, og øjnene er ikke med (`sizes-lamb.png`, kort 16–18 (2404–2844, 3392–3520) og (2404–2844, 3544–3672)). Den nye stjernestav har dog fejlen igen (B16). |

**Kaninens næse (K2):** Nærbilledet er `filmstrip-rabbit.png`, y0 ≈ 3088, og frame k har x0 = 64 + 360 · (k − 1).
- I frame 2, 4 og 6 er næsen 18 × 8–9 px, mod 16 × 10 px i de andre frames. Det er en squash på ca. 0,85.
- Næsen flytter sig lodret mellem y = 3297 og y = 3324 i et nik.

### 3.5 Sæt

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | B9, sadeltasken på dyret | **Rettet** | Rygkortet er beskåret om hofte og pose. Posen med spænde fylder ca. 1/3 af kortets højde og læses som en taske (`sizes-hamster.png`, `sizes-horse.png` m.fl., Rytter "på dyret", kort 13–15 (1936–2376, 3392–3520)). |
| 2 | T5-detaljen: smallere ærmer forneden på hest og enhjørning | **Ikke rettet (kendt begrænsning)** | Ærmerne er lige rør. Det gælder også den nye Talmagiker-kjortel (`fit-horse.png`, y0 = 10116, stadie 3 (1792–2540, 10116–10392)). |
| 3 | T2-detaljen: hjertebrillerne på hvalpebabyen | **Rettet** | Hjertespidserne går fri af mulen (`fit-puppy.png`, rækken "milepael-hjertebriller", y0 = 13656, stadie 1 (256–1004, 13656–13932)). |

### 3.6 Scener

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | Stenenes kontrast | **Rettet** | Se §5. |
| 2 | Hesten i guld ved åkanten | **Rettet** | Den mørkebrune hest græsser nu bag hegnet på folden, ca. 35 px (1x) fra åen (`scene-bakke/1180x820-gold.png` (1820–1920, 1345–1410)). |
| 3 | Lys: jordskygger væk fra solen og skyggeside på bakkerne | **Rettet** og **delvist** | Se nedenfor. |
| 4 | Regnbueskoven på telefon | **Rettet** | Himlen (sol, skyer og i guld regnbuen) fylder de øverste ca. 33 % (`scene-skov/393x852-gold.png`, y 0–560 af 1704), mod ca. 42 % i r2. Plateauet og tårnet står højere. |

**Lyset (punkt 3):**
- **Jordskyggerne er rettet.** De ligger til højre og nedad, væk fra solen øverst til venstre. Fx har træet ved (1640–1740, 780–915) skyggen ved (1670–1765, 908–928) i `scene-bakke/1180x820-silver.png`. Det samme gælder huset, broen, boden og træerne i Regnbueskoven.
- **Bakkernes skyggeside er svag.** Bakkerne har en svag, mørkere grøn skyggeside mod højre (`scene-bakke/1180x820-start.png`, mellemgrunden y ≈ 820–1280).

### 3.7 De kendte begrænsninger: godt nok til et betalt produkt?

Ja, alle tre er acceptable i et betalt produkt.

- **Festhattens ekstra vip (T6):**
  - Hatten kan nu genkendes som festhat på både figuren og kortet, og hornet står frit. Det vigtigste er dermed nået.
  - Flæsen, der ligner en tot, er en detalje.
  - Vil man helt videre, kræver det en særlig tegning af festhatten til arter med horn, fx en lille kegle bundet om hornets fod. Det er ikke nødvendigt.
- **De lige ærmer (T5):**
  - Ved 48–128 px ses forskellen ikke, og ærmerne følger benene og de løftede arme.
  - Det må gerne vente til en senere rig-ændring.
- **Lommerne er kun fyldt i stillbilleder, ikke i animationen:**
  - Jeg har gennemgået jubel og vinker frame for frame for ugle, hest, kat og lam (`filmstrip-<art>.png`, rækkerne y0 ≈ 887 og ≈ 2122) og nærstuderet de højeste frames.
  - Mellemrummene mellem løftede arme og krop er åbne og læses som negativ form. Jeg ser ingen huller, der blinker.

## 4. De ændrede arter (regressionstjek)

Jeg har tjekket species-, closeup- og sizes-arkene samt holes- og filmstrip-arkene for de ændrede arter. Jeg har ikke fundet en ny fejl eller en regression, der flytter et kriterium, så ingen score er ændret.

| Art | Middel | Laveste | Afgørelse | Det ser jeg nu |
|---|---|---|---|---|
| Kat | 4,5 | 4 | Bestået (uændret) | Lommerne er rettet. Langhårskattens krave er rund og ren (`closeup-cat.png` (964–1835, 210–1276)). |
| Hvalp | 4,4 | 4 | Bestået (uændret) | Hjertebrillerne går fri af mulen. |
| Pindsvin | 4,4 | 4 | Bestået (uændret) | Ingen ændringer, der ses. Ridder og Talmagiker sidder rent mellem piggene. |
| Hest | 4,3 | 4 | Bestået (uændret) | Pandetotten er en tydelig forbedring af silhuetten. T15 er et tøjfund og ikke et artsfund. |
| Enhjørning | 4,5 | 4 | Bestået (uændret) | Festhat, skæg og sprækker er rettet eller delvist rettet. Hjelmen og hatten fra Ridder og Talmagiker går rent om hornet. |
| Ugle | 4,4 | 4 | Bestået (uændret) | Alle tre punkter er rettet. |
| Kanin | 4,5 | 4 | Bestået (uændret) | K2 er rettet. Bemærk den kendte 1–2 px-lomme i vædderen · 2 · tænker (§3.1). Den er fundet af den nye lint og er ikke en regression i tegningen. |
| Egern | 4,4 | 4 | Bestået (uændret) | c6 er skilt fra c1. Ny observation: c6 ligger nu tæt på guld i grundfarven (x0 = 1476 mod x0 = 1720). Ved 48 px skilles de på glimtene og guldets lyse mave (`sizes-squirrel.png`, y0 = 268, kort 6 og 7), så scoren er uændret. |
| Ræv | 4,4 | 4 | Bestået (uændret) | Regnbuen er rettet. Skjoldet: se T15. |

Lam, hamster og panda er kun berørt af B13 (rettet) og af kendt-listen i §3.1. Deres scores er uændrede (4,5, 4,4 og 4,4).

## 5. Scenerne (kort tjek)

**De dæmpede låste sten:**
- Jeg har set dem på det levende kort i Regnbueskoven (393 × 852 og 1180 × 820) og i Hestebakkerne (393 × 852).
- En låst sten har et gråligt, dæmpet felt, et mørkt ikon og et låsemærke nederst til højre.
- Ikonet har ca. 6:1 (blyant) og ca. 5:1 (enhjørningen) kontrast mod feltet, målt i Regnbueskoven i 1180 × 820.
- Den aktive sten er stadig den eneste mættede og står klart.
- **Svar:** En låst sten er tydeligt låst, men stadig læsbar. Det er rettet for begge verdener.

**Skyggerne:** Se §3.6, punkt 3. Jordskyggerne giver nu ét lys fra øverst til venstre. Bakkernes skyggeside er svag, men findes.

**Arket:** Scenearket er nu pålideligt (§3.1, punkt 1). Jeg har kunnet bedømme scenerne direkte på panelerne uden egne elementoptagelser.

## 6. Proces-fund

1. **`fitmatrix.png` har tomme celler (proces, ikke kunst).**
   - Arket er 15428 × 10716 (ca. 165 megapixel). 420 af 2124 celler står som papirfarve:
     - kanin: r0 (kolonne 32–34) og r1–r2 (kolonne 33–34),
     - kat: r3 (21 spredte celler) og r4–r5, og hvalp: r6 (kolonne 0–34),
     - egern: r31 (kolonne 8–58) og r32, og ugle: r33–r35 (alle 59 kolonner).
   - Det er Chromiums fliser, der ikke blev tegnet, ligesom i r2's `scene.png`.
   - Pasformen er derfor bedømt på `fit-<art>.png`, der er hele.
   - **Ret sådan:** Del fitmatrix op i én side pr. art eller pr. sæt, eller fotografér den rækkevis, og tilføj samme lint for tomme flader som scenearket har.
2. **Huller-lint'ens kendt-liste** (§3.1): en lint, der kan "kende" en fejl væk, fejler ikke længere på den.

## 7. Rettelser i prioriteret rækkefølge

Intet blokerer. Begge sæt og alle arter består, så alt herunder er forbehold, der bør rettes før udgivelsen.

1. **B16, stjernestavens kort (Talmagiker):**
   - Beskær håndkortet om pote og stav under øjnene på kanin, lam, hamster og panda (`sizes-<art>.png` kort 16–18 (2404–2844, 3848–3976)).
   - Lad staven stå skråt ud af poten, så skaftet ses.
   - Udvid kortlint'en, så håndkort heller ikke må skære gennem øjnene.
2. **T15 og B15, skjoldet på de høje kroppe (Ridder):**
   - Løft skjoldet til brysthøjde, eller tegn det foran forbenet på hest, enhjørning og ræv, så mindst 3/4 af skjoldet ses (`fit-horse.png` og `fit-unicorn.png` y0 = 8926 og `fit-fox.png` y0 = 8894).
   - Tjek skjoldkortet bagefter (kort 16–18 (2404–2844, 3696–3824)).
3. **Huller-lint'ens kendt-liste:**
   - Fyld de fem lommer: vædder · 2 · tænker, lam · 3 · jubel, hamster · 3 · hvile og panda · 3 · sover (§3.1). Fyld kaninens først, fordi rubrikken kræver nul lukkede pixel.
   - Tøm derefter listen, så lint'en fejler igen.
4. **`fitmatrix.png`:** Del arket op, eller fotografér det rækkevis, og lint for tomme flader (§6).
5. **Mindre (valgfrit):**
   - Gør fjordføllets kam lavere og bredere (en børste i stedet for en vifte af takker), så den ikke smelter sammen til en hornspids i lille størrelse (blindtestens #55).
   - Flyt egernets c6 lidt mod rødorange eller brun, så den ikke ligger tæt på guld.

## Bilag A: koordinatsystem

- **`silhouettes.png` (= blindarket `sheet-r7.png`):** #n har midte ved x ≈ 212 + 300 · ((n − 1) mod 9), og rækkerne har midte ved y ≈ 376, 770, 1130, 1506, 1883, 2268 og 2642.
- **`fit-<art>.png`:**
  - Kolonnerne har x0 = 256 + 256 · (k − 1). Kort 1–3 er stadie 1, 4–6 stadie 2 og 7–9 stadie 3, hver i farvesæt 0, 1 og 2. Kortene er 236 × 276.
  - Rækker for kanin, kat, hest og enhjørning:
    - **Ridder:** hoved 7438, ansigt 7736, hals 8034, krop 8332, ryg 8628, hånd 8926.
    - **Talmagiker:** hoved 9224, ansigt 9522, hals 9820, krop 10116, ryg 10414, hånd 10712.
    - **Pirat:** 11010–12498. **Festhat:** 12794.
    - **Milepæle:** krone 13092, regnbuehue 13390, hjertebriller 13688, medalje 13986, glimmerbluse 14282, fevinger 14580, kappe 14878, slikkepind 15176.
    - **"Tøj i alle humør":** fra 18834. De nye rækker er 22108 (Ridder · baby), 22406 (Ridder · stor), 22704 (Talmagiker · baby) og 23002 (Talmagiker · stor).
  - Hvalp, pindsvin, lam, ræv, hamster, panda, egern og ugle: alle y0 er 32 px mindre.
  - I "tøj i alle humør" har kolonnerne x0 = 256 + 256 · (k − 1) for hvile, glad, jubel, tænker, ups, sover og vinker.
- **`sizes-<art>.png`:**
  - Butikskortene er 128 × 128, og kort k har x0 = 64 + 156 · (k − 1). Kort 1–3 er hoved, 4–6 ansigt, 7–9 hals, 10–12 krop, 13–15 ryg og 16–18 hånd, hver i farvesæt 0, 1 og 2.
  - "Genstanden alene" har y0 = 1636 + 152 · i, og "på dyret" har y0 = 3088 + 152 · i. Sættene er i = 0–8: Hverdag, Opdager, Rytter, Kongelig, Ridder, Talmagiker, Pirat, Fest og Milepæle.
  - 48 px-kortene har y0 = 268.
- **`species-<art>.png`:** Kort x0 = 256 + 244 · (n − 1) for c1–c6, guld og regnbue.
- **`holes.png`:**
  - Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28) og y0 = 212 + 162 · ⌊(n − 1) : 28⌋.
  - Flisernes rækkefølge er den samme som i G2-r2, fx hamster 889–948, panda 1132–1191 og ugle 1252–1311.
- **`filmstrip-<art>.png`:**
  - Frame k i humør-rækkerne har x0 ≈ 258 + 242 · (k − 1). Jubel har y0 ≈ 887, og vinker har y0 ≈ 2122.
  - Nærbilledet har y0 ≈ 3088, og frame k har x0 = 64 + 360 · (k − 1).
- **Scenepaneler:** `scene-<verden>/<b>x<h>-<tier>.png` i 2x (fx 2360 × 1640 for 1180 × 820).
- **Det levende kort:** Mine optagelser (`live-<verden>-<b>x<h>-{top,midt}.png`) og zoom-udsnit ligger lokalt i `artifacts/rev7/` i REV7's worktree og er ikke committet. De kan genskabes på dev-serveren med `?worlds=all` og opskriften i `loop.e2e.mjs`, hvor `unlocked.worlds` får `bakke` og `skov`.
