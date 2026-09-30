# Talvennerne 2: design for pædagogik, pensum og data

Rolle: indskolingslærer og læringsdesigner. Designet bygger på V1-koden i `/home/user/Test/src`. Alle stier nedenfor er relative til V2-appens rod.

---

## 0. Kernebeslutninger

| # | Beslutning | Begrundelse |
|---|---|---|
| 1 | Hierarkiet er **domæne → skill → familie → fact/instans**: 10 domæner (dashboardets kategorier), 72 skills (motorens enhed), cirka 170 familier (diagnostik og procedure-mestring). | Forældre skal se kategorier. Motoren skal kunne vælge præcist. Familier giver svar som "38+45-typen driller", og uden dem kan store puljer ikke mestres. |
| 2 | Hver skill er ét selvstændigt `SkillDef`-modul i et register. De 8 `switch(skill)`-steder i V1 fjernes. | I V1 skal man røre `facts.ts`, `tasks.ts` (4 funktioner), `distractors.ts`, `roundBuilder.validKinds`, `PromptDisplay`, `StrategyHint` og `engine.test` for hver ny skill. Med 72 skills holder det ikke. |
| 3 | Skills har to mestringstilstande. **recall** (automatiseres, højst cirka 100 facts) bruger Leitner pr. fact. **procedure** (store puljer) bruger Leitner pr. familie, og instanserne trækkes seedet. | 3-cifret plus har tusindvis af instanser. Mestring pr. instans ville aldrig blive færdig, mens mestring pr. familie måler strategien. |
| 4 | `answer: number \| string` plus `answerType`, `tolerance` og `accept`. Alle tidspunkter er minutter efter kl. 12. Alle beløb er øre. | Svarene kan serialiseres som JSON (pauset tur), V1's talkode ændres mindst muligt, og ur og penge forbliver numeriske. Det giver distraktorer som tal og keypad hvor det giver mening. |
| 5 | 16 TaskKinds. Hver skill har mindst én **produktions-kind**, dvs. en opgave hvor barnet selv frembringer svaret. | Den låste regel siger at valgopgaver topper ved boks 3. Uden en produktions-kind kan former, ur og mønter aldrig nå "kan selv". |
| 6 | Boks 4 og 5 kræver produktion **og en anden kalenderdag**. | Det er den eneste ærlige måde at vise at barnet har husket noget efter en nats søvn. Det er også nødvendigt fordi der ikke er tidsgrænse, så barnet kan spille 40 ture på én dag. |
| 7 | Tale sættes sammen af cirka 1.220 forindspillede klip (cirka 25 min): hele sætninger for alt fast, og talord, tidsfraser og beløb som slots. | Inventaret er endeligt og kan testes. Dækningen er garanteret, fordi manifestet genereres af den samme normalisering som koden bruger. |
| 8 | Alt lagres i IndexedDB-databasen `talvennerne2` (Dexie). localStorage bruges kun til `talvennerne2.activeProfile`. | localStorage-kvoten på 5 MB deles af ti apps på samme origin. 6 profiler med svarlog hører ikke hjemme der. |

---

## 1. Færdighedstaksonomi 0.–3. klasse

### 1.1 Domæner (dashboardets kategorier)

| DomainId | Forældrelabel | Kerne i niveauestimat |
|---|---|---|
| `number` | Tal og tælling | ja |
| `place` | Titalssystemet | ja |
| `addsub` | Plus og minus | ja |
| `muldiv` | Gange og division | ja |
| `algebra` | Lighedstegn og mønstre | nej |
| `shapes` | Figurer og rum | nej |
| `clock` | Klokken | nej |
| `money` | Penge | nej |
| `measure` | Måling og data | nej |
| `fractions` | Brøker | nej |

### 1.2 SkillDef-kontrakt

```ts
// src/engine/skills/types.ts
export interface SkillDef {
  id: SkillId
  domain: DomainId
  grade: 0 | 1 | 2 | 3
  stage: number                 // 0.0–3.9 position i pensum, bruges til niveauestimat
  mode: 'recall' | 'procedure'
  label: string                 // forældretekst, dansk
  families: FamilyDef[]
  kinds: TaskKind[]             // gyldige præsentationer; mindst én skal være produktion (test)
  enumerate(): Fact[]           // endelig, deterministisk, sorteret let→svær
  prompt(fact: Fact, kind: TaskKind, rng: Rng): Prompt
  speech(fact: Fact, kind: TaskKind): SpeechScript
  candidates(fact: Fact): Candidate[]   // mærkede forkerte svar (afsnit 3)
  hint(fact: Fact, tag: ErrorTag | null): HintSpec
}
export interface FamilyDef {
  id: string; label: string; rank: number
  grade?: 0 | 1 | 2 | 3         // overstyrer skill.grade, fx afrunding (3. kl.) i numberLine1000
  fastMs?: Partial<Record<TaskKind, number>>
}
export interface Fact {
  id: string                    // 'add:38+45', 'mul:3x7', 'clk:150', 'pay:1700'
  skill: SkillId
  family: string
  operands: readonly number[]
  answer: AnswerValue
  rank: number
  data?: FactData               // diskrimineret ekstra: figurvariant, møntsæt, datasæt
}
// masteryKey = recall ? fact.id : `${skill}/${family}`
```

Faktaregler:
- Gange lagres kanonisk som `mul:3x7` (mindste faktor først), og retningen trækkes i `buildTask`. Den kommutative lov giver dermed én mestringsnøgle pr. par.
- V1's id-konventioner (`add:a+b`, `sub:a-b`, `ten:a`, `dbl:a`, `hlf:n`) genbruges.

### 1.3 Skills

Forkortelser:
- **P** betyder produktions-kind.
- **R/Pr** betyder recall/procedure.
- Antal er facts for R og familier/instanser for Pr.

#### Domæne `number`: Tal og tælling

| id | kl. | stage | mode | Beskrivelse | Opregning (antal) | Repræsentation | Kinds |
|---|---|---|---|---|---|---|---|
| `count10` | 0 | 0.1 | R | Tæl 1–10 ting. Genkend 1–6 uden at tælle | `scatter` n=1–10 (10), `flash` n=1–6 × {terning, fingre, ti-ramme} vist 1,5 s (18) = **28** | dyr/prikker, terning, fingre, ti-ramme | choice, countTap P, keypad P |
| `count20` | 0 | 0.5 | R | Tæl 11–20 med tieren som klump | `tenframe` 11–20 (10), `loose` 11–20 (10) = **20** | 2 ti-rammer, perlesnor | choice, keypad P, countTap P |
| `hear20` | 0 | 0.3 | R | Hør et tal og find eller skriv cifrene 0–20 | 0–20 = **21** (11–19 har rank sidst, fordi de er uregelmæssige) | højttaler, talkort | choice, keypad P |
| `order20` | 0 | 0.4 | Pr | Før/efter/imellem/størst til 20 | `after` 20, `before` 20, `between` 19, `bigger` (par med afstand 1–3) 57 → **4 fam.** | tallinje 0–20, trædesten | choice, numberline P, keypad P, sortOrder P |
| `hear100` | 1 | 1.2 | Pr | Hør tal 20–99 (ener-før-tier, tyvetalssystem) | fam. `d2x`…`d9x`, 10 instanser hver → **8 fam./80** | højttaler, 100-tavle | choice, keypad P |
| `order100` | 1 | 1.3 | Pr | ±1, ±10, over tierskifte, størst, rækkefølge | `plus1`, `minus1`, `plus10`, `minus10`, `crossTen` (39+1, 70−1), `biggerDiffTens`, `biggerSwapped` (46/64) → **7 fam.** | 100-tavle | choice, keypad P, sortOrder P |
| `numberLine100` | 1 | 1.5 | Pr | Placér og aflæs på tom tallinje 0–100 (overslag) | `placeTens` 9, `placeAny` 99 (tolerance ±5), `readArrow` (multipla af 5, eksakt) 19 → **3 fam.** | tallinje | numberline P, choice, keypad P |
| `hear1000` | 2 | 2.1 | Pr | Hør tal 100–1000 | `hundreds` 10, `h0o` 81 (104), `hTeen` 81 (213), `hT0` 81 (320), `hTO` 567 → **5 fam.** | højttaler, multibase | choice, keypad P (5 cifre tilladt, så 1004-fejlen kan ses) |
| `order1000` | 2 | 2.3 | Pr | ±1/±10/±100, over hundredskifte, sammenlign, rækkefølge | `plus1`, `plus10`, `plus100`, `minus1`, `minus10`, `minus100`, `crossHundred` (399+1, 190+10, 400−1), `bigger3`, `biggerMixed` (69 vs 102) → **9 fam.** | tallinje, positionsplade | choice, keypad P, sortOrder P |
| `numberLine1000` | 2 | 2.5 | Pr | Tallinje 0–1000 (±50). Afrunding (3. kl.) | `placeHundreds`, `placeAny`, `round10` (g3), `round100` (g3) → **4 fam.** | tallinje | numberline P, choice, keypad P |

#### Domæne `place`: Titalssystemet

| id | kl. | stage | mode | Beskrivelse | Opregning | Repr. | Kinds |
|---|---|---|---|---|---|---|---|
| `tensOnes` | 1 | 1.1 | Pr | Tiere og enere ↔ tal til 99 | `build` (t,o→n) 90, `decompose` ("hvor mange tiere i 47") 180, `swapped` ("3 enere og 5 tiere") 81, `expand` (47 = 40 + ?) 81 → **4 fam.** | multibase-stænger og -terninger, positionsplade | choice, keypad P, buildBase P, fillSlots P |
| `placeValue1000` | 2 | 2.2 | Pr | H/T/E, cifferværdi, nul som pladsholder, veksling (3. kl.) | `buildHTO` 900, `zeroPlace` 162, `digitValue` (hvad er 7-tallet værd i 472), `expand` (472 = 400 + ? + 2), `regroup` g3 ("2 hundreder og 14 tiere") ~150 → **5 fam.** | plader/stænger/terninger | choice, keypad P, buildBase P, fillSlots P |

#### Domæne `addsub`: Plus og minus

| id | kl. | stage | mode | Beskrivelse | Opregning | Repr. | Kinds |
|---|---|---|---|---|---|---|---|
| `addTo10` | 0 | 0.4 | R | a+b ≤ 10 | **66** (V1) | prikker, ti-ramme | choice, keypad P |
| `subTo10` | 0 | 0.6 | R | a−b, a ≤ 10 | **66** | overstregede prikker | choice, keypad P |
| `tenFriends` | 0 | 0.8 | R | a + ? = 10 | **11** | ti-ramme | pair, choice, keypad P |
| `doubles` | 1 | 1.0 | R | a+a, a=1–10 | **10** | domino, to hænder | choice, keypad P, numberline P |
| `halves` | 1 | 1.1 | R | halvdelen af 2–20 | **10** | deling i to | choice, keypad P, share P |
| `addSub20Simple` | 1 | 1.2 | Pr | 12+5, 17−4, 10+6 (ingen tierovergang) | `addTeen` 45, `subTeen` 45, `tenPlus` 18 → **3 fam.** | 2 ti-rammer | choice, keypad P |
| `addTo20` | 1 | 1.4 | R | Plus over tieren (8+5) | **36** (V1) | ti-ramme "fyld op til 10" | choice, keypad P, numberline P |
| `subTo20` | 1 | 1.6 | R | Minus over tieren (13−5) | **36** (V1) | ti-ramme "tilbage til 10" | choice, keypad P |
| `tens100` | 1 | 1.5 | Pr | 30+40, 70−20 | `addTens` 45, `subTens` 45 → **2 fam.** | tierstænger | choice, keypad P |
| `add100NoCarry` | 1 | 1.7 | Pr | 34+5, 34+20, 34+25 | `TOplusO`, `TOplusT0`, `TOplusTO` → **3 fam.** | multibase, 100-tavle | choice, keypad P, buildBase P |
| `sub100NoBorrow` | 1 | 1.8 | Pr | 47−5, 47−20, 47−25 | `TOminusO`, `TOminusT0`, `TOminusTO` → **3 fam.** | samme | choice, keypad P |
| `add100Carry` | 2 | 2.1 | Pr | Med tierovergang | `toNextTen` (37+3), `TOplusOcarry` (38+5), `TOplusTOcarry` (38+45), `nearTen` (46+9, 46+19) → **4 fam.** | tom tallinje med hop | choice, keypad P, numberline P |
| `sub100Borrow` | 2 | 2.3 | Pr | Med veksling | `fromTen` (40−3, 60−24), `TOminusOborrow` (43−7), `TOminusTOborrow` (53−27), `nearTen` (52−9) → **4 fam.** | samme | choice, keypad P |
| `addSub1000Round` | 2 | 2.5 | Pr | Hele hundreder og tiere | `HplusH`, `HminusH`, `HTplusT`, `HTminusT`, `HplusTO`, `HTplusTcarry` (370+50) → **6 fam.** | plader, stænger | choice, keypad P |
| `add1000` | 3 | 3.1 | Pr | Trecifrede plus | `HTOplusOcarry`, `HTOplusTO`, `HTOplusTOcarry1`, `HTOplusTOcarry10`, `HTOplusHTO`, `HTOplusHTOcarry` → **6 fam.** | positionsplade | choice, keypad P |
| `sub1000` | 3 | 3.3 | Pr | Trecifrede minus | `HTOminusOborrow`, `HTOminusTO`, `HTOminusTOborrow`, `HTOminusHTO`, `HTOminusHTOborrow`, `acrossZero` (402−7, 500−36) → **6 fam.** | positionsplade | choice, keypad P |

Regnehistorier er en `Prompt`-variant (`scene:'story'`) for addTo10, subTo10, addTo20, subTo20, mul2510, shareEqually og change. De er ikke en egen skill.

#### Domæne `muldiv`: Gange og division

| id | kl. | stage | mode | Beskrivelse | Opregning | Repr. | Kinds |
|---|---|---|---|---|---|---|---|
| `groupsOf` | 2 | 2.4 | R | "3 kurve med 4": gange som gentaget plus | g 2–5 × s 2–5 = **16** | grupper af dyr, array | choice, keypad P |
| `mul2510` | 2 | 2.6 | R | 2-, 5- og 10-tabellen | kanoniske par = **27** | array, spring på tallinje | choice, keypad P |
| `shareEqually` | 2 | 2.7 | R | Del ligeligt mellem 2–5 | g 2–5 × q 1–5 = **20** | dyr får gulerødder | share P, choice, keypad P |
| `mul34` | 3 | 3.2 | R | Resten af 3- og 4-tabellen | **13** | array | choice, keypad P |
| `mul6to9` | 3 | 3.5 | R | Resten af 6–9-tabellerne (6·6…9·9 og ·1) | **14** | array delt op (7·8 = 5·8 + 2·8) | choice, keypad P |
| `div2510` | 3 | 3.3 | R | c : 2/5/10 | **30** | array, deling | choice, keypad P, share P (c ≤ 20) |
| `divAll` | 3 | 3.7 | R | c : 3, 4, 6–9 | **60** | array | choice, keypad P |
| `mulTens` | 3 | 3.8 | Pr | 3·40, 20·4 | `oneDigitTimesTens` 32, `tensTimesOneDigit` 32 → **2 fam.** | stænger | choice, keypad P |

De 54 unikke produkter (27 + 13 + 14) dækker hele den lille tabel. Dashboardets "7-tabellen" er et prædikat på tværs af skills: alle `mul:`-facts med faktor 7.

#### Domæne `algebra`: Lighedstegn og mønstre

| id | kl. | stage | mode | Beskrivelse | Opregning | Repr. | Kinds |
|---|---|---|---|---|---|---|---|
| `patterns` | 0 | 0.2 | Pr | Fortsæt mønstre | `AB`, `AAB`, `ABB`, `ABC`, `growing`; hver 24 instanser (tokens: former, farver, dyr) | perler på snor | choice, fillSlots P |
| `missingPart10` | 1 | 1.3 | R | 3 + ? = 7 (c < 10, c=10 er tenFriends) | **36** | prikker gemt under et blad | choice, keypad P |
| `skipCount` | 1 | 1.4 | Pr | Tæl i spring | `step2`, `step5`, `step10`, `step10offset` (3, 13, 23), `back10`, `step100` (g2), `step25` (g3) → **7 fam.** | trædesten, 100-tavle | choice, keypad P, fillSlots P |
| `missingPart20` | 2 | 2.0 | Pr | 8+?=13, 13−?=5, ?−5=8 | `addendCross`, `subtrahend`, `minuend` → **3 fam.** | tom tallinje | choice, keypad P |
| `inverseOps` | 2 | 2.2 | Pr | Regnefamilier: 7+5=12, så 12−5=? | `addToSub`, `subToAdd`, `mulToDiv` (g3) → **3 fam.** | regnetrekant | choice, keypad P |
| `equalSides` | 2 | 2.4 | Pr | Lighedstegnet betyder samme værdi | `trueFalse` (7+2 = 9+0?), `balanceAdd` (8+4 = ?+5), `balanceSub` (g3), `balanceMixed` (7+3 = 12−?) → **4 fam.** | vippebræt med dyr | trueFalse, choice, keypad P |

#### Domæne `shapes`: Figurer og rum

| id | kl. | stage | mode | Beskrivelse | Opregning | Repr. | Kinds |
|---|---|---|---|---|---|---|---|
| `shapes2D` | 0 | 0.2 | R | Cirkel, trekant, firkant, kvadrat, rektangel (1. kl.: femkant, sekskant, ottekant) | `basic` 4 × 6 varianter (standard, drejet 45°, strakt/skæv, lille, mønstret, kun omrids) = 24; `polygons` (g1) 3 × 4 = 12 → **36** | ikke-prototypiske varianter er obligatoriske | choice, multiSelect P |
| `sidesCorners` | 1 | 1.3 | R | Tæl sider og hjørner | {3,4,5,6,8}-kant × {sider, hjørner} × {regulær, uregelmæssig, drejet} = **30** | figur, hjørner markeres i hint | choice, keypad P |
| `shapes3D` | 1 | 1.6 | R | Kugle, terning, kasse, cylinder, kegle, pyramide; egenskaber (2. kl.) | `names` 6 × 3 (tegnet + 2 hverdagsting) = 18; `props` (g2) triller/kan stables/antal flader = 15 → **33** | 3D-tegning og hverdagsting | choice, multiSelect P, keypad P |
| `sortShapes` | 1 | 1.7 | Pr | Sortér efter egenskab | `threeCorners`, `fourCorners`, `noCorners`, `fourEqualSides` (g2), `rightAngle` (g3), 40 plader hver | 6–8 figurer | multiSelect P |
| `symmetry` | 1 | 1.8 | Pr | Symmetrilinje; spejling på net (2. kl.) | `isSymLine` 32, `mirrorGrid` (g2) 24 opgaver 4×4–6×6 | net, spejl | trueFalse, multiSelect P, grid P |
| `composeShapes` | 2 | 2.5 | R | Del og sammensæt (2 trekanter = kvadrat) | **16** opgaver | tangram-brikker | choice, keypad P |
| `area` | 3 | 3.4 | Pr | Areal i kvadrater, rækker × søjler | `countSquares`, `rowsCols`, `lShape`, `compareArea` | kvadratnet | choice, keypad P |
| `gridCoords` | 3 | 3.6 | Pr | Koordinatsystem, 1. kvadrant 0–6 | `readPoint` 49, `placePoint` 49 | net med akser | choice, grid P |

#### Domæne `clock`: Klokken (svar = minutter efter 12:00, 0–719; 24-timers 0–1439)

| id | kl. | stage | mode | Beskrivelse | Opregning | Kinds |
|---|---|---|---|---|---|---|
| `clockHour` | 1 | 1.5 | R | Hele timer | **12** | choice (3 ure), clockSet P |
| `clockHalf` | 1 | 1.8 | R | "halv tre" = 2:30 | **12** | choice, clockSet P |
| `clockQuarter` | 2 | 2.5 | R | Kvart over / kvart i | **24** | choice, clockSet P |
| `clockFive` | 3 | 3.2 | Pr | 5-minutters-intervaller | `over` (:05, :10, :20) 36, `iHalv` (:25) 12, `overHalv` (:35) 12, `i` (:40, :50, :55) 36 → **4 fam.** | choice, clockSet P |
| `clockDigital` | 3 | 3.5 | Pr | Digitalt ur, 12 og 24 timer | `analogToDigital` 48, `digital24` 48 → **2 fam.** | choice, clockSet P |
| `clockElapsed` | 3 | 3.6 | Pr | Hvad er klokken om/for … | `plusHour`, `plusHalf`, `plusQuarter`, `minusHalf` (start på kvarter, 48 hver) → **4 fam.** | choice, clockSet P |

#### Domæne `money`: Penge (svar i øre. Mønter: 50 øre, 1, 2, 5, 10, 20 kr. Sedler: 50, 100, 200, 500 kr)

| id | kl. | stage | mode | Beskrivelse | Opregning | Kinds |
|---|---|---|---|---|---|---|
| `coinNames` | 1 | 1.2 | R | Kend mønter og sedler | **10** | choice, multiSelect P ("tryk på alle femkroner") |
| `countCoins` | 1 | 1.6 | Pr | Hvor mange penge? | `sameCoins` (≤20), `mixedTo20`, `mixedTo100` (g2), `biggestFirst` (g2) → **4 fam.** | choice, keypad P |
| `payExact` | 2 | 2.3 | Pr | Betal præcist | `to20`, `to50`, `to100`, `fewestCoins` (g3) → **4 fam.** | pay P, choice |
| `change` | 2 | 2.6 | Pr | Byttepenge | `from10`, `from20`, `from50`, `from100` (g3) → **4 fam.** | choice, keypad P, pay P |
| `kronerOre` | 3 | 3.4 | Pr | Kroner og øre | `readAmount` (12,50 kr), `fiftiesInKroner`, `addHalves` (2,50 + 2,50) → **3 fam.** | choice, pay P |

#### Domæne `measure`: Måling og data

| id | kl. | stage | mode | Beskrivelse | Opregning | Kinds |
|---|---|---|---|---|---|---|
| `compareLength` | 0 | 0.3 | R | Længst/kortest; linet op eller forskudt | **16** | choice, sortOrder P |
| `weightCompare` | 1 | 1.0 | R | Tungest på skålvægt; stor er ikke det samme som tung | **12** | choice, sortOrder P |
| `measureUnits` | 1 | 1.1 | Pr | Mål med klodser eller clips | `cubes` 2–12, `clips` 2–10 → **2 fam.** | choice, keypad P |
| `rulerRead` | 1 | 1.7 | Pr | Aflæs lineal i cm; forskudt start (g2); tegn længde | `from0` 1–15, `offset` (g2, start 1–5), `draw` 1–15 → **3 fam.** | choice, keypad P, rulerDraw P |
| `unitChoice` | 2 | 2.2 | R | cm eller m; g eller kg (g3) | `lengthUnit` 16, `weightUnit` 8 → **24** | choice, multiSelect P |
| `readChart` | 2 | 2.6 | Pr | Piktogram og søjlediagram | `readPicto`, `readBar`, `mostLeast`, `difference`; 30 seedede datasæt hver | choice, keypad P |
| `convertCmM` | 3 | 3.3 | Pr | 1 m = 100 cm | `mToCm`, `mCmToCm`, `cmToMCm`, `compareMixed` → **4 fam.** | choice, keypad P |

#### Domæne `fractions`: Brøker (svar-tokens `'1/4'`)

| id | kl. | stage | mode | Beskrivelse | Opregning | Kinds |
|---|---|---|---|---|---|---|
| `halfShape` | 1 | 1.4 | R | Er den delt i halve (lige store dele)? | 8 lige + 8 skæve = **16** | trueFalse, multiSelect P |
| `fractionShape` | 2 | 2.6 | R | Halve, tredjedele, fjerdedele af figurer | {1/2, 1/3, 1/4, 2/4, 3/4, 2/3} × {cirkel, rektangel, stang} = **18** | choice, colorParts P |
| `fractionOfSet` | 3 | 3.3 | Pr | Halvdelen, en fjerdedel eller en tredjedel af en mængde | `halfOf` 10, `quarterOf` 5, `thirdOf` 6, `threeQuartersOf` 5 → **4 fam.** | share P, choice, keypad P |
| `fractionCompare` | 3 | 3.6 | R | Hvad er størst: 1/2 eller 1/4? | par af {1/2, 1/3, 1/4, 1/6, 1/8} × {størst, mindst} = **20** | choice, sortOrder P |

**Totaler:** 72 skills (32 recall med cirka 800 facts, 40 procedure med cirka 170 familier). Det giver cirka 970 mestringsnøgler pr. profil, eller cirka 70 KB JSON.

**Fravalg:** Chance og sandsynlighed (3. kl.) er udeladt, fordi fagplanen kræver at det arbejdes med gennem fysiske eksperimenter, og det bliver ikke meningsfuldt på en skærm. Omkreds og division med rest er udeladt, fordi de hører til 4. klasse.

---

## 2. Svarmodel og opgavetyper

### 2.1 Typer

```ts
// src/engine/types.ts
export type AnswerValue = number | string
export type AnswerType =
  | 'int'        // tal, antal, cm, kroner-som-tal
  | 'minutes'    // klokken: minutter efter 12:00 (0–719) / 00:00 (0–1439)
  | 'ore'        // penge i øre
  | 'token'      // lukket ordforråd: 'triangle', '1/4', 'cm', 'yes'/'no', '<', 'opt2'
  | 'set'        // sorterede tokens, '|'-joined: 's0|s3|s5', gitterceller '3|7|12'

export interface Task {
  id: string; factId: string; masteryKey: string
  skill: SkillId; family: string; kind: TaskKind
  prompt: Prompt
  answer: AnswerValue
  answerType: AnswerType
  accept: AnswerValue[]          // ækvivalente svar, fx '2/4' når '1/2' farves på en 4-delt figur
  tolerance: number              // 0; tallinje 0–100: 5; 0–1000: 50
  options: AnswerValue[]         // choice/pair/multiSelect/sortOrder/fillSlots-palet
  optionView: OptionView
  distractorTags: Record<string, ErrorTag>   // String(option) → fejltype, til logning
  unit: 'kr' | 'cm' | 'm' | null // keypad-suffiks
  entryScale: 1 | 100            // keypad i kroner når answerType='ore'
  range: [number, number]
  scaffold: boolean              // manipulative i prompten (kun boks 0)
  speech: SpeechScript           // klip-sekvens (afsnit 6)
}

export type OptionView =
  | 'numeral' | 'clock' | 'clockDigital' | 'coin' | 'shape' | 'solid'
  | 'fraction' | 'unitWord' | 'relation' | 'picture' | 'patternToken' | 'chartBar'

export type Term = { n: number } | { blank: true } | { op: '+' | '−' | '·' | ':' | '=' }

export type Prompt =
  | { scene: 'equation'; terms: Term[] }              // 38 + 45 = □ · 8 + □ = 13 · 8 + 4 = □ + 5
  | { scene: 'objects'; n: number; layout: 'scatter'|'dice'|'fingers'|'tenframe'|'row'; item: ItemId; flashMs?: number }
  | { scene: 'hear' }                                 // kun højttaler (hear20/100/1000)
  | { scene: 'base'; h: number; t: number; o: number; order: 'hto' | 'oth' }
  | { scene: 'row'; cells: (number | string | null)[] }   // talrække/mønster med huller
  | { scene: 'line'; min: number; max: number; arrowAt?: number; target?: number }
  | { scene: 'groups'; groups: number; size: number; item: ItemId }
  | { scene: 'array'; rows: number; cols: number }
  | { scene: 'share'; total: number; recipients: number; item: ItemId }
  | { scene: 'balance'; left: Term[]; right: Term[] }
  | { scene: 'shape'; shape: ShapeId; variant: number; mark?: 'corners' | 'sides' }
  | { scene: 'shapes'; items: { id: string; shape: ShapeId; variant: number }[] }
  | { scene: 'solid'; solid: SolidId; asObject?: ObjectId }
  | { scene: 'symmetry'; picture: string; line: 'v' | 'h' | 'd' }
  | { scene: 'grid'; w: number; h: number; filled: number[]; axis?: 'v'; coords?: boolean }
  | { scene: 'clock'; minutes: number | null; digital?: boolean; step: 60 | 30 | 15 | 5 }
  | { scene: 'coins'; ore: number[] }
  | { scene: 'shop'; item: ItemId; priceOre: number; paidOre?: number; purse: number[] }
  | { scene: 'ruler'; object: ObjectId; startCm: number; lengthCm: number | null }
  | { scene: 'unitsRow'; object: ObjectId; unit: 'cube' | 'clip'; length: number }
  | { scene: 'compareObjects'; objects: ObjectId[]; sizes: number[]; aligned: boolean; mode: 'length' | 'weight' }
  | { scene: 'chart'; kind: 'picto' | 'bar'; data: { cat: SpeciesId; n: number }[] }
  | { scene: 'fraction'; shape: 'circle' | 'rect' | 'bar'; parts: number; colored: number; equal: boolean }
  | { scene: 'area'; w: number; h: number; cells: number[] }
  | { scene: 'story'; frame: StoryId; species: SpeciesId; nums: number[] }
```

```ts
// src/engine/answer.ts
export function isCorrect(task: Task, given: AnswerValue): boolean {
  if (typeof task.answer === 'number' && typeof given === 'number')
    return Math.abs(given - task.answer) <= task.tolerance
  return given === task.answer || task.accept.includes(given)
}
```

**Keypad kun til tal.** `validKinds` filtrerer `keypad` væk medmindre `answerType ∈ {'int','ore'}`. For `ore` gælder desuden at svaret skal være hele kroner (`answer % 100 === 0`). I så fald vises suffikset "kr", og indtastningen ganges med `entryScale=100`. `maxDigits` sættes til `max(digits(range[1]), digits(answer)+2)` i `hear1000` og `placeValue1000`, så 1004- og 30020-fejlene kan ses. Andre steder bruges `digits(range[1])`. Et engine-assert fejler hvis keypad kombineres med `minutes`, `token` eller `set`.

### 2.2 TaskKinds (16), designet til et 6–9-årigt barn der måske ikke kan læse

Fælles regler for alle kinds:
- Opgaven læses op automatisk.
- En højttalerknap "Hør igen" er altid synlig.
- Et langt tryk (≥400 ms) på et svarkort læser kortet op. Det gør "cm", "ja" og lignende tilgængelige for børn der ikke kan læse.
- Tryk-mål er mindst 64 pt.
- Kind-instruktionen læses fuldt de første 3 gange pr. profil og derefter i kort form.

| kind | Skærm og interaktion | Produktion? | Loft |
|---|---|---|---|
| `choice` | Prompt øverst, 2–4 store kort (tal, ur, mønt, figur, brøk, enhedsikon). Et tryk er svaret. | nej | 3 (2 kort: 2) |
| `keypad` | V1 plus enhedssuffiks. ✓ aktiveres når der er indtastet noget. | ja | 5 |
| `countTap` | "Læg 7 i kurven": tryk på ting så de flyver i kurven, tryk i kurven for at fortryde, derefter ✓. | ja | 5 |
| `pair` | V1: træk to bobler sammen. | nej | 3 |
| `numberline` | V1 plus `tolerance` og intervallerne 0–1000. | ja | 5 |
| `trueFalse` | Påstand vises og læses op. To knapper: grønt ✓-ikon ("ja") og koralrødt ✗-ikon ("nej"). Ingen tekst. | nej | **2** |
| `sortOrder` | 3–5 kort. Barnet trykker i rækkefølge ("den mindste først"), og kortet flyver til plads 1, 2, … Tryk på et placeret kort sender det tilbage. | ja, hvis ≥3 kort | 5 |
| `multiSelect` | 5–8 ting i et gitter. Et tryk giver ring og flueben. "Tryk på alle trekanter", derefter ✓. Kun det præcise sæt er rigtigt. | ja, hvis ≥5 ting, ≥2 mål og ≥2 ikke-mål | 5 |
| `fillSlots` | Række med k tomme felter og en palet med 3–4 tokens. Tryk på paletten fylder næste felt, tryk på et felt tømmer det, derefter ✓. | ja, hvis k ≥ 2 | 5 |
| `clockSet` | Analogt ur (260 pt). Minutviseren trækkes og snapper til skillens trin (60/30/15/5), og timeviseren følger med som et tandhjul. Træk i timeviseren springer hele timer. Start på 12:00, derefter ✓. | ja | 5 |
| `pay` | Butik: vare med pris (cifre og oplæsning). Pungen har én knap pr. tilladt mønt eller seddel med ubegrænset forråd. Tryk lægger i bakken, tryk i bakken tager tilbage. Der vises ingen løbende sum, derefter ✓. Svaret er bakkens sum i øre. | ja | 5 |
| `share` | N ting i en bunke og g dyr på en bænk. Tryk på et dyr, så hopper én ting over. ✓ når bunken er tom. Svaret er antallet pr. dyr hvis delingen er lige, ellers `-1` med tag `shareUnequal`. | ja | 5 |
| `buildBase` | Tre knapper (plade 100, stang 10, terning 1) og et arbejdsområde. Tryk på en brik fjerner den. Der veksles ikke automatisk, derefter ✓. | ja | 5 |
| `colorParts` | Figur delt i n dele. Tryk farver eller affarver en del, derefter ✓. Svaret er `${farvede}/${n}`. | ja | 5 |
| `grid` | `multi`: spejl mønsteret ved at trykke celler til. `single`: tryk punktet (x,y). Derefter ✓. | ja | 5 |
| `rulerDraw` | Lineal med et elastikbånd. Enden trækkes og snapper til hele cm, derefter ✓. | ja | 5 |

```ts
// src/engine/mastery.ts
export function isProduction(t: Task): boolean {
  switch (t.kind) {
    case 'choice': case 'pair': case 'trueFalse': return false
    case 'sortOrder':   return t.options.length >= 3
    case 'multiSelect': return t.options.length >= 5
    case 'fillSlots':   return countBlanks(t.prompt) >= 2
    default:            return true
  }
}
export function ceilingFor(t: Task): number {
  if (isProduction(t)) return 5
  return t.kind === 'trueFalse' || t.options.length === 2 ? 2 : 3
}
```

**Efter en fejl** (låst valg, generaliseret til alle kinds):
1. Barnets svar bliver stående, overstreget.
2. `StrategyHint` vises (visuelt og oplæst). Hvis der er en diagnosticeret fejltype, bruges den misforståelses-specifikke hint (afsnit 3.4).
3. Et bekræftelsestrin viser 2 kort: det rigtige svar og barnets svar, begge med `optionView`. Barnet skal trykke på det rigtige.

Bekræftelsen logges som `assisted` og ændrer ikke mestringen. For `clockSet` og `pay` viser kortene henholdsvis de to ure og de to møntbakker.

---

## 3. Diagnostik af misforståelser

### 3.1 Mekanik

```ts
// src/engine/misconceptions.ts
export type ErrorTag = MisconceptionId | 'near' | 'operand' | 'ambiguous' | 'other'
export interface Candidate { value: AnswerValue; tag: ErrorTag }

export function classifyError(def: SkillDef, fact: Fact, given: AnswerValue): ErrorTag {
  const hits = new Set(def.candidates(fact).filter(c => c.value === given).map(c => c.tag))
  hits.delete('near'); hits.delete('operand')
  if (hits.size === 1) return [...hits][0] as MisconceptionId
  if (hits.size > 1) return 'ambiguous'
  if (isNearMiss(fact, given)) return 'near'
  return globalChecks(fact, given) ?? 'other'   // digitSwap på alle tocifrede svar
}
```

- **Entydighedsreglen:** Hvis den samme værdi kan komme fra to misforståelser (for eksempel hvis `smallerFromLarger` og `borrowNoDecrement` giver samme tal), får den tagget `ambiguous` og tæller aldrig som bevis. Der er en test for alle facts.
- **Valgopgaver:** Der vises 3 kort: det rigtige svar, 1 diagnostisk distraktor og 1 `near` (±1 eller ±10). Den diagnostiske distraktor roterer til den relevante misforståelse, der sjældnest er blevet tilbudt denne profil. Det sikrer at hver misforståelse får muligheder for at vise sig.
- **Bevisvægt:** Produktion der rammer præcis misforståelsens værdi vejer 1,0. Valgopgaver vejer 0,5. `trueFalse` vejer 0,25.

### 3.2 Misforståelser (30) og hvordan de kodes

| MisconceptionId | Eksempel | Kandidatformel | Skills | Forældretekst (kort) |
|---|---|---|---|---|
| `digitSwap` | 53 → 35 | ciffer-omvendt af TE-delen | hear100, hear1000, tensOnes, placeValue1000, alle tocifrede keypad-svar med to forskellige cifre ≠0 | Bytter om på tiere og enere. Det er meget almindeligt på dansk, hvor vi siger enerne først. |
| `concatNumberWords` | "et hundrede og fire" → 1004 | `H·10^(d+2)+rest` | hear1000, placeValue1000 | Skriver talordene efter hinanden. |
| `zeroPlaceholder` | 304 → 34 eller 340 | nul droppet eller flyttet | hear1000, placeValue1000 `zeroPlace` | Glemmer nullet som pladsholder. |
| `faceValue` | 7-tallet i 472 → 7 | ciffer i stedet for værdi (og omvendt: tiere i 47 → 40) | placeValue1000 `digitValue`, tensOnes `decompose` | Blander cifret og det cifret er værd. |
| `addsPlaceParts` | 4 tiere og 7 enere → 11 | t+o (h+t+o) | tensOnes `build`, placeValue1000 | Lægger tierne og enerne sammen som tal. |
| `forgotCarry` | 38+45 → 73, 8+5 → 3 | kolonnesum mod 10 uden mente | addTo20, add100Carry, addSub1000Round, add1000 | Glemmer tieren der skal med. |
| `smallerFromLarger` | 53−27 → 34, 13−5 → 12 | pr. kolonne \|x−y\| | subTo20, sub100Borrow, sub1000 | Trækker det mindste ciffer fra det største i hver kolonne. |
| `borrowNoDecrement` | 53−27 → 36, 13−5 → 18 | låner, men tager ikke fra tierne | subTo20, sub100Borrow, sub1000 | Låner en tier, men glemmer at tage den fra. |
| `placeMisalign` | 38+5 → 88 | a + b·10 | add100NoCarry, add100Carry, add1000 `HTOplusO` | Lægger enerne til tierne. |
| `wrongOperation` | 9−3 → 12, 20−13 → 33 | modsat regneart (≥0) | alle regne-skills, change | Bruger den forkerte regneart, ofte efter mange ens opgaver. |
| `countFromFirst` | 5+3 → 7, 8−3 → 6 | plus: svar−1, minus: svar+1 | addTo10, subTo10, addTo20, subTo20 | Tæller startallet med. |
| `tableNeighbour` | 6·7 → 48/36/49/35 | (a±1)·b, a·(b±1), a², b² | mul*, div* (kvotient ±1) | Svarer med et tal fra nabotabellen. |
| `mulAsAdd` | 6·7 → 13 | a+b | mul*, groupsOf | Lægger sammen i stedet for at gange. |
| `equalsAsAnswer` | 8+4=□+5 → 12 eller 17; 3+□=7 → 10 | a+b; a+b+d | missingPart10/20, equalSides | Tror lighedstegnet betyder "nu kommer svaret". |
| `halfPastNext` | "halv tre" → 3:30 | svar+60 | clockHalf, clockFive `iHalv`/`overHalv` | Læser "halv tre" som "tre og en halv". |
| `quarterDirection` | kvart i tre ↔ kvart over tre | svar ±30 med skift af time | clockQuarter, clockFive | Blander "kvart over" og "kvart i". |
| `hourHandMisread` | 2:45 → 3:45 | time ±1, samme minutter | clockHalf, clockQuarter, clockFive (aflæsning) | Aflæser den lille viser forkert, når den er tæt på næste tal. |
| `handsSwapped` | 3:00 → 12:15 | viserne byttet | clockHour, clockHalf | Bytter om på den lille og den store viser. |
| `firstDigitCompare` | 69 > 102 | tallet med størst førsteciffer | order1000 `biggerMixed` | Sammenligner første ciffer i stedet for hele tallet. |
| `skipStepOne` | 5,10,15 → 16 | sidste+1 | skipCount | Fortsætter med 1 i stedet for springet. |
| `coinsAsCount` | 10+5+2 kr → 3 | antal mønter | countCoins | Tæller mønterne, ikke hvad de er værd. |
| `rulerEnd` | fra 2 til 9 → 9 eller 8 | slutmærke; længde+1 (tæller streger) | rulerRead `offset` | Aflæser hvor tingen slutter, ikke hvor lang den er. |
| `lengthByEnd` | forskudte ting | tingen der stikker længst ud | compareLength (`aligned:false`) | Ser kun på den ene ende. |
| `sizeIsWeight` | ballon vs sten | den største ting | weightCompare | Tror store ting altid er tungest. |
| `unequalParts` | to skæve dele = halve | "ja" på skæv deling | halfShape, fractionShape | Tror to dele altid er halve. |
| `biggerDenominator` | 1/8 > 1/4 | brøken med størst nævner | fractionCompare | Tror 1/8 er mere end 1/4, fordi 8 er større. |
| `denominatorAsAnswer` | ¼ af 12 → 4 | svar = nævner | fractionOfSet | Svarer med nævneren. |
| `prototypeOnly` | drejet kvadrat overses | udeladelser kun på varianter ≠ standard | shapes2D, sortShapes | Genkender kun figurer der står "pænt". |
| `areaAsPerimeter` | 3×4 → 14 | 2(a+b) | area | Tæller kanten i stedet for fladen. |
| `tensZero` | 3·40 → 12 eller 1200 | nul droppet eller ekstra nul | mulTens | Glemmer nullet (eller sætter et for meget). |

Hver misforståelse har desuden et felt `homeTip` til dashboardet. Et eksempel for `digitSwap`: *"Sig tallet og peg: fem-og-TREDIVE. Tredive er tierne, og de skrives først. Leg 'hvilket tal siger jeg?' med husnumre."*

### 3.3 Hvornår appen tør konkludere

Status pr. profil og misforståelse er `watching`, `flagged` eller `resolved`.

**Flag (vises for forælderen som "Vi har set tegn på …")** kræver alle fire betingelser i et vindue på 30 dage:
1. Vægtet bevis ≥ 3,0.
2. Beviset kommer fra ≥ 3 forskellige facts.
3. Beviset er fundet på ≥ 2 forskellige dage.
4. Bevisraten er ≥ 30 % af mulighederne. En mulighed er en opgave hvor misforståelsen kunne vise sig: den var tilbudt som distraktor, eller det var en produktionsopgave i en relevant skill.

Særregel for `countFromFirst`: bevis ≥ 4,0, og ≥ 70 % af barnets plus/minus-fejl i vinduet skal have den forventede retning (plus: −1, minus: +1). Det adskiller mønstret fra almindelige ±1-slip.

**Undertrykkelse:** Når barnets nøjagtighed på første forsøg i skillen er under 40 % over de sidste 20 svar, tæller valgopgave-bevis ikke. Barnet gætter, og tilfældige tryk er ikke en misforståelse.

**Løst:** Efter et flag kræves ≥ 6 nye muligheder, hvoraf ≥ 5 er besvaret rigtigt, og intet bevis i de sidste 6. Dashboardet viser så "ser ud til at være på plads" og sender eventet `misconceptionResolved`.

**Barnet ser aldrig et flag.** Flaget har tre virkninger:
- `hint()` vælger den misforståelses-specifikke forklaring, selv når den aktuelle fejl er `other`.
- roundBuilder lægger 1 målrettet opgave pr. tur (se 4.4).
- Dashboardet viser flaget.

### 3.4 Misforståelses-hints (eksempler)

- **`digitSwap`:** Multibase-billede af 53 (5 stænger og 3 terninger). Oplæst: "Vi siger tre-og-halvtreds, men vi skriver tierne først: fem tiere, tre enere."
- **`halfPastNext`:** Uret animerer fra 2:00 til 2:30. Oplæst: "Halv tre betyder: halvvejs hen mod tre. Den lille viser står midt mellem to og tre."
- **`equalsAsAnswer`:** Vippebrættet vipper til balance. Oplæst: "Lighedstegnet betyder: det samme på begge sider."

---

## 4. Adaptivitet og progression

### 4.1 Mestring: Leitner med beviskrav

| Boks | Betydning | Krav for at nå boksen (hurtigt + rigtigt) | Forælder-trin |
|---|---|---|---|
| 0 | ny eller lige glippet | – (stillads vises kun her) | Øver |
| 1 | mødt | rigtigt, stillads tilladt | Øver |
| 2 | genkender | rigtigt uden stillads | Kan med støtte |
| 3 | sikker med valg | rigtigt (valg eller produktion) | Kan med støtte |
| 4 | kan selv | **produktion**, og en **senere kalenderdag** end dagen boks 3 blev nået | Kan selv |
| 5 | automatiseret | **produktion** ≥ 3 dage efter at boks 4 blev nået | Kan selv |

Regler:
- En fejl giver −2 (som i V1).
- Et assisteret svar (bekræftelsestrinnet) ændrer ingenting.
- Guldægget ændrer kun noget ved rigtigt svar (V1).
- Der er ingen forfald ved fravær. En nøgle i boks 5 der ikke er set i 30 dage, er bare "due".

```ts
export interface KeyState {
  box: number; seen: number; correct: number
  lastRound: number; lastDay: string          // 'YYYY-MM-DD' lokal tid
  boxDay: string                              // dagen den nuværende boks blev nået
  avgMs: number
  recent: string[]                            // procedure: de sidste 5 rigtige instans-id'er
}
const DUE_ROUNDS = [0, 1, 2, 4, 8, 16]
const DUE_DAYS   = [0, 0, 0, 1, 3, 7]         // due når BEGGE er opfyldt
```

**Procedure-familier:** Promovering kræver en instans der ikke findes i `recent`. Barnet kan altså ikke "farme" 38+45. Instansen vælges seedet og undgår de sidste 10 instanser fra familien.

**Hastighed (`fastMs`):** Kravet er låst (langsomt-men-rigtigt giver ingen fremgang), så tærsklerne skal være fair:
- Uret starter ved `max(vist, oplæsning slut)`.
- Hver "Hør igen" lægger promptens varighed til.

| kind | fastMs |
|---|---|
| choice | 5.000 + 1.500 pr. ciffer over 1 |
| trueFalse | 5.000 |
| pair | 7.000 |
| keypad | 6.000 + 2.000 pr. ciffer over 1 |
| countTap | 2.000 + 700·n |
| numberline | 8.000 (0–20), 10.000 (0–100), 12.000 (0–1000) |
| sortOrder | 2.500 pr. kort |
| multiSelect | 2.000 pr. ting |
| fillSlots | 3.500 pr. felt |
| clockSet | 12.000 (hel, halv), 18.000 (kvart, 5 min) |
| pay | 5.000 + 2.500 pr. mønt i den optimale løsning |
| share | 3.000 + 800·N |
| buildBase | 4.000 + 1.200 pr. brik |
| colorParts | 3.000 + 1.000 pr. del |
| grid | 5.000 + 1.500 pr. celle (single: 8.000) |
| rulerDraw | 8.000 |

Familier kan overstyre tærsklen. For keypad gælder: `add100Carry`/`sub100Borrow` 15.000, `add1000`/`sub1000` 25.000, `mulTens` 10.000.

**Skill-status (dashboard og medaljer):**
- **Kan selv** (guld): ≥ 80 % af nøglerne i boks 4–5.
- **Kan med støtte** (bronze): ≥ 70 % af nøglerne i boks ≥ 2.
- **Sølv**: ≥ 50 % i boks 4–5.
- **Øver**: skillen er set mindst én gang.
- **Ikke startet**: 0 forsøg.

### 4.2 Indplacering ("Vis Pip hvad du kan")

Indplaceringen køres ved oprettelse af profilen og kan gentages fra dashboardet.
- Forælderen vælger klassetrin (0–3).
- Maks 18 opgaver, cirka 4 minutter.
- Kun produktions-kinds.
- Ingen rigtig/forkert-feedback (neutralt "Tak!"), ingen hints, ingen tidskrav.
- Svarene logges med `mode:'placement'` og tæller ikke med i nøjagtighedsstatistikken.

| Checkpoint | Skill | Kind | Starter her ved |
|---|---|---|---|
| L1 | count10 | countTap | 0. kl. |
| L2 | hear20 | keypad | |
| L3 | addTo10 | keypad | 1. kl. |
| L4 | subTo10 | keypad | |
| L5 | addTo20 | keypad | 2. kl. |
| L6 | subTo20 | keypad | |
| L7 | hear100 | keypad | 3. kl. |
| L8 | tensOnes | keypad | |
| L9 | add100Carry | keypad | |
| L10 | sub100Borrow | keypad | |
| L11 | hear1000 | keypad | |
| L12 | mul2510 | keypad | |
| L13 | add1000 | keypad | |
| L14 | mul6to9 | keypad | |

Algoritmen:
- Hvert checkpoint har 2 opgaver, og begge rigtige er bestået.
- **Springfase:** bestået giver i+2, ikke bestået giver i−1 og skift til trinfase.
- **Trinfase:** bestået giver i+1, ikke bestået stopper testen.
- Resultatet er P, det højeste beståede checkpoint.

Seeding efter testen:
- Alle kerne-skills (number, place, addsub, muldiv) med `stage ≤ stage(P)` får alle nøgler sat til boks 3 med `boxDay = i dag`. Næste møde bliver dermed en produktionsopgave, og boks 4 tidligst i morgen.
- Hvis seedingen var for høj, retter −2 ved fejl det inden for 1–2 ture.
- Verdener hvor alle kerne-skills har stage < stage(P), åbnes.
- Anvendelsesdomænerne (klokken, penge, figurer, måling, brøker) seedes ikke. Deres regioner for klassetrin under barnets åbnes, så barnet kan tage mesterprøven og springe over.

### 4.3 Verdener og regioner (4 × 28 regioner)

Hver region har 4–7 noder:
- intro-noder pr. skill med `rankMax` (valg-tunge),
- en "skriv selv"-node (produktion),
- en blandingsnode (70 % regionens skills, 30 % review fra tidligere),
- en mesterprøve.

I alt cirka 155 noder og 28 mesterprøver. Arbejdstitlerne på verdenerne kan omdøbes af art og spil.

| Verden | Region-id | Skills |
|---|---|---|
| **0 (0. kl.)** | `w0-tal10` | count10, hear20 (≤10), order20 (≤10) |
| | `w0-tal20` | count20, hear20, order20 |
| | `w0-plus10` | addTo10 |
| | `w0-minus10` | subTo10 (+ blandet med addTo10) |
| | `w0-former` | shapes2D `basic`, patterns, compareLength |
| | `w0-tiervenner` | tenFriends |
| **1 (1. kl.)** | `w1-tal100` | hear100, tensOnes, order100, numberLine100 |
| | `w1-dobbelt` | doubles, halves, skipCount (2, 5, 10) |
| | `w1-tieren` | addSub20Simple, addTo20, subTo20, missingPart10 |
| | `w1-tiere` | tens100, add100NoCarry, sub100NoBorrow |
| | `w1-figurer` | shapes2D `polygons`, sidesCorners, shapes3D `names`, sortShapes, symmetry `isSymLine`, halfShape |
| | `w1-klokken` | clockHour, clockHalf |
| | `w1-maal-penge` | measureUnits, rulerRead (`from0`, `draw`), weightCompare, coinNames, countCoins (≤20) |
| **2 (2. kl.)** | `w2-tal1000` | hear1000, placeValue1000, order1000, numberLine1000 (placering) |
| | `w2-veksling` | add100Carry, sub100Borrow, missingPart20, inverseOps (+/−) |
| | `w2-hundreder` | addSub1000Round, skipCount `step100`, equalSides |
| | `w2-gange` | groupsOf, mul2510, shareEqually |
| | `w2-klokken` | clockQuarter |
| | `w2-penge` | countCoins (≤100), payExact, change (10/20/50) |
| | `w2-maal-data` | rulerRead `offset`, unitChoice (længde), readChart |
| | `w2-figurer-broeker` | composeShapes, symmetry `mirrorGrid`, shapes3D `props`, sortShapes `fourEqualSides`, fractionShape |
| **3 (3. kl.)** | `w3-store-tal` | add1000, sub1000, numberLine1000 (afrunding), placeValue1000 `regroup` |
| | `w3-tabellen` | mul34, mul6to9, mulTens |
| | `w3-division` | div2510, divAll, inverseOps `mulToDiv` |
| | `w3-klokken` | clockFive, clockDigital, clockElapsed |
| | `w3-penge-maal` | change `from100`, kronerOre, convertCmM, unitChoice (vægt), payExact `fewestCoins` |
| | `w3-areal-koordinater` | area, gridCoords, sortShapes `rightAngle`, skipCount `step25` |
| | `w3-broeker` | fractionOfSet, fractionCompare, fractionShape (3/4, 2/3), equalSides `balanceSub`/`balanceMixed` |

**Oplåsning (ingen hård mestringsmur, som i V1):**
- **Node til node:** forrige node spillet én gang.
- **Regioner:** De 2 første regioner i en verden er åbne fra starten. De øvrige åbner når en hvilken som helst region i samme verden har ≥ 4 spillede noder. Barnet har dermed altid mindst 2 valg.
- **Hårde forudsætninger:** `w1-tiere` kræver ≥ 3 noder i `w1-tal100`, `w2-hundreder` kræver ≥ 3 i `w2-tal1000`, og `w3-division` kræver ≥ 3 i `w3-tabellen`.
- **Næste verden** åbner når alle noder i den nuværende verden er spillet én gang, eller når ≥ 60 % af verdenens mesterprøver er bestået. Forælder og indplacering kan også åbne verdener.

### 4.4 Tursammensætning V2 (10 opgaver)

| Plads | Antal | Kilde |
|---|---|---|
| Åbner | 1 | sikker nøgle (boks ≥ 3) fra nodens skills |
| Vaklende | 5 | boks 1–3 fra nodens skills, "due" først |
| Nye | 2 | usete nøgler i rank-rækkefølge |
| Review | 1 | "due" nøgle (boks ≥ 3) fra **en hvilken som helst** oplåst skill uden for noden (spacing på tværs af pensum) |
| Målrettet | 1 | opgave der kan fremkalde en flagget misforståelse; ellers vaklende |

Ordningsregler:
- Samme nøgle kommer aldrig to gange i træk.
- Højst 3 opgaver i træk med samme regneart i blandede noder (modvirker `wrongOperation`).
- Nye opgaver ligger aldrig sidst. Sidste opgave er den næstsikreste nøgle, så turen slutter med et sandsynligt succesøjeblik.
- V1's `balanceAnswerPositions` beholdes.

**Loft over nyt stof:** højst 8 nye nøgler pr. skill og 20 i alt pr. dag. Så længe barnet vil spille, skifter lange sessioner mod konsolidering og andre skills i stedet for mere nyt stof.

**Træthed:** Hvis nøjagtigheden på første forsøg over de sidste 10 svar er under 50 %, bliver næste tur 4 sikre, 5 vaklende, 1 ny og ingen review. Der kommer intet pauseforslag (låst valg). Efter en tur med 10/10 hurtige svar bliver næste tur 1 sikker, 4 vaklende, 4 nye og 1 review.

**Lyd slået fra:** `hear*`-familier udelades, og dashboardet markerer dem "kræver lyd".

### 4.5 Mesterprøver

- 10 opgaver, stratificeret jævnt over regionens skills og familier.
- **Kun produktions-kinds**, intet stillads, ingen genindsættelse ved fejl. Strategi og bekræftelse vises stadig efter fejl (låst valg).
- Bestået ved ≥ 8/10. Tempo tæller ikke med i bestået/ikke bestået, men svarene opdaterer mestring normalt.
- Prøven kan tages når som helst fra regionens start ("Spring over"). Bestås den, markeres regionens noder som spillet.
- Genforsøg kræver mindst én almindelig tur siden sidste forsøg. Efter et nederlag foreslås en øvetur med de missede familier.
- Events til spillaget: `trialPassed {region, score}`. 10/10 giver "perfekt".

### 4.6 Læringsevents til spillaget

```ts
type LearningEvent =
  | { t: 'keyPromoted'; key: string; skill: SkillId; box: number }
  | { t: 'skillStatus'; skill: SkillId; status: 'support' | 'silver' | 'independent' }
  | { t: 'trialPassed'; region: RegionId; score: number }
  | { t: 'familyFirstCorrect'; skill: SkillId; family: string }
  | { t: 'misconceptionResolved'; id: MisconceptionId }
```

Pædagogiske krav til spillaget:
1. Eksklusive præmier låses kun op af `skillStatus: independent` og `trialPassed`.
2. Intet der er optjent, kan tabes.
3. Hver tur afsluttes med informativ feedback, "Det lærte du", der viser konkrete nøgler der rykkede sig ("8+5 sidder fast nu!"), og ét næste mål ("2 mere til guld i 5-tabellen"). Informativ feedback fremmer indre motivation. Forventede, konkrete belønninger kan undergrave den.

---

## 5. Forældre-dashboard

### 5.1 Visninger

1. **Profilvælger:** op til 6 profiler, hver med ansigt og navn.
2. **Overblik (14 dage):**
   - læringstid pr. dag (søjler) og legetid med dyrene adskilt, uden vurdering,
   - aktive dage (prikkalender),
   - opgaver i alt,
   - nøjagtighed på første forsøg,
   - nuværende verden og region.
3. **Pensumkort:** gitter med domæner som rækker og klassetrin 0–3 som kolonner. Hver skill er en prik: grå = ikke startet, gul = øver, blå = kan med støtte, grøn = kan selv. Det er "skole-look" uden at være en karakterbog.
4. **Domænekort (10), hvert med:**
   - statusfordeling af skills,
   - domænescore 0–100 (gennemsnit af skill-score = middelboks/5),
   - tendenspil: domænescore nu mod for 14 dage siden, op ved ≥ +5, ned ved ≤ −5,
   - sparkline over 12 uger,
   - nøjagtighed i 14 dage,
   - median svartid på produktionsopgaver nu mod for 14 dage siden ("hurtigere end for to uger siden"),
   - tid brugt.
5. **Skill-rækker (foldes ud):**
   - statusbadge,
   - bjælke for andel i boks 4–5 med markering ved 80 %,
   - "sidst øvet",
   - nøjagtighed og median svartid,
   - "rigtigt men langsomt"-andel (kompenserer for det låste tempokrav),
   - familie-opdeling ("38+45-typen: øver").
6. **Tabelgitter 10×10:** hvert produkt farvet efter boks.
7. **Misforståelser:** aktive flag med forældretekst og `homeTip`, derunder "løst for nylig".
8. **Anbefalinger:** højst 3 (se 5.2).
9. **Niveauestimat** med forklaring (se 5.3).
10. **Seneste ture:** node, resultat og hvad der rykkede sig.
11. **Indstillinger:** åbn verdener, indplacering igen, lyd/oplæsning/effekter, eksport/import pr. profil, slet profil.

**Voksen-gate:** skift fra V1's 6–9 × 7–9 til 2-cifret × 1-cifret (12–19 × 6–9). V1-gaten ligger inden for 3.-klasses pensum i V2.

### 5.2 Anbefalingsregler (prioriteret, højst 3)

| Prio | Regel | Tekstskabelon |
|---|---|---|
| R1 | aktivt misforståelses-flag (højst 1) | "Vi har set tegn på: {forældretekst}. Prøv: {homeTip}" |
| R2 | skill med nøjagtighed ≥ 85 % men < 40 % hurtige svar (14 dage, ≥ 20 svar) | "{navn} regner {label} rigtigt, men tæller sig frem. Øv hurtige svar i små bidder." |
| R3 | plateau: ≥ 30 forsøg i 14 dage, ingen promovering i 7 dage, nøjagtighed < 70 %. For gange vælges tabellen med lavest middelboks blandt de startede | "Øv {7}-tabellen, fx ved at tælle i spring på 7 i bilen." |
| R4 | glemt: ≥ 3 nøgler faldet fra ≥ 4 til ≤ 2 inden for 14 dage | "Genopfrisk {label}." |
| R5 | ≥ 70 % i boks 2–3, men < 30 % i boks ≥ 4 og ingen produktion i 7 dage | "{label}: kan med støtte. Spil {region}, så beder appen {navn} skrive svarene selv." |
| R6 | næste oplåste region uden forsøg, hvor forudsætningerne er "kan selv" | "Klar til: {regionName}." |

Der skrives cirka 30 kuraterede `homeTip`s pr. domæne og misforståelse i `src/parent/tips.ts`.

### 5.3 Forsigtigt niveauestimat

- Kun kerne-skills tæller (number, place, addsub, muldiv; 36 skills). level: 0 = øver eller ikke startet, 1 = støtte, 2 = selv.
- `est` er det største `stage` s, hvor der blandt kerne-skills med `stage ≤ s` gælder: andel med level ≥ 1 er ≥ 0,8, og andel med level = 2 er ≥ 0,5.
- Teksten afhænger af brøkdelen af `est` ud over hele klassetrin g:
  - under ,34: "starten af g. klasse",
  - under ,67: "midten af",
  - ellers "slutningen af".
- Estimatet vises kun ved ≥ 150 svar og ≥ 5 aktive dage. Ellers vises "Vi ved endnu for lidt."
- Teksten lyder altid "Svarer cirka til …" plus barnets klassetrin som oplysning, uden rød/grøn vurdering.
- Skills der er seedet af indplaceringen, tæller som støtte indtil de er bekræftet.
- Anvendelsesdomænerne vises kun på pensumkortet.

### 5.4 Datamodel (IndexedDB `talvennerne2`, Dexie)

```ts
// src/data/db.ts
db.version(1).stores({
  profiles:       'id',
  answers:        '++seq, [profileId+ts], [profileId+skill+ts]',
  daily:          '[profileId+day], profileId',
  misconceptions: '[profileId+id], profileId',
  meta:           'key',
})

export interface ProfileCore {                // læringsdelen; spillaget tilføjer dyr, garderobe m.m.
  id: string; version: number; name: string; grade: 0 | 1 | 2 | 3; createdAt: number
  placement: { done: boolean; at: number; highest: string | null }
  keys: Record<string, KeyState>              // masteryKey → state (~970)
  nodes: Record<NodeId, { plays: number; lastAt: number }>
  trials: Record<RegionId, { attempts: number; best: number; passedAt: number | null; lastAttemptRound: number }>
  unlocked: { worlds: number[]; regions: RegionId[] }   // forælder/indplacering
  roundIndex: number
  newToday: { day: string; perSkill: Record<SkillId, number> }
  offeredTags: Record<MisconceptionId, number>          // rotation af diagnostiske distraktorer
  pausedRound: PausedRound | null
}

export interface AnswerLogEntry {
  seq?: number; profileId: string
  ts: number; day: string; sessionId: string; roundId: string; nodeId: string
  mode: 'round' | 'trial' | 'placement' | 'golden' | 'review'
  skill: SkillId; family: string; factId: string; masteryKey: string
  kind: TaskKind; optionsCount: number; production: boolean
  given: AnswerValue; answer: AnswerValue; correct: boolean
  ms: number                          // fra max(vist, oplæsning slut), loft 120.000
  fast: boolean
  errorTag: ErrorTag | null
  detectable: MisconceptionId[]       // hvilke misforståelser opgaven kunne afsløre (muligheder)
  boxBefore: number; boxAfter: number
  scaffold: boolean; replays: number
}

export interface DailyAggregate {
  profileId: string; day: string
  learnMs: number                     // sum af rundetid mellem første og sidste input, gab > 90 s fratrukket
  playMs: number                      // tid i dyr/garderobe (meldes af UI)
  sessions: number; rounds: number; answers: number; firstTryCorrect: number
  bySkill: Record<SkillId, {
    n: number; correct: number; fast: number; nProd: number
    msHist: [number, number, number, number, number, number, number]  // <2,<4,<7,<12,<20,<35,≥35 s (produktion)
    errors: Partial<Record<MisconceptionId, number>>
  }>
  snapshot: Record<SkillId, { meanBox: number; share2: number; share4: number }>  // ved dagens sidste tur
  trialsPassed: RegionId[]
}

export interface MisconceptionState {
  profileId: string; id: MisconceptionId
  status: 'watching' | 'flagged' | 'resolved'
  evidence: { ts: number; day: string; factId: string; w: number }[]   // seneste 20
  flaggedAt: number | null; resolvedAt: number | null
  sinceFlag: { opportunities: number; correct: number; evidence: number }
}
```

**Opdatering:** ingen baggrundsjob, fordi PWA'er ikke kører i baggrunden.
- Hvert svar skrives til `answers` med det samme.
- Ved turens slut opdateres `daily` (inkrementelt), `misconceptions` (evaluering efter 3.3) og `profiles`. Det sker i én Dexie-transaktion.
- Medianer tilnærmes fra `msHist`, som kan lægges sammen på tværs af dage.

**Opbevaring:**
- `answers` gemmes i 90 dage og højst 20.000 rækker pr. profil. Beskæring sker ved app-start. Det svarer til cirka 250 B pr. række, altså ≤ 5 MB pr. profil.
- `daily` gemmes i 3 år (cirka 1 KB pr. dag).
- `misconceptions` og `profiles` gemmes permanent.
- "Slet profil" sletter alle rækker med `profileId`.
- `navigator.storage.persist()` kaldes ved første profil.
- Eksport pr. profil: ProfileCore + daily + misconceptions + de sidste 30 dages answers som JSON. Importen validerer `version`.

**Delt origin:**
- Kun navnene `talvennerne2` (IndexedDB) og `talvennerne2.*` (localStorage) bruges.
- Koden kalder aldrig `localStorage.clear()`, rører aldrig andre databaser og registrerer ingen service worker.

**Dashboard-beregning:** rene funktioner i `src/parent/metrics.ts`, `recommend.ts` og `gradeEstimate.ts` over (ProfileCore, DailyAggregate[], MisconceptionState[], seneste answers) til en view model. De testes med fixtures.

---

## 6. Oplæsning

### 6.1 Normaliseringsregler (`src/speech/normalize.ts`)

**Talord:**
- 0–20: nul, en, to, tre, fire, fem, seks, syv, otte, ni, ti, elleve, tolv, tretten, fjorten, femten, seksten, sytten, atten, nitten, tyve.
- Tiere: 30 tredive, 40 fyrre, 50 halvtreds, 60 tres, 70 halvfjerds, 80 firs, 90 halvfems.
- 21–99 er ét ord med ener + "og" + tier: enogtyve, femogfyrre, nioghalvfems. 1 i sammensætninger er "en".
- 100–999: "[et|to|…|ni] hundrede", og "og" står kun foran den sidste gruppe: 105 "et hundrede og fem", 220 "to hundrede og tyve", 999 "ni hundrede og nioghalvfems".
- 1000 hedder "tusind".

**Køn:** Talt alene og i regnestykker hedder 1 "en". Foran intetkønsord hedder det "et": "et hundrede", "et gram", "et kilogram". "En" bruges i "en krone", "en tier", "en ener", "en centimeter", "en meter".

**Regnetegn:**

| Tegn | Oplæses |
|---|---|
| + | plus |
| − | minus |
| · | gange |
| : | divideret med |
| < | mindre end |
| > | større end |

For `=` gælder:
- Spørgsmål med resultatet til højre: "Hvad er a plus b?" (= læses ikke).
- Manglende led i 0.–1. kl.: "a plus hvad giver c?".
- Balance- og sandt/falsk-opgaver: "er lig med". Skillens intro forklarer "Lighedstegnet betyder: det samme på begge sider."

**Klokken** (H = time 1–12, H+1 går rundt fra 12 til 1; 1 hedder "et"):

| Tid | Frase |
|---|---|
| :00 | [H] |
| :05 | fem minutter over [H] |
| :10 | ti minutter over [H] |
| :15 | kvart over [H] |
| :20 | tyve minutter over [H] |
| :25 | fem minutter i halv [H+1] |
| :30 | halv [H+1] |
| :35 | fem minutter over halv [H+1] |
| :40 | tyve minutter i [H+1] |
| :45 | kvart i [H+1] |
| :50 | ti minutter i [H+1] |
| :55 | fem minutter i [H+1] |

- Digitalt: "fjorten tredive". Enkeltcifrede minutter læses "fjorten nul fem".
- Dagtid: 5–11 "om morgenen", 12–17 "om eftermiddagen", 18–23 "om aftenen".
- Skærmen viser "14:30" på urdisplay og "kl. 14.30" i tekst.

**Penge:**
- Øre omskrives: 1250 → "tolv kroner og halvtreds øre", 100 → "en krone", 50 → "halvtreds øre", 10000 → "et hundrede kroner".
- Skærmen viser "12,50 kr." (komma).
- Mønt- og seddelnavne, ubestemt/bestemt form: halvtredsøre(n), enkrone(n), tokrone(n), femkrone(n), tikrone(n), tyvekrone(n), halvtredskroneseddel(en), hundredkroneseddel(en), tohundredkroneseddel(en), femhundredkroneseddel(en).

**Måling og brøker:**
- Enheder: centimeter, meter, gram, kilogram.
- Brøker: en halv, en tredjedel, en fjerdedel, to tredjedele, tre fjerdedele, en femtedel, en sjettedel, en ottendedel.

**Cifferord:** nullet, ettallet, totallet, tretallet, firetallet, femtallet, sekstallet, syvtallet, ottetallet, nitallet.

**Reservestemme:** `speechSynthesis` bruges nu med **ord** (normaliseret tekst) i stedet for cifre, som i V1. Den bruges til fritekst (navne barnet skriver) og hvis et klip mangler.

### 6.2 Klip-inventar

**Form-konvention:**
- Hvert klip genereres i én af to former: `mid` (tekst efterfulgt af ",", fortsættende intonation) eller `end` (tekst efterfulgt af ".", afsluttende intonation).
- Klippene trimmes ved −45 dBFS med 15 ms fade og normaliseres til −18 LUFS.

| Gruppe | Id-mønster | Antal | Snit | Varighed |
|---|---|---|---|---|
| Tal 0–100 | `n.mid.N`, `n.end.N` | 202 | 0,75 s | 2,5 min |
| "et" som intetkøn | `n.mid.1.et`, `n.end.1.et` | 2 | 0,4 s | – |
| Hundreder alene | `h.mid.H`, `h.end.H` (H=1–9) | 18 | 0,8 s | 0,2 min |
| Hundreder med "og" | `hog.H` ("to hundrede og") | 9 | 0,9 s | 0,1 min |
| Tusind | `n.mid.1000`, `n.end.1000` | 2 | 0,5 s | – |
| Tidsfraser (alle 5-min × 12 timer) | `t.end.M` (M = minutter) | 144 | 1,2 s | 2,9 min |
| Dagtid og digitale led | `t.part.*` | 6 | 0,9 s | 0,1 min |
| Regnetegn og forbindere | `op.*`, `frag.*` ("hvad er", "plus", "giver", "er lig med", "og", "tiere og", "enere", "kroner og", "øre", …) | cirka 180 | 0,6 s | 1,8 min |
| Katalognavneord | figurer 14 × {ubest., best., flertal} = 42, mønter 10 × 2 = 20, varer 14 × 2 = 28, måleting 16, dyrearter 16 × {ental, flertal} = 32, enheder 8, brøker 8, cifferord 10, datasætkategorier 20 | cirka 184 | 0,8 s | 2,5 min |
| Faste sætninger | se nedenfor | cirka 380 | 2,0 s | 12,7 min |
| Hint-skabelonled | `hint.*` (V1-strategisætninger opdelt i led, cirka 60 skabeloner) | cirka 100 | 1,2 s | 2,0 min |
| **I alt** | | **cirka 1.230** | | **cirka 25 min, cirka 4,5 MB ved 24 kbps mono** |

**Faste sætninger (cirka 380):**

| Kategori | Antal |
|---|---|
| kind-instruktioner (16 × lang og kort) | 32 |
| skill-intros (én pr. skill) | 72 |
| ros (generel 20, produktion 8 som "Du skrev det helt selv!", stime 6, prøve 6) | 40 |
| støtte efter fejl ("Lad os se på det sammen." og "Tryk på det rigtige svar.") | 18 |
| misforståelses-hints | 30 |
| indplacering | 20 |
| mesterprøve | 15 |
| verden- og region-intros | 32 |
| dyr- og garderobereplikker (reserveret til spillaget) | 60 |
| UI-labels til oplæsning | 40 |
| onboarding og profil | 20 |

**Sammensætning** (`src/speech/compose.ts`):
- `SpeechScript = { clips: ClipId[]; text: string }`.
- Tal 101–999 bygges som `n % 100 === 0 ? h.{form}.H : hog.H + n.{form}.(n % 100)`.
- Mellemrum: 0 ms mellem led i en frase, 120 ms efter komma, 250 ms efter punktum.
- Afspilning sker med Web Audio (planlagt gapless).

| Opgave | Klip | Tekst | cirka |
|---|---|---|---|
| add100Carry 38+45, keypad | `frag.hvad_er`, `n.mid.38`, `op.plus`, `n.end.45` | "Hvad er otteogtredive plus femogfyrre?" | 2,6 s |
| hear1000 304 | `frag.find_tallet`, `hog.3`, `n.end.4` | "Find tallet tre hundrede og fire." | 2,0 s |
| clockSet 2:25 | `frag.stil_uret_saa_klokken_er`, `t.end.145` | "Stil uret, så klokken er fem minutter i halv tre." | 3,0 s |
| change 13 kr / 20 kr | `item.def.is`, `frag.koster`, `n.mid.13`, `u.kroner.end`, `frag.du_betaler_med`, `coin.indef.2000.end`, `sent.hvor_meget_tilbage` | "Isen koster tretten kroner. Du betaler med en tyvekrone. Hvor mange penge får du tilbage?" | 5,5 s |

**Pakker (lazy-load):**
- `core` (< 1 MB): tal 0–20, forbindere, faste UI-sætninger og ros. Hentes ved start.
- `n100`, `n1000`, `clock`, `money`, `shapes`, `measure`, `fractions`, `story`, `hints` hentes ved node-start for regioner der bruger dem.
- Hvis et klip ikke er dekodet inden for 300 ms, læses **hele** udsagnet med `speechSynthesis`. Stemmer blandes aldrig i samme sætning.

**Stemme og generering:**
- Motor: CoRal `roest-v3-chatterbox-500m` (bedst målte danske MOS, OpenRAIL), én stemme i hele appen.
- Tempo cirka 0,9. Varm, børnerettet oplæsning.
- `scripts/tts/inventory.ts` importerer `normalize.ts` og alle `SkillDef.speech` og udskriver `manifest.json` (`{id, text, pack}`). Dækning er dermed garanteret.
- `scripts/tts/generate.py` renderer, og `scripts/tts/verify_asr.py` kontrollerer med faster-whisper large-v3 (`language='da'`).

---

## 7. Risici

1. "Så længe barnet vil" uden pauseforslag går imod ICO std. 5 og DSA-vejledningen om forlængelsesmekanik. Designet kompenserer ved at lange sessioner bliver lettere og mere konsoliderende, ikke mere belønnende (lofter over nyt stof, træthedsjustering, ingen tidsbestemte belønninger).
2. Tempokravet (langsomt-men-rigtigt giver ingen fremgang) kan fastlåse langsomme eller ængstelige regnere. Derfor vises "rigtigt men langsomt" separat, R2 har højeste ikke-diagnostiske prioritet, og alle tærskler starter ved oplæsningens slut.
3. 72 skills og 16 kinds er meget. Byg i tre bølger (0.–1. kl. med figurer, så 2. kl., så 3. kl.), men lav svarmodel, datamodel, SkillDef-register og taleinventar komplet i bølge 1.
4. Sammensat tale kan lyde hakket i regnestykker. Lyttetest-kravet i afsnit 8 er porten.
5. "Kan selv" kræver en anden dag, så efter dag 1 står intet som "kan selv". Dashboardet skal forklare det med én linje.
6. Søskende kan spille på hinandens profil og forurene dashboardet. Profilvalg med ansigt og navn ved hver app-start afbøder det.
7. Mønter og sedler tegnes stiliserede (egne SVG'er, ikke fotorealistiske), så de ikke kan forveksles med Nationalbankens design.

---

## 8. Acceptkriterier

**Engine (vitest):**
- Et uafhængigt `expectedAnswer` for alle 72 skills matcher hvert fact (recall) og 200 seedede instanser pr. familie (procedure).
- Fact-id'er er unikke pr. (skill, operands).
- Hver skill har mindst én kind hvor `isProduction` er sand, og alle skills kan nå boks 5 i en simuleret profil over 10 dage.
- `ceilingFor` giver 2 for trueFalse og 2-korts choice, 3 for choice og pair, og 5 for produktion.
- Boks 4 kan ikke nås samme dag som boks 3 blev nået. Boks 5 kræver ≥ 3 dage.
- En procedure-familie promoveres ikke på en instans der findes i `recent`.
- For alle facts og instanser gælder:
  - distraktorer er unikke, ≠ svaret, ≥ 0 og inden for `range`,
  - en diagnostisk værdi med to tags bliver `ambiguous`,
  - `classifyError(candidate.value)` giver præcis `candidate.tag`.
- roundBuilder (1.000 seeds):
  - åbneren er sikker hvis det er muligt,
  - ingen samme nøgle i træk,
  - ≤ 3 i træk med samme regneart i blandede noder,
  - sidste opgave er ikke ny,
  - review-pladsen kommer fra en anden skill når der findes en "due" nøgle.
- Indplacering: ≤ 18 opgaver for alle 2^18 svarmønstre, og kun produktions-kinds.
- Mesterprøve: 10 opgaver, kun produktion, dækker alle regionens skills.
- Misforståelsesregler: fixtures med 1 session (aldrig flag), 3 facts på 2 dage med rate ≥ 30 % (flag) og 50 % tilfældige ±1-fejl (aldrig `countFromFirst`).

**Tale:**
- `numberWords` for 0–1000 matcher en håndskrevet tabel for 0–100 og 60 udvalgte værdier (101, 104, 110, 111, 120, 199, 200, 305, 340, 999, 1000, …).
- `timePhrase` er rigtig for alle 144 værdier.
- `moneyPhrase` er rigtig for 40 udvalgte beløb.
- Dækning: `speech()` for alle recall-facts og 50 instanser pr. familie × alle kinds giver kun klip-id'er der findes i manifestet.
- ASR-kontrol:
  - 100 % ordret match for tal-, tids- og beløbsklip,
  - WER ≤ 10 % for faste sætninger,
  - 300 tilfældige sammensatte prompts renderet offline giver ≥ 97 % ordret match,
  - brugeren lytter til 20 sammensatte regnestykker og vurderer dem acceptable.

**Data og dashboard:**
- Beskæring holder 90 dage og ≤ 20.000 rækker pr. profil.
- "Slet profil" efterlader 0 rækker.
- Eksport → import giver en identisk view model.
- Metrics-, recommend- og gradeEstimate-fixtures giver deterministiske tekster.
- Estimatet skjules under 150 svar eller under 5 aktive dage.
- Ingen nøgler uden for `talvennerne2*` bliver skrevet (Playwright-tjek af `localStorage` og `indexedDB.databases()` før og efter en gennemspilning).

---

## 9. Filstruktur (V2-rod)

```
src/engine/types.ts            AnswerValue, Task, Prompt, TaskKind, Term
src/engine/answer.ts           isCorrect
src/engine/mastery.ts          KeyState, updateKey, isProduction, ceilingFor, isDue, skillStatus
src/engine/misconceptions.ts   MisconceptionId, classifyError, evaluate (flag/løst)
src/engine/roundBuilder.ts     V2-slots, interleaving, lofter, træthed
src/engine/placement.ts        stigen L1–L14, spring- og trinfase, seeding
src/engine/trial.ts            mesterprøve
src/engine/skills/{number,place,addsub,muldiv,algebra,shapes,clock,money,measure,fractions}.ts
src/engine/skills/index.ts     SKILLS-register (Map<SkillId, SkillDef>)
src/content/curriculum.ts      DOMAINS, WORLDS, REGIONS, NODES, oplåsningsregler
src/speech/normalize.ts        numberWords, timePhrase, moneyPhrase, fractionPhrase
src/speech/compose.ts          SpeechScript-byggere
src/speech/player.ts           Web Audio-sammensætning, pakker, reserve til speechSynthesis
src/data/db.ts · log.ts · aggregate.ts · export.ts
src/parent/metrics.ts · recommend.ts · gradeEstimate.ts · tips.ts
scripts/tts/inventory.ts · generate.py · verify_asr.py
```

### Kritiske filer for implementeringen

V1-filer der generaliseres:
- /home/user/Test/src/engine/types.ts: V1's `answer: number` og `a/b`-model skal erstattes af `AnswerValue`, `Prompt` og `operands`.
- /home/user/Test/src/engine/mastery.ts: Leitner-kernen, der skal have `isProduction(task)`, dagsbaseret beviskrav og familienøgler.
- /home/user/Test/src/engine/roundBuilder.ts: slot-logikken, der udvides med review, målrettet opgave, interleaving og lofter.
- /home/user/Test/src/engine/distractors.ts: bliver til mærkede `candidates()` pr. SkillDef plus `classifyError`.
- /home/user/Test/src/audio/speech.ts: bliver til reservestemme, mens hovedvejen er ny: `src/speech/normalize.ts` og `src/speech/player.ts`.
