# Balanceringsrapport

16 seeds pr. bot (6 bots) + 8 passive seeds til markedskalibrering. Kørt på 47 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 4.152, Forsigtig 47, Balanceret 4.082, AI-afviser 4.082, AI-hensynsløs 4.082, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 94 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 19,8, Forsigtig 72,6, Balanceret 86,1, AI-afviser 79,1, AI-hensynsløs 74,3, Tilfældig 45,4; værdi Grådig 0, Forsigtig 97, Balanceret 106.171, AI-afviser 23.123, AI-hensynsløs 205.095, Tilfældig 0; dk-licens 94 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 81 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 35.705 vs. 26.851; eftermæle 74,3 vs. 86,1; påbud 88 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 88 %; værdi 97 vs. 106.171 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 79,8, kasino 91,4 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 90 %, se 2025 87 % (kasino 84 % < betting 95 %), nl 50 %, on 89 %, dk kasino-BSI 4,67 mia., DL nr. 1 100 %, Balanceret dk-andel 2020 10 % |
| 9 | Game Dev Story-rytme (Balanceret) | FEJL | første lancering 45 sek., interval 177 sek., Top 10 2.014,17, Guldkupon 2.016,75, tidligste nr. 1 2.017,08, tidligste HoF 2.022,96, gallapris 100 % — fejl: Top 10 |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 433 pauser, 41 % i AI-akten, spilletid 197 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 19,8 | 19 % | 94 % | 100 % | 0 % | 192 |
| Forsigtig | 97 | 97 | 72,6 | 88 % | 0 % | 44 % | 63 % | 320 |
| Balanceret | 106.171 | 46.949 | 86,1 | 94 % | 0 % | 0 % | 94 % | 433 |
| AI-afviser | 23.123 | 10.225 | 79,1 | 94 % | 6 % | 6 % | 50 % | 387 |
| AI-hensynsløs | 205.095 | 90.693 | 74,3 | 94 % | 81 % | 88 % | 81 % | 446 |
| Tilfældig | 0 | 0 | 45,4 | 0 % | 13 % | 25 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 3 | 78 | 768 | 666 | 1.475 | 732 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 2 | 5 | 7 | 7 | 8 | 10 | 13 | 19 | 24 | 30 | 15 | 2 |
| Balanceret | 2 | 27 | 107 | 589 | 1.684 | 2.739 | 3.669 | 5.330 | 6.280 | 6.078 | 7.276 | 9.074 |
| AI-afviser | 2 | 27 | 107 | 589 | 1.684 | 2.732 | 3.915 | 4.890 | 6.388 | 3.105 | 3.165 | 2.874 |
| AI-hensynsløs | 2 | 27 | 107 | 589 | 1.684 | 2.739 | 3.669 | 5.518 | 9.488 | 13.034 | 18.823 | 21.162 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 39 | 514 | 5.097 | 4.620 | 7.919 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 15 | 24 | 27 | 31 | 38 | 45 | 73 | 110 | 118 | 159 | 52 | 1 |
| Balanceret | 27 | 174 | 724 | 4.181 | 11.238 | 17.989 | 24.974 | 40.164 | 47.542 | 53.975 | 70.605 | 102.647 |
| AI-afviser | 27 | 174 | 724 | 4.181 | 11.238 | 17.989 | 25.256 | 32.035 | 46.539 | 25.422 | 22.373 | 20.858 |
| AI-hensynsløs | 27 | 174 | 724 | 4.181 | 11.238 | 17.989 | 24.974 | 43.025 | 77.895 | 103.283 | 153.094 | 207.007 |
| Tilfældig | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 13 % | 0 % | 0 % | 0 % | 0 % | 6 % | 81 % | 0 % |
| Forsigtig | 0 % | 0 % | 0 % | 6 % | 0 % | 81 % | 0 % | 13 % |
| Balanceret | 0 % | 44 % | 0 % | 44 % | 6 % | 0 % | 0 % | 6 % |
| AI-afviser | 19 % | 13 % | 31 % | 6 % | 0 % | 25 % | 0 % | 6 % |
| AI-hensynsløs | 0 % | 38 % | 0 % | 0 % | 56 % | 0 % | 0 % | 6 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 100 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 425 | 303 | 3279 | 1616 | 496 | 61 | 547 | 541 | 3100 | 114 | 1096 | 375 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 48 % (forventet 50 %)
- Kanaliseringens tilbagetog: 28 % (forventet 25 %)
- Prediction market-omvæltningen: 23 % (forventet 20 %)
- Den hårde hånd: 8 % (forventet 15 %)
