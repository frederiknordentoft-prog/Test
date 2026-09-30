# Talvennerne 2: design for kunst, lyd og teknik

Scope: art direction, dyre-rig, garderobe, asset- og lydpipeline, lagring, arkitektur, test og eksekvering. Alle beslutninger holder sig til brugerens låste valg.

Fakta bag dokumentet (tjekket, intet ændret):
- **V1-koden:** læst på branch `claude/math-app-children-ios-4jihdr`.
- **Deploy-regler:** `CLAUDE.md` og `deploy-app.sh` er læst fra `main`.
- **Oversigts-branchen `claude/wc2026-tournament-app-k42mv8`:** har 9 app-mapper (element-sandbox, elpriser, kuglebanen, surdej, talvennerne, traeningslog, vaegtskaalen, vindtunnel, vm). Forsidens lead er "Ni web-apps, hver på sin egen side."
- **CoRal-modelkortet:** stemmerne Mic og Nic. Modellen understøtter ikke `exaggeration`. Lange tekster skal deles i sætninger. Modellen er Chatterbox Multilingual og indlæses med `ChatterboxMultilingualTTS.from_local(dir)` og `language_id="da"`.
- **Pakker:** `chatterbox-tts` 0.1.7 låser `torch==2.6.0` og medbringer `pyloudnorm`.
- **Netværk:** PyTorch' CPU-index svarer 200. `ffmpeg-static` 5.3.0 henter ffmpeg 6.1.1 fra GitHub-releases.
- **Talegenkendelse:** CoRal har også dansk ASR, `roest-v3-wav2vec2-315m` og `roest-v3-whisper-1.5b`.
- **Maskine:** containeren har 4 vCPU, 15 GB RAM og 30 GB fri disk.

---

## 0. Beslutninger i én tabel

| Beslutning | Valg | Hvorfor |
|---|---|---|
| Placering af kode | Ny selvstændig Vite-app i `talvennerne2/` på den nuværende branch. Motoren kopieres fra V1, den importeres ikke. | V1's filer, tsconfig og vitest-include (`src/**`) forbliver urørte. Mappenavnet svarer til deploy-slug. |
| Dyrestil | Siddende, front-vendt chibi med **flad cel-skygge** i to toner, farvede konturer og højlys. Ingen blur eller filtre. | Skarpt ved alle størrelser og billigt at tegne på gamle iPads. Tøjet passer på alle arter. |
| Kropsskabeloner | 3 skabeloner: `round`, `pear`, `tall`. | Med kun én positur ligner hest og pingvin "en kat i kostume". |
| Opgradering af dyr | 3 vækststadier (baby, ung, voksen) som parametre på samme rig. | Ankrene genberegnes, så tøjet passer på alle stadier. |
| Skrift | Nunito Variable, selvhostet, kun latin-subset. | Rund, læsbar, har æøå og tabeltal. Én skriftfamilie er mest konsekvent. |
| Tema | Kun lyst tema, "papir og himmel". | Premium og skoleagtigt. Én tilstand at kvalitetssikre. |
| Ikoner | Eget SVG-sæt på ca. 50 ikoner i 24-grid, ingen emoji (håndhæves af test). | Ens udtryk, og intet afhænger af iOS' emoji-version. |
| Animation | CSS-keyframes på `transform`/`opacity` for dyrene. `motion` (LazyMotion + domAnimation) kun til skærmovergange. | Lav CPU-belastning og lille bundle. |
| Stemme | CoRal `roest-v3-chatterbox-500m`. Én stemme til alt, valgt ved objektiv probe (se 5.4). | Højeste danske MOS (4,23). OpenRAIL-licens. |
| Tal 0-1000 som lyd | 0-100 og hele hundreder som hele klip. 101-999 sammensættes af et hoved ("tre hundrede og") og en hale ("syvogfyrre"). | Knap 120 talklip i stedet for 1001. Prosodigrænsen ligger naturligt ved "og". Alle 899 sammensætninger ASR-testes. |
| Lydformat | MP3 40 kbps CBR, 24 kHz mono, sprites pr. domæne, kodet med `ffmpeg-static`. | Afspilles overalt på iOS. Ca. 5,5 MB i alt, lazy-loaded. |
| Udtaletjek | `roest-v3-wav2vec2-315m` som gate for alle klip. `roest-v3-whisper-1.5b` som second opinion på fejlede klip. | Hurtig på CPU. CTC-modellen skriver tal som ord. |
| Lagring | Dexie 4 (IndexedDB), database `talvennerne2`. localStorage kun til `tv2:*`-nøgler. | Svarlog og aggregater kræver indeks og skema-migrationer. |
| Motorudvidelse | `SkillDef`-registry, auto-registreret med `import.meta.glob`. | Erstatter V1's 8 `switch(skill)`-steder. Parallelle agenter redigerer aldrig samme fil. |
| Svartype | `AnswerValue = number \| string` med lighed via `===`. | Klokken er minutter, penge er øre, figurer og brøker er tokens. Serialisering er triviel. |
| Service worker | Ingen. | Repoets regel. Rodens `sw.js` er en kill-switch, der sletter alle caches på origin. |

---

## 1. Art direction og designsystem

### 1.1 Stil og udfordring af hypotesen
- **Jeg er enig i siddende front-vendt chibi:** hovedet er ca. 45 % af figurens højde og 1,05-1,15 gange kroppens bredde. Fælles ankre gør, at tøj og animationer virker på alle arter.
- **Jeg er uenig i "blød skygge":**
  - Gradienter og feGaussianBlur på hver krop bliver dyre på en A10-iPad, når de animeres, og ser mudrede ud ved 48 px.
  - I stedet bruges flad cel-skygge: grundfarve, skyggeform i `shade`-tonen (en halvmåne nederst til højre, klippet til kroppen), 1-2 højlys-ellipser i hvid med 40 % alfa og en farvet kontur.
  - Kun jordskyggen bruger en radialGradient.
- **Artsidentitet skal komme fra silhuetten:** hovedform, ører, snude og hale bærer identiteten, ikke farven. Det håndhæves med en blind silhuettest (4.3).
- **Baggrunde** har lavere kroma end figurerne (højst 60 %) og luftperspektiv, så de fjerne lag er lysere og blålige. Figurerne springer altid frem.

### 1.2 Palet (tokens i `src/ui/design/tokens.css`, Tailwind 4 `@theme`)

| Token | Hex | Brug |
|---|---|---|
| `--c-ink` | #2B2144 | Tekst, pupiller og konturer på UI. Aldrig ren sort. |
| `--c-ink-2` | #5E5478 | Sekundær tekst |
| `--c-paper` | #FFF8EC | App-baggrund |
| `--c-card` | #FFFFFF | Kort |
| `--c-line` | rgba(43,33,68,.10) | Kanter |
| `--c-primary` / `--c-primary-deep` | #6C4CF5 / #4A2FC9 | Brand, primærknap og knappens underkant |
| `--c-sky-from` / `--c-sky-to` | #BFE6FF / #FFF3D6 | Standardhimmel |
| `--c-good` | #22B573 | Rigtigt |
| `--c-oops` | #FFB020 | "Ikke helt". Rød bruges aldrig som fejlfarve. |
| `--c-star` | #FFC83D | Stjerner |

Domænefarver bruges til kort, regioner og dashboard, altid sammen med label og ikon:

| Domæne-id | Dansk | Farve |
|---|---|---|
| `numbers` | Tal og titalssystem | #2F7DF6 |
| `addsub` | Plus og minus | #F2994A |
| `muldiv` | Gange og division | #9B51E0 |
| `shapes` | Former | #27AE60 |
| `clock` | Klokken | #EB5757 |
| `money` | Penge | #E0B020, med tekst i ink |
| `measure` | Måling | #2DB7B0 |
| `fractions` | Brøker | #E056A0 |

Sjældenhedstiers er kun visuelle. De tildeles deterministisk via mestring og aldrig tilfældigt, så der er ingen loot-box-mekanik:

| Tier | Farve |
|---|---|
| `common` | #CDBFA8 |
| `rare` | #4FB0FF |
| `epic` | #B574FF |
| `legendary` | #FFB02E, med en statisk glimmer-overlay |

### 1.3 Typografi
- **Pakke:** `@fontsource-variable/nunito`. Kun `latin-wght-normal.woff2` importeres (budget ≤ 60 KB).
- **Indlæsning:** `font-display: swap`. Preload af woff2-filen i `index.html`.
- **Skala (phone/iPad):**
  - Opgavetal: 56/72 px, vægt 900, `font-variant-numeric: tabular-nums`.
  - Overskrift: 28/34 px, vægt 900.
  - Knaplabel: 22/26 px, vægt 800.
  - Brødtekst: 17/19 px, vægt 600.
  - Dashboard-brødtekst: 15 px, vægt 600.

### 1.4 Eget ikonsæt
- **Filer:** `src/ui/design/icons.ts` er et datakort `{ [name]: { stroke: string[]; fill?: string[] } }`. `Icon.tsx` renderer `<svg viewBox="0 0 24 24">`.
- **Tegneregler:** stroke 2 med runde ender og samlinger. Duotone-fyld er `currentColor` med 18 % opacitet.
- **Sættet (ca. 50):**
  - Navigation: home, map, play, pause, close, back, next, check, retry, speaker, speaker-off, ear (gentag spørgsmål), lightbulb (hint), info, question.
  - Belønninger: lock, unlock, star, star-fill, heart, egg, gift, sparkle, crown, medal, trophy.
  - Garderobe og samling: bag (butik), hanger (garderobe), book (album), house (hjem).
  - Profiler og data: child, parent, profile-add, trash, export, import, chart, calendar, print, gear.
  - Matematik: plus, minus, times, divide, equals, clock, coin, ruler, scale, shapes, fraction-pie, cube, hundred-board.
- **Emoji-forbud:** en Vitest-test scanner `src/**` for `\p{Extended_Pictographic}` og fejler ved fund.

### 1.5 Komponenter og bevægelse
- **Primærknap `Button.Primary`:**
  - Højde 72 px (phone) eller 88 px (iPad), radius 24, fyld primary.
  - "Læbe" nedenunder: `box-shadow: 0 6px 0 var(--c-primary-deep)`.
  - Tryk: `translateY(4px)` og læben ned til 2 px på 80 ms. Slip: fjeder tilbage på 180 ms plus `sfx.tap`.
- **Svarknap:** mindst 80×80 px, hvidt kort med 3 px ink/10-kant og tal på 44-56 px.
- **Alle trykmål** er mindst 60×60 px.
- **Kort:** radius 28, padding 20, skygge `0 2px 0 rgba(43,33,68,.06), 0 12px 32px rgba(43,33,68,.10)`.
- **Sheets** glider ind nedefra med fjeder (stivhed 380, dæmpning 32).
- **Bevægelsestokens:**
  - Varigheder: `--dur-fast 120ms`, `--dur-base 220ms`, `--dur-slow 400ms`.
  - Easing: `--ease-out cubic-bezier(.2,.8,.2,1)`.
- **Skærmskift:** skub 24 px og fade på 220 ms. Ledsagerdyret bevares mellem skærme via `layoutId`.
- **Reduced motion:** kun crossfade på 120 ms, og dyrenes loops stoppes. Blink beholdes.
- **Belønningskoreografi i tre takter:**
  - Forventning (400 ms): wobble og lysring.
  - Afsløring (250 ms): pop og partikelburst.
  - Hvile (600 ms): dyret laver et glad-hop, og navnet læses op.

### 1.6 Scener og matematikmaterialer (samme stil)
- **Verdensscener:** 4 parallakselag i SVG med højst 60 elementer pr. lag. Kun 2-3 ambiente loops (skyer og blade) med translate.
- **Mønter** i korrekte relative størrelser og farver:

  | Mønt | Diameter | Farve og hul |
  |---|---|---|
  | 50 øre | 21,5 mm | Kobber #C8793E, intet hul |
  | 1 kr | 20,25 mm | Sølv #C9CED6, med hul |
  | 2 kr | 24,5 mm | Sølv, med hul |
  | 5 kr | 28,5 mm | Sølv, med hul |
  | 10 kr | 23,35 mm | Guld #D9B44A, intet hul |
  | 20 kr | 27 mm | Guld, intet hul |

  Værdien står som tal på mønten. Kroner og monogram kopieres ikke.
- **Sedler:** 50 lilla, 100 orange, 200 grøn, 500 blågrå. Stiliserede, uden broer eller portrætter, og med lille tekst "legepenge". 1000-sedlen findes ikke.
- **Ur:**
  - Urskive med 12 tal og 60 streger tegnet som én path.
  - Den lille viser er kort og tyk i ink. Den store viser er lang og tynd i #EB5757.
  - Digitalt ur i Nunito med tabeltal.
- **Lineal:** cm-streger og mm-streger som én path, tal 0-15.
- **Former:** plane figurer har 3,2-stroke og grøn toning. Rumlige figurer (kugle, terning, kasse, cylinder, kegle, pyramide) tegnes isometrisk med 3 toner: top lys, venstre mellem, højre mørk.
- **Andre materialer:** geobræt med 5×5 søm og spejllinje stiplet.
- **Multibase** er isometrisk. Gitterlinjer tegnes altid som én path, så en hundredplade er 2 elementer.

---

## 2. Dyre-rig

### 2.1 Koordinatsystem og skelet
Kanvas: `viewBox="0 0 200 240"`, jordlinje y=226, sikker zone x∈[6,194] og y∈[4,234]. Standardankre for stadie 2 (ung) med skabelonen `round` er vist nedenfor. Hver art kan overskrive dem, og `computeAnchors(species, stage)` returnerer det endelige sæt.

| Anker | Standard | Bruges af |
|---|---|---|
| `headCenter`, `headRx/Ry` | (100,96), 56/50 | Hoved, mønstre |
| `headTop`, `headWidth` | (100,48), 104 | Slot `head` |
| `earBaseL/R`, `earGap` | (70,58)/(130,58), 60 | Ører, hat-klemning |
| `hornBase` | (100,50) | Horn |
| `eyeL/eyeR` | (78,100)/(122,100) | Øjne, slot `face` |
| `muzzle`, `mouth`, `cheekL/R` | (100,120), (100,128), (66,118)/(134,118) | Ansigt |
| `neck`, `neckWidth` | (100,146), 58 | Slot `neck` |
| `bodyCenter`, `bodyRx/Ry`, `bodyWidth` | (100,182), 50/44, 100 | Slot `body` |
| `chest` | (100,170) | Medaljer |
| `back` | (100,168) | Slot `back`, vinger |
| `pawL/pawR`, `handRot` | (76,206)/(124,206), −20° | Slot `hand` (højre pote) |
| `footL/footR` | (70,222)/(130,222) | Fødder |
| `tailBase` | (146,208) | Hale |

**Kropsskabeloner** (`art/rig/bodies.ts`) er funktioner fra `(rx, ry, bias)` til en body-path:
- `round`: kanin, kat, hamster, panda, lam.
- `pear`: pingvin, sæl, egern, pindsvin, ugle (ugle er egg-variant, hvor hoved og krop smelter sammen; hovedankrene er virtuelle).
- `tall`: hest, enhjørning, pegasus, hvalp, ræv, drage.

**Vækststadier:**
- Stadie 1 (baby): hoved ×1,08, krop ×0,85, øjne ×1,15, figuren skaleres ×0,86 om fodpunktet.
- Stadie 2 (ung): standard.
- Stadie 3 (voksen): hoved ×0,96, krop ×1,08, manke og hale ×1,3, horn ×1,25, vinger ×1,2.

Ankrene beregnes af de samme transformationer, så tøj aldrig skal justeres pr. stadie.

### 2.2 Delkomponenter og lagorden
`art/rig/Rig.tsx` renderer lagene i fast rækkefølge. Hvert lag er en `<g class="p-<navn>">` med CSS-pivot sat fra ankrene.

| # | Lag | Kilde |
|---|---|---|
| 1 | `shadow` (jordskygge) | Rig |
| 2 | `back-item` (kappe bagside, rygsæk, vinger fra tøj) | Slot `back` |
| 3 | `wings` (egne vinger), `tail` | Art |
| 4 | `feet` | Art |
| 5 | `body` + `body-pattern` (clipPath til krop) + `body-shade` | Rig + art |
| 6 | `body-item` (klippet til kroppen, se 3.2) | Slot `body` |
| 7 | `hand-item` | Slot `hand` |
| 8 | `paws` (poten ligger over håndtaget) | Art |
| 9 | `neck-item` | Slot `neck` |
| 10 | `mane-back` | Art |
| 11 | `head` + `head-pattern` + `head-shade` | Art |
| 12 | `face`: øjne, snude, mund, kinder | Rig (husets øjne og mund) + art (snude) |
| 13 | `face-item` | Slot `face` |
| 14 | `mane-front` (pandelok) | Art |
| 15 | `head-item` (hattens bagdel først, så forreste skygge) | Slot `head` |
| 16 | `ears`, `horn` (ligger over hatten, se 3.2) | Art |
| 17 | `fx` (statisk glimmer på legendary) | Rig |

**Delbiblioteket** er delt i to:
- **Husets dele (frosset efter gate G1, ejes af rig-agenten)** ligger i `art/parts/house.tsx`:
  - Øjne: store lodrette ovaler, pupil i #2B2144, to højlys (stort øverst til venstre, lille nederst til højre) og en subtil iris-ring i artens accentfarve.
  - Øjenformer: `open`, `happy` (^), `closed` (–), `half`, `sparkle`.
  - Munde: `smile`, `cat-w`, `open-D`, `o`, `wobble`.
  - Kinder, jordskygge og kropsskabeloner.
- **Artsspecifikke former** (ører, snude, hale, manke, horn, vinger, pletter) bor i artens egen fil. Det giver ingen fælles filer mellem art-agenterne.

### 2.3 Varianter, farver og mønstre
- **Farveafledning:** `art/rig/palette.ts` indeholder en OKLCH→sRGB-funktion på ca. 40 linjer. Fra `fur` afledes:
  - `outline` = L×0,55, C×1,1.
  - `shade` = L−0,08, h−5.
  - `belly` = L+0,12 (maks 0,97), C×0,4.
  - `highlight` = hvid med 40 % alfa.

  Ingen rå hex-farver uden for palette-filerne (lint i 4.2).
- **Colorways pr. art:** 6 naturlige (fx kat: rød, grå, sort-hvid, tigerstribet, calico, creme) plus 3 fælles magiske:
  - `stardust`: dyb blå med stjernepletter.
  - `rainbow`: pastel-gradient i manke og hale. Det er den eneste tilladte statiske gradient.
  - `gold`: guld med glimmer-fx.

  Det giver 16 × 9 = 144 samleobjekter.
- **Mønstre** er static clipPath til krop og hoved: `tabby`, `spots`, `eye-patch`, `socks`, `blaze`, `belly`, `calico`, `panda`, `stars`.
- **Konturbredde:** 3,2 enheder, altså 1,6 % af bredden.

### 2.4 Animationstilstande
`<Rig mood="…">` sætter `data-mood` på rod-svg. Keyframes ligger i `art/rig/rig.css` og rammer `.p-*`-grupper med `transform-box: view-box` og pivot som px-koordinater fra ankrene. Tilfældig fase pr. instans sættes via `--phase`.

| Tilstand | Dele og bevægelse |
|---|---|
| `idle` | Krop scaleY 1→1,025 på 3,2 s. Hoved translateY −1,5 med 0,15 s forsinkelse. Hale ±6° på 2,4 s. |
| blink (altid) | Øjne scaleY→0,1 i 120 ms, periode 4,3-5,9 s pr. instans |
| `earTwitch` (inde i idle) | Ét øre roteres ±8° i 250 ms hvert ca. 7. sekund |
| `happy` | Hop: translateY −18 med squash og stretch, 600 ms × 2. Øjne `happy`, mund `open-D`, hale ±14°. |
| `cheer` (stor sejr) | Happy + rotation ±4° + fx-burst fra UI |
| `think` | Hovedet tippet 8°, øjnene kigger op til højre (pupil-translate), tanke-prikker (3 cirkler) |
| `oops` (efter fejl) | Øre −10°, øjne `half`, mund `smile`, lille nik. Opmuntrende, ikke straffende. |
| `sad` (kun i hjem-scenen, fx når dyret "savner" barnet ved start) | Ører +20° nedad, hovedet tippet 6°, halen stille |
| `sleep` | Øjne `closed`, langsom ånding 5 s, "z" i 3 cirkler |
| `wave` | Højre pote roteres om skulderpivot −35°↔−10°, 3 gange |

### 2.5 Ydeevneregler (håndhæves)
- **Forbudte SVG-elementer:** `filter`, `mask`, `foreignObject`, `<image>` og `<text>` i art. Statisk scan i test.
- **Elementbudget:** højst 90 elementer pr. art og stadie, højst 25 pr. genstand. Gentagne streger samles i én path.
- **Kun `transform` og `opacity` animeres.** Rod-svg'en for ledsageren får `will-change: transform`.
- **Samtidige animationer:** højst 3 dyr med animerede dele på skærmen ad gangen.
- **Album og butik:** statisk render (`data-static` slår loops fra) i en container med `content-visibility: auto`.
- **Målekrav:** Chromium med 4× CPU-throttle skal holde p95 frametid ≤ 20 ms på skærmen med opgave, ledsager og partikelburst, og ≥ 50 fps i album-scroll med 60 dyr.

### 2.6 Roster i bølger
16 arter:

| Bølge | Arter | Formål |
|---|---|---|
| 1 | kanin | Guldstandard for stilen |
| 2 (brugerens favoritter) | kat, hest, enhjørning | Højeste prioritet |
| 3 | hvalp, ræv, panda, egern, hamster, lam, pegasus, ugle | Resten af kernerosteren |
| 4 | pindsvin, pingvin, sæl, baby-drage | Afrunding |

- Arter med egne vinger (pegasus, drage, ugle) har `occupies: ['back']`, så `back`-slottet er låst for dem. UI'et forklarer det med ikon.
- Alle arter bruger kanin-arkets proportioner som reference.

### 2.7 TypeScript-kontrakt (`art/rig/types.ts`)
```ts
type Slot = 'head' | 'face' | 'neck' | 'body' | 'back' | 'hand'
type Stage = 1 | 2 | 3
interface SpeciesDef {
  id: string; name: string; nameClip: string; family: 'lagomorph'|'feline'|'equine'|'canine'|'bear'|'rodent'|'bird'|'ovine'|'marine'|'reptile'|'insectivore'
  body: 'round' | 'pear' | 'tall'
  anchors?: Partial<AnchorSet>                 // overskriv standard
  occupies?: Slot[]                            // fx pegasus: ['back']
  colorways: Colorway[]                        // 6 naturlige; magiske tilføjes af rig
  parts: { Ears?: Part; Muzzle: Part; Tail?: Part; ManeBack?: Part; ManeFront?: Part; Horn?: Part; Wings?: Part; Feet: Part; Paws: Part; Head?: Part; Patterns?: Record<string, Part> }
}
type Part = (p: { pal: Palette; a: AnchorSet; stage: Stage; mood: Mood }) => JSX.Element
```

---

## 3. Garderobe

### 3.1 Definition af en genstand (`art/items/<set>/<id>.tsx`)
```ts
interface ItemDef {
  id: string                 // 'hat.pirate' – permanent
  set: string; slot: Slot; name: string; nameClip: string
  tier: 'common'|'rare'|'epic'|'legendary'
  unlock: { kind: 'shop'; price: number } | { kind: 'mastery'; skill: string; medal: 'bronze'|'silver'|'gold' } | { kind: 'milestone'; id: string }
  colorways: { id: string; main: string; trim: string; accent: string }[]   // 2-4
  art: { front: ItemArt; back?: ItemArt }     // tegnet om (0,0) = anker, ved reference headWidth 104 / bodyWidth 100
  fit: { anchor: AnchorName; scaleBy: 'headWidth'|'bodyWidth'|'neckWidth'|'fixed'; baseScale: number; baseWidth: number
         earMode?: 'through'|'under'; overrides?: Record<string /*speciesId|family*/, { dx?: number; dy?: number; scale?: number; rot?: number }> }
  hides?: ('mane-front'|'ears')[]              // fx fuld vinterhue skjuler pandelok
}
```
Genstandens kontur afledes af `main` med samme regel som dyrene, så genstanden matcher stilen automatisk.

### 3.2 Fit-algoritme (`art/rig/fit.ts`, ren funktion, testet)
1. Find ankeret og skalér: `s = baseScale × (anchors[scaleBy] / reference)`.
2. For hovedbeklædning med `earMode: 'under'` (krone, festhat, kokkehue): `s = min(s, earGap × 1,15 / baseWidth)`, så hatten sidder mellem ørerne. Ører og horn ligger i lag 16 over hatten. En enhjørning med piratgat får altså hornet gennem hatten, med vilje.
3. `earMode: 'through'` (hue, kasket) er standard. Ørerne tegnes over skyggen og ser ud til at stikke gennem huller.
4. Overrides slås op pr. art og derefter pr. familie. Mål: højst 10 % af par (genstand, art) må have en override.
5. **Kropstøj klippes til kroppen:**
   - Tøjet tegnes som en for stor form med krave, søm og detaljer.
   - `<clipPath>` er artens body-path udvidet 2 enheder (en stroke-udvidet kopi).
   - Bagefter streges kroppens kontur igen med tøjets `outline`-farve, klippet til tøjets område.

   Én skjorte passer dermed på alle 16 arter. Hver kropsgenstand leverer 3 grundformer, én pr. kropsskabelon, så hals- og skulderlinjen er rigtig.
6. **Hånd:** genstanden placeres ved `pawR` med `handRot`. Poten tegnes bagefter (lag 8), så den "griber" om håndtaget. Luffer og vinger får ankret på spidsen.
7. **Øjenregel:** ingen genstand må dække øjnene. Undtagelse er `face`-briller, som har glas med højst 25 % opacitet. Det tjekkes automatisk med bbox-overlap mod øjen-ellipserne.

### 3.3 Katalog
- **9 sæt × 8 genstande = 72.** Et sæt dækker alle 6 slots plus 2 ekstra. Sættene er Pirat, Slot (prinsesse/prins), Astronaut, Fodbold, Vinter, Ridder, Kok, Detektiv og Skole.
- **8 "Mester"-genstande kan kun fås via guld-medalje pr. domæne.** Eksempler: regnestok-scepter, vinkelmålerkrone, urkæde, møntmedalje. De bedste præmier kræver altså, at barnet kan noget.
- **I alt 80 genstande**, hver med 2-4 colorways.

---

## 4. Asset-pipeline og kvalitetssikring

### 4.1 Fra kilde til PNG
- **Kilde:** håndskrevet TSX (arter, genstande, ikoner, scener, materialer). Ingen binære billedfiler undtagen app-ikoner, der renderes fra riggen.
- **Sheet-build:** `vite build --mode sheets` definerer `__SHEETS__` og bygger `src/dev/SheetApp.tsx`, som tree-shakes væk i produktion. Ruterne er:
  - `?sheet=species&id=rabbit`: alle colorways × 3 stadier × 10 tilstande.
  - `?sheet=sizes&id=rabbit`: 48, 96 og 256 px.
  - `?sheet=silhouettes`: alle arter, fyld sort, tilfældig rækkefølge, uden navne.
  - `?sheet=lineup`: alle arter side om side i stadie 2 til proportionstjek.
  - `?sheet=fit&item=hat.pirate`: genstanden på alle 16 arter × 3 stadier.
  - `?sheet=fitmatrix&species=horse`: arten med alle 80 genstande.
  - `?sheet=filmstrip&id=cat&mood=happy`: 8 frames, samplet med `animation-play-state: paused` og negative `animation-delay`.
  - `?sheet=icons`, `?sheet=materials`, `?sheet=screens`.
- **PNG'er:** `scripts/sheets.mjs` genbruger V1's `scripts/browser.mjs` (Chromium via proxy), kører mod `vite preview --port 4300` og skriver PNG'er med `deviceScaleFactor: 2` til `artifacts/sheets/…` (gitignored).

### 4.2 Automatiske lints (Vitest og Playwright, deterministiske)
Scan-tjek i Vitest:
1. Forbudte SVG-elementer (2.5).
2. Rå hex-farve uden for `palette.ts` og `colorways`.
3. Emoji.

Tjek i Chromium via `getBBox` (Playwright):

4. Hver del ligger inden for den sikre zone.
5. Elementbudget pr. art, stadie og genstand.
6. Alle ankre er defineret og endelige (ingen NaN).
7. Fit-matrix: genstandens bbox ligger inden for artens "fit hull" + 6 enheder, og øjen-overlap overholder reglen i 3.2.
8. Visuel regression: `pixelmatch` mod godkendte baseline-PNG'er i `talvennerne2/test/baselines/` med tærskel 0,1 % af pixels. Ny baseline kræver godkendt review.

### 4.3 Multimodalt review i løkke
- **Adskilte roller:** reviewer-agenten er aldrig forfatteren. Den får PNG plus rubrik (`talvennerne2/docs/art-rubric.md`) og returnerer JSON: score 1-5 pr. kriterium og en konkret fejlliste med koordinater.
- **Kriterier (10):**
  1. Genkendelighed ved 48 px.
  2. Silhuettens særpræg.
  3. Proportioner mod kanin-referencen.
  4. Konturkonsistens.
  5. Paletharmoni.
  6. Ansigtets appel.
  7. Tøjpasform.
  8. Pivot og animation (filmstrip).
  9. Læsbarhed i butikskort (64 px).
  10. Samlet "AAA-finish".
- **Accept:** alle kriterier ≥ 4 og middel ≥ 4,3. Højst 4 iterationer, derefter eskaleres til integratoren.
- **Blind silhuettest:** en frisk agent uden navneliste identificerer alle arter fra silhuet-arket. Kravet er ≥ 15/16 rigtige, og den forvekslede art redesignes.
- **Skærme** reviewes i 3 viewports: iPhone SE 375×667, iPhone 15 393×852 og iPad 820×1180 på langs og tværs. Samme rubrik bruges, suppleret med overflow, kontrast og trykmål.

### 4.4 Hvornår er noget færdigt
**Et dyr er færdigt**, når alt dette holder:
1. Alle 3 stadier × 9 colorways × 10 tilstande renderer uden konsolfejl.
2. Alle lints i 4.2 er grønne.
3. Fit-matrixen mod alle genstande er automatisk grøn, og reviewet giver ≥ 4 på pasform.
4. Rubrikken er bestået (alle ≥ 4, middel ≥ 4,3).
5. Arten er identificeret korrekt i den blinde silhuettest.
6. Arten er læsbar ved 48 px.
7. Navneklippet findes og har bestået ASR.
8. Baseline-PNG er godkendt og committet.
9. 12 animerede instanser giver p95 ≤ 20 ms ved 4× throttle.

**En genstand er færdig**, når:
- Den passer på ≥ 90 % af de 16 arter uden override, og de resterende er rettet med override.
- Den har højst 25 elementer og 2-4 colorways.
- Navneklippet findes.
- Rubrikken giver ≥ 4.
- Den er læsbar i butikskort ved 64 px.
- Øjenreglen er overholdt.

**Et ikon er færdigt**, når det er i 24-grid, har stroke 2, er læsbart ved 20 px og er bestået i icon-sheet-review.

**En skærm er færdig**, når:
- Den holder ved 3 viewports uden overflow.
- Tekstkontrasten er ≥ 4,5:1.
- Trykmål er ≥ 60 px.
- Den har ingen emoji.
- Rubrikken giver ≥ 4.

---

## 5. Lydpipeline

### 5.1 Installation (fase 0, uden for repoet)
```
python3 -m venv /opt/tv2-tts
/opt/tv2-tts/bin/pip install --index-url https://download.pytorch.org/whl/cpu torch==2.6.0 torchaudio==2.6.0
/opt/tv2-tts/bin/pip install chatterbox-tts==0.1.7 huggingface_hub transformers soundfile
snapshot_download('CoRal-project/roest-v3-chatterbox-500m', allow_patterns=['*.safetensors','*.json','*.pt','audio_samples/00_*'])
snapshot_download('CoRal-project/roest-v3-wav2vec2-315m')
```
- `chatterbox-tts` 0.1.7 låser `transformers==5.2.0`. ASR køres derfor i samme venv. Hvis versionen ikke passer til wav2vec2-modellen, bruges en separat venv `/opt/tv2-asr`.
- `torch.set_num_threads(3)`, så én kerne er fri til de andre agenter.
- **Encoder:** `ffmpeg-static` 5.3.0 som devDependency. Gate G0 kører `ffmpeg -encoders | grep libmp3lame`. Reserve er apt-pakken `ffmpeg` fra Ubuntu-spejlet.
- **Stemmeprompt:** referencelyden er `audio_samples/00_<voice>_01_…wav` (Københavnssætningen, ca. 9 s).
- **Stemmevalg:** probe-sættet er 12 sætninger (tal, klokken, penge, instruktion og ros) i både Mic og Nic. Vinder er stemmen med lavest samlet CER. Står det lige, vælges **Nic**. Brugeren får de 24 probeklip på lyttesiden, inden batch-kørslen starter.

### 5.2 Tekstlag, fælles for runtime og byggescripts (`src/engine/speech/`)
```ts
type SpeechPart =
  | { clip: string }                        // 'w.plus', 'q.addsub.what_is'
  | { num: number; gender?: 'c' | 'n' }     // 0–1000
  | { clock: { h: number; m: number } }
  | { money: number }                        // øre
  | { measure: { value: number; unit: 'cm'|'m'|'mm'|'g'|'kg'|'l'|'dl' } }
  | { frac: { n: number; d: 2|3|4|8 } }
  | { free: string }                         // kun enhedens stemme (navne)
```
- **Funktioner:** `danishNumber(n, gender)`, `clockPhrase(h, m)`, `moneyPhrase(øre)`, `measurePhrase`, `fracPhrase`.
- **To output-former:** `toClips(parts): string[]` og `toDanishText(parts): string`. Teksten har aldrig cifre og bruges til reservestemme, lytteside og ASR-facit.
- **Talregler:**
  - 0-99 er ét ord (tredive, fyrre, halvtreds, tres, halvfjerds, firs, halvfems, enogtyve osv.).
  - 100 er "et hundrede", 101-999 er "N hundrede og X", 1000 er "tusind".
  - Genus: "en krone", "en meter", "et kilo", "et gram", "klokken et".
- **Klokken:**

  | Minutter | Frase |
  |---|---|
  | 0 | "klokken H" |
  | 1-24 | "M minut(ter) over H" |
  | 15 | "kvart over H" |
  | 25-29 | "(30−M) minut(ter) i halv H+1" |
  | 30 | "halv H+1" |
  | 31-39 | "(M−30) minut(ter) over halv H+1" |
  | 40-59 | "(60−M) minut(ter) i H+1" |
  | 45 | "kvart i H+1" |

  Valget ":20 = tyve minutter over" skal bekræftes af læringsdesign.
- **Penge:** "K kroner og halvtreds øre". 50 øre alene er "halvtreds øre".

### 5.3 Klip-inventar
Inventaret genereres fra koden og redigeres aldrig i hånden. `scripts/voice/inventory.ts` (køres med `vite-node`) går alle `SkillDef.speech`, strategier, UI-fortællinger og indholdsnavne igennem og skriver `voice/inventory.json` med `{id, text, category, sprite, hash}`.

| Kategori | Id-mønster | Antal ca. |
|---|---|---|
| Tal 0-100, "et" | `n.0`…`n.100`, `n.1et` | 102 |
| Hundreder og tusind | `nh.2`…`nh.9`, `nh.1og`…`nh.9og`, `n.1000` | 18 |
| Operatorer og bindeord | `w.plus`, `w.minus`, `w.gange`, `w.divideret_med`, `w.er_lig_med`, `w.giver`, `w.og` … | 30 |
| Spørgsmålsfragmenter pr. skill | `q.<skill>.<n>` | 170 |
| Instruktioner pr. opgavetype | `ins.<kind>.<n>` | 30 |
| Klokken, penge, måling, brøker, former | `clk.*`, `kr.*`, `ms.*`, `fr.*`, `sh.<shape>[.pl]` | 110 |
| Strategifragmenter | `st.<skill>.<n>` | 90 |
| Feedback (informativ ros og opmuntring) | `fb.*` | 50 |
| UI-fortælling for ikke-læsere, onboarding | `ui.*` | 80 |
| Belønning og progression | `rw.*` | 40 |
| Navne: arter, colorways, genstande, sæt, steder | `name.*` | 200 |
| **I alt** | | **ca. 920** |

Sammensætningseksempel: "Hvad er 347 plus 28?" giver `q.addsub.what_is`, `nh.3og`, `n.47`, `w.plus`, `n.28`. Danske hv-spørgsmål falder i tonen, så et isoleret tal til sidst lyder naturligt.

### 5.4 Generering (`talvennerne2/scripts/tts/generate.py`)
- **Indstillinger:** `language_id="da"`, `audio_prompt_path=<valgt stemme>`, `temperature=0.6`, `top_p=0.95`, `min_p=0.05`, `repetition_penalty=2.0`, `cfg_weight=0.3` (modelkortets rolige indstilling).
- **Takes:** seed = `hashSeed(id)+take`. 3 takes for klip under 1,5 s, 2 for sætninger. Der genereres igen med nye seeds op til 6 takes, hvis ingen take består.
- **Genoptagelig:** cache-nøglen er `sha1(text|voice|settings|modelrev)`, så kun nye eller ændrede klip genereres igen.
- **Mastere:** valgte takes committes som FLAC 24 kHz mono i `talvennerne2/voice/masters/` (ca. 32 MB). En container-nulstilling koster så ikke timers CPU.
- **Tidsestimat (skal måles ved G0):** antagelsen er RTF ≈ 4,5 (fp32 0,5B-backbone er hukommelsesbundet, ca. 25 tokens pr. lydsekund) plus 0,8 s overhead pr. kald.

| Scenario | Lyd i alt | 1 take | 2,5 takes i snit |
|---|---|---|---|
| Dette inventar, ca. 920 klip, snit 1,17 s | ca. 18 min | ca. 1,8 t | **ca. 4,5 t** |
| Briefens 2.000 klip, snit 1,6 s | ca. 53 min | ca. 4,4 t | ca. 11 t |

Hvis den målte RTF er over 8, bruges 1 take plus ny generering kun for fejlede klip (ca. 2 t). Piper bruges kun, hvis Chatterbox ikke kan køre.

- **ASR-tid:** wav2vec2-315m tager ca. 0,15 s pr. klip, altså ca. 6 min for alle takes.

### 5.5 Efterbehandling (Python: numpy og pyloudnorm, kommer med chatterbox)
1. Highpass 70 Hz.
2. Trim stilhed ved −45 dBFS, så der er 20 ms tilbage før og 40 ms efter.
3. Fade ind 5 ms og ud 10 ms.
4. Loudness måles efter BS.1770. Klip under 0,4 s polstres med stilhed kun til målingen, fordi gatingen ignorerer stilheden.
5. Lineær gain til −18 LUFS, derefter limiter ved −1,5 dBTP.
6. **Accept:** alle klip ligger på −18 ± 1 LU, true peak ≤ −1,0 dBTP, varigheden er inden for [0,5; 2,0] gange forventet (stavelser ÷ 3,2/s), og der er ingen clipping.

### 5.6 Sprites og manifest (`scripts/voice/pack.mjs`, Node med ffmpeg-static)
- **Sprites:**

  | Sprite | Indhold |
  |---|---|
  | `num` | Talklip, ca. 100 s |
  | `core` | Operatorer, feedback, instruktioner, ca. 70 s |
  | Ét pr. domæne (8) | Ca. 20-60 s hver |
  | `ui` | UI-fortælling |
  | `names` | Navne |
- **Pakning:** FLAC dekodes til f32, klippene sættes sammen med **250 ms stilhed** imellem, og hele spriten kodes én gang: `-c:a libmp3lame -b:a 40k -ar 24000 -ac 1`.
- **Placering:** sprites ligger i `src/assets/voice/*.mp3`, så Vite fingerprinter filnavnene.
- **Manifest** (`voice-manifest.json`, importeres i den lazy audio-chunk): `{voice, sprites: {core: {url, clips: {'n.47': [start, dur]}}}, text: {...}}`.
- **Budget:** `num` + `core` ≤ 1,2 MB, domæne-sprite ≤ 700 KB, i alt ≤ 7 MB (forventet ca. 5,5 MB).

### 5.7 Afspilning (`src/audio/engine.ts` + `voice.ts`)
- **Én AudioContext** til både stemme og SFX (V1's `sfx.ts` flyttes herind). Graf: `master` → `voiceBus` (1,0) og `sfxBus` (0,7). SFX dukkes til 0,4, mens der tales.
- **iOS-unlock:** ved første `pointerdown` kaldes `resume()`, og en silent buffer på 1 frame afspilles. Ved `visibilitychange` til visible genoptages konteksten ved næste gestus, også når iOS har sat den i "interrupted".
- **Lydløs-kontakt:** forældreindstillingen "Læs op, også når enheden står på lydløs" sætter `navigator.audioSession.type='playback'`, hvor API'et findes. Standard respekterer kontakten.
- **Indlæsning:**
  - `num` og `core` hentes i idle efter første render og er pinned.
  - Domæne-sprites hentes, når en tur bygges. Turens intro-animation på 1,2 s skjuler hentetiden.
  - `decodeAudioData` med promise. LRU-grænse 64 MB dekodet lyd.
- **Offset-robusthed:** efter dekodning finpudses start og slut for hvert klip ved at scanne ±60 ms efter −45 dBFS. Det neutraliserer MP3-encoderens delay på tværs af Safari og Chromium.
- **Gapless kæde:** `speak(parts)` slår klippene op og planlægger `AudioBufferSourceNode.start(t, off, dur)` back-to-back. Mellemrummene er 20 ms ved hundrede-sømmen ("og" → hale), 60 ms mellem fragmenter og 250 ms mellem sætninger. Funktionen returnerer `{ended: Promise, cancel()}`, hvor `cancel` fader voiceBus ned på 30 ms. Ny opgave og nyt svar afbryder altid.
- **Test-hook:** `window.__voiceLog` findes kun med `?e2e=1`.

### 5.8 Enhedens stemme som reserve (`src/audio/deviceTts.ts`, udviklet fra V1's `speech.ts`)
- **Hvornår:** kun til `{free}`-dele (navne) og som reserve for hele ytringen, hvis spriten ikke er hentet inden 1,5 s eller er offline. Stemmerne blandes aldrig midt i en sætning, så navne siges som en separat ytring.
- **Tekst:** `toDanishText(parts)`, altid med talord.
- **iOS-forhold:** foretrækker da-DK `localService` ("Sara"), `rate=0.9`, holder reference til utterance, så `onend` ikke tabes, har en timeout-reserve for `onend` og kalder første gang `speak()` i en gestus.

### 5.9 Maskinelt udtaletjek (`scripts/tts/asr_check.py`)
- **Per take:** wav2vec2-315m transskriberer, og begge sider normaliseres (små bogstaver, uden tegnsætning og mellemrum, cifre til talord). Take'en består ved **CER ≤ 0,05** og **eksakt match på alle talord**.
- **Valg mellem beståede takes:** varigheden tættest på den forventede. Grænsetilfælde går til whisper-1.5b som second opinion.
- **Sammensætninger:** `scripts/voice/render.ts` bruger den samme sekvens-kode som runtime (`src/audio/sequence.ts`, ren TS) til at skrive WAV for alle tal 101-999 (899 stk.). ASR plus talparser skal give n igen. Krav: 100 %, og fejl rettes ved at gentage hovedet eller halen.
- **Skabelonsætninger:** 30 tilfældige facts pr. skill renderes, og ≥ 97 % skal matche `toDanishText`. Resten reviewes på lyttesiden.
- **Output:** `voice/qa.json` med CER, loudness, varighed, valgt take og ASR-tekst pr. klip.

### 5.10 Lytteside
- **Placering:** `talvennerne2/lyt.html` er en ekstra Vite-entry i `rollupOptions.input`. Den deployes, men linkes kun fra forældre-dashboardets "Om oplæsningen".
- **Indhold:**
  - Klip grupperet pr. sprite med id, tekst, ASR-tekst, CER, LUFS og en afspilknap, der bruger den rigtige `AudioEngine`, så iOS-stien testes.
  - "Byg en sætning": vælg skill og fact og hør hele sammensætningen.
  - Skyder for tal 0-1000 og for klokkeslæt.
- **Markering af klip:** fejl markeres i `localStorage['tv2:lyt-flags']`, og listen kan eksporteres som JSON til ny generering.

### 5.11 SFX og musik
- **SFX:** V1's syntese udvides til ca. 30 hændelser, fx stjerne, mønt, level-op, vækst (stigende arpeggio), udstyr (filtreret støj som "stofraslen"), køb og medalje. Rumklang via ConvolverNode med genereret impulsrespons.
- **Musik:** generativ ambient pr. verden med 4 lag (pad, bas, klokkespil, let perkussion) i pentatonik ved 70 bpm i ≤ 150 linjer egen scheduler. Tone.js bruges ikke. Lav volumen 0,25, dukket under tale og kan slås fra af forældre.

---

## 6. Lagring og data

### 6.1 Navnerum på den delte origin
- **IndexedDB:** kun databasen `talvennerne2`.
- **localStorage:** kun `tv2:boot` (`{v, lastProfileId, device: {silentOverride}}`) og `tv2:lyt-flags`.
- **sessionStorage:** kun `tv2:hint-seen`. V1's nøgler `talvennerne.save` og `hint-seen` hverken læses eller skrives.
- **Forbudt i koden, håndhævet af test med grep:** `localStorage.clear`, `sessionStorage.clear`, `caches.`, `serviceWorker.register`, `indexedDB.deleteDatabase(` med andet navn end `'talvennerne2'`, samt enhver nøgle uden `tv2:`-præfiks.
- **Persistens:** `navigator.storage.persist()` kaldes ved første profil. Det er ufarligt for de andre apps.

### 6.2 Dexie-skema (v1)
```ts
db.version(1).stores({
  profiles:       'id',                                   // {name, avatar:{speciesId,colorway}, grade 0–3, settings, economy{stars,xp,level}, createdAt, dataVersion}
  facts:          '[profileId+classId], profileId',       // FactState (box, seen, correct, lastRound, avgMs) pr. mestringsklasse
  answers:        '++seq, profileId, [profileId+ts], [profileId+skill+ts]', // {ts, day, domain, skill, classId, a, b, kind, correct, ms, given, tag, roundId, boxBefore, boxAfter}
  daily:          '[profileId+day+skill], [profileId+day]', // {attempts, correct, fastCorrect, freeEntryCorrect, msSum, activeSec, rounds}
  misconceptions: '[profileId+tag], profileId',           // {evidence, opportunities, lastSeen, status: suspected|confirmed|resolved}
  animals:        'uid, profileId',                       // {speciesId, colorway, stage, name, friendship, outfit{slot→{itemId,colorway}}, x, y, obtainedAt}
  inventory:      '[profileId+itemId], profileId',        // {colorways[], source, obtainedAt}
  progress:       '[profileId+nodeId], profileId',        // node-status, medaljer
  paused:         'profileId',                            // PausedRound (✕ gemmer turen)
  meta:           'key',                                  // lastPrune, schema-info
})
```
- **Skrivestien pr. svar:** Zustand opdateres synkront. En write-behind-kø laver én rw-transaktion over `facts`, `answers`, `daily`, `misconceptions` og `profiles`. Køen tømmes ved `pagehide`. Et nedbrud koster højst ét svar.
- **Aktiv tid** tælles kun, mens en tur er synlig og der har været input inden for de sidste 60 s.
- **Profiler:** højst 6 håndhæves i repo-laget.
- **Mestringsklasser:** store domæner (plus/minus til 1000) bruger klasser som mønster plus spand, fx `as3:add:carry1:h`. Instanser trækkes med seedet rng, og svarloggen gemmer den konkrete instans `a`/`b`.

### 6.3 Størrelsesbudget og opbevaring
- **Svarlog:** ca. 250 B pr. række inklusive indeks. Den rå log gemmes i **180 dage og højst 30.000 rækker pr. profil**, svarende til ca. 7,5 MB.
- **Oprydning** sker ved opstart højst én gang i døgnet i `requestIdleCallback`.
- **Daglige aggregater gemmes for altid** (ca. 10 KB pr. måned pr. profil). Dashboardet bruger aggregaterne ud over 30 dage.
- **Loft:** ≤ 8 MB pr. profil og ≤ 50 MB i alt ved 6 profiler.

### 6.4 Eksport og import
- **Format:** `{format: 'talvennerne2-export', version, exportedAt, profiles: [{profile, facts, animals, inventory, progress, daily, misconceptions, answers?}]}`. Svarloggen er valgfri og dækker de seneste 90 dage.
- **Deling:** `navigator.share({files})`, hvor det findes, ellers en `a[download]`-Blob. Import via `<input type=file>`.
- **Validering** med håndskrevet validator, altså ingen zod.
- **Valg ved import:** "Erstat denne profil" eller "Tilføj som ny profil", hvor der laves nye id'er.

### 6.5 Migrationsstrategi
- **Dexie `version(n).upgrade()`** til skemaændringer. `profile.dataVersion` og rene `migrate_vN_to_vN+1()`-funktioner til dokumentets form.
- **Fixtures:** hver tidligere version har en fixture i `test/fixtures/export-vN.json`, som altid skal kunne indlæses.
- **Permanente id'er:** `content/ids.lock.json` lister alle id'er for arter, genstande, klasser og noder. En test fejler, hvis et id forsvinder. Man tilføjer, man omdøber aldrig.

### 6.6 iOS-forhold
- En Safari-fane og en app på hjemmeskærmen har hver sin lagring, og Safari-faner kan miste data efter ca. 7 dage uden besøg.
- Derfor viser velkomstskærmen "Læg appen på hjemmeskærmen først" **før** første profil oprettes, og dashboardet har eksport lige ved hånden.

---

## 7. Kodearkitektur

### 7.1 Placering og afhængigheder
- **Placering:** `talvennerne2/` i roden af den nuværende branch med egen `package.json` og låste versioner uden `^`: react 19, zustand 5, dexie 4, motion 12, `@fontsource-variable/nunito`.
- **Dev-afhængigheder:** vite 8, `@vitejs/plugin-react`, tailwind 4, typescript 7, vitest 4, playwright, fake-indexeddb, pixelmatch, pngjs, ffmpeg-static.
- **Træk-interaktioner** (mønter, visere, sortering) bruger en egen `usePointerDrag`-hook på ca. 80 linjer (pointer capture). Ingen gesture-lib.
- **Vite-konfiguration:** `base: './'`. Manifestet har `start_url: './'`, `scope: './'`, `id: './'`, navn "Talvennerne 2" og kort navn "Talvenner 2".

### 7.2 Genbrug og omskrivning

| V1-fil | V2 |
|---|---|
| `engine/rng.ts` | Kopieres uændret |
| `engine/mastery.ts` | Kopieres. `ceilingFor(kind)` bruger `KindDef.guessP`: guessP ≤ 0,05 giver fri indtastning og loft 5, ellers loft 3. Alle konstanter og låste regler bevares. |
| `engine/roundBuilder.ts` | Kopieres. Fordelingen 2/5/3, sikker åbner og svarpositionsbalance bevares. Nyt: domæneblanding (interleaving) og misforståelses-målrettede items. |
| `engine/facts.ts`, `tasks.ts`, `distractors.ts` | Splittes i `engine/skills/<domain>/<skill>.ts`. Distraktorer bliver `{value, tag}`. |
| `state/useRound.ts` | Kopieres. `submit(value: AnswerValue)`, pause, resume og guldæg bevares. Persistens via repo-laget. |
| `fx/particles.ts`, `ParticleCanvas`, `haptics.ts` | Kopieres |
| `audio/sfx.ts` | Flyttes ind i `audio/engine.ts` |
| `ui/task/*` (Choice, Keypad, Count, Pair, NumberLine, Manipulatives, StrategyHint) | Kopieres og restyles efter designsystemet |
| `scripts/browser.mjs`, `playthrough.mjs`, `make-icons.mjs` | Kopieres og udvides |
| `art/*`, `state/storage.ts`, `useProfile.ts`, `audio/speech.ts`, `content/islands.ts`, alle skærme | Omskrives |

### 7.3 Mappestruktur
```
talvennerne2/
  index.html  lyt.html  vite.config.ts  package.json  tsconfig.json
  public/                      manifest, ikoner (renderet fra riggen)
  voice/                       inventory.json, qa.json, masters/*.flac
  scripts/  browser.mjs playthrough.mjs sheets.mjs budget.mjs scope-guard.mjs
            voice/{inventory.ts,render.ts,pack.mjs}  tts/{generate.py,asr_check.py,requirements.txt}
  test/     baselines/  fixtures/
  src/
    engine/  rng.ts mastery.ts roundBuilder.ts types.ts misconceptions.ts
             kinds.ts                         # KindDef {id, guessP, freeEntry}
             skills/registry.ts               # import.meta.glob('./*/*.ts', {eager:true})
             skills/<domain>/<skill>.ts + <domain>.oracle.ts + <domain>.test.ts
             speech/{danishNumber,clock,money,measure,fractions,parts}.ts
    content/ worlds.ts economy.ts ids.lock.json
    data/    db.ts repo/*.ts export.ts migrate.ts prune.ts
    state/   useSession.ts useProfile.ts useRound.ts useWardrobe.ts
    art/     rig/{Rig.tsx,anchors.ts,bodies.ts,fit.ts,palette.ts,oklch.ts,rig.css,types.ts}
             parts/house.tsx  species/<id>.tsx  items/<set>/<id>.tsx  scenes/<world>.tsx  materials/*.tsx
    audio/   engine.ts voice.ts sequence.ts deviceTts.ts music.ts
    fx/      particles.ts ParticleCanvas.tsx haptics.ts
    ui/      design/{tokens.css,Button,Card,Sheet,Icon,icons.ts}
             task/<kind>/…  skills/<domain>/index.ts (Prompt, Strategy – lazy)
             screens/…  parent/{Dashboard.tsx,selectors.ts,charts/*.tsx,print.css}
    dev/     SheetApp.tsx sheets/*  (kun __SHEETS__)
```

### 7.4 SkillDef erstatter V1's 8 switch-steder
```ts
type AnswerValue = number | string       // klokken = minutter, penge = øre, 'shape:triangle', 'frac:3/4', 'cmp:<'
interface SkillDef {
  id: string; domain: DomainId; grade: 0|1|2|3
  classes(): ItemClass[]                  // endelig, rangeret; mestringsenhed (V1: én fact = én klasse)
  instance(c: ItemClass, rng: Rng): Instance   // {a, b, answer, payload}
  kinds: TaskKind[]; bounds(i, kind): [number, number] | null
  distractors(i): { value: AnswerValue; tag: MisconceptionTag | 'near' | 'other' }[]
  speech(i, kind): SpeechPart[]; strategy(i): SpeechPart[]
  fastMs(i, kind): number
}
```
- **Nye `TaskKind`s** og hvilken domæne-agent der ejer dem:

  | TaskKind | Ejer |
  |---|---|
  | `clock-set` | clock |
  | `coins-pay` | money |
  | `ruler-read` | measure |
  | `shape-sort`, `shape-build` (geobræt) | shapes |
  | `fraction-shade` | fractions |
  | `array-build` | muldiv |
  | `compare` | numbers |
  | `missing-number` | addsub |

  Hver kind deklarerer `guessP`, som driver mestringsloftet.
- **Misforståelser:** et `given`-svar fra fri indtastning, der entydigt matcher ét tag, giver evidens 1,0. Et valgt distraktor-svar giver 0,5. Tærsklerne defineres i `misconceptions.ts` af læringsdesign.

### 7.5 Code splitting og budgetter (`scripts/budget.mjs` fejler buildet)
- **Lazy-indlæsning:**
  - Forældre-dashboard, butik, garderobe, hjem og lytteside.
  - Hver art via ikke-eager `import.meta.glob('./species/*.tsx')`. Den aktuelle ledsager preloades.
  - Domæne-UI og audio-chunk med manifestet.
- **Budgetter:**
  - Initial JS ≤ 160 KB gzip, lazy chunk ≤ 60 KB gzip, al JS ≤ 600 KB gzip.
  - Skrift ≤ 60 KB.
  - Lyd som i 5.6.
- **Dashboard-grafer** er håndbyggede SVG-komponenter (≤ 8 KB) uden chart-bibliotek. Print-CSS giver en "Udskriv rapport"-funktion, der kan bruges til skole-hjem-samtalen.

---

## 8. Test og verifikation

| Lag | Indhold | Accept |
|---|---|---|
| Generator (vitest) | Pr. skill: alle klasser, og for endelige klasser alle instanser, ellers 10.000 seedede, mod et **uafhængigt orakel** skrevet af en anden agent end generatoren. Distraktorer er unikke, inden for grænser, ≠ svar og tagget. Tag-værdien er lig misforståelsesfunktionen. Id'er er unikke. | 0 fejl |
| Tale | `danishNumber` 0-1000: tabel over 40 svære værdier, alle unikke, og `parse(danishNumber(n)) === n` med en uafhængig parser. Klokken: alle 144 femminutters-tider plus 24 håndskrevne tider. Penge: 0-100 kr i trin på 50 øre. Alle `speech()`- og `strategy()`-dele findes i inventaret. `toDanishText` indeholder ingen cifre. | 0 fejl |
| Mestring | V1's 32 motortests porteres. Nye egenskabstests: valg løfter aldrig over boks 3, fejl giver −2 med gulv 0, langsomt-rigtigt giver ingen ændring, fri indtastning er nødvendig for boks 4-5 for alle kinds med guessP > 0,05. | Grøn |
| Økonomi (simulering) | 10.000 seedede "børn" med træfsikkerhed 0,33-0,95 i 400 ture: ingen negativ saldo, ingen dubletter, mester-genstande er umulige for en gætter med 0,33, medianbarnet kan købe alle butiksgenstande inden 400 ture, ingen tidsbestemte priser (lint: ingen `Date` i economy), heltalspriser. | Invarianter holder |
| Lagring (fake-indexeddb) | CRUD, loft på 6 profiler, oprydning (180 d / 30.000 rækker), eksport→import giver identisk data, migrationsfixtures, navnerum (spion på localStorage: kun `tv2:*`) | Grøn |
| Art | Lints i 4.2, baseline-diff, fit-matrix | Grøn |
| E2E (Playwright, `?e2e=1`) | 2 profiler. Hver opgavetype spillet. Fejl viser strategi og venter på tryk. ✕ pauser, og genoptag har samme opgave og samme kø. Belønning, køb, udstyr og genindlæsning bevarer outfit. Profilisolation. Forældre-gate og dashboard viser data pr. profil. Eksport, import og nulstilling af én profil. Fremmede nøgler (`talvennerne.save`, `x:y`) er byte-identiske efter hele flowet. `__voiceLog` indeholder de forventede klip-id'er. 0 konsolfejl. 3 viewports. | Grøn |
| Ydeevne | Chromium med 4× throttle: opgaveskærm p95 ≤ 20 ms, album ≥ 50 fps, dekodet lyd ≤ 64 MB | Grøn |
| Lyd | ASR, sammensætninger og loudness (5.9) | 100 % tal, ≥ 97 % sætninger |
| WebKit | Spike ved G0 (`npx playwright install webkit` plus apt-deps). Lykkes den, køres E2E også i WebKit, som er tættest på iOS. | Grøn eller dokumenteret fravalg |

- **Samlet kommando:** `npm run verify` kører typecheck, vitest, build, budget, playthrough og sheets-diff.
- **Scope-vagt:** `npm run scope -- '<glob>'` fejler, hvis git-diff rører filer uden for agentens glob. Det spejler deploy-scriptets guard.

---

## 9. Eksekveringsplan

### Faser og gates

**F0: Skelet og spikes (1 integrator-agent)**
- Scaffold `talvennerne2/`. Kopiér V1-motoren og port testene.
- Spike S1: TTS-installation, RTF-måling på 20 probeklip × Mic og Nic, ASR og stemmevalg.
- Spike S2: WebKit i Playwright.
- Spike S3: ffmpeg-static med libmp3lame.
- **G0:**
  - `git diff --stat HEAD -- . ':!talvennerne2'` er tom.
  - V1's `dist` bygger med samme fil-hashes som før.
  - De porterede tests er grønne.
  - RTF er målt, stemmen er valgt, og probe-CER er ≤ 5 %.

**F1: Fundament (4 agenter parallelt, disjunkte mapper)**

| Agent | Ejer | Gate G1 |
|---|---|---|
| A Rig | `art/rig/**`, `art/parts/**`, `art/species/rabbit.tsx`, `src/dev/**`, `scripts/sheets.mjs` | Kaninen opfylder DoD. Rig-API'et fryses. |
| B Designsystem | `ui/design/**`, skrift, tokens, app-skal og navigation | Icon- og component-sheet ≥ 4 |
| C Data | `data/**`, `state/useSession.ts`, `state/useProfile.ts`, export/import | Lagringstests grønne |
| D Tale og lydmotor | `engine/speech/**`, `audio/**`, `scripts/voice/**` | Taltests grønne. Sekvens med syntetisk tone-sprite har timing ±5 ms i Chromium. |

**F2: Indhold (op til 16 samtidige agenter i bølger)**
- **Domæne-agenter × 8:** hver ejer `engine/skills/<domain>/**`, `ui/skills/<domain>/**` og sine nye `ui/task/<kind>/**`. Orakel-filen skrives af en anden agent.
- **Art-agenter:** først 3 (kat, hest, enhjørning), dernæst 8, til sidst 4. Hver ejer kun `art/species/<id>.tsx` og sin baseline.
- **Sæt-agenter × 9 + 1 mester:** hver ejer `art/items/<set>/**`.
- **G2a, inventar-frys:** alle domæners tale og alle navne er endelige. `inventory.json` genereres, og TTS-batchen startes i baggrunden (ca. 4,5 t, 3 tråde), mens art og genstande fortsætter.
- **G2b:**
  - Fit-matrixen er reviewet.
  - Alle generator- og økonomitests er grønne.
  - ASR er bestået, og sprites er pakket.
  - Brugeren har fået lyttesiden.

**F3: Integration (integrator + 2)**
- Verdener og kort, belønninger og økonomi, butik, garderobe, hjem, profiler, onboarding, forældre-dashboard og print, wiring af lyd, SFX og musik.
- **G3:** E2E er grøn i 3 viewports, budgetterne holder, og skærm-review er ≥ 4.

**F4: Polering og deploy**
- Ydeevne, tilgængelighed (danske VoiceOver-labels), app-ikoner renderet fra riggen og endeligt review.
- **G4:** deploy er verificeret (se nedenfor).

### Regler for parallelt arbejde
1. **Én worktree pr. agent** på en under-branch `tv2/<agent>`. Integratoren merger. Da mapperne er disjunkte, er merges konfliktfrie.
2. **Kun integratoren** må røre `package.json`, lockfilen, `App.tsx`, `content/worlds.ts`, `ids.lock.json` og, efter G1, `tokens.css` og `rig/**`.
3. **Registrering** sker via `import.meta.glob`. Ingen fælles indeksfiler.
4. **Porte:** hver agent kører preview på `4300 + n`.
5. **Scope-vagten** kører før hver commit.
6. **TTS-kørslen** bruger 3 tråde, og under den afvikles kun lette agentopgaver.

### Deploy (uden at røre andre apps)
1. **Hent scriptet:**
   ```
   git fetch origin main
   git show origin/main:.claude/skills/deploy-to-pages/scripts/deploy-app.sh > <scratch>/deploy-app.sh
   ```
2. **Byg og stage:** `cd talvennerne2 && npm run verify && npm run build`. Kør derefter fra repo-roden: `bash <scratch>/deploy-app.sh talvennerne2 talvennerne2/dist --new`.
3. **I worktreens `index.html`:**
   - Indsæt kortet efter V1's kort: `<a class="card t2" href="./talvennerne2/">` med `.emoji` 🦄. Titel "Talvennerne 2". Undertitel "Matematik fra 0. til 3. klasse · dyr at passe, tøj at vinde, overblik til forældre". Forsidens egen markup bruger emoji, og det følges.
   - Tilføj CSS-reglen `.t2 .emoji { background: linear-gradient(135deg, #6C4CF5, #7FD3FF); }`.
   - Ret "Ni web-apps" til "Ti web-apps".
   - Intet andet ændres. Det manglende `.tr`-gradient hører ikke til denne opgave.
4. **Push:** `bash <scratch>/deploy-app.sh --push <worktree> talvennerne2`. Guarden tillader kun `talvennerne2/` og `index.html`.
5. **G4:**
   - `deploy-app.sh --verify` viser alle 11 stier med 200, og roden har titlen "Mine projekter".
   - `talvennerne/` svarer 200 og er uændret.
   - Live Playwright-smoke: sæt `talvennerne.save` og en fremmed nøgle, åbn `/talvennerne2/`, opret en profil og spil én tur. De fremmede nøgler er uændrede.

---

## 10. Risici

**Låste valg:**
- "Så længe barnet vil" uden pauseforslag går imod ICO Children's Code std. 5 og DSA art. 28-retningslinjerne. Designet følger valget uden kunstige greb: ingen streak-tæller for barnet, ingen notifikationer, ingen tidsbegrænsede tilbud.
- "Langsomt, men rigtigt giver ingen fremgang" kan frustrere langsomme børn. Dashboardet viser derfor "rigtigt, men langsomt" som en synlig kategori, så forældre forstår stilstanden.

**Lyd og licens:**
- Chatterbox kan af og til gentage eller hugge ord. ASR-gaten med op til 6 takes fanger det, og resten markeres til manuel gennemlytning.
- Lyden har Chatterbox' indbyggede Perth-vandmærke, som ikke kan høres.
- OpenRAIL kræver, at licensen og brugsbegrænsningerne nævnes. Det sker under "Om oplæsningen" med kreditering af Alexandra Instituttet og CoRal.
- CPU-tiden er et estimat, indtil G0 har målt den. Den inkrementelle cache og FLAC-masterne i git gør, at det kun skal betales én gang.
- Hundrede-sømmen kan høres ved enkelte tal. De 899 ASR-tjek og lyttesiden fanger det, og dårlige hoveder eller haler genereres igen.

**Lagring og platform:**
- Hvis brugeren skifter mellem Safari og appen på hjemmeskærmen, "forsvinder" profilerne. Afbødet med installationshint før første profil og synlig eksport.
- Chromium er ikke iOS. WebKit-spiken og konservative SVG-regler (ingen filtre, `transform-box: view-box`) afbøder det, men test på en rigtig iPad før lancering anbefales.

**Omfang og repo:**
- Fit-matrixen er stor: 16 arter × 3 stadier × 80 genstande = 3.840 kombinationer. Automatiske bbox-tjek dækker alle, og det multimodale review ser art-ark og genstand-ark, ikke hver kombination.
- Oversigts-branchen vokser med ca. 6-8 MB lyd ved første deploy. Hashede filnavne ændres kun, når indholdet ændres, så senere deploys tilføjer kun ændrede sprites.

### Critical Files for Implementation
- /home/user/Test/src/engine/mastery.ts
- /home/user/Test/src/engine/roundBuilder.ts
- /home/user/Test/src/state/useRound.ts
- /home/user/Test/scripts/playthrough.mjs
- .claude/skills/deploy-to-pages/scripts/deploy-app.sh (på branch `main`, hentes med `git show origin/main:…`)
