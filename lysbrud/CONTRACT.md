# LYSBRUD — modulkontrakt

Alle filer er **ES-moduler** (`export`/`import`), vanilla JS, **ingen afhængigheder**,
ingen build-trin i kilden. Target: moderne Chrome/Safari/Firefox. Ingen TypeScript-syntaks.
Al brugervendt tekst er **dansk**. Al kode-kommentar er dansk, sparsom, kun hvor det ikke er indlysende.

Fælles importsti: `import { … } from './config.js'` (eller `'../config.js'` fra `src/art/`).

Koordinatsystem for hjulet: centrum i (0,0), vinkel 0 = **klokken 12**, voksende **med uret**.
En celle `(r, i)` i ring `r` med `n = GEOM.cells[r]` dækker vinkelspændet
`[i·2π/n + offset[r], (i+1)·2π/n + offset[r])`.

---

## `src/rng.js`

```js
export function makeRng(seed)        // → funktion rng() ∈ [0,1), deterministisk (mulberry32)
export function pick(rng, arr)       // tilfældigt element
export function pickWeighted(rng, weightsObj)  // {a:2,b:1} → 'a' | 'b'
export function randInt(rng, lo, hi) // heltal i [lo, hi]
export function shuffle(rng, arr)    // ny blandet kopi
```

## `src/engine.js`

Ren logik. **Ingen DOM, ingen canvas, ingen timere.** Skal kunne køres i Node.

```js
/** Uforanderligt øjebliksbillede af brættet. */
// Board = { grid: string[][], offsets: number[], wildMult: number[][] }
//   grid[r][i]     : symbol-id ('cyan' … 'purple' | 'wild' | 'prism')
//   offsets[r]     : ringens rotationsoffset i radianer (kontinuert)
//   wildMult[r][i] : 1 | 2 | 3 | 5  (kun meningsfuldt hvor grid[r][i] === 'wild')

export function createBoard(rng, opts)
//   opts = { weights = REEL_WEIGHTS, offsets = null }
//   → Board. Hvis offsets ikke gives, trækkes kontinuerte tilfældige offsets.

export function neighbours(board)
//   → Map<string, string[]>  nøgle = `${r}:${i}`
//   Naboer = celler ved siden af i samme ring (cyklisk) + celler i
//   ring r±1 hvis vinkelspændene overlapper mere end
//   GEOM.overlapEps × den smalleste af de to cellebredder.

export function findClusters(board, opts)
//   opts = { wildColor = null }   // i bonus: alle gems af denne farve tæller som wild
//   → Cluster[]  hvor Cluster = {
//        symbol: string,          // gem-id klyngen betaler for
//        cells:  [r,i][],         // alle celler i klyngen, inkl. wilds
//        size:   number,
//        wildMultSum: number,     // sum af wildMult over wild-celler; 0 hvis ingen wilds
//        pay:    number           // multiplikator af TOTAL indsats, FØR reaktor
//      }
//   Regler: kun celler med samme gem-id eller 'wild' (eller wildColor-farve i bonus)
//   er forbundne. En klynge kræver size ≥ MIN_CLUSTER og mindst ét ægte gem.
//   En celle må gerne indgå i flere klynger af forskellig farve (wilds deles).
//   Klynger af samme farve der er forbundet, er ÉN klynge.
//   pay = SYMBOL_BY_ID[symbol].pays[payBand(size)] × max(1, wildMultSum)

export function applyCascade(rng, board, clusters, opts)
//   opts = { weights = REFILL_WEIGHTS }
//   → { board: Board, removed: [r,i][] }
//   Fjerner alle celler i alle klynger og fylder dem med nye symboler.
//   Offsets bevares uændret. Nye wilds får ny wildMult.

export function spinOutcome(rng, opts)
//   opts = { bet, wildColor = null, weights = REEL_WEIGHTS, board = null }
//   → SpinResult = {
//        steps: Step[],           // mindst ét step
//        totalWin: number,        // i kroner
//        prismHits: number,       // antal prisme-symboler i ÅBNINGSbrættet
//        maxMultiplier: number
//      }
//   Step = {
//        board: Board,            // brættet FØR denne cascades fjernelse
//        clusters: Cluster[],     // [] på sidste step
//        multiplier: number,      // reaktortrin brugt på dette step
//        win: number,             // kroner vundet på dette step
//        removed: [r,i][],        // celler der splintres
//        nextBoard: Board | null  // brættet efter påfyld; null på sidste step
//      }
//   Reaktoren: step 0 bruger REACTOR_STEPS[0], step 1 → [1], … capped.
//   I bonus bruges BONUS.steps i stedet (opts.bonus === true).
```

## `src/director.js`

Formede udfald til demoen. Bruger `engine.spinOutcome` med afvisningssampling.

```js
export function createDirector(rng, opts)
//   opts = { scripted = true }
//   → {
//       nextSpin(state) → SpinResult,   // state = { bet, spinIndex, prismCharge, inBonus, wildColor, balance }
//       setScripted(bool),
//       isScripted() → bool
//     }
```
Instrueret tilstand (`scripted: true`) — sekvensen skal føles designet, ikke tilfældig:
- spin 1: lille gevinst med **mindst 2 kaskader** (lærer mekanikken)
- spin 2–3: variation, mindst ét dødt spin
- prismeladning skal ramme 4/5 og udløse **anticipation** mindst én gang før bonus
- **garanteret bonus inden for de første 10 spins**
- mindst én gevinst ≥ 60× indsats inden for de første 15 spins
- aldrig to mega-gevinster i træk
Ærlig tilstand (`scripted: false`) = rå `spinOutcome` uden formning.

Afvisningssampling må max køre 220 forsøg pr. spin; falder tilbage til rå udfald.

## `src/art/symbols.js`

Procedurel symbolkunst. **Ingen billedfiler.**

```js
export function buildSymbolAtlas(sizes, dpr)
//   sizes: number[]  — kantlængde i CSS-px for hver ring (5 værdier)
//   → { get(id, ringIndex) → HTMLCanvasElement, sizes, dpr }
//   Hvert sprite er kvadratisk, size×size CSS-px (× dpr fysisk), transparent baggrund,
//   symbolet centreret med ~12 % luft hele vejen rundt.

export function drawSymbol(ctx, id, cx, cy, size, opts)
//   opts = { glow = 1, alpha = 1, rotation = 0, dim = false, wildMult = 1 }
//   Tegner ét symbol direkte (bruges i paytable-modal og partikler).
```
Formkrav (traceret fra mockup):
- `shard`     — smal sekskantet krystal, spids top/bund, indre facetlinjer
- `octagon`   — ottekantet slebet sten med "spindelvævs"-facetter fra centrum
- `triangle`  — nedadpegende trekantskår med indre trekant og lyskant
- `webstar`   — 6-takket stjerne med konkave sider og radiære facetlinjer
- `quadstar`  — 4-takket stjerne, konkave sider, X-formet højlys
- `pentstar`  — 5-takket stjerne med spindelvævs-facetter
- `medallion` — massiv guldring med kanellure + indre mørk skive + gylden stjerne i midten (WILD)
- `prism`     — dobbeltpyramide (oktaeder) i blå/violet med hvide facetlinjer

Alle gems: mørk mættet kerne → lysere midte → hvid kantlys, tynd mørk kontur udenom,
plus et additivt glød-halo. Skal læses tydeligt ved 34 px.

## `src/art/backdrop.js`

```js
export function createBackdrop(width, height, seed)
//   → { canvas: HTMLCanvasElement, width, height }
//   Statisk, prærenderet krystalhule: dyb indigo→violet gradient, fjerne
//   krystalspir med additivt skær, stengulv i perspektiv nederst, vignette.
//   Skal matche mockuppens palette (PALETTE.cavern*). Deterministisk via seed.

export function drawAmbient(ctx, w, h, t, dpr)
//   Animerede støvfnug / svævende krystalsplinter. Kaldes hver frame, billigt.
```

## `src/audio.js`

WebAudio-syntese, **ingen lydfiler**.

```js
export function createAudio()
//   → {
//       unlock(),                    // kaldes ved første brugerklik
//       setMuted(bool), isMuted(),
//       spinStart(), spinLoop(on), ringStop(index),
//       shatter(tier), cascade(n), reactor(step),
//       win(tier),                   // 'small'|'big'|'mega'|'epic'|'lysbrud'
//       prismCharge(n), bonusStart(), bonusEnd(),
//       tick(), click()
//     }
```
Alt skal være tåleligt og "krystallinsk": rene sinus/trekant-toner, filtreret støj,
korte konvolutter. Ingen klipning. Master gain ≤ 0.7. Respekter `prefers-reduced-motion`
ved ikke at ændre noget (lyd er uafhængig).

## `styles.css`

Styler **kun** DOM-chromet omkring lærredet. Klasse- og id-navne er låst i `index.html`
(se markup-kontrakten i den fil). Ingen CSS-frameworks. Skal:
- matche mockuppens mørke casino-look (næsten sort chrome, guld/teal accenter)
- være fuldt responsiv: sidebar kollapser < 1180 px, sidepaneler bliver overlejrede
  skinner < 900 px, bundlinjen ombrydes < 700 px
- respektere `prefers-reduced-motion`
- have synlige fokus-ringe for tastaturnavigation

---

## Test

Hvert modul skal kunne importeres i Node 22 (`node --input-type=module`) uden at røre DOM,
**undtagen** `art/*`, `audio.js` og `ui.js` som må antage browser.
`engine.js`, `rng.js` og `director.js` skal være 100 % Node-kørbare og har smoke-tests i `test/`.
