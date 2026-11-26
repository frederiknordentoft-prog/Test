# AMM-laboratoriet

Simulator for et binært prediction market med LMSR (Hanson): spillerne handler mod huset, men deres nettovolumen bestemmer prisen.

    C(q)    = b·ln(e^(qJA/b) + e^(qNEJ/b))
    pris JA = e^(qJA/b) / (e^(qJA/b) + e^(qNEJ/b))
    køb Δ   koster C(q+Δ) − C(q)
    b       = startkapital / ln(1/min(p0, 1−p0))   → husets maks. tab = startkapital

- `engine.js` – motor uden afhængigheder (browser og Node): LMSR, informerede og tilfældige spillere, nyhedschok, din egen handel og omsætning (samlet og pr. side). Hver simuleret runde er én gennemført handel; standard er 500 spillere og 5.000 handler.
- `index.html` – UI (Chart.js fra cdnjs). Markedet kører live med 2, 10 (standard), 50 eller 250 handler pr. sekund; "Spring til slut" kører resten med det samme. Åbn via en statisk server, fx `python3 -m http.server` i denne mappe.
- `engine.test.js` – `node amm-sim/engine.test.js`: startpris, tabsgrænse, køb+salg uden gebyr, nulsum, b·KL-subsidie, omsætning og gebyr, determinisme.

## Kundevisning

Skift mellem **Operatør** og **Kunde** i den mørke bjælke øverst, mens markedet kører (eller direkte med `#operator` / `#kunde` i adressen).
Kundevisningen er en produktprototype i prediction market-stil: chance i procent med odds inkl. gebyr, graf med 1D/1U/Alt,
købs- og salgsboks med udbetaling og gevinst, din position med cash-out-værdi, live handelsfeed og regler.
Markedet er "Bliver december 2026 varmere end normalt i Danmark?", afgjort efter DMI's månedsopgørelse.

Produktnavnet er konstanten `BRAND` i `index.html` (standard: `Predict`). Skriv jeres eget navn der.
Simuleret ur: markedet åbner 1. nov. 2026 kl. 8, og hver handel svarer til 5 minutter.
