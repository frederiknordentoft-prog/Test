# Terningen · 1948: build spec (approved design)

> Note: the numbers in this spec ("1 pr. 142", "≈ 277.000 spin", "≈ 230 timer", median 99) were early estimates. The UI takes every number from REPORT (sim/run.ts --dice, 400 journeys): 1 die per 140 paid spins, ≈ 273.000 spins to 1948, median first die at spin 121. The copy module (src/ui/diceCopy.ts) formats them; never hard-code them.

## name

TERNINGEN · Porten under klinten (1948): the dice meta-game for NORDLYS

## summary

The spine is PORTEN, the most native and most mythic of the three concepts. It is a gate of chalk and ice set into Møns Klint, the coast NORDLYS already renders (the SkyLayer land bake, PAL.chalk/PAL.klint, the welcome eyebrow "Møns Klint"). Grafted onto it:
- from RELIKVIE: the archival voice ("TERNING NR. 38", "lagt i kammeret"), the colour rule "Guld er penge, violet er terninger", the honest first-contact card with "Forstået", the fixed-step demo previews, and the timing contract (no die in the air when the next spin starts);
- from STJERNEBILLEDE: storm dice "held" on the molten frame and released into the returning night, plus the copy-lint.

How it works:
- Every spin whose own total is ≥ 10× the stake it was played at gives exactly one die (Terningen). This covers base spins, Ladet spin (at its locked stake) and each Solstorm spin (at the storm stake).
- Dice live in a separate store, 'terningen.v1', that never expires. The HUD shows them as a quiet violet chip under Saldo: a count only, never a fraction.
- Each die lights one of the gate's 1948 ice tiles, in a seeded per-player blue-noise order. There is no front line and no predictable last tile.
- Six niches in the chalk hold machine silhouettes. NORDLYS is lit and feeds the gate; the other five are dark, nameless placeholders.
- At 1948 the gate opens in a 6-bar ceremony anchored to Polar Night's bar grid (85,2 BPM, D aeolian). The lintel digits 1·9·4·8 strike as four bells, the key die climbs from the NORDLYS niche to the keystone, the leaves swing open and cold light pours out.
- Automat 1948 is never drawn: only light, its name and "KONCEPT · FINDES IKKE I DENNE DEMO" directly under it.

Honesty and responsible-gambling frame:
- The myth is always marked as legend ("Man siger …").
- The facts always sit next to it and come from new simulator fields in REPORT: 1 die per 142 paid spins, about 277.000 spins, at least about 230 hours, about 4 % expected loss.
- The payback idea appears in exactly one sanctioned sentence, only in the rules and on the unlock placard, behind a swap flag.
- Demo tools never award dice, never stage a near-miss or a big win, and carry amber labels that #clean cannot hide.

Scope is one pass:
- One centrepiece, GateView (Pixi, drawn over the live sky), shared by the chamber and the ceremony.
- Plus the chip, the award moment, two one-time cards, a rules tab, 4 drawer tools and 3 deep links.

## dataModel

## Files

### New
- src/game/dice.ts: pure, no DOM and no Pixi.
- src/render/chamber/gateLattice.ts: pure.
- src/render/chamber/GateView.ts
- src/render/art/dieImage.ts and src/render/art/assets/terning-384.webp
- src/present/dieAward.ts
- src/present/cinematics/gate.ts
- src/ui/chamber.ts
- src/ui/diceCopy.ts: pure. Every dice string lives here, with numbers taken from REPORT.
- scripts/die-asset.mjs and scripts/dice-check.mjs
- tests/dice.test.ts, tests/dice.copy.test.ts, tests/dice.boundary.test.ts

### Changed
src/game/Game.ts, src/game/store.ts, src/game/world.ts, src/render/app.ts (new 'chamber' layer), src/present/celebration.ts, src/present/schedule.ts, src/ui/hud.ts, src/ui/styles.css, src/audio/audio.ts, src/audio/sfx.ts, src/audio/assets.ts, src/main.ts, sim/core.ts, sim/run.ts, sim/report.ts, src/math/config.ts (MathReport type), README.md.

## 1. Pure rule (src/game/dice.ts)

```ts
export const DICE_GOAL = 1948;
export const DICE_MIN_X = 10;
/** One die for a spin whose OWN total is ≥ 10× the stake it was evaluated at. Integer øre, exact: 10,00× counts, 9,99× does not. */
export const diceFor = (totalOre: number, stakeOre: number): boolean => stakeOre > 0 && totalOre >= DICE_MIN_X * stakeOre;
export interface DiceStore {
  v: 1;
  count: number;              // real dice; never expire, never spent
  seed: number;               // uint32, per-player gate fill order (newSessionSeed() at creation)
  firstAt: number | null;     // epoch ms of die nr. 1
  lastAt: number | null;
  helloSeen: boolean;         // first-visit introduction shown (once, ever)
  introSeen: boolean;         // first-die card shown (once, ever)
  unlock: 'none' | 'pending' | 'seen';
  offered: boolean;           // the 1948 card was shown (it is never shown again)
  unlockedAt: number | null;  // set only by a REAL ceremony (seal-break beat or skip)
}
export function diceDefaults(seed: number): DiceStore;   // count 0, flags false, unlock 'none'
/** THE only mutator. Returns the accession number (the new count). */
export function addDie(d: DiceStore, now: number): number {
  d.count++; d.lastAt = now; if (d.firstAt === null) d.firstAt = now;
  if (d.count >= DICE_GOAL && d.unlock === 'none') d.unlock = 'pending';
  return d.count;
}
export const fmtDice = (n: number) => (n <= 9999 ? String(n) : fmtInt(n));   // "1948", never "1.948"
export const diceWord = (n: number) => (n === 1 ? 'terning' : 'terninger');
export interface DiceView { count: number; unlock: DiceStore['unlock']; mode: 'real' | 'preview' | 'demo' }
```

## 2. Persistence (src/game/store.ts)

- `DICE_KEY = 'terningen.v1'` is separate from 'nordlys.v1'. It is platform level and sits outside the 365-day meter path, so no nordlys migration can touch it.
- `loadDice(seed)`: JSON parse. If the key is missing, `v !== 1` or parsing fails, return diceDefaults(seed); on an exception also set storageOk = false. It never expires.
- `saveDice(d)`: respects the SAME `writesEnabled` flag as save(). While setPersistenceEnabled(false) is on, it is a no-op.
- `wipeDice()`: removes the key.
- `Game.persist()` becomes `{ this.s.lastPlayed = Date.now(); save(this.s); saveDice(this.dice); }`. Both writes run in the same synchronous task, so a reload cannot land between them.

## 3. Additions to 'nordlys.v1' (SaveData)

- `HistoryEntry.die?: true`: this spin gave a die. Used for audit and replay, and for the Historik mark.
- `ActiveStorm.diceAwarded?: number`: dice committed in this storm so far. Read as `?? 0` for old saves.
- `Settings.dice: boolean`, default true: "Vis terninger i spillet". Existing saves get it through the existing `{...d.settings, ...s.settings}` merge.
- Stats and meter are unchanged. store.load()'s 365-day reset touches only meter and perksPending, never dice.

## 4. The award rule in Game.ts (exact places)

```ts
private dice: DiceStore;          // constructor: this.dice = loadDice(newSessionSeed())
private shownDice = 0;            // what the HUD shows (lags the model until a die lands)
private heldDice = 0;             // storm dice waiting on the molten frame
private awardDie(r: { totalOre: number; stakeOre: number }): number {
  if (this.demoMode || !diceFor(r.totalOre, r.stakeOre)) return 0;
  const n = addDie(this.dice, Date.now());
  if (!this.s.settings.dice) { this.dice.introSeen = true; this.dice.helloSeen = true; } // opted out: no cards later
  return n;
}
```

**a) Base spin and Ladet spin**, in spin()'s "commit the WHOLE outcome" block:
- Directly after `this.s.balanceOre += r.totalOre;` add `const dieNo = this.awardDie(r);`.
- r.stakeOre is the locked stake for a perk, because spinBase(…, stake) is called with `stake = lockedStakeOre(...)`.
- Then call `this.record(r, perk ? 'perk' : 'base', stake, r.totalOre - paid, pre, dieNo > 0)`. record() gets a 6th parameter `die = false` and sets `entry.die = true`.
- The existing `this.persist()` then writes both stores before any presentation.
- Presentation: `celebrate(tier, …, dieNo)`, then `finishSpinHud(r, profile, paid, dieNo)`, then `await this.award.fly()` (the die is awaited before the storm or idle).

**b) Each storm spin**, inside runStorm's `while (st.spinIndex < st.spinsTotal)` loop, inside the existing `if (!demo) { … }` block:
- `dieNo = this.awardDie(result)`, where result.stakeOre is the storm stake.
- `record(…, dieNo > 0)`.
- `Object.assign(this.s.activeStorm, { …existing fields, diceAwarded: (this.s.activeStorm.diceAwarded ?? 0) + (dieNo ? 1 : 0) })`.
- `persist()`.
- NEVER gate this on opts.resume. Game.spin() starts every real storm with `resume: { idx, spinIndex: 0 }`. The silent replay loop `for (k < opts.resume.spinIndex) stormSpin(...)` never awards, and the while loop only plays unplayed spins, so a reload can never double count.
- Demo storms (`demo === true`) compute `ghost = diceFor(result.totalOre, result.stakeOre)` for presentation only.

**c) Storm guarantee.** The `record({ spinId: …'-G' }, 'storm', …)` line is not a spin. It never calls awardDie.

**d) Paths that never award:**
- demo() and demoSuns(): demoMode is true, and demoSuns presents via presentSpin without spin().
- All dice demo tools.
- qaNext only moves counters.

**e) Storm summary.** Capture `const stormDice = demo ? ghostCount : (this.s.activeStorm?.diceAwarded ?? 0)` BEFORE `this.s.activeStorm = null`.

## 5. Display lag

- **Base and perk spins.** The model is committed at the press. shownDice updates when the die lands on the chip: `shownDice = dice.count − heldDice`.
- **Storm spins.** heldDice++ on each pop, and the chip does not change. In stormOutro the held dice are released and each landing rolls shownDice +1.
- **Constructor and resume.** `heldDice = this.s.activeStorm?.diceAwarded ?? 0` and `shownDice = dice.count − heldDice`. The held row is rebuilt with that many slots.

## 6. Unlock state machine

```
'none' →(addDie crosses 1948)→ 'pending'
  → the unlock card is shown once at the next idle (offered = true)
  → [Åbn porten] (card or chamber) → real ceremony
  → at the seal-break beat (or on skip): unlock = 'seen', unlockedAt = now, persist()
```
- "Ikke nu" keeps 'pending'. There is no reminder, and the chamber offers [Åbn porten].
- A reload before the seal-break beat leaves 'pending' in place.
- Demo and replay ceremonies never write.
- The count keeps rising after 'seen'. There is no new goal.

## 7. Demo isolation

- snapshot() adds `dice: { ...this.dice }, shown: this.shownDice, held: this.heldDice`. restore() puts them back and calls refreshHud().
- Every dice demo tool (demoDie, demoFirstDie, demoGate, previewChamber):
  - runs under `setPersistenceEnabled(false)` + snapshot/restore;
  - renders only a DiceView with mode 'preview' | 'demo' (the HUD, GateView and chamber DOM read a DiceView, never this.dice directly);
  - in dev builds calls `console.error('dice changed by demo')` if JSON.stringify(this.dice) differs afterwards.
- demoReset() is the ONLY tool that changes real dice: `wipeDice(); this.dice = diceDefaults(newSessionSeed()); shownDice = heldDice = 0`.

## 8. Game states and intents

**GameState** adds:
- 'chamber': a resting state, so flushLayout is allowed.
- 'ceremony'
- 'diceCard': the first-die or unlock card.
- 'demoDie'

In each of these, setSpin('busy'), the stake is locked, and a 'spin' intent is ignored, except:
- in 'diceCard' (first-die) it means "Forstået" after 1,5 s;
- in 'ceremony' it means skip.

**Intents** add:
- `{t:'chamber', open:boolean}`, also sent by the key T (idle only)
- `{t:'gateOpen'}`
- `{t:'gateReplay'}`
- `{t:'diceCard', act:'ok'|'chamber'|'gate'|'later'}`
- `{t:'hello', act:'close'|'chamber'}`
- `{t:'placard', act:'chamber'|'back'|'endDemo'|'close'}`
- `{t:'demoDie'}`
- `{t:'demoFirstDie'}`
- `{t:'demoGate'}`
- `{t:'demoChamber', n:0|25|250|1000|1948}`

**afterIdle():**
1. First, the existing demoPending.
2. Then deep links (#kammer / #terning / #1948).
3. Then maybeDiceMoments(), which only runs when `settings.dice && !demoMode`:
   - `count ≥ 1 && !introSeen` → the first-die card 250 ms later;
   - otherwise `unlock === 'pending' && !offered` → the unlock card 250 ms later.

## 9. Migration of existing saves

- No 'terningen.v1' → defaults with count 0. No retroactive dice from history.
- helloSeen = false, so returning players also see the introduction once.
- An interrupted storm from an old save resumes with diceAwarded 0. Only its remaining spins can give dice.
- Older history rows carry no mark.
- Nothing else migrates.

## 10. New REPORT fields (sim/run.ts → config.generated.ts; MathReport extras)

| Field | Meaning | Today's value |
|---|---|---|
| diceRate | dice per PAID spin, including its Ladede spin and storm spins | ≈ 0,00704 → 1 pr. 142 |
| diceRateBase | same, base + Ladet spin only | ≈ 1/203 |
| diceStormShare | share of dice from storm spins | ≈ 0,30 |
| diceP1 | P(a paid spin yields ≥ 1 die) | |
| diceFirstMedian | ceil(ln 0,5 / ln(1 − diceP1)) | ≈ 99 |
| dice1948Spins | mean paid spins to 1948 | ≈ 277.000 |
| dice1948SpinsP5 / P95 | 5th and 95th percentiles | |
| dice1948LossX | mean net loss over the journey, × stake | ≈ 11.000 |
| dice1948LossP5X / P95X | 5th and 95th percentiles | |
| dice1948LossShare | share of journeys ending with a net loss | ≈ 0,98 |
| diceJourneys | number of journeys simulated | |

How the sim produces them:
- sim/core.ts: simStorm counts `STORM_OUT.dice` (storm spins whose own win is ≥ 10× the storm stake). jobE2E accumulates diceBase / dicePerk / diceStorm and the spins with ≥ 1 die.
- New job kind 'dice': fresh players (meter 0), each played until 1948 dice, recording paid spins and net × stake per journey. Full run 400 journeys, quick run 24.
- REPORT.md prints a renewal-CLT cross-check.
- Play time is derived in the UI: `dice1948Spins × T.floor / 3600`.

## copy

All strings live in src/ui/diceCopy.ts, which is pure and covered by the copy-lint.
- Numbers come from REPORT through formatters: spins rounded to 1.000, hours floored to 10, kr rounded to 100, percentages as fmtPct.
- The values shown below are today's simulation results.
- {n} is the real count and {N} is a preview count. All numbers are plain digits up to 9999 (fmtDice).

## HUD CHIP (under Saldo)

- Visible text:
  - below 1000 px: "{n}"
  - desktop (≥ 1000 px and ≥ 5/4): "{n} terninger", "1 terning", "0 terninger"
- aria-label:
  - "Terninger: {n}. Åbn Terningekammeret."
  - pending: "Terninger: {n}. Porten kan åbnes. Åbn Terningekammeret."
  - after the unlock: "Terninger: {n}. Porten står åben. Åbn Terningekammeret."
- title (desktop tooltip): "Terningekammeret"
- Demo landing tag: "+1 demo"

## DESKTOP PANEL (right column, first panel)

- h4: "Terningekammeret"
- Row: "{n} terninger" / "1 terning"
- Link: "Porten under klinten ›"

## AWARD

- Caption under the die: "TERNING NR. {n}"
- Demo caption: "DEMO · TÆLLER IKKE"
- Screen reader, appended to the result announcement: "Terning nr. {n} er lagt i Terningekammeret."
- Storm pop, screen reader: "Terning nr. {n}. Den lægges i kammeret, når stormen har lagt sig."
- Storm outro, screen reader: "{k} terninger fra stormen er lagt i Terningekammeret." / "1 terning fra stormen er lagt i Terningekammeret."
- Held-row overflow: "+{m}"
- Storm summary row (real, k > 0): "Terninger fra stormen" · "{k}"
- Storm summary row (demo storm, k > 0): "Terninger · demo · tæller ikke" · "{k}"
- Demo storm summary note (replaces today's): "Demo-udløst storm · krediteres ikke saldoen · tæller ikke i statistikken · giver ingen terninger"
- Demo storm pop caption: "DEMO · TÆLLER IKKE"
- "Vis en terning" banner: "DEMO · TERNING" / "Sådan ser en terning ud · tæller ikke med"

## FIRST-VISIT INTRODUCTION (non-modal coach card, once)

- Eyebrow: "TERNINGEKAMMERET"
- Title: "Terningen"
- Body: "Hvert spin, der vinder mindst 10× indsatsen, giver en terning. Den lægges i Terningekammeret."
- Myth (cool): "Man siger, at porten derinde blev lukket i 1948 – og at den åbner ved 1948 terninger."
- Facts (body size): "I gennemsnit tager 1948 terninger ca. 277.000 spin. Automat 1948 bag porten er et koncept. Terninger udløber ikke."
- Buttons: "Se kammeret" · "Luk"
- Announced once (screen reader): "Terningen. Hvert spin, der vinder mindst 10 gange indsatsen, giver en terning til Terningekammeret. Man siger, at porten derinde blev lukket i 1948, og at den åbner ved 1948 terninger. I gennemsnit tager det ca. 277.000 spin. Automat 1948 er et koncept."

## FIRST-DIE CARD (modal, once)

- Eyebrow: "TERNING NR. 1"
- Title: "Din første terning"
- Body 1: "Den er lagt i Terningekammeret. Du får en terning, hver gang et spin vinder mindst 10× sin indsats – indsatsens størrelse er ligegyldig."
- Body 2: "Ved 1948 terninger åbner porten i kammeret ind til Automat 1948 – et koncept i denne demo."
- Facts (body size): "I gennemsnit tager 1948 terninger ca. 277.000 spin. Terninger udløber ikke og har ingen pengeværdi."
- Buttons: "Se kammeret" · "Forstået" (primary)
- Demo note, shown first when opened with the demo tool: "DEMO · Sådan møder man den første terning · dit antal er uændret ({n})"
- Screen reader: "Din første terning, nummer 1, er lagt i Terningekammeret. Du får en terning, hver gang et spin vinder mindst 10 gange sin indsats. Ved 1948 terninger åbner porten ind til Automat 1948, et koncept i denne demo. I gennemsnit tager det ca. 277.000 spin."

## UNLOCK CARD (real, once)

- Eyebrow: "TERNING NR. {n}"
- Big: "1948"
- Sub: "Alle 1948 fliser i porten lyser."
- Body: "Porten under klinten kan åbnes – nu eller en anden gang."
- Buttons: "Ikke nu" · "Åbn porten" (primary)

## TERNINGEKAMMERET

- Header eyebrow (CSS uppercase): "Terningekammeret · Møns Klint"
- Title (id chTitle): "Porten under klinten"
- Close button aria-label: "Luk Terningekammeret". The mute button reuses "Lyd til/fra".

**Myth, full version.** Lines 1–3 are pair 1 and are never split. Lines 5–6 plus the chip are pair 2 and are never split.
1. (cool) "Man siger, at der under klinten"
2. (cool) "står en port af kridt og is,"
3. (cool) "og at den blev lukket i 1948."
4. (ice) "Hver terning tænder én af dens 1948 fliser."
5. (strong) "Når alle lyser, åbner porten"
6. (strong) "ind til Automat 1948."
- Concept chip (neutral outline): "Koncept · findes ikke i denne demo"
7. (muted) "Bag den står endnu kun en idé – og et årstal."

**Myth, condensed version (fit step 3).**
- (cool, pair 1) "Man siger, at porten under klinten blev lukket i 1948."
- (strong, pair 2) "Ved 1948 terninger åbner den ind til Automat 1948." followed by the chip.

**Pending state (count ≥ 1948, not opened):**
- Line 4 becomes "Alle 1948 fliser lyser."
- Lines 5–6 become "Porten kan åbnes" / "ind til Automat 1948." (chip kept)
- Condensed: "Alle 1948 fliser lyser. Porten kan åbnes ind til Automat 1948."

**Open state (after a real unlock, or the 1948 preview):**
- Line 4 becomes "Alle 1948 fliser lyser."
- Lines 5–6 become "Porten står åben" / "ind til Automat 1948." (chip kept)
- Line 7 becomes "Lyset fra porten falder ud over stranden."

**Count block:**
- "{n}" + "terninger" / "terning". In preview, add the amber tag "forhåndsvisning".
- Pending: button "Åbn porten".
- Open: status "Porten står åben." + ghost button "Se åbningen igen".

**Facts (never dropped):**
- F1: "1 terning pr. spin, der vinder mindst 10× sin indsats – også Ladede spin og stormspin. Indsatsen er ligegyldig."
- F2: "I gennemsnit 1 terning pr. 142 betalte spin, tilfældigt fordelt. 1948 terninger kræver ca. 277.000 spin – mindst ca. 230 timers spil."
- F3: "Undervejs taber man i gennemsnit ca. 4 % af indsatserne. Terninger har ingen pengeværdi og udløber ikke. De fem mørke automater er pladsholdere."

**Actions:** "Regler og tal ›" (aria-label "Regler og tal for Terningen") · "Luk"

**Pixi labels:** lintel "1948"; niche label "NORDLYS"; open state "AUTOMAT 1948" with "KONCEPT · FINDES IKKE I DENNE DEMO" directly under it.

**Screen-reader summary (#chSum):**
- Base: "Terningekammeret. Man siger, at porten under klinten blev lukket i 1948. Den har 1948 fliser, og hver terning tænder én. Du har {n} terninger. I nicherne står seks automater: NORDLYS lyser, de fem andre er mørke pladsholdere. Automat 1948 er et koncept og findes ikke i denne demo."
- Pending: "… Alle 1948 fliser lyser, og porten kan åbnes. …"
- Open: "… Porten står åben. …"

**Ribbons (DOM, not hidden by #clean):**
- Preview: "FORHÅNDSVISNING · {N} terninger · dit antal er uændret ({n})"
- Preview at 1948: "FORHÅNDSVISNING · 1948 terninger · porten åben · dit antal er uændret ({n})"
- Demo ceremony: "DEMO · Portens åbning vist med demo-værktøjet · tæller ikke · dit antal er uændret ({n})"
- Replay (neutral, not amber): "GENSYN · Åbningen vises igen · intet ændrer sig"

## CEREMONY

**Pixi eyebrow:** "TERNING NR. {n}" (real), "DEMO · FORHÅNDSVISNING" (demo) or "GENSYN" (replay).

**Pixi title and label:** "AUTOMAT 1948" + "KONCEPT · FINDES IKKE I DENNE DEMO".

**Placard:**
- Eyebrow: "PORTEN ER ÅBEN" (real/replay) / "DEMO · FORHÅNDSVISNING"
- Demo note (first, demo only): "DEMO · Porten er åbnet med demo-værktøjet · dit antal terninger er uændret ({n})"
- Title: "Automat 1948"
- Chip directly under the title: "Koncept · findes ikke i denne demo"
- p1: "Bag porten skulle Automat 1948 stå: en automat for dem, der har samlet 1948 terninger."
- p2, THE SANCTIONED SENTENCE (flag AUTOMAT_PAYBACK_CLAUSE = true): "I konceptet er Automat 1948 tænkt med højere tilbagebetaling end de andre automater. Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling."
- p2 with the flag off: "Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling."
- p3 (muted): "Et årstal. En nøgle."
- p4 (real only): "Dine terninger bliver i kammeret, og tællingen fortsætter. Intet i NORDLYS ændrer sig."
- Buttons:
  - real: "Se kammeret" · "Tilbage til NORDLYS" (primary)
  - replay: "Luk"
  - demo: "Afslut demo"

**Screen reader:**
- At the start (real): "Terning nr. {n}. Porten under klinten åbner."
- At the start (demo): "Demo: portens åbning ved 1948 terninger. Tæller ikke."
- At the start (replay): "Gensyn af portens åbning."
- At the end: "Porten er åben. Automat 1948 er et koncept og findes ikke i denne demo."

**Banner after the demo:** "DIN SAMLING ER UÆNDRET" / "{n} terninger · demo-åbningen talte ikke med"

## MENU

**New tab "Terningen"** (between Kp-stigen and Historik):
- Top: button "Åbn Terningekammeret" + status "Du har {n} terninger." / "Du har 1 terning."
- Then the rules (see the rules field).

**Kp-stigen:** append the hint "Terninger er ikke en del af ladningen og udløber ikke."

**Historik:**
- Intro, appended: " Spin, der gav en terning, er mærket »terning«."
- Row mark after the Spil-ID: " · terning"

**Spil ansvarligt › Designprincipper**, appended: " Terningerne har ingen tidsfrister, streaks, daglige belønninger eller påmindelser og udløber ikke – en pause koster ingen terninger. Terning-tælleren kan slås fra under Indstillinger."

**Indstillinger:**
- New row: "Vis terninger i spillet" (checkbox)
- Hint: "Slået fra: ingen terningtæller og ingen terning-animationer. Terningerne tælles stadig og kan ses under Terningen i menuen."

**Storage chip** (replaces today's): "Lagring er ikke tilgængelig · fremskridt og terninger gemmes kun i denne fane"

## DEMO DRAWER

- Sub-heading: "Terningen"
- Buttons: "Vis en terning" · "Vis første terning" · "Åbn porten · 1948"
- Segmented control:
  - Label: "Vis kammeret med (kun visning)"
  - Segments: "0" "25" "250" "1000" "1948 · åben"
  - Group aria-label: "Vis kammeret med et antal terninger – kun visning"
- Warning chip (replaces today's): "Kun til demonstration. Findes ikke i den rigtige version. Demo-storme krediteres ikke saldoen og tæller ikke i statistikken. Demo-værktøjerne giver aldrig terninger og ændrer ikke dit antal."
- Hint (replaces today's): "\"Vis Kp\" ændrer kun himlen og buen – din rigtige måler røres ikke. Terning-værktøjerne ændrer kun visningen – dit antal terninger røres ikke. Genveje: Mellemrum = spin · E = demo · T = Terningekammeret · M = lyd · Esc = spring over. Direkte links: tilføj #solstorm (demo-stormen), #1948 (portens åbning), #kammer (Terningekammeret) eller #terning (en terning) til adressen."
- Nulstil demo banner: "DEMO NULSTILLET" / "Saldo 1.000,00 kr · Kp 0 · 0 terninger"

## README deep-link rows

- `#1948`: "Portens åbning (demo) starter 2 s efter \"Tænd himlen\". Tæller ikke og er mærket DEMO hele vejen"
- `#kammer`: "Åbner Terningekammeret efter intro"
- `#terning`: "Viser en demo-terning 2 s efter intro (tæller ikke)"

## hud

## Principle

The count is status only. It is shown as a quiet violet chip that belongs to what the player keeps (the deck), NOT in the regulatory strip #reg.
- Never a fraction, "/1948", bar, percentage or remaining count.
- No idle animation, no pulse, no glow at rest.
- The colour rule applies: gold = money, violet = dice.
- The flights point in opposite directions: charge flies UP to the sky, dice fall DOWN into the player's keeping.

## Markup (hud.ts)

In `.cell-l`, directly after `#bal`:

```html
<button class="dice zero" id="diceBtn" aria-label="Terninger: 0. Åbn Terningekammeret." title="Terningekammeret">
  <canvas class="ico" id="diceIco" aria-hidden="true"></canvas>
  <span class="n num" id="diceN"><span class="cur">0</span></span>
  <span class="w" id="diceW"> terninger</span>
</button>
```

Hud API:
- `setDice(shown: number, o: { show: boolean; unlock: 'none'|'pending'|'seen'; enabled: boolean })`
- `diceTarget(): {x, y, size}`: the icon centre in #app coordinates, which equal stage px.
- `landDice(n, calm)`
- `demoDiceTag()`

## CSS

```css
.dice { position:relative; display:inline-flex; align-items:center; gap:5px; height:22px; margin-top:3px; padding:0 8px 0 2px; border-radius:11px;
  border:1px solid rgba(138,92,255,.32); background:rgba(20,10,44,.40); color:#cdb8ff; font:650 12px/1 system-ui,sans-serif; letter-spacing:.02em; cursor:pointer; pointer-events:auto; }
.dice::before { content:''; position:absolute; inset:-11px -6px; }          /* 44 px tall hit area */
.dice .ico { width:18px; height:18px; flex:none; }                             /* DPR canvas */
.dice .w { display:none; color:var(--muted); font-weight:600; }
.dice.zero { color:var(--muted); border-color:var(--line); background:transparent; }
.dice.open .ico { border-radius:50%; box-shadow:0 0 0 1px rgba(25,227,214,.55); }   /* after the real unlock */
.dice[aria-disabled='true'] { cursor:default; }
.dice:focus-visible { outline:2px solid var(--teal); outline-offset:2px; }
.dice .n { position:relative; overflow:hidden; height:14px; }                 /* number roll */
.dice.land .ico { animation:diceLand .26s var(--ease); }
.dice.land { animation:diceRing .5s ease-out; }
@keyframes diceLand { 50% { transform:scale(1.15); } }
@keyframes diceRing { from { box-shadow:0 0 0 0 rgba(138,92,255,.7); } to { box-shadow:0 0 0 10px rgba(138,92,255,0); } }
:root.calm .dice.land { box-shadow:0 0 0 2px rgba(138,92,255,.6); transition:box-shadow .6s; }   /* static ring, no scale */
@media (max-height:640px) { .dice { height:20px; font-size:11.5px; } .dice .ico { width:16px; height:16px; } }
@media (min-width:1000px) and (min-aspect-ratio:5/4) { .dice { height:24px; font-size:12.5px; } .dice .ico { width:20px; height:20px; } .dice .w { display:inline; } }
:root.nodice .dice, :root.nodice .dice-panel { display:none; }                /* setting "Vis terninger i spillet" off */
```

The number stays violet (#cdb8ff), 12 px, weight 650. It is always smaller and lighter than the Saldo value (16–19 px, 700, ice), and the icon makes it sit indented, never directly under the amount's digits.

## Icon states (drawn by dieImage.drawDie into the DPR canvas)

- **0:** an empty socket. An isometric-cube hexagon outline, 1,2 px, frost #9cc9ff at 45 %, plus the three inner edges at 25 %. The die art is saved for the first find.
- **≥ 1:** the die bitmap at full colour, with tint 0.95 in canvas brightness.
- **After a real unlock:** a thin aurora ring (class .open).
- **Decode failure:** a violet hexagon glyph (same path, filled with rgba(138,92,255,.5)).

## Viewports

| Viewport | Deck | Chip | Left cell | Fit |
|---|---|---|---|---|
| 360×640 | deck-h 88; left cell ≈ 80 px wide (360 − 2×8 gutter − 2×12 gap − stake 152 − spin 72/88) | 20 px, "1948" worst case ≈ 57 px wide | label 13 + value 20 + 3 + chip 20 = 56 px | fits ✓ |
| 375×667 | deck-h 96; left cell ≈ 86 px | 22 px | 61 px | ✓ |
| 390×844 | deck-h 104; left cell ≈ 100 px | 22 px | | ✓ |
| Landscape phones (max-height 500) | deck-h 88 | compact 20 px | | ✓ |
| 1920×1080 and 1280/1366 | deck 720 px wide, centred | chip 24 px, "37 terninger" ≈ 104 px | | ✓ |

The chip never shares a line with the Saldo value, so it can never push the balance into ellipsis.

On desktop there is also a panel, the FIRST child of #sideR, above "Gevinsttabel · ved indsats":

```html
<div class="panel dice-panel">
  <h4>Terningekammeret</h4>
  <button class="dp-row" id="diceRow">
    <canvas class="ico" id="diceIco2" aria-hidden="true"></canvas>
    <span class="n num" id="diceN2">37</span>
    <span class="w">terninger</span>
  </button>
  <button class="linkbtn" id="diceLink">Porten under klinten ›</button>
</div>
```
- Row: the die canvas at 36 px, then the count at 18 px/700 #cdb8ff. Panel height ≈ 96 px.
- `.hist-panel { flex:1; min-height:0 }`, so 1280×720 and 1366×768 still fit. Tour check: scrollHeight ≤ clientHeight + 1.
- The flight always targets the chip, on every viewport. The panel number updates at the same moment, without its own animation.

## Visibility

- Hidden on the splash (the deck is hidden).
- Visible in idle, in spin, and in .cine and the demo time-lapse (.cell-l stays).
- In Solstorm the chip stays violet; storm glass never recolours it.
- Hidden by :root.nodice when the setting is off.
- Under the chamber overlay while the chamber is open.

## Tap and keyboard

- **In idle:** opens Terningekammeret. Enter or Space when focused (Space-to-spin already ignores focused buttons); the key T opens it from idle.
- **In any other state:** aria-disabled="true" and a no-op. Nothing is queued, the chip never interrupts a spin, and Space never opens it.
- **Landing (hud.landDice):**
  - class .land for 500 ms;
  - the number rolls: the old span slides up and out and the new one slides in from below, 220 ms (calm: 200 ms opacity crossfade);
  - sound 'dieLand', haptic 12 ms (never in calm).
- **Demo landing:** the die dissolves at the icon, the amber tag "+1 demo" floats 8 px above the chip for 1,5 s, and the number is unchanged.

## Chamber and ceremony mode (:root.chamber)

- #hdr, #slot-arc, #winstrip, #deck and .side get visibility hidden plus `inert`. #reg and #foot stay interactive (StopSpillet and ROFUS links, session time and net).
- The balance moves into the regulatory strip: `:root.chamber #reg #regBal { display:inline !important }`, and at ≤ 440 px `:root.chamber #reg .l b { display:none }`.
- At 360 px the strip then reads "14:05 Saldo 1.000,00 kr" + "DEMO · LEGEPENGE" ≈ 282 px of 344 ✓.

## award

## Rule, in code terms

Game.awardDie(r) → `diceFor(r.totalOre, r.stakeOre)`, committed BEFORE presentation (see dataModel §4).
- Every ≥ 10× win is winTier ≥ 2 and a WIN profile (> stake), so the LDW rule holds automatically.
- The die lives inside the existing celebration. It never appears mid-cascade, never before the result beat (which is ≥ 3,0 s after the press), and never extends a losing spin.
- The 3,0 s floor and schedule().resultAt are untouched: schedule() has no dice input.

## Layers

- **Pixi:** a new `DieAward` container (src/present/dieAward.ts), added to `stage.layers.banners` AFTER the Celebration. It holds:
  - the die Sprite (die texture, tint 0xe0e0e0 so the baked neon does not over-bloom);
  - the halo (softDot, additive, violet #8a5cff, α 0.35, 1.7× the die);
  - the glint (softBand, additive, α 0.35, masked by a second die sprite);
  - the caption (IsText 'ice', α 0.85);
  - the storm held row.
- **Particles:** world.particles, 'glint' kind, colours teal 0x19e3d6, violet 0x8a5cff and magenta 0xff2bd6 only (never gold, never red).
- **DOM:** the flight, the chip landing and aria.
  - Flight: a `<canvas class="die-fly">` in #overlays, position absolute, pointer-events none, drawn at DPR.
  - Hand-off: in the same frame the Pixi sprite is hidden and the canvas appears at `sprite.getBounds()`. Stage px equal CSS px because of autoDensity and #stagehost at inset 0.
  - Motion is driven by gsap on the game clock (deterministic under the QA advance()).

## Anchor and size (base spin and Ladet spin)

- x = W/2; y = cy + amountSize×0.2 + amountSize×0.55 + dieSize×0.6, i.e. directly under the counting amount.
- dieSize = clamp(56, 0.16 × min(W, 700), 104): 62 px on a 390 phone, 104 px on desktop.
- The die always stays inside the grid's lower half (cy + 66 px on 390, cy + 115 px on desktop).
- Caption at die centre + dieSize×0.62 + capSize, with cap = max(10, 0.024 × min(W, 700)) and tracking 0.2.

## Timing (new pure helpers in schedule.ts)

```ts
export const dieBirthAt = (tier: number) => 0.3 + Math.max(0.6, TIER_SECS[tier] - 0.4) - (tier >= 3 ? 0.4 : 0);
export const celebrateEndWithDie = (tier: number) => Math.max(TIER_SECS[tier] + 0.6, dieBirthAt(tier) + 1.2);
```
- tier 2 (FLOT, 10–20×): birth 1,50 s = count-up end.
- tier 3: birth 2,50 s. tier 4: 5,50 s. tier 5: 8,50 s. For tiers 3–5 the expo.out count shows ≥ 99,6 % of the final amount at the birth moment.
- The birth is never during the title slam (0,05–0,60 s).
- The celebration auto-closes at celebrateEndWithDie: tier 2 at 2,70 s (instead of 2,20), tier 3 at 3,70 s (instead of 3,60).
- Tier 4–5 show "Fortsæt" at max(TIER_SECS − 0,5, birth + 0,9): 6,4 s and 9,4 s.
- Celebration.play gets `o.die?: { onBirth(instant: boolean): void }`. It schedules `tl.call(onBirth, [false], birthAt)` and uses the extended close time.

## Storyboard (R = result beat = celebration start; tier 2 shown, other tiers shift by their birth time)

**R+0 → R+1,50:** the celebration exactly as today (dim, title slam, count-up 0,3–1,5 s, 'win' level 2 stinger).

**R+1,50, BIRTH:**
- The die appears at the anchor: scale 0.25 → 1.0 over 520 ms (back.out(1.6)), alpha 0 → 1 over 160 ms.
- Tumble: rotation −1,2 turn → 0, landing in the image's native ¾ pose. Fake 3D: scale.x × (0.55 + 0.45·|cos φ|).
- The halo fades to α 0.35 over 400 ms.
- 8 glint particles (speed 160, life 0,5 s).
- Sound: 'dieBirth' at R+1,55 (three glass clicks + a D5/A5 dyad, tail 1,2 s, air shimmer baked in at +0,35 s).

**R+1,85, GLINT:** a white softBand, α 0.35, masked by the die, sweeps top-left → bottom-right in 300 ms. It is a specular on a ~62 px object: it never touches uber.exposure and never calls w.flash().

**R+1,95, CAPTION:** "TERNING NR. 38" fades α 0 → 0.85 over 250 ms.

**R+2,70, CLOSE:**
- The celebration fades out as today (300 ms), and the caption fades in 150 ms.
- Game: celebrate() resolves; `finishSpinHud(r, …, dieNo)` updates the balance, win strip, session net and the announcement, which gets " Terning nr. 38 er lagt i Terningekammeret." appended.
- Then `await this.award.fly()`.

**R+2,75 → R+3,35, FLIGHT (600 ms, power2.inOut):**
- DOM canvas on a quadratic Bézier to `hud.diceTarget()`. The control point is the midpoint lifted by 18 % of the distance (a lob), and the target is re-measured every frame, so a resize mid-flight is safe.
- Size 62 → 18 px (20 on desktop); rotation +1,25 turn, landing at 0.
- Aurora trail: one Pixi glint every 40 ms at the canvas position, cycling teal → violet → magenta, life 0,45 s. Off on quality tier 2 and in calm.

**R+3,35, LAND:**
- The canvas is removed.
- hud.landDice(38): .land pop and ring plus the number roll.
- Sound 'dieLand' (a glass-on-stone tock, UI bus). Haptic 12 ms.
- shownDice = count − heldDice. The award resolves.
- THEN Game goes idle, or runStorm() if this spin triggered a Solstorm. The die has always landed before the cinematic captures the screen.

**Totals:**
- The tier-2 idle moves from about 2,2 s to 3,35 s after the result (~0,5 % of spins).
- By construction no die is ever in the air or audible when the next spin starts.
- Tier 3 lands at R+4,35. Tier 4–5 land 650 ms after "Fortsæt".

## Skip

A tap or Esc is allowed ≥ 1 s after the result, as today.
- If the die is not born yet, it appears instantly at full size (no tumble, no glint).
- The flight starts at once and lasts 300 ms.
- Contract: award.done ≤ skip + 300 ms + 1 frame.
- For tier 4–5 a skip jumps the count (tl.progress(1)) and births the die instantly. "Fortsæt" then closes and the 300 ms flight follows.

## Calm mode (same window)

- No tumble, bounce, particles, glint, trail, halo pulse or haptic.
- R+birth: a 300 ms fade-in at final size, with the caption.
- At CLOSE the die fades out in place (250 ms) while the chip icon lifts α .7 → 1, the number crossfades (200 ms) and a static violet ring shows for 600 ms.
- Landing = CLOSE + 250 ms.
- Sounds −3 dB (gain 0.7).

## Storm-spin variant

Real storms only. S = that storm spin's result beat.

**S+0, POP:**
- Position: the centroid of the cluster with the largest winOre in the spin (`grid.globalCenter` of its cells). Fallback: the grid centre.
- Size: clamp(40, storm cell × 1.1, 72).
- scale 0 → 1 in 220 ms (back.out(2)).
- Quench: tint 0xff6a00 → 0xffffff over 300 ms, "the die cools out of the storm".
- Halo white-hot 0xfff4e0 at α 0.3 (never crimson). 6 'ember' particles in amber/whitehot.
- Sound 'dieQuench'. SR: "Terning nr. {n}. Den lægges i kammeret, når stormen har lagt sig."

**S+300 → S+750, HOLD:**
- The die shrinks to the held size (14 px phone, 20 px desktop) and zips (450 ms, power2.in) to held slot k on the molten frame's top edge.
- Slots are right-aligned: x = r.x + r.size − 12 − k×16, y = r.y − 9.
- Landing: 'dieHold' tick, constant pitch (no escalating pitch).
- More than 8 held: slot 8 shows an IsText "+{m}".

**Loop:** the storm loop awaits `Promise.all([wait(0.25), pop])`, so it waits 0,8 s instead of 0,25 s on die spins only. The next storm spin never starts with a die in motion.

**Summary card** (real): the row "Terninger fra stormen · {k}", from activeStorm.diceAwarded, when k > 0.

**stormOutro:** run `Promise.all([w.stormOutro(), award.releaseHeld()])`.
- At outro +1,2 s (the crimson has cleared and the frame alpha is 0) the held dice rise one by one, 220 ms apart, each as a 700 ms DOM flight to the chip.
- Each landing rolls shownDice +1 with 'dieLand' at −3 dB.
- After 4 flights, the rest merge into one brighter die that rolls the remainder at once.
- SR: "{k} terninger fra stormen er lagt i Terningekammeret."
- Everything ends ≤ 2,6 s into the 3 s outro, so no extra wait.

**Resume after a reload:** the held row is rebuilt from activeStorm.diceAwarded, and shownDice = count − held.

**Calm storm:** a 200 ms fade-in at the cluster, then a crossfade (200 ms out, 200 ms in) to the slot after 400 ms. In the outro the held dice fade out together at +1,2 s (300 ms) and the chip crossfades to the total at +1,6 s.

## Demo storms and "Udløs via 4 sole"

- Nothing is awarded.
- A qualifying demo storm spin shows a ghost pop at the cluster with the IsText "DEMO · TÆLLER IKKE" (muted, 10 px) under it. The ghost dissolves in place after 600 ms (400 ms). No hold and no flight.
- The demo summary row reads "Terninger · demo · tæller ikke · {k}", and the demo note says "… giver ingen terninger".

## Photosensitivity (FlashBudget)

- The award never calls w.flash() or uber.exposure. Glint, halo and chip ring are local (< 1 % of the screen).
- Magenta appears only on small sprites. No saturated red anywhere; storm dice are quenched to white.
- A luminance.mjs segment covers the award in calm and full mode.

## Opt-out

With Settings.dice = false:
- no DieAward sprites, no flight, no storm pops or held row;
- the count still increments silently and the Historik mark is kept;
- no SR die sentence.

## firstDie

The idea is sold in the first minutes by two one-time moments, neither of which carries a call to play.

## A) FIRST-VISIT INTRODUCTION: non-modal coach card "#hello"

**When:**
- Once ever (dice.helloSeen), set when it is shown.
- 1,2 s after the first idle following "Tænd himlen".
- Only if settings.dice is on, there is no active storm, no deep link (#solstorm/#1948/#kammer/#terning) and no demo pending.
- Returning players from before this feature also see it once.
- The first-visit splash welcome is UNCHANGED (4 lines, ≤ 35 words; welcome.test stays green), and no returning-splash dice line is added.

**Position:**
- `position:absolute` in #overlays, computed from the chip rect:
  - left = max(gutter, chipRect.left − 12);
  - bottom = innerHeight − chipRect.top + 10;
  - width = min(320px, 100% − 2×gutter).
- A 10 px caret points down at the chip icon.
- Style: var(--glass-strong), 1 px rgba(138,92,255,.40), radius 16, padding 14 16.
- A 44 px die canvas at top-left glints once 500 ms after entry (Canvas2D 'source-atop' band, 600 ms; none in calm).
- Entry: opacity plus a 6 px rise over 400 ms (calm: opacity only).

**Text:**
- eyebrow 10,5 px, .2em, muted
- title 15 px/700, ice
- body 13,5 px, #cfe2ff
- myth 13,5 px, cool #b9d9ff
- facts 13,5 px, #cfe2ff: the SAME size as the body, never a footnote

**Buttons:** [Se kammeret] (btn small ghost) opens the chamber from idle; [Luk] (btn ghost small).

**Behaviour:**
- role="dialog", aria-modal="false", aria-labelledby the title. It does not take focus; the text is announced once through w.announce.
- Dismissed by Luk, Esc, "Se kammeret", or pressing SPIN. The spin proceeds normally: this card is not a disclosure gate.

**Copy:** exactly as in the copy field (FIRST-VISIT INTRODUCTION).

## B) FIRST-DIE CARD: modal, relic style

**When:**
- Once ever (dice.introSeen).
- 250 ms after the game returns to idle after the first REAL die: after the landing, or after the storm outro if the die came from a storm spin.
- Never during a result, a flight or a storm. Never in demo.

**Presentation:** the existing #summary overlay with `showSummary(html, 'relic')` → `.card.base.relic`.

```css
.card.relic { padding-top:56px; border-color:rgba(138,92,255,.45); box-shadow:0 0 50px rgba(138,92,255,.22),0 20px 60px rgba(0,0,0,.6); }
.card.relic .medal { position:absolute; left:50%; top:-44px; width:88px; height:88px; transform:translateX(-50%); }   /* die canvas */
.card.relic h2 { color:#cdb8ff; }
.card.relic .t { font-size:20px; font-weight:700; color:var(--ice); margin:2px 0 8px; }
.card.relic p { font-size:13.5px; line-height:1.45; color:#cfe2ff; margin:0 0 8px; text-align:left; }
.card.relic .facts { color:#cfe2ff; }                      /* same size as the body */
.card.relic .btns { display:flex; gap:10px; justify-content:center; margin-top:12px; }
```
- The medallion is the die canvas at 88 px. One slow glint 600 ms after the card lands (none in calm).
- Enter: the existing 0,4 s fade/scale.
- Sound: the first two notes of the 1-9-4-8 motif. bell1948 level 1 (D3) at +0 and level 2 (E4) at +704 ms, gain 0.5 (≈ −20 dBFS). The full motif is kept for the gate.

**Focus and keys:**
- showSummary is changed to focus `[data-primary]` first → "Forstået".
- Space, Enter, Esc and the SPIN button all mean "Forstået", but ONLY once the card has been visible for ≥ 1,5 s. Before that they are ignored, so the disclosure cannot be skipped by habit.
- Game state is 'diceCard', so spinning is blocked while it is open.

**Buttons:**
- [Se kammeret] (btn ghost small, data-act="chamber") closes the card and opens the chamber.
- [Forstået] (btn small, data-primary, data-act="ok").
- Deliberately no "Spil videre" and no "Fortsæt".

**Copy:** exactly as in the copy field (FIRST-DIE CARD). The honest distance (about 277.000 spin) and "indsatsens størrelse er ligegyldig" appear at first contact.

**Demo:** "Vis første terning" shows the same card with the amber `.demo-note` first, under setPersistenceEnabled(false). introSeen is not written.

**Fallback if user testing finds it intrusive:** the same content as a non-modal card that does not block SPIN (the #hello component), keeping the 1,5 s minimum before SPIN can dismiss it.

## Opt-out

When Settings.dice is off, neither card is shown and both flags are set (see awardDie). The rules tab carries the same facts.

## chamber

## FORM

A DOM dialog layered over a Pixi centrepiece drawn on the LIVE NORDLYS sky, at the player's own Kp (the sky is never boosted or lowered).
- DOM: `<section id="chamber" role="dialog" aria-modal="true" aria-labelledby="chTitle" aria-describedby="chSum">` in #overlays, inserted BEFORE #menuWrap, so the rules menu can open on top of it.
- It spans from the regulatory strip to the footer: `top: calc(var(--reg-h) + env(safe-area-inset-top))`, `bottom: calc(var(--foot-h) + env(safe-area-inset-bottom))`, `left/right: 0`.
- #reg (with the balance, see hud) and #foot stay visible and interactive.
- There is no backdrop-filter: the Pixi world is the backdrop. Legibility comes from gradient scrims: `linear-gradient(180deg, rgba(3,7,18,.55) 0, rgba(3,7,18,0) 24%, rgba(3,7,18,0) 66%, rgba(3,7,18,.78) 82%, rgba(3,7,18,.9) 100%)`.
- Opens from idle only: the chip, the desktop panel, the menu tab, the hello card, the first-die card, the key T, #kammer.
- State 'chamber'. Space does nothing. Esc, ✕ and "Luk" close it.

## DOM STRUCTURE

```html
<div id="chRibbon" class="ch-ribbon" hidden></div>
<header class="ch-hdr">
  <div><p class="ch-eb">Terningekammeret · Møns Klint</p><h2 id="chTitle">Porten under klinten</h2></div>
  <button class="iconbtn" id="chMute">…</button>
  <button class="iconbtn" id="chClose" aria-label="Luk Terningekammeret">✕</button>
</header>
<div class="ch-myth" id="chMyth" aria-hidden="true"><!-- line spans, pair wrappers, concept chip --></div>
<div class="ch-gate" id="chGate" aria-hidden="true"></div>          <!-- Pixi slot, measured like #slot-grid -->
<p class="sr" id="chSum"></p>
<div class="ch-count">
  <span class="n num" id="chN">37</span><span class="w" id="chW">terninger</span>
  <span class="tag" id="chTag" hidden>forhåndsvisning</span>
  <button class="btn gate" id="chOpen" hidden>Åbn porten</button>
  <span class="st" id="chSt" hidden>Porten står åben.</span>
  <button class="btn ghost small" id="chReplay" hidden>Se åbningen igen</button>
</div>
<ul class="ch-facts" id="chFacts"><li>F1</li><li>F2</li><li>F3</li></ul>
<div class="ch-act">
  <button class="linkbtn" id="chRules" aria-label="Regler og tal for Terningen">Regler og tal ›</button>
  <button class="btn ghost small" id="chDone">Luk</button>
</div>
```

**Text styles:**
- eyebrow: 11 px, .24em, muted, uppercase.
- title: 20 px/600, ice (desktop 30 px).
- myth: 14,5/20 px, centred, max-width 344 px. Tones: cool #b9d9ff, ice, strong (ice, 500), muted.
- concept chip: `.chip` neutral (line-strong border, frost, 11,5 px). Never amber, because amber means demo.
- count: 34 px/800 (desktop 64 px) with gradient text #19e3d6 → #8a5cff → #ff2bd6. At 0 the count is muted with no gradient.
- facts: 12/17 px, frost at .9; each li carries a 1 px left rule rgba(138,92,255,.35).
- `.btn.gate`: the violet perk-button look with NO animation.
- ribbon: amber dashed like `.card .demo-note`, 11,5 px, centred, sticky at the top. It is not among the #clean-hidden ids, so #clean cannot remove it. Replay ribbons use the neutral chip look.

## CSS GRID PER VIEWPORT

**Phone portrait (default):**
- `grid-template-rows: auto 46px auto minmax(200px,1fr) auto auto 52px`, padding 0 16 px.
- Rows: ribbon | header | myth | gate | count | facts | actions.

**Fit loop.** Run it in placeChamber(), on the same pattern as placeWelcome. Increase `data-fit` until the #chGate height is ≥ 200 px:
1. Hide the eyebrow.
2. Hide myth line 7.
3. Use the condensed myth.
4. Facts at 11,5/15,5 px.
5. Compact count row (count and label inline with the buttons) and actions at 44 px.

The count, the concept chip, F1–F3 and "Luk" are NEVER dropped, and everything is above the fold (nothing scrolls in portrait).

Worked budgets:
- 390×844: stage 782 px; the fixed rows total ≈ 474, so the gate slot is ≈ 308 at fit 0.
- 375×667: needs fit 3, giving ≈ 227.
- 360×640: needs fit 4–5, giving ≈ 203–215.

**Landscape phone** (max-height 500 px and landscape): columns 55 % | 45 %. The left column holds header, myth, count, facts and actions and scrolls (overflow-y auto, 24 px bottom fade). The right column is the gate slot, full height.

**Desktop** (≥ 1000 px and ≥ 5/4):
- Columns `minmax(280px,26%) 1fr minmax(300px,26%)`, rows `auto 60px 1fr 52px`.
- The header spans all columns.
- Myth in column 1, align-self start, margin-top 12vh, 18/28 px.
- Gate slot in column 2, rows 3–4.
- Count and facts in column 3, align-self end; facts 13/19 px.
- Actions in column 3, row 4.
- Nothing scrolls at 1080 or 720.

## PIXI CENTREPIECE: GateView (src/render/chamber/GateView.ts)

**Layer.** A new stage layer `chamber`, inserted in app.ts scene order directly after `sky` (before frameBack), so it is bloom-lit and the Particles layer sits above it.

**Build.** `build(slot, stage)` runs on open and on resize while open (debounced 150 ms). Geometry in px from the slot S:
- Opening: H = min(0.74·S.h, 0.60·viewportH, 607), W = H / 1.32. If W > 0.62·S.w then W = 0.62·S.w and H = 1.32·W.
- Centre cx = S.x + S.w/2. Opening top: oy = S.y + 0.32W + (S.h − H − 0.37W)/2.
- The arch: round top radius W/2, straight jambs.
- Examples: 390×844 → 176×232; 1280×720 → 311×411; 1920×1080 → 460×607.

**1. WALL.** One Canvas2D bake per layout. Resolution min(DPR, 1.5) × 0.75, max 2048 px wide. Kept in memory for context restore and uploaded as a Sprite. It spans x 0..stageW, from the ridge y (= oy − 0.42W) down to oy + H + 0.05W + 40, with a 40 px fade to transparent.
- Chalk: vertical gradient #3b4557 → #2b3345 (65 %) → #1a2030. These are PAL.chalk values pre-lit for night.
- Ridge: noise polyline with a 1 px rim #9cc9ff at α .35, dark tree bumps (#050b1a) on the outer thirds, and a 12 px feather into the live sky.
- 180 vertical erosion streaks: #56617a at α .10–.22, and #151a28 at α .15.
- Six flint bands at wall-height fractions .18/.31/.44/.57/.70/.83. Nodules every 9–16 px, ellipses rx 2–5 / ry 1,5–3, #0B1022 at α .75. The bands are interrupted by the portal and the niches.
- Three stepped archivolts: widths 0.07W / 0.06W / 0.05W, fills #4a5569 / #434d61 / #3c4558, voussoir joints 1 px #1a2030 at α .6.
  - The INNER ring has exactly 19 stones and the OUTER ring exactly 48. This "19 | 48" cipher is never mentioned anywhere.
  - Ice crust: a 1,5 px #cfefff stroke at α .45 on the inner edge, plus a 3 px #19e3d6 glow at α .12.
- Keystone socket: 0.13W square at the crown, recessed (#141a28, 1 px rim #9cc9ff at α .25).
- Lintel plaque: 0.62W × 0.12W above the outer archivolt, chiselled (1 px highlight below, shadow above).
- Threshold step under the opening.
- The OPENING is cut out with 'destination-out'.
- Six niches: rounded-top recesses nw × 1.55nw, where nw = clamp(28, 0.15W, 72), filled #0a0f1c with an inner-shadow gradient.
  - Columns at cx ± (W/2 + 0.18W + max(0.9nw, min(0.5·sideRoom, 0.35W))), where sideRoom is the room from the outer archivolt to the screen edge minus 16.
  - Rows at oy + 0.30H, 0.55H and 0.80H.
  - NORDLYS is the LEFT column, MIDDLE row.
- Grooves: 2 px carved lines (#141a28 plus a 1 px highlight) from each niche to its jamb.
  - The NORDLYS groove continues up the left jamb and along the outer archivolt to the keystone. Its polyline is stored as `keyPath` for the ceremony and for the lit overlay.
- Runtime tint: `wall.tint = mix(0xffffff, env[0], 0.25)` every frame (world.sky.envColors()), so the live aurora lights the chalk.

**2. LEAVES.** Two Containers, pivot at the outer jamb. Each holds:
- a baked half-arch Sprite: rgba(11,27,58,.92) → rgba(6,14,34,.95), 40 faint #19e3d6 caustic ellipses at α .03, a 1,5 px #19e3d6 fresnel edge at α .5, a 1 px #cfefff seam at α .25;
- a 3 px "edge strip" Graphics used for fake thickness while swinging;
- a ParticleContainer with 974 tile Particles, `dynamicProperties { color:true }`, blend 'add'. The tile texture is a baked 8 px rounded rhombus with a soft core.

**3. TILES (gateLattice.ts, pure and layout-independent):**
- A hex lattice in NORMALISED gate units (width 1, height 1.32), so the lit pattern is identical on every device.
- Points closer than half a spacing to the border or the centre seam are dropped. Each leaf keeps exactly the 974 points farthest from its border.
- Rendered tile size = 0.68 × spacing: ≈ 3 px on phones, ≈ 8 px on desktop.
- Unlit: tint #9cc9ff, α 0.10.
- Lit: α 0.85, with the aurora colour at the tile's height: #3dffb0 at the bottom → #19e3d6 in the middle → #8a5cff at the top, and the top 10 % blended 30 % toward #ff2bd6.
- `gateOrder(seed)`: a progressive blue-noise permutation of all 1948 tiles. Farthest-point sampling from a seeded random start, with each score × (1 + 0.15·hash(seed, i)) as jitter. Cached; about 10 ms.
- `lit = order.slice(0, min(count, 1948))`.
- Result: early dice spread evenly over both leaves, late dice fill gaps, there is no front line, and the last tile is a seed-dependent random interior tile.
- The keystone is NOT a tile.
- Twinkle: lit tiles only, α ±12 % at 0,1–0,3 Hz (static in calm).
- Nothing changes at any count between 1 and 1947 except that one more tile is lit: no sound, no copy change, no ring or leaf completion effect.

**4. KEYSTONE DIE.** A Sprite of the die texture at 0.11W.
- Sealed or pending: a ghost at α .14 with tint #9cc9ff.
- Open: the full die at α 1, seated.

**5. LINTEL "1948".**
- IsText 'ice', size min(0.085W, 48), tracking .45, centred on the plaque.
- Engraved: α .55, glow .6. Lit (after the ceremony, or in the open preview): α 1, glow 2.

**6. NICHES AND CABINETS.** Six baked Canvas2D silhouettes, about 0.8nw × 0.85nh, centred in their niches.
- The five dark ones are fill #050b1a with a 1 px rim rgba(156,201,255,.25) and a slightly lighter screen #0b1428 with one diagonal reflection line at α .12. Each has a distinct shape: arched topper, tall porthole, wide low, slanted top, twin screen. They have NO names, numbers, symbols or games, and their grooves stay unlit, even in a real unlock.
- NORDLYS is a rounded upright cabinet:
  - body #0b1b3a with a 1 px teal rim at α .5;
  - screen: a 3×3 of PAL.sym gem colours on #06101f, with an aurora topper line;
  - lantern: softDot, additive, #19e3d6, α .30, 2.2 × nw;
  - its groove overlay: Graphics stroke with a teal → violet gradient at α .5;
  - a softDot light travels the groove every 6 s over 1,8 s (static glow in calm);
  - label under the niche: IsText 'muted' "NORDLYS", size max(9, 0.3nw), tracking .16.
- There is no per-machine tally.

**7. LIGHT** (behind the leaves, inside the opening): an additive softDot tinted #fff4e0 at 0.9 × the opening, plus a vertical softBand tinted #cfe6ff.
- Sealed or pending: α 0.
- Open: α .6, breathing ±.03 at 0,1 Hz (static in calm).

**8. OPEN-STATE TEXTS.** Inside the light, centred at oy + 0.3H:
- IsText 'ice' "AUTOMAT 1948", size clamp(16, 0.075·min(W_stage, 720), 54), tracking .14, α .9. It may overlap the arch.
- DIRECTLY under it, IsText 'muted' "KONCEPT · FINDES IKKE I DENNE DEMO", size max(9, 0.022·min(W_stage, 720)), tracking .3.
- These two are never apart, and no cabinet, outline, grid or paytable is ever drawn.

**Scene cost.** About 12 draw calls, well under 1 ms per frame on mid-range phones. update() runs only while the chamber is visible.

## ROW OF MACHINES (the "across many machines" idea)

- Six niches in the same cliff, all feeding the same gate in the story. Only NORDLYS carries light.
- The facts say "De fem mørke automater er pladsholdere".
- The SR summary says "NORDLYS lyser, de fem andre er mørke pladsholdere".

## STATES (DiceView → GateView.setView)

| State | Tiles | Leaves | Keystone | Light | Lintel | Myth / count |
|---|---|---|---|---|---|---|
| sealed (count < 1948) | lit = count | closed | ghost | 0 | engraved | full myth, count |
| pending (≥ 1948, not opened) | all lit | closed | ghost | 0 | engraved | pending lines, [Åbn porten] |
| open (unlock 'seen', or the 1948 preview) | all lit | open (scale.x .14, dim ×0.6) | seated | .6 | lit | "AUTOMAT 1948" + label, open myth, "Porten står åben.", [Se åbningen igen] (real only) |

**Preview** (drawer: 0, 25, 250, 1000, 1948): the same states for {N}, the amber ribbon, and the count tag "forhåndsvisning". It ends when the chamber closes; the real view is then restored.

## OPEN AND CLOSE

**Open (900 ms, identical on every visit, with no "greeting" sweep and no bell):**
- 0–600 ms: the machine layers fade to 0 and are then hidden (frameBack, grid, cellFx, frameFront, arc, motes, popups; w.setMachineAlpha). world.logo is hidden.
- 0–900 ms: camera zoom 1.00 → 1.03 (power2.inOut).
- 200–900 ms: GateView α 0 → 1, y +24 → 0.
- 400–900 ms: the DOM fades in; :root.chamber is set; focus moves to #chClose.
- Audio: `setMusicFilter(4500, 0.8)` + `duck(−3, 0.8)`, so the music sounds as if heard inside the cliff.
- Calm: a 400 ms crossfade with no zoom and no y move.

**Close (500 ms):** the reverse.
- `setMusicFilter(20000, 0.6)`, `duck(0, 0.6)`.
- placeLogo(); state idle; focus returns to the chip only for keyboard (Esc) closes, following the existing openMenu rule.

**Open-state audio.** While the chamber is in the open state after a real unlock, the music is NOT filtered: the room is no longer sealed.

## A11Y

- The dialog labels are listed above. #chSum is rewritten on every state change. Canvas content is aria-hidden and fully described by #chSum.
- `inert` is set on #hdr, #slot-arc, #winstrip, #deck and .side while the chamber is open.
- All buttons are ≥ 40 px tall.
- Contrast: ice and frost on a ≥ .55 dark scrim.
- Calm mode is covered above.
- #chRules opens the menu on the "Terningen" tab over the chamber; closing the menu returns to the chamber.

## unlock

## TRIGGER (real)

- addDie() crosses 1948 and sets unlock to 'pending'.
- At the next idle (after the flight, or after the storm outro), and only once (offered = true), the UNLOCK CARD appears via #summary as `.card.base.relic` with the big gradient "1948". Copy is in the copy field.
- Sound: one bell1948 level 1 stroke at −20 dBFS.
- The card is inert to SPIN and Space (it needs an explicit button). Esc means "Ikke nu".
- "Ikke nu" keeps 'pending'. There is never a reminder; the chamber shows [Åbn porten].
- Dice are never spent.

## PRE-ROLL

On [Åbn porten] (card or chamber), the drawer tool, or #1948:
- State 'ceremony'.
- If the chamber is not open, run its 900 ms open transition.
- `audio.prepareGate()`, raced against a 2 s timeout.
- The chamber DOM text fades out (class :root.ceremony, 600 ms). The ribbon and the reg/foot stay.
- T0 = the first base-bed bar line ≥ max(open done, now + 0,9 s):
  - `g = audio.grid(); T0 = g.start + ceil((now + 0.9 − g.start)/g.bar)·g.bar`, where the bar is 2,817 s (Polar Night, 85,2 BPM, D aeolian). The code bed shares the grid.
  - If grid() is null: T0 = now + 0,9 s.
- `anchorToAudio(() => A.now(), () => A.latency())`, as in the Solstorm cinematic.
- All SFX are scheduled with `when: T0 + t`.

## STORYBOARD

Seconds from T0. B = 2,817, beat b = 0,704. Total 6 bars = 16,9 s.

### BAR 1 · 0,000–2,817 "Stilheden"
- 0,000: the Pixi eyebrow fades in above the lintel over 600 ms (IsText 'muted', max(10, 0,026 s), tracking .3). Text: "TERNING NR. {n}" (real), "DEMO · FORHÅNDSVISNING" (demo) or "GENSYN" (replay).
- 0,000: `setMusicFilter(900, 2.0)` + `duck(−6, 2.0)`. 'gateDrone' starts (1,5 s attack, −18 dBFS).
- 0,600–2,600: the lit tiles' twinkle amplitude eases to 0; the gate holds its breath.
- 0–5,634: camera zoom 1.03 → 1.06 (sine.inOut).
- SR: the start line (see copy).

### BAR 2 · 2,817–5,634 "De 1948 lys"
- 2,817: a shimmer wave climbs bottom → top through both leaves in 1,6 s. Each tile's brightness goes ×1.0 → ×1.25 in 500 ms (sine.out) and falls back in 700 ms. The rise is never faster than 500 ms and never above ×1.25.
- 2,817: 'tileShimmer' (16 FM glass notes on the Dm chord tones D5 F5 A5 C6 D6 F6 A6 C7 …, −22 dBFS).
- 4,225: the NORDLYS lantern goes α .30 → .65 over 800 ms and its groove overlay .5 → .9.
- The five dark niches stay dark for the whole ceremony.

### BAR 3 · 5,634–8,451 "Nøglen" (NORDLYS brings the key)
- 5,634: a die Sprite (0.16W: ≈ 28 px on a phone, 72 px on desktop) fades in at the NORDLYS cabinet screen (400 ms). 'dieBirth' at gain 0.5.
- 5,834–7,634: it travels along keyPath (niche → jamb → outer archivolt → keystone) in 1,8 s (sine.inOut), with one fake-3D half-flip at the midpoint. 16 glint particles trail, one every 110 ms, in teal/violet.
- 7,634: the die seats in the keystone.
  - scale 1.08 → 1 (back.out, 200 ms); the ghost is hidden.
  - 'keystone' (stone tock + glass click + low D2 bell, −14 dBFS).
  - Camera 1.06 → 1.075 → 1.065 over 300 ms. Haptic 25 ms.

### BAR 4 · 8,451–11,268 "Årstallet" (one digit per beat: the year becomes the tune 1-9-4-8 = root, 9th, 4th, octave)
- 8,451: "1" lights (IsText α .55 → 1, glow .6 → 2, 300 ms) + bell1948 level 1 (D3, −14 dBFS).
- 9,155: "9" + level 2 (E4).
- 9,859: "4" + level 3 (G3).
- 10,563: "8" + level 4 (D4).
- Each stroke sends a resonance wave through the tiles, inside-out from the keystone: ×1.15 (rise 500 ms, fall 800 ms), with the front crossing the door in 700 ms. Each wave first asks `w.allowFlash()`; if denied, the wave is skipped.

### BAR 5 · 11,268–14,085 "Seglet brister"
- 11,268: a seam of cold light draws bottom → top between the leaves in 450 ms (width 2 → 5 px, #eaf8ff core, teal halo at α .5). It is gated by allowFlash().
  - 'sealCrack' (filtered crack + 38 Hz thump, −14 dBFS). Haptic [20, 40, 20].
  - 'gateDrone' crossfades into 'lightPad' (Dm(add9) choir, −18 dBFS) over 1,2 s.
  - REAL only: `dice.unlock = 'seen'`, `unlockedAt = now`, persist().
- 11,268: `setMusicFilter(20000, 2.3)` + `duck(0, 2.3)`. The user's Polar Night comes back in full as the light pours out.
- 11,500–13,800 (2,3 s, power2.inOut): the leaves swing open on their outer hinges.
  - scale.x 1 → 0.14; skewY ±0.05; tint 0xffffff → 0x5a6a8a; the edge strip widens 0 → 6 px.
  - 'gateBreath' (a 2,3 s low filtered-noise swell).
- 11,500–13,800: the light behind rises slowly (never a flash): core α 0 → .8, band α 0 → .5 (power1.in).
  - bloomCtl.strength 1.0 → 1.35.
  - world.skyGlowFloor 0 → 0.6, a new floor on skyP.glow: ≤ 6 % luminance lift, no Kp change, no red, no crackle.
  - The wall tint lerps 25 % toward #fff4e0.
- 11,500–12,700: frost falls from the lintel: 40 'snow' + 24 'dust' particles.

### BAR 6 · 14,085–16,902 "Automat 1948"
- 14,085: "AUTOMAT 1948" rises inside the light: reveal 0 → 1 plus sweep −0,2 → 1,2 over 1,2 s, y +10 → 0 (the NORDLYS splash-logo move).
  - SIMULTANEOUSLY, directly under it, "KONCEPT · FINDES IKKE I DENNE DEMO" fades in over 400 ms. The label arrives with the name.
- 14,085 / 14,789 / 15,493 / 16,197: a motif echo 1-9-4-8 an octave up (bell1948, rate ×2, gain 0.4).
- 14,085: the eyebrow fades out (600 ms).
- 16,902: the DOM placard fades in (400 ms, rises 8 px). Focus moves to its primary button.
  - The drone and pad fade over 4 s. releaseAudioAnchor(). skyGlowFloor → 0 over 3 s. The light settles to .6.
  - SR: the end line.

## PLACARD

`.card.base.relic.placard` via #summary. Copy is in the copy field.
- Position: on phones, bottom-anchored (12 px above the footer, max-height 52 %, scrollable body), so "AUTOMAT 1948" in the gate's upper third stays visible. On desktop, in the right column, vertically centred.
- [Se kammeret]: state 'chamber' in the open state, music unfiltered.
- [Tilbage til NORDLYS]: the chamber closes (500 ms), then idle.

## SKIP

- Available from 2,0 s after T0, including the first real viewing, by tap (pointerdown on #chamber), Esc or Space.
- `tl.progress(1, true)`, then apply the end state explicitly: leaves open, light .6, digits lit, key seated, texts shown.
- Audio: `A.cancelScheduled()`; fade gateDrone and lightPad in 0,3 s; `setMusicFilter(20000, 0.3)`; `duck(0, 0.3)`.
- skyGlowFloor → 0 over 1 s. The placard appears immediately.
- REAL: persist 'seen' if not already.
- It never replays automatically.

## CALM VARIANT (~8 s, not bar-anchored; starts at pre-roll end; sounds kept, motion removed)

| Time | Event |
|---|---|
| 0,0 | eyebrow; duck and filter over 1 s |
| 1,0 | tiles steady (no shimmer) |
| 1,2 | the key crossfades niche → keystone (300 ms out, 300 ms in), 'keystone' at 1,8 |
| 2,4 / 3,2 / 4,0 / 4,8 | digits light by opacity with the four bell strokes (no waves) |
| 5,6 | seal: no seam brightening; the leaves crossfade to the open pose over 1,0 s; light → .5; bloom 1.0 → 1.15; skyGlowFloor ≤ .3; no particles, no camera, no haptic |
| 6,8 | name and label fade in together (600 ms) |
| 8,0 | placard |

## FLASHBUDGET

- No w.flash() anywhere.
- Every large-area rise takes ≥ 500 ms (tiles) or ≥ 1 s (light, bloom).
- The seam and the four resonance waves go through `world.allowFlash()`: the existing flashTimes bookkeeping, extracted from world.flash() with no exemptions.
- Nothing is red.
- The ceremony and its calm variant must pass scripts/luminance.mjs.

## DEMO VARIANT (drawer "Åbn porten · 1948" or #1948)

- setPersistenceEnabled(false), snapshot(), and demoMode for its duration.
- A HARD CUT to the gate at DiceView {count: 1948, mode: 'demo'}. There is no time-lapse count-up.
- The amber ribbon "DEMO · Portens åbning vist med demo-værktøjet · tæller ikke · dit antal er uændret ({n})" stays pinned from the first frame to the last. It is DOM in #chamber, which #clean does not hide.
- The eyebrow is "DEMO · FORHÅNDSVISNING". The placard starts with the amber demo-note. Button: [Afslut demo].
- It never writes unlock or unlockedAt.
- On "Afslut demo":
  1. the leaves close (reverse 1,2 s; calm: 0,5 s crossfade) and the light dims;
  2. restore(snap), and GateView returns to the real view;
  3. the chamber closes;
  4. banner "DIN SAMLING ER UÆNDRET" / "{n} terninger · demo-åbningen talte ikke med".

## REPLAY ("Se åbningen igen", after a real unlock)

- The leaves reset to the closed, all-lit pose (400 ms). Then the full ceremony with eyebrow "GENSYN", the neutral ribbon, button [Luk], and no writes.

## WHAT PERSISTS AFTER A REAL UNLOCK

- dice.unlock = 'seen' and unlockedAt.
- The chamber opens in the open state: leaves open, light .6, lit lintel, seated key, "AUTOMAT 1948" + the concept label, "Porten står åben.", [Se åbningen igen], unfiltered music.
- The chip gets its thin aurora ring and the aria text "Porten står åben".
- The count keeps rising as a plain record, and the accession numbers continue ("TERNING NR. 2011").
- No second door, no new goal, no reminder. Nothing in NORDLYS changes: RTP, buttons and rules stay the same.

## demoTools

## DRAWER (⋯ DEMO-VÆRKTØJER)

A new block after the existing actions and the "Vis Kp" slider, before "Nulstil demo":
- a hairline, then `<h4>Terningen</h4>`;
- all buttons `.btn ghost small` inside the drawer's amber-hazard context.

1. **[Vis en terning]**, id dDie → intent demoDie. Idle only; otherwise the existing "DEMO-VÆRKTØJER · Virker mellem spin" banner.
   - It is award-only: no win amount, no celebration, no forward-searched spin.
   - State 'demoDie', setPersistenceEnabled(false), snapshot().
   - A soft local dim (softDot vignette, α .35) over the grid.
   - The die is born at the grid centre (same size, tumble, glint and sound as the real award).
   - Caption "DEMO · TÆLLER IKKE". Hold 1,3 s, then the 600 ms flight to the chip.
   - At the chip: the die dissolves (scale 1 → .6, α → 0, 400 ms) and the amber tag "+1 demo" shows for 1,5 s. The number never changes.
   - Banner "DEMO · TERNING" / "Sådan ser en terning ud · tæller ikke med".
   - restore(snap).
2. **[Vis første terning]**, id dFirst → demoFirstDie. The first-die card with the amber demo-note on top, under persistence off. introSeen is never written.
3. **[Åbn porten · 1948]**, id dGate → demoGate. The demo ceremony (see unlock), with the hard cut to 1948, the amber ribbon throughout, and no writes.
4. **"Vis kammeret med (kun visning)"**, a segmented control #dSeg with FIXED steps only: [0] [25] [250] [1000] [1948 · åben].
   - It opens the chamber in preview mode (DiceView mode 'preview') with the amber ribbon "FORHÅNDSVISNING · {N} terninger · dit antal er uændret ({n})". At 1948 the ribbon reads "… · porten åben · …" and the gate shows the OPEN state.
   - There is no slider and no 1947 step: a presenter cannot stage a near-miss or a nearly-full door. The pending "all lit, closed" image is only reachable by real play.
   - The preview ends when the chamber closes. The segmented buttons are 36 px tall, with aria-pressed.

The existing warning chip and hint texts are replaced as in the copy field.

**"Nulstil demo"** (drawer and settings) is the ONLY action that changes the real collection:
- `wipe(); wipeDice();` then new defaults, shownDice = heldDice = 0, and GateView.setView(real).
- Banner: "DEMO NULSTILLET" / "Saldo 1.000,00 kr · Kp 0 · 0 terninger".

**"Udløs Solstorm" and "Udløs via 4 sole"** never award dice. Qualifying demo storm spins show the labelled ghost pop only, and the summary row and note say so.

## KEYBOARD

- T = open Terningekammeret, from idle only (listed in the drawer hint).
- The existing E, M, Esc and Space bindings are unchanged. In 'ceremony', Space and Esc mean skip.

## DEEP LINKS

Bare tokens, parsed in main.ts with the existing token set, combinable with _ or -.
- **#1948** → `world.diceOnLoad = 'gate'`: the demo ceremony starts 2 s after "Tænd himlen" (same pattern as #solstorm, via afterIdle).
- **#kammer** → the chamber opens 600 ms after the grid assembles.
- **#terning** → the demo award 2 s after the intro.
- Examples: #1948_clean, #kammer_autostart.
- #clean hides only #demoPill and #drawerWrap; the chamber ribbon and the "DEMO" captions stay.
- Any of these tokens suppresses the one-time hello card.
- The README deep-link table gets the three rows.

## HOW DEMO NEVER TOUCHES THE REAL COUNT (defence in depth)

- (a) One mutator. addDie() is called only in Game.awardDie(), and awardDie() returns 0 when demoMode is set. Its only two call sites are spin()'s commit block and runStorm's `if (!demo)` block.
- (b) Renderers read a DiceView. The HUD, GateView and chamber DOM never read this.dice for previews or demos, and previews never copy back.
- (c) Every dice demo entry point wraps itself in `setPersistenceEnabled(false)` + snapshot()/restore(). saveDice() honours the same flag.
- (d) In dev builds, every demo entry point compares JSON.stringify(this.dice) before and after and logs console.error on a difference.
- (e) Tests:
  - dice-check.mjs instruments localStorage.setItem and asserts ZERO writes to 'terningen.v1' across demo(), demoSuns(), dDie, dFirst, all 5 previews and dGate (both skipped and full), and that the stored string stays byte-identical;
  - dice.boundary.test.ts statically asserts the single mutator and its two call sites.
- (f) Demo and replay ceremonies never write unlock or unlockedAt, and the demo never shows a count of 1947.

## QA HOOKS

Added to window.__slot. They are not reachable from the UI and are documented as QA-only.
- `dice()`: returns the store.
- `qaNext('die' | 'diePerk' | 'sun4')`: fast-forward counters to the next spin with x ≥ 10 and < 20, the next perk spin with x ≥ 10 at the locked stake, or the next spin with 4+ suns.
- `qaDice(n)`: sets the REAL count, for the unlock tests only.
- `award()`: { inFlight, held }.
- `ceremony(kind)`
- `chamber(open)`

## rules

## PLACEMENT

- New section in Menu › "Regler & RTP", after "SOLSTORM · G5 EKSTREM" and before "Tal".
- The same HTML is rendered in the new tab "Terningen" (between Kp-stigen and Historik), with "Åbn Terningekammeret" and the status line on top.
- One function, `diceRulesHtml(REPORT, CONFIG)` in src/ui/diceCopy.ts, builds it. Every number is generated from REPORT, which is produced by `npm run sim` and tied to modelHash; nothing is hard-coded. The values shown are today's simulation.

## SECTION HTML

```html
<h4>Terningen</h4>
<p>Hvert spin, der vinder <b>mindst 10 gange sin indsats</b>, giver <b>én terning</b>. Det gælder almindelige spin, Ladede spin (målt mod den låste indsats) og hvert enkelt stormspin i Solstorm (målt mod stormens indsats). Gevinsterne fra alle kaskader i samme spin lægges sammen, og et spin giver højst én terning.</p>
<p>Indsatsens størrelse er ligegyldig: terningen kommer lige ofte ved alle indsatser. <b>En højere indsats giver ikke flere terninger – kun et større forventet tab.</b></p>
<p>Stormgarantien er ikke et spin og giver ingen terning. Demo-storme og demo-værktøjer giver aldrig terninger og ændrer aldrig dit antal.</p>
<p>Terningerne udløber ikke og nulstilles ikke, når din ladning (Kp) udløber. De har ingen pengeværdi, ændrer ikke gevinster, sandsynligheder eller tilbagebetalingen (RTP) i NORDLYS og kan ikke købes, veksles eller overføres. Spin, der gav en terning, er mærket i Historik. I denne demo gemmes terningerne i din browser, og "Nulstil demo" sletter dem.</p>

<h4>Terningekammeret og porten</h4>
<p>Terningerne samles i Terningekammeret. I fortællingen ligger kammeret under Møns Klint, og porten har 1948 fliser af is. Hver terning tænder én flise. Ved 1948 terninger kan porten åbnes. Terningerne bruges ikke, og tællingen fortsætter bagefter.</p>
<p>I konceptet samler flere automater terninger til det samme kammer. De fem mørke automater i kammeret er pladsholdere: i denne demo findes kun NORDLYS, og kun NORDLYS giver terninger.</p>

<h4>Automat 1948</h4>
<p>Bag porten skulle Automat 1948 stå: en automat for dem, der har samlet 1948 terninger. I konceptet er Automat 1948 tænkt med højere tilbagebetaling end de andre automater. Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling.</p>
<p>En rigtig version skulle have sine egne regler og sin egen RTP.</p>

<h4>Tal for Terningen</h4>
<div class="kv num">
<span>Terning pr. betalt spin (inkl. Ladede spin og stormspin)</span><span>ca. {fmtPct(diceRate,2)} · 1 pr. {round(1/diceRate)}</span>          → ca. 0,70 % · 1 pr. 142
<span>· kun almindelige og Ladede spin</span><span>1 pr. {round(1/diceRateBase)}</span>                                                 → 1 pr. 203
<span>· andel fra stormspin</span><span>ca. {round(diceStormShare·100)} %</span>                                                        → ca. 30 %
<span>Første terning (median)</span><span>efter ca. {diceFirstMedian} spin</span>                                                     → efter ca. 99 spin
<span>Betalte spin til 1948 terninger</span><span>ca. {round1000(dice1948Spins)}</span>                                                 → ca. 277.000
<span>· 90 % af forløbene</span><span>ca. {round1000(P5)}–{round1000(P95)}</span>                                                    → ca. 262.000–292.000 (sim)
<span>Spilletid (mindst 3,0 s pr. spin)</span><span>mindst ca. {floor10(dice1948Spins·3/3600)} timer</span>                            → mindst ca. 230 timer
<span>Forventet nettotab undervejs</span><span>ca. {round((1−rtp)·100)} % af indsatserne</span>                                          → ca. 4 %
<span>· ved 0,50 kr pr. spin</span><span>ca. {round100(dice1948LossX·0,50)} kr (90 %: ca. {P5}–{P95} kr)</span>                              → ca. 5.500 kr
<span>· ved 2,00 kr pr. spin</span><span>ca. {round100(dice1948LossX·2,00)} kr (90 %: ca. {P5}–{P95} kr)</span>                              → ca. 22.000 kr
<span>Forløb med nettotab ved terning nr. 1948</span><span>ca. {round(dice1948LossShare·100)} %</span>                                  → ca. 98 %
</div>
<p class="hint">Tallene er gennemsnit fra simulering med spillets egen matematik (RTP {fmtPct(rtp,1)}, model {modelHash[0..8]}, {diceJourneys} simulerede forløb til 1948 terninger). Terningerne kommer tilfældigt, uden faste mellemrum. Antallet af spin til 1948 terninger varierer kun lidt fra spiller til spiller; tabet undervejs varierer mere. Tabet er et forventet tab – ikke en pris for at åbne porten.</p>
<p><b>Terningerne er et minde om store gevinster – ikke en grund til at spille videre.</b> Porten er ikke noget, du skal nå: den viser, hvor sjældne de store gevinster er. Spil aldrig længere eller for mere for at samle terninger.</p>
```

## DENOMINATORS (defined once)

- 0,70 % and "1 pr. 142" are dice per PAID spin, counting the dice that the spin's own Ladede spin and storm spins give. That is the unit the player pays for, and the unit behind 277.000.
- Storm spins add only about 1 % to the total spin count, so "per any spin" would round the same, but only one definition is published.
- "1 pr. 203" is base and Ladet spin dice per paid spin.
- The copy never says "hvert 142. spin".

## OTHER TABS

- **Kp-stigen:** append `<p class="hint">Terninger er ikke en del af ladningen og udløber ikke.</p>`.
- **Historik:**
  - intro appended: " Spin, der gav en terning, er mærket »terning«.";
  - rows: ` · terning` after the Spil-ID (after " · Ladet spin"/" · Solstorm", before " · garanti").
- **Spil ansvarligt › Designprincipper:** append " Terningerne har ingen tidsfrister, streaks, daglige belønninger eller påmindelser og udløber ikke – en pause koster ingen terninger. Terning-tælleren kan slås fra under Indstillinger."
- **Indstillinger:** the row "Vis terninger i spillet" and its hint (see copy).

## FLAG

`AUTOMAT_PAYBACK_CLAUSE` (diceCopy.ts, default true). With it false, the sentence "I konceptet er Automat 1948 tænkt med højere tilbagebetaling end de andre automater." is removed from the rules and the placard, and the rest reads "Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling." Legal can remove the payback idea without a redesign.

## assets

## THE DIE IMAGE (user artwork)

Source: 1254×1254 RGBA, 2,2 MB.
- Copy it to `assets-src/terning.png`. It is not bundled and is committed for provenance.

**Processing script:** `node scripts/die-asset.mjs`. It needs no new dependencies: it uses the repo's playwright-core with /opt/pw-browsers/chromium and Canvas2D.
1. createImageBitmap from the PNG bytes.
2. Measure the alpha > 8 bounds. Measured: (191,162) → (1097,1112), i.e. 907×951 px.
3. Square crop: side = round(max(907, 951) × 1.04) = 989, centred on the bounds' centre. The 4 % pad keeps the neon edge glow.
4. Resize to 384×384 with imageSmoothingQuality 'high'.
5. `OffscreenCanvas.convertToBlob({type:'image/webp', quality:0.85})`. Measured ≈ 50 KB, ≈ 67 KB as base64.
6. Write `src/render/art/assets/terning-384.webp` and print its size. The script fails if the file is > 90 KB.

Why 384: the largest on-screen use is 104 CSS px (desktop award) at resolution ≤ 2 (pickResolution caps), plus 1.06 of ceremony zoom headroom, which comes to ≤ 221 device px. 384 with mipmaps covers it and the 88 px medallion at DPR 3 (264 px). Other measured sizes: 512 px = 78 KB, 256 = 27 KB.

**Runtime** (`src/render/art/dieImage.ts`), following the Polar Night pattern in polar.ts:
- `import.meta.glob('./assets/terning-384.webp', { query:'?inline', import:'default', eager:true })`: a missing file only disables the art.
- `atob` → Uint8Array → `new Blob([u8], {type:'image/webp'})` → `createImageBitmap(blob, { premultiplyAlpha:'premultiply' })`.
- CSP: no fetch, no data:/blob: URL is ever loaded, and there is no img-src dependency.
- Decode once at World.init. Keep the ImageBitmap for context-restore re-upload.
- Exports:
  - `dieTexture()`: `new Texture({ source: new ImageSource({ resource: bitmap, autoGenerateMipmaps: true, scaleMode:'linear' }) })`;
  - `drawDie(canvas, cssPx, { state:'socket'|'die'|'glyph', ring?:boolean })`: a DPR-aware canvas draw of the bitmap scaled with imageSmoothingQuality 'high'. Also draws the empty-socket hexagon and the fallback glyph;
  - `glintOnce(canvas, ms)`: a Canvas2D 'source-atop' white band sweep for the card medallion and the hello card.
- Pixi sprites of the die use tint 0xe0e0e0 so the baked neon does not over-bloom. Check it at 62 px on a phone.
- Fallback if decoding fails:
  - DOM: the violet hexagon glyph;
  - Pixi: a procedural isometric cube (Graphics: three faces tinted #19e3d6 / #8a5cff / #ff2bd6 at α .7, with a 1 px ice edge).
- Artifact growth ≈ +70 KB. to-artifact.mjs checks are unchanged, since no external references are added.
- README "Kendte grænser" is updated: all assets are in code except Polar Night and the die image, both inlined.

## CODE-DRAWN ASSETS

All are Canvas2D bakes, uploaded as Pixi textures and kept for context restore. Each bakes in ≤ 30 ms.

- **Chalk wall with portal** (GateView): chalk gradient, ridge and tree line, erosion streaks, 6 flint bands, 3 archivolts (inner 19 stones, outer 48), ice crust, keystone socket, lintel plaque, threshold, 6 niches and grooves, and the opening cut out. Baked at min(DPR, 1.5) × 0.75, re-baked on resize (debounced 150 ms). Full recipe in the chamber field.
- **Door leaves**: half-arch dark ice, caustic ellipses, teal fresnel edge, seam. One bake per leaf per layout.
- **Tile sprite**: an 8×8 rounded rhombus with a soft core, baked once.
- **Six cabinet silhouettes** and the NORDLYS mini-screen (a 3×3 of PAL.sym): baked per layout at niche size.
- **Reused**: softDot / softBand (render/tex.ts) for halo, light, lantern and glint; IsText for all Pixi type: lintel "1948", "AUTOMAT 1948", the label, captions, eyebrow and "NORDLYS".
- **Chip icon states**: socket hexagon, die, ring, glyph, drawn into DOM canvases.

## THE PURE LATTICE (gateLattice.ts)

- 1948 tiles in normalised gate units: 974 per leaf, hex lattice with the border margin rule.
- `gateOrder(seed)` is cached per seed.
- Unit-tested with golden hashes.

## audio

## PRINCIPLES

- All new sounds are raw WebAudio one-shots rendered through the existing OfflineAudioContext pipeline: SFX_ASSETS in sfx.ts, mix levels in the CFG table in audio.ts, and the dsp.ts helpers bell/perc/noise/filt/swell/aah/gong.
- Everything is in D aeolian to sit on "Polar Night" (measured 85,2 BPM, 2,817 s/bar, harmonic rhythm Dm C F C/E Gm Dm C C Dm C F Gm Dm Am B♭ C).
- Coin sounds are never used.
- Every dice sound sits ≥ 6 dB under the win stinger. Peaks ≤ −6 dBFS before the limiter.
- Muting goes through the master bus as today. Calm mode keeps the sounds at gain 0.7 (−3 dB).
- There are no escalating pitches anywhere (held storm dice use a constant pitch).

## NEW SFX (id: recipe → CFG)

- **dieBirth** (ch 2, dur 1,9): three glass clicks (FM tines at 2,9 kHz and 4,3 kHz, tau 30 ms) at 0/85/150 ms with amps .5/.35/.25. Then at 0,18 s a D5+A5 FM bell dyad (ratio 3.5, index 1.1, tau 0.9). At 0,35 s a 300 ms air shimmer (noise → bandpass 8 kHz, Q 1.2, swell). → db −20, hall, cents 3, max 1, gap 0.3.
- **dieLand** (ch 1, dur 0,25): a 3 ms noise click (HP 2 kHz) + a 180 Hz sine body (tau 50 ms) + a 900 Hz resonance (bandpassed noise, Q 12, tau 80 ms), i.e. glass on stone. → db −22, room, ui: true, max 3, gap 0.05.
- **dieQuench** (ch 1, dur 0,4): bandpassed hiss 3–6 kHz, 180 ms decay, + 2 glass clicks at 0,12 and 0,19 s. → db −24, room, max 2.
- **dieHold** (ch 1, dur 0,3): one FM glass tick at 2,35 kHz, tau 60 ms. → db −26, room, cents 0 (constant pitch).
- **bell1948a / bell1948b** (ch 2, dur 5,0, div 2): tower bells on D3 (146,83 Hz) and D4.
  - Partials ×[0.5 hum, 1, 1.19 tierce, 1.5, 2.0, 2.76] with decays [4.0, 3.2, 2.4, 1.8, 1.2, 0.8] s.
  - 8 ms strike noise (LP 3 kHz).
  - Played as Sfx 'bell1948' → db −14, hall, max 4, gap 0.1.
  - `level` maps to (zone, semitones): 1 → (a, 0) D3; 2 → (b, +2) E4; 3 → (a, +5) G3; 4 → (b, 0) D4. This is the year motif 1-9-4-8 = root, 9th, 4th, octave.
  - The first-die card plays levels 1 and 2 at gain 0.5; the unlock card plays level 1 at gain 0.7.
- **gateDrone** (ch 2, dur 12, div 4): D1 + A1 sine pairs detuned 0,3 Hz (slow beating) + noise LP 200 Hz; attack 1,5 s, release from 10 s. → db −18, room.
- **tileShimmer** (ch 2, dur 3,2): 16 FM glass notes over 1,6 s rising through D5 F5 A5 C6 D6 F6 A6 C7, tau .35, pan alternating ±.4. → db −22, hall.
- **keystone** (ch 2, dur 3,5): stone tock (noise LP 400 Hz + 90 Hz sine, tau .12) + a glass click + a low D2 bell (tau 2,5). → db −14, hall.
- **sealCrack** (ch 2, dur 2,0, liteRate 48000): a noise crack (bandpass sweep 1,2 → 6 kHz in 60 ms, tau .08) + a 38 Hz sine thump (tau .25). → db −14, room.
- **gateBreath** (ch 2, dur 2,8): noise → LP sweeping 200 → 1400 Hz under a 2,3 s swell. → db −18, room.
- **lightPad** (ch 2, dur 7, div 2): aah() choir on D3 A3 E4 F4 (Dm add9), attack 1,2 s, release 4 s. → db −18, hall.

## ASSET LOADING

- RENDER_ORDER (base) appends 'dieLand', 'dieBirth', 'dieQuench', 'dieHold', 'bell1948a', 'bell1948b' after 'bigWin5'. They are small and needed by any spin or card.
- GATE_SET = gateDrone, tileShimmer, keystone, sealCrack, gateBreath, lightPad is lazy:
  - `prepareGate(): Promise<void>` follows the prepareStorm pattern. It is called when the chamber opens and when a ceremony is requested, raced against 2 s.
  - `releaseGate()` runs after the ceremony. The memory is about 1,5 MB while the set is held.
- New helper `fadeOut(name: Sfx, seconds)`: fades live voices of that name. Used for the drone and pad on skip and at the ceremony end.

## MUSIC BUS

This is the only graph change. Agree it with the Polar Night agent before merging; the stems, the Polar decode and the level trim are untouched.
- Insert `musicLP` (BiquadFilter 'lowpass', Q 0.5, 20 kHz by default, effectively transparent) between music and duck: `music → musicLP → duck → dip`.
- API: `setMusicFilter(hz: number, seconds: number)`: `frequency.setTargetAtTime(clamp(hz, 200, 20000), now, seconds/3)`.
- Existing duck() and dip() semantics are unchanged.
- The bed is the 16-bar loop cut (bars 33–48), so the design never "restarts Polar Night from 0:00". The ceremony rides the running loop.

## MIX MOMENTS

- **Award (base/perk):**
  - 'win' level 2 at R+0 (the existing −4 dB music dip);
  - 'dieBirth' at birth + 50 ms;
  - 'dieLand' at landing.
  - No extra duck.
- **Storm:** 'dieQuench' at the pop and 'dieHold' at the slot. No duck: the storm music is at full level. 'dieLand' at −3 dB for each outro landing.
- **Chamber:** open → `setMusicFilter(4500, 0.8)` + `duck(−3, 0.8)`, so the room sounds sealed inside the cliff. Close → `setMusicFilter(20000, 0.6)` + `duck(0, 0.6)`. In the open state after an unlock, no filter.
- **Ceremony** (bar-anchored, all scheduled with `when` from T0):
  - bar 1: `setMusicFilter(900, 2.0)` + `duck(−6, 2.0)` and the drone;
  - bar 2: tileShimmer;
  - bar 3: dieBirth at gain 0.5, keystone at 7,634;
  - bar 4: bell1948 levels 1–4 on the four beats;
  - bar 5: sealCrack; drone → lightPad; gateBreath; `setMusicFilter(20000, 2.3)` + `duck(0, 2.3)`, so the user's track swells back as the light pours out;
  - bar 6: the motif echo an octave up at gain 0.4; the drone and pad fade over 4 s.
- **Skip:** `cancelScheduled()`, fadeOut drone/pad 0,3 s, filter and duck released in 0,3 s.
- **Calm ceremony:** the same sounds on its own timeline, at gain 0.7.

## QA

- dev/audio-check.mjs audits every new id (the lite-rate ⅓-octave audit).
- A human listening test against the Polar Night loop, bars 1–16: the bell strokes on Dm and Gm bars must not clash. If one does, retune bell1948 level 3 to F3 (the 3rd) and document it.
- `audio.stats().voices` returns to baseline 5 s after the ceremony.

## tests

## VITEST

**tests/dice.test.ts** (pure):
- diceFor:
  - (1000, 100) → true; (999, 100) → false;
  - (500, 50) → true; (499, 50) → false;
  - storm stake 200: (2000) → true, (1999) → false;
  - stake 0 → false.
- fmtDice: 0 → '0', 1948 → '1948', 9999 → '9999', 10000 → '10.000'. diceWord(1) → 'terning', otherwise 'terninger'.
- addDie:
  - increments and returns the accession number;
  - firstAt is set once;
  - unlock becomes 'pending' exactly on 1947 → 1948;
  - 'seen' is never reverted;
  - the count continues past 1948.
- dieBirthAt: tiers 2–5 = [1.5, 2.5, 5.5, 8.5]; each is ≥ 1,0 (after the title slam) and ≥ count-up end − 0,4.
- celebrateEndWithDie: tier 2 = 2.7, tier 3 = 3.7.
- gateLattice:
  - exactly 1948 tiles, 974 per leaf, all inside the arch with the border margin;
  - golden hash of the coordinates.
- gateOrder:
  - a permutation of 0..1947; deterministic per seed; different seeds differ; golden hash for seed 1;
  - no predictable last tile: over 200 seeds, order[1947] falls in ≥ 8 of 12 area cells;
  - no front line: for prefixes n ∈ {500, 1000, 1500, 1900}, each of 6 horizontal bands holds n/6 ± 35 %, and |left − right| ≤ 10 % of n.

**tests/dice.copy.test.ts:**
- Copy-lint. Every non-rules string from diceCopy.ts (HUD, award, hello, first-die, unlock card, chamber, ribbons, placard excluding the sanctioned sentence, drawer, banners), rendered for counts [0, 1, 2, 37, 1947, 1948, 2011] and every state, must NOT match:
  `/snart|tæt på|næsten|mangler|skynd|i dag|sidste chance|gå ikke glip|spil videre|spil mere|vinde mere|bedre chancer|højere gevinst|bonus|gratis|jackpot|garant|vundet|optjen|købt|kun\s+\S+\s+tilbage|\d+\s+(tilbage|mere)|\baf 1948\b|\/\s?1948/i`
- 'tilbagebetaling' and 'betaler' never appear outside diceRulesHtml() and the placard.
- The sanctioned sentence is present verbatim in the rules and the placard with the flag on, and absent with it off.
- Facts, hello, first-die and rules strings contain the REPORT-derived numbers exactly as formatted.
- diceCopy.ts source contains no literal 142, 203, 277, 230, 5.500 or 22.000.
- Captions: 'TERNING NR. 38', 'TERNING NR. 1948', 'TERNING NR. 2011'.
- Myth lines are ≤ 46 characters (full version).
- The hello and first-die facts are not marked as footnote class.

**tests/dice.boundary.test.ts** (static source scan, like math.config.test):
- `addDie(` appears only in src/game/Game.ts, once, inside awardDie.
- `awardDie(` appears exactly twice in Game.ts: inside spin() and inside runStorm's `if (!demo)` block, and never within the resume-replay `for` line.
- `saveDice(` appears only in store.ts and Game.persist.
- src/math/** does not import game/dice.
- The DOM and Pixi modules import only DiceView from dice.ts.

**tests/math.sim.test.ts** additions:
- REPORT has all dice fields, with modelHash equal to CONFIG.modelHash.
- 0,0060 < diceRate < 0,0080.
- |dice1948Spins − 1948/diceRate| / dice1948Spins < 0,02.
- diceStormShare ∈ [0,2, 0,4].
- diceFirstMedian = ceil(ln 0,5 / ln(1 − diceP1)).
- |dice1948LossX − dice1948Spins·(1 − rtp)| / dice1948LossX < 0,05.
- P5 < mean < P95.

**tests/present.schedule.test.ts:** add a ≥ 10× fixture and assert that schedule() beats and resultAt are identical to a stored snapshot, i.e. the dice have no effect on the result timing.

## PLAYWRIGHT: scripts/dice-check.mjs

Exits 1 on any failure. Uses window.__slot and advance() stepping, and instruments localStorage.setItem per key.

- **a) Base award:**
  - qaNext('die'), press SPIN.
  - 'terningen.v1'.count === 1 immediately after the press (committed before presentation) while #diceN still shows 0.
  - result ≥ 3,0 s after the press.
  - The award sprite is visible at R+1,5; the flight starts at R+2,75.
  - #diceN === '1' at R+3,35, and state is idle only after that.
  - The last history entry has die === true.
- **b) Skip:** a tap at R+1,2 lands the die in ≤ 320 ms. award.inFlight is false when the state becomes idle.
- **c) Next spin:** press SPIN at the first idle frame. award.inFlight === false and no 'dieLand' voice starts after the press.
- **d) Real storm:**
  - qaNext('sun4') → spin → startStorm → play everything.
  - expected = history entries with mode 'storm', no '-G' suffix and winOre ≥ 10 × stakeOre. The count delta must equal expected.
  - The summary row shows expected when > 0; the held row is empty after the outro; #diceN equals the count at idle.
- **e) Reload mid-storm:** the same as (d), with page.reload() after 3 storm spins → unlock → resume. The delta equals expected (no double count), the held row is restored after the reload, and the summary row is correct.
- **f) Perk:** the die is judged at the locked stake via qaNext('diePerk').
- **g) Demo isolation:**
  - Run demo(), demoSuns(), dDie, dFirst, the previews 0/25/250/1000/1948, and dGate both skipped at 2,5 s and full.
  - ZERO setItem calls for 'terningen.v1', and the stored string is byte-identical.
  - The demo storm summary row reads "Terninger · demo · tæller ikke".
- **h) Expiry:** set nordlys.v1 lastSpinAt to −400 days, reload. The meter is reset and the dice are unchanged.
- **i) Reset:** Nulstil demo → the dice are back at defaults and the chip shows 0.
- **j) Opt-out:** with dice=false, #diceBtn is hidden, no award sprite appears, and the count still increments.
- **k) First-die card:**
  - It appears after the first die.
  - Space and SPIN are ignored before 1,5 s and close it after.
  - introSeen is persisted and the card never reappears after a reload.
- **l) Hello card:** shown once; SPIN works while it is shown; not shown with any deep link.
- **m) Unlock:**
  - qaDice(1947) + qaNext('die') → the unlock card at idle.
  - "Ikke nu" → the chamber shows [Åbn porten].
  - Real ceremony → unlock 'seen' and unlockedAt set at the seal beat; the chip has the .open class; the chamber reopens in the open state.
  - A reload before bar 5 keeps 'pending'.
- **n) Ceremony:**
  - Skip works at 2,0 s after T0.
  - #reg and #foot keep opacity 1 and stay inside the viewport throughout.
  - For the demo, #chRibbon is visible from the first to the last frame, including with #clean.

## TOUR SHOTS AND LAYOUT ASSERTIONS (scripts/tour.mjs)

**Viewports:** 360×640, 375×667, 390×844, 844×390, 1280×720, 1366×768 and 1920×1080 at dpr 1, plus 390×844 at dpr 3.

**Shots:** dice-chip-0, dice-hello, die-birth (R+2,0), die-flight (mid-flight), dice-chip-1, dice-first-card, chamber-0, chamber-250 (preview), chamber-1948-open (preview), storm-held, gate-bar4 (demo, T0+10 s), gate-placard.

**Assertions:**
- #diceBtn lies inside .cell-l and #deck.
- #bal has scrollWidth ≤ clientWidth, i.e. no ellipsis.
- The chamber's #chN, the 3 li in #chFacts, the concept chip and #chDone are fully inside the viewport and do not overlap each other.
- #chGate is ≥ 200 px tall in portrait.
- document.scrollWidth ≤ innerWidth: no horizontal scroll.
- Desktop .side.right: scrollHeight ≤ clientHeight + 1 at 1280×720 and 1366×768.
- The placard does not cover the "AUTOMAT 1948" text bounds.

## PHOTOSENSITIVITY: scripts/luminance.mjs

- New segments 'award' (dDie) and 'gate' (the full demo ceremony, no skip), each run with calm=0 and calm=1.
- Pass: ≤ 3 general flashes per second in every window and 0 red flashes.
- Report the maximum per-frame luminance step. The gate's light ramp must show no opposing swing ≥ 10 % within 1 s.

## OTHER CHECKS

- `npm run typecheck`, `npm test`, `npm run sim` (it regenerates REPORT; math.sim.test then passes).
- `npm run build:artifact`: size < 16 MB, no external references, the CSP-safe decode verified inside the artifact frame.
- dev/audio-check.mjs covers the new SFX ids.

## complianceNotes

- How each judge mustFix is applied: FIRST MINUTES WITHOUT PRESSURE.
- The one-time non-modal hello card after the first ignite, with the facts at body size.
- The chamber is reachable and beautiful at 0 (a dark gate, a lit NORDLYS niche, a ghost key).
- No call to play anywhere.
- The splash welcome is unchanged, and there is no returning-splash dice line (sunk-cost cue avoided).
- STORM DICE: awarded inside runStorm's while loop in the existing `if (!demo)` block. Never gated on opts.resume, because Game.spin() starts every real storm with resume {spinIndex: 0}. The silent replay never awards. activeStorm.diceAwarded is persisted so the summary row and the held row survive a reload. Tests cover k→k, reload without a double count, guarantee → 0, and demo → 0 writes.
- BOUNDARY: `totalOre ≥ 10 × stakeOre` in integer øre, at the spin's own stake: the locked stake for a Ladet spin, the storm stake for storm spins. 10,00× counts and 9,99× does not (tested).
- DENOMINATORS:
- '1 pr. 142' / 0,70 % means dice per PAID spin, counting the dice from the spin's own Ladede spin and storm spins. This is the unit behind 277.000 betalte spin.
- Base and perk only is '1 pr. 203'.
- Every figure comes from new REPORT fields and is tied to modelHash.
- No cadence wording: 'tilfældigt fordelt' / 'uden faste mellemrum', never 'hvert 142. spin'.
- 'mindst ca. 230 timer' (a floor, not an estimate).
- No 'i begge retninger' or 'nogle når det hurtigere' claims: spins-to-1948 varies about ±3 %, and the sim publishes the P5–P95 ranges and the share of journeys ending with a net loss (≈ 98 %).
- NO FRACTIONS AND NO FRONT LINES:
- The HUD shows only the count, and the chamber shows only the count. 1948 lives on the lintel and in the myth, never as 'X af 1948', '/1948' or a remaining count.
- The fill order is a seeded per-player blue-noise permutation with an unpredictable last tile. The keystone is not a tile.
- Nothing looks, sounds or reads differently between 1900 and 1947.
- There are no milestones of any kind; only die nr. 1 (onboarding) and die nr. 1948 (the gate) are events.
- DEMO TOOLS CANNOT STAGE A NEAR-MISS OR A BIG WIN:
- Fixed preview steps [0 · 25 · 250 · 1000 · 1948 åben]: no 1947, no slider, and no 'all lit, closed' image in the demo.
- 'Vis en terning' is award-only, with no forward-searched win and no amount.
- The demo ceremony is a hard cut, with no count-up time-lapse.
- Every demo caption reads 'DEMO · TÆLLER IKKE'. Amber DOM ribbons in #chamber cannot be hidden by #clean.
- Demo and replay never write unlock or unlockedAt.
- EXPECTED LOSS:
- The chamber shows only the stake-independent 'ca. 4 % af indsatserne'.
- Fixed kr examples (0,50 kr and 2,00 kr, with 90 % ranges) appear only in the rules, next to 'et forventet tab – ikke en pris for at åbne porten'.
- The only UI link between dice and stake is the anti-nudge 'En højere indsats giver ikke flere terninger – kun et større forventet tab.'
- AUTOMAT 1948 FRAMING:
- ONE sanctioned, conditional sentence ('I konceptet er Automat 1948 tænkt med højere tilbagebetaling end de andre automater. Det er en idé – ikke et tilbud: den findes ikke i denne demo, og der er ikke lovet nogen gevinst eller tilbagebetaling.').
- It appears ONLY in the rules and the unlock placard, behind the AUTOMAT_PAYBACK_CLAUSE flag.
- No superlatives. No present-tense 'står/venter/betaler' about the machine; the myth says 'Bag den står endnu kun en idé – og et årstal.'
- 'Koncept · findes ikke i denne demo' sits directly under every title that names it (myth pair, Pixi label, placard chip).
- Automat 1948 is never drawn: no cabinet, blueprint, grid or paytable, only light and a name.
- DARK MACHINES:
- The five nameless niches never light as contributors, in the real ceremony or anywhere else.
- Only NORDLYS's groove carries the key.
- The copy calls them 'pladsholdere'.
- There are no per-machine tallies.
- NAMING: 'Terningen' is only the die. Award captions are accession numbers ('TERNING NR. 38'), never goal-directed ('til porten'). The first-die button is 'Forstået', never 'Fortsæt' or 'Spil videre'.
- FORMATTING: fmtDice prints plain digits up to 9999, so the count reads '1948', never '1.948' (fmtInt / da-DK is not used for dice).
- AUDIO:
- setMusicFilter() is added as a transparent low-pass in the music chain and must be agreed with the Polar Night agent before merging.
- The ceremony is anchored to the measured bar grid (85,2 BPM, D aeolian).
- It rides the 16-bar loop; there is no 'restart from 0:00'.
- No escalating pitch on repeated dice.
- AWARD TIMING:
- The die is born after the tier's count-up and never during the title slam.
- Game awaits the flight before idle (and before a triggered Solstorm), so no die is ever in the air or audible when the next spin starts.
- Skip lands it in ≤ 300 ms.
- The 3,0 s floor and resultAt are untouched (tested).
- No w.flash() and no red. The calm variant uses the same window.
- CEREMONY SKY:
- The sky stays at the player's own Kp. A separate skyGlowFloor (≤ 6 % lift) is used; there is never a kp → 8 push, red fringe or crackle.
- The Kp arc is hidden in the chamber.
- The reg strip (now showing Saldo) and the footer (18+, StopSpillet, ROFUS, session time, net) stay visible and interactive throughout.
- Skippable from 2,0 s, including the first real viewing.
- PHOTOSENSITIVITY:
- The seam and the four resonance waves go through world.allowFlash(), the same ≤ 3/s bookkeeping as w.flash(), with no exemptions.
- Large-area rises take ≥ 500 ms (tiles, ×1,25 max) or ≥ 1 s (light, bloom).
- Magenta appears only on small sprites. Storm dice are quenched to white, never crimson.
- Award, ceremony and calm variants must pass scripts/luminance.mjs before sign-off.
- REGULATORY STRIP: no dice counter in #reg. The chip lives in the deck, with the die icon mandatory at every width, violet, 12 px and lighter than the Saldo digits, so it never reads as a second wallet. User-test criterion: no participant reads it as money.
- MYTH AS LEGEND: every historical or place claim is marked 'Man siger …', and the rules say 'i fortællingen under Møns Klint'. There is no exclusivity or challenge framing: no 'få når så langt', no 'har ingen set'.
- FACTS AS PROMINENT AS THE MYTH:
- The chamber's facts F1–F3 and the concept chip are never dropped by the fit steps and are always above the fold.
- The hello and first-die facts are at body size.
- The first-die card cannot be dismissed by SPIN, Space or Esc in under 1,5 s.
- NO SUNK-COST REINFORCEMENT:
- No returning-splash dice line.
- No 'greeting' replay of lit tiles or bell on repeat chamber opens.
- No provenance date line and no per-machine tally.
- No share buttons, push, e-mail, leaderboards, streaks, dailies, timers or reminders ('Ikke nu' is never followed up).
- After the unlock there is no second door and no new goal.
- RG OPT-OUT: Indstillinger › 'Vis terninger i spillet' (Til/Fra) hides the chip, the panel, all award animation and the cards. The dice still count and stay visible in the menu tab. Designprincipper gains the no-deadlines / no-streaks / no-reminders line.
- OPEN LEGAL QUESTION, to be presented as such in the pitch and not as a product. A machine 'tænkt med højere tilbagebetaling' that unlocks after accumulated play may be classified under the Danish bonus rules (amount and wagering limits) or under Spillemyndigheden's practice for loyalty and VIP schemes. It must be verified by the operator's legal team. The swap flag removes the payback idea without a redesign, and a real version would likely need a cosmetic or experiential unlock. No section numbers are cited in the UI or in the pitch material until legal has verified them.
- BRAND: no operator name anywhere, and the die artwork has no logo. '1948' is left as a cipher inside a legend ('Man siger …'). The operator's brand and legal teams should confirm that the implicit reference to the founding year is wanted.
- RESIDUAL RISKS, to be named in the RG review:
- The goal gradient is inherent to any visible collection. A player near 1948 sees a door that is mostly lit, though with no front line, no fraction and no cues.
- The 1948-tile door gets dense on 360 px phones (≈ 3 px tiles).
- Dice are stored in localStorage, so the copy never claims they 'cannot be lost'. The storage chip now mentions dice, and a real product needs an account-level store (hence the separate 'terningen.v1' key).
