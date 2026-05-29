# Kabale Combo — projektopsummering (handoff til Claude chat)

> Denne fil er en selvstændig kontekst-opsummering. Giv den til en Claude-chat,
> så kan den hjælpe videre uden at kende kodebasen i forvejen.

## Hvad er projektet

En **spilbar, lokal prototype** af et kasino-kombinationsspil baseret på **7-kabale
(Klondike, draw-1)**. Spillerens dygtighed (færre talon-"runder" = større gevinst) og
tilfældighed (kortblanding + progressiv jackpot) indgår begge.

**Det er en demo med spillepenge — ikke et rigtigt pengespil.** Formålet er at *mærke*
gameplayet og *se økonomien* (RTP, volatilitet, jackpot) live, med alle parametre
justerbare. Det er IKKE certificeringsklar kode.

UI-tekst er på **dansk**; kode/kommentarer på engelsk. Brandfarver: gul `#F5B800`,
mørk flaskegrøn `#0E4E3A`. Typografi: Fraunces (overskrifter) + Inter (brødtekst).

## Tech stack

- **Vite + React + TypeScript + TailwindCSS + Zustand**. Ingen backend.
- State i hukommelse; **saldo, indstillinger og jackpotpulje persisteres i `localStorage`**.
- **Web worker** til solver + deal-generering, så UI'et aldrig fryser.
- Seedet RNG (mulberry32) → hver deal kan genskabes fra sit seed.

## Mappestruktur

```
src/
  engine/      # Klondike-regler (ren, deterministisk)
    types.ts       # CardId (0..51), GameState, Move, Pile, kort-helpers
    rng.ts         # mulberry32 seedet RNG + shuffledDeck
    klondike.ts    # deal, legalMoves, applyMove (immutabel), hashState, isWin, runde-tælling
  solver/
    solver.ts      # ITERATIV DFS (eksplicit stak) + transpositionstabel + node-budget
                   #   -> solve(): {status: solvable|unsolvable|unknown, solution, minRounds}
                   #   -> hint()
    dealgen.ts     # generér tilfældige / verificeret-løsbare deals
    player.ts      # menneske-lignende heuristik-spiller (til økonomi-simulering)
  economy/
    paytable.ts    # gevinsttabel (multiplikator pr. antal runder) + payout-beregning
    jackpot.ts     # progressiv jackpot, model A/B, localStorage, regnskab
    stats.ts       # session-statistik (RTP, hit-freq, runde-fordeling, skill-gab)
  store/
    configStore.ts # ALLE tunbare parametre (zustand), persisteret
    gameStore.ts   # spiltilstand, undo-stak, saldo, stats, jackpot, deal-pulje
  workers/
    solver.worker.ts  # worker-entry (generate/solve/hint/dealSeed)
    solverClient.ts   # main-thread klient + DealPool (baggrundspulje af verificerede deals)
  components/
    App.tsx, Board.tsx, Card.tsx, Toolbar.tsx, WinOverlay.tsx,
    ControlPanel.tsx, Dashboard.tsx, dnd.ts
scripts/
  sanity.ts      # korrekthedstest af motor+solver (npm run sanity)
  simulate.ts    # økonomi-simulering: optimal + spillermodeller -> RTP (npm run simulate)
```

## Sådan køres det

```bash
npm install
npm run dev        # Vite dev-server (typisk http://localhost:5173)
npm run build      # typecheck + produktionsbuild
npm run typecheck  # kun TS-tjek
npm run sanity     # motor/solver-korrekthedstest
npm run simulate -- [antal] [målRTP%] [nodeBudget] [tuneTo]   # økonomi-analyse
```

## Kerneregler / mekanik

- Standard Klondike, **draw-1**, ubegrænset (eller konfigurerbart max) genbrug af talonen.
- **"Runde"** = ét gennemløb af talonen. Starter på 1, tæller +1 hver gang talonen
  genbruges (waste → stock). Dette er **scoringsmetrikken**: gevinst = `stake × paytable[min(runder, 6+)]`.
- **Deal-mode (NY default = naturligt mix):** `solvableOnly = false`. Almindelige
  tilfældige deals deles (~80% løsbare / ~20% umulige), umulige inkl. Toggle slår
  løsbar-kun til. **Hver mode har sin egen gevinsttabel** (mix-tabellen er mere
  generøs, da de umulige deals holder optimal-RTP nede).
- **Udbetaling ved spil-slut:**
  - **Løst:** `stake × paytable[min(runder, 6+)]` (runde-paytable for den aktive mode).
  - **Ikke løst (giv op / max-runder):** TÆRSKEL-baseret **progress payout** ud fra
    `foundationFraction = kortPåFundament / 52`. 0 under `progressThreshold` (default
    0.70), stiger til `progressMax × stake` (default 0.5) nær 100%, kurveform via
    `progressExponent` (default 1.0). Tærsklen forhindrer et grind-exploit (nå ~50%
    og giv op). Erstatter den gamle binære `fail = 0`.
- Solveren leverer **minRounds** = **bevist minimum inden for søgebudget** (se solver
  nedenfor), vist som "du løste på X, optimalt var Y" + skill-gab i dashboardet.
  `minRoundsProven = false` markeres som advarsel når budgettet blev opbrugt.

## Gameplay-UI (færdigt)

- Klassisk board: 7 søjler, talon+waste, 4 fundamenter.
- **Klik-for-at-flytte** + **drag-and-drop** + **dobbeltklik → fundament**.
- Knapper: Nyt spil (= ny indsats), Fortryd (m. valgfri runde-straf), Hint (solver-fremhævning),
  Giv op. Runde-tæller, saldo, jackpot, pulje-status vises.
- Gevinst-overlay med multiplikator/beløb + evt. jackpot-animation.

## Kontrolpanel — alt er live-tunbart

indsats, gevinsttabel pr. runde (1/2/3/4/5/6+/tab — egen pr. mode), løsbar-kun/mix-toggle,
**progress payout (tærskel/maks/eksponent)**, max runder, fortryd-straf, jackpot-model
(A/B), bidragssats, jackpot-seed, jackpot-odds, solver node-budgets (deals/benchmark/hint),
pulje-mål, "nulstil indstillinger".

## Dashboard

saldo, session-RTP% + **opdeling i runde-RTP vs. progress-RTP**, hit frequency,
**deal-klassifikation (løsbare/umulige/ukendt-andele)**, antal spil/vundne, største
gevinst, indsat i alt, runde-fordeling (bar-graf), skill-gab (din ø. runder vs. optimal)
+ **advarsel når benchmark ikke er bevist optimalt** (node-budget opbrugt for N deals),
jackpot-regnskab (pulje, hits, spil-siden-hit, udbetalt) + **jackpot-RTP-opdeling:
bidrag/seed/udbetalt som andel af samlet indsats** (jackpot-RTP ≈ bidrag + seed).
Knapper: nulstil session, nulstil jackpot, +1000 spillepenge.

## Progressiv jackpot

- **Bidragssats** (default 6 % af hver indsats) lægges i puljen.
- **Seed** (default 5000): puljen nulstilles hertil efter hvert hit (operatør-finansieret).
- To udløsningsmodeller (valg i UI):
  - **A** (default, ren adskillelse): tilfældig udløsning på *ethvert* betalt spil, default 1/50.000.
  - **B**: kræver **løst spil OG** tilfældighedsfaktor, default 1/15.000 blandt løste.
- Persisteres i localStorage; vokser på tværs af sessioner.

## ⭐ Vigtigste økonomi-fund (fra `npm run simulate`)

> Bemærk: punkt 2–3 nedenfor beskrev det *oprindelige* binære design. Det er nu
> adresseret strukturelt med **naturligt mix + progress payout** (se ovenfor) — men
> den endelige RTP-balance afventer stadig rigtige spil-data / evt. fladere tabel.

**Solveren = optimal spiller. Runde-fordeling ved optimalt spil (på løsbare deals):**
ca. 7 % løst på 1 runde, **~53 % på 2**, ~27 % på 3, ~10 % på 4, ~3 % på 5, ~0 % på 6+.

1. **Den oprindelige placeholder-tabel `{1:5, 2:2, 3:1, 4:0.5, 5:0.2, 6+:0.2}` gav
   ~176 % optimal-RTP** → spillet var fuldstændigt slået. Den er erstattet med en tunet
   default: **`{1:2.7, 2:1.1, 3:0.55, 4:0.27, 5:0.11, 6+:0.11, fail:0}`** → optimal-RTP ≈ **96 %** (< 100 %, krav opfyldt).

2. **Det store, uløste designproblem:** en menneske-lignende heuristik-spiller **giver op
   på ~35 % af deals** (binær løst/ikke-løst, fail = 0). Det trækker estimeret *faktisk*
   RTP ned i **~50–65 %** — langt under mål-båndet **93–99 %**.

3. **Konflikt:** tuner man tabellen, så en gennemsnitsspiller får 96 % (1-runde → ~4×),
   eksploderer **optimal-RTP til ~144 %** → så kan spillet slås af dygtige spillere.
   Man kan altså IKKE samtidig opfylde "93–99 % for mennesker" og "<100 % ved optimalt
   spil" med den nuværende **binære** struktur + høje opgiv-rate.

4. **Forbehold:** heuristik-spilleren er grov (grådig, ingen lookahead). At "expert"
   løser *færre* end "casual" i simuleringen viser, at fejlrate-knappen ikke er et rent
   dygtigheds-mål. Stol på *strukturen* (høj opgiv-rate → RTP-konflikt), ikke de absolutte tal.

### Status på de tidligere løsningsretninger
- **A) Delvis udbetaling — IMPLEMENTERET** som tærskel-baseret progress payout (se mekanik).
- **Naturligt mix — IMPLEMENTERET** som ny default (de ~20% umulige deals holder
  optimal-RTP nede, så mix-tabellen kan være mere generøs).
- **B) Fladere gevinsttabel** — stadig en mulighed; tabellerne er fuldt live-tunbare.
- **C) Stærkere spillermodel** — ikke gjort; heuristikken er stadig en grov proxy.
- Endelig tuning bør ske mod **rigtige spil-data** (placeholder-karakter er bevidst).

## Solver-kontrakt (opdateret)

`solve(state, nodeBudget?, maxRoundCap?)` returnerer nu:
```ts
{ status: 'solvable'|'unsolvable'|'unknown';
  solution?: Move[];
  minRounds?: number;        // BEVIST minimum inden for budget (kun ved 'solvable')
  minRoundsProven: boolean;  // false hvis node-budgettet blev opbrugt -> kun øvre grænse
  nodesVisited: number; }
```
- **Iterativ (eksplicit stak), ingen rekursion** — den oprindelige rekursive DFS løb
  kaldestakken over på dybe søgestier (browseren maskerede det). Må ikke vende tilbage.
- **Minimerer runder** via branch-and-bound (behold bedste løsning, beskær grene der
  ikke kan slå den) + dominans-transpositionstabel (et bræt nået med færre runder
  dominerer samme bræt nået med flere). Når søgningen afsluttes uden at ramme budgettet,
  er `minRounds` et **bevist minimum** (`minRoundsProven = true`).
- At bevise minimalitet kræver at udtømme rum med færre runder → ofte kun bevist for
  små minRounds (typisk 2) inden for budget; default-budgetter hævet (deals 400k,
  benchmark 800k, hint 150k) og er tunbare. Resten markeres `minRoundsProven = false`.
- Verificeret i `npm run sanity`: løsninger når 52/52, runde-tælling matcher, og for
  beviste benchmarks giver `solve(..., minRounds-1)` ingen løsning (minRounds er minimal).

## Note om klassifikation/budget

Med moderat budget (fx 400k) klassificerer solveren mange deals som **"unknown"** frem
for at bevise (u)løselighed — så dashboard-andelene viser en del "ukendt". Hæv solver-
budgettet for skarpere klassifikation. `npm run simulate` kører nu på det naturlige mix
og rapporterer andelen `minRoundsProven` + RTP inkl. progress payout.

## Git / status

- Repo: `frederiknordentoft-prog/test`. Branch: `claude/kabale-combo-prototype-0YfHG`.
- Der blev oprettet en ren `main`-baseline; prototypen ligger som **pull request #1** mod `main`.
- Verificeret: `tsc --noEmit` rent, `npm run build` OK, `npm run sanity` OK, dev-server booter.
- **Ikke** verificeret i en rigtig browser (intet GUI i byggemiljøet) — visuel/interaktiv
  føling bør testes manuelt med `npm run dev`.

## Åbne spørgsmål til næste skridt

1. Hvilken løsningsretning på økonomi-konflikten (A/B/C ovenfor)?
2. Skal payout gøres progress-baseret (kort-på-fundament) i stedet for binær løst/tab?
3. Endelig gevinsttabel afventer rigtige spil-data — hvordan indsamles de?
