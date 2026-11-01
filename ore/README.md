# ØRE · prototype

Mobil sportsbook-prototype. Hver kamp vises som 100 simulerede fremtider, og en andel koster 0–100 øre. Ved slutfløjt er hver andel 1 kr eller 0 værd. Alle kurser er fiktive, der er ingen backend og ingen rigtige penge.

Planen ligger i `docs/PLAN.md`. Research, konceptspec og kritik ligger også i `docs/`.

## Skærme

| Hash | Indhold |
|---|---|
| `#lobby` | To levende kort (derbyet og hallen), demo og portefølje |
| `#kamp` | FCK–Brøndby, fri kamp med naturlige mål |
| `#demo` | Den scriptede derby på cirka 85 s. En spøgelsestommel udfører gestusserne |
| `#byg` | Byg en fremtid: 2–3 ben filtrerer de 100 fremtider |
| `#portefolje` | Positioner, købsgrænser og afsluttede kontrakter |
| `#afregning` | 1X2-floden, dine handler, regnskab og træk-karakterer |
| `#hallen` | Aalborg–GOG som oscilloskop med trigger |
| `#demo-hallen` | Hallen fra 38′, hvor Aalborg går fra +1 til +4 |
| `#spike` | Diagnose af værten (worker, fonte, lyd, fps, CSP, gestus) |

**På kampskærmen:**
- Langt tryk på Ø åbner instruktørpanelet med mål, VAR, rødt kort, hval og hastighed.
- Langt tryk i viften sætter en købsgrænse.
- Hold på en udfaldsflise for hurtigkøb. Glid op for at købe.

## Arkitektur

**`src/engine/`** er ren TypeScript og deterministisk. Tilstand = f(seed, tidslinje, substep).
- `football/`: simulation, DP-prissætter og visningslag.
- `market/`: ligger i `sim.ts`.
- `mc/`: Monte Carlo med worker-klient.
- `book/`: portefølje.
- `handball/`: håndboldmotoren.
- `director/`: tidslinjer.

**`src/state/`:** `MatchStore` og `HallenStore`, med realtidsloop, ordrer og afregning.

**`src/render/`:** viftens canvas-lag (geometri, stier og live-lag) og lyden.

**`src/ui/`:** React-skærme. React opdateres højst 4 gange i sekundet, og canvas tegnes imperativt.

**Build:**
- Workere bygges som klassiske iife-filer. I en opaque-origin sandbox kører kun klassiske blob-workere.
- Fonte self-hostes med `data:`-fallback.
- Ingen storage-API'er. Kun rene `#navn`-ruter.

## Kør

```bash
npm install
npm test
npm run build
node qa/qa.cjs
```

**`npm test`:**
- Motoren: determinisme, kalibrering af mål og priser, kvote-sum og VAR.
- Monte Carlo: MC mod DP, at tally er lig pris, stabilitet og Byg.
- Bogen, håndbold og hele demoen på et virtuelt ur.

**`npm run build`:** typecheck plus `dist/`.

**`node qa/qa.cjs`** kører Playwright i et cross-origin iframe-harness med artifact-lignende CSP:
- værtsparitet, CSP og fonte
- ydelse ved 1× og 4× CPU
- at rammen står stille under et mål
- at udbetalingen er synlig, og at køb går gennem prislåsen
- reduceret bevægelse
- axe
- screenshots ved 664, 744 og 844 px
- demoen fra start til slut i realtid

Statistiske tests bruger et rolldown-bundt af motoren (`tests/setup/bundle.ts`), fordi Vitests TS-transform gør de varme løkker cirka 8 gange langsommere end den rigtige app.

## Kalibrering (målt)

**Fodbold:**
- 2,65 mål pr. kamp, og FCK vinder 46 %.
- In-play fair-pris pr. decil ligger inden for cirka ±3 pp af den faktiske frekvens.
- MC og DP afviger i gennemsnit 0,4 pp.

**Håndbold:**
- 61,8 mål pr. kamp.
- σ = 0,654/√min, analytisk og simuleret inden for 1 %.
- Triggerpriser ligger inden for 1,6 pp af MC.
