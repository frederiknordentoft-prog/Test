# AMM-laboratoriet

Simulator for et binært prediction market. Samme spillerpopulation og samme tilfældige ordreimpulser sendes gennem tre mekanismer, så forskellene skyldes mekanismen:

| Mekanisme | Modpart | Hvem bærer cold start-risikoen | Maks. tab |
|---|---|---|---|
| CPMM (konstant produkt, FPMM-stil) | Puljen, fuldt dækket af spillernes indskud | LP | → startkapital L |
| LMSR (Hanson) | Huset | Huset | b·ln(1/min(p0, 1−p0)) = startkapital |
| Parimutuel pulje | De andre spillere | Huset, kun startindskud | ≤ startindskud |

- `engine.js` – ren motor uden afhængigheder (browser og Node).
- `index.html` – UI (Chart.js fra cdnjs). Åbn via en statisk server, fx `python3 -m http.server` i denne mappe.
- `engine.test.js` – `node amm-sim/engine.test.js`: startpriser, tabsgrænser, k-invariant, stiuafhængighed, nulsum, determinisme.

Regnskabsidentitet for alle tre: operatørens resultat ved udfald o = netto indskud + gebyrer − udbetaling til spillere(o) = −Σ spillernes resultat.
