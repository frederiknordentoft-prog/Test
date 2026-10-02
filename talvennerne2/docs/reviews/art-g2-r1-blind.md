# Kunst-gate bølge 2, runde 1: blind silhuettest (REV5)

- **Ark:** `/tmp/tv2-blind/sheet-d.png` (60 nummererede silhuetter, 2808×2904 px).
- **Reviewer:** REV5, uafhængig og ikke med i tidligere runder.
- **Tidspunkt:** 2026-10-02, 19:56–20:10 UTC.
- **Afgrænsning:** Kun dette ark er åbnet. Beskæringer og forstørrelser er lavet ud fra det. Ingen rubrik, reviews, kode, kontaktark eller andre filer i `/tmp/tv2-blind/` er åbnet før dette commit.
- **Sikkerhed:** "sikker" betyder mindst 90 % sandsynlighed. Alt andet er "usikker".

**Metode.** Først blev hele arket set samlet. Derefter blev hver silhuet forstørret 2–4 gange, og bounding box og areal blev målt. Arket består af **20 forskellige former, hver i tre størrelser**: S ≈ 15–20k px², M ≈ 22–28k px² og L ≈ 29–37k px². Hver silhuet er vurderet for sig. Sammenligning på tværs af arket er kun brugt som støtte, og det står i noten, hvor den har afgjort svaret. Formkoden i hakparentes (fx `[LAM-M]`) viser, hvilken form og størrelse jeg mener, silhuetten tilhører.

| # | Art | Sikkerhed | Note |
|---|---|---|---|
| 1 | lam | sikker | Flade vandrette ører, krøllet uldtop, bulet uldkant på kroppen, uldkvast-hale og små runde klove. Alternativ: hvalp på grund af ørerne, men ulden udelukker det. `[LAM-M]` |
| 2 | enhjørning | sikker | Langt horn midt mellem spidse ører, lang bølget manke ned ad venstre side og hestehale med krølle. Alternativ: hest eller pegasus, men hornet afgør det. `[En2-L]` |
| 3 | enhjørning | sikker | Kort horn, takket pandehår til venstre, hestemule og lille krølhale. Alternativ: hest. Hornet er kort i S, men tydeligt. `[En1-S]` |
| 4 | kat | sikker | Trekantede ører med små spidser, rundt kattehoved, knurhår og tyk busket hale op ad højre side. Alternativ: ræv eller egern på grund af den buskede hale, men hoved og knurhår siger kat. `[Kt2-M]` |
| 5 | hest | usikker | Hestemule, spidse ører, lille flad pandelok, mankestrå til højre og hale med krog. Desuden et langt, jævnt bånd fra issen helt ned til jorden i venstre side. Jeg læser båndet som en lang manke. Læses det som en løftet vinge, bliver svaret pegasus. `[He2-L]` |
| 6 | hest | sikker | Flad børstemanke med små buler mellem spidse ører, aflangt hoved med mule og hale med takket ende. Alternativ: enhjørning eller pegasus, men der er hverken horn eller vinger. `[He1-S]` |
| 7 | kat | sikker | Stor udgave af #4: små dusker på ørespidserne, knurhår, lille krave-bule ved halsen og tyk, leddelt hale op til kinden. Alternativ: ræv på grund af den buskede hale. `[Kt2-L]` |
| 8 | hvalp | sikker | Glat kuppelhoved, brede hængeører til skulderen og tynd opretstående hale. Alternativ: kanin med hængeører (form Ka2), men halen skiller dem. `[HVA-M]` |
| 9 | kanin | sikker | To lange ører op, det højre knækket i spidsen, lille top mellem ørerne, store bagfødder og pomponhale. Ingen reel alternativ. `[Ka1-S]` |
| 10 | kanin | usikker | Meget lange, brede hængeører fra issen ned forbi kinderne, lille top, store fødder og pomponhale (vædderkanin). Alternativ: hvalp, som også har hængeører. Halen og fødderne trækker mod kanin. `[Ka2-L]` |
| 11 | kat | usikker | Katteører, knurhår og takket pelskrave ved kinder og bryst. Alternativ: ræv, fordi kraven ligner kindtotter. `[Kt3-S]` |
| 12 | kanin | sikker | Lange ører op, det ene knækket, top, store fødder og pomponhale. Ingen reel alternativ. `[Ka1-M]` |
| 13 | enhjørning | sikker | Langt horn, takket pandehår og manke på begge sider, hestemule og hale med krølle. Alternativ: hest. `[En1-L]` |
| 14 | kat | usikker | Store katteører og en bred takket pelskrave fra kinderne ned til skulderen, mest i venstre side, samt stor busket hale til højre. Alternativ: ræv på grund af krave og busket hale. Piggene i venstre side kan også læses som en vinge (drage). `[Kt3-L]` |
| 15 | hest | sikker | Spidse ører, lille flad pandelok, lang manke ned ad venstre side og hestemule. Alternativ: enhjørning eller pegasus, men der er hverken horn eller vinger. `[He2-M]` |
| 16 | ugle | sikker | Bredt hoved uden hals, to kløvede fjerdusker skråt ud, kantet krop med foldede vinger i siderne og ingen hale. Alternativ: drage, hvis duskerne læses som horn. `[UGL-S]` |
| 17 | enhjørning | sikker | Kegleformet horn med stjerne i spidsen, spidse ører, manke ned ad højre side og lille hale. Alternativ: hest eller pegasus med pynt, men keglen er et horn. `[En3-S]` |
| 18 | hest | sikker | Stor: flad børstemanke med buler, aflangt hoved med mule og kraftig hale med takket ende. Alternativ: pegasus uden synlige vinger. `[He1-L]` |
| 19 | hvalp | sikker | Kuppelhoved, hængeører og tynd opretstående hale. Alternativ: kanin med hængeører. `[HVA-S]` |
| 20 | hest | sikker | Lille: spidse ører, flad pandelok, lang manke til venstre og mule. Alternativ: enhjørning, men der ses intet horn. `[He2-S]` |
| 21 | kanin | usikker | Lille: hængeører til skulderen, top og pomponhale. Alternativ: hvalp. `[Ka2-S]` |
| 22 | ugle | sikker | Stor: kløvede øredusker, bredt fladt hoved, vinger foldet i siderne og flad bund. Alternativ: drage. `[UGL-L]` |
| 23 | enhjørning | sikker | Horn, lang bølget manke på begge sider og krølhale. Alternativ: hest. `[En2-M]` |
| 24 | enhjørning | sikker | Horn med stjerne, manke til højre og hestemule. Alternativ: pegasus med pynt. `[En3-M]` |
| 25 | kanin | sikker | Stor: lange ører op, det ene knækket, top, store fødder og pomponhale. Ingen reel alternativ. `[Ka1-L]` |
| 26 | kanin | usikker | Hængeører, top og pomponhale. Alternativ: hvalp. `[Ka2-M]` |
| 27 | lam | sikker | Lille: vandrette ører, uldtop, uldkrop og kvasthale. Alternativ: hvalp. `[LAM-S]` |
| 28 | kat | sikker | Lille: katteører med små spidser, knurhår og busket hale. Alternativ: ræv. `[Kt2-S]` |
| 29 | enhjørning | sikker | Lille: kort horn, bølget manke og lille hale. Alternativ: hest. `[En2-S]` |
| 30 | hvalp | sikker | Stor: kuppelhoved, hængeører og tynd opretstående hale. Alternativ: kanin med hængeører. `[HVA-L]` |
| 31 | enhjørning | sikker | Stjernehorn, lang manke til højre og krølhale. Alternativ: pegasus med pynt. `[En3-L]` |
| 32 | kanin | sikker | Lange, lige ører op, kruset manke rundt om kinderne (løvehovedkanin), store fødder og pomponhale. Alternativ: lam (krøller og kvasthale) eller hamster (kinder). Ørerne afgør det. `[Ka3-M]` |
| 33 | panda | sikker | Runde ører, stort rundt hoved og bambuskvist i venstre side. Alternativ: isbjørn, men bambussen afgør det. `[PAN-L]` |
| 34 | pindsvin | sikker | Oval krop helt dækket af takkede pigge og ingen synlige ører. Alternativ: lam, men piggene er spidse, ikke krøllede. `[PIN-L]` |
| 35 | egern | sikker | Kløvede øredusker, rundt hoved og stor S-buet busket hale op over hovedet. Alternativ: ugle på grund af duskerne, men halen afgør det. `[EGE-L]` |
| 36 | egern | sikker | Som #35, mellemstørrelse. Alternativ: ugle. `[EGE-M]` |
| 37 | enhjørning | sikker | Kort horn, takket pandehår til venstre, mule og krølhale. Alternativ: hest. `[En1-M]` |
| 38 | lam | sikker | Stor: vandrette ører, uldtop, uldkrop, kvasthale og klove. Alternativ: hvalp. `[LAM-L]` |
| 39 | pindsvin | sikker | Lille pigget oval. Alternativ: lam. `[PIN-S]` |
| 40 | egern | sikker | Lille: øredusker og busket hale med krøllet spids. Alternativ: kat med busket hale (form Kt2). `[EGE-S]` |
| 41 | kat | sikker | Lille: glatte trekantede ører, knurhår og tynd hale med krølle. Alternativ: ræv. `[Kt1-S]` |
| 42 | kat | sikker | Stor: glatte ører, knurhår og lang tynd hale med krølle i spidsen. Ingen reel alternativ. `[Kt1-L]` |
| 43 | pindsvin | sikker | Pigget oval. Alternativ: lam. `[PIN-M]` |
| 44 | hest | sikker | Spidse ører, rund pandelok, lang manke til venstre, mule og hale med takket ende. Alternativ: enhjørning eller pegasus. `[He3-M]` |
| 45 | ræv | sikker | Høje smalle ører, spidse kindtotter vandret ud, smal hals og busket hale med spids. Alternativ: kat. `[RÆV-M]` |
| 46 | ræv | sikker | Som #45, lille. Alternativ: kat. `[RÆV-S]` |
| 47 | kat | usikker | Katteører, takket pelskrave ved kinder og bryst og busket hale. Alternativ: ræv. `[Kt3-M]` |
| 48 | hest | usikker | Stor: rund pandelok, mankestrå til højre, langt bånd fra issen til jorden i venstre side og hale med takket ende. Båndet er enten en manke eller en løftet vinge. Er det en vinge, bliver svaret pegasus. `[He3-L]` |
| 49 | hest | sikker | Børstemanke, aflangt hoved med mule og hale. Alternativ: pegasus. `[He1-M]` |
| 50 | kanin | sikker | Stor: lange, lige ører, kruset manke om kinderne, store fødder og pomponhale. Alternativ: lam eller hamster. `[Ka3-L]` |
| 51 | hamster | sikker | Små runde ører, brede kindposer og lille kompakt krop. Alternativ: isbjørn eller panda, som også har runde ører. `[HAM-S]` |
| 52 | kat | sikker | Glatte ører, knurhår og tynd krølhale. Ingen reel alternativ. `[Kt1-M]` |
| 53 | hamster | sikker | Runde ører, kindposer og kompakt krop. Alternativ: isbjørn. `[HAM-M]` |
| 54 | panda | sikker | Runde ører, rundt hoved og bambuskvist. Alternativ: isbjørn. `[PAN-M]` |
| 55 | ræv | sikker | Stor: høje ører, kindtotter og busket hale med spids. Alternativ: kat. `[RÆV-L]` |
| 56 | hamster | sikker | Stor: runde ører og kindposer. Alternativ: isbjørn. `[HAM-L]` |
| 57 | hest | sikker | Lille: rund pandelok, lang manke til venstre og mule. Alternativ: enhjørning, men der ses intet horn. `[He3-S]` |
| 58 | panda | sikker | Lille: runde ører og bambus. Uden bambussen kunne den læses som isbjørn eller hamster. `[PAN-S]` |
| 59 | ugle | sikker | Øredusker og vinger foldet i siderne. Alternativ: drage. `[UGL-M]` |
| 60 | kanin | sikker | Lille: lige ører op, kruset manke og pomponhale. Alternativ: lam. `[Ka3-S]` |

## Opsummering

**Fordeling af mine svar (60):**

| Art | Antal | Heraf sikker | Former |
|---|---|---|---|
| kanin | 9 | 6 | Ka1 (ører op, det ene knækket), Ka2 (hængeører), Ka3 (løvehoved) |
| kat | 9 | 6 | Kt1 (glat, tynd krølhale), Kt2 (øredusker, busket hale), Kt3 (pelskrave) |
| hest | 9 | 7 | He1 (børstemanke), He2 (flad pandelok, lang manke), He3 (rund pandelok, lang manke) |
| enhjørning | 9 | 9 | En1 (kort takket pandehår), En2 (lang bølget manke), En3 (stjernehorn) |
| hvalp | 3 | 3 | HVA |
| pindsvin | 3 | 3 | PIN |
| **lam** | 3 | 3 | LAM |
| **ræv** | 3 | 3 | RÆV |
| **hamster** | 3 | 3 | HAM |
| **panda** | 3 | 3 | PAN |
| **egern** | 3 | 3 | EGE |
| **ugle** | 3 | 3 | UGL |
| pegasus, drage, pingvin, isbjørn | 0 | – | Ikke set |

- **Sikker 52, usikker 8:** #5, #10, #11, #14, #21, #26, #47 og #48. Alle usikre ligger blandt de gamle arter eller deres varianter.
- **De seks nye arter:** 18 af 18 er "sikker". Hver ny art har én entydig form, som genkendes i alle tre størrelser, også i S. Kendetegnene er:
  - lam: vandrette ører og uld,
  - ræv: høje ører, kindtotter og spids busket hale,
  - hamster: kindposer,
  - panda: bambus og runde ører,
  - egern: øredusker og S-hale,
  - ugle: fjerdusker og foldede vinger.
- **Strukturen:** 20 former × 3 størrelser. Kanin, kat, hest og enhjørning findes hver i tre former, som jeg læser som racer eller varianter af samme art. Pegasus, drage, pingvin og isbjørn har jeg ikke fundet. Hvis nogen af dem er med på arket, gemmer de sig i en af de tre-form-grupper, sandsynligvis pegasus i He2 eller He3, og så er det i sig selv en forveksling.

## Vigtigste forvekslingspar

1. **Kat ↔ ræv (vigtigst for bølge 2).** Den pjuskede kat (Kt3: #11, #47, #14) har takket pelskrave ved kinderne, og den buskede kat (Kt2: #28, #4, #7) har busket hale. Det er netop rævens to kendetegn. Ræven selv er entydig på de høje, smalle ører og den spidse hale, men katte-varianterne låner dens træk.
2. **Hest ↔ pegasus.** I L-udgaverne #5 og #48 går et langt, jævnt bånd fra issen til jorden. Det kan læses som en løftet vinge. I S og M (#15, #20, #44, #57) er manken kort, og forvekslingen opstår ikke.
3. **Kanin med hængeører ↔ hvalp.** Ka2 (#10, #21, #26) og HVA (#8, #19, #30) har begge store hængeører. Kun halen (pompon mod tynd) og fødderne skiller dem.
4. **Hamster ↔ panda ↔ isbjørn.** Alle har små runde ører. Hamsteren skilles på kindposerne. Pandaen skilles næsten kun på bambusrekvisitten: #58 uden bambus kunne være isbjørn eller hamster. Hovedet alene bærer ikke pandaen.
5. **Ugle ↔ drage.** De kløvede fjerdusker (#16, #22, #59) kan læses som horn. Kroppen med foldede vinger og ingen hale afgør det til ugle.
6. **Løvehovedkanin ↔ lam.** Ka3 (#32, #50, #60) deler krøllet hoved og kvasthale med lammet. De lange opretstående ører skiller dem.
7. **Egern ↔ kat (Kt2).** Begge har øredusker og busket hale, men egernets S-hale over hovedet er entydig. Mindre risiko.
