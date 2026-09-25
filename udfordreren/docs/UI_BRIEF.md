# UI-brief (fase 1-2) — til agenter, der bygger brugerfladen

Spillet er **Spilhuset: Udfordreren**: en Game Dev Story-agtig tycoon om en dansk spiludbyder, der starter i en garage i 2012.
Den fulde spec ligger i `docs/SPEC.md` (afsnit 2, 6 og 9 er vigtigst for UI). Læs `src/sim/types.ts` før du skriver kode.

## Mål for denne omgang
Fase 1 og 2 skal kunne **spilles og testes af et menneske** i browseren: garagen → kontraktopgaver → første produkt med
point-bobler → anmeldelse med fanfare → Top 10 → ansættelser, træning, rolleskift → kælder/kontor → kombinationsbog og niveauer →
2.0-versioner → Guldkupon/Hall of Fame → messer og Branchegallaen → anden vertikal → runder og kvartalsmål.
Det skal **føles som Game Dev Story**: tydeligt loop, små fejringer, klare tal, hurtigt at forstå.

## Arkitektur (låst)
- `src/sim/` er ren TS og deterministisk. **UI må aldrig ændre sim-filer eller `src/data/`.** Mangler du en afledt værdi, så skriv en ren hjælpefunktion i `src/ui/lib/`.
- Læs state: `const g = useGame((s) => s.game)!` (fra `src/store/gameStore.ts`). Vælg smalle selectors for at undgå rerenders.
- Send handlinger: `useGame.getState().dispatch(action)` → returnerer `true` ved succes. Afvisninger bliver automatisk til en rød toast (signal `fejl`), så UI behøver ikke selv vise fejlen, men **deaktivér knapper med en forklaring**, når en handling ikke kan lade sig gøre (brug selectors i `src/sim/selectors.ts`, fx `typeStatus`, `naesteRunde`, `kontorKrav`, `forskningStatus`, `lanceringsStatus`).
- Alle `Action`-typer står i `src/sim/types.ts`. Nyttige selectors står i `src/sim/selectors.ts`.
- Tidsloopet (`src/ui/hooks/useGameLoop.ts`) kalder `stepUge()`. Signaler fra seneste step ligger i `useGame((s) => s.sidsteSignaler)` (bruges til bobler/juice). Signaler, der kræver en dialog, kommer i kø i `useGame((s) => s.dialoger)` og vises af `DialogHost` i `GameScreen.tsx` via `src/ui/dialogs/registry.tsx`.
- Brugeråbnede dialoger: `useUi.getState().aabn({ kind: 'nytProdukt' })` osv. (se `UiDialog` i `src/store/uiStore.ts`). Luk med `onLuk`.
- Render-tidsur til interpolation: `clock` i `gameStore.ts` (`sidsteTickMs`, `ugeMs`, `tick`).

## Designsystem
- Tokens i `src/index.css` (`bg`, `bg2`, `panel`, `panel2`, `line`, `hi`, `ink`, `muted`, `dim`, `gold`, `cyan`, `pink`, `good`, `bad`, `warn`, `violet`, `sky`) → brug som Tailwind-klasser (`bg-panel`, `text-gold`, `border-line` …) eller `var(--color-gold)`.
- Faste farvebetydninger: **penge = gold**, **indsigt = cyan**, **hype = pink**, **kunder = sky**, godt = good, dårligt = bad.
  Parametre: **Spænding = pink**, **Originalitet = violet**, **Teknik = sky**, **Tryghed = good**; **Fejl = bad**.
- Komponenter i `src/ui/components/kit.tsx`: `Btn`, `Panel`, `Bar`, `Stat`, `Badge`, `Monogram`, `Modal`, `Faner`, `Skyder`, `Tom`, `Tip`, `Ikon` (8×8 pixel-ikoner — tilføj gerne flere ikoner i kit.tsx, men ret ikke eksisterende API'er).
- Formatering i `src/ui/format.ts` (`mio`, `mioKort`, `heltal`, `pct`, `fortegn`).
- **Ingen emoji og ingen eksterne assets** (ingen billeder, fonte eller CDN'er). Grafik er procedural (canvas/SVG/CSS).
- Markeringer bruger **ikon + farve** (aldrig kun farve).
- Touch-mål mindst 44 px (`Btn` er 44 px høj; `lille` er 36 px — brug kun `lille` i tætte lister på desktop).
- Konkurrenter vises som farvede **monogrammer** (`Monogram` + `ejerInfo(s, ejer)`), aldrig logoer.
- Layout skal virke på **1440 px (laptop)**, **1024 px (iPad landskab)** og **390 px (mobil portræt)**. Ingen vandret scroll på siden.
- Respektér `settings.reduceretBevaegelse` (og `prefers-reduced-motion`): ingen rystelser/konfetti, kortere animationer.

## Sprog og tone
- Al tekst er **dansk**. Korte, venlige, lidt humoristiske Game Dev Story-tekster. **Aldrig moraliserende.**
- Fristelser (bonus, VIP, høj intensitet) skal være fristende, men prisen skal være synlig.
- **Rigtige firmanavne er forbudt i hele `src/`** undtagen `src/data/archive.ts`. Brug kun parodinavnene fra `src/data/competitors.ts`.
  Lande og myndigheder (Spillemyndigheden, ROFUS osv.) må gerne være rigtige.

## Testbarhed (Playwright senere)
- Sæt `data-testid` på vigtige elementer: knapper til handlinger (`nyt-produkt`, `lancer-<projectId>`, `boost-<param>`, `tag-kontrakt-<id>`, `ansaet-<kandidatId>` …), dialoger (`dialog-<kind>`), hitlisten (`top10`), rækker (`top10-raekke-<placering>`).
- Eksisterende testids må ikke omdøbes.

## Verifikation (før du melder færdig)
1. `npm run typecheck && npm run lint && npm run build` i `udfordreren/` — dine filer skal være fejlfri. (Andre agenter arbejder samtidig i andre filer; ret kun fejl i dine egne filer, og ignorér midlertidige fejl i andres.)
2. Start din egen dev-server på din tildelte port (`npx vite --port <PORT> --strictPort`) og brug Playwright (`/home/user/Test/udfordreren/node_modules/playwright`, `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`) til at spille dine flows og tage screenshots i 1440×900, 1024×768 og 390×844. Se på dem (Read-værktøjet viser billeder). Ingen konsolfejl.
   Tip: `?debug=1` i URL'en giver en debug-knap; `useGame.getState()` kan ikke nås udefra, så spil via UI'et (eller brug `page.evaluate` på `window.__udfordreren` hvis den findes).
3. Commit ikke — lederen committer.

---

## Fase 3: markeder, regulering og offshore (nyt i sim-kernen)

- **Alle 9 markeder** findes i `game.markeder`. De åbner på deres rigtige datoer (`MARKETS[m].aabnerUge` i `src/data/markets.ts`; `ms.aaben`, `ms.aabnetUge`). Norge åbner aldrig (monopol) — kun gråt via offshore-brand.
- **Licens pr. marked og vertikal:** `applyLicense { market, vertical }` virker i alle åbne markeder. Brug `licensStatus(s, m)` og `licensPris(s, m)` til knapper og forklaringer. `ms.licens` kan være `ingen | ansoegt | aktiv | suspenderet | inddraget`.
- **Produkter i flere markeder:** `startProject.project.markeder` kan indeholde alle markeder, hvor vertikalen er søgt/aktiv. Hitlisten findes pr. åbent marked (`ms.top10`, rangeret efter `nyeSpillerePrUge[m]`).
- **MarketState-felter:** `regler` (aktive regel-id'er → `REGLER` i `src/data/regulationTimeline.ts`, beskrivelse via `regelBeskrivelse(id)`), `blokering`, `selvudelukkede`, `sanktion { trin 0-4, roligeKvartaler }`, `suspenderetTil`, `offshore { betting, kasino }`, `kanalisering`, `politiskPres` (0-5, ≥ 3 → ny regel), `afgiftTillaeg` (pp), `offshoreBrandBsiPrUge`.
- **Kommende regler:** `game.planlagteRegler` (`marked`, `regelId`, `ikrafttraedelseUge`, `dynamisk`).
- **Effekter pr. marked:** `regelEffekt(s, m)` (CAC-tillæg pr. kanal, lukkede kanaler, bonus-/VIP-loft, BSI-ændring pr. vertikal), `effektivBonus/effektivVip(s, m)`, `effektivCac(s, kanal, m)`, `strenghedCac/strenghedArpu`.
- **Tilsynstillid og sanktioner:** `tillidsPoster(s, m)` forklarer kvartalets ændring. Trappen: `SANKTION_NAVN[trin]`, grænser via `sanktionsGraense(trin)` (55/40/25/10). Tabt dansk licens koster −15 i alle andre markeder.
- **Offshore:** `ms.offshore`, `ms.kanalisering`; formlen i `src/sim/offshore.ts` (`offshoreDynPp`) — vis gerne hvad der driver den (afgift, strenghed, bonusloft, selvudelukkede, blokering, licenseret kvalitet, trends).
- **Offshore-fristelsen:** handling `setOffshoreBrand { aktiv }` (2 mio. i opstart, se `OFFSHORE_BRAND` i `src/data/offshore.ts`); grå BSI i `ms.offshoreBrandBsiPrUge`; −10 tilsynstillid pr. kvartal i alle markeder; 10 %/år risiko for at alle licenser inddrages (eventet `offshoreAfsloeret`). Prisen skal være tydelig.
- **Trends og sportskalender:** `game.trends` (aktive, med `titel`, `effekt`, `slutUge`, `markeder`), `trendEffekt(s, m)`; faste datoer i `SPORTSKALENDER` og `FASTE_TRENDS` (`src/data/trends.ts`).
- **Nye signaler:** `markedAabner {marked}` (dialog + pause), `regel {marked, regelId, varsel}` (dialog: "på vej" eller "træder i kraft"), `sanktion {marked, trin, boede?}` (dialog + skærmryst via `rystelse()` fra `src/render/particles.ts`, respektér reduceret bevægelse), `trend {id, titel}` (toast; vis aktive trends i HUD'en eller "I sigte").
