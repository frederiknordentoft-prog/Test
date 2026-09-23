# NORDLYS · SOLSTORM G5

NORDLYS er en UI-demo af en casino-automat, der kører med legepenge. Al grafik og lyd er genereret i kode, bortset fra musikbunden «Polar Night» (Suno, indlejret MP3-sløjfe). Den kan skiftes til den kodede bund under Indstillinger → Musik → Kode.

Himlen over Møns Klint er progressionsbaren. Hver gevinst knuser iskrystaller, og ladningen fra dem flyver op i nordlyset. Når Kp når 9, eller når der lander 4 sole, rammer **SOLSTORM · G5 EKSTREM**. Skærmen knuses, og et smeltet 8×8-kabinet samler sig på beatet.

## Kør lokalt

```bash
npm install
npm run dev              # http://127.0.0.1:5173
npm test                 # vitest: matematik, præsentationsregler, grænser mellem lag
npm run sim              # Monte Carlo for matematikmodellen
npm run build:artifact   # dist/nordlys.html: én selvstændig fil til en claude.ai Artifact
```

## Deep links

Artifacts modtager kun et rent `#anker`. Flags skrives derfor som tokens, der kan kombineres med `_`:

| Link | Effekt |
|---|---|
| `#solstorm` | Demo-stormen starter automatisk 2 s efter "Tænd himlen" (demo-pillen udløser den også direkte; ⋯ åbner demo-værktøjerne) |
| `#1948` | Portens åbning (demo) starter 2 s efter "Tænd himlen". Tæller ikke og er mærket DEMO hele vejen |
| `#kammer` | Åbner Terningekammeret efter intro |
| `#terning` | Viser en demo-terning 2 s efter intro (tæller ikke) |
| `#clean` | Skjuler demo-pillen til optagelser. Vandmærket "DEMO" i canvas bliver stående |
| `#fullfx` | Fuld effekt, selvom systemet beder om reduceret bevægelse |
| `#fps` | Viser FPS i et overlay |
| `#autostart` | Springer splash-skærmen over. Bruges kun til QA |

**Taster:** Mellemrum = spin · ↑↓ = indsats · E = demo · T = Terningekammeret · M = lyd · Esc = spring over.

## Arkitektur

```
src/math/      Outcome-motor: ren TypeScript, seedet xoshiro128**, isomorf og RGS-klar
src/game/      Game (state machine, penge, måler, storme, demo), World (render-ejer), store, tiers
src/present/   schedule (ren: SpinResult → Beat[]), director (GSAP), celebration, Solstorm-cinematic, clock,
               Terningen: dieAward (Pixi + DOM-flugt), dicePresenter, portens ceremoni (cinematics/gate.ts)
src/render/    Pixi v8: sky, symbol-art, Isfont, grid/frame, Kp-bue, post (bloom + uber), partikler/skår,
               porten under klinten (chamber/GateView + det rene flise-gitter gateLattice), terningens billede (art/dieImage)
src/audio/     Rå WebAudio: FM-klokker, pre-renderede stems, adaptive lag, stormmusik, Polar Night-bund (polarLoop.ts)
src/ui/        DOM-HUD: skarp tekst, a11y, regulatoriske strips, menu, regler, demo-værktøjer
```

**Principper:**
- Outcome og præsentation er adskilt. `src/present` og `src/render` må aldrig importere outcome-RNG'en; det sikres af en test.
- Mindst 3,0 s pr. spil. Der er ingen turbo, autoplay eller bonus buy.
- Gevinster, der er lig med eller mindre end indsatsen, får den neutrale RETURN-profil og bliver ikke fejret (LDW-reglen).
- Der er ingen konstruerede near-misses. Anticipation følger en fast regel, der kan ses i reglerne.
- Solstorm-cinematic'en er slavet til lyd-uret, og hit-stops fryser kun effekter.
- Demo-knappen kører på en in-memory kopi af state. Den krediteres ikke saldoen, og den rigtige måler gendannes bagefter.

## Verifikation

| Område | Resultat | Kommando |
|---|---|---|
| Matematik (samlet RTP) | 96,035 % ± 0,055 pp (95 %-CI) | `npm run sim` |
| Matematik (gates) | 18 af 18 bestået på friske seeds; par sheet i `sim/REPORT.md` | `npm run sim` |
| Tests | 119 grønne: RNG-vektorer, klynger, kaskader, storm-replay, måler, golden hashes, 3,0 s-gulv, LDW-profiler, grænser mellem lag, terning-reglen, copy-lint, terningernes ene mutator og portens flise-gitter (1948 fliser, 974 pr. fløj, golden hashes, ingen frontlinje, ingen forudsigelig sidste flise) | `npm test` |
| Terningen | 203 Playwright-checks: tildeling før præsentationen, fødsel ved R+1,5 s, flugten (R+2,75 → 3,35 s) lander på chippen, skip ≤ 300 ms, landing før idle, kort vist én gang, reload midt i en tildeling og midt i en storm, stormterninger holdt på rammen og sluppet i outroen, porten (rigtig og demo, hele partituret på takt-gridden) og nul skrivninger til `terningen.v1` fra alle demo-værktøjer. Visuel runde ved 390×844, 375×667 og 1920×1080: skærmbilleder og overlap-tjek mod #reg, #foot, dækket og Kp-buen | `node scripts/dice-check.mjs` |
| Fotosensitivitet | WCAG 2.3.1: højst 1 blink/s (grænse 3); streng 10 %-måling højst 3/s (Solstorm); mættet rød højst 20 % af skærmen. Terningen: tildelingen 0 WCAG-blink/s (streng 1/s, rolig 0/s), portens ceremoni 0 blink/s både fuld og rolig, ingen mættet rød og ingen modsatrettede udsving ≥ 10 % inden for 1 s | `node scripts/luminance.mjs [url] [calm 0/1] [storm/award/gate]` |
| Visuel QA | Deterministisk Playwright-tur (SwiftShader WebGL2) ved 390×844, 375×667 og 1920×1080, uden page-fejl | `node scripts/tour.mjs` |
| Artifact | Single-file ca. 2,8 MB (heraf 1,5 MB indlejret MP3 og ca. 115 KB terningbillede) uden eksterne hosts. Kører hele Solstorm-demoen, terningen, kammeret og portens ceremoni i artifact-rammen under en streng CSP (ingen `unsafe-eval`); terningbilledet afkodes fra bytes uden at hente en URL | `npm run build:artifact` |

**Lyd:**
- Tjekket headless med 39 checks: ingen clipping, sømløse loops, storm-downbeat på 0 frames' afvigelse og bar-alignede lag.
- Polar Night-bunden (16 takter, 85,2 BPM målt): klikfri sløjfe over 3 gennemløb, takt-grid låst til scheduleren, loudness som den kodede bund, live-skift og fallback. `node dev/polar-check.mjs` (kører også i `node dev/audio-check.mjs`).
- Er ikke lyttetestet af et menneske.

**Ydelse:**
- Headless SwiftShader siger intet om rigtig GPU-tid. Brug `#fps` på en telefon.
- Adaptiv kvalitet (H/M/L) justerer opløsning, partikler, bloom og nordlysets frekvens.

**Review:**
- Et panel med fire linser (visuel, UX/copy, kode, compliance/ydelse) gennemgik spillet.
- Efter rettelserne tjekkede en adversariel verifikation hvert fund. Resultatet var fikset eller bevidst udskudt.
- Bevidst udskudt:
  - Isfont-atlasset bygges ved boot, ikke ved build.
  - Bloom-composite og uber-pass er ikke slået sammen.
  - Der er ingen downloadet brødtekst-font, fordi alle assets skal være lavet i kode.

**Kendte grænser:**
- Alle assets er lavet i kode undtagen Polar Night og terningens billede (brugerens eget, `assets-src/terning.png`). Begge er indlejret som bytes og afkodes uden at hente en URL. Billedet beskæres og kodes til WebP 512 + 128 px med `node scripts/die-asset.mjs`.
- Portens 1948 fliser er ca. 3 px store på en 360 px telefon.

Se [PLAN.md](PLAN.md) for designet og [docs/CONTRACTS.md](docs/CONTRACTS.md) for modulgrænserne.
