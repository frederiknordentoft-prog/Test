# Balanceringsrapport

200 seeds pr. bot (6 bots) + 60 passive seeds til markedskalibrering. Kørt på 625 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.171, Forsigtig 38, Balanceret 3.811, AI-afviser 3.811, AI-hensynsløs 3.811, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 100 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 26,7, Forsigtig 67,4, Balanceret 85,8, AI-afviser 80,9, AI-hensynsløs 78,2, Tilfældig 45,0; værdi Grådig 0, Forsigtig 2, Balanceret 71.778, AI-afviser 16.897, AI-hensynsløs 200.197, Tilfældig 0; dk-licens 100 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 90 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 31.513 vs. 18.371; eftermæle 78,2 vs. 85,8; påbud 97 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 83 %; værdi 2 vs. 71.778 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 84,5, kasino 87,0 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | FEJL | dk 2024 88 %, se 2025 83 % (kasino 79 % < betting 93 %), nl 49 %, on 89 %, dk kasino-BSI 4,50 mia., DL nr. 1 98 %, Balanceret dk-andel 2020 9 % — uden for: dk |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 183 sek., Top 10 2.012,62, Guldkupon 2.016,62, tidligste nr. 1 2.016,29, tidligste HoF 2.022,37, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 419 pauser, 42 % i AI-akten, spilletid 193 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 26,7 | 35 % | 100 % | 100 % | 0 % | 181 |
| Forsigtig | 2 | 2 | 67,4 | 83 % | 1 % | 33 % | 64 % | 312 |
| Balanceret | 71.778 | 31.740 | 85,8 | 100 % | 0 % | 0 % | 100 % | 419 |
| AI-afviser | 16.897 | 7.472 | 80,9 | 100 % | 1 % | 4 % | 39 % | 379 |
| AI-hensynsløs | 200.197 | 88.527 | 78,2 | 100 % | 86 % | 97 % | 84 % | 431 |
| Tilfældig | 0 | 0 | 45,0 | 0 % | 8 % | 28 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 3 | 101 | 441 | 700 | 2.168 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 1 | 4 | 5 | 4 | 4 | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| Balanceret | 2 | 27 | 150 | 695 | 1.513 | 1.937 | 2.439 | 4.488 | 4.193 | 5.647 | 6.875 | 7.059 |
| AI-afviser | 2 | 27 | 150 | 695 | 1.513 | 1.881 | 2.694 | 4.152 | 3.409 | 3.662 | 3.114 | 103 |
| AI-hensynsløs | 2 | 27 | 150 | 695 | 1.513 | 1.937 | 2.439 | 4.662 | 8.049 | 13.834 | 18.068 | 18.050 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 37 | 745 | 2.569 | 4.846 | 12.310 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 13 | 20 | 22 | 19 | 16 | 7 | 7 | 5 | 2 | 2 | 2 | 1 |
| Balanceret | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.321 | 16.527 | 28.863 | 33.792 | 44.459 | 58.524 | 66.210 |
| AI-afviser | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.191 | 19.265 | 27.324 | 28.065 | 30.024 | 24.194 | 0 |
| AI-hensynsløs | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.321 | 16.527 | 30.235 | 57.154 | 110.329 | 157.285 | 188.582 |
| Tilfældig | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 29 % | 0 % | 0 % | 0 % | 0 % | 6 % | 40 % | 26 % |
| Forsigtig | 0 % | 0 % | 0 % | 0 % | 0 % | 83 % | 0 % | 18 % |
| Balanceret | 0 % | 68 % | 0 % | 30 % | 3 % | 0 % | 0 % | 0 % |
| AI-afviser | 13 % | 10 % | 30 % | 0 % | 0 % | 49 % | 0 % | 0 % |
| AI-hensynsløs | 0 % | 34 % | 0 % | 1 % | 65 % | 0 % | 0 % | 0 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 3 % | 98 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5442 | 4086 | 41028 | 20208 | 6324 | 791 | 6826 | 5622 | 37885 | 1534 | 13937 | 5331 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 49 % (forventet 50 %)
- Kanaliseringens tilbagetog: 26 % (forventet 25 %)
- Prediction market-omvæltningen: 20 % (forventet 20 %)
- Den hårde hånd: 14 % (forventet 15 %)
