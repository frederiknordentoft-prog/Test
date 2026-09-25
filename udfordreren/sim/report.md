# Balanceringsrapport

200 seeds pr. bot (6 bots) + 60 passive seeds til markedskalibrering. Kørt på 389 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.292, Forsigtig 38, Balanceret 4.046, AI-afviser 4.046, AI-hensynsløs 4.046, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 100 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 25,7, Forsigtig 66,5, Balanceret 85,8, AI-afviser 80,7, AI-hensynsløs 77,2, Tilfældig 45,0; værdi Grådig 0, Forsigtig 2, Balanceret 66.662, AI-afviser 16.801, AI-hensynsløs 187.453, Tilfældig 0; dk-licens 100 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 87 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 26.892 vs. 21.305; eftermæle 77,2 vs. 85,8; påbud 99 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 82 %; værdi 2 vs. 66.662 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 84,0, kasino 87,1 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 90 %, se 2025 84 % (kasino 80 % < betting 93 %), nl 51 %, on 89 %, dk kasino-BSI 4,48 mia., DL nr. 1 93 %, Balanceret dk-andel 2020 9 % |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 184 sek., Top 10 2.012,62, Guldkupon 2.016,62, tidligste nr. 1 2.016,29, tidligste HoF 2.024,35, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 421 pauser, 42 % i AI-akten, spilletid 194 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 25,7 | 29 % | 100 % | 100 % | 0 % | 179 |
| Forsigtig | 2 | 2 | 66,5 | 82 % | 1 % | 37 % | 62 % | 308 |
| Balanceret | 66.662 | 29.478 | 85,8 | 100 % | 0 % | 3 % | 100 % | 421 |
| AI-afviser | 16.801 | 7.430 | 80,7 | 99 % | 1 % | 5 % | 42 % | 379 |
| AI-hensynsløs | 187.453 | 82.892 | 77,2 | 100 % | 90 % | 99 % | 86 % | 433 |
| Tilfældig | 0 | 0 | 45,0 | 0 % | 7 % | 28 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 3 | 101 | 434 | 737 | 2.081 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 1 | 4 | 5 | 4 | 4 | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| Balanceret | 2 | 27 | 150 | 695 | 1.513 | 2.028 | 2.368 | 3.730 | 4.912 | 4.998 | 6.028 | 6.240 |
| AI-afviser | 2 | 27 | 150 | 695 | 1.513 | 2.023 | 2.233 | 3.203 | 3.397 | 3.323 | 2.762 | 139 |
| AI-hensynsløs | 2 | 27 | 150 | 695 | 1.513 | 2.028 | 2.368 | 4.052 | 7.577 | 12.938 | 16.598 | 16.955 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 37 | 745 | 2.766 | 4.930 | 11.488 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 13 | 20 | 22 | 19 | 18 | 12 | 7 | 4 | 2 | 2 | 1 | 1 |
| Balanceret | 24 | 176 | 1.147 | 5.044 | 11.130 | 14.199 | 17.149 | 24.519 | 33.620 | 40.266 | 53.376 | 63.454 |
| AI-afviser | 24 | 176 | 1.147 | 5.044 | 11.130 | 14.330 | 16.919 | 22.145 | 24.856 | 27.913 | 20.542 | 0 |
| AI-hensynsløs | 24 | 176 | 1.147 | 5.044 | 11.130 | 14.199 | 17.149 | 29.230 | 56.942 | 106.731 | 148.386 | 176.200 |
| Tilfældig | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 23 % | 0 % | 0 % | 0 % | 0 % | 7 % | 44 % | 28 % |
| Forsigtig | 0 % | 0 % | 0 % | 0 % | 0 % | 82 % | 0 % | 19 % |
| Balanceret | 0 % | 67 % | 0 % | 30 % | 4 % | 0 % | 0 % | 0 % |
| AI-afviser | 10 % | 11 % | 30 % | 2 % | 0 % | 48 % | 0 % | 1 % |
| AI-hensynsløs | 0 % | 33 % | 0 % | 1 % | 67 % | 0 % | 0 % | 0 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 3 % | 98 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 5332 | 4169 | 40938 | 20246 | 6247 | 800 | 6852 | 5697 | 37839 | 1148 | 7552 | 5187 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 52 % (forventet 50 %)
- Kanaliseringens tilbagetog: 19 % (forventet 25 %)
- Prediction market-omvæltningen: 25 % (forventet 20 %)
- Den hårde hånd: 16 % (forventet 15 %)
