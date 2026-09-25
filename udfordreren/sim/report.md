# Balanceringsrapport

200 seeds pr. bot (6 bots) + 60 passive seeds til markedskalibrering. Kørt på 342 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.472, Forsigtig 38, Balanceret 4.046, AI-afviser 4.046, AI-hensynsløs 4.046, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 99 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 27,0, Forsigtig 66,5, Balanceret 85,7, AI-afviser 80,7, AI-hensynsløs 62,1, Tilfældig 44,9; værdi Grådig 0, Forsigtig 1, Balanceret 75.660, AI-afviser 18.421, AI-hensynsløs 194.529, Tilfældig 0; dk-licens 100 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 88 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 27.754 vs. 19.745; eftermæle 62,1 vs. 85,7; påbud 98 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 82 %; værdi 1 vs. 75.660 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 84,3, kasino 87,9 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 90 %, se 2025 84 % (kasino 80 % < betting 93 %), nl 51 %, on 89 %, dk kasino-BSI 4,48 mia., DL nr. 1 93 %, Balanceret dk-andel 2020 9 % |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 187 sek., Top 10 2.012,62, Guldkupon 2.016,62, tidligste nr. 1 2.016,29, tidligste HoF 2.023,58, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 426 pauser, 43 % i AI-akten, spilletid 195 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 27,0 | 33 % | 99 % | 100 % | 0 % | 179 |
| Forsigtig | 1 | 1 | 66,5 | 82 % | 1 % | 38 % | 63 % | 308 |
| Balanceret | 75.660 | 33.457 | 85,7 | 100 % | 1 % | 2 % | 100 % | 426 |
| AI-afviser | 18.421 | 8.146 | 80,7 | 100 % | 1 % | 7 % | 43 % | 391 |
| AI-hensynsløs | 194.529 | 86.021 | 62,1 | 99 % | 98 % | 98 % | 30 % | 444 |
| Tilfældig | 0 | 0 | 44,9 | 0 % | 7 % | 29 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 3 | 111 | 504 | 735 | 2.038 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 1 | 4 | 5 | 4 | 4 | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| Balanceret | 2 | 27 | 146 | 695 | 1.577 | 1.911 | 2.674 | 3.939 | 4.899 | 5.287 | 6.070 | 6.521 |
| AI-afviser | 2 | 27 | 146 | 695 | 1.577 | 2.058 | 2.547 | 3.883 | 3.763 | 3.427 | 3.038 | 1.602 |
| AI-hensynsløs | 2 | 27 | 146 | 695 | 1.577 | 1.911 | 2.674 | 4.172 | 6.770 | 12.159 | 15.449 | 14.913 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 15 | 627 | 1.645 | 3.868 | 11.163 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 5 | 20 | 22 | 19 | 18 | 12 | 7 | 4 | 2 | 2 | 1 | 1 |
| Balanceret | 11 | 130 | 658 | 4.524 | 11.527 | 15.741 | 21.025 | 26.809 | 37.827 | 48.534 | 61.547 | 72.750 |
| AI-afviser | 11 | 130 | 658 | 4.524 | 11.527 | 15.682 | 20.656 | 25.991 | 30.904 | 33.109 | 28.312 | 0 |
| AI-hensynsløs | 11 | 130 | 658 | 4.524 | 11.527 | 15.741 | 21.025 | 26.715 | 57.241 | 122.063 | 166.676 | 179.913 |
| Tilfældig | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 29 % | 0 % | 0 % | 0 % | 0 % | 4 % | 37 % | 31 % |
| Forsigtig | 0 % | 0 % | 0 % | 0 % | 0 % | 82 % | 0 % | 19 % |
| Balanceret | 0 % | 68 % | 0 % | 29 % | 3 % | 0 % | 0 % | 1 % |
| AI-afviser | 8 % | 9 % | 34 % | 0 % | 0 % | 50 % | 0 % | 1 % |
| AI-hensynsløs | 0 % | 32 % | 0 % | 0 % | 68 % | 0 % | 1 % | 1 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 3 % | 98 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5285 | 4139 | 40982 | 20192 | 6273 | 794 | 6833 | 5420 | 38414 | 1168 | 7853 | 5179 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 51 % (forventet 50 %)
- Kanaliseringens tilbagetog: 23 % (forventet 25 %)
- Prediction market-omvæltningen: 19 % (forventet 20 %)
- Den hårde hånd: 14 % (forventet 15 %)
