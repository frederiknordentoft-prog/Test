# Kunst-review, bølge 2 runde 2 (G2 · r2): samlet gate før Hestebakkerne og Regnbueskoven

- **Reviewer:** REV6. Jeg er frisk og uafhængig: jeg har ikke tegnet noget af det, jeg bedømmer, og jeg var ikke med i tidligere runder. Jeg har ikke læst kunstens kildekode eller `lint.json`. Kode har jeg kun åbnet for at betjene værktøjerne: silhuetrutens rækkefølge (til at rette blindtesten) og kortets URL-parametre og vælgere (til at fotografere kortet).
- **Opgave:**
  - genreview af enhjørningen (G1-r4) og uglen (G2-r1),
  - status på forbeholdene for de øvrige ti arter og for tøjsættene,
  - første review af scenerne Hestebakkerne (`bakke`) og Regnbueskoven (`skov`),
  - ny blind silhuettest.
- **Grundlag:**
  - `docs/art-rubric.md`, SPEC §5.3–5.6, §6, §7 og §11, `docs/reviews/art-g1-r4.md` (§3–§6) og `docs/reviews/art-g2-r1.md` (§3–§5).
  - Alle 77 ark genereret i `/home/user/wt/rev6/talvennerne2/artifacts/sheets/` 3. okt. 2026 kl. 07:23–07:32 UTC fra 8676052 (`vite build --mode sheets` + `scripts/sheets.mjs`, port 4349, Chromium bag `flock`). Alle 77 sider gav "ok".
  - **Egne elementoptagelser af scenerne**, fordi `scene.png` har tegnefejl (se §5.1): hvert Hestebakkerne- og Regnbueskoven-panel fra `sheets.html?sheet=scene`, fotograferet ét ad gangen på dev-serveren (port 4349, 1x).
  - **Det levende kort** i Chromium med `?worlds=all` i 393×852, 820×1180 og 1180×820 (2x), på en frisk profil efter onboarding, med de to verdener åbnet i profilen.
  - **Metode:**
    - Alle ark er set i helhed og derefter i udsnit med 1,5–4× zoom.
    - Huller er fundet maskinelt i `holes.png`: lukkede magenta-områder, der ligger inden for figurens yderkontur. Indersiden af guld- og stjernehvid-glimtene er sorteret fra (se §3.1). Tykkelsen er omregnet med 0,64 px pr. enhed.
    - Tiers er også målt: middelmætning og andel ændrede pixel mellem tiers.
- **Blindtest:**
  - `art-g2-r2-blind.md` blev committet (8676052), før noget andet blev åbnet.
  - Bagefter tjekkede jeg, at `silhouettes.png` er pixelidentisk med blindarket (SHA-256 `95f7aba4…094faac6` for begge).
  - Facit er beregnet ud fra silhuetrutens faste blanding (`BLIND_SALT` 6,2) og sammenlignet med mine svar ét for ét.
- **Koordinater:** pixel i PNG'en (2x), skrevet som (x, y) eller (x0–x1, y0–y1). Elementoptagelserne af scenerne er i 1x. Koordinatsystemerne står i bilag A.
- **Iteration:**
  - Enhjørningen: runde 5. Den blev eskaleret efter G1-r4 (4 af 4).
  - Uglen: runde 2 af højst 4.
  - Scenerne: runde 1.
- **Skalaen** er brugt som i r4 og G2-r1:
  - 4 betyder "kan sendes i et betalt produkt med små forbehold", og 5 betyder "AAA-niveau".
  - Et 5-tal kræver, at rubrikkens 5-beskrivelse er opfyldt i alle farver og stadier, jeg har set.
  - For de ti arter, der allerede har bestået, har jeg kun ændret en score ved en ny fejl eller en regression. Det har ikke været nødvendigt.

## Resultat

| Art | Middel | Laveste | Afgørelse |
|---|---|---|---|
| **Enhjørning** | **4,5** | 4 (fem kriterier) | **Bestået.** Pirathat og regnbuehue er rettet, festhatten er delvist rettet (T6), og stjernehornet og glimtet er rettet. |
| **Ugle** | **4,4** | 4 (seks kriterier) | **Bestået.** B11 er rettet: rygkortene viser genstanden med en lås. |
| Kanin | 4,5 | 4 | Bestået (uændret). R1 er rettet. |
| Kat | 4,5 | 4 | Bestået (uændret). Kasseærmerne og langhårskravens silhuet er rettet. |
| Hvalp | 4,4 | 4 | Bestået (uændret). Alle fire forbehold er rettet. |
| Pindsvin | 4,4 | 4 | Bestået (uændret). Begge forbehold er rettet. |
| Hest | 4,3 | 4 | Bestået (uændret). Regnbuehesten, ærmerne og fjordtoppen er rettet. Ny lille lomme hos araber-babyen. |
| Lam | 4,5 | 4 | Bestået (uændret). B13 er delvist rettet. |
| Ræv | 4,4 | 4 | Bestået (uændret). Den store lomme er rettet. |
| Hamster | 4,4 | 4 | Bestået (uændret). Alle forbehold er rettet. |
| Panda | 4,4 | 4 | Bestået (uændret). Alle forbehold er rettet. |
| Egern | 4,4 | 4 | Bestået (uændret). c1 og c6 er ikke skilt ad. |

| Sæt | Pasform | Butikskort | Afgørelse |
|---|---|---|---|
| Hverdag | 4 (op fra 3) | 4 | **Bestået.** T1, T5, T10 og B1 er rettet. |
| Opdager | 4 | 4 | **Bestået.** T11 og B2 er rettet. |
| Rytter | 4 | 4 | **Bestået.** T12 og T14 er rettet, B9 er delvist rettet. |
| Kongelig | 4 | 4 | **Bestået.** T13, B10 og B12 er rettet. |
| Pirat | 4 | 4 | **Bestået.** T7 og B4 er rettet, B5 er delvist rettet. |
| Fest-huen | 4 | 4 | **Bestået.** T9 er rettet, T6 og B6 er delvist rettet. |
| Milepæle | 4 (op fra 3) | 4 | **Bestået.** T2, T3, T4, T8 og B3 er rettet. |

| Scene | Middel | Laveste | Afgørelse |
|---|---|---|---|
| **Hestebakkerne** | **4,4** | 4 (fem kriterier) | **Bestået** |
| **Regnbueskoven** | **4,5** | 4 (fire kriterier) | **Bestået** |

- **Blindtesten:**
  - 60/60 rigtige på artsniveau, og alle 20 racer og alle stadier er ramt. Min skala-læsning (lille, mellem og stor) svarede også præcist til stadie 1, 2 og 3.
  - 51 svar var "sikre" og 9 "usikre". Alle 9 usikre var rigtige: de tre vædderkaniner og de seks langmankede heste (shetland og araber).
  - Kravet i rubrikkens accept-afsnit er opfyldt.
- **Det vigtigste fund er ikke kunsten, men arket:** `scene.png` har store flader, der ikke er tegnet, i Hestebakkerne- og Regnbueskoven-afsnittene (§5.1). Scenerne er derfor bedømt på elementoptagelser og på det levende kort. Arket skal rettes, før det kan bruges som gate-grundlag.

## 1. Scores: enhjørning og ugle

| # | Kriterium | Enhjørning (r4) | Enhjørning nu | Ugle (G2-r1) | Ugle nu |
|---|---|---|---|---|---|
| 1 | Genkendelighed ved 48 px | 5 | 5 | 5 | 5 |
| 2 | Silhuet | 4 | **5** | 5 | 5 |
| 3 | Proportioner | 5 | 5 | 5 | 5 |
| 4 | Kontur | 4 | 4 | 4 | 4 |
| 5 | Palet | 5 | 5 | 4 | 4 |
| 6 | Ansigtets appel | 5 | 5 | 5 | 5 |
| 7 | Pasform | **3** | **4** | 4 | 4 |
| 8 | Animation | 4 | 4 | 4 | 4 |
| 9 | Butikskort ved 64 px | **3** | **4** | **3** | **4** |
| 10 | AAA-finish | 4 | 4 | 4 | 4 |
| | **Middel** | 4,2 | **4,5** | 4,3 | **4,4** |

### Enhjørning: begrundelser

1. **Genkendelighed ved 48 px, 5** (`sizes-unicorn.png`, rækken "48 px", y0 = 268, kort x0 = 64 + 156 · (k − 1)):
   - Hornet og manken står tydeligt i alle farver.
   - "Glad" og "sover" (kort 9–10) kan skelnes.
2. **Silhuet, 5 (op fra 4)** (`silhouettes.png`):
   - Alle ni enhjørninger var "sikre" i blindtesten, og de tre racer kan skelnes i sort:
     - føl: pandehår mod venstre (#4, #27, #9),
     - bølgemanke: stor manke (#48, #34, #36),
     - stjernehorn: manke mod højre (#33, #59, #32).
   - Stjernehornets problem fra r4 (#36, #38, #40 dengang) er løst: stjernen er flyttet til et mærke i panden (`species-unicorn.png`, race 3 (256–1478, 2936–3800)), og hornet er et almindeligt horn.
   - Bemærk: bølgemankens manke deler form med shetland- og araberhestens. Det er hestens problem, ikke enhjørningens (se §3.3).
3. **Proportioner, 5:** Tydelig chibi i alle tre racer, og føllet har størst hoved og øjne (`species-unicorn.png`, stadierækkerne).
4. **Kontur, 4:**
   - Selve konturen er ensartet og sømløs.
   - r4's sprækker hos race 2 er væk, bortset fra hårfine punkter på 1–2 px i bølgemankens humør: `holes.png` #1028 (2698, 6143), #1048 (1601–1602, 6297–6300) og #1068.
   - Det er stadig brud på reglen om sprækker under 4 enheder, så 4.
5. **Palet, 5:** Uændret: ni klart forskellige farver, en varm regnbue og stjernehvid.
6. **Ansigtets appel, 5:** Uændret (`closeup-unicorn.png`, `moods-unicorn.png`).
7. **Pasform, 4 (op fra 3):** Det blokerende fund fra r4 (hornet mod hovedgenstandene) er løst eller delvist løst:
   - **T7 rettet:** Pirathatten har nu samme trekantssilhuet som på hesten og et hornhul med guldkant (`fit-unicorn.png`, rækken "pirat-head" y0 = 7438, fx (1024–1260, 7438–7714)).
   - **T8 rettet:** Regnbuehuen har kuppel, ribkant, ørehuller og hornhul, og pomponen sidder bag hornet (rækken "milepael-regnbuehue" y0 = 9820, alle 9 celler).
   - **T6 delvist rettet:**
     - Festhatten har fuld størrelse og sidder mellem venstre øre og hornet. Ca. 2/3 af ørets inderside ses.
     - Men keglen står bag hornet, så hornet dækker det meste af den. Hatten læses mest som pompon plus flæse (rækken "fest-head · under" y0 = 9224, fx keglen ved (1105–1150, 9270–9325)).
     - Hornet står ikke frit med 4 enheders luft, som r4 bad om.
   - **T5 rettet:** Ærmerne starter ved skulderen og følger forbenet ned til en manchet (`fit-unicorn.png` (1280–1516, 1188–1464) og (2304–2540, 1188–1464)).
   - Hue, safarihat, ridehjelm, diadem og krone går alle rent om hornet (rækkerne y0 = 296, 2082, 3868, 5652 og 9522).
8. **Animation, 4:**
   - **Glimtet er rettet:** en udfyldt hvid stjerne med guldkontur og en lille ekstra stjerne ved hornspidsen i 0,45–0,95 s, derefter pause (`filmstrip-unicorn.png`, nærbilledet y0 ≈ 3088, frame 2–4 (424–1504, 3110–3330)).
   - Jeg har ikke gennemgået alle humør frame for frame, så jeg hæver ikke til 5.
9. **Butikskort, 4 (op fra 3):**
   - **B5 delvist rettet:**
     - Skægget kommer med på kortet (`sizes-unicorn.png`, Pirat "på dyret", kort 4–6 (532–972, 3392–3520)).
     - Men skæggets nederste kant skæres stadig af kortets underkant (y ≈ 3518).
   - **B6 delvist rettet:**
     - Festhatkortet (Fest "på dyret", kort 1–3 (64–504, 3544–3672)) viser hatten i fuld størrelse.
     - Men keglen er næsten skjult bag hornet, så kortet læses som pompon og gul flæse.
   - Pirathatten og regnbuehuen er tydelige på kortene (kort 1–3 i Pirat og kort 4–6 i Milepæle).
   - Resten af kortene svarer til de andre arters.
10. **AAA-finish, 4:**
    - Gennemført og charmerende.
    - Til 5 mangler: festhatten, de hårfine sprækker og skæggets beskæring.

### Ugle: begrundelser

1. **Genkendelighed ved 48 px, 5:** Uændret (`sizes-owl.png`, y0 = 268).
2. **Silhuet, 5:** #2, #18 og #30 var "sikre" i blindtesten.
3. **Proportioner, 5:** Uændret.
4. **Kontur, 4:**
   - Vinke- og jubel-lommerne i stadie 1–2 er rettet: `holes.png` #1265, #1271, #1281 og #1287 har ingen lukkede områder længere.
   - **Ikke rettet:** jubel i stadie 3 har stadig en lomme på ca. 6 enheder mellem løftet vinge og krop:
     - #1301 (1771–1782, 7727–7735),
     - #1307 (2587–2599, 7726–7735).
   - Det er nøjagtig samme koordinater som i G2-r1.
5. **Palet, 4:**
   - c4 perlehvid er nu tydeligt perlerosa og skilt fra c2 sne (`species-owl.png` x0 = 988 mod x0 = 500).
   - c1 brun og c5 kanel kan skelnes.
   - Regnbuen har stadig striber kun på maven og en lavendelhvid krop, der ligner c2 sne (x0 = 1964 mod x0 = 500). Derfor stadig 4.
6. **Ansigtets appel, 5:** Uændret.
7. **Pasform, 4:**
   - **T13 rettet:** Monoklen har klart glas, og øjet beholder sin egen irisfarve (`fit-owl.png`, rækken "kongelig-face" y0 = 5950, farve 2-cellerne).
   - Rygslottet er låst som i §7.1.
   - **Ikke rettet (G2-r1, punkt 5):** Gulerod og scepter sidder bag vingen. Kun guleroden blade og scepterets kugle titter frem (`fit-owl.png`, rækkerne "rytter-hand" y0 = 5356 og "kongelig-hand" y0 = 7140, fx (1280–1516, 5356–5632)).
8. **Animation, 4:** Uændret. Hoveddrejet er stadig en hældning.
9. **Butikskort, 4 (op fra 3):**
   - **B11 rettet:** Alle 21 rygkort viser uglen beskåret i venstre side, genstanden alene ved siden af og en lås i hjørnet (`sizes-owl.png`, kort 13–15 i Hverdag, Opdager, Rytter, Kongelig og Pirat (1936–2376, y0 2784, 2936, 3088, 3240 og 3392) og Milepæle 16–21 (2404–3312, 3696–3824)). Genstanden er tydelig, og de tre farvesæt er forskellige.
   - **Ny (B14):** Håndkortene viser næsten kun vingen (se §4.2).
10. **AAA-finish, 4:** Til 5 mangler jubel-lommen, regnbuen og håndgenstandene.

## 2. Gate-afgørelse

- **Enhjørning: bestået.**
  - Alle kriterier er ≥ 4, og middel er 4,5.
  - Den blokerende fejl fra r4 (hornet mod hovedgenstandene) er løst for pirathat og regnbuehue og delvist løst for festhatten. Festhatten er nu et forbehold, ikke en blokering.
- **Ugle: bestået.**
  - Alle kriterier er ≥ 4, og middel er 4,4.
  - B11 er rettet.
- **De ti andre arter: bestået som før.** Ingen score er ændret, fordi jeg ikke har fundet en ny fejl eller regression, der flytter et kriterium. Forbeholdene står i §3.
- **Alle syv sæt: bestået** med pasform 4 og butikskort 4. Ingen genstand sidder forkert på alle arter længere.
- **Hestebakkerne og Regnbueskoven: bestået** efter rubrikkens regel (alle ≥ 4 og middel ≥ 4,3), som jeg også har brugt for scenerne.
- **Blindtesten:** 60/60, og alle racer og stadier er ramt. Kravet er opfyldt.

## 3. Status pr. tidligere fund

### 3.1 Om huller-søgningen

- Den første maskinelle søgning gav 94 lukkede magenta-områder.
- De fleste ligger inde i guld- og stjernehvid-glimtene ✦ ved siden af figuren, fx kanin #217 (2801–2805, 1409–1413), hvalp #515 og enhjørning #1058. Det er glimtets hule midte, ikke et hul i dyret.
- Når de er sorteret fra, er de reelle lommer kun disse:

| Flise | Art · race · stadie · humør | Størrelse | Status |
|---|---|---|---|
| #302 | kat · huskat · 1 · vinker c1 | (3001–3008, 1946–1959), ca. 9 enheder | Lomme mellem hale og krop. Huskat-babyens hoftekile er åbnet til ca. 6 enheder i hvile (#289–#301, fx (1234–1237, 1950–1958)), men i vinker er den lukket. |
| #460, #466 | kat · maine coon · 3 · ups c1/c4 | (1652–1654, 2900–2905) og (2468–2470, 2900–2905), 3–4 enheder | Ny lille sprække mellem pote og krop. |
| #709–#723 | hest · araber · 1 (alle farver og humør) | fx #709 (1200–1203, 4364–4371), 4,4 enheder | **Ny lomme** mellem manens spids og hoften. |
| #1301, #1307 | ugle · 3 · jubel | ca. 6 enheder | Uændret fra G2-r1. |
| #1028, #1048, #1068 | enhjørning · bølgemanke · humør | 1–2 px | Hårfine sprækker. |

- `holes`-lint'en gav "ok" trods disse. **Udvidelsen af lint'en, som r4 og G2-r1 bad om, er altså ikke lavet.**

### 3.2 Enhjørningens punkter fra r4 §5

| # | Punkt | Status | Det ser jeg nu |
|---|---|---|---|
| 1 | Hornet mod hovedgenstandene (T6–T8) | **Delvist rettet** | T7 og T8 er rettet. T6: hatten har fuld størrelse, men keglen gemmer sig bag hornet (§1). |
| 2 | Butikskort B5 og B6 | **Delvist rettet** | Skægget kommer med, men underkanten beskæres. Festhatkortet læses som pompon og flæse. |
| 3 | Kasseærmer (T5) | **Rettet** | Ærmerne går fra skulderen ned langs forbenet (`fit-unicorn.png` (2304–2540, 1188–1464)). |
| 4 | Fællesfejl T1–T3 | **Rettet** | Se §4.1. |
| 5 | Sprækker under 4 enheder (race 2) | **Stort set rettet** | Kun hårfine 1–2 px-punkter (#1028, #1048, #1068). |
| 6 | Stjernehornets silhuet | **Rettet** | Stjernen er et mærke i panden. Stjernehornet var "sikkert" på alle tre stadier i blindtesten. |
| 7 | Glimtet | **Rettet** | Udfyldt hvid stjerne med guldkontur og en ekstra lille stjerne. |

### 3.3 Forbehold fra r4 §5 (kanin, kat, hvalp, pindsvin og hest)

| Art | Forbehold | Status | Det ser jeg nu |
|---|---|---|---|
| Kanin | R1: vinke-lommen (#34, #40) | **Rettet** | Ingen lukkede områder i #34 og #40 og ingen huller inden for nogen kaninfigur (kun glimtenes midte, §3.1). |
| Kanin | Udvid magenta-lint'en | **Ikke rettet** | Lint'en giver "ok" trods lommerne i §3.1. |
| Kanin | K2: næsevippet | **Delvist rettet** | Næsen bevæger sig nu ca. 13–19 px i nærbilledet (r4: 8–9 px) i et vip op–ned–op (`filmstrip-rabbit.png`, nærbilledet y0 ≈ 3088, næsen ved y ≈ 3301–3320). Squash af næsen og nik har jeg ikke kunnet bekræfte. |
| Kat | T5 (C2): kasseærmer | **Rettet** | `fit-cat.png` (256–2540, 1188–1464): ærmerne følger forbenene, og striberne fortsætter. |
| Kat | Langhårskravens silhuet | **Rettet** | Kraven er rund og symmetrisk med totter, og knurhårene stikker ud (`fitmatrix.png`, kat-rækken r4). Langhårskatten (#16, #23, #25) var "sikker" i blindtesten uden rævealternativ. |
| Kat | Sprækken på maine coon-babyen (#409–#415) | **Rettet** | Intet lukket område i #409–#428. |
| Kat | Huskat-babyens hoftekile | **Delvist rettet** | Ca. 6 enheder i hvile, altså over grænsen, men en lukket lomme på ca. 9 enheder i vinker (#302). |
| Hvalp | Sprækken #522 og lommerne #519, #521, #525 og #527 | **Rettet** | Ingen lukkede områder. |
| Hvalp | Et større vink | **Rettet** | Poten svinger tydeligt ud fra kinden i 0,45–0,68 s (`filmstrip-puppy.png`, vinker-rækken (y0 ≈ 2124)). |
| Hvalp | Hundeagtige ører med fold | **Rettet** | Ørerne har en synlig fold foroven (`species-puppy.png`, stadie 1–3). |
| Pindsvin | Stadie 3 mere voksen | **Rettet** | Relativt mindre hoved og længere krop og pigge (`species-hedgehog.png`, y0 = 896). |
| Pindsvin | c4 og c5 | **Rettet** | c4 rustrød (x0 = 988) og c5 mandel (x0 = 1232) er klart forskellige. |
| Hest | H3: regnbuehesten mint | **Rettet** | Varm cremefarvet krop i alle tre racer (`species-horse.png`, x0 = 1964). |
| Hest | T5 (H6) | **Rettet** | `fit-horse.png` (2304–2540, 1188–1464). |
| Hest | Fjordtoppen (bundkontur, totter og klipning, T9) | **Rettet** | Totter i forskellig højde uden kassebund (`fit-horse.png` (2048–2284, 594–870)). Toppen er helt skjult under festhat og ridehjelm. |
| Hest | Mule og hale på de mindste heste | **Rettet** | Babyerne kendes på mule og hale (#12, #24 og #54 i blindtesten). |
| Hest | **Ny:** lomme hos araber-babyen | **Ny** | #709–#723, 4,4 enheder mellem manens spids og hoften i alle farver (§3.1). |
| Hest | **Ny (observation, ingen scoreændring):** langmanket hest mod bølgemanke-enhjørning | **Ny** | Shetland og araber deler manken med bølgemanken, og kun hornet og halen skiller dem. Alle seks var "usikre" i min blindtest, men rigtige. REV5 var sikker på de samme former, så jeg kalder det ikke en regression. |

### 3.4 Forbehold fra G2-r1 §5 (lam, ræv, hamster, panda og egern)

| Art | Forbehold | Status | Det ser jeg nu |
|---|---|---|---|
| Alle fem | Lommerne under kontur | **Rettet** | Ingen af G2-r1's lommer findes længere for lam, ræv, hamster og panda. Egernet: se nedenfor. |
| Alle fem | Udvid huller-lint'en (lukkede lommer under 25 enheder) | **Ikke rettet** | Se §3.1. |
| Lam | Vinke-lommen (#782, #788) | **Rettet** | Ingen lukkede områder. |
| Lam | T12 og B13 | **T12 rettet, B13 delvist** | Jakkekortet er centreret fra hage til hofte. Scepter- og gulerodskortet skærer stadig gennem øjet (`sizes-lamb.png` (2404–2844, 3088–3216) og (2404–2844, 3240–3368)). |
| Lam | "Stor" mere voksen | **Rettet** | Større krop og længere ben (`species-lamb.png`, y0 = 896). |
| Ræv | Lommen mellem bryst og forben (#879, #881, #885, #887) | **Rettet** | Ingen lukkede områder. |
| Ræv | Regnbuen mod c2 polar | **Delvist rettet** | Regnbuen er nu varmere og har stribet hale, men kroppen er stadig bleg (`species-fox.png` x0 = 1964 mod x0 = 500). |
| Ræv | c5 guldrød mod guld | **Rettet** | c5 er tydeligt orange (x0 = 1232 mod 1720). |
| Hamster | c1 "guld" og c6 "panda" | **Rettet** | c1 hedder nu "abrikos", og c6 er "plettet" (hvid med orange pletter). |
| Hamster | T12 og "stor" | **Rettet** | Sadeltasken hænger som poser på flankerne. "Stor" har større krop. |
| Panda | Lommerne i ups og vinker | **Rettet** | Ingen lukkede områder i #1140–#1171. |
| Panda | c2 mod c5 og c6 mod regnbuen | **Rettet** | Brun og creme kan skelnes, og regnbuen er nu lyseblå (`species-panda.png` x0 = 1964). |
| Panda | Bambus i jubel | **Rettet** | Bambussen sidder i den løftede pote i alle tre stadier (`moods-panda.png`, jubel-kolonnen). |
| Egern | Sprækkerne i stadie 2 og stadie 3 · jubel | **Stort set rettet** | #1227, #1241 og #1247 er væk. Hakker på 1–2 px står tilbage i #1223, #1225, #1229 og #1231, fx (2563–2564, 7259). |
| Egern | c1 rød mod c6 orange | **Ikke rettet** | Ligger stadig tæt (`species-squirrel.png` x0 = 256 mod 1476), især ved 48 px. |

### 3.5 Uglens punkter fra G2-r1 §5

| # | Punkt | Status |
|---|---|---|
| 1 | B11 rygkortene | **Rettet** |
| 2 | Lommerne mellem vinge og hoved | **Delvist rettet:** stadie 1–2 er rettet, jubel i stadie 3 (#1301, #1307) er ikke |
| 3 | De hvide farver | **Delvist rettet:** c4 er skilt fra c2, men regnbuen har stadig kun striber på maven |
| 4 | T13 monoklen | **Rettet** |
| 5 | Håndgenstande på vingen | **Ikke rettet** (B14) |

## 4. Tøjet: pasform på alle 12 arter og butikskortene

Det er tjekket på `fit-<art>.png` for alle 12 arter, på `fitmatrix.png` (alle 36 rækker og alle 48 kolonner i oversigt, fokuskolonnerne i zoom) og på `sizes-<art>.png`.

**Det, der virker:**
- Brillerne sidder på øjnene med klart glas, også på mørk pels.
- Huer, hatte, hjelme, diademer og kroner sidder mellem eller om ørerne og hornet.
- Ærmerne følger forbenene og danner et V i jubel.
- Slikkepinden følger poten.
- Sadeltaskerne hænger på flankerne.
- De hele sæt (kolonne 41–47) er harmoniske på alle arter.

### 4.1 Tidligere tøjfund (T1–T14)

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| T1 | Solbrillerne på munden | **Rettet** | Brillerne sidder på øjnene med klart glas (`fitmatrix.png` kolonne 5 (x0 = 1476), alle rækker, fx hest r14 (1476–1700, 4328–4596)). |
| T2 | Hjertebrillerne dækker øjnene | **Rettet** | Klart glas, og pupiller og højlys ses (kolonne 35, x0 = 8796). På hvalpebabyen rører hjerternes spidser mulen (`fit-puppy.png` (256–1004, 10084–10360)), men øjne og mund er fri. |
| T3 | Slikkepinden vender på hovedet i "tænker" | **Rettet** | Slikket er oppe ved kinden (`fit-cat.png` og `fit-rabbit.png` (1024–1260, 18538–18814) og (1024–1260, 18834–19110)). |
| T4 | Tom pote i "vinker" | **Rettet** | Slikkepinden sidder i den løftede pote (`fit-cat.png` og `fit-rabbit.png` (1792–2028, 18834–19110) og (1792–2028, 19430–19706)). |
| T5 | Kasseærmer | **Rettet** | Se §3.3 (kat, hest) og §1 (enhjørning). Ærmerne er ikke smallere forneden på hest og enhjørning, men det er en detalje. |
| T6 | Festhatten på enhjørningen | **Delvist rettet** | Se §1. |
| T7 | Pirathatten på enhjørningen | **Rettet** | |
| T8 | Regnbuehuen på enhjørningen | **Rettet** | |
| T9 | Fjordtoppen bag festhatten | **Rettet** | `fit-horse.png` (2048–2284, 9224–9500). |
| T10 | Ærmerne krydser i jubel | **Rettet** | Ærmerne følger armene i et V (`fit-cat.png`, `fit-rabbit.png` og `fit-horse.png` (768–1004, 15858–16134)). |
| T11 | Opdager-brillerne bag shetland-babyens pandelok | **Rettet** | Brillerne ligger oven på pandelokken (`fitmatrix.png` kolonne 10, r12 (2696–2920, 3752–4020)). |
| T12 | Sadeltasken som en planke | **Rettet** | To poser på flankerne og ingen stang foran skødet (kolonne 19, x0 = 4892, lam, hamster, panda, kanin og kat). |
| T13 | Monoklens farvede glas | **Rettet** | Klart glas med højlys, og øjets egen irisfarve ses (`fit-fox.png`, `fit-hamster.png`, `fit-owl.png`, `fit-cat.png` og `fit-unicorn.png`, rækken y0 = 5950, farve 2-cellerne). |
| T14 | Fjordtoppen over ridehjelmen | **Rettet** | `fit-horse.png` (2048–2284, 3868–4144). |

**Nye tøjfejl:** Jeg har ikke fundet nye pasformsfejl (ingen T15).

### 4.2 Butikskort (B1–B13) og nye kortfejl

| # | Fund | Status | Det ser jeg nu |
|---|---|---|---|
| B1 | Rygsækken kun som stropper | **Rettet** | Rygsækken vises ved siden af dyret (`sizes-rabbit.png`, Hverdag "på dyret", kort 13–15 (1936–2376, 2784–2912)). |
| B2 | Luppen næsten usynlig | **Rettet** | Håndslottet er beskåret om poten og genstanden (Opdager kort 16–18 (2404–2844, 2936–3064)). |
| B3 | Kappen kun i kanterne | **Rettet** | Kappen bølger synligt ud til siden (Milepæle kort 19–21 (2872–3312, 3696–3824)). |
| B4 | Bandanaen svær at læse | **Rettet** | Bandanaen har knude og flagrende snipper alene (Pirat alene, kort 7–9 (1000–1440, 2244–2372)), og den ligger oven på løvehovedets manke (kort 9 "på dyret" (1312–1440, 3392–3520)). |
| B5 | Enhjørningens skæg beskåret | **Delvist rettet** | Se §1. |
| B6 | Enhjørningens festhatkort | **Delvist rettet** | Se §1. |
| B7 | Kasseærmer på trøjekortene | **Rettet** | Følger af T5. |
| B8 | Solbrillekortet | **Rettet** | Følger af T1 (Hverdag "på dyret", kort 4–6). |
| B9 | Sadeltasken som en planke | **Delvist rettet** | Planken er væk, men poserne er meget små og sidder ved kortets underkant. På hesten er de knap synlige (`sizes-rabbit.png`, Rytter "på dyret", kort 13–15 (1936–2376, 3088–3216)). |
| B10 | Monoklen ligner luppen | **Rettet** | Mindre glas og en snor i bue ud af kortet (Kongelig alene, kort 4–6 (532–972, 2092–2220)). |
| B11 | Uglens rygkort | **Rettet** | Se §1. |
| B12 | Diademet lille alene | **Rettet** | Fylder ca. 85 % af bredden og har højere takker (Kongelig alene, kort 1–3 (64–504, 2092–2220)). |
| B13 | Lammets krops- og håndkort | **Delvist rettet** | Se §3.4. |

Nummereringen fortsætter efter B13, fordi G2-r1 allerede har brugt B13.

- **B14. Uglens håndkort viser næsten kun vingen (ny, mindre fejl).**
  - **Hvor:**
    - `sizes-owl.png`, Rytter og Kongelig "på dyret", kort 16–18 (2404–2844, 3088–3216) og (2404–2844, 3240–3368),
    - `fit-owl.png`, rækkerne y0 = 5356 og 7140.
  - **Fejlen:** Guleroden og scepteret sidder bag vingen. Kun bladene og kuglen ses, og guleroden kan ikke genkendes ved 64 px. Ballonen virker, fordi snoren går fra vingespidsen.
  - **Ret sådan:**
    - Lad vingespidsen gribe om genstanden foran vingen, eller flyt genstanden ud til siden, så mindst 2/3 af den ses.
    - Beskær håndkortet om vingespids og genstand ligesom luppen (B2).

## 5. Scenerne: Hestebakkerne og Regnbueskoven

### 5.1 Arket `scene.png` har tegnefejl (proces, blokerer arket, ikke kunsten)

- **Fejlen:** Arket er 4968 × 29908 px (ca. 149 megapixel). I Hestebakkerne- og Regnbueskoven-afsnittene mangler store rektangulære flader. De står som papirfarve eller bleg flade i stedet for himmel, bakker og skov. Eksempler:
  - telefonpanelet "bronze" har en tom papirflade nederst til venstre ved (925–1435, 7135–7384),
  - telefonpanelernes himmel er papirfarvet,
  - næsten hele Regnbueskoven-afsnittet (y ≈ 17900–26600) er tomt, bortset fra få elementer.
- **Det er ikke kunsten:** Engdalen-panelerne øverst er hele, og de samme paneler fotograferet ét ad gangen (elementoptagelser) er komplette. Det ligner rasterfliser, der ikke blev tegnet i den meget store helsidesoptagelse.
- **Ret sådan:**
  - Del scene-ruten op i én side pr. verden (`scene:eng`, `scene:bakke`, `scene:skov`), eller tag ét skærmbillede pr. panel med `locator.screenshot()`.
  - Tilføj et lint, der fejler, hvis et panel har store flader i ren papirfarve.
  - Et reviewark må ikke være mindre pålideligt end det, det dokumenterer.

### 5.2 Scores

Kriterierne er dem fra Engdalen-reviewet i r4 §4 (komposition, dybde, lys, verdenslogik, progression og samspil med kortet) plus rubrikkens palet og AAA-finish. Grundlaget er:
- elementoptagelserne af alle fire tiers i 393·852, 820·1180 og 1180·820, plus "blandet med kortet" (filnavne i bilag A),
- det levende kort i de tre formater.

| # | Kriterium | Hestebakkerne | Regnbueskoven |
|---|---|---|---|
| 1 | Komposition og mellemgrund | 4 | 4 |
| 2 | Dybde og luftperspektiv | 5 | 5 |
| 3 | Lys fra én retning | 4 | 4 |
| 4 | Verdenslogik | 4 | 5 |
| 5 | Progression (start, bronze, sølv og guld, regnbue ved guld) | 5 | 5 |
| 6 | Samspil med kortet (kendemærker uden for panelet, stenene kan læses) | 4 | 4 |
| 7 | Palet | 5 | 5 |
| 8 | AAA-finish | 4 | 4 |
| | **Middel** | **4,4** | **4,5** |

### 5.3 Hestebakkerne

Koordinaterne er i `panel-bakke_1180_820_<tier>.png` (1x), hvis intet andet står.

1. **Komposition, 4:**
   - Kendemærkerne er spredt over hele billedet:
     - Urtårnet (55–105, 320–500),
     - huse og grøntsagsmarken (20–150, 575–645),
     - får bag hegn,
     - kilde, å og bro,
     - gården,
     - hestene,
     - købmandsboden (1065–1160, 575–665).
   - Engen nederst til venstre (150–700, 600–800) er tom, men det er der, stenpanelet ligger på iPad på tværs.
   - På telefon ligger horisonten ved ca. 1/3, og himlen fylder passende.
2. **Dybde, 5:**
   - Der er fire tydelige planer:
     - fjerne blågrå bakker med prikkede kamme,
     - mellembakker med stibånd og små cypresser,
     - nær eng i mættet grøn,
     - store blade i hjørnerne, delvist beskåret.
   - Fjernt er køligt og lyst, nært er varmt og mættet. Det er præcis det, r4 bad om.
3. **Lys, 4:**
   - Solen står øverst til venstre, og træer, hus, bro og bod har jordskygge.
   - Skyggerne ligger lige under tingene og ikke på modsat side af solen, og bakkerne har ingen skyggeside.
4. **Verdenslogik, 4:**
   - Åen udspringer fra en kilde mellem sten (785–815, 440–460) og bliver bredere nedstrøms.
   - Broen er en bue med gelænder på begge sider, lanterner og skygge (735–805, 530–565).
   - Hegnet stopper ved åens bred (865–1055, 660–690).
   - **Lille brud:** I guld står den mørkebrune hest helt ude på åkanten, og forbenene rører vandets kontur (881–931, 702–733).
5. **Progression, 5:**
   - Mætningen stiger jævnt: middelmætning 0,17, 0,21, 0,25 og 0,29 for start, bronze, sølv og guld (1180·820).
   - Hvert tier får egne rekvisitter:
     - **bronze:** tændte vinduer, røg fra skorstenen og lanterner på broen,
     - **sølv:** glimt i åen, blomster i vindueskasserne, blomstrende træer og et føl,
     - **guld:** regnbue (185–1020, 100–270), fugle, flag på bro og tårn, guirlander på huset og boden og flere heste.
   - Start er pastel og aldrig grå.
6. **Samspil med kortet, 4:**
   - På alle tre formater står tårn, hus, å, bro, heste og bod uden for stenpanelet (`live-bakke-1180x820-top.png`, `live-bakke-820x1180-top.png` og `live-bakke-393x852-top.png`).
   - Den aktive sten er meget tydelig.
   - De låste sten er meget blege på det frostede panel, især på telefon midt på kortet (`live-bakke-393x852-midt.png`, fx brille-stenen ved (462, 490) og stjerne-stenen ved (371, 981)). De kan ses, men læses dårligt.
7. **Palet, 5:** Varm og harmonisk og i familie med figurerne. Start er bleg, men ikke grå.
8. **AAA-finish, 4:**
   - Gennemført og charmerende: høballer, får, cypresser, føl og vindueskasser.
   - Til 5 mangler hesten i åkanten, retningsbestemt lys og lidt liv på den tomme eng i telefon- og iPad-portrætformaterne.

### 5.4 Regnbueskoven

Koordinaterne er i `panel-skov_1180_820_<tier>.png` (1x), hvis intet andet står.

1. **Komposition, 4:**
   - Tablet-formaterne er rige:
     - Stortalsbjerget med flag (690–880, 230–370),
     - vandfald, sø og vandmølle,
     - Urtårnets top,
     - grotten med panda og bambus (20–170, 460–580),
     - uglen i træets hul (705–780, 540–695),
     - egernet,
     - linealpælene,
     - figurhaven med kugle, kegle og terninger,
     - Købmandsgården.
   - **På telefon** fylder den tomme himmel de øverste ca. 42 % (`panel-skov_393_852_*.png`, y 0–360), og scenen bliver bundtung. I appen dækker topbaren det meste af himlen, så det er et mindre problem.
2. **Dybde, 5:** Diset blå trærække langt væk, plateauet, regnbueskoven, søen og den nære eng. Lysstrålerne giver luft mellem planerne.
3. **Lys, 4:**
   - Solen står øverst til venstre, og fra bronze falder diagonale lysstråler fra samme retning (640–760, 250–400).
   - Skyggerne ligger lige under tingene ligesom i Hestebakkerne.
4. **Verdenslogik, 5:**
   - Vandfaldet falder fra plateauet ned i søen (815–840, 410–600).
   - Søen løber ud ved vandmøllen (1010–1050, 615–655) i en å, der bliver bredere og går under en buebro med gelænder og lanterner (955–1075, 730–765).
   - Hegnet ved møllen stopper ved åens bred (1055–1170, 670–688).
   - Pandaen sidder ved bambussen, og uglen bor i et træ.
5. **Progression, 5:**
   - Mætningen er 0,15, 0,20, 0,24 og 0,29 (1180·820).
   - **Bronze:** lanterner langs stien, lysstråler og røg.
   - **Sølv:** frugt på træerne, glimt i åen og sommerfugle.
   - **Guld:** regnbue, fugle, flag og guirlander på plateau, bro og mølle.
6. **Samspil med kortet, 4:**
   - På iPad står plateau, vandfald, sø, mølle, grotte og bro til højre for stenpanelet (`live-skov-1180x820-top.png`, `live-skov-820x1180-top.png`).
   - På telefon ses kun tårnet og plateauet i kanten (`live-skov-393x852-top.png`).
   - Skoven bag det frostede stenpanel er travl, og de låste sten (fx mønterne i Købmandsgården, `live-skov-393x852-midt.png` (396, 781)) har meget lav kontrast.
7. **Palet, 5:** Pastelregnbuen i træerne og den lavendelblå himmel er harmoniske og særlige uden at skrige.
8. **AAA-finish, 4:** Meget rig og kærligt detaljeret. Til 5 mangler telefonhimlen, den gentagne træform i skovbåndet og kontrasten bag stenene.

## 6. Rettelser i prioriteret rækkefølge

Intet blokerer, så alt herunder er forbehold, der rettes før udgivelse.

### Proces

1. **`scene.png` (§5.1):** Lav scenearket pr. verden eller pr. panel, og tilføj et lint for tomme papirflader. Uden det kan scenerne ikke gates på arket.
2. **Huller-lint'en (§3.1):** Lad den fejle på lukkede magenta-områder inden for figurens yderkontur på mindst 1 px, men ikke inde i glimtene ✦. Den skal fange #302, #460, #466, #709–#723 og #1301/#1307, som den nu lader passere.

### Enhjørning

1. **T6 og B6, festhatten:**
   - Vip keglen ca. 15° mere ud mod venstre øre, så hele trekanten med pompon ses ved siden af hornet, og hornet har mindst 4 enheders luft.
   - Gør flæsen ca. 30 % smallere, så den ikke ligner en krøllet pandelok.
   - Tjek alle 9 celler i `fit-unicorn.png` y0 = 9224 og kort 1–3 i Fest "på dyret".
2. **B5, skægget:** Lad ansigtsslottets beskæring gå 6–8 enheder under skæggets spids, når genstanden når under munden (`sizes-unicorn.png`, kort 4–6 (532–972, 3392–3520)).
3. **Sprækkerne #1028, #1048 og #1068:** Fyld pels bag manens lokke i bølgemankens humør.

### Ugle

1. **Jubel-lommen i stadie 3 (#1301, #1307):** Fyld pels bag den løftede vinge mellem vinge og krop i begge farver.
2. **B14, håndgenstandene:** Lad vingespidsen gribe om gulerod og scepter foran vingen, og beskær håndkortet om vingespids og genstand.
3. **Regnbuen:** Læg striberne også i fjerørerne og halefjerene, så regnbueuglen ikke ligner c2 sne med en stribet mave.

### De øvrige arter

1. **Hest:**
   - Fyld lommen mellem manens spids og hoften hos araber-babyen (#709–#723).
   - Giv shetland og araber en hestetypisk detalje i silhuetten, fx en tot pandehår som fjordhesten eller en mankekam langs halsen, så de ikke kun skilles fra bølgemanken på hornet.
2. **Kat:** Fyld lommen mellem hale og krop hos huskat-babyen i vinker (#302) og sprækken hos maine coon i ups (#460, #466).
3. **Kanin, K2:** Tilføj squash af næsen (ca. 0,85) og et nik på 1–2 enheder på overshoot-framen.
4. **Farver:**
   - Skil egernets c1 rød fra c6 orange, fx ved at gøre c6 mere gul.
   - Giv rævens regnbue en varm creme krop, der ikke ligner c2 polar.
5. **Lammets håndkort (B13):** Beskær scepter- og gulerodskortet om poten under øjnene.

### Sæt

1. **B9, sadeltasken på dyret:** Beskær rygkortet om hofte og pose, eller vis ryggen i tre kvart profil, så én pose fylder mindst 1/3 af kortet.
2. **T5-detaljen:** Gør ærmerne ca. 20 % smallere forneden på hest og enhjørning.
3. **T2-detaljen:** Gør hjertebrillerne 10–15 % mindre på hvalpebabyen, så spidserne ikke rører mulen.

### Scener

1. **Stenenes kontrast:** Giv de låste sten en mørkere kontur eller et mindre gennemsigtigt felt (ca. 85 % i stedet for det nuværende frostede felt), så ikonet står med kontrast ≥ 3:1 mod panelet. Det gælder især Regnbueskovens skov og telefonens midte.
2. **Hestebakkerne:** Flyt den mørkebrune hest i guld op på græsset, mindst 10 px fra åkanten (881–931, 702–733).
3. **Lys:** Forskyd jordskyggerne 3–6 px væk fra solen (mod højre og ned), og giv bakkerne en svag skyggeside mod højre.
4. **Regnbueskoven på telefon:** Løft plateauet og trærækken ca. 80 px, eller sænk himlen, så scenen ikke er bundtung i 393·852.

## Bilag A: koordinatsystem

- **`silhouettes.png`:** #n har midte ved x ≈ 212 + 300 · ((n − 1) mod 9), og rækkerne har midte ved y ≈ 376, 755, 1130, 1506, 1882, 2265 og 2650.
- **Arts-ark:**
  - Kort x0 = 256 + 244 · (n − 1) for c1–c6, guld og regnbue.
  - Enhjørningen har ni farver i race 1 og en stjerneform-række pr. race. Race 1–3 starter ved y ≈ 352, 1644 og 2936.
- **Fit-ark (alle 12 arter):**
  - Kort x0 = 256, 512 og 768 (stadie 1 · farve 0/1/2), 1024, 1280 og 1536 (stadie 2) og 1792, 2048 og 2304 (stadie 3). Kortene er 236 × 276.
  - Slot-rækker y0:
    - **Hverdag:** hoved 296, ansigt 594, hals 892, krop 1188, ryg 1486, hånd 1784.
    - **Opdager:** 2082, 2380, 2676, 2974, 3272, 3570.
    - **Rytter:** 3868, 4164, 4462, 4760, 5058, 5356.
    - **Kongelig:** 5652, 5950, 6248, 6546, 6844, 7140.
    - **Pirat:** 7438, 7736, 8034, 8332, 8628, 8926.
    - **Festhat:** 9224.
    - **Milepæle:** krone 9522, regnbuehue 9820, hjertebriller 10116, medalje 10414, glimmerbluse 10712, fevinger 11010, kappe 11306, slikkepind 11604.
    - **Kombinationer og hele sæt:** 11902–14282.
  - "Tøj i alle humør" har y0 = 14668, 14966, …, 19430 (17 rækker). Hos katten er det fx række 5 "domestic · 3 · stor · hverdag" 15858 og række 15 "domestic · 3 · stor · milepael" 18834.
  - Kolonnerne er x0 = 256 + 256 · (k − 1) for hvile, glad, jubel, tænker, ups, sover og vinker.
  - Hvalp og pindsvin: alle y0 er 32 px mindre.
- **`fitmatrix.png`:**
  - Række y0 = 296 + 288 · r, i rækkefølgen kanin 0–2, kat 3–5, hvalp 6–8, pindsvin 9–11, hest 12–14, lam 15–17, ræv 18–20, hamster 21–23, enhjørning 24–26, panda 27–29, egern 30–32 og ugle 33–35.
  - Kolonne x0 = 256 + 244 · c:
    - 0 hue, 1 festhat, 2 trøje, 3 hue + trøje, 4 festhat + trøje,
    - 5–8 Hverdag ansigt/hals/ryg/hånd, 9–14 Opdager, 15–20 Rytter, 21–26 Kongelig, 27–32 Pirat,
    - 33–40 krone, regnbuehue, hjertebriller, medalje, glimmerbluse, fevinger, kappe og slikkepind,
    - 41–47 hele sæt: Hverdag, Opdager, Rytter, Kongelig, Pirat, Milepæl 1 og Milepæl 2.
- **`sizes-<art>.png`:**
  - Kort x0 = 64 + 156 · (k − 1). 48 px-kortene har y0 = 268.
  - Butikskortene er 128 × 128. "Genstanden alene" har y0 = 1636, 1788, 1940, 2092, 2244, 2396 og 2548, og "på dyret" har y0 = 2784, 2936, 3088, 3240, 3392, 3544 og 3696 (Hverdag, Opdager, Rytter, Kongelig, Pirat, Fest og Milepæle).
- **`holes.png`:**
  - Flise #n (128 × 154) har x0 = 64 + 136 · ((n − 1) mod 28). Række 1–47 har y0 = 212, 374, 536, … (afstand ca. 162).
  - Fliserne fordeler sig sådan: kanin 1–288, kat 289–468, hvalp 469–528, pindsvin 529–588, hest 589–768 (shetland 589–648, fjord 649–708, araber 709–768), lam 769–828, ræv 829–888, hamster 889–948, enhjørning 949–1131, panda 1132–1191, egern 1192–1251 og ugle 1252–1311.
- **Filmstrimler:** Nærbilledet har y0 ≈ 3088, og frame k har x0 = 64 + 360 · (k − 1).
- **`scene.png`:** 4968 × 29908 px. Hestebakkerne-afsnittet ligger ved y ≈ 5900–17800, og Regnbueskoven-afsnittet ved y ≈ 17900–29700.
- **Elementoptagelser** (lokale, ikke committet):
  - `panel-<verden>_<b>_<h>_<tier>.png` i 1x for hvert panel på scenearket,
  - `live-<verden>-<b>x<h>-{top,midt,bund}.png` i 2x fra det levende kort.
  - De kan genskabes med samme rute og dev-serveren: `sheets.html?sheet=scene` og `/?worlds=all`.
