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

## Fase 4: levende konkurrenter og platforme (nyt i sim-kernen)

- **Konkurrenter:** `game.konkurrenter` (id, navn, arketype, markeder, vertikaler, styrke, aggressivitet, innovation, opkoebslyst, compliance, `tilstede`, `ejetAf`, `sidsteHandling` = "hvad de gjorde sidst"). Monogram og farve via `ejerInfo(s, id)`. Deres produkter er `game.produkter` med `ejer === id`.
- **Reaktioner (R1-R12):** `game.reaktioner` (aktive effekter med `regel`, `competitorId`, `marked`, `slutUge`, `effekt`, `tekst`), `game.reaktionsTaeller`. Forklaringer i `REAKTIONS_REGLER` (`src/data/reactionRules.ts`: navn, hvis, så). Nyttige selectors: `konkurrentMarketing(s, id, m)`, `spillerCacTillaeg(s, m)`, `aggressivitet(s, c)`, `featureFordel(s)`.
- **Opkøb:** `acquire { competitorId }` med `opkoebStatus(s, c)` (pris, grund). Kun mindre konkurrenter.
- **Opkøbstilbud:** `game.opkoebstilbud { competitorId, pris, udloeberUge }`. Handlinger `acceptOffer { competitorId }` (slutter spillet som exit) og `afvisTilbud` (byderen bliver mere aggressiv i to år). Signal `tilbud` → dialog + pause.
- **Sponsorater (R7):** `game.sponsorAuktion` (navn, marked, afgoeresUge, mindstebud pr. år, spillerBud, varighedUger) og `game.sponsorater` (ejer, bud, slutUge). Handling `bydSponsorat { bud }`. Signal `sponsorAuktion` → dialog + pause; `sponsorResultat` → toast. Vundet sponsorat: `sponsorRabat(s, m)` (30 % CAC-rabat på sponsoratkanalen).
- **Platforme (6.12):** `game.platforme[kind]` for `kontoplatform | sportsbook | kasinoplatform` (model, kvalitet, dataejerskab, b2bKunder, `migrererTil`, `migreringStartUge`, `migreringFaerdigUge`, `sidsteB2bUge`). Modeller i `PLATFORM_MODELS` (capex, uger, revenue share, kvalitetsloft, dataejerskab). Handling `choosePlatform { kind, model }` med `platformStatus(s, kind, model)`; vælg den nuværende model under en migrering for at afbryde (halv refusion). `sellPlatformB2B { kind }` med `b2bStatus(s, kind)`; `game.b2bIndtaegtPrUge`. `platformKvalitet(s, kind)` er lavere under migrering. `revenueShare(s, v)`.
- **Signaler:** `reaktion` (dialog kun for R1 bonuskrig og R8 påbud; ellers toast), `tilbud`, `sponsorAuktion`, `sponsorResultat`, `platform { kind, model, faerdig }`, `opkoeb`, `konkurrentNyhed { tekst, arkivId? }` (historiske konkurrenttiltag).
- **Konkurrentoversigt** (DoD): profil, markeder, bedste produkt og "hvad de gjorde sidst" + nyhedstickeren, hvor reaktioner vises med forklaring.

## Fase 5: spillerbyen og AI-akten (nyt i sim-kernen)

- **Akt-skiftet (uge 728 = 2026):** flaget `aktTo`, `AI_AKT_UGE` i `src/sim/time.ts`. Signal `aktSkift { scenarier, vurderinger }` → dialogen **"Verdensbilledet 2026"**: vis alle `VERDENSSCENARIER` (navn, sandsynlighed, tekst, effekt) og markér de trukne (`game.verdensscenarier`), samt `VERDENSVURDERINGER` (trukket hvis `game.verdensVurderinger[id]` findes; værdien er ugen). AI-laboratoriet åbner. Resten af spillet skal føles anderledes (ugen varer 6 sek.).
- **Verdensnyheder:** signal `verdensNyhed { id, titel, tekst }` → dialog + pause (højesteret i USA, den store skandale, Norge åbner, AI-krav, EU-harmonisering).
- **AI-laboratoriet** (nyt panel, låst før 2026 med en teaser): `game.agenter` (navn, funktion, kapacitet, computePrUge, fejlrate, overvaagning, uheld). Definitioner i `AGENTER` (`src/data/ai.ts`: navn, beskrivelse, faser, erstatter). Handlinger: `deployAgent { funktion, overvaagning }` (status via `agentStatus(s, f)`: pris, compute, grund), `retireAgent { agentId }`, `setOvervaagning { agentId, overvaagning }` (0-1 i trin af 0,1; lav overvågning = billigere, men flere AI-uheld; vis `fejlrate(f, o)`). `maxAgenter(s)`, `dataFaktor(s, f)` (0 under 0,3 dataejerskab — vis en tydelig advarsel), `agentEffekt(s)` (ARPU, churn, indhold, tillid, byBeskyttelse, compute, overvågningsløn), `menneskeligtTilsyn(s)`. Regnskabet har `regnskab.compute`.
- **Agenter i projektfaser:** udviklings-, indholds- og trading-agenter kan tildeles faser via `assignPhase` (id'erne i `faseTildeling` kan være agent-id'er). `ledigeAgenter(s, p, fase)` giver de mulige. Point-signaler for agenter har `staffId = agent.id` → tegn dem som glødende terminaler.
- **AI-scenarier:** `game.aiScenarier[id]` (styrke 0-1) for `AI_SCENARIER` (navn, mekanik, vinder, taber). `aiMarkedsEffekt(s, m)` forklarer effekten på jeres BSI/churn. Signal `aiScenarie` → toast.
- **Fristelsen hyperpersonalisering:** `setHyperpersonalisering { aktiv }` med `hyperStatus(s)`; `game.hyperpersonalisering`. +5-10 % BSI pr. kunde, men byen bliver rød uden en risikoagent med høj overvågning. Prisen skal være synlig.
- **AI-transformation:** `aiTransformation { andel: 0.25 | 0.5 }` med `transformationStatus(s, andel)` (antal, pris) og `transformationsKandidater(s)`. Lavere lønninger, tab af indsigt og et omdømme-event. `game.transformation`.
- **Børslicens (kun under prediction market-omvæltningen):** `applyBoersLicens` med `boersStatus(s)`; `game.boerslicens`.
- **Agent-API:** kanalen `aiAgentApi` (fra 2028, kræver forskningen "Agent-API" og dataejerskab ≥ 0,6).
- **Spillerbyen (6.14)** (nyt panel eller fane): `game.by` — 200 personer med `x, y` (0-1), `profil` (`rekreativ | engageret | vip | risiko | problem | churnet`), `vaerdi`, `eksponering` (−1 = forsvandt stille ved selvudelukkelse; tegn den ikke), `marked`. Ikon + farve: **VIP = guld**, **risiko = gul**, **problem = rød**, rekreativ/engageret i neutrale toner; `churnet` vises ikke (eller som svage silhuetter). `byTal(s, m?)`, `risikoAndel(s, m?)`, `byDrivere(s, m)` (skade vs. beskyttelse), `byTillid(s, m)`, `byArpuFaktor(s, m)`. Byhistorier i `game.byHistorier` (korte og respektfulde) og signal `byhistorie` → toast. Filtrér pr. marked.
- **Ansvarsforskning:** nye noder i `RESEARCH` (Tidlig intervention, Affordability-tjek; AI-noder fra 2026 med `laaser`).
- **Andre signaler:** `agent { agentId, funktion, handling }` (toast), `transformation { erstattet }` (toast; eventet `aiTransformationDebat` kommer som dialog).

## Fase 6: slutninger, eftertanke, New Game+ og Arkivet (nyt i sim-kernen)

- **Slutningen:** `game.slut = { id, vaerdi, eftermaele, stifterVaerdi, uge }`. `id` er en af `SLUT_IDS` (`src/data/endings.ts`: `SLUTNINGER[id]` har titel, tekst og tone). Signal `slut` åbner slutskærmen.
- **Slutskærmen** (spec 6.17) skal vise:
  - slutningens titel og tekst, selskabsværdi, stifternes værdi og eftermælet med dets seks dele (`eftermaele(s)` i `src/sim/endings.ts`: navn, point, maks, forklaring);
  - en **tidslinje** over produkter, markeder, runder og valg: `game.tidslinje` (uge, tekst, kind: produkt | marked | firma | pris | ai | verden | krise) — gerne som en vandret tidslinje med år og ikoner;
  - **trofæhylden**: Guldkuponer og Hall of Fame (`produkter` med `guldkupon`/`hallOfFame`), gallapriser (`game.galla`), milepæle (`game.milepaele`);
  - **byens udvikling**: `game.byAarlig` (andele pr. år: rekreativ, engageret, vip, risiko, problem) som et lille stablet søjlediagram;
  - **eftertanke**: tre kort fra `eftertanke(s)` (titel, tekst, arkivId), hvert med et link, der åbner Arkivets opslag.
  - Knapper: "Nyt spil", "New Game+" (arver kombinationsbogen og niveauerne via `arvFra(s)` i `src/sim/newgameplus.ts`) og de to modes, der låses op, når man har afsluttet et spil: "2018-start i USA" (`mode: 'usa2018'`) og "AI-native fra 2026" (`mode: 'aiNative2026'`). Start dem med `nytSpil({ ...opts, mode, arv })`. Gem arven og de ulåste modes i Dexie-indstillingerne, så de huskes mellem spil.
- **Arkivet** (spec 6.18): nyt panel eller en dialog med opslagene i `ARKIV` (`src/data/archive.ts` — det ENESTE sted med rigtige navne; UI'et må kun vise teksten derfra, aldrig skrive navnene selv). Ulåste opslag står i `game.arkiv`; låste vises som "???" med en hint. Nyheder med `arkivId` kan klikkes og åbne opslaget (`arkivId(id)` oversætter konkurrenternes id'er). Arkivet kan slås fra i indstillingerne (`settings.arkiv`).
- **Debug-menuen** (`?debug=1`, spec 6.20) skal også kunne: vise seed, hoppe til år, sætte kapital, indsigt og tillid, udløse et event (`udloesEvent`) eller en konkurrentreaktion, åbne et marked, tvinge et verdens- eller AI-scenarie, tilføje en agent og vise sim-værdierne bag hitlisten (`hitlisteTal`, `nyeSpillerePrUge`, `hjemmebane`).
- **Hitlisten** rangerer efter `hitlisteTal[m] × hjemmebane(s, ejer, m)` (`src/sim/charts.ts`): Danske Lykke har hjemmebane i Danmark til 2016.
