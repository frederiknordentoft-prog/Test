# Terningen II: the corner vault, the big die moment, Kvit eller dobbelt, autospin, aurora SPIN (build brief)

Approved by the user on 2026-09-23. It builds on `dice-1948-spec.md`, and where the two disagree this brief wins. Copy is in Danish. Line anchors refer to the tree at `fa496d2`.

## 0. The user's request and decisions (final)

The request, verbatim in substance:
1. The Terningekammer is visible in the bottom-right corner, with the user's designed die (`assets-src/terning.png`, already embedded as WebP 512/128). It stands there glinting, and now and then it rattles: "look at me, I'm exciting and mysterious".
2. A demo button that gives you a die.
3. The die win is super lush and reads as something BIG.
4. A won die can be staged: "Kvit eller dobbelt" (50 %) or "3 for 1" (33,3 %).
5. Polish every other relevant detail.
6. More aurora on the SPIN button.
7. Autospin.
8. Use the user's die image everywhere, including inside the chamber.

The user's decisions:
- **Corner:** "Terningen i en isniche". The die image floats in a small ice niche with the count under it. A glint runs across it every few seconds, and every 20–40 s it rattles briefly. A tap opens the chamber. On phones it sits right above SPIN; on desktop, at the bottom of the right column.
- **Gamble:** ONE choice per award: Behold / Kvit eller dobbelt (50 %) / 3 for 1 (33,3 %). The result is final, the odds are fair, and there is no ladder.
- **Autospin with limits:** 10/25/50/100 spins. It stops at every die, at Ladet spin, at Solstorm and at a loss limit. Each spin still takes ≥ 3,0 s, and there is no turbo.
- **Solstorm:** ONE combined choice for all of the storm's dice after the storm (k → 2k / 3k / 0).

These consciously reverse three earlier principles, because the user's words win:
- "no autoplay" becomes "autospin with a loss limit";
- dice that are "never spent" become "only NEW dice can be staged";
- "no idle animation on the chip" becomes a glinting, rattling niche, in idle only and never in calm.

## 1. Pure gamble rule: `src/math/gamble.ts` (new)

This file is pure. Its only import is a type import of `./rng.ts`, and nothing it imports has "dice" in its path.

```ts
export type GambleBet = 'double' | 'triple';
export const GAMBLE_SIDES = 6;
/** pip = face+1 wins when pip ≥ from: double 4–6 (3/6 × 2 = 1), triple 5–6 (2/6 × 3 = 1). EV = stake, exactly. */
export const GAMBLE_BETS = { double: { mult: 2, from: 4 }, triple: { mult: 3, from: 5 } } as const;
export const gambleFace = (rng: Rng): number => rng.int(GAMBLE_SIDES);   // first draw of a fresh per-idx rng (unbiased)
export function resolveGamble(bet: GambleBet, stake: number, face: number): { pip: number; win: boolean; payout: number } // throws on a bad face
export const winPips = (bet: GambleBet): number[]
```

- The rule is a code constant, not part of CONFIG, so modelHash and REPORT are untouched.
- Winning faces are nested: a triple win is always also a double win.
- If `Rng` has no `int`, use an unbiased rejection draw on u32.

**`src/math/rng.ts`:**
- Add the Domain `'gamble'`.
- `DOMAIN_CONST.gamble = 0x5445524e` ('TERN').
- `DOMAIN_LETTER.gamble = 'T'`. Never use 'G', which is the storm guarantee suffix.
- `parseSpinId` becomes `[BSPDT]`.
- Update the header comment.

## 2. Model: `src/game/dice.ts` and `src/game/store.ts`

**`dice.ts`**
- Header comment: dice are never spent by the game; only the player's own choice can stake NEW dice.
- `GambleChoice = 'keep' | GambleBet`.
- `PendingGamble { id: string; source: 'spin' | 'storm'; stake: number; at: number; settled?: { choice: GambleBet; face: number; gid: string; payout: number } }`
- `GambleLogEntry { gid: string | null; id: string; source; choice: GambleChoice; stake; face: number | null; payout; at }`, with `GAMBLE_LOG_MAX = 50`.
- `DiceStore` gains `gamble: PendingGamble | null` and `gambleLog: GambleLogEntry[]`. They are required in the type, with defaults in `diceDefaults`.
- `canOffer(d, allowed)`: `allowed && d.introSeen && d.unlock !== 'pending' && !d.gamble`.
- `openGamble(d, g): boolean`: refuses if a choice is already open, if `stake < 1`, or if `count < stake`.
- `settleGamble(d, choice, face, gid, now) → { payout, delta, count }`. It is THE only count mutator besides `addDie`:
  - `payout` is the stake for keep, otherwise `resolveGamble(...)`.
  - `count += payout − stake`.
  - `lastAt = now` when `payout > stake`.
  - It sets 'pending' if `count ≥ 1948 && unlock === 'none'`.
  - It has a defensive, unreachable revert `pending → none` when `count < 1948 && !offered`.
  - It never touches 'seen'.
  - It appends to the log (capped).
  - keep → `d.gamble = null`; a bet → `d.gamble.settled = {...}`.
- `clearSettled(d)`: `d.gamble = null`. It runs after the reveal has been shown.
- `cloneDice(d)`: a deep copy. snapshot() must stop using a shallow spread.
- `stagedOf(d)`: `d.gamble ? (d.gamble.settled?.payout ?? d.gamble.stake) : 0`.

**Invariants** (tested):
- The count after a gamble is ≥ the count before the award. Only the new dice can be staged, and the count never reaches 0 through a gamble.
- `unlock === 'pending'` ⇒ `count ≥ 1948`.
- 'seen' never reverts.

**`store.ts`**
- `'terningen.v1'` stays `v: 1`. There is no migration: loadDice's spread fills in defaults.
- Sanitise on load:
  - drop a malformed `gamble` (a non-integer or < 1 stake, or `stake > count`);
  - replace a non-array `gambleLog` with `[]`.
- `SaveData.counters.gamble = 0`. The existing merge covers old saves.
- `Settings.gambleOffers: boolean`, default true ("Tilbyd Kvit eller dobbelt"). Add it to the settings literal in hud.ts too.

## 3. Autospin: `src/game/auto.ts` (new, pure)

- `AUTO_COUNTS = [10, 25, 50, 100]`
- `AUTO_LIMIT_X = [10, 25, 50, 100]`: the loss limit as × stake, shown in kr.
- `AUTO_GAP = 0.6`: game seconds between idle and the next press.
- `AutoRun { total; left; stakeOre; startBalanceOre; lossLimitOre }`
- `AutoStop = 'done' | 'player' | 'die' | 'perk' | 'storm' | 'loss' | 'balance' | 'menu' | 'hidden' | 'demo' | 'chamber' | 'card' | 'offer' | 'stake' | 'reset'`
- `autoLimits(stake, spins)`, `validAuto(spins, limit, stake)`.
- `autoStopReason(a, { balanceOre, stakeOre, perksPending, gambleOpen, momentDue })` checks, in this order:
  1. `left ≤ 0` → done
  2. an open gamble → offer
  3. a perk → perk
  4. a card is due → card
  5. the stake changed → stake
  6. balance < stake → balance
  7. `startBalance − balance + stake > lossLimit` → loss (it stops BEFORE a spin that could exceed the limit)

## 4. Game.ts wiring

**States and fields**
- New states `'gambleOffer' | 'gambleReveal'`. Neither is a resting state.
- New fields:
  - `stagedDice = 0`
  - `gambleRun = null`
  - `auto: (AutoRun & { timer }) | null = null`
- Helper `chipDice() = max(0, dice.count − heldDice − stagedDice)`. Every place that sets `shownDice` uses it.
- Constructor: `stagedDice = stagedOf(dice)`, `shownDice = chipDice()`.

**setState, stake lock and the SPIN button**
- In setState, `lockStake = to !== 'idle' || !!this.auto`.
- While autospin runs in spinning or celebrating, `hud.setSpin('auto', AUTO.stopCap(left))` keeps STOP pressable.
- `refreshSpinButton`: auto wins.
- refreshHud's lock includes auto.
- `changeStake` returns if auto.
- `refill` returns if auto.
- `visibilitychange` hidden → `stopAuto('hidden')`.

**dispatch**
- The 250 ms guard also covers any `gamble` act other than keep.
- On `'spin'`:
  - menu open → ignore
  - auto → `stopAuto('player')`
  - gambleOffer → `gambleKey()` (keep only, after 1,0 s)
  - gambleReveal → ignore
- On `'continue'`: gambleOffer → gambleKey; gambleReveal → gambleSkipHold.
- On `'skip'`: gambleOffer → ignore (a canvas tap never means anything); gambleReveal → gambleSkipHold.
- `'settings'`: switching `dice` or `gambleOffers` off during gambleOffer → `gambleAct('keep', true)`.
- `'menu'` open → `stopAuto('menu')`. Chamber open → `stopAuto('chamber')`.
- New intents:
  - `{t:'gamble', act:'keep'|'double'|'triple'}`
  - `{t:'autoStart', spins, lossLimitOre}`
  - `{t:'autoStop'}`
  - `{t:'demoGamble'}` (idle only, else toolsBusy)
  - `{t:'autoSheet', open:boolean}` if the HUD needs it

**spin()**
- After the idle check: if `dice.gamble && !demoMode`, run `resumeGamble()` and return. The game never spins with a choice open.
- With `balance < stake` and no perk: if auto → `stopAuto('balance')` and return; otherwise refill. Autospin never refills.
- After the debit, `if (auto) auto.left--`.
- In the commit block, after `this.record(` and before `this.persist()`: `if (dieNo) this.offerDice(r.spinId, 'spin', 1)`. After persist: `stagedDice = dieNo ? 1 : 0` (the flyDie/landDice path decrements it).
- After finishSpinHud:
  - `if (dieNo) { stopAuto('die'); await this.dieOutcome(); }`
  - then, if a storm was triggered, `stopAuto('storm')` before runStorm.
- `finishSpinHud` announces `srAward` only when no choice is open.

**offerDice, the only caller of openGamble:**

```ts
private offerDice(id: string, source: 'spin' | 'storm', k: number): boolean {
  if (this.demoMode || !canOffer(this.dice, this.s.settings.dice !== false && this.s.settings.gambleOffers !== false)) return false;
  return openGamble(this.dice, { id, source, stake: k, at: Date.now() });
}
```

**Award flow**
- `awardDie` is unchanged, so the existing regex test still holds.
- `dieOutcome()`: an open spin choice → `runGamble('award')`, else `flyDie()`.
- `landDice(add, fromHeld)`: `fromHeld ? heldDice −= add : stagedDice = max(0, stagedDice − add)`, then `shownDice = chipDice()`.
- flyDie's opt-out branch: `stagedDice = 0; shownDice = chipDice()`.

**afterIdle order**
1. An open choice and not demo → `resumeGamble()`, return.
2. demoPending.
3. `autoContinue()` returning true → return.
4. The deep link.
5. maybeDiceMoments. It also returns while a choice is open, and so does openChamber.

**intro()**
- Before resuming a storm: `if (dice.gamble) await this.runGamble('restore')`. This covers a spin choice from the same spin that triggered the storm.

**runStorm**
- Finish block, inside `if (!demo)`, right after `this.s.activeStorm = null` and before its `persist()`: `if (stormDice > 0) this.offerDice(stormBaseId, 'storm', stormDice)`, where `stormBaseId = this.stormId(idx, 0).slice(0, -2)`.
- After the summary card, before `setState('stormOutro')`: `if (!demo && dice.gamble?.source === 'storm') await this.runGamble('held')`. The choice is made while the dice are still held.
- At settle, `heldDice = payout`. `releaseStormDice` releases exactly the payout in the outro, using chipDice.

**The gamble section** (method names are load-bearing for the boundary tests)
- **`runGamble(from: 'award'|'held'|'restore', demo = false)`:**
  1. Return if `gambleRun` is already set.
  2. If real and offers are now off → `commitGamble('keep')` and a silent fly.
  3. If there is a settled result (reload mid-reveal) → go straight to the result with the copy "Resultatet står fast".
  4. Otherwise:
     - `setState('gambleOffer')`
     - `award.gambleStage({k, from, demo})`
     - `hud.showSummary(gambleCardHtml(...), 'gamble')`
     - `award.cardShown('gamble', el)`
     - announce
     - `await pick`
  5. Keep → close the card and settle (fly).
  6. A bet → `setState('gambleReveal')`, show the throw card, then `await Promise.all([wait(T.floor), award.gambleThrow({bet, pip, k, payout, demo})])`.
  7. Show the result card and announce, then `Promise.race([wait(GAMBLE_T.hold), skip])`.
  8. Close the card, set `lastModalClose`, then `award.gambleSettle(payout, {from, demo})`.
  9. Real only: `finishGamble()`. Then `gambleRun = null`.
- **`gambleAct(act, force = false)`:**
  - Only in gambleOffer with a pending pick.
  - keep needs ≥ `GAMBLE_T.keepArm` (0,4 s) since the card appeared; bets need ≥ `GAMBLE_T.arm` (1,0 s). `force` skips both.
  - `const res = run.demo ? this.demoThrow(act, run.k) : this.commitGamble(act)`
  - Real only: `from === 'held' ? heldDice = res.payout : stagedDice = res.payout`. The chip never moves before the result is shown.
  - Then `pick(res)`.
- **`gambleKey()`:** SPIN, Space or Enter mean KEEP only, and only after 1,0 s. They never mean a bet.
- **`commitGamble`, THE only caller of settleGamble:**

  ```ts
  private commitGamble(choice: GambleChoice) {
    if (this.demoMode || !this.dice.gamble || this.dice.gamble.settled) return null;
    let face = -1, gid = '';
    if (choice !== 'keep') { const idx = ++this.s.counters.gamble; gid = makeSpinId(this.s.sessionSeed, 'gamble', idx); face = gambleFace(spinRng(this.s.sessionSeed, 'gamble', idx)); }
    const r = settleGamble(this.dice, choice, face, gid, Date.now());
    this.persist();
    return { choice, pip: face + 1, payout: r.payout };
  }
  ```
- **`demoThrow(bet, k)`:** draws from the 'demo' domain (`++counters.demo`) with the same `resolveGamble`. It writes nothing.
- **`finishGamble()`:** `if (demoMode) return; clearSettled(dice); persist();`
- **`resumeGamble()`:** `stopAuto('offer')` → `runGamble('restore')` → `refreshHud(); setState('idle'); afterIdle()`.
- **`gambleSkipHold()`:** resolves the result hold or calls `award.gambleSkip()`. It NEVER shortens the throw below the 3,0 s floor.
- **Timing constants:** `GAMBLE_T = { keepArm: 0.4, arm: 1.0, hold: 1.6 }` in `src/present/schedule.ts`.

**Autospin in Game**
- **`startAuto(n, limitOre)`:** idle only, with no perk, no open choice, `balance ≥ stake` and `validAuto`. It sets `auto`, calls `hud.setAuto(...)`, then `void this.spin()`.
- **`autoContinue()`:**
  - A stop reason → `stopAuto(reason)`, return false.
  - Otherwise `timer = gsap.delayedCall(AUTO_GAP, ...)`. When it fires, it calls `this.spin()` only if it is the same run, the state is idle and `quietIdle()` holds; else it calls `stopAuto('card')`. Return true.
  - It ALWAYS goes through spin(), so the floor holds and there is no turbo.
- **`stopAuto(reason)`:** kills the timer, sets `auto = null`, calls `hud.setAuto(null, reason, summary)`, announces, and calls `refreshSpinButton` when idle.
- Autospin lives only in memory and never resumes after a reload.
- **`requestDemo`, `demoGamble` and `demoReset`** call `stopAuto` first.

**Demo "Terning": `demoGamble()`**
1. `hideHello`
2. `t = beginDiceDemo()`
3. `setState('demoDie')`
4. the `DEMO_GAMBLE_BANNER`
5. the 'dieBirth' sound
6. `await award.demoAward({hold: true})`
7. `await runGamble('award', true)`
8. `finishDiceDemo(t)`
9. `setState('idle')`
10. the "unchanged" banner

There is NO money celebration and NO staged money win. snapshot/restore uses `cloneDice` and also saves `staged`. `demoReset` stops autospin, sets `stagedDice = 0` and `gambleRun = null`.

**debug() / QA hooks**
- Add `gamble: 0` to `setSeed`'s counters.
- `qaDice` refuses while a choice is open and uses chipDice.
- New hooks:
  - `gamble()`: a clone of the open choice
  - `gambleRun()`: `{demo, from, k, phase, bet, pip, payout, armed}`
  - `choose(act)`
  - `qaGamble(pip)`: moves `counters.gamble` so the next REAL throw shows that pip; counters only
  - `auto()`, `autoStart(n, limitX)`

## 5. Presenter contract: `src/present/dicePresenter.ts`

Types:
- `GambleFrom = 'award' | 'held' | 'restore'`
- `GambleShow { k; from; demo }`
- `GambleThrow { bet; pip; k; payout; demo }`

New `DicePresenter` methods:

| Method | Contract |
|---|---|
| `gambleStage(o)` | The k dice wait centre stage above the card. 'award': the born die stays and grows (see §7). 'held': the storm's held dice rise into a fan at the centre. 'restore': k dice fade in at the centre. No timer, no countdown, no motion that pulls toward a bet. |
| `gambleThrow(o): Promise<void>` | Presentation of a committed outcome. The Game shows the result at max(this, T.floor). NO near-miss: never rest on, pass or slow past a winning face before a losing one, or the reverse. No red, no escalating pitch, flashes only through world.allowFlash(). Calm: a crossfade. |
| `gambleSettle(payout, {from, demo}): Promise<void>` | 'award' or 'restore': flights to the dice home (at most 4, the rest merged) calling `host.land(add, false)`. payout 0 → the die freezes and dissolves in place, with no shatter-burst and no sting. 'held': the fan becomes `payout` dice, and the outro's releaseHeld does the flights (payout 0 → the fan fades out). demo → dissolve at the home + `demoTag(payout)`. |
| `gambleSkip()` | The result hold and the flights finish in ≤ 300 ms. Never shortens the throw. |
| `demoAward({hold})` | Like the demo die, but the die stays centre stage after its birth. |
| `awardFly(add = 1)` | A flight that lands `add`. |
| `cardShown('gamble', el)` | The card is shown. |
| `inFlight()` / `phase()` | Include gamble motion. |

The core phase ships DOM stand-ins so the game is playable before the visuals exist:
- `fly(add)` lands `add`.
- `gambleStage` is a no-op.
- `gambleThrow` resolves at once. The DOM card shows the Unicode faces ⚀–⚅, a CSS roll, then the real pip.
- `gambleSettle` calls `drop()`/`fly(payout)` (for 'held' with payout 0, clearHeld).

## 6. Copy

Gamble copy lives in `src/ui/diceCopy.ts`; autospin copy in the new `src/ui/autoCopy.ts`. Every string is added to `nonRulesCopy()` in `tests/dice.copy.test.ts`. Pip lists are built from `winPips` in code, never typed as literals.

**Gamble card**
- Eyebrow:
  - spin: `awardCaption(n)`
  - storm: `TERNINGER FRA STORMEN`
  - demo: `DEMO · TÆLLER IKKE`
- Title:
  - spin: `Din nye terning`
  - storm: `${countWord(k)} fra stormen`
- Body:
  - spin: `Du vælger én gang. Resultatet er endeligt.`
  - storm: `Du vælger én gang for dem alle. Resultatet er endeligt.`
- Buttons, in order keep, double, triple. `data-primary` is on keep only.
  - `Behold`, sub `countWord(k)`
  - `Kvit eller dobbelt`, sub `4, 5 eller 6: ${countWord(2k)} · 1, 2 eller 3: ingen`
  - `3 for 1`, sub `5 eller 6: ${countWord(3k)} · 1–4: ingen`
- Facts: `En terning kastes. I gennemsnit giver alle tre valg lige mange terninger. Kun de nye terninger kan sættes på spil – aldrig dem, der allerede ligger i kammeret.`
- Demo note: `DEMO · Sådan fungerer valget · tæller ikke · dit antal er uændret (${n})`

**Throw:** `Terningen kastes …`

**Result**
- `Terningen viser ${pip}`.
- Win: `${countWord(payout)} lægges i Terningekammeret.`
- Loss: `${countWord(k)} er gået tabt.`
- Then `Du har ${countWord(count)}.` (demo: `Dit antal er uændret (${n}).`)
- Restored: eyebrow `RESULTATET AF DIT VALG`, line `Valget blev truffet før genindlæsningen. Resultatet står fast.`

**Screen reader**
- Offer: `Din nye terning venter på dit valg: Behold, Kvit eller dobbelt eller 3 for 1. Behold er valgt på forhånd.` For a storm, start with `${countWord(k)} fra stormen …`.
- Keep: `${countWord(k)} er lagt i Terningekammeret.`

**First-die card, new paragraph:** `Fra næste terning kan du vælge at beholde den eller sætte den på spil (Kvit eller dobbelt eller 3 for 1). Valget kan slås fra under Indstillinger.`

**Setting:** `Tilbyd Kvit eller dobbelt`, hint `Slået fra: nye terninger beholdes altid, og der spørges ikke.`

**Demo tools**
- Drawer: `Vis en terning med valg`.
- Header pill segment: `Terning`, aria `Vis en terning og valget Behold, Kvit eller dobbelt eller 3 for 1 – demo-værktøj. Tæller ikke og ændrer ikke dit antal.`
- Tag: `+${n} demo`.

**Rules (`diceRulesHtml`), new `<h4>Kvit eller dobbelt</h4>`:**
- Paragraph 1: `Når et spin har givet en terning, vælger du én gang: Behold, Kvit eller dobbelt eller 3 for 1. Ved de to sidste kastes en almindelig terning: Kvit eller dobbelt giver 2 terninger ved 4, 5 eller 6 og ingen ved 1, 2 eller 3; 3 for 1 giver 3 terninger ved 5 eller 6 og ingen ved 1–4. Der er ét valg pr. tildeling, og resultatet er endeligt. Efter en Solstorm gælder ét fælles valg for alle stormens terninger.`
- Paragraph 2: `Chancerne er fair: i gennemsnit giver alle tre valg præcis lige så mange terninger, som du satte på spil. Kun de nye terninger kan sættes på spil – aldrig dem i kammeret og aldrig penge. Kastet bruger spillets egen tilfældighedsgenerator og har sit eget ID. Din første terning beholdes altid, og mens alle 1948 fliser lyser, og porten ikke er åbnet, beholdes nye terninger altid.`
- Append to the numbers paragraph: `Tallene gælder, når terningerne beholdes. Kvit eller dobbelt ændrer ikke gennemsnittet, men gør antallet mere spredt.`

**Autospin**
- Title `Autospin`. Labels `Antal spin` and `Tabsgrænse`.
- Limit hint: `Autospin stopper, før tabet i denne runde bliver større end ${kr}.`
- Start: `Start autospin`.
- Caption on the button: `STOP · ${left}`. Aria: `Stop autospin. Der er ${left} spin i køen.`
- Stop reasons:
  - `Autospin færdig`
  - `Autospin stoppet ved en terning`
  - `Autospin stoppet · Ladet spin er klar`
  - `Autospin stoppet · Solstorm`
  - `Autospin stoppet · tabsgrænsen er nået`
  - `Autospin stoppet · saldoen er for lav`
  - `Autospin stoppet · menuen blev åbnet`
  - `Autospin stoppet · fanen var skjult`
  - `Autospin stoppet`
- Summary: `${n} spin · netto ${fmtSignedKr}`
- Rules paragraph: `Vælg 10, 25, 50 eller 100 spin og en tabsgrænse. Hvert spin tager mindst 3,0 s, præcis som når du trykker selv, og der er ingen turbo. Autospin stopper ved hver terning, ved Ladet spin, ved Solstorm, før tabet i runden ville overstige tabsgrænsen, når saldoen ikke rækker, og når du åbner menuen, skifter fane eller trykker STOP. Indsatsen er låst, og autospin fortsætter aldrig efter en genindlæsning.`

**"No autoplay" lines to change**
- `hud.ts:735` becomes: `Mindst 3,0 s pr. spin – også i autospin · ingen turbo eller køb af bonus · autospin kræver en tabsgrænse og stopper ved hver terning, Ladet spin og Solstorm · …`
- README:49 and PLAN.md:79/590 (the principles).

**Extra lint for gamble and auto copy only:** `/prøv igen|en gang til|næste gang|denne gang|heldig|lykke|risikofri|sikker|\bvind\b|1948|porten|Automat/i`. The existing BANNED pattern applies to them too. That rules out "vundet", "bonus", "\d+ mere" and similar. The demo button is never labelled "Vind".

## 7. Visuals

### 7.1 The dice home: "Terningenichen" (`#vault`, new `src/ui/vault.ts` + CSS)

It becomes the ONLY dice home. It replaces the chip under Saldo and the desktop `.dice-panel`.
- Keep the ids `#diceBtn`, `#diceIco` and `#diceN`, so the aria-label ("Terninger: n. Åbn Terningekammeret."), dice-check, hello-card placement and `diceTarget()` keep working. `diceTarget()` returns the niche die's centre and size.
- **Phone:** right-aligned directly above SPIN, in the band between the grid frame and the deck/winstrip. The die is about 48–56 px, the count sits under it (violet, tabular), with the small label "KAMMER" or none if tight.
- **Desktop (≥ 1000 px and 5/4):** the last block of `#sideR`, bottom-right. The die is about 96 px, with the count, "terninger" and the link "Porten under klinten ›". The history panel keeps `flex:1`, and 1280×720 must still fit (scrollHeight ≤ clientHeight + 1).
- **Look:** a niche of frosted ice glass (an arched top, an inner shadow, a faint aurora rim gradient teal → violet → magenta at low alpha, a small ice ledge the die floats over). The die bobs ±3 px on an 5 s ease loop.
- **Glint:** every 4–7 s (cosmeticRng), a specular band sweeps the die (canvas `source-atop`, about 450 ms), plus 1–2 tiny star twinkles near its corners.
- **Rattle:** every 20–40 s (cosmeticRng), a 0,5 s rattle: a small rotate/translate jitter of ±4° and ±2 px with an ease-out tail. It happens only in idle, not in autospin, not with a menu, card or chamber open, and not when the document is hidden. Sound: at most a very soft `dieHold` tick when sound is on, or none.
- **Desktop hover:** parallax, the die tilts up to 8° toward the pointer, and the glint follows.
- **0 dice:** the die sits frozen inside the ice (desaturated, darker, a frost overlay, sealed). The first landing thaws it (a crossfade to full colour and a burst of ice glints). This replaces the coded hexagon socket; the coded painter stays as a decode-failure fallback only.
- **After the real unlock:** a slow aurora ring around the niche.
- **Landing ("catch"):** the niche pulses a ring, the count rolls, a small aurora puff rises, and the die dips 3 px.
- **Calm:** everything static (no bob, glint or rattle). The landing is a static ring.
- **Visibility:**
  - hidden on the splash, in the chamber and ceremony, and during the storm's molten phases;
  - visible again from stormOutro, so the released dice can land;
  - hidden by `:root.nodice`.
- **Tap / Enter / Space when focused:** opens the chamber (idle only, as before). Otherwise `aria-disabled`.
- **Hooks:** Game calls `hud.setVaultActive(active: boolean)` when idle and quiet (not auto, no card), so the rattle is only scheduled then. The core phase pre-wires this hook.

### 7.2 "Terningens øjeblik": the big die moment (`src/present/dieAward.ts` + new `src/present/dieMoment.ts`)

**For a base spin or Ladet spin with a die:**
- The die is born as today, under the counting amount.
- When the money celebration closes, `gambleStage('award')` (or a keep-without-offer "hero" beat when there is no offer) lifts the die to stage centre (y ≈ 40 % of the grid area).
- It grows to `clamp(120, 0.34·min(W,H), 260)` px over 700 ms (expo.out), with a 1.25-turn tumble and fake 3D.
- Behind it:
  - an aurora corona: about 18 additive ray wedges in teal/violet/magenta, α ≤ .22, rotating slowly;
  - one expanding ice ring;
  - 20–30 glint motes orbiting on an ellipse;
  - two soft aurora ribbons (softBand) sweeping behind.
- Sky and camera:
  - `world.skyGlowFloor` ramps up over 600 ms (a ramp, never a flash);
  - bloom strength +0.25 as a ramp;
  - `cam.zoom` 1 → 1.04;
  - on arrival `hitStop(70)` + `shake(0.12)` (neither in calm).
- Isfont title `TERNING` (plasma/ice) above the die, with `NR. n` under it.
- Sound, layered from existing buffers: `dieBirth` + a `bell1948` dyad + a low pulse. A new asset is allowed only if ≤ 0,3 MB mono; the audio peak is 63,4 of 64 MB.
- While waiting, the die hovers with a specular sweep every 1,4 s and a gentle bob. The card sits under it (a bottom sheet on phones, so the die stays visible).
- **Keep:** a 700 ms flight to the niche with an aurora trail. The niche catches it.
- **No offer** (first die, opted out, pending gate): the hero beat still plays (a shorter hold, ~0,9 s), then it flies. Tier-4/5 flows keep "Fortsæt".

**The throw (bet, ≥ 3,0 s from the choice):**
- Six ice tablets with pips 1–6 sit in a shallow arc under the die. The winning tablets (4–6, or 5–6) are lit statically from the start in teal/violet, so the odds are visible.
- The die tumbles and rattles in place at a constant tempo and constant pitch. The rattle is jittered `dieHold`/`dieLand` voices, like `countRoll`.
- At the result, the drawn tablet lights once. There is no sweep, no deceleration past faces and no near-miss. The die comes to rest showing a big pip glyph plate in front of it (Isfont numeral), matching the tablet.
- **Win:** the die splits into `payout` dice (clones fanning out, a glint burst, the corona brightens as a ramp, a `bell1948` sting). The dice then fly one by one to the niche.
- **Loss:** the die frosts over (tint → ice blue, desaturate), fine crack lines appear, and it dissolves into snow that drifts down (particles 'snow'). The sound is the neutral `returnTick`. No red and no sad sting.

**Other variants**
- **Storm ('held'):** the held dice rise from the molten frame into a fan at the centre (at most 8, plus "+m"). Result: the fan becomes the payout dice, and the outro releases them.
- **Demo:** a "DEMO · TÆLLER IKKE" band throughout. It dissolves at the niche with "+N demo".
- **Calm:** no tumble, rays, shake, zoom or particles. Crossfades, static tablets, sound −3 dB.
- **Photosensitivity:** a new `gamble` segment in `scripts/luminance.mjs` (demoGamble → choose double → through the settle). The target is 0 WCAG flashes/s and ≤ 1 strict flash/s, full and calm, with no saturated red. The award segment must stay at 0 WCAG flashes/s.

### 7.3 SPIN with aurora (hud.ts + styles.css)

- Inside the button, a masked layer (`overflow: hidden; border-radius: 50%`) holds 3 pre-blurred aurora bands made from radial or linear gradients (teal/green #19e3d6/#3dffb0, violet #8a5cff, magenta #ff2bd6). There is NO `filter: blur`. The bands drift through transforms over 8–12 s, with `mix-blend-mode: screen` over the existing teal body.
- A rotating conic aurora ring sits around the rim (a pseudo-element, rotate animation 14 s).
- States:
  - busy: aurora dims to 40 % and slows
  - Ladet spin (perk): violet-weighted
  - storm: keep the molten look (no aurora)
  - auto: the aurora flows faster and STOP shows
  - calm: a static gradient snapshot
- Fix two findings on the way:
  - `.spin.low` and `.spin[disabled]` are never matched, so the button needs a real low/disabled look;
  - `spinIdle` overrides the perk and storm glow.

### 7.4 Autospin UI

- An "AUTO" pill directly under SPIN replaces the SPIN caption; the word SPIN moves into the button under the icon. It is 44 px tall as a hit area, visually about 22 px.
- The pill opens a small sheet anchored above the deck: `Antal spin` (a segmented 10/25/50/100), `Tabsgrænse` (4 segments in kr from `autoLimits`), and the primary `Start autospin`.
- While running:
  - SPIN shows "STOP" and the pill shows "STOP · 12";
  - the ring still fills over 3 s;
  - the stake is locked.
- On stop: a banner with the reason and a summary ("25 spin · netto −12,40 kr").
- Keys: A = the autospin sheet (idle), D = the demo die.
- Placement must be verified overlap-free at 360×640, 375×667, 390×844, 844×390, 1280×720 and 1920×1080. If the pill cannot fit under SPIN on landscape phones, it may sit at SPIN's left shoulder.

### 7.5 The demo button

- The `#demoPill` in `#hdr` becomes ONE two-segment pill: `⚡ Solstorm | [die icon] Terning`. Below 440 px it shows icons only. It stays one element, so the header's logo-fit measurement (world.ts:207-216) keeps working.
- `#clean` hides it as today, and it is added to the splash, cine and chamber hide lists.
- The drawer gains `Vis en terning med valg`.
- The `#terning` deep link now runs demoGamble (the full flow).

### 7.6 The user's die image everywhere

It appears in:
- the niche, including the frozen 0 state;
- the chamber DOM count block (next to `#chN`);
- GateView: a small die floating above the NORDLYS niche (the keystone already uses it);
- the menu tab "Terningen" (tab icon and header);
- the history mark "· terning" (a 12 px die icon);
- the storm summary row;
- the gamble card;
- the autospin stop banner when it stops for a die.

The coded die and socket in `diceIcon.ts` become fallback only.

### 7.7 Details

- Menu tab "Terningen" gets a "Dine valg" log: the last 10 gamble log entries, each with ID, choice, pip, and result as "1 → 2 terninger" or "1 → ingen". This is an audit trail.
- Haptics: 12 ms on a result (never in calm).
- Screen-reader lines for the offer, throw, result and autospin stop.
- Desktop tooltips.
- Focus order: Behold gets focus first. No timer or countdown on the card.

## 8. Tests and checks

**`tests/dice.boundary.test.ts`**
- Keep the existing tests.
- The demo methods (+ `demoGamble`) and `debug` contain none of `settleGamble`, `openGamble`, `commitGamble`, `offerDice`, `clearSettled`.
- ui, render and present never import the new mutators or `cloneDice`.
- New tests:
  - `settleGamble(` is called once in Game.ts, inside `commitGamble`, which matches `/if \(this\.demoMode \|\| !this\.dice\.gamble \|\| this\.dice\.gamble\.settled\) return null;[\s\S]*settleGamble\([\s\S]*this\.persist\(\)/`. `++this.s.counters.gamble` appears once, inside commitGamble.
  - `dice.count` is written only in dice.ts (addDie, settleGamble), or in `debug`.
  - `openGamble(` appears once, inside `offerDice`, whose body starts with the `demoMode || !canOffer(` guard. `this.offerDice(` is called exactly twice:
    - in spin(), between `this.awardDie(r)` and `this.persist()`;
    - in the storm finish block containing `this.s.activeStorm = null`, before its persist().
  - In `gambleAct`, `commitGamble(` comes before `pick(res)`. In `runGamble`, the awaited pick comes before `gambleThrow(`.
  - spin() has the auto balance stop before `this.refill()`. autoContinue calls `this.spin()` and never presentSpin, timeScale or clock scale.

**`tests/dice.test.ts`**
- Updated defaults.
- canOffer, openGamble, and settleGamble for keep and for every face × both bets.
- clearSettled, and cloneDice (deep).
- A seeded property test of the invariants.

**New `tests/gamble.test.ts`**
- Exact enumeration: mean payout = k for k 1..20. Win faces are 3/6 and 2/6, and they are nested.
- 600k draws of `gambleFace(spinRng(s,'gamble',i))`: chi² over the 6 faces, and the mean payout within 0,006·k.
- Golden faces for one seed.
- The gid round-trips through `parseSpinId`.
- A bad face throws.

**Other tests**
- `tests/math.rng.test.ts`: the 'gamble' domain and the `T` id.
- `tests/present.schedule.test.ts`: present, render and ui never contain `gambleFace(` or `resolveGamble(`.
- New `tests/auto.test.ts`: an `autoStopReason` table, `autoLimits` and `validAuto`.
- `tests/dice.copy.test.ts`:
  - every gamble string for k ∈ {1,2,3,7,20}, spin and storm, real and demo, every pip × bet, restored or not;
  - every AUTO string in the corpus;
  - the extra lint;
  - the card's structure: button order, primary on keep only, sub-lines equal to winPips/countWord, the fairness line, no countdown.

**`scripts/dice-check.mjs`**
- New sections `gamble` and `auto`. A `keepIfOffered()` helper for the existing storm, resume and perk sections.
- The existing award b/c checks run with `settings.gambleOffers = false`.
- `gamble` section:
  - The 1st die gets no card.
  - The 2nd die: the store count is +1 at the SPIN press, `gamble.stake === 1`, Behold is focused, and Space and the bets are inert before 1,0 s.
  - A win (via qaGamble): count and `settled` are in the store AT the choice press, and the result is shown ≥ 3,0 s later.
  - A loss.
  - Keep via Space.
  - The niche count never decreases across all frames.
  - Reload mid-choice and mid-throw: no new draw (`counters.gamble` unchanged).
  - Storm: the card shows k, a double win releases 2k in the outro, and the niche equals the count at idle.
  - `qaDice(1946)` + a triple win → the 1948 card. `qaDice(1947)` → no card, the die is kept.
  - Demo (the drawer and the header segment): zero `setItem` calls on `terningen.v1`, a byte-identical store, `counters.gamble` unchanged, and the "+N demo" tag.
  - The landing is ≤ 4 px from the niche.
- `auto` section:
  - the gap between presses is ≥ 3,0 s;
  - stops at: die (the card shows), perk, storm, loss (a 10× limit), balance (no refill), STOP mid-spin (+1 spin only), menu, hidden, demo;
  - the stake buttons are disabled during autospin.

**Tour and luminance**
- `scripts/tour.mjs` at 360×640, 375×667, 390×844, 844×390, 1280×720 and 1920×1080: zero page errors. Overlap checks between the niche, SPIN, the AUTO pill, winstrip, grid frame, #reg, #foot and the hello card.
- Shots: the die moment, the card, mid-throw, win, loss, the autospin sheet and running state, the niche at 0 and at n.
- `scripts/luminance.mjs`: a new `gamble` segment. award, gamble and gate pass, full and calm.

**Audio and artifact**
- `node dev/audio-check.mjs` (peak < 64 MB) and `dev/polar-check.mjs` stay green.
- `npm run build:artifact` stays < 16 MB. A strict-CSP smoke of `#terning`, `#solstorm` and `#1948`: 0 errors and 0 demo writes.

## 9. Risks (accepted)

- Autospin and double-or-nothing on dice reverse earlier RG positions at the user's explicit request. The mitigations:
  - fair odds;
  - only new dice can be staged;
  - keep is the default;
  - the gamble can be switched off in settings;
  - no gate mention in gamble copy (enforced by the lint);
  - the autospin loss limit is mandatory.
- REPORT remains valid for means (the gamble is fair). The copy says the numbers assume keeping.
- Accession numbers can repeat after a loss. This is cosmetic.
