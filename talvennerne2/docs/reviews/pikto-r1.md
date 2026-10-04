# Piktogrammer runde 1: review (REVP)

Reviewer: REVP (uafhængig, har ikke tegnet noget af kunsten)
Dato: 2026-10-04
Emne: de 12 nye ting på svarkortene i "Tryk på alt, man måler i meter/centimeter" (QA2 P3-8)

## Resultat: ikke bestået

- **Tegningerne består genkendelighedskravet.** Blindt genkendte jeg 12/12 ved 46 px og 12/12 ved 78 px (krav: mindst 11/12 og 12/12).
- **Ét blokerende fund i kortene.** I fejlflowet med seks overstregede kort ligger den overstregede række oven på strategiteksten på liggende telefon (SE og X) og skjuler 2–3 linjer. Kravet "intet overlapper" er derfor ikke opfyldt. Auditten fanger det ikke.
- **Stilen ligger tæt på nabomaterialerne** (middel 4,2), men skoens sål trækker ned (stil 3). Briefen sætter ingen tærskel for stil. Bruger man kunst-rubrikkens accept som målestok (alle ≥ 4, middel ≥ 4,3), mangler både skoen og middeltallet.

Rettelse 1 er blokerende. Rettelse 2 bør laves i samme runde, fordi skoen er den eneste tegning under 4. Rettelse 3–5 anbefales.

## Grundlag

- **Blindtest:** `docs/reviews/pikto-r1-blind.md`, committet i 816b20f, før jeg havde åbnet andet end `blind-46.png` og `blind-78.png`. Filen er ikke ændret bagefter. Den rettes mod nøglen herunder.
- **Derefter læst og set:**
  - `docs/art-rubric.md`,
  - `docs/SPEC.md` (Ændringer, §3.4 og §11),
  - `/tmp/tv2-pikto/materials.png`,
  - de 18 skærmbilleder (ask, teach og teach6 i 6 viewports) med `task-audit.json` og `shoot.mjs` i `/home/user/wt/pikto/talvennerne2/artifacts/pikto/` og `before/`,
  - nøglen `/tmp/tv2-pikto/key.json`.
- **Kildekode:** For at kunne skrive konkrete rettelser har jeg læst `src/ui/scenes/objects.tsx`, `src/ui/task/faces.tsx`, `src/ui/task/task.css` og `src/ui/screens/child/round/round.css`.
- **Forbehold:**
  - Briefen nævnte 7 af de 12 kategorier, før jeg så billederne (tog, bus, lastbil, skib, hval, ske og gaffel). Fly, sko, kam, bro og hus var ukendte for mig.
  - Blindarkene er taget i 2x, så 46 px svarer til 92 fysiske px.

## Genkendelighed: blindtesten rettet mod nøglen

| # | Nøgle | Mit svar ved 46 px | Mit svar ved 78 px | Rigtigt (46/78) |
|---|---|---|---|---|
| 1 | plane | fly | fly | ja / ja |
| 2 | shoe | sko | sko | ja / ja |
| 3 | ship | skib | skib | ja / ja |
| 4 | whale | hval | hval | ja / ja |
| 5 | train | tog | tog | ja / ja |
| 6 | spoon | ske | ske | ja / ja |
| 7 | lorry | lastbil | lastbil | ja / ja |
| 8 | comb | kam | kam | ja / ja |
| 9 | bridge | bro | bro | ja / ja |
| 10 | house | hus | hus | ja / ja |
| 11 | fork | gaffel | gaffel | ja / ja |
| 12 | bus | bus | bus | ja / ja |

- **Tal:** 12/12 ved 46 px og 12/12 ved 78 px, alle markeret "sikker". Kravet er opfyldt.
- **Grænsetilfælde ved 46 px (ca. 90 %):** sko (kan læses som skøjte), kam (børste) og bus (togvogn).
- **To tællefejl i mine blindnoter:** Gaflen har 3 tænder, ikke 4, og kammen har 7, ikke 8. Svarene er de samme.
- **Ikke blindt, kun som supplement:** Jeg simulerede en 1x-skærm ved at nedskalere `blind-46.png` 2:1. Alle 12 er stadig læsbare. Ved 24 px på en 1x-skærm flyder kammens og gaflens tænder og skoens snørebånd sammen.
- **Størrelser i spillet** (`task-audit.json`):
  - Svarkortene viser billederne i 44–84 px. På liggende telefon er det 44 px, altså lidt under de testede 46 px.
  - Fejlflowets minikort og "Tryk på"-knappen viser dem i 24–38 px. Det dækker blindtesten ikke.

## Pr. ting

| Ting | Genkendt blindt (46 / 78 px) | Stil 1–5 | Note |
|---|---|---|---|
| fly | ja / ja | 4 | Tydelig silhuet med to vinger, halefinne, vinduer og cockpitrude. Flyet er rødt ligesom fire andre ting. |
| sko | ja / ja (ca. 90 % ved 46) | 3 | Sålen ligger løst under skoen og stikker ud bag hælen og foran tåen. Den lyse INK_3-kontur bryder med skoens mørkerøde, så sålen læses som en skinne (skøjte). Se rettelse 2. |
| skib | ja / ja | 4 | Klar. Vandet er et fuldbredde-rektangel uden kontur med lige afskårne sider. Kahyttens ruder og koøjerne har ingen kontur, mens bussens og husets har. Se rettelse 5. |
| hval | ja / ja | 5 | Sættets bedste: pust, halefinne, lys bug, øje og smil. Pustet er uden kontur ligesom vandet, og det passer sammen. |
| tog | ja / ja | 4 | Klar silhuet med lokomotiv, skorsten og vogn. Hjulene har ingen nav (bus og lastbil har), og toget ligner et legetøjstog. |
| ske | ja / ja | 4 | Klar og tydeligt forskellig fra gaflen. Konturen (2,2) er tyndere end gulerodens, bladets og regnormens (2,6), så skeen vejer lettere på kortet. |
| lastbil | ja / ja | 5 | Ren og konsekvent: lad, førerhus, chassis og hjul med nav. Den kan ikke forveksles med bussen. |
| kam | ja / ja (ca. 91 % ved 46) | 4 | Kammen har nøjagtig regnormens farver (MAT.petal), og de to står side om side i opgaven. Tænderne flyder sammen under ca. 30 px på en 1x-skærm. Se rettelse 4. |
| bro | ja / ja | 4 | Bue, gelænder og vand læses straks. Bue-ringen (1,4 ved 55 %) og de 7 stolper bliver hårfine i små størrelser. Vandet har samme problem som skibets. Se rettelse 5. |
| hus | ja / ja | 5 | Klart og varmt: tag med skygge, skorsten, dør med greb og ruder med sprosser. |
| gaffel | ja / ja | 4 | De tre brede tænder holder ved 46 px. Konturen (1,8) er sættets tyndeste, ca. 1 px ved 24 px. |
| bus | ja / ja (ca. 90 % ved 46) | 4 | Stilen er i orden, men kassen er kort og uden dør. Den høje rude til højre er ment som forrude, men læses som endnu et sidevindue, så bussen kan ligne en togvogn. Se rettelse 3. |

Middel for stil: 4,2.

## Stil mod nabomaterialerne

**Det, der stemmer:** De nye ting bruger samme system som blyant, gulerod, regnorm og blad: flad fyld, en mørkere skygge nederst til højre, et hvidt højlys på 45 % og en farvet kontur på ca. 2,4–2,6 afledt af fyldet. Alle farver kommer fra materialepaletten.

**Afvigelser:**
- Vandet under skib og bro og hvalens pust har ingen kontur. Vandet går desuden i fuld bredde med lige afskårne sider og ligner et klippet rektangel.
- Skoens sål og skibets kahyt har den lyse INK_3-kontur. På skoen får det sålen til at se løs ud.
- Konturen er tyndere på gaflen (1,8), skeen (2,2) og kammen (2,0) end på resten (2,6).
- Togets hjul har ingen nav, mens bussens og lastbilens har.
- Fem af tolv ting er røde (MAT.apple: sko, tog, skib, fly og hus), og kammen har samme farver som regnormen. På seks kort giver det mindre variation.
- Detaljegraden er højere end nabomaterialernes, men den holder ved 44 px. I minikortene (24–38 px) bliver broens bue-ring og gelænder, husets sprosser og skoens snørebånd til støj.

## Kortene (6 viewports)

**Svarkortene (ask): i orden i alle 6 viewports.**
- Billede og ord er læsbare, intet er beskåret eller overlapper, og de seks kort passer uden scroll.
- Det mindste kort er 82x85 px, så kravet om svarkort på mindst 80x80 er opfyldt.
- Kosmetisk: "en regnorm" brydes på to linjer i X-p, SE-l og X-l. Rækkerne får derfor forskellig højde: 114x105/114x125 og 82x85/82x100.

**Fejlflowet (teach med 3 kort og teach6 med 6 kort):**
- teach er i orden i alle 6 viewports, og teach6 er i orden i portræt og på iPad.
- **Blokerende:** I `task-teach6-se-l.png` og `task-teach6-x-l.png` ligger den orange boks med de seks overstregede kort oven på strategiteksten.
  - I SE-l ligger boksen ved ca. x 66–1282 og y 298–412 i 2x-PNG'en. I X-l ligger den ved ca. x 318–1532 og y 296–408.
  - Den skjuler linjerne "bruger vi til at måle, hvor langt noget er. Små ting måler vi i".
- **Auditten fanger det ikke.** `task-audit.json` melder `over: false` og `clipped: []` for begge, fordi `shoot.mjs` kun tjekker overløb på siden og hvert billede og ord mod sit eget kort.
- **Eksisterende problem, til integratoren** (det ses også i `before/teach-se-l.png`):
  - Overstregningen går ud over den overstregede boks. I teach6 på liggende telefon når den helt op i himlen ved knapperne.
  - Den krydser strategitekstens sidste linje ("meter.") i blandt andet teach-x-p, teach-ipad-l og teach6-ipad-l.
  - I teach6 i portræt gør den "en kam" ulæselig.
  - Det er ikke piktogrammernes skyld, men stregen krydser nu billederne.

**SPEC:**
- §3.4: Ting-kortene har piktogram og ord, og ordet læses op via `optionClips`.
- §11: Kunsten ligger i TSX (`src/ui/scenes/objects.tsx`). De tilføjede linjer har ingen binære billeder, ingen emoji og ingen rå hex-farver.

## Misforståelser et barn kunne få

| Par | Risiko | Hvorfor |
|---|---|---|
| bus / lastbil | lav | Farve og form er forskellige: en gul kasse med vinduesrække mod et orange lad med blåt førerhus. |
| tog / bus | lav–middel | Toget er tydeligt med skorsten og vogn. Bussen har ingen front eller dør og kan ligne en togvogn eller sporvogn. Se rettelse 3. |
| skib / hval | lav | Begge har noget blåt (vand og pust), men silhuetterne er helt forskellige. |
| ske / gaffel | lav | Skål mod tre tænder. De har samme grå farve og spejlvendt vinkel, men skelnes stadig ved 24 px på retina. |
| sko / skøjte | lav–middel | Den løse, brede sål ligner en skinne. Se rettelse 2. |
| kam / børste, kam / regnorm | lav (lav–middel under 30 px) | Tænderne flyder sammen i små størrelser, og kammen har samme lyserøde farve som regnormen. Se rettelse 4. |
| tog (og bus) som legetøj | lav–middel | Opgaven handler om størrelse. Et kort, sødt legetøjstog kan få et barn til at tænke "centimeter". Skinner under toget ville hjælpe. |
| bro / tunnel eller port | lav | Vandet under buen afgør det. |
| hval / fisk | lav | Pustet afgør det. |

## Rettelser i prioriteret rækkefølge

1. **Fejlflowets seks overstregede kort på liggende telefon (blokerende).**
   - *Sandsynlig årsag (læst i CSS'en, ikke afprøvet):* `.tv-teach__given` har `flex: none` (`round.css`). I liggende format er `.tv-teach__row.is-wide` en vandret, højrestillet række (`flex-direction: row`, `justify-content: flex-end`). Boksen kan derfor ikke krympe, wrap-reglen i `task.css` får ingen bredde at bryde efter, og rækken løber mod venstre ind over `.tv-hint__text`.
   - *Ret sådan:* Lad boksen krympe, når den har billeder, fx `.tv-teach__given:has(.tv-face__thing) { flex: 0 1 auto; min-width: 0; max-width: 100%; }`. Så brydes de seks minikort 3 + 3 inden for række-kolonnen. Alternativt kan den overstregede række få sin egen linje i fuld bredde under teksten.
   - *Tjek bagefter:* Tag `teach6-se-l` og `teach6-x-l` om.
   - *Udvid `shoot.mjs`:* Auditten skal fejle, når rektanglet for `.tv-teach__given` skærer `.tv-hint__text`.
2. **Skoens sål (stil 3).**
   - *Problem:* Sålen (`roundRect(3, 36, 44, 7, 3.5)`, MAT.frame) ligger løst under skoen og stikker 2 enheder ud bagved og 1 foran (overdelen går fra x 5 til 46).
   - *Ret sådan:* Lad sålen følge overdelens bund (x 5–46) med afrundet hæl, og lad den bue op foran og gå over i tåkappen. Giv den skoens kontur (`t.outline`) i stedet for den lyse INK_3, så sko og sål bliver én form.
   - *Behold:* snørebåndene og sløjfen.
3. **Bussens front (grænsetilfælde ved 46 px, tog/bus).**
   - *Ret sådan:* Gør højre ende til en tydelig front: forrude helt ude i enden, let skrå eller afrundet næse og en lille forlygte nederst.
   - Sæt en dør lige bag forruden, fx to smalle lodrette ruder ned mod bunden.
   - Gør kassen lidt længere og lavere, fx 44 x 24 i stedet for 42 x 28, med hjulene nær enderne.
4. **Kammen (grænsetilfælde ved 46 px).**
   - *Ret sådan:* Giv kammen en anden tone end regnormen, fx MAT.rim eller en lilla eller grøn tone fra paletten.
   - Hæv konturen fra 2,0 til 2,4.
   - Brug 6 tænder på ca. 3,4 enheder med lige så brede mellemrum, så de holder sig adskilt under 30 px.
5. **Små størrelser og vandet (fejlflowets 24–38 px og stil).**
   - *Ret sådan:*
     - Hæv konturen på gaffel og ske til mindst 2,4.
     - I `is-sm` skal broens bue-ring, hver anden gelænderstolpe og husets sprosser væk. Det kan også gøres med en lille variant pr. ting.
     - Stop vandstrimlen under skib og bro inden for x 2–46, giv den afrundede ender, og giv den en mørkere blå kontur som resten af tegningerne.

**Mindre ting, der kan vente:**
- Toget kan bruge `wheels()` med nav som bus og lastbil og evt. to skinner under hjulene.
- Fire røde ting på seks kort kan undgås, fx med blå vinger på flyet eller en blå sko.
- Svargitteret kan få ens rækkehøjde (fx `grid-auto-rows: 1fr`).
- Overstregningen bør klippes til sin boks (integratoren, eksisterende).
