# 🟢 START HER — VM/turnerings-Manager optimizer (genbrugelig)

Dette repo er en **markedsdrevet, data-drevet motor til holdet.dk-managerspil**.
Det er bygget til VM 2026, men er lavet så det kan genbruges til en ny turnering
(EM, næste VM, Champions League Manager) ved at udskifte data-filerne.

> **To filer indeholder al viden:**
> 1. **`PROJECT_STATE.md`** — reglerne (eksakt pointsystem), modellen, strategi-lærdomme, historik, nuværende hold.
> 2. **Denne fil** — sådan bruger/genstarter du det.
>
> Starter du en frisk AI-session: bed den læse `PROJECT_STATE.md` + `START_HER.md` først, så er den oppe at køre uden samtalehistorik.

═══════════════════════════════════════════════════════════════════
## DEN DESTILLEREDE PLAYBOOK (turnerings-uafhængig — virker hver gang)
═══════════════════════════════════════════════════════════════════
1. **Markedet er bedste signal.** Byg alt på odds: outright (holdstyrke),
   Golden Boot (spiller-målandele), kampodds (per-kamp mål-mu). Modellen er en
   *tynd transformation* af odds → holdet-point, ikke et selvstændigt gæt.
2. **Kaptajnen er den største enkeltedge.** Vælg højeste single-kamp-EV:
   straffeskytte/stjerne på storfavorit MOD ET SVAGT, ÅBENT hold.
   ⚠️ Mål driver kaptajnpoint — IKKE sejrssandsynlighed. En storfavorit mod en
   *parkeret bus* (lavt målloft) er en dårligere kaptajn end en favorit mod et
   åbent, lækkende hold. Tjek altid mål-totals-odds, ikke kun 1X2.
3. **Billigt bagude, dyrt fremme.** "Holdmål +10k til alle på banen" gør billige
   forsvarere på målstærke favoritter mod svage hold ekstremt effektive.
4. **Positions-huller:** lavere position betaler MERE pr. mål (DEF 175k > MID 150k
   > ATT 125k) + clean sheet til DEF. En angriber klassificeret som MID/DEF
   (fx Saibari) = guld. Modellen bruger holdet-positionen × reel målandel.
5. **Kun bekræftede startere.** Heuristik alene fejler (Bremer-fejlen: en reserve
   sat til p_start 0,86). Verificér mod opstillinger hver runde.
6. **Rotation:** Hold der allerede er kvalificeret / spiller dødt opgør → roterer
   → undgå. Knockout = fuld styrke (modsat). Verificér "har holdet noget at spille for?"
7. **Knockout = stak den letteste bracket-vej.** Når lodtrækningen kendes, betyder
   forskellen på en let og svær vej alt. Find holdet med højest P(når finalen) og
   ej flere spillere derfra (nationsgrænsen bortfalder ved kvartfinalerne).
8. **Transfergebyr (1%) er reelt** — undgå unødig churn; favorisér holdbare spillere.
   Et hold der ryger ud mister IKKE værdi (frossen), men koster gebyr at erstatte.
9. **Spil efter din ligaplacering:** Fører/beskytter du? → kopiér feltets chalk
   (lav varians). Jagter du? → differentials (lav-ejede, høj-EV) for at skabe edge.
10. **"Vent en runde"-tricket:** hvis en spiller du ejer har bedre EV i den
    kommende runde end opgraderingen, men opgraderingen har bedre vej derefter —
    behold nuværende én runde, skift før næste. (Haaland R4 → Messi før R5.)

═══════════════════════════════════════════════════════════════════
## MODEL-FILER (hvad gør hvad)
═══════════════════════════════════════════════════════════════════
- `src/scoring.py`     — eksakt holdet-pointsystem (+ `tests/test_scoring.py`)
- `src/model.py`       — gruppespils-ratings-fit + turneringssim + kamp-ankre
- `src/players.py`     — p_start (bekræftede opstillinger) + mål/assist-andele
- `src/simulate.py`    — korreleret vækst-sim (asymmetrisk kaptajnbonus)
- `src/optimize.py`    — flerrunde-ILP (EV-max)
- `run.py`             — GRUPPESPIL: fuld pipeline R1-R7-udsyn
- `optimize_r2.py`     — runde-optimering fra et FAKTISK hold (budget/gebyr)
- **`knockout.py`**    — KNOCKOUT: simulerer det faste R32→finale-bracket,
  giver P(når runde/finale) + forventet vækst pr. spiller pr. runde + ILP.
- `diff_finder.py`     — kampodds-ankret: kaptajn-tjek + differential-finder (ejerskab)
- `r4_table.py` / `r4_final.py` — hold-/udskiftnings-/EV-tabeller, fee-bevidst
- `gen_*.py`           — visuelle holdkort/PDF'er

═══════════════════════════════════════════════════════════════════
## DATA-FILER (udskift disse til en NY turnering)
═══════════════════════════════════════════════════════════════════
- `data/prices.csv`        — holdet-eksport: alle spillere (navn;hold;position;pris;...)
- `data/odds_outright.csv` — vinder-odds pr. hold (american)
- `data/odds_scorer.csv`   — Golden Boot-odds pr. spiller (+ straffeskytte-flag)
- `data/fixtures.csv`      — kampprogram (runde;gruppe;hjemme;ude)
- `data/odds_title_r32.csv`— knockout: titelodds for de tilbageværende hold
- `data/stats_after_r3.csv`— live holdet-eksport (Index/Trend/Aktiv/skader) — opdateres pr. runde
- `data/Regler.txt`        — pointsystemet (kontrollér mod spillets regler!)

═══════════════════════════════════════════════════════════════════
## SÅDAN STARTER DU EN NY TURNERING (fra bunden)
═══════════════════════════════════════════════════════════════════
1. Bekræft pointsystemet i `data/Regler.txt` og opdatér `src/scoring.py` hvis ændret.
2. Læg ny `prices.csv` (holdet-eksport), `odds_outright.csv`, `odds_scorer.csv`,
   `fixtures.csv` ind. Opdatér GROUPS i `src/ingest.py` + bracket i `knockout.py`.
3. `pip install -r requirements.txt`
4. Gruppespil: `python run.py` → R1-hold + transfersti. Verificér opstillinger.
5. Før hver deadline: opdatér odds/opstillinger/bank → genkør `run.py` (gruppe)
   eller `knockout.py` (knockout) → tjek kaptajn (højeste single-kamp-EV).
6. Efter hver runde: hent ny `stats_after_r3.csv`-stil eksport (resultater/priser).

═══════════════════════════════════════════════════════════════════
## PER-RUNDE TJEKLISTE
═══════════════════════════════════════════════════════════════════
[ ] Bekræftede opstillinger (skader/karantæne) — kun startere
[ ] Friske kampodds (1X2 + mål-totals) for rundens kampe
[ ] Bank + aktuelle salgs-/købspriser → budget (husk 1% gebyr)
[ ] Kaptajn = højeste single-kamp-EV (favorit mod svagest/mest åbne, straffeskytte)
[ ] Sælg spillere på udslåede/svære hold; ej holdbare favoritter
[ ] Ligaplacering: chalk (beskyt) vs. differential (jagt)
