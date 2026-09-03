# Objekt · spilleautomat-demo

Fem valser, tre rækker, 20 gevinstlinjer, wild, scatter og gratis spins – bygget som Apple ville have gjort det, hvis spillet lå på apple.com. Ren UI/spil-demo med demokreditter. Ingen backend, ingen eksterne assets: alle symboler, lyde og effekter er genereret i kode.

## Kør

Åbn `slot/index.html` (Objekt-skin) eller `slot/nova.html` (Nova-skin) via en statisk server (fx `python3 -m http.server` i mappen), eller brug de samlede enkeltfiler i `slot/dist/`, som `node slot/build.mjs` genererer.

## Skins

Samme spilmotor, matematik og flow – to visuelle identiteter:

| Skin | Side | Identitet |
| --- | --- | --- |
| Objekt | `index.html` | Apple-disciplineret: lyst/mørkt, materialer under ét lys, én accent. |
| Nova | `nova.html` | Kosmisk ædelstens-tema: stjernehimmel der går i warp under spin, facetterede glødende sten, guld-BAR og rubin-7, regnbuestjerne som Wild, ringplanet som Bonus, neon-gevinstlinjer med bloom, ædelstensskår ved store gevinster. |

Et skin består af et stylesheet (`skins/nova.css`), en symbolmaler med samme API som `js/art.js` (`js/art-nova.js`) og et lille hook-modul (`skins/nova.js`), der sætter `window.SlotSkin` med art, partikeltype og hooks (`onSpinStart`, `onSpinEnd`, `onReelStop`, `onWin`, `onFreeEnter`, `onFreeExit`). `js/app.js` og `js/reels.js` er skin-agnostiske; valsemotoren slår effekter til ud fra `art.colors()` (`line`, `bloom`, `landFlash`, `wildPulse`, `idleSparkle`).

## Struktur

| Fil | Ansvar |
| --- | --- |
| `js/math.js` | Spilmodel: valsestrimler, 20 linjer, wild-substitution, scatter, gratis spins, seeded RNG. Udfaldet afgøres ved spinstart. |
| `js/art.js` | Objekt-symboler (glasprisme, titaniumring, safirlinse, titanblok, keramik, stålkugle, fire graverede skiver A/K/Q/J) tegnet i Canvas 2D og cachet pr. størrelse og tema. |
| `js/art-nova.js` | Nova-symboler (regnbuestjerne, ringplanet, BAR, 7, seks facetterede ædelsten). |
| `js/starfield.js` | Nova-baggrund: radial stjernedrift, hyperspace-streaks under spin, åndende nebula, flash ved gevinst. |
| `js/reels.js` | Valsemotor: pull-back, acceleration, motion blur, staggered stop med settle, scatter-anticipation, gevinstlinjer og specular-sweep på vindende objekter. |
| `js/fx.js` | Bokeh-lys og glimt til gevinstpræsentation. |
| `js/audio.js` | Syntetiseret lydpalette (Web Audio): klik, spinstart, tick, valsestop, klokkespil pr. gevinsttrin, bonus. |
| `js/app.js` | Tilstandsmaskine og UI: indsats, saldo, spin-flow, gevinsttrin, gratis spins, autospin med stopbetingelser, spilinfo, ur/spilletid, reality check. |
| `tools/simulate.mjs` | Monte Carlo-kontrol af RTP og hitrate. |

## Matematik (demo)

Seneste simulering (3 mio. spins): RTP 96,16 % (basis 74,2 %, gratis spins 22,0 %), gevinstfrekvens 36,1 %, bonus ca. hver 131. spin, maks. 475 × indsats i ét spin.

## Compliance-elementer i UI

18+, "Demo · Spil for sjov", demokreditter uden værdi, RTP, ur og spilletid, StopSpillet.dk med telefonnummer, ROFUS, autospin med mindst 3 sekunder mellem resultater og stopbetingelser, reality check efter 30 minutter.

## Test

`Objekt.next({ board: [[...], ...] })` i browserkonsollen tvinger det næste spins bræt (kun til test af præsentation). `?seed=123` giver en deterministisk spinserie.
