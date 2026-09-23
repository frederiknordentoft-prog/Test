# Plan: NORDLYS · SOLSTORM G5, en AAA-casinoautomat som UI-demo

## Kontekst

Frederik har bedt om en online casino-automat, **kun som UI-demo**: legepenge, ingen backend.

**Kravene fra Frederik:**
- Spilleren skal *opleve at vinde mere*.
- Der skal være progression, hvor man samler noget op.
- En sjælden **Extreme edition** skal være vildere og vildere at se på, og den skal betale bedre tilbage.
- En demo-knap skal kunne udløse Extreme med det samme.
- Alle assets skal være lavet i kode.
- Niveauet skal være AAA, og spillet skal være noget, Danske Spil vil købe.
- "Tænk som Matt Shumer": et wow-øjeblik, som folk optager og deler.
- Temaet må ikke vise, hvor jeg er svag.

**Hvordan planen er lavet:**
- Et designpanel med 11 agenter står bag: research i tech og regulering, fire uafhængige koncepter, to dommere, en syntese og to adversarielle kritikere.
- **Alle fire koncepter endte uafhængigt af hinanden på det samme tema.**
- Kritikernes rettelser er arbejdet ind nedenfor. Det gælder bl.a. to blokerende matematikfejl, fasefølgen, LDW, clock-sync, context loss og mobil-viewport.

**Repo:**
- `/home/user/Test` indeholder et urelateret elpris-dashboard i roden, og det røres ikke.
- Alt nyt ligger i `/home/user/Test/automat/`.
- Branch: `claude/casino-automat-ui-demo-odxmxe`.
- Der findes ingen eksisterende kode at genbruge.

---

## 1. Koncept

- **NORDLYS**, med tagline "Lad himlen lade op."
- **Extreme:** **SOLSTORM · G5 EKSTREM**. NOAA's skala kalder officielt Kp 9 for "G5 – Extreme".

**Scenen:**
- Polarnat over Møns Klint (Dark Sky Park) med havet foran.
- Hver gevinst knuser iskrystaller til *ladning*, og ladningen flyver op i himlen.
- **Himlen er progressionsbaren:** Kp 0→9, fra grønt over violet og røde toppe til knitrende storm.
- Ved Kp 9, eller når 4 sole lander, rammer en CME. Skærmen knuses mod kameraet, og et smeltet 8x8-obsidian-kabinet samler sig på beatet.
- Den danske krog er G5-stormen 10.–11. maj 2024, hvor hele landet så rødt nordlys.

**Hvorfor temaet virker:**
- Alt er lys, glas og matematik: fbm-gardiner, facetterede krystaller, SDF, Voronoi-knusning, bloom og syntese.
- Der er ingen karakterer, ansigter, dyr, malede illustrationer eller licens-IP.
- Det rammer ikke de mættede temaer (Viking, Egypten, frugt, slik).
- Der er ingen børneappel (L 127 §36).
- Det er et Danske Spil-eksklusivt spil uden IP-omkostning.

**"Bedre tilbagebetaling":**

| | RTP |
|---|---|
| Basisspil | ca. 81 % |
| Solstorm-spin | ca. 2.000 % (snit ca. 200× indsats over 10 spin) |
| Samlet deklareret | 96,00 % |

Tallene står åbent i reglerne.

**Scope-disciplin:** ét basisspil og én Extreme-tilstand. Der er ingen mellemliggende free-spins-tilstand.

## 2. Kerne-loop: "vinde mere", ærligt

**Grid og symboler:**
- 6x6 cluster pays: 5 eller flere ortogonalt forbundne. Uafhængige vægtede celletræk og ingen skjulte hjul.
- **Isskred-kaskade:** vindere knuses, resten falder ned, og der fyldes op ovenfra.
- **Wild "Nordlysbue":** kan indgå i flere klynger.
- **Scatter "Solen":** lander kun i første drop, højst én pr. kolonne, med sandsynlighed p. Den ligger fast under kaskader og er ikke en del af klynger.
  - 3 sole = 3× + 150 ladning.
  - 4 eller flere = Solstorm (rute B).

**Frostmærker (normativt, "læsning A"):**
- En gevinst evalueres med cellernes mærker *før* opgradering.
- Derefter opgraderes mærkerne: umærket → frost (x1, glød) → x2 → x4 → … → x32.
- Klyngens gevinst = tabelværdi × max(1, Σ mærker ≥ x2). Mærkerne lægges sammen.
- Mærkerne gælder kun inden for ét spin i basisspillet.

**Tempo:**
- Mindst **3,0 s** fra tryk til resultat (SCP.07.03 §5.1.1.5).
- Ingen turbo, slam-stop eller bonus buy.
- Autospin (10, 25, 50 eller 100 spin) kræver en tabsgrænse og går altid gennem det samme spin med 3,0 s-gulvet. Det stopper ved hver terning, ved Ladet spin, ved Solstorm, før tabet i runden ville overstige grænsen, ved for lav saldo, menu, skjult fane og STOP. Det fylder aldrig saldoen op og fortsætter aldrig efter en genindlæsning (brugerens valg 2026-09-23, se `docs/briefs/dice-gamble-autospin.md`).
- Tryk under et spin ignoreres; de sættes ikke i kø.
- Spin-knappens ring fyldes over de 3 s.

| Tid | Spin uden gevinst |
|---|---|
| 0–600 ms | Krystaller falder ud |
| 600–2.400 ms | 6 kolonner lander med 250 ms mellemrum; hver kolonne har en FM-klokke, så de danner en arpeggio |
| 2.400–3.000 ms | En glint scanner gridet |

**Søjle 1 er net-win-frekvens, ikke hitrate:**
- Gevinst over indsatsen i **≥ 25 %** af spin. Hitraten (≥ 43 %) er sekundær.
- Begge tal oplyses i reglerne.

**Effektprofiler: WIN eller RETURN.** `schedule.ts` klassificerer *slut-totalen T*, før første step vises.

| Resultat | Behandling |
|---|---|
| T > indsats | **WIN:** guld, knusning med resonans-pings, perimeter-ribbon, chime-stige, mærke-blip, gevinstniveauer, "i plus"-tick på Netto-linjen |
| 0 < T < indsats | **RETURN:** afmættet dissolve (ingen skår, pings eller varme gnister), tørt tick, "Retur 0,60 kr · netto −1,40 kr" i #7F93B2, ingen ribbon og ingen mærke-blip. Motes opfører sig ens uanset T. Aria-teksten er "Retur X kr, netto −Y kr" |
| T = indsats | "Indsats retur", neutralt |
| T = 0 | 150 ms dæmpning |

**Gevinstniveauer** (efter T/indsats):

| Niveau | Varighed |
|---|---|
| GEVINST 1–5× | 0,8 s |
| FLOT 5–20× | 1,6 s |
| STOR 20–100× | 3 s |
| MEGA 100–500× | 6 s |
| EPISK 500×+ | 9 s |

- Alle kan springes over efter 1 s. Fra 100× kræves "Fortsæt".

## 3. Progression

**Ladning:**
- Lav krystal = 1, høj = 2, wild = 3, 3 sole = +150.
- Motes flyver i en helix ind i Kp-buen på 650 ms.
- Farven er kølig #CFEFFF (aldrig en gevinstfarve), og lyden er et "zip".
- **Én glød-envelope pr. kaskade:** højst 1 Hz og højst 10 % luminans, i stedet for et puls pr. mote.
- Der optjenes **ingen ladning under Solstorm**.

**Én måler med låst indsats:**
- Måleren gemmer `charge` og `stakeSumOre`.
- **Låst indsats = floor(stakeSumOre / charge)** i hele øre. Den bruges til rute A-storme **og til alle Ladede spin**, så det ikke kan betale sig at skifte indsats.
- Adversary-simulationer skal vise, at spillerens edge er ≤ 0.

**Tærskler (front-loaded):**
- K kommer i lukket form fra tuneren (ca. 12.000).
- Andele af K for Kp1–9: [0,004; 0,012; 0,03; 0,06; 0,11; 0,19; 0,31; 0,55; 1,0].
- Det giver cirka Kp1 efter 10 spin, Kp2 efter 30, Kp3 efter 70 og Kp4 efter 140. Snittet til Kp9 er ca. 2.200 spin.
- **Gate:** medianspilleren krydser mindst 3 synlige tiers inden for 150 spin.

**Én kilde til tiers:** `src/game/tiers.ts` holder sky-uniforms, musiklag og perks pr. Kp. Hvert Kp-trin giver **én synlig himmelændring og ét musiklag**:

| Kp | Navn | Ændring |
|---|---|---|
| 1 | – | Glas-arp |
| 2 | – | Tykkere gardiner |
| 3 | Uro | **Ladet spin** (4 felter x2 ved låst indsats) |
| 4 | – | Rimlys på rammen, puls-bas |
| 5 | G1 | Violet #8A5CFF, kick, **Ladet spin** |
| 6 | G2 | Foldede gardiner, blød perkussion |
| 7 | G3 | Røde toppe #FF3D6E, **Ladet spin** |
| 8 | G4 | Magenta hårrevner, knitren, ostinato (ingen nedtælling) |
| 9 | G5 | SOLSTORM |

**Level-up (1,4 s):**
- Nålen slår over, og himlen "ånder" én gang.
- Banneret "GEOMAGNETISK STORM · G3 KRAFTIG" vises.
- Det nye lag går ind på næste takt.

**Altid synligt næste mål:**
- Chippen "Næste: Kp 5 · G1 → Ladet spin · 610 ladning · ≈ N spin i snit".
- En låst "G5 · SOLSTORM"-silhuet sidder øverst på buen.
- Kp-stigen (alle trin i ren tekst) er et bottom sheet på mobil og et venstrepanel på desktop.

**Persistens:**
- `localStorage['nordlys.v1']` i try/catch.
- **Synligt banner, hvis storage ikke er tilgængelig.**
- Gemmer: måler, indstillinger, Himmellog, de sidste 100 spin med pre-state og **`activeStorm`** (så stormen kan genoptages efter reload).
- Teksten "Dit fremskridt gemmes i 365 dage efter dit sidste spin."

## 4. SOLSTORM · G5 EKSTREM

**Udløsning:**

| Rute | Betingelse | Hyppighed | Måler bagefter | Indsats |
|---|---|---|---|---|
| A | Kp 9 | ca. 1:2.200 | Nulstilles | Låst |
| B | 4+ sole | ca. 1:3.300 | Beholdes | Spinnets indsats |

- Samlet ca. 1:1.330.
- A og B i samme spin giver én storm ved spinnets indsats, og måleren nulstilles.
- Triggere evalueres først, når basis-præsentationen er færdig.

**Anticipation (fast, synlig regel, logges i `SpinResult`):**
- Ved 3 synlige sole og mindst én kolonne tilbage får hver resterende kolonne +600 ms og en drone.

**Cinematic "Stormen rammer" (7,2 s):**
- **Master-uret er lyd-clocken:** `tlTime = ctx.currentTime − t0 − outputLatency`, med fallback til `performance.now` når lyden er låst eller muted.
- Hit-stops er rene visuelle freezes af partikler, shake og motes. De stopper ikke det globale ur.

| Tid | Beat |
|---|---|
| 0 | Sidste mote eller 4. sol. Visuel hit-stop 180 ms. Musikken dukkes, og en 40 Hz swell starter. |
| 180–1.200 | Nålen slår til 9, og glitch-teksten går fra "Kp 9" til "G5 · EKSTREM". Nordlyset farves crimson #FF2A4D oppefra. Kamera-push 1,00→1,06. |
| 1.200–2.200 | CME: en plasmafront (polar-fbm) ruller ned, stjernerne streaker (radial zoom), CA langs fronten og en riser. |
| 2.200 | **IMPACT:** varmhvidt flash #FFF4E0 i **40 ms** via FlashBudget, shock-ring, haptic og 808-drop. |
| 2.200–2.450 | 48 Voronoi-revner lyser op indefra og ud. |
| 2.450 | **Capture:** `world` og `hud` renderes til én forallokeret RT med `transform: world.worldTransform`. Scenen byttes med shard-meshen. DOM-RegStrip knuses aldrig. |
| 2.450–3.400 | **Shatter:** skårene tumler udad, falsk z, 300 debris. Bag dem: void med en stigende plasmasol. |
| 3.400–4.600 | **Reform:** 8x8-rammen tegnes som smeltede SDF-strøg. SOLSTORM-logoet slår ind med ét bogstav pr. 70 ms, `back.out`. |
| 4.600–5.600 | 64 obsidian-symboler falder i en diagonal bølge. **6 startmærker (x2) antændes.** Teksten "10 SOLSTORM-SPIN · Låst indsats 3,40 kr" bygges op. |
| 5.600 | Downbeat, 140 BPM. Knappen "START SOLSTORMEN" vises. Ingen autostart. |

- **Skip:** fra anden visning efter 1,5 s, via `applyState('reform')`.
- **Rolig tilstand:** 2 s crossfade.
- **Kommer rolig tilstand fra OS'et,** vises chippen "Rolig tilstand (systemindstilling) · Vis fuld effekt". `#fx=full` er til optagelser.

**I stormen:**
- 8x8 grid med en 4 px ramme og celler på mindst 44 px.
- 10 spin kører som *én feature* efter ét tryk. Hvert spin er mindst 3,0 s.
- **Plasmamærker** holder hele stormen og går op til x128. Stormen **starter med 6 x2-mærker**, som løfter bunden af fordelingen.
- **Stormbølger** før spin 4 og 8: alle mærker ≥ x2 fordobles. Shockwave, domino-flip af x-tags, sub-drop.
- **Retrigger:** 3+ sole giver +3 spin, højst 20 i alt. `p_storm` er separat.
- **Stormgaranti 30×** vises åbent på en separat linje: "Stormgaranti +X kr".
- Cyan #3AF2FF er reserveret til multiplikatortal på mørke pills.

**Slutningen:**
1. Log-skaleret count-up (kan springes over).
2. Summary-kortet: "Solstorm · 10 spin · Højeste mærke x64 · 412,40 kr (206×)".
3. Obligatorisk "Fortsæt" med session-netto.
4. "Solstormen aftager" (crossfade): 8x8 bliver til 6x6, og Kp tømmes synligt ved rute A.

## 5. Matematik (normativ spec øverst i `src/math/engine.ts`)

**Regelspec.** Hvert punkt har sin egen engine-test:
- Frostmærke-timing (læsning A), additiv sum.
- Wild: tæller i alle klynger, giver ladning 3, hopper ét mærkeniveau op når den vinder.
- Sol-celler i kaskader.
- 4+ sole giver kun storm (ingen 3×).
- Ingen ladning i storm.
- Stormbølger rammer kun mærker ≥ x2.
- Låst indsats rundes ned til hele øre.
- **Integer-øre overalt.** Totalen afrundes én gang pr. sekvens.

**Startvægte (prototype):**

| Symbol | L1–L4 | Måne | Polarstjerne | Rav | Wild |
|---|---|---|---|---|---|
| Vægt | 26 / 25 / 23 / 22 | 10 | 8 | 6 | 2,2 |

- p ≈ 0,069.
- Storm-vægtene ligger fast. Stormens forventning styres af en separat lineær `s_storm`, og cap'en lægges på efter skalering.

**Paytable-form** (× indsats efter klyngestørrelse 5 / 6 / 7 / 8 / 9–10 / 11–12 / 13–15 / 16+):

| Symbol | Værdier |
|---|---|
| L1 | 0,3 / 0,4 / 0,5 / 0,7 / 1 / 1,5 / 3 / 8 |
| … | … |
| H3 Rav | 1,5 / 2 / 3 / 5 / 8 / 15 / 40 / 200 |

- Den endelige tabel kommer fra tuneren og **afrundes til 0,05- eller 0,1-trin**. Et forventet s ≈ 2 giver minimum-gevinster på ca. 0,6–0,8×.

**RTP-budget:**

| Komponent | pp |
|---|---|
| Base-klynger | ca. 79 |
| Sole | ca. 1,6 |
| Ladede spin | ca. 0,1 (efter sim) |
| Storm B | ca. 6 |
| Storm A | ca. 9 |
| **Samlet** | **96,00** |

- Minimum-RTP uden gemt fremskridt er ca. 86,5 %, og det oplyses.
- Den målerafhængige andel er højst 10 pp.
- Tuneren udsender også varianter på 94 % og 92 % (kun s og s_storm ændres).
- Stake-stige: 0,50–100 kr. Max gevinst 10.000× (i kr pr. indsats står i reglerne).

**RNG og replay:**
- Outcome: `xoshiro128**`, seedet pr. spin med `splitmix32(sessionSeed ^ DOMAIN[base|storm|perk|demo], idx)`. Demo har sin egen tæller.
- Kosmetik: `mulberry32` i `src/present/cosmeticRng.ts`.
- En lint-test forbyder `Math.random` uden for cosmeticRng. GSAP's random-strenge må ikke bruges.
- Spil-ID = (seed, idx, stateHash). Hver historikpost gemmer en pre-state: mode, stake, locked stake, charge, stakeSum, perk, stormspin-indeks og mærkegrid.
- En golden-test afspiller en hel storm fra historikken.

**Tuner (`sim/tune.ts`, med common random numbers og 2–3 fixed-point-runder):**
1. Wild-vægten bisectes mod hitrate.
2. Shape-knoppen (lave-niveau-floor) bisectes mod net-win.
3. `s = mål_base / målt_base`.
4. p analytisk (1:3.300).
5. `s_storm` i lukket form, derefter korrektion for cap.
6. `K = c̄/r_A − Ō`.
7. Afrunding af paytable, og resten rettes med s.
8. Verifikation på friske seeds.

- Resultatet skrives til `src/math/config.generated.ts` med en SHA-256 model-hash.

**Monte Carlo (`sim/run.ts`, `worker_threads`):**
- **Dekomponering:** RTP = base + r_A·E[S] + r_B·E[S].
  - r_A via renewal-reward.
  - CI via delta-metoden.
  - End-to-end-krydstjekket bruger route-A-regenerative cykler som i.i.d.-batches.
  - Det består når |e2e − dec| ≤ 1,96·√(SE²+SE²).
- **Kørsler:** fuld kørsel med 2×10⁸ basisspin og 2×10⁶ storme, startet i baggrunden under P2. `sim:quick` bruger fast seed og tjekker eksakte golden-værdier med eksplicit `testTimeout`.
- **Rapporter:** `sim/report.json` og `sim/REPORT.md`. REPORT.md er Danske Spils par sheet og har en integrationssektion: `src/math` er isomorf TypeScript til operatørens RGS, som er server-autoritativ, og klienten læser `SpinResult`-JSON.
- **Alle tal, spilleren ser** (regler, minimum-gevinster, K, "≈ N spin"), kommer fra `report.json`.

**Gates:**

| Gate | Krav |
|---|---|
| Samlet RTP | 96,00 ± 0,10 pp |
| Minimum-RTP | ≥ 86 % |
| Målerandel | ≤ 10 pp |
| Net-win | ≥ 25 % |
| Hitrate | ≥ 43 % |
| LDW-andel af hits | ≤ 45 % |
| Solstorm | 1:1.100–1:1.600 |
| Storm E | 180–230× |
| Storm P10 | ≥ 15× |
| Garanti | brugt i ≤ 20 % af stormene og koster ≤ 5 % af E |
| Cap | ≤ 1 pr. 10⁴ storme |
| Tiers | ≥ 3 inden for 150 spin (median) |
| Stake-switch-adversary | edge ≤ 0 |

- P99 og SD (basis og blandet) rapporteres. Volatiliteten beskrives som "lav i basisspillet, høj i Solstorm".

## 6. Visuel identitet og rendering

**Paletter:**

| | Base | Extreme |
|---|---|---|
| Himmel | #050B1A → #0B1B3A | Void #0A0204 → #3A0010 |
| Accenter | Grøn #3DFFB0, teal #19E3D6, violet #8A5CFF, rød #FF3D6E | Crimson #FF1E3C, magenta #FF2BD6, smeltet #FF6A00, hvidglød #FFF4E0 |
| Tekst | Is #EAF8FF | – |
| Penge | Guld #FFD36B, kun ved WIN | Extreme-guld #FFC23D |

- Varm farve betyder værdi. Paletterne blendes i OKLab.

**Typografi:**
- **Isfont**: ca. 25 glyffer (N O R D L Y S E K T M G W I, cifre og `, . × + − % kr`) som monoline-polylinjer.
- Kapsel-SDF'en beregnes **på CPU'en** til en `BufferImageSource`, så den overlever context loss. R = afstand, G = buelængde til stroke-reveal.
- `SdfText`-shaderen giver gradient, bevel, glød og sweep.
- Bannertekst bages fra en tung `system-ui` med samme gradient og glød. Ingen downloadede fonte.

**Stage-topologi:**
```
app.stage
└─ cameraRoot (push/shake)
   ├─ world  [UberPost, filterArea = app.screen, resolution 'inherit']
   │   sky · composite · frame · GridMesh · FX · shards
   └─ hud    (ingen filter: saldo, indsats, spin, Kp-bue)
```
- Sæt `Filter.defaultOptions.resolution = 'inherit'` ved boot. Standardværdien er 1 og gør alt blødt på retina.
- Kawase bloom kører eksplicit på 0,25.

**Render-budget pr. frame:**
- **Bages én gang:** stjerner, Mælkevej og Klint-silhuet (højde- og normal-tekstur).
- **Pr. frame kun:** nordlysgardinerne (3 lag i 0,5x; 30 Hz på tier M og L) plus composite (opskalering, havspejl, blue-noise dither).
- **Storm:** sol med limb darkening og granulation. God rays er en 12–16-taps radial blur af en ¼-opløsnings-maske.
- **Uber-shader i 2 `#define`-varianter, begge pre-warmet:**
  - base: CA, grade, vignette, grain
  - cinematic: tilføjer zoom, rings, glitch og haze
- **WebGL2 er påkrævet.** Ellers vises en statisk plakat. Alle shaders er `#version 300 es` + `precision highp float;`.

**Asset-pipeline (`symbolBaker`):**
- **Ét bake-program pr. edition** med en `uSymbol`-switch. Atlasser er dimensioneret efter indhold (ca. 1024×512 ved 256 px celler med 4 px gutter).
  - A: albedo + alpha
  - B: normal + emission, bages med `blendMode 'none'`
- `bakeAll()` er idempotent og hænger på `renderer.runners.contextChange`, med sløret "Genindlæser grafik".
- En rAF-budgetteret chunk-scheduler håndterer baking (Safari har ingen `requestIdleCallback`).
- **`extremeReady`-promise** awaites af `enterSolstorm()`. Demo-time-lapsen og cinematicen frem til reform er bake-vinduet, og en sync-fallback kører i slices på højst 16 ms.
- Pre-warm: hver mesh-, filter- og blend-kombination tegnes én gang til en 1×1 RT.

**Krystal-look:**
- **MUST:** atlasset genbages pr. Kp-tier med en env-strip fra nordlys-rampen (krystallerne spejler den himmel, spilleren har tjent), plus et additivt sheen-sweep og 3-taps dispersion.
- **SHOULD:** per-pixel runtime-lighting med pointer-parallax.

**Symbol-opskrifter:**

| Symbol | Opskrift |
|---|---|
| L1 | Trillion #5CE1FF |
| L2 | Princess 45° #3DFFB0 |
| L3 | Hex-brillant #8A5CFF |
| L4 | Pear #FF5C9A |
| H1 Måne | Halvmåne-SDF, Worley-kratere, 22°-halo |
| H2 Polarstjerne | r(θ) = mix(0,22R; R; \|cos 4θ\|⁶) med diffraktions-spikes |
| H3 Rav | Støjforskudt pebble-SDF, subsurface, bobler, L-system-bregne |
| Wild | Hex-isplade med live mini-nordlys |
| Sol | Limb darkening, granulation, korona |

- De fire lave krystaller har forskellige former, så de er farveblind-sikre.
- **Extreme-varianter:** obsidian med ridged-fbm-magmaårer, formørket måne med korona, ember-rav, plasmawild og crimson sol.
- **Knusning:** 3 forudberegnede Voronoi-mønstre. Skårene bærer atlas-UV'er, så det er de rigtige krystalstykker, der tumler. Én forallokeret batched mesh.

**Fotosensitivitet (FlashBudget):**
- Højst 3 luminans-skift pr. sekund. Flash angives i ms (33–50).
- Aldrig fuldskærms mættet rød, ingen inversion.
- Demo-time-lapsen er én kontinuerlig ramp med ét åndedrag til sidst.

## 7. Lyd (rå WebAudio, intet Tone.js)

**Motor:**
- Busser (sfx, musik, ui) → limiter på −1 dBFS.
- IR genereres i kode. To convolvers med crossfade, så der aldrig byttes buffer live.
- **Musik-stems pre-renderes** med `OfflineAudioContext` i idle som loopbare 2-takts `AudioBuffer`s styret af gains. Kun sparsomme stingers syntetiseres live, så der er ingen node-storm på low-end Android.
- Scheduler med look-ahead.
- Unlock på "Tænd himlen"-trykket.
- `visibilitychange` og iOS `interrupted` → `ctx.suspend()` og pause af spil-uret. Ved retur: resume og re-anchor.

**SFX:**
- Base: FM-klokker i D-dorisk pentatonisk pr. kolonne, chime-stige pr. kaskade, resonante knuse-pings (kun ved WIN), tørt tick (RETURN), mote-zip, level-up-riser og gong, stigende sol-gongs, brass-stingers til gevinstniveauer.
- Ingen mønt-lyde.
- Storm: 40 Hz swell, reverse cymbal, glas-knus XL, 808-drop, letter-slam og Stormbølge-boom.

**Musik:**
- **Base:** 84 BPM, Dm9–Bbmaj7–Fmaj7–C6. Lagene følger `tiers.ts` og går ind på takt-grænser.
- **Solstorm:** 140 BPM, D-frygisk, kick, reese-bas, breaks. Supersaw ved x8 og kor ved x128.

## 8. UI og layout

**Flydende layout (mindst 360×600, `dvh`):**
- En `ResizeObserver` på host kalder `renderer.resize` og én `layout(w, h, mode)`. Kun RT-reallokeringer debounces.
- Gridstørrelse = min(bredde − 2·gutter, resterende højde).

**Portræt:**
- Én-linjes RegStrip (≥ 12 px): "NORDLYS · ur (operatør-slot) · Saldo · Indsats · DEMO · LEGEPENGE". Overløb går til menuen.
- Header med demo-pill og menu.
- Kp-bue med next-goal-chip. **Under 720 px højde** klappes den sammen til en 40 px bar, og gevinststrimlen lægges over bunden af gridet. Under 680 px flyttes demo-pillen ind i headeren.
- Grid, Netto-linje og gevinststrimmel.
- Deck: Saldo, − Indsats +, SPIN (88 px, med 3 s-ring).
- RG-footer: "18+ · StopSpillet 70 22 28 25 · ROFUS · Session 14 min · Netto −34,00 kr".

**Desktop:**
- Kp-rør og Kp-stige til venstre, grid i midten, historik og gevinsttabel til højre, Klint-panorama nederst.

**Input:**
- Alle kilder (DOM a11y-spejl, Pixi og tastatur) går gennem **én `dispatch(intent)`**.
- `KeyboardEvent.repeat` ignoreres.
- 250 ms lockout efter en modal lukkes, så "Fortsæt" ikke også starter et spin.
- Saldo < indsats giver Spin disabled og "Fyld op".
- **Taster:** Space = spin, ↑↓ = indsats, M = mute, E = demo, Esc = skip.

**Menu:**
- Regler & RTP (alle tal fra `report.json`, plus model-hash), gevinsttabel i kr, Kp-stige, Historik (Spil-ID), Lyd, Haptik (Android), Rolig tilstand, Spil ansvarligt, Fyld op, Nulstil demo.

**A11y:** skjult DOM-spejl med `<button>`s, aria-live og fokusringe.

**Første 10 sekunder (beat sheet):**

| Tid | Hvad sker der |
|---|---|
| 0 ms | Himmel, stjerner og nordlys bevæger sig lydløst fra første frame |
| 300–1.500 | NORDLYS stroke-reveal via SDF'ens buelængde |
| Tryk | Lyden låses op. Nordlyset tændes nedefra på 900 ms, synkront med første akkord |
| +0,9–2,4 s | Gridet samler sig med klokke-arpeggio, og HUD glider ind |
| ca. 8 s | Demo-pillen pulser én gang |

- **Gate:** første bevægelse inden 1,0 s, spilbart inden 4 s efter tryk.

**Demo-knap:**
- **Udseende:** DOM-pill "⚡ DEMO · Udløs Solstorm" med stiplet kant i #FFB547 og hazard-striber. Aria-teksten er "Demo-værktøj: springer progressionen over. Findes ikke i den rigtige version." Den ligger bag `VITE_DEMO_TOOLS`, som er slået til i dette build.
- **Flow:**
  1. Kører spinnet, sættes demoen i kø med én pending-flag. Knappen er disabled i storm, transition og outro.
  2. Demoen kører på et **in-memory fork af store**, og persistens-skrivninger er slået fra.
  3. Kp-time-lapse på 2,4 s som én kontinuerlig ramp.
  4. Den fulde cinematic.
  5. Ægte stormmatematik med demo-domænets seed.
  6. Badge "DEMO-UDLØST" hele vejen.
  7. Resultatet vises i et separat "Demo-resultat"-kort og krediteres ikke saldoen.
  8. Måleren gendannes: "Dit Kp 3,2 er gendannet".
- **Skuffe:** "Udløs via 4 sole", "Sæt Kp" og "Nulstil demo".
- **Hash-parametre (artifacts får kun `#hash`):**
  - `#demo=solstorm`
  - `#clean=1`: skjuler pill og skuffe, men **et vandmærke tegnet i canvas, "DEMO · Solstorm udløst manuelt", står altid** under tvungne storme
  - `#seed=`, `#scene=`, `#fx=full`, `#fps=1`

## 9. Arkitektur

**Stack:**

| Pakke | Brug |
|---|---|
| Vite | 8.3 |
| TypeScript | 6 (`erasableSyntaxOnly`, ingen `enum`) |
| pixi.js | 8.21 (`preference:'webgl'`) |
| pixi-filters | 6.1.5, kun `KawaseBlurFilter` |
| gsap | 3.15 (core + CustomEase) |
| vitest | – |
| vite-plugin-singlefile | 2.3.3 |
| playwright | 1.56.1, pinned |

- Ingen React eller Tone. Egen store og egen typed bus.
- **GSAP-ur:** `gsap.ticker.remove(gsap.updateRoot)` ved modul-import. Roden fødes med monoton tid fra spil-uret, og i cinematics fra lyd-uret.

```
automat/
  package.json vite.config.ts tsconfig.json index.html .gitignore
  scripts/  to-artifact.mjs  shoot.mjs  size-check.mjs  luminance.mjs
  sim/      run.ts worker.ts tune.ts replay.ts  report.json REPORT.md
  src/math/     rng.ts types.ts config.ts config.generated.ts grid.ts cluster.ts
                engine.ts storm.ts meter.ts hash.ts            ← ren TS, ingen DOM/Vite
  src/game/     stateMachine.ts SpinController.ts store.ts persistence.ts bus.ts
                tiers.ts demo.ts dispatch.ts
  src/present/  schedule.ts (SpinResult → Beat[], ren) director.ts celebration.ts
                clock.ts flashBudget.ts cosmeticRng.ts
                cinematics/ intro.ts solstormIntro.ts stormWave.ts solstormOutro.ts
  src/render/   app.ts quality.ts layers.ts sky/ world/ frame/ grid/GridMesh.ts
                art/ (symbolBaker, voronoi, envStrip) type/ (isfont, SdfText)
                fx/ (particles, shards, ribbon, motes) post/ (Bloom, UberPost)
                hud/ (KpMeter, WinStrip, Deck, SpinButton) shaders/*.glsl (?raw)
  src/audio/    engine.ts ir.ts synth.ts stems.ts sfx.ts music.ts
  src/ui/       regStrip.ts rgFooter.ts demoDrawer.ts rules.ts kpLadder.ts
                history.ts settings.ts a11y.ts styles.css
  src/main.ts   src/debug.ts (window.__slot: seed, scene, advance(ms,{render}), shot)
  tests/
```

**State machine:**
- Base: `Boot → Splash → Intro → Idle → Spinning → Resolving → Celebrating → Idle`. `LevelUp` kører som overlay.
- Storm: `Idle → StormTransition → StormReady → StormSpinning ↔ StormResolving → StormSummary → StormOutro → Idle`.
- `activeStorm` persisteres efter hvert stormspin. Ved boot genoptages den i `StormReady` med teksten "Stormen fortsætter".
- Ved resize midt i en cinematic resizes canvas med det samme, og layout udskydes til næste label via `applyState`. Skår gemmes i normaliserede koordinater.

**Dataflow:**
- `engine.spin(preState)` returnerer et immutabelt `SpinResult`.
- `schedule.ts` laver det om til `Beat[]` (ren og testbar: 3,0 s-gulvet og profilen).
- `director` bygger GSAP-timelinen og emitter bus-events til lyd, FX og HUD.
- **Boundary-test:** `src/math` importerer aldrig render, present, gsap, pixi, `import.meta.env` eller `?raw`. Present og render importerer aldrig `math/rng`.

**Performance:**

| Post | Budget |
|---|---|
| JS | ≤ 4 ms/frame, 0 allokeringer i hot loop |
| Draw calls | < 40 |
| Boot | < 1,5 s |
| Bundle | ≤ 2,5 MB (mål ca. 1,1 MB) |

- **Opløsning:** `res = clamp(min(dpr, 2, √(BUDGET/px)), 1, 2)`.
- **Quality tiers H/M/L:** partikler 3.000 / 1.500 / 600, DPR-loft 2 / 1,5 / 1,25. Ned efter 1,5 s over 19 ms, op efter 5 s under 12 ms.
- **Rolig tilstand:** ingen shake, flash, CA, zoom eller skår, 70 % færre partikler.

## 10. Byggefaser: vertikal slice med artifact ved hvert checkpoint

Feature freeze ved ca. 60 % af session-budgettet.

| Fase | Indhold | Definition of Done |
|---|---|---|
| **P0 Scaffold** | Vite, TS, vitest, `to-artifact.mjs` (overrider `:root{padding:0}`, `html,body{margin:0;height:100%;overflow:hidden;background:#050B1A}`, `<title>NORDLYS</title>`), `shoot.mjs` med SwiftShader-probe, `window.__slot`. Røgtest af `node sim/run.ts --quick` (tsx som fallback). | Én HTML-fil. Playwright logger WebGL2-renderer og tager et testshot uden `pageerror`. |
| **P1 Matematik** | Regelspec, rng, cluster, engine, storm, meter, tune, sim-dekomponering, REPORT. Fuld 2×10⁸-kørsel **startes i baggrunden**. | Quick-gates grønne. Golden-hashes og replay virker. Boundary- og `Math.random`-lint grønne. |
| **P2 Kerne-loop** | GridMesh, symbolBaker (lit A+B), drop, kaskade, Voronoi-shatter, frostmærker, WIN/RETURN-profiler, Netto-linje, gevinstniveauer, basis-SFX (juice fra start), simpel HUD og RegStrip, dispatch og guards. | Screenshots ved 375×667 og 1920×1080 ser færdige ud. Schedule-test: ≥ 3.000 ms for 10k seeds, og ingen WIN-events når T ≤ indsats (100k seeds). |
| **P3 Storm-slice og demo** | Demo-knap og skuffe, `extremeReady`, cinematic v1 (hit-stop, CME, flash, capture og shatter, reform, logo-slam), 8x8 med plasmamærker og startmærker, Stormbølger, retrigger, garanti, summary og crossfade-outro, `activeStorm`-resume. | **Checkpoint-artifact publiceret.** Demo-flowet gendanner måleren og krediterer ikke saldoen. Ingen frame over 50 ms ved demo 300 ms efter unlock. |
| **P4 Verden** | SkyPass-gardiner, bagte lag (stjerner, Klint), havspejl, ramme, bloom og uber (2 varianter), Kp-bue, motes og glød-envelope, tiers og level-ups, Isfont-logo, 10 s-intro, context-loss-restore. | Himlen art-directes via `#scene=kpN` ved Kp 0/3/5/7/8. Første bevægelse inden 1 s. Checkpoint-artifact. |
| **P5 Lyd** | Stems via OfflineAudioContext, adaptive lag på takt, stormmusik, audio-clock-master til cinematic. | Unit-test: labels plus hit-stops matcher audio-events inden for 1 frame. Tier-skift er hørbare på takten. |
| **P6 Compliance-UI** | Regler (fra `report.json`), Kp-stige, historik, RG-footer, a11y-spejl, quality tiers, FlashBudget, rolig tilstand med OS-chip, storage-banner, `#clean`-vandmærke. | Alle tal i UI'et er genereret. Luminans-test grøn. |
| **P7 Polish og levering** | Fuld Playwright-tur, size-check, final artifact, commit og push. | §11 er grøn. |

**Cut-liste (COULD, skæres i denne rækkefølge):**
1. Promo-klip: deterministisk frame-stepping plus ffmpeg til 1080p-MP4 (meget "Matt Shumer", men sidst)
2. Himmellog
3. Replay-UI (Spil-ID og CLI-replay beholdes)
4. `#attract`-kiosk
5. God rays og heat haze
6. Dendritisk frost-outro
7. Plasmawild 3x3 og domino-flip
8. Pointer-parallax og runtime gem-lighting

## 11. Verifikation

- **Math:** `npm run sim` giver fuld dekomponering, alle gates i §5 og stake-switch-adversary. `npm test` kører `rng` (referencevektorer), `cluster`, `engine.golden` (base og hel storm fra historik), `meter` (låst indsats, A/B/A+B, 365 dage, ingen ladning i storm), `schedule` (3 s, anticipation, WIN/RETURN-whitelist), `flashBudget`, `tiers`, `boundaries`/lint og `sim.quick` (golden).
- **Playwright** (`executablePath:'/opt/pw-browsers/chromium'`, args `--use-gl=angle --use-angle=swiftshader-webgl --enable-unsafe-swiftshader --ignore-gpu-blocklist`):
  - `__slot.advance(ms,{render:false})` med stoppet ticker, så der kun renderes ved shot-punkter. Capture-renderen ved 2.450 kører altid.
  - Fejler ved `pageerror` eller shader-fejl.
  - **Viewports:** 360×640, 375×667, 390×664, 390×844 og 1920×1080. Der tjekkes for overflow, og at RegStrip og footer er helt synlige.
  - **Shots:** splash, intro, idle, kaskade med x4, Retur, STOR GEVINST, Kp 7-himmel, cinematic ved t = 0,3 / 1,6 / 2,2 / 2,8 / 3,9 / 5,0 / 6,5, storm-idle, Stormbølge, summary, outro, rolig tilstand, regler og demo-skuffe.
  - **Skarphed:** et shot ved deviceScaleFactor 2 måler kant-gradient på et ciffer, som regression for filter-opløsningen.
  - **Capture-swap:** pixel-diff før og efter ved t = 2.450.
  - **`#clean&demo=solstorm`:** vandmærket er synligt.
  - **Luminans-trace** ved 480×270 (64×64 readPixels) over 20 seedede basisspin, time-lapse, level-up, cinematic og Stormbølge.
- **Performance:** headless tjekker kun korrekthed: CPU ≤ 4 ms pr. frame og heap-vækst ≈ 0 over 10 s idle. `#fps=1`-overlaget med GPU-timer-query er til Frederiks egen telefon.
- **Build:** `size-check.mjs` (≤ 2,5 MB, `<title>` i de første 8 KB, ingen eksterne hosts).
- **Levering:**
  - Load `artifact-design`-skillen før publicering, så sidens kontrakt følges.
  - Publicér `automat/dist/nordlys.html` som claude.ai Artifact. Den er gitignored, og linket kan åbnes på telefonen.
  - Commit og push `automat/` til `claude/casino-automat-ui-demo-odxmxe`.
- **Manuel smoke:** spil 50 spin, tryk demo midt i et spin, reload midt i en storm, rotér telefonen midt i en cinematic, og skjul fanen.

## 12. Risici og ansvarligt spildesign

| Risiko | Mitigering |
|---|---|
| Nordlyset ligner en fbm-screensaver | Gardin-søm, striationer, farve efter højde, Klint for skala. Iterér på `#scene`-shots. |
| Flade krystaller | Lit atlas, env-strip pr. tier, dispersion, kant-highlight. Bedøm i reel cellestørrelse. |
| 8x8 bliver rødt mudder | Cyan tal på mørke pills, ikke-vindere dimmes, FX bag symbolerne. Fejler 375×667-gaten, køres `GRID_EXTREME=7` og simulatoren igen. |
| Scope | Vertikal slice, checkpoint-artifacts, freeze ved 60 % og cut-listen. |
| Headless-GPU | SwiftShader bruges kun til korrekthed. Rigtig performance måles på Frederiks enhed. |
| Varemærket "NORDLYS" | Tjekkes af operatøren. |

**Ansvarligt spil:**
- Legepenge og "DEMO · LEGEPENGE" hele tiden.
- WIN/RETURN-profiler, så Spilpakke 1s LDW-forbud (2027) overholdes allerede nu.
- Ingen konstruerede near-misses. Anticipation-reglen er fast og logget.
- 3 s-cyklus, også i autospin, ingen turbo eller bonus buy. Autospin kræver en tabsgrænse og stopper ved hver terning, Ladet spin og Solstorm. Extreme optjenes altid i basisspillet.
- Kvit eller dobbelt gælder kun nye terninger (aldrig penge og aldrig terninger i kammeret): ét valg pr. tildeling, fair chancer, Behold er forvalgt, resultatet trækkes og gemmes ved valget og vises tidligst 3,0 s senere. Valget kan slås fra.
- Persistens og sjældenhed er fuldt oplyst, inkl. "≈ N spin i snit". Kp 8 har spænding, men ingen nedtælling; det er dokumenteret som et bevidst valg.
- Rolig og saglig tekst, aldrig "så tæt på".
- Demo-storme er mærket i canvas, tæller ikke og krediteres ikke.
- Session-tid og -netto vises altid. "Fortsæt" kræves efter storm og efter gevinster på 100× eller mere.

## Kritiske filer
- `automat/src/math/engine.ts`: normativ regelspec og outcome
- `automat/sim/tune.ts` og `automat/sim/run.ts`: tuning og beviste gates
- `automat/src/present/schedule.ts`: 3 s-gulv, WIN/RETURN og beats
- `automat/src/present/cinematics/solstormIntro.ts`: det virale øjeblik
- `automat/src/render/art/symbolBaker.ts` og `automat/src/render/grid/GridMesh.ts`: AAA-looket
- `automat/src/game/demo.ts`: demo-knappen
