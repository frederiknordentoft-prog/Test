# Spilhuset: Udfordreren

En Game Dev Story-inspireret tycoon om en dansk spiludbyder. Du starter i en garage i januar 2012, lige efter liberaliseringen,
og bygger produkter, ansætter folk og jagter anmeldelser, Guldkuponer og Top 10. Undervejs kommer nye markeder, regulering,
offshore-pres og levende konkurrenter, og fra 2026 AI-akten med agenter, verdensscenarier og spillerbyen. Spillet slutter i
december 2035 med en slutning, et eftermæle og tre kort til eftertanke, der peger ind i Arkivet.

> **Status:** alle 8 faser i spec'en er bygget. Se `PLAN.md` for detaljer og `DECISIONS.md` for de valg, der er truffet undervejs.

## Kør spillet

```bash
cd udfordreren
npm install
npm run dev        # http://localhost:5173 (tilføj ?debug=1 for debug-menuen)
```

Byg og preview:

```bash
npm run build && npm run preview   # produktionsbuild i dist/ med service worker (installerbar og offline)
npm run build:single               # én selvstændig HTML-fil i dist-single/ (uden service worker)
npm run artifact                   # single-builden gjort artifact-venlig: dist-single/udfordreren.html
```

## Installér som app

Produktionsbuilden er en PWA: den kan installeres fra browseren (Chrome/Edge: "Installér", iPad/iPhone: Del → "Føj til
hjemmeskærm") og virker offline efter første indlæsning. En ny version hentes i baggrunden og bruges næste gang, spillet åbnes,
så et spil i gang aldrig bliver afbrudt. App-ikonerne i `public/` tegnes procedural med `npm run ikoner`.

Spillet gemmer i IndexedDB (3 pladser + autosave hvert kvartal). I et privat vindue uden lokal lagring kører spillet videre uden
gem og siger det tydeligt; eksport og import som JSON virker altid.

## Kvalitet

```bash
npm run typecheck   # TypeScript strict
npm run lint        # ESLint (sim-kernen må ikke bruge Math.random/Date.now/React)
npm run test        # Vitest: determinisme, save/load, faser, anmeldelser, hitliste, økonomi, regulering, AI, slutninger, musik …
npm run sim         # balanceringsharness: 6 bots × 200 seeds, 10 assertions → sim/report.md (ca. 6 min.)
npm run e2e         # Playwright: bygger, starter preview på 4173 og kører Definition of Done, fase 4-6 og PWA
npm run grepcheck   # ingen rigtige firmanavne uden for src/data/archive.ts
```

E2E mod en server, der allerede kører (uden build): `E2E_BASE_URL=http://localhost:5173 npx playwright test --grep-invert "PWA ›"`.
PWA-testene kræver produktionsbuilden, fordi dev-serveren ikke har nogen service worker.

## Arkitektur

- `src/sim/` — ren, deterministisk simulationskerne. `step(state, actions)` returnerer en ny `GameState`. Én seedet `sfc32` i `rng.ts`.
- `src/data/` — alle tunbare tabeller med markeringer: **[F]** fakta, **[A]** afledt, **[D]** designestimat (`npm run dliste` → `docs/D-VAERDIER.md`).
- `src/store/` — Zustand-store (tidsloop, pauser, dialogkø) og Dexie-persistens (gem, autosave, JSON-eksport og -import).
- `src/ui/` — React-paneler, dialoger og skærme. Designsystemet ligger i `src/ui/components/kit.tsx`.
- `src/render/` — procedural pixel-grafik på canvas: kontoret i fem trin og AI-forvandlingen, spillerbyen, markedskortet, partikler og akt-chrome.
- `src/audio/` — lydeffekter i sfxr-stil (`sfx.ts`) og chiptune pr. akt i Tone.js (`music.ts`, noderne i `moenstre.ts`). Tone hentes først, når musikken er slået til, og spilleren har trykket.
- `tests/unit/` — Vitest. `tests/e2e/` — Playwright. `sim/` — bots og balanceringsscripts.

Ingen eksterne assets: al grafik og lyd laves i koden.

## Balancering

Al balance ligger i `src/data/`. Ændr et tal, og kør harnesset:

```bash
npm run sim                                   # 200 seeds pr. bot, skriver sim/report.md, fejler ved en rød assertion
npx tsx sim/runner.ts --seeds 40 --passive 20 --no-fail   # hurtig kørsel under tuning
npx tsx sim/kanalisering.ts Passiv 10 dk,uk,se,nl         # kanalisering pr. år (kalibrering af offshore-basis)
npx tsx sim/quick.ts 40 2022                  # hurtig rytmetest med den balancerede bot
```

De seks bots (Grådig, Forsigtig, Balanceret, AI-afviser, AI-hensynsløs, Tilfældig) er profiler af én motor i
`sim/bots/strategi.ts`. De ti assertions fra spec afsnit 8 står i `sim/runner.ts`; `sim/report.md` viser resultatet og
nøgletal pr. bot. Hver tuning er logget med én linje i `DECISIONS.md`.

### Designestimater og tal, der bør verificeres

`npm run dliste` skriver `docs/D-VAERDIER.md`: alle linjer med [D] og [A] i `src/data/` med fil og linje. De vigtigste
designestimater er:

- **Kundeøkonomi** (`costs.ts`, `acquisition.ts`, `verticals.ts`, `markets.ts`): CAC pr. kanal, churn, BSI pr. kunde, bonus- og
  VIP-effekter, licensgebyrer og behandlingstider.
- **Offshore-modellen** (`offshore.ts`): formlens vægte og den strukturelle basis pr. marked, kalibreret til kanaliseringen
  (dk ca. 90 % i 2024, se ca. 85 % med kasino under betting, nl ca. 50 %, on ca. 89 %).
- **Tilsynstillid og sanktioner** (`trust.ts`): tillidsposter, sanktionstrappe, genopretning.
- **Konkurrenternes reaktioner** (`reactionRules.ts`) og **dynamisk regulering** (`regulationTimeline.ts`: puljen og R10/R11).
- **Rytmen** (`balance.ts`): projektlængder, markedsstandard, hitlistens hjemmebane for statsselskabet.
- **AI-akten** (`ai.ts`): agenternes pris, compute, fejlrate og effekt, verdens- og AI-scenariernes sandsynligheder — alt
  2026-2035 er spekulation og markeret som sådan.

Fakta, der er nye eller kan ændre sig, og som bør tjekkes før en præsentation: Spilpakke 1 i Danmark (i kraft 1. juli 2026,
dele 1. januar 2027), UK's afgift på fjernspil (40 % fra april 2026, fjernbetting 25 % fra april 2027), Hollands afgift
(37,8 % fra 2026), Sveriges kreditforbud (2026), Finlands åbning (2027) og antallet af selvudelukkede i ROFUS.

## Debug-menu

Tilføj `?debug=1` til URL'en: hop til et år, sæt kapital/indsigt/tillid, udløs events og konkurrentreaktioner, åbn markeder,
tving verdens- og AI-scenarier, tilføj agenter og se sim-værdierne bag hitlisten.

## Hosting

Statisk, uden backend, login eller analytics. `netlify.toml` bygger med `npm run build`, udgiver `dist/` og sætter no-cache på
`sw.js` og manifestet (byggede filer med hash caches længe). Ligger spillet i en undermappe af repoet, så sæt *Base directory*
til `udfordreren` i Netlify. Enhver anden statisk host virker også: upload indholdet af `dist/`. Kræver Node 22 til bygningen.

## Parodinavne og Arkivet

Konkurrenterne har venlige parodinavne (fx Danske Lykke, bet356, Unibit, Betssen, Flitter) og vises kun som farvede
monogrammer. Koblingen mellem parodinavn og virkeligt firma står i `docs/SPEC.md` afsnit 7.4. I spillet står rigtige navne
**kun** i Arkivet (`src/data/archive.ts`): korte "I virkeligheden …"-opslag, skrevet ud fra faktalisten i spec 7.15, som låses
op, når et marked åbner, eller en konkurrent eller et event dukker op. Arkivet kan slås fra under Indstillinger.
`npm run grepcheck` sikrer, at ingen rigtige firmanavne findes andre steder i `src/`. Lande og myndigheder (Spillemyndigheden,
ROFUS, Spelinspektionen, UKGC m.fl.) er rigtige.
