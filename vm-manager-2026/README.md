# VM Manager 2026 Optimizer (holdet.dk)

Markedsdrevet Monte Carlo- + optimeringspipeline til holdet.dk's **VM Manager
2026**, bygget efter `PROJECT_INSTRUCTIONS.md`. Modellen er en tynd
transformation af bettingmarkedet → holdet-vækst:

```
outright-odds (48 hold)  ──► rating-fit (titel-sandsynligheder matches eksakt)
kamp-ankre fra markedet  ──► pinner bundholdenes styrke (mu pr. kamp)
Golden Boot-odds (153)   ──► relative målandele pr. hold (longshot-bias-korrigeret)
24.000 korrelerede turneringssimulationer (grupper + R32→finale-bracket)
det EKSAKTE pointsystem  ──► vækst pr. spiller pr. runde
flerrunde-ILP (R1–R7)    ──► hold + transfersti + kaptajner (EV-max, miniliga)
```

## Kør

```bash
pip install -r requirements.txt
python run.py            # guldhold (frie transfers, 1% gebyr)
python run.py --basis    # basishold (max 3 kontrakter)
python tests/test_scoring.py
```

Output: `out/report.md` / `out/report_basis.md` (dansk, med startopstilling,
kaptajn pr. runde, transfers, fordeling, holdbarhed, value-tabel og
deadline-tjekliste). Kørselstid ~85 sek.

## Data (data/)

| Fil | Indhold | Kilde |
|---|---|---|
| `prices.csv` | 1.521 spillere: pris, position, popularitet, ude-status | holdet.dk-eksport (bruger) |
| `odds_outright.csv` | VM-vinderodds, alle 48 hold | BetMGM via Yahoo, jun. 2026 |
| `odds_scorer.csv` | Golden Boot-odds, 153 spillere + straffeskytte-flag | RotoWire, jun. 2026 |
| `fixtures.csv` | Alle 72 gruppekampe med runde (MD1–MD3) | ESPN-kampprogram |
| `Regler.txt` | Det eksakte pointsystem | holdet.dk |

Knockout-bracketen (R32-skabelon med 3'er-allokering, R16→finale) ligger i
`src/model.py` og følger det officielle format.

## Vigtigste modelvalg

- **Titel-odds identificerer ikke bundholdene** (P(titel)≈0 for alle), så svage
  holds ratings pinnes af kamp-ankre fra markedet (`MATCH_ANCHORS`).
- **GB-odds bruges kun relativt inden for hvert hold** — holdets samlede mål
  kommer fra kampodds-laget, ellers dobbelttælles turneringslængden. Absolut
  loft pr. spiller modvirker longshot-bias i halen.
- **Korreleret sim**: alle spillere på samme hold deler scoreline pr. iteration
  (korrekt stack-varians og kaptajn-robusthed).
- **R3 nedvægtes (0.8)** pga. rotation/stakes; R4+ er vejledende og
  genoptimeres når bracketen kendes.
- p_start er heuristisk (pris- og popularitetsrang + GB-floor + håndoverrides)
  — verificér opstillinger før deadline, jf. tjeklisten i rapporten.

## Genkørsel før hver deadline

1. Opdatér `data/odds_*.csv` (og evt. priser/ude-status fra holdet.dk).
2. Justér `P_START_OVERRIDE` i `src/players.py` med bekræftede opstillinger.
3. `python run.py` — rapporten genberegner hold + transfers fra din nuværende trup.

Efter runde 1: kalibrér mod holdets live Index/Vækst (jf. spec §8) — endnu ikke
implementeret (`calibrate.py` er næste fase).
