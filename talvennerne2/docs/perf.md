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

**Resultatet er blandet.**
- Ved `THROTTLE=1` holder alle krav nu. Før var der billeder på 50 ms, når strategien kom frem.
- Blik-lytterens pris med det påklædte dyr er næsten væk.
- Ved 4× gav ændringerne ingen målbar forskel i de lange opgaver, målt side om side med det uændrede build. Kravene holder ikke.
- Maskinen skiftede hastighed under målingen, så kun sammenligningen side om side tæller.
- Resten af prisen ligger uden for dette område (se "Det, der står tilbage").

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

**Krav** (prod-buildet ved 4×, telefon, Engdalen, 2 ture med ≥ 50 svar):
- hver fase har en lang opgave i ≤ 25 % af overgangene,
- medianen af det værste billede pr. fase er ≤ 33,4 ms,
- ingen lang opgave er over 70 ms,
- hele turen har p95 ≤ 16,8 ms og ≤ 0,5 % over 20 ms.

Den tunge profil og skov-iPad skal holde det samme uden IndexedDB-scripts ≥ 10 ms inden for 300 ms af et tryk. Ved `THROTTLE=1` må intet billede være over 33,4 ms inden for 2,5 s af et tryk.

### Maskinen skiftede hastighed undervejs

Den samme build (det uændrede, 37f386f) gav to meget forskellige målinger med samme seed: kl. 9.13 var medianen af de lange opgaver 62 ms, kl. 9.35 93 ms. Begge kørsler var stort set "gyldige" (0,3 % og 0,2 % over 20 ms væk fra svarene), for en side, der intet laver, holder 60 billeder/s, også når maskinen er langsom. Fra ca. 9.30 var alle opgaver i et svar 1,5 gange så lange som før. Der kørte ingen anden Chromium samtidig (låsen), og `top` viste maskinen næsten ledig; det ligner, at værten var presset. Derfor:
- en før/efter-sammenligning er kun gyldig, når de to builds måles side om side (`DIST_B`, afsnittet herunder),
- kravene er absolutte tal og kan kun holde, når maskinen er hurtig. Efter-kørslerne i matrixen faldt alle i den langsomme periode (`bench` 13–15 ms), og ingen af dem holder kravene.

### Side om side (`DIST_B`)

Det uændrede build (før) og det ændrede (efter) skiftevis i samme Chromium kl. 10.27–10.41, Engdalen, telefon, 4×, 2 ture hver (72 og 91 svar), samme seeds. Målestokken var 13–15 ms for begge. Begge er ugyldige efter kriteriet (0,7 % og 1,2 % over 20 ms væk fra svarene):

| Fase | Lang opgave, før | Lang opgave, efter | Median / maks., før | Median / maks., efter | Værste billede, før | Værste billede, efter |
|---|---|---|---|---|---|---|
| rigtigt tryk | 20/20 | 19/19 | 112 / 155 ms | 115 / 165 ms | 116,6 ms | 116,6 ms |
| forkert tryk | 52/52 | 72/72 | 99 / 215 ms | 100 / 167 ms | 100 ms | 100 ms |
| strategien vises | 52/52 | 70/71 | 73 / 117 ms | 69 / 151 ms | 83,3 ms | 66,7 ms |
| rigtigt → næste opgave | 18/18 | 18/18 | 81 / 139 ms | 74 / 103 ms | 83,4 ms | 83,4 ms |
| bekræft → næste opgave | 52/52 | 71/71 | 105 / 168 ms | 111 / 166 ms | 116,6 ms | 116,7 ms |

- **Forskellen er inden for støjen.** De lange opgaver er lige lange før og efter (median 89 og 81 ms over hele turen). Trykket bruger stadig 80–90 ms i `DIV#root.onclick` i begge builds i den langsomme periode.
- **Det, ændringerne fjernede, kan ses enkeltvis:** blikket med påklædt dyr kostede 12–15 ms pr. tryk før og 0,4–4 ms efter, og billederne på 50 ms ved `THROTTLE=1` er væk. Men det, der er tilbage, fylder mest.

### Før (det uændrede build)

Engdalen, telefon, 2 ture (71 svar), kl. 9.13 i den hurtige periode. Gyldigheden er 0,1 procentpoint over grænsen (0,3 % over 20 ms væk fra svarene). Tallene ligner målingen ved frigivelsen:

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
| Engdalen kl. 9.35 (samme build, langsom periode) | 58 | 100 % · 116,6 ms | 100 % · 99,9 ms | 100 % · 66,7 ms | 100 % · 83,4 ms | 100 % · 116,6 ms | 157 ms | 16,8 ms / 1,9 % | –, – |
| Tung profil, 333 KB | 74 | 100 % · 66,7 ms | 72 % · 50,1 ms | 0 % · 33,3 ms | 14 % · 49,9 ms | 100 % · 83,4 ms | 116 ms | 16,8 ms / 1,4 % | – |
| Regnbueskoven, iPad | 57 | 83 % · 50 ms | 6 % · 33,4 ms | 0 % · 16,8 ms | 33 % · 33,4 ms | 98 % · 66,7 ms | 90 ms | 16,8 ms / 0,9 % | – |
| Engdalen, THROTTLE=1 | 54 | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | – | 16,7 ms / 0,2 % | – |

- **Den tunge profil** (kl. 9.01) er gyldig. Det påklædte dyr gjorde blikket dyrt: blik-lytteren kostede 12–15 ms pr. tryk.
- **Skov-iPad og `THROTTLE=1`** er også gyldige. Ved `THROTTLE=1` var der billeder på 50 ms inden for 2,5 s af et tryk, når strategien kom frem. De lange animationsbilleder dér havde ingen script-tid: det var gengivelsen.

### Hvad der er ændret

1. **Dyret bliver stående (P1).** Nøglen pr. opgave sad på hele scenen, så dyret (riggens SVG) blev monteret forfra ved hver opgave, og et påklædt dyr blev tegnet uden tøj, til genstandene var hentet.
   - Nu sidder nøglen på kortet og svarfeltet, der glider ind (`tv-stage-in`), mens dyret bliver stående. Ingen slide-in i rolig tilstand og ved reduced motion.
   - `Buddy` er i `memo` og klæder sig på fra en modul-cache over hentede genstande. Kortet og intro-skærmen har allerede hentet dem, så der aldrig er et billede uden tøj.
   - Blik-lytterne er kun aktive i think og idle. Før kostede de 12–15 ms pr. tryk med det påklædte dyr i den tunge profil, nu 0,4–4 ms.
   - `Rig()` genbruger sin rene render (`rigElement`) og sit pupil-input, så længe props er uændrede. `lookAt` tæller ikke i animeret tilstand, for pupillerne flyttes imperativt. Markup'en er den samme, og alle kunst-hashes er uændrede.
2. **Ingen måling i commit (P2).** `useSizeVars` læste kortets størrelse med `getBoundingClientRect` og `getComputedStyle` i commit og tvang et layout. Nu sætter ResizeObserverens første callback `--cw`/`--ch` efter layout og før paint.
3. **Én render pr. opgave (P3).**
   - Tilstanden for en ny opgave sættes i den render, der viser opgaven ("tilstand fra forrige render"), ikke i en effekt, der gav en ekstra render: beat, svar, kladde, hint, støtte, lyspære, puls, oplæst kort, demo, humør, æg, kompakt og taleboblen.
   - `supportFor` genbruger den strategi, der allerede er regnet ud, og `JSON.stringify`-sammenligningen er blevet en identitet.
   - `RoundScreen` er i `memo` og læser kun det, den tegner, fra `useRound` (`useShallow`). Den abonnerer ikke længere på profilen, kun på reserve-dyret, så PlayScreens re-render ved hvert svar stopper dér. PromptScene, ProgressStones, Teaching og opgavevisningerne er pakket i `memo`.
   - Oplæsningen (eller demoen) starter efter paint, og `recordIntro` skriver profilen efter paint. Ved et tryk på bekræft kører Reacts effekter synkront, så ville oplæsningens første tilstande ellers give en ekstra render i selve trykket. Det trin er ikke målt for sig, for målingerne var for støjfyldte til at skille det ud.
4. **Svar-trykket (P4).** Stjerne-burst, konfetti og starten af ros- og oops-stemmen kører efter paint (`afterPaint` i `src/app/idle.ts`: rAF og så `setTimeout 0`; `whenIdle` er flyttet dertil fra kortet). Stemmens start koster 5–7 ms ved 4× (`voice.ts` finder klippets grænser i lyddata hver gang). Lydeffekterne er stadig øjeblikkelige. Stjernen i burst'en parses én gang og klones.

**P5 og P6 var ikke nødvendige.**
- Ingen kørsel viste IndexedDB-scripts ≥ 10 ms inden for 300 ms af et tryk, heller ikke den tunge profil før og efter. Før ændringerne var den eneste IndexedDB-post én `IDBRequest.onsuccess` på 25 ms uden for vinduet.
- En CPU-profil af et ikke-minificeret build ved 4× viser `rigElement` på 2–5 ms pr. kald (grænsen er 8 ms).

### Efter

Matrixen efter ændringerne. Alle kørsler ved 4× faldt i den langsomme periode og er derfor ikke sammenlignelige med "Før" (se `DIST_B`-sammenligningen ovenfor):

| Kørsel | Svar | Rigtigt tryk | Forkert tryk | Strategien vises | Rigtigt → næste | Bekræft → næste | Længste lange opgave | Hele turen: p95 / over 20 ms | Målestok |
|---|---|---|---|---|---|---|---|---|---|
| Engdalen, 2 ture | 91 | 100 % · 100 ms | 100 % · 100 ms | 96 % · 66,7 ms | 94 % · 83,3 ms | 100 % · 100,1 ms | 159 ms | 16,8 ms / 2 % | –, – |
| Tung profil, 333 KB | 60 | 100 % · 133,3 ms | 100 % · 116,7 ms | 100 % · 83,3 ms | 100 % · 100 ms | 100 % · 116,7 ms | 176 ms | 16,8 ms / 2,3 % | 13,4/15,1 |
| Regnbueskoven, iPad | 44 | 100 % · 100,1 ms | 100 % · 99,9 ms | 93 % · 83,3 ms | 100 % · 100 ms | 100 % · 100 ms | 198 ms | 16,8 ms / 2,1 % | 13,2/13,2 |
| Engdalen, THROTTLE=1 | 62 | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | 0 % · 16,8 ms | – | 16,7 ms / 0 % | 3,4/4,1 |
| Tung profil, 503 KB (3 min) | 38 | 100 % · 116,8 ms | 100 % · 116,7 ms | 100 % · 83,4 ms | 100 % · 99,9 ms | 100 % · 116,7 ms | 192 ms | 16,8 ms / 2,3 % | 13,1/12,1 |

- **Ved `THROTTLE=1` holder alle krav:** det værste billede inden for 2,5 s af et tryk er 33,3 ms (før 50,1 ms), og der er ingen lange animationsbilleder.
- **Ved 4×** holder ingen af kørslerne kravene i den langsomme periode. Engdalen, den tunge profil og skov-iPad var ugyldige (0,3–0,7 % over 20 ms væk fra svarene).
- **Ingen IndexedDB-scripts** ≥ 10 ms inden for 300 ms af et tryk, heller ikke med den tunge profil på 333 KB og 503 KB. Med 503 KB var der slet ingen IndexedDB-scripts i de lange animationsbilleder. Kopien af dokumentet ved hvert svar er altså ikke det, der koster.
- **0 konsolfejl.** Højst 384 SVG-elementer (skov-iPad).

**Tilsigtet synlig ændring:** dyret bliver stående, mens opgaven glider ind. Før gled hele scenen ind, dyret med.

### Det, der står tilbage

En CPU-profil af det ændrede build (ikke-minificeret, 4×) viser, hvad et svar stadig koster i JavaScript. Det er 25–40 ms pr. tryk eller opgaveskift, oven i stil, layout og maling:

| Hvad | Ved 4× | Hvor |
|---|---|---|
| `submit` → `recordAnswer` (mestring, misforståelser, log) | 8–11 ms pr. tryk | `useRound`, `useProfile` |
| Riggen tegnes om, når humøret skifter (idle → happy/oops → think → idle) | 2–5 ms pr. skift | `rigElement` |
| Det gamle kort og svarfelt fjernes (`removeChild`) | 5–11 ms pr. opgaveskift | React/DOM |
| Opgavens scene og svarkort monteres (`ThingArt`, `Scatter`, `AnswerCard`) | 3–17 ms pr. opgave | `src/ui/scenes`, `src/ui/task` |
| Stemmens start: `say` → `planAll` → `boundsFor` læser lyddata hver gang | 5–7 ms pr. klip (nu efter paint) | `src/audio/voice.ts` |
| Lydeffekterne (`fm`, noder) | 2–3 ms pr. tryk | `src/audio/sfx.ts` |

Forslag til næste runde, som kræver andre ejere eller integratorens godkendelse:
1. Bogfør svaret (`recordAnswer`/`saveRound`) efter paint: trykket viser det grønne kort med det samme, og mestringen regnes i næste opgave. Det kræver en ændring i `useRound`.
2. Gem klippenes grænser i `voice.ts` i stedet for at læse lyddata ved hvert klip.
3. Mål på en rigtig iPad, før der skæres mere. Ved 4× i Chromium er en tom side lige hurtig hele tiden, men svarenes opgaver svinger med en faktor 1,5 med maskinens hastighed.

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
