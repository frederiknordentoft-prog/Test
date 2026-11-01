# ØRE · prototype

Mobil sportsbook-prototype. Hver kamp vises som 100 simulerede fremtider, og en andel koster 0–100 øre. Alle kurser er fiktive, der er ingen backend og ingen rigtige penge.

Planen ligger i `docs/PLAN.md`. Research, konceptspec og kritik ligger også i `docs/`.

## Status: fase 0 (spike og look-dev)

- `#lookdev`: Fremtidsviften i tre varianter (A Lyn, B Langtid, C Spaghetti), vist i en mock af hele kampskærmen. Skift tidspunkt mellem 27′ og 70′, og tryk ▶ for at afspille med ét kampminut pr. sekund.
- `#spike`: diagnose af værten. Den tester worker (egen fil og blob), fonte, lyd, fps, CSP, ViewTransition, lager, canvas-ydelse og gestusser. "Kopiér rapport" giver en JSON, der kan sendes tilbage.
- Langt tryk på Ø viser debug-HUD'en.

## Kør

```bash
npm install
npm test
npm run build
node qa/f0.cjs
node qa/sheet.cjs
```

- `npm test` kører Vitest: rng, power-metode, DP, MC mod DP, at tally er lig pris, stabilitet og start ved ask.
- `npm run build` typechecker og bygger `dist/`.
- `qa/f0.cjs` kører CSP-iframe-harnesset, ydelsesmåling og screenshots i `qa/out/`.
- `qa/sheet.cjs` laver kontaktark af look-dev-screenshots.

## Fund fra F0 (headless Chromium)

| Område | Fund |
|---|---|
| Opaque-origin sandbox | Kun **klassiske blob-workere** virker. Module-workere, workere fra egen fil og `data:`-workere fejler. Workere bygges derfor som iife (`vite.config.ts`). Uden sandbox virker fil-workere også |
| CSP | 0 overtrædelser. Egne woff2-fonte indlæses via FontFace. Fallback til `data:`-URI findes |
| Lager | `localStorage` kaster SecurityError i sandkassen. Appen bruger det ikke |
| ViewTransition | Både React `<ViewTransition>` (19.3.1) og `document.startViewTransition` findes |
| Monte Carlo | 5.000 stier med pres pr. sti tager cirka 45–70 ms i worker eller hovedtråd |
| Lagbygning | Strand-laget tager cirka 7–20 ms (Langtid cirka 130 ms på grund af `getImageData`) |
| Long tasks | Ved 4× CPU er der stadig long tasks på 100–600 ms. Profilen viser native canvas-raster i software, fordi headless ikke har GPU. Det skal måles på telefonen |

Viften tegnes kun ved dataændring, i to stablede canvas med CSS-krydsfade. Det levende hoved er et DOM-element med CSS-animation, og der er intet rAF-loop i hvile.
