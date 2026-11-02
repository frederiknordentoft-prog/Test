# UDFALD · prototype

Mobil sportsbook-prototype. Hver kamp vises som 100 simulerede fremtider. Prisen er en **kurs** fra 0 til 100, ligesom en obligation: kurs 55 betyder, at en andel koster 55 øre og betaler 1 kr, hvis udfaldet sker. Kursen ligger lige over chancen (54 %), fordi husets andel ligger oveni. Appen hedder UDFALD, fordi det, man køber, er et udfald. Alle kurser er fiktive, der er ingen backend og ingen rigtige penge.

Planen ligger i `docs/PLAN.md`. Research, konceptspec og kritik ligger også i `docs/`.

## Skærme

| Hash | Indhold |
|---|---|
| `#lobby` | To levende kort (derbyet og hallen), demo og portefølje |
| `#kamp` | FCK–Brøndby, fri kamp med naturlige mål |
| `#demo` | Den scriptede derby på cirka 85 s. En spøgelsestommel udfører gestusserne |
| `#byg` | Byg en fremtid: 2–3 ben filtrerer de 100 fremtider |
| `#maal` | Mål og slutresultat: 6 × 6 slutresultater, regioner og Over/Under 0,5–4,5 |
| `#pulje` | Parken-puljen: pulje på 1X2 mod et simuleret publikum, lukker ved pausen |
| `#portefolje` | Positioner, købsgrænser, sikring, pulje og afsluttede kontrakter |
| `#afregning` | 1X2-floden, dine handler, regnskab og træk-karakterer |
| `#hallen` | Aalborg–GOG som oscilloskop med trigger |
| `#demo-hallen` | Hallen fra 38′, hvor Aalborg går fra +1 til +4 |
| `#spike` | Diagnose af værten (worker, fonte, lyd, fps, CSP, gestus) |

**På kampskærmen:**
- Langt tryk på logoet åbner instruktørpanelet med mål, VAR, rødt kort, hval og hastighed.
- Langt tryk i viften sætter en købsgrænse.
- Hold på en udfaldsflise for hurtigkøb. Glid op for at købe.
- Tryk på etiketten over kursen for at skifte fokus: FCK → X → BIF → Over 2,5. Chippen "Over 2,5 · kurs N" under Målvejret går direkte dertil.
- "Sikring" på positionskortet sætter stop-loss og "Sikr gevinst" (kun 1X2 og Over 2,5, de kontrakter der har en linje i viften).
- Bundbjælken: Byg · Mål · Pulje · Portefølje. Lobbyen nås via chevronen øverst.

## Arkitektur

**`src/engine/`** er ren TypeScript og deterministisk. Tilstand = f(seed, tidslinje, substep).
- `football/`: simulation, DP-prissætter og visningslag.
- `market/`: ligger i `sim.ts`.
- `mc/`: Monte Carlo med worker-klient.
- `book/`: portefølje, sikring (stop-loss / take-profit) og pulje-regnskab.
- `handball/`: håndboldmotoren.
- `director/`: tidslinjer.

**`src/state/`:** `MatchStore` og `HallenStore`, med realtidsloop, ordrer og afregning. `focus.ts` samler alt om det fokuserede kontrakt (1X2-udfald eller Over 2,5) i én `FocusSpec`, som viften, hovedet, baren og bakken læser.

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
- Mål i alt og slutresultat: gitteret summerer til 1, gitterets 1X2 er lig `price1x2`, Over er lig `totalsBack`, MC inden for 2 pp, in-play-kalibrering af Over 2,5 og golden hashes for 1X2-simulationen.
- Bogen (inkl. sikring og pulje), håndbold, hele demoen og de nye funktioner gennem storen på et virtuelt ur.

**`npm run build`:** typecheck plus `dist/`.

**`node qa/qa.cjs`** kører Playwright i et cross-origin iframe-harness med artifact-lignende CSP:
- værtsparitet, CSP og fonte
- ydelse ved 1× og 4× CPU
- at rammen står stille under et mål, både med 1X2- og Over 2,5-fokus
- de nye funktioner gennem UI'et: Over 2,5-chippen, sikring, puljen og et slutresultat
- at udbetalingen er synlig, og at køb går gennem prislåsen
- reduceret bevægelse
- axe på alle skærme, også `#maal`, `#pulje` og sikringsbakken
- screenshots ved 664, 744 og 844 px, plus Over 2,5-viften, Mål og Pulje ved 664 og 844 px
- demoen fra start til slut i realtid

Statistiske tests bruger et rolldown-bundt af motoren (`tests/setup/bundle.ts`), fordi Vitests TS-transform gør de varme løkker cirka 8 gange langsommere end den rigtige app.

## Rapporten

`docs/UDFALD-rapport.pdf` beskriver spillet og de nye mekanismer i detaljer, med screenshots. Del I er til alle, Del II er maskinrummet, og bilagene har ordliste, kontraktnøgler og konstanter. Kilderne ligger i `docs/rapport/`. Alle tal om kampen og alle billeder fra derbyet kommer fra én deterministisk kørsel (`docs/rapport/scripts/story.js`), som både node og browseren afspiller, og browserens handler skal matche node-kørslen handel for handel.

```bash
npx vitest run
node docs/rapport/scripts/data.mjs
node docs/rapport/scripts/mc20.mjs
node docs/rapport/scripts/shoot.cjs
python3 docs/rapport/scripts/fakta.py
node docs/rapport/build.mjs
python3 docs/rapport/scripts/verify.py
```

## Kalibrering (målt)

**Fodbold:**
- 2,65 mål pr. kamp, og FCK vinder 46 %.
- In-play fair-pris pr. decil ligger inden for cirka ±3 pp af den faktiske frekvens.
- MC og DP afviger i gennemsnit 0,4 pp.
- Over 2,5 in-play pr. decil: alle deciler inden for 1,3 pp. Ved kickoff ligger DP'en 0,8 pp lavt (47,3 % mod 48,1 %), fordi den ignorerer excitationen fra mål, der endnu ikke er scoret.
- Puljen: en krone på en hvilken som helst side før pausen giver højst 0,95 kr igen i forventning (strukturelt ≤ 0,9 · 1,035 / 0,985 ≈ 0,946).

**Håndbold:**
- 61,8 mål pr. kamp.
- σ = 0,654/√min, analytisk og simuleret inden for 1 %.
- Triggerpriser ligger inden for 1,6 pp af MC.
