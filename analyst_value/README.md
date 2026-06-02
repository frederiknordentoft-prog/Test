# C25 Analyst Value — tilfører analytikere værdi, eller er det lige så godt at gætte?

Et værktøj + analyse der tester, om finanshuses og eksperters **aktiespådomme**
på danske **C25-aktier** rammer aktiens retning bedre end ren tilfældighed.
Fokus på spådomme der er **1–2 år gamle** (gamle nok til at udfaldet er kendt).

**Benchmark: retning vs. møntkast.** Hver anbefaling (køb/hold/sælg) oversættes
til en retningsspådom (op/ned), og vi måler om aktien faktisk bevægede sig den
vej over de følgende 12 måneder. Det sammenlignes med tre "dumme" strategier:
møntkast (50/50), "sig altid køb" (markedets drift) og tilfældigt gæt (Monte Carlo).

## Hovedresultat (på de tilgængelige data)

| Mål | Værdi |
|---|---|
| Daterede finanshus-kald analyseret | ~260 (Novo Nordisk + Genmab) |
| Retnings-træfsikkerhed | **46 %** |
| Møntkast | 50 % |
| "Sig altid køb" (base rate) | 43 % |
| Slår møntkast? (binomial p) | **Nej** (p ≈ 0,87) |

**Konklusion:** I dette datasæt tilfører analytikerne ikke en statistisk
påviselig edge på retning — at gætte ville have klaret sig lige så godt. Det
eneste, der ligner signal, er *opgraderinger* (firmaet skifter aktivt mening),
mens *reiterations* var nærmest værdiløse. Se notebooken for grafer og nuancer.

## Filer

| Fil | Indhold |
|---|---|
| `c25_analyst_value.ipynb` | **Hovedleverancen** — analysen trin for trin med grafer og fortolkning (kørt, med outputs). |
| `c25_analyst_value.py` | Motoren: hentning, retnings-mapping, evaluering, benchmarks, binomial-test. Kan genbruges som bibliotek/CLI-byggesten. |
| `predictions_manual.csv` | Skabelon til manuelt indtastede kald (Børsen, TV2, Danske/Jyske Bank …). |
| `build_notebook.py` | Genererer notebooken fra kildekode (til vedligehold). |
| `data/` | Cachede, hentede rådata + evaluerede resultater (CSV). |
| `charts/` | Genererede grafer (PNG). |

## Kør selv

```bash
pip install -r requirements.txt
# regenerér + kør analysen (henter friske data fra Yahoo Finance):
python build_notebook.py
jupyter nbconvert --to notebook --execute --inplace c25_analyst_value.ipynb
# eller brug motoren direkte:
python -c "import c25_analyst_value as av; r=av.fetch_ratings(); \
  e=av.evaluate(r, av.fetch_prices(r.price_ticker.unique())); print(av.verdict(e).summary())"
```

## Datakilder og ærlige begrænsninger

- **Automatisk (Yahoo Finance `upgradeDowngradeHistory`):** rig, dateret historik
  findes kun for de C25-navne, der også er US-noterede (ADR) — reelt **Novo
  Nordisk** og **Genmab**. Datasættet rummer både globale huse (Goldman, JP
  Morgan, Morgan Stanley) og nordiske (**Jyske Bank, Handelsbanken, Kepler
  Cheuvreux, Swedbank**). De øvrige 23 C25-selskaber har 0–2 kald og kan ikke
  testes automatisk.
- **Børsen.dk, TV2 Finans, Danske Bank, Jyske Banks egne analyser:** ligger bag
  betalingsmur/kundelogin uden åbent, maskinlæsbart arkiv → kan **ikke** hentes
  automatisk. Indtast dem i `predictions_manual.csv` (dansk Køb/Hold/Sælg
  forstås), så kører samme motor på dem.
- **Forbehold:** lille, pharma-tung stikprøve; "retning" er et groft mål;
  ratings dateres på US-ADR'en mens kurser måles på den danske notering (lille
  FX-støj). Resultaterne er retvisende for *de testede navne*, ikke nødvendigvis
  for hele C25.
