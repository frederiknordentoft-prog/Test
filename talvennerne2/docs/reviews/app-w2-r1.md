# App-review, bølge 2 runde 1 (QA2): Hestebakkerne og Regnbueskoven spillet igennem

Uafhængigt produkt- og QA-review af 1. og 2. klasses verdener, før de frigives (`RELEASED_WORLDS` i `src/meta/built.ts`). Verdenerne er spillet som barn og som forælder. Formatet og P1/P2/P3-skalaen følger QA1's review af Engdalen (`docs/reviews/app-gslice-r1.md`).

- **Build:** `f368c38` på `tv2/qa2`. `npm run build` var grønt: initial 139,7 KB og al JS 586,8 KB gzip. Budgettet er 600 KB, så der er 13 KB tilbage til bølge 3.
- **Afvikling:** dev-serveren (port 4353) med `?worlds=all&e2e=1&voice=fast`. `?worlds=all` virker kun i dev (`import.meta.env.DEV` i `src/meta/built.ts`), så prod-buildet kan ikke åbne de to verdener endnu.
- **Chromium:** `scripts/browser.mjs` med fingre (CDP `Input.dispatchTouchEvent`, både tryk og træk), `hasTouch`, `isMobile` på telefon og `da-DK`.
- **Adgang:** dev-profiler oprettet med `createProfile` og en startven. Verdenen og dens steder er åbnet i `profile.unlocked`, altså samme vej som dashboardets "Åbn hele …", når verdenen er frigivet. Lydtjekket er sat som bestået (`device.audioVerified`), så hør-opgaverne kommer med.
- **Oplæsning:** `window.__voiceLog` er holdt op mod stemmens manifest (`src/assets/voice/voice-manifest.json`, 1.225 klip). Mangler et klip, læser enhedens stemme hele sætningen.
- **Skærmbilleder og scripts:** ligger i `artifacts/qa2/` (git-ignoreret): `play.mjs`, `content.mjs`, `after.mjs`, `vp.mjs`, `pay.mjs`, `pay2.mjs` og `lib.mjs`. Alle stier herunder er relative til `talvennerne2/`.
- **Teknisk klar:** `worldReady('bakke')` og `worldReady('skov')` er sande, når `released` ikke filtrerer. Alle skills har moduler, og venner, kister og finaleting er tegnet. Frigivelsen er altså én linje i `RELEASED_WORLDS`.

## Resultat

RESULTAT

| Punkt | Karakter (1–5) |
|---|---|
| Funktionsfejl (5 = ingen) | KAR1 |
| Børnebrugbarhed | KAR2 |
| AAA-indtryk | KAR3 |
| Fremdrift og motivation | KAR4 |
| Forældrenes dashboard | KAR5 |

## Sådan er der spillet

**Fire børn på én dag, hver i sit format, med alle seks sten i hver region (l1, l2, ven/kiste, l3, blandet, prøve):**

| Barn | Format | Regioner |
|---|---|---|
| Mie, 1. kl., kat | telefon 393×852 | Hundredemarken l1, Dobbeltdalen, Tyvebroen og Formværkstedet |
| Otto, 1. kl., kanin | iPad på tværs 1180×820 | Urtårnet, Tierhoppet, Målebakken og Hestebakkernes finale |
| Sara, 2. kl., hvalp | iPad 820×1180 | Stortalsbjerget, Vekselvandet, Gangegrotten, Urtårnets top og Regnbueskovens finale |
| Bo, 2. kl., føl | telefon 393×852 | Købmandsgården, Hundredebroen, Linealstien og Figurhaven |

- Hundredemarken er desuden spillet helt igennem i en kalibreringstur på telefon.
- **Svar:** rigtige svar med fingeren. 1–2 forkerte svar pr. tur, på 2. og 7. første forsøg (i l3 det 3. og i prøven det 5.).
- **Dumpede prøver:** Urtårnet og Købmandsgården blev dumpet med vilje (7 planker). Derefter Træningshytten og en ny prøve, der blev bestået.
- **Friske profiler** (dagens loft over nye nøgler nulstillet, se P2-1): l1, l2 og prøven i Tyvebroen, Formværkstedet, Tierhoppet, Målebakken, Vekselvandet, Gangegrotten, Urtårnets top, Linealstien, Figurhaven og Hundredebroen. Først dér kom figurer, mål, brøker og gange rigtigt i spil.
- **Omfang:** 120 ture (90 i hovedkørslen og 30 med friske profiler) med 1.410 opgaver. 180 forkerte svar gav fejlflowet, og 91 guldæg blev fanget. FINALE_OMFANG
- **Bagefter, med de fire børn importeret på én enhed:** kortet i fire formater, voksen-porten (først med et forkert svar) og alle syv faner i dashboardet for 1. og 2. klasse, udskrift, Dyrehaven, garderoben, butikken, bøgerne og mestringssættene.
- **Formater:** telefon på tværs (852×393) med alle wave 2-opgavetyper og 4× CPU-throttle på opgaveskærmen.

**Verificeret OK:**
- Alle opgavetyper kan besvares med fingeren:
  - urets visere trækkes,
  - mønter og sedler trækkes eller trykkes i bakken,
  - ting deles ud ved træk eller tryk på tallerkner,
  - brøkdele farves ved at stryge hen over dem,
  - nålen trækkes hen ad tallinjen,
  - kort, tastatur, felter, byggeklodser, rækkefølge og "find dem alle" trykkes.

  Der var ingen fejlregistrering ud over P1-2 (betaling).
- 0 trykmål under 60 px i svarfeltet og ingen vandret scroll i opgaverne i nogen af formaterne.
- Fejlflowet viste overstreget svar, strategi med billede og én stor "Tryk på …" i alle 180 fejl. For ur, penge og deling var det ét kort med det rigtige ur, den rigtige bakke eller de rigtige tallerkner. Turen gik først videre efter trykket.
- Mesterprøven: "Klar, når du er. Bedst: 7 planker", Træningshytten lyser, "Spil en tur først, så er broen klar igen", og en bestået prøve giver medalje og tåge, der letter.
- Mønterne ligner danske mønter i farve, hul og indbyrdes størrelse (5 kr. > 20 kr. > 10 kr.). Urene er rene og korrekte, også ved halv og kvart. Linealen, søjlediagrammet og brøkfigurerne er klare.
- Venner (lam, ræv, hamster, enhjørning, panda, egern og ugle) og kister (Ridehjelm, Støvbriller, Gulerod, Diadem, Monokel, Perlekæde, Scepter) blev givet og vist på stenkortet på forhånd. Hvalpen er nu tegnet (QA1's P1-2).
- Ingen opgave var uden oplæsning: hver eneste opgave lagde klip i `__voiceLog`.

## Oplæsning: hvor enhedens stemme bruges

Bølge 2's klip indspilles stadig, så reserven er forventet. 79 % af opgaverne (1.116 af 1.410) blev læst af enhedens stemme, fordi mindst ét klip i sætningen mangler. Tallet gælder den region, turen blev spillet i (se P2-1 om lånte opgaver).

| Region | Opgaver med enhedens stemme |
|---|---|
| Hundredemarken (kun l1) | 5 af 13 (38 %) |
| Dobbeltdalen | 74 af 74 (100 %) |
| Tyvebroen | 82 af 108 (76 %) |
| Formværkstedet | 104 af 106 (98 %) |
| Urtårnet | 96 af 96 (100 %) |
| Tierhoppet | 42 af 108 (39 %) |
| Målebakken | 94 af 108 (87 %) |
| Stortalsbjerget | 64 af 74 (86 %) |
| Vekselvandet | 21 af 94 (22 %) |
| Gangegrotten | 82 af 108 (76 %) |
| Urtårnets top | 88 af 109 (81 %) |
| Købmandsgården | 86 af 86 (100 %) |
| Hundredebroen | 74 af 108 (69 %) |
| Linealstien | 108 af 108 (100 %) |
| Figurhaven | 87 af 98 (89 %) |

- Mest brugt: `t.end`, `frag.stil_uret_saa_klokken_er`, `noun.unit.*`, `s.clock.*`, `s.money.*`, `frag.du_betaler_med`, `noun.coin.*`, `s.change.*` og `hog.*` (hundreder-og-tal).
- Hele spørgesætninger for 1. klasses fakta (`q.dbl:5`, `q.hlf:20` …) mangler også. De skal være indspillet før frigivelse (SPEC D8).
- Ingen cifre i oplæsningen: al tale går gennem klip-kataloget, hvis tekster `catalog.test.ts` holder cifferfri (stikprøve på 143 af de 621 brugte id'er bekræftet). Skærmteksten i strategierne bruger cifre ("50 70 90. Det er 90 kr."), mens talen bruger ord.


---

## P1 – blokerer frigivelse

### P1-1 "Det lærte du" viser urets minuttal som tal: "540", "0", "525" – og siger "Tallet fem hundrede og fyrre"

- **Skærm og format:** opsummeringen efter turen. Alle formater, set på iPad på tværs og iPad på højkant.
- **Trin:**
  1. Spil en tur i Urtårnet (Hestebakkerne) eller Urtårnets top (Regnbueskoven).
  2. Se den første skærm efter turen.
- **Set:**
  - Kortene under "Det lærte du" viser minuttallet fra urets fakta-id i stedet for klokkeslættet, med et øre-ikon: "540", "240" og "180" (kl. 9, 4 og 3).
  - Det skete efter alle 14 ture i de to urregioner. Eksempler: "0" for kl. 12, "570" for halv ti, og "525", "105" og "645" for kvart i ni, kvart i to og kvart i elleve.
  - Talen er "Tallet" + tallet, altså "Tallet fem hundrede og fyrre. Du er blevet bedre til det her."
  - Det er den første skærm efter hver urtur ("Læring vises før ting", SPEC §1), og den er forkert både på skærmen og i øret.
- **Burde:** En lille urskive eller "kl. 9" / "halv ti" / "kvart i ni" (der findes klip til klokkeslæt i `speech/clock.ts`), både vist og læst op.
- **Skærmbillede:** `artifacts/qa2/bakke1-ipadLand-cer-w1-klokken-l1-0-summary.png`
- **Fil:**
  - `src/ui/screens/child/ceremony/describe.ts` (`keyFace`: `typeof fact.answer === 'number'` giver `{ t: 'number', n: fact.answer }` og talen `s.reward.learned.number` + tallet; ursvar er minutter, `answerType: 'minutes'`)
  - Samme gren giver kontekstløse tal for andre fakta, se P3-12.

PAYP1

---

## P2 – bør rettes før frigivelse

### P2-1 En ny regions første sten er næsten uden regionens stof, når dagens nye nøgler er brugt

- **Skærm og format:** turen. Alle formater.
- **Trin:**
  1. Spil to regioner igennem på samme dag (ca. 12 ture), fx Hundredemarken og Dobbeltdalen.
  2. Gå til en ny region, fx Formværkstedet, og spil l1, l2 og kisten.
- **Set:**
  - Formværkstedet l1 havde 0 af 10 figuropgaver. Resten var dobbelt, halvdelen, "5 + ? = 7" og "7 + 7" fra Dobbeltdalen og Tyvebroen. Den eneste figuropgave var "shape:square:5" i alle tre ture.
  - Det gjaldt alle regioner, der blev startet efter ca. 12 ture:

    | Sten | Egne opgaver |
    |---|---|
    | Tyvebroen l1 | 0 af 10 |
    | Tierhoppet l1 | 1 af 10 |
    | Formværkstedet l1, l2, kiste | 0, 1 og 1 af 10 |
    | Gangegrotten l1, l2 | 0 og 1 af 10 |
    | Vekselvandet l1 | 1 af 8 |
    | Målebakken l1 | 0 af 3 (en tur på tre opgaver) |

  - Barnet får alligevel stjerner, kisten (Støvbriller) og vennen, og stenene tæller som spillet. Bagefter kommer mesterprøven med 10 af 10 egne opgaver, som barnet næsten ikke har øvet.
  - Det følger A13 (loft på 20 nye nøgler pr. læringsdag, `TASTE_KEYS` og `TASTE_PER_DAY`). Men for barnet hedder stenen "Formværkstedet", og den indeholder plusstykker. For en forælder, der lige har åbnet verdenen, ser det ud som en fejl.
  - Med friske profiler (nyt døgn) var l1 og l2 i de samme regioner 10 af 10 egne opgaver.
- **Burde:** En sten, der ikke kan give sit eget stof i dag, skal sige det, fx "Her er der nyt i morgen", eller vise smagsprøven tydeligt som en kort tur. Den skal ikke kunne give kiste, ven og stjerner uden regionens stof.
- **Skærmbilleder:**
  - `artifacts/qa2/bakke0-phone-ask-w1-figurer-keypad-addTo20.png` (Formværkstedet med "7 + 7")
  - `artifacts/qa2/bakke0-phone-teach-w1-figurer-keypad-missingPart10.png`
  - `artifacts/qa2/skov2-ipad-ask-w2-klokken-share-shareEqually.png` (Urtårnets top med en delingsopgave)
- **Fil:** `src/engine/roundBuilder.ts` (`NEW_PER_DAY`, `CAPPED_REPEAT_MAX`, `TASTE_KEYS`, `TASTE_PER_DAY` og fyldet i linje 360–440), `src/meta/progression.ts` (stjerner og node-belønninger)

### P2-2 Ven-noden viser artens standarddyr, men barnet får en anden farve: en grå ræv og et sort egern

- **Skærm og format:** kortets stenkort og ceremonien "En ny ven!". Alle formater.
- **Trin:** Tryk på ven-stenen i Urtårnet, og spil turen. Gør det samme i Købmandsgården.
- **Set:**
  - Kortet viser en orange ræv ("Her møder du en ny ven: Ræv"), men ceremonien giver en grå ræv, der ligner en ulv.
  - Egernet på kortet er rødt, men barnet fik et sort egern. Enhjørningen kom i farve `c4`.
  - Farve og race trækkes seedet (`rollCombo`), mens kortet tegner `AnimalPicture species=…` med standardfarven. Det er samme slags løftebrud som QA1's P2-9 (ægget).
- **Burde:** Kortet viser præcis det dyr, noden giver (trækket kan regnes ud på forhånd), eller noden giver artens kendte farve første gang.
- **Skærmbilleder:**
  - `artifacts/qa2/bakke1-ipadLand-sheet-w1-klokken-friend.png`
  - `artifacts/qa2/bakke1-ipadLand-cer-w1-klokken-friend-2-thing.png`
  - `artifacts/qa2/skov3-phone-cer-w2-penge-friend-1-thing.png`
- **Fil:** `src/ui/screens/child/map/StoneSheet.tsx` (`AnimalPicture`), `src/meta/animals.ts` (`friendAnimal`, `rollCombo`)

### P2-3 Oplæsningen taber en sætning, og konsollen får en fejl (stemmens LRU-cache)

- **Skærm og format:** turen. Set på iPad og telefon.
- **Trin:** Spil de første ture i en ny region, mens stemmens sprites hentes i baggrunden.
- **Set:**
  - `TypeError: Cannot read properties of undefined (reading 'bounds')` i `boundsFor` (`src/audio/voice.ts`), 4 gange i 90 ture: Urtårnet l1, Tierhoppet l1, Gangegrotten l2 og Urtårnets top l3.
  - Fejlen fanges i `Speech.run`, og sætningen bliver tavs.
  - Årsag: `Speech.run` venter på, at sprites er klar, men tæller dem først som i brug (`inUse++`) efter endnu en `await`. Imens kan `evict()` (kaldt, når en anden sprite er indlæst) slette en klar sprite, som ingen holder. Så giver `sprites.get(...)` `undefined`. LRU'en fylder, fordi `preloadVoice` henter alle UI-sprites (ca. 15 min lyd, over 64 MB afkodet).
  - SPEC §15.2 kræver 0 konsolfejl.
- **Burde:** Hold på spritene, så snart de er klar (fx `inUse++` inde i `loadSprite`'s resultat, før der ventes igen), eller lad `playClips` falde tilbage til enhedens stemme i stedet for at kaste.
- **Skærmbillede:** – (konsollen). Logget i `artifacts/qa2/bakke-rounds.jsonl` og `skov-rounds.jsonl`.
- **Fil:** `src/audio/voice.ts` (`Speech.run`, `evict`, `playClips`, `boundsFor`)

### P2-4 Tallinjeopgaven viser ikke tallet: "Sæt nålen ved …" findes kun i lyd

- **Skærm og format:** opgave (`numberline`). Alle formater.
- **Trin:** Få en `numberLine100`- eller `numberLine1000`-placering, fx i Hundredemarken eller Stortalsbjerget.
- **Set:**
  - Skærmen viser kun en tom tallinje og "Sæt nålen på tallinjen." Tallet, der skal placeres (fx 30 eller 640), står ingen steder. Det findes kun i talen "Sæt nålen ved tredive".
  - Klippet `s.nl.place` er ikke indspillet, så sætningen læses af enhedens stemme.
  - Et barn i 1. klasse skal altså huske et dansk talord som "halvfjerds", før det kan estimere. Opgaven blander hør-tal og placering, så en fejl kan ikke tolkes.
  - På iPad står linjen alene midt på en ellers tom skærm.
- **Burde:** Vis tallet tydeligt over linjen ("Hvor er 30?"). Nålen skal stadig ikke vise sit tal.
- **Skærmbilleder:**
  - `artifacts/qa2/calib/bakke-phone-ask-w1-tal100-numberline-numberLine100.png`
  - `artifacts/qa2/skov2-ipad-ask-w2-tal1000-numberline-numberLine1000.png`
- **Fil:** `src/ui/task/numberline/View.tsx` (`numberlineOwnsPrompt`: "target … never drawn here"), `src/engine/skills/number/numberLine100.ts` og `numberLine1000.ts` (`prompt` giver `{ ...LINE }` uden mål)

### P2-5 Et forkert svar med flere felter står samlet i første felt: "64 = 64 + ?"

- **Skærm og format:** fejlflowet i `fillSlots` med to eller tre felter i en ligning. Telefon.
- **Trin:** Svar forkert på "64 = ? + ?" (Tiere og enere) eller "586 = ? + ? + ?".
- **Set:**
  - Barnets svar "6 | 4" vises som "64" overstreget i første felt, og andet felt viser stadig "?". Det ligner, at barnet har skrevet 64.
  - QA1's P2-6 blev rettet for rækker (`scene: 'row'`), men ikke for ligninger.
- **Burde:** Hvert tal i sit eget felt, også i ligninger.
- **Skærmbillede:** `artifacts/qa2/bakke0-phone-teach-w1-tieren-fillSlots-tensOnes.png`
- **Fil:** `src/ui/screens/child/RoundScreen.tsx` (`blankFaces` håndterer kun `prompt.scene === 'row'`; `blankFace`)

MEDALP2

### P2-7 Finalens ting ryger ned i "Også i dag" som små tekstkort

- **Skærm og format:** slutningen af Hestebakkernes finale. iPad på tværs.
- **Trin:** Bestå finalen.
- **Set:**
  - "Verdensfest! Du klarede finalen." og "En ny ting! Rosette" får hver sin skærm.
  - Ridejakke og Sadeltaske, de to andre finaleting, er kun små kort med et gaveikon under "Også i dag". De har hverken billede eller "Prøv den på".
  - Det er verdenens største fest, og tre af Rytter-sættets seks ting kommer her.
  - Stenkortet til finalen viser heller ikke, hvad man kan vinde ("Den store fest for hele verdenen."), hvor kister viser deres ting på forhånd.
- **Burde:** Finalens ting vises samlet på én skærm med billeder og "Prøv dem på", og stenkortet viser dem på forhånd.
- **Skærmbilleder:** `artifacts/qa2/bakke1-ipadLand-cer-bakke-finale-end.png`, `artifacts/qa2/bakke1-ipadLand-sheet-finale.png`
- **Fil:** `src/meta/ceremonyQueue.ts` (`MAX_FULL_SCREEN`, `weightOf` for `item`), `src/ui/screens/child/ceremony/End.tsx`, `src/ui/screens/child/map/StoneSheet.tsx`


DASHP2

---

## P3 – senere

| # | Skærm / format | Fund | Skærmbillede | Fil |
|---|---|---|---|---|
| 1 | alle | QA1's P3-1 er stadig åben: 153 konsoladvarsler i 90 ture ("Oscillator.frequency … 12320 / 15522 outside nominal range"), én ved hver fejring. | – | `src/audio/sfx.ts`, `src/audio/engine.ts` |
| 2 | fejlflow, ur | Strategien blander ord og cifre i samme sætning: "Ved hele timer peger den lange viser på tolv. Den lille viser peger på 12." | `bakke1-ipadLand-teach-w1-klokken-clockSet-clockHour.png` | `src/ui/hint/displayText.ts` (skærmteksten; talen siger "tolv" og "tre"), `src/speech/clips/skills/clock.ts` |
| 3 | fejlflow, telefon | Det overstregede svar ("53") ligger oven på hundredtavlens øverste højre hjørne og dækker 9, 10, 19 og 20. | `calib/bakke-phone-teach-w1-tal100-choice-order100.png` | `src/ui/hint/HintVisual.tsx`, `src/ui/hint/hint.css` |
| 4 | opgave, penge | Priserne er ikke realistiske for børn: en gulerod koster 90 kr. | `skov3-phone-ask-w2-penge-pay-payExact.png` | `src/engine/skills/money/payExact.ts` |
| 5 | opgave, ligevægt | Vippen står altid vandret (`tilt={0}`), også når "7 + 3 og 6 + 4"-påstanden er falsk. Et barn læser en vandret vippe som "lige meget". Strategien taler om "lighedstegnet", selv om der ikke er noget lighedstegn på skærmen. | `skov3-phone-ask-w2-hundreder-trueFalse-equalSides.png`, `skov3-phone-teach-w2-hundreder-trueFalse-equalSides.png` | `src/ui/scenes/PromptScene.tsx` (`Seesaw tilt={0}`), `src/speech/clips/skills/algebra2.ts` (`hint.algebra2.sameBothSides`) |
| 6 | fejlflow, deling | Strategien siger "Alle dyr skal have lige mange. Giv en til hvert dyr …", men skærmen viser tallerkner, ikke dyr. | `skov2-ipad-teach-w2-klokken-share-shareEqually.png` | `src/speech/clips/skills/muldiv.ts` (`hint.shareEqually.sameForAll`) |
| 7 | fejlflow, tælle i spring | Hoppene på tallinjen går 400 → 500 → … → 800, men talrækken var 420, 520, 620, og teksten siger "620 plus 100 giver 720". | `skov3-phone-teach-w2-hundreder-fillSlots-skipCount.png` | `src/engine/skills/number/skipCount.ts` (hint) |
| 8 | opgave, enheder | Svarkortene i "Tryk på alt, man måler i meter" er ord uden piktogram ("en bus", "en ske", "en regnorm"). SPEC §3.4 kræver piktogram ved token-kort. Kortene læses op, men et barn, der ikke kan læse, skal huske rækkefølgen. | `skov3-phone-ask-w2-maal-data-multiSelect-unitChoice.png` | `src/engine/skills/measure/unitChoice.ts`, `src/ui/task/faces.tsx` |
| 9 | opgave, figurer | Stilladset på nye nøgler er en tom tallinje 0–10, også ved "Hvor mange sider har trekanten?" og "Hvor mange halvcirkler skal der til for at lave en cirkel?", hvor den ikke hjælper. | `fresh-bakkeF0-phone-ask-w1-figurer-sidesCorners-sides-choice.png`, `fresh-skovF2-ipad-ask-w2-figurer-composeShapes-compose-choice.png` | `src/ui/hint/hintFor.ts` (`scaffoldFor`) |
| 10 | opgave, tallinje | Nålens skygge starter midt på linjen. Ved "5 + 5" på 0–20 står den præcis på svaret. | `bakke0-phone-ask-w1-dobbelt-numberline-doubles.png` | `src/ui/task/numberline/View.tsx` |
| 11 | kort, iPad | "Næste sted" klipper regionsnavnet ("Stortalsbjerg…"). Mål 2 sender et barn i 1. og 2. klasse til Tællelunden i Engdalen ("Tag en tur forbi Tællelunden"), hvor det aldrig har været. | `skov2-ipad-map-start.png` | `src/ui/screens/child/map/SidePanel.tsx`, `src/meta/progression.ts` (`revisitRegions`) |
| 12 | opsummering | Samme gren som P1-1 giver andre kontekstløse tal: halvdelen af 8 bliver "4" med et øre-ikon ("Tallet fire"), og tiere bliver "180". Det er ikke forkert, men barnet kan ikke se, hvad det har lært. | `bakke1-ipadLand-cer-w1-klokken-l1-0-summary.png` (samme layout) | `src/ui/screens/child/ceremony/describe.ts` (`keyFace`) |
| 13 | opgave, tiere og enere | Udfyldning "64 = ? + ?" og "586 = ? + ? + ?" viser felterne to gange: i ligningen og i svarbakken (som QA1 så for sortOrder). | `skov2-ipad-ask-w2-tal1000-fillSlots-placeValue1000.png` | `src/ui/task/fillSlots/View.tsx` |

## Rækværk (SPEC §13) i de nye verdener

| Punkt | Status |
|---|---|
| Streak, nedtælling, notifikationer | Ingen fundet. Målet "Svar rigtigt fem gange i træk" gælder én tur (SPEC §13.9), ikke dage. |
| Tidsbegrænsede tilbud, sjældenhed | Ingen. Butikken har faste priser. Venner og æg trækker race og farve blandt uejede, alle lige meget værd (men se P2-2: kortet viser ikke den trukne farve). |
| Rigtige penge, reklamer, eksterne kald | Ingen. Alle forespørgsler gik til samme origin i alle kørsler (`artifacts/qa2/*-net.json`). |
| Skyld | Ingen skyldtekster i de nye klip (scan for "savner", "ked af det", "kom tilbage" m.fl. og gennemlæsning). En dumpet prøve hedder "Klar, når du er. Bedst: 7 planker". |
| Auto-start, fokus | Ingen auto-start. "Næste" og "Til kortet" er lige store på alle ceremoniskærme i alle formater. |
| Valuta under turen | Ingen tal under turen. Perler og point tælles op efter "Det lærte du". |
| Sammenligning | Ingen. Dashboardet viser ét barn ad gangen, også med fire børn på enheden. |
| Intet optjent tabes | OK i data: inventar og dyr voksede i alle 90 ture. MEDALRAEK |
| ✕ gemmer | Ikke gentestet her. QA1 og loop-e2e dækker det, og de nye opgavetyper bruger samme tur. |
| Lange sessioner konsoliderer | Ja, og for meget: efter ca. 12 ture på en dag er nye regioner næsten uden eget stof (P2-1). |
| Gennemsigtighed for forældre | DASHRAEK |

## Hvad virker godt

1. **Fingeren virker overalt.** De fire nye opgavetyper føles som legetøj:
   - Viserne snapper på uret, og timeviseren følger med.
   - Mønter og sedler kan både trækkes og trykkes i bakken, og et tryk i bakken tager dem tilbage.
   - Ting hopper over på tallerknerne.
   - Brøkdele farves ved at stryge hen over dem.

   Ingen trykmål var under 60 px, og ingen opgave skubbede siden sidelæns.
2. **Fejlflowet er ens og venligt i alle 15 regioner.** Overstreget svar, "Næsten. Se her.", en strategi med billede (hundredtavle, tallinje med hop, tiere og enere som klodser, urskive, mønter), og så ét stort "Tryk på …" med det rigtige ur, den rigtige bakke eller de rigtige tallerkner.
3. **Matematikken er korrekt og tegnet med omhu.** Danske mønter med hul og rigtige størrelser. Rene ure ved hel, halv og kvart. En lineal med forskudt start. Søjle- og billeddiagrammer. Brøkfigurer, 3D-figurer med "find dem alle", og spejlingsgitre, hvor "nej" er en forskydning – en god distraktor.
4. **Prøve, hytte og finale hænger sammen.** "Klar, når du er" uden skyld, en hytte med netop de missede familier, genforsøg efter en tur og "Verdensfest!" efter finalen.
5. **Verdenerne er klar teknisk.** Alle skills har moduler, og alle venner, kister og finaleting er tegnet. Kortets scener (urtårn, vandfald, vandmølle, panda og enhjørning ved stierne) giver hver verden sit eget sted. GODT_EKSTRA


## De ændringer, der løfter mest før frigivelse

AENDRINGER
