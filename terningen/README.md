# Terningen — interaktiv AI-transformationsmodel

Et web-baseret fortælleværktøj til Danske Spils AI-transformation 2027, bygget til storskærm.
Kernen er en mekanisk terning i messing og creme på mørk navy: seks sider = seks komponenter i
organisationens evne til at omsætte AI til værdi, og et roterende urværk i midten = arbejdsgangene.

- **Samlet → eksploderet:** fladerne glider udad, og urværket bliver synligt og roterer.
- **Klik på en side (eller urværket):** siden svinger ud om sin hængselkant, og et panel folder ind
  med titel, kernesætning og spørgsmålene til ledelsesdiskussionen. De øvrige dele dæmpes.
- **Flaskehals:** udpeg én komponent som flaskehals — urværket bremser til stilstand over ~1,2 s,
  komponenten lyser amber og får mærkatet FLASKEHALS. Fjern den, og maskinen starter igen.
- **Fortællingen:** 9 beats (samlet → eksploderet → de seks sider → kernen) styres med tastaturet.
- **Deep-links:** hele tilstanden ligger i URL-hashen, fx `#beat=4&open=teknologi&bottleneck=governance`.

## Test uden installation

- **Hosted side:** appen er udgivet som en privat Artifact-side, der kan åbnes direkte i Chrome
  og Safari (også på iPhone/iPad): se linket i sessionen/`DECISIONS.md` #39.
- **Én fil:** `npm run build:single` skriver `dist/terningen.html` — hele appen i én HTML-fil,
  der kan åbnes ved dobbeltklik eller sendes som vedhæftning. Deep-links virker også fra filen.

## Kør

```bash
cd terningen
npm ci              # Node ≥ 20.19; lockfilen er committet
npm run dev         # http://localhost:5173 (strictPort — fejler højt, hvis porten er optaget)
```

Produktionsbuild og kvalitetsporte:

```bash
npm run typecheck   # tsc --noEmit (app + node-config)
npm run lint        # eslint
npm run test        # vitest: beats, hash round-trip, makeGearPath, tandhjulskæde, terningegeometri,
                    #         bremsning/genstart af urværket
npm run build       # vite build → dist/ (relative stier, kan serveres fra en undermappe)
npm run preview
```

End-to-end-gennemgang af Definition of Done i en rigtig browser (kræver en kørende `npm run dev`
i et andet vindue og Chromium til Playwright):

```bash
npx playwright install chromium   # én gang
npm run e2e                       # alle flows, edge cases og layoutkontrol ved 1920×1080
npm run e2e:all                   # 1366×768, 1920×1080 og 2560×1440
TERNINGEN_URL=http://localhost:4173/ npm run e2e   # mod fx `npm run preview`
```

Scriptet (`e2e/dod-checks.mjs`) afprøver de seks DoD-flows, deep-links (gyldige og ugyldige),
hurtige klik midt i en animation, Esc uden noget åbent, flaskehals på en åben komponent,
`prefers-reduced-motion` slået til/fra midt i en session, tastaturnavigation, browserzoom
125 %/150 % og tekstoverløb/layout-hop — og gemmer skærmbilleder i `e2e/shots/`.

## Betjening

| Handling | Mus | Tastatur |
|---|---|---|
| Næste / forrige beat | Knapper nederst | `→` `↓` `PgDn` `Mellemrum` `Enter` / `←` `↑` `PgUp` (ét tryk = ét beat; tastegentagelse ignoreres) |
| Første / sidste beat | – | `Home` / `End` |
| Saml / eksplodér | Knapper nederst | – |
| Åbn / luk en komponent | Klik på flade, urværk eller chip | `Tab` til fladen, `Enter`/`Mellemrum`; `Esc` lukker |
| Sæt / fjern flaskehals | Knap i panelet eller højreklik på flade/urværk | `B` (på den åbne komponent) |

Alt indhold (titler, kernesætninger, spørgsmål, UI-tekster, sidetitel) ligger i `src/content/model.ts`.
`<title>` i `index.html` er kun fallback, før scriptet sætter `document.title` fra samme modul.
Under 1500 px bredde viser komponentchipperne kun terningeøjne; titlen ligger i `aria-label`/`title`.
Farver ligger som CSS-variabler i `src/styles/tokens.css`.

## Arkitektur

- Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + Zustand. Ingen backend, ingen router.
- Terningen er rigtige CSS 3D-transforms: én container med `preserve-3d`, seks flader placeret med
  `rotateX/rotateY + translateZ`. Eksplosion = større `translateZ`; åbning = rotation om hængselkanten.
- Urværket er procedurelt genererede SVG-tandhjul (`makeGearPath`), ét `<svg>` per hjul, roteret med
  CSS-animation. Nabohjul kører modsat med hastighed omvendt proportional med radius; indgrebet er
  verificeret geometrisk i tests. Bremsning og genstart er én compositor-drevet Web Animations-overgang
  per hjul, der starter i hjulets aktuelle vinkel og afleverer til CSS-animationen i samme vinkel —
  ingen JS-loop, ingen hop.
- `prefers-reduced-motion: reduce` slår rotation og alle overgange fra; alt indhold er stadig tilgængeligt.

```
src/
  components/   Cube, CubeFace, Clockwork, Gear, ComponentPanel, StageOverlay, Controls
  store/        useModelStore.ts   (Zustand + to-vejs hash-synkronisering)
  content/      model.ts           (alt tekst, typed)
  lib/          gear.ts (makeGearPath), gearTrain.ts, cube.ts, hash.ts, beats.ts,
                clockworkMotion.ts (bremse/genstart-matematik), motion.ts
  styles/       tokens.css         (designtokens som CSS-variabler)
```

## Definition of Done — status

| Krav | Status | Verificeret ved |
|---|---|---|
| `npm run typecheck` uden fejl | ✅ | tsc, app + node-config |
| `npm run lint` ren | ✅ | eslint (ts/tsx + js/mjs) |
| `npm run build` lykkes | ✅ | vite build → `dist/` |
| Vitest: beat-sekvensering, hash round-trip, `makeGearPath` | ✅ | 34 tests i 6 filer (også tandhjulskæde, terningegeometri, bremsekurver) |
| Flow 1–6 (eksplodér, åbn, skift, flaskehals, piletaster, deep-link) | ✅ | `npm run e2e` — 81 kontroller, grønne ved 1366×768, 1920×1080, 2560×1440 og mod produktionsbuild |
| Ingen layout-hop/tekstoverløb ved de tre opløsninger | ✅ | e2e måler panelposition/-bredde, scroll-overflow og viewport-overflow i hvert beat |
| `prefers-reduced-motion` slår rotation og svingninger fra | ✅ | e2e emulerer reduce/no-preference, også skiftet midt i en session |
| ~60 fps med alle tandhjul synlige | ✅ Chromium | rAF-måling 60–61 fps ved 1920×1080 i headless Chromium (software-rendering); ét composited lag per hjul |
| Fungerer i Safari og Chrome | ⚠️ Chrome verificeret, Safari ikke kørt | Safari kunne ikke køres i byggemiljøet; WebKit-faldgruber er undgået efter kode-review (se DECISIONS #22, #10, #11, #35) |
| README + DECISIONS | ✅ | denne fil og `DECISIONS.md` (37 beslutninger) |

## Antagelser

- Beat-rækkefølgen følger specifikationens tabel: øjne 1–6 (beat 2–7) og kernen Arbejdsgange som
  finale (beat 8). Deep-link-eksemplet `#beat=4&open=teknologi` fastlægger beat = øjne + 1.
- Et ugyldigt deep-link (ukendt nøgle/værdi, beat uden for 0–8, `beat` og `open` der modsiger
  hinanden) falder tilbage til beat 0 uden at crashe; hashen skrives altid om til kanonisk form.
- Terningen drejer, så den åbnede side vender mod kameraet — ellers kan siderne 4, 5 og 6 ikke nås
  fra ét fast kamera. Urværket vender altid mod kameraet.
- Amber er semantisk: kun det, der ER flaskehalsen — dens flade (for- og bagside) eller urværket,
  mærkatet FLASKEHALS, den aktive "Fjern flaskehals"-knap og komponentens chip. Den inaktive
  "Markér som flaskehals"-knap er almindelig messing.
- Verificeret i Chromium (Playwright) ved 1366×768, 1920×1080 og 2560×1440 samt browserzoom
  125 % og 150 %. Safari kunne ikke køres i build-miljøet; Safari-specifikke faldgruber er undgået
  (ingen `opacity`/`overflow`/`filter` på `preserve-3d`-elementer, `-webkit-backface-visibility`,
  ingen SVG-filtre, ingen individuelle transform-egenskaber). Se DECISIONS.md #22.
- Browserkrav: Tailwind CSS 4 forudsætter Safari 16.4+, Chrome 111+ eller Firefox 128+ (moderne
  CSS som `@property` og `color-mix()`); det er også versioner, hvor Web Animations API
  (`Element.animate`, `getAnimations`, `Animation.finished`) og `:focus-visible` er sikre.
- Fabrikkerne rundt om terningen og AI Bet-laget er bevidst ikke bygget; arkitekturen (én skærm med
  lag, tilstand i store + hash, indhold i ét modul) er klar til at få dem lagt ovenpå.

Se `DECISIONS.md` for alle trufne valg.
