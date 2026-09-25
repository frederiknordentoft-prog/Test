# Balanceringsrapport

200 seeds pr. bot (6 bots) + 60 passive seeds til markedskalibrering. Kørt på 815 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.171, Forsigtig 38, Balanceret 3.811, AI-afviser 3.811, AI-hensynsløs 3.811, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 100 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 26,6, Forsigtig 67,8, Balanceret 86,4, AI-afviser 81,1, AI-hensynsløs 77,5, Tilfældig 45,0; værdi Grådig 0, Forsigtig 2, Balanceret 71.036, AI-afviser 17.307, AI-hensynsløs 188.871, Tilfældig 0; dk-licens 100 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 84 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 31.479 vs. 18.648; eftermæle 77,5 vs. 86,4; påbud 97 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 81 %; værdi 2 vs. 71.036 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 84,8, kasino 87,0 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 89 %, se 2025 84 % (kasino 79 % < betting 93 %), nl 49 %, on 89 %, dk kasino-BSI 4,43 mia., DL nr. 1 98 %, Balanceret dk-andel 2020 9 % |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 184 sek., Top 10 2.012,62, Guldkupon 2.016,62, tidligste nr. 1 2.016,29, tidligste HoF 2.022,37, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 419 pauser, 41 % i AI-akten, spilletid 193 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 26,6 | 35 % | 100 % | 100 % | 0 % | 180 |
| Forsigtig | 2 | 2 | 67,8 | 81 % | 1 % | 31 % | 64 % | 310 |
| Balanceret | 71.036 | 31.412 | 86,4 | 100 % | 0 % | 0 % | 100 % | 419 |
| AI-afviser | 17.307 | 7.653 | 81,1 | 100 % | 1 % | 5 % | 43 % | 385 |
| AI-hensynsløs | 188.871 | 83.519 | 77,5 | 100 % | 88 % | 97 % | 86 % | 433 |
| Tilfældig | 0 | 0 | 45,0 | 0 % | 8 % | 28 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 3 | 101 | 441 | 700 | 2.168 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 1 | 4 | 5 | 4 | 4 | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| Balanceret | 2 | 27 | 150 | 695 | 1.513 | 1.933 | 2.433 | 4.469 | 4.236 | 5.719 | 6.834 | 6.874 |
| AI-afviser | 2 | 27 | 150 | 695 | 1.513 | 1.933 | 2.687 | 4.342 | 3.399 | 3.721 | 2.992 | 2.047 |
| AI-hensynsløs | 2 | 27 | 150 | 695 | 1.513 | 1.933 | 2.433 | 4.505 | 7.471 | 13.654 | 17.872 | 17.800 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 37 | 745 | 2.569 | 4.846 | 12.310 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 13 | 20 | 22 | 19 | 16 | 7 | 6 | 4 | 2 | 2 | 2 | 1 |
| Balanceret | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.294 | 16.529 | 28.814 | 33.793 | 43.681 | 56.837 | 67.171 |
| AI-afviser | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.356 | 17.832 | 27.276 | 29.177 | 29.653 | 23.122 | 0 |
| AI-hensynsløs | 24 | 176 | 1.153 | 5.502 | 10.794 | 14.294 | 16.529 | 30.190 | 56.305 | 105.636 | 156.153 | 185.736 |
| Tilfældig | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 30 % | 0 % | 0 % | 0 % | 0 % | 5 % | 40 % | 26 % |
| Forsigtig | 0 % | 0 % | 0 % | 1 % | 0 % | 80 % | 0 % | 20 % |
| Balanceret | 0 % | 67 % | 0 % | 30 % | 3 % | 0 % | 0 % | 0 % |
| AI-afviser | 12 % | 13 % | 30 % | 1 % | 0 % | 46 % | 0 % | 0 % |
| AI-hensynsløs | 0 % | 33 % | 0 % | 1 % | 67 % | 0 % | 0 % | 0 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 3 % | 98 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5541 | 4105 | 40965 | 20167 | 6237 | 791 | 6834 | 5650 | 38142 | 1563 | 13705 | 5367 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 48 % (forventet 50 %)
- Kanaliseringens tilbagetog: 22 % (forventet 25 %)
- Prediction market-omvæltningen: 22 % (forventet 20 %)
- Den hårde hånd: 14 % (forventet 15 %)
