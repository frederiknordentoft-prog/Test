# Blackjack

Et komplet online blackjack-spil bygget som ren UI/spil-demo i én HTML-fil. Ingen billeder, ingen fonte, ingen biblioteker: kort, jetoner, bord og lyd er genereret i kode.

**Spil:** åbn `index.html` i en browser. Det er det hele.

## Design

Tænkt som Apple ville lave det, hvis det lå på apple.com:

- Space-black bord med ét blødt lys, hvide kort med rigtig vægt (lagdelte skygger), frosted-glass paneler.
- Systemfonten (SF Pro på Apple-enheder), tabular-nums på alle beløb, én accentfarve.
- Proceduralt genererede kort i SVG: standard pip-layouts, monogram-billedkort, grafit-bagside.
- Lyd syntetiseret i Web Audio: papir, glas og tre toner ved gevinst. Ingen samples.
- Lys og mørk tilstand, dansk og engelsk, hurtigt tempo, valgfrit strategi-hint, reduceret bevægelse respekteres.
- 18+ · Spil ansvarligt · StopSpillet · ROFUS · klokkeslæt vises som på et dansk licenseret casino.

## Regler

| | |
|---|---|
| Kortspil | 6, blandes ved 75 % af skoen (cut card) |
| Dealer | Står på alle 17 (S17), kigger efter blackjack ved es og 10 |
| Blackjack | Betaler 3:2 |
| Forsikring | 2:1, tilbydes ved es; even money ved egen blackjack |
| Fordobling | På alle to kort, også efter split |
| Split | Op til 4 hænder, 10-kort af forskellig rang må splittes |
| Splittede esser | Ét kort pr. es, ingen re-split, A+10 er 21 (ikke blackjack) |
| Overgivelse | Sen, kun på de første to kort |
| Indsats | 10 – 5.000 kr. · jetoner 10/25/50/100/500/1000 |
| Saldo | 10.000 kr. demo. Ingen rigtige penge. |

Tastatur: mellemrum/enter = giv kort / gentag, `H` kort, `S` stå, `D` fordobl, `P` split, `R` overgiv, `Y`/`N` forsikring, `1`–`6` jetoner, `Esc` luk.

## Kode

```
blackjack/
  index.html          ← den færdige, selvstændige fil (bygget)
  src/engine.js       ← rene regler, deterministisk, event-baseret (Node + browser)
  src/cards.js        ← procedural SVG-kortgenerator
  src/audio.js        ← Web Audio-lydkit
  src/app.js          ← UI-controller: afspiller engine-events som animation
  src/styles.css      ← designsystem (tokens, materialer, motion, responsivt)
  src/template.html   ← DOM-skelet
  build.mjs           ← inliner src/* til index.html (ingen dependencies)
  tests/engine.test.mjs  ← 36 regeltests (node --test)
  tests/ui.test.mjs      ← end-to-end tests i Chromium (Playwright)
```

Byg og test:

```
node build.mjs
node --test tests/engine.test.mjs
node tests/ui.test.mjs
```

Motoren er adskilt fra præsentationen: `Game` returnerer en ordnet liste af events for hver handling (`deal`, `card`, `peek`, `reveal`, `settle` …), og UI'et afspiller dem med timing. Udfald afhænger kun af skoen (Fisher–Yates med `crypto.getRandomValues`); animationer rører aldrig resultatet.
