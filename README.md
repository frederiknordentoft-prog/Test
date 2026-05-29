# Kabale Combo — prototype

En **spilbar, lokal prototype** af et kasino-kombinationsspil baseret på 7-kabale
(Klondike, draw-1). Spillerens dygtighed (færre talon-runder = større gevinst) og
tilfældighed (kortblanding + progressiv jackpot) indgår begge.

> **Prototype med spillepenge — ikke et rigtigt pengespil.** En demo til intern
> fremvisning og økonomi-eksperimentering i en ansvarligt-spil-kontekst.

## Kør den

```bash
npm install
npm run dev        # åbner Vite dev-server (typisk http://localhost:5173)
```

Andre scripts:

```bash
npm run build      # typecheck + produktionsbuild
npm run typecheck  # kun TypeScript-tjek
npm run sanity     # korrekthedstest af motor + solver (inkl. bevist minRounds)
npm run simulate -- [antal] [målRTP%] [nodeBudget] [tuneTo]   # økonomi-analyse på mix
```

Ingen backend. Saldo, indstillinger og jackpotpulje persisteres i `localStorage`.

## Sådan spiller du

- **Nyt spil** trækker en deal (som standard fra **naturligt mix**: ~80% løsbare,
  ~20% umulige) og hæver indsatsen. Løsbar-kun kan slås til i kontrolpanelet.
- Flyt kort med **klik-for-at-flytte** (klik kort → klik destination) eller **træk-og-slip**.
- **Dobbeltklik** sender det øverste kort direkte til sit fundament.
- **Træk fra talon** (klik på talonbunken) trækker ét kort. Når talonen er tom,
  genbruges den — det tæller en **runde** op.
- Løs hele kabalen for en gevinst der afhænger af **antal runder**.
- Hvis du **ikke** løser (giv op / for mange runder) får du en **tærskel-baseret
  progress payout**: 0 under tærsklen (default 70% af kortene på fundamentet),
  stigende mod et maks nær 100%.
- **Hint** fremhæver solverens næste fornuftige træk, **Fortryd** og **Giv op** virker.

## Arkitektur

```
src/
  engine/      # Klondike-regler: deal, lovlige træk, anvend træk, hash, runde-tælling
  solver/      # iterativ DFS + branch-and-bound (minimerer runder) + node-budget
               #   -> løsbarhed, hints, BEVIST minimum-runde-benchmark; player.ts (heuristik)
  economy/     # gevinsttabel, progressiv jackpot, session-statistik
  store/        # Zustand: configStore (tunbare parametre) + gameStore (spiltilstand)
  workers/     # solver-web-worker + klient + baggrundspulje af verificerede deals
  components/  # board, kort, kontrolpanel, dashboard, gevinst-overlay
```

Solver og deal-generering kører i en **web worker**, så UI'et aldrig fryser. Deals
forgenereres i en lille baggrundspulje, så et nyt spil ikke blokerer.

## Justerbare parametre (kontrolpanel, live)

| Parameter | Beskrivelse |
|-----------|-------------|
| Indsats (stake) | Pris pr. spil (default 10) |
| Gevinsttabel | Multiplikator pr. antal runder (1, 2, 3, 4, 5, 6+, tab). Egen tabel pr. mode |
| Kun løsbare deals | Til/fra — fra = naturligt mix (default), til = kun verificerede |
| Progress payout | Tærskel (0.70), maks (0.5× indsats), eksponent (1.0) for ikke-løste spil |
| Max runder | 0 = ubegrænset; ellers bust ved overskridelse |
| Fortryd-straf | Fortryd koster en ekstra runde (test RTP-effekt) |
| Jackpot-model | **A** (ren tilfældig på ethvert betalt spil) eller **B** (kræver løst spil) |
| Bidragssats | Andel af indsats der lægges i jackpotpuljen (default 6%) |
| Jackpot-seed | Puljen nulstilles hertil efter hit (operatør-finansieret) |
| Jackpot-odds | 1-ud-af-N (A: alle spil, B: blandt løste) |
| Solver node-budget | Søgegrænse for deals / hints |

## Økonomi & RTP

- **RTP styres af gevinsttabellen**, ikke af spillet. Mål: samlet RTP i båndet
  **93–99%**, og RTP ved optimalt spil **< 100%**.
- Dashboardet viser live **session-RTP**, **hit frequency**, **runde-fordeling**,
  og **skill-gabet** (din gennemsnitlige runder vs. solverens optimum).
- **Jackpot-regnskab** viser bidrag ind / seed ind / udbetalt som andel af
  samlet indsats, så man kan se at jackpot-RTP ≈ bidrag + seed (puljen er bevaret,
  ikke gratis penge).

> Gevinsttabellen er bevidst en **placeholder**. Simulér den faktiske
> runde-fordeling for løsbare deals og indsæt en tunet tabel bagefter.

## Determinisme

Hver deal har et **seed** (gemt på deal-objektet), så et spil kan genskabes —
vigtigt for demo og senere certificering. RNG: mulberry32.
