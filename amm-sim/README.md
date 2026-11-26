# AMM-laboratoriet

Simulator for et binært prediction market med LMSR (Hanson): spillerne handler mod huset, men deres nettovolumen bestemmer prisen.

    C(q)    = b·ln(e^(qJA/b) + e^(qNEJ/b))
    pris JA = e^(qJA/b) / (e^(qJA/b) + e^(qNEJ/b))
    køb Δ   koster C(q+Δ) − C(q)
    b       = startkapital / ln(1/min(p0, 1−p0))   → husets maks. tab = startkapital

- `engine.js` – motor uden afhængigheder (browser og Node): LMSR, informerede og tilfældige spillere, nyhedschok, din egen handel og omsætning (samlet og pr. side). Hver simuleret runde er én gennemført handel; standard er 500 spillere og 5.000 handler.
- `index.html` – UI (Chart.js fra cdnjs). Åbn via en statisk server, fx `python3 -m http.server` i denne mappe.
- `engine.test.js` – `node amm-sim/engine.test.js`: startpris, tabsgrænse, køb+salg uden gebyr, nulsum, b·KL-subsidie, omsætning og gebyr, determinisme.
