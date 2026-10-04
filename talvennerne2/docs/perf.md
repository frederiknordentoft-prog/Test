# Ydelse ved frigivelsen af Hestebakkerne og Regnbueskoven (QA2 P3-16)

QA2 målte på dev-serveren (React i dev-tilstand) på en maskine under last og bad om en måling af prod-buildet, når verdenerne frigives (`docs/reviews/app-w2-r1.md`, P3-16). Det er gjort her, den 4/10, på den version der ligger live.

- **Build:** live-kopien af `talvennerne2/` (overview 0f40379, byte-identisk med `dist/` fra b883aad), og igen efter rettelsen af importen (dcda944).
- **Krav (SPEC §15.2):** ved 4× CPU-throttle har opgaveskærmen p95 ≤ 20 ms, og albummet (Dyrehaven) ≥ 50 fps. Ingen skærm har over 1.500 SVG-elementer.
- **Afvikling:** Chromium (headless) med fingre (CDP-touch), `Emulation.setCPUThrottlingRate` = 4, telefon 393 × 852 og iPad 1180 × 820, `deviceScaleFactor` 2. Maskinen var ledig (ingen agenter og ingen stemmeindspilning).
- **Måling:**
  - billedtid er tiden mellem to `requestAnimationFrame`,
  - lange opgaver kommer fra `PerformanceObserver('longtask')`.

  Throttlingen gælder hovedtråden, ikke GPU'ens rasterisering.
- **Gang:** barnet onboardes med fingeren som en rigtig førstegangsbruger. Svarene er tilfældige tryk, så både fejringen og strategien efter en fejl kommer med; derfor er turene lange.

## Resultat

**Begge krav holder med god margin.**

| Måling | Format | Billeder | p95 | p99 | Maks. | Over 20 ms | Lange opgaver |
|---|---|---|---|---|---|---|---|
| Engdalen, første tur (59 svar) | telefon | 17.165 | 16,8 ms | 16,8 ms | 100 ms | 0,9 % | 58 (p50 65 ms, maks. 105 ms) |
| Hestebakkerne `w1-tal100-l1` (85 svar) | telefon | 24.928 | 16,8 ms | 16,8 ms | 100 ms | 0,9 % | 87 (p50 66 ms, maks. 105 ms) |
| Regnbueskoven `w2-tal1000-l1` (50 svar) | iPad | 14.219 | 16,8 ms | 16,8 ms | 117 ms | 0,8 % | 49 (p50 65 ms, maks. 97 ms) |
| Engdalen, første tur efter rettelsen (29 svar, hele turen + fejring) | telefon | 6.948 | 16,8 ms | 33,3 ms | 100 ms | 1,1 % | 36 (p50 66 ms, maks. 97 ms) |

| Dyrehaven med 60 dyr, scroll med fingeren | Format | Billeder/s | p95 | Maks. | Lange opgaver |
|---|---|---|---|---|---|
| 3 × ned og 3 × op | telefon | 59,9 | 16,8 ms | 33 ms | 0 |
| 3 × ned og 3 × op | iPad | 60,0 | 16,7 ms | 16,8 ms | 0 |
| Igen efter rettelsen | telefon | 59,8 | 16,8 ms | 33 ms | 0 |

- **Afslutningen af turen** (fejringerne) holdt 60 billeder/s uden lange opgaver.
- **SVG-elementer:** højst 261 på de målte skærme (Dyrehaven med 60 dyr: 3 animerede dyr, resten som billeder).
- **Konsolfejl:** ingen.

## Fund

1. **Én lang opgave pr. svar.** Hvert svar giver én lang opgave på ca. 65 ms ved 4× throttle (maks. 117 ms), altså ca. 16 ms uden throttle. Det er 3–5 tabte billeder lige når fejringen eller strategien starter. På en rigtig iPad er det nok 1–2 billeder. Det er inden for kravet, men det er det sted, hvor en ydelsesrunde giver mest.
   - **Næste skridt:** profilér, hvad der kører synkront ved et svar: `recordAnswer` (mestring og misforståelser), skrivekøen, gengivelsen af tur-skærmen og oplæsningen. Udskyd det, der ikke skal ses i første billede.
2. **"Erstat …s data" mistede importen.** Fundet under målingen af Dyrehaven og rettet i beb4e59 (live i dcda944).
   - Efter en erstat-import af det aktive barn viste appen det gamle barn. Næste skrivning lagde det gamle barn tilbage over importen: i prod blev 60 dyr til 1, efter at et emne var slået fra og til. Bekræftelsen forsvandt også, og siden hoppede til toppen.
   - Årsag: profilen var `null` under importen. Dashboardets auto-valg indlæste derfor det gamle barn, før importen var skrevet, og `selectProfile` kortsluttede bagefter.
   - Nu dropper `useProfile.replaceLoaded` barnets skrivekø, skriver intet for barnet undervejs og indlæser den gemte profil på stedet.
   - Dækket af to tests i `src/state/useSession.data.test.ts` (den første fejler før rettelsen) og af erstat-trinnet i dashboardets e2e. E2e'en fejlede med 3 tjek før rettelsen.
   - Efter deploy er det tjekket på live-kopien: bekræftelsen står, Dyrehaven viser 60 dyr uden genindlæsning, og databasen beholder dem efter en ændret indstilling.

## Gentag målingen

```
npm run build
flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs                       # Engdalen, første tur, telefon
WORLD=bakke flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs           # Hestebakkernes første åbne sten
WORLD=skov VP=ipad flock /tmp/tv2-chromium.lock node scripts/perf/round.mjs    # Regnbueskoven på iPad
flock /tmp/tv2-chromium.lock node scripts/perf/zoo.mjs                         # Dyrehaven med 60 dyr (VP=ipad for iPad)
```

- `DIST=<mappe>` måler en anden kopi, fx filerne hentet tilbage fra live-sitet (A7).
- `MINUTES` begrænser en tur (standard 5).
- Resultaterne og skærmbillederne havner i `artifacts/perf/` (git-ignoreret).
