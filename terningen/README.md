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

## Kør

```bash
cd terningen
npm install --legacy-peer-deps   # se DECISIONS.md #3
npm run dev                      # http://localhost:5173
```

Produktionsbuild og kvalitetsporte:

```bash
npm run typecheck   # tsc --noEmit (app + node-config)
npm run lint        # eslint
npm run test        # vitest: beats, hash round-trip, makeGearPath, tandhjulskæde, terningegeometri
npm run build       # vite build → dist/ (relative stier, kan serveres fra en undermappe)
npm run preview
```

## Betjening

| Handling | Mus | Tastatur |
|---|---|---|
| Næste / forrige beat | Knapper nederst | `→` `↓` `PgDn` `Mellemrum` `Enter` / `←` `↑` `PgUp` |
| Første / sidste beat | – | `Home` / `End` |
| Saml / eksplodér | Knapper nederst | – |
| Åbn / luk en komponent | Klik på flade, urværk eller chip | `Tab` til fladen, `Enter`/`Mellemrum`; `Esc` lukker |
| Sæt / fjern flaskehals | Knap i panelet eller højreklik på flade/urværk | `B` (på den åbne komponent) |

Alt indhold (titler, kernesætninger, spørgsmål, UI-tekster) ligger i `src/content/model.ts`.
Farver ligger som CSS-variabler i `src/styles/tokens.css`.

## Arkitektur

- Vite + React 19 + TypeScript (strict) + Tailwind CSS 4 + Zustand. Ingen backend, ingen router.
- Terningen er rigtige CSS 3D-transforms: én container med `preserve-3d`, seks flader placeret med
  `rotateX/rotateY + translateZ`. Eksplosion = større `translateZ`; åbning = rotation om hængselkanten.
- Urværket er procedurelt genererede SVG-tandhjul (`makeGearPath`), ét `<svg>` per hjul, roteret med
  CSS-animation. Nabohjul kører modsat med hastighed omvendt proportional med radius; indgrebet er
  verificeret geometrisk i tests. Bremsning ramper animationernes `playbackRate` via Web Animations API.
- `prefers-reduced-motion: reduce` slår rotation og alle overgange fra; alt indhold er stadig tilgængeligt.

```
src/
  components/   Cube, CubeFace, Clockwork, Gear, ComponentPanel, StageOverlay, Controls
  store/        useModelStore.ts   (Zustand + to-vejs hash-synkronisering)
  content/      model.ts           (alt tekst, typed)
  lib/          gear.ts (makeGearPath), gearTrain.ts, cube.ts, hash.ts, beats.ts, motion.ts
  styles/       tokens.css         (designtokens som CSS-variabler)
```

## Antagelser

- Beat-rækkefølgen følger specifikationens tabel: øjne 1–6 (beat 2–7) og kernen Arbejdsgange som
  finale (beat 8). Deep-link-eksemplet `#beat=4&open=teknologi` fastlægger beat = øjne + 1.
- Et ugyldigt deep-link (ukendt nøgle/værdi, beat uden for 0–8, `beat` og `open` der modsiger
  hinanden) falder tilbage til beat 0 uden at crashe; hashen skrives altid om til kanonisk form.
- Terningen drejer, så den åbnede side vender mod kameraet — ellers kan siderne 4, 5 og 6 ikke nås
  fra ét fast kamera. Urværket vender altid mod kameraet.
- Amber er semantisk: kun flaskehalsens flade/urværk, mærkatet FLASKEHALS og knappen, der sætter den.
- Verificeret i Chromium (Playwright) ved 1366×768, 1920×1080 og 2560×1440 samt browserzoom
  125 % og 150 %. Safari kunne ikke køres i build-miljøet; Safari-specifikke faldgruber er undgået
  (ingen `opacity`/`overflow`/`filter` på `preserve-3d`-elementer, `-webkit-backface-visibility`,
  ingen SVG-filtre, ingen individuelle transform-egenskaber). Se DECISIONS.md #22.
- Fabrikkerne rundt om terningen og AI Bet-laget er bevidst ikke bygget; arkitekturen (én skærm med
  lag, tilstand i store + hash, indhold i ét modul) er klar til at få dem lagt ovenpå.

Se `DECISIONS.md` for alle trufne valg.
