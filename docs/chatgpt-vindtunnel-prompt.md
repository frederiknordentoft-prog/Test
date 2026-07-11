# PROMPT — kopiér alt herunder ind i ChatGPT

Du er en autonom senior-udvikler med speciale i beregningsfysik (CFD) og web-grafik (WebGL2). Din opgave er at bygge et komplet, fungerende produkt: **en interaktiv 2D-vindtunnel i browseren**, hvor man tegner en form, blæser vind på den, ser strømningen som røg og **måler** kræfterne som i en rigtig vindtunnel. Du bygger i etaper — én lille bid ad gangen i den rækkefølge, der står nedenfor — og du går ALDRIG videre til næste etape, før den aktuelle etapes gate er bestået og demonstreret.

---

## Arbejdsform (ufravigelig)

1. **Én etape ad gangen.** Levér koden for etapen, kør/verificér den, og rapportér kort: hvad der er bygget, hvordan gaten blev bestået (konkrete tal/observationer), og hvad næste etape er. Spørg ikke om lov — byg.
2. **Gates er hårde krav.** Hvis en gate fejler, så debug og fix før du fortsætter. Rapportér ærligt hvad der fejlede og hvordan du fiksede det.
3. **Fysikken må aldrig være "pyntet".** Alle fysik-påstande verificeres empirisk med acceptancetestene i afsnittet "Fysik-acceptancetests" — aldrig antaget.
4. **Al UI-tekst er på dansk.** Kort og venligt sprog, aldrig tekstvægge.
5. Efter sidste etape: levér en samlet README med arkitektur, kørselsinstruktioner og testresultater.

---

## Produktvision

En browser-vindtunnel man kan lege sig til aerodynamik i:

- **Vind fra venstre**, justerbar 1–30 m/s med en slider. Modstand (drag) skal måleligt vokse ~kvadratisk med farten.
- **Tegn selv objektet**: lukket frihåndsform med finger/mus + primitiver (cirkel, firkant, flad plade, strømlinet dråbe). Objektet sidder på en "pind" (ophæng) midt i tunnelen og kan roteres (angle of attack) og **trækkes rundt med fingeren**.
- **Røg gør vinden synlig**: streaklines fra en røg-rake i venstre side — levende, bløde, glødende linjer på mørk baggrund (additiv blending). Det er hero-visualiseringen.
- **Tunnelen MÅLER**: drag og lift beregnes ved impuls-udveksling på objektets rand (momentum exchange) — IKKE fra en antaget koefficient. Vises som **middelværdi ± udsving** (udsvinget er hvirvelafløsningens pendling — en pointe, ikke støj).
- **Ophæng med fysik**: torsionsfjeder + dæmper; masse og inertimoment beregnes af den tegnede form × en vægt-slider (0,1–10×). Tungt objekt svinger knap; let objekt kastes rundt af hvirvelgaden (F=ma gjort synlig). Lås-knap til rene målinger.
- **Feltvisninger** (vælger): fart, hvirvler (vorticitet), tryk som **Cp**, strømlinjer. Colorblind-sikre farveskalaer (viridis + blå-orange divergerende) med **legende**.
- **Probe**: tryk et sted i tunnelen og aflæs lokal fart og tryk — både i m/s / Pa og dimensionsløst (u/U∞ og Cp; stagnationspunktet skal aflæse Cp ≈ 1).
- **Læringslag**: korte danske forklaringsbobler udløst af handlinger; labels for stagnationspunkt og hvirvelgade (med Strouhal-tal); 4 udfordringer ("Lav en hvirvelgade", "Under Cd 0,5", "Få den til at flagre", "Løft uden vinge"); sammenlign-mode med to tunneler side om side og delt vind.
- **Tempo-slider** 0,25×–4×: simulationen kører naturligt i "slowmotion"; slideren skalerer substeps pr. frame.
- **Mobil-først PWA**: installerbar, touch-venlig, portrait- OG landscape-layout, `prefers-reduced-motion` respekteres, ≥30 fps på en mid-range telefon via adaptiv kvalitetsstige.
- **Ærlighed i UI**: et "Avanceret"-panel viser Cd, Cl, Reynolds-tal, Strouhal-tal, blokerings-%, gitter, fps — plus tre ærlige noter: (1) 2D-kræfter er pr. meter dybde; (2) simuleret Re ≈ 10³, en rigtig genstand ved samme fart ligger ved Re ≈ 3×10⁵ hvor Cd typisk er lavere; (3) objektets bevægelse kobles kvasi-statisk. Det er et lærerigt legetøj, ikke certificeret CFD — og det siger vi åbent.

**Non-goals:** 3D, turbulensmodeller (LES/RANS), konti/backend, CAD-import.

---

## Låste tekniske valg (afvig ikke)

- **Stack:** Vite + React + Zustand + TypeScript (strict) + vite-plugin-pwa. Dependencies holdes minimale: react, react-dom, zustand, earcut (triangulering). Ingen GL- eller fysik-biblioteker — rå WebGL2.
- **HÅRD REGEL:** Sim-motoren er ren TypeScript i sin egen mappe (`src/engine/**`) med NUL React/Zustand-imports (håndhæv med en ESLint `no-restricted-imports`-regel). Motoren kører sit eget requestAnimationFrame-loop mod et canvas. React er kun meta-UI (sliders, paneler). Kobling: UI'et abonnerer på storen og kalder `engine.setParams(...)`; motoren publicerer målinger tilbage med et callback throttlet til ~10 Hz.
- **Fysikmetode: D2Q9 lattice-Boltzmann (BGK + Smagorinsky) på GPU via WebGL2 fragment-shaders**, ping-pong float-framebuffers, MRT med 3 RGBA-teksturer: `texF0=(f0..f3)`, `texF1=(f4..f7)`, `texF2=(f8, ρ, ux, uy)`. **CPU-fallback**: samme D2Q9 i typed arrays (~192×96) bag samme `Backend`-interface — byg den TIDLIGT (etape 2), både som fallback og som fysik-testkerne i Node.
- **Præcisions-trick (kritisk for mobil/16F):** lagr distributionerne som **afvigelser** `g_i = f_i − w_i` (w = lattice-vægtene), så hviletilstanden er 0 og RGBA16F-præcision rækker. Probe teksturformater ved opstart ved FAKTISK at test-rendere til RGBA32F og RGBA16F — extension-flag alene lyver på iOS.
- **LBM-detaljer:** pull-scheme fused stream+collide i én shader. Halfway bounce-back mod obstacle-tekstur (no-slip). Indløb (venstre kolonne): fuld equilibrium ved (ρ=1, u=(u_in,0)). Udløb (højre): zero-gradient + **sponge-zone** (viskositet ×8 over de sidste 6 % kolonner). Top/bund: free-slip (spejl-refleksion). Stabilitetsværn lagdelt: u_in ≤ 0,12 lattice-enheder, τ-gulv 0,51, Smagorinsky C=0,1, hastigheds-clamp ±0,25, vind-ændringer rampes over ~0,35 s, og en "badness"-kanal (NaN/ρ uden for [0,2; 4]) summeres på GPU'en → automatisk blid nulstilling med dansk toast.
- **Kraftmåling (Ladd, stationær væg):** for hvert link fra fluid-celle ind i solid nabo er impulsoverførslen **ΔF = e_i · 2·f̃_i** hvor f̃ er post-collision-fordelingen MOD væggen. (ADVARSEL: formlen `e_i·(f_i + f_ī)` ser plausibel ud men er FORKERT — den symmetriske sum udligner netop impuls-delen og giver negativ drag på runde former.) Summér også moment om ophængspunktet. Reducér til 1×1 via ping-pong 2×2-sum-passes; læs tilbage **asynkront** (PIXEL_PACK_BUFFER + fenceSync, poll næste frame — aldrig blokerende readPixels i driftsloopet).
- **Røg:** 16k GPU-partikler (positions-teksturer, RK2-advektion, respawn ved rake med deterministisk hash-jitter) splattet additivt ind i en trails-buffer, der selv advekteres semi-Lagrangesk og henfalder (~0,982/frame) — det giver streaklines. Seeded PRNG overalt — ingen Math.random i motoren (reproducerbarhed).
- **Objekt-pipeline:** frihåndspunkter → resampling → Chaikin-glatning ×2 → Douglas-Peucker → CCW → validering (min-areal, min-tykkelse) → earcut-triangulering én gang ved commit. Pose (rotation + pind-bøjning) er en uniform i obstacle-vertex-shaderen, så re-rasterisering pr. frame er ét billigt draw call. Masse, tyngdepunkt og inertimoment via shoelace-formler.
- **Enheder:** tunnelhøjde ≡ 0,5 m; slider 1–30 m/s ↦ u_in ∈ [0,008; 0,12] lattice. Kræfter vises i N pr. meter dybde via Cd: F = ½·ρ_luft·v²·D_m·Cd hvor Cd = 2F_lat/(u_lat²·D_lat) er den ægte leverance. Re = u·D/ν med ν = (τ−0,5)/3. **Vist Re normaliseres til et nominelt gitter**, så den adaptive kvalitetsstige ikke ændrer tallet midt i en session.

---

## Etapeplan — byg i denne rækkefølge

**Etape 0 — Scaffold.** Vite+React+TS+Zustand+PWA-skelet, ESLint med engine-renhedsregel, mørkt app-shell med dansk titel, en triviel fullscreen-shader der beviser float-FBO-pipelinen.
*Gate:* `tsc --noEmit`, `eslint`, `vite build` grønne; shaderen renderer.

**Etape 1 — LBM-kerne med hardcodet cylinder (risiko-dræberen).** Hele LBM-shaderen med alle randbetingelser, hastigheds-heatmap (viridis), vind-slider, fast timestep med substeps, badness→auto-reset. VIGTIGT: init-feltet skal have en lille deterministisk asymmetrisk perturbation (fx `0,05·u_in·sin(0,11x)·sin(0,13y+0,7)`) — en perfekt symmetrisk opsætning shedder ALDRIG.
*Gate:* tydelig periodisk von Kármán-hvirvelgade bag cylinderen; 5 min på max vind uden nulstilling.

**Etape 2 — CPU-kerne + Node-testharness.** Portér D2Q9 1:1 til typed arrays (ingen DOM), og skriv et Node-script der kører fysik-acceptancetest 1–6 (se nedenfor) mod CPU-kernen.
*Gate:* alle 6 tests PASS i terminalen.

**Etape 3 — Kraftvægt på GPU.** Boundary-flag-pass, momentum-exchange-pass, reduce-kæde, async readback, målere i UI (middel ± udsving over ~2 s-vindue). In-page harness (`?harness=1`) der kører de samme tests mod GPU-backenden.
*Gate:* GPU-harness PASS på v²-loven, Strouhal, symmetri og stabilitet; drag-tallet er POSITIVT for alle primitiver efter indsvingning.

**Etape 4 — Tegning + primitiver.** Frihåndspipeline, primitiv-knapper, træk-formen-gestus, ghost-hint når tunnelen er tom. Appen skal ÅBNE med cirklen monteret i vinden — aldrig en tom tunnel.
*Gate:* frihåndstegnet klat får plausible, stabile målinger; formen kan trækkes uden crash; dråbe vs. plade-testen PASS (Cd-forhold < 0,5 ved samme frontalhøjde).

**Etape 5 — Hero-røg.** Partikler + trails-buffer, spawn-fade så rake-zonen ikke klumper, reduced-motion-variant (dye-striber uden partikelglød).
*Gate:* glødende streaklines folder sig om formen og hvirvelgaden er synligt levende i røgen; ≥30 fps på telefon (eller adaptiv stige træder til).

**Etape 6 — Feltvisninger + probe.** Fart/vorticitet/Cp-tryk/strømlinjer (screen-space LIC er nok) med legender. Cp-skalaen er PIECEWISE: Cp∈[−3;0]→[0;0,5] og Cp∈[0;+1]→[0,5;1], så fristrøm = neutral grå og stagnation (Cp=1) = fuld mætning. Probe med m/s, Pa, u/U∞ og Cp; aflæsningsboks flipper væk fra kanten.
*Gate:* probe i stagnationspunktet læser Cp ≈ 1 og fart ≈ 0; probe over cylinderen læser u/U∞ > 1; legender synlige og korrekte.

**Etape 7 — Ophæng + vægt + tempo.** Torsionsfjeder-dynamik (semi-implicit Euler på momentet fra readbacken, dæmpning der også tåler 1–2 frames readback-latens), vægt-slider (log-skala; træk på den låser automatisk pinden op), vinkel-slider, tempo-slider med fraktions-akkumulator.
*Gate:* samme vind: tung plade svinger < 2°, let plade kastes > 15° rundt; vinkel-sweep viser Cl stige og så kollapse (stall); Strouhal-tallet i UI står BOMSTILLE når tempo-slideren flyttes.

**Etape 8 — Læringslag + polish + PWA.** Bobler, labels (stagnation + "Hvirvelgade · St ≈ …"), 4 udfordringer (kræv 8 s settle efter formskift + 8 målinger i træk før en udfordring markeres klaret — opstartstransienter må ikke give pokaler), sammenlign-mode, landscape-layout, Avanceret-panel med ærlige noter, PWA-manifest med scope/ikoner, tilgængelighed (aldrig kun farve, fokusrækkefølge, ingen user-scalable=no).
*Gate:* alle 4 udfordringer kan gennemføres reelt; Lighthouse PWA + a11y ≥ 90; fuld harness-kørsel PASS på begge backends.

---

## Fysik-acceptancetests (byg dem i etape 2–3, kør ved hver senere gate)

Protokol pr. test: sæt form + vind, **settle i mindst 1,2 × (gitterbredde/u_in) steps** (fast antal er en klassisk fejl — flowudvikling skalerer med domænekrydsningstiden), mål derefter over ≥ 2500 steps med samples hver ~20.-25. step.

1. **v²-loven:** cylinder ved u og 2u → drag-forhold ∈ [3,2; 4,8].
2. **Strømlinjeform:** dråbe vs. flad plade ved samme frontalhøjde → Cd-forhold < 0,5 (og plade-Cd > 0,5). Referenceniveauer ved Re ~10³ og ≤20 % blokering: plade ≈ 1,8–2,2, cylinder ≈ 1,5–1,9, dråbe ≈ 0,7–0,9.
3. **Strouhal:** cylinder, St = f·D/u ∈ [0,12; 0,35] (litteratur ≈ 0,2). Frekvensen måles i **lattice-tid** som zero-crossings af det MIDDEL-FJERNEDE løftsignal med **hysterese** (kryds tæller kun når signalet har passeret ±½ typisk amplitude) — rå fortegnsskift-tælling inflateres af støj.
4. **Symmetri:** cylinder middel-|Cl| < max(0,1; 0,15·Cd).
5. **Stabilitet:** firkant på max vind, ≥6500 steps, ingen NaN/nulstillinger, drag forbliver positiv.
6. **Determinisme:** to identiske kørsler → bit-identiske kraftsummer.

---

## Faldgrube-appendiks (hver af disse har kostet rigtige debugging-timer — undgå dem fra start)

1. **Momentum exchange:** ΔF = 2·e_i·f̃_i (kun fordelingen MOD væggen). Summen f_i + f_ī fjerner netop den impulsbærende (ulige) del → negativ drag på cirkler/dråber mens firkanter ser plausible ud.
2. **Symmetrisk opsætning shedder aldrig:** uden et deterministisk asymmetrisk seed i init-feltet forbliver kølvandet symmetrisk og Strouhal-testen måler 0. Hold seedet lille (~5 % af u_in), ellers ses det som skakternet mønster i tryk-overlayet.
3. **Frekvens-tælling uden hysterese** giver 2× for høj Strouhal, når løftsignalet er svagt/støjende.
4. **Fast settle-tid** underudvikler flowet ved lav vind → v²-testen fejler med for HØJT forhold. Skalér settle med gitterbredde/u_in.
5. **Blokering:** former der fylder ≥25 % af tunnelhøjden hæver Cd ~70 % over litteraturen. Hold primitiver på 15–21 % blokering, vis blokerings-% i Avanceret, og kald tallet "Cd (i denne tunnel)".
6. **Genbrug ALDRIG en fenced PBO** til en ny readPixels før den er læst — driverens shadow-copy kasseres og du læser nuller/gamle data (set i praksis). I test-/harness-kode: læs blokerende UDEN PBO.
7. **RGBA32F er ofte urenderbart på iOS** trods extension-flag: test-rendér begge formater ved opstart, og design 16F-stien som førsteklasses via deviation-lagringen.
8. **Negativ CSS-bredde** (fx en søjle skaleret fra en negativ transient-Cd) er ugyldig og falder tilbage til FULD bredde — clamp alle procenter ≥ 0.
9. **Impulsiv start** giver en trykbølge med sekunders negativ drag: kør en warm-up-burst (~240 substeps) efter hver init/nulstilling før brugeren ser tallene.
10. **Wall-clock-frekvenser lyver:** alt der rapporteres om hvirvelafløsning skal være dimensionsløst (St) eller omregnes eksplicit — ellers ændrer tallet sig med tempo-slider, kvalitetsstige og framerate.
11. **Sim-loop i React** (state pr. frame) dræber ydelsen — motoren skal eje sit eget rAF-loop, og målinger flyder tilbage throttlet.
12. **Vist Re, der afhænger af gitteret:** normalisér til nominelt gitter, ellers ændrer den adaptive kvalitetsstige "fysikken" for øjnene af brugeren.

---

## Succeskriterier for det færdige produkt

- Tegn en firkant → SE en hvirvelgade løsne sig bagved, med St ≈ 0,2-label.
- Dråben måler synligt < halv drag af pladen ved samme frontalhøjde — uden at appen har fået det at vide.
- Dobbelt vind ≈ firedobbelt drag, aflæseligt på måleren.
- Tungt objekt deflekterer knap; let objekt kastes rundt — samme vind.
- Røgen får en fremmed til at sige "nå, SÅDAN bevæger luft sig om ting" inden for 30 sekunder.

Begynd nu med Etape 0. Rapportér kort efter hver etape, og fortsæt selv til næste.
