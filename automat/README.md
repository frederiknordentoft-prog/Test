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
| `#solstorm` | Demo-stormen starter automatisk 2 s efter "Tænd himlen" (demo-pillens ⚡-segment udløser den også direkte; ⋯ åbner demo-værktøjerne) |
| `#1948` | Portens åbning (demo) starter 2 s efter "Tænd himlen". Tæller ikke og er mærket DEMO hele vejen |
| `#kammer` | Åbner Terningekammeret efter intro |
| `#terning` | Viser demo-terningen med sit valg 2 s efter intro: Terningens øjeblik, kortet Behold / Kvit eller dobbelt / 3 for 1, kastet og resultatet. Tæller ikke, skriver intet og er mærket DEMO hele vejen (samme som pillens Terning-segment og D) |
| `#clean` | Skjuler demo-pillen til optagelser. Vandmærket "DEMO" i canvas bliver stående |
| `#fullfx` | Fuld effekt, selvom systemet beder om reduceret bevægelse |
| `#fps` | Viser FPS i et overlay |
| `#autostart` | Springer splash-skærmen over. Bruges kun til QA |

**Taster:** Mellemrum = spin · ↑↓ = indsats · A = autospin (i idle) · E = demo-storm · D = demo-terning med valg · T = Terningekammeret · M = lyd · Esc = spring over. På valgkortet betyder Mellemrum og Enter kun Behold, og først efter 1,0 s.

## Arkitektur

```
src/math/      Outcome-motor: ren TypeScript, seedet xoshiro128**, isomorf og RGS-klar
src/game/      Game (state machine, penge, måler, storme, demo), World (render-ejer), store, tiers
src/present/   schedule (ren: SpinResult → Beat[]), director (GSAP), celebration, Solstorm-cinematic, clock,
               Terningen: dieAward (Pixi + DOM-flugt), dieMoment (Terningens øjeblik: helten, kastet, stormens vifte),
               dicePresenter, portens ceremoni (cinematics/gate.ts)
src/render/    Pixi v8: sky, symbol-art, Isfont, grid/frame, Kp-bue, post (bloom + uber), partikler/skår,
               porten under klinten (chamber/GateView + det rene flise-gitter gateLattice), terningens billede (art/dieImage)
src/audio/     Rå WebAudio: FM-klokker, pre-renderede stems, adaptive lag, stormmusik, Polar Night-bund (polarLoop.ts)
src/ui/        DOM-HUD: skarp tekst, a11y, regulatoriske strips, menu, regler, demo-værktøjer, isnichen (vault.ts),
               SPIN med nordlys, autospin-arket og valgkortet
```

**Principper:**
- Outcome og præsentation er adskilt. `src/present` og `src/render` må aldrig importere outcome-RNG'en; det sikres af en test.
- Mindst 3,0 s pr. spil, også i autospin. Der er ingen turbo eller bonus buy. Autospin (10, 25, 50 eller 100 spin) kræver en tabsgrænse, går altid gennem det samme spin og stopper ved hver terning, Ladet spin og Solstorm, før tabet ville overstige grænsen, ved for lav saldo, menu, skjult fane, demo og STOP. Indsatsen er låst imens. Det fylder aldrig saldoen op og fortsætter aldrig efter en genindlæsning.
- Kvit eller dobbelt (4–6: dobbelt, 50 %) og 3 for 1 (5–6: tredobbelt, 33,3 %) gælder kun nye terninger, aldrig penge og aldrig terninger i kammeret. Chancerne er fair (i gennemsnit præcis indsatsen), der er ét valg pr. tildeling (en Solstorm giver ét fælles valg for alle sine terninger), og Behold er forvalgt. Kastet trækkes fra sit eget RNG-domæne (`T`-ID) og gemmes ved valget, før noget vises, så en genindlæsning aldrig giver et nyt kast. Resultatet vises tidligst 3,0 s efter valget. Kastet har ingen near-miss: vinderbrikkerne står tændt fra første billede, terningen ruller i ét tempo og én tonehøjde, og den trukne brik tændes først, når resultatet vises. Et tab er neutralt (frost og sne i isblåt, ingen rød og ingen trist lyd). Valget kan slås fra i indstillingerne.
- Terningerne har ét hjem: isnichen lige over SPIN på telefoner og nederst i højre kolonne på desktop. Den viser kun et antal, aldrig en brøk. Bob, glimt og rasl kører kun i en stille idle (aldrig i autospin, med et kort, en menu eller kammeret åbent, i en skjult fane eller i rolig tilstand). Nichen er væk i kammeret, i ceremonien og i stormens smeltede faser og er tilbage fra stormens outro, så de frigivne terninger lander. Hver flyvning lander på den (≤ 4 px).
- Gevinster, der er lig med eller mindre end indsatsen, får den neutrale RETURN-profil og bliver ikke fejret (LDW-reglen).
- Der er ingen konstruerede near-misses. Anticipation følger en fast regel, der kan ses i reglerne.
- Solstorm-cinematic'en er slavet til lyd-uret, og hit-stops fryser kun effekter.
- Demo-knappen kører på en in-memory kopi af state. Den krediteres ikke saldoen, og den rigtige måler gendannes bagefter.

## Verifikation

| Område | Resultat | Kommando |
|---|---|---|
| Matematik (samlet RTP) | 96,035 % ± 0,055 pp (95 %-CI) | `npm run sim` |
| Matematik (gates) | 18 af 18 bestået på friske seeds; par sheet i `sim/REPORT.md` | `npm run sim` |
| Tests | 162 grønne: RNG-vektorer, klynger, kaskader, storm-replay, måler, golden hashes, 3,0 s-gulv, LDW-profiler, grænser mellem lag, terning-reglen, copy-lint (placardets påstand står altid i samme blok som sit forbehold; valget og autospin uden held, "igen", port eller årstal), terningernes to mutatorer (tildelingen og valget: antallet kommer aldrig under værdien før tildelingen, 'pending' kræver 1948, 'seen' vender aldrig tilbage), Kvit eller dobbelt (præcis fairness ved optælling for 1–20 terninger, chi² over 600.000 kast, gyldne kast, `T`-ID'er), autospin-reglerne (stop-rækkefølgen, tabsgrænsen før spinnet), valget gemt ved trykket før afsløringen og portens flise-gitter (1948 fliser, 974 pr. fløj, golden hashes, ingen frontlinje, ingen forudsigelig sidste flise) | `npm test` |
| Terningen | 291 Playwright-checks: tildeling før præsentationen, fødsel ved R+1,6 s, heltens øjeblik ved R+2,70 s (terningen løftes til scenens midte og vokser til clamp(120, 0,34·min(B,H), 260) px), flugten hjem (R+4,37 → 5,07 s) lander på isnichen (0 px), skip ≤ 300 ms (også under heltens hold), landing før idle, kort vist én gang, reload midt i en tildeling og midt i en storm, stormterninger holdt på rammen og sluppet i outroen, Ladet spin bedømt ved den låste indsats, 365-dages-udløbet nulstiller måleren men aldrig terningerne, porten (rigtig og demo, hele partituret på takt-gridden, Space springer over, #1948_clean beholder demo-båndet), nichens nordlysring efter den rigtige oplåsning og nul skrivninger til `terningen.v1` fra alle demo-værktøjer. Placardet ved 360×640, 375×667 og 844×390: påstanden hel med sit forbehold, knapperne inde i kortet, båndet og navnet frie. Visuel runde ved 390×844, 375×667 og 1920×1080: skærmbilleder og overlap-tjek af nichen mod SPIN, AUTO-pillen, #winstrip, gitterrammen, #reg og #foot, terningen frosset ved 0 og tøet ved den første landing, SPIN's nordlys i bevægelse, nichen skjult i kammeret | `node scripts/dice-check.mjs` |
| Kvit eller dobbelt og autospin | 125 Playwright-checks: intet valg for den første terning eller mens porten venter, valget i `terningen.v1` ved trykket og resultatet vist ≥ 3,0 s senere, Behold fokuseret først, Space, Enter, SPIN og indsatserne virkningsløse før 1,0 s, gevinst, tab og Behold, reload midt i valget og midt i kastet uden nyt kast ("Resultatet står fast"), stormens ene fælles valg (2k sluppet i outroen), 1946 + 3 for 1 → 1948-kortet, 1947 + en terning → intet valg, demo-valget uden skrivninger til `terningen.v1`, landingen på isnichen (≤ 4 px), antallet falder aldrig. Scenen: terningen venter centreret over kortet, seks isbrikker under den med vinderfladerne tændt fra første billede og den trukne flade tændt først ved resultatet, en gevinst deler terningen i udbetalingen, et tab flyver ingen steder (frost og sne). Ét tryk ved resultatet afslutter pausen og lander terningerne ≤ 600 ms senere. Stormens frigivne terninger flyver først, når nichen er tilbage i outroen, og lander på den (0 px). Autospin: ≥ 3,0 s mellem tryk, stop ved terning, Ladet spin, Solstorm, tabsgrænsen (før den overskrides), for lav saldo (ingen påfyldning), STOP (+1 spin), menu, skjult fane og demo, låst indsats | `node scripts/dice-check.mjs [url] gamble,auto` |
| Fotosensitivitet | WCAG 2.3.1: højst 1 blink/s (grænse 3); streng 10 %-måling højst 3/s (Solstorm); mættet rød højst 20 % af skærmen. Terningen: tildelingen 0 WCAG-blink/s (streng 2/s fra pengefejringen, rolig 1/s), Kvit eller dobbelt (demo-terningen, valget, kastet, resultatet) 0 WCAG-blink/s og streng 1/s både fuld og rolig, portens ceremoni 0 blink/s både fuld og rolig, ingen mættet rød og ingen modsatrettede udsving ≥ 10 % inden for 1 s | `node scripts/luminance.mjs [url] [calm 0/1] [storm/award/gamble/gate]` |
| Visuel QA | Deterministisk Playwright-tur (SwiftShader WebGL2) ved 360×640, 375×667, 390×844, 844×390, 1280×720 og 1920×1080: 136 checks, uden page-fejl. HUD-runden (nichen ved 0 og n, hello-kortet, SPIN i idle, Ladet spin og autospin, autospin-arket og en kørende autospin, valgkortet ved tilbud, kast og resultat, kammeret og menuens Terningen-fane) tjekker ved hvert hvilebillede, at nichen, SPIN, AUTO-pillen, #winstrip, gitterrammen, #reg, #foot, hello-kortet og indsatsen ikke overlapper og er på skærmen (desktop: #sideR uden scroll) | `node scripts/tour.mjs` |
| Artifact | Single-file ca. 2,8 MB (heraf 1,5 MB indlejret MP3 og ca. 115 KB terningbillede) uden eksterne hosts. Kører hele Solstorm-demoen, terningen, kammeret og portens ceremoni i artifact-rammen under en streng CSP (ingen `unsafe-eval`); terningbilledet afkodes fra bytes uden at hente en URL. `scripts/csp-smoke.mjs` pakker filen ind i en streng CSP og kører `#terning` (helt gennem demo-valget), `#solstorm` (hele stormen til idle) og `#1948` (ceremonien forbi 15 s): 0 fejl og 0 skrivninger til `terningen.v1` | `npm run build:artifact && node scripts/csp-smoke.mjs` |

**Lyd:**
- Tjekket headless med 51 checks: ingen clipping, sømløse loops, storm-downbeat på 0 frames' afvigelse og bar-alignede lag. Lydhukommelsen topper på 63,5 af 64 MB (med terningens nye `diePulse`: mono, 12 kHz, 1,4 s).
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
