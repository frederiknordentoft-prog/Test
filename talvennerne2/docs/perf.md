# Ydelse ved frigivelsen af Hestebakkerne og Regnbueskoven (QA2 P3-16)

QA2 målte på dev-serveren (React i dev-tilstand) på en maskine under last og bad om en måling af prod-buildet, når verdenerne frigives (`docs/reviews/app-w2-r1.md`, P3-16). Det er gjort her, den 4/10, på den version der ligger live.

- **Build:** live-kopien af `talvennerne2/` (overview 0f40379, byte-identisk med `dist/` fra b883aad), og igen efter rettelsen af importen (dcda944).
- **Krav (SPEC §15.2):** ved 4× CPU-throttle har opgaveskærmen p95 ≤ 20 ms, og albummet (Dyrehaven) ≥ 50 fps. Ingen skærm har over 1.500 SVG-elementer.
- **Afvikling:** Chromium (headless) med fingre (CDP-touch), `Emulation.setCPUThrottlingRate` = 4, telefon 393 × 852 og iPad 1180 × 820, `deviceScaleFactor` 2. Maskinen var ledig (ingen agenter og ingen stemmeindspilning).
- **Måling:**
  - billedtid er tiden mellem to `requestAnimationFrame`,
  - lange opgaver kommer fra `PerformanceObserver('longtask')`.

  Throttlingen gælder hovedtråden, ikke GPU'ens rasterisering.
- **Gang:** barnet onboardes med fingeren som en rigtig førstegangsbruger. Svarene er tilfældige tryk, så både fejringen og strategien efter en fejl kommer med; derfor er turene lange.

## Resultat

**Begge krav holder med god margin.**

| Måling | Format | Billeder | p95 | p99 | Maks. | Over 20 ms | Lange opgaver |
|---|---|---|---|---|---|---|---|
| Engdalen, første tur (59 svar) | telefon | 17.165 | 16,8 ms | 16,8 ms | 100 ms | 0,9 % | 58 (p50 65 ms, maks. 105 ms) |
| Hestebakkerne `w1-tal100-l1` (85 svar) | telefon | 24.928 | 16,8 ms | 16,8 ms | 100 ms | 0,9 % | 87 (p50 66 ms, maks. 105 ms) |
| Regnbueskoven `w2-tal1000-l1` (50 svar) | iPad | 14.219 | 16,8 ms | 16,8 ms | 117 ms | 0,8 % | 49 (p50 65 ms, maks. 97 ms) |
| Engdalen, første tur efter rettelsen (29 svar, hele turen + fejring) | telefon | 6.948 | 16,8 ms | 33,3 ms | 100 ms | 1,1 % | 36 (p50 66 ms, maks. 97 ms) |

| Dyrehaven med 60 dyr, scroll med fingeren | Format | Billeder/s | p95 | Maks. | Lange opgaver |
|---|---|---|---|---|---|
| 3 × ned og 3 × op | telefon | 59,9 | 16,8 ms | 33 ms | 0 |
| 3 × ned og 3 × op | iPad | 60,0 | 16,7 ms | 16,8 ms | 0 |
| Igen efter rettelsen | telefon | 59,8 | 16,8 ms | 33 ms | 0 |

- **Afslutningen af turen** (fejringerne) holdt 60 billeder/s uden lange opgaver.
- **SVG-elementer:** højst 261 på de målte skærme (Dyrehaven med 60 dyr: 3 animerede dyr, resten som billeder).
- **Konsolfejl:** ingen.

## Fund

1. **Én lang opgave pr. svar.** Hvert svar giver én lang opgave på ca. 65 ms ved 4× throttle (maks. 117 ms), altså ca. 16 ms uden throttle. Det er 3–5 tabte billeder lige når fejringen eller strategien starter. På en rigtig iPad er det nok 1–2 billeder. Det er inden for kravet, men det er det sted, hvor en ydelsesrunde giver mest.
   - **Næste skridt:** profilér, hvad der kører synkront ved et svar: `recordAnswer` (mestring og misforståelser), skrivekøen, gengivelsen af tur-skærmen og oplæsningen. Udskyd det, der ikke skal ses i første billede.
2. **"Erstat …s data" mistede importen.** Fundet under målingen af Dyrehaven og rettet i beb4e59 (live i dcda944).
   - Efter en erstat-import af det aktive barn viste appen det gamle barn. Næste skrivning lagde det gamle barn tilbage over importen: i prod blev 60 dyr til 1, efter at et emne var slået fra og til. Bekræftelsen forsvandt også, og siden hoppede til toppen.
   - Årsag: profilen var `null` under importen. Dashboardets auto-valg indlæste derfor det gamle barn, før importen var skrevet, og `selectProfile` kortsluttede bagefter.
   - Nu dropper `useProfile.replaceLoaded` barnets skrivekø, skriver intet for barnet undervejs og indlæser den gemte profil på stedet.
   - Dækket af to tests i `src/state/useSession.data.test.ts` (den første fejler før rettelsen) og af erstat-trinnet i dashboardets e2e. E2e'en fejlede med 3 tjek før rettelsen.
   - Efter deploy er det tjekket på live-kopien: bekræftelsen står, Dyrehaven viser 60 dyr uden genindlæsning, og databasen beholder dem efter en ændret indstilling.

## Ydelsesrunden: hakket ved svaret (4/10, PERF)

Fund 1 ovenfor, taget op: hvert svar gav en lang opgave på 50–117 ms ved 4×. Runden fjerner det, der ikke behøver at ske i svarets billede: dyret bliver stående, en ny opgave tegnes med én render, og stjernerne og stemmen kommer efter paint.

**Rettet i runde 2:** mange af runde 1's efter-målinger målte en dev-server, ikke de byggede filer (se "Rettelse" herunder). Målt igen side om side på de byggede filer har runde 1 fjernet næsten alle lange opgaver ved svarene. Bekræft → næste opgave gik fra lang opgave i 91 % af overgangene til 10 %, og hele turen fra 49 til 8 lange opgaver.

### Måling

`scripts/perf/round.mjs` deler nu hvert svar i faser ud fra turens beats (`data-beat` på `.tv-round`, læst med en MutationObserver):

| Fase | Overgang |
|---|---|
| rigtigt tryk | asking → correct |
| forkert tryk | asking → wrong |
| strategien vises | wrong → teaching (850 ms-timeren) |
| rigtigt → næste opgave | correct → næste opgave (1 s-timeren) |
| bekræft → næste opgave | teaching → næste opgave (trykket på svaret i strategien) |

- **Pr. fase:** hvor mange overgange der har en lang opgave, der overlapper [t − 100, t + 400] ms, medianen og den længste af dem, medianen af det værste billede i [t − 100, t + 600] ms og de største scripts i de lange animationsbilleder (`long-animation-frame`: invoker, kilde, varighed og tvunget layout).
- **Gyldighed:** billederne væk fra svarene skal have p95 ≤ 16,8 ms og ≤ 0,2 % over 20 ms, ellers var maskinen optaget. `ASSERT=1` giver exit 1, når et krav herunder eller gyldigheden ikke holder.
- **Gentagelig:** trykkene er seedede (`SEED`), og `RUNS` lægger flere ture fra hver sin nye enhed sammen.
- **Langtidsspilleren:** `PROFILE=heavy` fletter `scripts/perf/heavy.ts`' indhold ind i barnets egen eksport og bringer den tilbage med "Erstat …s data" (flyttet til `lib.mjs`, så `zoo.mjs` bruger det samme). Indholdet er alle frigivne nøgler i bølge 1–2 med historik (786), 60 påklædte dyr, hele garderoben i alle farver, 200 belønninger og misforståelser med fulde vinduer. Barnets eget dyr er påklædt. Dokumentet er 333 KB (`heavy.ts 500` giver 503 KB).
- **Maskinens hastighed:** et fast stykke arbejde måles i siden før og efter hver tur (`bench`). `DIST_B` spiller to builds skiftevis (A, B, A, B) og opgør dem hver for sig.
- **Trykket selv** (fra runde 2): Event Timing giver for hvert tryk handlerens tid med Reacts render og tiden til næste billede (`clickMedian`, `clickToPaintMedian` pr. fase). Det kan sammenlignes, også når der næsten ingen lange opgaver er.
- **Den rigtige build:** `serve()` stopper, hvis porten ikke serverer netop de filer, der skal måles.

**Krav** (prod-buildet ved 4×, telefon, Engdalen, 2 ture med ≥ 50 svar):
- hver fase har en lang opgave i ≤ 25 % af overgangene,
- medianen af det værste billede pr. fase er ≤ 33,4 ms,
- ingen lang opgave er over 70 ms,
- hele turen har p95 ≤ 16,8 ms og ≤ 0,5 % over 20 ms.

Den tunge profil og skov-iPad skal holde det samme uden IndexedDB-scripts ≥ 10 ms inden for 300 ms af et tryk. Ved `THROTTLE=1` må intet billede være over 33,4 ms inden for 2,5 s af et tryk.

### Rettelse: en glemt dev-server blev målt

Fra kl. 9.29 lyttede en Vite-dev-server på port 4360. Den var startet af min egen e2e-kørsel, som kun stoppede `npx`, ikke Vite selv. `serve()` startede sin egen server på samme port, fik ikke porten og sagde intet. Derfor målte alle kørsler på den port derefter dev-serveren: React i udviklingstilstand og kildekoden i worktreet, ikke de byggede filer.

- **Ugyldige (dev-serveren):** Engdalen kl. 9.35, begge `THROTTLE=1`-kørsler, hele efter-matrixen, kørslen med 503 KB og den første side om side-sammenligning. I den var A og B den samme kode, så "ingen forskel" var meningsløst.
- **"Maskinen skiftede hastighed" var forkert.** Det var dev-serveren, der var 1,5–2 gange langsommere.
- **Gyldige prod-kørsler fra runde 1:** den tunge profil, Engdalen kl. 9.13 og skov-iPad (tabellerne under "Før") og CPU-profilen under "Det, der står tilbage".
- **Nu:** `serve()` tjekker, at porten serverer netop den build, ellers stopper målingen.

Runde 1 er målt igen side om side på de byggede filer:

Det uændrede build (B) og runde 1 (A, det, der ligger i session-branchen) skiftevis kl. 12.08–12.27, Engdalen, telefon, 4×, én tur hver (54 og 41 svar). Begge kørsler er gyldige (0,1 % og 0,2 % over 20 ms væk fra svarene):

| Fase | Overgange med lang opgave, B / A | Median lang opgave, B → A | A/B | Maks., B / A | Værste billede, B / A | Største invoker, B → A (ms pr. overgang) |
|---|---|---|---|---|---|---|
| rigtigt tryk | 4/10 / 1/10 | 59 → 57 ms | 97 % | 69 / 57 ms | 50 / 49,9 ms | DIV#root.onclick 22,2 → DIV#root.onclick 13,1 |
| forkert tryk | 2/44 / 4/31 | 52 → 53 ms | 102 % | 67 / 73 ms | 33,4 / 33,3 ms | DIV#root.onclick 12,7 → DIV#root.onclick 8,2 |
| strategien vises | 0/44 / 0/31 | – → – ms | – | – / – ms | 16,8 / 16,8 ms | MessagePort.onmessage 0,5 → – |
| rigtigt → næste opgave | 2/9 / 0/9 | 58 → – ms | – | 78 / – ms | 50 / 33,4 ms | TimerHandler:setTimeout 44,8 → TimerHandler:setTimeout 2,3 |
| bekræft → næste opgave | 40/44 / 3/31 | 69 → 53 ms | 77 % | 106 / 58 ms | 66,6 / 33,4 ms | DIV#root.onclick 41,9 → DIV#root.onclick 9,4 |

Hele turen: lange opgaver B 49 (median 67 ms, maks. 106), A 8 (median 57 ms, maks. 73); svar B 54, A 41; målestok B 15.5/13.7, A 14.3/16.2; væk fra svar over 20 ms: B 0,1 %, A 0,2 %; konsolfejl B 0, A 0

Trykket selv, målt med Event Timing (handlerens tid inklusive Reacts render, og tiden til næste billede):

| Tryk | Målt, B / A | Handlerens tid (median), B → A | A/B | Tid til næste billede (median), B → A | A/B | Lange opgaver, B / A |
|---|---|---|---|---|---|---|
| rigtigt tryk | 10/10 / 10/10 | 19,8 → 20 ms | 101 % | 96 → 88 ms | 92 % | 4/10 / 1/10 |
| forkert tryk | 44/44 / 31/31 | 18,9 → 20,3 ms | 107 % | 80 → 80 ms | 100 % | 2/44 / 4/31 |
| bekræft-tryk → næste opgave | 44/44 / 31/31 | 42,5 → 16,7 ms | 39 % | 112 → 88 ms | 79 % | 40/44 / 3/31 |

Målestok B 15.5/13.7, A 14.3/16.2; svar B 54, A 41; lange opgaver i alt B 49 (maks. 106), A 8 (maks. 73); væk fra svar over 20 ms B 0,1 %, A 0,2 %

- **Bekræft → næste opgave var problemet, og det er næsten væk.** Lang opgave i 91 % af overgangene før og 10 % efter. Handlerens tid faldt fra 42,5 til 16,7 ms: dyret monteres ikke længere forfra, og opgaven tegnes med én render.
- **Hele turen:** 49 lange opgaver før (median 67 ms, maks. 106 ms), 8 efter (median 57 ms, maks. 73 ms).
- **Svar-trykket** var allerede kort i handleren (ca. 20 ms i begge). Dets lange opgaver (1 af 10 og 4 af 31) ligger lige over grænsen på 50 ms.

### Før (det uændrede build)

Engdalen, telefon, 2 ture (71 svar), kl. 9.13. Gyldigheden er 0,1 procentpoint over grænsen (0,3 % over 20 ms væk fra svarene). Tallene ligner målingen ved frigivelsen:

| Fase | Overgange med lang opgave | Median / maks. | Værste billede (median) | Største LoAF-invokere (ms pr. overgang) |
|---|---|---|---|---|
| rigtigt tryk | 10/20 (50 %) | 60 / 66 ms | 50 ms | DIV#root.onclick 21,1; DOMWindow.onpointerdown 4,6 |
| forkert tryk | 3/51 (6 %) | 52 / 77 ms | 33,3 ms | DIV#root.onclick 11,2; DOMWindow.onpointerdown 3,4; BODY.onmouseup 0,2 |
| strategien vises | 0/51 (0 %) | – | 33,3 ms | MessagePort.onmessage 0,8; TimerHandler:setTimeout 0,3 |
| rigtigt → næste opgave | 2/18 (11 %) | 58 / 59 ms | 49,9 ms | TimerHandler:setTimeout 36,2 |
| bekræft → næste opgave | 40/51 (78 %) | 63 / 100 ms | 66,6 ms | DIV#root.onclick 37,6; DOMWindow.onpointerdown 3,9 |

Hele turen: p95 16,8 ms og 1,1 % over 20 ms, 57 lange opgaver (maks. 100 ms).

De andre kørsler på det uændrede build. Hver fase viser andelen af overgange med en lang opgave og medianen af det værste billede:

| Kørsel | Svar | Rigtigt tryk | Forkert tryk | Strategien vises | Rigtigt → næste | Bekræft → næste | Længste lange opgave | Hele turen: p95 / over 20 ms | Målestok |
|---|---|---|---|---|---|---|---|---|---|
| Tung profil, 333 KB | 74 | 100 % · 66,7 ms | 72 % · 50,1 ms | 0 % · 33,3 ms | 14 % · 49,9 ms | 100 % · 83,4 ms | 116 ms | 16,8 ms / 1,4 % | – |
| Regnbueskoven, iPad | 57 | 83 % · 50 ms | 6 % · 33,4 ms | 0 % · 16,8 ms | 33 % · 33,4 ms | 98 % · 66,7 ms | 90 ms | 16,8 ms / 0,9 % | – |

- **Den tunge profil** (kl. 9.01) er gyldig. Det påklædte dyr gjorde blikket dyrt: blik-lytteren kostede 12–15 ms pr. tryk.
- **Skov-iPad** er også gyldig.

### Hvad der er ændret

1. **Dyret bliver stående (P1).** Nøglen pr. opgave sad på hele scenen, så dyret (riggens SVG) blev monteret forfra ved hver opgave, og et påklædt dyr blev tegnet uden tøj, til genstandene var hentet.
   - Nu sidder nøglen på kortet og svarfeltet, der glider ind (`tv-stage-in`), mens dyret bliver stående. Ingen slide-in i rolig tilstand og ved reduced motion.
   - `Buddy` er i `memo` og klæder sig på fra en modul-cache over hentede genstande. Kortet og intro-skærmen har allerede hentet dem, så der aldrig er et billede uden tøj.
   - Blik-lytterne er kun aktive i think og idle. Før kostede de 12–15 ms pr. tryk med det påklædte dyr i den tunge profil.
   - `Rig()` genbruger sin rene render (`rigElement`) og sit pupil-input, så længe props er uændrede. `lookAt` tæller ikke i animeret tilstand, for pupillerne flyttes imperativt. Markup'en er den samme, og alle kunst-hashes er uændrede.
2. **Ingen måling i commit (P2).** `useSizeVars` læste kortets størrelse med `getBoundingClientRect` og `getComputedStyle` i commit og tvang et layout. Nu sætter ResizeObserverens første callback `--cw`/`--ch` efter layout og før paint.
3. **Én render pr. opgave (P3).**
   - Tilstanden for en ny opgave sættes i den render, der viser opgaven ("tilstand fra forrige render"), ikke i en effekt, der gav en ekstra render: beat, svar, kladde, hint, støtte, lyspære, puls, oplæst kort, demo, humør, æg, kompakt og taleboblen.
   - `supportFor` genbruger den strategi, der allerede er regnet ud, og `JSON.stringify`-sammenligningen er blevet en identitet.
   - `RoundScreen` er i `memo` og læser kun det, den tegner, fra `useRound` (`useShallow`). Den abonnerer ikke længere på profilen, kun på reserve-dyret, så PlayScreens re-render ved hvert svar stopper dér. PromptScene, ProgressStones, Teaching og opgavevisningerne er pakket i `memo`.
   - Oplæsningen (eller demoen) starter efter paint, og `recordIntro` skriver profilen efter paint. Ved et tryk på bekræft kører Reacts effekter synkront, så ville oplæsningens første tilstande ellers give en ekstra render i selve trykket. Det trin er ikke målt for sig, for målingerne var for støjfyldte til at skille det ud.
4. **Svar-trykket (P4).** Stjerne-burst, konfetti og starten af ros- og oops-stemmen kører efter paint (`afterPaint` i `src/app/idle.ts`: rAF og så `setTimeout 0`; `whenIdle` er flyttet dertil fra kortet). Stemmens start koster 5–7 ms ved 4× (`voice.ts` finder klippets grænser i lyddata hver gang). Lydeffekterne er stadig øjeblikkelige. Stjernen i burst'en parses én gang og klones.

**P5 og P6 var ikke nødvendige.**
- Den tunge profil viste ingen IndexedDB-scripts ≥ 10 ms inden for 300 ms af et tryk. Den eneste IndexedDB-post var én `IDBRequest.onsuccess` på 25 ms uden for vinduet.
- En CPU-profil af et ikke-minificeret build ved 4× viser `rigElement` på 2–5 ms pr. kald (grænsen er 8 ms).

### Efter

Efter-matrixen fra runde 1 målte dev-serveren og er fjernet. Det ændrede build er målt side om side ovenfor og i runde 2.

**Tilsigtet synlig ændring:** dyret bliver stående, mens opgaven glider ind. Før gled hele scenen ind, dyret med.

### Det, der står tilbage

En CPU-profil af det ændrede build (ikke-minificeret, 4×) viser, hvad et svar stadig koster i JavaScript. Det er 25–40 ms pr. tryk eller opgaveskift, oven i stil, layout og maling:

| Hvad | Ved 4× | Hvor |
|---|---|---|
| `submit` → `recordAnswer` (mestring, misforståelser, log) | 2–11 ms pr. tryk (mest ved det første) | `useRound`, `useProfile` |
| Riggen tegnes om, når humøret skifter (idle → happy/oops → think → idle) | 2–5 ms pr. skift | `rigElement` |
| Det gamle kort og svarfelt fjernes (`removeChild`) | 5–11 ms pr. opgaveskift | React/DOM |
| Opgavens scene og svarkort monteres (`ThingArt`, `Scatter`, `AnswerCard`) | 3–17 ms pr. opgave | `src/ui/scenes`, `src/ui/task` |
| Stemmens start: `say` → `planAll` → `boundsFor` læser lyddata (første klip pr. sprite) | 5–7 ms (nu efter paint) | `src/audio/voice.ts` |
| Lydeffekterne (`fm`, noder) | 2–3 ms pr. tryk | `src/audio/sfx.ts` |

Forslagene herfra er lavet i runde 2: bogføringen efter paint og klipgrænserne ved afkodningen.

## Runde 2: svaret bogføres efter paint (4/10, PERF)

CPU-profilen fra runde 1 viste, hvad trykket stadig bar. Runde 2 tager de tre dele, der ikke er opgavevisningernes eller kunstens.

### Ændringer

1. **Svaret bogføres efter paint** (`src/state/useRound.ts`).
   - `submit()` sætter stadig rundens egen tilstand med det samme (rigtigt/forkert, stime, kø, status), for skærmen viser den i trykkets billede.
   - Bogføringen (`hooks.answer`: mestring, misforståelser, logrækken og dagen) og genoptagelsespunktet (`hooks.snapshot`) venter til efter den næste paint (`afterPaint`). Begge kostede 8–11 ms ved 4× i klik-tasken, og deres to profil-skrivninger re-renderede PlayScreen.
   - `next()`, `confirm()`, guldægget, `pause()`, `quit()`, slutningen og en ny tur (`start`/`resume`) bogfører det ventende først (`bookAnswers`). Det gør datalaget også før skrivningen ved `visibilitychange → hidden`, `pagehide` og `flush()` (`useProfile.onBeforeFlush`).
   - Garantien er præcis én bogføring pr. svar, i rækkefølge. Svaret og dets snapshot lander stadig i én rw-transaktion (SPEC §9.2).
   - Intet i brugerfladen bruger bogføringens resultat i trykket: strategien klassificerer svaret selv (`classifyAnswer`), og guldægget læser profilen i `next()`, efter at der er bogført.
   - **SPEC-note A18 (integratoren):** en genindlæsning i det ene billede mellem tryk og paint kan miste dét svar, og så stilles samme opgave igen. `pagehide` bogfører først, så det kun gælder, hvis siden dør uden `pagehide`.
2. **Stemmens klipgrænser** (`src/audio/voice.ts`). Grænserne var allerede gemt pr. sprite og klip. Det dyre var læsningen af lyddata (`getChannelData`, 5–7 ms ved 4×), som faldt på det første klip, en sætning spillede fra en sprite: lige efter et tryk. Nu findes alle klippenes grænser i én læsning, når spriten er afkodet. De ligger på spriten og forsvinder med den, når LRU'en smider den ud.
3. **PlayScreen** abonnerede på hele profilen. Nu læser den kun dyret, den gemte turs sten og prøven (`useShallow`), så en profil-skrivning ikke re-renderer den.

### Tests

- **`round.test.ts`, nye tests:**
  - bogføringen sker efter paint og ikke i `submit`,
  - `next()`/`confirm()` før paint bogfører først, i rækkefølge og én gang,
  - `pause`, `quit` og en ny tur bogfører først.
- **`round.test.ts`, tilpasset fordi de antog synkron bogføring:**
  - "resumes after a reload on the task after the last answer" bogfører, som `pagehide` gør,
  - "does not let a missed golden egg cost the child anything", "logs a caught egg as golden" og "credits replays and marks answers after help as assisted" venter på paint,
  - `beforeEach` kalder `quit()` før nulstillingen, så en ventende bogføring fra forrige test ikke lander i den næste.
- **`useProfile.data.test.ts`, nye tests:**
  - intet bogføres i trykket, og svaret og snapshot kommer i én transaktion efter paint,
  - hide og `pagehide` bogfører med det samme, før køen skrives.
  
  `:89-107` og `:169` er uændrede: `next()` og `flush()` bogfører først.
- **`voice.lru.test.ts`, ny test:** en sprites lyddata læses én gang, når den er afkodet, og igen kun efter at LRU'en har smidt den ud.

### A/B (`DIST_B`)

B er session-branchens build (`dist` fra hovedtræet kl. 11.05, 5dbb13b/a142b25, altså runde 1), og A er runde 2. De spilles skiftevis, Engdalen, telefon, 4×, samme seeds.

**Første kørsel** kl. 11.48–11.59, 2 ture hver (A 72, B 62 svar). B er gyldig. A's første tur er ugyldig: 0,3 % over 20 ms væk fra svarene, og målestokken var 17,3 ms mod ca. 13–14 ms i resten.

| Fase | Overgange med lang opgave, B / A | Median lang opgave, B → A | A/B | Maks., B / A | Værste billede, B / A | Største invoker, B → A (ms pr. overgang) |
|---|---|---|---|---|---|---|
| rigtigt tryk | 1/20 / 6/20 | 54 → 58 ms | 107 % | 54 / 66 ms | 33,3 / 33,3 ms | DIV#root.onclick 14,7 → DIV#root.onclick 13,2 |
| forkert tryk | 1/42 / 5/52 | 54 → 56 ms | 104 % | 54 / 61 ms | 33,3 / 33,4 ms | DIV#root.onclick 5,5 → DIV#root.onclick 10,1 |
| strategien vises | 0/40 / 0/52 | – → – ms | – | – / – ms | 33,2 / 33,2 ms | MessagePort.onmessage 2,4 → MessagePort.onmessage 2,3 |
| rigtigt → næste opgave | 1/18 / 0/18 | 50 → – ms | – | 50 / – ms | 33,3 / 33,3 ms | TimerHandler:setTimeout 14,6 → TimerHandler:setTimeout 3,3 |
| bekræft → næste opgave | 0/40 / 13/52 | – → 57 ms | – | – / 85 ms | 33,4 / 33,4 ms | DIV#root.onclick 11,3 → DIV#root.onclick 13 |

Hele turen: lange opgaver B 3 (median 54 ms, maks. 54), A 25 (median 57 ms, maks. 85); svar B 62, A 72; målestok B 14/13.3, 13.4/13.1, A 17.3/14, 13/20.4; væk fra svar over 20 ms: B 0,1 %, A 0,2 %; konsolfejl B 0, A 0

- **Runde 1 holder allerede de absolutte krav i B's ture:** højst 6 % af overgangene med en lang opgave, værste billede 33,3 ms i median, længste lange opgave 54 ms og 3 lange opgaver på 62 svar.
- **A har flere lange opgaver** (25, mest ved bekræft-trykket). Det er trykket selv (`DIV#root.onclick`), lige over grænsen (52–66 ms). Det skete mest i A's første tur, hvor maskinen var langsommere.
- **Medianen af de lange opgaver** kan ikke sammenlignes, når B næsten ingen har. Derfor er trykket målt igen med Event Timing herunder.

**Anden kørsel med Event Timing** kl. 12.30–12.42, 2 ture hver (A 86, B 77 svar). Alle fire ture er gyldige (højst 0,2 % over 20 ms væk fra svarene):

| Tryk | Målt, B / A | Handlerens tid (median), B → A | A/B | Tid til næste billede (median), B → A | A/B | Lange opgaver, B / A |
|---|---|---|---|---|---|---|
| rigtigt tryk | 17/17 / 16/16 | 21,2 → 18,4 ms | 87 % | 88 → 88 ms | 100 % | 0/17 / 2/16 |
| forkert tryk | 60/60 / 69/70 | 19,4 → 15 ms | 77 % | 80 → 80 ms | 100 % | 6/60 / 2/70 |
| bekræft-tryk → næste opgave | 59/59 / 69/69 | 17,4 → 17,6 ms | 101 % | 88 → 88 ms | 100 % | 4/59 / 5/69 |

Målestok B 14.2/13.7, 16.3/12.9, A 14.9/18.4, 14.2/13.5; svar B 77, A 86; lange opgaver i alt B 11 (maks. 79), A 10 (maks. 61); væk fra svar over 20 ms B 0,1 %, A 0,2 %

| Fase | Overgange med lang opgave, B / A | Median lang opgave, B → A | A/B | Maks., B / A | Værste billede, B / A | Største invoker, B → A (ms pr. overgang) |
|---|---|---|---|---|---|---|
| rigtigt tryk | 0/17 / 2/16 | – → 53 ms | – | – / 56 ms | 33,4 / 33,4 ms | DIV#root.onclick 11,9 → DIV#root.onclick 14,4 |
| forkert tryk | 6/60 / 2/70 | 54 → 51 ms | 94 % | 79 / 54 ms | 33,3 / 33,3 ms | DIV#root.onclick 7,6 → DIV#root.onclick 3,7 |
| strategien vises | 0/59 / 0/69 | – → – ms | – | – / – ms | 33,3 / 33,3 ms | MessagePort.onmessage 1,5 → MessagePort.onmessage 1,2 |
| rigtigt → næste opgave | 0/15 / 0/15 | – → – ms | – | – / – ms | 33,4 / 33,4 ms | TimerHandler:setTimeout 3,5 → TimerHandler:setTimeout 11,7 |
| bekræft → næste opgave | 4/59 / 5/69 | 53 → 60 ms | 113 % | 56 / 61 ms | 33,4 / 33,4 ms | DIV#root.onclick 13,5 → DIV#root.onclick 12,1 |

Hele turen: lange opgaver B 11 (median 54 ms, maks. 79), A 10 (median 56 ms, maks. 61); svar B 77, A 86; målestok B 14.2/13.7, 16.3/12.9, A 14.9/18.4, 14.2/13.5; væk fra svar over 20 ms: B 0,1 %, A 0,2 %; konsolfejl B 0, A 0

- **Svar-trykket er blevet kortere:** handlerens tid faldt 13 % ved rigtigt og 23 % ved forkert (21,2 → 18,4 ms og 19,4 → 15,0 ms). Det svarer til bogføringen og profil-skrivningerne, der nu ligger efter paint.
- **Bekræft-trykket er uændret** (17,4 → 17,6 ms). Runde 2 rører ikke den vej, for intet bogføres ved bekræft. Dens pris er den nye opgaves montering.
- **Tiden fra tryk til næste billede er den samme** (80–88 ms i begge). Den bestemmes af gengivelsen ved 4×, ikke af handleren.
- **Lange opgaver:** begge builds har nu få (11 og 10 på 77 og 86 svar, maks. 79 og 61 ms), og de ligger lige over 50 ms. Medianen af dem siger derfor ikke meget: forkert 54 → 51 ms (94 %) og bekræft 53 → 60 ms (113 %).
- **Accept-kravet om ≥ 30 % lavere median ved svar- og bekræft-tryk holder ikke.** Svar-trykkets handler faldt 13–23 %, og bekræft-trykket er uændret.

### THROTTLE=1

Runde 2, 70 svar: ingen lange opgaver, og det værste billede inden for 2,5 s af et tryk er 16,8 ms. Alle krav holder (`ASSERT=1` giver exit 0).


### Det, der står tilbage efter runde 2

- **Bekræft-trykket** (17–18 ms i handleren ved 4×) er nu mest den nye opgaves montering: scenen og svarkortene (`src/ui/scenes`, `src/ui/task`) og fjernelsen af det gamle kort og svarfelt. Det ligger uden for dette område.
- **Svar-trykket** (15–18 ms) er Reacts render af svarkortene, sætningen og dyret. Når humøret skifter, tegnes riggen om (2–5 ms).
  - Et forslag til næste runde: lad dyrets humør skifte et billede senere, så det grønne kort kommer alene i trykkets billede. Det kræver en ændring i `RoundScreen`, så det skal godkendes.
- **De absolutte krav** (≤ 25 % lange opgaver pr. fase osv.) så ud til at holde for runde 1 og 2 i de gyldige prod-kørsler ovenfor. Integratoren måler dem igen i et roligt vindue.

## Gentag målingen

```
npm run build
flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs                       # Engdalen, første tur, telefon
WORLD=bakke flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs           # Hestebakkernes første åbne sten
WORLD=skov VP=ipad flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs    # Regnbueskoven på iPad
flock /tmp/tv2-chromium.lock node scripts/perf/zoo.mjs                         # Dyrehaven med 60 dyr (VP=ipad for iPad)
```

- `DIST=<mappe>` måler en anden kopi, fx filerne hentet tilbage fra live-sitet (A7).
- `MINUTES` begrænser en tur (standard 5).
- `RUNS=2 SEED=1 ASSERT=1` er accept-målingen for svarøjeblikkene (ydelsesrunden ovenfor); `ASSERT=1` giver exit 1, når et krav eller gyldigheden ikke holder.
- `DIST_B=<mappe>` spiller en anden build skiftevis med `DIST` og opgør dem hver for sig. Brug det til en før/efter-sammenligning, fordi maskinens hastighed skifter.
- `PROFILE=heavy` spiller som en langtidsspiller. Lav indholdet først med `node scripts/voice/run-vite.mjs scripts/perf/heavy.ts` (333 KB) eller `… heavy.ts 500` (503 KB, så `HEAVY=artifacts/perf/heavy-500.json`).
- `THROTTLE=1` måler uden throttle.
- Resultaterne og skærmbillederne havner i `artifacts/perf/` (git-ignoreret).
