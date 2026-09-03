# LYSBRUD

Visuel demo af et koncentrisk ring-slot til **Nordlys Casino**. Fem ringe roterer omkring
en central prisme; gevinster opstår når mindst tre ens symboler forbindes i en ubrudt kæde
— både langs ringene og på tværs af dem. Vindende symboler splintres, felterne fyldes igen,
og hver kaskade oplader reaktoren mod et visuelt klimaks.

Bygget uden afhængigheder: vanilla ES-moduler, Canvas 2D til spillet, DOM/CSS til
casino-chromet. **Ingen billed-, font- eller lydfiler** — al grafik er proceduralt tegnet og
al lyd er syntetiseret med WebAudio.

```
npm run serve     # http://localhost:8080/
npm test          # motor- og instruktørtests (119 + 25 asserts)
npm run build     # → dist/lysbrud.html (én selvstændig fil)
```

`dist/lysbrud.html` er hele spillet i én fil. Den kan åbnes direkte fra disk, lægges i en
`<iframe>` eller serveres som den er.

---

## Sådan er det bygget

| Fil | Ansvar |
| --- | --- |
| `src/config.js` | Eneste kilde til palette, symboler, geometri, matematik og timing |
| `src/rng.js` | Deterministisk mulberry32 + vægtede træk |
| `src/engine.js` | Bræt, nabograf, klyngesøgning, kaskader, reaktor — ren logik, kører i Node |
| `src/director.js` | Demo-instruktøren: former hvilke udfald spilleren faktisk ser |
| `src/wheel.js` | Hjulets geometri, celleplader, guldskinner, prismekerne |
| `src/fx.js` | Partikler, energikæder, flyvende tal, rystelser, bloom |
| `src/art/symbols.js` | Procedural symbolkunst + sprite-atlas |
| `src/art/backdrop.js` | Krystalhulen bag hjulet |
| `src/audio.js` | WebAudio-syntese |
| `src/ui.js` | DOM-laget: målere, overlays, modaler |
| `src/main.js` | Tilstandsmaskine, animationsløkke, spilflow |

`CONTRACT.md` er den låste modulkontrakt modulerne er skrevet imod.

### Geometri

Hjulet er målt op fra mockuppen: skinnerne ligger på 0,245 · 0,395 · 0,545 · 0,695 · 0,845 · 1,0
af hjulets radius, så alle fem ringe er lige tykke. Cellerne fordeler sig **12 · 16 · 20 · 24 · 28
= 100 celler**, hvilket holder hver celle næsten kvadratisk fra inderste til yderste ring.

Vinkel 0 er klokken 12 og vokser med uret. Ringene standser på **kontinuerte** vinkler — ikke
på hele celletrin — så forbindelsesmønstret mellem ringene er nyt hvert eneste spin. Det er
selve pointen med spillet: to celler i naboringe er forbundne når deres vinkelspænd overlapper
med mere end 80 % af den smalleste celles bredde.

---

## Matematikken

Alle tal nedenfor er **målt**, ikke anslået. Værktøjerne der målte dem ligger i `tools/`:

```
node tools/balance.mjs --spins 120000 --eps 0.8   # profil for den committede config
node tools/curve.mjs   --spins 60000              # kalibrerer gevinstkurven mod et RTP-mål
node tools/model.mjs                              # uafhængig model, fejer parameterrummet
```

### Basisspillet — 120 000 spins à 25 kr.

| | |
| --- | --- |
| RTP | **96,40 %** |
| Døde spins | 0,57 % |
| Kaskader pr. spin | 2,11 |
| Klynger pr. spin | 6,5 (gennemsnitlig størrelse 3,5) |
| Største gevinst i stikprøven | 522× indsats |
| Fordeling | <1×: 75,0 % · 1–5×: 22,2 % · 5–15×: 1,9 % · 15–60×: 0,29 % · 60–250×: 0,03 % |

Hyppigheden er høj og gevinsterne små — det er kaskadespillets natur, og det er derfor
gevinsttabellen er så stejl: en klynge på 3 betaler småpenge, mens 15+ betaler op til 467×.

### Hvorfor ni symboler og ikke seks

Mockuppen viser omkring seks tydelige farver. Med kun seks symboltyper på 100 celler
**falder brættet aldrig til ro**: hver farve dækker ~16 celler, hvilket ligger over
perkolationstærsklen for nabografen, så hver kaskade rammer over halvdelen af brættet og
kæden løber til loftet. Målt: RTP 29 782 %, nul døde spins, 13 kaskader pr. spin.

Ni symboltyper (og et vinkelkrav på 80 % overlap på tværs af ringene) bringer tætheden under
tærsklen. Derfor har hvert symbol nu både sin egen farve **og** sin egen silhuet, så en klynge
kan aflæses på begge — nødvendigt når 100 celler er i spil samtidig.

Vil man have en mere klassisk rytme med ~30 % døde spins, er der ét tal at skrue på:
`MIN_CLUSTER: 4` i `config.js`. Så er spillet ikke længere "mindst tre" som beskrevet, hvilket
er grunden til at 3 er standard.

### Demo-økonomi — læs denne

Basisspillet er ærligt kalibreret til 96,4 % RTP. **Prisme-bonussen er det ikke.** Den
udløses bevidst efter cirka 10 spins, så demoen faktisk når at vise den; en produktionsudgave
ville udløse den hver 250.–350. spin. En bonusrunde giver i gennemsnit ~660× indsats
(median 395×, p99 ~4 600×, målt max 21 254× på 3 000 runder), og med den udløsningsfrekvens
er den samlede målte tilbagebetaling derfor langt over 100 %.

To tal flytter det til produktionsniveau, og intet andet skal røres:

* `prism`-vægtene i `REEL_WEIGHTS` (i dag 0,42–0,75 pr. ring) → cirka 0,05
* eventuelt `BONUS.steps`-toppen (i dag 15×) hvis bonussen skal være mindre

`BONUS.wildColorMinTier` er ikke pynt: vælger kernen en hyppig farve, kommer hver
farves delgraf over perkolationstærsklen, hele brættet bliver forbundet, og kaskaderne
løber i loft. Kernen vælger derfor kun blandt de sjældnere farver.

Bonusrunden er også grunden til at mockuppens 248 750 kr. på en indsats på 25 kr. (9 950×)
er et realistisk tal i dette spil og ikke bare et pænt mockup-tal — det ligger omkring
p99,8 i bonusfordelingen.

---

## Demo-instruktøren

`director.js` afgør hvilke udfald spilleren ser. Den erstatter ikke motoren — den
afvisningssampler rigtige udfald indtil et af dem rammer det beat, sekvensen kalder på:

* spin 1 lærer mekanikken: lille gevinst med mindst to kaskader
* spin 2–3 giver variation, herunder mindst ét dødt spin
* prismemåleren når 4/5 og udløser mindst én *anticipation* før bonussen
* bonussen er garanteret inden for de første 10 spins
* mindst én gevinst ≥ 60× inden for de første 15 spins
* aldrig to mega-gevinster i træk

Beat-arket ligger som en datastruktur øverst i filen — det er dét, man redigerer for at ændre
demoens tempo. Slås **Instrueret demo** fra i indstillingerne, køres rå RNG uden formning.

---

## Hvad der er taget fra mockuppen

Mockuppen er brugt som **målestok, ikke som asset**. Der ligger ingen billedfiler i spillet.
Ringradier, cellefordeling, palette, panelernes proportioner og typografien er målt ud af de
to screenshots (bl.a. ved at rulle hjulet ud i polære koordinater — se
`reference/crops/polar_half.png`), og alt er derefter tegnet forfra i kode, så det skalerer
til enhver opløsning. Referencerne ligger i `reference/` udelukkende til sammenligning.

---

## Ydelse

Målt i headless Chromium uden GPU (software-rasterisering, 4 kerner), 1400×820:
**60 fps i hvile, 51 fps under fuld partikelbelastning.** En rigtig maskine med
GPU-komposition ligger over det.

Det kostede én rettelse at komme dertil. Bloom-passet var oprindeligt to fuldskærms
`filter: blur()`-blits, og alene det kostede 33 fps — resten af scenen kørte 60. Nu
sløres der i 0,36× opløsning og skaleres op bagefter: samme udseende, cirka en ottendedel
af rasteriseringsarbejdet. `tools/qa-layers.mjs` slår hvert tegnelag fra ét ad gangen og
måler forskellen, hvis nogen skal gøre øvelsen igen.

Resten af budgettet holdes af prærendering: hver rings celleplade og hvert symbol tegnes
én gang til et offscreen-lærred og stemples derefter, så en frame er ~200 `drawImage`-kald
frem for tusindvis af stier.

## Tilgængelighed og drift

* Fuldt responsiv fra 1672 px ned til 390 px; sidebar og sidepaneler kollapser undervejs
* Mellemrumstasten spinner; alle kontroller er tastaturnavigerbare med synlig fokusring
* `prefers-reduced-motion` respekteres, og **Reducer bevægelse** kan slås til manuelt
* Lyden starter først efter et brugerklik (browserpolitik) og kan slås fra
* Ingen netværkskald, ingen cookies, ingen sporing

Demoversion uden rigtige penge. 18+ · Spil ansvarligt.
