# Balanceringsrapport

40 seeds pr. bot (6 bots) + 20 passive seeds til markedskalibrering. Kørt på 123 sek. med 4 workers.

## Assertions (spec 8)

| # | Assertion | Resultat | Detaljer |
|---|---|---|---|
| 1 | Grådig: højeste BSI 2012-20, aldrig højeste eftermæle, bøde i ≥ 60 % | OK | BSI 2012-20 (median, mio.): Grådig 5.123, Forsigtig 38, Balanceret 4.830, AI-afviser 4.830, AI-hensynsløs 4.830, Tilfældig 1; højeste eftermæle i 0 seeds; bøde i 98 % |
| 2 | Balanceret: højeste eftermæle, top 2 på værdi, dansk licens til 2035 i ≥ 85 % | OK | eftermæle Grådig 26,0, Forsigtig 65,5, Balanceret 86,1, AI-afviser 80,5, AI-hensynsløs 77,6, Tilfældig 45,8; værdi Grådig 0, Forsigtig 1, Balanceret 76.778, AI-afviser 22.211, AI-hensynsløs 221.362, Tilfældig 0; dk-licens 100 % |
| 3 | AI-afviser: ≥ 30 % lavere værdi end Balanceret i ≥ 70 % | OK | opfyldt i 93 % |
| 4 | AI-hensynsløs: højere BSI 2026-29 og lavere eftermæle end Balanceret, påbud i ≥ 60 % | OK | BSI 2026-29 33.778 vs. 18.371; eftermæle 77,6 vs. 86,1; påbud 95 % |
| 5 | Forsigtig: overlever i ≥ 70 % og ligger under Balanceret | OK | overlever 80 %; værdi 1 vs. 76.778 |
| 6 | Balanceret: betting- og kasinostart inden for ±20 % i eftermæle | OK | betting 84,5, kasino 88,4 |
| 7 | Intet dødt indhold og alle udfald dækket | OK | alt dækket |
| 8 | Markedskalibrering | OK | dk 2024 90 %, se 2025 84 % (kasino 80 % < betting 93 %), nl 49 %, on 89 %, dk kasino-BSI 4,65 mia., DL nr. 1 100 %, Balanceret dk-andel 2020 10 % |
| 9 | Game Dev Story-rytme (Balanceret) | OK | første lancering 45 sek., interval 187 sek., Top 10 2.012,38, Guldkupon 2.016,65, tidligste nr. 1 2.016,87, tidligste HoF 2.025,79, gallapris 100 % |
| 10 | Pacing: 200-450 beslutningspauser, ≥ 40 % i AI-akten | OK | 423 pauser, 41 % i AI-akten, spilletid 194 min. ved 1x |

## Nøgletal pr. bot (medianer)

| Bot | Værdi (mio.) | Stifternes værdi | Eftermæle | Overlever | Bøde | Påbud | dk-licens 2035 | Pauser |
|---|---|---|---|---|---|---|---|---|
| Grådig | 0 | 0 | 26,0 | 35 % | 98 % | 100 % | 0 % | 174 |
| Forsigtig | 1 | 1 | 65,5 | 80 % | 0 % | 38 % | 57 % | 306 |
| Balanceret | 76.778 | 33.951 | 86,1 | 100 % | 0 % | 0 % | 100 % | 423 |
| AI-afviser | 22.211 | 9.822 | 80,5 | 100 % | 0 % | 3 % | 40 % | 365 |
| AI-hensynsløs | 221.362 | 97.886 | 77,6 | 100 % | 75 % | 95 % | 83 % | 436 |
| Tilfældig | 0 | 0 | 45,8 | 0 % | 5 % | 23 % | 0 % | 18 |

## BSI pr. år (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 4 | 102 | 508 | 672 | 1.978 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 2 | 4 | 5 | 5 | 5 | 3 | 2 | 1 | 0 | 0 | 0 | 0 |
| Balanceret | 2 | 30 | 142 | 787 | 1.782 | 2.186 | 3.741 | 4.633 | 4.193 | 5.774 | 7.668 | 8.225 |
| AI-afviser | 2 | 30 | 142 | 787 | 1.782 | 2.186 | 3.734 | 4.489 | 3.860 | 3.561 | 2.929 | 0 |
| AI-hensynsløs | 2 | 30 | 142 | 787 | 1.782 | 2.186 | 3.741 | 4.879 | 8.962 | 14.593 | 19.578 | 19.872 |
| Tilfældig | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Selskabsværdi ved årets udgang (median, mio. kr.)

| Bot | 2012 | 2014 | 2016 | 2018 | 2020 | 2022 | 2024 | 2026 | 2028 | 2030 | 2032 | 2034 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Grådig | 48 | 745 | 2.789 | 4.796 | 9.990 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Forsigtig | 13 | 21 | 23 | 21 | 23 | 13 | 7 | 5 | 2 | 2 | 1 | 1 |
| Balanceret | 25 | 170 | 1.153 | 5.600 | 11.966 | 16.072 | 24.875 | 28.863 | 32.545 | 44.839 | 63.464 | 74.601 |
| AI-afviser | 25 | 170 | 1.153 | 5.600 | 11.966 | 16.072 | 24.875 | 27.324 | 28.065 | 29.437 | 21.045 | 0 |
| AI-hensynsløs | 25 | 170 | 1.153 | 5.600 | 11.966 | 16.072 | 24.875 | 35.612 | 62.366 | 117.807 | 168.004 | 200.942 |
| Tilfældig | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

## Slutninger

| Bot | Exit | Børsnotering | Leverandøren | Den ansvarlige udfordrer | AI-native leder | Opkøbt af Danske Lykke | Tabt licens | Konkurs |
|---|---|---|---|---|---|---|---|---|
| Grådig | 30 % | 0 % | 0 % | 0 % | 0 % | 5 % | 33 % | 33 % |
| Forsigtig | 0 % | 0 % | 0 % | 0 % | 0 % | 80 % | 0 % | 20 % |
| Balanceret | 0 % | 60 % | 0 % | 35 % | 5 % | 0 % | 0 % | 0 % |
| AI-afviser | 20 % | 5 % | 35 % | 0 % | 0 % | 40 % | 0 % | 0 % |
| AI-hensynsløs | 0 % | 48 % | 0 % | 0 % | 53 % | 0 % | 0 % | 0 % |
| Tilfældig | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 0 % | 100 % |

## Reaktionsregler (antal udløsninger i alt)

| R1 | R2 | R3 | R4 | R5 | R6 | R7 | R8 | R9 | R10 | R11 | R12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1071 | 939 | 8130 | 3965 | 1243 | 155 | 1346 | 986 | 7447 | 349 | 2730 | 1148 |

## Verdensscenarier (andel af spil, der nåede 2026)

- Afgiftsvinteren: 54 % (forventet 50 %)
- Kanaliseringens tilbagetog: 25 % (forventet 25 %)
- Prediction market-omvæltningen: 20 % (forventet 20 %)
- Den hårde hånd: 15 % (forventet 15 %)
