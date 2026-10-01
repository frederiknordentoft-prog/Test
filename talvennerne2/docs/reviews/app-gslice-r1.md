# App-review, G-slice runde 1 (QA1): Engdalen spillet igennem

Uafhængigt produkt- og QA-review af den byggede app. Den er spillet som barn og som forælder.

- **Build:** `d43aad4` på `tv2/qa1`. `npm run build` var grønt (initial 137,5 KB, al JS 377,6 KB gzip).
- **Afvikling:** `dist/` blev serveret med `vite preview`. Chromium kørte via `scripts/browser.mjs` med touch, `isMobile`, `da-DK` og `?e2e=1&voice=fast`.
- **Oplæsning:** bedømt ud fra `window.__voiceLog`.
- **Skærmbilleder:** ligger i `artifacts/qa1/` (git-ignoreret). Alle stier herunder er relative til `talvennerne2/`.

## Samlet vurdering

1. Kernen er robust. Turen, fejlflowet med strategi og "Tryk på 3", ✕-pausen, genindlæsning midt i en tur og adskilte profiler virker. Der var 0 konsolfejl og kun netværk til samme origin i alle tre formater.
2. Dyrene (kanin, kat, hest/føl), Pip, kortet og designsystemet ligner et betalt produkt. Forældre-dashboardet er klart, ærligt og nyttigt.
3. Skiven kan dog ikke udgives endnu, af tre grunde:
   - En familie kan ikke oprette barn nr. 2.
   - Startdyret "Hvalp" er en pladsholder overalt, og i turen vises det som en kanin.
   - 71 af 74 tøjting er ikke tegnet, så butikken sælger ikoner, man ikke kan se på dyret.
4. Slutningen af turen skal strammes:
   - Niveau-op ryger ned i små kort.
   - Samme ting vises to gange.
   - "Det lærte du" er væk efter 2 s og lover mestring, barnet ikke har.
5. Oplæsningen dækker opgaverne godt. Men stilladset afslører svaret på nye nøgler, og flere belønningskort læses ikke op for børn, der ikke kan læse.

| Punkt | Karakter (1–5) |
|---|---|
| Funktionsfejl (5 = ingen) | **2** |
| Børnebrugbarhed | **3** |
| AAA-indtryk | **2** |
| Fremdrift og motivation | **3** |
| Forældrenes dashboard | **4** |

## Sådan er der spillet

**Telefon 393×852 (Ida, kanin):**
- Første start: forældreintro, lydtjek med ét forkert tryk, navn, klækning og navngivning.
- Seks ture i Tællelunden:
  - l1
  - l2 med ✕ → "Til kortet" → "Fortsæt turen" og genindlæsning midt i turen
  - venneturen
  - "Skriv selv"
  - blandet tur uden fejl
  - mesterprøven, dumpet med 7/10
- Guldægget blev både fanget, misset og sprunget over.
- Dyrehaven (skiftet ven, omdøbning), garderoben (på og af) og butikken: købte Piratskæg og ønskede Pirattrøje.
- Alle fire bøger.
- Voksen-porten med et forkert svar, alle syv faner, eksport, en indstilling og udskrift.
- Barn nr. 2 (Bo, hvalp, 2. klasse) med en hel tur, og skift tilbage til Ida.

**iPad 820×1180 (kat) og telefon på tværs 852×393 (føl):**
- Første start og første tur med ceremonier.
- Kortet, alle dock-skærme og dashboardet.

**Verificeret OK:**
- Samme opgave og samme kø efter ✕ og efter genindlæsning.
- "Næste" og "Til kortet" er lige store.
- Ingen trykmål under 60 px på børneskærmene.
- Eksportfilen `talvennerne2-ida-2026-10-01.json` har format v1 og 68 svar.
- "Rolig animation" bliver gemt.
- Ida og Bo har hver deres perler, dyr og kort, og intet går på tværs.

---

## P1 – blokerer en første udgivelse

### P1-1 Man kan ikke oprette barn nr. 2 og ikke skifte barn, når der er én profil

- **Skærm og format:** kort, voksen-port og dashboard. Alle formater.
- **Trin:**
  1. Opret ét barn.
  2. Luk eller genindlæs appen.
  3. Prøv at finde "Ny spiller" eller "Skift spiller".
- **Set:**
  - Opstarten vælger altid det eneste barn og går til kortet. Profilvælgeren med "+ Ny spiller" vises kun ved mindst 2 profiler.
  - Knappen "For voksne" på kortet åbner dashboardet. Der findes hverken "Ny spiller" eller "Skift spiller", og "tilbage" sætter altid det oprindelige barn tilbage.
  - Den eneste vej er "Hent fra en fil → Tilføj som ny spiller". Den kopierer et eksisterende barn, og vælgeren viser derefter to identiske "Ida"-kort.
  - Søskende på samme iPad kan heller ikke skifte uden at lukke appen.
- **Burde:** "Ny spiller" og "Skift spiller" bag voksen-porten, også når der kun er ét barn. Det kan fx være en knap i dashboardet, eller at "For voksne" fører til profilvælgeren.
- **Skærmbilleder:** `artifacts/qa1/phone-116-dash-Indstillinger.png`, `artifacts/qa1/phone-152-picker.png`
- **Fil:**
  - `src/state/useSession.ts` (boot: `if (profiles.length === 1) await get().selectProfile(...)`)
  - `src/app/boot.ts` (`initialRoute`)
  - `src/ui/screens/child/map/adult.ts`
  - `src/ui/screens/parent/DashboardScreen.tsx` (`back`)
  - `src/ui/screens/parent/dashboard/SettingsTab.tsx`

### P1-2 Startdyret "Hvalp" (og Engdalens pindsvin) er pladsholdere, og i turen vises en kanin

- **Skærm og format:** onboarding, klækning, Dyrehaven, Samlebogen, profilvælger og tur. Alle formater.
- **Trin:**
  1. Opret en ny spiller.
  2. Vælg ægget "Hvalp" og klæk det.
  3. Spil en tur, og åbn Dyrehaven.
- **Set:** pladsholderen ser forskellig ud på hver skærm:
  - Ved klækningen: en tom ægform med ansigt.
  - Ved navngivning efter æg: et sort pote-ikon, der står skævt i cirklen.
  - I Dyrehaven: grå, stiplede klatter.
  - I profilvælgeren: ægformen.
  - I Samlebogen: grå figurer.
  - I selve turen står en hvid kanin som barnets ven, selv om vennen er en hvalp.
  - Hvalpen er én af kun fire startdyr. Hvalp og pindsvin er også ven-noder i Engdalen (Minusbækken og Tiervennernes hule), og æggene bliver til flere af dem.
- **Burde:** Hvalp og pindsvin er tegnet. Ellers skal de fjernes fra startvalget og ven-noderne, indtil de er. Barnet må aldrig se et andet dyr end sit eget.
- **Skærmbilleder:**
  - `artifacts/qa1/phone-07-onb-eggs.png`
  - `artifacts/qa1/phone-156-onb2-puppy-hatched.png`
  - `artifacts/qa1/phone-bo1c-hatch-named.png`
  - `artifacts/qa1/phone-159-bo-zoo.png`
  - `artifacts/qa1/phone-bo1-teaching-hear20-choice.png` (kanin i Bos tur)
  - `artifacts/qa1/phone-160-picker-3.png`
- **Fil:**
  - `src/art/species/` (`puppy.tsx` og `hedgehog.tsx` mangler)
  - `src/content/catalog.ts` (`STARTERS`)
  - `src/ui/screens/child/round/Buddy.tsx` (falder tilbage til kanin)
  - `src/ui/screens/child/animals/art.tsx` (stand-in)
  - `src/ui/screens/child/ceremony/NameAnimal.tsx` (pote-ikon)

### P1-3 71 af 74 tøjting er ikke tegnet: butikken sælger ikoner, og påklædning viser intet

- **Skærm og format:** butik, garderobe og niveau-op. Alle formater.
- **Trin, to veje:**
  - Nå niveau 3, og tag Halstørklædet på.
  - Eller: gå i Butik, vælg Piratskæg (80), tryk "Ja, køb den" og derefter "Prøv den på".
- **Set:**
  - Kun `hverdag-head`, `hverdag-body` og `fest-head` findes i `src/art/items`.
  - Alt andet vises som generiske slot-ikoner. Piratskæg er tegnet som et par briller, og Pirattrøje som en t-shirt-kontur.
  - Halstørklædet (belønning for niveau 3) og Piratskægget kan "tages på", men intet ændrer sig på dyret.
  - Barnet brugte 80 af sine 106 perler på noget, der ikke kan ses.
  - Opdager-sættet (Engdalens kister og finale) og 3 af 6 Hverdag-ting mangler også.
- **Burde:** Alt, der kan optjenes eller købes i skiven, er tegnet og synligt på dyret. Ting uden tegning skjules i butikken, indtil de er tegnet.
- **Skærmbilleder:**
  - `artifacts/qa1/phone-80-shop.png`
  - `artifacts/qa1/phone-81-shop-buy-sheet.png`
  - `artifacts/qa1/phone-83-shop-go-wardrobe.png`
  - `artifacts/qa1/phone-73-wardrobe-neck.png`
- **Fil:**
  - `src/art/items/**` (Hverdag, Opdager, Pirat og milepæl 5)
  - `src/ui/screens/child/shop/model.ts` og `ShopView.tsx` (filtrér på `AVAILABLE_ITEMS`)
  - `src/ui/screens/child/wardrobe/glyphs.tsx` og `ItemThumb.tsx`

---

## P2 – tydelige UX-svagheder

### P2-1 Niveau-op ryger ned i "Også i dag", og samme ting vises to gange

- **Skærm og format:** ceremonier, telefon (tur 1, 3 og 5).
- **Trin:** Spil, til et niveau-op falder sammen med et nyt dyr eller en medalje.
- **Set:**
  - Slutningen af turen har et tidsbudget på 6 s. Niveau-op (2,5 s, vægt 60) springes over, og den kortere ting (1,5 s, vægt 50) får skærmen i stedet.
  - Niveau 3 og 4 blev derfor kun et lille kort med teksten "Nyt niveau! 3".
  - Når niveau-op får skærmen, viser den huen med "Prøv den på". Den næste skærm viser samme hue igen som "En ny ting!".
- **Burde:** Niveau-op får altid fuld skærm, og tingen vises kun dér.
- **Skærmbilleder:**
  - `artifacts/qa1/phone-c1-01-levelUp.png`
  - `artifacts/qa1/phone-c1-02-thing.png`
  - `artifacts/qa1/phone-r3c-02-thing.png`
  - `artifacts/qa1/phone-r3c-03-end.png`
- **Fil:**
  - `src/meta/ceremonyQueue.ts` (budget-løkken: `if (used + ms > budget) continue`)
  - `src/ui/screens/child/ceremony/Steps.tsx` (`LevelUpScreen` og `ThingScreen`)

### P2-2 "Det lærte du" lover mestring, barnet ikke har

- **Skærm og format:** opsummering. Alle formater.
- **Trin:** Spil første tur (tallene 0–5), eller dump mesterprøven med to fejl i "Hør og skriv".
- **Set:**
  - Når én nøgle i en skill uden fakta-form rykker, vises hele skillen, fx "Jeg kan finde og skrive tallene til tyve. Det sidder fast nu!"
  - Det sker også lige før "Klar, når du er" efter en dumpet prøve.
  - Dashboardet siger samtidig "Øver · 0 % sikre".
  - SPEC §5.8 beder om nøgler, der har rykket sig, fx "8+5 sidder fast nu!".
- **Burde:** Vis de konkrete tal eller nøgler, der har rykket sig. "Sidder fast" bør kun bruges ved boks 5 eller en medalje.
- **Skærmbilleder:**
  - `artifacts/qa1/phone-r6-10-summary-early.png`
  - `artifacts/qa1/phone-r6c-00-summary.png`
  - `artifacts/qa1/phone-112-dash-Færdigheder.png`
- **Fil:**
  - `src/ui/screens/child/ceremony/describe.ts` (`learnedItems`)
  - `src/meta/progression.ts`

### P2-3 Opsummeringen er væk efter 2 s og klippes på telefon på tværs

- **Skærm og format:** opsummering. Alle formater, klipningen kun på 852×393.
- **Trin:** Afslut en tur, og se den første ceremoniskærm.
- **Set:**
  - "Det lærte du", stjernerne og perler/point er én skærm på 2,0 s. Med tale er den højst 3,2 s, og så afbryder den næste skærm oplæsningen.
  - På 852×393 slutter scenen ved y=301, men indholdet er højere:

    | Indhold | Lodret placering |
    |---|---|
    | Stjerner | 251–295 |
    | Perler/point | 305–357 (under knapperne) |
- **Burde:** Skærmen bliver stående, til barnet trykker, eller mindst 5 s. Den afbryder aldrig tale, og den passer i alle formater.
- **Skærmbilleder:** `artifacts/qa1/side-s10-summary-900.png`, `artifacts/qa1/phone-r3-10-summary-early.png`
- **Fil:**
  - `src/ui/screens/child/ceremony/flow.ts` (`autoAdvanceMs`)
  - `src/meta/ceremonyQueue.ts` (`CEREMONY_MS` for learned, stars og tally)
  - `src/ui/screens/child/CeremonyScreen.tsx` (`SPEECH_GRACE_MS`)
  - `src/ui/screens/child/ceremony/ceremony.css`

### P2-4 Kortene under "Også i dag" læses ikke op

- **Skærm og format:** slutskærmen. Alle formater.
- **Trin:** Afslut en tur, der giver kort.
- **Set:**
  - Kun overskriften (`s.reward.alsoToday`) siges.
  - Kortene læses kun op ved tryk, fx "Nyt niveau! 3", "Mål klaret! …", "Din ven har lært at hoppe!" og "Træningshytten er tændt".
  - Sammen med P2-1 betyder det, at et barn, der ikke kan læse, ikke hører, at det har nået et nyt niveau.
- **Burde:** Kortene læses op efter hinanden, og hvert kort lyser, mens det nævnes.
- **Skærmbilleder:** `artifacts/qa1/phone-c1-04-end.png`, `artifacts/qa1/phone-r3c-03-end.png`
- **Fil:**
  - `src/ui/screens/child/ceremony/End.tsx`
  - `src/ui/screens/child/CeremonyScreen.tsx` (`speechOf` for `end`)

### P2-5 Stilladset på nye nøgler viser svaret, og svaret tæller fuldt

- **Skærm og format:** opgaver. Alle formater.
- **Trin:** Spil første tur.
- **Set:**
  - Alle nøgler i boks 0 får stillads af sig selv. Ved "Find tallet 1" er det en tierramme med præcis én prik. Ved "Hvilket tal kommer efter 1?" er det en +1-pil fra 1 til 2.
  - Svarene logges ikke som `assisted`. De flytter boksen og giver 3 stjerner.
  - Lyspæren ses derfor aldrig i de første ture.
- **Burde:** Et stillads, der støtter uden at afsløre svaret, eller at svaret logges som assisteret (SPEC §3.5: lyspæren "åbner aldrig af sig selv").
- **Skærmbilleder:**
  - `artifacts/qa1/phone-21-task1.png`
  - `artifacts/qa1/phone-r2-task-order20-choice.png`
  - `artifacts/qa1/phone-r2-task-order20-keypad.png`
- **Fil:**
  - `src/engine/tasks.ts:202` (`scaffold` ved boks 0)
  - `src/state/useProfile.ts` (mestring ignorerer `task.scaffold`)
  - `src/ui/hint/hintFor.ts`

### P2-6 sortOrder: rækken brækker, og et forkert svar stuves ind i første felt

- **Skærm og format:** opgave, telefon 393×852.
- **Trin:** Få en "tæl tilbage"-opgave eller "største først".
- **Set:**
  - "8 ? ? ? ?" brækker til to linjer på 393 px: tre felter på første linje og ét på den næste.
  - Efter et forkert svar står hele "4521" overstreget i første felt, mens de andre felter stadig viser "?".
  - Felterne vises desuden to gange: i opgaven og i svarbakken.
- **Burde:** Én linje, og et forkert svar vises tal for tal i hvert sit felt.
- **Skærmbilleder:** `artifacts/qa1/phone-r4-task-order20-sortOrder.png`, `artifacts/qa1/phone-r6-teaching-order20-sortOrder.png`
- **Fil:**
  - `src/ui/scenes/RowScene.tsx`
  - `src/ui/task/sortOrder/View.tsx`
  - `src/ui/screens/child/RoundScreen.tsx` (`blankFace`)

### P2-7 "Hvilket tal er størst?" viser to tomme tallinjer

- **Skærm og format:** opgave. Alle formater.
- **Trin:** Få opgaven `order20/bigger` (choice med scene `line`).
- **Set:** Opgaven og stilladset tegner to ens tallinjer fra 0 til 10, uden markering af tallene 0, 1 og 2. Strategien tegner så en tredje linje, også uden markering.
- **Burde:** Én linje, hvor kandidaterne er markeret.
- **Skærmbillede:** `artifacts/qa1/phone-r2c-teaching-order20-choice.png`
- **Fil:** `src/ui/scenes/PromptScene.tsx`, `src/ui/hint/HintVisual.tsx`

### P2-8 Den første demo viser "1 + 2 = ?" for et barn i 0. klasse i Tællelunden

- **Skærm og format:** første opgave. Alle formater.
- **Trin:** Første tur.
- **Set:** Choice-demoen er hårdkodet til et plusstykke. Det er det første, et barn i 0. klasse ser, i et område, der handler om at tælle.
- **Burde:** Et eksempel, der passer til opgaven, fx "Find tallet 3" med tre kort.
- **Skærmbilleder:** `artifacts/qa1/phone-16-first-round-start.png`, `artifacts/qa1/ipad-16-first-round-start.png`
- **Fil:** `src/ui/task/choice/Demo.tsx`

### P2-9 Ægget viser en anden ven end den, der klækkes

- **Skærm og format:** onboarding, iPad.
- **Trin:** Vælg "Killing" (orange på ægget), og klæk.
- **Set:** Der kom en grå tigerkat ud. Racen og farven trækkes fra profil-id'et, men ægget viser standardfarven.
- **Burde:** Ægget viser det dyr, der kommer ud, eller farven trækkes, før ægget vises.
- **Skærmbilleder:** `artifacts/qa1/ipad-07-onb-eggs.png`, `artifacts/qa1/ipad-10-onb-hatched.png`
- **Fil:**
  - `src/ui/screens/child/onboarding/steps.tsx` (`PeekEgg`)
  - `src/ui/screens/child/onboarding/flow.ts`
  - `src/state/useMeta.ts` (`chooseStarter`)

### P2-10 Klassetrinnet bruges ikke, og forældre kan ikke åbne verdener

- **Skærm og format:** onboarding og dashboard. Alle formater.
- **Trin:** Opret et barn i 2. klasse.
- **Set:**
  - Bo valgte 2. klasse og fik "Find tallet 1".
  - Indstillingerne har ikke "åbn verdener/regioner", som SPEC §9.1.12 kræver.
  - Introen lover "Matematik fra 0. til 3. klasse".
- **Burde:** En af disse:
  - forælderen kan åbne verdener,
  - klassetrin 1–3 er skjult,
  - appen siger tydeligt, at alle starter i Engdalen.
- **Skærmbilleder:** `artifacts/qa1/phone-bo1-teaching-hear20-choice.png`, `artifacts/qa1/phone-116-dash-Indstillinger.png`
- **Fil:**
  - `src/ui/screens/child/onboarding/flow.ts` (`finishOnboarding`)
  - `src/ui/screens/parent/dashboard/SettingsTab.tsx`

### P2-11 De første ture er ensformige

- **Skærm og format:** ture og Dyrehaven, telefon.
- **Trin:** Spil tur 1–4.
- **Set:**
  - Opgaver med svaret 1 kommer 4–5 gange pr. tur: "Læg 1 terning i kurven", "Læg 1 æble i kurven", "Hvor mange fingre?" og "Hvor mange terninger?".
  - Med en kanin som startdyr gav fire ture fire kaniner, fordi æggene kun kan blive den oplåste art.
- **Burde:** Mere variation i de nye nøgler. Gerne et andet dyr tidligt.
- **Skærmbilleder:** `artifacts/qa1/phone-r1-task-count10-countTap.png`, `artifacts/qa1/phone-61-zoo.png`
- **Fil:**
  - `src/engine/roundBuilder.ts` (nye nøgler i rank-rækkefølge på tværs af kinds)
  - `src/meta/progression.ts` (æggets art)

---

## P3 – polering

| # | Skærm / format | Fund | Skærmbillede | Fil |
|---|---|---|---|---|
| 1 | alle | Lydeffekterne laves i en AudioContext på 24 kHz, men FM-modulatoren går over 12 kHz (15.522 og 12.320 Hz). Tonen bliver klampet, og der kommer en konsoladvarsel ved hver fejring. | – | `src/audio/sfx.ts`, `src/audio/engine.ts` |
| 2 | ceremoni, telefon | Venneturen gav en vædderkanin, en ny race, men skærmen siger "En ny farve!". Dyret overlapper overskriften. | `phone-r3c-00-summary.png` | `src/meta/ceremonyQueue.ts` (`speechFor`), `src/ui/screens/child/ceremony/ceremony.css` |
| 3 | ceremoni | Tre regioner åbnede samtidig, men skærmen siger "Et nyt sted …" i ental, og navnene vises først sent. | `phone-r4c-00-summary.png` | `src/ui/screens/child/ceremony/Steps.tsx` (`TrialScreen`) |
| 4 | dashboard + udskrift | "1 aktive dag" skal være "1 aktiv dag". Anbefalingen "Klar til: mesterprøven" står der stadig efter en dumpet prøve. | `phone-110-dash-Overblik.png` | `src/ui/screens/parent/dashboard/OverviewTab.tsx`, `PrintReport.tsx`, `src/parent/recommend.ts` |
| 5 | dashboard | "Tilføj som ny spiller" laver et identisk barn med samme navn og forbogstav. | `phone-152-picker.png` | `src/ui/screens/parent/dashboard/SettingsTab.tsx` |
| 6 | mål | Målet "Tag en tur forbi Tællelunden" peger på det sted, barnet allerede er, og klares af første tur. Kortet mangler punktum. | `phone-c1-04-end.png` | `src/content/goals.ts`, `src/ui/screens/child/map/words.ts` |
| 7 | medalje, bøger | Bronzemedaljen er en flad brun klat med "antenner". Stemplerne er nummererede ringe. | `phone-r5c-01-medal.png`, `phone-91-book-stamps.png` | `src/ui/screens/child/ceremony/Steps.tsx`, `src/ui/screens/child/books/StampBook.tsx` |
| 8 | kort | Tågen over låste regioner er store, flade hvide ellipser. Kortet er 11 skærme langt på telefon, og "Næste tre mål" ligger helt nederst. | `phone-40-map-scroll-4.png`, `phone-40-map-scroll-10.png` | `src/ui/screens/child/map/RegionSection.tsx`, `src/ui/screens/child/map/map.css` |
| 9 | iPad, telefon | Store tomme flader: Dyrehavens nederste halvdel på iPad, kortet i tallinje-opgaven og toppen af kortet i countTap. | `ipad-201-zoo.png`, `phone-r2c-task-order20-numberline.png` | `src/ui/screens/child/animals/zoo.css`, `src/ui/task/task.css` |
| 10 | Trofæer | Det optjente trofæ står ikke øverst. Listen har 34 punkter (3.957 px). | `phone-91-book-trophies.png` | `src/ui/screens/child/books/TrophyBook.tsx` |
| 11 | kort-HUD | Hjertemåleren "falder" fra halv til næsten tom efter et venskabsniveau, hvilket kan ligne et tab. | `phone-r5-tryon-dock-map.png` | `src/ui/screens/child/map/Hud.tsx` |
| 12 | garderobe | ✕ ved dyret betyder "tag af", men ligner "luk". | `phone-c1-tryon-wardrobe.png` | `src/ui/screens/child/wardrobe/WardrobeView.tsx` |
| 13 | forældreintro, telefon | Det tredje kort ("Alt optjenes ved at regne") ligger under folden bag en klæbende "Kom i gang". | `phone-01-intro.png` | `src/ui/screens/parent/ParentIntroScreen.tsx` |
| 14 | lydtjek | Med 2 kort og 2 forsøg består en enhed uden lyd i 75 % af tilfældene. Det følger spec, men er svagt. | `phone-02-soundcheck.png` | `src/ui/screens/child/onboarding/soundCheck.ts` |
| 15 | opgaver | Boblen siger "Læg dem i kurven." til "Læg 1 æble i kurven", og "dem" lægger op til at lægge alle i. Demoerne til countTap og sortOrder varer ca. 5,3 s (spec: 3–5 s). | `phone-r1-task-count10-countTap.png` | `src/speech/clips/ui/kinds.ts`, `src/ui/task/countTap/Demo.tsx` |
| 16 | kort, iPad | "Tællelunden" på feltet "Næste sted" rører feltets kant. | `ipad-200-map.png` | `src/ui/screens/child/map/SidePanel.tsx` |
| 17 | tur | Pausekortet læses ikke op. Guldæggets "spring over" er en pil uden tekst, der ligner "næste". | `phone-44-pause.png`, `phone-r4-golden.png` | `src/ui/screens/child/round/Overlays.tsx`, `src/ui/screens/child/RoundScreen.tsx` |
| 18 | ceremoni | Forlader barnet "Prøv den på" via dock'en ("Kort"), ses resten af slutskærmene aldrig. Ved tur 5 gjaldt det niveau 4 og trofæet "En perfekt tur". Intet går tabt i data. | `phone-r5-tryon-dock-map.png` | `src/ui/screens/child/CeremonyScreen.tsx`, `src/ui/screens/child/WardrobeScreen.tsx` |

## Rækværk (SPEC §13), som de så ud i spillet

| Punkt | Status |
|---|---|
| Streak, nedtælling, notifikationer | Ingen fundet. "Dage spillet i alt" tæller op. Dagstrofæerne tæller dage i alt, ikke dage i træk. |
| Tidsbegrænsede tilbud, sjældenhed | Ingen. Faste priser på 80, 120 og 180. Ægget vælger blandt uejede, og alle er lige meget værd. |
| Rigtige penge, reklamer, eksterne kald | Ingen. Alt netværk gik til samme origin i alle kørsler. "Lyt til stemmens klip" peger på `lyt.html` på samme origin. |
| Skyld | Ingen skyldtekster. En dumpet prøve hedder "Klar, når du er. Bedst: 7 planker". |
| Auto-start, fokus | Ingen auto-start af næste tur. "Næste" og "Til kortet" er lige store. Ceremoniskærme går selv videre efter 1,5–3 s (se P2-3). |
| Valuta under turen | Ingen tal under turen. Perlesaldoen står på kortet og i butikken. |
| Sammenligning | Ingen. Dashboardet viser ét barn ad gangen. |
| Intet optjent tabes | OK i data. P3-11 kan ligne et tab. P1-3 er et brudt løfte: man køber noget, man ikke kan se. |
| ✕ gemmer | OK, også efter genindlæsning. |
| Gennemsigtighed for forældre | OK: læringstid pr. dag, belønningslog og "Alt i spillet optjenes ved at regne". |

## De 5 ændringer, der løfter indtrykket mest

1. **Ingen pladsholdere i skiven.** Tegn hvalp, pindsvin og de ting, der kan fås i Engdalen: Hverdag, Opdager, milepæl 5 og ét butikssæt. Indtil da skal ting og arter uden tegning fjernes fra startvalget, ven-noderne og butikken. Barnet må aldrig se et andet dyr end sit eget.
2. **"Ny spiller" og "Skift spiller" bag voksen-porten**, også med ét barn, så søskende kan dele en iPad.
3. **Byg slutningen af turen om:**
   - Opsummeringen bliver stående til tryk og passer i alle formater.
   - Niveau-op får altid fuld skærm, og tingen vises kun én gang.
   - "Også i dag" læses op.
4. **Gør "Det lærte du" konkret og sandt:** de tal og fakta, der har rykket sig. Ingen påstande om hele færdigheder, og intet "Det sidder fast nu!" lige efter en dumpet prøve.
5. **Pudsning af opgaveskærmene:**
   - sortOrder på én linje, og et forkert svar tal for tal.
   - Én tallinje med markerede kandidater.
   - Demoer, der passer til barnets område.
   - Et stillads, der hjælper uden at give svaret, og som logges som assisteret.
