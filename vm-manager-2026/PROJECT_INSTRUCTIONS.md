# PROJECT_INSTRUCTIONS.md — VM Manager 2026 Optimizer

> Final-produkt-spec til Claude Code. Byg en markedsdrevet Monte Carlo- +
> optimeringspipeline til holdet.dk's **VM Manager 2026**. Genkøres før hver
> rundedeadline. Kode/identifiers på engelsk, output/forklaringer på dansk.

---

## 0. Mål og designprincip

**Objektiv:** Maksimér **forventet vækst (EV)** = bedste *gennemsnitlige* slutplacering.
Brugeren spiller i en **lille miniliga (vennegruppe)**, ikke for at vinde et felt på
100.000+. Konsekvenser:

- **EV er den primære og default-objektivfunktion.** I en lille liga vinder konsistent
  høj EV næsten altid. Vild differential-jagt er forkert her.
- Korreleret simulation bruges til at rapportere **fordeling/varians** af det valgte
  hold og til **robust kaptajnvalg** — ikke til at maksimere en høj fraktil.
- En **kvantil-/differential-tilstand** bygges som *valgfri toggle* (default OFF), så
  brugeren senere kan skifte mål uden at omskrive noget.

**Designprincip:** Modellen er en **tynd transformation af bettingmarkedet → holdet-point**,
ikke et selvstændigt gæt. Markedet er det bedste signal vi har:

```
1X2 + totals odds   ──► Dixon-Coles ──► mu_for / mu_against pr. kamp pr. runde
anytime-scorer odds ──► de-vig       ──► forventede mål pr. spiller (lambda_p)
assist odds         ──► de-vig       ──► forventede assists pr. spiller
forventede opstillinger             ──► p_start (spilletid)
holdet pointsystem (eksakt, §3)     ──► vækst i kr.
ILP                                 ──► optimal flerrundeplan (EV)
```

Hvor markedsdata mangler, falder modellen tilbage på xG-andele (sekundært signal).

---

## 1. Repo-struktur

```
vm-manager-2026/
├── PROJECT_INSTRUCTIONS.md          # dette dokument
├── config.yaml                      # parametre, stier, toggles
├── data/
│   ├── prices.csv                   # brugerens holdet-eksport (INPUT)
│   ├── odds_match.csv               # 1X2 + totals pr. kamp pr. runde
│   ├── odds_scorer.csv              # anytime-scorer + assist odds pr. spiller
│   ├── lineups.csv                  # p_start pr. spiller (fra opstillinger)
│   ├── fixtures.csv                 # kampprogram: runde, hjemme, ude, neutral
│   └── live_index.csv              # EFTER R1: holdet Index/Vækst/ejerskab
├── src/
│   ├── ingest_prices.py             # parser holdet-eksport -> players-tabel
│   ├── ingest_odds.py               # de-vig + Dixon-Coles -> mu_for/against
│   ├── ingest_scorer.py             # anytime/assist odds -> lambda_p
│   ├── scoring.py                   # det eksakte holdet-pointsystem (§3)
│   ├── simulate.py                  # KORRELERET Monte Carlo (§5)
│   ├── optimize.py                  # ILP flerrundeplan (§6)
│   ├── report.py                    # dansk output + deadline-tjekliste
│   └── calibrate.py                 # EFTER R1: backtest mod live Index
├── tests/
│   └── test_scoring.py              # enhedstests på pointsystemet
├── run.py                           # entrypoint: python run.py --round R1
└── requirements.txt                 # numpy, pandas, scipy, pulp, pyyaml, requests
```

---

## 2. Datainput

### 2.1 prices.csv (brugeren leverer)
Eksport fra holdet.dk's transfercenter. Kolonner (dansk, kan variere lidt — lav en
**tolerant, config-styret kolonne-mapping** med auto-detektion af separator):

| Kolonne | Betydning | Brug |
|---|---|---|
| `Navn` | spillernavn | nøgle |
| `Land · Position` *(eller separate)* | nation + position | join + pos-map |
| `Pris` | fx `2.000.000` (punktum = tusindsep.) | budget (mio.) |
| `Totalvækst`,`Vækst`,`Mål`,`Assist` | 0 før kickoff; reelle efter runder | calibrate |
| `Gule`,`Røde`,`Sk`(skud),`Rd`(redninger) | hændelser | calibrate |
| `Pop.` | ejerskab % | differential (valgfri) |
| `Trend`,`Index` | popularitet / værdiindeks | calibrate |

**Position-map (dansk → kode):** `Målvogter→GK, Forsvar→DEF, Midtbane→MID, Angriber→ATT`.

**Pris-parsing:** fjern punktummer (tusindsep.), divider med 1.000.000 → mio. float.
**OBS:** punktum er tusindsep. i `Pris`, men decimal i `Pop.` (fx `0.1 %`). Parse
kolonnevis, ikke globalt.

Hvis brugeren i stedet pastes 3-linje-format (Navn / "Land · Position" / tab-række),
understøt også det. Reuse denne parser-kerne:

```python
POS = {"Målvogter":"GK","Forsvar":"DEF","Midtbane":"MID","Angriber":"ATT"}
def price_to_m(x):  # "2.000.000" -> 2.0
    return float(str(x).replace(".","").replace(" ","")) / 1_000_000
```

### 2.2 fixtures.csv
`round,home,away,neutral,date`. VM 2026: alle kampe `neutral=True` undtagen
værtsnationer (Mexico/Canada/USA spiller "hjemme" i nogle byer → lille home-edge).
Inkludér gruppespillet (R1–R3) + knockout efterhånden.

### 2.3 odds_match.csv
`round,home,away,odds_home,odds_draw,odds_away,odds_over25,odds_under25`.
Kilde: **The Odds API** (brugeren har brugt den før). Hent dansk-licens-bookmakere
eller Pinnacle (skarpest). Se §4 for ingestion.

### 2.4 odds_scorer.csv
`round,player,team,anytime_odds,assist_odds(optional),pen_taker(bool),sp_taker(bool)`.
Anytime-scorer-markedet er det **primære** spillersignal. Hvor det ikke findes for
en kamp (svage modstandere mangler ofte marked), falder tilbage på xG-andel.

### 2.5 lineups.csv
`player,p_start(0-1),exp_min`. Fra forventede opstillinger. Internationale gratis-kilder:
**RotoWire** (har også dødbolds-/straffeskytter), **Sports Mole**, **bulinews**,
**lastwordonsports**, **Goal**. Bold+ (betalingsmur) hentes via Chrome-extension.

### 2.6 live_index.csv (EFTER runde 1)
Holdet-eksport med reelle `Index/Vækst/Pop`. Den **bedste** kalibreringskilde — henter
modellen tilbage til virkeligheden. Hentes via Chrome-extension (gated).

---

## 3. Pointsystem (eksakt — aflæst fra holdet.dk's regler)

**Implementér NØJAGTIGT dette i `scoring.py`. Enhedstest hver linje.**

```python
SCORING = {
    # Mål og assist (vækst i kr.)
    "goal":        {"GK":250_000, "DEF":175_000, "MID":150_000, "ATT":125_000},
    "own_goal":    -50_000,
    "assist":       60_000,        # IKKE ved straffe, selvmål, rebound (§noter)
    "shot_on_target": 10_000,      # pr. skud på mål (inkl. det skud der bliver mål)

    # Afgørende scoring (til målscoreren af det afgørende mål)
    "decisive_win": 40_000,
    "decisive_draw":20_000,

    # Kampens spiller (1 pr. kamp)
    "motm":         33_000,

    # Fairplay
    "yellow":      -20_000,
    "second_yellow":-20_000,
    "red":         -50_000,

    # Holdpræstation (til ALLE spillere i kamprapporten)
    "result":      {"W":25_000, "D":5_000, "L":-8_000},
    "team_goal":    10_000,        # pr. mål holdet scorer
    "conceded":    -8_000,         # pr. mål holdet indkasserer

    # Special
    "appear":       7_000,         # på banen
    "no_appear":   -5_000,         # i truppen, men ikke på banen
    "clean_sheet": {"GK":75_000, "DEF":50_000, "MID":0, "ATT":0},  # kræver spillet
    "gk_save":      5_000,         # pr. redning
    "saved_penalty":100_000,
    "missed_penalty":-30_000,
    "hattrick":     100_000,
    "shootout_win": 25_000,        # straffesparkskonkurrence (knockout)

    # Finans
    "captain_mult": 2.0,           # Kaptajnbonus = Vækst * 1  =>  x2
    "bank_rate":    0.01,          # 1% rente pr. runde af uforbrugt budget
    "transfer_rate":0.01,          # 1% (10k/mio.) af KØBT spillers pris; R1-opbygning gratis
}
BUDGET = 50.0  # mio.
```

**Vigtige strukturelle pointer der følger af systemet:**
- **`team_goal +10k til ALLE`** gør billige forsvarere/midtbane på *målstærke* favoritter
  meget effektive. Et forsvar mod en svag modstander, der vinder 4-0, giver hver
  forsvarsspiller `25k(sejr) + 4×10k(holdmål) + 50k(clean sheet) + 7k = 122k` før
  egne hændelser. Dette er det største ikke-indlysende edge i spillet.
- **`shot_on_target +10k`** belønner skudglade spillere — men skal **modstandersjusteres**
  (færre skud på mål mod eliteforsvar), ellers overvurderes stjerner i deres svære kampe.
- **`no_appear -5k`** straffer ubekræftede startere → p_start-kvalitet er afgørende.
- **Kaptajn = ren fordobling** (ikke værdiskaleret). Vælg kaptajn = højeste single-EV pr. runde.

---

## 4. Odds-ingestion

### 4.1 De-vig (fjern bookmaker-margin)
For 1X2: `p_i = (1/o_i) / Σ(1/o_j)`. For 2-vejs (over/under) tilsvarende.
For anytime-scorer (mange udfald + overround): de-vig ved at skalere alle spilleres
implied prob, så de er konsistente med holdets forventede mål (§4.3).

### 4.2 Team-lag: Dixon-Coles pr. kamp (mu_for / mu_against)
**Primær (robust) metode — løs hver kamp uafhængigt:** find `(lambda_home, lambda_away)`
så en Dixon-Coles-model reproducerer de de-viggede `P(H),P(D),P(A)` (og P(over 2.5)
hvis tilgængelig). Brug Dixon-Coles lavscorings-korrektion `tau(x,y;rho)` med
`rho ≈ -0.05`. Neutral bane: home-edge = 0 (undtagen værtsnationer: lille +).

```python
from scipy.optimize import least_squares
from scipy.stats import poisson
import numpy as np

def dc_tau(x,y,lh,la,rho):
    if   x==0 and y==0: return 1 - lh*la*rho
    elif x==0 and y==1: return 1 + lh*rho
    elif x==1 and y==0: return 1 + la*rho
    elif x==1 and y==1: return 1 - rho
    return 1.0

def match_probs(lh, la, rho=-0.05, maxg=10):
    P = np.zeros((maxg,maxg))
    for x in range(maxg):
        for y in range(maxg):
            P[x,y] = dc_tau(x,y,lh,la,rho)*poisson.pmf(x,lh)*poisson.pmf(y,la)
    P /= P.sum()
    pH = np.tril(P,-1).sum(); pD = np.trace(P); pA = np.triu(P,1).sum()
    pOver = sum(P[x,y] for x in range(maxg) for y in range(maxg) if x+y>2)
    return pH,pD,pA,pOver

def solve_lambdas(pH,pD,pA,pOver=None):
    target = [pH,pD,pA] + ([pOver] if pOver is not None else [])
    def resid(z):
        lh,la = np.exp(z)             # positivitet
        h,d,a,o = match_probs(lh,la)
        out = [h-pH, d-pD, a-pA] + ([o-pOver] if pOver is not None else [])
        return out
    z = least_squares(resid, np.log([1.4,1.1])).x
    return float(np.exp(z[0])), float(np.exp(z[1]))   # mu_for_home, mu_for_away
```
→ For hvert hold pr. runde: `mu_for = lambda_eget`, `mu_against = lambda_modstander`.

**Valgfri forbedring:** turneringsbred DC-fit (attack/defense pr. nation + home-adv)
med tids-vægtning. Ikke nødvendigt for kvalitet; per-kamp-løsningen er markedsfaithful.

### 4.3 Spiller-lag: anytime-scorer → forventede mål
Anytime `P(scorer ≥1)` (de-vigget) → Poisson-lambda pr. spiller:
`lambda_p = -ln(1 - P_anytime)`.
Skaler holdets spilleres `lambda_p` så `Σ lambda_p (startere) ≈ mu_for_team` (binder
spiller- og holdlag sammen og fjerner residual-vig). Assists fra assist-odds tilsvarende,
ellers `assist_share`-fallback. **Straffeskytte-flag**: flyt holdets straffe-EV til
pen-taker (markedet gør det delvist; flag sikrer det).

Hvor anytime-marked mangler (svage kampe): fallback til xG-andel × mu_for_team.

---

## 5. Korreleret Monte Carlo (`simulate.py`)

**Kerneforbedring ift. prototypen:** simulér hver **KAMP** én gang pr. iteration, så alle
spillere på samme hold deler samme scoreline. Det giver korrekt **korrelation for stacks**
(vigtigt for fordeling/varians og kaptajn-robusthed). EV påvirkes ikke af korrelation
(E[Σ]=ΣE), så ILP'en (§6) bruger bare per-spiller-means — men rapportering og evt.
kvantiltilstand kræver den korrelerede sim.

**Algoritme (pr. iteration s = 1..N, N≈50.000):**

```
for hver kamp m i runden:
    træk (tg, tc) ~ Dixon-Coles(mu_for_m, mu_against_m)        # delt scoreline
    fordel holdets tg mål på spillere ~ Multinomial(tg, w_scorer)   # w fra lambda_p
    fordel assists ~ Multinomial(assisterede mål, w_assist)
    træk skud på mål pr. spiller ~ Poisson(sot_rate * mf * opp_adj) # opp_adj = clip(mu_for/1.6, .55, 1.6)
    motm = vælg 1 spiller i kampen ~ vægtet af (mål+assist+rolle), oftere på vinderhold
    kort ~ Bernoulli(card_p[pos])
for hver spiller p (i brugerens kandidatunivers):
    minutter ~ start(p_start) ? N(exp_min,6) : indhop/0   # 0 => no_appear -5k
    growth_p[s] = scoring(p, kampudfald, minutter)        # §3, ALLE komponenter
```

`scoring()` summerer: mål(pos) + assist + skud×10k + clean_sheet(pos hvis tc==0 & spillet)
+ result(W/D/L) + tg×10k − tc×8k + decisive(≈0.35-vægt hvis scorer & afgørende)
+ motm×33k + appear/no_appear + gk_saves(GK) + hattrick(≥3 mål) + cards.

**Output:** `mean[round][player]`, `std[round][player]`, og — for et givet hold —
den fulde fordeling af samlet vækst (sum over samme-iteration spillergrowths).

---

## 6. Optimering (`optimize.py`)

### 6.1 Primær: EV-maksimerende flerrunde-ILP (default)
Beslut R1-hold **og** transferstien R1→R2→R3 samlet (pulp/CBC). Variabler pr. runde:
`x[r,i]` (på holdet), `c[r,i]` (kaptajn), `buy[r,i]` (købt ind den runde).

```
maximize  Σ_r w_r [ Σ_i mean[r,i]·x[r,i] + Σ_i mean[r,i]·(captain_mult-1)·c[r,i] ]
          − Σ_{r≥2} Σ_i fee_i·buy[r,i]                      # fee_i = price_i·10_000
          (+ bank_rate·1e6·(BUDGET_r − Σ price·x)  — valgfri, lille; se note)
s.t.  Σ_i x[r,i] = 11                       (hver runde)
      Σ_i price_i·x[r,i] ≤ BUDGET_r         (BUDGET_r vokser ~2.2%/runde pga. værditilvækst)
      formation: GK=1, DEF∈[3,5], MID∈[2,5], ATT∈[1,3]
      Σ_i c[r,i] = 1 ;  c[r,i] ≤ x[r,i]
      buy[r,i] ≥ x[r,i] − x[r-1,i]          (x[0,·]=0; R1-opbygning gratis)
```
`w_r`: rundevægte. Default `R1=1.0, R2=1.0, R3=0.8` (R3 er et "puslespil" — hold/hviler/
indsats ukendt; nedvægt til deadline-info lander). **Bankrente holdes UDE af objektivet
som driver** (1%/runde overinciterer kontant-hamstring urealistisk); rapportér den separat.

### 6.2 Minilig-tilpasning (dette er brugerens mål)
- Ren EV er korrekt for en lille liga. Behold default.
- Tilføj **valgfri** let differential-justering: `mean'[r,i] = mean[r,i] − λ·ownership_i`
  (λ default 0). Sæt λ>0 KUN hvis brugeren vil have en lille edge mod template-valg i
  vennegruppen — men advar: det koster EV. Til en minliga er λ=0 eller meget lille rigtigst.

### 6.3 Valgfri: kvantil-/vinder-tilstand (default OFF)
Til "vinde et stort felt" senere: simulér mange kandidathold korreleret (§5) og maksimér
`P(samlet vækst ≥ target)` eller en høj fraktil. Brug greedy/lokalsøgning ovenpå ILP-løsningen.
**Ikke brugerens mål nu — byg som toggle, lad den ligge.**

---

## 7. Output (`report.py`)

Dansk, copy-paste-venligt. Pr. runde:
- **Startopstilling** (formation, GK/DEF/MID/ATT), pris, modstander, forventet vækst, std.
- **Kaptajn** + vicekaptajn (næsthøjeste single-EV).
- **Transfers IN/OUT**, gebyr, og netto-effekt (brutto − gebyr).
- **Holdets fordeling**: middel, std, P25–P75 (fra korreleret sim) → "hvor sikkert er holdet".
- **Value-tabel**: vækst pr. mio. (find billige enablers).
- **Deadline-tjekliste**: spillere med startrisiko (`p_start<0.75`) at verificere; spillere
  hvis kamp-EV falder næste runde (sælg-kandidater); bedste transfer-ind-kandidater.

---

## 8. Kør & kalibrér (runbook)

```bash
python run.py --round R1     # før hver deadline: ingest -> simulate -> optimize -> report
```

**Før hver deadline:** opdatér `odds_match.csv`, `odds_scorer.csv`, `lineups.csv` (de
ændrer sig mest), genkør.

**Efter runde 1 (vigtigst):** hent `live_index.csv` fra holdet (Chrome-extension) →
`calibrate.py` sammenligner modellens forventede vækst mod faktisk Index/Vækst →
juster `sot_rate`, decisive/motm-vægte og evt. `mu_for`-skalering, så modellen rammer
virkeligheden. Dette løfter R2–R7 markant.

**Arbejdsdeling Code vs. Chrome-extension:**
- **Code** ejer alt: CSV, The Odds API, Dixon-Coles, simulation, ILP, rapport, kalibrering.
- **Chrome-extension** henter det *gated*, som API/web-fetch ikke ser:
  holdet live Index/ejerskab, Bold+ opstillinger, og anytime-scorer/assist-odds hvis de
  ikke er i din Odds-API-tier. Eksportér til de CSV'er Code læser.

---

## 9. Faseplan (byg i denne rækkefølge)

- **Fase 0 — Scaffold:** repo, `config.yaml`, `requirements.txt`, tomme moduler, `run.py`-skelet.
- **Fase 1 — Priser + pointsystem:** `ingest_prices.py` (tolerant CSV/paste-parser),
  `scoring.py` (eksakt §3) + `tests/test_scoring.py` (verificér hver linje med håndregnede cases).
- **Fase 2 — Odds-ingestion:** `ingest_odds.py` (de-vig + Dixon-Coles §4.2),
  `ingest_scorer.py` (anytime→lambda_p §4.3). Enhedstest de-vig (summer til 1) og
  lambda-løsning (reproducér input-odds).
- **Fase 3 — Korreleret sim:** `simulate.py` (§5). Sanity: en spiller på et 4-0-favorithold
  giver højere forsvars-EV end på et 1-0-grindhold.
- **Fase 4 — Optimering:** `optimize.py` (EV-ILP §6.1) + minilig-default (§6.2).
  Kvantil-toggle som stub (§6.3).
- **Fase 5 — Rapport:** `report.py` (§7) + deadline-tjekliste.
- **Fase 6 — Kalibreringsloop:** `calibrate.py` (efter R1, §8).

**Seed:** Start fra den vedlagte prototype `vm_manager_plan.py` (Monte Carlo + ILP +
det fulde pointsystem virker allerede). Porter den ind, og erstat de håndskønnede
mu_for/mu_against og xG-andele med markedsdata fra Fase 2, og den uafhængige sim med
den korrelerede i Fase 3.

---

## 10. Acceptkriterier (final produkt)

1. `python run.py --round R1` producerer en komplet R1-plan + R2/R3-udsyn på <60 sek.
2. `scoring.py` består alle enhedstests mod håndregnede point.
3. Ingen håndskønnede holdstyrker tilbage: alle mu_for/mu_against og spiller-lambdaer
   stammer fra de-viggede odds (med dokumenteret xG-fallback hvor marked mangler).
4. Skud-på-mål er modstandersjusteret (stjerner overvurderes ikke mod eliteforsvar).
5. Optimeringen respekterer budget, formation og transfergebyrer; kaptajn vælges pr. runde.
6. Default-objektiv = EV (minliga). Kvantiltilstand findes som dokumenteret, slukket toggle.
7. Rapporten er på dansk med startopstilling, kaptajn, transfers, fordeling og deadline-tjekliste.
8. `calibrate.py` kan indlæse holdet live Index efter R1 og foreslå justeringer.
