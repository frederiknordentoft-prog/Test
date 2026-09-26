# PLAN — Udfordreren

Kort todo pr. fase (spec afsnit 9). ✅ = færdig, 🔶 = i gang, ⬜ = ikke startet.

## Fase 1: Garagen og Game Dev Story-kernen 2012-2014 ✅
- ✅ Vite + React + TS strict + Tailwind + Zustand + Dexie, ESLint, Vitest, Playwright
- ✅ Ren sim-kerne (`src/sim/`), seedet sfc32, stabil state-hash
- ✅ Stifter- og vertikalvalg, white-label, dk-licens (12 uger)
- ✅ Kontraktopgaver, projektfaser med tildeling, point-bobler, fejl, test og boost
- ✅ 4 anmeldere /40 med fanfare; Guldkupon/Hall of Fame
- ✅ Top 10 for dk (Danske Lykke + 5 konkurrenter), rangeret efter ugens nye spillere
- ✅ Kundemotor med lanceringsbølger, økonomi, tid og pause, autosave
- ✅ Pixelkontor på canvas, mentor-tutorial, responsivt layout (1440/1024/390)
- ✅ Gate: første lancering med anmeldelse < 90 sek. (e2e), unit tests for faser, anmeldelser og hitliste

## Fase 2: Vækst, niveauer og belønninger ✅
- ✅ Alle roller, jobannoncer, træning, energi, rolleskift
- ✅ Kontortrin, kombinationsbog, type-/temaniveauer, 2.0-versioner
- ✅ Messer, Branchegallaen, anden vertikal med kryds-salg, runder og kvartalsmål
- ✅ Gate: unit tests for niveauer, efterfølgere, gala og runder; start i én vertikal og tilføj den anden

## Fase 3: Markeder, regulering og offshore ✅
- ✅ Sim: 9 markeder med åbningsdatoer, licens pr. marked/vertikal, afgifter og strenghed over tid, offshore-model (7.8), historiske og dynamiske regler, R11, sanktionstrappe, trends og sportskalender, offshore-fristelsen
- ✅ Gate: markedskalibrering (dk 90 %, se 87 % med kasino < betting, nl 50 %, on 89 %, dk kasino-BSI 4,7 mia., Danske Lykke nr. 1)
- ✅ UI: markedskort, regulering, sanktioner, trends, preslog og faste afgiftstrin
- ✅ Insider-spiltest rettet: afgiftsstigningers størrelse, varsler, anden vertikal, offshore-brandets størrelse og risiko, 2026-kanalisering, svensk bonusregel

## Fase 4: Levende konkurrenter og platforme ✅
- ✅ Sim: reaktionsregler R1-R12 med synlige effekter, historiske konkurrenttiltag, opkøb og opkøbstilbud, sponsorauktioner, platformmigrering og B2B
- ✅ Gate: bonuskrig, kopi og opkøbstilbud før 2020 i bot-kørsler; unit test for hver regel
- ✅ UI: konkurrentoversigt (Rivaler), platformvalg (Teknik), tilbuds-, sponsor- og reaktionsdialoger

## Fase 5: Spillerbyen og AI-akten ✅
- ✅ Sim: spillerbyen, ansvarsforskning og fristelser, akt-skift 2026 med verdensscenarier, AI-laboratoriet og agenter i faser, AI-scenarier, AI-transformation, børslicens og agent-API, 80 events
- ✅ Unit tests for agenter, verdensscenarier, AI-scenarier, transformation og byen
- ✅ UI: AI-laboratoriet (agenter, fristelser, verden), Verdensbilledet 2026, verdensnyheder, spillerbyen, agenter i projektfaser
- ✅ Spiltest rettet: byen bliver rød under hyperpersonalisering, AI-uheld med vægt, AI-øjeblikke i tidslinjen, Norges licensregime

## Fase 6: Slutninger, Arkiv og balancering ✅
- ✅ Sim: 8 slutninger, eftermæle, tidslinje, eftertanke, Arkivet (kun 7.15), New Game+ med to modes
- ✅ `npm run sim`: 6 bots × 200 seeds i parallelle workers, 10 assertions, `sim/report.md`
- ✅ UI: slutskærm med eftermæle, tidslinje, trofæer og byens udvikling, eftertanke, Arkiv, New Game+ og debug-menuens værktøjer
- ✅ Værdiansættelse med resultatmargin og negativ kasse; `npm run sim` består alle 10 assertions ved 200 seeds

## Fase 7: Følelse, grafik og lyd ✅
- ✅ Pixelkontor i trin, trofæer, mentor-tutorial, SFX, reduceret bevægelse, tekststørrelse, pause ved visibilitychange
- ✅ Chiptune pr. akt (Tone.js, dovent indlæst i sin egen chunk), AI-forvandlingen af kontoret, trofæhylde, akt-chrome for hele skallen, juice-gennemgang
- ✅ Gate: automatiseret gennemgang 2012 → første produkt → 2015 → akt-skiftet 2026 → slutskærm på 1440/1024/390, Guldkupon-juice og forvandlingen i screenshots; ≈ 60 fps ved 4x i 2030 (1440×900, hovedkontor med 30 folk og 20 agenter)

## Fase 8: Hærdning og levering ✅
- ✅ `netlify.toml`, `docs/D-VAERDIER.md` (`npm run dliste`)
- ✅ PWA og offline (ingen service worker i dev og single-build), iOS/iPad-tjek, eksport/import-hærdning, privat vindue
- ✅ Definition of Done-e2e (`tests/e2e/dod.spec.ts`) plus fase 4-6 og PWA: `npm run e2e` er grøn
- ✅ README og slutverifikation af hele Definition of Done

## Kendte punkter
- JSON-eksport virker lokalt; i den delte artifact-version blokerer vieweren downloads.
- Musikken er kun målt (niveau, temaskift), ikke lyttet igennem af et menneske. iOS/iPad er kode-auditeret og emuleret i Chromium, ikke testet i Safari/WebKit eller på en rigtig enhed.
